#!/usr/bin/env node
import { path, fs, cleanText, hashText, nowIso, sleep, worldCupRoot, requestGeminiJsonWithFallbacks, getActiveGeminiKey } from "./modules/utils.mjs";
import { knownOpeningFixtures } from "./modules/scheduler.mjs";

const DEFAULT_INTERVAL_MINUTES = 15;
const DEFAULT_TREND_THRESHOLD = 75;
const DEFAULT_RETRY_LIMIT = 1;
const DEFAULT_WORKFLOW_FILE = "worldcup-pipeline.yml";
const DEFAULT_BRANCH = "main";

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

function numberArg(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function controllerConfig(args = {}) {
  const repo = cleanText(args.repo || process.env.WORLD_CUP_GITHUB_REPO || process.env.GITHUB_REPOSITORY || "financewithrajat10-jpg/Money-Printing-Machine");
  const [owner, repoName] = repo.split("/");
  return {
    owner,
    repo: repoName,
    repoFullName: repo,
    branch: cleanText(args.ref || args.branch || process.env.WORLD_CUP_GITHUB_REF || DEFAULT_BRANCH),
    workflowFile: cleanText(args.workflow || process.env.WORLD_CUP_WORKFLOW_FILE || DEFAULT_WORKFLOW_FILE),
    githubToken: cleanText(process.env.WORLD_CUP_GITHUB_TOKEN || process.env.GITHUB_FINE_GRAINED_PAT || process.env.GITHUB_TOKEN || ""),
    youtubeApiKey: cleanText(process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || ""),
    trendThreshold: numberArg(args.trendThreshold || process.env.WORLD_CUP_TREND_THRESHOLD, DEFAULT_TREND_THRESHOLD),
    intervalMinutes: Math.max(1, numberArg(args.intervalMinutes || process.env.WORLD_CUP_CONTROLLER_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES)),
    retryLimit: Math.max(0, numberArg(args.retryLimit || process.env.WORLD_CUP_CONTROLLER_RETRY_LIMIT, DEFAULT_RETRY_LIMIT)),
    dryRun: boolArg(args.dryRun, false),
    offline: boolArg(args.offline, false),
    once: boolArg(args.once, false),
    force: boolArg(args.force, false),
    stateFile: path.resolve(cleanText(args.stateFile || process.env.WORLD_CUP_CONTROLLER_STATE_FILE || path.join(worldCupRoot, "azure-controller-state.json"))),
    telegramBotToken: cleanText(process.env.WORLD_CUP_CONTROLLER_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ""),
    telegramChatId: cleanText(process.env.WORLD_CUP_CONTROLLER_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || ""),
    telegramThreadId: cleanText(process.env.WORLD_CUP_CONTROLLER_TELEGRAM_THREAD_ID || process.env.TELEGRAM_THREAD_ID || ""),
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

function candidateKey(candidate) {
  return hashText(`${candidate.type}:${candidate.topic}:${candidate.teamA || ""}:${candidate.teamB || ""}:${candidate.kickoff || ""}`);
}

function wasDispatched(state, candidate) {
  const key = candidateKey(candidate);
  return Boolean(state.dispatched?.[key]);
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

function matchCandidateFromFixture(fixture, state, now = new Date()) {
  const kickoffMs = Date.parse(fixture.kickoff || "");
  if (!Number.isFinite(kickoffMs)) return null;
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

function youtubeQueries() {
  return String(process.env.WORLD_CUP_TREND_QUERIES || "FIFA World Cup 2026|World Cup 2026|football World Cup|USMNT World Cup|Messi Ronaldo World Cup")
    .split("|")
    .map(cleanText)
    .filter(Boolean);
}

async function youtubeSearch(config, query) {
  if (!config.youtubeApiKey) return [];
  const publishedAfter = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "8");
  searchUrl.searchParams.set("order", "date");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("publishedAfter", publishedAfter);
  searchUrl.searchParams.set("key", config.youtubeApiKey);
  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) throw new Error(`YouTube search failed: ${searchResponse.status}`);
  const searchJson = await searchResponse.json();
  const ids = (searchJson.items || []).map((item) => item.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  statsUrl.searchParams.set("part", "snippet,statistics");
  statsUrl.searchParams.set("id", ids.join(","));
  statsUrl.searchParams.set("key", config.youtubeApiKey);
  const statsResponse = await fetch(statsUrl);
  if (!statsResponse.ok) throw new Error(`YouTube stats failed: ${statsResponse.status}`);
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

function scoreYouTubeVideo(video) {
  const ageHours = Math.max(0.25, (Date.now() - Date.parse(video.publishedAt || nowIso())) / 36e5);
  const viewVelocity = video.views / ageHours;
  const velocityScore = Math.min(30, Math.log10(viewVelocity + 1) * 8);
  const commentScore = Math.min(15, Math.log10(video.comments + 1) * 6);
  const recognizability = /messi|ronaldo|usa|usmnt|brazil|argentina|england|france|spain|germany|portugal|mexico|world cup/i.test(video.title) ? 15 : 8;
  const debate = /vs|prediction|shock|why|problem|pressure|controversy|lineup|injury|reaction/i.test(video.title) ? 15 : 6;
  const freshness = ageHours <= 2 ? 15 : ageHours <= 4 ? 10 : 5;
  return Math.round(Math.min(100, velocityScore + commentScore + recognizability + debate + freshness + 10));
}

async function buildYouTubeCandidates(config, warnings) {
  const all = [];
  for (const query of youtubeQueries()) {
    try {
      const videos = await youtubeSearch(config, query);
      for (const video of videos) {
        const score = scoreYouTubeVideo(video);
        all.push({
          type: "pre-tournament",
          topic: video.title,
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
    return {
      type: ["prediction", "postmatch", "pre-tournament"].includes(cleanText(result.json?.type).toLowerCase()) ? cleanText(result.json.type).toLowerCase() : "pre-tournament",
      topic,
      teamA: cleanText(result.json?.teamA),
      teamB: cleanText(result.json?.teamB),
      kickoff: cleanText(result.json?.kickoff),
      score: Math.max(0, Math.min(100, Number(result.json?.score || 78))),
      reason: cleanText(result.json?.reason) || "Gemini Search Grounding trend candidate.",
      source: "gemini-search-grounding",
      sources: Array.isArray(result.json?.sources) ? result.json.sources : [],
      groundingHealth: {
        model: result.model,
        sourceCount: Array.isArray(result.sources) ? result.sources.length : 0,
        searchOperationExpected: true,
      },
    };
  } catch (error) {
    warnings.push(`Gemini trend grounding failed: ${error.message}`);
    return null;
  }
}

function selectCandidate(candidates, state, threshold, force = false) {
  const sorted = candidates
    .filter((candidate) => candidate?.topic)
    .map((candidate) => ({ ...candidate, key: candidateKey(candidate), duplicate: wasDispatched(state, candidate) }))
    .sort((a, b) => b.score - a.score);
  const selected = sorted.find((candidate) => !candidate.duplicate && (force || candidate.score >= threshold));
  return { selected: selected || null, candidates: sorted };
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
    force: "true",
  };
}

async function githubRequest(config, pathname, { method = "GET", body = null } = {}) {
  if (!config.githubToken) throw new Error("Missing WORLD_CUP_GITHUB_TOKEN/GITHUB_FINE_GRAINED_PAT/GITHUB_TOKEN.");
  const response = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "world-cup-azure-controller",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
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
  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, { method: "POST", body: form });
  if (!response.ok) throw new Error(`Telegram alert failed: ${response.status}`);
  return await response.json();
}

async function runControllerOnce(config) {
  const state = await readJsonFile(config.stateFile, { version: 1, dispatched: {}, scans: [] });
  const warnings = [];
  const now = new Date();
  const matchCandidates = configuredFixtures()
    .map((fixture) => matchCandidateFromFixture(fixture, state, now))
    .filter(Boolean);
  const youtubeCandidates = config.offline ? [] : await buildYouTubeCandidates(config, warnings);
  const geminiCandidate = config.offline ? null : await buildGeminiTrendCandidate(warnings);
  const rawCandidates = [...matchCandidates, ...youtubeCandidates, ...(geminiCandidate ? [geminiCandidate] : [])];
  const { selected, candidates } = selectCandidate(rawCandidates, state, config.trendThreshold, config.force);
  const scan = {
    scannedAt: nowIso(),
    selected,
    candidates: candidates.slice(0, 20),
    warnings,
    threshold: config.trendThreshold,
    dryRun: config.dryRun,
    offline: config.offline,
  };
  state.scans = [scan, ...(state.scans || [])].slice(0, 200);
  let dispatch = null;
  if (!selected) {
    await writeJsonFile(config.stateFile, state);
    await sendTelegram(config, `World Cup controller checked trends: no candidate crossed ${config.trendThreshold}. Top score: ${candidates[0]?.score || 0}.`).catch(() => null);
    return { skipped: true, reason: "No non-duplicate candidate crossed threshold.", scan };
  }
  if (config.dryRun) {
    dispatch = { dryRun: true, inputs: workflowInputs(selected) };
    scan.dispatch = dispatch;
    await writeJsonFile(config.stateFile, state);
    return { skipped: false, selected, dispatch, scan };
  }
  await sendTelegram(config, `Trend found: ${selected.topic}\nScore: ${selected.score}\nTriggering GitHub workflow...`).catch(() => null);
  const dispatchedAt = nowIso();
  try {
    dispatch = await dispatchWorkflow(config, selected);
  } catch (error) {
    dispatch = { error: error.message, attemptedAt: dispatchedAt, inputs: workflowInputs(selected) };
    scan.dispatch = dispatch;
    await writeJsonFile(config.stateFile, state);
    await sendTelegram(config, `World Cup controller could not trigger GitHub: ${error.message}`).catch(() => null);
    return { skipped: false, selected, dispatch, scan, error: error.message };
  }
  let workflowRun = null;
  try {
    for (let attempt = 0; attempt < 10 && !workflowRun; attempt += 1) {
      await sleep(10_000);
      workflowRun = await findRecentWorkflowRun(config, dispatchedAt);
    }
    if (workflowRun) {
      const completed = await pollWorkflowRun(config, workflowRun.id);
      dispatch.workflowRun = {
        id: completed.id,
        url: completed.html_url,
        status: completed.status,
        conclusion: completed.conclusion,
      };
      if (completed.conclusion !== "success" && config.retryLimit > 0) {
        await sendTelegram(config, `GitHub run failed, retrying once: ${completed.html_url}`).catch(() => null);
        await dispatchWorkflow(config, selected);
      }
      await sendTelegram(config, `GitHub World Cup run completed: ${completed.conclusion}\n${completed.html_url}`).catch(() => null);
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
  await writeJsonFile(config.stateFile, state);
  return { skipped: false, selected, dispatch, scan };
}

async function main() {
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

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message, code: "WORLD_CUP_AZURE_CONTROLLER_FAILED" }, null, 2));
  process.exit(1);
});
