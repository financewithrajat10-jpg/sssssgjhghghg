#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const worldCupRoot = path.join(repoRoot, "worldcup");

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const equalsIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

loadEnvFile(path.join(repoRoot, ".env.azure-controller"));

const dbFile = path.resolve(cleanText(process.argv[2] || process.env.WORLD_CUP_CONTROLLER_DB_FILE || path.join(worldCupRoot, "azure-controller-state.sqlite")));
const hours = Math.max(1, Number(process.argv[3] || process.env.WORLD_CUP_YOUTUBE_DIAGNOSTIC_RETENTION_HOURS || 24) || 24);
const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

if (!existsSync(dbFile)) {
  console.error(JSON.stringify({ error: `SQLite DB not found: ${dbFile}` }, null, 2));
  process.exit(1);
}

const db = new DatabaseSync(dbFile, { readOnly: true });
function tableExists(name) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function columnExists(table, column) {
  if (!tableExists(table)) return false;
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function countWhere(table, whereSql = "", params = []) {
  if (!tableExists(table)) return 0;
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table} ${whereSql}`).get(...params)?.count || 0;
}

try {
  const activePool = columnExists("youtube_videos", "active") ? countWhere("youtube_videos", "WHERE active = 1") : countWhere("youtube_videos");
  const discoveryRuns = countWhere("youtube_discovery_runs", "WHERE started_at >= ?", [since]);
  const statsRuns = countWhere("youtube_stats_runs", "WHERE started_at >= ?", [since]);
  const snapshots = countWhere("youtube_snapshots", "WHERE scanned_at >= ?", [since]);
  const spikeRows = countWhere("youtube_spike_events", "WHERE detected_at >= ?", [since]);
  const eligibleSpikes = countWhere("youtube_spike_events", "WHERE detected_at >= ? AND eligible = 1", [since]);
  const latestDiscovery = tableExists("youtube_discovery_runs") ? db.prepare("SELECT * FROM youtube_discovery_runs ORDER BY started_at DESC LIMIT 1").get() || null : null;
  const latestStats = tableExists("youtube_stats_runs") ? db.prepare("SELECT * FROM youtube_stats_runs ORDER BY started_at DESC LIMIT 1").get() || null : null;
  const latestCluster = tableExists("youtube_topic_cluster_attempts") ? db.prepare("SELECT * FROM youtube_topic_cluster_attempts ORDER BY attempted_at DESC LIMIT 1").get() || null : null;
  const rejectionReasons = tableExists("youtube_spike_events")
    ? db
        .prepare(
          `SELECT rejection_reason AS reason, COUNT(*) AS count
       FROM youtube_spike_events
       WHERE detected_at >= ? AND eligible = 0 AND rejection_reason IS NOT NULL AND rejection_reason <> ''
       GROUP BY rejection_reason
       ORDER BY count DESC
       LIMIT 12`,
        )
        .all(since)
    : [];
  const topEligible = tableExists("youtube_spike_events")
    ? db
        .prepare(
          `SELECT video_id, title, channel_title, previous_views, current_views, delta_views, growth_percent
       FROM youtube_spike_events
       WHERE detected_at >= ? AND eligible = 1
       ORDER BY growth_percent DESC, delta_views DESC
       LIMIT 10`,
        )
        .all(since)
    : [];
  console.log(
    JSON.stringify(
      {
        dbFile,
        windowHours: hours,
        since,
        activePool,
        discoveryRuns,
        statsRuns,
        snapshots,
        spikeRows,
        eligibleSpikes,
        latestDiscovery: latestDiscovery ? safeJsonParse(latestDiscovery.diagnostics_json, latestDiscovery) : null,
        latestStats: latestStats ? safeJsonParse(latestStats.diagnostics_json, latestStats) : null,
        latestCluster: latestCluster ? safeJsonParse(latestCluster.response_json, latestCluster) : null,
        rejectionReasons,
        topEligible,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
