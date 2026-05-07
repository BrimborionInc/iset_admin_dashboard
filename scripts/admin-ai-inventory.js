#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function listFiles(dir, predicate = () => true) {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .flatMap(entry => {
      const relative = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(relative, predicate);
      return predicate(relative) ? [relative.replace(/\\/g, "/")] : [];
    })
    .sort();
}

function extractRoutes() {
  const relativePath = "src/routes/AppRoutes.js";
  const source = readText(relativePath);
  const routes = [];
  const routePattern = /<Route\s+path="([^"]+)"([^>]*)>/g;
  let match;
  while ((match = routePattern.exec(source))) {
    routes.push({
      route: match[1],
      exact: /\bexact\b/.test(match[2] || ""),
      line: lineNumberAt(source, match.index),
      source: relativePath,
    });
  }
  return routes;
}

function extractHelpPanels() {
  return listFiles("src/helpPanelContents", file => /\.(js|jsx)$/.test(file)).map(file => {
    const source = readText(file);
    const componentMatch =
      source.match(/const\s+([A-Za-z0-9_]+)\s*=\s*/) ||
      source.match(/function\s+([A-Za-z0-9_]+)/);
    const aiContextMatch = source.match(/\.aiContext\s*=\s*(`(?:[\s\S]*?)`|'(?:[\s\S]*?)'|"(?:[\s\S]*?)")/);
    return {
      file,
      component: componentMatch?.[1] || null,
      hasAiContext: /\.aiContext\s*=/.test(source),
      aiContextCharacters: aiContextMatch ? aiContextMatch[1].length : 0,
    };
  });
}

function walkTraining(node, trail = [], rows = []) {
  if (!node || typeof node !== "object") return rows;
  const id = typeof node.id === "string" ? node.id : null;
  const title = typeof node.title === "string" ? node.title : null;
  const nextTrail = title || id ? [...trail, title || id] : trail;
  if (id && title && /^section-\d+/.test(id)) {
    rows.push({
      id,
      title,
      trail: trail.join(" > "),
    });
  }
  for (const key of ["modules", "sections", "chunks", "slides", "items", "children"]) {
    if (Array.isArray(node[key])) {
      node[key].forEach(child => walkTraining(child, nextTrail, rows));
    }
  }
  return rows;
}

function extractTrainingSections() {
  const relativePath = "src/documentation/runtime/trainingModules2025.json";
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  const data = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  return walkTraining(data).map(row => ({
    ...row,
    source: relativePath,
  }));
}

function extractDocFiles() {
  const groups = [
    "docs/widgets/admin",
    "docs/dashboards",
    "docs/workflows/admin",
    "docs/features",
    "docs/guides",
    "docs/training",
  ];
  return groups.map(group => ({
    group,
    markdownFiles: listFiles(group, file => /\.md$/.test(file)),
  }));
}

function buildInventory() {
  const routes = extractRoutes();
  const helpPanels = extractHelpPanels();
  const trainingSections = extractTrainingSections();
  const docGroups = extractDocFiles();
  return {
    generatedAt: new Date().toISOString(),
    sources: {
      routes: "src/routes/AppRoutes.js",
      helpPanels: "src/helpPanelContents/*",
      trainingRuntime: "src/documentation/runtime/trainingModules2025.json",
      documentationCatalog: "src/documentation/documentationLinks.js",
    },
    summary: {
      routes: routes.length,
      helpPanels: helpPanels.length,
      helpPanelsWithAiContext: helpPanels.filter(panel => panel.hasAiContext).length,
      trainingSections: trainingSections.length,
      markdownDocs: docGroups.reduce((total, group) => total + group.markdownFiles.length, 0),
    },
    routes,
    helpPanels,
    trainingSections,
    docGroups,
  };
}

function markdownTable(headers, rows) {
  const line = `| ${headers.join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map(row => `| ${row.map(value => String(value ?? "").replace(/\|/g, "\\|")).join(" | ")} |`);
  return [line, rule, ...body].join("\n");
}

function renderMarkdown(inventory) {
  const lines = [
    "# Admin AI Inventory Report",
    "",
    `Generated: ${inventory.generatedAt}`,
    "",
    "## Summary",
    "",
    markdownTable(
      ["Metric", "Count"],
      Object.entries(inventory.summary).map(([key, value]) => [key, value]),
    ),
    "",
    "## Routes",
    "",
    markdownTable(
      ["Route", "Exact", "Source"],
      inventory.routes.map(route => [route.route, route.exact ? "yes" : "", `${route.source}:${route.line}`]),
    ),
    "",
    "## Help Panels",
    "",
    markdownTable(
      ["File", "Component", "AI Context", "AI Context Chars"],
      inventory.helpPanels.map(panel => [
        panel.file,
        panel.component || "",
        panel.hasAiContext ? "yes" : "",
        panel.aiContextCharacters || "",
      ]),
    ),
    "",
    "## Training Sections",
    "",
    markdownTable(
      ["ID", "Title", "Trail"],
      inventory.trainingSections.map(section => [section.id, section.title, section.trail]),
    ),
    "",
    "## Documentation Groups",
    "",
    markdownTable(
      ["Group", "Markdown Files"],
      inventory.docGroups.map(group => [group.group, group.markdownFiles.length]),
    ),
    "",
  ];
  return lines.join("\n");
}

function main() {
  const inventory = buildInventory();
  const formatArg = process.argv.find(arg => arg.startsWith("--format="));
  const format = formatArg ? formatArg.split("=", 2)[1] : "markdown";
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
    return;
  }
  if (format === "summary") {
    process.stdout.write(`${JSON.stringify(inventory.summary, null, 2)}\n`);
    return;
  }
  if (format !== "markdown") {
    console.error("Usage: node scripts/admin-ai-inventory.js [--format=markdown|json|summary]");
    process.exitCode = 1;
    return;
  }
  process.stdout.write(renderMarkdown(inventory));
}

main();
