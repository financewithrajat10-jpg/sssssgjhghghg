import {
  AUDIO_SRT_FALLBACK_MODELS,
  AUDIO_SRT_MODEL,
  DEFAULT_LANGUAGE,
  DEFAULT_SCHEDULE_HOURS,
  DEFAULT_UPLOAD_TARGET,
  DEFAULT_WORLD_CUP_STRATEGY,
  EVALUATOR_MODEL,
  GEMINI_REQUEST_TIMEOUT_MS,
  GEMINI_RETRY_DELAYS_MS,
  GOOGLE_DRIVE_SCOPE,
  LITE_TEXT_MODEL,
  LOCAL_ENTITY_FOLDER_HINTS,
  LOCAL_ENTITY_PREFERRED_IMAGES,
  MAJOR_WORLD_CUP_ASSET_TARGETS,
  MAX_SAVED_KEYS,
  MAX_VIDEOS_PER_DAY,
  MEDIA_REQUEST_TIMEOUT_MS,
  SEARCH_FALLBACK_MODELS,
  SEARCH_MODEL,
  STOCK_VIDEO_HOSTS,
  TTS_MODEL,
  TTS_REWRITE_MODEL,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  VISUAL_PREVIEW_TIMEOUT_MS,
  VISUAL_REVIEW_MAX_ITEMS,
  VISUAL_REVIEW_MODEL,
  VISUAL_SCOUT_PAGES,
  VISUAL_SCOUT_TIMEOUT_MS,
  VISUAL_SELECTION_FALLBACK_MODELS,
  VISUAL_SELECTION_MODEL,
  WORLD_CUP_ASSET_SEARCH_FALLBACK_MODELS,
  WORLD_CUP_ASSET_SEARCH_MODEL,
  WORLD_CUP_BGM_FILE,
  WORLD_CUP_BGM_MODE,
  WORLD_CUP_BGM_PRESET,
  WORLD_CUP_BGM_VOLUME,
  WORLD_CUP_CAPTION_DESIGN_MODEL,
  WORLD_CUP_CAPTION_MIDSCREEN,
  WORLD_CUP_CAPTION_PRESET,
  WORLD_CUP_DRIVE_FALLBACK_TELEGRAM,
  WORLD_CUP_ENABLE_BGM,
  WORLD_CUP_ENABLE_LOCAL_ENTITY_ASSETS,
  WORLD_CUP_LOCAL_ENTITY_CANDIDATES_PER_ENTITY,
  WORLD_CUP_LOCAL_ENTITY_MAX_ENTITIES,
  WORLD_CUP_LOCAL_ENTITY_MIN_SCORE,
  WORLD_CUP_LOCAL_ENTITY_SELECTIONS_PER_ENTITY,
  WORLD_CUP_LOCAL_PROOF_MAX_PER_VIDEO,
  WORLD_CUP_MAX_IMAGE_SEGMENTS,
  WORLD_CUP_MIN_CLIP_RATIO,
  WORLD_CUP_MIN_REAL_VISUAL_RATIO,
  WORLD_CUP_RESEARCH_PASSES,
  WORLD_CUP_TELEGRAM_SEND_SIDECARS,
  WORLD_CUP_VISUAL_RETRY_ATTEMPTS,
  WORLD_CUP_VOICES,
  WORLD_CUP_VOICE_VOLUME,
  WRITER_MODEL,
  WorldCupError,
  __dirname,
  activeWorldCupApiUsage,
  assetPackRoot,
  bgmRoot,
  cachedFfmpegPath,
  classifyGeminiError,
  cleanInputText,
  cleanText,
  createApiUsageLedger,
  createWavBuffer,
  ensureWorldCupDirs,
  envGeminiKey,
  execFileAsync,
  extractGroundingSources,
  extractJson,
  fetchWithTimeout,
  geminiKeyStorePath,
  getActiveGeminiKey,
  getActiveStockKey,
  getActiveWorldCupApiUsage,
  hasFfmpeg,
  hashText,
  indexPath,
  isHardGeminiQuotaError,
  isRetryableGeminiError,
  isViral2,
  loadLocalEnvFiles,
  localDownloadsRoot,
  localEntityPreviewRoot,
  normalizeBool,
  normalizeGeminiKeyStore,
  normalizeWorldCupBgmPreset,
  normalizeWorldCupCaptionPreset,
  normalizeWorldCupInput,
  normalizeWorldCupStrategy,
  nowIso,
  portableFfmpegPath,
  readJsonFile,
  recordApiUsage,
  repairCommonMojibake,
  repoRoot,
  requestGeminiGenerateContent,
  requestGeminiJson,
  requestGeminiJsonWithFallbacks,
  requestGeminiText,
  requestGeminiTextWithFallbacks,
  resolveFfmpegPath,
  runsRoot,
  safeFilePart,
  setActiveWorldCupApiUsage,
  sleep,
  slugify,
  stockEnvKey,
  stockKeyStorePath,
  stripTagsForSpeech,
  synthesizeWorldCupAudio,
  tempRoot,
  todayDate,
  wavDurationSeconds,
  withTimeout,
  worldCupRoot,
} from "./utils.mjs";
import {
  createRunSkeleton,
  listWorldCupRuns,
  loadWorldCupMemory,
  memoryPrompt,
  readWorldCupRun,
  rebuildWorldCupIndex,
  runSummary,
  saveRun,
  writeRunFile,
} from "./memory.mjs";

export function preTournamentTopics() {
  const configured = String(process.env.WORLD_CUP_TOPICS || "")
    .split("|")
    .map(cleanText)
    .filter(Boolean);
  if (configured.length) {
    return configured;
  }
  return [
    "World Cup trap teams nobody wants in their group",
    "Which host nation has the most pressure right now",
    "World Cup chaos watch: teams with upset energy",
    "Legacy watch: stars who need one more World Cup moment",
    "Fraud watch versus aura check before the tournament starts",
    "Why midfield pressure decides more World Cup matches than star power",
  ];
}

export function hasMeaningfulWorldCupInput(value) {
  return Boolean(cleanInputText(value));
}

export function isTournamentWindow(date) {
  const value = cleanInputText(date).slice(0, 10);
  return value >= "2026-06-11" && value <= "2026-07-19";
}

export function knownOpeningFixtures() {
  return [
    {
      date: "2026-06-11",
      teamA: "Mexico",
      teamB: "South Africa",
      group: "Group A",
      kickoff: "2026-06-11T19:00:00Z",
      venue: "Mexico City Stadium",
      topic: "Mexico vs South Africa World Cup opening match prediction",
    },
    {
      date: "2026-06-11",
      teamA: "Korea Republic",
      teamB: "Czechia",
      group: "Group A",
      kickoff: "2026-06-12T02:00:00Z",
      venue: "Estadio Guadalajara",
      topic: "Korea Republic vs Czechia World Cup Group A prediction",
    },
    {
      date: "2026-06-12",
      teamA: "Canada",
      teamB: "Bosnia and Herzegovina",
      group: "Group B",
      kickoff: "2026-06-12T19:00:00Z",
      venue: "Toronto Stadium",
      topic: "Canada vs Bosnia and Herzegovina World Cup host pressure prediction",
    },
    {
      date: "2026-06-12",
      teamA: "USA",
      teamB: "Paraguay",
      group: "Group D",
      kickoff: "2026-06-13T02:00:00Z",
      venue: "Los Angeles Stadium",
      topic: "USA vs Paraguay World Cup host pressure prediction",
    },
  ];
}

export function opportunityFromFixture(fixture, now = new Date()) {
  const kickoffMs = Date.parse(fixture.kickoff || "");
  const postMatchReady = Number.isFinite(kickoffMs) && now.getTime() >= kickoffMs + 115 * 60 * 1000;
  const type = postMatchReady ? "postmatch" : "prediction";
  const topic =
    type === "postmatch"
      ? `${fixture.teamA} vs ${fixture.teamB} post-match analysis: the moment that changed the game`
      : fixture.topic || `${fixture.teamA} vs ${fixture.teamB} World Cup prediction`;
  return {
    type,
    topic,
    teamA: fixture.teamA,
    teamB: fixture.teamB,
    kickoff: fixture.kickoff,
    venue: fixture.venue,
    matchId: slugify(`${fixture.date}-${fixture.teamA}-${fixture.teamB}`, "worldcup-match"),
    reason: "Fixture selected from World Cup matchday fallback list.",
  };
}

export function fallbackMatchdayOpportunity(date, now = new Date()) {
  const day = cleanInputText(date).slice(0, 10);
  const fixtures = knownOpeningFixtures().filter((fixture) => fixture.date >= day);
  const upcoming = fixtures
    .filter((fixture) => Number.isFinite(Date.parse(fixture.kickoff || "")) && Date.parse(fixture.kickoff) >= now.getTime() - 3 * 60 * 60 * 1000)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const selected = upcoming[0] || fixtures[0] || knownOpeningFixtures()[0];
  return selected ? opportunityFromFixture(selected, now) : null;
}

export async function discoverMatchdayOpportunity({ keyInfo, date, memory, input = {} }) {
  const fallback = fallbackMatchdayOpportunity(date);
  if (!keyInfo?.apiKey || input.offline) {
    return fallback;
  }
  const prompt = `
Use Google Search grounding to choose the best FIFA World Cup 2026 matchday short-video opportunity for today.

Date: ${date}
Current UTC time: ${new Date().toISOString()}
Audience: US, Europe, and South America football fans.
Channel: World Cup Chaos Desk.

Recent memory to avoid:
${memoryPrompt(memory)}

Rules:
- Prefer actual matches today or in the next 18 hours.
- If a match has not started, choose type "prediction".
- If a match has ended and reliable result/turning points are available, choose type "postmatch".
- Do not choose broad pre-tournament topics during the tournament unless no fixture can be found.
- Avoid repeated home-advantage/legacy/trap-team generic angles unless tied to a specific match.
- Return a specific Team A vs Team B opportunity with kickoff if available.

Return JSON only:
{
  "type": "prediction or postmatch",
  "topic": "specific short topic",
  "teamA": "team name",
  "teamB": "team name",
  "kickoff": "ISO timestamp or human kickoff time",
  "venue": "venue if known",
  "reason": "why this is the strongest matchday video now"
}
`.trim();
  try {
    const result = await requestGeminiJsonWithFallbacks({
      keyInfo,
      primaryModel: SEARCH_MODEL,
      fallbackModels: SEARCH_FALLBACK_MODELS,
      prompt,
      temperature: 0.3,
      search: true,
    });
    const teamA = cleanInputText(result.json?.teamA);
    const teamB = cleanInputText(result.json?.teamB);
    if (!teamA || !teamB) {
      return fallback;
    }
    const type = ["prediction", "postmatch"].includes(cleanText(result.json?.type).toLowerCase()) ? cleanText(result.json.type).toLowerCase() : "prediction";
    return {
      type,
      topic: cleanInputText(result.json?.topic) || `${teamA} vs ${teamB} ${type === "postmatch" ? "post-match analysis" : "prediction"}`,
      teamA,
      teamB,
      kickoff: cleanInputText(result.json?.kickoff),
      venue: cleanInputText(result.json?.venue),
      matchId: slugify(`${date}-${teamA}-${teamB}`, "worldcup-match"),
      reason: cleanInputText(result.json?.reason) || "Search-grounded matchday opportunity.",
    };
  } catch {
    return fallback;
  }
}

export async function discoverPreTournamentTopic({ keyInfo, date, existing, memory, input = {} }) {
  if (!keyInfo?.apiKey || input.offline) {
    return "";
  }
  const fallbackTopics = preTournamentTopics();
  const prompt = `
Use Google Search grounding to choose ONE current FIFA World Cup short-video topic for today.

Date: ${date}
Audience: US, Europe, and South America football fans.
Channel: World Cup Chaos Desk.

Recent memory to avoid:
${memoryPrompt(memory)}

Rules:
- Pick a topic with real current demand, fan debate, recognizable teams/players, and clear visual potential.
- Do NOT pick USMNT home advantage again unless there is genuinely fresh news today that makes it the strongest topic.
- Avoid repeating any hook, joke, or angle in recent memory.
- Prefer a topic that can become a 35-55 second funny but evidence-backed short.
- Make the topic specific enough for search, script, visuals, and comments.

Fallback seeds if search is weak:
${fallbackTopics.map((topic, index) => `${index + 1}. ${topic}`).join("\n")}

Return JSON only:
{
  "topic": "specific current short topic",
  "reason": "why this has viral potential today",
  "avoidReason": "how it avoids recent repetition"
}
`.trim();
  try {
    const result = await requestGeminiJsonWithFallbacks({
      keyInfo,
      primaryModel: SEARCH_MODEL,
      fallbackModels: SEARCH_FALLBACK_MODELS,
      prompt,
      temperature: 0.45,
      search: true,
    });
    const topic = cleanInputText(result.json?.topic);
    if (topic && !/home advantage helps the usmnt/i.test(topic)) {
      return topic;
    }
    if (topic && existing % 4 !== 0) {
      return "";
    }
    return topic;
  } catch {
    return "";
  }
}

export async function countRunsForDate(date) {
  const index = await listWorldCupRuns();
  return (index.runs || []).filter((run) => run.createdAt?.slice(0, 10) === date).length;
}

export function scheduledHours() {
  return String(DEFAULT_SCHEDULE_HOURS)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);
}

export async function runWorldCupSchedulerImpl(input = {}, deps = {}) {
  const date = (cleanInputText(input.date) || todayDate()).slice(0, 10);
  const existing = await countRunsForDate(date);
  const max = Math.max(1, Number(input.limit || MAX_VIDEOS_PER_DAY) || MAX_VIDEOS_PER_DAY);
  const explicit =
    hasMeaningfulWorldCupInput(input.topic) ||
    hasMeaningfulWorldCupInput(input.teamA) ||
    hasMeaningfulWorldCupInput(input.teamB) ||
    hasMeaningfulWorldCupInput(input.matchId);
  const allowedHours = scheduledHours();
  const currentHour = new Date().getUTCHours();
  if (!explicit && !input.force && allowedHours.length && !allowedHours.includes(currentHour)) {
    return {
      skipped: true,
      reason: `Current UTC hour ${currentHour} is outside WORLD_CUP_SCHEDULE_HOURS (${allowedHours.join(", ")}).`,
      scheduleHoursUtc: allowedHours,
    };
  }
  if (existing >= max && !input.force) {
    return {
      skipped: true,
      reason: `Daily limit reached for ${date}.`,
      generatedToday: existing,
      maxVideosPerDay: max,
    };
  }
  const requestedType = cleanText(input.type || input.mode || "").toLowerCase();
  const autoMode = !requestedType || requestedType === "auto";
  let topic = cleanInputText(input.topic);
  let opportunity = null;
  let keyInfo = null;
  let memory = null;
  if (!explicit) {
    keyInfo = await getActiveGeminiKey();
    memory = await loadWorldCupMemory({ limit: 12 });
    if (autoMode || isTournamentWindow(date)) {
      opportunity = await discoverMatchdayOpportunity({ keyInfo, date, memory, input });
    }
    if (opportunity?.teamA && opportunity?.teamB) {
      topic = opportunity.topic;
    } else {
      topic = (await discoverPreTournamentTopic({ keyInfo, date, existing, memory, input })) || preTournamentTopics()[existing % preTournamentTopics().length];
    }
  }
  const runType =
    opportunity?.type ||
    (["prediction", "postmatch", "pre-tournament"].includes(requestedType) ? requestedType : input.teamA && input.teamB ? "prediction" : "pre-tournament");
  const run = await deps.generateWorldCupRun({
    ...input,
    date,
    topic,
    type: runType,
    teamA: opportunity?.teamA || input.teamA,
    teamB: opportunity?.teamB || input.teamB,
    matchId: opportunity?.matchId || input.matchId,
    kickoff: opportunity?.kickoff || input.kickoff,
    venue: opportunity?.venue || input.venue,
    render: normalizeBool(input.render, true),
    upload: normalizeBool(input.upload, false),
  });
  return { skipped: false, run: runSummary(run), maxVideosPerDay: max };
}
