#!/usr/bin/env node

/**
 * Bulk importer for NOC reference data.
 *
 * Usage:
 *   node scripts/import-noc-codes.js [--file2021 path] [--file2016 path]
 *
 * DB connection uses environment variables:
 *   DB_HOST, DB_PORT (optional), DB_USER, DB_PASS, DB_NAME
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { parse } = require("csv-parse/sync");

const DEFAULT_FILES = {
  "2021": path.resolve(__dirname, "../docs/data/NOC 2021/noc_2021_version_1.0_-_elements.csv"),
  "2016": path.resolve(__dirname, "../docs/data/NOC 2016/noc_2016_version_1.3_-_elements.csv"),
};

const VERSION_META = {
  "2021": {
    label: "National Occupational Classification 2021 Version 1.0",
    description: "Five-digit TEER structure released September 2022",
    displayOrder: 1,
  },
  "2016": {
    label: "National Occupational Classification 2016 Version 1.3",
    description: "Four-digit skill type/level structure",
    displayOrder: 2,
  },
};

const CHUNK_SIZE = 500;

function normaliseSearch(value) {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function resolveCodeColumn(record) {
  const keys = Object.keys(record).map(key => key.trim());
  let match = keys.find(key => key.toLowerCase().startsWith("code - noc"));
  if (match) return match;
  match = keys.find(key => key.toLowerCase() === "code");
  if (match) return match;
  match = keys.find(key => key.toLowerCase() === "noc");
  if (match) return match;
  return undefined;
}

function resolveTitleColumn(record) {
  const direct = Object.keys(record).find(key => key.toLowerCase() === "class title");
  if (direct) return direct;
  const fallback = Object.keys(record).find(key => key.toLowerCase().includes("class title"));
  return fallback;
}

function ensureDbConfig() {
  const { DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error("DB_HOST, DB_USER, and DB_NAME must be set in the environment for the importer.");
  }
  return {
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS || "",
    database: DB_NAME,
    port: DB_PORT ? Number(DB_PORT) : 3306,
    multipleStatements: false,
  };
}

async function importDataset(connection, { version, filePath }) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[noc-import] Skipping version ${version}: file not found at ${filePath}`);
    return;
  }

  const csvContent = fs.readFileSync(filePath, "utf8");
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  if (!records.length) {
    console.warn(`[noc-import] No rows parsed for version ${version} (${filePath}).`);
    return;
  }

  const codeKey = resolveCodeColumn(records[0]);
  const titleKey = resolveTitleColumn(records[0]);
  const levelKey = Object.keys(records[0]).find(key => key.toLowerCase() === "level");

  if (!codeKey || !titleKey) {
    throw new Error(
      `[noc-import] Unable to locate required columns in ${filePath} (codeKey=${codeKey}, titleKey=${titleKey}).`
    );
  }

  const collected = new Map();
  for (const row of records) {
    const codeRaw = row[codeKey];
    const titleRaw = row[titleKey];
    const levelRaw = levelKey ? row[levelKey] : null;
    if (!codeRaw || !titleRaw) continue;
    // Only keep occupational unit groups (level 5) for 2021; 2016 dataset uses four-digit codes uniformly.
    if (version === "2021" && levelRaw && String(levelRaw).trim() !== "5") continue;
    const code = String(codeRaw).trim();
    const title = String(titleRaw).trim();
    if (!code || !title) continue;
    if (!collected.has(code)) {
      collected.set(code, title);
    }
  }

  if (collected.size === 0) {
    console.warn(`[noc-import] No codes collected for version ${version}; skipping.`);
    return;
  }

  const meta = VERSION_META[version] || {
    label: `National Occupational Classification ${version}`,
    description: null,
    displayOrder: 99,
  };

  console.log(`[noc-import] Importing ${collected.size} NOC codes for version ${version} from ${filePath}`);

  await connection.beginTransaction();
  try {
    await connection.query(
      `
        INSERT INTO noc_version (code, label, description, is_active, display_order)
        VALUES (?, ?, ?, 1, ?)
        ON DUPLICATE KEY UPDATE
          label = VALUES(label),
          description = VALUES(description),
          is_active = VALUES(is_active),
          display_order = VALUES(display_order),
          updated_at = CURRENT_TIMESTAMP
      `,
      [version, meta.label, meta.description, meta.displayOrder]
    );

    await connection.query(`DELETE FROM noc_code WHERE version_code = ?`, [version]);

    const values = Array.from(collected.entries()).map(([code, title], index) => [
      code,
      version,
      title,
      normaliseSearch(title),
      1,
      index + 1,
    ]);

    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);
      await connection.query(
        `INSERT INTO noc_code (code, version_code, title, search_title, is_active, display_order) VALUES ?`,
        [chunk]
      );
    }

    await connection.commit();
    console.log(`[noc-import] Completed version ${version}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const customFiles = {};

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!value) {
      throw new Error(`Expected value after ${flag}`);
    }
    if (flag === "--file2021") {
      customFiles["2021"] = path.resolve(process.cwd(), value);
    } else if (flag === "--file2016") {
      customFiles["2016"] = path.resolve(process.cwd(), value);
    } else {
      throw new Error(`Unknown flag ${flag}. Supported flags: --file2021, --file2016`);
    }
  }

  const datasets = Object.entries(DEFAULT_FILES)
    .map(([version, defaultPath]) => ({
      version,
      filePath: customFiles[version] || defaultPath,
    }))
    .filter(item => fs.existsSync(item.filePath));

  if (datasets.length === 0) {
    console.log("[noc-import] No input files found. Provide CSV paths via --file2021 / --file2016.");
    process.exit(0);
  }

  const dbConfig = ensureDbConfig();
  const connection = await mysql.createConnection(dbConfig);
  try {
    for (const dataset of datasets) {
      await importDataset(connection, dataset);
    }
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error("[noc-import] Failed:", error);
  process.exit(1);
});
