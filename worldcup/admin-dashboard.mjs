#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const worldCupRoot = path.join(repoRoot, "worldcup");
const startedAt = new Date();

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

loadEnvFile(path.join(repoRoot, ".env.azure-controller"));

const config = {
  host: cleanText(process.env.WORLD_CUP_ADMIN_HOST || "127.0.0.1"),
  port: Math.max(1, Number(process.env.WORLD_CUP_ADMIN_PORT || 8787) || 8787),
  username: cleanText(process.env.WORLD_CUP_ADMIN_USER || "admin"),
  password: cleanText(process.env.WORLD_CUP_ADMIN_PASSWORD || ""),
  dbFile: path.resolve(cleanText(process.env.WORLD_CUP_CONTROLLER_DB_FILE || path.join(worldCupRoot, "azure-controller-state.sqlite"))),
  prematchTargetHours: Math.max(0, Number(process.env.WORLD_CUP_PREMATCH_TARGET_HOURS || 36) || 36),
  prematchGraceMinutes: Math.max(1, Number(process.env.WORLD_CUP_PREMATCH_GRACE_MINUTES || 30) || 30),
  postmatchDelayMinutes: Math.max(0, Number(process.env.WORLD_CUP_POSTMATCH_DELAY_MINUTES || 15) || 15),
  postmatchMaxAgeHours: Math.max(1, Number(process.env.WORLD_CUP_POSTMATCH_MAX_AGE_HOURS || 12) || 12),
  controllerIntervalMinutes: Math.max(1, Number(process.env.WORLD_CUP_CONTROLLER_INTERVAL_MINUTES || 15) || 15),
  retentionHours: Math.max(1, Number(process.env.WORLD_CUP_YOUTUBE_DIAGNOSTIC_RETENTION_HOURS || 24) || 24),
};

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function hashText(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function normalizeComparable(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamMatchesVip(teamName, vipTeam) {
  const name = normalizeComparable(teamName);
  const vip = normalizeComparable(vipTeam);
  return Boolean(name && vip && name === vip);
}

function listArg(value, fallback = []) {
  const text = cleanText(value);
  if (!text) return [...fallback];
  return text
    .split(/[|,]/)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

const vipTeams = [...new Set([...listArg(process.env.WORLD_CUP_VIP_TEAMS), ...DEFAULT_VIP_TEAMS])];

function isVipMatch(match) {
  const teams = [match.home, match.away].map(cleanText);
  return vipTeams.some((team) => teams.some((name) => teamMatchesVip(name, team)));
}

function candidateKey(candidate) {
  return hashText(`${candidate.type}:${candidate.topic}:${candidate.teamA || ""}:${candidate.teamB || ""}:${candidate.kickoff || ""}`);
}

function isoNow() {
  return new Date().toISOString();
}

function formatIst(iso) {
  const ms = Date.parse(iso || "");
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  }).format(new Date(ms));
}

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function columnExists(db, table, column) {
  if (!tableExists(db, table)) return false;
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function countWhere(db, table, whereSql = "", params = []) {
  if (!tableExists(db, table)) return 0;
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table} ${whereSql}`).get(...params)?.count || 0;
}

function openDb() {
  if (!existsSync(config.dbFile)) throw new Error(`SQLite DB not found: ${config.dbFile}`);
  return new DatabaseSync(config.dbFile);
}

function dispatchedMap(db) {
  if (!tableExists(db, "dispatched")) return new Map();
  const rows = db.prepare("SELECT key, source, dispatched_at, workflow_conclusion, candidate_json, details_json FROM dispatched").all();
  return new Map(
    rows.map((row) => [
      row.key,
      {
        source: row.source || "",
        dispatchedAt: row.dispatched_at || "",
        dispatchedAtIst: formatIst(row.dispatched_at),
        workflowConclusion: row.workflow_conclusion || "",
        candidate: safeJsonParse(row.candidate_json, {}),
        details: safeJsonParse(row.details_json, {}),
      },
    ]),
  );
}

function matchSnapshot(row) {
  const snapshot = safeJsonParse(row.snapshot_json, {}) || {};
  return {
    ...snapshot,
    id: cleanText(snapshot.id || row.match_id),
    name: cleanText(snapshot.name || row.name),
    kickoff: cleanText(snapshot.kickoff || row.kickoff),
    status: cleanText(snapshot.status || row.status),
    home: cleanText(snapshot.home || row.home),
    away: cleanText(snapshot.away || row.away),
    score: cleanText(snapshot.score || row.score),
    firstCompletedSeenAt: cleanText(snapshot.firstCompletedSeenAt || row.first_completed_seen_at),
    completed: snapshot.completed === true || /^(final|ft|full time|full-time)$/i.test(cleanText(snapshot.status || row.status)),
  };
}

function matchDebug(row, dispatched) {
  const match = matchSnapshot(row);
  const kickoffMs = Date.parse(match.kickoff);
  const nowMs = Date.now();
  const vip = isVipMatch(match);
  const teamA = match.away;
  const teamB = match.home;
  const preDueMs = Number.isFinite(kickoffMs) ? kickoffMs - config.prematchTargetHours * 36e5 : NaN;
  const preEndMs = Number.isFinite(preDueMs) ? preDueMs + config.prematchGraceMinutes * 60000 : NaN;
  const preTopic = `${teamA} vs ${teamB} match planning: the pressure angle fans should watch`;
  const preCandidate = { type: "prediction", topic: preTopic, teamA, teamB, kickoff: match.kickoff };
  const preDispatch = dispatched.get(candidateKey(preCandidate)) || null;
  const completedSeenMs = Date.parse(match.firstCompletedSeenAt || "");
  const completionBasisMs = Number.isFinite(completedSeenMs) ? completedSeenMs : Number.isFinite(kickoffMs) ? kickoffMs + 125 * 60000 : NaN;
  const postDueMs = Number.isFinite(completionBasisMs) ? completionBasisMs + config.postmatchDelayMinutes * 60000 : NaN;
  const postExpiresMs = Number.isFinite(completionBasisMs) ? completionBasisMs + config.postmatchMaxAgeHours * 36e5 : NaN;
  const postTopic = `${teamA} vs ${teamB} post-match analysis: the result everyone is reacting to`;
  const postCandidate = { type: "postmatch", topic: postTopic, teamA, teamB, kickoff: match.kickoff };
  const postDispatch = dispatched.get(candidateKey(postCandidate)) || null;

  let preReason = "";
  if (!vip) preReason = "Not a VIP team/player match, so the controller ignores it.";
  else if (match.completed) preReason = "Match is already completed, so pre-match is no longer eligible.";
  else if (preDispatch) preReason = "Pre-match was already dispatched.";
  else if (!Number.isFinite(preDueMs)) preReason = "Kickoff time is missing or invalid.";
  else if (nowMs < preDueMs) preReason = `Waiting for the 36-hour trigger window. Due ${formatIst(new Date(preDueMs).toISOString())}.`;
  else if (nowMs > preEndMs) preReason = `Pre-match trigger window expired at ${formatIst(new Date(preEndMs).toISOString())}.`;
  else preReason = "Pre-match is due now and should dispatch on the next controller scan.";

  let postReason = "";
  if (!vip) postReason = "Not a VIP team/player match, so the controller ignores it.";
  else if (!match.completed) postReason = "ESPN has not marked this match final yet.";
  else if (postDispatch) postReason = "Post-match was already dispatched.";
  else if (!Number.isFinite(postDueMs)) postReason = "Completion timestamp is missing or invalid.";
  else if (nowMs < postDueMs) postReason = `Waiting until ${formatIst(new Date(postDueMs).toISOString())}, 15 minutes after completion was seen.`;
  else if (nowMs > postExpiresMs) postReason = `Post-match trigger expired at ${formatIst(new Date(postExpiresMs).toISOString())}.`;
  else postReason = "Post-match is due now and should dispatch on the next controller scan.";

  return {
    id: match.id,
    name: match.name,
    home: match.home,
    away: match.away,
    kickoff: match.kickoff,
    kickoffIst: formatIst(match.kickoff),
    status: match.status,
    score: match.score,
    vip,
    completed: match.completed,
    firstCompletedSeenAt: match.firstCompletedSeenAt,
    firstCompletedSeenAtIst: formatIst(match.firstCompletedSeenAt),
    lastSeenAt: row.last_seen_at || "",
    lastSeenAtIst: formatIst(row.last_seen_at),
    pre: {
      topic: preTopic,
      dueAt: Number.isFinite(preDueMs) ? new Date(preDueMs).toISOString() : "",
      dueAtIst: Number.isFinite(preDueMs) ? formatIst(new Date(preDueMs).toISOString()) : "",
      windowEndIst: Number.isFinite(preEndMs) ? formatIst(new Date(preEndMs).toISOString()) : "",
      dispatched: Boolean(preDispatch),
      dispatch: preDispatch,
      dueNow: vip && !match.completed && !preDispatch && nowMs >= preDueMs && nowMs <= preEndMs,
      reason: preReason,
    },
    post: {
      topic: postTopic,
      dueAt: Number.isFinite(postDueMs) ? new Date(postDueMs).toISOString() : "",
      dueAtIst: Number.isFinite(postDueMs) ? formatIst(new Date(postDueMs).toISOString()) : "",
      expiresAtIst: Number.isFinite(postExpiresMs) ? formatIst(new Date(postExpiresMs).toISOString()) : "",
      dispatched: Boolean(postDispatch),
      dispatch: postDispatch,
      dueNow: vip && match.completed && !postDispatch && nowMs >= postDueMs && nowMs <= postExpiresMs,
      reason: postReason,
    },
  };
}

function getSummary() {
  const db = openDb();
  try {
    const lastScan = tableExists(db, "scans")
      ? db.prepare("SELECT scanned_at, selected_json, warnings_json, diagnostics_json FROM scans ORDER BY datetime(scanned_at) DESC LIMIT 1").get() || null
      : null;
    const lastDispatch = tableExists(db, "dispatched")
      ? db.prepare("SELECT dispatched_at, source, workflow_conclusion, candidate_json, details_json FROM dispatched ORDER BY datetime(dispatched_at) DESC LIMIT 1").get() || null
      : null;
    const dbStat = existsSync(config.dbFile) ? statSync(config.dbFile) : null;
    const today = isoNow().slice(0, 10);
    const selected = safeJsonParse(lastScan?.selected_json || "null", null);
    const warnings = safeJsonParse(lastScan?.warnings_json || "[]", []);
    const diagnostics = safeJsonParse(lastScan?.diagnostics_json || "{}", {});
    const lastCandidate = safeJsonParse(lastDispatch?.candidate_json || "{}", {});
    const lastDetails = safeJsonParse(lastDispatch?.details_json || "{}", {});
    return {
      now: isoNow(),
      nowIst: formatIst(isoNow()),
      startedAt: startedAt.toISOString(),
      startedAtIst: formatIst(startedAt.toISOString()),
      dbFile: config.dbFile,
      dbSizeMb: dbStat ? Math.round((dbStat.size / 1024 / 1024) * 100) / 100 : 0,
      config: {
        prematchTargetHours: config.prematchTargetHours,
        prematchGraceMinutes: config.prematchGraceMinutes,
        postmatchDelayMinutes: config.postmatchDelayMinutes,
        postmatchMaxAgeHours: config.postmatchMaxAgeHours,
        controllerIntervalMinutes: config.controllerIntervalMinutes,
        retentionHours: config.retentionHours,
      },
      counts: {
        matches: countWhere(db, "espn_matches"),
        dispatchedToday: countWhere(db, "dispatched", "WHERE dispatched_at >= ?", [`${today}T00:00:00.000Z`]),
        activeYouTubePool: countWhere(db, "youtube_videos", "WHERE last_seen_at >= ?", [new Date(Date.now() - config.retentionHours * 36e5).toISOString()]),
        eligibleSpikes24h: countWhere(db, "youtube_spike_events", "WHERE detected_at >= ? AND eligible = 1", [new Date(Date.now() - config.retentionHours * 36e5).toISOString()]),
      },
      lastScan: lastScan
        ? {
            scannedAt: lastScan.scanned_at,
            scannedAtIst: formatIst(lastScan.scanned_at),
            selected,
            warnings,
            diagnostics,
          }
        : null,
      lastDispatch: lastDispatch
        ? {
            dispatchedAt: lastDispatch.dispatched_at,
            dispatchedAtIst: formatIst(lastDispatch.dispatched_at),
            source: lastDispatch.source || "",
            conclusion: lastDispatch.workflow_conclusion || "",
            candidate: lastCandidate,
            workflowRun: lastDetails.workflowRun || null,
          }
        : null,
    };
  } finally {
    db.close();
  }
}

function getMatches() {
  const db = openDb();
  try {
    const dispatched = dispatchedMap(db);
    const rows = tableExists(db, "espn_matches")
      ? db
          .prepare(
            `SELECT match_id, name, kickoff, status, home, away, score, snapshot_json, first_completed_seen_at, last_seen_at
             FROM espn_matches
             ORDER BY datetime(kickoff) ASC`,
          )
          .all()
      : [];
    const matches = rows.map((row) => matchDebug(row, dispatched));
    return {
      generatedAt: isoNow(),
      generatedAtIst: formatIst(isoNow()),
      matches,
      summary: {
        total: matches.length,
        vip: matches.filter((match) => match.vip).length,
        preDueNow: matches.filter((match) => match.pre.dueNow).length,
        postDueNow: matches.filter((match) => match.post.dueNow).length,
        preDispatched: matches.filter((match) => match.pre.dispatched).length,
        postDispatched: matches.filter((match) => match.post.dispatched).length,
      },
    };
  } finally {
    db.close();
  }
}

function getYouTubeHealth() {
  const db = openDb();
  const since = new Date(Date.now() - config.retentionHours * 36e5).toISOString();
  try {
    const latestDiscovery = tableExists(db, "youtube_discovery_runs")
      ? db.prepare("SELECT * FROM youtube_discovery_runs ORDER BY datetime(started_at) DESC LIMIT 1").get() || null
      : null;
    const latestStats = tableExists(db, "youtube_stats_runs")
      ? db.prepare("SELECT * FROM youtube_stats_runs ORDER BY datetime(started_at) DESC LIMIT 1").get() || null
      : null;
    const latestCluster = tableExists(db, "youtube_topic_cluster_attempts")
      ? db.prepare("SELECT * FROM youtube_topic_cluster_attempts ORDER BY datetime(attempted_at) DESC LIMIT 1").get() || null
      : null;
    const rejectionReasons = tableExists(db, "youtube_spike_events")
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
    const topSpikes = tableExists(db, "youtube_spike_events")
      ? db
          .prepare(
            `SELECT video_id, detected_at, title, channel_title, previous_views, current_views, delta_views, growth_percent, eligible, rejection_reason
             FROM youtube_spike_events
             WHERE detected_at >= ?
             ORDER BY eligible DESC, growth_percent DESC, delta_views DESC
             LIMIT 30`,
          )
          .all(since)
      : [];
    const poolLeaders = tableExists(db, "youtube_videos")
      ? db
          .prepare(
            `SELECT video_id, title, channel_title, published_at, last_seen_at, last_views, last_comments, query
             FROM youtube_videos
             WHERE last_seen_at >= ?
             ORDER BY last_views DESC
             LIMIT 25`,
          )
          .all(since)
      : [];
    const snapshotsByHour = tableExists(db, "youtube_snapshots")
      ? db
          .prepare(
            `SELECT substr(scanned_at, 1, 13) || ':00:00.000Z' AS bucket, COUNT(*) AS snapshots, MAX(views) AS max_views
             FROM youtube_snapshots
             WHERE scanned_at >= ?
             GROUP BY bucket
             ORDER BY bucket ASC`,
          )
          .all(since)
      : [];
    const spikesByHour = tableExists(db, "youtube_spike_events")
      ? db
          .prepare(
            `SELECT substr(detected_at, 1, 13) || ':00:00.000Z' AS bucket,
                    COUNT(*) AS spike_rows,
                    SUM(CASE WHEN eligible = 1 THEN 1 ELSE 0 END) AS eligible
             FROM youtube_spike_events
             WHERE detected_at >= ?
             GROUP BY bucket
             ORDER BY bucket ASC`,
          )
          .all(since)
      : [];
    return {
      generatedAt: isoNow(),
      generatedAtIst: formatIst(isoNow()),
      windowHours: config.retentionHours,
      activePool: countWhere(db, "youtube_videos", "WHERE last_seen_at >= ?", [since]),
      discoveryRuns: countWhere(db, "youtube_discovery_runs", "WHERE started_at >= ?", [since]),
      statsRuns: countWhere(db, "youtube_stats_runs", "WHERE started_at >= ?", [since]),
      snapshots: countWhere(db, "youtube_snapshots", "WHERE scanned_at >= ?", [since]),
      spikeRows: countWhere(db, "youtube_spike_events", "WHERE detected_at >= ?", [since]),
      eligibleSpikes: countWhere(db, "youtube_spike_events", "WHERE detected_at >= ? AND eligible = 1", [since]),
      latestDiscovery: latestDiscovery ? { ...latestDiscovery, diagnostics: safeJsonParse(latestDiscovery.diagnostics_json, {}) } : null,
      latestStats: latestStats ? { ...latestStats, diagnostics: safeJsonParse(latestStats.diagnostics_json, {}) } : null,
      latestCluster: latestCluster
        ? {
            ...latestCluster,
            candidate: safeJsonParse(latestCluster.candidate_json, null),
            response: safeJsonParse(latestCluster.response_json, null),
          }
        : null,
      rejectionReasons,
      topSpikes,
      poolLeaders,
      charts: { snapshotsByHour, spikesByHour },
    };
  } finally {
    db.close();
  }
}

function getDispatches() {
  const db = openDb();
  try {
    const rows = tableExists(db, "dispatched")
      ? db
          .prepare(
            `SELECT key, source, dispatched_at, workflow_conclusion, candidate_json, details_json, updated_at
             FROM dispatched
             ORDER BY datetime(dispatched_at) DESC
             LIMIT 100`,
          )
          .all()
      : [];
    return {
      generatedAt: isoNow(),
      generatedAtIst: formatIst(isoNow()),
      dispatches: rows.map((row) => {
        const candidate = safeJsonParse(row.candidate_json, {}) || {};
        const details = safeJsonParse(row.details_json, {}) || {};
        return {
          key: row.key,
          source: row.source || "",
          dispatchedAt: row.dispatched_at,
          dispatchedAtIst: formatIst(row.dispatched_at),
          updatedAt: row.updated_at,
          updatedAtIst: formatIst(row.updated_at),
          conclusion: row.workflow_conclusion || "",
          candidate,
          workflowRun: details.workflowRun || null,
          inputs: details.inputs || null,
          error: details.error || "",
        };
      }),
    };
  } finally {
    db.close();
  }
}

function getScans() {
  const db = openDb();
  try {
    const rows = tableExists(db, "scans")
      ? db
          .prepare(
            `SELECT scanned_at, selected_json, candidates_json, warnings_json, diagnostics_json
             FROM scans
             ORDER BY datetime(scanned_at) DESC
             LIMIT 80`,
          )
          .all()
      : [];
    return {
      generatedAt: isoNow(),
      generatedAtIst: formatIst(isoNow()),
      scans: rows.map((row) => ({
        scannedAt: row.scanned_at,
        scannedAtIst: formatIst(row.scanned_at),
        selected: safeJsonParse(row.selected_json || "null", null),
        candidates: safeJsonParse(row.candidates_json, []),
        warnings: safeJsonParse(row.warnings_json, []),
        diagnostics: safeJsonParse(row.diagnostics_json, {}),
      })),
    };
  } finally {
    db.close();
  }
}

function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error("Request body too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      resolve(safeJsonParse(text || "{}", {}));
    });
    request.on("error", reject);
  });
}

function runController(args = []) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, ["worldcup/azure-controller.mjs", ...args], {
      cwd: repoRoot,
      env: { ...process.env, WORLD_CUP_CONTROLLER_TELEGRAM_COMMANDS: "false" },
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, 10 * 60 * 1000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > 200000) stdout = stdout.slice(-200000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 200000) stderr = stderr.slice(-200000);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        durationMs: Date.now() - started,
        stdout,
        stderr,
        ok: code === 0,
      });
    });
  });
}

function secureCompare(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isAuthorized(request) {
  if (!config.password) return false;
  const header = request.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const index = decoded.indexOf(":");
  if (index < 0) return false;
  const username = decoded.slice(0, index);
  const password = decoded.slice(index + 1);
  return secureCompare(username, config.username) && secureCompare(password, config.password);
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function sendHtml(response, status, html) {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(html);
}

function sendUnauthorized(response) {
  response.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="World Cup Admin"',
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end("Authentication required.");
}

const dashboardHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>World Cup Admin</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --line: #d9dee7;
      --text: #16202a;
      --muted: #627083;
      --good: #167a45;
      --warn: #a85f00;
      --bad: #b3261e;
      --blue: #2458a6;
      --teal: #007d79;
      --shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #ffffff;
      border-bottom: 1px solid var(--line);
      box-shadow: var(--shadow);
    }
    .bar {
      max-width: 1440px;
      margin: 0 auto;
      min-height: 58px;
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px;
    }
    h1 {
      font-size: 18px;
      margin: 0;
      font-weight: 700;
    }
    nav {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    nav button, .action button, .filters button {
      border: 1px solid var(--line);
      background: #fff;
      color: var(--text);
      border-radius: 6px;
      padding: 7px 10px;
      cursor: pointer;
      font: inherit;
    }
    nav button.active, .filters button.active {
      border-color: var(--blue);
      background: #eaf1ff;
      color: var(--blue);
    }
    main {
      max-width: 1440px;
      margin: 0 auto;
      padding: 18px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .panel, .metric {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .metric {
      padding: 12px;
      min-height: 88px;
    }
    .metric .label { color: var(--muted); font-size: 12px; }
    .metric .value { font-size: 24px; font-weight: 750; margin-top: 6px; }
    .metric .sub { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .panel {
      margin-top: 14px;
      overflow: hidden;
    }
    .panel h2 {
      margin: 0;
      font-size: 15px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      background: #fbfcfe;
    }
    .panel-body {
      padding: 12px 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 8px 7px;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
      background: #fbfcfe;
    }
    tr:last-child td { border-bottom: 0; }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 650;
      background: #eef1f5;
      color: #415166;
      white-space: nowrap;
    }
    .pill.good { background: #e7f6ed; color: var(--good); }
    .pill.warn { background: #fff1db; color: var(--warn); }
    .pill.bad { background: #fdebea; color: var(--bad); }
    .pill.blue { background: #eaf1ff; color: var(--blue); }
    .pill.teal { background: #e4f7f5; color: var(--teal); }
    .muted { color: var(--muted); }
    .reason { color: #3d4a5c; font-size: 12px; margin-top: 4px; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .filters { display: flex; gap: 6px; flex-wrap: wrap; }
    input[type="search"] {
      min-width: 260px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 8px 10px;
      font: inherit;
      background: #fff;
    }
    .charts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    canvas {
      width: 100%;
      height: 210px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
    }
    pre {
      margin: 0;
      padding: 10px;
      background: #101923;
      color: #dce7f3;
      border-radius: 8px;
      max-height: 360px;
      overflow: auto;
      font-size: 12px;
    }
    .action {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .action button.primary {
      background: var(--blue);
      color: #fff;
      border-color: var(--blue);
    }
    .action button.danger {
      background: #fff;
      color: var(--bad);
      border-color: #efb1ad;
    }
    .hidden { display: none; }
    @media (max-width: 980px) {
      .grid, .charts { grid-template-columns: 1fr 1fr; }
      .bar { align-items: flex-start; flex-direction: column; }
    }
    @media (max-width: 680px) {
      main { padding: 10px; }
      .grid, .charts { grid-template-columns: 1fr; }
      input[type="search"] { min-width: 0; width: 100%; }
      table { font-size: 12px; }
      th, td { padding: 7px 5px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <h1>World Cup Admin</h1>
      <nav>
        <button data-tab="overview" class="active">Overview</button>
        <button data-tab="matches">Matches</button>
        <button data-tab="youtube">YouTube</button>
        <button data-tab="runs">Runs</button>
        <button data-tab="scans">Scans</button>
      </nav>
    </div>
  </header>
  <main>
    <section id="overview" class="tab"></section>
    <section id="matches" class="tab hidden"></section>
    <section id="youtube" class="tab hidden"></section>
    <section id="runs" class="tab hidden"></section>
    <section id="scans" class="tab hidden"></section>
  </main>
  <script>
    const state = { summary: null, matches: null, youtube: null, runs: null, scans: null, filter: 'vip', q: '' };
    const $ = (selector, root = document) => root.querySelector(selector);
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const pill = (text, cls = '') => '<span class="pill ' + cls + '">' + esc(text) + '</span>';
    async function api(path, options) {
      const url = new URL(path, window.location.href);
      url.username = '';
      url.password = '';
      const res = await fetch(url.href, { cache: 'no-store', ...options });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }
    function setTab(name) {
      document.querySelectorAll('nav button').forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
      document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('hidden', tab.id !== name));
    }
    document.querySelectorAll('nav button').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));
    function metric(label, value, sub = '') {
      return '<div class="metric"><div class="label">' + esc(label) + '</div><div class="value">' + esc(value) + '</div><div class="sub">' + esc(sub) + '</div></div>';
    }
    function renderOverview() {
      const data = state.summary;
      if (!data) return;
      $('#overview').innerHTML = [
        '<div class="grid">',
        metric('ESPN matches', data.counts.matches, data.counts.dispatchedToday + ' dispatches today'),
        metric('YouTube pool', data.counts.activeYouTubePool, data.counts.eligibleSpikes24h + ' eligible spikes in window'),
        metric('Last scan', data.lastScan?.scannedAtIst || 'none', data.lastScan?.selected?.topic || 'No selected candidate'),
        metric('Last dispatch', data.lastDispatch?.dispatchedAtIst || 'none', data.lastDispatch?.candidate?.topic || ''),
        '</div>',
        '<div class="panel"><h2>Controller</h2><div class="panel-body">',
        '<div class="action"><button class="primary" id="refreshAll">Refresh</button><button id="dryRunNow">Dry-run now</button><button class="danger" id="liveRunOnce">Live run once</button></div>',
        '<p class="muted">DB: ' + esc(data.dbFile) + ' (' + esc(data.dbSizeMb) + ' MB)</p>',
        '<p>Pre-match: ' + esc(data.config.prematchTargetHours) + 'h before kickoff, ' + esc(data.config.prematchGraceMinutes) + 'm window. Post-match: ' + esc(data.config.postmatchDelayMinutes) + 'm after ESPN final seen.</p>',
        '<div id="actionResult"></div>',
        '</div></div>',
        '<div class="panel"><h2>Latest Warnings</h2><div class="panel-body">',
        data.lastScan?.warnings?.length ? '<pre>' + esc(JSON.stringify(data.lastScan.warnings, null, 2)) + '</pre>' : '<p class="muted">No warnings in latest scan.</p>',
        '</div></div>'
      ].join('');
      $('#refreshAll').onclick = loadAll;
      $('#dryRunNow').onclick = async () => runAction('/api/actions/controller-dry-run', {});
      $('#liveRunOnce').onclick = async () => {
        const confirmText = prompt('Type RUN_LIVE to run the controller once with live dispatch enabled.');
        if (confirmText === 'RUN_LIVE') await runAction('/api/actions/controller-once', { confirm: 'RUN_LIVE' });
      };
    }
    async function runAction(path, body) {
      $('#actionResult').innerHTML = '<p class="muted">Running...</p>';
      try {
        const result = await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
        $('#actionResult').innerHTML = '<pre>' + esc(JSON.stringify(result, null, 2)) + '</pre>';
        await loadAll();
      } catch (error) {
        $('#actionResult').innerHTML = '<pre>' + esc(error.message) + '</pre>';
      }
    }
    function renderMatches() {
      const data = state.matches;
      if (!data) return;
      const filters = ['all', 'vip', 'due', 'blocked', 'dispatched'];
      let rows = data.matches || [];
      if (state.filter === 'vip') rows = rows.filter((m) => m.vip);
      if (state.filter === 'due') rows = rows.filter((m) => m.pre.dueNow || m.post.dueNow);
      if (state.filter === 'blocked') rows = rows.filter((m) => m.vip && !m.pre.dispatched && !m.post.dispatched && !m.pre.dueNow && !m.post.dueNow);
      if (state.filter === 'dispatched') rows = rows.filter((m) => m.pre.dispatched || m.post.dispatched);
      if (state.q) rows = rows.filter((m) => JSON.stringify(m).toLowerCase().includes(state.q.toLowerCase()));
      $('#matches').innerHTML = [
        '<div class="grid">',
        metric('Total matches', data.summary.total, data.summary.vip + ' VIP'),
        metric('Pre due now', data.summary.preDueNow, data.summary.preDispatched + ' pre dispatched'),
        metric('Post due now', data.summary.postDueNow, data.summary.postDispatched + ' post dispatched'),
        metric('Showing', rows.length, 'filtered rows'),
        '</div>',
        '<div class="panel"><h2>Match Debug</h2><div class="panel-body">',
        '<div class="toolbar"><div class="filters">' + filters.map((f) => '<button data-filter="' + f + '" class="' + (state.filter === f ? 'active' : '') + '">' + f + '</button>').join('') + '</div><input type="search" id="matchSearch" placeholder="Search match, status, reason" value="' + esc(state.q) + '"></div>',
        '<table><thead><tr><th style="width:20%">Match</th><th style="width:12%">Kickoff</th><th style="width:10%">Status</th><th style="width:29%">Pre-match</th><th style="width:29%">Post-match</th></tr></thead><tbody>',
        rows.map((m) => '<tr><td><strong>' + esc(m.away + ' vs ' + m.home) + '</strong><div class="muted">' + esc(m.name) + '</div>' + (m.vip ? pill('VIP', 'blue') : pill('non-VIP')) + '</td><td>' + esc(m.kickoffIst) + '</td><td>' + esc(m.status || '') + '<div class="muted">' + esc(m.score || '') + '</div></td><td>' + (m.pre.dispatched ? pill('dispatched', 'good') : m.pre.dueNow ? pill('due now', 'warn') : pill('waiting')) + '<div class="muted">Due: ' + esc(m.pre.dueAtIst || '') + '</div><div class="reason">' + esc(m.pre.reason) + '</div></td><td>' + (m.post.dispatched ? pill('dispatched', 'good') : m.post.dueNow ? pill('due now', 'warn') : m.completed ? pill('waiting') : pill('not final')) + '<div class="muted">Due: ' + esc(m.post.dueAtIst || '') + '</div><div class="reason">' + esc(m.post.reason) + '</div></td></tr>').join(''),
        '</tbody></table></div></div>'
      ].join('');
      document.querySelectorAll('[data-filter]').forEach((button) => button.onclick = () => { state.filter = button.dataset.filter; renderMatches(); });
      $('#matchSearch').oninput = (event) => { state.q = event.target.value; renderMatches(); };
    }
    function drawChart(canvas, rows, valueKey, color) {
      const ctx = canvas.getContext('2d');
      const width = canvas.width = Math.max(600, canvas.clientWidth * devicePixelRatio);
      const height = canvas.height = 210 * devicePixelRatio;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = '#d9dee7';
      ctx.lineWidth = 1 * devicePixelRatio;
      ctx.beginPath();
      ctx.moveTo(40 * devicePixelRatio, 12 * devicePixelRatio);
      ctx.lineTo(40 * devicePixelRatio, height - 28 * devicePixelRatio);
      ctx.lineTo(width - 12 * devicePixelRatio, height - 28 * devicePixelRatio);
      ctx.stroke();
      const vals = rows.map((r) => Number(r[valueKey] || 0));
      const max = Math.max(1, ...vals);
      const barW = Math.max(4 * devicePixelRatio, (width - 64 * devicePixelRatio) / Math.max(1, rows.length));
      rows.forEach((row, i) => {
        const value = Number(row[valueKey] || 0);
        const barH = (height - 52 * devicePixelRatio) * (value / max);
        ctx.fillStyle = color;
        ctx.fillRect(44 * devicePixelRatio + i * barW, height - 28 * devicePixelRatio - barH, Math.max(2 * devicePixelRatio, barW - 2 * devicePixelRatio), barH);
      });
      ctx.fillStyle = '#627083';
      ctx.font = (11 * devicePixelRatio) + 'px system-ui';
      ctx.fillText('max ' + max, 48 * devicePixelRatio, 22 * devicePixelRatio);
    }
    function renderYoutube() {
      const data = state.youtube;
      if (!data) return;
      $('#youtube').innerHTML = [
        '<div class="grid">',
        metric('Active pool', data.activePool, data.windowHours + 'h window'),
        metric('Discovery runs', data.discoveryRuns, data.latestDiscovery?.status || ''),
        metric('Stats refreshes', data.statsRuns, data.latestStats?.status || ''),
        metric('Eligible spikes', data.eligibleSpikes, data.spikeRows + ' spike rows'),
        '</div>',
        '<div class="panel"><h2>Trend Charts</h2><div class="panel-body"><div class="charts"><canvas id="snapChart"></canvas><canvas id="spikeChart"></canvas></div></div></div>',
        '<div class="panel"><h2>Latest Cluster</h2><div class="panel-body"><pre>' + esc(JSON.stringify(data.latestCluster, null, 2)) + '</pre></div></div>',
        '<div class="panel"><h2>Spike Rejection Reasons</h2><div class="panel-body"><table><thead><tr><th>Reason</th><th>Count</th></tr></thead><tbody>' + data.rejectionReasons.map((r) => '<tr><td>' + esc(r.reason) + '</td><td>' + esc(r.count) + '</td></tr>').join('') + '</tbody></table></div></div>',
        '<div class="panel"><h2>Top Spike Rows</h2><div class="panel-body"><table><thead><tr><th>Video</th><th>Channel</th><th>Growth</th><th>Delta</th><th>Decision</th></tr></thead><tbody>' + data.topSpikes.map((v) => '<tr><td>' + esc(v.title) + '<div class="muted">' + esc(v.video_id) + '</div></td><td>' + esc(v.channel_title) + '</td><td>' + esc(Math.round(Number(v.growth_percent || 0))) + '%</td><td>' + esc(v.delta_views) + '</td><td>' + (v.eligible ? pill('eligible', 'good') : pill(v.rejection_reason || 'rejected', 'bad')) + '</td></tr>').join('') + '</tbody></table></div></div>'
      ].join('');
      drawChart($('#snapChart'), data.charts.snapshotsByHour || [], 'snapshots', '#2458a6');
      drawChart($('#spikeChart'), data.charts.spikesByHour || [], 'eligible', '#007d79');
    }
    function renderRuns() {
      const data = state.runs;
      if (!data) return;
      $('#runs').innerHTML = '<div class="panel"><h2>Recent Dispatches</h2><div class="panel-body"><table><thead><tr><th>Time</th><th>Source</th><th>Topic</th><th>Status</th><th>Run</th></tr></thead><tbody>' + data.dispatches.map((d) => '<tr><td>' + esc(d.dispatchedAtIst) + '</td><td>' + esc(d.source) + '</td><td>' + esc(d.candidate?.topic || '') + '<div class="muted">' + esc(d.candidate?.type || '') + '</div></td><td>' + (d.conclusion ? pill(d.conclusion, d.conclusion === 'success' ? 'good' : 'bad') : pill('pending', 'warn')) + '</td><td>' + (d.workflowRun?.url ? '<a href="' + esc(d.workflowRun.url) + '" target="_blank" rel="noreferrer">GitHub</a>' : '<span class="muted">not stored yet</span>') + '</td></tr>').join('') + '</tbody></table></div></div>';
    }
    function renderScans() {
      const data = state.scans;
      if (!data) return;
      $('#scans').innerHTML = '<div class="panel"><h2>Recent Scans</h2><div class="panel-body"><table><thead><tr><th>Time</th><th>Selected</th><th>Sources</th><th>Warnings</th></tr></thead><tbody>' + data.scans.map((s) => '<tr><td>' + esc(s.scannedAtIst) + '</td><td>' + (s.selected ? esc(s.selected.topic || '') + '<div class="muted">' + esc(s.selected.source || '') + '</div>' : '<span class="muted">none</span>') + '</td><td>' + esc(JSON.stringify({ espn: s.diagnostics?.espnCandidates || 0, yt: s.diagnostics?.youtubeSpikeCandidates || 0, raw: s.diagnostics?.rawCandidateCount || 0 })) + '</td><td>' + esc((s.warnings || []).slice(0, 2).join(' | ')) + '</td></tr>').join('') + '</tbody></table></div></div>';
    }
    async function loadAll() {
      const [summary, matches, youtube, runs, scans] = await Promise.all([
        api('/api/summary'),
        api('/api/matches'),
        api('/api/youtube'),
        api('/api/dispatches'),
        api('/api/scans')
      ]);
      Object.assign(state, { summary, matches, youtube, runs, scans });
      renderOverview();
      renderMatches();
      renderYoutube();
      renderRuns();
      renderScans();
    }
    loadAll().catch((error) => {
      document.querySelector('main').innerHTML = '<pre>' + esc(error.message) + '</pre>';
    });
    setInterval(loadAll, 60000);
  </script>
</body>
</html>`;

async function route(request, response) {
  if (!isAuthorized(request)) {
    sendUnauthorized(response);
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/") return sendHtml(response, 200, dashboardHtml);
    if (request.method === "GET" && url.pathname === "/api/summary") return sendJson(response, 200, getSummary());
    if (request.method === "GET" && url.pathname === "/api/matches") return sendJson(response, 200, getMatches());
    if (request.method === "GET" && url.pathname === "/api/youtube") return sendJson(response, 200, getYouTubeHealth());
    if (request.method === "GET" && url.pathname === "/api/dispatches") return sendJson(response, 200, getDispatches());
    if (request.method === "GET" && url.pathname === "/api/scans") return sendJson(response, 200, getScans());
    if (request.method === "POST" && url.pathname === "/api/actions/controller-dry-run") {
      return sendJson(response, 200, await runController(["--once", "--dry-run"]));
    }
    if (request.method === "POST" && url.pathname === "/api/actions/controller-once") {
      const body = await getRequestBody(request);
      if (body?.confirm !== "RUN_LIVE") return sendJson(response, 400, { error: "Confirmation required." });
      return sendJson(response, 200, await runController(["--once"]));
    }
    return sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    return sendJson(response, 500, { error: error.message, stack: process.env.NODE_ENV === "production" ? undefined : error.stack });
  }
}

function main() {
  if (!config.password) {
    console.error("WORLD_CUP_ADMIN_PASSWORD is required.");
    process.exit(1);
  }
  const server = http.createServer((request, response) => {
    route(request, response).catch((error) => sendJson(response, 500, { error: error.message }));
  });
  server.listen(config.port, config.host, () => {
    console.log(`World Cup admin dashboard listening on http://${config.host}:${config.port}`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();

export { getDispatches, getMatches, getScans, getSummary, getYouTubeHealth, isVipMatch };
