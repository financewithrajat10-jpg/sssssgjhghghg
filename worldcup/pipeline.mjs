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
  WORLD_CUP_QUALITY_MODE,
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
  WORLD_CUP_V2_FINAL_PUBLISH_SCORE,
  WORLD_CUP_V2_MAX_SCRIPT_RETRIES,
  WORLD_CUP_V2_MAX_VISUAL_RETRIES,
  WORLD_CUP_V2_REQUIRE_ZERO_FALLBACKS,
  WORLD_CUP_V2_SCRIPT_PUBLISH_SCORE,
  WORLD_CUP_V2_TELEGRAM_SEND_FAILED_MP4,
  WORLD_CUP_YOUTUBE_MAX_PER_DAY,
  WORLD_CUP_YOUTUBE_METADATA_MODEL,
  WORLD_CUP_YOUTUBE_NOTIFY_SUBSCRIBERS,
  WORLD_CUP_YOUTUBE_PRIVACY,
  WORLD_CUP_YOUTUBE_UPLOAD,
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
  editScriptsV20,
  generateScripts,
  judgeScripts,
  polishScriptForShorts,
  rewriteForTts,
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
import { hasGoogleDriveCredentials, hasR2Credentials, hasTelegramCredentials, resolveWorldCupAsset, sendWorldCupTelegramAlert, uploadWorldCupRun } from "./modules/uploads.mjs";
import { hasYouTubeCredentials, uploadWorldCupRunToYouTube, youtubeTelegramSummary } from "./modules/youtube.mjs";
import { runWorldCupSchedulerImpl, scheduledHours } from "./modules/scheduler.mjs";
import {
  addRetryLog,
  buildStoryboard,
  buildV2FailureAlert,
  ensureQualityV2,
  qualityV2Enabled,
  scoreCaptionAudioGateV2,
  scorePostRenderGateV2,
  scoreScriptGateV2,
  scoreStoryboardGateV2,
  setV2Status,
  updateQualityGate,
  visualGateRetryStalled,
} from "./modules/quality-v2.mjs";

export { WorldCupError } from "./modules/utils.mjs";
export { buildMajorWorldCupAssetPacks, buildWorldCupAssetPack } from "./modules/visuals.mjs";
export { listWorldCupRuns, readWorldCupRun } from "./modules/memory.mjs";
export { renderWorldCupRun, rebuildWorldCupVisuals } from "./modules/render.mjs";
export { resolveWorldCupAsset, uploadWorldCupRun } from "./modules/uploads.mjs";
export { uploadWorldCupRunToYouTube } from "./modules/youtube.mjs";

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
    youtubeReady: hasYouTubeCredentials(),
    uploadTarget: DEFAULT_UPLOAD_TARGET,
    youtube: {
      enabled: WORLD_CUP_YOUTUBE_UPLOAD,
      privacy: WORLD_CUP_YOUTUBE_PRIVACY,
      maxPerDay: WORLD_CUP_YOUTUBE_MAX_PER_DAY,
      notifySubscribers: WORLD_CUP_YOUTUBE_NOTIFY_SUBSCRIBERS,
      metadataModel: WORLD_CUP_YOUTUBE_METADATA_MODEL,
    },
    strategy: DEFAULT_WORLD_CUP_STRATEGY,
    strategies: ["classic", "viral2"],
    quality: {
      mode: WORLD_CUP_QUALITY_MODE || "off",
      scriptPublishScore: WORLD_CUP_V2_SCRIPT_PUBLISH_SCORE,
      finalPublishScore: WORLD_CUP_V2_FINAL_PUBLISH_SCORE,
      maxScriptRetries: WORLD_CUP_V2_MAX_SCRIPT_RETRIES,
      maxVisualRetries: WORLD_CUP_V2_MAX_VISUAL_RETRIES,
      requireZeroFallbacks: WORLD_CUP_V2_REQUIRE_ZERO_FALLBACKS,
      telegramSendFailedMp4: WORLD_CUP_V2_TELEGRAM_SEND_FAILED_MP4,
    },
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

async function writeQualityV2Sidecars(run) {
  if (!run.qualityV2 || !Object.keys(run.qualityV2).length) {
    return run;
  }
  run.files.qualityV2 = await writeRunFile(run, "quality-v2.json", `${JSON.stringify(run.qualityV2, null, 2)}\n`, "utf8");
  if (run.storyboard) {
    run.files.storyboard = await writeRunFile(run, "storyboard.json", `${JSON.stringify(run.storyboard, null, 2)}\n`, "utf8");
  }
  if (run.retryLog) {
    run.files.retryLog = await writeRunFile(run, "retry-log.json", `${JSON.stringify(run.retryLog, null, 2)}\n`, "utf8");
  }
  return run;
}

async function writeVisualSidecars(run) {
  run.attributions = run.visualPlan.attributions || [];
  run.rightsManifest = buildRightsManifest(run.visualPlan);
  run.files.visuals = await writeRunFile(run, "visuals.json", `${JSON.stringify(run.visualPlan, null, 2)}\n`, "utf8");
  run.files.attribution = await writeRunFile(run, "attribution.json", `${JSON.stringify(run.attributions, null, 2)}\n`, "utf8");
  run.files.rights = await writeRunFile(run, "rights.json", `${JSON.stringify(run.rightsManifest, null, 2)}\n`, "utf8");
  return run;
}

function youtubeUploadRequested(input = {}, options = {}) {
  return normalizeBool(options.youtubeUpload ?? input.youtubeUpload ?? input.youtube_upload, false);
}

function addUniqueRunWarning(run, warning) {
  run.warnings = Array.from(new Set([...(run.warnings || []), cleanText(warning)].filter(Boolean)));
  return run;
}

async function maybeUploadWorldCupRunToYouTube(run, input, options) {
  if (!youtubeUploadRequested(input, options)) {
    return run;
  }
  const uploaded = await uploadWorldCupRunToYouTube(run.id, { ...input, ...options });
  if (hasTelegramCredentials()) {
    try {
      await sendWorldCupTelegramAlert(uploaded, youtubeTelegramSummary(uploaded), "youtube-upload");
      return await readWorldCupRun(uploaded.id);
    } catch (error) {
      const latest = await readWorldCupRun(uploaded.id);
      latest.warnings = Array.from(new Set([...(latest.warnings || []), `YouTube Telegram confirmation failed: ${error.message}`]));
      await saveRun(latest);
      return latest;
    }
  }
  return uploaded;
}

export async function uploadWorldCupRunForPrimaryDelivery(run, input, options, uploadOptions = {}, uploader = uploadWorldCupRun) {
  try {
    return await uploader(run.id, { ...input, ...options, ...uploadOptions });
  } catch (error) {
    const latest = await readWorldCupRun(run.id);
    addUniqueRunWarning(latest, `Primary Telegram/Drive/R2 delivery failed before YouTube stage: ${error.message}`);
    latest.delivery = {
      ...(latest.delivery || {}),
      primaryUpload: {
        status: "failed",
        failedAt: nowIso(),
        code: error.code || "PRIMARY_UPLOAD_FAILED",
        message: error.message,
      },
    };
    await saveRun(latest);
    if (youtubeUploadRequested(input, options) && latest.files?.mp4) {
      return latest;
    }
    throw error;
  }
}

async function writeApiUsageSidecar(run) {
  run = await readWorldCupRun(run.id);
  run.apiUsage = getActiveWorldCupApiUsage() || run.apiUsage || {};
  run.apiUsage.completedAt = nowIso();
  run.files.apiUsage = await writeRunFile(run, "api-usage.json", `${JSON.stringify(run.apiUsage, null, 2)}\n`, "utf8");
  await saveRun(run);
  return await readWorldCupRun(run.id);
}

async function blockQualityV2Run(run, failedGate, options) {
  setV2Status(run, "pre_render_blocked", { failedGate });
  updateQualityGate(run, "blocked", {
    pass: false,
    score: run.qualityV2?.gates?.[failedGate]?.score || run.qualityV2?.gates?.[failedGate]?.total || 0,
    hardFails: run.qualityV2?.gates?.[failedGate]?.hardFails || [`${failedGate} gate failed.`],
    issues: run.qualityV2?.gates?.[failedGate]?.issues || [],
  });
  run.apiUsage = getActiveWorldCupApiUsage() || run.apiUsage || {};
  run.apiUsage.completedAt = nowIso();
  run.files.apiUsage = await writeRunFile(run, "api-usage.json", `${JSON.stringify(run.apiUsage, null, 2)}\n`, "utf8");
  await writeQualityV2Sidecars(run);
  await saveRun(run);
  if (options.upload && hasTelegramCredentials()) {
    await sendWorldCupTelegramAlert(run, buildV2FailureAlert(run, failedGate), `v2-${failedGate}-blocked`).catch((error) => {
      run.warnings.push(`V2 Telegram quality alert failed: ${error.message}`);
    });
  }
  return await readWorldCupRun(run.id);
}

async function generateWorldCupRun(input = {}) {
  const options = normalizeWorldCupInput(input);
  const keyInfo = await getActiveGeminiKey();
  let run = await createRunSkeleton(options);
  run.warnings = [];
  run.apiUsage = createApiUsageLedger();
  const isQualityV2 = qualityV2Enabled(options);
  if (isQualityV2) {
    ensureQualityV2(run, options);
  }
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
  let scriptEditorResult = null;
  run.editedScripts = [];
  if (customSelectedScript) {
    run.scripts = [customSelectedScript];
    polishedSelectedScript = customSelectedScript;
  } else {
    const scriptResult = await generateScripts(run.evidence, keyInfo, options, run.warnings);
    run.scripts = scriptResult.scripts;
    let scriptsForJudging = run.scripts;
    if (isViral2(options)) {
      scriptEditorResult = await editScriptsV20({
        scripts: run.scripts,
        evidence: run.evidence,
        keyInfo,
        options,
        warnings: run.warnings,
      });
      run.editedScripts = Array.isArray(scriptEditorResult.scripts) && scriptEditorResult.scripts.length ? scriptEditorResult.scripts : [];
      if (run.editedScripts.length === run.scripts.length) {
        scriptsForJudging = run.editedScripts;
      } else {
        run.warnings.push("V2 2.0 editor did not return all candidates; evaluator used rough generated scripts.");
        run.editedScripts = [];
      }
      run.viralStrategy.scriptEditor = {
        version: scriptEditorResult.version,
        model: scriptEditorResult.model,
        editedCount: scriptEditorResult.editedCount,
        candidateCount: run.editedScripts.length,
        selectionStage: run.editedScripts.length ? (scriptEditorResult.editedCount ? "after_v2_2_edit" : "polished_candidates_after_editor_skip") : "rough_fallback",
      };
    }
    judgeResult = await judgeScripts({ scripts: scriptsForJudging, evidence: run.evidence, keyInfo, options, warnings: run.warnings });
    polishedSelectedScript = polishScriptForShorts(judgeResult.selected, run.warnings);
  }
  let scriptGateV2 = null;
  let scriptBlockedV2 = false;
  if (isViral2(options)) {
    const viralQuality = scoreViral2Script(polishedSelectedScript, run.evidence, run.viralStrategy);
    if (isQualityV2) {
      scriptGateV2 = scoreScriptGateV2({
        script: polishedSelectedScript,
        evidence: run.evidence,
        viralStrategy: run.viralStrategy,
        memory: run.memory,
        options,
      });
      updateQualityGate(run, "script", scriptGateV2);
      scriptBlockedV2 = !scriptGateV2.pass;
    }
    polishedSelectedScript.viralQuality = viralQuality;
    run.viralStrategy.scriptGate = {
      selectedStyleId: polishedSelectedScript.styleId,
      quality: viralQuality,
      qualityV2: scriptGateV2,
      editor: run.viralStrategy.scriptEditor || null,
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
    `${JSON.stringify(
      {
        scripts: run.scripts,
        editedScripts: run.editedScripts || [],
        selection: {
          strategy: isViral2(options) ? "v2_2_edit_all_then_judge" : "rough_candidates_then_judge",
          customScript: Boolean(customSelectedScript),
          editor: run.viralStrategy?.scriptEditor || null,
          judgeModel: run.selectedScript.judge?.model || "",
          selectedStyleId: run.selectedScript.styleId,
        },
        selectedScript: run.selectedScript,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  run.status = "script_ready";
  if (isQualityV2) {
    await writeQualityV2Sidecars(run);
  }
  await saveRun(run);

  if (scriptBlockedV2) {
    return await blockQualityV2Run(run, "script", options);
  }

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

  const initialVisualOptions = isQualityV2 ? { ...options, maxVisualRetries: 0 } : options;
  run.visualPlan = await planWorldCupVisualsWithRetries({ run, keyInfo, options: initialVisualOptions, initialVisualScoutPromise: visualScoutPromise });
  await writeVisualSidecars(run);

  if (isQualityV2) {
    setV2Status(run, "pre_render_quality_check", { stage: "visuals" });
    run.storyboard = buildStoryboard(run);
    let storyboardGate = scoreStoryboardGateV2({ run, storyboard: run.storyboard, options });
    updateQualityGate(run, "visual", storyboardGate);
    let visualAttempt = 0;
    while (!storyboardGate.pass && visualAttempt < options.maxVisualRetries && !options.offline) {
      visualAttempt += 1;
      setV2Status(run, "visual_retrying", { attempt: visualAttempt });
      addRetryLog(run, "visual", visualAttempt, storyboardGate);
      await writeQualityV2Sidecars(run);
      await saveRun(run);
      const retryOptions = { ...options, visualRetryAttempt: visualAttempt, maxVisualRetries: 0 };
      const previousStoryboardGate = storyboardGate;
      run.visualPlan = await planWorldCupVisualsWithRetries({ run, keyInfo, options: retryOptions });
      await writeVisualSidecars(run);
      run.storyboard = buildStoryboard(run);
      storyboardGate = scoreStoryboardGateV2({ run, storyboard: run.storyboard, options });
      updateQualityGate(run, "visual", storyboardGate);
      if (visualGateRetryStalled(previousStoryboardGate, storyboardGate)) {
        const reason = storyboardGate.hardFails?.slice(0, 2).join(" | ") || "same V2 visual gate blockers";
        run.warnings.push(`Visual retry stopped early after attempt ${visualAttempt}: no progress on ${reason}.`);
        break;
      }
    }
    const captionAudioGate = scoreCaptionAudioGateV2({ run, options });
    updateQualityGate(run, "captionAudio", captionAudioGate);
    await writeQualityV2Sidecars(run);
    const allowPreRenderReview = normalizeBool(options.telegramSendFailedMp4 ?? options.v2TelegramSendFailedMp4, true);
    const preRenderHardFails = [
      ...(!storyboardGate.pass ? storyboardGate.hardFails || [] : []),
      ...(!captionAudioGate.pass ? captionAudioGate.hardFails || [] : []),
    ];
    const preRenderIssues = [
      ...(!storyboardGate.pass ? storyboardGate.issues || [] : []),
      ...(!captionAudioGate.pass ? captionAudioGate.issues || [] : []),
    ];
    if (!storyboardGate.pass || !captionAudioGate.pass) {
      if (!allowPreRenderReview) {
        if (!storyboardGate.pass) {
          run.warnings.push("V2 render blocked because storyboard/visual gate did not pass.");
          return await blockQualityV2Run(run, "visual", options);
        }
        run.warnings.push("V2 render blocked because caption/audio gate did not pass.");
        return await blockQualityV2Run(run, "captionAudio", options);
      }
      run.warnings.push(`V2 pre-render gate did not pass, but review-copy render is enabled; rendering MP4 with quality score/issues: ${preRenderHardFails.slice(0, 3).join(" | ")}`);
    }
    updateQualityGate(run, "preRender", {
      version: "pre-render-v2",
      pass: Boolean(storyboardGate.pass && captionAudioGate.pass),
      score: Math.round((Number(storyboardGate.score || 0) + Number(captionAudioGate.score || 0)) / 2),
      issues: storyboardGate.pass && captionAudioGate.pass ? [] : ["Review-copy render allowed despite pre-render quality issues.", ...preRenderIssues],
      hardFails: preRenderHardFails,
      checkedAt: nowIso(),
    });
    await writeQualityV2Sidecars(run);
  }

  run.review = reviewWorldCupRun(run);
  run.status = isQualityV2 ? "generated" : visualPlanNeedsRetry(run.visualPlan) ? "needs_visual_review" : "generated";
  await saveRun(run);

  if (options.render && run.status === "generated") {
    run = await renderWorldCupRun(run.id, input);
    if (isQualityV2) {
      let postRenderGate = scorePostRenderGateV2({ run, options });
      updateQualityGate(run, "postRender", postRenderGate);
      const meanVolume = Number(postRenderGate.audio?.meanVolumeDb);
      if (!postRenderGate.pass && Number.isFinite(meanVolume) && meanVolume < -20) {
        addRetryLog(run, "audio-render", 1, postRenderGate);
        run.warnings.push(`V2 audio gate rerendering once because mean volume was ${meanVolume.toFixed(1)} dB.`);
        await writeQualityV2Sidecars(run);
        await saveRun(run);
        run = await renderWorldCupRun(run.id, {
          ...input,
          bgmVolume: Math.min(0.35, Math.max(0.22, Number(options.bgmVolume || 0) + 0.04)),
        });
        postRenderGate = scorePostRenderGateV2({ run, options });
        updateQualityGate(run, "postRender", postRenderGate);
      }
      if (postRenderGate.pass) {
        setV2Status(run, "publish_candidate", { score: postRenderGate.score });
      } else {
        setV2Status(run, "rendered_needs_review", { failedGate: "postRender", score: postRenderGate.score });
        if (options.upload && hasTelegramCredentials() && !run.files?.mp4) {
          await sendWorldCupTelegramAlert(run, buildV2FailureAlert(run, "postRender"), "v2-post-render-blocked").catch((error) => {
            run.warnings.push(`V2 Telegram post-render alert failed: ${error.message}`);
          });
        }
      }
      await writeQualityV2Sidecars(run);
      await saveRun(run);
    }
  } else if (options.render && run.status === "needs_visual_review") {
    run.warnings.push("Render skipped because visual retries still left fallback boards. Script, TTS, and SRT were preserved.");
    await saveRun(run);
  }
  if (options.upload) {
    if (isQualityV2 && run.status !== "publish_candidate") {
      const sendReviewMp4 = Boolean(run.files?.mp4) && normalizeBool(options.telegramSendFailedMp4 ?? options.v2TelegramSendFailedMp4, true);
      if (sendReviewMp4) {
        run.warnings.push("V2 review-copy upload enabled: sending rendered MP4 to Telegram with quality score/issues.");
        await writeQualityV2Sidecars(run);
        await saveRun(run);
        run = await uploadWorldCupRunForPrimaryDelivery(run, input, options, {
          requireMp4: true,
          telegramSendFailedMp4: true,
          allowNeedsReviewUpload: true,
        });
        run = await maybeUploadWorldCupRunToYouTube(run, input, options);
        return await writeApiUsageSidecar(run);
      }
      if (hasTelegramCredentials() && !run.telegram?.messages?.some((message) => String(message.label || "").startsWith("v2-"))) {
        await sendWorldCupTelegramAlert(run, buildV2FailureAlert(run, run.status === "rendered_needs_review" ? "postRender" : "preRender"), "v2-upload-blocked").catch((error) => {
          run.warnings.push(`V2 Telegram upload-block alert failed: ${error.message}`);
        });
      }
      run.apiUsage = getActiveWorldCupApiUsage() || run.apiUsage || {};
      run.apiUsage.completedAt = nowIso();
      run.files.apiUsage = await writeRunFile(run, "api-usage.json", `${JSON.stringify(run.apiUsage, null, 2)}\n`, "utf8");
      await writeQualityV2Sidecars(run);
      await saveRun(run);
      run = await maybeUploadWorldCupRunToYouTube(run, input, options);
      return await writeApiUsageSidecar(run);
    }
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
    const allowNeedsReviewUpload = normalizeBool(input.allowNeedsReviewUpload ?? input.allowReviewUpload, normalizeBool(options.youtubeUpload, false));
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
    run = await uploadWorldCupRunForPrimaryDelivery(run, input, options, { requireMp4: true });
  }
  run = await maybeUploadWorldCupRunToYouTube(run, input, options);
  return await writeApiUsageSidecar(run);
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
