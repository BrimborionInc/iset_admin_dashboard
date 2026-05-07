#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FIXTURE_PATH = "docs/testing/admin-ai-chatbot-eval-fixtures.json";
const ALLOWED_STATUSES = new Set(["drafted", "verified", "passing", "failing", "retired"]);
const REQUIRED_STRING_FIELDS = ["id", "domain", "route", "helpTitle", "role", "prompt", "status"];
const REQUIRED_ARRAY_FIELDS = ["expectedAnchors", "forbiddenPatterns", "sourceRefs"];

function loadFixtures(relativePath) {
  const absolute = path.resolve(ROOT, relativePath);
  const raw = fs.readFileSync(absolute, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${relativePath} must contain a JSON array`);
  }
  return parsed;
}

function validateFixture(fixture, index, ids) {
  const label = fixture?.id || `fixture[${index}]`;
  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
    return [`fixture[${index}] must be an object`];
  }
  const errors = [];
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof fixture[field] !== "string" || !fixture[field].trim()) {
      errors.push(`${label}: ${field} is required`);
    }
  }
  for (const field of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(fixture[field]) || fixture[field].length === 0) {
      errors.push(`${label}: ${field} must be a non-empty array`);
      continue;
    }
    fixture[field].forEach((value, valueIndex) => {
      if (typeof value !== "string" || !value.trim()) {
        errors.push(`${label}: ${field}[${valueIndex}] must be a non-empty string`);
      }
    });
  }
  if (fixture.id) {
    if (ids.has(fixture.id)) {
      errors.push(`${label}: duplicate id`);
    }
    ids.add(fixture.id);
  }
  if (fixture.status && !ALLOWED_STATUSES.has(fixture.status)) {
    errors.push(`${label}: unsupported status ${fixture.status}`);
  }
  return errors;
}

function summarize(fixtures) {
  const byStatus = {};
  const byDomain = {};
  for (const fixture of fixtures) {
    byStatus[fixture.status] = (byStatus[fixture.status] || 0) + 1;
    byDomain[fixture.domain] = (byDomain[fixture.domain] || 0) + 1;
  }
  return { count: fixtures.length, byStatus, byDomain };
}

function main() {
  const relativePath = process.argv[2] || DEFAULT_FIXTURE_PATH;
  let fixtures;
  try {
    fixtures = loadFixtures(relativePath);
  } catch (error) {
    console.error(`[ai:eval:check] failed to load fixtures: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const ids = new Set();
  const errors = fixtures.flatMap((fixture, index) => validateFixture(fixture, index, ids));
  if (errors.length) {
    errors.forEach(error => console.error(`[ai:eval:check] ${error}`));
    console.error(`[ai:eval:check] errors=${errors.length}`);
    process.exitCode = 1;
    return;
  }

  const summary = summarize(fixtures);
  console.log(`[ai:eval:check] fixtures=${summary.count}`);
  console.log(`[ai:eval:check] byStatus=${JSON.stringify(summary.byStatus)}`);
  console.log(`[ai:eval:check] byDomain=${JSON.stringify(summary.byDomain)}`);
}

main();
