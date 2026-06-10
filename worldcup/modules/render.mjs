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
import {
  createRunSkeleton,
  combinedViralDecision,
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
  assetMatchTerms,
  assetMatchesSegment,
  assetPackMatchesEvidence,
  attachVisualReviews,
  buildDirectorSummary,
  buildLocalEntityLayer,
  buildMajorWorldCupAssetPacks,
  buildRightsManifest,
  buildVisualPlan,
  buildWorldCupAssetPack,
  candidateAllowedByReview,
  chooseImageForSegment,
  clipLooksContextMismatched,
  commonsAssetFromImageInfo,
  curatedAssetTargetForTeam,
  detectLocalEntitiesHeuristic,
  detectLocalEntitiesWithGemma,
  discoverAssetPackTargets,
  entityAliasRegex,
  evidenceAssetTerms,
  fallbackVisualForSegment,
  fetchInlineImagePart,
  folderAliasText,
  getLocalEntityCatalog,
  imageProofShouldOverrideClip,
  impliedTeamNames,
  isImageFile,
  isLocalProofAsset,
  isPathInside,
  isVideoFile,
  listLocalMediaFiles,
  loadLocalAssetPackAssets,
  localEntityCandidateFromFile,
  localEntityFallbackReview,
  localEntityMentionScore,
  localImagePart,
  localVisualReview,
  makeLocalEntityContactSheet,
  makeLocalImagePreview,
  mediaMimeType,
  orderLocalEntityImageFiles,
  planWorldCupVisualsWithRetries,
  refineVisualScoutWithGemini,
  resolveWikimediaPlayerImage,
  resolveWikimediaTeamImage,
  resolveWikimediaVisualAssets,
  reviewLocalEntityImagesWithGemma,
  reviewVisualCandidatesWithGemma,
  reviewWorldCupRun,
  saveAssetPackImage,
  scoutWorldCupVisualAssets,
  scriptVisualScoutQueries,
  searchLicensedCommonsImage,
  searchPexelsVideos,
  searchPixabayVideos,
  searchStockCandidatesParallel,
  segmentMatchesLocalEntity,
  segmentSearchQueries,
  selectBackupFootballClip,
  selectVisualClip,
  stockCandidateMatchesSegment,
  stockProviderQuery,
  textMentionsAlias,
  visualCandidateText,
  visualIntentForSegment,
  visualPlanFallbackCount,
  visualPlanNeedsRetry,
  visualPlanRealVisualRatio,
} from "./visuals.mjs";

export function stockH264Args({ preset = "veryfast", crf = "21" } = {}) {
  const gop = VIDEO_FPS * 2;
  return [
    "-c:v",
    "libx264",
    "-preset",
    preset,
    "-crf",
    crf,
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "baseline",
    "-level:v",
    "4.1",
    "-g",
    String(gop),
    "-keyint_min",
    String(gop),
    "-sc_threshold",
    "0",
    "-bf",
    "0",
    "-refs",
    "1",
    "-tag:v",
    "avc1",
    "-color_range",
    "tv",
    "-colorspace",
    "bt709",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-movflags",
    "+faststart",
    "-map_metadata",
    "-1",
    "-metadata:s:v:0",
    "rotate=0",
  ];
}

export function ffmpegConcatPath(filePath) {
  return filePath.replaceAll("\\", "/").replaceAll("'", "'\\''");
}

export function ffmpegFilterPath(fileName) {
  return String(fileName || "").replace(/\\/g, "/").replace(/:/g, "\\:");
}

export function isApprovedMediaHost(hostname) {
  return STOCK_VIDEO_HOSTS.has(hostname) || hostname.endsWith("wikimedia.org") || hostname.endsWith("wikimedia.commons");
}

export async function downloadAsset(url, tempDir, fileName) {
  if (!/^https?:\/\//i.test(String(url || ""))) {
    const resolved = path.resolve(String(url || ""));
    const assetRootResolved = path.resolve(assetPackRoot);
    const downloadsRootResolved = path.resolve(localDownloadsRoot);
    if (!isPathInside(resolved, assetRootResolved) && !isPathInside(resolved, downloadsRootResolved)) {
      throw new Error("Blocked local media outside World Cup asset packs/downloads.");
    }
    if (!(await fileExists(resolved))) {
      throw new Error("Local asset file was not found.");
    }
    return resolved;
  }
  const parsed = new URL(url);
  if (!isApprovedMediaHost(parsed.hostname)) {
    throw new Error(`Blocked unapproved media host: ${parsed.hostname}`);
  }
  const response = await fetchWithTimeout(url, { headers: { "User-Agent": "WorldCupChaosDesk/1.0" } });
  if (!response.ok) {
    throw new Error(`Media download failed with HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const filePath = path.join(tempDir, fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export function wrapCardLine(text, maxChars = 24) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.slice(0, 7).join("\n");
}

export async function renderFallbackCard(ffmpegPath, tempDir, segment, index) {
  const textPath = path.join(tempDir, `card-${String(index + 1).padStart(3, "0")}.txt`);
  const title = wrapCardLine(segment.fallbackVisual?.headline || "World Cup Chaos Desk", 22);
  const subline = wrapCardLine(segment.fallbackVisual?.subline || segment.captionText || "", 26);
  await fs.writeFile(textPath, `${title}\n\n${subline}`, "utf8");
  const out = path.join(tempDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
  const colors = ["0b1220", "111827", "052e2b", "1f2937"];
  const color = colors[index % colors.length];
  const draw = [
    `drawbox=x=0:y=0:w=iw:h=ih:color=0x${color}:t=fill`,
    "drawbox=x=70:y=110:w=940:h=1700:color=black@0.18:t=fill",
    "drawbox=x=90:y=130:w=900:h=1660:color=white@0.08:t=4",
    `drawtext=textfile='${ffmpegFilterPath(path.basename(textPath))}':fontcolor=white:fontsize=50:line_spacing=18:x=120:y=(h-text_h)/2`,
    "drawtext=text='WORLD CUP CHAOS DESK':fontcolor=0xffe600:fontsize=42:x=90:y=110",
    "format=yuv420p",
  ].join(",");
  await execFileAsync(
    ffmpegPath,
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x${color}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:r=${VIDEO_FPS}:d=${Math.max(0.6, segment.durationSeconds).toFixed(3)}`,
      "-vf",
      draw,
      "-an",
      ...stockH264Args({ crf: "20" }),
      out,
    ],
    { cwd: tempDir, timeout: 120000, maxBuffer: 20_000_000 },
  );
  return out;
}

export async function renderImageSegment(ffmpegPath, tempDir, imageUrl, segment, index) {
  const ext = /^https?:\/\//i.test(String(imageUrl || "")) ? path.extname(new URL(imageUrl).pathname) || ".jpg" : path.extname(String(imageUrl || "")) || ".jpg";
  const imagePath = await downloadAsset(imageUrl, tempDir, `image-${String(index + 1).padStart(3, "0")}${ext}`);
  const out = path.join(tempDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
  await execFileAsync(
    ffmpegPath,
    [
      "-y",
      "-loop",
      "1",
      "-i",
      imagePath,
      "-t",
      Math.max(0.6, segment.durationSeconds).toFixed(3),
      "-vf",
      `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},setsar=1,fps=${VIDEO_FPS},format=yuv420p`,
      "-an",
      ...stockH264Args({ crf: "20" }),
      out,
    ],
    { timeout: 120000, maxBuffer: 20_000_000 },
  );
  return out;
}

export async function renderClipSegment(ffmpegPath, tempDir, clipUrl, segment, index) {
  const clipPath = await downloadAsset(clipUrl, tempDir, `clip-${String(index + 1).padStart(3, "0")}.mp4`);
  const out = path.join(tempDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
  await execFileAsync(
    ffmpegPath,
    [
      "-y",
      "-stream_loop",
      "-1",
      "-i",
      clipPath,
      "-t",
      Math.max(0.6, segment.durationSeconds).toFixed(3),
      "-vf",
      `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},setsar=1,fps=${VIDEO_FPS},format=yuv420p`,
      "-an",
      ...stockH264Args({ crf: "20" }),
      out,
    ],
    { timeout: 180000, maxBuffer: 20_000_000 },
  );
  return out;
}

export async function renderClipSegmentWithEntityOverlay(ffmpegPath, tempDir, clipUrl, segment, index) {
  const overlayItems = Array.isArray(segment.entityOverlay?.assets) ? segment.entityOverlay.assets.filter((item) => item?.asset?.url).slice(0, 2) : [];
  if (!overlayItems.length) {
    return renderClipSegment(ffmpegPath, tempDir, clipUrl, segment, index);
  }
  const clipPath = await downloadAsset(clipUrl, tempDir, `clip-${String(index + 1).padStart(3, "0")}.mp4`);
  const imagePaths = [];
  for (const [overlayIndex, item] of overlayItems.entries()) {
    const ext = path.extname(String(item.asset.url || "")) || ".jpg";
    imagePaths.push(await downloadAsset(item.asset.url, tempDir, `entity-${String(index + 1).padStart(3, "0")}-${overlayIndex + 1}${ext}`));
  }
  const out = path.join(tempDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
  const inputs = ["-stream_loop", "-1", "-i", clipPath];
  for (const imagePath of imagePaths) {
    inputs.push("-loop", "1", "-i", imagePath);
  }
  const duration = Math.max(0.6, segment.durationSeconds).toFixed(3);
  const bg = `[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},setsar=1,fps=${VIDEO_FPS},eq=brightness=-0.08:saturation=0.9[bg]`;
  const filters = [bg];
  let last = "bg";
  if (imagePaths.length === 1) {
    filters.push("[1:v]scale=820:980:force_original_aspect_ratio=decrease,pad=860:1020:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[entity1]");
    filters.push(`[${last}]drawbox=x=90:y=135:w=900:h=1100:color=black@0.28:t=fill[cardbg]`);
    filters.push("[cardbg][entity1]overlay=x=(W-w)/2:y=175,format=yuv420p[vout]");
  } else {
    filters.push("[1:v]scale=500:760:force_original_aspect_ratio=decrease,pad=500:780:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[entity1]");
    filters.push("[2:v]scale=500:760:force_original_aspect_ratio=decrease,pad=500:780:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[entity2]");
    filters.push(`[${last}]drawbox=x=25:y=190:w=1030:h=860:color=black@0.28:t=fill[splitbg]`);
    filters.push("[splitbg][entity1]overlay=x=35:y=230[tmp1]");
    filters.push("[tmp1][entity2]overlay=x=545:y=230,format=yuv420p[vout]");
  }
  await execFileAsync(
    ffmpegPath,
    [
      "-y",
      ...inputs,
      "-t",
      duration,
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[vout]",
      "-an",
      ...stockH264Args({ crf: "20" }),
      out,
    ],
    { timeout: 180000, maxBuffer: 20_000_000 },
  );
  return out;
}

export function visualSegmentsForRender(visualSegments = [], totalDuration = 0) {
  const segments = (Array.isArray(visualSegments) ? visualSegments : [])
    .filter((segment) => Number.isFinite(Number(segment.startTime)) || Number.isFinite(Number(segment.endTime)) || Number.isFinite(Number(segment.durationSeconds)))
    .sort((a, b) => Number(a.startTime || 0) - Number(b.startTime || 0));
  if (!segments.length) {
    return [];
  }
  const safeTotal = Math.max(
    Number(totalDuration || 0) || 0,
    ...segments.map((segment) => Number(segment.endTime || 0) || 0),
    segments.reduce((sum, segment) => sum + Math.max(0.6, Number(segment.durationSeconds || 0) || 0), 0),
  );
  return segments.map((segment, index) => {
    const start = Math.max(0, Number(segment.startTime || 0) || 0);
    const nextStart = index < segments.length - 1 ? Math.max(start, Number(segments[index + 1].startTime || 0) || 0) : safeTotal;
    const plannedEnd = Math.max(Number(segment.endTime || 0) || 0, nextStart || 0, start + Math.max(0.6, Number(segment.durationSeconds || 0) || 0));
    const end = Math.max(start + 0.6, Math.min(safeTotal || plannedEnd, plannedEnd));
    return {
      ...segment,
      renderStartTime: start,
      renderEndTime: end,
      renderDurationSeconds: Math.max(0.6, end - start),
      durationSeconds: Math.max(0.6, end - start),
    };
  });
}

export function bgmMoodForRun(run) {
  const text = `${run.selectedScript?.styleId || ""} ${run.selectedScript?.text || ""} ${run.tts?.mood || ""}`.toLowerCase();
  if (/hype|urgent|must win|knockout|shock|break/i.test(text)) {
    return "hype";
  }
  if (/funny|joke|group chat|courtroom|cooked|puck|fan/.test(text)) {
    return "funny";
  }
  if (/chaos|panic|trap|fraud|debate|hot take|contrarian/.test(text)) {
    return "debate";
  }
  if (/dramatic|legacy|pressure|sulafat|cinematic/.test(text)) {
    return "dramatic";
  }
  if (/emotional|heartbreak|last dance|dream|hope/.test(text)) {
    return "emotional";
  }
  return "analysis";
}

export function resolveBgmMood(run, options = {}) {
  const preset = normalizeWorldCupBgmPreset(options.bgmPreset || WORLD_CUP_BGM_PRESET);
  if (preset === "off") {
    return "off";
  }
  return preset === "auto" ? bgmMoodForRun(run) : preset;
}

export function defaultBgmVolumeForMood(mood) {
  const values = {
    funny: 0.2,
    debate: 0.19,
    dramatic: 0.17,
    emotional: 0.14,
    analysis: 0.16,
    hype: 0.22,
  };
  return values[mood] || WORLD_CUP_BGM_VOLUME;
}

export function resolveBgmVolume(options = {}, mood = "analysis") {
  const explicit = Number(options.bgmVolume);
  if (Number.isFinite(explicit) && explicit > 0 && Math.abs(explicit - WORLD_CUP_BGM_VOLUME) > 0.001) {
    return Math.min(0.35, Math.max(0.02, explicit));
  }
  return Math.min(0.35, Math.max(0.02, defaultBgmVolumeForMood(mood)));
}

export async function ensureSyntheticBgmTrack(ffmpegPath, mood, warnings) {
  await ensureWorldCupDirs();
  const safeMood = ["analysis", "funny", "debate", "dramatic", "emotional", "hype"].includes(mood) ? mood : "analysis";
  const out = path.join(bgmRoot, `${safeMood}-pulse-64s.wav`);
  if (await fileExists(out)) {
    return out;
  }
  const tones =
    safeMood === "funny"
      ? { low: 92, mid: 184, high: 368, lowVolume: 0.040, midVolume: 0.014, highVolume: 0.007, noise: 0.010 }
      : safeMood === "debate"
        ? { low: 74, mid: 148, high: 296, lowVolume: 0.050, midVolume: 0.015, highVolume: 0.008, noise: 0.012 }
        : safeMood === "hype"
          ? { low: 82, mid: 164, high: 328, lowVolume: 0.058, midVolume: 0.018, highVolume: 0.009, noise: 0.014 }
          : safeMood === "dramatic"
            ? { low: 55, mid: 110, high: 220, lowVolume: 0.045, midVolume: 0.012, highVolume: 0.006, noise: 0.009 }
            : safeMood === "emotional"
              ? { low: 62, mid: 124, high: 248, lowVolume: 0.035, midVolume: 0.010, highVolume: 0.005, noise: 0.006 }
              : { low: 64, mid: 128, high: 256, lowVolume: 0.038, midVolume: 0.011, highVolume: 0.006, noise: 0.008 };
  try {
    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `sine=frequency=${tones.low}:sample_rate=48000:duration=64`,
        "-f",
        "lavfi",
        "-i",
        `sine=frequency=${tones.mid}:sample_rate=48000:duration=64`,
        "-f",
        "lavfi",
        "-i",
        `sine=frequency=${tones.high}:sample_rate=48000:duration=64`,
        "-f",
        "lavfi",
        "-i",
        "anoisesrc=color=pink:sample_rate=48000:duration=64",
        "-filter_complex",
        `[0:a]volume=${tones.lowVolume},lowpass=f=180[low];` +
          `[1:a]volume=${tones.midVolume},lowpass=f=650[mid];` +
          `[2:a]volume=${tones.highVolume},lowpass=f=1200[high];` +
          `[3:a]volume=${tones.noise},lowpass=f=900,highpass=f=90[air];` +
          "[low][mid][high][air]amix=inputs=4:duration=first," +
          "acompressor=threshold=-28dB:ratio=1.8:attack=30:release=300," +
          "afade=t=in:st=0:d=0.8,afade=t=out:st=62.5:d=1.5[out]",
        "-map",
        "[out]",
        "-c:a",
        "pcm_s16le",
        out,
      ],
      { timeout: 60000, maxBuffer: 10_000_000 },
    );
    return out;
  } catch (error) {
    warnings.push(`Synthetic BGM generation skipped: ${error.message}`);
    return "";
  }
}

export async function resolveBgmTrack({ run, options, ffmpegPath, warnings }) {
  const enabled = normalizeBool(options.bgm ?? options.backgroundMusic, WORLD_CUP_ENABLE_BGM);
  const mode = cleanText(options.bgmMode || WORLD_CUP_BGM_MODE || "auto").toLowerCase();
  const mood = resolveBgmMood(run, options);
  if (!enabled || mode === "off" || mood === "off") {
    return null;
  }
  const localFile = cleanText(options.bgmFile || WORLD_CUP_BGM_FILE);
  if ((mode === "file" || mode === "auto") && localFile && (await fileExists(localFile))) {
    return {
      path: localFile,
      source: "local-file",
      mood,
      volume: resolveBgmVolume(options, mood),
    };
  }
  const syntheticPath = await ensureSyntheticBgmTrack(ffmpegPath, mood, warnings);
  return syntheticPath
    ? {
        path: syntheticPath,
        source: "synthetic-safe-pulse",
        mood,
        volume: resolveBgmVolume(options, mood),
      }
    : null;
}

export function voiceAudioFilter(runOrOptions = {}) {
  if (isViral2(runOrOptions)) {
    const volume = Math.max(WORLD_CUP_VOICE_VOLUME, 1.65).toFixed(2);
    return `volume=${volume},acompressor=threshold=-22dB:ratio=3.2:attack=4:release=80,loudnorm=I=-16:LRA=9:TP=-1.5,alimiter=limit=0.96`;
  }
  return `volume=${WORLD_CUP_VOICE_VOLUME.toFixed(2)},acompressor=threshold=-18dB:ratio=2.5:attack=6:release=90,alimiter=limit=0.95`;
}

export function bgmAudioFilter(volume, duration, fadeOutStart) {
  return `volume=${volume},acompressor=threshold=-24dB:ratio=1.5:attack=20:release=180,atrim=0:${duration},afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutStart}:d=1.2,asetpts=PTS-STARTPTS`;
}

export function maxCaptionGap(segments = [], totalDuration = 0) {
  let gap = 0;
  let cursor = 0;
  for (const segment of segments) {
    gap = Math.max(gap, Math.max(0, Number(segment.startTime || 0) - cursor));
    cursor = Math.max(cursor, Number(segment.endTime || 0));
  }
  if (totalDuration) {
    gap = Math.max(gap, Math.max(0, totalDuration - cursor));
  }
  return gap;
}

export async function analyzeRenderedAudio(ffmpegPath, outputPath) {
  const nullTarget = process.platform === "win32" ? "NUL" : "/dev/null";
  try {
    const result = await execFileAsync(
      ffmpegPath,
      ["-hide_banner", "-i", outputPath, "-af", "volumedetect", "-f", "null", nullTarget],
      { timeout: 90000, maxBuffer: 20_000_000 },
    );
    const text = `${result.stdout || ""}\n${result.stderr || ""}`;
    return {
      meanVolumeDb: Number((text.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i) || [])[1] || NaN),
      maxVolumeDb: Number((text.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i) || [])[1] || NaN),
    };
  } catch (error) {
    return { error: error.message };
  }
}

export async function buildPostRenderQuality({ run, outputPath, ffmpegPath, renderLog = null }) {
  const totalDuration = Number(run.audio?.durationSeconds || run.srt?.durationSeconds || 0) || 0;
  const segments = Array.isArray(run.srt?.segments) ? run.srt.segments : [];
  const visualSegments = Array.isArray(run.visualPlan?.segments) ? run.visualPlan.segments : [];
  const renderedSegments = Array.isArray(renderLog?.segments) ? renderLog.segments : [];
  const actualVisuals = renderedSegments.length
    ? renderedSegments.map((segment, index) => ({
        id: `${segment.source || "unknown"}-${segment.number || index + 1}`,
        source: cleanText(segment.source || "unknown"),
        selectedClip: /pexels|pixabay|stock/i.test(segment.source || ""),
        selectedImage: /image|wikimedia|local-asset-pack|local-entity/i.test(segment.source || ""),
        entityOverlay: /local-entity-overlay/i.test(segment.source || ""),
        fallback: /fallback/i.test(segment.source || ""),
      }))
    : visualSegments;
  const visualIds = actualVisuals.map((segment, index) => segment.selectedClip?.id || segment.selectedImage?.id || segment.id || `fallback-${segment.number || index + 1}`).filter(Boolean);
  const uniqueVisualRatio = visualIds.length ? new Set(visualIds).size / visualIds.length : 0;
  const realVisualCount = actualVisuals.filter((segment) => (segment.selectedClip || segment.selectedImage) && !segment.fallback).length;
  const realVisualRatio = actualVisuals.length ? realVisualCount / actualVisuals.length : 0;
  const clipCount = actualVisuals.filter((segment) => segment.selectedClip && !segment.fallback).length;
  const clipRatio = actualVisuals.length ? clipCount / actualVisuals.length : 0;
  const fallbackCount = actualVisuals.filter((segment) => segment.fallback).length;
  const localProofCount = actualVisuals.filter((segment) => cleanText(segment.source).toLowerCase() === "local-asset-pack").length;
  const localEntityOverlayCount = actualVisuals.filter((segment) => segment.entityOverlay || /local-entity-overlay/i.test(segment.source || "")).length;
  const captionTotal = segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.endTime || 0) - Number(segment.startTime || 0)), 0);
  const captionCoverage = totalDuration ? Math.min(1, captionTotal / totalDuration) : 0;
  const captionGap = maxCaptionGap(segments, totalDuration);
  const audio = await analyzeRenderedAudio(ffmpegPath, outputPath);
  const firstHook = firstSentence(run.selectedScript?.text || run.tts?.screenplay || "");
  const firstThree = scoreFirstThreeSecondHook(run.selectedScript?.text || run.tts?.screenplay || "", run.evidence || {});
  const checks = {
    firstHookStrong: hasViralContradiction(firstHook) && firstThree.decision === "pass",
    firstThreeSeconds: firstThree,
    uniqueVisualRatio: Number(uniqueVisualRatio.toFixed(2)),
    realVisualRatio: Number(realVisualRatio.toFixed(2)),
    clipRatio: Number(clipRatio.toFixed(2)),
    fallbackCount,
    localEntityOverlayCount,
    localProofCount,
    captionCoverage: Number(captionCoverage.toFixed(2)),
    maxCaptionGapSeconds: Number(captionGap.toFixed(2)),
    audio,
  };
  const issues = [];
  if (run.strategy === "viral2" && !checks.firstHookStrong) {
    issues.push("First hook is not a sharp contradiction.");
  }
  if (fallbackCount > 0) {
    issues.push(`${fallbackCount} rendered segments used fallback cards.`);
  }
  if (localProofCount > WORLD_CUP_LOCAL_PROOF_MAX_PER_VIDEO) {
    issues.push(`Local proof images appeared ${localProofCount} times; limit is ${WORLD_CUP_LOCAL_PROOF_MAX_PER_VIDEO}.`);
  }
  if (visualIds.length >= 4 && uniqueVisualRatio < 0.72) {
    issues.push("Visual repetition is still too high.");
  }
  if (actualVisuals.length >= 4 && realVisualRatio < WORLD_CUP_MIN_REAL_VISUAL_RATIO) {
    issues.push(`Too many fallback boards; real image/clip coverage is ${Math.round(realVisualRatio * 100)}%.`);
  }
  if (actualVisuals.length >= 4 && clipRatio < WORLD_CUP_MIN_CLIP_RATIO) {
    issues.push(`Too few video clips; clip coverage is ${Math.round(clipRatio * 100)}%.`);
  }
  if (captionCoverage < 0.72 || captionGap > 1.4) {
    issues.push("Caption coverage/gaps may hurt retention.");
  }
  if (Number.isFinite(audio.meanVolumeDb) && audio.meanVolumeDb < -28) {
    issues.push(`Rendered audio is still quiet (mean ${audio.meanVolumeDb.toFixed(1)} dB).`);
  }
  if (run.bgm?.enabled !== false && run.bgm?.volume && Number(run.bgm.volume) < 0.14) {
    issues.push(`Background music is likely too low (${Number(run.bgm.volume).toFixed(2)}).`);
  }
  let score = 84;
  score -= issues.length * 10;
  if (checks.firstHookStrong) score += 4;
  if (uniqueVisualRatio >= 0.85) score += 4;
  if (realVisualRatio >= WORLD_CUP_MIN_REAL_VISUAL_RATIO) score += 4;
  if (clipRatio >= WORLD_CUP_MIN_CLIP_RATIO) score += 4;
  if (captionCoverage >= 0.85) score += 4;
  if (Number.isFinite(audio.meanVolumeDb) && audio.meanVolumeDb >= -24) score += 4;
  if (run.bgm?.volume && Number(run.bgm.volume) >= 0.16) score += 3;
  if (issues.length) {
    score = Math.min(score, 82);
  } else {
    score = Math.min(score, 95);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    decision: issues.length ? (score >= 65 ? "revise" : "discard") : score >= 82 ? "publish_candidate" : "revise",
    issues,
    checks,
    checkedAt: nowIso(),
  };
}

export async function renderWorldCupRun(id, options = {}) {
  const run = await readWorldCupRun(id);
  const ffmpegPath = await resolveFfmpegPath();
  const runDir = path.join(runsRoot, run.id);
  const tempDir = await fs.mkdtemp(path.join(tempRoot, `render-${run.id}-`));
  const renderLog = {
    startedAt: nowIso(),
    ffmpegPath,
    segments: [],
    warnings: [],
  };
  try {
    const audioPath = run.files.audio ? path.join(runDir, run.files.audio) : "";
    const totalDuration = Number(run.audio?.durationSeconds || run.srt?.durationSeconds || 45) || 45;
    const includeAudio = Boolean(audioPath && (await fileExists(audioPath)));
    const allowSilentRender = normalizeBool(options.allowSilentRender ?? options.allowSilent ?? options.silentOk, false);
    if (!includeAudio && !allowSilentRender) {
      throw new WorldCupError("Refusing to render World Cup MP4 without generated TTS audio.", {
        status: 422,
        code: "WORLD_CUP_RENDER_REQUIRES_AUDIO",
        details: {
          audio: run.audio || {},
          hint: "Fix TTS/API errors, or pass allowSilentRender=true only for local visual tests.",
        },
      });
    }
    const segmentPaths = [];
    const visualSegments = visualSegmentsForRender(run.visualPlan?.segments || [], totalDuration);
    const plannedRealVisualCount = visualSegments.filter((segment) => segment.selectedClip || segment.selectedImage).length;
    const plannedRealVisualRatio = visualSegments.length ? plannedRealVisualCount / visualSegments.length : 0;
    const allowFallbackVisuals = normalizeBool(options.allowFallbackVisuals ?? options.allowFallbackVisualRender ?? options.fallbackVisualsOk, false);
    if (visualSegments.length >= 4 && plannedRealVisualRatio < WORLD_CUP_MIN_REAL_VISUAL_RATIO && !allowFallbackVisuals) {
      throw new WorldCupError("Refusing to render World Cup MP4 with too many fallback boards.", {
        status: 422,
        code: "WORLD_CUP_RENDER_NEEDS_REAL_VISUALS",
        details: {
          realVisualRatio: Number(plannedRealVisualRatio.toFixed(2)),
          requiredRealVisualRatio: WORLD_CUP_MIN_REAL_VISUAL_RATIO,
          hint: "Improve Pexels/Pixabay/Wikimedia visual sourcing, or pass allowFallbackVisuals=true only for local layout tests.",
        },
      });
    }
    for (const [index, segment] of visualSegments.entries()) {
      try {
        let segmentPath = "";
        const safeSelectedClip =
          segment.selectedClip && candidateAllowedByReview(segment.selectedClip) && !clipLooksContextMismatched(segment.selectedClip, run.evidence || {})
            ? segment.selectedClip
            : null;
        if (segment.selectedClip && !safeSelectedClip) {
          renderLog.warnings.push(`Segment ${segment.number || index + 1} replaced off-topic stock clip with fallback visual.`);
        }
        if (safeSelectedClip?.url && segment.entityOverlay?.assets?.length) {
          segmentPath = await renderClipSegmentWithEntityOverlay(ffmpegPath, tempDir, safeSelectedClip.url, segment, index);
        } else if (segment.selectedImage?.url) {
          segmentPath = await renderImageSegment(ffmpegPath, tempDir, segment.selectedImage.url, segment, index);
        } else if (safeSelectedClip?.url) {
          segmentPath = await renderClipSegment(ffmpegPath, tempDir, safeSelectedClip.url, segment, index);
        } else {
          segmentPath = await renderFallbackCard(ffmpegPath, tempDir, segment, index);
        }
        segmentPaths.push(segmentPath);
        renderLog.segments.push({
          number: segment.number,
          source: segment.entityOverlay?.assets?.length && safeSelectedClip ? `${safeSelectedClip.provider}+local-entity-overlay` : segment.selectedImage ? segment.selectedImage.provider || "image" : safeSelectedClip ? safeSelectedClip.provider : "fallback-card",
          entityOverlay: segment.entityOverlay
            ? {
                mode: segment.entityOverlay.mode,
                entities: segment.entityOverlay.assets?.map((item) => item.entity).filter(Boolean) || [],
              }
            : null,
          durationSeconds: Number(segment.durationSeconds || 0),
          startTime: Number(segment.renderStartTime ?? segment.startTime ?? 0),
          endTime: Number(segment.renderEndTime ?? segment.endTime ?? 0),
        });
      } catch (error) {
        renderLog.warnings.push(`Segment ${segment.number || index + 1} used fallback: ${error.message}`);
        segmentPaths.push(await renderFallbackCard(ffmpegPath, tempDir, segment, index));
      }
    }
    if (!segmentPaths.length) {
      const fallback = estimateSrtFromText(run.tts?.screenplay || run.selectedScript?.text || "World Cup Chaos Desk", 45);
      for (const [index, segment] of fallback.segments.entries()) {
        segmentPaths.push(await renderFallbackCard(ffmpegPath, tempDir, { ...segment, captionText: segment.text, fallbackVisual: fallbackVisualForSegment(segment, run.evidence || {}) }, index));
      }
    }
    const concatPath = path.join(tempDir, "clips.ffconcat");
    await fs.writeFile(
      concatPath,
      ["ffconcat version 1.0", ...segmentPaths.map((filePath) => `file '${ffmpegConcatPath(filePath)}'`)].join("\n") + "\n",
      "utf8",
    );
    const visualPath = path.join(tempDir, "visual.mp4");
    await execFileAsync(
      ffmpegPath,
      ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-fps_mode", "cfr", "-r", String(VIDEO_FPS), ...stockH264Args(), visualPath],
      { timeout: 240000, maxBuffer: 20_000_000 },
    );
    renderLog.visualTimeline = {
      targetDurationSeconds: totalDuration,
      plannedDurationSeconds: Number(visualSegments.reduce((sum, segment) => sum + Math.max(0.6, Number(segment.durationSeconds || 0) || 0), 0).toFixed(3)),
      mode: "caption-gaps-filled-no-final-loop",
    };

    const srtText = await fs.readFile(path.join(runDir, run.files.srt || "srt.srt"), "utf8").catch(() => buildSrt(run.srt?.segments || []));
    const assPath = path.join(tempDir, "captions.ass");
    await fs.writeFile(assPath, buildAssFromSrt(srtText, run.captionPlan || run.viralStrategy?.captionInstructions || {}), "utf8");
    const outputPath = path.join(runDir, `${safeFilePart(run.topic)}.mp4`);
    const burnSubtitles = normalizeBool(options.burnSubtitles, true);
    const subtitleFilter = burnSubtitles ? ["-vf", "subtitles=captions.ass"] : [];
    const bgmTrack = includeAudio ? await resolveBgmTrack({ run, options, ffmpegPath, warnings: renderLog.warnings }) : null;
    if (bgmTrack) {
      renderLog.bgm = {
        source: bgmTrack.source,
        mood: bgmTrack.mood,
        volume: bgmTrack.volume,
        file: path.basename(bgmTrack.path),
      };
      run.bgm = renderLog.bgm;
    } else {
      run.bgm = { enabled: false };
    }

    if (includeAudio && bgmTrack) {
      const fadeOutStart = Math.max(0, totalDuration - 1.2).toFixed(3);
      const duration = totalDuration.toFixed(3);
      const volume = Number(bgmTrack.volume || WORLD_CUP_BGM_VOLUME).toFixed(3);
      const filterGraph = [
        burnSubtitles ? "[0:v]subtitles=captions.ass[vout]" : "",
        `[1:a]${voiceAudioFilter(run)}[voicebase]`,
        "[voicebase]asplit=2[voice_sc][voice_mix]",
        `[2:a]${bgmAudioFilter(volume, duration, fadeOutStart)}[bgmraw]`,
        "[bgmraw][voice_sc]sidechaincompress=threshold=0.055:ratio=3.5:attack=28:release=220:makeup=1.2[duckedbgm]",
        "[voice_mix][duckedbgm]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.96[aout]",
      ]
        .filter(Boolean)
        .join(";");
      await execFileAsync(
        ffmpegPath,
        [
          "-y",
          "-i",
          visualPath,
          "-i",
          audioPath,
          "-stream_loop",
          "-1",
          "-i",
          bgmTrack.path,
          "-filter_complex",
          filterGraph,
          "-map",
          burnSubtitles ? "[vout]" : "0:v:0",
          "-map",
          "[aout]",
          ...stockH264Args(),
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-t",
          duration,
          outputPath,
        ],
        { cwd: tempDir, timeout: 300000, maxBuffer: 20_000_000 },
      );
    } else if (includeAudio) {
      await execFileAsync(
        ffmpegPath,
        [
          "-y",
          "-i",
          visualPath,
          "-i",
          audioPath,
          ...subtitleFilter,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-af",
          voiceAudioFilter(run),
          ...stockH264Args(),
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-t",
          totalDuration.toFixed(3),
          outputPath,
        ],
        { cwd: tempDir, timeout: 300000, maxBuffer: 20_000_000 },
      );
    } else {
      await execFileAsync(
        ffmpegPath,
        [
          "-y",
          "-i",
          visualPath,
          "-f",
          "lavfi",
          "-t",
          totalDuration.toFixed(3),
          "-i",
          "anullsrc=channel_layout=stereo:sample_rate=48000",
          ...subtitleFilter,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          ...stockH264Args(),
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-t",
          totalDuration.toFixed(3),
          outputPath,
        ],
        { cwd: tempDir, timeout: 300000, maxBuffer: 20_000_000 },
      );
    }

    run.postRenderQuality = await buildPostRenderQuality({ run, outputPath, ffmpegPath, renderLog });
    renderLog.postRenderQuality = run.postRenderQuality;
    renderLog.completedAt = nowIso();
    renderLog.durationSeconds = totalDuration;
    renderLog.width = VIDEO_WIDTH;
    renderLog.height = VIDEO_HEIGHT;
    renderLog.fps = VIDEO_FPS;
    run.status = "rendered";
    run.files.mp4 = path.basename(outputPath);
    run.files.quality = await writeRunFile(run, "quality.json", `${JSON.stringify(run.postRenderQuality, null, 2)}\n`, "utf8");
    run.files.renderLog = await writeRunFile(run, "render-log.json", `${JSON.stringify(renderLog, null, 2)}\n`, "utf8");
    const priorWarnings = (run.warnings || []).filter(
      (warning) =>
        !/^Segment \d+ used fallback:/i.test(warning) &&
        !/^Segment \d+ replaced off-topic stock clip with fallback visual\./i.test(warning) &&
        !/^Synthetic BGM generation skipped:/i.test(warning),
    );
    run.warnings = [...priorWarnings, ...renderLog.warnings];
    run.review = reviewWorldCupRun(run);
    return await saveRun(run);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function rebuildWorldCupVisuals(id, input = {}) {
  const run = await readWorldCupRun(id);
  const options = normalizeWorldCupInput({ ...input, id: run.id });
  const keyInfo = await getActiveGeminiKey();
  run.warnings = Array.isArray(run.warnings) ? run.warnings : [];
  run.visualPlan = await planWorldCupVisualsWithRetries({ run, keyInfo, options });
  run.attributions = run.visualPlan.attributions || [];
  run.rightsManifest = buildRightsManifest(run.visualPlan);
  run.files.visuals = await writeRunFile(run, "visuals.json", `${JSON.stringify(run.visualPlan, null, 2)}\n`, "utf8");
  run.files.attribution = await writeRunFile(run, "attribution.json", `${JSON.stringify(run.attributions, null, 2)}\n`, "utf8");
  run.files.rights = await writeRunFile(run, "rights.json", `${JSON.stringify(run.rightsManifest, null, 2)}\n`, "utf8");
  run.review = reviewWorldCupRun(run);
  run.status = visualPlanNeedsRetry(run.visualPlan) ? "needs_visual_review" : "generated";
  return await saveRun(run);
}
