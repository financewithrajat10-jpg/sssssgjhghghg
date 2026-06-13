import { createHash } from "./utils.mjs";
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
  WORLD_CUP_RESEARCH_MODE,
  WORLD_CUP_SCRAPE_MAX_PAGES,
  WORLD_CUP_SCRAPE_SEARCH_RESULTS,
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
import {
  assColor,
  assOverrideColor,
  assTimestamp,
  buildAssFromSrt,
  buildSrt,
  captionAnimationTag,
  captionPresetDesignConfig,
  captionSafeScale,
  captionSegmentPlan,
  designWorldCupCaptions,
  emphasisWordsForCaption,
  emphasizeCaptionText,
  escapeAssPart,
  escapeAssText,
  estimateSrtFromText,
  generateAudioAwareSrt,
  localCaptionDesign,
  normalizeCaptionAnimation,
  normalizeCaptionDesign,
  normalizeCaptionPlacement,
  normalizeFootballCaptionText,
  normalizeTimedCaptionSegments,
  parseSrtSegments,
  parseSrtTimestamp,
  splitCaptionWords,
  splitIntoCaptionLines,
  srtTimestamp,
} from "./captions.mjs";

export async function fetchText(url) {
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "WorldCupChaosDesk/1.0 (+content analysis; no text republication)",
      Accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.text();
}

export function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function localCommentaryExtractor(text, sourceUrl = "") {
  const lines = String(text || "")
    .replace(/\r/g, "\n")
    .split(/\n|(?=\b\d{1,3}(?:\+\d+)?['’])/)
    .map(cleanText)
    .filter(Boolean);
  const events = [];
  for (const line of lines) {
    const match = line.match(/\b(\d{1,3})(?:\+(\d+))?['’]?\s*[-:.)]?\s*(.{12,220})/);
    if (match) {
      const minute = match[2] ? `${match[1]}+${match[2]}` : match[1];
      events.push({
        minute,
        event: cleanText(match[3]).slice(0, 180),
        player: "",
        team: "",
        impact: "possible match event extracted from commentary text",
        sourceUrl,
        confidence: 0.45,
      });
    }
  }
  return events.slice(0, 18);
}

export async function extractCommentaryEvents({ keyInfo, text, url, offline, warnings }) {
  let commentary = String(text || "");
  if (!commentary && url) {
    try {
      commentary = stripHtml(await fetchText(url)).slice(0, 18000);
    } catch (error) {
      warnings.push(`Commentary fetch failed: ${error.message}`);
    }
  }
  if (!commentary) {
    return [];
  }
  if (!keyInfo?.apiKey || offline) {
    return localCommentaryExtractor(commentary, url);
  }
  const prompt = `
Extract structured football events from the commentary text.
Do not copy the commentary wording. Transform it into compact facts only.

Return JSON:
{
  "events": [
    {"minute":"12", "event":"shot saved", "player":"", "team":"", "impact":"why it mattered", "sourceUrl":"${url || ""}", "confidence":0.0}
  ]
}

Commentary:
${commentary.slice(0, 16000)}
`.trim();
  try {
    const result = await requestGeminiJson({ keyInfo, model: WRITER_MODEL, prompt, temperature: 0.2 });
    return (Array.isArray(result.json?.events) ? result.json.events : [])
      .map((event) => ({
        minute: cleanText(event.minute),
        event: cleanText(event.event),
        player: cleanText(event.player),
        team: cleanText(event.team),
        impact: cleanText(event.impact),
        sourceUrl: cleanText(event.sourceUrl || url),
        confidence: Math.max(0, Math.min(1, Number(event.confidence || 0.6))),
      }))
      .filter((event) => event.event)
      .slice(0, 20);
  } catch (error) {
    warnings.push(`Commentary extraction used local fallback: ${error.message}`);
    return localCommentaryExtractor(commentary, url);
  }
}

export function fallbackEvidence(options, commentaryEvents = []) {
  const matchLine =
    options.match.teamA && options.match.teamB
      ? `${options.match.teamA} vs ${options.match.teamB}`
      : options.topic;
  return {
    match: options.match,
    topic: options.topic,
    videoType: options.type,
    channelIdentity: "World Cup Chaos Desk",
    audience: options.audience,
    recentForm: [],
    keyPlayers: [],
    tacticalMatchup: [
      {
        claim: `${matchLine} should be framed around pressure, transitions, and fan expectations unless stronger data is available.`,
        support: "Local fallback evidence because live search/data provider was unavailable.",
        sourceUrl: "",
        confidence: 0.35,
      },
    ],
    injuriesSuspensions: [],
    oddsFavoriteContext: "",
    turningPoints: commentaryEvents,
    sourcedClaims: [],
    evidenceQuality: {
      sourceCount: 0,
      reliabilityScore: 0.25,
      needsReview: true,
      notes: ["Live fixture/search data was not available; use opinion-only framing and avoid hard stats."],
    },
    contentAngles: [],
    hookBank: [],
    visualBrief: {
      style: "stock football atmosphere, tactical cards, fan reaction cutaways, safe fallback graphics",
      teamVisualQueries: [],
      playerVisualNeeds: [],
    },
    uncertaintyNotes: ["Live fixture/search data was not available for this draft. Review facts before posting."],
  };
}


export function clampScore(value, min = 0, max = 10) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function firstSentence(text) {
  return cleanText(text).split(/(?<=[.!?])\s+/)[0] || cleanText(text);
}

export function hasViralContradiction(text) {
  return /\b(everyone thinks|people think|but|actually|blueprint|should terrify|wake-up call|loss wasn'?t|trap|danger|wrong|break|pressure|real opponent|not .* it'?s|isn'?t ready|not ready|unprepared|instead|nobody|risk|hot take|contrarian)\b/i.test(cleanText(text));
}

export function hasMemorableFootballLine(text) {
  return /\b(group chat|comment section|panic button|football court|football jail|receipts|cooked|career mode|aura|fraud watch|chaos|rent is due|trap game|pressure cooker|spreadsheet|restart button|playing the noise|crowd a trap|home advantage is cute)\b/i.test(cleanText(text));
}

export const FOOTBALL_JOKE_LINES = [
  "Home advantage is cute until your own fans start sounding like the comment section.",
  "The crowd is an extra man until it opens the group chat.",
  "This is career mode with no restart button.",
  "The panic button is already warm.",
  "Football logic walked in with a spreadsheet and left with a headache.",
  "The group chat is about to become a courtroom.",
  "That first bad touch can turn hope into audit mode.",
  "The vibes are wearing boots, but the receipts are holding the whistle.",
];

export function footballJokeLine(seed = "") {
  const hash = createHash("sha256").update(cleanText(seed) || "world-cup").digest();
  return FOOTBALL_JOKE_LINES[hash[0] % FOOTBALL_JOKE_LINES.length];
}

export function firstThreeSecondHook(text) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  return words.slice(0, 16).join(" ");
}

export function scoreFirstThreeSecondHook(text, evidence = {}) {
  const hook = firstThreeSecondHook(text);
  const evidenceText = cleanText(`${evidence.topic || ""} ${evidence.match?.teamA || ""} ${evidence.match?.teamB || ""} ${JSON.stringify(evidence.keyPlayers || [])}`);
  const combined = `${hook} ${evidenceText}`;
  const hasSpecificTarget = /\b(usmnt|usa|united states|mexico|brazil|argentina|france|spain|england|germany|portugal|messi|ronaldo|mbappe|pulisic|neymar)\b/i.test(combined);
  const hasEvidenceTarget =
    Boolean(cleanText(`${evidence.match?.teamA || ""} ${evidence.match?.teamB || ""}`)) ||
    (Array.isArray(evidence.keyPlayers) && evidence.keyPlayers.some((player) => cleanText(player?.name || player)));
  const genericWorldCupTarget = /\bworld cup\b/i.test(hook) && !hasEvidenceTarget;
  const concrete = hasSpecificTarget || genericWorldCupTarget;
  const stakes = /\b(pressure|trap|danger|break|wrong|panic|end|risk|host|home|chaos|favorite|upset|crowd|warning|red flag|blueprint|exploit|holes|loss|signs|isn'?t ready|not ready|unprepared|fragile|belongs?)\b/i.test(hook);
  const curiosity = /\b(but|actually|why|nobody|real|blueprint|warning|wake-up|one stat|one thing|not|isn'?t|aren'?t|can'?t|won'?t|instead|hot take|contrarian)\b/i.test(hook);
  const shortEnough = hook.length <= 125;
  const questionOpener = /^(is|are|can|could|do|does|did|will|would|should|what|why|how)\b/i.test(hook);
  const score = (concrete ? 28 : 10) + (stakes ? 28 : 8) + (curiosity ? 28 : 8) + (shortEnough ? 16 : 6);
  const hardFails = [];
  if (!concrete) hardFails.push("First three seconds do not name a recognizable team/player/topic.");
  if (!stakes) hardFails.push("First three seconds do not create pressure, danger, or debate.");
  if (!curiosity) hardFails.push("First three seconds lack a curiosity gap or contradiction.");
  if (!shortEnough) hardFails.push("First three seconds are too wordy.");
  if (questionOpener) hardFails.push("First three seconds open with a soft question instead of a direct claim.");
  return {
    hook,
    score: Math.max(0, Math.min(100, score - (questionOpener ? 18 : 0))),
    decision: hardFails.length ? "revise" : "pass",
    hardFails,
  };
}

export function topicNamesForViral(evidence, options) {
  const teams = [evidence?.match?.teamA || options?.match?.teamA, evidence?.match?.teamB || options?.match?.teamB].map(cleanText).filter(Boolean);
  const keyPlayer = (Array.isArray(evidence?.keyPlayers) ? evidence.keyPlayers : []).map((player) => cleanText(player.name)).find(Boolean);
  return {
    teams,
    keyPlayer,
    topic: cleanText(evidence?.topic || options?.topic || "this World Cup story"),
    label: teams.length === 2 ? `${teams[0]} vs ${teams[1]}` : cleanText(evidence?.topic || options?.topic || "this World Cup story"),
  };
}

export function localViralTopicScore({ evidence, options, memory }) {
  const names = topicNamesForViral(evidence, options);
  const sourceCount = Number(evidence?.evidenceQuality?.sourceCount || 0);
  const trustedClaims = trustedSourceClaims(evidence);
  const text = `${names.topic} ${names.label} ${JSON.stringify(evidence?.contentAngles || [])} ${JSON.stringify(evidence?.hookBank || [])}`;
  const alreadyRepeated = (memory?.recentTopics || []).some((topic) => slugify(topic) === slugify(names.topic));
  const hasTeamOrPlayer = names.teams.length >= 1 || Boolean(names.keyPlayer) || /messi|ronaldo|mbappe|neymar|pulisic|argentina|brazil|france|spain|england|mexico|usa|usmnt/i.test(text);
  const emotional = /pressure|legacy|last dance|host|rival|revenge|fear|hope|pain|trap|upset|chaos|fan|ticket|home/i.test(text);
  const debate = /wrong|trap|danger|fraud|aura|hot take|controversy|favorite|underdog|overrated|pressure/i.test(text);
  const visual = hasTeamOrPlayer ? 8 : /stadium|fans|crowd|tactic|flag|coach|keeper|midfield/i.test(text) ? 7 : 5;
  const uniqueness = alreadyRepeated ? 3 : hasViralContradiction(text) ? 8 : 6;
  const dimensions = {
    recency: options?.type === "prediction" || options?.type === "postmatch" || sourceCount >= 2 ? 8 : 6,
    fanDivide: debate ? 8 : 5,
    recognizableNames: hasTeamOrPlayer ? 8 : 4,
    emotionalStakes: emotional ? 8 : 5,
    visualAvailability: visual,
    evidenceQuality: sourceCount >= 3 ? 8 : sourceCount >= 1 ? 6 : 3,
    uniqueness,
    commentPotential: debate || emotional ? 8 : 5,
  };
  const total = Math.round(
    dimensions.recency * 1.2 +
      dimensions.fanDivide * 1.35 +
      dimensions.recognizableNames * 1.1 +
      dimensions.emotionalStakes * 1.35 +
      dimensions.visualAvailability +
      dimensions.evidenceQuality +
      dimensions.uniqueness * 1.1 +
      dimensions.commentPotential * 1.4,
  );
  const normalizedTotal = Math.max(0, Math.min(100, total));
  return {
    total: normalizedTotal,
    dimensions,
    decision: normalizedTotal >= 82 ? "publish_candidate" : normalizedTotal >= 65 ? "revise" : "discard",
    reasons: [
      sourceCount < 2 ? "Evidence is weak, so hard claims must be opinion-safe." : "Evidence is usable for a sourced take.",
      alreadyRepeated ? "Recent memory shows this topic has been repeated." : "Topic is not an exact repeat of recent memory.",
      hasViralContradiction(text) ? "Topic has a clear contradiction/pressure angle." : "Topic needs a sharper contradiction before scripting.",
    ],
  };
}

export function localViralHookLab({ evidence, options, topicScore }) {
  const names = topicNamesForViral(evidence, options);
  const label = names.label || "this World Cup story";
  const isUsa = /usa|usmnt|united states/i.test(`${label} ${names.topic}`);
  const opponent = names.teams.find((team) => !/usa|usmnt|united states/i.test(team)) || "the opponent";
  const pressureTarget = isUsa ? "the USMNT" : label;
  const topicText = cleanText(`${label} ${names.topic}`).toLowerCase();
  const topicContradiction = /legacy|last dance|one more/i.test(topicText)
    ? `Everyone wants the fairy-tale World Cup ending. I think the bracket might be the villain.`
    : /host nation|host nations|home|host/i.test(topicText) && /pressure/i.test(topicText)
      ? `Everyone talks about host-nation advantage. I think one host is carrying the loudest pressure.`
    : /chaos|upset|trap/i.test(topicText)
      ? `Everyone wants a clean World Cup favorite. I think the chaos team is hiding in plain sight.`
      : /fraud|aura/i.test(topicText)
        ? `Everyone is arguing aura. I think the receipts are about to be much funnier.`
        : /midfield|press/i.test(topicText)
          ? `Everyone watches the stars. I think the midfield panic decides the whole story.`
          : `Everyone thinks ${label} is about the obvious favorite. I think the real danger is pressure.`;
  const contradiction = isUsa
    ? `Everyone thinks home advantage helps ${pressureTarget}. I think it might break them.`
    : topicContradiction;
  const hooks = isUsa
    ? [
        `Everyone thinks home advantage helps the USMNT. I think it might break them.`,
        `The USMNT's biggest World Cup danger might not be ${opponent}. It might be playing at home.`,
        `This is the trap nobody wants to admit about the USMNT.`,
        `Home advantage sounds nice until 70,000 people become the panic button.`,
        `I am going contrarian on the USMNT. The crowd might be the real opponent.`,
      ]
    : [
        contradiction,
        `Everyone thinks ${label} is simple. That is exactly why it feels dangerous.`,
        `The obvious World Cup pick is usually where football sets the trap.`,
        `This matchup has group-chat chaos written all over it.`,
        `The favorite has the better names. The underdog might have the better problem.`,
        `Football logic says one thing. World Cup chaos says check the pressure first.`,
      ];
  return {
    version: "viral2",
    source: "local",
    topicScore,
    oneSentenceContradiction: contradiction,
    hooks,
    titleIdeas: isUsa ? ["HOME ADVANTAGE TRAP", "USMNT PANIC BUTTON", "THE REAL OPPONENT"] : ["TRAP GAME ALERT", "WORLD CUP CHAOS PICK", "THE FAVORITE PROBLEM"],
    coverText: isUsa ? "HOME ADVANTAGE TRAP" : "TRAP GAME ALERT",
    captionInstructions: {
      style: "creator-yellow-pop",
      animation: "slide-lift",
      emphasisWords: ["TRAP", "BREAK", "PANIC", "PRESSURE", "WRONG", "DANGER", "CHAOS", "OPPONENT"],
      firstFrameRule: "First caption must be a complete contradiction, readable with sound off in one second.",
    },
    visualStyle: {
      summary:
        "Start with a real team/player/flag proof beat when license-safe, then alternate crowd pressure, tactical cards, close action, and joke overlays. Avoid generic training clips back-to-back.",
      pacing: "Change visual every 2.5 to 5 seconds. Use a graphic interruption on the joke line.",
      beatSearchQueries: isUsa
        ? ["United States soccer fans stadium", "USMNT flag supporters", "soccer crowd pressure", "football tactical board panic"]
        : ["soccer fans pressure stadium", "world cup football crowd", "football tactical board vertical", "soccer match tension"],
    },
    editPlan: [
      "0-1.5s: contradiction hook with large cover text",
      "1.5-5s: why this matters right now",
      "5-15s: one receipt or pressure clue",
      "15-28s: escalation plus memorable football joke",
      "28-40s: clear opinion and comment trigger",
    ],
    publishGate: {
      publishAt: 82,
      reviseAt: 65,
      hardFails: ["no complete contradiction in first sentence", "no evidence for hard stat", "no memorable line", "audio too quiet", "generic repeated clips"],
    },
  };
}

export function normalizeViralStrategy(raw, fallback) {
  const topicScore = raw?.topicScore?.total ? raw.topicScore : fallback.topicScore;
  const hooks = Array.isArray(raw?.hooks) ? raw.hooks.map(cleanText).filter(Boolean).slice(0, 10) : fallback.hooks;
  const titleIdeas = Array.isArray(raw?.titleIdeas) ? raw.titleIdeas.map(cleanText).filter(Boolean).slice(0, 8) : fallback.titleIdeas;
  const captionInstructions = raw?.captionInstructions && typeof raw.captionInstructions === "object" ? raw.captionInstructions : fallback.captionInstructions;
  const visualStyle = raw?.visualStyle && typeof raw.visualStyle === "object" ? raw.visualStyle : fallback.visualStyle;
  return {
    ...fallback,
    ...raw,
    version: "viral2",
    topicScore,
    oneSentenceContradiction: cleanText(raw?.oneSentenceContradiction) || fallback.oneSentenceContradiction,
    hooks: hooks.length ? hooks : fallback.hooks,
    titleIdeas: titleIdeas.length ? titleIdeas : fallback.titleIdeas,
    coverText: cleanText(raw?.coverText) || fallback.coverText,
    captionInstructions,
    visualStyle,
    editPlan: Array.isArray(raw?.editPlan) ? raw.editPlan.map(cleanText).filter(Boolean).slice(0, 8) : fallback.editPlan,
    publishGate: raw?.publishGate || fallback.publishGate,
  };
}

export async function buildViral2Strategy({ evidence, options, keyInfo, memory, warnings }) {
  const topicScore = localViralTopicScore({ evidence, options, memory });
  const fallback = localViralHookLab({ evidence, options, topicScore });
  if (!keyInfo?.apiKey || options.offline) {
    return fallback;
  }
  const prompt = `
You are the viral programming editor for "World Cup Chaos Desk".
Build a Shorts-native pre-writing strategy. Be harsher than the script writer.

Audience: ${options.audience}
Video type: ${options.type}
Topic: ${options.topic}
Match: ${options.match.teamA && options.match.teamB ? `${options.match.teamA} vs ${options.match.teamB}` : "topic-based"}

Evidence:
${JSON.stringify(evidence, null, 2)}

Recent memory:
${memoryPrompt(memory)}

Rules:
- Score the topic before scripting. Viral potential comes from recency, fan divide, recognizable teams/players, emotional stakes, visual availability, evidence quality, uniqueness, and comment potential.
- Create hooks that work in the first 1 second with sound off.
- Every hook must be a complete claim or contradiction, not a setup fragment.
- Avoid generic preview language.
- Caption instructions should name emphasis words and first-frame cover text.
- Visual style must explain which beats need real team/player/flag proof, which need stock clips, and which need graphics.

Return JSON:
{
  "topicScore": {
    "total": 0,
    "dimensions": {
      "recency": 0,
      "fanDivide": 0,
      "recognizableNames": 0,
      "emotionalStakes": 0,
      "visualAvailability": 0,
      "evidenceQuality": 0,
      "uniqueness": 0,
      "commentPotential": 0
    },
    "decision": "publish_candidate | revise | discard",
    "reasons": [""]
  },
  "oneSentenceContradiction": "",
  "hooks": [""],
  "titleIdeas": [""],
  "coverText": "",
  "captionInstructions": {
    "style": "creator-yellow-pop",
    "animation": "slide-lift",
    "emphasisWords": [""],
    "firstFrameRule": ""
  },
  "visualStyle": {
    "summary": "",
    "pacing": "",
    "beatSearchQueries": [""]
  },
  "editPlan": [""],
  "publishGate": {
    "publishAt": 82,
    "reviseAt": 65,
    "hardFails": [""]
  }
}
`.trim();
  try {
    const result = await requestGeminiJson({ keyInfo, model: EVALUATOR_MODEL, prompt, temperature: 0.35 });
    return normalizeViralStrategy(result.json || {}, fallback);
  } catch (error) {
    warnings.push(`Viral 2.0 strategy fallback used: ${error.message}`);
    return fallback;
  }
}

export function hasHardStat(text) {
  return /\b\d+(?:\.\d+)?\s*(?:%|percent|ppg|points per game|xg|goals?|shots?|saves?|ranked|ranking|hours?|days?)\b/i.test(cleanText(text));
}

export function trustedSourceClaims(evidence) {
  return (Array.isArray(evidence?.sourcedClaims) ? evidence.sourcedClaims : []).filter(
    (claim) => cleanText(claim.claim) && cleanText(claim.sourceUrl) && Number(claim.confidence || 0) >= 0.6,
  );
}

export function normalizeEvidencePack({ options, commentaryEvents, rawEvidence = {}, sources = [], researchNotes = [] }) {
  const fallback = fallbackEvidence(options, commentaryEvents);
  const sourceUrls = new Set(sources.map((source) => cleanText(source.uri || source.sourceUrl)).filter(Boolean));
  const sourceCount = sourceUrls.size;
  const sourcedClaims = (Array.isArray(rawEvidence.sourcedClaims) ? rawEvidence.sourcedClaims : [])
    .map((claim) => ({
      claim: cleanText(claim.claim),
      sourceUrl: cleanText(claim.sourceUrl),
      confidence: Math.max(0, Math.min(1, Number(claim.confidence || 0))),
    }))
    .filter((claim) => claim.claim && !/use only verified|return json|if the data is incomplete/i.test(claim.claim))
    .map((claim) => {
      const hasSource = claim.sourceUrl && (sourceUrls.has(claim.sourceUrl) || /^https?:\/\//i.test(claim.sourceUrl));
      if (!hasSource && hasHardStat(claim.claim)) {
        return { ...claim, confidence: Math.min(claim.confidence, 0.35) };
      }
      return claim;
    })
    .filter((claim) => !hasHardStat(claim.claim) || (claim.sourceUrl && claim.confidence >= 0.6));

  const quality = {
    sourceCount,
    reliabilityScore: Math.max(0, Math.min(1, Number(rawEvidence.evidenceQuality?.reliabilityScore || (sourceCount >= 3 ? 0.75 : sourceCount ? 0.55 : 0.25)))),
    needsReview: Boolean(rawEvidence.evidenceQuality?.needsReview) || sourceCount < 2 || !sourcedClaims.length,
    notes: [
      ...(Array.isArray(rawEvidence.evidenceQuality?.notes) ? rawEvidence.evidenceQuality.notes.map(cleanText).filter(Boolean) : []),
      ...(sourceCount < 2 ? ["Not enough grounded sources for hard statistical claims."] : []),
    ],
  };

  return {
    ...fallback,
    ...rawEvidence,
    match: { ...options.match, ...(rawEvidence.match || {}) },
    topic: cleanText(rawEvidence.topic || options.topic),
    videoType: options.type,
    recentForm: Array.isArray(rawEvidence.recentForm) ? rawEvidence.recentForm : [],
    keyPlayers: Array.isArray(rawEvidence.keyPlayers) ? rawEvidence.keyPlayers.slice(0, 6) : [],
    tacticalMatchup: Array.isArray(rawEvidence.tacticalMatchup) ? rawEvidence.tacticalMatchup : fallback.tacticalMatchup,
    injuriesSuspensions: Array.isArray(rawEvidence.injuriesSuspensions) ? rawEvidence.injuriesSuspensions : [],
    turningPoints: [...commentaryEvents, ...(Array.isArray(rawEvidence.turningPoints) ? rawEvidence.turningPoints : [])].slice(0, 24),
    sourcedClaims,
    sources,
    researchNotes: researchNotes.map((note) => ({
      id: note.id,
      query: note.query,
      summary: cleanText(note.text).slice(0, 2400),
      model: note.model,
    })),
    evidenceQuality: quality,
    contentAngles: Array.isArray(rawEvidence.contentAngles) ? rawEvidence.contentAngles.map(cleanText).filter(Boolean).slice(0, 8) : [],
    hookBank: Array.isArray(rawEvidence.hookBank) ? rawEvidence.hookBank.map(cleanText).filter(Boolean).slice(0, 12) : [],
    visualBrief: rawEvidence.visualBrief || fallback.visualBrief,
    uncertaintyNotes: [
      ...(Array.isArray(rawEvidence.uncertaintyNotes) ? rawEvidence.uncertaintyNotes.map(cleanText).filter(Boolean) : []),
      ...(quality.needsReview ? ["This evidence pack needs human review before publishing hard claims."] : []),
    ],
  };
}

export function worldCupResearchPasses(options, memory) {
  const matchDescription =
    options.match.teamA && options.match.teamB
      ? `${options.match.teamA} vs ${options.match.teamB} ${options.match.competition} ${options.match.date}`
      : options.topic;
  const teams = [options.match.teamA, options.match.teamB].filter(Boolean).join(" ");
  const usaLens = /usa|usmnt|united states|america|yanks/i.test(`${matchDescription} ${teams}`)
    ? "Include USMNT/United States soccer context, likely key player names, fan pressure, and safe visual ideas."
    : "";
  const baseRules = `
Return concise research notes, not final script.
Separate verified facts, opinion angles, fan debate, and uncertainty.
Do not invent numbers. If a stat is found, include the source URL/title.
${usaLens}
${memoryPrompt(memory)}
`.trim();
  return [
    {
      id: "current_context",
      query: `${matchDescription} latest context World Cup 2026 form squad pressure`,
      prompt: `${baseRules}\nSearch for current public context and likely fan debate for: ${matchDescription}.`,
    },
    {
      id: "data_receipts",
      query: `${matchDescription} stats form rankings injuries tactical analysis World Cup 2026`,
      prompt: `${baseRules}\nSearch for reliable data points, form context, injury/suspension uncertainty, and tactical receipts for: ${matchDescription}.`,
    },
    {
      id: "viral_angles",
      query: `${matchDescription} fan reactions hot takes controversy prediction World Cup`,
      prompt: `${baseRules}\nSearch for creator-friendly hooks, fan arguments, controversy, and comment-triggering angles around: ${matchDescription}.`,
    },
    {
      id: "visual_assets",
      query: `${matchDescription} key players team visuals Wikimedia Commons football stock footage`,
      prompt: `${baseRules}\nSearch for key players, teams, visual needs, and safe visual fallback ideas for: ${matchDescription}.`,
    },
    {
      id: "contrarian_pick",
      query: `${matchDescription} contrarian prediction upset risk pressure tactical weakness`,
      prompt: `${baseRules}\nSearch for a contrarian but defensible football argument for: ${matchDescription}.`,
    },
  ].slice(0, WORLD_CUP_RESEARCH_PASSES);
}

export function decodeBasicHtmlEntities(text = "") {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCharCode(value) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const value = Number.parseInt(code, 16);
      return Number.isFinite(value) ? String.fromCharCode(value) : "";
    });
}

export function compactScrapedText(text = "") {
  return repairCommonMojibake(
    decodeBasicHtmlEntities(stripHtml(text))
      .replace(/\b(cookie|privacy policy|subscribe|newsletter|sign in|advertisement|sponsored|all rights reserved)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function extractTagValue(text = "", tagName = "") {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  return decodeBasicHtmlEntities(text.match(pattern)?.[1] || "");
}

export async function fetchGoogleNewsRssItems(query, warnings = []) {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const xml = await fetchText(rssUrl);
    return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
      .map((match) => {
        const item = match[1];
        const title = compactScrapedText(extractTagValue(item, "title"));
        const link = cleanText(extractTagValue(item, "link"));
        const description = compactScrapedText(extractTagValue(item, "description")).slice(0, 700);
        const sourceTitle = compactScrapedText(extractTagValue(item, "source"));
        const publishedAt = cleanText(extractTagValue(item, "pubDate"));
        return {
          title,
          uri: link,
          sourceUrl: link,
          sourceTitle: sourceTitle || "Google News RSS",
          publishedAt,
          snippet: description,
          provider: "google-news-rss",
        };
      })
      .filter((item) => item.title && item.uri)
      .slice(0, WORLD_CUP_SCRAPE_SEARCH_RESULTS);
  } catch (error) {
    warnings.push(`Google News RSS scrape failed for "${query}": ${error.message}`);
    return [];
  }
}

export function normalizeDuckDuckGoUrl(href = "") {
  const decoded = decodeBasicHtmlEntities(href);
  try {
    const url = new URL(decoded, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return url.href;
  } catch {
    return "";
  }
}

export async function fetchDuckDuckGoItems(query, warnings = []) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const html = await fetchText(url);
    return [...html.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => ({
        title: compactScrapedText(match[2]),
        uri: normalizeDuckDuckGoUrl(match[1]),
        provider: "duckduckgo-html",
      }))
      .filter((item) => item.title && /^https?:\/\//i.test(item.uri))
      .slice(0, WORLD_CUP_SCRAPE_SEARCH_RESULTS);
  } catch (error) {
    warnings.push(`DuckDuckGo scrape failed for "${query}": ${error.message}`);
    return [];
  }
}

export function sourceHost(source = {}) {
  try {
    return new URL(source.uri || source.sourceUrl || "").hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function scrapedPageTitle(html = "", fallback = "") {
  const title = compactScrapedText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  return title || cleanText(fallback);
}

export async function fetchScrapedArticle(source, warnings = []) {
  const uri = cleanText(source.uri || source.sourceUrl);
  const rssSnippet = cleanText(source.snippet);
  if (!/^https?:\/\//i.test(uri)) {
    return rssSnippet ? { ...source, text: rssSnippet, title: cleanText(source.title) } : null;
  }
  try {
    const html = await fetchText(uri);
    const text = compactScrapedText(html).slice(0, 4200);
    if (text.length < 160 && rssSnippet) {
      return { ...source, text: rssSnippet, title: cleanText(source.title) };
    }
    return {
      ...source,
      title: scrapedPageTitle(html, source.title),
      text,
      host: sourceHost(source),
    };
  } catch (error) {
    if (rssSnippet) {
      return { ...source, text: rssSnippet, title: cleanText(source.title), fetchWarning: error.message };
    }
    warnings.push(`Article scrape failed for "${uri}": ${error.message}`);
    return null;
  }
}

export async function scrapeResearchPass(pass, warnings = []) {
  const searchItems = [
    ...(await fetchGoogleNewsRssItems(pass.query, warnings)),
    ...(await fetchDuckDuckGoItems(pass.query, warnings)),
  ];
  const uniqueSources = [];
  const seen = new Set();
  for (const item of searchItems) {
    const uri = cleanText(item.uri || item.sourceUrl);
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    uniqueSources.push(item);
  }
  const articles = [];
  for (const source of uniqueSources.slice(0, WORLD_CUP_SCRAPE_MAX_PAGES)) {
    const article = await fetchScrapedArticle(source, warnings);
    if (article?.text) articles.push(article);
  }
  const noteText = articles
    .map((article, index) =>
      [
        `Source ${index + 1}: ${cleanText(article.title || article.sourceTitle || "Untitled source")}`,
        `URL: ${cleanText(article.uri || article.sourceUrl)}`,
        `Provider: ${cleanText(article.provider || "web-scrape")}`,
        article.fetchWarning ? `Fetch note: ${article.fetchWarning}` : "",
        `Raw scraped excerpt: ${cleanText(article.text).slice(0, 3000)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
  return {
    ...pass,
    text: noteText,
    model: "web-scrape",
    sources: articles.map((article) => ({
      title: cleanText(article.title || article.sourceTitle || "Source"),
      uri: cleanText(article.uri || article.sourceUrl),
      provider: cleanText(article.provider || "web-scrape"),
      host: cleanText(article.host || sourceHost(article)),
    })),
  };
}

export async function collectScrapedResearchNotes({ options, memory, warnings }) {
  const researchNotes = [];
  const sourceMap = new Map();
  for (const pass of worldCupResearchPasses(options, memory)) {
    const note = await scrapeResearchPass(pass, warnings);
    if (cleanText(note.text).length < 160) {
      warnings.push(`Scrape pass "${pass.id}" returned thin data.`);
      continue;
    }
    researchNotes.push(note);
    for (const source of note.sources || []) {
      const uri = cleanText(source.uri || source.sourceUrl);
      if (uri && !sourceMap.has(uri)) sourceMap.set(uri, source);
    }
  }
  return { researchNotes, sources: [...sourceMap.values()].slice(0, 24) };
}

export async function consolidateWorldCupEvidence({ options, keyInfo, commentaryEvents, researchNotes, sources, memory, warnings }) {
  const sourceList = sources.map((source, index) => `${index + 1}. ${source.title || "Source"} - ${source.uri || source.sourceUrl}`).join("\n");
  const researchText = researchNotes.map((note) => `## ${note.id}: ${note.query}\n${note.text}`).join("\n\n").slice(0, 26000);
  const prompt = `
You are the evidence editor for "World Cup Chaos Desk".
Convert scraped public web research notes into a strict evidence pack for a short video.

Video:
- Type: ${options.type}
- Topic: ${options.topic}
- Match: ${options.match.teamA && options.match.teamB ? `${options.match.teamA} vs ${options.match.teamB}` : "topic-based pre-tournament video"}
- Audience: ${options.audience}

Available source URLs:
${sourceList || "No scraped source URLs were returned."}

Research notes:
${researchText || "No scraped research notes were returned."}

Commentary-derived internal events:
${JSON.stringify(commentaryEvents, null, 2)}

Memory:
${memoryPrompt(memory)}

Rules:
- Output JSON only.
- Every hard number, injury, ranking, quote, or recent-form claim must include a sourceUrl from the available source URLs.
- If there are fewer than two useful sources, set evidenceQuality.needsReview=true and avoid hard statistical claims.
- Treat scraped excerpts as raw material only: do not copy article phrasing into scripts or claims.
- Do not include instructions as claims.
- If exact data is weak, create opinion-safe angles instead of fake-specific stats.
- Include creator angles that can start arguments in comments without becoming misinformation.
- Include visualBrief.teamVisualQueries. For USA/USMNT topics, include queries for safe US soccer fan/team atmosphere visuals and key player/card needs.

Return JSON:
{
  "match": {},
  "topic": "",
  "videoType": "prediction | postmatch | pre-tournament",
  "recentForm": [{"claim":"", "support":"", "sourceUrl":"", "confidence":0.0}],
  "keyPlayers": [{"name":"", "team":"", "whyImportant":"", "safeVisualHint":"Wikimedia/player-card fallback ok", "sourceUrl":"", "confidence":0.0}],
  "tacticalMatchup": [{"claim":"", "support":"", "sourceUrl":"", "confidence":0.0}],
  "injuriesSuspensions": [{"claim":"", "sourceUrl":"", "confidence":0.0}],
  "oddsFavoriteContext": "",
  "turningPoints": [],
  "sourcedClaims": [{"claim":"", "sourceUrl":"", "confidence":0.0}],
  "contentAngles": ["urgent/controversial/story/data angle"],
  "hookBank": ["short hook option"],
  "visualBrief": {
    "style": "visual language",
    "teamVisualQueries": ["stock/Wikimedia-safe visual search query"],
    "playerVisualNeeds": ["player name or fallback card need"]
  },
  "evidenceQuality": {"sourceCount": 0, "reliabilityScore": 0.0, "needsReview": true, "notes": [""]},
  "uncertaintyNotes": [""]
}
`.trim();
  try {
    const result = await requestGeminiJson({
      keyInfo,
      model: WRITER_MODEL,
      prompt,
      temperature: 0.25,
    });
    return normalizeEvidencePack({ options, commentaryEvents, rawEvidence: result.json || {}, sources, researchNotes });
  } catch (error) {
    warnings.push(`Evidence consolidation fallback used: ${error.message}`);
    return normalizeEvidencePack({ options, commentaryEvents, rawEvidence: {}, sources, researchNotes });
  }
}

export async function collectWorldCupData(options, keyInfo, warnings) {
  const commentaryEvents = await extractCommentaryEvents({
    keyInfo,
    text: options.commentaryText,
    url: options.commentaryUrl,
    offline: options.offline,
    warnings,
  });
  const memory = await loadWorldCupMemory({ excludeId: options.id, limit: 10 });
  if (!keyInfo?.apiKey || options.offline) {
    return {
      evidence: fallbackEvidence(options, commentaryEvents),
      sources: [],
      commentaryEvents,
      memory,
    };
  }

  const researchMode = cleanText(options.researchMode || WORLD_CUP_RESEARCH_MODE || "scrape").toLowerCase();
  if (!["grounding", "search", "gemini-search"].includes(researchMode)) {
    const { researchNotes, sources } = await collectScrapedResearchNotes({ options, memory, warnings });
    if (!researchNotes.length) {
      warnings.push("Scrape evidence fallback used: all web scrape passes returned thin data.");
      return {
        evidence: normalizeEvidencePack({ options, commentaryEvents, rawEvidence: {}, sources: [], researchNotes: [] }),
        sources: [],
        commentaryEvents,
        memory,
      };
    }
    const evidence = await consolidateWorldCupEvidence({ options, keyInfo, commentaryEvents, researchNotes, sources, memory, warnings });
    evidence.researchModel = `web-scrape -> ${WRITER_MODEL}`;
    evidence.researchMode = "scrape";
    return { evidence, sources, commentaryEvents, memory };
  }

  const researchNotes = [];
  const sourceMap = new Map();
  for (const pass of worldCupResearchPasses(options, memory)) {
    try {
      const result = await requestGeminiTextWithFallbacks({
        keyInfo,
        primaryModel: SEARCH_MODEL,
        fallbackModels: SEARCH_FALLBACK_MODELS,
        prompt: pass.prompt,
        temperature: 0.35,
        search: true,
      });
      researchNotes.push({ ...pass, text: result.text, model: result.model });
      for (const source of result.sources || []) {
        if (source.uri && !sourceMap.has(source.uri)) {
          sourceMap.set(source.uri, source);
        }
      }
    } catch (error) {
      warnings.push(`Search pass "${pass.id}" failed: ${error.message}`);
    }
  }

  const sources = [...sourceMap.values()].slice(0, 16);
  if (!researchNotes.length) {
    warnings.push("Search evidence fallback used: all research passes failed.");
    return {
      evidence: normalizeEvidencePack({ options, commentaryEvents, rawEvidence: {}, sources: [], researchNotes: [] }),
      sources: [],
      commentaryEvents,
      memory,
    };
  }

  const evidence = await consolidateWorldCupEvidence({ options, keyInfo, commentaryEvents, researchNotes, sources, memory, warnings });
  evidence.researchModel = `${SEARCH_MODEL} -> ${WRITER_MODEL}`;
  evidence.researchMode = "grounding";
  return { evidence, sources, commentaryEvents, memory };
}

export function fallbackScripts(evidence, viralStrategy = null) {
  const matchName = evidence.match?.teamA && evidence.match?.teamB ? `${evidence.match.teamA} vs ${evidence.match.teamB}` : evidence.topic;
  const trustedClaims = trustedSourceClaims(evidence);
  const dataPoint =
    trustedClaims[0]?.claim ||
    evidence.tacticalMatchup?.[0]?.claim ||
    "the verified data is still thin, so this is a pressure-read, not a spreadsheet lock";
  if (viralStrategy?.version === "viral2") {
    const contradiction = cleanText(viralStrategy.oneSentenceContradiction) || `Everyone thinks ${matchName} is simple. I think the pressure says otherwise.`;
    const coverText = cleanText(viralStrategy.coverText) || "TRAP GAME ALERT";
    const firstJoke = footballJokeLine(`${matchName}:contrarian`);
    const softJoke = footballJokeLine(`${matchName}:soft`);
    return [
      {
        styleId: "viral2_contrarian_friend",
        title: coverText,
        hookType: "contradiction",
        text: `${contradiction} Because the useful clue is not the bigger badge. It is who plays normal football when the noise gets stupid. ${firstJoke} My pick is the team that can stay boring for five minutes longer. Am I overthinking this, or is pressure the real opponent?`,
        dataPoint,
        opinion: "Pressure can matter more than reputation in the first World Cup beat.",
        joke: firstJoke,
        memorableLine: firstJoke,
        commentTrigger: "Am I overthinking this, or is pressure the real opponent?",
        coverText,
        visualMoments: ["first-frame contradiction", "crowd pressure", "tactical panic card", "comment courtroom gag"],
      },
      {
        styleId: "viral2_funny_fan",
        title: viralStrategy.titleIdeas?.[1] || coverText,
        hookType: "fan_debate",
        text: `${contradiction} The scary part is simple: World Cup games do not forgive main-character football. The crowd is an extra man until it opens the group chat. Then the whole plan turns into career mode with no restart button. So I am not watching the hype. I am watching the first panic touch. Tell me, is this a smart take or am I already in football jail?`,
        dataPoint,
        opinion: "The first signs of panic matter more than the pre-match hype.",
        joke: "career mode with no restart button",
        memorableLine: "The crowd is an extra man until it opens the group chat.",
        commentTrigger: "Is this a smart take or am I already in football jail?",
        coverText,
        visualMoments: ["team proof beat", "career mode gag card", "panic touch close-up", "football jail comment card"],
      },
      {
        styleId: "viral2_soft_analyst",
        title: viralStrategy.titleIdeas?.[2] || coverText,
        hookType: "risk",
        text: `${contradiction} That does not mean they are bad. It means the first ugly spell matters. Crowds can lift you, but they can also make every simple pass feel like a referendum. ${softJoke} If this goes wrong, the opponent may not beat them first. The moment might. Agree or am I too cynical?`,
        dataPoint,
        opinion: "The risk is emotional speed, not talent.",
        joke: "every simple pass feels like a referendum",
        memorableLine: softJoke,
        commentTrigger: "Agree or am I too cynical?",
        coverText,
        visualMoments: ["crowd lift", "simple pass pressure", "noise graphic", "agree/disagree end card"],
      },
    ];
  }
  return [
    {
      styleId: "serious_analyst",
      title: `${matchName}: the serious pick`,
      hookType: "prediction",
      text: `I'm going contrarian on ${matchName}. The clue is this: ${dataPoint}. That makes this less about star names and more about who handles the first bad ten minutes. My lean is the team that turns pressure into chances, not panic. If this ages badly, I will accept the football court hearing in the comments.`,
      dataPoint,
      opinion: "The calmer team under pressure has the edge.",
      joke: "football court hearing in the comments",
      commentTrigger: "Tell me if this pick is cooked or genius.",
    },
    {
      styleId: "funny_fan_analyst",
      title: `${matchName}: chaos watch`,
      hookType: "controversy",
      text: `This has trap-game energy written all over it. On paper, it looks simple. In World Cup language, that means someone is about to make the group chat unbearable. The useful clue: ${dataPoint}. So I am watching the midfield like it owes me money. My pick is the team with less panic in possession. If I am wrong, clip this and send me to football jail.`,
      dataPoint,
      opinion: "This could be closer than the reputation gap suggests.",
      joke: "the group chat becomes unbearable",
      commentTrigger: "Who is going to football jail here?",
    },
    {
      styleId: "dramatic_storyteller",
      title: `${matchName}: pressure story`,
      hookType: "story",
      text: `Every World Cup story has one quiet question: who blinks first? For ${matchName}, the clue is ${dataPoint}. That is why this is not just a preview. It is a pressure test. One mistake, one counterattack, one keeper moment, and the whole story flips. I am leaning toward the side that looks built for ugly minutes. Save this, because football loves receipts.`,
      dataPoint,
      opinion: "The game may be decided by one pressure moment.",
      joke: "football loves receipts",
      commentTrigger: "What is the one moment you think decides it?",
    },
  ];
}

export function sanitizeScriptAgainstEvidence(script, evidence, warnings) {
  const trustedClaims = trustedSourceClaims(evidence);
  const canUseHardStats = trustedClaims.some((claim) => hasHardStat(claim.claim));
  const evidenceWeak = Boolean(evidence?.evidenceQuality?.needsReview) || trustedClaims.length === 0;
  const output = { ...script };
  output.riskNotes = Array.isArray(output.riskNotes) ? output.riskNotes : [];
  if ((evidenceWeak || !canUseHardStats) && hasHardStat(`${output.text} ${output.dataPoint}`)) {
    output.text = cleanText(output.text).replace(
      /[^.?!]*\b\d+(?:\.\d+)?\s*(?:%|percent|ppg|points per game|xg|goals?|shots?|saves?|ranked|ranking)[^.?!]*[.?!]/gi,
      "The verified public data is still thin, so this has to be treated as a pressure read, not a spreadsheet lock.",
    );
    output.dataPoint = trustedClaims[0]?.claim || "No hard stat is safe enough yet; this angle is framed as opinion.";
    output.riskNotes.push("Hard stat removed because evidence did not contain a trusted sourced claim.");
    warnings.push(`Unsupported hard stat removed from ${output.styleId || "script"}.`);
  }
  return output;
}

export function softenWorldCupShortsTone(value) {
  return cleanText(value)
    .replace(/\babsolute failure\b/gi, "full group-chat panic")
    .replace(/\bfailure\b/gi, "pressure moment")
    .replace(/\bdisaster\b/gi, "panic episode")
    .replace(/\btotal meltdown\b/gi, "group-chat trial")
    .replace(/\bmeltdown\b/gi, "panic spiral")
    .replace(/\btotal collapse\b/gi, "group-chat spiral")
    .replace(/\bcollapse\b/gi, "panic spiral")
    .replace(/\bchoke under\b/gi, "feel")
    .replace(/\bchoke\b/gi, "panic")
    .replace(/\bfold under\b/gi, "feel")
    .replace(/\bfold\b/gi, "blink")
    .replace(/\balready lost the mental game\b/gi, "already shown the nerves are real")
    .replace(/\bcrisis\b/gi, "pressure test")
    .replace(/\bperfectly built to exploit\b/gi, "annoyingly built to punish")
    .replace(/\bsuffocating expectation\b/gi, "loud expectation");
}

export function polishScriptForShorts(script, warnings) {
  const output = { ...script };
  let text = cleanText(output.text);
  const original = text;
  text = text.replace(/^i['’]?m going contrarian on\s+/i, "The real trap is ");
  text = text.replace(/^i['’]?m going contrarian[:.]?\s*/i, "");
  text = text.replace(/^hot take[:.]?\s*/i, "");
  text = text.replace(/^here['’]?s why[:.]?\s*/i, "");
  if (text !== original) {
    output.riskNotes = [...(Array.isArray(output.riskNotes) ? output.riskNotes : []), "Meta hook moved out of first sentence for stronger retention."];
    warnings.push(`Shorts hook polish adjusted ${output.styleId || "script"} opening.`);
  }
  const toneBefore = text;
  text = softenWorldCupShortsTone(text);
  for (const field of ["title", "dataPoint", "opinion", "joke", "memorableLine", "commentTrigger", "coverText"]) {
    if (typeof output[field] === "string") {
      output[field] = softenWorldCupShortsTone(output[field]);
    }
  }
  if (text !== toneBefore) {
    output.riskNotes = [...(Array.isArray(output.riskNotes) ? output.riskNotes : []), "Harsh pundit wording softened for creator tone."];
    warnings.push(`Shorts tone polish softened harsh wording in ${output.styleId || "script"}.`);
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 122) {
    const sentenceParts = text.match(/[^.!?]+[.!?]+/g) || [text];
    const trimmed = [];
    let count = 0;
    for (const sentence of sentenceParts) {
      const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
      if (count + sentenceWords > 112) {
        break;
      }
      trimmed.push(sentence.trim());
      count += sentenceWords;
    }
    text = cleanText(trimmed.join(" ") || words.slice(0, 112).join(" "));
    output.riskNotes = [...(Array.isArray(output.riskNotes) ? output.riskNotes : []), "Script shortened to stay in short-form range."];
  }
  output.text = text || original;
  return output;
}

export async function generateScripts(evidence, keyInfo, options, warnings) {
  if (!keyInfo?.apiKey || options.offline) {
    return { scripts: fallbackScripts(evidence, options.viralStrategy), model: "local-fallback" };
  }
  const memory = await loadWorldCupMemory({ excludeId: options.id, limit: 10 });
  const trustedClaims = trustedSourceClaims(evidence);
  const hardStatsAllowed = trustedClaims.some((claim) => hasHardStat(claim.claim));
  const viralMode = isViral2(options);
  const viralStrategy = options.viralStrategy || {};
  const viralRules = viralMode
    ? `
VIRAL 2.0 MODE:
- This run is a comparison against the classic pipeline. Keep the classic pipeline's softer, funnier creator tone, but make the hook and structure cleaner.
- Topic score decision: ${viralStrategy.topicScore?.decision || "unknown"} (${viralStrategy.topicScore?.total ?? "n/a"}/100).
- One-sentence contradiction to preserve or improve: "${viralStrategy.oneSentenceContradiction || "none"}"
- Hook lab. Use one of these or beat them:
${(viralStrategy.hooks || []).map((hook, index) => `  ${index + 1}. ${hook}`).join("\n") || "  none"}
- Cover text ideas: ${(viralStrategy.titleIdeas || []).join(" | ") || viralStrategy.coverText || "none"}
- Edit plan:
${(viralStrategy.editPlan || []).map((step) => `  - ${step}`).join("\n") || "  - fast contradiction, receipt, joke, opinion, comment trigger"}
- The first sentence must be a complete contradiction or hard opinion. It cannot be a sentence fragment.
- The first 12-16 spoken words must include a recognizable team/player/topic, a pressure word, and a curiosity gap. No slow preamble.
- Never open with a soft question like "Is the USMNT ready..." or "Can they handle..." Start with a direct claim.
- Preferred hook shape: "Germany just gave Paraguay the blueprint, and that should terrify the USMNT."
- Include exactly one memorable football-native line that could become a comment quote.
- Include 3 to 5 visual moments as plain phrases.
- Reject yourself if the script could fit any sport after replacing team names.
- Prefer concrete fan language over abstract tactical poetry.
- Prefer playful anxiety over doom. The voice should feel like a smart friend joking through nerves.
- Use Classic-style lines like "panic button", "career mode with no restart button", "group chat courtroom", "souffle during an earthquake", or "football court hearing".
- Creator line lab. Every script MUST contain one fresh line with this level of casual fan truth. Do not repeat a line from recent memory:
  "Home advantage is cute until your own fans start sounding like the comment section."
  You may adapt it to the topic, but it must be short, funny, and instantly quotable.
- Do not use harsh pundit phrases like "national humiliation", "psychological death trap", "sucker's bet", "delusional", "glass cannon", "destined to break", "crushed", "failure", "disaster", "meltdown", "collapse", "choke", "fold", or "crisis".
- End with a debate question that has two natural sides.
`
    : "";
  const prompt = `
You are the head writer for "World Cup Chaos Desk".
Write three distinct English short-video scripts for US, Europe, and South America football audiences.

Channel identity:
- smart football friend with receipts
- fast, funny, fan-native, and data-backed
- soft, playful, conversational, and opinionated without sounding angry
- make viewers feel "wait, this is actually a fun take"
- never generic AI sports narration

Video target:
- Type: ${options.type}
- Duration: 32 to 45 seconds
- Word target: 80 to 115 spoken words. Never exceed 125 words.
- Structure: 0-2s hook, 2-7s funny promise, 7-18s one data/pressure clue, 18-32s fan-story + joke, 32-45s soft punchline/comment trigger
- First sentence must be the actual scroll-stopping claim. Do not begin with "I'm going contrarian", "hot take", "here's why", or a setup phrase.
- Prefer direct hooks like "Home advantage might actually destroy the USMNT" over meta hooks like "I'm going contrarian."
- First 3-second gate: the first 12-16 spoken words must name the target, create pressure/debate, and make viewers ask "why?"
- Do not start with a question. For Shorts, claim first and ask later.
- If the topic is about a recent loss, use the loss as the instant tension: "Germany just gave Paraguay the blueprint..."
- If the chosen topic/title/cover promises a numbered list such as "3 paths", "4 reasons", or "2 scenarios", the spoken script must clearly label and deliver every item. Do not use a list hook unless the list appears in the script.

Required in every script:
- a 1 to 2 second hook from one of these proven patterns:
  Urgency: "In 47 hours, this team's entire World Cup could end. Here's why."
  Mystery: "One stat that nobody's talking about... and it changes EVERYTHING."
  Controversy: "The ref is TERRIFIED of this matchup. Here's why."
  Prediction: "I'm going contrarian. Here's my hot take."
  Story: "This player has been waiting 8 years for this moment."
  Data shock: "This stat will BREAK your prediction."
  Risk: "Vegas got this WRONG. Here's the real play."
- one real evidence-backed data point if trusted evidence exists
- one clear opinion
- one football-native joke or metaphor that sounds like a fan talking, not a writer showing off
- one creator-native quote line in the actual script, similar in quality to:
  "Home advantage is cute until your own fans start sounding like the comment section."
  "The crowd is an extra man until it opens the group chat."
  "This is career mode with no restart button."
  "The panic button is already warm."
  "The group chat is about to become a courtroom."
- one ending that makes comments likely
- a human voice rhythm: short sentences, natural contractions, question beats, and room for pitch changes
- one first-frame cover text idea in the title or hook language, such as "HOME ADVANTAGE TRAP" or "USMNT PANIC MODE"

Avoid:
- generic openings like "The 2026 World Cup is coming"
- starting with "I'm going contrarian" unless it appears after the claim
- angry rant energy
- long tactical lectures
- poetic lines that need too much decoding; keep them sharp and mobile-friendly
- more than one hard stat
- phrases like "absolute failure", "funeral march", "silent killer" unless the style is explicitly dramatic
- harsh doom language like "national humiliation", "death trap", "sucker's bet", "delusional", "glass cannon", "destined to break", "crushed", "failure", "disaster", "meltdown", "collapse", "choke", "fold", or "crisis"
- fake certainty
- copied commentary wording
- bland ESPN preview tone
- random player claims not in evidence
- overused "you won't believe" hooks
- hard numbers unless they appear in sourcedClaims with sourceUrl and confidence >= 0.6
${viralRules}

Evidence quality:
- trusted hard stats allowed: ${hardStatsAllowed ? "yes" : "no"}
- if trusted hard stats allowed is "no", frame the video as opinion, pressure read, fan debate, or scout note.
- if evidenceQuality.needsReview is true, make every factual claim cautious and never invent percentages, rankings, odds, injuries, lineups, or recent form.

Creator memory:
${memoryPrompt(memory)}

Suggested angles and hooks from research:
- Angles: ${(evidence.contentAngles || []).join(" | ") || "none"}
- Hooks: ${(evidence.hookBank || []).join(" | ") || "none"}

Evidence pack:
${JSON.stringify(evidence, null, 2)}

Return JSON:
{
  "scripts": [
    {
      "styleId": "serious_analyst",
      "hookType": "",
      "title": "",
      "text": "",
      "dataPoint": "",
      "opinion": "",
      "joke": "",
      "memorableLine": "the exact creator-native quote line used inside the script",
      "commentTrigger": "",
      "coverText": "",
      "visualMoments": [""],
      "factualClaims": [""],
      "riskNotes": [""]
    },
    {"styleId": "funny_fan_analyst", "...": ""},
    {"styleId": "dramatic_storyteller", "...": ""}
  ]
}
`.trim();
  try {
    const result = await requestGeminiJson({ keyInfo, model: WRITER_MODEL, prompt, temperature: 0.85 });
    const scripts = (Array.isArray(result.json?.scripts) ? result.json.scripts : [])
      .map((script) => ({
        styleId: cleanText(script.styleId),
        hookType: cleanText(script.hookType),
        title: cleanText(script.title),
        text: cleanText(script.text),
        dataPoint: cleanText(script.dataPoint),
        opinion: cleanText(script.opinion),
        joke: cleanText(script.joke),
        memorableLine: cleanText(script.memorableLine),
        commentTrigger: cleanText(script.commentTrigger),
        coverText: cleanText(script.coverText),
        visualMoments: Array.isArray(script.visualMoments) ? script.visualMoments.map(cleanText).filter(Boolean).slice(0, 6) : [],
        factualClaims: Array.isArray(script.factualClaims) ? script.factualClaims.map(cleanText).filter(Boolean) : [],
        riskNotes: Array.isArray(script.riskNotes) ? script.riskNotes.map(cleanText).filter(Boolean) : [],
      }))
      .map((script) => sanitizeScriptAgainstEvidence(script, evidence, warnings))
      .map((script) => polishScriptForShorts(script, warnings))
      .filter((script) => script.text);
    if (scripts.length < 3) {
      warnings.push("Writer returned fewer than three scripts, local fallbacks were added.");
      return { scripts: [...scripts, ...fallbackScripts(evidence, options.viralStrategy)].slice(0, 3), model: WRITER_MODEL };
    }
    return { scripts, model: WRITER_MODEL };
  } catch (error) {
    warnings.push(`Script writer fallback used: ${error.message}`);
    return { scripts: fallbackScripts(evidence, options.viralStrategy), model: "local-fallback" };
  }
}

export function heuristicScriptScore(script) {
  const text = script.text || "";
  const words = text.split(/\s+/).filter(Boolean);
  const hasJoke = /court|jail|rent|panic|group chat|comment section|receipts|chaos|aura|cooked|oops|hype|almost|spreadsheet|laptop|ferrari|roundabout|restart button|headache|audit mode|whistle/i.test(text);
  const hasQuestion = /\?/.test(text) || /comments|tell me|who|what/i.test(text);
  const notTooLong = words.length >= 75 && words.length <= 120;
  const tooHeavy = /absolute failure|funeral march|silent killer|crumble|melt|disaster|meltdown|crisis|collapse|choke|fold/i.test(text);
  return {
    factualSupport: script.dataPoint ? 7 : 5,
    hookStrength: words.slice(0, 14).join(" ").length < 95 ? 8 : 6,
    humorAuthenticity: hasJoke && !tooHeavy ? 9 : hasJoke ? 7 : 5,
    shareability: hasJoke && hasQuestion && !tooHeavy ? 9 : hasJoke && hasQuestion ? 7 : 6,
    retentionPotential: notTooLong ? 8 : 6,
    commentPotential: hasQuestion ? 8 : 5,
    ttsNaturalness: words.length <= 120 && !tooHeavy ? 9 : words.length <= 145 ? 7 : 5,
    risk: 8,
  };
}

export function totalJudgeScore(scores) {
  return Object.values(scores || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function scoreViral2Script(script, evidence, viralStrategy = {}) {
  const text = cleanText(script?.text || "");
  const words = text.split(/\s+/).filter(Boolean);
  const opening = firstSentence(text);
  const firstThree = scoreFirstThreeSecondHook(text, evidence);
  const promiseContract = evaluateScriptPromiseContract(script, evidence, viralStrategy);
  const hasQuestion = /\?/.test(text) || /\b(comment|tell me|agree|overthinking|cynical|verdict)\b/i.test(text);
  const evidenceWeak = Boolean(evidence?.evidenceQuality?.needsReview) || trustedSourceClaims(evidence).length === 0;
  const unsupportedHardStat = hasHardStat(`${text} ${script?.dataPoint || ""}`) && !trustedSourceClaims(evidence).some((claim) => hasHardStat(claim.claim));
  const generic =
    /\b(the 2026 world cup is coming|this match will be interesting|anything can happen|both teams will try|football is unpredictable|at the end of the day)\b/i.test(text) ||
    !/\b(world cup|usmnt|usa|mexico|brazil|argentina|france|spain|england|paraguay|home|host|pressure|favorite|underdog|crowd|group)\b/i.test(text);
  const harshPunditTone = /\b(national humiliation|psychological death trap|death trap|sucker'?s bet|delusional|glass cannon|destined to break|crushed|failure|disaster|meltdown|crisis|collapse|choke|fold|crack under|shatter)\b/i.test(text);
  const dimensions = {
    hook: hasViralContradiction(opening) && opening.length <= 115 ? 18 : hasViralContradiction(opening) ? 14 : 7,
    clarity: words.length >= 65 && words.length <= 118 ? 12 : words.length <= 130 ? 9 : 5,
    personality: hasMemorableFootballLine(`${text} ${script?.memorableLine || ""}`) ? 15 : /panic|trap|chaos|pressure|comment|court|jail|career mode|group chat|restart button/i.test(text) ? 10 : 4,
    retention: /\b(because|the scary part|the clue|that means|suddenly|so i)\b/i.test(text) ? 12 : 7,
    comment: hasQuestion ? 13 : 5,
    evidence: unsupportedHardStat ? 0 : evidenceWeak ? 7 : 12,
    visual: Array.isArray(script?.visualMoments) && script.visualMoments.length >= 3 ? 10 : /\b(crowd|fans|tactical|board|panic|flag|player|pressure)\b/i.test(text) ? 7 : 3,
    tts: /[,;:]{2,}|.{180,}/.test(text) ? 5 : 8,
  };
  let total = Object.values(dimensions).reduce((sum, score) => sum + score, 0);
  const hardFails = [];
  if (firstThree.decision !== "pass") {
    hardFails.push(...firstThree.hardFails);
  }
  if (!hasViralContradiction(opening)) {
    hardFails.push("First sentence is not a complete contradiction or hard opinion.");
  }
  if (unsupportedHardStat) {
    hardFails.push("Hard stat appears without a trusted sourced claim.");
  }
  if (!hasMemorableFootballLine(`${text} ${script?.memorableLine || ""}`)) {
    hardFails.push("No memorable football-native line.");
  }
  if (generic) {
    hardFails.push("Script still sounds generic after removing team names.");
  }
  if (harshPunditTone) {
    hardFails.push("Tone is too harsh/pundit-like; use softer funny football-friend language.");
  }
  if (promiseContract && !promiseContract.pass) {
    hardFails.push(promiseContract.reason);
  }
  if (!hasQuestion) {
    hardFails.push("Ending does not trigger a natural comment debate.");
  }
  total = Math.max(0, Math.min(100, total - hardFails.length * 5));
  const publishAt = Number(viralStrategy?.publishGate?.publishAt || 82);
  const reviseAt = Number(viralStrategy?.publishGate?.reviseAt || 65);
  return {
    total,
    dimensions,
    decision: hardFails.length ? (total >= reviseAt ? "revise" : "discard") : total >= publishAt ? "publish_candidate" : total >= reviseAt ? "revise" : "discard",
    hardFails,
    promiseContract,
    opening,
    firstThreeSeconds: firstThree,
    checkedAt: nowIso(),
  };
}

export function hardenedOpeningForEvidence(evidence = {}, viralStrategy = {}) {
  const text = cleanText(`${evidence.topic || ""} ${evidence.match?.teamA || ""} ${evidence.match?.teamB || ""}`).toLowerCase();
  if (/usmnt|usa|united states/.test(text) && /germany/.test(text) && /paraguay/.test(text)) {
    return "Germany just gave Paraguay the blueprint, and that should terrify the USMNT.";
  }
  if (/usmnt|usa|united states/.test(text) && /home|host|pressure/.test(text)) {
    return "Home advantage might be the USMNT's biggest trap, not their biggest weapon.";
  }
  if (/legacy|last dance|one more/.test(text)) {
    return "The World Cup fairy tale everyone wants might have the ugliest bracket problem.";
  }
  if (/host nation|host nations|home|host/.test(text) && /pressure/.test(text)) {
    return "The World Cup host with the loudest crowd might also have the heaviest problem.";
  }
  if (/fraud|aura/.test(text)) {
    return "World Cup aura debates are fun until the receipts start acting rude.";
  }
  if (/chaos|upset|trap/.test(text)) {
    return "The World Cup chaos team nobody wants is probably hiding in plain sight.";
  }
  if (/midfield|press|pressure/.test(text)) {
    return "Everyone watches the World Cup stars, but the midfield panic usually writes the ending.";
  }
  const strategyHook = (Array.isArray(viralStrategy?.hooks) ? viralStrategy.hooks : []).find((hook) => {
    const scored = scoreFirstThreeSecondHook(hook, evidence);
    return scored.decision === "pass" && !/^(is|are|can|could|do|does|did|will|would|should|what|why|how)\b/i.test(cleanText(hook));
  });
  return strategyHook || "The World Cup take everyone likes is hiding the part fans will argue about.";
}

export function hardenViralOpening(script, evidence = {}, viralStrategy = {}, warnings = []) {
  const quality = scoreViral2Script(script, evidence, viralStrategy);
  if (quality.decision === "publish_candidate") {
    return { script, quality, changed: false };
  }
  const text = cleanText(script?.text || "");
  if (!text) {
    return { script, quality, changed: false };
  }
  const opening = hardenedOpeningForEvidence(evidence, viralStrategy);
  const rest = cleanText(text.replace(firstSentence(text), ""));
  const hardened = {
    ...script,
    text: cleanText(`${opening} ${rest}`),
    riskNotes: [...(Array.isArray(script.riskNotes) ? script.riskNotes : []), "Opening hardened locally after Viral 2.0 hook gate."],
  };
  const hardenedQuality = scoreViral2Script(hardened, evidence, viralStrategy);
  if (hardenedQuality.total >= quality.total || quality.hardFails.length) {
    warnings.push("Viral 2.0 local hook hardener replaced the opening before TTS.");
    return { script: hardened, quality: hardenedQuality, changed: true };
  }
  return { script, quality, changed: false };
}

export function numberWordToInt(value) {
  const text = cleanText(String(value || "")).toLowerCase();
  const map = { two: 2, three: 3, four: 4, five: 5 };
  return map[text] || Number(text) || 0;
}

export function normalizePromiseText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectScriptPromiseContract(script = {}, evidence = {}, viralStrategy = {}) {
  const candidates = [
    evidence?.topic,
    script?.title,
    script?.coverText,
    viralStrategy?.coverText,
    viralStrategy?.oneSentenceContradiction,
    evidence?.match?.label,
    script?.hookType,
  ].map(cleanText).filter(Boolean);
  let fallback = null;
  for (const source of candidates) {
    const match = source.match(/\b(2|3|4|5|two|three|four|five)\s+(?:exact\s+|real\s+|big\s+|major\s+)?(paths?|scenarios?|routes?|traps?|reasons?|ways?|things?|questions?|factors?|moments?|teams?|players?)\b/i);
    if (!match) {
      continue;
    }
    const count = numberWordToInt(match[1]);
    if (!count || count < 2 || count > 5) {
      continue;
    }
    const contract = {
      count,
      noun: cleanText(match[2]).toLowerCase(),
      source,
      explicitItems: extractExplicitPromiseItems(source, count),
    };
    if (contract.explicitItems.length >= Math.min(count, 2)) {
      return contract;
    }
    fallback ||= contract;
  }
  return fallback;
}

export function extractExplicitPromiseItems(source, count) {
  const cleaned = cleanText(source);
  const colonIndex = cleaned.indexOf(":");
  const afterColon = colonIndex >= 0 ? cleaned.slice(colonIndex + 1) : "";
  if (!afterColon) {
    return [];
  }
  const pieces = afterColon
    .split(/\s*,\s*|\s*;\s*|\s+\bor\b\s+/i)
    .map((item) => cleanText(item.replace(/^(and|or)\s+/i, "")))
    .filter((item) => item.split(/\s+/).filter(Boolean).length >= 2)
    .slice(0, count);
  return pieces.length >= 2 ? pieces : [];
}

export function promiseItemMatchesText(item, text) {
  const normalizedItem = normalizePromiseText(item);
  const normalizedText = normalizePromiseText(text);
  if (!normalizedItem || !normalizedText) {
    return false;
  }
  if (normalizedText.includes(normalizedItem)) {
    return true;
  }
  const tokens = normalizedItem
    .split(" ")
    .filter((token) => token.length >= 3 && !/^(the|and|or|with|from|this|that|while|other|world|cup|exact|path|paths|scenario|scenarios)$/.test(token));
  if (!tokens.length) {
    return false;
  }
  const matched = tokens.filter((token) => normalizedText.includes(token)).length;
  return matched >= Math.min(tokens.length, Math.max(2, Math.ceil(tokens.length * 0.7)));
}

export function evaluateScriptPromiseContract(script = {}, evidence = {}, viralStrategy = {}) {
  const contract = detectScriptPromiseContract(script, evidence, viralStrategy);
  if (!contract) {
    return null;
  }
  const text = cleanText(script?.text || "");
  const ordinalHits = [
    /\b(path|scenario|route|reason|way|thing|factor|moment)\s+one\b/i,
    /\b(path|scenario|route|reason|way|thing|factor|moment)\s+two\b/i,
    /\b(path|scenario|route|reason|way|thing|factor|moment)\s+three\b/i,
    /\b(first|second|third|fourth|fifth)\b/i,
    /\b1[).:]|\b2[).:]|\b3[).:]/,
  ].filter((pattern) => pattern.test(text)).length;
  const matchedItems = contract.explicitItems.filter((item) => promiseItemMatchesText(item, text));
  const explicitPass = contract.explicitItems.length >= contract.count
    ? matchedItems.length >= contract.count
    : true;
  const listSignalPass = ordinalHits >= Math.min(contract.count, 3) || matchedItems.length >= Math.min(contract.count, 2);
  const pass = explicitPass && listSignalPass;
  return {
    ...contract,
    pass,
    matchedItems,
    reason: pass
      ? ""
      : `Script promises ${contract.count} ${contract.noun} but does not clearly deliver each one.`,
  };
}

export function scriptPromiseSubject(evidence = {}, contract = {}) {
  const source = cleanText(evidence?.topic || contract.source || "this World Cup story");
  const beforeColon = cleanText(source.split(":")[0] || source);
  return beforeColon
    .replace(/\b(2|3|4|5|two|three|four|five)\s+(?:exact\s+|real\s+|big\s+|major\s+)?/i, "")
    .replace(/^the\s+/i, "")
    .trim() || "this World Cup story";
}

export function labelPromiseItem(item, index, noun) {
  const labels = ["one", "two", "three", "four", "five"];
  const singular = cleanText(noun || "path").replace(/s$/i, "") || "path";
  return `${singular[0].toUpperCase()}${singular.slice(1)} ${labels[index] || index + 1}: ${cleanText(item)}`;
}

export function promiseRepairOpening(subject, contract) {
  const combined = normalizePromiseText(`${subject} ${contract?.source || ""} ${(contract?.explicitItems || []).join(" ")}`);
  const countWord = contract?.count === 2 ? "two" : contract?.count === 3 ? "three" : String(contract?.count || "");
  const noun = cleanText(contract?.noun || "traps");
  if (/\busmnt\b|\busa\b|united states/.test(combined) && /paraguay|home|opener/.test(combined)) {
    return "Home advantage might be the USMNT's biggest trap, not their biggest weapon.";
  }
  if (/messi/.test(combined) && /ronaldo/.test(combined)) {
    return "The Messi-Ronaldo World Cup dream has three traps, and one slip changes the movie.";
  }
  return `The obvious ${subject} story is hiding ${countWord} ${noun}, and the safe take is not the fun one.`;
}

export function repairScriptPromiseContract(script = {}, evidence = {}, viralStrategy = {}, warnings = []) {
  const contract = evaluateScriptPromiseContract(script, evidence, viralStrategy);
  if (!contract || contract.pass) {
    return { script, contract, changed: false };
  }
  const items = contract.explicitItems.length >= contract.count
    ? contract.explicitItems.slice(0, contract.count)
    : Array.from({ length: contract.count }, (_, index) => `the ${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} pressure point`);
  const subject = scriptPromiseSubject(evidence, contract);
  const itemLines = items.map((item, index) => labelPromiseItem(item, index, contract.noun));
  const countWord = contract.count === 2 ? "two" : contract.count === 3 ? "three" : String(contract.count);
  const repairJoke = footballJokeLine(`${subject}:${contract.noun}:${items.join("|")}`);
  const text = cleanText([
    promiseRepairOpening(subject, contract),
    `Here are ${countWord} ${contract.noun}: ${itemLines.join(". ")}.`,
    contract.count === 3 && /messi|ronaldo/i.test(`${subject} ${items.join(" ")}`)
      ? "That is not nostalgia, it is bracket chaos with feelings."
      : "That is why this is not just a prediction, it is pressure math with feelings.",
    repairJoke,
    "Which timeline are you betting on?",
  ].join(" "));
  const repaired = polishScriptForShorts({
    ...script,
    title: cleanText(script.title || subject),
    text,
    dataPoint: cleanText(script.dataPoint || "The story depends on bracket path and pressure, not a guaranteed result."),
    opinion: cleanText(script.opinion || "The funniest outcome is not always the most likely one, but it is the one fans will argue about."),
    joke: repairJoke,
    memorableLine: repairJoke,
    commentTrigger: "Which timeline are you betting on?",
    coverText: cleanText(script.coverText || `${contract.count} ${contract.noun.toUpperCase()}`),
    visualMoments: [
      `${subject} split-screen`,
      `${contract.count} ${contract.noun} bracket board`,
      "fan reaction panic cutaway",
      "comment debate ending",
    ],
    factualClaims: Array.isArray(script.factualClaims) ? script.factualClaims : [],
    riskNotes: [
      ...(Array.isArray(script.riskNotes) ? script.riskNotes : []),
      "Script promise repaired locally so a numbered hook pays off every item.",
    ],
    revisedBy: script.revisedBy ? `${script.revisedBy}+promise_contract` : "promise_contract",
  }, warnings);
  const repairedContract = evaluateScriptPromiseContract(repaired, evidence, viralStrategy);
  warnings.push("Script promise contract hardener rewrote the selected script before TTS.");
  return { script: repaired, contract: repairedContract, changed: true };
}

export async function reviseViral2Script({ script, evidence, viralStrategy, keyInfo, warnings, qualityIssues = [], forbiddenPhrases = [], retryAttempt = 1 }) {
  if (!keyInfo?.apiKey) {
    return null;
  }
  const failureText = Array.isArray(qualityIssues) && qualityIssues.length
    ? `\nAdditional V2 publish-gate failure reasons from attempt ${retryAttempt}:\n${qualityIssues.map((issue) => `- ${cleanText(issue)}`).join("\n")}\n`
    : "";
  const forbiddenText = Array.isArray(forbiddenPhrases) && forbiddenPhrases.length
    ? `\nFreshness bans for this revision:\n${forbiddenPhrases.map((phrase) => `- Do not use or lightly paraphrase: "${cleanText(phrase)}"`).join("\n")}\n`
    : "";
  const prompt = `
You are the brutal Shorts editor for "World Cup Chaos Desk".
The script below failed Viral 2.0 / V2 publish quality gates. Rewrite it once.

Keep:
- Same topic and safe evidence.
- 75-115 spoken words.
- One complete first-sentence contradiction.
- First 12-16 words must pass the first-3-second gate: recognizable target + pressure/debate + curiosity gap.
- Never open with a question. Rewrite any "Is/Are/Can/Will..." opener into a direct claim.
- One memorable football-native line.
- One clear opinion.
- One debate-ending question.
- No unsupported hard stats.
- If the topic, title, or cover promises a numbered list such as "3 paths", "4 reasons", or "2 scenarios", the script must explicitly deliver every item using clear labels like "Path one", "Path two", and "Path three". Do not promise three items and spend the whole script on one branch.
- Keep the tone soft, funny, and nervous, not angry or doom-heavy.
- Avoid: national humiliation, psychological death trap, sucker's bet, delusional, glass cannon, destined to break, crushed, failure, disaster, meltdown, collapse, choke, fold, crisis.
- Prefer fresh topic-specific equivalents of: panic button, group chat courtroom, football court hearing, souffle during an earthquake. Do not repeat the exact same creator line across videos.
- The rewritten script MUST include one quotable creator line in this style:
  "Home advantage is cute until your own fans start sounding like the comment section."
  "The crowd is an extra man until it opens the group chat."
  "The panic button is already warm."
  "The group chat is about to become a courtroom."
${failureText}
${forbiddenText}

Use this hook lab if useful:
${JSON.stringify(viralStrategy, null, 2)}

Evidence:
${JSON.stringify(evidence, null, 2)}

Failed script:
${JSON.stringify(script, null, 2)}

Return JSON:
{
  "title": "",
  "text": "",
  "dataPoint": "",
  "opinion": "",
  "joke": "",
  "memorableLine": "",
  "commentTrigger": "",
  "coverText": "",
  "visualMoments": [""],
  "revisionNotes": [""]
}
`.trim();
  try {
    const result = await requestGeminiJson({ keyInfo, model: WRITER_MODEL, prompt, temperature: 0.72 });
    return {
      ...script,
      title: cleanText(result.json.title || script.title),
      text: cleanText(result.json.text || script.text),
      dataPoint: cleanText(result.json.dataPoint || script.dataPoint),
      opinion: cleanText(result.json.opinion || script.opinion),
      joke: cleanText(result.json.joke || script.joke),
      memorableLine: cleanText(result.json.memorableLine || script.memorableLine),
      commentTrigger: cleanText(result.json.commentTrigger || script.commentTrigger),
      coverText: cleanText(result.json.coverText || script.coverText),
      visualMoments: Array.isArray(result.json.visualMoments) ? result.json.visualMoments.map(cleanText).filter(Boolean).slice(0, 6) : script.visualMoments || [],
      revisionNotes: Array.isArray(result.json.revisionNotes) ? result.json.revisionNotes.map(cleanText).filter(Boolean) : [],
      revisedBy: "viral2_gate",
    };
  } catch (error) {
    warnings.push(`Viral 2.0 revision skipped: ${error.message}`);
    return null;
  }
}

export async function judgeScripts({ scripts, evidence, keyInfo, options, warnings }) {
  if (!keyInfo?.apiKey || options.offline) {
    const judged = scripts.map((script) => ({ ...script, scores: heuristicScriptScore(script) }));
    judged.sort((a, b) => totalJudgeScore(b.scores) - totalJudgeScore(a.scores));
    return {
      selected: judged[0],
      candidates: judged,
      model: "local-heuristic",
      revisionUsed: false,
      notes: ["Local heuristic judge used because live evaluator was unavailable."],
    };
  }
  const prompt = `
You are a strict short-form football editor.
Judge these three World Cup scripts for factual support, hook strength, humor authenticity, shareability, retention, comment potential, TTS naturalness, and copyright/unsupported-claim risk.
Penalize any hard number, ranking, injury, odds, or recent-form claim that is not clearly supported by evidence.sourcedClaims with a sourceUrl.
Reward scripts that use urgent, mysterious, controversial, contrarian, story, data-shock, or risk hooks without becoming clickbait misinformation.
Strongly prefer scripts that feel like a funny, soft, natural football creator, not a TV analyst.
Prefer 80-115 spoken words. Penalize scripts over 125 words unless they are exceptional.
Penalize heavy negative phrases like "absolute failure", "funeral march", "silent killer", "crumble", "disaster", "meltdown", "collapse", "choke", "fold", or "crisis" when a softer funny version could work.
Reward pitch-friendly writing: short sentences, playful questions, pauses before punchlines, and one memorable joke.
Strongly penalize scripts that do not contain one quotable creator/fan line like:
- "Home advantage is cute until your own fans start sounding like the comment section."
- "The crowd is an extra man until it opens the group chat."
- "The panic button is already warm."
- "The group chat is about to become a courtroom."

Evidence:
${JSON.stringify(evidence, null, 2)}

Scripts:
${JSON.stringify(scripts, null, 2)}

Return JSON:
{
  "ranked": [
    {
      "styleId": "",
      "totalScore": 0,
      "scores": {
        "factualSupport": 0,
        "hookStrength": 0,
        "humorAuthenticity": 0,
        "shareability": 0,
        "retentionPotential": 0,
        "commentPotential": 0,
        "ttsNaturalness": 0,
        "risk": 0
      },
      "notes": [""],
      "needsRevision": false
    }
  ],
  "winnerStyleId": "",
  "globalNotes": [""]
}
`.trim();
  try {
    const result = await requestGeminiJson({ keyInfo, model: EVALUATOR_MODEL, prompt, temperature: 0.25 });
    const ranked = Array.isArray(result.json?.ranked) ? result.json.ranked : [];
    const candidates = scripts.map((script) => {
      const score = ranked.find((item) => item.styleId === script.styleId) || {};
      return {
        ...script,
        totalScore: Number(score.totalScore || totalJudgeScore(score.scores) || totalJudgeScore(heuristicScriptScore(script))),
        scores: score.scores || heuristicScriptScore(script),
        judgeNotes: Array.isArray(score.notes) ? score.notes.map(cleanText).filter(Boolean) : [],
        needsRevision: Boolean(score.needsRevision),
      };
    });
    candidates.sort((a, b) => (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0));
    let selected = candidates.find((script) => script.styleId === result.json?.winnerStyleId) || candidates[0];
    let revisionUsed = false;
    if ((selected?.needsRevision || Number(selected?.totalScore || 0) < 48) && keyInfo?.apiKey) {
      const revised = await reviseWeakScript({ script: selected, evidence, keyInfo, warnings });
      if (revised?.text) {
        selected = { ...selected, ...revised, revisedFrom: selected.styleId };
        revisionUsed = true;
      }
    }
    return {
      selected,
      candidates,
      model: EVALUATOR_MODEL,
      revisionUsed,
      notes: Array.isArray(result.json?.globalNotes) ? result.json.globalNotes.map(cleanText).filter(Boolean) : [],
    };
  } catch (error) {
    warnings.push(`Script judge fallback used: ${error.message}`);
    const judged = scripts.map((script) => ({ ...script, scores: heuristicScriptScore(script) }));
    judged.sort((a, b) => totalJudgeScore(b.scores) - totalJudgeScore(a.scores));
    return { selected: judged[0], candidates: judged, model: "local-heuristic", revisionUsed: false, notes: [] };
  }
}

export async function reviseWeakScript({ script, evidence, keyInfo, warnings }) {
  const prompt = `
Revise this World Cup short script once.
Keep it factual, fan-native, funny, and easy for TTS.
Do not add unsupported facts.
Use a sharper comment-driving hook. Avoid generic openings.
If evidence is weak, remove hard stats and frame the argument as opinion or pressure-read.
Keep or add one quotable creator-native line in the actual script, like:
- "Home advantage is cute until your own fans start sounding like the comment section."
- "The crowd is an extra man until it opens the group chat."
- "The panic button is already warm."
- "The group chat is about to become a courtroom."

Evidence:
${JSON.stringify(evidence, null, 2)}

Weak script:
${JSON.stringify(script, null, 2)}

Return JSON:
{"title":"", "text":"", "dataPoint":"", "opinion":"", "joke":"", "memorableLine":"", "commentTrigger":"", "revisionNotes":[""]}
`.trim();
  try {
    const result = await requestGeminiJson({ keyInfo, model: WRITER_MODEL, prompt, temperature: 0.75 });
    return result.json;
  } catch (error) {
    warnings.push(`Revision pass skipped: ${error.message}`);
    return null;
  }
}

export function fallbackTtsRewrite(selectedScript) {
  const style = selectedScript.styleId || "";
  const words = cleanText(selectedScript.text).split(/\s+/).filter(Boolean);
  const shortened =
    words.length > 118
      ? `${words.slice(0, 105).join(" ")}... ${cleanText(selectedScript.commentTrigger || "Are you buying this take, or am I overthinking it?")}`
      : cleanText(selectedScript.text);
  const voice =
    style.includes("funny") || /jail|group chat|chaos|cooked|hype|almost|laptop|spreadsheet/i.test(selectedScript.text)
      ? "Orus"
      : style.includes("dramatic")
        ? "Sulafat"
        : "Orus";
  const mood =
    style.includes("funny") || voice === "Orus"
      ? "soft, humorous, curious football friend with natural pitch changes"
      : style.includes("dramatic")
        ? "cinematic but grounded"
        : "warm conversational analyst";
  return {
    screenplay: `[Hook | curious, quick, slight smile]\n${shortened}\n\n[Outro | warmer, playful question]\nDrop your verdict in the comments.`,
    voice,
    mood,
    model: "local-fallback",
    reasoning: "Voice selected from script style using local fallback rules.",
    tags: ["Hook", "Outro", mood],
  };
}

export async function rewriteForTts({ selectedScript, evidence, keyInfo, options, warnings }) {
  if (!keyInfo?.apiKey || options.offline) {
    return fallbackTtsRewrite(selectedScript);
  }
  const viralTtsRules = isViral2(options)
    ? `
Viral 2.0 audio rules:
- The voice should sound like a soft, funny football creator talking to a friend, not a commentator.
- First line: quick, bright, confident.
- Proof beat: slightly lower and slower.
- Punchline/memorable line: playful lift, tiny smile.
- Ending question: pitch up naturally, like you genuinely want comments.
- Avoid whisper starts. Avoid slow cinematic suspense for football explainers.
- Keep tags visible but light, because the user may edit them.
`
    : "";
  const prompt = `
Rewrite the winning World Cup script into a Gemini TTS-ready screenplay.

Rules:
- Keep the same facts and opinion. Do not add unsupported claims.
- Keep it natural for short-form audio. No overdramatic whisper starts. No news-anchor delivery.
- Make the audio feel like a funny football creator talking softly but with excitement.
- Keep the first spoken line as the actual claim/hook. Do not prepend "I'm going contrarian" or a slow setup.
- Vary energy: quick first claim, slightly slower proof beat, playful lift on the joke, warmer pitch-up on the ending question.
- Use performance tags that guide pitch, speed, emotion, and pauses:
  [Hook | curious, quick, slight smile]
  [Beat | slower, lower pitch]
  [Joke | faster, playful lift]
  [Pause | 0.35s]
  [Question | warmer, pitch up]
- Use 4 to 7 tags total. Do not tag every sentence.
- Shorten if needed to 80-115 spoken words. Never exceed 125 spoken words.
- Preserve football-fan humor and comment trigger.
- Preserve the selectedScript.memorableLine exactly or near-exactly. Do not sanitize it into analyst language.
- Select one Gemini voice from: ${WORLD_CUP_VOICES.join(", ")}.
- Voice logic:
  default World Cup voice: Orus
  serious but human: Orus, Kore
  funny soft creator: Orus, Puck only if very playful
  chaos pick: Puck, Laomedeia, Fenrir
  dramatic legacy story: Sulafat, Algieba
  post-match analysis: Orus, Kore, Sadaltager
- Prefer Orus unless the script clearly needs a different voice.
- Avoid choosing Kore for softer humorous scripts because it can sound too stiff.
- Avoid choosing Puck when the tone should be credible and not cartoonish.
${viralTtsRules}

Winning script:
${JSON.stringify(selectedScript, null, 2)}

Evidence:
${JSON.stringify(evidence, null, 2)}

Return JSON:
{
  "screenplay": "",
  "voice": "",
  "mood": "",
  "reasoning": "",
  "tags": [""]
}
`.trim();
  try {
    const result = await requestGeminiJson({ keyInfo, model: TTS_REWRITE_MODEL, prompt, temperature: 0.65 });
    const fallback = fallbackTtsRewrite(selectedScript);
    let screenplay = cleanText(result.json.screenplay).replace(/\\n/g, "\n") || fallback.screenplay;
    const spokenWords = stripTagsForSpeech(screenplay).split(/\s+/).filter(Boolean);
    if (spokenWords.length > 130) {
      screenplay = fallback.screenplay;
      warnings.push("TTS rewrite was too long, shortened to fallback performance script.");
    }
    const requestedVoice = WORLD_CUP_VOICES.includes(result.json.voice) ? result.json.voice : fallback.voice;
    const selectedVoice = /funny|soft|playful|curious|hype|contrarian/i.test(`${selectedScript.styleId} ${selectedScript.text} ${result.json.mood}`) && requestedVoice === "Kore" ? "Orus" : requestedVoice;
    return {
      screenplay,
      voice: selectedVoice,
      mood: cleanText(result.json.mood) || fallback.mood,
      reasoning: cleanText(result.json.reasoning),
      tags: Array.isArray(result.json.tags) ? result.json.tags.map(cleanText).filter(Boolean) : [],
      model: TTS_REWRITE_MODEL,
    };
  } catch (error) {
    warnings.push(`TTS rewrite fallback used: ${error.message}`);
    return fallbackTtsRewrite(selectedScript);
  }
}
