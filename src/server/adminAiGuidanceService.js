const HELP_PANEL_SURFACE = "help-panel";
const ENTRY_TABLE = "admin_ai_guidance_entry";
const EXAMPLE_TABLE = "admin_ai_guidance_example";

const SEEDED_GUIDANCE_ENTRIES = [
  {
    slug: "case-backload-overview",
    title: "Imported/application-less backload overview",
    surface: HELP_PANEL_SURFACE,
    priority: 120,
    routePatterns: ["/cases/:caseId", "/application-case/:id"],
    helpTitles: [
      "Case Workspace",
      "ISET Application Assessment",
      "Help and Tutorials",
      "Application assessment workflow",
    ],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: ["backload", "imported file", "application-less", "historic records"],
    keywords: [
      "backload",
      "existing intervention",
      "historic intervention",
      "historical intervention",
      "active intervention",
      "application-less",
      "imported client",
      "pre-path",
      "historic and active interventions",
    ],
    stateHints: ["applicationless", "cross-workspace"],
    sourceRefs: [
      "src/helpPanelContents/caseWorkspaceHelp.js",
      "docs/guides/client-file-imports.md",
    ],
    answerStyleText:
      "Lead with the correct PATH workspace and control. If the user is in Application Assessment, explicitly say the backload workflow belongs in Case Workspace.",
    guidanceText: `When staff ask how to record pre-PATH or imported-file history, explain that the approved workflow is in Case Workspace, not in the Application Assessment widget. The correct entry points are the Case Header quick actions \`Add existing action plan\`, \`Add existing intervention\`, and \`Upload existing documents\`. Use those quick actions only when the plan, intervention, or document already existed before PATH go-live or before the client had a real PATH application. These are silent historical entry points: they do not start approval routing, checklist progression, payment packets, or applicant notifications.`,
  },
  {
    slug: "case-backload-intervention-lifecycle",
    title: "Backloaded intervention lifecycle guardrails",
    surface: HELP_PANEL_SURFACE,
    priority: 115,
    routePatterns: ["/cases/:caseId", "/application-case/:id"],
    helpTitles: ["Case Workspace", "ISET Application Assessment", "Help and Tutorials"],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: ["intervention", "lifecycle", "status", "active plan"],
    keywords: [
      "existing intervention",
      "active intervention",
      "historic intervention",
      "archived plan",
      "closed plan",
      "completed intervention",
      "cancelled intervention",
      "in progress intervention",
      "suspended intervention",
      "end date",
    ],
    stateHints: ["applicationless"],
    sourceRefs: [
      "src/helpPanelContents/caseWorkspaceInterventionsHelp.js",
      "docs/guides/client-file-imports.md",
    ],
    answerStyleText:
      "When listing rules, keep them concrete and operational: archived plans blocked, closed plans limited to completed/cancelled, active statuses require an active plan, and completed historical records need real dates/outcomes.",
    guidanceText: `Backloaded interventions must preserve the real plan and intervention lifecycle state. Archived plans cannot receive backloaded interventions. Closed plans only accept completed or cancelled interventions. In-progress or suspended interventions require an active plan. Completed or cancelled historical interventions need the real end date and outcome details recorded. If the user asks about both historic and active interventions, explain that ongoing pre-PATH services may still be backloaded, but they must be attached to an active plan and entered with their real current lifecycle state.`,
  },
  {
    slug: "case-backload-finance-history",
    title: "Backloaded intervention finance handling",
    surface: HELP_PANEL_SURFACE,
    priority: 110,
    routePatterns: ["/cases/:caseId", "/application-case/:id"],
    helpTitles: ["Case Workspace", "ISET Application Assessment", "Help and Tutorials"],
    roles: [
      "ISET Coordinator",
      "Regional Manager",
      "NWAC Administrator",
      "System Administrator",
    ],
    topicTags: ["finance", "actual amount", "manual_backload", "payment packets"],
    keywords: [
      "actual amount",
      "payment lines",
      "manual_backload",
      "historic finance",
      "payment packet",
      "finance submission",
      "remaining amount",
      "unpaid work",
    ],
    stateHints: ["applicationless"],
    sourceRefs: [
      "src/helpPanelContents/caseWorkspaceInterventionsHelp.js",
      "docs/guides/client-file-imports.md",
    ],
    answerStyleText:
      "Explain the historical-only rule plainly and separate it from live PATH payment workflow.",
    guidanceText: `Actual amount and payment lines entered during backload are historical only. They do not create live payment packets, finance submissions, CFA side effects, or applicant notifications. For \`manual_backload\` interventions, PATH stores historical finance history so reporting and budget burn can reflect legacy spend, but those records stay outside the live payment workflow. If there is unpaid work that now has to be managed in PATH, staff should create a new live intervention for the remaining amount instead of pushing the backloaded record through live payments.`,
  },
];

const SEEDED_GUIDANCE_EXAMPLES = [
  {
    guidanceSlug: "case-backload-overview",
    sortOrder: 10,
    questionText:
      "I'm in the ISET Application Assessment workspace. Do you know much about how I can backload historic and active interventions?",
    answerText:
      "Yes, but that workflow belongs in Case Workspace rather than inside the Application Assessment widget. For imported or application-less files, open the case and use `Case header > Add existing intervention`. Use that backload action only for pre-PATH or already-existing services, because it records history silently instead of starting normal approval or payment workflow.",
  },
  {
    guidanceSlug: "case-backload-intervention-lifecycle",
    sortOrder: 20,
    questionText: "Can I backload an active intervention or only a completed one?",
    answerText:
      "You can backload an ongoing intervention, but it has to match the parent plan lifecycle. Archived plans are blocked, closed plans only accept completed or cancelled interventions, and in-progress or suspended interventions need an active plan. Completed or cancelled historical interventions also need the real end date and outcome recorded.",
  },
  {
    guidanceSlug: "case-backload-finance-history",
    sortOrder: 30,
    questionText: "If I enter actual amount on a backloaded intervention, does that create a payment request?",
    answerText:
      "No. Backloaded `actual amount` and payment lines are treated as historical finance only. They can support reporting and budget burn, but they do not create live payment packets or finance submission workflow. If new unpaid work still needs to be managed in PATH, create a new live intervention for that remaining amount.",
  },
];

let guidanceSchemaPromise = null;
let guidanceCache = { fetchedAt: 0, entries: [], examples: [] };
const GUIDANCE_CACHE_TTL_MS = 60 * 1000;

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(item => normalizeString(item)).filter(Boolean);
  }
  if (!value && value !== 0) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return normalizeList(JSON.parse(trimmed));
      } catch (_) {
        return trimmed
          .split(",")
          .map(item => normalizeString(item))
          .filter(Boolean);
      }
    }
    return trimmed
      .split(",")
      .map(item => normalizeString(item))
      .filter(Boolean);
  }
  if (typeof value === "object") {
    return Object.values(value)
      .map(item => normalizeString(item))
      .filter(Boolean);
  }
  return [];
}

function tokenizeText(input) {
  return normalizeLower(input)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(token => token && token.length >= 2);
}

function buildKeywordSet(input) {
  return new Set(tokenizeText(input));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pathPatternMatches(pathname, pattern) {
  const normalizedPath = normalizeString(pathname);
  const normalizedPattern = normalizeString(pattern);
  if (!normalizedPath || !normalizedPattern) return false;
  const regexSource = normalizedPattern
    .split("/")
    .map(segment => {
      if (!segment) return "";
      if (segment === "*") return ".*";
      if (segment.startsWith(":")) return "[^/]+";
      return escapeRegex(segment);
    })
    .join("/");
  try {
    return new RegExp(`^${regexSource}$`, "i").test(normalizedPath);
  } catch (_) {
    return false;
  }
}

function countKeywordMatches(text, keywords) {
  const haystack = normalizeLower(text);
  if (!haystack) return 0;
  return normalizeList(keywords).reduce((total, keyword) => {
    const needle = normalizeLower(keyword);
    if (!needle) return total;
    return haystack.includes(needle) ? total + 1 : total;
  }, 0);
}

function countTagOverlaps(keywordSet, tags) {
  return normalizeList(tags).reduce((total, tag) => {
    const normalized = normalizeLower(tag).replace(/[^a-z0-9]+/g, " ").trim();
    if (!normalized) return total;
    const parts = normalized.split(/\s+/).filter(Boolean);
    return parts.every(part => keywordSet.has(part)) ? total + 1 : total;
  }, 0);
}

function extractLatestUserQuestion(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (normalizeLower(message?.role) !== "user") continue;
    const content = normalizeString(message?.content);
    if (content) return content;
  }
  return "";
}

function normalizeChatContext(rawContext = {}) {
  return {
    surface: normalizeString(rawContext.surface) || HELP_PANEL_SURFACE,
    pathname: normalizeString(rawContext.pathname),
    helpTitle: normalizeString(rawContext.helpTitle),
    aiContext: normalizeString(rawContext.aiContext),
    role: normalizeString(rawContext.role),
  };
}

function hydrateEntry(row = {}) {
  return {
    slug: normalizeString(row.slug),
    title: normalizeString(row.title),
    surface: normalizeString(row.surface) || HELP_PANEL_SURFACE,
    priority: Number(row.priority ?? 0),
    routePatterns: normalizeList(row.route_patterns_json),
    helpTitles: normalizeList(row.help_titles_json),
    roles: normalizeList(row.roles_json),
    topicTags: normalizeList(row.topic_tags_json),
    keywords: normalizeList(row.keywords_json),
    stateHints: normalizeList(row.state_hints_json),
    sourceRefs: normalizeList(row.source_refs_json),
    answerStyleText: normalizeString(row.answer_style_text),
    guidanceText: normalizeString(row.guidance_text),
  };
}

function hydrateExample(row = {}) {
  return {
    guidanceSlug: normalizeString(row.guidance_slug),
    questionText: normalizeString(row.question_text),
    answerText: normalizeString(row.answer_text),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function scoreEntry(entry, context, latestQuestion) {
  if (entry.surface !== context.surface) return 0;
  const latestQuestionText = normalizeString(latestQuestion);
  const combinedText = [
    latestQuestionText,
    context.helpTitle,
    context.aiContext,
    context.pathname,
  ]
    .filter(Boolean)
    .join(" ");
  const questionKeywords = buildKeywordSet(latestQuestionText);
  let contextScore = 0;
  let contentScore = 0;

  if (
    context.role &&
    entry.roles.length &&
    entry.roles.some(role => normalizeLower(role) === normalizeLower(context.role))
  ) {
    contextScore += 12;
  }
  if (
    context.pathname &&
    entry.routePatterns.some(pattern => pathPatternMatches(context.pathname, pattern))
  ) {
    contextScore += 18;
  }
  if (
    context.helpTitle &&
    entry.helpTitles.some(title => normalizeLower(context.helpTitle).includes(normalizeLower(title)))
  ) {
    contextScore += 12;
  }

  const keywordMatches = countKeywordMatches(latestQuestionText, entry.keywords);
  contentScore += keywordMatches * 16;
  const combinedMatches = countKeywordMatches(combinedText, entry.keywords);
  contentScore += Math.max(0, combinedMatches - keywordMatches) * 6;
  contentScore += countTagOverlaps(questionKeywords, entry.topicTags) * 8;

  if (
    entry.stateHints.includes("applicationless") &&
    /(application-less|application less|imported client|imported file|pre-path)/i.test(combinedText)
  ) {
    contentScore += 10;
  }
  if (
    entry.stateHints.includes("cross-workspace") &&
    /application assessment|iset application assessment/i.test(combinedText) &&
    /(backload|existing intervention|historic intervention|active intervention)/i.test(combinedText)
  ) {
    contentScore += 10;
  }

  if (contentScore === 0) return 0;
  return contentScore + contextScore + Math.max(0, Math.min(entry.priority, 10));
}

async function ensureGuidanceSchema(pool) {
  if (guidanceSchemaPromise) return guidanceSchemaPromise;
  guidanceSchemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${ENTRY_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(128) NOT NULL,
        title VARCHAR(255) NOT NULL,
        surface VARCHAR(64) NOT NULL DEFAULT '${HELP_PANEL_SURFACE}',
        priority INT NOT NULL DEFAULT 100,
        active TINYINT(1) NOT NULL DEFAULT 1,
        route_patterns_json JSON NULL,
        help_titles_json JSON NULL,
        roles_json JSON NULL,
        topic_tags_json JSON NULL,
        keywords_json JSON NULL,
        state_hints_json JSON NULL,
        source_refs_json JSON NULL,
        answer_style_text TEXT NULL,
        guidance_text MEDIUMTEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_slug (slug),
        KEY idx_surface_active (surface, active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${EXAMPLE_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guidance_slug VARCHAR(128) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        question_text TEXT NOT NULL,
        answer_text MEDIUMTEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_guidance_slug_sort (guidance_slug, sort_order),
        KEY idx_guidance_slug_active (guidance_slug, active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    for (const entry of SEEDED_GUIDANCE_ENTRIES) {
      await pool.query(
        `
          INSERT INTO ${ENTRY_TABLE} (
            slug,
            title,
            surface,
            priority,
            active,
            route_patterns_json,
            help_titles_json,
            roles_json,
            topic_tags_json,
            keywords_json,
            state_hints_json,
            source_refs_json,
            answer_style_text,
            guidance_text
          ) VALUES (?, ?, ?, ?, 1, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?)
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            surface = VALUES(surface),
            priority = VALUES(priority),
            active = VALUES(active),
            route_patterns_json = VALUES(route_patterns_json),
            help_titles_json = VALUES(help_titles_json),
            roles_json = VALUES(roles_json),
            topic_tags_json = VALUES(topic_tags_json),
            keywords_json = VALUES(keywords_json),
            state_hints_json = VALUES(state_hints_json),
            source_refs_json = VALUES(source_refs_json),
            answer_style_text = VALUES(answer_style_text),
            guidance_text = VALUES(guidance_text),
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          entry.slug,
          entry.title,
          entry.surface,
          entry.priority,
          JSON.stringify(entry.routePatterns || []),
          JSON.stringify(entry.helpTitles || []),
          JSON.stringify(entry.roles || []),
          JSON.stringify(entry.topicTags || []),
          JSON.stringify(entry.keywords || []),
          JSON.stringify(entry.stateHints || []),
          JSON.stringify(entry.sourceRefs || []),
          entry.answerStyleText || null,
          entry.guidanceText,
        ],
      );
    }

    for (const example of SEEDED_GUIDANCE_EXAMPLES) {
      await pool.query(
        `
          INSERT INTO ${EXAMPLE_TABLE} (
            guidance_slug,
            sort_order,
            active,
            question_text,
            answer_text
          ) VALUES (?, ?, 1, ?, ?)
          ON DUPLICATE KEY UPDATE
            active = VALUES(active),
            question_text = VALUES(question_text),
            answer_text = VALUES(answer_text),
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          example.guidanceSlug,
          example.sortOrder,
          example.questionText,
          example.answerText,
        ],
      );
    }
  })().catch(error => {
    guidanceSchemaPromise = null;
    throw error;
  });
  return guidanceSchemaPromise;
}

async function loadGuidanceData(pool) {
  const now = Date.now();
  if (guidanceCache.entries.length && (now - guidanceCache.fetchedAt) < GUIDANCE_CACHE_TTL_MS) {
    return guidanceCache;
  }
  await ensureGuidanceSchema(pool);
  const [entryRows] = await pool.query(
    `SELECT * FROM ${ENTRY_TABLE} WHERE active = 1 ORDER BY priority DESC, updated_at DESC, id ASC`,
  );
  const [exampleRows] = await pool.query(
    `SELECT * FROM ${EXAMPLE_TABLE} WHERE active = 1 ORDER BY guidance_slug ASC, sort_order ASC, id ASC`,
  );
  guidanceCache = {
    fetchedAt: now,
    entries: entryRows.map(hydrateEntry),
    examples: exampleRows.map(hydrateExample),
  };
  return guidanceCache;
}

function buildGuidancePrompt(context, matchedEntries, matchedExamples, latestQuestion) {
  const lines = [
    "Retrieved PATH guidance is available for this help-panel question.",
    "Treat the retrieved guidance below as the authoritative workflow layer for this answer.",
    "Use exact PATH controls and workflow rules when they are named.",
    "If the retrieved guidance shows that the question belongs in another workspace, say that directly and name the correct workspace or quick action.",
    "Do not invent CSV imports, bulk-upload steps, or generic SaaS workflows unless the retrieved guidance explicitly says they exist.",
    "Do not pad the answer with generic uncertainty language when the retrieved guidance already answers the workflow question.",
  ];

  if (context.pathname) lines.push(`Current route: ${context.pathname}`);
  if (context.helpTitle) lines.push(`Current help panel: ${context.helpTitle}`);
  if (context.role) lines.push(`Current role: ${context.role}`);
  if (latestQuestion) lines.push(`Current user question: ${latestQuestion}`);

  lines.push("", "Retrieved guidance:");
  matchedEntries.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.title}`);
    lines.push(entry.guidanceText);
    if (entry.answerStyleText) {
      lines.push(`Answer shaping: ${entry.answerStyleText}`);
    }
    if (entry.sourceRefs.length) {
      lines.push(`Source anchors: ${entry.sourceRefs.join(", ")}`);
    }
    lines.push("");
  });

  if (matchedExamples.length) {
    lines.push("Approved answer examples:");
    matchedExamples.forEach((example, index) => {
      lines.push(`Example ${index + 1} question: ${example.questionText}`);
      lines.push(`Example ${index + 1} answer: ${example.answerText}`);
    });
  }

  return lines.join("\n");
}

async function buildHelpPanelGuidanceSystemPrompt({ pool, chatContext, messages = [] }) {
  const context = normalizeChatContext(chatContext);
  if (context.surface !== HELP_PANEL_SURFACE) return null;

  const latestQuestion = extractLatestUserQuestion(messages);
  const { entries, examples } = await loadGuidanceData(pool);
  const rankedEntries = entries
    .map(entry => ({
      entry,
      score: scoreEntry(entry, context, latestQuestion),
    }))
    .filter(item => item.score >= 35)
    .sort((left, right) => right.score - left.score || right.entry.priority - left.entry.priority)
    .slice(0, 3)
    .map(item => item.entry);

  if (!rankedEntries.length) return null;

  const allowedSlugs = new Set(rankedEntries.map(entry => entry.slug));
  const matchedExamples = examples
    .filter(example => allowedSlugs.has(example.guidanceSlug))
    .slice(0, 3);

  return buildGuidancePrompt(context, rankedEntries, matchedExamples, latestQuestion);
}

module.exports = {
  HELP_PANEL_SURFACE,
  buildHelpPanelGuidanceSystemPrompt,
};
