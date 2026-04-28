#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const RELEASE_NOTES_LOG_PATH = path.join(REPO_ROOT, 'docs', 'meta', 'next-release-notes-log.md');
const OUTPUT_PATH = path.join(REPO_ROOT, 'src', 'generated', 'buildInfo.js');
const RELEASE_NOTES_OUTPUT_PATH = path.join(REPO_ROOT, 'src', 'generated', 'publicReleaseNotes.js');

const EN_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const FR_MONTH_NAMES = [
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
];

function parseArgs(argv) {
  const args = {
    buildTarget: '',
    releaseId: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--build-target' || token === '-t') {
      args.buildTarget = String(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (token === '--release-id') {
      args.releaseId = String(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (!token.startsWith('-') && !args.buildTarget) {
      args.buildTarget = String(token);
    }
  }

  return args;
}

function runGit(args) {
  try {
    return execFileSync('git', ['-C', REPO_ROOT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_) {
    return '';
  }
}

function buildDisplayLabel(buildInfo) {
  const parts = [];
  if (buildInfo.releaseId) {
    parts.push(`release ${buildInfo.releaseId}`);
  } else if (buildInfo.buildTarget) {
    parts.push(`build ${buildInfo.buildTarget}`);
  }
  if (buildInfo.gitShort) {
    parts.push(buildInfo.gitDirty ? `${buildInfo.gitShort}-dirty` : buildInfo.gitShort);
  }
  if (buildInfo.buildTarget && !buildInfo.releaseId) {
    parts.push(buildInfo.buildTarget);
  }
  return parts.join(' | ') || `build v${buildInfo.packageVersion}`;
}

function extractBulletSection(markdown, heading, options = {}) {
  const required = options.required !== false;
  const lines = String(markdown || '').split(/\r?\n/);
  const targetHeading = `### ${heading}`;
  const startIndex = lines.findIndex(line => line.trim() === targetHeading);
  if (startIndex === -1) {
    throw new Error(`Missing release-notes draft section: ${heading}`);
  }
  const items = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
      break;
    }
    if (trimmed.startsWith('- ')) {
      items.push(trimmed.slice(2).trim());
    }
  }
  if (!items.length) {
    if (!required) {
      return [];
    }
    throw new Error(`Release-notes draft section is empty: ${heading}`);
  }
  return items;
}

function getOrdinalSuffix(day) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  const mod10 = day % 10;
  if (mod10 === 1) return 'st';
  if (mod10 === 2) return 'nd';
  if (mod10 === 3) return 'rd';
  return 'th';
}

function formatReleaseDate(dateValue, locale) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid build timestamp for release notes generation.');
  }
  const day = date.getUTCDate();
  const monthIndex = date.getUTCMonth();
  const year = date.getUTCFullYear();
  if (locale === 'fr') {
    return `${day} ${FR_MONTH_NAMES[monthIndex]} ${year}`;
  }
  return `${day}${getOrdinalSuffix(day)} ${EN_MONTH_NAMES[monthIndex]} ${year}`;
}

function buildPublicReleaseNotes({ builtAt, releaseId }) {
  const markdown = fs.readFileSync(RELEASE_NOTES_LOG_PATH, 'utf8');
  const enFeatures = extractBulletSection(markdown, "What's New (draft bullets - EN)");
  const enKnownIssues = extractBulletSection(markdown, 'Known Bugs (draft bullets - EN)', { required: false });
  const enComingNext = extractBulletSection(markdown, 'Coming Soon (draft bullets - EN)', { required: false });
  const frFeatures = extractBulletSection(markdown, 'Nouveautes (brouillon - FR)');
  const frKnownIssues = extractBulletSection(markdown, 'Problemes connus (brouillon - FR)', { required: false });
  const frComingNext = extractBulletSection(markdown, 'A venir (brouillon - FR)', { required: false });
  const releaseLabel = releaseId ? `Release ${releaseId}` : 'Current build';

  return {
    generatedAt: builtAt,
    releaseId: releaseId || '',
    releaseLabel,
    releaseDateEn: formatReleaseDate(builtAt, 'en'),
    releaseDateFr: formatReleaseDate(builtAt, 'fr'),
    en: {
      sectionEyebrow: 'Optional reading',
      description: '',
      featuresHeading: 'What changed',
      features: enFeatures,
      knownIssuesHeading: 'Known issues',
      knownIssues: enKnownIssues,
      comingNextHeading: 'Coming next',
      comingNext: enComingNext,
    },
    fr: {
      sectionEyebrow: 'Lecture optionnelle',
      description: '',
      featuresHeading: 'Ce qui a change',
      features: frFeatures,
      knownIssuesHeading: 'Points connus',
      knownIssues: frKnownIssues,
      comingNextHeading: 'A venir',
      comingNext: frComingNext,
    },
  };
}

function writeGeneratedModule(outputPath, variableName, value) {
  const output = [
    `const ${variableName} = ` + JSON.stringify(value, null, 2) + ';',
    '',
    `export default ${variableName};`,
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const gitCommit = runGit(['rev-parse', 'HEAD']);
  const gitShort = runGit(['rev-parse', '--short=8', 'HEAD']);
  const dirtyOutput = runGit(['status', '--porcelain', '--untracked-files=no']);
  const releaseId = args.releaseId || process.env.PATH_RELEASE_ID || '';
  const buildTarget = args.buildTarget || process.env.PATH_DEPLOY_ENV || process.env.NODE_ENV || '';
  const builtAt = new Date().toISOString();
  const publicReleaseNotes = buildPublicReleaseNotes({ builtAt, releaseId });

  const buildInfo = {
    packageVersion: String(packageJson.version || '0.0.0'),
    releaseId,
    buildTarget,
    builtAt,
    gitCommit,
    gitShort,
    gitDirty: Boolean(dirtyOutput),
    publicReleaseLabel: publicReleaseNotes.releaseLabel,
    publicReleaseDateEn: publicReleaseNotes.releaseDateEn,
    publicReleaseDateFr: publicReleaseNotes.releaseDateFr,
  };
  buildInfo.displayLabel = buildDisplayLabel(buildInfo);

  writeGeneratedModule(OUTPUT_PATH, 'buildInfo', buildInfo);
  writeGeneratedModule(RELEASE_NOTES_OUTPUT_PATH, 'publicReleaseNotes', publicReleaseNotes);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_PATH)}: ${buildInfo.displayLabel}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, RELEASE_NOTES_OUTPUT_PATH)}: ${publicReleaseNotes.releaseLabel}`);
}

main();
