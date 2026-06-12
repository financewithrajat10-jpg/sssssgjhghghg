import {
  DEFAULT_WORLD_CUP_STRATEGY,
  DEFAULT_UPLOAD_TARGET,
  GEMINI_RETRY_DELAYS_MS,
  MAX_VIDEOS_PER_DAY,
  SEARCH_MODEL,
  SEARCH_FALLBACK_MODELS,
  WRITER_MODEL,
  EVALUATOR_MODEL,
  TTS_REWRITE_MODEL,
  TTS_MODEL,
  TTS_FALLBACK_MODELS,
  AUDIO_SRT_MODEL,
  AUDIO_SRT_FALLBACK_MODELS,
  VISUAL_REVIEW_MODEL,
  VISUAL_SELECTION_MODEL,
  VISUAL_SELECTION_FALLBACK_MODELS,
  WORLD_CUP_ASSET_SEARCH_MODEL,
  WORLD_CUP_ASSET_SEARCH_FALLBACK_MODELS,
  WORLD_CUP_CAPTION_DESIGN_MODEL,
  WORLD_CUP_CAPTION_MIDSCREEN,
  WORLD_CUP_CAPTION_PRESET,
  WORLD_CUP_BGM_FILE,
  WORLD_CUP_BGM_MODE,
  WORLD_CUP_BGM_PRESET,
  WORLD_CUP_BGM_VOLUME,
  WORLD_CUP_ENABLE_BGM,
  WORLD_CUP_LOCAL_PROOF_MAX_PER_VIDEO,
  WORLD_CUP_ENABLE_WIKIMEDIA_VISUALS,
  WORLD_CUP_LOCAL_ENTITY_CANDIDATES_PER_ENTITY,
  WORLD_CUP_LOCAL_ENTITY_MAX_ENTITIES,
  WORLD_CUP_LOCAL_ENTITY_MIN_SCORE,
  WORLD_CUP_LOCAL_ENTITY_OVERLAY_SCREEN_RATIO,
  WORLD_CUP_LOCAL_ENTITY_SELECTIONS_PER_ENTITY,
  WORLD_CUP_ENABLE_LOCAL_ENTITY_ASSETS,
  WORLD_CUP_MAX_IMAGE_SEGMENTS,
  WORLD_CUP_MIN_CLIP_RATIO,
  WORLD_CUP_MIN_REAL_VISUAL_RATIO,
  WORLD_CUP_RESEARCH_PASSES,
  WORLD_CUP_VISUAL_RETRY_ATTEMPTS,
  WORLD_CUP_VOICE_VOLUME,
  VISUAL_REVIEW_MAX_ITEMS,
  VISUAL_SCOUT_PAGES,
  VISUAL_SCOUT_TIMEOUT_MS,
  WorldCupError,
  assetPackRoot,
  cleanText,
  createApiUsageLedger,
  getActiveGeminiKey,
  getActiveStockKey,
  getActiveWorldCupApiUsage,
  hasFfmpeg,
  isViral2,
  localDownloadsRoot,
  normalizeBool,
  normalizeWorldCupInput,
  nowIso,
  setActiveWorldCupApiUsage,
  stockEnvKey,
  synthesizeWorldCupAudio,
  withTimeout,
} from "./modules/utils.mjs";
import { buildSrt, designWorldCupCaptions, generateAudioAwareSrt, normalizeTimedCaptionSegments } from "./modules/captions.mjs";
import {
  createRunSkeleton,
  listWorldCupRuns,
  readWorldCupRun,
  rebuildWorldCupIndex,
  runSummary,
  saveRun,
  writeRunFile,
} from "./modules/memory.mjs";
import {
  buildViral2Strategy,
  collectWorldCupData,
  generateScripts,
  hardenViralOpening,
  judgeScripts,
  polishScriptForShorts,
  repairScriptPromiseContract,
  reviseViral2Script,
  rewriteForTts,
  sanitizeScriptAgainstEvidence,
  scoreViral2Script,
  totalJudgeScore,
} from "./modules/script.mjs";
import {
  buildRightsManifest,
  reviewWorldCupRun,
  scoutWorldCupVisualAssets,
  planWorldCupVisualsWithRetries,
  visualPlanNeedsRetry,
} from "./modules/visuals.mjs";
import { renderWorldCupRun, rebuildWorldCupVisuals } from "./modules/render.mjs";
import { hasGoogleDriveCredentials, hasR2Credentials, hasTelegramCredentials, resolveWorldCupAsset, uploadWorldCupRun } from "./modules/uploads.mjs";
import { runWorldCupSchedulerImpl, scheduledHours } from "./modules/scheduler.mjs";

export { WorldCupError } from "./modules/utils.mjs";
export { buildMajorWorldCupAssetPacks, buildWorldCupAssetPack } from "./modules/visuals.mjs";
export { listWorldCupRuns, readWorldCupRun } from "./modules/memory.mjs";
export { renderWorldCupRun, rebuildWorldCupVisuals } from "./modules/render.mjs";
export { resolveWorldCupAsset, uploadWorldCupRun } from "./modules/uploads.mjs";

async function worldCupConfigSummary() {
  const keyInfo = await getActiveGeminiKey();
  const pexels = await getActiveStockKey("pexels");
  const pixabay = await getActiveStockKey("pixabay");
  return {
    ready: Boolean(keyInfo?.apiKey),
    ffmpegReady: await hasFfmpeg(),
    r2Ready: hasR2Credentials(),
    driveReady: Boolean(hasGoogleDriveCredentials() && (process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.WORLD_CUP_GOOGLE_DRIVE_FOLDER_ID)),
    telegramReady: hasTelegramCredentials(),
    uploadTarget: DEFAULT_UPLOAD_TARGET,
    strategy: DEFAULT_WORLD_CUP_STRATEGY,
    strategies: ["classic", "viral2"],
    stockReady: Boolean(pexels?.apiKey || pixabay?.apiKey),
    models: {
      search: SEARCH_MODEL,
      searchFallbacks: SEARCH_FALLBACK_MODELS,
      writer: WRITER_MODEL,
      evaluator: EVALUATOR_MODEL,
      ttsRewrite: TTS_REWRITE_MODEL,
      tts: TTS_MODEL,
      ttsFallbacks: TTS_FALLBACK_MODELS,
      audioSrt: AUDIO_SRT_MODEL,
      audioSrtFallbacks: AUDIO_SRT_FALLBACK_MODELS,
      visualReview: VISUAL_REVIEW_MODEL,
      visualSelection: VISUAL_SELECTION_MODEL,
      visualSelectionFallbacks: VISUAL_SELECTION_FALLBACK_MODELS,
      captionDesign: WORLD_CUP_CAPTION_DESIGN_MODEL,
    },
    retryDelaysMs: GEMINI_RETRY_DELAYS_MS,
    researchPasses: WORLD_CUP_RESEARCH_PASSES,
    bgm: {
      enabled: WORLD_CUP_ENABLE_BGM,
      mode: WORLD_CUP_BGM_MODE,
      preset: WORLD_CUP_BGM_PRESET,
      hasLocalFile: Boolean(WORLD_CUP_BGM_FILE),
      volume: WORLD_CUP_BGM_VOLUME,
      voiceVolume: WORLD_CUP_VOICE_VOLUME,
    },
    caption: {
      preset: WORLD_CUP_CAPTION_PRESET,
      midScreen: WORLD_CUP_CAPTION_MIDSCREEN,
      designModel: WORLD_CUP_CAPTION_DESIGN_MODEL,
    },
    visuals: {
      minRealVisualRatio: WORLD_CUP_MIN_REAL_VISUAL_RATIO,
      minClipRatio: WORLD_CUP_MIN_CLIP_RATIO,
      maxImageSegments: WORLD_CUP_MAX_IMAGE_SEGMENTS,
      maxLocalProofImages: WORLD_CUP_LOCAL_PROOF_MAX_PER_VIDEO,
      wikimediaEnabled: WORLD_CUP_ENABLE_WIKIMEDIA_VISUALS,
      retryAttempts: WORLD_CUP_VISUAL_RETRY_ATTEMPTS,
      assetPackRoot,
      localEntityAssets: {
        enabled: WORLD_CUP_ENABLE_LOCAL_ENTITY_ASSETS,
        overlayScreenRatio: WORLD_CUP_LOCAL_ENTITY_OVERLAY_SCREEN_RATIO,
        downloadsRoot: localDownloadsRoot,
        maxEntities: WORLD_CUP_LOCAL_ENTITY_MAX_ENTITIES,
        candidatesPerEntity: WORLD_CUP_LOCAL_ENTITY_CANDIDATES_PER_ENTITY,
        selectedPerEntity: WORLD_CUP_LOCAL_ENTITY_SELECTIONS_PER_ENTITY,
        minScore: WORLD_CUP_LOCAL_ENTITY_MIN_SCORE,
      },
    },
    defaultCaptionStyle: WORLD_CUP_CAPTION_PRESET,
    defaultCaptionAnimation: "slide-lift",
    maxVideosPerDay: MAX_VIDEOS_PER_DAY,
    scheduleHoursUtc: scheduledHours(),
  };
}


export { worldCupConfigSummary };

function buildCustomSelectedScript(options, evidence, warnings = []) {
  const text = cleanText(options.customScriptText || "");
  if (!text) {
    return null;
  }
  const firstSentence = text.split(/(?<=[.!?])\s+/).find(Boolean) || text.slice(0, 120);
  const title =
    cleanText(options.customScriptTitle) ||
    cleanText(evidence?.topic) ||
    cleanText(firstSentence).slice(0, 72) ||
    "World Cup Chaos Desk";
  const commentTrigger =
    cleanText(options.customScriptCommentTrigger) ||
    text
      .split(/(?<=[.!?])\s+/)
      .reverse()
      .find((line) => /\?|comments?|comment|you think|agree|wrong/i.test(line)) ||
    "Tell me in the comments: is this smart football logic, or am I overthinking it?";
  warnings.push("Custom script mode used: writer and judge generation were skipped, then TTS/SRT/visual/render ran from this script.");
  return {
    styleId: cleanText(options.customScriptStyle) || "custom_script",
    title,
    text,
    hook: cleanText(firstSentence),
    dataPoint: cleanText(options.customScriptDataPoint),
    opinion: cleanText(options.customScriptOpinion),
    joke: "",
    memorableLine: "",
    commentTrigger: cleanText(commentTrigger),
    source: "custom-script-input",
  };
}

async function generateWorldCupRun(input = {}) {
  const options = normalizeWorldCupInput(input);
  const keyInfo = await getActiveGeminiKey();
  let run = await createRunSkeleton(options);
  run.warnings = [];
  run.apiUsage = createApiUsageLedger();
  setActiveWorldCupApiUsage(run.apiUsage);

  try {
    if (!keyInfo?.apiKey) {
      run.warnings.push("No Gemini key is active. A local fallback draft was created.");
    }

    const data = await collectWorldCupData(options, keyInfo, run.warnings);
  run.evidence = data.evidence;
  run.sources = data.sources;
  run.memory = data.memory || {};
  if (isViral2(options)) {
    run.viralStrategy = await buildViral2Strategy({ evidence: run.evidence, options, keyInfo, memory: run.memory, warnings: run.warnings });
    run.captionPlan = run.viralStrategy.captionInstructions || {};
    run.evidence.viralStrategy = {
      version: run.viralStrategy.version,
      topicScore: run.viralStrategy.topicScore,
      oneSentenceContradiction: run.viralStrategy.oneSentenceContradiction,
      coverText: run.viralStrategy.coverText,
      visualStyle: run.viralStrategy.visualStyle,
    };
    options.viralStrategy = run.viralStrategy;
    run.files.viralStrategy = await writeRunFile(run, "viral-strategy.json", `${JSON.stringify(run.viralStrategy, null, 2)}\n`, "utf8");
  } else {
    run.viralStrategy = { version: "classic" };
  }
  run.files.evidence = await writeRunFile(run, "evidence.json", `${JSON.stringify(run.evidence, null, 2)}\n`, "utf8");
  run.status = "evidence_ready";
  await saveRun(run);

  const customSelectedScript = buildCustomSelectedScript(options, run.evidence, run.warnings);
  let judgeResult = null;
  let polishedSelectedScript = null;
  if (customSelectedScript) {
    run.scripts = [customSelectedScript];
    polishedSelectedScript = customSelectedScript;
  } else {
    const scriptResult = await generateScripts(run.evidence, keyInfo, options, run.warnings);
    run.scripts = scriptResult.scripts;
    judgeResult = await judgeScripts({ scripts: run.scripts, evidence: run.evidence, keyInfo, options, warnings: run.warnings });
    polishedSelectedScript = polishScriptForShorts(judgeResult.selected, run.warnings);
  }
  if (isViral2(options)) {
    let viralQuality = scoreViral2Script(polishedSelectedScript, run.evidence, run.viralStrategy);
    if (!customSelectedScript && viralQuality.decision !== "publish_candidate" && keyInfo?.apiKey && !options.offline) {
      const revised = await reviseViral2Script({
        script: polishedSelectedScript,
        evidence: run.evidence,
        viralStrategy: run.viralStrategy,
        keyInfo,
        warnings: run.warnings,
      });
      if (revised?.text) {
        const revisedScript = polishScriptForShorts(sanitizeScriptAgainstEvidence(revised, run.evidence, run.warnings), run.warnings);
        const revisedQuality = scoreViral2Script(revisedScript, run.evidence, run.viralStrategy);
        if (revisedQuality.total >= viralQuality.total || viralQuality.hardFails.length) {
          polishedSelectedScript = revisedScript;
          viralQuality = revisedQuality;
          run.warnings.push("Viral 2.0 gate revised the selected script before TTS.");
        }
      }
    }
    if (!customSelectedScript) {
      const hardened = hardenViralOpening(polishedSelectedScript, run.evidence, run.viralStrategy, run.warnings);
      polishedSelectedScript = hardened.script;
      viralQuality = hardened.quality;
      const promiseRepaired = repairScriptPromiseContract(polishedSelectedScript, run.evidence, run.viralStrategy, run.warnings);
      if (promiseRepaired.changed) {
        polishedSelectedScript = promiseRepaired.script;
        viralQuality = scoreViral2Script(polishedSelectedScript, run.evidence, run.viralStrategy);
      }
    }
    polishedSelectedScript.viralQuality = viralQuality;
    run.viralStrategy.scriptGate = {
      selectedStyleId: polishedSelectedScript.styleId,
      quality: viralQuality,
    };
  }
  run.selectedScript = {
    ...polishedSelectedScript,
    judge: judgeResult
      ? {
          model: judgeResult.model,
          candidates: judgeResult.candidates.map((candidate) => ({
            styleId: candidate.styleId,
            title: candidate.title,
            totalScore: candidate.totalScore || totalJudgeScore(candidate.scores),
            scores: candidate.scores,
            notes: candidate.judgeNotes || [],
          })),
          revisionUsed: judgeResult.revisionUsed,
          notes: judgeResult.notes,
        }
      : {
          model: "custom-script-input",
          candidates: [
            {
              styleId: polishedSelectedScript.styleId,
              title: polishedSelectedScript.title,
              totalScore: polishedSelectedScript.viralQuality?.total || 0,
              scores: {},
              notes: ["Custom script supplied by operator; automatic script generation and judging skipped."],
            },
          ],
          revisionUsed: false,
          notes: ["Custom script supplied by operator."],
        },
  };
  run.files.script = await writeRunFile(
    run,
    "script.json",
    `${JSON.stringify({ scripts: run.scripts, selectedScript: run.selectedScript }, null, 2)}\n`,
    "utf8",
  );
  run.status = "script_ready";
  await saveRun(run);

  const visualScoutPromise = withTimeout(
    scoutWorldCupVisualAssets({
      evidence: run.evidence,
      selectedScript: run.selectedScript,
      keyInfo,
      options,
      warnings: run.warnings,
    }),
    VISUAL_SCOUT_TIMEOUT_MS,
    "Parallel visual scout",
  ).catch((error) => ({ error }));

  run.tts = await rewriteForTts({ selectedScript: run.selectedScript, evidence: run.evidence, keyInfo, options, warnings: run.warnings });
  let audioBase64 = "";
  if (options.generateAudio && keyInfo?.apiKey && !options.offline) {
    try {
      const audio = await synthesizeWorldCupAudio({
        keyInfo,
        screenplay: run.tts.screenplay,
        voice: run.tts.voice,
        mood: run.tts.mood,
      });
      run.files.audio = await writeRunFile(run, "audio.wav", audio.audio);
      run.audio = {
        file: run.files.audio,
        mimeType: audio.mimeType,
        durationSeconds: audio.durationSeconds,
        model: audio.model,
        voice: audio.voice,
      };
      audioBase64 = audio.audio.toString("base64");
    } catch (error) {
      run.warnings.push(`Audio generation failed, SRT will use script timing: ${error.message}`);
      run.audio = { error: error.message, model: TTS_MODEL, voice: run.tts.voice };
    }
  } else {
    run.warnings.push(options.offline ? "Offline mode skipped Gemini TTS." : "Audio generation was disabled.");
  }
  run.status = run.files.audio ? "audio_ready" : "script_audio_pending";
  await saveRun(run);

  const srtResult = await generateAudioAwareSrt({
    keyInfo,
    audioBase64,
    mimeType: "audio/wav",
    screenplay: run.tts.screenplay || run.selectedScript.text,
    durationSeconds: run.audio?.durationSeconds || options.durationSeconds,
    warnings: run.warnings,
  });
  let finalSrtSegments = normalizeTimedCaptionSegments(srtResult.segments);
  const audioDurationForCaptions = Number(run.audio?.durationSeconds || options.durationSeconds || 0) || 0;
  const captionEnd = Number(finalSrtSegments.at(-1)?.endTime || 0) || 0;
  if (audioDurationForCaptions && finalSrtSegments.length && audioDurationForCaptions - captionEnd > 1.25) {
    const repaired = finalSrtSegments.map((segment) => ({ ...segment }));
    repaired[repaired.length - 1].endTime = audioDurationForCaptions;
    repaired[repaired.length - 1].durationSeconds = Math.max(0.45, audioDurationForCaptions - Number(repaired[repaired.length - 1].startTime || 0));
    finalSrtSegments = normalizeTimedCaptionSegments(repaired);
    run.warnings.push(`Caption timing extended to full audio duration (${audioDurationForCaptions.toFixed(2)}s).`);
  }
  run.srt = {
    source: srtResult.source,
    model: srtResult.model || "",
    audioSummary: srtResult.audioSummary || "",
    segments: finalSrtSegments,
    durationSeconds: finalSrtSegments.at(-1)?.endTime || 0,
    captionStyle: "creator-yellow-pop",
    captionAnimation: "slide-lift",
    captionPlan: run.captionPlan || {},
  };
  run.captionPlan = await designWorldCupCaptions({
    keyInfo,
    segments: run.srt.segments,
    screenplay: run.tts.screenplay || run.selectedScript.text,
    selectedScript: run.selectedScript,
    evidence: run.evidence,
    options,
    warnings: run.warnings,
  });
  run.srt.captionPlan = run.captionPlan;
  const finalSrt = buildSrt(run.srt.segments);
  run.files.srt = await writeRunFile(run, "srt.srt", finalSrt, "utf8");
  run.files.captions = await writeRunFile(
    run,
    "captions.json",
    `${JSON.stringify({ ...run.srt, srt: finalSrt }, null, 2)}\n`,
    "utf8",
  );
  run.status = "srt_ready";
  await saveRun(run);

  run.visualPlan = await planWorldCupVisualsWithRetries({ run, keyInfo, options, initialVisualScoutPromise: visualScoutPromise });
  run.attributions = run.visualPlan.attributions || [];
  run.rightsManifest = buildRightsManifest(run.visualPlan);
  run.files.visuals = await writeRunFile(run, "visuals.json", `${JSON.stringify(run.visualPlan, null, 2)}\n`, "utf8");
  run.files.attribution = await writeRunFile(run, "attribution.json", `${JSON.stringify(run.attributions, null, 2)}\n`, "utf8");
  run.files.rights = await writeRunFile(run, "rights.json", `${JSON.stringify(run.rightsManifest, null, 2)}\n`, "utf8");
  run.review = reviewWorldCupRun(run);
  run.status = visualPlanNeedsRetry(run.visualPlan) ? "needs_visual_review" : "generated";
  await saveRun(run);

  if (options.render && run.status === "generated") {
    run = await renderWorldCupRun(run.id, input);
  } else if (options.render && run.status === "needs_visual_review") {
    run.warnings.push("Render skipped because visual retries still left fallback boards. Script, TTS, and SRT were preserved.");
    await saveRun(run);
  }
  if (options.upload) {
    if (options.render && !run.files?.mp4) {
      throw new WorldCupError("Refusing to upload World Cup run because no MP4 was rendered.", {
        status: 422,
        code: "WORLD_CUP_UPLOAD_REQUIRES_RENDERED_MP4",
        details: {
          runId: run.id,
          status: run.status,
          hint: "Fix visual sourcing/rendering first, or run upload without render only when sidecar-only delivery is intentional.",
        },
      });
    }
    const allowNeedsReviewUpload = normalizeBool(input.allowNeedsReviewUpload ?? input.allowReviewUpload, false);
    if (!allowNeedsReviewUpload && (run.review?.status === "needs_review" || run.postRenderQuality?.decision === "revise" || run.postRenderQuality?.decision === "discard")) {
      throw new WorldCupError("Refusing to upload World Cup run because quality review did not pass.", {
        status: 422,
        code: "WORLD_CUP_UPLOAD_REQUIRES_PUBLISH_CANDIDATE",
        details: {
          runId: run.id,
          review: run.review || {},
          postRenderQuality: run.postRenderQuality || {},
          hint: "Fix quality issues first, or pass allowNeedsReviewUpload=true only for private debugging.",
        },
      });
    }
    await uploadWorldCupRun(run.id, { ...input, requireMp4: true });
  }
    run = await readWorldCupRun(run.id);
    run.apiUsage = getActiveWorldCupApiUsage() || run.apiUsage || {};
    run.apiUsage.completedAt = nowIso();
    run.files.apiUsage = await writeRunFile(run, "api-usage.json", `${JSON.stringify(run.apiUsage, null, 2)}\n`, "utf8");
    await saveRun(run);
    return await readWorldCupRun(run.id);
  } finally {
    if (getActiveWorldCupApiUsage() === run.apiUsage) {
      setActiveWorldCupApiUsage(null);
    }
  }
}


export { generateWorldCupRun };

export async function runWorldCupScheduler(input = {}) {
  return runWorldCupSchedulerImpl(input, { generateWorldCupRun });
}
