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

export function srtTimestamp(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const totalMs = Math.round(safe * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function assTimestamp(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const totalCs = Math.round(safe * 100);
  const hours = Math.floor(totalCs / 360000);
  const minutes = Math.floor((totalCs % 360000) / 6000);
  const secs = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function normalizeTimedCaptionSegments(rawSegments = []) {
  const sorted = (Array.isArray(rawSegments) ? rawSegments : [])
    .map((segment, index) => {
      const startTime = Math.max(0, Number(segment.startTime ?? segment.start ?? 0) || 0);
      const endTime = Math.max(startTime + 0.45, Number(segment.endTime ?? segment.end ?? startTime + 1.8) || startTime + 1.8);
      const text = normalizeFootballCaptionText(segment.text || segment.caption || segment.line || "");
      return text ? { ...segment, number: index + 1, startTime, endTime, durationSeconds: endTime - startTime, text } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.startTime - b.startTime);
  let previousEnd = 0;
  return sorted.map((segment, index) => {
    const nextStart = sorted[index + 1]?.startTime;
    const startTime = Math.max(index === 0 ? 0 : previousEnd + 0.03, Number(segment.startTime) || 0);
    let endTime = Math.max(startTime + 0.45, Number(segment.endTime) || startTime + 1.8);
    if (Number.isFinite(nextStart) && nextStart > startTime) {
      endTime = Math.min(endTime, Math.max(startTime + 0.45, nextStart - 0.03));
    }
    endTime = Math.min(endTime, startTime + 5.8);
    if (endTime <= startTime + 0.3) {
      endTime = startTime + 0.45;
    }
    previousEnd = endTime;
    return {
      ...segment,
      number: index + 1,
      startTime,
      endTime,
      durationSeconds: endTime - startTime,
    };
  });
}

export function buildSrt(segments) {
  return normalizeTimedCaptionSegments(segments)
    .map((segment, index) => {
      const text = cleanText(segment.text || segment.caption || segment.line);
      return text ? `${index + 1}\n${srtTimestamp(segment.startTime)} --> ${srtTimestamp(segment.endTime)}\n${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function parseSrtTimestamp(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!match) {
    return 0;
  }
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(millis.padEnd(3, "0")) / 1000;
}

export function parseSrtSegments(srtText) {
  const segments = String(srtText || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block, index) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const timeIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeIndex === -1) {
        return null;
      }
      const [startRaw, endRaw] = lines[timeIndex].split("-->").map((part) => part.trim());
      const startTime = parseSrtTimestamp(startRaw);
      const endTime = parseSrtTimestamp(endRaw);
      const text = normalizeFootballCaptionText(lines.slice(timeIndex + 1).join(" "));
      if (!text || endTime <= startTime) {
        return null;
      }
      return { number: index + 1, startTime, endTime, durationSeconds: endTime - startTime, text };
    })
    .filter(Boolean);
  return normalizeTimedCaptionSegments(segments);
}

export function normalizeFootballCaptionText(text) {
  let cleaned = cleanText(repairCommonMojibake(text));
  const replacements = [
    [/\bgold drought\b/gi, "goal drought"],
    [/\bgolden drought\b/gi, "goal drought"],
    [/\bquarter final\b/gi, "quarterfinal"],
    [/\bU S M N T\b/gi, "USMNT"],
    [/\bU S\b/gi, "US"],
  ];
  for (const [pattern, replacement] of replacements) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleanText(cleaned);
}

export function splitIntoCaptionLines(text) {
  const cleaned = stripTagsForSpeech(text)
    .replace(/([.!?])\s+/g, "$1|")
    .split("|")
    .map(cleanText)
    .filter(Boolean);
  if (cleaned.length >= 4) {
    return cleaned;
  }
  const words = stripTagsForSpeech(text).split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let index = 0; index < words.length; index += 8) {
    chunks.push(words.slice(index, index + 8).join(" "));
  }
  return chunks.filter(Boolean);
}

export function estimateSrtFromText(text, durationSeconds = 0) {
  const lines = splitIntoCaptionLines(text);
  const totalWords = Math.max(1, lines.join(" ").split(/\s+/).filter(Boolean).length);
  const estimatedDuration = Number(durationSeconds || 0) || Math.min(58, Math.max(30, totalWords * 0.36 + 4));
  let cursor = 0;
  const segments = lines.map((line, index) => {
    const wordCount = Math.max(1, line.split(/\s+/).filter(Boolean).length);
    const proportional = (wordCount / totalWords) * estimatedDuration;
    const duration = Math.min(5.6, Math.max(1.2, proportional));
    const startTime = cursor;
    const isLast = index === lines.length - 1;
    const endTime = isLast ? Math.max(startTime + 1, estimatedDuration) : Math.min(estimatedDuration, cursor + duration);
    cursor = endTime;
    return { number: index + 1, startTime, endTime, durationSeconds: endTime - startTime, text: line };
  });
  for (const segment of segments) {
    segment.text = normalizeFootballCaptionText(segment.text);
  }
  const normalizedSegments = normalizeTimedCaptionSegments(segments);
  return { segments: normalizedSegments, srt: buildSrt(normalizedSegments), source: "estimated-from-script" };
}

export async function generateAudioAwareSrt({ keyInfo, audioBase64, mimeType, screenplay, durationSeconds, warnings }) {
  if (!audioBase64 || !keyInfo?.apiKey) {
    return estimateSrtFromText(screenplay, durationSeconds);
  }
  const prompt = `
You are a subtitle timing editor for fast football short videos.
Listen to the audio and create accurate English SRT-style caption segments.

Rules:
- Output JSON only.
- Use the actual audio pace, not the written script pace.
- Keep captions punchy and readable, usually 2 to 7 words.
- Segment duration should usually be 1.0 to 3.5 seconds.
- Do not leave large silent gaps unless there is actual silence.
- Preserve spoken words. Do not add facts.

Return:
{
  "audioSummary": "short timing summary",
  "segments": [
    {"startTime": 0.0, "endTime": 1.8, "text": "caption words"}
  ]
}
`.trim();
  try {
    const result = await requestGeminiJsonWithFallbacks({
      keyInfo,
      primaryModel: AUDIO_SRT_MODEL,
      fallbackModels: AUDIO_SRT_FALLBACK_MODELS,
      temperature: 0.2,
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || "audio/wav", data: audioBase64 } },
      ],
    });
    const rawSegments = Array.isArray(result.json?.segments) ? result.json.segments : [];
    const segments = normalizeTimedCaptionSegments(
      rawSegments
      .map((segment, index) => {
        const startTime = Math.max(0, Number(segment.startTime ?? segment.start ?? 0) || 0);
        const endTime = Math.max(startTime + 0.5, Number(segment.endTime ?? segment.end ?? startTime + 2) || startTime + 2);
        const text = normalizeFootballCaptionText(segment.text || segment.caption || "");
        return text ? { number: index + 1, startTime, endTime, durationSeconds: endTime - startTime, text } : null;
      })
      .filter(Boolean),
    );
    if (!segments.length) {
      throw new Error("No valid SRT segments returned.");
    }
    return {
      audioSummary: result.json.audioSummary || "",
      segments,
      srt: buildSrt(segments),
      source: "audio-aware-gemini",
      model: result.model || AUDIO_SRT_MODEL,
    };
  } catch (error) {
    warnings.push(`Audio-aware SRT fell back to script timing: ${error.message}`);
    return estimateSrtFromText(screenplay, durationSeconds);
  }
}

export function captionPresetDesignConfig(preset = WORLD_CUP_CAPTION_PRESET) {
  const id = normalizeWorldCupCaptionPreset(preset);
  const configs = {
    "creator-yellow-pop": {
      style: "creator-yellow-pop",
      baseColor: "#ffffff",
      highlightColor: "#ffe600",
      animation: "pop",
      powerfulAnimation: "punch",
      middleAnimation: "impact",
      defaultFontScale: 0.98,
    },
    "chaos-debate": {
      style: "chaos-debate",
      baseColor: "#ffffff",
      highlightColor: "#ffde3b",
      animation: "kinetic",
      powerfulAnimation: "punch",
      middleAnimation: "impact",
      defaultFontScale: 1.02,
    },
    "hype-punch": {
      style: "hype-punch",
      baseColor: "#ffffff",
      highlightColor: "#39ff88",
      animation: "punch",
      powerfulAnimation: "impact",
      middleAnimation: "impact",
      defaultFontScale: 1.04,
    },
    "dark-documentary": {
      style: "dark-documentary",
      baseColor: "#f5f5f5",
      highlightColor: "#ffd166",
      animation: "slide-lift",
      powerfulAnimation: "kinetic",
      middleAnimation: "impact",
      defaultFontScale: 0.96,
    },
  };
  return configs[id] || configs["creator-yellow-pop"];
}

export function localCaptionDesign({ segments, screenplay, options }) {
  const midMode = cleanText(options.captionMidScreen || WORLD_CUP_CAPTION_MIDSCREEN || "off").toLowerCase();
  const preset = captionPresetDesignConfig(options.captionPreset || WORLD_CUP_CAPTION_PRESET);
  const powerWords = [
    "pressure",
    "trap",
    "panic",
    "chaos",
    "home",
    "advantage",
    "opponent",
    "weak",
    "wrong",
    "danger",
    "germany",
    "usa",
    "usmnt",
    "pulisic",
    "send-off",
    "ready",
    "compete",
    "fade",
    "talent",
    "wrong",
    "contrarian",
    "courtroom",
    "generation",
    "world cup",
  ];
  const scriptText = cleanText(screenplay).toLowerCase();
  const globalWords = powerWords.filter((word) => scriptText.includes(word)).slice(0, 8);
  let middleUsed = 0;
  return {
    version: "caption-design-v1",
    model: "local-caption-heuristic",
    style: preset.style,
    baseColor: preset.baseColor,
    highlightColor: preset.highlightColor,
    midScreenMode: midMode,
    emphasisWords: globalWords,
    segments: segments.map((segment) => {
      const text = cleanText(segment.text).toLowerCase();
      const localWords = powerWords.filter((word) => text.includes(word)).slice(0, 3);
      const powerful = /trap|panic|pressure|opponent|wrong|weak|courtroom|break|chaos|generation|danger|ready|advantage/.test(text);
      const shortEnoughForMiddle = cleanText(segment.text).split(/\s+/).filter(Boolean).length <= 5;
      const placement =
        midMode === "off"
          ? "bottom"
          : midMode === "on" && powerful && shortEnoughForMiddle && middleUsed++ < 3
            ? "middle"
            : midMode === "auto" && powerful && shortEnoughForMiddle && middleUsed++ < 2
              ? "middle"
              : "bottom";
      return {
        number: segment.number,
        emphasisWords: localWords.length ? localWords : globalWords.slice(0, 2),
        placement,
        animation: placement === "middle" ? preset.middleAnimation : powerful ? preset.powerfulAnimation : preset.animation,
        fontScale: placement === "middle" ? 1.12 : powerful ? Math.min(1.08, preset.defaultFontScale + 0.06) : preset.defaultFontScale,
        reason: powerful ? "High-retention power phrase." : "Readable default caption beat.",
      };
    }),
  };
}

export function normalizeCaptionDesign(raw, fallback, options) {
  const midMode = cleanText(options.captionMidScreen || WORLD_CUP_CAPTION_MIDSCREEN || "off").toLowerCase();
  const allowMiddle = midMode !== "off";
  const preset = captionPresetDesignConfig(options.captionPreset || raw?.style || fallback.style || WORLD_CUP_CAPTION_PRESET);
  let middleCount = 0;
  const rawSegments = Array.isArray(raw?.segments) ? raw.segments : [];
  const segmentMap = new Map(rawSegments.map((segment) => [Number(segment.number), segment]));
  const segments = fallback.segments.map((fallbackSegment) => {
    const source = segmentMap.get(Number(fallbackSegment.number)) || {};
    let placement = normalizeCaptionPlacement(source.placement, fallbackSegment.placement || "bottom");
    const sourceWords = cleanText(source.text || fallbackSegment.text || "").split(/\s+/).filter(Boolean).length;
    const emphasisWords = Array.isArray(source.emphasisWords)
      ? source.emphasisWords.map(cleanText).filter(Boolean).slice(0, 3)
      : fallbackSegment.emphasisWords;
    if (!allowMiddle) {
      placement = "bottom";
    }
    if (placement === "middle" && sourceWords > 5) {
      placement = "bottom";
    }
    if (placement === "middle") {
      middleCount += 1;
      if (midMode === "auto" && middleCount > 2) {
        placement = "bottom";
      }
      if (midMode === "on" && middleCount > 3) {
        placement = "bottom";
      }
    }
    return {
      number: Number(fallbackSegment.number),
      emphasisWords,
      placement,
      animation: normalizeCaptionAnimation(source.animation, fallbackSegment.animation || preset.animation || "pop"),
      fontScale: Math.max(0.82, Math.min(placement === "middle" ? 1.14 : 1.08, Number(source.fontScale || fallbackSegment.fontScale || preset.defaultFontScale || 1) || 1)),
      reason: cleanText(source.reason || fallbackSegment.reason || ""),
    };
  });
  return {
    ...fallback,
    ...raw,
    version: "caption-design-v1",
    style: preset.style,
    baseColor: cleanText(raw?.baseColor || fallback.baseColor || preset.baseColor),
    highlightColor: cleanText(raw?.highlightColor || fallback.highlightColor || preset.highlightColor),
    midScreenMode: midMode,
    emphasisWords: Array.isArray(raw?.emphasisWords)
      ? raw.emphasisWords.map(cleanText).filter(Boolean).slice(0, 12)
      : fallback.emphasisWords,
    segments,
  };
}

export async function designWorldCupCaptions({ keyInfo, segments, screenplay, selectedScript, evidence, options, warnings }) {
  const fallback = localCaptionDesign({ segments, screenplay, options });
  if (!options.captionDesign || !keyInfo?.apiKey || options.offline || !segments.length) {
    return fallback;
  }
  const midMode = cleanText(options.captionMidScreen || WORLD_CUP_CAPTION_MIDSCREEN || "off").toLowerCase();
  const preset = captionPresetDesignConfig(options.captionPreset || WORLD_CUP_CAPTION_PRESET);
  const prompt = `
You are Gemma caption director for viral football Shorts.
Create a per-SRT caption design plan. The visual style should look like modern YouTube Shorts captions:
white bold base text, yellow highlight words, thick black stroke, short pop/impact animations.

Caption preset:
- Requested preset: ${preset.style}
- Base color: ${preset.baseColor}
- Highlight color: ${preset.highlightColor}
- Default animation: ${preset.animation}

Mid-screen rule:
- User mode is "${midMode}".
- If mode is "off", every segment placement MUST be "bottom".
- If mode is "auto", choose middle placement only for 1-2 truly powerful punchline/hook segments.
- If mode is "on", choose middle placement only for up to 3 powerful segments.
- Do not put normal informational lines in the middle.
- Middle captions must be short: 5 words or fewer.
- Avoid choosing long phrases as emphasis. Pick 1-3 exact keywords that appear in the caption.

Script:
${screenplay || selectedScript?.text || ""}

Evidence/topic:
${JSON.stringify({ topic: evidence.topic, match: evidence.match, selectedTitle: selectedScript?.title }, null, 2)}

SRT segments:
${JSON.stringify(
  segments.map((segment) => ({
    number: segment.number,
    startTime: segment.startTime,
    endTime: segment.endTime,
    text: segment.text,
  })),
  null,
  2,
)}

Return JSON only:
{
  "style": "${preset.style}",
  "baseColor": "${preset.baseColor}",
  "highlightColor": "${preset.highlightColor}",
  "emphasisWords": ["global words to highlight"],
  "segments": [
    {
      "number": 1,
      "emphasisWords": ["1 to 4 exact words from the segment"],
      "placement": "bottom | middle",
      "animation": "pop | punch | slide-lift | impact | glitch | calm | kinetic",
      "fontScale": 1.0,
      "reason": "why this caption treatment helps retention"
    }
  ]
}
`.trim();
  try {
    const result = await requestGeminiJson({ keyInfo, model: WORLD_CUP_CAPTION_DESIGN_MODEL, prompt, temperature: 0.25 });
    return normalizeCaptionDesign({ ...(result.json || {}), model: WORLD_CUP_CAPTION_DESIGN_MODEL }, fallback, options);
  } catch (error) {
    warnings.push(`Caption design fallback used: ${error.message}`);
    return fallback;
  }
}


export function assColor(hex, alpha = "00") {
  const clean = String(hex || "#ffffff").replace("#", "").padEnd(6, "f").slice(0, 6);
  return `&H${alpha}${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}`;
}

export function escapeAssText(text) {
  return cleanText(text)
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

export function splitCaptionWords(text, maxWords = 3, maxChars = 18) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords || maxWords <= 0) {
    const joined = words.join(" ");
    if (joined.length <= maxChars || maxWords <= 1 || words.length <= 1) {
      return [joined].filter(Boolean);
    }
    return splitCaptionWords(joined, Math.max(1, maxWords - 1), maxChars);
  }
  const chunks = [];
  let current = [];
  for (const word of words) {
    const next = [...current, word];
    if (current.length && (next.length > maxWords || next.join(" ").length > maxChars)) {
      chunks.push(current.join(" "));
      current = [word];
    } else {
      current = next;
    }
  }
  if (current.length) {
    chunks.push(current.join(" "));
  }
  return chunks;
}

export function captionSafeScale(text, placement, requestedScale = 1) {
  const chars = cleanText(text).length;
  const safeChars = placement === "middle" ? 15 : 18;
  const widthScale = chars > safeChars ? safeChars / chars : 1;
  const requested = Number(requestedScale || 1) || 1;
  return Math.max(0.76, Math.min(placement === "middle" ? 1.12 : 1.08, requested * widthScale));
}

export function assOverrideColor(hex) {
  const clean = String(hex || "#ffffff").replace("#", "").padEnd(6, "f").slice(0, 6);
  return `&H${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}&`;
}

export function escapeAssPart(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

export function captionSegmentPlan(captionPlan = {}, number = 0) {
  const segments = Array.isArray(captionPlan.segments) ? captionPlan.segments : [];
  return segments.find((segment) => Number(segment.number) === Number(number)) || {};
}

export function normalizeCaptionAnimation(value, fallback = "pop") {
  const cleaned = cleanText(value).toLowerCase();
  return ["pop", "punch", "slide-lift", "impact", "glitch", "calm", "kinetic"].includes(cleaned) ? cleaned : fallback;
}

export function normalizeCaptionPlacement(value, fallback = "bottom") {
  const cleaned = cleanText(value).toLowerCase();
  return ["bottom", "middle"].includes(cleaned) ? cleaned : fallback;
}

export function emphasisWordsForCaption(captionPlan = {}, segmentPlan = {}) {
  const globalWords = Array.isArray(captionPlan.emphasisWords) ? captionPlan.emphasisWords : [];
  const localWords = Array.isArray(segmentPlan.emphasisWords) ? segmentPlan.emphasisWords : [];
  return [...new Set([...localWords, ...globalWords].map(cleanText).filter(Boolean))].slice(0, 14);
}

export function emphasizeCaptionText(text, captionPlan = {}, segmentPlan = {}, scale = 1) {
  const words = emphasisWordsForCaption(captionPlan, segmentPlan);
  if (!words.length) {
    return escapeAssText(text);
  }
  const pattern = new RegExp(`\\b(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
  const reset = assOverrideColor(segmentPlan.baseColor || captionPlan.baseColor || "#ffffff");
  const pop = assOverrideColor(segmentPlan.highlightColor || captionPlan.highlightColor || "#ffe600");
  const accentBorder = Number(scale || segmentPlan.fontScale || 1) >= 1.08 ? 9 : 7;
  return escapeAssPart(cleanText(text)).replace(pattern, (match) => `{\\c${pop}\\fs${Math.round(78 * Number(scale || 1))}\\bord${accentBorder}}${match.toUpperCase()}{\\rCaption\\c${reset}\\bord7}`);
}

export function captionAnimationTag({ placement, animation, startY, endY, fontScale, isFirstChunk }) {
  const scale = Math.max(0.9, Math.min(1.35, Number(fontScale || 1)));
  const baseScale = Math.round(96 * scale);
  const peakScale = Math.round((animation === "impact" || animation === "punch" ? 118 : 110) * scale);
  const settleScale = Math.round(100 * scale);
  const alpha = placement === "middle" ? "\\bord8\\shad3" : "\\bord7\\shad2";
  if (animation === "glitch") {
    return `{\\an5\\pos(540,${endY})${alpha}\\fscx${baseScale}\\fscy${baseScale}\\t(0,70,\\frz-1\\fscx${peakScale})\\t(70,140,\\frz1\\fscy${peakScale})\\t(140,240,\\frz0\\fscx${settleScale}\\fscy${settleScale})\\fad(35,70)}`;
  }
  if (animation === "impact" || animation === "punch") {
    return `{\\an5\\pos(540,${endY})${alpha}\\fscx88\\fscy88\\t(0,90,\\fscx${peakScale}\\fscy${peakScale})\\t(90,230,\\fscx${settleScale}\\fscy${settleScale})\\fad(30,70)}`;
  }
  if (animation === "calm") {
    return `{\\an5\\move(540,${startY + 28},540,${endY},0,260)${alpha}\\fscx${baseScale}\\fscy${baseScale}\\fad(90,120)}`;
  }
  if (animation === "kinetic") {
    return `{\\an5\\move(510,${startY},540,${endY},0,170)${alpha}\\fscx94\\fscy94\\t(0,160,\\fscx${peakScale}\\fscy${peakScale})\\t(160,310,\\fscx${settleScale}\\fscy${settleScale})\\fad(35,70)}`;
  }
  const firstBeatBoost = isFirstChunk ? `\\t(0,140,\\fscx${Math.round(118 * scale)}\\fscy${Math.round(118 * scale)})` : "";
  return `{\\an5\\move(540,${startY},540,${endY},0,160)${alpha}\\fad(45,80)\\fscx95\\fscy95\\t(0,120,\\fscx${peakScale}\\fscy${peakScale})${firstBeatBoost}\\t(120,260,\\fscx${settleScale}\\fscy${settleScale})}`;
}

export function buildAssFromSrt(srtText, captionPlan = {}) {
  const segments = parseSrtSegments(srtText);
  const preset = captionPresetDesignConfig(captionPlan.style || WORLD_CUP_CAPTION_PRESET);
  const viralCaption =
    (Array.isArray(captionPlan.emphasisWords) && captionPlan.emphasisWords.length) ||
    (Array.isArray(captionPlan.segments) && captionPlan.segments.some((segment) => Array.isArray(segment.emphasisWords) && segment.emphasisWords.length));
  const fontSize = viralCaption ? 70 : 66;
  const marginV = viralCaption ? 315 : 330;
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${VIDEO_WIDTH}`,
    `PlayResY: ${VIDEO_HEIGHT}`,
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 2",
    "YCbCr Matrix: TV.709",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Caption,Arial,${fontSize},${assColor(preset.baseColor)},${assColor("#ffffff")},${assColor("#050505")},${assColor("#000000", "88")},-1,0,0,0,100,100,0,0,1,7,2,2,110,110,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const lines = [];
  for (const segment of segments) {
    const segmentPlan = captionSegmentPlan(captionPlan, segment.number);
    const placement = normalizeCaptionPlacement(segmentPlan.placement, "bottom");
    const animation = normalizeCaptionAnimation(segmentPlan.animation, captionPlan.animation || "pop");
    const requestedScale = Math.max(0.82, Math.min(placement === "middle" ? 1.12 : 1.08, Number(segmentPlan.fontScale || (placement === "middle" ? 1.08 : 0.98)) || 1));
    const chunks = splitCaptionWords(segment.text, placement === "middle" ? 3 : 3, placement === "middle" ? 15 : 18);
    const duration = segment.endTime - segment.startTime;
    const chunkDuration = chunks.length > 1 ? duration / chunks.length : duration;
    for (let index = 0; index < chunks.length; index += 1) {
      const start = segment.startTime + chunkDuration * index;
      const end = index === chunks.length - 1 ? segment.endTime : segment.startTime + chunkDuration * (index + 1);
      const chunkScale = captionSafeScale(chunks[index], placement, requestedScale);
      const yStart = placement === "middle" ? 990 : 1490;
      const yEnd = placement === "middle" ? 920 : 1418;
      const tag = captionAnimationTag({
        placement,
        animation,
        startY: yStart,
        endY: yEnd,
        fontScale: chunkScale,
        isFirstChunk: viralCaption && segment.number === 1 && index === 0,
      });
      lines.push(`Dialogue: 0,${assTimestamp(start)},${assTimestamp(end)},Caption,,0,0,0,,${tag}${emphasizeCaptionText(chunks[index], captionPlan, segmentPlan, chunkScale)}`);
    }
  }
  return `${header.concat(lines).join("\n")}\n`;
}
