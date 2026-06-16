#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { path, fs, cleanText, hashText, nowIso, sleep, repoRoot, worldCupRoot, requestGeminiJsonWithFallbacks, getActiveGeminiKey } from "./modules/utils.mjs";
import { knownOpeningFixtures, preTournamentTopics } from "./modules/scheduler.mjs";

const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_TREND_THRESHOLD = 95;
const DEFAULT_RETRY_LIMIT = 0;
const DEFAULT_WORKFLOW_FILE = "worldcup-pipeline.yml";
const DEFAULT_BRANCH = "main";
const DEFAULT_FETCH_TIMEOUT_MS = 45000;
const DEFAULT_DAILY_TOTAL_LIMIT = 6;
const DEFAULT_DAILY_TREND_LIMIT = 3;
const DEFAULT_TREND_COOLDOWN_MINUTES = 60;
const DEFAULT_STALE_DISPATCH_RETRY_MINUTES = 120;
const DEFAULT_FAILED_DISPATCH_COOLDOWN_MINUTES = 360;
const DEFAULT_INTENT_LLM_TIMEOUT_MS = 15000;
const DEFAULT_INTENT_LLM_MODEL = "gemma-4-31b-it";
const DEFAULT_ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";
const DEFAULT_MATCH_LOOKAHEAD_DAYS = 3;
const DEFAULT_PREMATCH_TARGET_HOURS = 36;
const DEFAULT_PREMATCH_GRACE_MINUTES = 30;
const DEFAULT_POSTMATCH_DELAY_MINUTES = 15;
const DEFAULT_POSTMATCH_MAX_AGE_HOURS = 12;
const DEFAULT_YOUTUBE_SCAN_MAX = 100;
const DEFAULT_YOUTUBE_DISCOVERY_INTERVAL_MINUTES = 60;
const DEFAULT_YOUTUBE_DISCOVERY_MAX_PER_RUN = 100;
const DEFAULT_YOUTUBE_STATS_INTERVAL_MINUTES = 30;
const DEFAULT_YOUTUBE_POOL_RETENTION_HOURS = 24;
const DEFAULT_YOUTUBE_POOL_MAX = 2400;
const DEFAULT_YOUTUBE_MIN_BASELINE_VIEWS = 1000;
const DEFAULT_YOUTUBE_SPIKE_GROWTH_PERCENT = 100;
const DEFAULT_YOUTUBE_SPIKE_MIN_DELTA_VIEWS = 1000;
const DEFAULT_YOUTUBE_STRONG_DELTA_VIEWS = 10000;
const DEFAULT_YOUTUBE_STRONG_DELTA_MIN_GROWTH_PERCENT = 50;
const DEFAULT_YOUTUBE_TOPIC_MIN_SPIKE_VIDEOS = 10;
const DEFAULT_YOUTUBE_TOPIC_MIN_CHANNELS = 4;
const DEFAULT_YOUTUBE_TOPIC_MIN_CONFIDENCE = 75;
const DEFAULT_YOUTUBE_DIAGNOSTIC_RETENTION_HOURS = 24;
const DEFAULT_ANALYZER_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_SKIP_NOTICE_COOLDOWN_MINUTES = 180;
const DUPLICATE_GATE_REASON = "duplicate candidate already dispatched";
const ROUTINE_NO_CANDIDATE_REASON_PATTERNS = [/duplicate candidate already dispatched/i, /daily (?:total|trend) limit reached/i, /trend cooldown active/i];
const INTENT_ACTIONS = new Set(["dispatch_specific", "discover_and_dispatch", "status", "help", "clarify"]);
const INTENT_TYPES = new Set(["pre-tournament", "prediction", "postmatch", "breaking-news"]);
const DEFAULT_VIP_TEAMS = [
  "Real Madrid",
  "Barcelona",
  "Manchester City",
  "Arsenal",
  "Bayern Munich",
  "Liverpool",
  "Paris Saint-Germain",
  "Manchester United",
  "Juventus",
  "Inter Milan",
  "Argentina",
  "Algeria",
  "Australia",
  "Austria",
  "Belgium",
  "Portugal",
  "France",
  "Brazil",
  "England",
  "Spain",
  "Germany",
  "Netherlands",
  "Croatia",
  "Uruguay",
  "Colombia",
  "Italy",
  "Morocco",
  "Senegal",
  "Ghana",
  "Nigeria",
  "Ivory Coast",
  "Cote d'Ivoire",
  "Egypt",
  "South Africa",
  "Cameroon",
  "Japan",
  "South Korea",
  "Ecuador",
  "Paraguay",
  "Chile",
  "Peru",
  "Switzerland",
  "Denmark",
  "Sweden",
  "Norway",
  "Poland",
  "Serbia",
  "Turkey",
  "Czechia",
  "Costa Rica",
  "Panama",
  "New Zealand",
  "Saudi Arabia",
  "Iran",
  "Qatar",
  "Tunisia",
  "Scotland",
  "Wales",
  "Cape Verde",
  "Cabo Verde",
  "Curacao",
  "USA",
  "USMNT",
  "United States",
  "Mexico",
  "Canada",
];
const DEFAULT_VIP_PLAYERS = [
  "Messi",
  "Ronaldo",
  "Mbappe",
  "Haaland",
  "Yamal",
  "Bellingham",
  "Vinicius",
  "De Bruyne",
  "Pulisic",
  "Neymar",
  "Kane",
  "Saka",
  "Foden",
  "Palmer",
  "Musiala",
  "Wirtz",
  "Kimmich",
  "Havertz",
  "Modric",
  "Salah",
  "Son",
  "Lewandowski",
  "Griezmann",
  "Pedri",
  "Gavi",
  "Rodri",
  "Morata",
  "Valverde",
  "Darwin Nunez",
  "Luis Diaz",
  "Davies",
  "David",
  "Reyna",
];
const MAJOR_TEAM_PATTERN = /\b(usa|usmnt|united states|mexico|canada|brazil|argentina|uruguay|colombia|england|france|spain|germany|portugal)\b/i;
const RECOGNIZABLE_PLAYER_PATTERN = /\b(messi|ronaldo|neymar|mbappe|mbapp[eé]|pulisic|bellingham|vinicius|vin[ií]cius|modric|kane|yamal|musiala|haaland)\b/i;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const rawKey = token.slice(2);
    const [keyFromEquals, valueFromEquals] = rawKey.split(/=(.*)/s);
    const key = keyFromEquals.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (valueFromEquals !== undefined) {
      args[key] = valueFromEquals;
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !String(next).startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function boolArg(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "y", "on"].includes(String(value).trim().toLowerCase());
}

async function loadControllerEnvFile() {
  const filePath = path.join(repoRoot, ".env.azure-controller");
  const text = await fs.readFile(filePath, "utf8").catch(() => "");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const equalsIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function numberArg(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function listArg(value, fallback = []) {
  const raw = value === undefined || value === null ? "" : String(value);
  if (!raw.trim()) return [...fallback];
  return raw
    .split(/[|,]/)
    .map(cleanText)
    .filter(Boolean);
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function jsonText(value) {
  return JSON.stringify(value ?? null);
}

function controllerConfig(args = {}) {
  const repo = cleanText(args.repo || process.env.WORLD_CUP_GITHUB_REPO || process.env.GITHUB_REPOSITORY || "financewithrajat10-jpg/Money-Printing-Machine");
  const [owner, repoName] = repo.split("/");
  const explicitYouTubeKeys = listArg(args.youtubeApiKeys || process.env.WORLD_CUP_YOUTUBE_API_KEYS || process.env.YOUTUBE_API_KEYS, []);
  const primaryYouTubeKey = cleanText(process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || explicitYouTubeKeys[0] || "");
  const youtubeApiKeys = [...new Set([...explicitYouTubeKeys, primaryYouTubeKey].map(cleanText).filter(Boolean))];
  const prematchTargetHours = Math.max(0, numberArg(args.prematchTargetHours || process.env.WORLD_CUP_PREMATCH_TARGET_HOURS, DEFAULT_PREMATCH_TARGET_HOURS));
  const prematchGraceMinutes = Math.max(1, numberArg(args.prematchGraceMinutes || process.env.WORLD_CUP_PREMATCH_GRACE_MINUTES, DEFAULT_PREMATCH_GRACE_MINUTES));
  return {
    owner,
    repo: repoName,
    repoFullName: repo,
    branch: cleanText(args.ref || args.branch || process.env.WORLD_CUP_GITHUB_REF || DEFAULT_BRANCH),
    workflowFile: cleanText(args.workflow || process.env.WORLD_CUP_WORKFLOW_FILE || DEFAULT_WORKFLOW_FILE),
    githubToken: cleanText(process.env.WORLD_CUP_GITHUB_TOKEN || process.env.GITHUB_FINE_GRAINED_PAT || process.env.GITHUB_TOKEN || ""),
    youtubeApiKey: primaryYouTubeKey,
    youtubeApiKeys,
    trendThreshold: numberArg(args.trendThreshold || process.env.WORLD_CUP_TREND_THRESHOLD, DEFAULT_TREND_THRESHOLD),
    dailyTotalLimit: Math.max(1, numberArg(args.dailyTotalLimit || process.env.WORLD_CUP_CONTROLLER_DAILY_TOTAL_LIMIT, DEFAULT_DAILY_TOTAL_LIMIT)),
    dailyTrendLimit: Math.max(0, numberArg(args.dailyTrendLimit || process.env.WORLD_CUP_CONTROLLER_DAILY_TREND_LIMIT, DEFAULT_DAILY_TREND_LIMIT)),
    trendCooldownMinutes: Math.max(0, numberArg(args.trendCooldownMinutes || process.env.WORLD_CUP_CONTROLLER_TREND_COOLDOWN_MINUTES, DEFAULT_TREND_COOLDOWN_MINUTES)),
    staleDispatchRetryMinutes: Math.max(15, numberArg(args.staleDispatchRetryMinutes || process.env.WORLD_CUP_CONTROLLER_STALE_DISPATCH_RETRY_MINUTES, DEFAULT_STALE_DISPATCH_RETRY_MINUTES)),
    failedDispatchCooldownMinutes: Math.max(0, numberArg(args.failedDispatchCooldownMinutes || process.env.WORLD_CUP_CONTROLLER_FAILED_DISPATCH_COOLDOWN_MINUTES, DEFAULT_FAILED_DISPATCH_COOLDOWN_MINUTES)),
    requiredGroundedSources: Math.max(1, numberArg(args.requiredGroundedSources || process.env.WORLD_CUP_CONTROLLER_REQUIRED_GROUNDED_SOURCES, 2)),
    enableGeminiTrends: boolArg(args.enableGeminiTrends ?? process.env.WORLD_CUP_CONTROLLER_ENABLE_GEMINI_TRENDS, false),
    majorOnlyScheduled: boolArg(args.majorOnlyScheduled ?? process.env.WORLD_CUP_CONTROLLER_MAJOR_ONLY_SCHEDULED, true),
    intervalMinutes: Math.max(1, numberArg(args.intervalMinutes || process.env.WORLD_CUP_CONTROLLER_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES)),
    retryLimit: Math.max(0, numberArg(args.retryLimit || process.env.WORLD_CUP_CONTROLLER_RETRY_LIMIT, DEFAULT_RETRY_LIMIT)),
    fetchTimeoutMs: Math.max(5000, numberArg(args.fetchTimeoutMs || process.env.WORLD_CUP_CONTROLLER_FETCH_TIMEOUT_MS, DEFAULT_FETCH_TIMEOUT_MS)),
    telegramCommands: boolArg(args.telegramCommands ?? process.env.WORLD_CUP_CONTROLLER_TELEGRAM_COMMANDS, true),
    dryRun: boolArg(args.dryRun, false),
    offline: boolArg(args.offline, false),
    once: boolArg(args.once, false),
    force: boolArg(args.force, false),
    legacyTriggerEnabled: boolArg(args.legacyTriggerEnabled ?? process.env.WORLD_CUP_LEGACY_TRIGGER_ENABLED, false),
    stateFile: path.resolve(cleanText(args.stateFile || process.env.WORLD_CUP_CONTROLLER_STATE_FILE || path.join(worldCupRoot, "azure-controller-state.json"))),
    dbFile: path.resolve(cleanText(args.dbFile || process.env.WORLD_CUP_CONTROLLER_DB_FILE || path.join(worldCupRoot, "azure-controller-state.sqlite"))),
    espnEnabled: boolArg(args.espnEnabled ?? process.env.WORLD_CUP_ESPN_ENABLED, true),
    espnScoreboardUrl: cleanText(args.espnScoreboardUrl || process.env.WORLD_CUP_ESPN_SCOREBOARD_URL || DEFAULT_ESPN_SCOREBOARD_URL),
    matchLookaheadDays: Math.max(0, numberArg(args.matchLookaheadDays || process.env.WORLD_CUP_MATCH_LOOKAHEAD_DAYS, DEFAULT_MATCH_LOOKAHEAD_DAYS)),
    prematchTargetHours,
    prematchGraceMinutes,
    prematchWindowStartHours: Math.max(0, prematchTargetHours - prematchGraceMinutes / 60),
    prematchWindowEndHours: prematchTargetHours,
    postmatchDelayMinutes: Math.max(0, numberArg(args.postmatchDelayMinutes || process.env.WORLD_CUP_POSTMATCH_DELAY_MINUTES, DEFAULT_POSTMATCH_DELAY_MINUTES)),
    postmatchMaxAgeHours: Math.max(1, numberArg(args.postmatchMaxAgeHours || process.env.WORLD_CUP_POSTMATCH_MAX_AGE_HOURS, DEFAULT_POSTMATCH_MAX_AGE_HOURS)),
    vipTeams: listArg(args.vipTeams || process.env.WORLD_CUP_VIP_TEAMS, DEFAULT_VIP_TEAMS),
    vipPlayers: listArg(args.vipPlayers || process.env.WORLD_CUP_VIP_PLAYERS, DEFAULT_VIP_PLAYERS),
    youtubeSpikeEnabled: boolArg(args.youtubeSpikeEnabled ?? process.env.WORLD_CUP_YOUTUBE_SPIKE_ENABLED, true),
    youtubeScanMax: Math.max(1, numberArg(args.youtubeScanMax || process.env.WORLD_CUP_YOUTUBE_SCAN_MAX, DEFAULT_YOUTUBE_SCAN_MAX)),
    youtubeDiscoveryEnabled: boolArg(args.youtubeDiscoveryEnabled ?? process.env.WORLD_CUP_YOUTUBE_DISCOVERY_ENABLED, true),
    youtubeDiscoveryIntervalMinutes: Math.max(1, numberArg(args.youtubeDiscoveryIntervalMinutes || process.env.WORLD_CUP_YOUTUBE_DISCOVERY_INTERVAL_MINUTES, DEFAULT_YOUTUBE_DISCOVERY_INTERVAL_MINUTES)),
    youtubeDiscoveryMaxPerRun: Math.max(
      1,
      numberArg(args.youtubeDiscoveryMaxPerRun || process.env.WORLD_CUP_YOUTUBE_DISCOVERY_MAX_PER_RUN || process.env.WORLD_CUP_YOUTUBE_SCAN_MAX, DEFAULT_YOUTUBE_DISCOVERY_MAX_PER_RUN),
    ),
    youtubeStatsIntervalMinutes: Math.max(
      1,
      numberArg(args.youtubeStatsIntervalMinutes || process.env.WORLD_CUP_YOUTUBE_STATS_INTERVAL_MINUTES || process.env.WORLD_CUP_YOUTUBE_SPIKE_INTERVAL_MINUTES, DEFAULT_YOUTUBE_STATS_INTERVAL_MINUTES),
    ),
    youtubePoolRetentionHours: Math.max(1, numberArg(args.youtubePoolRetentionHours || process.env.WORLD_CUP_YOUTUBE_POOL_RETENTION_HOURS, DEFAULT_YOUTUBE_POOL_RETENTION_HOURS)),
    youtubePoolMax: Math.max(1, numberArg(args.youtubePoolMax || process.env.WORLD_CUP_YOUTUBE_POOL_MAX, DEFAULT_YOUTUBE_POOL_MAX)),
    youtubeMinBaselineViews: Math.max(0, numberArg(args.youtubeMinBaselineViews || process.env.WORLD_CUP_YOUTUBE_MIN_BASELINE_VIEWS, DEFAULT_YOUTUBE_MIN_BASELINE_VIEWS)),
    youtubeSpikeGrowthPercent: Math.max(0, numberArg(args.youtubeSpikeGrowthPercent || process.env.WORLD_CUP_YOUTUBE_SPIKE_GROWTH_PERCENT, DEFAULT_YOUTUBE_SPIKE_GROWTH_PERCENT)),
    youtubeSpikeMinDeltaViews: Math.max(0, numberArg(args.youtubeSpikeMinDeltaViews || process.env.WORLD_CUP_YOUTUBE_SPIKE_MIN_DELTA_VIEWS, DEFAULT_YOUTUBE_SPIKE_MIN_DELTA_VIEWS)),
    youtubeStrongDeltaViews: Math.max(0, numberArg(args.youtubeStrongDeltaViews || process.env.WORLD_CUP_YOUTUBE_STRONG_DELTA_VIEWS, DEFAULT_YOUTUBE_STRONG_DELTA_VIEWS)),
    youtubeStrongDeltaMinGrowthPercent: Math.max(
      0,
      numberArg(args.youtubeStrongDeltaMinGrowthPercent || process.env.WORLD_CUP_YOUTUBE_STRONG_DELTA_MIN_GROWTH_PERCENT, DEFAULT_YOUTUBE_STRONG_DELTA_MIN_GROWTH_PERCENT),
    ),
    youtubeTopicMinSpikeVideos: Math.max(1, numberArg(args.youtubeTopicMinSpikeVideos || process.env.WORLD_CUP_YOUTUBE_TOPIC_MIN_SPIKE_VIDEOS, DEFAULT_YOUTUBE_TOPIC_MIN_SPIKE_VIDEOS)),
    youtubeTopicMinChannels: Math.max(1, numberArg(args.youtubeTopicMinChannels || process.env.WORLD_CUP_YOUTUBE_TOPIC_MIN_CHANNELS, DEFAULT_YOUTUBE_TOPIC_MIN_CHANNELS)),
    youtubeTopicMinConfidence: Math.max(0, Math.min(100, numberArg(args.youtubeTopicMinConfidence || process.env.WORLD_CUP_YOUTUBE_TOPIC_MIN_CONFIDENCE, DEFAULT_YOUTUBE_TOPIC_MIN_CONFIDENCE))),
    youtubeClusterAnalyzer: cleanText(args.youtubeClusterAnalyzer || process.env.WORLD_CUP_YOUTUBE_CLUSTER_ANALYZER || "gemini").toLowerCase(),
    youtubeDiagnosticRetentionHours: Math.max(
      1,
      numberArg(args.youtubeDiagnosticRetentionHours || process.env.WORLD_CUP_YOUTUBE_DIAGNOSTIC_RETENTION_HOURS, DEFAULT_YOUTUBE_DIAGNOSTIC_RETENTION_HOURS),
    ),
    analyzerModel: cleanText(args.analyzerModel || process.env.WORLD_CUP_ANALYZER_MODEL || process.env.WORLD_CUP_SEARCH_MODEL || DEFAULT_ANALYZER_MODEL),
    evergreenFallback: boolArg(args.evergreenFallback ?? process.env.WORLD_CUP_EVERGREEN_FALLBACK, true),
    skipNoticeCooldownMinutes: Math.max(0, numberArg(args.skipNoticeCooldownMinutes || process.env.WORLD_CUP_CONTROLLER_SKIP_NOTICE_COOLDOWN_MINUTES, DEFAULT_SKIP_NOTICE_COOLDOWN_MINUTES)),
    telegramBotToken: cleanText(process.env.WORLD_CUP_CONTROLLER_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ""),
    telegramChatId: cleanText(process.env.WORLD_CUP_CONTROLLER_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || ""),
    telegramThreadId: cleanText(process.env.WORLD_CUP_CONTROLLER_TELEGRAM_THREAD_ID || process.env.TELEGRAM_THREAD_ID || ""),
    intentLlmEnabled: boolArg(args.intentLlmEnabled ?? process.env.WORLD_CUP_INTENT_LLM_ENABLED, false),
    intentLlmProvider: cleanText(args.intentLlmProvider || process.env.WORLD_CUP_INTENT_LLM_PROVIDER || "gemma-api"),
    intentLlmUrl: cleanText(args.intentLlmUrl || process.env.WORLD_CUP_INTENT_LLM_URL || ""),
    intentLlmApiKey: cleanText(process.env.WORLD_CUP_INTENT_LLM_API_KEY || ""),
    intentLlmModel: cleanText(args.intentLlmModel || process.env.WORLD_CUP_INTENT_LLM_MODEL || DEFAULT_INTENT_LLM_MODEL),
    intentLlmApiStyle: cleanText(args.intentLlmApiStyle || process.env.WORLD_CUP_INTENT_LLM_API_STYLE || "openai-chat").toLowerCase(),
    intentLlmTimeoutMs: Math.max(3000, numberArg(args.intentLlmTimeoutMs || process.env.WORLD_CUP_INTENT_LLM_TIMEOUT_MS, DEFAULT_INTENT_LLM_TIMEOUT_MS)),
  };
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function openControllerDb(config) {
  await fs.mkdir(path.dirname(config.dbFile), { recursive: true });
  const db = new DatabaseSync(config.dbFile);
  initControllerDb(db);
  return db;
}

function sqliteColumns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

function ensureSqliteColumn(db, table, column, definition) {
  const columns = sqliteColumns(db, table);
  if (!columns.has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function initControllerDb(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS controller_meta (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dispatched (
      key TEXT PRIMARY KEY,
      candidate_json TEXT NOT NULL,
      details_json TEXT NOT NULL,
      source TEXT,
      dispatched_at TEXT NOT NULL,
      workflow_conclusion TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scanned_at TEXT NOT NULL,
      selected_json TEXT,
      candidates_json TEXT NOT NULL,
      warnings_json TEXT NOT NULL,
      diagnostics_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS espn_matches (
      match_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kickoff TEXT,
      status TEXT,
      home TEXT,
      away TEXT,
      score TEXT,
      snapshot_json TEXT NOT NULL,
      first_completed_seen_at TEXT,
      last_seen_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS youtube_videos (
      video_id TEXT PRIMARY KEY,
      title TEXT,
      channel_title TEXT,
      published_at TEXT,
      query TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_views INTEGER NOT NULL DEFAULT 0,
      last_comments INTEGER NOT NULL DEFAULT 0,
      snapshot_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS youtube_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      query TEXT,
      views INTEGER NOT NULL DEFAULT 0,
      comments INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS youtube_discovery_runs (
      run_id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL,
      queries_json TEXT NOT NULL,
      api_calls INTEGER NOT NULL DEFAULT 0,
      videos_found INTEGER NOT NULL DEFAULT 0,
      new_videos INTEGER NOT NULL DEFAULT 0,
      duplicates INTEGER NOT NULL DEFAULT 0,
      rejected_videos INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      diagnostics_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS youtube_stats_runs (
      run_id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL,
      active_pool_size INTEGER NOT NULL DEFAULT 0,
      batches_requested INTEGER NOT NULL DEFAULT 0,
      videos_updated INTEGER NOT NULL DEFAULT 0,
      spike_eligible INTEGER NOT NULL DEFAULT 0,
      rejected_spikes INTEGER NOT NULL DEFAULT 0,
      api_calls INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      diagnostics_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS youtube_spike_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      title TEXT,
      channel_title TEXT,
      previous_views INTEGER NOT NULL DEFAULT 0,
      current_views INTEGER NOT NULL DEFAULT 0,
      delta_views INTEGER NOT NULL DEFAULT 0,
      previous_comments INTEGER NOT NULL DEFAULT 0,
      current_comments INTEGER NOT NULL DEFAULT 0,
      delta_comments INTEGER NOT NULL DEFAULT 0,
      growth_percent REAL NOT NULL DEFAULT 0,
      eligible INTEGER NOT NULL DEFAULT 0,
      rejection_reason TEXT,
      metrics_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS youtube_topic_cluster_attempts (
      run_id TEXT PRIMARY KEY,
      attempted_at TEXT NOT NULL,
      status TEXT NOT NULL,
      input_count INTEGER NOT NULL DEFAULT 0,
      cluster_count INTEGER NOT NULL DEFAULT 0,
      strongest_size INTEGER NOT NULL DEFAULT 0,
      strongest_channels INTEGER NOT NULL DEFAULT 0,
      confidence REAL NOT NULL DEFAULT 0,
      topic TEXT,
      candidate_json TEXT,
      response_json TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_dispatched_day ON dispatched(dispatched_at);
    CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON scans(scanned_at);
    CREATE INDEX IF NOT EXISTS idx_youtube_snapshots_video ON youtube_snapshots(video_id, scanned_at);
    CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON youtube_videos(published_at);
    CREATE INDEX IF NOT EXISTS idx_youtube_videos_last_seen ON youtube_videos(last_seen_at);
    CREATE INDEX IF NOT EXISTS idx_youtube_spike_events_detected ON youtube_spike_events(detected_at);
  `);
  ensureSqliteColumn(db, "youtube_videos", "discovered_run_id", "TEXT");
  ensureSqliteColumn(db, "youtube_videos", "last_stats_run_id", "TEXT");
  ensureSqliteColumn(db, "youtube_videos", "last_delta_views", "INTEGER NOT NULL DEFAULT 0");
  ensureSqliteColumn(db, "youtube_videos", "last_delta_comments", "INTEGER NOT NULL DEFAULT 0");
  ensureSqliteColumn(db, "youtube_videos", "last_growth_percent", "REAL NOT NULL DEFAULT 0");
  ensureSqliteColumn(db, "youtube_videos", "last_spike_eligible", "INTEGER NOT NULL DEFAULT 0");
  ensureSqliteColumn(db, "youtube_videos", "last_rejection_reason", "TEXT");
  ensureSqliteColumn(db, "youtube_videos", "active", "INTEGER NOT NULL DEFAULT 1");
  ensureSqliteColumn(db, "espn_matches", "first_completed_seen_at", "TEXT");
}

function readMetaState(db) {
  const state = { version: 2, dispatched: {}, scans: [] };
  for (const row of db.prepare("SELECT key, value_json FROM controller_meta").all()) {
    state[row.key] = safeJsonParse(row.value_json, null);
  }
  for (const row of db.prepare("SELECT key, candidate_json, details_json, dispatched_at FROM dispatched").all()) {
    const candidate = safeJsonParse(row.candidate_json, null);
    const details = safeJsonParse(row.details_json, {});
    if (!candidate) continue;
    state.dispatched[row.key] = {
      key: row.key,
      candidate,
      dispatchedAt: row.dispatched_at,
      ...details,
    };
  }
  const scans = db
    .prepare("SELECT scanned_at, selected_json, candidates_json, warnings_json, diagnostics_json FROM scans ORDER BY scanned_at DESC LIMIT 200")
    .all();
  state.scans = scans.map((row) => ({
    scannedAt: row.scanned_at,
    selected: safeJsonParse(row.selected_json, null),
    candidates: safeJsonParse(row.candidates_json, []),
    warnings: safeJsonParse(row.warnings_json, []),
    diagnostics: safeJsonParse(row.diagnostics_json, {}),
  }));
  return state;
}

async function migrateLegacyJsonState(config, db) {
  const migrated = db.prepare("SELECT value_json FROM controller_meta WHERE key = ?").get("legacyJsonMigrated");
  if (safeJsonParse(migrated?.value_json || "false", false)) return;
  const count = db.prepare("SELECT COUNT(*) AS count FROM dispatched").get()?.count || 0;
  if (count > 0) {
    db.prepare("INSERT OR REPLACE INTO controller_meta(key, value_json, updated_at) VALUES (?, ?, ?)").run("legacyJsonMigrated", "true", nowIso());
    return;
  }
  const legacy = await readJsonFile(config.stateFile, null);
  if (!legacy || typeof legacy !== "object") {
    db.prepare("INSERT OR REPLACE INTO controller_meta(key, value_json, updated_at) VALUES (?, ?, ?)").run("legacyJsonMigrated", "true", nowIso());
    return;
  }
  const state = { version: 2, dispatched: legacy.dispatched || {}, scans: legacy.scans || [], ...legacy };
  persistControllerState(db, state);
  for (const scan of state.scans || []) {
    recordScan(db, scan);
  }
  db.prepare("INSERT OR REPLACE INTO controller_meta(key, value_json, updated_at) VALUES (?, ?, ?)").run("legacyJsonMigrated", "true", nowIso());
}

async function loadControllerState(config, db) {
  await migrateLegacyJsonState(config, db);
  return readMetaState(db);
}

function persistControllerState(db, state) {
  const updatedAt = nowIso();
  const metaKeys = [
    "lastStatus",
    "lastError",
    "lastDispatchAt",
    "lastWorkflowCompletedAt",
    "lastScanStartedAt",
    "lastScanCompletedAt",
    "lastTelegramCommandAt",
    "lastTelegramCommandError",
    "lastTelegramDiscoveryRequest",
    "lastNoCandidateNoticeAt",
    "lastNoCandidateNoticeKey",
    "lastNoCandidateNoticeReason",
    "telegramUpdateOffset",
    "forcePredictionNow",
  ];
  const upsertMeta = db.prepare(`
    INSERT INTO controller_meta(key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `);
  for (const key of metaKeys) {
    if (state[key] !== undefined) upsertMeta.run(key, jsonText(state[key]), updatedAt);
  }
  const upsertDispatch = db.prepare(`
    INSERT INTO dispatched(key, candidate_json, details_json, source, dispatched_at, workflow_conclusion, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      candidate_json = excluded.candidate_json,
      details_json = excluded.details_json,
      source = excluded.source,
      dispatched_at = excluded.dispatched_at,
      workflow_conclusion = excluded.workflow_conclusion,
      updated_at = excluded.updated_at
  `);
  for (const [key, entry] of Object.entries(state.dispatched || {})) {
    const { candidate, ...details } = entry || {};
    if (!candidate) continue;
    upsertDispatch.run(
      key,
      jsonText(candidate),
      jsonText(details),
      cleanText(candidate.source),
      cleanText(entry.dispatchedAt || entry.attemptedAt || updatedAt),
      cleanText(entry.workflowRun?.conclusion || ""),
      updatedAt,
    );
  }
}

function recordScan(db, scan = {}) {
  if (!scan?.scannedAt) return;
  db.prepare(`
    INSERT INTO scans(scanned_at, selected_json, candidates_json, warnings_json, diagnostics_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    scan.scannedAt,
    jsonText(scan.selected || null),
    jsonText(scan.candidates || []),
    jsonText(scan.warnings || []),
    jsonText(scan.diagnostics || {}),
  );
}

function recordEspnMatches(db, matches = [], scannedAt = nowIso(), config = {}) {
  const stmt = db.prepare(`
    INSERT INTO espn_matches(match_id, name, kickoff, status, home, away, score, snapshot_json, first_completed_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(match_id) DO UPDATE SET
      name = excluded.name,
      kickoff = excluded.kickoff,
      status = excluded.status,
      home = excluded.home,
      away = excluded.away,
      score = excluded.score,
      snapshot_json = excluded.snapshot_json,
      first_completed_seen_at = COALESCE(espn_matches.first_completed_seen_at, excluded.first_completed_seen_at),
      last_seen_at = excluded.last_seen_at
  `);
  for (const match of matches) {
    const existing = db.prepare("SELECT first_completed_seen_at FROM espn_matches WHERE match_id = ?").get(cleanText(match.id));
    const kickoffMs = Date.parse(match.kickoff || "");
    const scannedMs = Date.parse(scannedAt);
    const postmatchMaxAgeMs = Math.max(1, Number(config.postmatchMaxAgeHours || DEFAULT_POSTMATCH_MAX_AGE_HOURS)) * 36e5;
    const estimatedCompletedMs = Number.isFinite(kickoffMs) ? expectedFullTimeMs(kickoffMs) : NaN;
    const completionIsFreshEnough = Number.isFinite(estimatedCompletedMs) && Number.isFinite(scannedMs) && scannedMs - estimatedCompletedMs <= postmatchMaxAgeMs;
    const firstCompletedSeenAt = cleanText(existing?.first_completed_seen_at) || (match.completed && completionIsFreshEnough ? scannedAt : "");
    match.firstCompletedSeenAt = firstCompletedSeenAt;
    stmt.run(
      cleanText(match.id),
      cleanText(match.name),
      cleanText(match.kickoff),
      cleanText(match.status),
      cleanText(match.home),
      cleanText(match.away),
      cleanText(match.score),
      jsonText(match),
      firstCompletedSeenAt,
      scannedAt,
    );
  }
}

function latestYouTubeSnapshot(db, videoId) {
  return (
    db
      .prepare("SELECT video_id, scanned_at, views, comments FROM youtube_snapshots WHERE video_id = ? ORDER BY scanned_at DESC LIMIT 1")
      .get(videoId) || null
  );
}

function lastYouTubeScanAt(db) {
  return cleanText(db.prepare("SELECT MAX(scanned_at) AS scanned_at FROM youtube_snapshots").get()?.scanned_at);
}

function recordYouTubeSnapshot(db, video, scannedAt = nowIso()) {
  const previous = latestYouTubeSnapshot(db, video.id);
  db.prepare(`
    INSERT INTO youtube_videos(video_id, title, channel_title, published_at, query, first_seen_at, last_seen_at, last_views, last_comments, snapshot_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(video_id) DO UPDATE SET
      title = excluded.title,
      channel_title = excluded.channel_title,
      published_at = excluded.published_at,
      query = excluded.query,
      last_seen_at = excluded.last_seen_at,
      last_views = excluded.last_views,
      last_comments = excluded.last_comments,
      snapshot_json = excluded.snapshot_json
  `).run(
    video.id,
    cleanText(video.title),
    cleanText(video.channelTitle),
    cleanText(video.publishedAt),
    cleanText(video.query),
    scannedAt,
    scannedAt,
    Number(video.views || 0),
    Number(video.comments || 0),
    jsonText(video),
  );
  db.prepare("INSERT INTO youtube_snapshots(video_id, scanned_at, query, views, comments) VALUES (?, ?, ?, ?, ?)").run(
    video.id,
    scannedAt,
    cleanText(video.query),
    Number(video.views || 0),
    Number(video.comments || 0),
  );
  return previous;
}

function latestRunAt(db, table, column = "started_at") {
  return cleanText(db.prepare(`SELECT MAX(${column}) AS run_at FROM ${table}`).get()?.run_at);
}

function minutesSince(isoText, now = new Date()) {
  const ms = Date.parse(isoText || "");
  if (!Number.isFinite(ms)) return Infinity;
  return (now.getTime() - ms) / 60000;
}

function shouldRunInterval(lastAt, intervalMinutes, now = new Date(), force = false) {
  if (force) return true;
  if (!lastAt) return true;
  const elapsed = minutesSince(lastAt, now);
  return !Number.isFinite(elapsed) || elapsed >= intervalMinutes;
}

function rollingCutoffIso(hours, now = new Date()) {
  return new Date(now.getTime() - Math.max(1, Number(hours || 1)) * 60 * 60 * 1000).toISOString();
}

function pruneYouTubeDiagnostics(db, config, now = new Date()) {
  const poolCutoff = rollingCutoffIso(config.youtubePoolRetentionHours, now);
  const diagnosticCutoff = rollingCutoffIso(config.youtubeDiagnosticRetentionHours, now);
  db.prepare("UPDATE youtube_videos SET active = 0 WHERE COALESCE(published_at, first_seen_at) < ?").run(poolCutoff);
  db.prepare("DELETE FROM youtube_snapshots WHERE scanned_at < ?").run(diagnosticCutoff);
  db.prepare("DELETE FROM youtube_spike_events WHERE detected_at < ?").run(diagnosticCutoff);
  db.prepare("DELETE FROM youtube_discovery_runs WHERE started_at < ?").run(diagnosticCutoff);
  db.prepare("DELETE FROM youtube_stats_runs WHERE started_at < ?").run(diagnosticCutoff);
  db.prepare("DELETE FROM youtube_topic_cluster_attempts WHERE attempted_at < ?").run(diagnosticCutoff);
  db.prepare("DELETE FROM youtube_videos WHERE active = 0 AND last_seen_at < ?").run(diagnosticCutoff);
}

function activeYouTubePoolRows(db, config, now = new Date()) {
  const cutoff = rollingCutoffIso(config.youtubePoolRetentionHours, now);
  return db
    .prepare(
      `SELECT video_id, title, channel_title, published_at, query, first_seen_at, last_seen_at, last_views, last_comments
       FROM youtube_videos
       WHERE active = 1
         AND COALESCE(published_at, first_seen_at) >= ?
       ORDER BY datetime(COALESCE(published_at, first_seen_at)) DESC, datetime(first_seen_at) DESC
       LIMIT ?`,
    )
    .all(cutoff, Math.max(1, Number(config.youtubePoolMax || DEFAULT_YOUTUBE_POOL_MAX)));
}

function enforceYouTubePoolCap(db, config, now = new Date()) {
  const cutoff = rollingCutoffIso(config.youtubePoolRetentionHours, now);
  db.prepare(
    `UPDATE youtube_videos
     SET active = 0
     WHERE video_id NOT IN (
       SELECT video_id
       FROM youtube_videos
       WHERE COALESCE(published_at, first_seen_at) >= ?
       ORDER BY datetime(COALESCE(published_at, first_seen_at)) DESC, datetime(first_seen_at) DESC
       LIMIT ?
     )`,
  ).run(cutoff, Math.max(1, Number(config.youtubePoolMax || DEFAULT_YOUTUBE_POOL_MAX)));
}

function upsertDiscoveredYouTubeVideo(db, video, runId, discoveredAt = nowIso()) {
  const existing = db.prepare("SELECT video_id FROM youtube_videos WHERE video_id = ?").get(video.id);
  db.prepare(`
    INSERT INTO youtube_videos(video_id, title, channel_title, published_at, query, first_seen_at, last_seen_at, last_views, last_comments, snapshot_json, discovered_run_id, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 1)
    ON CONFLICT(video_id) DO UPDATE SET
      title = excluded.title,
      channel_title = excluded.channel_title,
      published_at = excluded.published_at,
      query = excluded.query,
      last_seen_at = excluded.last_seen_at,
      snapshot_json = excluded.snapshot_json,
      active = 1
  `).run(
    video.id,
    cleanText(video.title),
    cleanText(video.channelTitle),
    cleanText(video.publishedAt),
    cleanText(video.query),
    discoveredAt,
    discoveredAt,
    jsonText(video),
    cleanText(runId),
  );
  return !existing;
}

function recordDiscoveryRun(db, summary = {}) {
  db.prepare(`
    INSERT OR REPLACE INTO youtube_discovery_runs(run_id, started_at, completed_at, status, queries_json, api_calls, videos_found, new_videos, duplicates, rejected_videos, error, diagnostics_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cleanText(summary.runId),
    cleanText(summary.startedAt),
    cleanText(summary.completedAt),
    cleanText(summary.status || "success"),
    jsonText(summary.queries || []),
    Number(summary.apiCalls || 0),
    Number(summary.videosFound || 0),
    Number(summary.newVideos || 0),
    Number(summary.duplicates || 0),
    Number(summary.rejectedVideos || 0),
    cleanText(summary.error),
    jsonText(summary),
  );
}

function recordStatsRun(db, summary = {}) {
  db.prepare(`
    INSERT OR REPLACE INTO youtube_stats_runs(run_id, started_at, completed_at, status, active_pool_size, batches_requested, videos_updated, spike_eligible, rejected_spikes, api_calls, error, diagnostics_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cleanText(summary.runId),
    cleanText(summary.startedAt),
    cleanText(summary.completedAt),
    cleanText(summary.status || "success"),
    Number(summary.activePoolSize || 0),
    Number(summary.batchesRequested || 0),
    Number(summary.videosUpdated || 0),
    Number(summary.spikeEligible || 0),
    Number(summary.rejectedSpikes || 0),
    Number(summary.apiCalls || 0),
    cleanText(summary.error),
    jsonText(summary),
  );
}

function recordSpikeEvent(db, runId, video, previous, metrics, detectedAt = nowIso()) {
  db.prepare(`
    INSERT INTO youtube_spike_events(
      run_id, video_id, detected_at, title, channel_title, previous_views, current_views, delta_views,
      previous_comments, current_comments, delta_comments, growth_percent, eligible, rejection_reason, metrics_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cleanText(runId),
    cleanText(video.id),
    detectedAt,
    cleanText(video.title),
    cleanText(video.channelTitle),
    Number(previous?.views || 0),
    Number(video.views || 0),
    Number(metrics.deltaViews || 0),
    Number(previous?.comments || 0),
    Number(video.comments || 0),
    Number(metrics.deltaComments || 0),
    Number(metrics.growthPercent || 0),
    metrics.eligible ? 1 : 0,
    cleanText(metrics.rejectionReason),
    jsonText(metrics),
  );
}

function recordYouTubeStatsSnapshot(db, video, previous, metrics, runId, scannedAt = nowIso()) {
  db.prepare(`
    UPDATE youtube_videos
    SET title = ?, channel_title = ?, published_at = ?, last_seen_at = ?, last_views = ?, last_comments = ?,
        snapshot_json = ?, last_stats_run_id = ?, last_delta_views = ?, last_delta_comments = ?,
        last_growth_percent = ?, last_spike_eligible = ?, last_rejection_reason = ?, active = 1
    WHERE video_id = ?
  `).run(
    cleanText(video.title),
    cleanText(video.channelTitle),
    cleanText(video.publishedAt),
    scannedAt,
    Number(video.views || 0),
    Number(video.comments || 0),
    jsonText(video),
    cleanText(runId),
    Number(metrics.deltaViews || 0),
    Number(metrics.deltaComments || 0),
    Number(metrics.growthPercent || 0),
    metrics.eligible ? 1 : 0,
    cleanText(metrics.rejectionReason),
    cleanText(video.id),
  );
  db.prepare("INSERT INTO youtube_snapshots(video_id, scanned_at, query, views, comments) VALUES (?, ?, ?, ?, ?)").run(
    video.id,
    scannedAt,
    cleanText(video.query),
    Number(video.views || 0),
    Number(video.comments || 0),
  );
  recordSpikeEvent(db, runId, video, previous, metrics, scannedAt);
}

function recentEligibleSpikeVideos(db, config, now = new Date()) {
  const cutoff = new Date(now.getTime() - Math.max(1, Number(config.youtubeStatsIntervalMinutes || DEFAULT_YOUTUBE_STATS_INTERVAL_MINUTES) + 5) * 60 * 1000).toISOString();
  return db
    .prepare(
      `SELECT video_id AS id, title, channel_title AS channelTitle, current_views AS views, current_comments AS comments,
              previous_views AS previousViews, previous_comments AS previousComments, delta_views AS deltaViews,
              delta_comments AS deltaComments, growth_percent AS growthPercent, metrics_json AS metricsJson
       FROM youtube_spike_events
       WHERE eligible = 1 AND detected_at >= ?
       ORDER BY growth_percent DESC, delta_views DESC
       LIMIT 200`,
    )
    .all(cutoff)
    .map((row) => ({
      ...row,
      spike: { ...safeJsonParse(row.metricsJson, {}), score: Number(safeJsonParse(row.metricsJson, {})?.score || 0) },
    }));
}

function candidateKey(candidate) {
  return hashText(`${candidate.type}:${candidate.topic}:${candidate.teamA || ""}:${candidate.teamB || ""}:${candidate.kickoff || ""}`);
}

function wasDispatched(state, candidate, config = {}) {
  const key = candidateKey(candidate);
  const entry = state.dispatched?.[key];
  if (!entry) return false;
  const conclusion = cleanText(entry.workflowRun?.conclusion || "").toLowerCase();
  if (["failure", "cancelled", "timed_out", "action_required"].includes(conclusion) || entry.error) {
    const failedMs = Date.parse(entry.workflowRun?.completedAt || entry.workflowRun?.completed_at || entry.updatedAt || entry.dispatchedAt || entry.attemptedAt || "");
    const cooldownMinutes = Number(config.failedDispatchCooldownMinutes ?? DEFAULT_FAILED_DISPATCH_COOLDOWN_MINUTES);
    if (!Number.isFinite(failedMs)) {
      return true;
    }
    return Date.now() - failedMs < cooldownMinutes * 60 * 1000;
  }
  if (!conclusion && !entry.workflowRun?.id) {
    const dispatchedMs = Date.parse(entry.dispatchedAt || entry.attemptedAt || "");
    const retryMinutes = Number(config.staleDispatchRetryMinutes || DEFAULT_STALE_DISPATCH_RETRY_MINUTES);
    if (Number.isFinite(dispatchedMs) && Date.now() - dispatchedMs > retryMinutes * 60 * 1000) {
      return false;
    }
  }
  return true;
}

function markDispatched(state, candidate, details = {}) {
  const key = candidateKey(candidate);
  state.dispatched ||= {};
  state.dispatched[key] = {
    key,
    candidate,
    dispatchedAt: nowIso(),
    ...details,
  };
}

function expectedFullTimeMs(kickoffMs) {
  return kickoffMs + 125 * 60 * 1000;
}

function candidateText(candidate) {
  return cleanText(`${candidate?.topic || ""} ${candidate?.teamA || ""} ${candidate?.teamB || ""} ${candidate?.reason || ""}`);
}

function isMajorTeamName(value) {
  const comparable = normalizeTeamComparable(value);
  if (!comparable) return false;
  return DEFAULT_VIP_TEAMS.some((team) => teamMatchesVip(comparable, team));
}

function fixtureIsPriority(fixture) {
  const tier = cleanText(fixture.tier || fixture.priorityTier || "").toLowerCase();
  if (["a", "b", "major", "priority"].includes(tier)) return true;
  if (boolArg(fixture.priority, false) || boolArg(fixture.force, false)) return true;
  return isMajorTeamName(fixture.teamA) || isMajorTeamName(fixture.teamB) || isMajorTeamName(fixture.topic);
}

function matchCandidateFromFixture(fixture, state, now = new Date(), config = {}) {
  const kickoffMs = Date.parse(fixture.kickoff || "");
  if (!Number.isFinite(kickoffMs)) return null;
  if (config.majorOnlyScheduled !== false && !fixtureIsPriority(fixture)) return null;
  const nowMs = now.getTime();
  const predictionWindowStart = kickoffMs - 12 * 60 * 60 * 1000;
  const predictionWindowEnd = kickoffMs - 11 * 60 * 60 * 1000 + 15 * 60 * 1000;
  const postmatchWindowStart = expectedFullTimeMs(kickoffMs) + 25 * 60 * 1000;
  const base = {
    teamA: fixture.teamA,
    teamB: fixture.teamB,
    kickoff: fixture.kickoff,
    matchId: cleanText(fixture.matchId) || hashText(`${fixture.date}:${fixture.teamA}:${fixture.teamB}`),
    score: 100,
    reason: "Fixture timing rule.",
    source: "fixture-scheduler",
  };
  const prediction = {
    ...base,
    type: "prediction",
    topic: fixture.topic || `${fixture.teamA} vs ${fixture.teamB} World Cup prediction`,
    timing: "12-hour-before-kickoff",
  };
  if ((nowMs >= predictionWindowStart && nowMs < predictionWindowEnd) || state.forcePredictionNow) {
    return prediction;
  }
  const postmatch = {
    ...base,
    type: "postmatch",
    topic: `${fixture.teamA} vs ${fixture.teamB} post-match analysis: the moment that changed the game`,
    timing: "postmatch-after-fulltime",
  };
  if (nowMs >= postmatchWindowStart && nowMs < postmatchWindowStart + 90 * 60 * 1000) {
    return postmatch;
  }
  return null;
}

function configuredFixtures() {
  const raw = cleanText(process.env.WORLD_CUP_FIXTURES_JSON || "");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to checked-in defaults.
    }
  }
  return knownOpeningFixtures();
}

function yyyymmdd(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function espnScheduleDates(now = new Date(), lookaheadDays = DEFAULT_MATCH_LOOKAHEAD_DAYS) {
  const dates = [];
  for (let offset = -1; offset <= lookaheadDays; offset += 1) {
    const date = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    dates.push(yyyymmdd(date));
  }
  return [...new Set(dates)];
}

function espnUrlForDate(baseUrl, dateText) {
  const url = new URL(baseUrl);
  url.searchParams.set("dates", dateText);
  return url;
}

function normalizeEspnEvent(event = {}) {
  const competition = Array.isArray(event.competitions) ? event.competitions[0] || {} : {};
  const competitors = Array.isArray(competition.competitors) ? competition.competitors : [];
  if (!event.id || !event.date || competitors.length < 2) return null;
  const home = competitors.find((competitor) => cleanText(competitor.homeAway).toLowerCase() === "home") || competitors[0];
  const away = competitors.find((competitor) => cleanText(competitor.homeAway).toLowerCase() === "away") || competitors.find((competitor) => competitor !== home) || competitors[1];
  const homeName = cleanText(home?.team?.displayName || home?.team?.name || home?.team?.shortDisplayName);
  const awayName = cleanText(away?.team?.displayName || away?.team?.name || away?.team?.shortDisplayName);
  if (!homeName || !awayName) return null;
  const kickoffMs = Date.parse(event.date);
  if (!Number.isFinite(kickoffMs)) return null;
  const statusType = event.status?.type || {};
  const status = cleanText(statusType.description || statusType.name || event.status?.description || "");
  const statusState = cleanText(statusType.state || "").toLowerCase();
  const completed = Boolean(statusType.completed) || statusState === "post" || /^(final|ft|full time|full-time)$/i.test(status);
  const homeScore = cleanText(home?.score || "0");
  const awayScore = cleanText(away?.score || "0");
  return {
    id: cleanText(event.id),
    name: cleanText(event.name || event.shortName || `${awayName} at ${homeName}`),
    kickoff: new Date(kickoffMs).toISOString(),
    status,
    statusState,
    completed,
    home: homeName,
    away: awayName,
    score: `${homeName} ${homeScore} - ${awayScore} ${awayName}`,
    rawStatus: statusType,
  };
}

function normalizeTeamComparable(value = "") {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(?:fc|sc|cf|afc|the)\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function regexEscape(text = "") {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textMentionsVipEntity(text = "", entity = "") {
  const comparableText = normalizeTeamComparable(text);
  const comparableEntity = normalizeTeamComparable(entity);
  if (!comparableText || !comparableEntity) return false;
  return new RegExp(`(?:^|\\s)${regexEscape(comparableEntity)}(?:$|\\s)`, "i").test(comparableText);
}

function teamMatchesVip(teamName = "", vipTeam = "") {
  const team = normalizeTeamComparable(teamName);
  const vip = normalizeTeamComparable(vipTeam);
  if (!team || !vip) return false;
  return team === vip;
}

function textHasVipPlayer(text = "", player = "") {
  const cleaned = cleanText(text);
  const value = cleanText(player);
  if (!cleaned || !value) return false;
  return new RegExp(`\\b${regexEscape(value)}\\b`, "i").test(cleaned);
}

function isVipMatch(match = {}, config = {}) {
  const teams = [match.home, match.away].map(cleanText).filter(Boolean);
  if (teams.some(isMajorTeamName)) return true;
  const vipTeams = [...new Set([...(config.vipTeams || []), ...DEFAULT_VIP_TEAMS])];
  for (const team of vipTeams) {
    if (teams.some((teamName) => teamMatchesVip(teamName, team))) return true;
  }
  const haystack = cleanText(`${match.home || ""} ${match.away || ""} ${match.name || ""}`);
  const vipPlayers = [...new Set([...(config.vipPlayers || []), ...DEFAULT_VIP_PLAYERS])];
  for (const player of vipPlayers) {
    if (textHasVipPlayer(haystack, player)) return true;
  }
  return false;
}

function espnCandidateFromMatch(match = {}, config = {}, now = new Date()) {
  if (!isVipMatch(match, config)) return null;
  const kickoffMs = Date.parse(match.kickoff || "");
  if (!Number.isFinite(kickoffMs)) return null;
  const nowMs = now.getTime();
  const targetHours = Number(config.prematchTargetHours ?? config.prematchWindowEndHours ?? DEFAULT_PREMATCH_TARGET_HOURS);
  const legacyStartHours = Number(config.prematchWindowStartHours);
  const legacyEndHours = Number(config.prematchWindowEndHours);
  const fallbackGraceMinutes = Number.isFinite(legacyStartHours) && Number.isFinite(legacyEndHours) ? Math.max(1, (legacyEndHours - legacyStartHours) * 60) : DEFAULT_PREMATCH_GRACE_MINUTES;
  const graceMinutes = Number(config.prematchGraceMinutes ?? fallbackGraceMinutes);
  const preTriggerMs = kickoffMs - Math.max(0, targetHours) * 36e5;
  const preGraceMs = Math.max(1, graceMinutes) * 60 * 1000;
  const timeUntilHours = (kickoffMs - nowMs) / 36e5;
  const base = {
    teamA: match.away,
    teamB: match.home,
    kickoff: match.kickoff,
    matchId: `espn-${match.id}`,
    source: "espn-scoreboard",
    espn: match,
  };
  if (!match.completed && nowMs >= preTriggerMs && nowMs <= preTriggerMs + preGraceMs) {
    return {
      ...base,
      type: "prediction",
      topic: `${match.away} vs ${match.home} match planning: the pressure angle fans should watch`,
      score: 100,
      reason: `ESPN VIP pre-match 36-hour trigger (${Math.round(timeUntilHours * 10) / 10} hours before kickoff).`,
      timing: "espn-prematch",
      dueAt: new Date(preTriggerMs).toISOString(),
    };
  }
  const postDelayMs = Number(config.postmatchDelayMinutes ?? DEFAULT_POSTMATCH_DELAY_MINUTES) * 60 * 1000;
  const completionSeenMs = Date.parse(match.firstCompletedSeenAt || match.completedSeenAt || match.completedAt || "");
  const completionBasisMs = Number.isFinite(completionSeenMs) ? completionSeenMs : expectedFullTimeMs(kickoffMs);
  const postmatchMaxAgeMs = Math.max(1, Number(config.postmatchMaxAgeHours || DEFAULT_POSTMATCH_MAX_AGE_HOURS)) * 36e5;
  if (match.completed && nowMs >= completionBasisMs + postDelayMs && nowMs - completionBasisMs <= postmatchMaxAgeMs) {
    return {
      ...base,
      type: "postmatch",
      topic: `${match.away} vs ${match.home} post-match analysis: the result everyone is reacting to`,
      score: 99,
      reason: `ESPN final-status trigger ${Math.round(postDelayMs / 60000)} minutes after match completion. Final score: ${match.score}.`,
      timing: "espn-postmatch",
      dueAt: new Date(completionBasisMs + postDelayMs).toISOString(),
    };
  }
  return null;
}

async function fetchEspnMatches(config, warnings, now = new Date()) {
  if (!config.espnEnabled) return [];
  const matches = [];
  const seen = new Set();
  for (const dateText of espnScheduleDates(now, config.matchLookaheadDays)) {
    try {
      const response = await fetchWithControllerTimeout(espnUrlForDate(config.espnScoreboardUrl, dateText), {}, config.fetchTimeoutMs);
      const body = await response.text().catch(() => "");
      if (!response.ok) {
        warnings.push(`ESPN schedule fetch failed for ${dateText}: ${response.status} ${body.slice(0, 160)}`);
        continue;
      }
      const data = body ? JSON.parse(body) : {};
      for (const event of Array.isArray(data.events) ? data.events : []) {
        const match = normalizeEspnEvent(event);
        if (!match || seen.has(match.id)) continue;
        seen.add(match.id);
        matches.push(match);
      }
    } catch (error) {
      warnings.push(`ESPN schedule fetch failed for ${dateText}: ${error.message}`);
    }
  }
  return matches;
}

async function buildEspnCandidates(config, state, db, warnings, now = new Date()) {
  if (config.offline || !config.espnEnabled) return [];
  const matches = await fetchEspnMatches(config, warnings, now);
  recordEspnMatches(db, matches, nowIso(), config);
  const candidates = matches.map((match) => espnCandidateFromMatch(match, config, now)).filter(Boolean);
  if (!matches.length) warnings.push("ESPN returned no soccer matches for the configured lookahead window.");
  if (matches.length && !candidates.length) warnings.push(`ESPN returned ${matches.length} matches, but none were VIP matches inside pre/post trigger windows.`);
  return candidates;
}

function youtubeQueries() {
  return String(process.env.WORLD_CUP_TREND_QUERIES || "FIFA World Cup 2026|World Cup 2026|football World Cup|USMNT World Cup|Messi Ronaldo World Cup")
    .split("|")
    .map(cleanText)
    .filter(Boolean);
}

async function fetchWithControllerTimeout(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function youtubeKeyList(config = {}) {
  return [...new Set([...(config.youtubeApiKeys || []), config.youtubeApiKey].map(cleanText).filter(Boolean))];
}

function isYouTubeKeyRetryableError(error) {
  return /YouTube .* failed: (400|403|429)\b|quota|rateLimit|dailyLimitExceeded|keyInvalid|API key not valid/i.test(error?.message || "");
}

async function youtubeSearch(config, query, options = {}) {
  if (!config.youtubeApiKey) return [];
  const maxResults = Math.max(1, Math.min(50, Number(options.maxResults || 8)));
  const publishedAfterHours = Math.max(1, Number(options.publishedAfterHours || 4));
  const publishedAfter = new Date(Date.now() - publishedAfterHours * 60 * 60 * 1000).toISOString();
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(maxResults));
  searchUrl.searchParams.set("order", "date");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("publishedAfter", publishedAfter);
  searchUrl.searchParams.set("key", config.youtubeApiKey);
  const searchResponse = await fetchWithControllerTimeout(searchUrl, {}, config.fetchTimeoutMs);
  if (!searchResponse.ok) {
    const detail = cleanText(await searchResponse.text().catch(() => "")).slice(0, 240);
    throw new Error(`YouTube search failed: ${searchResponse.status}${detail ? ` ${detail}` : ""}`);
  }
  const searchJson = await searchResponse.json();
  const ids = (searchJson.items || []).map((item) => item.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  statsUrl.searchParams.set("part", "snippet,statistics");
  statsUrl.searchParams.set("id", ids.join(","));
  statsUrl.searchParams.set("key", config.youtubeApiKey);
  const statsResponse = await fetchWithControllerTimeout(statsUrl, {}, config.fetchTimeoutMs);
  if (!statsResponse.ok) {
    const detail = cleanText(await statsResponse.text().catch(() => "")).slice(0, 240);
    throw new Error(`YouTube stats failed: ${statsResponse.status}${detail ? ` ${detail}` : ""}`);
  }
  const statsJson = await statsResponse.json();
  return (statsJson.items || []).map((item) => ({
    id: item.id,
    title: cleanText(item.snippet?.title),
    channelTitle: cleanText(item.snippet?.channelTitle),
    publishedAt: item.snippet?.publishedAt,
    views: Number(item.statistics?.viewCount || 0),
    comments: Number(item.statistics?.commentCount || 0),
    query,
  }));
}

async function youtubeSearchWithKeyFallback(config, query, options = {}, warnings = []) {
  const keys = youtubeKeyList(config);
  if (!keys.length) return [];
  const startIndex = Math.max(0, Number(options.keyIndex || 0)) % keys.length;
  let lastError = null;
  for (let offset = 0; offset < keys.length; offset += 1) {
    const keyIndex = (startIndex + offset) % keys.length;
    try {
      return await youtubeSearch({ ...config, youtubeApiKey: keys[keyIndex] }, query, options);
    } catch (error) {
      lastError = error;
      if (keys.length <= 1 || !isYouTubeKeyRetryableError(error)) throw error;
      warnings.push(`YouTube key slot ${keyIndex + 1}/${keys.length} failed for "${query}": ${cleanText(error.message).slice(0, 180)}.`);
    }
  }
  throw lastError || new Error("YouTube search failed for all configured key slots.");
}

async function youtubeDiscoverySearch(config, query, options = {}) {
  if (!config.youtubeApiKey) return { videos: [], nextPageToken: "" };
  const maxResults = Math.max(1, Math.min(50, Number(options.maxResults || 50)));
  const publishedAfterHours = Math.max(1, Number(options.publishedAfterHours || config.youtubePoolRetentionHours || DEFAULT_YOUTUBE_POOL_RETENTION_HOURS));
  const publishedAfter = new Date((options.now || new Date()).getTime() - publishedAfterHours * 60 * 60 * 1000).toISOString();
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(maxResults));
  searchUrl.searchParams.set("order", "date");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("publishedAfter", publishedAfter);
  if (options.pageToken) searchUrl.searchParams.set("pageToken", options.pageToken);
  searchUrl.searchParams.set("key", config.youtubeApiKey);
  const response = await fetchWithControllerTimeout(searchUrl, {}, config.fetchTimeoutMs);
  if (!response.ok) {
    const detail = cleanText(await response.text().catch(() => "")).slice(0, 240);
    throw new Error(`YouTube discovery failed: ${response.status}${detail ? ` ${detail}` : ""}`);
  }
  const json = await response.json();
  return {
    videos: (json.items || [])
      .map((item) => ({
        id: item.id?.videoId,
        title: cleanText(item.snippet?.title),
        channelTitle: cleanText(item.snippet?.channelTitle),
        publishedAt: item.snippet?.publishedAt,
        query,
      }))
      .filter((video) => video.id && video.title),
    nextPageToken: cleanText(json.nextPageToken),
  };
}

async function youtubeDiscoverySearchWithKeyFallback(config, query, options = {}, warnings = []) {
  const keys = youtubeKeyList(config);
  if (!keys.length) return { videos: [], nextPageToken: "" };
  const startIndex = Math.max(0, Number(options.keyIndex || 0)) % keys.length;
  let lastError = null;
  for (let offset = 0; offset < keys.length; offset += 1) {
    const keyIndex = (startIndex + offset) % keys.length;
    try {
      return await youtubeDiscoverySearch({ ...config, youtubeApiKey: keys[keyIndex] }, query, options);
    } catch (error) {
      lastError = error;
      if (keys.length <= 1 || !isYouTubeKeyRetryableError(error)) throw error;
      warnings.push(`YouTube discovery key slot ${keyIndex + 1}/${keys.length} failed for "${query}": ${cleanText(error.message).slice(0, 180)}.`);
    }
  }
  throw lastError || new Error("YouTube discovery failed for all configured key slots.");
}

async function youtubeVideosList(config, ids = [], options = {}) {
  if (!config.youtubeApiKey || !ids.length) return [];
  const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  statsUrl.searchParams.set("part", "snippet,statistics");
  statsUrl.searchParams.set("id", ids.slice(0, 50).join(","));
  statsUrl.searchParams.set("key", config.youtubeApiKey);
  const response = await fetchWithControllerTimeout(statsUrl, {}, config.fetchTimeoutMs);
  if (!response.ok) {
    const detail = cleanText(await response.text().catch(() => "")).slice(0, 240);
    throw new Error(`YouTube stats failed: ${response.status}${detail ? ` ${detail}` : ""}`);
  }
  const json = await response.json();
  return (json.items || []).map((item) => ({
    id: item.id,
    title: cleanText(item.snippet?.title),
    channelTitle: cleanText(item.snippet?.channelTitle),
    publishedAt: item.snippet?.publishedAt,
    views: Number(item.statistics?.viewCount || 0),
    comments: Number(item.statistics?.commentCount || 0),
    query: cleanText(options.query),
  }));
}

async function youtubeVideosListWithKeyFallback(config, ids = [], options = {}, warnings = []) {
  const keys = youtubeKeyList(config);
  if (!keys.length || !ids.length) return [];
  const startIndex = Math.max(0, Number(options.keyIndex || 0)) % keys.length;
  let lastError = null;
  for (let offset = 0; offset < keys.length; offset += 1) {
    const keyIndex = (startIndex + offset) % keys.length;
    try {
      return await youtubeVideosList({ ...config, youtubeApiKey: keys[keyIndex] }, ids, options);
    } catch (error) {
      lastError = error;
      if (keys.length <= 1 || !isYouTubeKeyRetryableError(error)) throw error;
      warnings.push(`YouTube stats key slot ${keyIndex + 1}/${keys.length} failed: ${cleanText(error.message).slice(0, 180)}.`);
    }
  }
  throw lastError || new Error("YouTube stats failed for all configured key slots.");
}

function chunkArray(items = [], size = 50) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function scoreYouTubeVideo(video) {
  const ageHours = Math.max(0.25, (Date.now() - Date.parse(video.publishedAt || nowIso())) / 36e5);
  const viewVelocity = video.views / ageHours;
  const velocityScore = Math.min(30, Math.log10(viewVelocity + 1) * 8);
  const commentScore = Math.min(15, Math.log10(video.comments + 1) * 6);
  const recognizedEntity =
    /world cup/i.test(video.title) ||
    MAJOR_TEAM_PATTERN.test(normalizeTeamComparable(video.title)) ||
    RECOGNIZABLE_PLAYER_PATTERN.test(video.title) ||
    DEFAULT_VIP_TEAMS.some((team) => textMentionsVipEntity(video.title, team)) ||
    DEFAULT_VIP_PLAYERS.some((player) => textMentionsVipEntity(video.title, player));
  const recognizability = recognizedEntity ? 15 : 8;
  const debate = /vs|prediction|shock|why|problem|pressure|controversy|lineup|injury|reaction/i.test(video.title) ? 15 : 6;
  const freshness = ageHours <= 2 ? 15 : ageHours <= 4 ? 10 : 5;
  return Math.round(Math.min(100, velocityScore + commentScore + recognizability + debate + freshness + 10));
}

function rejectedYouTubeTrendReason(video) {
  const title = cleanText(video.title).toLowerCase();
  if (/\b(efootball|pes\s?\d*|video game|simulation|simulated|gameplay|watch along|watchalong)\b/i.test(title)) {
    return "gaming/simulation/watchalong video";
  }
  if (/\bfifa\s?\d+\b/i.test(title) && /\b(game|simulation|simulated|gameplay|live)\b/i.test(title)) {
    return "gaming/simulation watch signal";
  }
  if (/^\s*(🔴|live\b|\[live\])|full match|live stream|stream commentary|trực tiếp/i.test(video.title || "")) {
    return "live/full-match stream";
  }
  if (video.comments <= 1 && video.views > 100000) {
    return "suspicious low-comment velocity";
  }
  const asciiLetters = (video.title.match(/[A-Za-z]/g) || []).length;
  const totalLetters = (video.title.match(/\p{L}/gu) || []).length || 1;
  if (asciiLetters / totalLetters < 0.45) {
    return "not enough English-language signal";
  }
  const entityPattern =
    /\b(usa|usmnt|paraguay|mexico|south africa|korea|czechia|czech republic|canada|brazil|argentina|uruguay|colombia|england|france|spain|germany|portugal|messi|ronaldo|neymar|mbappe|pulisic|bellingham|shakira|opening ceremony|fixture|schedule|lineup|injury|prediction|highlights?)\b/i;
  const hasRecognizableEntity =
    entityPattern.test(video.title || "") ||
    DEFAULT_VIP_TEAMS.some((team) => textMentionsVipEntity(video.title, team)) ||
    DEFAULT_VIP_PLAYERS.some((player) => textMentionsVipEntity(video.title, player));
  if (!hasRecognizableEntity) {
    return "generic football hashtag without a strong entity";
  }
  if (/^#|#football|#worldcup/i.test(title) && title.split(/\s+/).length < 8) {
    return "hashtag-only generic topic";
  }
  return "";
}

function topicFromYouTubeVideo(video) {
  const title = cleanText(video.title)
    .replace(/[🔴🏆⚽🔥☠️😱🥰🤠🚨🇦-🇿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const scoreMatch = title.match(/\b([A-Z][A-Za-z .'-]{2,24})\s+\d+\s*[-:]\s*\d+\s+([A-Z][A-Za-z .'-]{2,24})\b/);
  if (scoreMatch) {
    const teamA = cleanText(scoreMatch[1].replace(/^Highlights?\s*/i, ""));
    const teamB = cleanText(scoreMatch[2]);
    return {
      type: "postmatch",
      topic: `${teamA} vs ${teamB} post-match: the moment that changed the game`,
      teamA,
      teamB,
    };
  }
  const match = title.match(/\b([A-Z][A-Za-z .'-]{2,24})\s+(?:vs|v|versus|-)\s+([A-Z][A-Za-z .'-]{2,24})\b/);
  if (match) {
    const teamA = cleanText(match[1]);
    const teamB = cleanText(match[2]);
    return {
      topic: `${teamA} vs ${teamB}: the pressure angle fans are already arguing about`,
      teamA,
      teamB,
    };
  }
  return { topic: title.slice(0, 120), teamA: "", teamB: "" };
}

async function buildYouTubeCandidates(config, warnings) {
  const all = [];
  const seenVideoIds = new Set();
  const queries = youtubeQueries();
  for (let queryIndex = 0; queryIndex < queries.length; queryIndex += 1) {
    const query = queries[queryIndex];
    try {
      const videos = await youtubeSearchWithKeyFallback(config, query, { keyIndex: queryIndex }, warnings);
      for (const video of videos) {
        if (seenVideoIds.has(video.id)) continue;
        seenVideoIds.add(video.id);
        const rejected = rejectedYouTubeTrendReason(video);
        if (rejected) {
          warnings.push(`Rejected YouTube trend "${video.title}": ${rejected}.`);
          continue;
        }
        const score = scoreYouTubeVideo(video);
        const topic = topicFromYouTubeVideo(video);
        all.push({
          type: topic.type || "pre-tournament",
          topic: topic.topic,
          teamA: topic.teamA,
          teamB: topic.teamB,
          score,
          reason: `YouTube velocity signal from ${video.channelTitle || "recent video"} (${video.views} views, ${video.comments} comments).`,
          source: "youtube",
          youtube: video,
        });
      }
    } catch (error) {
      warnings.push(`YouTube trend query failed for "${query}": ${error.message}`);
    }
  }
  return all;
}

function rotateQueriesForDiscovery(queries = [], maxCalls = 2, now = new Date()) {
  const cleanQueries = queries.map(cleanText).filter(Boolean);
  if (!cleanQueries.length) return [];
  const slots = Math.max(1, Math.min(2, Number(maxCalls || 2)));
  const hourIndex = Math.floor(now.getTime() / 3600000);
  const start = (hourIndex * slots) % cleanQueries.length;
  const selected = [];
  for (let offset = 0; offset < Math.min(slots, cleanQueries.length); offset += 1) {
    selected.push(cleanQueries[(start + offset) % cleanQueries.length]);
  }
  return selected;
}

async function runYouTubeDiscoveryIfDue(config, db, warnings, now = new Date()) {
  const startedAt = now.toISOString();
  const summary = {
    ran: false,
    runId: `yt-discovery-${hashText(startedAt).slice(0, 12)}`,
    startedAt,
    completedAt: "",
    status: "skipped",
    reason: "",
    queries: [],
    apiCalls: 0,
    videosFound: 0,
    newVideos: 0,
    duplicates: 0,
    rejectedVideos: 0,
    rejectedSamples: [],
    errors: [],
  };
  if (config.offline || !config.youtubeSpikeEnabled || !config.youtubeDiscoveryEnabled) {
    summary.reason = "YouTube discovery disabled or offline.";
    return summary;
  }
  if (!youtubeKeyList(config).length) {
    summary.reason = "YouTube discovery skipped because no API key is configured.";
    warnings.push("YouTube discovery skipped because YOUTUBE_API_KEY/GOOGLE_API_KEY/WORLD_CUP_YOUTUBE_API_KEYS is missing.");
    return summary;
  }
  pruneYouTubeDiagnostics(db, config, now);
  const lastAt = latestRunAt(db, "youtube_discovery_runs", "started_at");
  if (!shouldRunInterval(lastAt, config.youtubeDiscoveryIntervalMinutes, now, config.force)) {
    summary.reason = `last discovery was ${Math.round(minutesSince(lastAt, now))} minutes ago`;
    summary.lastRunAt = lastAt;
    return summary;
  }
  const maxSearchCalls = Math.max(1, Math.min(2, Math.ceil(Number(config.youtubeDiscoveryMaxPerRun || DEFAULT_YOUTUBE_DISCOVERY_MAX_PER_RUN) / 50)));
  const queries = rotateQueriesForDiscovery(youtubeQueries(), maxSearchCalls, now);
  summary.queries = queries;
  summary.ran = true;
  try {
    const seen = new Set();
    for (let queryIndex = 0; queryIndex < queries.length && summary.videosFound < config.youtubeDiscoveryMaxPerRun; queryIndex += 1) {
      const query = queries[queryIndex];
      try {
        summary.apiCalls += 1;
        const result = await youtubeDiscoverySearchWithKeyFallback(
          config,
          query,
          {
            maxResults: Math.min(50, Number(config.youtubeDiscoveryMaxPerRun || DEFAULT_YOUTUBE_DISCOVERY_MAX_PER_RUN) - summary.videosFound),
            keyIndex: queryIndex,
            now,
          },
          warnings,
        );
        for (const video of result.videos) {
          if (seen.has(video.id) || summary.videosFound >= config.youtubeDiscoveryMaxPerRun) continue;
          seen.add(video.id);
          summary.videosFound += 1;
          const rejected = rejectedYouTubeTrendReason({ ...video, views: 0, comments: 0 });
          if (rejected) {
            summary.rejectedVideos += 1;
            if (summary.rejectedSamples.length < 10) summary.rejectedSamples.push({ id: video.id, title: video.title, reason: rejected });
            continue;
          }
          if (upsertDiscoveredYouTubeVideo(db, video, summary.runId, startedAt)) summary.newVideos += 1;
          else summary.duplicates += 1;
        }
      } catch (error) {
        const message = cleanText(error.message);
        summary.errors.push({ query, error: message });
        warnings.push(`YouTube discovery query failed for "${query}": ${message}`);
      }
    }
    enforceYouTubePoolCap(db, config, now);
    summary.activePoolSize = activeYouTubePoolRows(db, config, now).length;
    summary.status = summary.errors.length ? (summary.videosFound ? "partial" : "error") : "success";
    summary.completedAt = nowIso();
    if (summary.status === "error") summary.error = summary.errors.map((entry) => entry.error).join("; ");
    recordDiscoveryRun(db, summary);
    return summary;
  } catch (error) {
    summary.status = "error";
    summary.error = cleanText(error.message);
    summary.completedAt = nowIso();
    recordDiscoveryRun(db, summary);
    warnings.push(`YouTube discovery failed: ${summary.error}`);
    return summary;
  }
}

async function runYouTubeStatsRefreshIfDue(config, db, warnings, now = new Date()) {
  const startedAt = now.toISOString();
  const summary = {
    ran: false,
    runId: `yt-stats-${hashText(startedAt).slice(0, 12)}`,
    startedAt,
    completedAt: "",
    status: "skipped",
    reason: "",
    activePoolSize: 0,
    batchesRequested: 0,
    videosUpdated: 0,
    spikeEligible: 0,
    rejectedSpikes: 0,
    apiCalls: 0,
    eligibleVideos: [],
    rejectedSamples: [],
    errors: [],
  };
  if (config.offline || !config.youtubeSpikeEnabled) {
    summary.reason = "YouTube stats disabled or offline.";
    return summary;
  }
  if (!youtubeKeyList(config).length) {
    summary.reason = "YouTube stats skipped because no API key is configured.";
    warnings.push("YouTube stats refresh skipped because YOUTUBE_API_KEY/GOOGLE_API_KEY/WORLD_CUP_YOUTUBE_API_KEYS is missing.");
    return summary;
  }
  const lastAt = latestRunAt(db, "youtube_stats_runs", "started_at");
  if (!shouldRunInterval(lastAt, config.youtubeStatsIntervalMinutes, now, config.force)) {
    summary.reason = `last stats refresh was ${Math.round(minutesSince(lastAt, now))} minutes ago`;
    summary.lastRunAt = lastAt;
    summary.activePoolSize = activeYouTubePoolRows(db, config, now).length;
    return summary;
  }
  const pool = activeYouTubePoolRows(db, config, now);
  const byId = new Map(pool.map((row) => [row.video_id, row]));
  const batches = chunkArray(pool.map((row) => row.video_id), 50);
  summary.ran = true;
  summary.activePoolSize = pool.length;
  summary.batchesRequested = batches.length;
  try {
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const ids = batches[batchIndex];
      try {
        summary.apiCalls += 1;
        const stats = await youtubeVideosListWithKeyFallback(config, ids, { keyIndex: batchIndex }, warnings);
        for (const stat of stats) {
          const row = byId.get(stat.id);
          const video = {
            ...stat,
            query: row?.query || stat.query || "",
            title: stat.title || row?.title || "",
            channelTitle: stat.channelTitle || row?.channel_title || "",
            publishedAt: stat.publishedAt || row?.published_at || "",
          };
          const previous = latestYouTubeSnapshot(db, stat.id);
          const metrics = youtubeRollingSpikeMetrics(video, previous, config, now);
          recordYouTubeStatsSnapshot(db, video, previous, metrics, summary.runId, startedAt);
          summary.videosUpdated += 1;
          if (metrics.eligible) {
            summary.spikeEligible += 1;
            summary.eligibleVideos.push({ ...video, spike: metrics });
          } else {
            summary.rejectedSpikes += 1;
            if (summary.rejectedSamples.length < 15) {
              summary.rejectedSamples.push({
                id: video.id,
                title: video.title,
                views: video.views,
                deltaViews: metrics.deltaViews,
                growthPercent: Math.round(metrics.growthPercent),
                reason: metrics.rejectionReason,
              });
            }
          }
        }
      } catch (error) {
        const message = cleanText(error.message);
        summary.errors.push({ batch: batchIndex + 1, size: ids.length, error: message });
        warnings.push(`YouTube stats batch ${batchIndex + 1}/${batches.length} failed: ${message}`);
      }
    }
    summary.status = summary.errors.length ? (summary.videosUpdated ? "partial" : "error") : "success";
    summary.completedAt = nowIso();
    if (summary.status === "error") summary.error = summary.errors.map((entry) => entry.error).join("; ");
    recordStatsRun(db, summary);
    return summary;
  } catch (error) {
    summary.status = "error";
    summary.error = cleanText(error.message);
    summary.completedAt = nowIso();
    recordStatsRun(db, summary);
    warnings.push(`YouTube stats refresh failed: ${summary.error}`);
    return summary;
  }
}

function youtubeSpikeMetrics(video = {}, previous = null, now = new Date()) {
  const currentViews = Number(video.views || 0);
  const currentComments = Number(video.comments || 0);
  const ageHours = Math.max(0.25, (now.getTime() - Date.parse(video.publishedAt || nowIso())) / 36e5);
  const lifetimeViewsPerHour = currentViews / ageHours;
  const lifetimeCommentsPerHour = currentComments / ageHours;
  let deltaViewsPerHour = lifetimeViewsPerHour;
  let deltaCommentsPerHour = lifetimeCommentsPerHour;
  let viewMultiplier = 1;
  if (previous?.scanned_at) {
    const elapsedHours = Math.max(0.25, (now.getTime() - Date.parse(previous.scanned_at)) / 36e5);
    const deltaViews = Math.max(0, currentViews - Number(previous.views || 0));
    const deltaComments = Math.max(0, currentComments - Number(previous.comments || 0));
    deltaViewsPerHour = deltaViews / elapsedHours;
    deltaCommentsPerHour = deltaComments / elapsedHours;
    const previousAgeHours = Math.max(0.25, (Date.parse(previous.scanned_at) - Date.parse(video.publishedAt || nowIso())) / 36e5);
    const previousViewsPerHour = Number(previous.views || 0) / previousAgeHours;
    viewMultiplier = deltaViewsPerHour / Math.max(1, previousViewsPerHour);
  }
  const velocitySignal = Math.log10(Math.max(lifetimeViewsPerHour, deltaViewsPerHour) + 1) * 12;
  const commentSignal = Math.log10(Math.max(currentComments, deltaCommentsPerHour) + 1) * 8;
  const multiplierSignal = Math.min(20, Math.max(0, viewMultiplier - 1) * 8);
  const entitySignal = /messi|ronaldo|usa|usmnt|brazil|argentina|england|france|spain|germany|portugal|mexico|world cup|mbappe|bellingham|yamal/i.test(
    video.title || "",
  )
    ? 16
    : 6;
  const debateSignal = /vs|prediction|shock|why|problem|pressure|controversy|lineup|injury|reaction|final|highlights/i.test(video.title || "") ? 14 : 5;
  const freshSignal = ageHours <= 6 ? 10 : ageHours <= 24 ? 6 : 2;
  const score = Math.round(Math.min(100, 18 + velocitySignal + commentSignal + multiplierSignal + entitySignal + debateSignal + freshSignal));
  return {
    score,
    ageHours,
    lifetimeViewsPerHour,
    deltaViewsPerHour,
    deltaCommentsPerHour,
    viewMultiplier,
    hasPrevious: Boolean(previous),
  };
}

function youtubeRollingSpikeMetrics(video = {}, previous = null, config = {}, now = new Date()) {
  const previousViews = Number(previous?.views || 0);
  const currentViews = Number(video.views || 0);
  const previousComments = Number(previous?.comments || 0);
  const currentComments = Number(video.comments || 0);
  const deltaViews = Math.max(0, currentViews - previousViews);
  const deltaComments = Math.max(0, currentComments - previousComments);
  const elapsedMinutes = previous?.scanned_at ? Math.max(1, (now.getTime() - Date.parse(previous.scanned_at)) / 60000) : 0;
  const growthPercent = previousViews > 0 ? (deltaViews / previousViews) * 100 : 0;
  const minBaseline = Number(config.youtubeMinBaselineViews || DEFAULT_YOUTUBE_MIN_BASELINE_VIEWS);
  const minDeltaViews = Number(config.youtubeSpikeMinDeltaViews || DEFAULT_YOUTUBE_SPIKE_MIN_DELTA_VIEWS);
  const spikeGrowthPercent = Number(config.youtubeSpikeGrowthPercent || DEFAULT_YOUTUBE_SPIKE_GROWTH_PERCENT);
  const strongDeltaViews = Number(config.youtubeStrongDeltaViews || DEFAULT_YOUTUBE_STRONG_DELTA_VIEWS);
  const strongDeltaMinGrowthPercent = Number(config.youtubeStrongDeltaMinGrowthPercent || DEFAULT_YOUTUBE_STRONG_DELTA_MIN_GROWTH_PERCENT);
  const contentRejection = rejectedYouTubeTrendReason({ ...video, views: currentViews, comments: currentComments });
  let rejectionReason = "";
  if (!previous) rejectionReason = "no previous stats snapshot";
  else if (previousViews < minBaseline) rejectionReason = `baseline views ${previousViews} below ${minBaseline}`;
  else if (contentRejection) rejectionReason = contentRejection;
  else if (deltaViews < minDeltaViews) rejectionReason = `delta views ${deltaViews} below ${minDeltaViews}`;
  else if (!(growthPercent >= spikeGrowthPercent || (deltaViews >= strongDeltaViews && growthPercent >= strongDeltaMinGrowthPercent))) {
    rejectionReason = `growth ${Math.round(growthPercent)}% below ${spikeGrowthPercent}% and delta ${deltaViews} below strong override`;
  }
  const eligible = !rejectionReason;
  const viewsPerMinute = elapsedMinutes > 0 ? deltaViews / elapsedMinutes : 0;
  const score = eligible
    ? Math.round(Math.min(100, 72 + Math.min(18, growthPercent / 10) + Math.min(10, Math.log10(deltaViews + 1) * 2)))
    : Math.round(Math.min(70, Math.max(0, Math.log10(deltaViews + 1) * 10 + Math.min(20, growthPercent / 10))));
  return {
    eligible,
    rejectionReason,
    score,
    previousViews,
    currentViews,
    deltaViews,
    previousComments,
    currentComments,
    deltaComments,
    growthPercent,
    elapsedMinutes,
    viewsPerMinute,
    hasPrevious: Boolean(previous),
  };
}

function entityTokensForText(text = "", config = {}) {
  const cleaned = cleanText(text).toLowerCase();
  const tokens = [];
  for (const entity of [...(config.vipTeams || DEFAULT_VIP_TEAMS), ...(config.vipPlayers || DEFAULT_VIP_PLAYERS)]) {
    const value = cleanText(entity).toLowerCase();
    if (value && cleaned.includes(value)) tokens.push(entity);
  }
  const genericMatches = cleaned.match(/\b(world cup|fifa|usmnt|usa|messi|ronaldo|mbappe|bellingham|yamal|pulisic|neymar|brazil|argentina|england|france|spain|germany|portugal|mexico)\b/g) || [];
  return [...new Set([...tokens, ...genericMatches])].slice(0, 8);
}

function titleTopicKey(video = {}, config = {}) {
  const topic = topicFromYouTubeVideo(video);
  if (topic.teamA && topic.teamB) return normalizeTeamComparable(`${topic.teamA} ${topic.teamB}`);
  const entities = entityTokensForText(video.title, config).filter((entity) => !/^world cup|fifa$/i.test(entity));
  if (entities.length >= 2) return normalizeTeamComparable(entities.slice(0, 2).join(" "));
  if (entities.length === 1) return normalizeTeamComparable(entities[0]);
  return normalizeTeamComparable(video.title)
    .split(/\s+/)
    .filter((word) => !["world", "cup", "fifa", "football", "soccer", "shorts", "viral", "live", "new", "today", "explained"].includes(word))
    .slice(0, 6)
    .join(" ");
}

function localYouTubeClusterCandidate(videos = [], config = {}) {
  const groups = new Map();
  for (const video of videos) {
    const entities = entityTokensForText(video.title, config);
    const key = titleTopicKey(video, config);
    if (!key) continue;
    const current = groups.get(key) || { key, entities, videos: [], score: 0 };
    current.videos.push(video);
    current.score = Math.max(current.score, Number(video.spike?.score || scoreYouTubeVideo(video)));
    current.entities = [...new Set([...current.entities, ...entities])].slice(0, 8);
    groups.set(key, current);
  }
  const best = [...groups.values()]
    .map((group) => ({
      ...group,
      clusterScore: Math.min(100, group.score + Math.min(18, (group.videos.length - 1) * 6)),
    }))
    .sort((a, b) => b.clusterScore - a.clusterScore || b.videos.length - a.videos.length)[0];
  if (!best?.videos?.length) return null;
  const minVideos = Number(config.youtubeTopicMinSpikeVideos || DEFAULT_YOUTUBE_TOPIC_MIN_SPIKE_VIDEOS);
  const minChannels = Number(config.youtubeTopicMinChannels || DEFAULT_YOUTUBE_TOPIC_MIN_CHANNELS);
  const minConfidence = Number(config.youtubeTopicMinConfidence || DEFAULT_YOUTUBE_TOPIC_MIN_CONFIDENCE);
  const distinctChannels = new Set(best.videos.map((video) => cleanText(video.channelTitle).toLowerCase()).filter(Boolean)).size;
  if (best.videos.length < minVideos || distinctChannels < minChannels || best.clusterScore < minConfidence) return null;
  const leader = best.videos.sort((a, b) => Number(b.spike?.score || 0) - Number(a.spike?.score || 0))[0];
  const topic = topicFromYouTubeVideo(leader);
  return {
    type: topic.type || "pre-tournament",
    topic: topic.topic,
    teamA: topic.teamA,
    teamB: topic.teamB,
    score: best.clusterScore,
    reason: `YouTube spike cluster from ${best.videos.length} recent videos around ${best.entities.join(", ") || "one football topic"}.`,
    source: "youtube-spike-cluster",
    confidence: best.clusterScore,
    clusterSize: best.videos.length,
    distinctChannels,
    entities: best.entities,
    evidence: best.videos.slice(0, 6).map((video) => ({
      id: video.id,
      title: video.title,
      channelTitle: video.channelTitle,
      views: video.views,
      comments: video.comments,
      score: video.spike?.score,
      deltaViews: video.spike?.deltaViews,
      growthPercent: video.spike?.growthPercent,
    })),
  };
}

async function buildGeminiTopicClusterCandidate(config, videos, warnings) {
  if (!videos.length) return null;
  const minVideos = Number(config.youtubeTopicMinSpikeVideos || DEFAULT_YOUTUBE_TOPIC_MIN_SPIKE_VIDEOS);
  const minChannels = Number(config.youtubeTopicMinChannels || DEFAULT_YOUTUBE_TOPIC_MIN_CHANNELS);
  const minConfidence = Number(config.youtubeTopicMinConfidence || DEFAULT_YOUTUBE_TOPIC_MIN_CONFIDENCE);
  const distinctInputChannels = new Set(videos.map((video) => cleanText(video.channelTitle).toLowerCase()).filter(Boolean)).size;
  if (videos.length < minVideos || distinctInputChannels < minChannels) return null;
  if (config.offline || config.youtubeClusterAnalyzer === "local") return localYouTubeClusterCandidate(videos, config);
  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo?.apiKey) {
    warnings.push("Gemini analyzer skipped because no active Gemini API key was available; using local YouTube clustering.");
    return localYouTubeClusterCandidate(videos, config);
  }
  const prompt = `
You are a World Cup short-video trigger analyst.
Cluster these recent football YouTube videos and find the single strongest repeated topic to dispatch.
Prefer concrete matches, teams, players, lineup/injury/pressure narratives, and post-match reactions.
Only dispatch if at least ${minVideos} spike videos from at least ${minChannels} distinct channels are about the same concrete topic.
Return confidence from 0-100. Return confidence below ${minConfidence} if the evidence is not clearly one repeated topic.
Return JSON only:
{
  "topic": "specific short-video topic",
  "type": "pre-tournament, prediction, or postmatch",
  "teamA": "",
  "teamB": "",
  "score": 0,
  "confidence": 0,
  "reason": "why this topic is spiking",
  "entities": [],
  "evidence": [{"id": "", "title": "", "channelTitle": ""}]
}

Videos:
${JSON.stringify(
  videos.slice(0, 40).map((video) => ({
    id: video.id,
    title: video.title,
    channelTitle: video.channelTitle,
    views: video.views,
    comments: video.comments,
    publishedAt: video.publishedAt,
    spike: video.spike,
  })),
)}
`.trim();
  try {
    const result = await requestGeminiJsonWithFallbacks({
      keyInfo,
      primaryModel: config.analyzerModel,
      fallbackModels: String(process.env.WORLD_CUP_ANALYZER_FALLBACK_MODELS || process.env.WORLD_CUP_SEARCH_FALLBACK_MODELS || "gemini-3.1-flash-lite,gemini-2.5-flash")
        .split(",")
        .map(cleanText)
        .filter(Boolean),
      prompt,
      temperature: 0.2,
      search: false,
    });
    const topic = cleanText(result.json?.topic);
    if (!topic) return localYouTubeClusterCandidate(videos, config);
    const rawScore = Number(result.json?.score);
    const confidence = Number(result.json?.confidence);
    const normalizedConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 0;
    const rawEvidence = Array.isArray(result.json?.evidence) ? result.json.evidence : [];
    const evidence = rawEvidence.length ? rawEvidence.slice(0, 12) : videos.slice(0, Math.max(minVideos, 12));
    const distinctEvidenceChannels = new Set(evidence.map((item) => cleanText(item?.channelTitle).toLowerCase()).filter(Boolean)).size || distinctInputChannels;
    const clusterSize = Math.max(evidence.length, minVideos);
    if (clusterSize < minVideos || distinctEvidenceChannels < minChannels || normalizedConfidence < minConfidence) {
      warnings.push(
        `Gemini topic analyzer did not meet cluster thresholds (${clusterSize}/${minVideos} videos, ${distinctEvidenceChannels}/${minChannels} channels, confidence ${Math.round(normalizedConfidence)}/${minConfidence}).`,
      );
      return localYouTubeClusterCandidate(videos, config);
    }
    return {
      type: ["prediction", "postmatch", "pre-tournament"].includes(cleanText(result.json?.type).toLowerCase()) ? cleanText(result.json.type).toLowerCase() : "pre-tournament",
      topic,
      teamA: cleanText(result.json?.teamA),
      teamB: cleanText(result.json?.teamB),
      score: Number.isFinite(rawScore) ? Math.max(0, Math.min(100, rawScore)) : normalizedConfidence,
      reason: cleanText(result.json?.reason) || "Gemini topic analyzer selected a repeated YouTube spike.",
      source: "gemini-topic-analyzer",
      analyzerModel: result.model,
      confidence: normalizedConfidence,
      clusterSize,
      distinctChannels: distinctEvidenceChannels,
      entities: Array.isArray(result.json?.entities) ? result.json.entities.map(cleanText).filter(Boolean).slice(0, 8) : [],
      evidence: evidence.slice(0, 12),
    };
  } catch (error) {
    warnings.push(`Gemini topic analyzer failed: ${error.message}; using local YouTube clustering.`);
    return localYouTubeClusterCandidate(videos, config);
  }
}

function recordTopicClusterAttempt(db, summary = {}) {
  db.prepare(`
    INSERT OR REPLACE INTO youtube_topic_cluster_attempts(
      run_id, attempted_at, status, input_count, cluster_count, strongest_size, strongest_channels,
      confidence, topic, candidate_json, response_json, error
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cleanText(summary.runId),
    cleanText(summary.attemptedAt),
    cleanText(summary.status || "skipped"),
    Number(summary.inputCount || 0),
    Number(summary.clusterCount || 0),
    Number(summary.strongestSize || 0),
    Number(summary.strongestChannels || 0),
    Number(summary.confidence || 0),
    cleanText(summary.topic),
    jsonText(summary.candidate || null),
    jsonText(summary.response || summary),
    cleanText(summary.error),
  );
}

async function buildYouTubeClusterCandidates(config, db, warnings, statsSummary = {}, now = new Date()) {
  const attemptedAt = now.toISOString();
  const spikeVideos = (Array.isArray(statsSummary.eligibleVideos) && statsSummary.eligibleVideos.length ? statsSummary.eligibleVideos : recentEligibleSpikeVideos(db, config, now)).sort(
    (a, b) => Number(b.spike?.growthPercent || 0) - Number(a.spike?.growthPercent || 0) || Number(b.spike?.deltaViews || 0) - Number(a.spike?.deltaViews || 0),
  );
  const summary = {
    runId: `yt-cluster-${hashText(attemptedAt).slice(0, 12)}`,
    attemptedAt,
    status: "skipped",
    inputCount: spikeVideos.length,
    clusterCount: 0,
    strongestSize: 0,
    strongestChannels: 0,
    confidence: 0,
    topic: "",
    candidate: null,
    reason: "",
  };
  const minVideos = Number(config.youtubeTopicMinSpikeVideos || DEFAULT_YOUTUBE_TOPIC_MIN_SPIKE_VIDEOS);
  const minChannels = Number(config.youtubeTopicMinChannels || DEFAULT_YOUTUBE_TOPIC_MIN_CHANNELS);
  const distinctChannels = new Set(spikeVideos.map((video) => cleanText(video.channelTitle).toLowerCase()).filter(Boolean)).size;
  if (spikeVideos.length < minVideos || distinctChannels < minChannels) {
    summary.reason = `not enough spike evidence (${spikeVideos.length}/${minVideos} videos, ${distinctChannels}/${minChannels} channels)`;
    summary.strongestSize = spikeVideos.length;
    summary.strongestChannels = distinctChannels;
    recordTopicClusterAttempt(db, summary);
    return { candidates: [], diagnostics: summary };
  }
  try {
    const candidate = await buildGeminiTopicClusterCandidate(config, spikeVideos, warnings);
    if (!candidate) {
      summary.reason = "no repeated topic cluster met thresholds";
      summary.strongestSize = spikeVideos.length;
      summary.strongestChannels = distinctChannels;
      recordTopicClusterAttempt(db, summary);
      return { candidates: [], diagnostics: summary };
    }
    candidate.dueAt ||= attemptedAt;
    summary.status = "success";
    summary.clusterCount = 1;
    summary.strongestSize = Number(candidate.clusterSize || candidate.evidence?.length || spikeVideos.length);
    summary.strongestChannels = Number(candidate.distinctChannels || distinctChannels);
    summary.confidence = Number(candidate.confidence || candidate.score || 0);
    summary.topic = candidate.topic;
    summary.candidate = candidate;
    recordTopicClusterAttempt(db, summary);
    return { candidates: [candidate], diagnostics: summary };
  } catch (error) {
    summary.status = "error";
    summary.error = cleanText(error.message);
    warnings.push(`YouTube topic clustering failed: ${summary.error}`);
    recordTopicClusterAttempt(db, summary);
    return { candidates: [], diagnostics: summary };
  }
}

async function buildYouTubeSpikeCandidates(config, db, warnings, now = new Date()) {
  const discovery = await runYouTubeDiscoveryIfDue(config, db, warnings, now);
  const stats = await runYouTubeStatsRefreshIfDue(config, db, warnings, now);
  const cluster = await buildYouTubeClusterCandidates(config, db, warnings, stats, now);
  return {
    candidates: cluster.candidates,
    diagnostics: { discovery, stats, cluster: cluster.diagnostics },
  };
}

async function buildGeminiTrendCandidate(warnings) {
  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo?.apiKey) return null;
  const prompt = `
Use Google Search grounding to find ONE football/FIFA World Cup topic that is starting to accelerate right now and could become a strong short-video topic in the next 1-2 hours.

Audience: US, Europe, and South America.
Return JSON only:
{
  "topic": "specific video topic",
  "type": "pre-tournament, prediction, or postmatch",
  "teamA": "",
  "teamB": "",
  "kickoff": "",
  "score": 0,
  "reason": "why this is rising now",
  "sources": [{"title": "", "url": ""}]
}
`.trim();
  try {
    const result = await requestGeminiJsonWithFallbacks({
      keyInfo,
      primaryModel: process.env.WORLD_CUP_SEARCH_MODEL || "gemini-2.5-flash-lite",
      fallbackModels: String(process.env.WORLD_CUP_SEARCH_FALLBACK_MODELS || "gemini-2.5-flash,gemini-3.1-flash-lite").split(",").map(cleanText).filter(Boolean),
      prompt,
      temperature: 0.35,
      search: true,
    });
    const topic = cleanText(result.json?.topic);
    if (!topic) return null;
    const jsonSources = Array.isArray(result.json?.sources) ? result.json.sources : [];
    const groundingSources = Array.isArray(result.sources) ? result.sources : [];
    const sources = [...jsonSources, ...groundingSources]
      .map((source) => ({ title: cleanText(source?.title), url: cleanText(source?.url || source?.uri) }))
      .filter((source) => source.title || source.url);
    const rawScore = Number(result.json?.score);
    return {
      type: ["prediction", "postmatch", "pre-tournament"].includes(cleanText(result.json?.type).toLowerCase()) ? cleanText(result.json.type).toLowerCase() : "pre-tournament",
      topic,
      teamA: cleanText(result.json?.teamA),
      teamB: cleanText(result.json?.teamB),
      kickoff: cleanText(result.json?.kickoff),
      score: Number.isFinite(rawScore) ? Math.max(0, Math.min(100, rawScore)) : 0,
      reason: cleanText(result.json?.reason) || "Gemini Search Grounding trend candidate.",
      source: "gemini-search-grounding",
      sources,
      groundingHealth: {
        model: result.model,
        sourceCount: sources.length,
        searchOperationExpected: true,
      },
    };
  } catch (error) {
    warnings.push(`Gemini trend grounding failed: ${error.message}`);
    return null;
  }
}

function buildEvergreenFallbackCandidate(state = {}, config = {}, now = new Date()) {
  if (!config.evergreenFallback) return null;
  const topics = preTournamentTopics();
  if (!topics.length) return null;
  const dispatchedKeys = new Set(Object.keys(state.dispatched || {}));
  for (let offset = 0; offset < topics.length; offset += 1) {
    const topic = topics[(now.getUTCDate() + offset) % topics.length];
    const candidate = {
      type: "pre-tournament",
      topic,
      teamA: "",
      teamB: "",
      kickoff: "",
      matchId: `evergreen-${hashText(topic).slice(0, 12)}`,
      score: 80,
      reason: "Evergreen fallback selected because no stronger live spike or match-window candidate passed.",
      source: "evergreen-fallback",
    };
    if (!dispatchedKeys.has(candidateKey(candidate))) return candidate;
  }
  return null;
}

function candidateGroundedSourceCount(candidate) {
  if (["fixture-scheduler", "espn-scoreboard", "evergreen-fallback"].includes(candidate?.source)) return 1;
  if (["youtube", "youtube-spike"].includes(candidate?.source)) return candidate.youtube?.id ? 1 : 0;
  if (candidate?.source === "youtube-spike-cluster") return Array.isArray(candidate.evidence) ? candidate.evidence.length : 1;
  if (candidate?.source === "gemini-topic-analyzer") return Array.isArray(candidate.evidence) ? candidate.evidence.length : 1;
  const explicitSources = Array.isArray(candidate?.sources) ? candidate.sources.filter((source) => cleanText(source?.url || source?.title)).length : 0;
  const groundingSources = Number(candidate?.groundingHealth?.sourceCount || 0);
  return Math.max(explicitSources, groundingSources);
}

function candidateHasRecognizableEntity(candidate) {
  if (candidate?.source === "evergreen-fallback") return true;
  const text = candidateText(candidate);
  return (
    MAJOR_TEAM_PATTERN.test(normalizeTeamComparable(text)) ||
    RECOGNIZABLE_PLAYER_PATTERN.test(text) ||
    DEFAULT_VIP_TEAMS.some((team) => textMentionsVipEntity(text, team)) ||
    DEFAULT_VIP_PLAYERS.some((player) => textMentionsVipEntity(text, player))
  );
}

function isScheduledMatchCandidate(candidate) {
  return ["fixture-scheduler", "espn-scoreboard"].includes(candidate?.source);
}

function isFallbackCandidate(candidate) {
  return candidate?.source === "evergreen-fallback";
}

function isSpikeCandidate(candidate) {
  return ["gemini-topic-analyzer", "youtube-spike-cluster", "youtube-spike"].includes(candidate?.source);
}

function isTrendCandidate(candidate) {
  return isSpikeCandidate(candidate) || ["youtube", "gemini-search-grounding"].includes(candidate?.source);
}

function dispatchedEntries(state) {
  return Object.values(state.dispatched || {}).filter(Boolean);
}

function dispatchStatsForToday(state, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const entries = dispatchedEntries(state).filter((entry) => cleanText(entry.dispatchedAt).slice(0, 10) === day);
  const trendEntries = entries.filter((entry) => isTrendCandidate(entry.candidate));
  const lastTrendAt = trendEntries
    .map((entry) => cleanText(entry.dispatchedAt))
    .filter(Boolean)
    .sort()
    .at(-1);
  return {
    day,
    total: entries.length,
    trends: trendEntries.length,
    lastTrendAt: lastTrendAt || "",
  };
}

function youtubeVelocity(candidate) {
  const video = candidate?.youtube || {};
  const ageHours = Math.max(0.25, (Date.now() - Date.parse(video.publishedAt || nowIso())) / 36e5);
  return {
    ageHours,
    viewsPerHour: Number(video.views || 0) / ageHours,
    comments: Number(video.comments || 0),
  };
}

function candidateGate(candidate, state, config, now = new Date()) {
  const reasons = [];
  const stats = dispatchStatsForToday(state, now);
  const isFixtureCandidate = isScheduledMatchCandidate(candidate);
  const isFallback = isFallbackCandidate(candidate);
  if (candidate.duplicate) {
    reasons.push(DUPLICATE_GATE_REASON);
  }
  if (!isFixtureCandidate && stats.total >= config.dailyTotalLimit) {
    reasons.push(`daily total limit reached (${stats.total}/${config.dailyTotalLimit})`);
  }
  if (isFixtureCandidate) {
    return {
      allowed: config.force ? !candidate.duplicate : reasons.length === 0,
      reasons,
      stats,
      sourceCount: candidateGroundedSourceCount(candidate),
    };
  }

  if (!isFallback && candidate.score < config.trendThreshold) {
    reasons.push(`trend score ${candidate.score} is below strict threshold ${config.trendThreshold}`);
  }
  if (stats.trends >= config.dailyTrendLimit) {
    reasons.push(`daily trend limit reached (${stats.trends}/${config.dailyTrendLimit})`);
  }
  if (stats.lastTrendAt && config.trendCooldownMinutes > 0) {
    const elapsedMinutes = (now.getTime() - Date.parse(stats.lastTrendAt)) / 60000;
    if (elapsedMinutes < config.trendCooldownMinutes) {
      reasons.push(`trend cooldown active (${Math.round(elapsedMinutes)}/${config.trendCooldownMinutes} minutes)`);
    }
  }
  if (!candidateHasRecognizableEntity(candidate)) {
    reasons.push("no major team or recognizable player signal");
  }
  const sourceCount = candidateGroundedSourceCount(candidate);
  if (candidate.source === "gemini-search-grounding" && sourceCount < config.requiredGroundedSources) {
    reasons.push(`not enough grounded source URLs (${sourceCount}/${config.requiredGroundedSources})`);
  }
  if (["youtube", "youtube-spike"].includes(candidate.source)) {
    const velocity = youtubeVelocity(candidate);
    const spikeScore = Number(candidate.spike?.score || 0);
    if (velocity.viewsPerHour < 750 && velocity.comments < 15 && spikeScore < config.trendThreshold) {
      reasons.push(`weak YouTube velocity (${Math.round(velocity.viewsPerHour)} views/hour, ${velocity.comments} comments)`);
    }
  }
  return {
    allowed: config.force ? !candidate.duplicate : reasons.length === 0,
    reasons,
    stats,
    sourceCount,
  };
}

function candidateDueAtMs(candidate, config = {}, now = new Date()) {
  const explicitMs = Date.parse(candidate?.dueAt || "");
  if (Number.isFinite(explicitMs)) return explicitMs;
  const kickoffMs = Date.parse(candidate?.kickoff || "");
  if (Number.isFinite(kickoffMs) && candidate?.type === "prediction") {
    const targetHours = Number(config.prematchTargetHours ?? DEFAULT_PREMATCH_TARGET_HOURS);
    return kickoffMs - Math.max(0, targetHours) * 36e5;
  }
  if (Number.isFinite(kickoffMs) && candidate?.type === "postmatch") {
    return expectedFullTimeMs(kickoffMs) + Number(config.postmatchDelayMinutes ?? DEFAULT_POSTMATCH_DELAY_MINUTES) * 60 * 1000;
  }
  return now.getTime();
}

function selectCandidate(candidates, state, config, now = new Date()) {
  const sorted = candidates
    .filter((candidate) => candidate?.topic)
    .map((candidate) => {
      const enriched = { ...candidate, key: candidateKey(candidate), duplicate: wasDispatched(state, candidate, config) };
      return { ...enriched, dueAt: enriched.dueAt || new Date(candidateDueAtMs(enriched, config, now)).toISOString(), gate: candidateGate(enriched, state, config, now) };
    })
    .sort((a, b) => candidateDueAtMs(a, config, now) - candidateDueAtMs(b, config, now) || b.score - a.score);
  const selected = sorted.find((candidate) => candidate.gate?.allowed);
  return { selected: selected || null, candidates: sorted };
}

function noCandidateNoticeDecision(state = {}, scan = {}, config = {}, now = new Date()) {
  const top = Array.isArray(scan.candidates) ? scan.candidates[0] || null : null;
  const reasons = Array.isArray(top?.gate?.reasons) ? top.gate.reasons.map(cleanText).filter(Boolean) : [];
  const routineReason = reasons.find((reason) => ROUTINE_NO_CANDIDATE_REASON_PATTERNS.some((pattern) => pattern.test(reason)));
  if (routineReason) {
    return {
      send: false,
      key: "",
      reason: routineReason,
    };
  }

  const diagnostics = scan.diagnostics || {};
  const reasonText = reasons.join("; ") || "no candidates";
  const key = hashText(
    [
      "no-candidate",
      top?.key || top?.matchId || top?.topic || "none",
      reasonText,
      diagnostics.espnCandidates || 0,
      diagnostics.youtubeSpikeCandidates || 0,
      diagnostics.youtubeCandidates || 0,
      diagnostics.geminiTrendCandidate ? 1 : 0,
      diagnostics.evergreenCandidate ? 1 : 0,
    ].join(":"),
  ).slice(0, 20);
  const cooldownMs = Math.max(0, Number(config.skipNoticeCooldownMinutes || 0)) * 60 * 1000;
  const lastAtMs = Date.parse(state.lastNoCandidateNoticeAt || "");
  if (
    cooldownMs > 0 &&
    state.lastNoCandidateNoticeKey === key &&
    Number.isFinite(lastAtMs) &&
    now.getTime() - lastAtMs < cooldownMs
  ) {
    return {
      send: false,
      key,
      reason: `skip notice cooldown active (${Math.round((now.getTime() - lastAtMs) / 60000)}/${config.skipNoticeCooldownMinutes} minutes)`,
    };
  }
  return { send: true, key, reason: reasonText };
}

function markNoCandidateNoticeSent(state, decision = {}, now = new Date()) {
  state.lastNoCandidateNoticeAt = now.toISOString();
  state.lastNoCandidateNoticeKey = cleanText(decision.key || "");
  state.lastNoCandidateNoticeReason = cleanText(decision.reason || "");
}

function workflowInputs(candidate) {
  return {
    mode: candidate.type || "pre-tournament",
    strategy: "viral2",
    date: new Date().toISOString().slice(0, 10),
    match_id: candidate.matchId || "",
    team_a: candidate.teamA || "",
    team_b: candidate.teamB || "",
    kickoff: candidate.kickoff || "",
    topic: candidate.topic || "",
    render: "true",
    upload: "true",
    upload_target: "telegram",
    youtube_upload: cleanText(process.env.WORLD_CUP_YOUTUBE_UPLOAD || "true"),
    youtube_privacy: cleanText(process.env.WORLD_CUP_YOUTUBE_PRIVACY || "public"),
    youtube_max_per_day: cleanText(process.env.WORLD_CUP_YOUTUBE_MAX_PER_DAY || "5"),
    allow_needs_review_upload: cleanText(process.env.WORLD_CUP_CONTROLLER_ALLOW_NEEDS_REVIEW_UPLOAD || "true"),
    quality_mode: "v2",
    max_script_retries: "2",
    max_visual_retries: "3",
    strict_publish: cleanText(process.env.WORLD_CUP_CONTROLLER_STRICT_PUBLISH || "false"),
    telegram_send_failed_mp4: "true",
    force: "true",
  };
}

function workflowRunUrl(config, runId) {
  return `https://github.com/${config.repoFullName}/actions/runs/${runId}`;
}

function candidateLooksMatchVideo(candidate = {}) {
  return (
    isScheduledMatchCandidate(candidate) ||
    ["prediction", "postmatch"].includes(cleanText(candidate.type).toLowerCase()) ||
    Boolean(cleanText(candidate.teamA) && cleanText(candidate.teamB))
  );
}

function zipEntries(buffer) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const minOffset = Math.max(0, data.length - 0xffff - 22);
  let eocdOffset = -1;
  for (let offset = data.length - 22; offset >= minOffset; offset -= 1) {
    if (data.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) return [];
  const entryCount = data.readUInt16LE(eocdOffset + 10);
  const centralOffset = data.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let offset = centralOffset;
  for (let index = 0; index < entryCount && offset + 46 <= data.length; index += 1) {
    if (data.readUInt32LE(offset) !== centralSignature) break;
    const compressedSize = data.readUInt32LE(offset + 20);
    const uncompressedSize = data.readUInt32LE(offset + 24);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > data.length) break;
    entries.push({
      name: data.toString("utf8", nameStart, nameEnd),
      compressedSize,
      uncompressedSize,
    });
    offset = nameEnd + extraLength + commentLength;
  }
  return entries;
}

function mp4EvidenceFromZip(buffer) {
  const entries = zipEntries(buffer);
  const mp4Entries = entries.filter((entry) => /\.mp4$/i.test(entry.name) && Math.max(Number(entry.uncompressedSize || 0), Number(entry.compressedSize || 0)) > 0);
  return {
    hasMp4: mp4Entries.length > 0,
    mp4Entries: mp4Entries.slice(0, 5),
    entryCount: entries.length,
  };
}

async function workflowRunMp4Evidence(config, runId) {
  const data = await githubRequest(config, `/repos/${config.owner}/${config.repo}/actions/runs/${runId}/artifacts?per_page=20`);
  const artifacts = (data.artifacts || []).filter((artifact) => !artifact.expired);
  const checked = [];
  for (const artifact of artifacts) {
    try {
      const response = await fetchWithControllerTimeout(`https://api.github.com/repos/${config.owner}/${config.repo}/actions/artifacts/${artifact.id}/zip`, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.githubToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "world-cup-azure-controller",
        },
      }, config.fetchTimeoutMs);
      if (!response.ok) {
        checked.push({ id: artifact.id, name: artifact.name, error: `artifact zip HTTP ${response.status}` });
        continue;
      }
      const evidence = mp4EvidenceFromZip(Buffer.from(await response.arrayBuffer()));
      checked.push({ id: artifact.id, name: artifact.name, ...evidence });
      if (evidence.hasMp4) {
        return { hasMp4: true, artifacts: checked };
      }
    } catch (error) {
      checked.push({ id: artifact.id, name: artifact.name, error: error.message });
    }
  }
  return { hasMp4: false, artifacts: checked };
}

function controllerWorkflowConclusion(candidate, completed, mp4Evidence = {}) {
  const githubConclusion = cleanText(completed?.conclusion || "");
  if (githubConclusion === "success") {
    return { conclusion: "success", githubConclusion, cloudSuccessReason: "" };
  }
  if (candidateLooksMatchVideo(candidate) && mp4Evidence?.hasMp4) {
    return {
      conclusion: "success",
      githubConclusion,
      cloudSuccessReason: "mp4_artifact_present",
    };
  }
  return { conclusion: githubConclusion || "unknown", githubConclusion, cloudSuccessReason: "" };
}

async function githubRequest(config, pathname, { method = "GET", body = null } = {}) {
  if (!config.githubToken) throw new Error("Missing WORLD_CUP_GITHUB_TOKEN/GITHUB_FINE_GRAINED_PAT/GITHUB_TOKEN.");
  const response = await fetchWithControllerTimeout(`https://api.github.com${pathname}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "world-cup-azure-controller",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  }, config.fetchTimeoutMs);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`GitHub API ${method} ${pathname} failed: ${response.status} ${text.slice(0, 300)}`);
  }
  return response.status === 204 ? null : await response.json();
}

async function dispatchWorkflow(config, candidate) {
  const inputs = workflowInputs(candidate);
  await githubRequest(config, `/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(config.workflowFile)}/dispatches`, {
    method: "POST",
    body: { ref: config.branch, inputs },
  });
  return { inputs, dispatchedAt: nowIso() };
}

async function findRecentWorkflowRun(config, sinceIso) {
  const query = new URLSearchParams({ event: "workflow_dispatch", branch: config.branch, per_page: "10" });
  const data = await githubRequest(config, `/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(config.workflowFile)}/runs?${query}`);
  const sinceMs = Date.parse(sinceIso);
  return (data.workflow_runs || []).find((run) => Date.parse(run.created_at) >= sinceMs - 15_000) || null;
}

async function pollWorkflowRun(config, runId, timeoutMs = 35 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const run = await githubRequest(config, `/repos/${config.owner}/${config.repo}/actions/runs/${runId}`);
    if (run.status === "completed") return run;
    await sleep(30_000);
  }
  throw new Error(`Timed out waiting for GitHub workflow run ${runId}.`);
}

async function sendTelegram(config, text) {
  if (!config.telegramBotToken || !config.telegramChatId) return null;
  const form = new FormData();
  form.set("chat_id", config.telegramChatId);
  form.set("text", text);
  if (config.telegramThreadId) form.set("message_thread_id", config.telegramThreadId);
  const response = await fetchWithControllerTimeout(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, { method: "POST", body: form }, config.fetchTimeoutMs);
  if (!response.ok) throw new Error(`Telegram alert failed: ${response.status}`);
  return await response.json();
}

async function telegramGetUpdates(config, offset = 0) {
  if (!config.telegramBotToken || !config.telegramChatId || !config.telegramCommands) return [];
  const url = new URL(`https://api.telegram.org/bot${config.telegramBotToken}/getUpdates`);
  url.searchParams.set("timeout", "0");
  url.searchParams.set("allowed_updates", JSON.stringify(["message"]));
  if (offset) url.searchParams.set("offset", String(offset));
  const response = await fetchWithControllerTimeout(url, {}, config.fetchTimeoutMs);
  if (!response.ok) throw new Error(`Telegram getUpdates failed: ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.result) ? data.result : [];
}

function isTelegramCommandForThisController(config, message = {}) {
  const chatId = cleanText(message.chat?.id);
  if (cleanText(config.telegramChatId) && chatId !== cleanText(config.telegramChatId)) return false;
  if (config.telegramThreadId && cleanText(message.message_thread_id) !== cleanText(config.telegramThreadId)) return false;
  return true;
}

function telegramCommandHelp(extra = "") {
  return [
    "World Cup commands:",
    "/wc topic <topic> - create a viral pre-tournament/trend short",
    "/wc pre <topic> - same as topic",
    "/wc prediction Team A vs Team B | optional topic | optional kickoff ISO",
    "/wc post Team A vs Team B | optional topic",
    "/wc status - show controller status",
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

function isStructuredWorldCupCommand(text = "") {
  return /^\/(?:wc|worldcup)(?:@\w+)?(?:\s|$)/i.test(cleanText(text));
}

function shouldTryIntentParser(text = "") {
  const cleaned = cleanText(text);
  return Boolean(cleaned && !cleaned.startsWith("/"));
}

function intentParserConfigured(config = {}) {
  return Boolean(config.intentLlmEnabled && config.intentLlmUrl && cleanText(config.intentLlmProvider).toLowerCase() === "gemma-api");
}

function buildWorldCupIntentPrompt(text = "") {
  return `
Convert the user's Telegram message into strict JSON for a World Cup short-video controller.

Allowed actions:
- dispatch_specific: user gave a concrete topic, player, team, or match.
- discover_and_dispatch: user wants the system to pick any currently trending World Cup topic.
- status: user asks for controller status.
- help: user asks how to use the bot.
- clarify: request is too unclear or missing important details.

Allowed type values: pre-tournament, prediction, postmatch, breaking-news.

Return JSON only with this shape:
{
  "action": "dispatch_specific | discover_and_dispatch | status | help | clarify",
  "type": "pre-tournament | prediction | postmatch | breaking-news",
  "topic": "",
  "teamA": "",
  "teamB": "",
  "kickoff": "",
  "event": "",
  "entity": "",
  "selectionMode": "",
  "needsTrendDiscovery": false,
  "needsVerification": false,
  "sourceHint": "",
  "clarifyingQuestion": ""
}

Rules:
- For "any trending topic", "latest topic", or similar broad requests, use action discover_and_dispatch and do not invent the topic.
- For injuries, red cards, suspensions, lineups, controversies, or breaking news, use type breaking-news and needsVerification true.
- For predictions, fill teamA and teamB when the user names both teams.
- If the user is unclear, use action clarify with a short clarifyingQuestion.

User message:
${text}
`.trim();
}

function extractFirstJsonObject(text = "") {
  const cleaned = String(text || "").trim();
  if (!cleaned) throw new Error("Intent LLM returned empty text.");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Intent LLM did not return JSON.");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function parseGemmaIntentPayload(payload) {
  if (!payload) throw new Error("Intent LLM returned no payload.");
  if (typeof payload === "string") return extractFirstJsonObject(payload);
  if (typeof payload !== "object") throw new Error("Intent LLM returned an unsupported payload.");
  const geminiParts = payload.candidates?.[0]?.content?.parts;
  const candidates = [
    payload.intent,
    payload.json,
    payload.output_json,
    payload.output,
    payload.response,
    payload.text,
    payload.choices?.[0]?.message?.content,
    payload.choices?.[0]?.text,
    Array.isArray(geminiParts) ? geminiParts.map((part) => part?.text).filter(Boolean).join("\n") : "",
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "object") return candidate;
    if (typeof candidate === "string") return extractFirstJsonObject(candidate);
  }
  if (payload.action) return payload;
  throw new Error("Intent LLM response did not contain an intent JSON object.");
}

async function requestGemmaIntent(config, text) {
  if (!intentParserConfigured(config)) {
    throw new Error("Missing Gemma intent parser config. Set WORLD_CUP_INTENT_LLM_ENABLED=true and WORLD_CUP_INTENT_LLM_URL.");
  }
  const prompt = buildWorldCupIntentPrompt(text);
  const headers = { "Content-Type": "application/json" };
  if (config.intentLlmApiKey) headers.Authorization = `Bearer ${config.intentLlmApiKey}`;
  const body =
    config.intentLlmApiStyle === "prompt"
      ? {
          model: config.intentLlmModel,
          temperature: 0,
          stream: false,
          format: "json",
          prompt,
        }
      : {
          model: config.intentLlmModel,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You return only strict JSON for a World Cup video-controller intent parser." },
            { role: "user", content: prompt },
          ],
        };
  const response = await fetchWithControllerTimeout(
    config.intentLlmUrl,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    config.intentLlmTimeoutMs,
  );
  const textBody = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Gemma intent parser failed: ${response.status} ${textBody.slice(0, 180)}`);
  }
  let payload = textBody;
  try {
    payload = textBody ? JSON.parse(textBody) : {};
  } catch {
    payload = textBody;
  }
  return validateWorldCupIntent(parseGemmaIntentPayload(payload), text);
}

function normalizeIntentAction(value = "") {
  const cleaned = cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    dispatch: "dispatch_specific",
    specific: "dispatch_specific",
    create: "dispatch_specific",
    make_video: "dispatch_specific",
    auto: "discover_and_dispatch",
    trend: "discover_and_dispatch",
    trending: "discover_and_dispatch",
    discover: "discover_and_dispatch",
    auto_trending: "discover_and_dispatch",
  };
  return aliases[cleaned] || cleaned;
}

function normalizeIntentType(value = "", fallback = "pre-tournament") {
  const cleaned = cleanText(value).toLowerCase().replace(/[\s_]+/g, "-");
  const aliases = {
    pre: "pre-tournament",
    trend: "pre-tournament",
    viral: "pre-tournament",
    post: "postmatch",
    "post-match": "postmatch",
    breaking: "breaking-news",
    news: "breaking-news",
  };
  const normalized = aliases[cleaned] || cleaned || fallback;
  return INTENT_TYPES.has(normalized) ? normalized : fallback;
}

function parseTeamsFromText(text = "") {
  const match = cleanText(text).match(/^(.+?)\s+(?:vs|v|versus)\s+(.+?)$/i);
  if (!match) return { teamA: "", teamB: "" };
  return { teamA: cleanText(match[1]), teamB: cleanText(match[2]) };
}

function looksLikeAutoTrendRequest(text = "") {
  const cleaned = cleanText(text).toLowerCase();
  if (!cleaned) return false;
  const wantsSystemChoice = /\b(any|auto|automatic|pick|choose|find|next|latest|trending|trend)\b/.test(cleaned);
  const wantsVideoTopic = /\b(topic|video|short|reel|world cup|fifa|football)\b/.test(cleaned);
  const hasSpecificMatch = /\b(?:vs|versus)\b/.test(cleaned);
  return wantsSystemChoice && wantsVideoTopic && !hasSpecificMatch;
}

function autoTrendIntent() {
  return {
    action: "discover_and_dispatch",
    type: "pre-tournament",
    topic: "",
    teamA: "",
    teamB: "",
    kickoff: "",
    event: "",
    entity: "",
    selectionMode: "auto_trending",
    needsTrendDiscovery: true,
    needsVerification: false,
    sourceHint: "",
    clarifyingQuestion: "",
  };
}

function invalidKickoffReason(kickoff = "") {
  const cleaned = cleanText(kickoff);
  if (!cleaned) return "";
  return Number.isFinite(Date.parse(cleaned)) ? "" : "Kickoff must be a valid ISO-style date/time.";
}

function clarifyIntent(question) {
  return {
    action: "clarify",
    type: "pre-tournament",
    topic: "",
    teamA: "",
    teamB: "",
    kickoff: "",
    event: "",
    entity: "",
    selectionMode: "",
    needsTrendDiscovery: false,
    needsVerification: false,
    sourceHint: "",
    clarifyingQuestion: cleanText(question) || "Which World Cup topic, player, or match should I use?",
  };
}

function validateWorldCupIntent(raw, sourceText = "") {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Intent JSON must be an object.");
  }
  const action = normalizeIntentAction(raw.action || raw.intent || raw.intentAction);
  if (!INTENT_ACTIONS.has(action)) {
    throw new Error(`Unsupported intent action: ${cleanText(raw.action || raw.intent || raw.intentAction || "missing")}`);
  }
  if (action === "help" || action === "status") {
    return {
      ...clarifyIntent(""),
      action,
      clarifyingQuestion: "",
    };
  }
  if (action === "clarify") {
    return clarifyIntent(raw.clarifyingQuestion || raw.question || raw.message);
  }

  const rawEvent = cleanText(raw.event);
  const breakingSignal = /\b(injur|red card|suspension|suspended|lineup|starting xi|ban|banned|controversy|breaking)\b/i.test(
    `${sourceText} ${rawEvent} ${raw.topic || ""}`,
  );
  const type = normalizeIntentType(raw.type || raw.videoType, breakingSignal ? "breaking-news" : "pre-tournament");
  const intent = {
    action,
    type,
    topic: cleanText(raw.topic),
    teamA: cleanText(raw.teamA || raw.team_a),
    teamB: cleanText(raw.teamB || raw.team_b),
    kickoff: cleanText(raw.kickoff),
    event: rawEvent,
    entity: cleanText(raw.entity || raw.player),
    selectionMode: cleanText(raw.selectionMode || raw.selection_mode),
    needsTrendDiscovery: action === "discover_and_dispatch" || boolArg(raw.needsTrendDiscovery ?? raw.needs_trend_discovery, false),
    needsVerification: type === "breaking-news" || breakingSignal || boolArg(raw.needsVerification ?? raw.needs_verification, false),
    sourceHint: cleanText(raw.sourceHint || raw.source || raw.url),
    clarifyingQuestion: "",
  };

  const kickoffIssue = invalidKickoffReason(intent.kickoff);
  if (kickoffIssue) return clarifyIntent(kickoffIssue);

  if (action === "discover_and_dispatch") {
    return {
      ...autoTrendIntent(),
      type: intent.type,
      selectionMode: intent.selectionMode || "auto_trending",
      sourceHint: intent.sourceHint,
    };
  }

  const teamsFromTopic = parseTeamsFromText(intent.topic);
  if (!intent.teamA && !intent.teamB && teamsFromTopic.teamA && teamsFromTopic.teamB && intent.type !== "pre-tournament") {
    intent.teamA = teamsFromTopic.teamA;
    intent.teamB = teamsFromTopic.teamB;
  }
  if (!intent.topic && intent.teamA && intent.teamB) {
    intent.topic =
      intent.type === "prediction"
        ? `${intent.teamA} vs ${intent.teamB} World Cup prediction`
        : intent.type === "postmatch"
          ? `${intent.teamA} vs ${intent.teamB} post-match analysis: the moment that changed the game`
          : `${intent.teamA} vs ${intent.teamB}: the pressure angle fans are already arguing about`;
  }
  if (!intent.topic) {
    return clarifyIntent("Please give me a specific World Cup topic, player, or match.");
  }
  return intent;
}

function intentToWorldCupCommand(intent, sourceText = "") {
  if (intent.action === "help") return { action: "help", help: telegramCommandHelp("Natural language is also supported when Gemma intent parsing is enabled.") };
  if (intent.action === "status") return { action: "status", intent };
  if (intent.action === "clarify") {
    return {
      action: "clarify",
      message: intent.clarifyingQuestion || "Which World Cup topic, player, or match should I use?",
      intent,
    };
  }
  if (intent.action === "discover_and_dispatch") {
    return { action: "discover_and_dispatch", intent };
  }
  if (intent.type === "breaking-news" || intent.needsVerification) {
    return {
      action: "blocked_verification",
      intent,
      message:
        "I understood this as breaking news, but I need verified current sources before dispatching. Send a source link, or ask for any trending World Cup topic.",
    };
  }
  const teamsFromTopic = parseTeamsFromText(intent.topic);
  const teamA = intent.teamA || teamsFromTopic.teamA;
  const teamB = intent.teamB || teamsFromTopic.teamB;
  const type = normalizeIntentType(intent.type, "pre-tournament");
  const topic = cleanText(intent.topic || sourceText);
  return {
    action: "dispatch",
    intent,
    candidate: {
      type,
      topic,
      teamA,
      teamB,
      kickoff: intent.kickoff || "",
      matchId: hashText(`telegram-intent:${type}:${topic}:${teamA}:${teamB}:${intent.kickoff || ""}`),
      score: 100,
      reason: "Manual Telegram natural-language command.",
      source: "telegram-intent",
      manual: true,
    },
  };
}

async function parseTelegramIntentCommand(config, text) {
  if (!shouldTryIntentParser(text) || !config.intentLlmEnabled) return null;
  if (!intentParserConfigured(config)) {
    return {
      action: "help",
      help: telegramCommandHelp("Natural-language parsing is enabled, but WORLD_CUP_INTENT_LLM_URL is missing."),
      intentError: "missing-intent-llm-config",
    };
  }
  try {
    const intent = await requestGemmaIntent(config, text);
    return intentToWorldCupCommand(intent, text);
  } catch (error) {
    return {
      action: "clarify",
      message: `I could not turn that into a safe video request yet: ${error.message}`,
      intentError: error.message,
    };
  }
}

function parseTelegramWorldCupCommand(text = "") {
  const cleaned = cleanText(text);
  const match = cleaned.match(/^\/(?:wc|worldcup)(?:@\w+)?(?:\s+([\s\S]+))?$/i);
  if (!match) return null;
  const body = cleanText(match[1] || "");
  if (!body || /^help$/i.test(body)) {
    return {
      action: "help",
      help: telegramCommandHelp(),
    };
  }
  if (/^status$/i.test(body)) return { action: "status" };
  if (looksLikeAutoTrendRequest(body)) {
    return { action: "discover_and_dispatch", intent: autoTrendIntent() };
  }
  const parts = body.split("|").map(cleanText);
  const head = parts[0] || "";
  const headMatch = head.match(/^(topic|viral|trend|pre|pre-tournament|prediction|predict|post|postmatch)\s+([\s\S]+)$/i);
  const modeWord = cleanText(headMatch?.[1] || "topic").toLowerCase();
  const subject = cleanText(headMatch?.[2] || head);
  const type =
    ["prediction", "predict"].includes(modeWord)
      ? "prediction"
      : ["post", "postmatch"].includes(modeWord)
        ? "postmatch"
        : "pre-tournament";
  let teamA = "";
  let teamB = "";
  const teamMatch = subject.match(/^(.+?)\s+(?:vs|v|versus)\s+(.+?)$/i);
  if (teamMatch && type !== "pre-tournament") {
    teamA = cleanText(teamMatch[1]);
    teamB = cleanText(teamMatch[2]);
  }
  const topic =
    parts[1] ||
    (type === "prediction" && teamA && teamB
      ? `${teamA} vs ${teamB} World Cup prediction`
      : type === "postmatch" && teamA && teamB
        ? `${teamA} vs ${teamB} post-match analysis: the moment that changed the game`
        : subject);
  return {
    action: "dispatch",
    candidate: {
      type,
      topic,
      teamA,
      teamB,
      kickoff: parts[2] || "",
      matchId: hashText(`telegram:${type}:${topic}:${teamA}:${teamB}:${parts[2] || ""}`),
      score: 100,
      reason: "Manual Telegram command.",
      source: "telegram-command",
      manual: true,
    },
  };
}

async function processTelegramCommands(config, state, db) {
  if (!config.telegramCommands || !config.telegramBotToken || !config.telegramChatId) return [];
  const updates = await telegramGetUpdates(config, Number(state.telegramUpdateOffset || 0)).catch((error) => {
    state.lastTelegramCommandError = error.message;
    return [];
  });
  const results = [];
  for (const update of updates) {
    state.telegramUpdateOffset = Math.max(Number(state.telegramUpdateOffset || 0), Number(update.update_id || 0) + 1);
    const message = update.message || {};
    const text = cleanText(message.text || "");
    if (!text || !isTelegramCommandForThisController(config, message)) continue;
    const command = isStructuredWorldCupCommand(text) ? parseTelegramWorldCupCommand(text) : await parseTelegramIntentCommand(config, text);
    if (!command) continue;
    if (command.action === "help") {
      await sendTelegram(config, command.help).catch(() => null);
      results.push({ action: "help", updateId: update.update_id, intentError: command.intentError || "" });
      continue;
    }
    if (command.action === "status") {
      const stats = dispatchStatsForToday(state, new Date());
      await sendTelegram(
        config,
        [
          "World Cup controller status:",
          `Last status: ${state.lastStatus || "unknown"}`,
          `Today: ${stats.total}/${config.dailyTotalLimit} total, ${stats.trends}/${config.dailyTrendLimit} trends`,
          `Last dispatch: ${state.lastDispatchAt || "none"}`,
        ].join("\n"),
      ).catch(() => null);
      results.push({ action: "status", updateId: update.update_id });
      continue;
    }
    if (command.action === "clarify") {
      await sendTelegram(config, command.message || "Which World Cup topic, player, or match should I use?").catch(() => null);
      results.push({ action: "clarify", updateId: update.update_id, intent: command.intent || null, intentError: command.intentError || "" });
      continue;
    }
    if (command.action === "blocked_verification") {
      state.lastStatus = "telegram_verification_blocked";
      state.lastError = command.message;
      await sendTelegram(config, command.message).catch(() => null);
      results.push({ action: "blocked_verification", updateId: update.update_id, intent: command.intent || null });
      continue;
    }
    if (command.action === "discover_and_dispatch") {
      state.lastStatus = "telegram_discovery_requested";
      state.lastTelegramDiscoveryRequest = {
        updateId: update.update_id,
        text,
        intent: command.intent || null,
        requestedAt: nowIso(),
      };
      await sendTelegram(config, "Got it. I will scan fixtures, YouTube velocity, and configured trend sources for the strongest World Cup topic now.").catch(() => null);
      results.push({ action: "discover_and_dispatch", updateId: update.update_id, intent: command.intent || null });
      continue;
    }
    if (command.action !== "dispatch" || !command.candidate?.topic) continue;
    const selected = command.candidate;
    await sendTelegram(config, `Manual World Cup command received:\n${selected.topic}\nTriggering GitHub workflow...`).catch(() => null);
    const dispatchedAt = nowIso();
    let dispatch = null;
    try {
      dispatch = await dispatchWorkflow(config, selected);
      markDispatched(state, selected, { ...dispatch, telegramUpdateId: update.update_id });
      state.lastStatus = "telegram_workflow_dispatched";
      state.lastDispatchAt = dispatch.dispatchedAt;
      persistControllerState(db, state);
      let workflowRun = null;
      for (let attempt = 0; attempt < 10 && !workflowRun; attempt += 1) {
        await sleep(10_000);
        workflowRun = await findRecentWorkflowRun(config, dispatchedAt);
      }
      if (workflowRun) {
        await sendTelegram(config, `GitHub workflow started:\n${workflowRun.html_url || workflowRunUrl(config, workflowRun.id)}`).catch(() => null);
        const completed = await pollWorkflowRun(config, workflowRun.id);
        const mp4Evidence =
          completed.conclusion === "success"
            ? { hasMp4: false, skipped: "workflow_success" }
            : await workflowRunMp4Evidence(config, workflowRun.id).catch((error) => ({ hasMp4: false, error: error.message }));
        const classified = controllerWorkflowConclusion(selected, completed, mp4Evidence);
        dispatch.workflowRun = {
          id: completed.id,
          url: completed.html_url,
          status: completed.status,
          conclusion: classified.conclusion,
          githubConclusion: classified.githubConclusion,
          cloudSuccessReason: classified.cloudSuccessReason,
          mp4Evidence,
          completedAt: completed.updated_at || completed.run_started_at || nowIso(),
        };
        const completionText = classified.cloudSuccessReason
          ? `Manual World Cup run completed for cloud: success\nGitHub conclusion: ${completed.conclusion}\nReason: MP4 artifact was produced.\n${completed.html_url}`
          : `Manual World Cup run completed: ${completed.conclusion}\n${completed.html_url}`;
        await sendTelegram(config, completionText).catch(() => null);
      } else {
        dispatch.workflowRun = { warning: "Could not locate workflow run after dispatch." };
        await sendTelegram(config, "Manual World Cup workflow dispatched, but controller could not locate the run yet.").catch(() => null);
      }
    } catch (error) {
      dispatch = { error: error.message, attemptedAt: dispatchedAt, inputs: workflowInputs(selected) };
      state.lastStatus = "telegram_dispatch_failed";
      state.lastError = error.message;
      await sendTelegram(config, `Manual World Cup command failed: ${error.message}`).catch(() => null);
    }
    markDispatched(state, selected, dispatch);
    persistControllerState(db, state);
    results.push({ action: "dispatch", selected, dispatch, updateId: update.update_id });
  }
  return results;
}

async function runControllerOnce(config) {
  const db = await openControllerDb(config);
  try {
  const state = await loadControllerState(config, db);
  const commandResults = await processTelegramCommands(config, state, db);
  const shouldRunDiscoveryAfterTelegramCommand = commandResults.some((result) => result.action === "discover_and_dispatch");
  if (commandResults.length) {
    state.lastTelegramCommandAt = nowIso();
    persistControllerState(db, state);
    if (!shouldRunDiscoveryAfterTelegramCommand) {
      return { telegramCommands: commandResults, skipped: false };
    }
  }
  const warnings = [];
  const now = new Date();
  state.lastStatus = "scanning";
  state.lastScanStartedAt = nowIso();
  persistControllerState(db, state);
  const matchCandidates = config.legacyTriggerEnabled
    ? configuredFixtures()
        .map((fixture) => matchCandidateFromFixture(fixture, state, now, config))
        .filter(Boolean)
    : [];
  const espnCandidates = await buildEspnCandidates(config, state, db, warnings, now);
  const youtubeSpikeResult = await buildYouTubeSpikeCandidates(config, db, warnings, now);
  const youtubeSpikeCandidates = youtubeSpikeResult.candidates || [];
  const youtubeDiagnostics = youtubeSpikeResult.diagnostics || {};
  const youtubeCandidates = config.offline || !config.legacyTriggerEnabled ? [] : await buildYouTubeCandidates(config, warnings);
  const geminiCandidate = config.offline || !config.legacyTriggerEnabled || !config.enableGeminiTrends ? null : await buildGeminiTrendCandidate(warnings);
  const evergreenCandidate = buildEvergreenFallbackCandidate(state, config, now);
  const rawCandidates = [
    ...youtubeSpikeCandidates,
    ...espnCandidates,
    ...matchCandidates,
    ...youtubeCandidates,
    ...(geminiCandidate ? [geminiCandidate] : []),
    ...(evergreenCandidate ? [evergreenCandidate] : []),
  ];
  const { selected, candidates } = selectCandidate(rawCandidates, state, config, now);
  const scan = {
    scannedAt: nowIso(),
    selected,
    candidates: candidates.slice(0, 20),
    warnings,
    diagnostics: {
      dbFile: config.dbFile,
      espnCandidates: espnCandidates.length,
      fixtureCandidates: matchCandidates.length,
      youtubeSpikeCandidates: youtubeSpikeCandidates.length,
      youtubeDiscovery: youtubeDiagnostics.discovery || null,
      youtubeStats: youtubeDiagnostics.stats || null,
      youtubeCluster: youtubeDiagnostics.cluster || null,
      youtubeCandidates: youtubeCandidates.length,
      geminiTrendCandidate: Boolean(geminiCandidate),
      evergreenCandidate: Boolean(evergreenCandidate),
      legacyTriggerEnabled: config.legacyTriggerEnabled,
      rawCandidateCount: rawCandidates.length,
    },
    threshold: config.trendThreshold,
    dailyTotalLimit: config.dailyTotalLimit,
    dailyTrendLimit: config.dailyTrendLimit,
    trendCooldownMinutes: config.trendCooldownMinutes,
    dryRun: config.dryRun,
    offline: config.offline,
    telegramCommands: commandResults,
  };
  state.scans = [scan, ...(state.scans || [])].slice(0, 200);
  let dispatch = null;
  if (!selected) {
    state.lastStatus = "skipped";
    state.lastScanCompletedAt = nowIso();
    const top = candidates[0] || null;
    const topReason = top?.gate?.reasons?.length ? ` Reason: ${top.gate.reasons.join("; ")}.` : "";
    const ytStats = youtubeDiagnostics.stats || {};
    const ytCluster = youtubeDiagnostics.cluster || {};
    const diagnosticText = ` Sources: ESPN ${espnCandidates.length}, YouTube clusters ${youtubeSpikeCandidates.length}, YouTube trends ${youtubeCandidates.length}, Gemini ${geminiCandidate ? 1 : 0}, fallback ${evergreenCandidate ? 1 : 0}. YouTube pool ${ytStats.activePoolSize || 0}, refreshed ${ytStats.videosUpdated || 0}, spike videos ${ytStats.spikeEligible || 0}, strongest cluster ${ytCluster.strongestSize || 0}/${config.youtubeTopicMinSpikeVideos}.`;
    const noticeDecision = noCandidateNoticeDecision(state, scan, config, now);
    scan.noCandidateNotice = noticeDecision;
    scan.diagnostics.noCandidateNotice = noticeDecision;
    if (noticeDecision.send) {
      markNoCandidateNoticeSent(state, noticeDecision, now);
      await sendTelegram(config, `World Cup controller found no dispatchable candidate. Top score: ${top?.score || 0}.${topReason}${diagnosticText}`).catch(() => null);
    }
    recordScan(db, scan);
    persistControllerState(db, state);
    return { telegramCommands: commandResults, skipped: true, reason: "No candidate passed the strict dispatch gate.", scan };
  }
  if (config.dryRun) {
    dispatch = { dryRun: true, inputs: workflowInputs(selected) };
    scan.dispatch = dispatch;
    state.lastStatus = "dry_run_selected";
    state.lastScanCompletedAt = nowIso();
    recordScan(db, scan);
    persistControllerState(db, state);
    return { telegramCommands: commandResults, skipped: false, selected, dispatch, scan };
  }
  const selectedLabel = isScheduledMatchCandidate(selected) ? "Scheduled match window" : isFallbackCandidate(selected) ? "Evergreen fallback" : "High-confidence trend";
  await sendTelegram(config, `${selectedLabel}: ${selected.topic}\nScore: ${selected.score}\nTriggering GitHub workflow...`).catch(() => null);
  const dispatchedAt = nowIso();
  try {
    dispatch = await dispatchWorkflow(config, selected);
    markDispatched(state, selected, dispatch);
    scan.dispatch = dispatch;
    state.lastStatus = "workflow_dispatched";
    state.lastDispatchAt = dispatch.dispatchedAt;
    persistControllerState(db, state);
  } catch (error) {
    dispatch = { error: error.message, attemptedAt: dispatchedAt, inputs: workflowInputs(selected) };
    scan.dispatch = dispatch;
    state.lastStatus = "dispatch_failed";
    state.lastError = error.message;
    recordScan(db, scan);
    persistControllerState(db, state);
    await sendTelegram(config, `World Cup controller could not trigger GitHub: ${error.message}`).catch(() => null);
    return { telegramCommands: commandResults, skipped: false, selected, dispatch, scan, error: error.message };
  }
  let workflowRun = null;
  try {
    for (let attempt = 0; attempt < 10 && !workflowRun; attempt += 1) {
      await sleep(10_000);
      workflowRun = await findRecentWorkflowRun(config, dispatchedAt);
    }
    if (workflowRun) {
      const completed = await pollWorkflowRun(config, workflowRun.id);
      const mp4Evidence =
        completed.conclusion === "success"
          ? { hasMp4: false, skipped: "workflow_success" }
          : await workflowRunMp4Evidence(config, workflowRun.id).catch((error) => ({ hasMp4: false, error: error.message }));
      const classified = controllerWorkflowConclusion(selected, completed, mp4Evidence);
      dispatch.workflowRun = {
        id: completed.id,
        url: completed.html_url,
        status: completed.status,
        conclusion: classified.conclusion,
        githubConclusion: classified.githubConclusion,
        cloudSuccessReason: classified.cloudSuccessReason,
        mp4Evidence,
        completedAt: completed.updated_at || completed.run_started_at || nowIso(),
      };
      if (dispatch.workflowRun.conclusion !== "success" && config.retryLimit > 0) {
        await sendTelegram(config, `GitHub run failed, retrying once: ${completed.html_url}`).catch(() => null);
        await dispatchWorkflow(config, selected);
      }
      const completionText = classified.cloudSuccessReason
        ? `GitHub World Cup run completed for cloud: success\nGitHub conclusion: ${completed.conclusion}\nReason: MP4 artifact was produced.\n${completed.html_url}`
        : `GitHub World Cup run completed: ${completed.conclusion}\n${completed.html_url}`;
      await sendTelegram(config, completionText).catch(() => null);
    } else {
      dispatch.workflowRun = { warning: "Could not locate workflow run after dispatch." };
      await sendTelegram(config, "GitHub workflow dispatched, but controller could not locate the run yet.").catch(() => null);
    }
  } catch (error) {
    dispatch.error = error.message;
    await sendTelegram(config, `World Cup controller error after dispatch: ${error.message}`).catch(() => null);
  }
  markDispatched(state, selected, dispatch);
  scan.dispatch = dispatch;
  state.lastStatus = dispatch.workflowRun?.conclusion === "success" ? "workflow_completed" : "workflow_finished";
  state.lastWorkflowCompletedAt = nowIso();
  recordScan(db, scan);
  persistControllerState(db, state);
  return { telegramCommands: commandResults, skipped: false, selected, dispatch, scan };
  } finally {
    db.close();
  }
}

async function main() {
  await loadControllerEnvFile();
  const args = parseArgs(process.argv.slice(2));
  const config = controllerConfig(args);
  if (!config.owner || !config.repo) throw new Error("WORLD_CUP_GITHUB_REPO must be owner/repo.");
  if (config.once || config.dryRun) {
    console.log(JSON.stringify(await runControllerOnce(config), null, 2));
    return;
  }
  for (;;) {
    const result = await runControllerOnce(config).catch(async (error) => {
      await sendTelegram(config, `World Cup controller crashed: ${error.message}`).catch(() => null);
      return { error: error.message };
    });
    console.log(JSON.stringify(result, null, 2));
    await sleep(config.intervalMinutes * 60 * 1000);
  }
}

export {
  buildEvergreenFallbackCandidate,
  candidateKey,
  controllerWorkflowConclusion,
  controllerConfig,
  espnCandidateFromMatch,
  initControllerDb,
  intentToWorldCupCommand,
  isVipMatch,
  loadControllerState,
  localYouTubeClusterCandidate,
  noCandidateNoticeDecision,
  normalizeEspnEvent,
  openControllerDb,
  parseGemmaIntentPayload,
  parseTelegramIntentCommand,
  parseTelegramWorldCupCommand,
  persistControllerState,
  mp4EvidenceFromZip,
  runYouTubeDiscoveryIfDue,
  runYouTubeStatsRefreshIfDue,
  buildYouTubeClusterCandidates,
  selectCandidate,
  validateWorldCupIntent,
  workflowInputs,
  youtubeRollingSpikeMetrics,
  youtubeSpikeMetrics,
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(JSON.stringify({ error: error.message, code: "WORLD_CUP_AZURE_CONTROLLER_FAILED" }, null, 2));
    process.exit(1);
  });
}
