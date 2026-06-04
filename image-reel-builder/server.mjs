import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const renderTempRoot = path.join(__dirname, ".tmp-renders");
const geminiKeyStorePath = path.join(__dirname, "..", ".gemini-keys.json");
const port = Number(process.env.PORT || 4010);
const execFileAsync = promisify(execFile);
const portableFfmpegPath = "C:\\tmp\\ffmpeg-portable\\bin\\ffmpeg.exe";
const SMART_CAPTION_MODEL_CANDIDATES = [
  process.env.SMART_CAPTION_MODEL,
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
  "gemini-3.1-flash-lite",
].filter(Boolean);
const CAPTION_ANIMATIONS = new Set(["pop", "punch", "fade", "slide-up", "horror", "whisper", "impact", "calm", "kinetic", "glitch"]);
const CAPTION_STYLE_IDS = new Set([
  "creator-yellow",
  "bold-pop",
  "cinematic-box",
  "horror-glow",
  "clean-lower",
  "psych-teal",
  "relationship-soft",
  "motivation-impact",
]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function appError(message, { status = 500, code = "APP_ERROR", details = null } = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function sendMp4(res, result) {
  res.writeHead(200, {
    "Content-Type": result.mimeType,
    "Content-Disposition": `attachment; filename="${result.filename}"`,
    "Content-Length": result.video.length,
    "Cache-Control": "no-store",
    "X-Video-Width": String(result.width),
    "X-Video-Height": String(result.height),
    "X-Video-Fps": String(result.fps),
    "X-Video-Duration-Seconds": secondsForFfmpeg(result.durationSeconds),
    "X-Video-Compatibility-Mode": result.compatibilityMode,
    "X-Audio-Track": result.audioTrack,
    "X-Subtitles": result.subtitles,
  });
  res.end(result.video);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 350_000_000) {
        reject(new Error("Request is too large. Use fewer or smaller images."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

async function resolveFfmpegPath() {
  const candidates = [process.env.FFMPEG_PATH, portableFfmpegPath, "ffmpeg"].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["-version"], { timeout: 5000 });
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error("FFmpeg was not found. Install it or set FFMPEG_PATH.");
}

function extensionForImage(image) {
  const nameExt = path.extname(image.name || "").toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(nameExt)) {
    return nameExt;
  }
  if (image.mimeType === "image/png") return ".png";
  if (image.mimeType === "image/webp") return ".webp";
  return ".jpg";
}

function extensionForAudio(audio) {
  const nameExt = path.extname(audio?.name || "").toLowerCase();
  if ([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"].includes(nameExt)) {
    return nameExt;
  }
  const mimeType = String(audio?.mimeType || "").toLowerCase();
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("aac")) return ".aac";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("flac")) return ".flac";
  return ".mp3";
}

function secondsForFfmpeg(seconds) {
  return Math.max(0.001, Number(seconds || 0)).toFixed(6);
}

function secondsForAss(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const totalCentiseconds = Math.round(safeSeconds * 100);
  const hours = Math.floor(totalCentiseconds / 360000);
  const minutes = Math.floor((totalCentiseconds % 360000) / 6000);
  const secs = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function parseSrtTimestamp(value) {
  const match = String(value || "").trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!match) {
    return 0;
  }
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(millis.padEnd(3, "0")) / 1000;
}

function parseSrt(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const timeIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeIndex === -1) {
        return null;
      }
      const [startRaw, endRaw] = lines[timeIndex].split("-->").map((part) => part.trim());
      const start = parseSrtTimestamp(startRaw);
      const end = parseSrtTimestamp(endRaw);
      const subtitleText = lines.slice(timeIndex + 1).join(" ").replace(/\s+/g, " ").trim();
      if (!subtitleText || end <= start) {
        return null;
      }
      return { start, end, text: subtitleText };
    })
    .filter(Boolean);
}

function cleanCaptionText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstJsonObject(text) {
  const value = String(text || "");
  const start = value.indexOf("{");
  if (start === -1) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }
  return "";
}

function extractJson(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw appError("Gemma returned an empty caption response.", { status: 502, code: "EMPTY_CAPTION_RESPONSE" });
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonText = extractFirstJsonObject(trimmed);
    if (!jsonText) {
      throw appError("Gemma did not return valid caption JSON.", {
        status: 502,
        code: "INVALID_CAPTION_JSON",
        details: trimmed.slice(0, 600),
      });
    }
    return JSON.parse(jsonText);
  }
}

function assColor(hex, alpha = "00") {
  const clean = String(hex || "#ffffff").replace("#", "").padEnd(6, "f").slice(0, 6);
  const rr = clean.slice(0, 2);
  const gg = clean.slice(2, 4);
  const bb = clean.slice(4, 6);
  return `&H${alpha}${bb}${gg}${rr}`;
}

function assInlineColor(hex) {
  const clean = String(hex || "#ffffff").replace("#", "").padEnd(6, "f").slice(0, 6);
  const rr = clean.slice(0, 2);
  const gg = clean.slice(2, 4);
  const bb = clean.slice(4, 6);
  return `&H${bb}${gg}${rr}&`;
}

function captionPreset(styleId) {
  const presets = {
    "creator-yellow": {
      label: "Creator Yellow",
      font: "Nirmala UI",
      primary: "#ffe600",
      smartPrimary: "#ffffff",
      highlight: "#ffe600",
      outline: "#050505",
      back: "#000000",
      sizeRatio: 0.058,
      outlineRatio: 0.0058,
      shadowRatio: 0.002,
      alignment: 2,
      marginRatio: 0.155,
      borderStyle: 1,
      chunkWords: 3,
      animation: "pop",
    },
    "bold-pop": {
      label: "Bold Pop",
      font: "Nirmala UI",
      primary: "#ffffff",
      smartPrimary: "#ffffff",
      highlight: "#ffe600",
      outline: "#000000",
      back: "#000000",
      sizeRatio: 0.06,
      outlineRatio: 0.006,
      shadowRatio: 0.003,
      alignment: 2,
      marginRatio: 0.16,
      borderStyle: 1,
      chunkWords: 4,
      animation: "pop",
    },
    "cinematic-box": {
      label: "Cinematic Box",
      font: "Nirmala UI",
      primary: "#ffffff",
      smartPrimary: "#ffffff",
      highlight: "#f4b18f",
      outline: "#111111",
      back: "#000000",
      backAlpha: "72",
      sizeRatio: 0.047,
      outlineRatio: 0.0015,
      shadowRatio: 0,
      alignment: 2,
      marginRatio: 0.12,
      borderStyle: 3,
      chunkWords: 0,
      animation: "fade",
    },
    "horror-glow": {
      label: "Horror Glow",
      font: "Nirmala UI",
      primary: "#fff4e8",
      smartPrimary: "#fff4e8",
      highlight: "#ff4a35",
      outline: "#4b0000",
      back: "#000000",
      sizeRatio: 0.054,
      outlineRatio: 0.0065,
      shadowRatio: 0.004,
      alignment: 2,
      marginRatio: 0.16,
      borderStyle: 1,
      chunkWords: 4,
      animation: "horror",
    },
    "clean-lower": {
      label: "Clean Lower",
      font: "Nirmala UI",
      primary: "#ffffff",
      smartPrimary: "#ffffff",
      highlight: "#9ee7d8",
      outline: "#111111",
      back: "#000000",
      sizeRatio: 0.046,
      outlineRatio: 0.004,
      shadowRatio: 0.0015,
      alignment: 2,
      marginRatio: 0.105,
      borderStyle: 1,
      chunkWords: 0,
      animation: "fade",
    },
    "psych-teal": {
      label: "Psych Teal",
      font: "Nirmala UI",
      primary: "#eafffb",
      smartPrimary: "#eafffb",
      highlight: "#00e0c7",
      outline: "#041a18",
      back: "#000000",
      sizeRatio: 0.052,
      outlineRatio: 0.0055,
      shadowRatio: 0.0025,
      alignment: 2,
      marginRatio: 0.145,
      borderStyle: 1,
      chunkWords: 4,
      animation: "calm",
    },
    "relationship-soft": {
      label: "Relationship Soft",
      font: "Nirmala UI",
      primary: "#fff7f2",
      smartPrimary: "#fff7f2",
      highlight: "#ff9ac0",
      outline: "#38131f",
      back: "#000000",
      sizeRatio: 0.05,
      outlineRatio: 0.0048,
      shadowRatio: 0.002,
      alignment: 2,
      marginRatio: 0.135,
      borderStyle: 1,
      chunkWords: 4,
      animation: "fade",
    },
    "motivation-impact": {
      label: "Motivation Impact",
      font: "Nirmala UI",
      primary: "#ffffff",
      smartPrimary: "#ffffff",
      highlight: "#ffdd2e",
      outline: "#080808",
      back: "#000000",
      sizeRatio: 0.064,
      outlineRatio: 0.007,
      shadowRatio: 0.0025,
      alignment: 5,
      marginRatio: 0.42,
      borderStyle: 1,
      chunkWords: 3,
      animation: "impact",
    },
  };
  return presets[styleId] || presets["creator-yellow"];
}

function escapeAssText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\r?\n/g, "\\N")
    .trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function softBreakCaption(text) {
  const words = cleanCaptionText(text).split(/\s+/).filter(Boolean);
  if (words.length <= 4) {
    return words.join(" ");
  }
  const midpoint = Math.ceil(words.length / 2);
  return `${words.slice(0, midpoint).join(" ")}\n${words.slice(midpoint).join(" ")}`;
}

function highlightAssText(text, highlights, color) {
  let marked = cleanCaptionText(text);
  const phrases = (Array.isArray(highlights) ? highlights : [])
    .map(cleanCaptionText)
    .filter((phrase) => phrase.length > 1)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);

  for (const phrase of phrases) {
    marked = marked.replace(new RegExp(escapeRegExp(phrase), "gi"), (match) => `\uE000${match}\uE001`);
  }

  return escapeAssText(softBreakCaption(marked))
    .replaceAll("\uE000", `{\\c${assInlineColor(color)}}`)
    .replaceAll("\uE001", "{\\rCaption}");
}

function splitCaptionIntoChunks(text, wordsPerChunk) {
  if (!wordsPerChunk) {
    return [String(text || "").trim()].filter(Boolean);
  }
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= wordsPerChunk) {
    return [words.join(" ")];
  }
  const chunks = [];
  for (let index = 0; index < words.length; index += wordsPerChunk) {
    chunks.push(words.slice(index, index + wordsPerChunk).join(" "));
  }
  return chunks;
}

function resolveCaptionAnimation(animationMode, fallback) {
  const animation = String(animationMode || "").trim();
  if (animation && animation !== "auto" && CAPTION_ANIMATIONS.has(animation)) {
    return animation;
  }
  return CAPTION_ANIMATIONS.has(fallback) ? fallback : "pop";
}

function parseCenterCaptionSpec(spec) {
  return String(spec || "")
    .split(/[,\n]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (/^\d+$/.test(token)) {
        return { type: "index", index: Number(token) };
      }
      const range = token.split(/\s*-\s*/);
      if (range.length === 2) {
        const start = range[0].includes(":") ? parseSrtTimestamp(range[0]) : Number(range[0]);
        const end = range[1].includes(":") ? parseSrtTimestamp(range[1]) : Number(range[1]);
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
          return { type: "range", start, end };
        }
      }
      return null;
    })
    .filter(Boolean);
}

function segmentMatchesCenterRule(segment, index, rules) {
  return rules.some((rule) => {
    if (rule.type === "index") {
      return rule.index === index + 1 || rule.index === Number(segment.number || 0);
    }
    const overlap = Math.max(0, Math.min(segment.end, rule.end) - Math.max(segment.start, rule.start));
    return overlap > 0.05;
  });
}

function captionPositionForSegment(segment, index, options = {}) {
  const placement = String(options.placementMode || "auto");
  if (placement === "bottom") return "bottom";
  if (placement === "center") return "center";
  if (placement === "top") return "top";
  if (placement === "selected-center") {
    return segmentMatchesCenterRule(segment, index, options.centerRules || []) ? "center" : "bottom";
  }
  return ["bottom", "center", "top"].includes(segment.position) ? segment.position : "bottom";
}

function animationTag(animation) {
  if (animation === "pop") {
    return "{\\fad(70,110)\\fscx92\\fscy92\\t(0,150,\\fscx108\\fscy108)\\t(150,260,\\fscx100\\fscy100)}";
  }
  if (animation === "punch" || animation === "impact") {
    return "{\\fad(35,90)\\fscx78\\fscy78\\t(0,110,\\fscx120\\fscy120)\\t(110,230,\\fscx100\\fscy100)}";
  }
  if (animation === "slide-up") {
    return "{\\fad(70,110)\\fscx96\\fscy96\\t(0,170,\\fscx104\\fscy104)\\t(170,300,\\fscx100\\fscy100)}";
  }
  if (animation === "kinetic") {
    return "{\\fad(25,80)\\fscx62\\fscy62\\t(0,90,\\fscx126\\fscy126)\\t(90,170,\\fscx94\\fscy94)\\t(170,250,\\fscx100\\fscy100)}";
  }
  if (animation === "glitch") {
    return "{\\fad(35,120)\\blur0.65\\fscx105\\fscy98\\frz-1\\t(0,80,\\frz2\\fax0.06)\\t(80,150,\\frz-2\\fax-0.05)\\t(150,260,\\frz0\\fax0\\blur0)}";
  }
  if (animation === "horror") {
    return "{\\fad(90,160)\\blur1.1\\fscx96\\fscy96\\t(0,180,\\fscx104\\fscy104)\\t(180,320,\\fscx100\\fscy100)}";
  }
  return "{\\fad(90,130)}";
}

function smartPosition({ width, height, preset, position }) {
  const x = Math.round(width / 2);
  if (position === "top") {
    return { x, y: Math.round(height * 0.19) };
  }
  if (position === "center" || preset.alignment === 5) {
    return { x, y: Math.round(height * 0.52) };
  }
  return { x, y: Math.round(height * (1 - preset.marginRatio)) };
}

function smartAnimationTag(animation, { width, height, preset, position }) {
  const point = smartPosition({ width, height, preset, position });
  const fromY = point.y + Math.round(height * 0.025);
  if (animation === "slide-up") {
    return `{\\an5\\move(${point.x},${fromY},${point.x},${point.y},0,220)\\fad(60,90)\\fscx96\\fscy96\\t(0,160,\\fscx106\\fscy106)\\t(160,280,\\fscx100\\fscy100)}`;
  }
  if (animation === "punch" || animation === "impact") {
    return `{\\an5\\pos(${point.x},${point.y})\\fad(35,90)\\fscx82\\fscy82\\t(0,120,\\fscx116\\fscy116)\\t(120,230,\\fscx100\\fscy100)}`;
  }
  if (animation === "kinetic") {
    return `{\\an5\\pos(${point.x},${point.y})\\fad(25,70)\\fscx60\\fscy60\\t(0,80,\\fscx128\\fscy128)\\t(80,155,\\fscx92\\fscy92)\\t(155,235,\\fscx100\\fscy100)}`;
  }
  if (animation === "glitch") {
    return `{\\an5\\pos(${point.x},${point.y})\\fad(35,120)\\blur0.75\\frz-1\\fscx104\\fscy96\\t(0,70,\\frz2\\fax0.08)\\t(70,140,\\frz-2\\fax-0.06)\\t(140,230,\\frz1\\fax0.03)\\t(230,320,\\frz0\\fax0\\blur0\\fscx100\\fscy100)}`;
  }
  if (animation === "horror") {
    return `{\\an5\\pos(${point.x},${point.y})\\fad(90,180)\\blur1.2\\fscx96\\fscy96\\t(0,150,\\fscx104\\fscy104\\frz-1)\\t(150,280,\\fscx100\\fscy100\\frz1)\\t(280,390,\\frz0)}`;
  }
  if (animation === "whisper" || animation === "calm") {
    return `{\\an5\\pos(${point.x},${point.y})\\fad(140,180)\\blur0.35}`;
  }
  if (animation === "pop") {
    return `{\\an5\\pos(${point.x},${point.y})\\fad(60,100)\\fscx90\\fscy90\\t(0,150,\\fscx108\\fscy108)\\t(150,260,\\fscx100\\fscy100)}`;
  }
  return `{\\an5\\pos(${point.x},${point.y})\\fad(90,130)}`;
}

function buildAssHeader({ width, height, preset, primaryOverride = null }) {
  const fontSize = Math.round(height * preset.sizeRatio);
  const outline = Math.max(1, Math.round(height * preset.outlineRatio));
  const shadow = Math.max(0, Math.round(height * preset.shadowRatio));
  const marginV = Math.round(height * preset.marginRatio);
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 2",
    "YCbCr Matrix: TV.709",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Caption,${preset.font},${fontSize},${assColor(primaryOverride || preset.primary)},${assColor("#ffffff")},${assColor(preset.outline)},${assColor(preset.back, preset.backAlpha || "90")},-1,0,0,0,100,100,0,0,${preset.borderStyle},${outline},${shadow},${preset.alignment},80,80,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
}

function buildAssFromSrt({ srtText, width, height, styleId, animationMode = "auto", placementMode = "auto", centerSpec = "" }) {
  const preset = captionPreset(styleId);
  const events = parseSrt(srtText);
  if (!events.length) {
    throw new Error("Subtitle file did not contain valid SRT timing blocks.");
  }

  const header = buildAssHeader({ width, height, preset });
  const centerRules = parseCenterCaptionSpec(centerSpec);

  const lines = [];
  for (const [eventIndex, event] of events.entries()) {
    const chunks = splitCaptionIntoChunks(event.text, preset.chunkWords);
    const duration = event.end - event.start;
    const chunkDuration = chunks.length > 1 ? duration / chunks.length : duration;
    for (let index = 0; index < chunks.length; index += 1) {
      const start = event.start + chunkDuration * index;
      const end = index === chunks.length - 1 ? event.end : event.start + chunkDuration * (index + 1);
      const segment = { start, end, number: eventIndex + 1, position: preset.alignment === 5 ? "center" : "bottom" };
      const position = captionPositionForSegment(segment, eventIndex, { placementMode, centerRules });
      const animation = resolveCaptionAnimation(animationMode, preset.animation);
      const text = `${smartAnimationTag(animation, { width, height, preset, position })}${escapeAssText(chunks[index])}`;
      lines.push(`Dialogue: 0,${secondsForAss(start)},${secondsForAss(end)},Caption,,0,0,0,,${text}`);
    }
  }

  return `${header.concat(lines).join("\n")}\n`;
}

function buildAssFromSmartCaptions({ plan, fallbackSrtText, width, height, styleId, animationMode = "auto", placementMode = "auto", centerSpec = "" }) {
  const preset = captionPreset(plan?.stylePreset || styleId);
  const segments = normalizeSmartCaptionPlan(plan, {
    srtText: fallbackSrtText,
    styleId,
    model: plan?.model || "local",
    fallbackOnly: true,
  }).segments;
  if (!segments.length) {
    throw new Error("Smart caption plan did not include valid segments.");
  }

  const header = buildAssHeader({ width, height, preset, primaryOverride: preset.smartPrimary || preset.primary });
  const centerRules = parseCenterCaptionSpec(centerSpec);
  const lines = segments.map((segment, index) => {
    const animation = resolveCaptionAnimation(animationMode, segment.animation || preset.animation);
    const position = captionPositionForSegment(segment, index, { placementMode, centerRules });
    const text = `${smartAnimationTag(animation, {
      width,
      height,
      preset,
      position,
    })}${highlightAssText(segment.text, segment.highlight, segment.highlightColor || preset.highlight || preset.primary)}`;
    return `Dialogue: 0,${secondsForAss(segment.start)},${secondsForAss(segment.end)},Caption,,0,0,0,,${text}`;
  });

  return `${header.concat(lines).join("\n")}\n`;
}

function envGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

async function loadGeminiKeyStore() {
  try {
    const raw = await fs.readFile(geminiKeyStorePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      activeKeyId: parsed.activeKeyId || null,
      slots: Array.isArray(parsed.slots) ? parsed.slots.filter((slot) => slot?.apiKey) : [],
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { activeKeyId: null, slots: [] };
    }
    throw appError("Unable to read saved Gemini key settings.", {
      status: 500,
      code: "KEY_STORE_READ_FAILED",
      details: error.message,
    });
  }
}

function resolveActiveGeminiKey(store) {
  if (store.activeKeyId) {
    const activeSlot = store.slots.find((slot) => slot.id === store.activeKeyId && slot.apiKey);
    if (activeSlot) {
      return { id: activeSlot.id, label: activeSlot.label || "Saved Gemini key", apiKey: activeSlot.apiKey };
    }
  }

  const envKey = envGeminiKey();
  if (envKey) {
    return { id: "env", label: "Default .env key", apiKey: envKey };
  }

  const firstSlot = store.slots.find((slot) => slot.apiKey);
  return firstSlot ? { id: firstSlot.id, label: firstSlot.label || "Saved Gemini key", apiKey: firstSlot.apiKey } : null;
}

async function getActiveGeminiKey() {
  return resolveActiveGeminiKey(await loadGeminiKeyStore());
}

async function requestGemmaCaptionJson({ keyInfo, model, prompt }) {
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": keyInfo.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.45,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (error) {
    throw appError(`Gemma caption request failed: ${error.message}`, {
      status: 502,
      code: "CAPTION_NETWORK_FAILED",
      details: { model, keyId: keyInfo.id },
    });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw appError(data?.error?.message || `Gemma caption request failed with HTTP ${response.status}.`, {
      status: response.status,
      code: response.status === 429 ? "CAPTION_QUOTA_OR_RATE_LIMIT" : "CAPTION_MODEL_FAILED",
      details: { model, keyId: keyInfo.id, geminiStatus: data?.error?.status || null },
    });
  }

  const textResponse = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n");
  return extractJson(textResponse);
}

function buildSmartCaptionPrompt({ srtText, styleId, mood, format, audioDuration }) {
  const preset = captionPreset(styleId);
  return `
You are a short-form reel caption designer for Hindi/Indian content.
Rewrite SRT captions into a premium smart-caption plan for burned ASS subtitles.

Context:
- Output format: ${format || "9:16"}
- Current visual caption style: ${preset.label}
- Requested mood/content type: ${mood || "auto"}
- Audio duration, if known: ${Number(audioDuration || 0) ? Number(audioDuration).toFixed(2) : "unknown"} seconds

Rules:
- Output JSON only.
- Preserve Hindi/Devanagari text. Do not romanize.
- Preserve meaning exactly; improve only caption rhythm and emphasis.
- Keep original timing coverage. You may split a long SRT block into 2 shorter captions inside the same start/end range.
- Keep each on-screen caption punchy: usually 2-7 words.
- Pick 1-3 highlight phrases per caption. Highlights should be emotionally important words, not every word.
- Choose animation per caption from: pop, punch, fade, slide-up, horror, whisper, impact, calm, kinetic, glitch.
- Use kinetic or punch for sharp hook/retention lines. Use slide-up for clean creator captions. Use glitch only for shock, suspense, horror, or dark psychology moments.
- Use horror/whisper only when the SRT actually feels scary or suspenseful.
- Use impact/punch for motivation, reveal, warning, or hard truth moments.
- Use fade/calm for emotional, relationship, documentary, or reflective lines.
- Choose position from bottom, center, top. Usually bottom; center only for hooks, shocks, or very punchy one-liners.
- No emojis, no markdown, no speaker labels, no subtitles inside image prompts, no commentary.

Return this exact JSON shape:
{
  "contentType": "auto|psychology|motivation|horror|relationship|documentary|story|mixed",
  "captionStyle": "short explanation of the caption rhythm",
  "stylePreset": "${styleId}",
  "segments": [
    {
      "start": 0,
      "end": 2.4,
      "text": "Hindi caption text",
      "highlight": ["important phrase"],
      "emotion": "curious|fear|sad|shock|calm|confident|warning",
      "animation": "pop",
      "position": "bottom"
    }
  ]
}

Input SRT:
${srtText}
`.trim();
}

function captionOverlapSeconds(a, b) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

function captionCoversEvent(segment, event) {
  const eventDuration = Math.max(0.1, event.end - event.start);
  const segmentDuration = Math.max(0.1, segment.end - segment.start);
  if (segmentDuration > Math.max(10, eventDuration * 4)) {
    return false;
  }
  const midpoint = event.start + eventDuration / 2;
  return (
    captionOverlapSeconds(segment, event) >= Math.min(0.3, eventDuration * 0.35) ||
    (segment.start <= midpoint && segment.end >= midpoint)
  );
}

function fillSmartCaptionCoverage(segments, events, styleId) {
  const preset = captionPreset(styleId);
  const filled = [...segments];
  let fallbackCaptionCount = 0;

  for (const event of events) {
    if (!filled.some((segment) => captionCoversEvent(segment, event))) {
      filled.push({
        start: event.start,
        end: event.end,
        text: event.text,
        highlight: [],
        emotion: "",
        animation: preset.animation,
        position: "bottom",
        highlightColor: "",
        source: "srt-fallback",
      });
      fallbackCaptionCount += 1;
    }
  }

  const sorted = filled
    .filter((segment) => segment.text && segment.end > segment.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .slice(0, 320);
  const srtEnd = events.reduce((max, event) => Math.max(max, event.end), 0);
  const coverageEnd = sorted.reduce((max, segment) => Math.max(max, segment.end), 0);
  const coveragePercent = srtEnd ? Math.min(100, Math.round((coverageEnd / srtEnd) * 100)) : 100;

  return {
    segments: sorted,
    fallbackCaptionCount,
    srtEnd,
    coverageEnd,
    coveragePercent,
    coverageWarning:
      fallbackCaptionCount > 0
        ? `${fallbackCaptionCount} SRT captions were automatically kept because the smart plan did not cover them.`
        : "",
  };
}

function normalizeSmartCaptionPlan(plan, { srtText, styleId, model, fallbackOnly = false }) {
  const events = parseSrt(srtText);
  const totalEnd = events.reduce((max, event) => Math.max(max, event.end), 0);
  const rawSegments = Array.isArray(plan?.segments) ? plan.segments : [];
  const sourceSegments = rawSegments.length ? rawSegments : events;
  const normalizedSegments = sourceSegments
    .map((segment, index) => {
      const fallback = events[Math.min(index, Math.max(0, events.length - 1))] || { start: 0, end: 1, text: "" };
      const start = Math.max(0, Number(segment.start ?? fallback.start) || 0);
      const rawEnd = Number(segment.end ?? fallback.end);
      const end = Math.min(Math.max(start + 0.35, rawEnd > start ? rawEnd : fallback.end), totalEnd || start + 8);
      const text = cleanCaptionText(segment.text || fallback.text);
      if (!text || end <= start) {
        return null;
      }
      const animation = CAPTION_ANIMATIONS.has(String(segment.animation || "")) ? String(segment.animation) : captionPreset(styleId).animation;
      const position = ["bottom", "center", "top"].includes(segment.position) ? segment.position : "bottom";
      return {
        start,
        end,
        text,
        highlight: Array.isArray(segment.highlight) ? segment.highlight.map(cleanCaptionText).filter(Boolean).slice(0, 3) : [],
        emotion: cleanCaptionText(segment.emotion || ""),
        animation,
        position,
        highlightColor: cleanCaptionText(segment.highlightColor || ""),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start)
    .slice(0, 240);

  if (!normalizedSegments.length && !fallbackOnly) {
    throw appError("Smart captions could not find valid SRT timing blocks.", {
      status: 400,
      code: "NO_VALID_SRT_FOR_CAPTIONS",
    });
  }

  const requestedStyle = cleanCaptionText(plan?.stylePreset || styleId);
  const coverage = fillSmartCaptionCoverage(normalizedSegments, events, styleId);
  return {
    model,
    contentType: cleanCaptionText(plan?.contentType || "auto"),
    captionStyle: cleanCaptionText(plan?.captionStyle || "Short punchy reel captions with selective keyword highlights."),
    stylePreset: CAPTION_STYLE_IDS.has(requestedStyle) ? requestedStyle : styleId,
    segments: coverage.segments,
    fallbackCaptionCount: coverage.fallbackCaptionCount,
    srtEnd: coverage.srtEnd,
    coverageEnd: coverage.coverageEnd,
    coveragePercent: coverage.coveragePercent,
    coverageWarning: coverage.coverageWarning,
  };
}

async function generateSmartCaptions(body) {
  const srtText = String(body.srtText || "").trim();
  const events = parseSrt(srtText);
  if (!events.length) {
    throw appError("Load a valid SRT file before using Smart captions.", {
      status: 400,
      code: "SMART_CAPTIONS_NEED_SRT",
    });
  }

  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo?.apiKey) {
    throw appError("No Gemini API key is available for Smart captions.", {
      status: 400,
      code: "MISSING_GEMINI_KEY",
    });
  }

  const styleId = String(body.styleId || "creator-yellow");
  const prompt = buildSmartCaptionPrompt({
    srtText,
    styleId,
    mood: body.mood,
    format: body.format,
    audioDuration: body.audioDuration,
  });
  const failures = [];
  for (const model of SMART_CAPTION_MODEL_CANDIDATES) {
    try {
      const rawPlan = await requestGemmaCaptionJson({ keyInfo, model, prompt });
      const plan = normalizeSmartCaptionPlan(rawPlan, { srtText, styleId, model });
      return {
        ...plan,
        keyId: keyInfo.id,
        keyLabel: keyInfo.label,
        originalCaptionCount: events.length,
        smartCaptionCount: plan.segments.length,
      };
    } catch (error) {
      failures.push({ model, code: error.code || "CAPTION_MODEL_FAILED", message: error.message });
      if (error.code === "CAPTION_NETWORK_FAILED") {
        throw error;
      }
    }
  }

  throw appError("Smart captions failed on all lightweight Gemma caption models.", {
    status: 502,
    code: "SMART_CAPTION_MODELS_FAILED",
    details: failures,
  });
}

function buildVideoTransform({ width, height, fit }) {
  if (fit === "contain") {
    return `scale=${width}:${height}:force_original_aspect_ratio=decrease:out_range=tv,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
  }
  return `scale=${width}:${height}:force_original_aspect_ratio=increase:out_range=tv,crop=${width}:${height},setsar=1`;
}

function filePathForConcat(filePath) {
  return filePath.replace(/\\/g, "/").replace(/'/g, "\\'");
}

function h264LevelForFps(fps) {
  return Number(fps) > 30 ? "4.2" : "4.1";
}

async function renderVideo(body) {
  const ffmpegPath = await resolveFfmpegPath();
  const images = Array.isArray(body.images) ? body.images : [];
  const clips = Array.isArray(body.clips) ? body.clips : [];
  const audio = body.audio && body.audio.data ? body.audio : null;
  const subtitles = body.subtitles && body.subtitles.text && body.subtitles.enabled !== false ? body.subtitles : null;

  if (!images.length) {
    throw new Error("Add at least one image before exporting.");
  }
  if (clips.length !== images.length) {
    throw new Error("Each image must have exactly one timeline clip.");
  }

  const width = Number(body.width || 1080);
  const height = Number(body.height || 1920);
  const fps = Number(body.fps || 30);
  const fit = body.fit === "contain" ? "contain" : "cover";
  const compatibilityMode = body.compatibilityMode === "capcut-safe" ? "capcut-safe" : "standard";
  const syncToAudio = Boolean(audio && body.syncToAudio !== false);
  const audioDuration = Math.max(0, Number(audio?.durationSeconds || 0));
  const captionStyle = String(body.captionStyle || "creator-yellow");
  const captionAnimation = String(body.captionAnimation || subtitles?.animationMode || "auto");
  const captionPlacement = String(body.captionPlacement || subtitles?.placementMode || "auto");
  const captionCenterSpec = String(body.captionCenterSpec || subtitles?.centerSpec || "");
  const gopSize = compatibilityMode === "capcut-safe" ? Math.max(1, Math.round(fps)) : Math.max(1, Math.round(fps * 2));
  const x264Params = `keyint=${gopSize}:min-keyint=${gopSize}:scenecut=0:open-gop=0`;
  await fs.mkdir(renderTempRoot, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(renderTempRoot, "image-reel-"));
  const outputPath = path.join(tempDir, "reel.mp4");
  const concatPath = path.join(tempDir, "images.ffconcat");

  try {
    const imagePaths = [];
    const clipDurations = [];
    let audioPath = "";
    let assPath = "";
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const data = String(image.data || "").replace(/^data:[^,]+,/, "");
      if (!data) {
        throw new Error(`Image ${index + 1} is missing image data.`);
      }
      const imageFileName = `image-${String(index + 1).padStart(3, "0")}${extensionForImage(image)}`;
      const imagePath = path.join(tempDir, imageFileName);
      await fs.writeFile(imagePath, Buffer.from(data, "base64"));
      imagePaths.push(imageFileName);
    }

    for (let index = 0; index < clips.length; index += 1) {
      const clip = clips[index];
      const start = Number(clip.startTime || 0);
      const end = Number(clip.endTime || 0);
      clipDurations.push(Math.max(0.1, end - start));
    }

    let totalDuration = clipDurations.reduce((sum, duration) => sum + duration, 0);
    if (syncToAudio && audioDuration > 0 && Math.abs(audioDuration - totalDuration) > 0.05) {
      if (audioDuration > totalDuration) {
        clipDurations[clipDurations.length - 1] += audioDuration - totalDuration;
      } else {
        let overflow = totalDuration - audioDuration;
        for (let index = clipDurations.length - 1; index >= 0 && overflow > 0; index -= 1) {
          const removable = Math.max(0, clipDurations[index] - 0.1);
          const reduction = Math.min(removable, overflow);
          clipDurations[index] -= reduction;
          overflow -= reduction;
        }
      }
      totalDuration = clipDurations.reduce((sum, duration) => sum + duration, 0);
    }

    if (audio) {
      const audioData = String(audio.data || "").replace(/^data:[^,]+,/, "");
      if (!audioData) {
        throw new Error("Audio file is missing audio data.");
      }
      const audioFileName = `voice${extensionForAudio(audio)}`;
      audioPath = audioFileName;
      await fs.writeFile(path.join(tempDir, audioFileName), Buffer.from(audioData, "base64"));
    }

    if (subtitles) {
      assPath = "captions.ass";
      const assText = subtitles.smartEnabled && subtitles.smart
        ? buildAssFromSmartCaptions({
            plan: subtitles.smart,
            fallbackSrtText: subtitles.text,
            width,
            height,
            styleId: captionStyle,
            animationMode: captionAnimation,
            placementMode: captionPlacement,
            centerSpec: captionCenterSpec,
          })
        : buildAssFromSrt({
            srtText: subtitles.text,
            width,
            height,
            styleId: captionStyle,
            animationMode: captionAnimation,
            placementMode: captionPlacement,
            centerSpec: captionCenterSpec,
          });
      await fs.writeFile(path.join(tempDir, assPath), assText, "utf8");
    }

    const transform = buildVideoTransform({ width, height, fit });
    const filterChain = [`${transform}`, `fps=${fps}`, assPath ? `ass=${assPath}` : "", "format=yuv420p"].filter(Boolean).join(",");
    const concatLines = ["ffconcat version 1.0"];
    for (let index = 0; index < imagePaths.length; index += 1) {
      concatLines.push(`file '${filePathForConcat(imagePaths[index])}'`);
      concatLines.push(`duration ${secondsForFfmpeg(clipDurations[index])}`);
    }
    concatLines.push(`file '${filePathForConcat(imagePaths.at(-1))}'`);
    await fs.writeFile(concatPath, `${concatLines.join("\n")}\n`, "utf8");

    const args = [
      "-y",
      "-fflags",
      "+genpts",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "images.ffconcat",
      ...(audioPath ? ["-i", audioPath] : []),
      "-t",
      secondsForFfmpeg(totalDuration),
      "-vf",
      filterChain,
      "-fps_mode",
      "cfr",
      "-r",
      String(fps),
      "-map",
      "0:v:0",
      ...(audioPath
        ? ["-map", "1:a:0", "-af", "aresample=async=1:first_pts=0,apad", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]
        : ["-an"]),
      "-c:v",
      "libx264",
      "-preset",
      compatibilityMode === "capcut-safe" ? "medium" : "veryfast",
      "-tune",
      "stillimage",
      "-crf",
      compatibilityMode === "capcut-safe" ? "21" : "23",
      "-pix_fmt",
      "yuv420p",
      "-profile:v",
      "baseline",
      "-level:v",
      h264LevelForFps(fps),
      "-g",
      String(gopSize),
      "-keyint_min",
      String(gopSize),
      "-sc_threshold",
      "0",
      "-bf",
      "0",
      "-refs",
      "1",
      "-x264-params",
      x264Params,
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
      "-use_editlist",
      "0",
      "-movflags",
      "+faststart",
      "-map_metadata",
      "-1",
      "-metadata:s:v:0",
      "rotate=0",
      "-start_at_zero",
      "reel.mp4",
    ];

    await execFileAsync(ffmpegPath, args, { cwd: tempDir, timeout: 300000, maxBuffer: 20_000_000 });
    const video = await fs.readFile(outputPath);

    return {
      mimeType: "video/mp4",
      filename: "image-reel.mp4",
      video,
      ffmpegPath,
      width,
      height,
      fps,
      durationSeconds: totalDuration,
      audioTrack: audioPath ? "provided" : "none",
      subtitles: assPath ? "burned" : "none",
      compatibilityMode,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/health") {
    try {
      const ffmpegPath = await resolveFfmpegPath();
      return sendJson(res, 200, { ffmpegReady: true, ffmpegPath });
    } catch (error) {
      return sendJson(res, 200, { ffmpegReady: false, error: error.message });
    }
  }

  if (req.method === "POST" && req.url === "/api/render") {
    try {
      const body = await readJson(req);
      return sendMp4(res, await renderVideo(body));
    } catch (error) {
      return sendJson(res, 500, { error: error.message || "Unable to export MP4." });
    }
  }

  if (req.method === "POST" && req.url === "/api/smart-captions") {
    try {
      const body = await readJson(req);
      return sendJson(res, 200, await generateSmartCaptions(body));
    } catch (error) {
      return sendJson(res, Number(error.status || 500), {
        error: error.message || "Unable to generate smart captions.",
        code: error.code || "SMART_CAPTION_FAILED",
        details: error.details || null,
      });
    }
  }

  sendJson(res, 404, { error: "API route not found." });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api/")) {
    handleApi(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(port, () => {
  console.log(`Image Reel Builder running at http://localhost:${port}`);
});

export { server };
