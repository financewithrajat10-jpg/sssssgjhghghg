import { fileExists, fs, path } from "./utils.mjs";
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
  WORLD_CUP_CLIP_REUSE_COOLDOWN_VIDEOS,
  WORLD_CUP_DRIVE_FALLBACK_TELEGRAM,
  WORLD_CUP_ENABLE_BGM,
  WORLD_CUP_ENABLE_LOCAL_ENTITY_ASSETS,
  WORLD_CUP_ENABLE_WIKIMEDIA_VISUALS,
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
  FOOTBALL_JOKE_LINES,
  buildViral2Strategy,
  clampScore,
  collectWorldCupData,
  consolidateWorldCupEvidence,
  detectScriptPromiseContract,
  evaluateScriptPromiseContract,
  extractCommentaryEvents,
  extractExplicitPromiseItems,
  fallbackEvidence,
  fallbackScripts,
  fallbackTtsRewrite,
  fetchText,
  firstSentence,
  firstThreeSecondHook,
  footballJokeLine,
  generateScripts,
  hardenViralOpening,
  hardenedOpeningForEvidence,
  hasHardStat,
  hasMemorableFootballLine,
  hasViralContradiction,
  heuristicScriptScore,
  judgeScripts,
  labelPromiseItem,
  localCommentaryExtractor,
  localViralHookLab,
  localViralTopicScore,
  normalizeEvidencePack,
  normalizePromiseText,
  normalizeViralStrategy,
  numberWordToInt,
  polishScriptForShorts,
  promiseItemMatchesText,
  promiseRepairOpening,
  repairScriptPromiseContract,
  reviseViral2Script,
  reviseWeakScript,
  rewriteForTts,
  sanitizeScriptAgainstEvidence,
  scoreFirstThreeSecondHook,
  scoreViral2Script,
  scriptPromiseSubject,
  softenWorldCupShortsTone,
  stripHtml,
  topicNamesForViral,
  totalJudgeScore,
  trustedSourceClaims,
  worldCupResearchPasses,
} from "./script.mjs";
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
  listWorldCupRuns,
  loadWorldCupMemory,
  memoryPrompt,
  readWorldCupRun,
  rebuildWorldCupIndex,
  runSummary,
  saveRun,
  writeRunFile,
} from "./memory.mjs";

export function commonsAssetFromImageInfo({ page, info, sourcePlayer = "", sourceTeam = "", query = "" }) {
  if (!info?.url && !info?.thumburl) {
    return null;
  }
  const metadata = info.extmetadata || {};
  const license = stripHtml(metadata.LicenseShortName?.value || metadata.License?.value || "");
  const mime = cleanText(info.mime || "");
  if (!/(public domain|cc|creative commons|gfdl)/i.test(license) || /(fair use|non-free|copyrighted)/i.test(license)) {
    return null;
  }
  if (mime && !/^image\/(jpeg|png|webp)$/i.test(mime)) {
    return null;
  }
  const url = info.thumburl || info.url;
  const title = cleanText(metadata.ObjectName?.value || page?.title || query);
  const description = stripHtml(metadata.ImageDescription?.value || "");
  const pageTitle = cleanText(page?.title || "");
  if (isWrongCommonsFootballResult({ title, description, pageTitle, query, sourcePlayer, sourceTeam })) {
    return null;
  }
  return {
    id: `wikimedia-${hashText(url)}`,
    type: "image",
    provider: "wikimedia",
    url,
    preview: url,
    pageUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page?.title || "").replace(/ /g, "_"))}`,
    title,
    creator: stripHtml(metadata.Artist?.value || ""),
    license,
    rightsStatus: "approved",
    sourcePlayer,
    sourceTeam,
    query,
  };
}

export function isWrongCommonsFootballResult({ title = "", description = "", pageTitle = "", query = "", sourcePlayer = "", sourceTeam = "" } = {}) {
  const requestedFootballProof = /\b(football|footballer|soccer|player|team|national|world cup|fifa|uefa|club|fc)\b/i.test(`${query} ${sourcePlayer} ${sourceTeam}`);
  if (!requestedFootballProof) {
    return false;
  }
  const assetText = cleanText(`${title} ${description} ${pageTitle}`).toLowerCase();
  const hasFootballContext = /\b(football|footballer|soccer|futbol|fútbol|player|team|club|fc|f\.c\.|stadium|match|training|cup|league|uefa|fifa|la liga|premier league|national team)\b/i.test(assetText);
  const looksLikeBiologyOrSpecimen = /\b(fish|species|specimen|museum|zoolog|taxonomy|genus|female|male|bird|insect|plant|flora|fauna|mammal|reptile|amphibian|frog|lizard|snake|beetle|butterfly|moth|astyanax|herbarium|fossil|mc[nz]?\s*\d+)\b/i.test(assetText);
  const hasRequestedName = [sourcePlayer, sourceTeam]
    .map(cleanText)
    .filter((value) => value.length >= 3)
    .some((value) => new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(assetText));
  if (looksLikeBiologyOrSpecimen && !hasFootballContext) {
    return true;
  }
  if (sourcePlayer && !hasRequestedName && !hasFootballContext) {
    return true;
  }
  return false;
}

export async function searchLicensedCommonsImage(query, { sourcePlayer = "", sourceTeam = "" } = {}) {
  const search = cleanText(query);
  if (!search) {
    return null;
  }
  try {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query" +
      `&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(search)}` +
      `&prop=imageinfo&iiprop=${encodeURIComponent("url|extmetadata|mime")}&iiurlwidth=1400&format=json&origin=*`;
    const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
    recordApiUsage({ provider: "wikimedia", operation: "commons.search", status: response.ok ? "success" : "failed", details: { query: search, status: response.status } });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const pages = Object.values(data?.query?.pages || {});
    for (const page of pages) {
      const asset = commonsAssetFromImageInfo({ page, info: page?.imageinfo?.[0], sourcePlayer, sourceTeam, query: search });
      if (asset) {
        return asset;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function resolveWikimediaPlayerImage(playerName, team) {
  const query = cleanText(`${playerName} ${team || ""} footballer`);
  if (!query) {
    return null;
  }
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*`;
    const searchResponse = await fetchWithTimeout(searchUrl, { headers: { Accept: "application/json" } });
    recordApiUsage({ provider: "wikimedia", operation: "wikidata.search", status: searchResponse.ok ? "success" : "failed", details: { query, status: searchResponse.status } });
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      const id = searchData?.search?.[0]?.id;
      if (id) {
        const claimUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${encodeURIComponent(id)}&property=P18&format=json&origin=*`;
        const claimResponse = await fetchWithTimeout(claimUrl, { headers: { Accept: "application/json" } });
        recordApiUsage({ provider: "wikimedia", operation: "wikidata.p18", status: claimResponse.ok ? "success" : "failed", details: { entity: id, status: claimResponse.status } });
        if (claimResponse.ok) {
          const claimData = await claimResponse.json();
          const fileName = claimData?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
          if (fileName) {
            const title = `File:${fileName}`;
            const infoUrl =
              `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}` +
              `&prop=imageinfo&iiprop=${encodeURIComponent("url|extmetadata|mime")}&iiurlwidth=1400&format=json&origin=*`;
            const infoResponse = await fetchWithTimeout(infoUrl, { headers: { Accept: "application/json" } });
            recordApiUsage({ provider: "wikimedia", operation: "commons.imageinfo", status: infoResponse.ok ? "success" : "failed", details: { title, status: infoResponse.status } });
            if (infoResponse.ok) {
              const infoData = await infoResponse.json();
              const page = Object.values(infoData?.query?.pages || {})[0];
              const asset = commonsAssetFromImageInfo({
                page,
                info: page?.imageinfo?.[0],
                sourcePlayer: playerName,
                sourceTeam: team || "",
                query,
              });
              if (asset) {
                return asset;
              }
            }
          }
        }
      }
    }
  } catch {
    // Commons search below is the fallback.
  }
  return await searchLicensedCommonsImage(query, { sourcePlayer: playerName, sourceTeam: team || "" });
}

export async function resolveWikimediaTeamImage(teamName) {
  const cleaned = cleanText(teamName);
  if (!cleaned) {
    return null;
  }
  return (
    (await searchLicensedCommonsImage(`${cleaned} national football team`, { sourcePlayer: cleaned, sourceTeam: cleaned })) ||
    (await searchLicensedCommonsImage(`${cleaned} soccer team`, { sourcePlayer: cleaned, sourceTeam: cleaned })) ||
    (await resolveWikimediaPlayerImage(cleaned, "football team"))
  );
}

export async function searchPexelsVideos(query, apiKey, page = 1) {
  if (!apiKey) {
    return [];
  }
  const url = `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=10&page=${encodeURIComponent(page)}`;
  const response = await fetchWithTimeout(url, { headers: { Authorization: apiKey } });
  recordApiUsage({ provider: "stock", operation: "pexels.video.search", status: response.ok ? "success" : "failed", details: { query, page, status: response.status } });
  if (!response.ok) {
    throw new Error(`Pexels HTTP ${response.status}`);
  }
  const data = await response.json();
  return (Array.isArray(data?.videos) ? data.videos : [])
    .map((video) => {
      const files = Array.isArray(video.video_files) ? video.video_files : [];
      const file =
        files
          .filter((item) => item?.link)
          .sort((a, b) => (Number(b.height || 0) >= Number(b.width || 0) ? 1 : 0) - (Number(a.height || 0) >= Number(a.width || 0) ? 1 : 0))[0] ||
        files[0];
      if (!file?.link) {
        return null;
      }
      return {
        id: `pexels-${video.id}-${hashText(file.link)}`,
        provider: "pexels",
        url: file.link,
        preview: video.image || "",
        pageUrl: video.url || "",
        creator: video.user?.name || "",
        duration: Number(video.duration || 0),
        width: Number(file.width || 0),
        height: Number(file.height || 0),
        query,
        page,
        rightsStatus: "approved",
      };
    })
    .filter(Boolean);
}

export async function searchPixabayVideos(query, apiKey, page = 1) {
  if (!apiKey) {
    return [];
  }
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&orientation=vertical&per_page=10&page=${encodeURIComponent(page)}&safesearch=true`;
  const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  recordApiUsage({ provider: "stock", operation: "pixabay.video.search", status: response.ok ? "success" : "failed", details: { query, page, status: response.status } });
  if (!response.ok) {
    throw new Error(`Pixabay HTTP ${response.status}`);
  }
  const data = await response.json();
  return (Array.isArray(data?.hits) ? data.hits : [])
    .map((hit) => {
      const video = hit.videos?.large || hit.videos?.medium || hit.videos?.small || hit.videos?.tiny;
      if (!video?.url) {
        return null;
      }
      return {
        id: `pixabay-${hit.id}-${hashText(video.url)}`,
        provider: "pixabay",
        url: video.url,
        preview: hit.picture_id ? `https://i.vimeocdn.com/video/${hit.picture_id}_640x360.jpg` : "",
        pageUrl: hit.pageURL || "",
        creator: hit.user || "",
        duration: Number(hit.duration || 0),
        width: Number(video.width || 0),
        height: Number(video.height || 0),
        query,
        tags: hit.tags || "",
        page,
        rightsStatus: "approved",
      };
    })
    .filter(Boolean);
}

export function visualCandidateText(candidate) {
  return cleanText(
    [
      candidate.id,
      candidate.provider,
      candidate.type || "video",
      candidate.title,
      candidate.query,
      candidate.pageUrl,
      candidate.tags,
      candidate.creator,
      candidate.sourcePlayer,
      candidate.sourceTeam,
    ].join(" "),
  );
}

export function isPathInside(childPath, parentPath) {
  const child = path.resolve(String(childPath || ""));
  const parent = path.resolve(String(parentPath || ""));
  return child === parent || child.startsWith(`${parent}${path.sep}`);
}

export function mediaMimeType(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export function isImageFile(filePath) {
  return /\.(jpe?g|png|webp)$/i.test(String(filePath || ""));
}

export function isVideoFile(filePath) {
  return /\.(mp4|mov|mkv|webm)$/i.test(String(filePath || ""));
}

export function folderAliasText(folder) {
  return cleanText(String(folder || "").replace(/[._-]+/g, " "));
}

export function entityAliasRegex(alias) {
  const escaped = cleanText(alias)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
}

export function textMentionsAlias(text, alias) {
  const cleanAlias = cleanText(alias).toLowerCase();
  if (!cleanAlias || cleanAlias.length < 3) {
    return false;
  }
  return entityAliasRegex(cleanAlias).test(cleanText(text).toLowerCase());
}

export async function listLocalMediaFiles(folder, mediaType = "image") {
  const root = path.join(localDownloadsRoot, folder);
  if (!isPathInside(root, localDownloadsRoot) || !(await fileExists(root))) {
    return [];
  }
  const preferred = mediaType === "image" ? path.join(root, "Images") : path.join(root, "Reels");
  const roots = (await fileExists(preferred)) ? [preferred, root] : [root];
  const files = [];
  for (const searchRoot of roots) {
    let entries = [];
    try {
      entries = await fs.readdir(searchRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const filePath = path.join(searchRoot, entry.name);
      if (entry.isDirectory() && searchRoot === root && ["Images", "Reels"].includes(entry.name)) {
        continue;
      }
      if (entry.isFile() && (mediaType === "image" ? isImageFile(filePath) : isVideoFile(filePath))) {
        files.push(filePath);
      }
    }
  }
  return [...new Set(files)].sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true }));
}

export async function getLocalEntityCatalog() {
  if (!WORLD_CUP_ENABLE_LOCAL_ENTITY_ASSETS || !(await fileExists(localDownloadsRoot))) {
    return [];
  }
  let folders = [];
  try {
    folders = (await fs.readdir(localDownloadsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
  const hintByFolder = new Map(LOCAL_ENTITY_FOLDER_HINTS.map((hint) => [hint.folder.toLowerCase(), hint]));
  const catalog = [];
  for (const folder of folders) {
    const hint = hintByFolder.get(folder.toLowerCase());
    const imageFiles = await listLocalMediaFiles(folder, "image");
    const videoFiles = await listLocalMediaFiles(folder, "video");
    if (!imageFiles.length && !videoFiles.length) {
      continue;
    }
    const fallbackName = folderAliasText(folder).replace(/\b\w/g, (letter) => letter.toUpperCase());
    const aliases = [
      ...(Array.isArray(hint?.aliases) ? hint.aliases : []),
      hint?.name,
      folder,
      folderAliasText(folder),
    ]
      .map(cleanText)
      .filter(Boolean);
    catalog.push({
      name: hint?.name || fallbackName,
      folder,
      type: hint?.type || "unknown",
      aliases: [...new Set(aliases.map((alias) => alias.toLowerCase()))],
      imageCount: imageFiles.length,
      videoCount: videoFiles.length,
      imageFiles,
      videoFiles,
    });
  }
  return catalog.sort((a, b) => {
    const hintedA = hintByFolder.has(a.folder.toLowerCase()) ? 0 : 1;
    const hintedB = hintByFolder.has(b.folder.toLowerCase()) ? 0 : 1;
    return hintedA - hintedB || b.imageCount - a.imageCount || a.name.localeCompare(b.name);
  });
}

export function localEntityMentionScore(entity, text) {
  let score = 0;
  for (const alias of entity.aliases || []) {
    if (textMentionsAlias(text, alias)) {
      score += alias.split(/\s+/).length > 1 ? 4 : 2;
    }
  }
  return score;
}

export function detectLocalEntitiesHeuristic({ catalog, evidence, selectedScript, srtSegments }) {
  const scriptText = cleanText(selectedScript?.text || selectedScript?.screenplay || "");
  const fullText = cleanText(
    [
      evidence?.topic,
      evidence?.match?.teamA,
      evidence?.match?.teamB,
      ...(Array.isArray(evidence?.keyPlayers) ? evidence.keyPlayers.map((player) => `${player.name || ""} ${player.team || ""}`) : []),
      scriptText,
      ...(Array.isArray(srtSegments) ? srtSegments.map((segment) => segment.text || "") : []),
    ].join(" "),
  );
  return catalog
    .map((entity) => ({
      ...entity,
      priorityScore: localEntityMentionScore(entity, fullText) + (entity.type === "player" ? 1 : 0),
      reason: "Detected from final script/SRT/topic.",
    }))
    .filter((entity) => entity.priorityScore > 0 && entity.imageCount > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore || (a.type === "player" ? -1 : 1))
    .slice(0, WORLD_CUP_LOCAL_ENTITY_MAX_ENTITIES);
}

export async function detectLocalEntitiesWithGemma({ catalog, evidence, selectedScript, srtSegments, keyInfo, warnings }) {
  const heuristic = detectLocalEntitiesHeuristic({ catalog, evidence, selectedScript, srtSegments });
  if (!keyInfo?.apiKey || !catalog.length || WORLD_CUP_LOCAL_ENTITY_MAX_ENTITIES <= 0) {
    return heuristic;
  }
  const available = catalog
    .map((entity) => ({
      name: entity.name,
      folder: entity.folder,
      type: entity.type,
      aliases: entity.aliases.slice(0, 8),
      imageCount: entity.imageCount,
      videoCount: entity.videoCount,
    }))
    .slice(0, 140);
  const prompt = `
You are the entity visual planner for a football Shorts pipeline.
Pick only entities that must appear visually in this specific video.

Rules:
- Use only folders from the available local library.
- Prioritize entities explicitly mentioned in the final script/SRT.
- Include both players in comparison hooks.
- Include a team only if it is central, not just background context.
- Return at most ${WORLD_CUP_LOCAL_ENTITY_MAX_ENTITIES} entities.

Final script:
${selectedScript?.text || selectedScript?.screenplay || ""}

SRT captions:
${(Array.isArray(srtSegments) ? srtSegments : []).map((segment) => `${segment.number}. ${segment.text}`).join("\n")}

Topic/evidence:
${JSON.stringify({ topic: evidence?.topic, match: evidence?.match, keyPlayers: evidence?.keyPlayers }, null, 2)}

Available local library:
${JSON.stringify(available, null, 2)}

Return JSON:
{
  "entities": [
    {"name": "", "folder": "", "priority": "hero|supporting", "reason": ""}
  ]
}
`.trim();
  try {
    const result = await requestGeminiJson({ keyInfo, model: VISUAL_REVIEW_MODEL, prompt, temperature: 0.15 });
    const byFolder = new Map(catalog.map((entity) => [entity.folder.toLowerCase(), entity]));
    const picked = (Array.isArray(result.json?.entities) ? result.json.entities : [])
      .map((item, index) => {
        const match = byFolder.get(cleanText(item.folder).toLowerCase());
        return match
          ? {
              ...match,
              priority: cleanText(item.priority) || (index === 0 ? "hero" : "supporting"),
              reason: cleanText(item.reason) || "Selected by Gemma entity planner.",
              priorityScore: 100 - index,
            }
          : null;
      })
      .filter(Boolean)
      .slice(0, WORLD_CUP_LOCAL_ENTITY_MAX_ENTITIES);
    const merged = [...picked];
    for (const entity of heuristic) {
      if (!merged.some((item) => item.folder === entity.folder)) {
        merged.push(entity);
      }
    }
    return merged.slice(0, WORLD_CUP_LOCAL_ENTITY_MAX_ENTITIES);
  } catch (error) {
    warnings.push(`Local entity planner fallback used: ${error.message}`);
    return heuristic;
  }
}

export async function makeLocalImagePreview(filePath) {
  await ensureWorldCupDirs();
  const out = path.join(localEntityPreviewRoot, `${hashText(filePath)}.jpg`);
  if (await fileExists(out)) {
    return out;
  }
  try {
    const ffmpegPath = await resolveFfmpegPath();
    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        "-i",
        filePath,
        "-vf",
        "scale=360:360:force_original_aspect_ratio=decrease,pad=360:360:(ow-iw)/2:(oh-ih)/2:black",
        "-frames:v",
        "1",
        out,
      ],
      { timeout: 30000, maxBuffer: 10_000_000 },
    );
    return out;
  } catch {
    return filePath;
  }
}

export async function makeLocalEntityContactSheet(entity, candidates) {
  const previews = [];
  for (const candidate of candidates) {
    previews.push(await makeLocalImagePreview(candidate.url));
  }
  if (!previews.length) {
    return "";
  }
  const out = path.join(localEntityPreviewRoot, `sheet-${safeFilePart(entity.folder)}-${hashText(previews.join("|"))}.jpg`);
  if (await fileExists(out)) {
    return out;
  }
  try {
    const ffmpegPath = await resolveFfmpegPath();
    const inputs = previews.flatMap((preview) => ["-i", preview]);
    const cols = Math.min(5, previews.length);
    const labels = previews.map((_, index) => {
      const label = String(index + 1);
      return `[${index}:v]scale=240:240:force_original_aspect_ratio=decrease,pad=240:240:(ow-iw)/2:(oh-ih)/2:black,drawbox=x=0:y=0:w=58:h=46:color=black@0.82:t=fill,drawtext=text='${label}':fontcolor=white:fontsize=34:x=16:y=5[t${index}]`;
    });
    const stackInputs = previews.map((_, index) => `[t${index}]`).join("");
    const layout = previews.map((_, index) => `${(index % cols) * 240}_${Math.floor(index / cols) * 240}`).join("|");
    const filter = [...labels, `${stackInputs}xstack=inputs=${previews.length}:layout=${layout},format=yuv420p[sheet]`].join(";");
    await execFileAsync(
      ffmpegPath,
      ["-y", ...inputs, "-filter_complex", filter, "-map", "[sheet]", "-frames:v", "1", out],
      { timeout: 60000, maxBuffer: 20_000_000 },
    );
    return out;
  } catch {
    return "";
  }
}

export async function localImagePart(filePath) {
  const previewPath = await makeLocalImagePreview(filePath);
  const buffer = await fs.readFile(previewPath);
  if (!buffer.length || buffer.length > 3_500_000) {
    return null;
  }
  return { inlineData: { mimeType: mediaMimeType(previewPath), data: buffer.toString("base64") } };
}

export function localEntityCandidateFromFile(entity, filePath, index) {
  return {
    id: `local-entity-${hashText(filePath)}`,
    provider: "local-downloads",
    type: "image",
    url: filePath,
    preview: filePath,
    pageUrl: "",
    title: `${entity.name} local image ${index + 1}`,
    creator: entity.folder,
    license: "user-supplied local download",
    rightsStatus: "user_supplied",
    sourcePlayer: entity.type === "player" ? entity.name : "",
    sourceTeam: entity.type === "team" ? entity.name : "",
    localEntity: {
      name: entity.name,
      folder: entity.folder,
      type: entity.type,
      aliases: entity.aliases || [],
    },
  };
}

export function orderLocalEntityImageFiles(entity, imageFiles) {
  const preferred = LOCAL_ENTITY_PREFERRED_IMAGES[String(entity.folder || "").toLowerCase()] || [];
  if (!preferred.length) {
    return imageFiles;
  }
  const rank = new Map(preferred.map((fileName, index) => [fileName.toLowerCase(), index]));
  return [...imageFiles].sort((a, b) => {
    const aRank = rank.has(path.basename(a).toLowerCase()) ? rank.get(path.basename(a).toLowerCase()) : 999;
    const bRank = rank.has(path.basename(b).toLowerCase()) ? rank.get(path.basename(b).toLowerCase()) : 999;
    return aRank - bRank || path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true });
  });
}

export function localEntityFallbackReview(candidates, entity) {
  const adPattern = /mcdonald|hyundai|chobani|rexona|redbull|powerade|uber|loreal|newbalance|underarmour|jbl|galp|celsius|xfinity|truly|wahed|nike|adidas|whoop/i;
  return candidates
    .map((candidate, index) => {
      const text = `${candidate.url} ${candidate.title}`;
      const risky = adPattern.test(text);
      return {
        ...candidate,
        visualReview: {
          model: "local-entity-heuristic",
          relevance: risky ? 4 : Math.max(WORLD_CUP_LOCAL_ENTITY_MIN_SCORE, 8 - Math.floor(index / 3)),
          risk: risky ? "medium" : "low",
          flags: risky ? ["possible-ad-or-sponsor"] : [],
          useCase: risky ? "avoid" : entity.type === "team" ? "team proof image" : "player proof image",
          reason: risky ? "Filename/path suggests brand or sponsor content." : "Folder matches the requested entity.",
        },
      };
    })
    .filter((candidate) => Number(candidate.visualReview.relevance || 0) >= WORLD_CUP_LOCAL_ENTITY_MIN_SCORE)
    .slice(0, WORLD_CUP_LOCAL_ENTITY_SELECTIONS_PER_ENTITY);
}

export async function reviewLocalEntityImagesWithGemma({ entity, keyInfo, warnings }) {
  const imageFiles = orderLocalEntityImageFiles(entity, entity.imageFiles).slice(0, WORLD_CUP_LOCAL_ENTITY_CANDIDATES_PER_ENTITY);
  const candidates = imageFiles.map((filePath, index) => localEntityCandidateFromFile(entity, filePath, index));
  if (!candidates.length) {
    return [];
  }
  if (!keyInfo?.apiKey) {
    return localEntityFallbackReview(candidates, entity);
  }
  const metadata = candidates.map((candidate, index) => ({
    id: candidate.id,
    index: index + 1,
    title: candidate.title,
    folder: entity.folder,
    entity: entity.name,
    type: entity.type,
    fileName: path.basename(candidate.url),
  }));
  const prompt = `
You are Gemma visual picker for one football entity.
Review only this entity folder and choose the best images for a short-form football video.

Entity:
${JSON.stringify({ name: entity.name, folder: entity.folder, type: entity.type, aliases: entity.aliases }, null, 2)}

Rules:
- Select ${WORLD_CUP_LOCAL_ENTITY_SELECTIONS_PER_ENTITY} or fewer images.
- Prefer clear football context, match action, celebration, team proof, strong face/kit visibility.
- Reject or score low: ads, product shots, sponsor graphics, random lifestyle, wrong person/team, heavy text graphics, awkward crop, low quality.
- If the image does not visibly show football context for this entity, mark usable=false even if it contains the player.
- The contact sheet has visible numbers in the top-left corner. Use those numbers to avoid ID mixups.
- Logos on kits are acceptable unless the image is mostly a logo/ad graphic.
- Return scores honestly. Do not over-select weak images.

Candidates:
${JSON.stringify(metadata, null, 2)}

Return JSON:
{
  "items": [
    {"id": "", "index": 0, "usable": true, "score": 0, "useCase": "hero|comparison|team|emotion|avoid", "flags": [""], "reason": ""}
  ],
  "selectedIds": [""],
  "selectedIndexes": [0]
}
`.trim();
  const parts = [{ text: prompt }];
  const contactSheet = await makeLocalEntityContactSheet(entity, candidates).catch(() => "");
  if (contactSheet) {
    const sheetBuffer = await fs.readFile(contactSheet).catch(() => null);
    if (sheetBuffer?.length && sheetBuffer.length < 4_000_000) {
      parts.push(
        { text: `Numbered contact sheet for ${entity.name}. Choose by visible number and candidate metadata index.` },
        { inlineData: { mimeType: "image/jpeg", data: sheetBuffer.toString("base64") } },
      );
    }
  }
  if (!contactSheet) {
    for (const candidate of candidates) {
      const imagePart = await localImagePart(candidate.url).catch(() => null);
      if (imagePart) {
        parts.push({ text: `Candidate ${candidate.id}: ${candidate.title}` }, imagePart);
      }
    }
  }
  try {
    const result = await requestGeminiJson({ keyInfo, model: VISUAL_REVIEW_MODEL, prompt, parts, temperature: 0.1 });
    const itemMap = new Map(
      (Array.isArray(result.json?.items) ? result.json.items : [])
        .map((item) => [cleanText(item.id), item])
        .filter(([id]) => id),
    );
    const selectedIds = new Set((Array.isArray(result.json?.selectedIds) ? result.json.selectedIds : []).map(cleanText).filter(Boolean));
    const selectedIndexes = new Set((Array.isArray(result.json?.selectedIndexes) ? result.json.selectedIndexes : []).map((index) => Number(index)).filter((index) => Number.isFinite(index) && index > 0));
    const reviewed = candidates.map((candidate) => {
      const item = itemMap.get(candidate.id) || {};
      const candidateIndex = metadata.find((row) => row.id === candidate.id)?.index || 0;
      const indexedItem =
        !itemMap.has(candidate.id) && candidateIndex
          ? (Array.isArray(result.json?.items) ? result.json.items : []).find((row) => Number(row.index) === Number(candidateIndex)) || {}
          : item;
      const score = Math.max(0, Math.min(10, Number(indexedItem.score ?? 0) || 0));
      const usable = indexedItem.usable !== false && score >= WORLD_CUP_LOCAL_ENTITY_MIN_SCORE;
      const flags = Array.isArray(indexedItem.flags) ? indexedItem.flags.map(cleanText).filter(Boolean) : [];
      return {
        ...candidate,
        visualReview: {
          model: VISUAL_REVIEW_MODEL,
          relevance: score || (usable ? WORLD_CUP_LOCAL_ENTITY_MIN_SCORE : 0),
          risk: flags.some((flag) => /ad|wrong|reject|sponsor|logo-heavy|low/i.test(flag)) ? "medium" : "low",
          flags,
          useCase: cleanText(indexedItem.useCase) || (usable ? `${entity.type} proof image` : "avoid"),
          reason: cleanText(indexedItem.reason) || "Reviewed by local entity visual picker.",
        },
        localEntityUsable: usable,
        localEntityIndex: candidateIndex,
      };
    });
    const hasExplicitSelection = selectedIds.size > 0 || selectedIndexes.size > 0;
    const selected = reviewed
      .filter((candidate) =>
        hasExplicitSelection ? selectedIds.has(candidate.id) || selectedIndexes.has(candidate.localEntityIndex) : candidate.localEntityUsable,
      )
      .sort((a, b) => {
        const selectedDelta = Number(selectedIds.has(b.id)) - Number(selectedIds.has(a.id));
        return selectedDelta || Number(b.visualReview.relevance || 0) - Number(a.visualReview.relevance || 0);
      })
      .slice(0, WORLD_CUP_LOCAL_ENTITY_SELECTIONS_PER_ENTITY);
    return selected.length ? selected : localEntityFallbackReview(candidates, entity);
  } catch (error) {
    warnings.push(`Local image review fallback used for ${entity.name}: ${error.message}`);
    return localEntityFallbackReview(candidates, entity);
  }
}

export function segmentMatchesLocalEntity(segment, entity, evidence = {}) {
  const segmentText = cleanText(`${segment.text || ""} ${segment.captionText || ""}`).toLowerCase();
  const topicText = cleanText(`${evidence.topic || ""} ${evidence.match?.teamA || ""} ${evidence.match?.teamB || ""}`).toLowerCase();
  if ((entity.aliases || []).some((alias) => textMentionsAlias(segmentText, alias))) {
    return true;
  }
  if (Number(segment.number || 0) === 1 && (entity.aliases || []).some((alias) => textMentionsAlias(topicText, alias))) {
    return true;
  }
  return false;
}

export async function buildLocalEntityLayer({ evidence, srtSegments, selectedScript, keyInfo, options, warnings }) {
  if (!WORLD_CUP_ENABLE_LOCAL_ENTITY_ASSETS || options.offline || WORLD_CUP_LOCAL_ENTITY_MAX_ENTITIES <= 0) {
    return { enabled: false, entities: [], selectedAssets: [], segments: {} };
  }
  const catalog = await getLocalEntityCatalog();
  if (!catalog.length) {
    return { enabled: false, entities: [], selectedAssets: [], segments: {}, warning: "No local downloads library found." };
  }
  const entities = await detectLocalEntitiesWithGemma({ catalog, evidence, selectedScript, srtSegments, keyInfo, warnings });
  if (!entities.length) {
    return { enabled: true, entities: [], selectedAssets: [], segments: {} };
  }
  const reviewedResults = await Promise.allSettled(entities.map((entity) => reviewLocalEntityImagesWithGemma({ entity, keyInfo, warnings })));
  const selectedByFolder = new Map();
  const selectedAssets = [];
  for (const [index, result] of reviewedResults.entries()) {
    const entity = entities[index];
    const assets = result.status === "fulfilled" ? result.value : [];
    if (result.status === "rejected") {
      warnings.push(`Local entity image review failed for ${entity.name}: ${result.reason?.message || result.reason}`);
    }
    selectedByFolder.set(entity.folder, assets);
    selectedAssets.push(...assets);
  }
  const segments = {};
  for (const segment of srtSegments || []) {
    const matchingEntities = entities
      .filter((entity) => segmentMatchesLocalEntity(segment, entity, evidence))
      .filter((entity) => (selectedByFolder.get(entity.folder) || []).length)
      .slice(0, 2);
    if (!matchingEntities.length) {
      continue;
    }
    const assets = matchingEntities
      .map((entity, index) => {
        const entityAssets = selectedByFolder.get(entity.folder) || [];
        const asset = entityAssets[(Number(segment.number || 1) + index - 1) % entityAssets.length];
        return asset ? { entity: entity.name, folder: entity.folder, type: entity.type, asset } : null;
      })
      .filter(Boolean);
    if (assets.length) {
      segments[String(segment.number)] = {
        mode: assets.length > 1 ? "split" : "single",
        provider: "local-entity-overlay",
        assets,
        reason: `SRT segment mentions ${assets.map((item) => item.entity).join(" and ")}.`,
      };
    }
  }
  return {
    enabled: true,
    model: VISUAL_REVIEW_MODEL,
    downloadsRoot: localDownloadsRoot,
    entities: entities.map((entity) => ({
      name: entity.name,
      folder: entity.folder,
      type: entity.type,
      priority: entity.priority || "",
      reason: entity.reason || "",
      imageCount: entity.imageCount,
      selectedCount: (selectedByFolder.get(entity.folder) || []).length,
    })),
    selectedAssets,
    segments,
  };
}

export function localVisualReview(candidate, evidence) {
  const text = visualCandidateText(candidate).toLowerCase();
  const offTopic = candidate.provider !== "wikimedia" && clipLooksContextMismatched(candidate, evidence);
  const flags = [];
  if (offTopic) {
    flags.push("off-topic");
  }
  if (/getty|apnews|associated-press|fifa\.com|broadcast|screenshot|watermark/.test(text)) {
    flags.push("source-risk");
  }
  if (/logo|crest|official-team-photo/.test(text)) {
    flags.push("logo-or-crest");
  }
  const isImage = candidate.provider === "wikimedia" || candidate.type === "image";
  const relevance = offTopic ? 2 : isImage ? 8 : /soccer|football|stadium|fans?|crowd|goal|pitch/.test(text) ? 7 : 4;
  const risk = flags.includes("source-risk") ? "high" : flags.length ? "medium" : "low";
  return {
    relevance,
    risk,
    flags,
    useCase: isImage ? "team/player image" : "stock football clip",
    reason: offTopic ? "Local check found the clip context does not match football/World Cup needs." : "Local metadata check passed.",
  };
}

export async function fetchInlineImagePart(candidate) {
  const url = candidate.preview || (candidate.provider === "wikimedia" ? candidate.url : "");
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (!isApprovedMediaHost(parsed.hostname)) {
      return null;
    }
    const response = await fetchWithTimeout(url, { headers: { Accept: "image/*", "User-Agent": "WorldCupChaosDesk/1.0" } }, VISUAL_PREVIEW_TIMEOUT_MS);
    if (!response.ok) {
      return null;
    }
    const mimeType = cleanText(response.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!/^image\/(jpeg|png|webp)$/i.test(mimeType)) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 4_000_000) {
      return null;
    }
    return { inlineData: { mimeType, data: buffer.toString("base64") } };
  } catch {
    return null;
  }
}

export function attachVisualReviews(candidates, reviewedItems, model, evidence = {}) {
  const reviewMap = new Map(
    (Array.isArray(reviewedItems) ? reviewedItems : [])
      .map((item) => [cleanText(item.id), item])
      .filter(([id]) => id),
  );
  return candidates.map((candidate) => {
    const modelReview = reviewMap.get(candidate.id);
    const fallback = localVisualReview(candidate, evidence);
    const relevance = Math.max(0, Math.min(10, Number(modelReview?.relevance ?? fallback.relevance) || fallback.relevance));
    const risk = ["low", "medium", "high"].includes(cleanText(modelReview?.risk).toLowerCase()) ? cleanText(modelReview.risk).toLowerCase() : fallback.risk;
    const flags = Array.isArray(modelReview?.flags) ? modelReview.flags.map(cleanText).filter(Boolean) : fallback.flags;
    return {
      ...candidate,
      visualReview: {
        model,
        relevance,
        risk,
        flags,
        useCase: cleanText(modelReview?.useCase) || fallback.useCase,
        reason: cleanText(modelReview?.reason) || fallback.reason,
      },
    };
  });
}

export async function reviewVisualCandidatesWithGemma({ keyInfo, candidates, evidence, selectedScript, warnings }) {
  const limited = candidates.slice(0, VISUAL_REVIEW_MAX_ITEMS);
  if (!limited.length) {
    return candidates;
  }
  if (!keyInfo?.apiKey) {
    return limited.map((candidate) => ({ ...candidate, visualReview: { model: "local-heuristic", ...localVisualReview(candidate, evidence) } }));
  }
  const metadata = limited.map((candidate) => ({
    id: candidate.id,
    provider: candidate.provider,
    type: candidate.provider === "wikimedia" ? "image" : "stock-video",
    title: candidate.title || candidate.query || "",
    pageUrl: candidate.pageUrl || "",
    creator: candidate.creator || "",
    license: candidate.license || candidate.rightsStatus || "",
    query: candidate.query || "",
    tags: candidate.tags || "",
    duration: candidate.duration || 0,
    sourcePlayer: candidate.sourcePlayer || "",
    sourceTeam: candidate.sourceTeam || "",
  }));
  const prompt = `
You are Gemma visual QA for a football short-video pipeline.
Use only a generic safety/relevance check. Do not claim legal certainty.

Task:
- Check whether each candidate visually fits the World Cup/football script.
- Flag obvious generic risks: watermark, broadcast screenshot, Getty/AP/FIFA source, visible official logo/crest focus, wrong sport, unrelated gym/MMA/bodybuilding, low relevance.
- Do not reject Pexels/Pixabay clips only because a player/team appears. Use the source/license metadata.
- Production visuals should prefer football/stadium/fan clips; local player/team images are added later as overlays from the local downloads library.

Evidence/topic:
${JSON.stringify({ topic: evidence.topic, match: evidence.match, keyPlayers: evidence.keyPlayers, selectedScript: selectedScript?.text }, null, 2)}

Candidates:
${JSON.stringify(metadata, null, 2)}

Return JSON:
{
  "items": [
    {"id": "", "relevance": 0, "risk": "low|medium|high", "flags": [""], "useCase": "team image|player image|fan clip|action clip|tactical card|blocked", "reason": ""}
  ],
  "notes": [""]
}
`.trim();
  const parts = [{ text: prompt }];
  const previewCandidates = limited
    .filter((candidate) => candidate.provider === "wikimedia" || candidate.preview)
    .slice(0, 6);
  const previewResults = await Promise.allSettled(previewCandidates.map((candidate) => fetchInlineImagePart(candidate)));
  for (const [index, result] of previewResults.entries()) {
    if (result.status === "fulfilled" && result.value) {
      parts.push({ text: `Preview thumbnail for candidate ${previewCandidates[index].id}` }, result.value);
    }
  }
  try {
    const result = await requestGeminiJson({ keyInfo, model: VISUAL_REVIEW_MODEL, prompt, parts, temperature: 0.15 });
    return attachVisualReviews(limited, result.json?.items, VISUAL_REVIEW_MODEL, evidence);
  } catch (imageError) {
    try {
      const result = await requestGeminiJson({ keyInfo, model: VISUAL_REVIEW_MODEL, prompt, temperature: 0.15 });
      return attachVisualReviews(limited, result.json?.items, VISUAL_REVIEW_MODEL, evidence);
    } catch (textError) {
      warnings.push(`Gemma visual review fallback used: ${textError.message || imageError.message}`);
      return limited.map((candidate) => ({ ...candidate, visualReview: { model: "local-heuristic", ...localVisualReview(candidate, evidence) } }));
    }
  }
}

export async function refineVisualScoutWithGemini({ keyInfo, candidates, evidence, selectedScript, warnings }) {
  if (!keyInfo?.apiKey || !candidates.length) {
    return { model: "local-none", preferredIds: [], blockedIds: [], retryQueries: [], notes: [] };
  }
  const prompt = `
You are the visual editor for "World Cup Chaos Desk".
Gemma already did the generic visual QA. Your job is relevance planning only, not copyright judgment.

Choose which candidates best match this short and suggest retry search queries for missing moments.

Script:
${selectedScript?.text || ""}

Evidence:
${JSON.stringify({ topic: evidence.topic, match: evidence.match, keyPlayers: evidence.keyPlayers, visualBrief: evidence.visualBrief }, null, 2)}

Gemma-reviewed candidates:
${JSON.stringify(
  candidates.map((candidate) => ({
    id: candidate.id,
    provider: candidate.provider,
    title: candidate.title || candidate.query || "",
    query: candidate.query || "",
    pageUrl: candidate.pageUrl || "",
    review: candidate.visualReview || {},
  })),
  null,
  2,
)}

Rules:
- Prefer football/stadium/fan clips over generic intensity clips.
- Local player/team images are overlaid separately, so do not prefer standalone image candidates over useful clips.
- Avoid off-topic gym, MMA, bodybuilding, baseball, basketball, cricket.
- Ask for retry queries when no candidate supports a key joke or hook.

Return JSON:
{
  "preferredIds": [""],
  "blockedIds": [""],
  "retryQueries": [""],
  "notes": [""]
}
`.trim();
  try {
    const result = await requestGeminiJsonWithFallbacks({
      keyInfo,
      primaryModel: VISUAL_SELECTION_MODEL,
      fallbackModels: VISUAL_SELECTION_FALLBACK_MODELS,
      prompt,
      temperature: 0.25,
    });
    return {
      model: result.model || VISUAL_SELECTION_MODEL,
      preferredIds: Array.isArray(result.json?.preferredIds) ? result.json.preferredIds.map(cleanText).filter(Boolean) : [],
      blockedIds: Array.isArray(result.json?.blockedIds) ? result.json.blockedIds.map(cleanText).filter(Boolean) : [],
      retryQueries: Array.isArray(result.json?.retryQueries) ? result.json.retryQueries.map(cleanText).filter(Boolean).slice(0, 4) : [],
      notes: Array.isArray(result.json?.notes) ? result.json.notes.map(cleanText).filter(Boolean) : [],
    };
  } catch (error) {
    warnings.push(`Visual relevance refinement skipped: ${error.message}`);
    return { model: VISUAL_SELECTION_MODEL, preferredIds: [], blockedIds: [], retryQueries: [], notes: [] };
  }
}

export function scriptVisualScoutQueries(selectedScript, evidence) {
  const lines = splitIntoCaptionLines(selectedScript?.text || "");
  const segments = lines.map((line, index) => ({ number: index + 1, text: line, durationSeconds: 4 }));
  const queries = [];
  for (const segment of segments) {
    queries.push(...segmentSearchQueries(segment, evidence).slice(0, 2));
  }
  const visualQueries = Array.isArray(evidence.visualBrief?.teamVisualQueries) ? evidence.visualBrief.teamVisualQueries : [];
  queries.push(...visualQueries);
  for (const player of Array.isArray(evidence.keyPlayers) ? evidence.keyPlayers.slice(0, 4) : []) {
    queries.push(`${player.name} ${player.team || ""} football`, `${player.team || "soccer"} player training vertical`);
  }
  const text = cleanText(`${evidence.topic || ""} ${selectedScript?.text || ""}`).toLowerCase();
  if (/usa|usmnt|united states|american/.test(text)) {
    queries.push(
      "United States soccer fans flag vertical",
      "US soccer supporters American flag vertical",
      "USA soccer stadium fans",
      "American soccer crowd flag",
      "USMNT supporters stadium",
      "United States football fans",
      "soccer fans red white blue",
    );
  }
  if (/career mode|fifa|formation|tinkering/.test(text)) {
    queries.push("soccer tactics board vertical", "football formation board", "soccer video game controller");
  }
  if (/panic|pressure|trap|headache/.test(text)) {
    queries.push("soccer fans nervous reaction", "football crowd tension stadium", "soccer player pressure training");
  }
  return [...new Set(queries.map(cleanText).filter(Boolean))].slice(0, 24);
}

export function evidenceAssetTerms(evidence = {}) {
  const terms = [
    evidence.topic,
    evidence.match?.teamA,
    evidence.match?.teamB,
    ...(Array.isArray(evidence.keyPlayers) ? evidence.keyPlayers.flatMap((player) => [player.name, player.team]) : []),
    ...(impliedTeamNames(evidence) || []),
  ]
    .map(cleanText)
    .filter(Boolean);
  if (terms.some((term) => /usa|usmnt|united states/i.test(term))) {
    terms.push("usa", "usmnt", "united states", "american soccer");
  }
  return [...new Set(terms.map((term) => term.toLowerCase()))];
}

export function curatedAssetTargetForTeam(teamOrTopic) {
  const text = cleanText(teamOrTopic).toLowerCase();
  return (
    MAJOR_WORLD_CUP_ASSET_TARGETS.find((target) =>
      [target.team, ...(target.aliases || [])].some((name) => {
        const cleaned = cleanText(name).toLowerCase();
        return cleaned && (text === cleaned || text.includes(cleaned) || cleaned.includes(text));
      }),
    ) || null
  );
}

export function assetPackMatchesEvidence(manifest, evidence) {
  const terms = evidenceAssetTerms(evidence);
  const haystack = cleanText(
    `${manifest.team || ""} ${(manifest.players || []).join(" ")} ${(manifest.aliases || []).join(" ")} ${(manifest.topic || "")}`,
  ).toLowerCase();
  return terms.some((term) => term.length > 2 && haystack.includes(term));
}

export async function loadLocalAssetPackAssets(evidence) {
  await ensureWorldCupDirs();
  const assets = [];
  const attributions = [];
  const dirs = await fs.readdir(assetPackRoot, { withFileTypes: true }).catch(() => []);
  for (const dir of dirs.filter((entry) => entry.isDirectory())) {
    const manifestPath = path.join(assetPackRoot, dir.name, "manifest.json");
    const manifest = await readJsonFile(manifestPath, null);
    if (!manifest || !assetPackMatchesEvidence(manifest, evidence)) {
      continue;
    }
    for (const item of Array.isArray(manifest.assets) ? manifest.assets : []) {
      if (item.kind !== "image" || !item.localPath) {
        continue;
      }
      const localPath = path.resolve(assetPackRoot, dir.name, item.localPath);
      if (!(await fileExists(localPath))) {
        continue;
      }
      const asset = {
        id: cleanText(item.id) || `local-${hashText(localPath)}`,
        provider: "local-asset-pack",
        type: "image",
        url: localPath,
        preview: localPath,
        pageUrl: cleanText(item.sourceUrl || ""),
        title: cleanText(item.title || manifest.team || "World Cup asset"),
        creator: cleanText(item.creator || ""),
        license: cleanText(item.license || "local asset manifest"),
        rightsStatus: cleanText(item.rightsStatus || "approved"),
        sourcePlayer: cleanText(item.sourcePlayer || item.player || ""),
        sourceTeam: cleanText(item.sourceTeam || manifest.team || ""),
        visualReview: item.visualReview || { model: "asset-pack-manifest", relevance: 9, risk: "low", flags: [], useCase: "local team/player image", reason: "Saved local asset pack item." },
      };
      assets.push(asset);
      attributions.push({
        assetId: asset.id,
        title: asset.title,
        creator: asset.creator,
        license: asset.license,
        sourceUrl: asset.pageUrl,
        rightsStatus: asset.rightsStatus,
      });
    }
  }
  return { assets, attributions };
}

export async function resolveWikimediaVisualAssets(evidence) {
  if (!WORLD_CUP_ENABLE_WIKIMEDIA_VISUALS) {
    const localAssets = await loadLocalAssetPackAssets(evidence);
    return { assets: localAssets.assets.map((asset) => ({ ...asset, backupOnly: true })), attributions: localAssets.attributions };
  }
  const assets = [];
  const attributions = [];
  const keyPlayers = (Array.isArray(evidence.keyPlayers) ? evidence.keyPlayers : []).slice(0, 6);
  const playerResults = await Promise.allSettled(keyPlayers.map((player) => resolveWikimediaPlayerImage(player.name, player.team)));
  for (const result of playerResults) {
    if (result.status === "fulfilled" && result.value && !assets.some((item) => item.id === result.value.id)) {
      assets.push(result.value);
    }
  }
  const teamResults = await Promise.allSettled(impliedTeamNames(evidence).map((teamName) => resolveWikimediaTeamImage(teamName)));
  for (const result of teamResults) {
    if (result.status === "fulfilled" && result.value && !assets.some((item) => item.id === result.value.id)) {
      assets.push(result.value);
    }
  }
  const localAssets = await loadLocalAssetPackAssets(evidence);
  for (const asset of localAssets.assets) {
    if (!assets.some((item) => item.id === asset.id)) {
      assets.push({ ...asset, backupOnly: true });
    }
  }
  for (const asset of assets) {
    attributions.push({
      assetId: asset.id,
      title: asset.title,
      creator: asset.creator,
      license: asset.license,
      sourceUrl: asset.pageUrl,
      rightsStatus: "approved",
    });
  }
  attributions.push(...localAssets.attributions.filter((row) => !attributions.some((item) => item.assetId === row.assetId)));
  return { assets, attributions };
}

export async function discoverAssetPackTargets({ team, players = [], topic = "", keyInfo, offline = false, warnings = [] }) {
  const fallbackPlayers = players.map(cleanText).filter(Boolean);
  const curated = curatedAssetTargetForTeam(team || topic);
  const fallback = {
    team: cleanText(curated?.team || team || topic || "World Cup"),
    aliases: [...(curated?.aliases || []), team, topic].map(cleanText).filter(Boolean),
    players: fallbackPlayers.length ? fallbackPlayers : curated?.players || [],
    stockQueries: [
      `${team || topic} soccer fans vertical`,
      `${team || topic} football supporters flag`,
      `${team || topic} soccer stadium atmosphere`,
    ].map(cleanText).filter(Boolean),
    notes: ["Local fallback target list."],
  };
  if (!keyInfo?.apiKey || offline) {
    return fallback;
  }
  const prompt = `
Use Google Search grounding to build a practical visual asset-pack target list for World Cup short videos.

Team/topic: ${team || topic}
User-provided players: ${fallbackPlayers.join(", ") || "none"}

Need:
- recognizable team aliases
- 4 to 8 relevant player names if this is a team
- stock-video queries that are searchable on Pexels/Pixabay
- keep names useful for Wikimedia/Commons lookup

Return JSON:
{
  "team": "",
  "aliases": [""],
  "players": [""],
  "stockQueries": [""],
  "notes": [""]
}
`.trim();
  try {
    const result = await requestGeminiJsonWithFallbacks({
      keyInfo,
      primaryModel: WORLD_CUP_ASSET_SEARCH_MODEL,
      fallbackModels: WORLD_CUP_ASSET_SEARCH_FALLBACK_MODELS,
      prompt,
      search: true,
      temperature: 0.2,
    });
    return {
      team: cleanText(result.json?.team || fallback.team),
      aliases: Array.isArray(result.json?.aliases) ? result.json.aliases.map(cleanText).filter(Boolean).slice(0, 8) : fallback.aliases,
      players: Array.isArray(result.json?.players) ? result.json.players.map(cleanText).filter(Boolean).slice(0, 10) : fallback.players,
      stockQueries: Array.isArray(result.json?.stockQueries) ? result.json.stockQueries.map(cleanText).filter(Boolean).slice(0, 12) : fallback.stockQueries,
      notes: Array.isArray(result.json?.notes) ? result.json.notes.map(cleanText).filter(Boolean) : fallback.notes,
      model: result.model,
    };
  } catch (error) {
    warnings.push(`Asset-pack target discovery fallback used: ${error.message}`);
    return fallback;
  }
}

export async function saveAssetPackImage(asset, packDir) {
  if (!asset?.url || !/^https?:\/\//i.test(asset.url)) {
    return null;
  }
  const parsed = new URL(asset.url);
  if (!isApprovedMediaHost(parsed.hostname)) {
    return null;
  }
  const ext = path.extname(parsed.pathname).split("?")[0] || ".jpg";
  const imagesDir = path.join(packDir, "images");
  await fs.mkdir(imagesDir, { recursive: true });
  const localName = `${slugify(asset.sourcePlayer || asset.sourceTeam || asset.title || asset.id, "asset")}-${hashText(asset.url)}${ext}`;
  const relativePath = path.join("images", localName);
  const fullPath = path.join(packDir, relativePath);
  if (await fileExists(fullPath)) {
    return relativePath;
  }
  const response = await fetchWithTimeout(asset.url, { headers: { "User-Agent": "WorldCupChaosDesk/1.0", Accept: "image/*" } }, MEDIA_REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Image download failed for ${asset.title || asset.id}: HTTP ${response.status}`);
  }
  await fs.writeFile(fullPath, Buffer.from(await response.arrayBuffer()));
  return relativePath;
}

export async function buildWorldCupAssetPack(input = {}) {
  await ensureWorldCupDirs();
  const warnings = [];
  const keyInfo = await getActiveGeminiKey();
  const team = cleanText(input.team || input.teamName || input.topic || "");
  const topic = cleanText(input.topic || team || "World Cup team");
  const players = String(input.players || "")
    .split(/[,|]/)
    .map(cleanText)
    .filter(Boolean);
  const offline = normalizeBool(input.offline, false);
  const includeStock = normalizeBool(input.includeStock ?? input.stock, true);
  const targets = await discoverAssetPackTargets({ team, players, topic, keyInfo, offline, warnings });
  const packSlug = slugify(targets.team || topic, "world-cup-assets");
  const packDir = path.join(assetPackRoot, packSlug);
  await fs.mkdir(packDir, { recursive: true });

  const imageCandidates = [];
  const teamQueries = [
    targets.team || team,
    ...(Array.isArray(targets.aliases) ? targets.aliases : []),
    /usa|usmnt|yanks|stars and stripes/i.test(`${targets.team} ${targets.aliases?.join(" ")}`) ? "United States men's national soccer team" : "",
    /usa|usmnt|yanks|stars and stripes/i.test(`${targets.team} ${targets.aliases?.join(" ")}`) ? "United States soccer team" : "",
  ]
    .map(cleanText)
    .filter(Boolean);
  for (const query of [...new Set(teamQueries)]) {
    const teamAsset = offline ? null : await resolveWikimediaTeamImage(query);
    if (teamAsset && !imageCandidates.some((candidate) => candidate.id === teamAsset.id)) {
      imageCandidates.push(teamAsset);
    }
  }
  for (const playerName of targets.players.slice(0, Math.max(1, Math.min(10, Number(input.limit || 8) || 8)))) {
    const playerTeamQueries = [targets.team || team, "United States soccer", "USMNT", ""].map(cleanText).filter((value, index, list) => list.indexOf(value) === index);
    for (const playerTeam of playerTeamQueries) {
      const asset = offline ? null : await resolveWikimediaPlayerImage(playerName, playerTeam);
      if (asset && !imageCandidates.some((candidate) => candidate.id === asset.id)) {
        imageCandidates.push(asset);
        break;
      }
    }
  }

  const reviewedImages = await reviewVisualCandidatesWithGemma({
    keyInfo,
    candidates: imageCandidates,
    evidence: {
      topic,
      match: { teamA: targets.team || team, teamB: "" },
      keyPlayers: targets.players.map((name) => ({ name, team: targets.team || team })),
    },
    selectedScript: { text: `${targets.team || team} World Cup asset pack` },
    warnings,
  });

  const savedAssets = [];
  for (const asset of reviewedImages.filter(candidateAllowedByReview)) {
    try {
      const localPath = await saveAssetPackImage(asset, packDir);
      if (!localPath) {
        continue;
      }
      savedAssets.push({
        id: asset.id,
        kind: "image",
        provider: asset.provider,
        title: asset.title,
        sourceUrl: asset.pageUrl,
        creator: asset.creator,
        license: asset.license,
        rightsStatus: asset.rightsStatus || "approved",
        sourcePlayer: asset.sourcePlayer,
        sourceTeam: asset.sourceTeam || targets.team || team,
        localPath,
        visualReview: asset.visualReview || null,
      });
    } catch (error) {
      warnings.push(`Asset image skipped: ${error.message}`);
    }
  }

  const baseManifest = {
    version: "worldcup-asset-pack-v1",
    id: packSlug,
    createdAt: nowIso(),
    team: targets.team || team,
    topic,
    aliases: targets.aliases,
    players: targets.players,
    discoveryModel: targets.model || "local",
    assets: savedAssets,
    stockCandidates: [],
    stockQueries: targets.stockQueries,
    notes: targets.notes || [],
    warnings,
  };
  await fs.writeFile(path.join(packDir, "manifest.json"), `${JSON.stringify({ ...baseManifest, status: "images_ready" }, null, 2)}\n`, "utf8");

  const pexelsKey = await getActiveStockKey("pexels");
  const pixabayKey = await getActiveStockKey("pixabay");
  let stockCandidates = [];
  if (includeStock && !offline && (pexelsKey?.apiKey || pixabayKey?.apiKey)) {
    stockCandidates = await searchStockCandidatesParallel({
      queries: targets.stockQueries.slice(0, 8),
      pexelsKey,
      pixabayKey,
      warnings,
    });
    stockCandidates = await reviewVisualCandidatesWithGemma({
      keyInfo,
      candidates: stockCandidates,
      evidence: {
        topic,
        match: { teamA: targets.team || team, teamB: "" },
        keyPlayers: targets.players.map((name) => ({ name, team: targets.team || team })),
      },
      selectedScript: { text: `${targets.team || team} football fan atmosphere and match pressure` },
      warnings,
    });
  }

  const manifest = {
    ...baseManifest,
    status: "ready",
    stockCandidates: stockCandidates.filter(candidateAllowedByReview).slice(0, 24),
  };
  await fs.writeFile(path.join(packDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    ...manifest,
    directory: packDir,
  };
}

export async function buildMajorWorldCupAssetPacks(input = {}) {
  const limit = Math.max(1, Math.min(MAJOR_WORLD_CUP_ASSET_TARGETS.length, Number(input.limit || MAJOR_WORLD_CUP_ASSET_TARGETS.length) || MAJOR_WORLD_CUP_ASSET_TARGETS.length));
  const includeStock = normalizeBool(input.includeStock ?? input.stock, false);
  const results = [];
  for (const target of MAJOR_WORLD_CUP_ASSET_TARGETS.slice(0, limit)) {
    try {
      const pack = await buildWorldCupAssetPack({
        team: target.team,
        players: target.players.slice(0, Number(input.playersPerTeam || 4) || 4).join(", "),
        limit: Number(input.playersPerTeam || 4) || 4,
        includeStock,
        offline: normalizeBool(input.offline, false),
      });
      results.push({
        team: target.team,
        id: pack.id,
        directory: pack.directory,
        assets: pack.assets?.length || 0,
        stockCandidates: pack.stockCandidates?.length || 0,
        warnings: pack.warnings || [],
      });
    } catch (error) {
      results.push({ team: target.team, error: error.message });
    }
  }
  return {
    createdAt: nowIso(),
    count: results.length,
    includeStock,
    results,
  };
}

export async function searchStockCandidatesParallel({ queries, pexelsKey, pixabayKey, warnings }) {
  const tasks = [];
  for (const query of queries) {
    const stockQuery = stockProviderQuery(query, { text: query }, {});
    for (let page = 1; page <= VISUAL_SCOUT_PAGES; page += 1) {
      if (pexelsKey?.apiKey) {
        tasks.push({ query: stockQuery, originalQuery: query, provider: "pexels", promise: searchPexelsVideos(stockQuery, pexelsKey.apiKey, page) });
      }
      if (pixabayKey?.apiKey) {
        tasks.push({ query: stockQuery, originalQuery: query, provider: "pixabay", promise: searchPixabayVideos(stockQuery, pixabayKey.apiKey, page) });
      }
    }
  }
  const results = await Promise.allSettled(tasks.map((task) => task.promise));
  const candidates = [];
  for (const [index, result] of results.entries()) {
    const task = tasks[index];
    if (result.status === "fulfilled") {
      candidates.push(...result.value.map((candidate) => ({ ...candidate, type: "video", scoutQuery: task.query })));
    } else {
      warnings.push(`Stock scout failed for "${task.query}" via ${task.provider}: ${result.reason?.message || result.reason}`);
    }
  }
  return [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
}

export async function scoutWorldCupVisualAssets({ evidence, selectedScript, keyInfo, options, warnings }) {
  const startedAt = nowIso();
  const wikimedia = options.offline || !WORLD_CUP_ENABLE_WIKIMEDIA_VISUALS ? { assets: [], attributions: [] } : await resolveWikimediaVisualAssets(evidence);
  const pexelsKey = await getActiveStockKey("pexels");
  const pixabayKey = await getActiveStockKey("pixabay");
  const queries = scriptVisualScoutQueries(selectedScript, evidence);
  if (Number(options.visualRetryAttempt || 0) > 0) {
    const retryBoost = [
      ...(Array.isArray(evidence.visualBrief?.teamVisualQueries) ? evidence.visualBrief.teamVisualQueries : []),
      "soccer fans close up vertical",
      "football crowd emotion vertical",
      "soccer player pressure vertical",
      "football stadium atmosphere vertical",
      "soccer supporters flag vertical",
    ];
    queries.unshift(...retryBoost.map(cleanText).filter(Boolean));
  }
  const uniqueQueries = [...new Set(queries.map(cleanText).filter(Boolean))].slice(0, Number(options.visualRetryAttempt || 0) > 0 ? 28 : 24);
  let stockCandidates = [];
  if (!options.offline && (pexelsKey?.apiKey || pixabayKey?.apiKey)) {
    stockCandidates = await searchStockCandidatesParallel({ queries: uniqueQueries, pexelsKey, pixabayKey, warnings });
  }
  let allCandidates = [...wikimedia.assets, ...stockCandidates];
  allCandidates = await reviewVisualCandidatesWithGemma({ keyInfo, candidates: allCandidates, evidence, selectedScript, warnings });
  let selection = await refineVisualScoutWithGemini({ keyInfo, candidates: allCandidates, evidence, selectedScript, warnings });
  if (selection.retryQueries.length && !options.offline && (pexelsKey?.apiKey || pixabayKey?.apiKey)) {
    const retryCandidates = await searchStockCandidatesParallel({ queries: selection.retryQueries, pexelsKey, pixabayKey, warnings });
    const reviewedRetry = await reviewVisualCandidatesWithGemma({ keyInfo, candidates: retryCandidates, evidence, selectedScript, warnings });
    allCandidates = [...new Map([...allCandidates, ...reviewedRetry].map((candidate) => [candidate.id, candidate])).values()];
    selection = await refineVisualScoutWithGemini({ keyInfo, candidates: allCandidates, evidence, selectedScript, warnings });
  }
  const preferredRank = new Map(selection.preferredIds.map((id, index) => [id, index + 1]));
  const blockedIds = new Set(selection.blockedIds);
  allCandidates = allCandidates.map((candidate) => ({
    ...candidate,
    visualSelection: {
      model: selection.model,
      preferredRank: preferredRank.get(candidate.id) || 0,
      blocked: blockedIds.has(candidate.id),
    },
  }));
  return {
    startedAt,
    completedAt: nowIso(),
    queries: uniqueQueries,
    reviewModel: VISUAL_REVIEW_MODEL,
    selectionModel: selection.model,
    selectionNotes: selection.notes,
    retryQueries: selection.retryQueries,
    wikimediaAssets: allCandidates.filter((candidate) => candidate.provider === "wikimedia"),
    stockCandidates: allCandidates.filter((candidate) => candidate.provider !== "wikimedia"),
    attributions: wikimedia.attributions,
  };
}

export function segmentSearchQueries(segment, evidence) {
  const base = cleanText(segment.text).toLowerCase();
  const teams = [evidence.match?.teamA, evidence.match?.teamB].filter(Boolean).join(" ");
  const visualQueries = Array.isArray(evidence.visualBrief?.teamVisualQueries) ? evidence.visualBrief.teamVisualQueries.map(cleanText).filter(Boolean) : [];
  const viralQueries = Array.isArray(evidence.viralStrategy?.visualStyle?.beatSearchQueries)
    ? evidence.viralStrategy.visualStyle.beatSearchQueries.map(cleanText).filter(Boolean)
    : [];
  if (evidence.viralStrategy?.version === "viral2" && segment.number === 1 && viralQueries.length) {
    return [...viralQueries, ...visualQueries, "football fans pressure stadium", "soccer team flag vertical"].filter(Boolean).slice(0, 8);
  }
  const mentionedPlayer = (Array.isArray(evidence.keyPlayers) ? evidence.keyPlayers : []).find((player) => {
    const last = cleanText(player.name).split(/\s+/).slice(-1)[0];
    return last && new RegExp(`\\b${last}\\b`, "i").test(base);
  });
  if (mentionedPlayer) {
    return [
      `${mentionedPlayer.name} ${mentionedPlayer.team || ""} football`,
      `${mentionedPlayer.team || "soccer"} player training vertical`,
      "football player close up training",
    ];
  }
  if (/career mode|fifa|formation|tinkering|video game/.test(base)) {
    return ["soccer tactics board vertical", "football formation board", "soccer video game controller", "table soccer game vertical"];
  }
  if (/press|midfield|tactic|pressure|counter|transition|formation|defensive|manager|coach|pochettino/.test(base)) {
    return [`football tactical board ${teams}`, "soccer coach tactics board", "football midfield pressure training"];
  }
  if (/fans|comments|jail|court|group chat|chaos|panic|hype|pressure|crumble|expectations|home/.test(base)) {
    return [
      ...viralQueries,
      ...visualQueries,
      "United States soccer fans flag",
      "USA soccer fans stadium",
      "football supporters nervous",
      "soccer fans reaction crowd",
    ].filter(Boolean);
  }
  if (/goal|save|keeper|shot|moment/.test(base)) {
    return ["soccer goalkeeper save vertical", "football goal celebration stadium", "soccer match action"];
  }
  if (/usa|usmnt|united states|yanks|american/i.test(base) || /usa|usmnt|united states/i.test(evidence.topic || "")) {
    return [
      ...visualQueries,
      "American soccer player training vertical",
      "United States soccer fans flag",
      "soccer stadium crowd vertical",
    ].filter(Boolean);
  }
  return [`world cup football stadium ${teams}`, "soccer stadium crowd vertical", "football boots pitch close up"];
}

export function stockProviderQuery(query, segment, evidence) {
  const text = cleanText(`${query || ""} ${segment?.text || ""} ${evidence?.topic || ""}`).toLowerCase();
  if (/set piece|corner|header|free kick|second minute|goal|volley/.test(text)) {
    return "soccer set piece stadium vertical";
  }
  if (/soldier field|crowd|fans|pressure|panic|friendly|home/.test(text)) {
    return "soccer stadium crowd fans vertical";
  }
  if (/pochettino|coach|tactic|formation|career mode|restart button/.test(text)) {
    return "soccer coach tactics training vertical";
  }
  if (/rookie|squad|training|debut|player|usmnt|usa|united states/.test(text)) {
    return "soccer team training vertical";
  }
  if (/goalkeeper|keeper|courtroom|debate/.test(text)) {
    return "soccer goalkeeper pressure vertical";
  }
  return cleanText(query || "soccer match stadium vertical");
}

export function clipLooksContextMismatched(clip, evidence) {
  const metadataText = cleanText(`${clip.pageUrl || ""} ${clip.tags || ""}`).toLowerCase();
  const text = cleanText(`${clip.pageUrl || ""} ${clip.query || ""} ${clip.tags || ""}`).toLowerCase();
  const topic = cleanText(`${evidence?.topic || ""} ${evidence?.match?.teamA || ""} ${evidence?.match?.teamB || ""}`).toLowerCase();
  const wrongSport = /basketball|baseball|american-football|cricket|tennis|afc-asian-cup|asian-cup|mma|mixed-martial|martial-arts|bodybuilding|weight-training|gym-workout|fighters|combat/.test(text);
  if (wrongSport) {
    return true;
  }
  const footballRelevant = /soccer|football|stadium|goal|match|pitch|fans?|crowd/.test(metadataText);
  if (!footballRelevant) {
    return true;
  }
  if (/usa|usmnt|united states|america|yanks/.test(topic)) {
    const explicitlyUs = /usa|usmnt|united-states|united states|american|america/.test(metadataText);
    const neutralTraining = /soccer-players|football-player|soccer-player|football-training|soccer-training/.test(metadataText);
    const genericFootballAtmosphere = /football|soccer|stadium|crowd|fans?|supporters|pitch|goal|match|training/.test(metadataText);
    if (/morocco|moroccan|maroc|rabat|qatar|turkey|turkiye|bursa|bursaspor|trabzon|trabzonspor|colombia|doha/.test(metadataText)) {
      return true;
    }
    const clearlyOtherNation = /morocco|maroc|qatar|turkey|türkiye|asian-cup|afc-asian-cup|india-siriya/.test(metadataText);
    return clearlyOtherNation || (!explicitlyUs && !neutralTraining && !genericFootballAtmosphere);
  }
  return false;
}

export function selectVisualClip(candidates, { usedAssetIds, memoryAssetIds, segment, evidence }) {
  const scored = candidates
    .filter((clip) => clip?.url && !usedAssetIds.has(clip.id) && candidateAllowedByReview(clip) && !clipLooksContextMismatched(clip, evidence))
    .map((clip) => {
      const portrait = Number(clip.height || 0) >= Number(clip.width || 0);
      const highEnough = Number(clip.height || 0) >= 640;
      const longEnough = Number(clip.duration || 0) >= Math.max(3, Number(segment.durationSeconds || 0));
      const repeated = memoryAssetIds.has(clip.id);
      const wrongSport = /basketball|baseball|american-football|cricket|tennis|mma|mixed-martial|martial-arts|bodybuilding|weight-training|gym-workout|fighters|combat/i.test(
        `${clip.pageUrl || ""} ${clip.query || ""} ${clip.tags || ""}`,
      );
      const providerBonus = 1;
      const review = clip.visualReview || localVisualReview(clip, evidence);
      const selectionBonus = clip.visualSelection?.preferredRank ? Math.max(0, 8 - clip.visualSelection.preferredRank) : 0;
      const riskPenalty = review.risk === "medium" ? 5 : review.risk === "high" ? 50 : 0;
      const relevancePenalty = Number(review.relevance || 0) < 6 ? 10 : Number(review.relevance || 0) < 7 ? 4 : 0;
      const score =
        (portrait ? 12 : 0) +
        (highEnough ? 5 : 0) +
        (longEnough ? 4 : 0) +
        (Number(review.relevance || 0) * 2) +
        selectionBonus +
        providerBonus -
        (repeated ? 24 : 0) -
        (wrongSport ? 30 : 0) -
        relevancePenalty -
        riskPenalty;
      return { clip, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.find((item) => item.score > 0)?.clip || null;
}

export function selectBackupFootballClip(candidates, { usedAssetIds, memoryAssetIds = new Set(), segment, evidence }) {
  const text = cleanText(segment?.text || "").toLowerCase();
  const footballCandidates = candidates
    .filter((clip) => clip?.url && !usedAssetIds.has(clip.id) && candidateAllowedByReview(clip) && !clipLooksContextMismatched(clip, evidence))
    .map((clip) => {
      const haystack = visualCandidateText(clip).toLowerCase();
      const portrait = Number(clip.height || 0) >= Number(clip.width || 0);
      const highEnough = Number(clip.height || 0) >= 540;
      const football = /soccer|football|stadium|crowd|fans?|supporters|goal|match|pitch|player|training|coach|tactic|formation/.test(haystack);
      const wrongSport = /basketball|baseball|american-football|cricket|tennis|mma|mixed-martial|martial-arts|bodybuilding|weight-training|gym-workout|fighters|combat/.test(haystack);
      const repeated = memoryAssetIds.has(clip.id);
      const beatMatch =
        (/fan|crowd|noise|watch|pressure|home/.test(text) && /stadium|crowd|fans?|supporters/.test(haystack)) ||
        (/tactic|pochettino|3-2-5|press|formation|possession/.test(text) && /coach|tactic|formation|training|players/.test(haystack)) ||
        (/panic|touch|shaky|nervous|break/.test(text) && /player|training|match|pressure|stadium|crowd/.test(haystack));
      const score = (portrait ? 10 : 0) + (highEnough ? 4 : 0) + (football ? 12 : 0) + (beatMatch ? 8 : 0) - (repeated ? 24 : 0) - (wrongSport ? 40 : 0);
      return { clip, score };
    })
    .filter((item) => item.score > 10)
    .sort((a, b) => b.score - a.score);
  return footballCandidates[0]?.clip || null;
}

export function impliedTeamNames(evidence) {
  const names = [evidence.match?.teamA, evidence.match?.teamB].filter(Boolean);
  const topic = `${evidence.topic || ""} ${JSON.stringify(evidence.sourcedClaims || [])}`;
  if (/usa|usmnt|united states|yanks/i.test(topic)) {
    names.push("United States men's national soccer team");
  }
  return [...new Set(names.map(cleanText).filter(Boolean))].slice(0, 4);
}

export function assetMatchTerms(asset) {
  const terms = [];
  const source = cleanText(`${asset.sourcePlayer || ""} ${asset.sourceTeam || ""}`);
  const words = source.split(/\s+/).filter((word) => word.length > 3);
  if (words.length) {
    terms.push(words[words.length - 1]);
  }
  if (/united states|usmnt|usa/i.test(source)) {
    terms.push("USA", "USMNT", "United States", "Yanks", "home soil");
  }
  return [...new Set(terms.map(cleanText).filter(Boolean))];
}

export function assetMatchesSegment(asset, segment, evidence) {
  const haystack = cleanText(`${segment.text || ""} ${evidence.topic || ""}`);
  return assetMatchTerms(asset).some((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(haystack));
}

export function candidateAllowedByReview(candidate) {
  const review = candidate.visualReview || {};
  const risk = cleanText(review.risk).toLowerCase();
  if (candidate.visualSelection?.blocked || risk === "high") {
    return false;
  }
  const flags = Array.isArray(review.flags) ? review.flags.join(" ").toLowerCase() : "";
  return !/(source-risk|off-topic|watermark|broadcast|getty|ap\/fifa|fifa source)/i.test(flags);
}

export function isLocalProofAsset(asset) {
  return cleanText(asset?.provider).toLowerCase() === "local-asset-pack" || Boolean(asset?.backupOnly);
}

export function stockCandidateMatchesSegment(candidate, segment, evidence) {
  if (!candidateAllowedByReview(candidate) || clipLooksContextMismatched(candidate, evidence)) {
    return false;
  }
  const text = cleanText(`${segment.text || ""} ${segment.visualIntent || ""}`).toLowerCase();
  const candidateText = visualCandidateText(candidate).toLowerCase();
  if (/career mode|fifa|formation|tinkering|tactic/.test(text)) {
    return /tactic|formation|coach|board|soccer|football|controller|table-soccer/.test(candidateText);
  }
  if (/pulisic|player|goal|drought|one player/.test(text)) {
    return /player|football|soccer|goal|training|match|pitch/.test(candidateText);
  }
  if (/panic|pressure|trap|headache|home|fans|comment|fairy tale/.test(text)) {
    return /fans?|crowd|stadium|flag|soccer|football|supporters|reaction/.test(candidateText);
  }
  return /soccer|football|stadium|fans?|crowd|goal|match|pitch|player/.test(candidateText);
}

export function chooseImageForSegment({
  assets,
  segment,
  evidence,
  imageSlotsUsed,
  localImageSlotsUsed = 0,
  usedAssetIds,
  maxImageSlots = WORLD_CUP_MAX_IMAGE_SEGMENTS,
  maxLocalImageSlots = WORLD_CUP_LOCAL_PROOF_MAX_PER_VIDEO,
}) {
  const reviewedAssets = assets
    .filter((asset) => !usedAssetIds.has(asset.id) && candidateAllowedByReview(asset))
    .filter((asset) => !isLocalProofAsset(asset) || localImageSlotsUsed < maxLocalImageSlots)
    .sort((a, b) => Number(isLocalProofAsset(a)) - Number(isLocalProofAsset(b)));
  const directMatch = reviewedAssets.find((asset) => assetMatchesSegment(asset, segment, evidence) && !isLocalProofAsset(asset));
  if (directMatch) {
    return directMatch;
  }
  if (imageSlotsUsed >= maxImageSlots) {
    return null;
  }
  const localDirectMatch = reviewedAssets.find((asset) => assetMatchesSegment(asset, segment, evidence));
  if (localDirectMatch) {
    return localDirectMatch;
  }
  const text = cleanText(`${segment.text || ""} ${evidence.topic || ""}`).toLowerCase();
  if (segment.number === 1 || /usa|usmnt|united states|home|pulisic|player|team|pressure/.test(text)) {
    return reviewedAssets[0] || null;
  }
  return null;
}

export function imageProofShouldOverrideClip({ image, clip, segment, evidence, imageSlotsUsed, totalSegments }) {
  if (!image || imageSlotsUsed >= WORLD_CUP_MAX_IMAGE_SEGMENTS) {
    return false;
  }
  const text = cleanText(`${segment.text || ""} ${segment.visualIntent || ""} ${evidence.topic || ""}`).toLowerCase();
  const proofBeat =
    segment.number === 1 ||
    /usa|usmnt|united states|pulisic|player|team|proof|lost|germany|send-off|home|pressure/.test(text) ||
    assetMatchesSegment(image, segment, evidence);
  if (!proofBeat) {
    return false;
  }
  if (!clip) {
    return true;
  }
  const clipText = visualCandidateText(clip).toLowerCase();
  const clipIsGeneric = !/usa|usmnt|united states|american|germany|player|training|match|stadium|fans?|crowd/.test(clipText);
  const earlyProofBudget = Math.max(1, Math.min(WORLD_CUP_MAX_IMAGE_SEGMENTS, Math.ceil(Number(totalSegments || 0) * 0.25)));
  return imageSlotsUsed < earlyProofBudget && (segment.number <= 2 || clipIsGeneric);
}

export async function buildVisualPlan({ evidence, srtSegments, keyInfo, options, warnings, visualScout = null, selectedScript = null }) {
  const attributions = [];
  let wikimediaAssets = WORLD_CUP_ENABLE_WIKIMEDIA_VISUALS && Array.isArray(visualScout?.wikimediaAssets) ? visualScout.wikimediaAssets : [];
  const localEntityLayer = await buildLocalEntityLayer({ evidence, srtSegments, selectedScript, keyInfo, options, warnings });
  const memory = await loadWorldCupMemory({ excludeId: options.id, limit: WORLD_CUP_CLIP_REUSE_COOLDOWN_VIDEOS });
  const memoryAssetIds = new Set(memory.visualAssetIds || []);
  const usedAssetIds = new Set();
  if (WORLD_CUP_ENABLE_WIKIMEDIA_VISUALS && !wikimediaAssets.length && !visualScout && !options.offline) {
    const resolved = await resolveWikimediaVisualAssets(evidence);
    wikimediaAssets = resolved.assets;
    attributions.push(...resolved.attributions);
  } else {
    attributions.push(...(Array.isArray(visualScout?.attributions) ? visualScout.attributions : []));
  }
  const scoutedStockCandidates = Array.isArray(visualScout?.stockCandidates) ? visualScout.stockCandidates : [];

  const pexelsKey = await getActiveStockKey("pexels");
  const pixabayKey = await getActiveStockKey("pixabay");
  const canSearchStock = !options.offline && Boolean(pexelsKey?.apiKey || pixabayKey?.apiKey);
  const segments = [];
  let imageSlotsUsed = 0;
  let localImageSlotsUsed = 0;
  let clipSlotsUsed = 0;

  for (const segment of srtSegments) {
    const queries = segmentSearchQueries(segment, evidence);
    let candidates = [];
    candidates.push(...scoutedStockCandidates.filter((candidate) => stockCandidateMatchesSegment(candidate, segment, evidence)));
    if (candidates.length < 3 && canSearchStock && options.source !== "fallback-only") {
      for (const [queryIndex, query] of queries.slice(0, 3).entries()) {
        const page = 1 + ((Number(segment.number || 1) + queryIndex) % 3);
        const stockQuery = stockProviderQuery(query, segment, evidence);
        try {
          if (pexelsKey?.apiKey) {
            candidates.push(...(await searchPexelsVideos(stockQuery, pexelsKey.apiKey, page)));
          }
          if (pixabayKey?.apiKey) {
            candidates.push(...(await searchPixabayVideos(stockQuery, pixabayKey.apiKey, page)));
          }
        } catch (error) {
          warnings.push(`Stock search failed for "${stockQuery}": ${error.message}`);
        }
      }
    }
    const uniqueCandidates = [...new Map(candidates.map((clip) => [clip.id, clip])).values()];
    let selectedClip = selectVisualClip(uniqueCandidates, { usedAssetIds, memoryAssetIds, segment, evidence });
    if (!selectedClip) {
      selectedClip = selectBackupFootballClip(uniqueCandidates, { usedAssetIds, memoryAssetIds, segment, evidence });
      if (selectedClip) {
        warnings.push(`Segment ${segment.number} used backup football clip instead of fallback board.`);
      }
    }
    let selectedImage = chooseImageForSegment({
      assets: wikimediaAssets,
      segment,
      evidence,
      imageSlotsUsed,
      localImageSlotsUsed,
      usedAssetIds,
      maxImageSlots: WORLD_CUP_MAX_IMAGE_SEGMENTS,
      maxLocalImageSlots: WORLD_CUP_LOCAL_PROOF_MAX_PER_VIDEO,
    });
    const entityOverlay = localEntityLayer.segments?.[String(segment.number)] || null;
    if (!imageProofShouldOverrideClip({ image: selectedImage, clip: selectedClip, segment, evidence, imageSlotsUsed, totalSegments: srtSegments.length })) {
      selectedImage = null;
    }
    if (entityOverlay?.assets?.length) {
      if (selectedClip) {
        selectedImage = null;
      }
      for (const overlayItem of entityOverlay.assets) {
        attributions.push({
          assetId: overlayItem.asset.id,
          title: overlayItem.asset.title,
          creator: overlayItem.asset.creator,
          license: overlayItem.asset.license,
          sourceUrl: overlayItem.asset.url,
          rightsStatus: overlayItem.asset.rightsStatus || "user_supplied",
          provider: "local-downloads",
          entity: overlayItem.entity,
        });
      }
    }
    if (selectedImage) {
      usedAssetIds.add(selectedImage.id);
      imageSlotsUsed += 1;
      if (isLocalProofAsset(selectedImage)) {
        localImageSlotsUsed += 1;
      }
      selectedClip = null;
    }
    if (selectedClip) {
      usedAssetIds.add(selectedClip.id);
      clipSlotsUsed += 1;
      attributions.push({
        assetId: selectedClip.id,
        title: selectedClip.query,
        creator: selectedClip.creator,
        license: selectedClip.provider === "pexels" ? "Pexels license" : "Pixabay license",
        sourceUrl: selectedClip.pageUrl,
        rightsStatus: "approved",
      });
    }
    segments.push({
      number: segment.number,
      startTime: segment.startTime,
      endTime: segment.endTime,
      durationSeconds: segment.durationSeconds,
      captionText: segment.text,
      visualIntent: visualIntentForSegment(segment, evidence),
      searchQueries: queries,
      selectedImage: selectedImage || null,
      selectedClip,
      entityOverlay,
      candidates: uniqueCandidates.slice(0, 6),
      fallbackVisual: fallbackVisualForSegment(segment, evidence),
      rightsStatus: entityOverlay?.assets?.length ? "user_supplied" : selectedImage || selectedClip ? "approved" : "fallback_used",
    });
  }

  const minClipSegments = Math.max(1, Math.floor(segments.length * WORLD_CUP_MIN_CLIP_RATIO));
  if (canSearchStock && clipSlotsUsed < minClipSegments) {
    warnings.push(`Only ${clipSlotsUsed}/${segments.length} visual beats use video clips; target is at least ${minClipSegments}.`);
  }

  return {
    title: evidence.match?.teamA && evidence.match?.teamB ? `${evidence.match.teamA} vs ${evidence.match.teamB}` : evidence.topic,
    directorSummary: buildDirectorSummary(evidence),
    aspectRatio: "9:16",
    captionStyle: "creator-yellow-pop",
    captionAnimation: "slide-lift",
    visualPacing: "Change visual every 3 to 6 seconds; use tactical/card fallback when rights are unclear.",
    playerAssets: wikimediaAssets,
    localEntityLayer: localEntityLayer.enabled
      ? {
          model: localEntityLayer.model,
          downloadsRoot: localEntityLayer.downloadsRoot,
          entities: localEntityLayer.entities,
          selectedAssets: localEntityLayer.selectedAssets.map((asset) => ({
            id: asset.id,
            title: asset.title,
            url: asset.url,
            provider: asset.provider,
            rightsStatus: asset.rightsStatus,
            localEntity: asset.localEntity,
            visualReview: asset.visualReview,
          })),
        }
      : { enabled: false },
    visualScout: visualScout
      ? {
          reviewModel: visualScout.reviewModel,
          selectionModel: visualScout.selectionModel,
          queries: visualScout.queries,
          retryQueries: visualScout.retryQueries,
          notes: visualScout.selectionNotes,
          stockCandidates: scoutedStockCandidates.length,
          wikimediaAssets: wikimediaAssets.length,
        }
      : null,
    segments,
    attributions,
    warnings: canSearchStock ? [] : ["No stock media key found, fallback visuals were used for stock beats."],
  };
}

export function visualPlanRealVisualRatio(visualPlan = {}) {
  const segments = Array.isArray(visualPlan.segments) ? visualPlan.segments : [];
  if (!segments.length) {
    return 0;
  }
  return segments.filter((segment) => segment.selectedClip || segment.selectedImage || segment.entityOverlay?.assets?.length).length / segments.length;
}

export function visualPlanFallbackCount(visualPlan = {}) {
  const segments = Array.isArray(visualPlan.segments) ? visualPlan.segments : [];
  return segments.filter((segment) => !segment.selectedClip && !segment.selectedImage && !segment.entityOverlay?.assets?.length).length;
}

export function visualPlanNeedsRetry(visualPlan = {}) {
  const segments = Array.isArray(visualPlan.segments) ? visualPlan.segments : [];
  if (segments.length < 4) {
    return false;
  }
  return visualPlanFallbackCount(visualPlan) > 0 || visualPlanRealVisualRatio(visualPlan) < WORLD_CUP_MIN_REAL_VISUAL_RATIO;
}

export function visualIntentForSegment(segment, evidence) {
  const text = segment.text || "";
  const viralStyle = evidence.viralStrategy?.visualStyle || {};
  if (segment.number === 1) {
    return evidence.viralStrategy?.version === "viral2"
      ? `First-frame contradiction. Use cover text "${evidence.viralStrategy.coverText || "TRAP GAME ALERT"}" with a real team/flag proof beat if safe.`
      : "First-frame hook graphic with huge cover text, team colors, and instant controversy.";
  }
  if (evidence.viralStrategy?.version === "viral2" && /panic button|panic|trap|break|pressure|real opponent/i.test(text)) {
    return "Viral 2.0 pressure beat: crowd tension, red panic overlay, quick zoom, or tactical panic-card interruption.";
  }
  if (/career mode|fifa|formation|tinkering/i.test(text)) {
    return "Visual joke: football formation board or game-controller style graphic, quick zoom on the punchline.";
  }
  if (/press|midfield|tactic|transition/i.test(text)) {
    return "Simple tactical board with arrows, pressure zones, and team-color accents.";
  }
  if (/fans|comments|group chat|jail|chaos|cooked/i.test(text)) {
    return "Humor cutaway: fan reaction, comment-war energy, fast visual punch.";
  }
  if (/goal|save|moment|mistake|counter/i.test(text)) {
    return "Action beat with match-moment tension, quick zoom, and scoreboard-card overlay.";
  }
  const teams = [evidence.match?.teamA, evidence.match?.teamB].filter(Boolean).join(" vs ");
  return viralStyle.summary ? `${viralStyle.summary} Current beat: ${text.slice(0, 120)}` : `Football atmosphere shot with ${teams || "World Cup"} context and bold data-card overlay.`;
}

export function fallbackVisualForSegment(segment, evidence) {
  const teams = [evidence.match?.teamA, evidence.match?.teamB].filter(Boolean);
  const palette = segment.number % 3 === 0 ? "emerald and gold" : segment.number % 3 === 1 ? "navy and yellow" : "black, white, and red";
  const text = cleanText(segment.text);
  const topic = cleanText(evidence.topic || "");
  if (segment.number === 1) {
    return {
      type: "hook-card",
      palette: "black, yellow, and deep green",
      headline: evidence.viralStrategy?.coverText || (/usmnt|usa|united states/i.test(`${text} ${topic}`) ? "HOME ADVANTAGE TRAP?" : "WORLD CUP WARNING"),
      subline: "",
    };
  }
  if (/career mode|fifa|formation|tinkering/i.test(text)) {
    return {
      type: "formation-gag-card",
      palette: "navy and yellow",
      headline: "CAREER MODE FC",
      subline: "",
    };
  }
  if (/panic|pressure|trap|headache/i.test(text)) {
    return {
      type: "pressure-card",
      palette: "black, white, and red",
      headline: /usmnt|usa|united states/i.test(`${text} ${topic}`) ? "USMNT PANIC MODE" : "PRESSURE TEST",
      subline: "",
    };
  }
  return {
    type: /press|midfield|tactic/i.test(segment.text) ? "tactical-board" : "worldcup-card",
    palette,
    headline: teams.length === 2 ? `${teams[0]} vs ${teams[1]}` : "World Cup Chaos Desk",
    subline: "",
  };
}

export function buildDirectorSummary(evidence) {
  const topic = evidence.match?.teamA && evidence.match?.teamB ? `${evidence.match.teamA} vs ${evidence.match.teamB}` : evidence.topic;
  const keyClaim = evidence.sourcedClaims?.[0]?.claim || evidence.tacticalMatchup?.[0]?.claim || "pressure and fan emotion drive the story";
  if (evidence.viralStrategy?.version === "viral2") {
    return `Viral 2.0 reel about ${topic}. One-sentence promise: ${evidence.viralStrategy.oneSentenceContradiction || keyClaim}. Visual language: ${evidence.viralStrategy.visualStyle?.summary || "real proof beat, crowd pressure, tactical cards, and joke overlays"}. Pacing: ${evidence.viralStrategy.visualStyle?.pacing || "change visual every 2.5 to 5 seconds"}.`;
  }
  return `Fast football creator reel about ${topic}. Visual language should feel like a smart fan desk: quick cards, tactical boards, safe stock crowd/action clips, and player cards only when rights are approved. Main visual thesis: ${keyClaim}`;
}

export function buildRightsManifest(visualPlan) {
  const assetRows = [];
  for (const segment of visualPlan.segments || []) {
    if (segment.entityOverlay?.assets?.length) {
      for (const overlay of segment.entityOverlay.assets) {
        const asset = overlay.asset || {};
        assetRows.push({
          segment: segment.number,
          assetId: asset.id,
          provider: asset.provider || "local-downloads",
          sourceUrl: asset.url || "",
          rightsStatus: asset.rightsStatus || "user_supplied",
          flags: asset.visualReview?.flags || [],
          visualReview: asset.visualReview || null,
          entity: overlay.entity || asset.localEntity?.name || "",
        });
      }
    }
    if (segment.selectedImage) {
      const imageRiskText = cleanText(`${segment.selectedImage.title || ""} ${segment.selectedImage.pageUrl || ""} ${segment.selectedImage.creator || ""}`);
      const flags = [
        ...(segment.selectedImage.visualReview?.flags || []),
        ...(/nike|adidas|puma|logo|crest|badge|fifa|getty|ap news|associated press/i.test(imageRiskText) ? ["brand-or-source-visibility-review"] : []),
      ];
      assetRows.push({
        segment: segment.number,
        assetId: segment.selectedImage.id,
        provider: "wikimedia",
        sourceUrl: segment.selectedImage.pageUrl,
        rightsStatus: "approved",
        flags,
        visualReview: segment.selectedImage.visualReview || null,
      });
    } else if (segment.selectedClip) {
      assetRows.push({
        segment: segment.number,
        assetId: segment.selectedClip.id,
        provider: segment.selectedClip.provider,
        sourceUrl: segment.selectedClip.pageUrl,
        rightsStatus: "approved",
        flags: segment.selectedClip.visualReview?.flags || [],
        visualReview: segment.selectedClip.visualReview || null,
      });
    } else if (!segment.entityOverlay?.assets?.length) {
      assetRows.push({
        segment: segment.number,
        assetId: `fallback-${segment.number}`,
        provider: "local-generated-card",
        sourceUrl: "",
        rightsStatus: "fallback_used",
        flags: ["no licensed player image or stock clip attached"],
      });
    }
  }
  return {
    policy: "Gemini vision may flag risk, but source URL, license, and approved asset status decide use.",
    assets: assetRows,
    blocked: assetRows.filter((asset) => asset.rightsStatus === "blocked"),
    needsReview: assetRows.filter((asset) => asset.rightsStatus === "needs_review"),
  };
}

export function reviewWorldCupRun(run) {
  const issues = [];
  const evidenceQuality = run.evidence?.evidenceQuality || {};
  if (evidenceQuality.needsReview) {
    issues.push("Evidence needs review before publishing hard claims.");
  }
  if (hasHardStat(`${run.selectedScript?.text || ""} ${run.selectedScript?.dataPoint || ""}`) && !trustedSourceClaims(run.evidence).some((claim) => hasHardStat(claim.claim))) {
    issues.push("Selected script may contain hard stats without trusted sourced claims.");
  }
  const visualSegments = Array.isArray(run.visualPlan?.segments) ? run.visualPlan.segments : [];
  const visualIds = visualSegments
    .map((segment) => segment.selectedClip?.id || segment.selectedImage?.id || segment.entityOverlay?.assets?.map((item) => item.asset?.id).filter(Boolean).join("+") || "")
    .filter(Boolean);
  const uniqueVisualCount = new Set(visualIds).size;
  const realVisualCount = visualSegments.filter((segment) => segment.selectedClip || segment.selectedImage || segment.entityOverlay?.assets?.length).length;
  const realVisualRatio = visualSegments.length ? realVisualCount / visualSegments.length : 0;
  if (visualIds.length >= 4 && uniqueVisualCount / visualIds.length < 0.7) {
    issues.push("Visual variety is low; clips repeat too much.");
  }
  if (visualSegments.length >= 4 && realVisualRatio < WORLD_CUP_MIN_REAL_VISUAL_RATIO) {
    issues.push(`Too many fallback boards; real image/clip coverage is ${Math.round(realVisualRatio * 100)}%.`);
  }
  if (!run.audio?.file && !run.audio?.durationSeconds) {
    issues.push("No generated TTS audio attached.");
  }
  if (run.strategy === "viral2") {
    const topicScore = Number(run.viralStrategy?.topicScore?.total || 0);
    const scriptQuality = run.selectedScript?.viralQuality || run.viralStrategy?.scriptGate?.quality || {};
    const postQuality = run.postRenderQuality || {};
    if (topicScore && topicScore < 65) {
      issues.push(`Viral 2.0 topic score is too weak (${topicScore}/100).`);
    }
    if (scriptQuality.decision && scriptQuality.decision !== "publish_candidate") {
      issues.push(`Viral 2.0 script gate says ${scriptQuality.decision}.`);
    }
    if (Array.isArray(scriptQuality.hardFails) && scriptQuality.hardFails.length) {
      issues.push(`Viral 2.0 hard fails: ${scriptQuality.hardFails.slice(0, 2).join("; ")}.`);
    }
    if (postQuality.decision && postQuality.decision !== "publish_candidate") {
      issues.push(`Post-render QC says ${postQuality.decision}.`);
    }
  }
  return {
    status: issues.length ? "needs_review" : "publish_candidate",
    issues,
    checkedAt: nowIso(),
  };
}

export async function planWorldCupVisualsWithRetries({ run, keyInfo, options, initialVisualScoutPromise = null }) {
  let visualScout = null;
  const warnings = run.warnings || [];
  if (initialVisualScoutPromise) {
    const visualScoutResult = await initialVisualScoutPromise;
    if (visualScoutResult?.error) {
      warnings.push(`Parallel visual scout failed, planner will search normally: ${visualScoutResult.error.message}`);
    } else {
      visualScout = visualScoutResult;
      run.visualScout = visualScout;
      run.files.visualScout = await writeRunFile(run, "visual-scout.json", `${JSON.stringify(visualScout, null, 2)}\n`, "utf8");
    }
  }

  let plan = await buildVisualPlan({ evidence: run.evidence, srtSegments: run.srt.segments, keyInfo, options, warnings, visualScout, selectedScript: run.selectedScript || run.tts });
  let attempt = 0;
  while (visualPlanNeedsRetry(plan) && attempt < WORLD_CUP_VISUAL_RETRY_ATTEMPTS && !options.offline) {
    attempt += 1;
    warnings.push(
      `Visual plan retry ${attempt}: fallback count ${visualPlanFallbackCount(plan)}, real coverage ${Math.round(visualPlanRealVisualRatio(plan) * 100)}%. Keeping script/TTS/SRT and rebuilding visuals only.`,
    );
    const retryOptions = { ...options, visualRetryAttempt: attempt };
    const retryScoutResult = await withTimeout(
      scoutWorldCupVisualAssets({
        evidence: run.evidence,
        selectedScript: run.selectedScript,
        keyInfo,
        options: retryOptions,
        warnings,
      }),
      VISUAL_SCOUT_TIMEOUT_MS,
      `Visual retry scout ${attempt}`,
    ).catch((error) => ({ error }));
    if (retryScoutResult?.error) {
      warnings.push(`Visual retry ${attempt} scout failed: ${retryScoutResult.error.message}`);
      continue;
    }
    visualScout = retryScoutResult;
    run.visualScout = visualScout;
    run.files.visualScout = await writeRunFile(run, "visual-scout.json", `${JSON.stringify(visualScout, null, 2)}\n`, "utf8");
    plan = await buildVisualPlan({ evidence: run.evidence, srtSegments: run.srt.segments, keyInfo, options: retryOptions, warnings, visualScout, selectedScript: run.selectedScript || run.tts });
  }

  return plan;
}
