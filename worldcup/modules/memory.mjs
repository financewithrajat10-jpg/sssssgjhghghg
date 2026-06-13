import { fs, path } from "./utils.mjs";
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

export async function loadWorldCupMemory({ excludeId = "", limit = 10 } = {}) {
  await ensureWorldCupDirs();
  const files = await fs.readdir(runsRoot).catch(() => []);
  const runFiles = files.filter((file) => file.endsWith(".json") && file !== "index.json");
  const runs = [];
  for (const file of runFiles) {
    try {
      const run = JSON.parse(await fs.readFile(path.join(runsRoot, file), "utf8"));
      if (run?.id && run.id !== excludeId) {
        runs.push(run);
      }
    } catch {
      // Old or partial runs should not break generation memory.
    }
  }
  runs.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const recentRuns = runs.slice(0, limit);
  const visualAssetIds = [];
  const memorableLines = [];
  for (const run of recentRuns) {
    const memorable = cleanText(run.selectedScript?.memorableLine || run.selectedScript?.joke || "");
    if (memorable) {
      memorableLines.push(memorable);
    }
    for (const segment of run.visualPlan?.segments || []) {
      const id = segment.selectedClip?.id || segment.selectedImage?.id || "";
      if (id) {
        visualAssetIds.push(id);
      }
    }
  }
  return {
    recentTopics: recentRuns.map((run) => cleanText(run.topic)).filter(Boolean),
    recentHooks: recentRuns
      .map((run) => cleanText(run.selectedScript?.text || run.tts?.screenplay || "").split(/[.!?]/)[0])
      .filter(Boolean)
      .slice(0, limit),
    recentAngles: recentRuns
      .map((run) => cleanText(run.selectedScript?.title || run.selectedScript?.opinion || ""))
      .filter(Boolean)
      .slice(0, limit),
    recentMemorableLines: [...new Set(memorableLines)].slice(0, limit),
    visualAssetIds: [...new Set(visualAssetIds)].slice(0, 80),
  };
}

export function memoryPrompt(memory) {
  if (!memory?.recentTopics?.length && !memory?.recentHooks?.length && !memory?.recentMemorableLines?.length) {
    return "No previous World Cup run memory available.";
  }
  return `
Recent World Cup pipeline memory:
- Avoid repeating topics: ${memory.recentTopics.slice(0, 8).join(" | ") || "none"}
- Avoid repeating hooks: ${memory.recentHooks.slice(0, 8).join(" | ") || "none"}
- Avoid repeating angles: ${memory.recentAngles.slice(0, 8).join(" | ") || "none"}
- Avoid repeating joke/quote lines: ${(memory.recentMemorableLines || []).slice(0, 8).join(" | ") || "none"}
`.trim();
}


export async function createRunSkeleton(options) {
  await ensureWorldCupDirs();
  const runDir = path.join(runsRoot, options.id);
  await fs.mkdir(runDir, { recursive: true });
  const createdAt = nowIso();
  return {
    id: options.id,
    type: options.type,
    strategy: options.strategy,
    qualityMode: options.qualityMode || "",
    strictPublish: Boolean(options.strictPublish),
    status: "drafting",
    createdAt,
    updatedAt: createdAt,
    topic: options.topic,
    match: options.match,
    language: options.language,
    evidence: {},
    viralStrategy: {},
    captionPlan: {},
    postRenderQuality: {},
    scripts: [],
    selectedScript: {},
    tts: {},
    audio: {},
    bgm: {},
    srt: {},
    visualPlan: {},
    rightsManifest: {},
    review: {},
    qualityV2: {},
    retryLog: {},
    r2: { mp4Key: "", publicUrl: "" },
    drive: { folderId: "", folderUrl: "", uploaded: [] },
    telegram: { uploadedAt: "", messages: [] },
    sources: [],
    attributions: [],
    warnings: [],
    files: {},
  };
}

export async function writeRunFile(run, fileName, data, encoding = null) {
  const runDir = path.join(runsRoot, run.id);
  await fs.mkdir(runDir, { recursive: true });
  const filePath = path.join(runDir, fileName);
  await fs.writeFile(filePath, data, encoding || undefined);
  return fileName;
}

export async function saveRun(run) {
  run.updatedAt = nowIso();
  await ensureWorldCupDirs();
  await fs.writeFile(path.join(runsRoot, `${run.id}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  await rebuildWorldCupIndex();
  return run;
}

export function combinedViralDecision(run) {
  if (run.strategy !== "viral2") {
    return "";
  }
  const decisions = [
    run.viralStrategy?.topicScore?.decision,
    run.selectedScript?.viralQuality?.decision,
    run.postRenderQuality?.decision,
  ].filter(Boolean);
  if (!decisions.length) {
    return "";
  }
  if (decisions.includes("discard")) {
    return "discard";
  }
  if (decisions.includes("revise") || run.review?.status === "needs_review") {
    return "revise";
  }
  return "publish_candidate";
}

export function runSummary(run) {
  return {
    id: run.id,
    type: run.type,
    strategy: run.strategy || "classic",
    status: run.status,
    topic: run.topic,
    match: run.match,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    scriptPreview: cleanText(run.selectedScript?.text || run.tts?.screenplay || "").slice(0, 280),
    selectedStyle: run.selectedScript?.styleId || "",
    viralScore: run.selectedScript?.viralQuality?.total || run.viralStrategy?.topicScore?.total || 0,
    viralTopicScore: run.viralStrategy?.topicScore?.total || 0,
    viralDecision: combinedViralDecision(run),
    qualityMode: run.qualityMode || run.qualityV2?.mode || "",
    qualityV2: run.qualityV2
      ? {
          finalDecision: run.qualityV2.finalDecision || "",
          finalScore: run.qualityV2.finalScore || 0,
          issues: (run.qualityV2.issues || []).slice(0, 4),
          gates: Object.fromEntries(
            Object.entries(run.qualityV2.gates || {}).map(([key, value]) => [
              key,
              {
                pass: value?.pass,
                score: value?.score || value?.total || 0,
                hardFails: (value?.hardFails || []).slice(0, 3),
              },
            ]),
          ),
        }
      : null,
    voice: run.tts?.voice || "",
    bgm: run.bgm || {},
    review: run.review || {},
    srtSegments: run.srt?.segments?.length || 0,
    durationSeconds: run.audio?.durationSeconds || run.srt?.durationSeconds || 0,
    r2: run.r2 || {},
    drive: run.drive || {},
    telegram: run.telegram || {},
    files: run.files || {},
    warnings: (run.warnings || []).slice(0, 6),
  };
}

export async function rebuildWorldCupIndex() {
  await ensureWorldCupDirs();
  const files = await fs.readdir(runsRoot).catch(() => []);
  const runs = [];
  for (const file of files.filter((item) => item.endsWith(".json"))) {
    try {
      const run = JSON.parse(await fs.readFile(path.join(runsRoot, file), "utf8"));
      runs.push(runSummary(run));
    } catch {
      // Ignore corrupt local run summaries.
    }
  }
  runs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const index = { updatedAt: nowIso(), runs };
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return index;
}

export async function listWorldCupRuns() {
  await ensureWorldCupDirs();
  try {
    return JSON.parse(await fs.readFile(indexPath, "utf8"));
  } catch {
    return await rebuildWorldCupIndex();
  }
}

export async function readWorldCupRun(id) {
  const rawId = cleanText(id);
  const candidates = [rawId, slugify(id, "")]
    .filter((candidate) => candidate && /^[a-z0-9-]+$/i.test(candidate))
    .filter((candidate, index, list) => list.indexOf(candidate) === index);
  if (!candidates.length) {
    throw new WorldCupError("Missing World Cup run id.", { status: 400, code: "MISSING_RUN_ID" });
  }
  for (const safeId of candidates) {
    try {
      return JSON.parse(await fs.readFile(path.join(runsRoot, `${safeId}.json`), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  throw new WorldCupError("World Cup run was not found.", { status: 404, code: "WORLD_CUP_RUN_NOT_FOUND" });
}
