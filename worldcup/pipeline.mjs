import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash, createHmac, createSign, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(__dirname);
const geminiKeyStorePath = path.join(repoRoot, ".gemini-keys.json");
const stockKeyStorePath = path.join(repoRoot, ".stock-keys.json");
const worldCupRoot = path.join(repoRoot, ".tmp-worldcup");
const runsRoot = path.join(worldCupRoot, "runs");
const tempRoot = path.join(worldCupRoot, "tmp");
const indexPath = path.join(worldCupRoot, "index.json");
const portableFfmpegPath = "C:\\tmp\\ffmpeg-portable\\bin\\ffmpeg.exe";
const execFileAsync = promisify(execFile);

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const VIDEO_FPS = 30;
const MAX_SAVED_KEYS = 4;
const DEFAULT_LANGUAGE = process.env.WORLD_CUP_DEFAULT_LANGUAGE || "en";
const SEARCH_MODEL = process.env.WORLD_CUP_SEARCH_MODEL || process.env.WORLD_CUP_RESEARCH_MODEL || "gemini-2.5-pro";
const SEARCH_FALLBACK_MODELS = String(process.env.WORLD_CUP_SEARCH_FALLBACK_MODELS || "gemini-3.5-flash,gemini-2.5-flash")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const WRITER_MODEL = process.env.WORLD_CUP_WRITER_MODEL || "gemini-3.5-flash";
const EVALUATOR_MODEL = process.env.WORLD_CUP_EVALUATOR_MODEL || "gemini-3-flash-preview";
const TTS_REWRITE_MODEL = process.env.WORLD_CUP_TTS_REWRITE_MODEL || WRITER_MODEL;
const TTS_MODEL = process.env.WORLD_CUP_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const AUDIO_SRT_MODEL = process.env.WORLD_CUP_AUDIO_SRT_MODEL || "gemini-2.5-flash";
const MAX_VIDEOS_PER_DAY = Number(process.env.WORLD_CUP_MAX_VIDEOS_PER_DAY || 3);
const DEFAULT_SCHEDULE_HOURS = process.env.WORLD_CUP_SCHEDULE_HOURS || "9,15,21";
const DEFAULT_UPLOAD_TARGET = process.env.WORLD_CUP_UPLOAD_TARGET || "google-drive";
const STOCK_VIDEO_HOSTS = new Set([
  "player.vimeo.com",
  "vod-progressive.akamaized.net",
  "videos.pexels.com",
  "static-videos.pexels.com",
  "images.pexels.com",
  "cdn.pixabay.com",
  "pixabay.com",
]);
const WORLD_CUP_VOICES = [
  "Kore",
  "Puck",
  "Orus",
  "Sulafat",
  "Leda",
  "Laomedeia",
  "Charon",
  "Algieba",
  "Sadaltager",
  "Fenrir",
];

export class WorldCupError extends Error {
  constructor(message, { status = 500, code = "WORLD_CUP_ERROR", provider = null, model = null, details = null } = {}) {
    super(message);
    this.name = "WorldCupError";
    this.status = status;
    this.code = code;
    this.provider = provider;
    this.model = model;
    this.details = details;
  }
}

let cachedFfmpegPath = null;

function nowIso() {
  return new Date().toISOString();
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value, fallback = "world-cup-short") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return slug || fallback;
}

function safeFilePart(value, fallback = "asset") {
  return slugify(value, fallback).slice(0, 64);
}

function normalizeBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return ["1", "true", "yes", "y", "on"].includes(String(value).trim().toLowerCase());
}

function stripTagsForSpeech(text) {
  return String(text || "")
    .replace(/^\s*\[[^\]]+\]\s*/gm, "")
    .replace(/\[Pause\s*\|\s*[\d.]+s\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function envGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function normalizeGeminiKeyStore(store) {
  const slots = Array.isArray(store?.slots)
    ? store.slots
        .filter((slot) => slot?.apiKey)
        .slice(0, MAX_SAVED_KEYS)
        .map((slot, index) => ({
          id: String(slot.id || `slot-${index + 1}`),
          label: String(slot.label || `Gemini key ${index + 1}`),
          apiKey: String(slot.apiKey || "").trim(),
        }))
    : [];
  return {
    activeKeyId: store?.activeKeyId || (envGeminiKey() ? "env" : slots[0]?.id || null),
    slots,
  };
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function getActiveGeminiKey() {
  const store = normalizeGeminiKeyStore(await readJsonFile(geminiKeyStorePath, {}));
  if (store.activeKeyId && store.activeKeyId !== "env") {
    const active = store.slots.find((slot) => slot.id === store.activeKeyId && slot.apiKey);
    if (active) {
      return { id: active.id, label: active.label, apiKey: active.apiKey, source: "saved" };
    }
  }
  const envKey = envGeminiKey();
  if (envKey) {
    return { id: "env", label: "Default .env key", apiKey: envKey, source: ".env" };
  }
  const first = store.slots.find((slot) => slot.apiKey);
  return first ? { id: first.id, label: first.label, apiKey: first.apiKey, source: "saved" } : null;
}

function stockEnvKey(provider) {
  const envNames =
    provider === "pexels"
      ? ["PEXELS_API_KEY", "PEXELS_API_KEYS"]
      : provider === "pixabay"
        ? ["PIXABAY_API_KEY", "PIXABAY_API_KEYS"]
        : [];
  for (const envName of envNames) {
    const value = String(process.env[envName] || "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean)[0];
    if (value) {
      return value;
    }
  }
  return "";
}

async function getActiveStockKey(provider) {
  const envKey = stockEnvKey(provider);
  const store = await readJsonFile(stockKeyStorePath, {});
  const providerStore = store?.providers?.[provider] || store?.[provider] || {};
  const slots = Array.isArray(providerStore?.slots) ? providerStore.slots.filter((slot) => slot?.apiKey) : [];
  if (providerStore.activeKeyId && providerStore.activeKeyId !== "env") {
    const active = slots.find((slot) => slot.id === providerStore.activeKeyId && slot.apiKey);
    if (active) {
      return { id: active.id, label: active.label || `${provider} key`, apiKey: String(active.apiKey).trim(), source: "saved" };
    }
  }
  if (envKey) {
    return { id: "env", label: `${provider} .env key`, apiKey: envKey, source: ".env" };
  }
  const first = slots[0];
  return first ? { id: first.id, label: first.label || `${provider} key`, apiKey: String(first.apiKey).trim(), source: "saved" } : null;
}

async function ensureWorldCupDirs() {
  await fs.mkdir(runsRoot, { recursive: true });
  await fs.mkdir(tempRoot, { recursive: true });
}

async function resolveFfmpegPath() {
  if (cachedFfmpegPath) {
    return cachedFfmpegPath;
  }
  const candidates = [process.env.FFMPEG_PATH, portableFfmpegPath, "ffmpeg"].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["-version"], { timeout: 6000, maxBuffer: 2_000_000 });
      cachedFfmpegPath = candidate;
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  throw new WorldCupError("FFmpeg was not found. Set FFMPEG_PATH, install FFmpeg, or use the portable FFmpeg folder.", {
    status: 500,
    code: "FFMPEG_NOT_FOUND",
  });
}

async function hasFfmpeg() {
  try {
    await resolveFfmpegPath();
    return true;
  } catch {
    return false;
  }
}

function classifyGeminiError(data, status, model) {
  const geminiError = data?.error || {};
  const message = geminiError.message || `Gemini request failed with HTTP ${status}.`;
  const lower = message.toLowerCase();
  let code = geminiError.status || "GEMINI_REQUEST_FAILED";
  if (status === 400 || lower.includes("token") || lower.includes("too long")) {
    code = "REQUEST_TOO_LONG_OR_INVALID";
  }
  if (status === 401 || status === 403 || lower.includes("api key")) {
    code = "INVALID_OR_UNAUTHORIZED_KEY";
  }
  if (status === 429 || lower.includes("quota") || lower.includes("rate")) {
    code = "QUOTA_OR_RATE_LIMIT";
  }
  if (status >= 500) {
    code = "GEMINI_SERVER_ERROR";
  }
  return new WorldCupError(message, {
    status: status >= 400 && status < 500 ? status : 502,
    code,
    provider: "gemini",
    model,
    details: geminiError,
  });
}

function extractJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [raw, fenced?.[1]].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim());
    } catch {
      // Keep trying.
    }
  }
  const firstObject = raw.indexOf("{");
  const lastObject = raw.lastIndexOf("}");
  if (firstObject !== -1 && lastObject > firstObject) {
    try {
      return JSON.parse(raw.slice(firstObject, lastObject + 1));
    } catch {
      // Try array next.
    }
  }
  const firstArray = raw.indexOf("[");
  const lastArray = raw.lastIndexOf("]");
  if (firstArray !== -1 && lastArray > firstArray) {
    try {
      return JSON.parse(raw.slice(firstArray, lastArray + 1));
    } catch {
      // Fall through.
    }
  }
  throw new WorldCupError("Gemini did not return valid JSON.", {
    status: 502,
    code: "INVALID_GEMINI_JSON",
    details: raw.slice(0, 1200),
  });
}

function extractGroundingSources(groundingMetadata) {
  const chunks = Array.isArray(groundingMetadata?.groundingChunks) ? groundingMetadata.groundingChunks : [];
  return chunks
    .map((chunk) => chunk.web)
    .filter((web) => web?.uri)
    .map((web) => ({ title: cleanText(web.title || "Source"), uri: String(web.uri || "") }))
    .slice(0, 12);
}

async function requestGeminiJson({ keyInfo, model, prompt, temperature = 0.6, search = false, parts = null }) {
  if (!keyInfo?.apiKey) {
    throw new WorldCupError("Missing Gemini API key for World Cup generation.", {
      status: 400,
      code: "MISSING_GEMINI_KEY",
      provider: "gemini",
      model,
    });
  }

  const body = {
    contents: [{ parts: parts || [{ text: prompt }] }],
    generationConfig: { temperature },
  };
  if (search) {
    body.tools = [{ google_search: {} }];
  } else {
    body.generationConfig.responseMimeType = "application/json";
  }

  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": keyInfo.apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new WorldCupError(`Gemini network request failed: ${error.message}`, {
      status: 502,
      code: "NETWORK_OR_SERVER_UNREACHABLE",
      provider: "gemini",
      model,
    });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw classifyGeminiError(data, response.status, model);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  return {
    json: extractJson(text),
    rawText: text,
    sources: extractGroundingSources(data?.candidates?.[0]?.groundingMetadata),
    groundingMetadata: data?.candidates?.[0]?.groundingMetadata || null,
  };
}

async function requestGeminiJsonWithFallbacks({ keyInfo, primaryModel, fallbackModels = [], prompt, temperature = 0.6, search = false }) {
  const models = [primaryModel, ...fallbackModels].filter(Boolean).filter((model, index, list) => list.indexOf(model) === index);
  const errors = [];
  for (const model of models) {
    try {
      const result = await requestGeminiJson({ keyInfo, model, prompt, temperature, search });
      return { ...result, model };
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
      const retryable =
        error.code === "QUOTA_OR_RATE_LIMIT" ||
        error.code === "GEMINI_SERVER_ERROR" ||
        error.code === "NETWORK_OR_SERVER_UNREACHABLE" ||
        /quota|rate|high demand|overloaded|temporar/i.test(error.message || "");
      if (!retryable) {
        throw error;
      }
    }
  }
  throw new WorldCupError(`All Gemini model attempts failed: ${errors.join(" | ")}`, {
    status: 502,
    code: "GEMINI_MODEL_FALLBACKS_EXHAUSTED",
    details: errors,
  });
}

function createWavBuffer(pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

function wavDurationSeconds(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF") {
    return 0;
  }
  try {
    const channels = buffer.readUInt16LE(22) || 1;
    const sampleRate = buffer.readUInt32LE(24) || 24000;
    const bitsPerSample = buffer.readUInt16LE(34) || 16;
    const dataSize = buffer.readUInt32LE(40) || Math.max(0, buffer.length - 44);
    return dataSize / ((sampleRate * channels * bitsPerSample) / 8);
  } catch {
    return 0;
  }
}

async function synthesizeWorldCupAudio({ keyInfo, screenplay, voice, mood }) {
  const selectedVoice = WORLD_CUP_VOICES.includes(voice) ? voice : "Kore";
  const prompt = `
You are the voice of "World Cup Chaos Desk".
Read this short-form football script naturally for TikTok, Instagram Reels, and YouTube Shorts.
Do not read bracket labels as literal text. Use them only as acting notes.
Mood: ${mood || "confident, fast, funny analyst"}
Voice style: clear English, natural football-fan rhythm, energetic but not shouting.

${screenplay}
`.trim();

  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": keyInfo.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          temperature: 1.1,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
        model: TTS_MODEL,
      }),
    });
  } catch (error) {
    throw new WorldCupError(`Gemini TTS network request failed: ${error.message}`, {
      status: 502,
      code: "NETWORK_OR_SERVER_UNREACHABLE",
      provider: "gemini",
      model: TTS_MODEL,
    });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw classifyGeminiError(data, response.status, TTS_MODEL);
  }
  const inlineData = data?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!inlineData?.data) {
    throw new WorldCupError("Gemini TTS did not return audio data.", {
      status: 502,
      code: "NO_AUDIO_RETURNED",
      provider: "gemini",
      model: TTS_MODEL,
      details: data,
    });
  }
  const rawAudio = Buffer.from(inlineData.data, "base64");
  const mimeType = inlineData.mimeType || "audio/pcm";
  const audio = mimeType.includes("wav") ? rawAudio : createWavBuffer(rawAudio);
  return {
    audio,
    mimeType: "audio/wav",
    durationSeconds: wavDurationSeconds(audio),
    voice: selectedVoice,
    model: TTS_MODEL,
  };
}

function srtTimestamp(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const totalMs = Math.round(safe * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function assTimestamp(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const totalCs = Math.round(safe * 100);
  const hours = Math.floor(totalCs / 360000);
  const minutes = Math.floor((totalCs % 360000) / 6000);
  const secs = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function buildSrt(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment, index) => {
      const text = cleanText(segment.text || segment.caption || segment.line);
      return text ? `${index + 1}\n${srtTimestamp(segment.startTime)} --> ${srtTimestamp(segment.endTime)}\n${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function parseSrtTimestamp(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!match) {
    return 0;
  }
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(millis.padEnd(3, "0")) / 1000;
}

function parseSrtSegments(srtText) {
  return String(srtText || "")
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
      const text = cleanText(lines.slice(timeIndex + 1).join(" "));
      if (!text || endTime <= startTime) {
        return null;
      }
      return { number: index + 1, startTime, endTime, durationSeconds: endTime - startTime, text };
    })
    .filter(Boolean);
}

function splitIntoCaptionLines(text) {
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

function estimateSrtFromText(text, durationSeconds = 0) {
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
  return { segments, srt: buildSrt(segments), source: "estimated-from-script" };
}

async function generateAudioAwareSrt({ keyInfo, audioBase64, mimeType, screenplay, durationSeconds, warnings }) {
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
    const result = await requestGeminiJson({
      keyInfo,
      model: AUDIO_SRT_MODEL,
      temperature: 0.2,
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || "audio/wav", data: audioBase64 } },
      ],
    });
    const rawSegments = Array.isArray(result.json?.segments) ? result.json.segments : [];
    const segments = rawSegments
      .map((segment, index) => {
        const startTime = Math.max(0, Number(segment.startTime ?? segment.start ?? 0) || 0);
        const endTime = Math.max(startTime + 0.5, Number(segment.endTime ?? segment.end ?? startTime + 2) || startTime + 2);
        const text = cleanText(segment.text || segment.caption || "");
        return text ? { number: index + 1, startTime, endTime, durationSeconds: endTime - startTime, text } : null;
      })
      .filter(Boolean);
    if (!segments.length) {
      throw new Error("No valid SRT segments returned.");
    }
    return {
      audioSummary: result.json.audioSummary || "",
      segments,
      srt: buildSrt(segments),
      source: "audio-aware-gemini",
      model: AUDIO_SRT_MODEL,
    };
  } catch (error) {
    warnings.push(`Audio-aware SRT fell back to script timing: ${error.message}`);
    return estimateSrtFromText(screenplay, durationSeconds);
  }
}

function normalizeWorldCupInput(input = {}) {
  const type = String(input.type || input.mode || "pre-tournament").trim().toLowerCase();
  const teamA = cleanText(input.teamA || input.team_a || input.match?.teamA || input.match?.homeTeam || "");
  const teamB = cleanText(input.teamB || input.team_b || input.match?.teamB || input.match?.awayTeam || "");
  const date = cleanText(input.date || input.match?.date || todayDate()).slice(0, 10);
  const matchId = cleanText(input.matchId || input.match_id || input.match?.id || "");
  const topic =
    cleanText(input.topic) ||
    (teamA && teamB ? `${teamA} vs ${teamB} ${type === "postmatch" ? "post-match analysis" : "prediction"}` : "World Cup chaos storylines to watch");
  const matchSlug = teamA && teamB ? `${slugify(teamA)}-vs-${slugify(teamB)}` : slugify(topic, "world-cup-topic");
  const runType = ["prediction", "postmatch", "pre-tournament"].includes(type) ? type : teamA && teamB ? "prediction" : "pre-tournament";
  const idBase = `${date}-${matchSlug}-${runType}-${hashText(`${topic}:${matchId}:${input.kickoff || ""}`)}`;
  return {
    id: cleanText(input.id) || slugify(idBase),
    type: runType,
    mode: runType,
    topic,
    match: {
      id: matchId || hashText(`${date}:${teamA}:${teamB}:${topic}`),
      date,
      kickoff: cleanText(input.kickoff || input.match?.kickoff || ""),
      teamA,
      teamB,
      competition: cleanText(input.competition || input.match?.competition || "FIFA World Cup 2026"),
      venue: cleanText(input.venue || input.match?.venue || ""),
    },
    audience: cleanText(input.audience || "US, Europe, and South America football fans"),
    language: cleanText(input.language || DEFAULT_LANGUAGE),
    render: normalizeBool(input.render, false),
    upload: normalizeBool(input.upload, false),
    offline: normalizeBool(input.offline, false),
    generateAudio: normalizeBool(input.generateAudio, true),
    source: cleanText(input.source || "auto"),
    commentaryText: String(input.commentaryText || ""),
    commentaryUrl: cleanText(input.commentaryUrl || ""),
    durationSeconds: Math.max(25, Math.min(65, Number(input.durationSeconds || 48) || 48)),
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
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

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function localCommentaryExtractor(text, sourceUrl = "") {
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

async function extractCommentaryEvents({ keyInfo, text, url, offline, warnings }) {
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

function fallbackEvidence(options, commentaryEvents = []) {
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
    sourcedClaims: [
      {
        claim: "Use only verified match facts from the evidence pack. If the data is incomplete, mark predictions as opinion.",
        sourceUrl: "",
        confidence: 1,
      },
    ],
    uncertaintyNotes: ["Live fixture/search data was not available for this draft. Review facts before posting."],
  };
}

async function collectWorldCupData(options, keyInfo, warnings) {
  const commentaryEvents = await extractCommentaryEvents({
    keyInfo,
    text: options.commentaryText,
    url: options.commentaryUrl,
    offline: options.offline,
    warnings,
  });
  if (!keyInfo?.apiKey || options.offline) {
    return {
      evidence: fallbackEvidence(options, commentaryEvents),
      sources: [],
      commentaryEvents,
    };
  }

  const matchDescription =
    options.match.teamA && options.match.teamB
      ? `${options.match.teamA} vs ${options.match.teamB}, ${options.match.competition}, date ${options.match.date}, kickoff ${options.match.kickoff || "unknown"}`
      : `World Cup topic: ${options.topic}`;
  const prompt = `
You are a football research producer for short-form content.
Research the current public context for this video and build a compact evidence pack.

Video:
- Type: ${options.type}
- Topic/match: ${matchDescription}
- Audience: ${options.audience}
- Language: ${options.language}

Rules:
- Use search grounding for current facts.
- Include only claims that are supportable from sources or mark them as uncertainty/opinion.
- Do not invent injuries, odds, lineups, scores, or stats.
- Keep evidence compact enough for a script writer.
- Commentary-derived events are internal facts and must not be quoted verbatim.

Known commentary events:
${JSON.stringify(commentaryEvents, null, 2)}

Return JSON:
{
  "match": {},
  "topic": "",
  "videoType": "prediction | postmatch | pre-tournament",
  "recentForm": [{"claim":"", "support":"", "sourceUrl":"", "confidence":0.0}],
  "keyPlayers": [{"name":"", "team":"", "whyImportant":"", "safeVisualHint":"player-card fallback ok", "sourceUrl":"", "confidence":0.0}],
  "tacticalMatchup": [{"claim":"", "support":"", "sourceUrl":"", "confidence":0.0}],
  "injuriesSuspensions": [{"claim":"", "sourceUrl":"", "confidence":0.0}],
  "oddsFavoriteContext": "",
  "turningPoints": [],
  "sourcedClaims": [{"claim":"", "sourceUrl":"", "confidence":0.0}],
  "uncertaintyNotes": [""]
}
`.trim();

  try {
    const result = await requestGeminiJsonWithFallbacks({
      keyInfo,
      primaryModel: SEARCH_MODEL,
      fallbackModels: SEARCH_FALLBACK_MODELS,
      prompt,
      temperature: 0.35,
      search: true,
    });
    const evidence = {
      ...fallbackEvidence(options, commentaryEvents),
      ...result.json,
      match: { ...options.match, ...(result.json.match || {}) },
      topic: cleanText(result.json.topic || options.topic),
      videoType: options.type,
      researchModel: result.model,
      turningPoints: [...commentaryEvents, ...(Array.isArray(result.json.turningPoints) ? result.json.turningPoints : [])].slice(0, 24),
    };
    return { evidence, sources: result.sources, commentaryEvents };
  } catch (error) {
    warnings.push(`Search evidence fallback used: ${error.message}`);
    return { evidence: fallbackEvidence(options, commentaryEvents), sources: [], commentaryEvents };
  }
}

function fallbackScripts(evidence) {
  const matchName = evidence.match?.teamA && evidence.match?.teamB ? `${evidence.match.teamA} vs ${evidence.match.teamB}` : evidence.topic;
  const dataPoint = evidence.sourcedClaims?.[0]?.claim || evidence.tacticalMatchup?.[0]?.claim || "the data is still incomplete, so the safest angle is pressure and matchup context";
  return [
    {
      styleId: "serious_analyst",
      title: `${matchName}: the serious pick`,
      text: `Everyone wants the obvious World Cup take on ${matchName}. I do not. The clue is this: ${dataPoint}. That makes this less about star names and more about who handles the first bad ten minutes. My lean is the team that turns pressure into chances, not panic. If this ages badly, I will accept the football court hearing in the comments.`,
      dataPoint,
      opinion: "The calmer team under pressure has the edge.",
      joke: "football court hearing in the comments",
      commentTrigger: "Tell me if this pick is cooked or genius.",
    },
    {
      styleId: "funny_fan_analyst",
      title: `${matchName}: chaos watch`,
      text: `This match has trap game energy. On paper, it looks simple. In World Cup language, that means someone is about to make the group chat unbearable. The useful clue: ${dataPoint}. So I am watching the midfield like it owes me money. My pick is the team with less panic in possession. If I am wrong, clip this and send me to football jail.`,
      dataPoint,
      opinion: "This could be closer than the reputation gap suggests.",
      joke: "the group chat becomes unbearable",
      commentTrigger: "Who is going to football jail here?",
    },
    {
      styleId: "dramatic_storyteller",
      title: `${matchName}: pressure story`,
      text: `Every World Cup match has one quiet question: who blinks first? For ${matchName}, the clue is ${dataPoint}. That is why this is not just a preview. It is a pressure test. One mistake, one counterattack, one keeper moment, and the whole story flips. I am leaning toward the side that looks built for ugly minutes. Save this, because football loves receipts.`,
      dataPoint,
      opinion: "The game may be decided by one pressure moment.",
      joke: "football loves receipts",
      commentTrigger: "What is the one moment you think decides it?",
    },
  ];
}

async function generateScripts(evidence, keyInfo, options, warnings) {
  if (!keyInfo?.apiKey || options.offline) {
    return { scripts: fallbackScripts(evidence), model: "local-fallback" };
  }
  const prompt = `
You are the head writer for "World Cup Chaos Desk".
Write three distinct English short-video scripts for US, Europe, and South America football audiences.

Channel identity:
- smart football friend with receipts
- fast, funny, fan-native, and data-backed
- opinionated but fair
- never generic AI sports narration

Video target:
- Type: ${options.type}
- Duration: 35 to 55 seconds
- Structure: 0-2s hook, 2-6s promise, 6-18s data/form, 18-32s tactical/fan story, 32-45s prediction/conclusion, 45-55s punchline/comment trigger

Required in every script:
- a 1 to 2 second hook
- one real evidence-backed data point
- one clear opinion
- one football-native joke or metaphor
- one ending that makes comments likely

Avoid:
- fake certainty
- copied commentary wording
- bland ESPN preview tone
- random player claims not in evidence
- overused "you won't believe" hooks

Evidence pack:
${JSON.stringify(evidence, null, 2)}

Return JSON:
{
  "scripts": [
    {
      "styleId": "serious_analyst",
      "title": "",
      "text": "",
      "dataPoint": "",
      "opinion": "",
      "joke": "",
      "commentTrigger": "",
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
        title: cleanText(script.title),
        text: cleanText(script.text),
        dataPoint: cleanText(script.dataPoint),
        opinion: cleanText(script.opinion),
        joke: cleanText(script.joke),
        commentTrigger: cleanText(script.commentTrigger),
        factualClaims: Array.isArray(script.factualClaims) ? script.factualClaims.map(cleanText).filter(Boolean) : [],
        riskNotes: Array.isArray(script.riskNotes) ? script.riskNotes.map(cleanText).filter(Boolean) : [],
      }))
      .filter((script) => script.text);
    if (scripts.length < 3) {
      warnings.push("Writer returned fewer than three scripts, local fallbacks were added.");
      return { scripts: [...scripts, ...fallbackScripts(evidence)].slice(0, 3), model: WRITER_MODEL };
    }
    return { scripts, model: WRITER_MODEL };
  } catch (error) {
    warnings.push(`Script writer fallback used: ${error.message}`);
    return { scripts: fallbackScripts(evidence), model: "local-fallback" };
  }
}

function heuristicScriptScore(script) {
  const text = script.text || "";
  const words = text.split(/\s+/).filter(Boolean);
  const hasJoke = /court|jail|rent|panic|group chat|receipts|chaos|aura|cooked/i.test(text);
  const hasQuestion = /\?/.test(text) || /comments|tell me|who|what/i.test(text);
  const notTooLong = words.length >= 80 && words.length <= 155;
  return {
    factualSupport: script.dataPoint ? 7 : 5,
    hookStrength: words.slice(0, 14).join(" ").length < 95 ? 8 : 6,
    humorAuthenticity: hasJoke ? 8 : 5,
    shareability: hasJoke && hasQuestion ? 8 : 6,
    retentionPotential: notTooLong ? 8 : 6,
    commentPotential: hasQuestion ? 8 : 5,
    ttsNaturalness: words.length <= 155 ? 8 : 6,
    risk: 8,
  };
}

function totalJudgeScore(scores) {
  return Object.values(scores || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

async function judgeScripts({ scripts, evidence, keyInfo, options, warnings }) {
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

async function reviseWeakScript({ script, evidence, keyInfo, warnings }) {
  const prompt = `
Revise this World Cup short script once.
Keep it factual, fan-native, funny, and easy for TTS.
Do not add unsupported facts.

Evidence:
${JSON.stringify(evidence, null, 2)}

Weak script:
${JSON.stringify(script, null, 2)}

Return JSON:
{"title":"", "text":"", "dataPoint":"", "opinion":"", "joke":"", "commentTrigger":"", "revisionNotes":[""]}
`.trim();
  try {
    const result = await requestGeminiJson({ keyInfo, model: WRITER_MODEL, prompt, temperature: 0.75 });
    return result.json;
  } catch (error) {
    warnings.push(`Revision pass skipped: ${error.message}`);
    return null;
  }
}

function fallbackTtsRewrite(selectedScript) {
  const style = selectedScript.styleId || "";
  const voice =
    style.includes("funny") || /jail|group chat|chaos|cooked/i.test(selectedScript.text)
      ? "Puck"
      : style.includes("dramatic")
        ? "Sulafat"
        : "Kore";
  const mood =
    style.includes("funny") || voice === "Puck"
      ? "energetic football fan analyst"
      : style.includes("dramatic")
        ? "cinematic but grounded"
        : "confident analyst";
  return {
    screenplay: `[Hook | punchy]\n${selectedScript.text}\n\n[Outro | playful]\nDrop your verdict in the comments.`,
    voice,
    mood,
    model: "local-fallback",
    reasoning: "Voice selected from script style using local fallback rules.",
    tags: ["Hook", "Outro", mood],
  };
}

async function rewriteForTts({ selectedScript, evidence, keyInfo, options, warnings }) {
  if (!keyInfo?.apiKey || options.offline) {
    return fallbackTtsRewrite(selectedScript);
  }
  const prompt = `
Rewrite the winning World Cup script into a Gemini TTS-ready screenplay.

Rules:
- Keep the same facts and opinion. Do not add unsupported claims.
- Keep it natural for short-form audio. No overdramatic whisper starts.
- Use light tags only, like [Hook | punchy], [Beat | controlled], [Punchline | playful].
- Do not overload every line with tags.
- Preserve football-fan humor and comment trigger.
- Select one Gemini voice from: ${WORLD_CUP_VOICES.join(", ")}.
- Voice logic:
  serious prediction: Kore, Orus, Charon
  funny or chaos pick: Puck, Laomedeia, Fenrir
  dramatic legacy story: Sulafat, Algieba
  post-match analysis: Kore, Orus, Sadaltager

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
    return {
      screenplay: cleanText(result.json.screenplay).replace(/\\n/g, "\n") || fallbackTtsRewrite(selectedScript).screenplay,
      voice: WORLD_CUP_VOICES.includes(result.json.voice) ? result.json.voice : fallbackTtsRewrite(selectedScript).voice,
      mood: cleanText(result.json.mood) || fallbackTtsRewrite(selectedScript).mood,
      reasoning: cleanText(result.json.reasoning),
      tags: Array.isArray(result.json.tags) ? result.json.tags.map(cleanText).filter(Boolean) : [],
      model: TTS_REWRITE_MODEL,
    };
  } catch (error) {
    warnings.push(`TTS rewrite fallback used: ${error.message}`);
    return fallbackTtsRewrite(selectedScript);
  }
}

async function resolveWikimediaPlayerImage(playerName, team) {
  const query = cleanText(`${playerName} ${team || ""} footballer`);
  if (!query) {
    return null;
  }
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*`;
    const searchResponse = await fetch(searchUrl, { headers: { Accept: "application/json" } });
    if (!searchResponse.ok) {
      return null;
    }
    const searchData = await searchResponse.json();
    const id = searchData?.search?.[0]?.id;
    if (!id) {
      return null;
    }
    const claimUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${encodeURIComponent(id)}&property=P18&format=json&origin=*`;
    const claimResponse = await fetch(claimUrl, { headers: { Accept: "application/json" } });
    if (!claimResponse.ok) {
      return null;
    }
    const claimData = await claimResponse.json();
    const fileName = claimData?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!fileName) {
      return null;
    }
    const title = `File:${fileName}`;
    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`;
    const infoResponse = await fetch(infoUrl, { headers: { Accept: "application/json" } });
    if (!infoResponse.ok) {
      return null;
    }
    const infoData = await infoResponse.json();
    const page = Object.values(infoData?.query?.pages || {})[0];
    const info = page?.imageinfo?.[0];
    if (!info?.url) {
      return null;
    }
    const metadata = info.extmetadata || {};
    return {
      id: `wikimedia-${hashText(info.url)}`,
      type: "image",
      provider: "wikimedia",
      url: info.url,
      pageUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      title: metadata.ObjectName?.value || fileName,
      creator: stripHtml(metadata.Artist?.value || ""),
      license: stripHtml(metadata.LicenseShortName?.value || metadata.License?.value || ""),
      rightsStatus: "approved",
      sourcePlayer: playerName,
      sourceTeam: team || "",
    };
  } catch {
    return null;
  }
}

async function searchPexelsVideos(query, apiKey) {
  if (!apiKey) {
    return [];
  }
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`;
  const response = await fetch(url, { headers: { Authorization: apiKey } });
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
        rightsStatus: "approved",
      };
    })
    .filter(Boolean);
}

async function searchPixabayVideos(query, apiKey) {
  if (!apiKey) {
    return [];
  }
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&orientation=vertical&per_page=5&safesearch=true`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
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
        rightsStatus: "approved",
      };
    })
    .filter(Boolean);
}

function segmentSearchQueries(segment, evidence) {
  const base = cleanText(segment.text).toLowerCase();
  const teams = [evidence.match?.teamA, evidence.match?.teamB].filter(Boolean).join(" ");
  if (/press|midfield|tactic|pressure|counter|transition/.test(base)) {
    return [`football tactical board ${teams}`, "soccer tactics board animation", "football midfield pressure"];
  }
  if (/fans|comments|jail|court|group chat|chaos|panic/.test(base)) {
    return ["football fans reaction crowd", "soccer fans celebration vertical", "football supporters nervous"];
  }
  if (/goal|save|keeper|shot|moment/.test(base)) {
    return ["soccer goalkeeper save vertical", "football goal celebration stadium", "soccer match action"];
  }
  return [`world cup football stadium ${teams}`, "soccer stadium crowd vertical", "football boots pitch close up"];
}

async function buildVisualPlan({ evidence, srtSegments, keyInfo, options, warnings }) {
  const attributions = [];
  const wikimediaAssets = [];
  const keyPlayers = (Array.isArray(evidence.keyPlayers) ? evidence.keyPlayers : []).slice(0, 5);
  for (const player of keyPlayers) {
    const asset = await resolveWikimediaPlayerImage(player.name, player.team);
    if (asset) {
      wikimediaAssets.push(asset);
      attributions.push({
        assetId: asset.id,
        title: asset.title,
        creator: asset.creator,
        license: asset.license,
        sourceUrl: asset.pageUrl,
        rightsStatus: "approved",
      });
    }
  }

  const pexelsKey = await getActiveStockKey("pexels");
  const pixabayKey = await getActiveStockKey("pixabay");
  const canSearchStock = !options.offline && Boolean(pexelsKey?.apiKey || pixabayKey?.apiKey);
  const segments = [];

  for (const segment of srtSegments) {
    const queries = segmentSearchQueries(segment, evidence);
    const mentionedAsset = wikimediaAssets.find((asset) => new RegExp(`\\b${asset.sourcePlayer.split(/\s+/).slice(-1)[0]}\\b`, "i").test(segment.text));
    let candidates = [];
    if (!mentionedAsset && canSearchStock && options.source !== "fallback-only") {
      for (const query of queries.slice(0, 2)) {
        try {
          if (pexelsKey?.apiKey) {
            candidates.push(...(await searchPexelsVideos(query, pexelsKey.apiKey)));
          }
          if (pixabayKey?.apiKey) {
            candidates.push(...(await searchPixabayVideos(query, pixabayKey.apiKey)));
          }
        } catch (error) {
          warnings.push(`Stock search failed for "${query}": ${error.message}`);
        }
        if (candidates.length) {
          break;
        }
      }
    }
    const selectedClip = candidates.find((clip) => clip.url) || null;
    if (selectedClip) {
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
      selectedImage: mentionedAsset || null,
      selectedClip,
      candidates: candidates.slice(0, 4),
      fallbackVisual: fallbackVisualForSegment(segment, evidence),
      rightsStatus: mentionedAsset || selectedClip ? "approved" : "fallback_used",
    });
  }

  return {
    title: evidence.match?.teamA && evidence.match?.teamB ? `${evidence.match.teamA} vs ${evidence.match.teamB}` : evidence.topic,
    directorSummary: buildDirectorSummary(evidence),
    aspectRatio: "9:16",
    captionStyle: "creator-yellow-pop",
    captionAnimation: "slide-lift",
    visualPacing: "Change visual every 3 to 6 seconds; use tactical/card fallback when rights are unclear.",
    playerAssets: wikimediaAssets,
    segments,
    attributions,
    warnings: canSearchStock ? [] : ["No stock media key found, fallback visuals were used for stock beats."],
  };
}

function visualIntentForSegment(segment, evidence) {
  const text = segment.text || "";
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
  return `Football atmosphere shot with ${teams || "World Cup"} context and bold data-card overlay.`;
}

function fallbackVisualForSegment(segment, evidence) {
  const teams = [evidence.match?.teamA, evidence.match?.teamB].filter(Boolean);
  const palette = segment.number % 3 === 0 ? "emerald and gold" : segment.number % 3 === 1 ? "navy and yellow" : "black, white, and red";
  return {
    type: /press|midfield|tactic/i.test(segment.text) ? "tactical-board" : "worldcup-card",
    palette,
    headline: teams.length === 2 ? `${teams[0]} vs ${teams[1]}` : "World Cup Chaos Desk",
    subline: cleanText(segment.text).slice(0, 110),
  };
}

function buildDirectorSummary(evidence) {
  const topic = evidence.match?.teamA && evidence.match?.teamB ? `${evidence.match.teamA} vs ${evidence.match.teamB}` : evidence.topic;
  const keyClaim = evidence.sourcedClaims?.[0]?.claim || evidence.tacticalMatchup?.[0]?.claim || "pressure and fan emotion drive the story";
  return `Fast football creator reel about ${topic}. Visual language should feel like a smart fan desk: quick cards, tactical boards, safe stock crowd/action clips, and player cards only when rights are approved. Main visual thesis: ${keyClaim}`;
}

function buildRightsManifest(visualPlan) {
  const assetRows = [];
  for (const segment of visualPlan.segments || []) {
    if (segment.selectedImage) {
      assetRows.push({
        segment: segment.number,
        assetId: segment.selectedImage.id,
        provider: "wikimedia",
        sourceUrl: segment.selectedImage.pageUrl,
        rightsStatus: "approved",
        flags: [],
      });
    } else if (segment.selectedClip) {
      assetRows.push({
        segment: segment.number,
        assetId: segment.selectedClip.id,
        provider: segment.selectedClip.provider,
        sourceUrl: segment.selectedClip.pageUrl,
        rightsStatus: "approved",
        flags: [],
      });
    } else {
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

async function createRunSkeleton(options) {
  await ensureWorldCupDirs();
  const runDir = path.join(runsRoot, options.id);
  await fs.mkdir(runDir, { recursive: true });
  const createdAt = nowIso();
  return {
    id: options.id,
    type: options.type,
    status: "drafting",
    createdAt,
    updatedAt: createdAt,
    topic: options.topic,
    match: options.match,
    language: options.language,
    evidence: {},
    scripts: [],
    selectedScript: {},
    tts: {},
    audio: {},
    srt: {},
    visualPlan: {},
    rightsManifest: {},
    r2: { mp4Key: "", publicUrl: "" },
    drive: { folderId: "", folderUrl: "", uploaded: [] },
    sources: [],
    attributions: [],
    warnings: [],
    files: {},
  };
}

async function writeRunFile(run, fileName, data, encoding = null) {
  const runDir = path.join(runsRoot, run.id);
  await fs.mkdir(runDir, { recursive: true });
  const filePath = path.join(runDir, fileName);
  await fs.writeFile(filePath, data, encoding || undefined);
  return fileName;
}

async function saveRun(run) {
  run.updatedAt = nowIso();
  await ensureWorldCupDirs();
  await fs.writeFile(path.join(runsRoot, `${run.id}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  await rebuildWorldCupIndex();
  return run;
}

function runSummary(run) {
  return {
    id: run.id,
    type: run.type,
    status: run.status,
    topic: run.topic,
    match: run.match,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    scriptPreview: cleanText(run.selectedScript?.text || run.tts?.screenplay || "").slice(0, 280),
    selectedStyle: run.selectedScript?.styleId || "",
    voice: run.tts?.voice || "",
    srtSegments: run.srt?.segments?.length || 0,
    durationSeconds: run.audio?.durationSeconds || run.srt?.durationSeconds || 0,
    r2: run.r2 || {},
    drive: run.drive || {},
    files: run.files || {},
    warnings: (run.warnings || []).slice(0, 6),
  };
}

async function rebuildWorldCupIndex() {
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
  const safeId = slugify(id, "");
  if (!safeId) {
    throw new WorldCupError("Missing World Cup run id.", { status: 400, code: "MISSING_RUN_ID" });
  }
  try {
    return JSON.parse(await fs.readFile(path.join(runsRoot, `${safeId}.json`), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new WorldCupError("World Cup run was not found.", { status: 404, code: "WORLD_CUP_RUN_NOT_FOUND" });
    }
    throw error;
  }
}

export async function worldCupConfigSummary() {
  const keyInfo = await getActiveGeminiKey();
  const pexels = await getActiveStockKey("pexels");
  const pixabay = await getActiveStockKey("pixabay");
  return {
    ready: Boolean(keyInfo?.apiKey),
    ffmpegReady: await hasFfmpeg(),
    r2Ready: Boolean(
      process.env.CLOUDFLARE_ACCOUNT_ID &&
        process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
        process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME,
    ),
    driveReady: Boolean(hasGoogleDriveCredentials() && process.env.GOOGLE_DRIVE_FOLDER_ID),
    uploadTarget: DEFAULT_UPLOAD_TARGET,
    stockReady: Boolean(pexels?.apiKey || pixabay?.apiKey),
    models: {
      search: SEARCH_MODEL,
      searchFallbacks: SEARCH_FALLBACK_MODELS,
      writer: WRITER_MODEL,
      evaluator: EVALUATOR_MODEL,
      ttsRewrite: TTS_REWRITE_MODEL,
      tts: TTS_MODEL,
      audioSrt: AUDIO_SRT_MODEL,
    },
    defaultCaptionStyle: "creator-yellow-pop",
    defaultCaptionAnimation: "slide-lift",
    maxVideosPerDay: MAX_VIDEOS_PER_DAY,
    scheduleHoursUtc: scheduledHours(),
  };
}

export async function generateWorldCupRun(input = {}) {
  const options = normalizeWorldCupInput(input);
  const keyInfo = await getActiveGeminiKey();
  const run = await createRunSkeleton(options);
  run.warnings = [];

  if (!keyInfo?.apiKey) {
    run.warnings.push("No Gemini key is active. A local fallback draft was created.");
  }

  const data = await collectWorldCupData(options, keyInfo, run.warnings);
  run.evidence = data.evidence;
  run.sources = data.sources;
  run.files.evidence = await writeRunFile(run, "evidence.json", `${JSON.stringify(run.evidence, null, 2)}\n`, "utf8");

  const scriptResult = await generateScripts(run.evidence, keyInfo, options, run.warnings);
  run.scripts = scriptResult.scripts;
  const judgeResult = await judgeScripts({ scripts: run.scripts, evidence: run.evidence, keyInfo, options, warnings: run.warnings });
  run.selectedScript = {
    ...judgeResult.selected,
    judge: {
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
    },
  };
  run.files.script = await writeRunFile(
    run,
    "script.json",
    `${JSON.stringify({ scripts: run.scripts, selectedScript: run.selectedScript }, null, 2)}\n`,
    "utf8",
  );

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

  const srtResult = await generateAudioAwareSrt({
    keyInfo,
    audioBase64,
    mimeType: "audio/wav",
    screenplay: run.tts.screenplay || run.selectedScript.text,
    durationSeconds: run.audio?.durationSeconds || options.durationSeconds,
    warnings: run.warnings,
  });
  run.srt = {
    source: srtResult.source,
    model: srtResult.model || "",
    audioSummary: srtResult.audioSummary || "",
    segments: srtResult.segments,
    durationSeconds: srtResult.segments.at(-1)?.endTime || 0,
    captionStyle: "creator-yellow-pop",
    captionAnimation: "slide-lift",
  };
  run.files.srt = await writeRunFile(run, "srt.srt", srtResult.srt, "utf8");
  run.files.captions = await writeRunFile(
    run,
    "captions.json",
    `${JSON.stringify({ ...run.srt, srt: srtResult.srt }, null, 2)}\n`,
    "utf8",
  );

  run.visualPlan = await buildVisualPlan({ evidence: run.evidence, srtSegments: run.srt.segments, keyInfo, options, warnings: run.warnings });
  run.attributions = run.visualPlan.attributions || [];
  run.rightsManifest = buildRightsManifest(run.visualPlan);
  run.files.visuals = await writeRunFile(run, "visuals.json", `${JSON.stringify(run.visualPlan, null, 2)}\n`, "utf8");
  run.files.attribution = await writeRunFile(run, "attribution.json", `${JSON.stringify(run.attributions, null, 2)}\n`, "utf8");
  run.files.rights = await writeRunFile(run, "rights.json", `${JSON.stringify(run.rightsManifest, null, 2)}\n`, "utf8");
  run.status = "generated";
  await saveRun(run);

  if (options.render) {
    await renderWorldCupRun(run.id, input);
  }
  if (options.upload) {
    await uploadWorldCupRun(run.id, input);
  }
  return await readWorldCupRun(run.id);
}

function assColor(hex, alpha = "00") {
  const clean = String(hex || "#ffffff").replace("#", "").padEnd(6, "f").slice(0, 6);
  return `&H${alpha}${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}`;
}

function escapeAssText(text) {
  return cleanText(text)
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

function splitCaptionWords(text, maxWords = 4) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords || maxWords <= 0) {
    return [words.join(" ")].filter(Boolean);
  }
  const chunks = [];
  for (let index = 0; index < words.length; index += maxWords) {
    chunks.push(words.slice(index, index + maxWords).join(" "));
  }
  return chunks;
}

function buildAssFromSrt(srtText) {
  const segments = parseSrtSegments(srtText);
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
    `Style: Caption,Arial,70,${assColor("#ffe600")},${assColor("#ffffff")},${assColor("#050505")},${assColor("#000000", "88")},-1,0,0,0,100,100,0,0,1,7,2,2,80,80,270,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const lines = [];
  for (const segment of segments) {
    const chunks = splitCaptionWords(segment.text, 4);
    const duration = segment.endTime - segment.startTime;
    const chunkDuration = chunks.length > 1 ? duration / chunks.length : duration;
    for (let index = 0; index < chunks.length; index += 1) {
      const start = segment.startTime + chunkDuration * index;
      const end = index === chunks.length - 1 ? segment.endTime : segment.startTime + chunkDuration * (index + 1);
      const yStart = 1580;
      const yEnd = 1510;
      const tag = `{\\an5\\move(540,${yStart},540,${yEnd},0,160)\\fad(60,90)\\fscx95\\fscy95\\t(0,120,\\fscx108\\fscy108)\\t(120,240,\\fscx100\\fscy100)}`;
      lines.push(`Dialogue: 0,${assTimestamp(start)},${assTimestamp(end)},Caption,,0,0,0,,${tag}${escapeAssText(chunks[index])}`);
    }
  }
  return `${header.concat(lines).join("\n")}\n`;
}

function stockH264Args({ preset = "veryfast", crf = "21" } = {}) {
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

function ffmpegConcatPath(filePath) {
  return filePath.replaceAll("\\", "/").replaceAll("'", "'\\''");
}

function ffmpegFilterPath(fileName) {
  return String(fileName || "").replace(/\\/g, "/").replace(/:/g, "\\:");
}

async function downloadAsset(url, tempDir, fileName) {
  const parsed = new URL(url);
  if (!STOCK_VIDEO_HOSTS.has(parsed.hostname) && !parsed.hostname.endsWith("wikimedia.org") && !parsed.hostname.endsWith("wikimedia.commons")) {
    throw new Error(`Blocked unapproved media host: ${parsed.hostname}`);
  }
  const response = await fetch(url, { headers: { "User-Agent": "WorldCupChaosDesk/1.0" } });
  if (!response.ok) {
    throw new Error(`Media download failed with HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const filePath = path.join(tempDir, fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function renderFallbackCard(ffmpegPath, tempDir, segment, index) {
  const textPath = path.join(tempDir, `card-${String(index + 1).padStart(3, "0")}.txt`);
  const title = segment.fallbackVisual?.headline || "World Cup Chaos Desk";
  const subline = segment.fallbackVisual?.subline || segment.captionText || "";
  await fs.writeFile(textPath, `${title}\n\n${subline}`, "utf8");
  const out = path.join(tempDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
  const colors = ["0b1220", "111827", "052e2b", "1f2937"];
  const color = colors[index % colors.length];
  const draw = [
    `drawbox=x=0:y=0:w=iw:h=ih:color=0x${color}:t=fill`,
    "drawbox=x=70:y=110:w=940:h=1700:color=black@0.18:t=fill",
    "drawbox=x=90:y=130:w=900:h=1660:color=white@0.08:t=4",
    `drawtext=textfile='${ffmpegFilterPath(path.basename(textPath))}':fontcolor=white:fontsize=58:line_spacing=18:x=(w-text_w)/2:y=(h-text_h)/2`,
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

async function renderImageSegment(ffmpegPath, tempDir, imageUrl, segment, index) {
  const imagePath = await downloadAsset(imageUrl, tempDir, `image-${String(index + 1).padStart(3, "0")}${path.extname(new URL(imageUrl).pathname) || ".jpg"}`);
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

async function renderClipSegment(ffmpegPath, tempDir, clipUrl, segment, index) {
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
    const segmentPaths = [];
    const visualSegments = Array.isArray(run.visualPlan?.segments) ? run.visualPlan.segments : [];
    for (const [index, segment] of visualSegments.entries()) {
      try {
        let segmentPath = "";
        if (segment.selectedImage?.url) {
          segmentPath = await renderImageSegment(ffmpegPath, tempDir, segment.selectedImage.url, segment, index);
        } else if (segment.selectedClip?.url) {
          segmentPath = await renderClipSegment(ffmpegPath, tempDir, segment.selectedClip.url, segment, index);
        } else {
          segmentPath = await renderFallbackCard(ffmpegPath, tempDir, segment, index);
        }
        segmentPaths.push(segmentPath);
        renderLog.segments.push({ number: segment.number, source: segment.selectedImage ? "wikimedia-image" : segment.selectedClip ? segment.selectedClip.provider : "fallback-card" });
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

    const srtText = await fs.readFile(path.join(runDir, run.files.srt || "srt.srt"), "utf8").catch(() => buildSrt(run.srt?.segments || []));
    const assPath = path.join(tempDir, "captions.ass");
    await fs.writeFile(assPath, buildAssFromSrt(srtText), "utf8");
    const outputPath = path.join(runDir, `${safeFilePart(run.topic)}.mp4`);
    const audioPath = run.files.audio ? path.join(runDir, run.files.audio) : "";
    const totalDuration = Number(run.audio?.durationSeconds || run.srt?.durationSeconds || 45) || 45;
    const includeAudio = Boolean(audioPath && (await fileExists(audioPath)));
    const subtitleFilter = normalizeBool(options.burnSubtitles, true) ? ["-vf", "subtitles=captions.ass"] : [];

    if (includeAudio) {
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
          ...stockH264Args(),
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-shortest",
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
          "-shortest",
          outputPath,
        ],
        { cwd: tempDir, timeout: 300000, maxBuffer: 20_000_000 },
      );
    }

    renderLog.completedAt = nowIso();
    renderLog.durationSeconds = totalDuration;
    renderLog.width = VIDEO_WIDTH;
    renderLog.height = VIDEO_HEIGHT;
    renderLog.fps = VIDEO_FPS;
    run.status = "rendered";
    run.files.mp4 = path.basename(outputPath);
    run.files.renderLog = await writeRunFile(run, "render-log.json", `${JSON.stringify(renderLog, null, 2)}\n`, "utf8");
    run.warnings = [...(run.warnings || []), ...renderLog.warnings];
    return await saveRun(run);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key, data, encoding) {
  return createHmac("sha256", key).update(data).digest(encoding);
}

function amzDates(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function encodeS3Path(key) {
  return String(key || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function uploadR2Object({ key, body, contentType }) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKey || !secretKey || !bucket) {
    throw new WorldCupError("Missing Cloudflare R2 environment variables.", { status: 400, code: "MISSING_R2_CONFIG" });
  }
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}/${encodeS3Path(key)}`;
  const url = `https://${host}${canonicalUri}`;
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ""));
  const payloadHash = sha256Hex(payload);
  const { amzDate, dateStamp } = amzDates();
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), "auto"), "s3"), "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body: payload,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new WorldCupError(`R2 upload failed for ${key}: HTTP ${response.status}`, {
      status: 502,
      code: "R2_UPLOAD_FAILED",
      details: text.slice(0, 1200),
    });
  }
  return { key, size: payload.length };
}

function publicR2Url(key) {
  const base = String(process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  return base ? `${base}/${encodeS3Path(key)}` : "";
}

function r2BasePrefix(run) {
  const date = cleanText(run.match?.date || run.createdAt?.slice(0, 10) || todayDate());
  const matchSlug =
    run.match?.teamA && run.match?.teamB
      ? `${slugify(run.match.teamA)}-vs-${slugify(run.match.teamB)}`
      : slugify(run.topic, "world-cup-topic");
  return `worldcup/${date}/${matchSlug}`;
}

function googleDriveFolderUrl(folderId) {
  return folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : "";
}

function base64Url(data) {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseGoogleServiceAccount() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "";
  const rawBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64 || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64 || "";
  if (rawJson.trim()) {
    return JSON.parse(rawJson);
  }
  if (rawBase64.trim()) {
    return JSON.parse(Buffer.from(rawBase64.trim(), "base64").toString("utf8"));
  }
  return null;
}

function hasGoogleDriveCredentials() {
  try {
    const credentials = parseGoogleServiceAccount();
    return Boolean(credentials?.client_email && credentials?.private_key);
  } catch {
    return false;
  }
}

let cachedGoogleDriveToken = null;

async function getGoogleDriveAccessToken() {
  const credentials = parseGoogleServiceAccount();
  if (!credentials?.client_email || !credentials?.private_key) {
    throw new WorldCupError("Missing Google Drive service account JSON credentials.", {
      status: 400,
      code: "MISSING_GOOGLE_DRIVE_CREDENTIALS",
    });
  }
  if (cachedGoogleDriveToken && cachedGoogleDriveToken.expiresAt > Date.now() + 60000) {
    return cachedGoogleDriveToken.accessToken;
  }

  const tokenUri = credentials.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(String(credentials.private_key).replace(/\\n/g, "\n"));
  const assertion = `${header}.${payload}.${base64Url(signature)}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new WorldCupError(`Google Drive token request failed with HTTP ${response.status}.`, {
      status: 502,
      code: "GOOGLE_DRIVE_TOKEN_FAILED",
      details: data,
    });
  }
  cachedGoogleDriveToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000,
  };
  return cachedGoogleDriveToken.accessToken;
}

function driveQueryValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function driveRequest(pathname, { method = "GET", query = {}, headers = {}, body = null, contentType = "application/json" } = {}) {
  const token = await getGoogleDriveAccessToken();
  const url = new URL(pathname.startsWith("http") ? pathname : `https://www.googleapis.com${pathname}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...headers,
    },
    body,
  });
  const text = await response.text().catch(() => "");
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new WorldCupError(`Google Drive request failed with HTTP ${response.status}.`, {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      code: "GOOGLE_DRIVE_REQUEST_FAILED",
      details: data || text,
    });
  }
  return data;
}

async function getOrCreateDriveFolder(name, parentId) {
  const safeName = cleanText(name).slice(0, 120) || "folder";
  const parentClause = parentId ? ` and '${driveQueryValue(parentId)}' in parents` : "";
  const query = `name = '${driveQueryValue(safeName)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentClause}`;
  const existing = await driveRequest("/drive/v3/files", {
    query: {
      q: query,
      fields: "files(id,name,webViewLink)",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    },
  });
  if (existing.files?.[0]?.id) {
    return existing.files[0];
  }
  return await driveRequest("/drive/v3/files", {
    method: "POST",
    query: {
      fields: "id,name,webViewLink",
      supportsAllDrives: "true",
    },
    body: JSON.stringify({
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
}

async function uploadGoogleDriveFile({ folderId, name, body, contentType }) {
  const token = await getGoogleDriveAccessToken();
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ""));
  const metadata = {
    name,
    parents: folderId ? [folderId] : undefined,
  };
  const startUrl = new URL("https://www.googleapis.com/upload/drive/v3/files");
  startUrl.searchParams.set("uploadType", "resumable");
  startUrl.searchParams.set("fields", "id,name,mimeType,size,webViewLink,webContentLink");
  startUrl.searchParams.set("supportsAllDrives", "true");
  const startResponse = await fetch(startUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Upload-Content-Type": contentType,
      "X-Upload-Content-Length": String(payload.length),
    },
    body: JSON.stringify(metadata),
  });
  if (!startResponse.ok) {
    const data = await startResponse.json().catch(() => ({}));
    throw new WorldCupError(`Google Drive upload session failed for ${name}: HTTP ${startResponse.status}.`, {
      status: 502,
      code: "GOOGLE_DRIVE_UPLOAD_SESSION_FAILED",
      details: data,
    });
  }
  const uploadUrl = startResponse.headers.get("location");
  if (!uploadUrl) {
    throw new WorldCupError("Google Drive did not return a resumable upload URL.", {
      status: 502,
      code: "GOOGLE_DRIVE_UPLOAD_URL_MISSING",
    });
  }
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(payload.length),
    },
    body: payload,
  });
  const data = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok) {
    throw new WorldCupError(`Google Drive upload failed for ${name}: HTTP ${uploadResponse.status}.`, {
      status: 502,
      code: "GOOGLE_DRIVE_UPLOAD_FAILED",
      details: data,
    });
  }
  if (process.env.GOOGLE_DRIVE_MAKE_PUBLIC === "true") {
    await driveRequest(`/drive/v3/files/${encodeURIComponent(data.id)}/permissions`, {
      method: "POST",
      query: { supportsAllDrives: "true" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }).catch(() => {});
  }
  return {
    id: data.id,
    name: data.name || name,
    size: Number(data.size || payload.length),
    mimeType: data.mimeType || contentType,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    webContentLink: data.webContentLink || "",
  };
}

function driveBaseParts(run) {
  const date = cleanText(run.match?.date || run.createdAt?.slice(0, 10) || todayDate());
  const matchSlug =
    run.match?.teamA && run.match?.teamB
      ? `${slugify(run.match.teamA)}-vs-${slugify(run.match.teamB)}`
      : slugify(run.topic, "world-cup-topic");
  return { date, matchSlug };
}

async function uploadWorldCupRunToR2(id) {
  const run = await readWorldCupRun(id);
  const runDir = path.join(runsRoot, run.id);
  const prefix = r2BasePrefix(run);
  const uploaded = [];
  const sidecars = [
    ["script.json", run.files.script, "application/json; charset=utf-8"],
    ["evidence.json", run.files.evidence, "application/json; charset=utf-8"],
    ["srt.srt", run.files.srt, "application/x-subrip; charset=utf-8"],
    ["visuals.json", run.files.visuals, "application/json; charset=utf-8"],
    ["attribution.json", run.files.attribution, "application/json; charset=utf-8"],
    ["rights.json", run.files.rights, "application/json; charset=utf-8"],
    ["render-log.json", run.files.renderLog, "application/json; charset=utf-8"],
  ];
  if (run.files.mp4) {
    const mp4Key = `${prefix}/${run.type === "postmatch" ? "postmatch" : run.type}.mp4`;
    uploaded.push(
      await uploadR2Object({
        key: mp4Key,
        body: await fs.readFile(path.join(runDir, run.files.mp4)),
        contentType: "video/mp4",
      }),
    );
    run.r2.mp4Key = mp4Key;
    run.r2.publicUrl = publicR2Url(mp4Key);
  }
  for (const [targetName, fileName, contentType] of sidecars) {
    if (!fileName) {
      continue;
    }
    const localPath = path.join(runDir, fileName);
    if (!(await fileExists(localPath))) {
      continue;
    }
    uploaded.push(
      await uploadR2Object({
        key: `${prefix}/${targetName}`,
        body: await fs.readFile(localPath),
        contentType,
      }),
    );
  }
  run.r2.keyPrefix = prefix;
  run.r2.uploadedAt = nowIso();
  run.r2.uploaded = uploaded;
  run.status = run.files.mp4 ? "uploaded" : "sidecars_uploaded";
  uploaded.push(
    await uploadR2Object({
      key: `${prefix}/run.json`,
      body: `${JSON.stringify(run, null, 2)}\n`,
      contentType: "application/json; charset=utf-8",
    }),
  );
  const saved = await saveRun(run);
  const index = await listWorldCupRuns();
  await uploadR2Object({
    key: "worldcup/index.json",
    body: `${JSON.stringify(index, null, 2)}\n`,
    contentType: "application/json; charset=utf-8",
  });
  return saved;
}

async function uploadWorldCupRunToDrive(id) {
  const run = await readWorldCupRun(id);
  const rootFolderId = cleanText(process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.WORLD_CUP_GOOGLE_DRIVE_FOLDER_ID || "");
  if (!rootFolderId) {
    throw new WorldCupError("Missing GOOGLE_DRIVE_FOLDER_ID for World Cup Google Drive uploads.", {
      status: 400,
      code: "MISSING_GOOGLE_DRIVE_FOLDER_ID",
    });
  }

  const runDir = path.join(runsRoot, run.id);
  const { date, matchSlug } = driveBaseParts(run);
  const worldcupFolder = await getOrCreateDriveFolder("worldcup", rootFolderId);
  const dateFolder = await getOrCreateDriveFolder(date, worldcupFolder.id);
  const matchFolder = await getOrCreateDriveFolder(matchSlug, dateFolder.id);
  const uploaded = [];
  const sidecars = [
    ["script.json", run.files.script, "application/json; charset=utf-8"],
    ["evidence.json", run.files.evidence, "application/json; charset=utf-8"],
    ["srt.srt", run.files.srt, "application/x-subrip; charset=utf-8"],
    ["visuals.json", run.files.visuals, "application/json; charset=utf-8"],
    ["attribution.json", run.files.attribution, "application/json; charset=utf-8"],
    ["rights.json", run.files.rights, "application/json; charset=utf-8"],
    ["render-log.json", run.files.renderLog, "application/json; charset=utf-8"],
  ];

  if (run.files.mp4) {
    const mp4Name = `${run.type === "postmatch" ? "postmatch" : run.type}.mp4`;
    uploaded.push(
      await uploadGoogleDriveFile({
        folderId: matchFolder.id,
        name: mp4Name,
        body: await fs.readFile(path.join(runDir, run.files.mp4)),
        contentType: "video/mp4",
      }),
    );
  }
  if (run.files.audio) {
    uploaded.push(
      await uploadGoogleDriveFile({
        folderId: matchFolder.id,
        name: "audio.wav",
        body: await fs.readFile(path.join(runDir, run.files.audio)),
        contentType: "audio/wav",
      }),
    );
  }
  for (const [targetName, fileName, contentType] of sidecars) {
    if (!fileName) {
      continue;
    }
    const localPath = path.join(runDir, fileName);
    if (!(await fileExists(localPath))) {
      continue;
    }
    uploaded.push(
      await uploadGoogleDriveFile({
        folderId: matchFolder.id,
        name: targetName,
        body: await fs.readFile(localPath),
        contentType,
      }),
    );
  }

  run.drive = {
    folderId: matchFolder.id,
    folderUrl: matchFolder.webViewLink || googleDriveFolderUrl(matchFolder.id),
    rootFolderId,
    uploadedAt: nowIso(),
    uploaded,
  };
  run.status = run.files.mp4 ? "uploaded_drive" : "sidecars_uploaded_drive";
  uploaded.push(
    await uploadGoogleDriveFile({
      folderId: matchFolder.id,
      name: "run.json",
      body: `${JSON.stringify(run, null, 2)}\n`,
      contentType: "application/json; charset=utf-8",
    }),
  );
  const saved = await saveRun(run);
  const index = await listWorldCupRuns();
  await uploadGoogleDriveFile({
    folderId: worldcupFolder.id,
    name: "index.json",
    body: `${JSON.stringify(index, null, 2)}\n`,
    contentType: "application/json; charset=utf-8",
  });
  return saved;
}

export async function uploadWorldCupRun(id, options = {}) {
  const destination = String(options.destination || options.uploadTarget || DEFAULT_UPLOAD_TARGET || "google-drive").toLowerCase();
  if (destination === "r2" || destination === "cloudflare-r2") {
    return await uploadWorldCupRunToR2(id);
  }
  if (destination === "auto") {
    if (hasGoogleDriveCredentials() && (process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.WORLD_CUP_GOOGLE_DRIVE_FOLDER_ID)) {
      return await uploadWorldCupRunToDrive(id);
    }
    return await uploadWorldCupRunToR2(id);
  }
  if (destination === "google-drive" || destination === "drive" || destination === "gdrive") {
    return await uploadWorldCupRunToDrive(id);
  }
  throw new WorldCupError(`Unsupported World Cup upload target: ${destination}`, {
    status: 400,
    code: "UNSUPPORTED_UPLOAD_TARGET",
  });
}

export async function resolveWorldCupAsset(id, fileKey = "mp4") {
  const run = await readWorldCupRun(id);
  const map = {
    mp4: run.files.mp4,
    video: run.files.mp4,
    srt: run.files.srt,
    captions: run.files.captions,
    script: run.files.script,
    evidence: run.files.evidence,
    visuals: run.files.visuals,
    attribution: run.files.attribution,
    rights: run.files.rights,
    renderLog: run.files.renderLog,
    audio: run.files.audio,
  };
  const fileName = map[fileKey] || map[String(fileKey || "").replace(/[^a-zA-Z]/g, "")];
  if (!fileName) {
    throw new WorldCupError("Requested World Cup asset does not exist for this run.", { status: 404, code: "WORLD_CUP_ASSET_NOT_FOUND" });
  }
  const runDir = path.resolve(runsRoot, run.id);
  const filePath = path.resolve(runDir, fileName);
  if (!filePath.startsWith(runDir)) {
    throw new WorldCupError("Blocked unsafe World Cup asset path.", { status: 403, code: "UNSAFE_ASSET_PATH" });
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".mp4"
      ? "video/mp4"
      : ext === ".srt"
        ? "application/x-subrip; charset=utf-8"
        : ext === ".wav"
          ? "audio/wav"
          : "application/json; charset=utf-8";
  return { path: filePath, mime, filename: path.basename(filePath), run };
}

function preTournamentTopics() {
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

async function countRunsForDate(date) {
  const index = await listWorldCupRuns();
  return (index.runs || []).filter((run) => run.createdAt?.slice(0, 10) === date).length;
}

function scheduledHours() {
  return String(DEFAULT_SCHEDULE_HOURS)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);
}

export async function runWorldCupScheduler(input = {}) {
  const date = cleanText(input.date || todayDate()).slice(0, 10);
  const existing = await countRunsForDate(date);
  const max = Math.max(1, Number(input.limit || MAX_VIDEOS_PER_DAY) || MAX_VIDEOS_PER_DAY);
  const explicit = input.topic || input.teamA || input.teamB || input.matchId;
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
  const topic = explicit ? input.topic : preTournamentTopics()[existing % preTournamentTopics().length];
  const run = await generateWorldCupRun({
    ...input,
    date,
    topic,
    type: input.type || input.mode || (input.teamA && input.teamB ? "prediction" : "pre-tournament"),
    render: normalizeBool(input.render, true),
    upload: normalizeBool(input.upload, false),
  });
  return { skipped: false, run: runSummary(run), maxVideosPerDay: max };
}
