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
const bgmRoot = path.join(worldCupRoot, "bgm");
const assetPackRoot = path.join(worldCupRoot, "asset-packs");
const indexPath = path.join(worldCupRoot, "index.json");
const portableFfmpegPath = "C:\\tmp\\ffmpeg-portable\\bin\\ffmpeg.exe";
const execFileAsync = promisify(execFile);

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const VIDEO_FPS = 30;
const MAX_SAVED_KEYS = 4;
const DEFAULT_LANGUAGE = process.env.WORLD_CUP_DEFAULT_LANGUAGE || "en";
const DEFAULT_WORLD_CUP_STRATEGY = normalizeWorldCupStrategy(process.env.WORLD_CUP_STRATEGY || "classic");
const LITE_TEXT_MODEL = process.env.WORLD_CUP_LITE_TEXT_MODEL || "gemini-3.1-flash-lite";
const SEARCH_MODEL = process.env.WORLD_CUP_SEARCH_MODEL || process.env.WORLD_CUP_RESEARCH_MODEL || "gemini-2.5-flash-lite";
const SEARCH_FALLBACK_MODELS = String(process.env.WORLD_CUP_SEARCH_FALLBACK_MODELS || "gemini-2.5-flash,gemini-3.1-flash-lite")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const WRITER_MODEL = process.env.WORLD_CUP_WRITER_MODEL || LITE_TEXT_MODEL;
const EVALUATOR_MODEL = process.env.WORLD_CUP_EVALUATOR_MODEL || LITE_TEXT_MODEL;
const TTS_REWRITE_MODEL = process.env.WORLD_CUP_TTS_REWRITE_MODEL || WRITER_MODEL;
const TTS_MODEL = process.env.WORLD_CUP_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const AUDIO_SRT_MODEL = process.env.WORLD_CUP_AUDIO_SRT_MODEL || LITE_TEXT_MODEL;
const AUDIO_SRT_FALLBACK_MODELS = String(process.env.WORLD_CUP_AUDIO_SRT_FALLBACK_MODELS || "gemini-2.5-flash")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const VISUAL_REVIEW_MODEL = process.env.WORLD_CUP_VISUAL_REVIEW_MODEL || "gemma-4-26b-a4b-it";
const VISUAL_SELECTION_MODEL = process.env.WORLD_CUP_VISUAL_SELECTION_MODEL || "gemini-2.5-flash-lite";
const VISUAL_SELECTION_FALLBACK_MODELS = String(process.env.WORLD_CUP_VISUAL_SELECTION_FALLBACK_MODELS || "gemini-3.1-flash-lite,gemini-2.5-flash")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const VISUAL_SCOUT_PAGES = Math.max(1, Math.min(3, Number(process.env.WORLD_CUP_VISUAL_SCOUT_PAGES || 1) || 1));
const VISUAL_REVIEW_MAX_ITEMS = Math.max(6, Math.min(40, Number(process.env.WORLD_CUP_VISUAL_REVIEW_MAX_ITEMS || 24) || 24));
const WORLD_CUP_VOICE_VOLUME = Math.min(2.2, Math.max(1, Number(process.env.WORLD_CUP_VOICE_VOLUME || 1.35) || 1.35));
const WORLD_CUP_CAPTION_DESIGN_MODEL = process.env.WORLD_CUP_CAPTION_DESIGN_MODEL || VISUAL_REVIEW_MODEL;
const WORLD_CUP_ASSET_SEARCH_MODEL = process.env.WORLD_CUP_ASSET_SEARCH_MODEL || "gemini-2.5-pro";
const WORLD_CUP_ASSET_SEARCH_FALLBACK_MODELS = String(process.env.WORLD_CUP_ASSET_SEARCH_FALLBACK_MODELS || `${SEARCH_MODEL},gemini-2.5-flash-lite,gemini-2.5-flash`)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const WORLD_CUP_CAPTION_MIDSCREEN = cleanText(process.env.WORLD_CUP_CAPTION_MIDSCREEN || "auto").toLowerCase();
const WORLD_CUP_VISUAL_RETRY_ATTEMPTS = Math.max(0, Math.min(4, Number(process.env.WORLD_CUP_VISUAL_RETRY_ATTEMPTS || 2) || 2));
const GEMINI_REQUEST_TIMEOUT_MS = Math.max(30000, Number(process.env.WORLD_CUP_GEMINI_REQUEST_TIMEOUT_MS || 120000) || 120000);
const MEDIA_REQUEST_TIMEOUT_MS = Math.max(5000, Number(process.env.WORLD_CUP_MEDIA_REQUEST_TIMEOUT_MS || 20000) || 20000);
const VISUAL_SCOUT_TIMEOUT_MS = Math.max(30000, Number(process.env.WORLD_CUP_VISUAL_SCOUT_TIMEOUT_MS || 180000) || 180000);
const VISUAL_PREVIEW_TIMEOUT_MS = Math.max(3000, Number(process.env.WORLD_CUP_VISUAL_PREVIEW_TIMEOUT_MS || 8000) || 8000);
const WORLD_CUP_MIN_REAL_VISUAL_RATIO = Math.max(0, Math.min(1, Number(process.env.WORLD_CUP_MIN_REAL_VISUAL_RATIO || 0.75) || 0.75));
const WORLD_CUP_MIN_CLIP_RATIO = Math.max(0, Math.min(1, Number(process.env.WORLD_CUP_MIN_CLIP_RATIO || 0.55) || 0.55));
const WORLD_CUP_MAX_IMAGE_SEGMENTS = Math.max(0, Math.min(4, Number(process.env.WORLD_CUP_MAX_IMAGE_SEGMENTS || 2) || 2));
const WORLD_CUP_LOCAL_PROOF_MAX_PER_VIDEO = Math.max(0, Math.min(2, Number(process.env.WORLD_CUP_LOCAL_PROOF_MAX_PER_VIDEO || 1) || 1));
const MAX_VIDEOS_PER_DAY = Number(process.env.WORLD_CUP_MAX_VIDEOS_PER_DAY || 3);
const DEFAULT_SCHEDULE_HOURS = process.env.WORLD_CUP_SCHEDULE_HOURS || "9,15,21";
const DEFAULT_UPLOAD_TARGET = process.env.WORLD_CUP_UPLOAD_TARGET || "google-drive";
const WORLD_CUP_RESEARCH_PASSES = Math.max(1, Math.min(5, Number(process.env.WORLD_CUP_RESEARCH_PASSES || 4) || 4));
const WORLD_CUP_ENABLE_BGM = normalizeBool(process.env.WORLD_CUP_ENABLE_BGM, true);
const WORLD_CUP_BGM_MODE = cleanText(process.env.WORLD_CUP_BGM_MODE || "auto").toLowerCase();
const WORLD_CUP_BGM_PRESET = normalizeWorldCupBgmPreset(process.env.WORLD_CUP_BGM_PRESET || "auto");
const WORLD_CUP_BGM_FILE = process.env.WORLD_CUP_BGM_FILE || "";
const WORLD_CUP_BGM_VOLUME = Math.min(0.35, Math.max(0.02, Number(process.env.WORLD_CUP_BGM_VOLUME || 0.18) || 0.18));
const WORLD_CUP_CAPTION_PRESET = normalizeWorldCupCaptionPreset(process.env.WORLD_CUP_CAPTION_PRESET || "creator-yellow-pop");
const GEMINI_RETRY_DELAYS_MS = String(process.env.WORLD_CUP_GEMINI_RETRY_DELAYS || "5000,10000,15000")
  .split(",")
  .map((delay) => Number(delay.trim()))
  .filter((delay) => Number.isFinite(delay) && delay > 0);
const STOCK_VIDEO_HOSTS = new Set([
  "player.vimeo.com",
  "vod-progressive.akamaized.net",
  "videos.pexels.com",
  "static-videos.pexels.com",
  "images.pexels.com",
  "i.vimeocdn.com",
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

const MAJOR_WORLD_CUP_ASSET_TARGETS = [
  { team: "USA", aliases: ["USMNT", "United States men's national soccer team"], players: ["Christian Pulisic", "Weston McKennie", "Tyler Adams", "Gio Reyna", "Sergino Dest", "Timothy Weah"] },
  { team: "Brazil", aliases: ["Selecao", "Brazil national football team"], players: ["Vinicius Junior", "Rodrygo", "Neymar", "Alisson Becker", "Marquinhos", "Bruno Guimaraes"] },
  { team: "Argentina", aliases: ["La Albiceleste", "Argentina national football team"], players: ["Lionel Messi", "Lautaro Martinez", "Julian Alvarez", "Emiliano Martinez", "Enzo Fernandez", "Alexis Mac Allister"] },
  { team: "France", aliases: ["Les Bleus", "France national football team"], players: ["Kylian Mbappe", "Antoine Griezmann", "Aurelien Tchouameni", "Mike Maignan", "William Saliba", "Ousmane Dembele"] },
  { team: "England", aliases: ["Three Lions", "England national football team"], players: ["Harry Kane", "Jude Bellingham", "Bukayo Saka", "Phil Foden", "Declan Rice", "Cole Palmer"] },
  { team: "Spain", aliases: ["La Roja", "Spain national football team"], players: ["Lamine Yamal", "Pedri", "Nico Williams", "Rodri", "Dani Olmo", "Unai Simon"] },
  { team: "Germany", aliases: ["Die Mannschaft", "Germany national football team"], players: ["Jamal Musiala", "Florian Wirtz", "Kai Havertz", "Joshua Kimmich", "Antonio Rudiger", "Marc-Andre ter Stegen"] },
  { team: "Portugal", aliases: ["Portugal national football team"], players: ["Cristiano Ronaldo", "Bruno Fernandes", "Bernardo Silva", "Joao Felix", "Rafael Leao", "Diogo Costa"] },
  { team: "Mexico", aliases: ["El Tri", "Mexico national football team"], players: ["Santiago Gimenez", "Edson Alvarez", "Hirving Lozano", "Guillermo Ochoa", "Luis Chavez", "Cesar Montes"] },
  { team: "Canada", aliases: ["Canada men's national soccer team"], players: ["Alphonso Davies", "Jonathan David", "Tajon Buchanan", "Stephen Eustaquio", "Cyle Larin", "Ismael Kone"] },
  { team: "Uruguay", aliases: ["La Celeste", "Uruguay national football team"], players: ["Federico Valverde", "Darwin Nunez", "Ronald Araujo", "Manuel Ugarte", "Luis Suarez", "Jose Maria Gimenez"] },
  { team: "Colombia", aliases: ["Los Cafeteros", "Colombia national football team"], players: ["Luis Diaz", "James Rodriguez", "Jhon Duran", "Davinson Sanchez", "Jefferson Lerma", "Rafael Santos Borre"] },
  { team: "Netherlands", aliases: ["Oranje", "Netherlands national football team"], players: ["Virgil van Dijk", "Frenkie de Jong", "Cody Gakpo", "Xavi Simons", "Memphis Depay", "Denzel Dumfries"] },
  { team: "Italy", aliases: ["Azzurri", "Italy national football team"], players: ["Federico Chiesa", "Gianluigi Donnarumma", "Nicolo Barella", "Alessandro Bastoni", "Lorenzo Pellegrini", "Giacomo Raspadori"] },
  { team: "Belgium", aliases: ["Red Devils", "Belgium national football team"], players: ["Kevin De Bruyne", "Romelu Lukaku", "Jeremy Doku", "Youri Tielemans", "Thibaut Courtois", "Amadou Onana"] },
  { team: "Japan", aliases: ["Samurai Blue", "Japan national football team"], players: ["Takefusa Kubo", "Kaoru Mitoma", "Wataru Endo", "Daichi Kamada", "Ritsu Doan", "Takumi Minamino"] },
  { team: "Morocco", aliases: ["Atlas Lions", "Morocco national football team"], players: ["Achraf Hakimi", "Hakim Ziyech", "Sofyan Amrabat", "Yassine Bounou", "Noussair Mazraoui", "Youssef En-Nesyri"] },
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
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€“|â€”/g, "-")
    .replace(/Â/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function repairCommonMojibake(value) {
  return String(value || "")
    .replace(/soufflÃ©/gi, "souffle")
    .replace(/Ã©/g, "e")
    .replace(/Ã¨/g, "e")
    .replace(/Ã¡/g, "a")
    .replace(/Ã­/g, "i")
    .replace(/Ã³/g, "o")
    .replace(/Ãº/g, "u")
    .replace(/Ã±/g, "n")
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€“|â€”/g, "-")
    .replace(/Â/g, "");
}

function slugify(value, fallback = "world-cup-short") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/^-+|-+$/g, "");
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

function normalizeWorldCupStrategy(value) {
  const strategy = cleanText(value || "classic").toLowerCase();
  if (["viral", "viral2", "viral-2", "viral_2", "shorts2", "shorts-2"].includes(strategy)) {
    return "viral2";
  }
  return "classic";
}

function normalizeWorldCupCaptionPreset(value) {
  const preset = cleanText(value || "creator-yellow-pop").toLowerCase();
  if (["creator-yellow-pop", "creator-yellow", "yellow-pop", "default"].includes(preset)) {
    return "creator-yellow-pop";
  }
  if (["chaos-debate", "debate-pop", "debate"].includes(preset)) {
    return "chaos-debate";
  }
  if (["hype-punch", "hype", "impact"].includes(preset)) {
    return "hype-punch";
  }
  if (["dark-documentary", "documentary", "cinematic-clean"].includes(preset)) {
    return "dark-documentary";
  }
  return "creator-yellow-pop";
}

function normalizeWorldCupBgmPreset(value) {
  const preset = cleanText(value || "auto").toLowerCase();
  if (["off", "none"].includes(preset)) {
    return "off";
  }
  if (["funny", "debate", "dramatic", "emotional", "analysis", "hype", "auto"].includes(preset)) {
    return preset;
  }
  return "auto";
}

function isViral2(optionsOrRun = {}) {
  return normalizeWorldCupStrategy(optionsOrRun.strategy || optionsOrRun.contentStrategy || "classic") === "viral2";
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
  await fs.mkdir(bgmRoot, { recursive: true });
  await fs.mkdir(assetPackRoot, { recursive: true });
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
  const balancedCandidates = [];
  for (const open of ["{", "["]) {
    const close = open === "{" ? "}" : "]";
    for (let start = raw.indexOf(open); start !== -1; start = raw.indexOf(open, start + 1)) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let index = start; index < raw.length; index += 1) {
        const char = raw[index];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (inString) {
          continue;
        }
        if (char === open) {
          depth += 1;
        } else if (char === close) {
          depth -= 1;
          if (depth === 0) {
            balancedCandidates.push(raw.slice(start, index + 1));
            break;
          }
        }
      }
    }
  }
  for (const candidate of balancedCandidates.reverse()) {
    try {
      return JSON.parse(candidate);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, ms, label) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = MEDIA_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

let activeWorldCupApiUsage = null;

function createApiUsageLedger() {
  return {
    startedAt: nowIso(),
    completedAt: "",
    totals: {
      gemini: 0,
      stock: 0,
      wikimedia: 0,
      openverse: 0,
      other: 0,
      failed: 0,
    },
    models: {},
    providers: {},
    calls: [],
  };
}

function recordApiUsage({ provider = "other", model = "", operation = "", status = "success", count = 1, details = null } = {}) {
  if (!activeWorldCupApiUsage) {
    return;
  }
  const safeProvider = cleanText(provider || "other").toLowerCase() || "other";
  const safeModel = cleanText(model || "");
  const safeStatus = cleanText(status || "success").toLowerCase() || "success";
  const safeCount = Math.max(1, Number(count || 1) || 1);
  activeWorldCupApiUsage.totals[safeProvider] = Number(activeWorldCupApiUsage.totals[safeProvider] || 0) + safeCount;
  if (safeStatus !== "success") {
    activeWorldCupApiUsage.totals.failed = Number(activeWorldCupApiUsage.totals.failed || 0) + safeCount;
  }
  if (safeModel) {
    const modelRow = activeWorldCupApiUsage.models[safeModel] || { attempts: 0, success: 0, failed: 0, operations: {} };
    modelRow.attempts += safeCount;
    modelRow[safeStatus === "success" ? "success" : "failed"] += safeCount;
    const op = cleanText(operation || "generateContent") || "generateContent";
    modelRow.operations[op] = Number(modelRow.operations[op] || 0) + safeCount;
    activeWorldCupApiUsage.models[safeModel] = modelRow;
  }
  const providerRow = activeWorldCupApiUsage.providers[safeProvider] || { attempts: 0, success: 0, failed: 0, operations: {} };
  providerRow.attempts += safeCount;
  providerRow[safeStatus === "success" ? "success" : "failed"] += safeCount;
  const op = cleanText(operation || "request") || "request";
  providerRow.operations[op] = Number(providerRow.operations[op] || 0) + safeCount;
  activeWorldCupApiUsage.providers[safeProvider] = providerRow;
  activeWorldCupApiUsage.calls.push({
    at: nowIso(),
    provider: safeProvider,
    model: safeModel || undefined,
    operation: op,
    status: safeStatus,
    details: details || undefined,
  });
  activeWorldCupApiUsage.calls = activeWorldCupApiUsage.calls.slice(-300);
}

function isHardGeminiQuotaError(error) {
  const text = `${error?.message || ""} ${JSON.stringify(error?.details || {})}`.toLowerCase();
  return /limit:\s*0/.test(text) || /free_tier.*limit:\s*0/.test(text);
}

function isRetryableGeminiError(error) {
  if (!error) {
    return false;
  }
  if (isHardGeminiQuotaError(error)) {
    return false;
  }
  const text = `${error.message || ""} ${JSON.stringify(error.details || {})}`.toLowerCase();
  return (
    error.code === "NETWORK_OR_SERVER_UNREACHABLE" ||
    error.code === "GEMINI_SERVER_ERROR" ||
    error.code === "QUOTA_OR_RATE_LIMIT" ||
    /high demand|overloaded|temporar|please retry|rate limit|unavailable|deadline|timeout/.test(text)
  );
}

async function requestGeminiGenerateContent({ keyInfo, model, body }) {
  if (!keyInfo?.apiKey) {
    throw new WorldCupError("Missing Gemini API key for World Cup generation.", {
      status: 400,
      code: "MISSING_GEMINI_KEY",
      provider: "gemini",
      model,
    });
  }

  let lastError = null;
  for (let attempt = 0; attempt <= GEMINI_RETRY_DELAYS_MS.length; attempt += 1) {
    let response;
    try {
      const modelName = String(model || "").replace(/^models\//, "");
      response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": keyInfo.apiKey,
          },
          body: JSON.stringify(body),
        },
        GEMINI_REQUEST_TIMEOUT_MS,
      );
    } catch (error) {
      lastError = new WorldCupError(`Gemini network request failed: ${error.message}`, {
        status: 502,
        code: "NETWORK_OR_SERVER_UNREACHABLE",
        provider: "gemini",
        model,
      });
      recordApiUsage({
        provider: "gemini",
        model,
        operation: body?.tools ? "generateContent.search" : "generateContent",
        status: "failed",
        details: { code: lastError.code },
      });
      if (attempt < GEMINI_RETRY_DELAYS_MS.length && isRetryableGeminiError(lastError)) {
        await sleep(GEMINI_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw lastError;
    }

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      recordApiUsage({ provider: "gemini", model, operation: body?.tools ? "generateContent.search" : "generateContent", status: "success" });
      return data;
    }
    lastError = classifyGeminiError(data, response.status, model);
    recordApiUsage({
      provider: "gemini",
      model,
      operation: body?.tools ? "generateContent.search" : "generateContent",
      status: "failed",
      details: { status: response.status, code: lastError.code },
    });
    if (attempt < GEMINI_RETRY_DELAYS_MS.length && isRetryableGeminiError(lastError)) {
      await sleep(GEMINI_RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw lastError;
  }
  throw lastError;
}

async function requestGeminiJson({ keyInfo, model, prompt, temperature = 0.6, search = false, parts = null }) {
  const body = {
    contents: [{ parts: parts || [{ text: prompt }] }],
    generationConfig: { temperature },
  };
  if (search) {
    body.tools = [{ google_search: {} }];
  } else {
    body.generationConfig.responseMimeType = "application/json";
  }

  const data = await requestGeminiGenerateContent({ keyInfo, model, body });
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  return {
    json: extractJson(text),
    rawText: text,
    sources: extractGroundingSources(data?.candidates?.[0]?.groundingMetadata),
    groundingMetadata: data?.candidates?.[0]?.groundingMetadata || null,
  };
}

async function requestGeminiText({ keyInfo, model, prompt, temperature = 0.45, search = false }) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature },
  };
  if (search) {
    body.tools = [{ google_search: {} }];
  }

  const data = await requestGeminiGenerateContent({ keyInfo, model, body });
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "";
  return {
    text,
    sources: extractGroundingSources(data?.candidates?.[0]?.groundingMetadata),
    groundingMetadata: data?.candidates?.[0]?.groundingMetadata || null,
  };
}

async function requestGeminiJsonWithFallbacks({ keyInfo, primaryModel, fallbackModels = [], prompt, temperature = 0.6, search = false, parts = null }) {
  const models = [primaryModel, ...fallbackModels].filter(Boolean).filter((model, index, list) => list.indexOf(model) === index);
  const errors = [];
  for (const model of models) {
    try {
      const result = await requestGeminiJson({ keyInfo, model, prompt, temperature, search, parts });
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

async function requestGeminiTextWithFallbacks({ keyInfo, primaryModel, fallbackModels = [], prompt, temperature = 0.45, search = false }) {
  const models = [primaryModel, ...fallbackModels].filter(Boolean).filter((model, index, list) => list.indexOf(model) === index);
  const errors = [];
  for (const model of models) {
    try {
      const result = await requestGeminiText({ keyInfo, model, prompt, temperature, search });
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
  throw new WorldCupError(`All Gemini text attempts failed: ${errors.join(" | ")}`, {
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
Mood: ${mood || "soft, funny, curious football friend with controlled excitement"}
Voice style:
- Natural English football-fan rhythm, like a real creator talking to one friend.
- Soft but alive. Smile in the voice. Do not sound like a news anchor.
- Vary pitch and speed: quick on jokes, slower on reveals, slightly higher pitch on surprise, warmer lower pitch on opinion.
- Use tiny human pauses before punchlines and questions.
- Keep excitement controlled, never shout.

${screenplay}
`.trim();

  const data = await requestGeminiGenerateContent({
    keyInfo,
    model: TTS_MODEL,
    body: {
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
    },
  });
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
      const text = normalizeFootballCaptionText(lines.slice(timeIndex + 1).join(" "));
      if (!text || endTime <= startTime) {
        return null;
      }
      return { number: index + 1, startTime, endTime, durationSeconds: endTime - startTime, text };
    })
    .filter(Boolean);
}

function normalizeFootballCaptionText(text) {
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
  for (const segment of segments) {
    segment.text = normalizeFootballCaptionText(segment.text);
  }
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
    const segments = rawSegments
      .map((segment, index) => {
        const startTime = Math.max(0, Number(segment.startTime ?? segment.start ?? 0) || 0);
        const endTime = Math.max(startTime + 0.5, Number(segment.endTime ?? segment.end ?? startTime + 2) || startTime + 2);
        const text = normalizeFootballCaptionText(segment.text || segment.caption || "");
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
      model: result.model || AUDIO_SRT_MODEL,
    };
  } catch (error) {
    warnings.push(`Audio-aware SRT fell back to script timing: ${error.message}`);
    return estimateSrtFromText(screenplay, durationSeconds);
  }
}

function captionPresetDesignConfig(preset = WORLD_CUP_CAPTION_PRESET) {
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

function localCaptionDesign({ segments, screenplay, options }) {
  const midMode = cleanText(options.captionMidScreen || WORLD_CUP_CAPTION_MIDSCREEN || "auto").toLowerCase();
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

function normalizeCaptionDesign(raw, fallback, options) {
  const midMode = cleanText(options.captionMidScreen || WORLD_CUP_CAPTION_MIDSCREEN || "auto").toLowerCase();
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

async function designWorldCupCaptions({ keyInfo, segments, screenplay, selectedScript, evidence, options, warnings }) {
  const fallback = localCaptionDesign({ segments, screenplay, options });
  if (!options.captionDesign || !keyInfo?.apiKey || options.offline || !segments.length) {
    return fallback;
  }
  const midMode = cleanText(options.captionMidScreen || WORLD_CUP_CAPTION_MIDSCREEN || "auto").toLowerCase();
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

function normalizeWorldCupInput(input = {}) {
  const type = String(input.type || input.mode || "pre-tournament").trim().toLowerCase();
  const strategy = normalizeWorldCupStrategy(input.strategy || input.contentStrategy || DEFAULT_WORLD_CUP_STRATEGY);
  const teamA = cleanText(input.teamA || input.team_a || input.match?.teamA || input.match?.homeTeam || "");
  const teamB = cleanText(input.teamB || input.team_b || input.match?.teamB || input.match?.awayTeam || "");
  const date = cleanText(input.date || input.match?.date || todayDate()).slice(0, 10);
  const matchId = cleanText(input.matchId || input.match_id || input.match?.id || "");
  const topic =
    cleanText(input.topic) ||
    (teamA && teamB ? `${teamA} vs ${teamB} ${type === "postmatch" ? "post-match analysis" : "prediction"}` : "World Cup chaos storylines to watch");
  const matchSlug = teamA && teamB ? `${slugify(teamA)}-vs-${slugify(teamB)}` : slugify(topic, "world-cup-topic");
  const runType = ["prediction", "postmatch", "pre-tournament"].includes(type) ? type : teamA && teamB ? "prediction" : "pre-tournament";
  const strategyPart = strategy === "viral2" ? "-viral2" : "";
  const idBase = `${date}-${matchSlug}-${runType}${strategyPart}-${hashText(`${topic}:${matchId}:${input.kickoff || ""}:${strategy}`)}`;
  return {
    id: cleanText(input.id) || slugify(idBase),
    type: runType,
    mode: runType,
    strategy,
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
    bgm: normalizeBool(input.bgm ?? input.backgroundMusic, WORLD_CUP_ENABLE_BGM),
    bgmFile: cleanText(input.bgmFile || input.backgroundMusicFile || WORLD_CUP_BGM_FILE),
    bgmMode: cleanText(input.bgmMode || WORLD_CUP_BGM_MODE || "auto").toLowerCase(),
    bgmPreset: normalizeWorldCupBgmPreset(input.bgmPreset || input.musicPreset || WORLD_CUP_BGM_PRESET),
    bgmVolume: Math.min(0.35, Math.max(0.02, Number(input.bgmVolume || WORLD_CUP_BGM_VOLUME) || WORLD_CUP_BGM_VOLUME)),
    captionMidScreen: cleanText(input.captionMidScreen || input.midScreenCaptions || WORLD_CUP_CAPTION_MIDSCREEN || "auto").toLowerCase(),
    captionPreset: normalizeWorldCupCaptionPreset(input.captionPreset || input.captionStyle || WORLD_CUP_CAPTION_PRESET),
    captionDesign: normalizeBool(input.captionDesign ?? input.smartCaptions, true),
    commentaryText: String(input.commentaryText || ""),
    commentaryUrl: cleanText(input.commentaryUrl || ""),
    durationSeconds: Math.max(25, Math.min(65, Number(input.durationSeconds || 48) || 48)),
  };
}

async function fetchText(url) {
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

async function loadWorldCupMemory({ excludeId = "", limit = 10 } = {}) {
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
  for (const run of recentRuns) {
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
    visualAssetIds: [...new Set(visualAssetIds)].slice(0, 80),
  };
}

function memoryPrompt(memory) {
  if (!memory?.recentTopics?.length && !memory?.recentHooks?.length) {
    return "No previous World Cup run memory available.";
  }
  return `
Recent World Cup pipeline memory:
- Avoid repeating topics: ${memory.recentTopics.slice(0, 8).join(" | ") || "none"}
- Avoid repeating hooks: ${memory.recentHooks.slice(0, 8).join(" | ") || "none"}
- Avoid repeating angles: ${memory.recentAngles.slice(0, 8).join(" | ") || "none"}
`.trim();
}

function clampScore(value, min = 0, max = 10) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function firstSentence(text) {
  return cleanText(text).split(/(?<=[.!?])\s+/)[0] || cleanText(text);
}

function hasViralContradiction(text) {
  return /\b(everyone thinks|people think|but|actually|blueprint|should terrify|wake-up call|loss wasn'?t|trap|danger|wrong|break|pressure|real opponent|not .* it'?s|isn'?t ready|not ready|unprepared|instead|nobody|risk|hot take|contrarian)\b/i.test(cleanText(text));
}

function hasMemorableFootballLine(text) {
  return /\b(group chat|comment section|panic button|football court|football jail|receipts|cooked|career mode|aura|fraud watch|chaos|rent is due|trap game|pressure cooker|spreadsheet|restart button|playing the noise|crowd a trap|home advantage is cute)\b/i.test(cleanText(text));
}

function firstThreeSecondHook(text) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  return words.slice(0, 16).join(" ");
}

function scoreFirstThreeSecondHook(text, evidence = {}) {
  const hook = firstThreeSecondHook(text);
  const evidenceText = cleanText(`${evidence.topic || ""} ${evidence.match?.teamA || ""} ${evidence.match?.teamB || ""} ${JSON.stringify(evidence.keyPlayers || [])}`);
  const combined = `${hook} ${evidenceText}`;
  const concrete = /\b(usmnt|usa|united states|mexico|brazil|argentina|france|spain|england|germany|portugal|messi|ronaldo|mbappe|pulisic|neymar)\b/i.test(combined);
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

function topicNamesForViral(evidence, options) {
  const teams = [evidence?.match?.teamA || options?.match?.teamA, evidence?.match?.teamB || options?.match?.teamB].map(cleanText).filter(Boolean);
  const keyPlayer = (Array.isArray(evidence?.keyPlayers) ? evidence.keyPlayers : []).map((player) => cleanText(player.name)).find(Boolean);
  return {
    teams,
    keyPlayer,
    topic: cleanText(evidence?.topic || options?.topic || "this World Cup story"),
    label: teams.length === 2 ? `${teams[0]} vs ${teams[1]}` : cleanText(evidence?.topic || options?.topic || "this World Cup story"),
  };
}

function localViralTopicScore({ evidence, options, memory }) {
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

function localViralHookLab({ evidence, options, topicScore }) {
  const names = topicNamesForViral(evidence, options);
  const label = names.label || "this World Cup story";
  const isUsa = /usa|usmnt|united states/i.test(`${label} ${names.topic}`);
  const opponent = names.teams.find((team) => !/usa|usmnt|united states/i.test(team)) || "the opponent";
  const pressureTarget = isUsa ? "the USMNT" : label;
  const contradiction = isUsa
    ? `Everyone thinks home advantage helps ${pressureTarget}. I think it might break them.`
    : `Everyone thinks ${label} is about the obvious favorite. I think the real danger is pressure.`;
  const hooks = isUsa
    ? [
        `Everyone thinks home advantage helps the USMNT. I think it might break them.`,
        `The USMNT's biggest World Cup danger might not be ${opponent}. It might be playing at home.`,
        `This is the trap nobody wants to admit about the USMNT.`,
        `Home advantage sounds nice until 70,000 people become the panic button.`,
        `I am going contrarian on the USMNT. The crowd might be the real opponent.`,
      ]
    : [
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

function normalizeViralStrategy(raw, fallback) {
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

async function buildViral2Strategy({ evidence, options, keyInfo, memory, warnings }) {
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

function hasHardStat(text) {
  return /\b\d+(?:\.\d+)?\s*(?:%|percent|ppg|points per game|xg|goals?|shots?|saves?|ranked|ranking|hours?|days?)\b/i.test(cleanText(text));
}

function trustedSourceClaims(evidence) {
  return (Array.isArray(evidence?.sourcedClaims) ? evidence.sourcedClaims : []).filter(
    (claim) => cleanText(claim.claim) && cleanText(claim.sourceUrl) && Number(claim.confidence || 0) >= 0.6,
  );
}

function normalizeEvidencePack({ options, commentaryEvents, rawEvidence = {}, sources = [], researchNotes = [] }) {
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

function worldCupResearchPasses(options, memory) {
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

async function consolidateWorldCupEvidence({ options, keyInfo, commentaryEvents, researchNotes, sources, memory, warnings }) {
  const sourceList = sources.map((source, index) => `${index + 1}. ${source.title || "Source"} - ${source.uri || source.sourceUrl}`).join("\n");
  const researchText = researchNotes.map((note) => `## ${note.id}: ${note.query}\n${note.text}`).join("\n\n").slice(0, 26000);
  const prompt = `
You are the evidence editor for "World Cup Chaos Desk".
Convert grounded research notes into a strict evidence pack for a short video.

Video:
- Type: ${options.type}
- Topic: ${options.topic}
- Match: ${options.match.teamA && options.match.teamB ? `${options.match.teamA} vs ${options.match.teamB}` : "topic-based pre-tournament video"}
- Audience: ${options.audience}

Available source URLs:
${sourceList || "No grounded URLs were returned."}

Research notes:
${researchText || "No grounded research notes were returned."}

Commentary-derived internal events:
${JSON.stringify(commentaryEvents, null, 2)}

Memory:
${memoryPrompt(memory)}

Rules:
- Output JSON only.
- Every hard number, injury, ranking, quote, or recent-form claim must include a sourceUrl from the available source URLs.
- If there are fewer than two useful sources, set evidenceQuality.needsReview=true and avoid hard statistical claims.
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

async function collectWorldCupData(options, keyInfo, warnings) {
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
  return { evidence, sources, commentaryEvents, memory };
}

function fallbackScripts(evidence, viralStrategy = null) {
  const matchName = evidence.match?.teamA && evidence.match?.teamB ? `${evidence.match.teamA} vs ${evidence.match.teamB}` : evidence.topic;
  const trustedClaims = trustedSourceClaims(evidence);
  const dataPoint =
    trustedClaims[0]?.claim ||
    evidence.tacticalMatchup?.[0]?.claim ||
    "the verified data is still thin, so this is a pressure-read, not a spreadsheet lock";
  if (viralStrategy?.version === "viral2") {
    const contradiction = cleanText(viralStrategy.oneSentenceContradiction) || `Everyone thinks ${matchName} is simple. I think the pressure says otherwise.`;
    const coverText = cleanText(viralStrategy.coverText) || "TRAP GAME ALERT";
    return [
      {
        styleId: "viral2_contrarian_friend",
        title: coverText,
        hookType: "contradiction",
        text: `${contradiction} Because the useful clue is not the bigger badge. It is who plays normal football when the noise gets stupid. Home advantage is cute until your own fans start sounding like the comment section. My pick is the team that can stay boring for five minutes longer. Am I overthinking this, or is pressure the real opponent?`,
        dataPoint,
        opinion: "Pressure can matter more than reputation in the first World Cup beat.",
        joke: "the group chat turns into a courtroom",
        memorableLine: "Home advantage is cute until your own fans start sounding like the comment section.",
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
        text: `${contradiction} That does not mean they are bad. It means the first ugly spell matters. Crowds can lift you, but they can also make every simple pass feel like a referendum. One bad pass and suddenly everyone has a coaching license. If this goes wrong, the opponent may not beat them first. The moment might. Agree or am I too cynical?`,
        dataPoint,
        opinion: "The risk is emotional speed, not talent.",
        joke: "every simple pass feels like a referendum",
        memorableLine: "One bad pass and suddenly everyone has a coaching license.",
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

function sanitizeScriptAgainstEvidence(script, evidence, warnings) {
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

function polishScriptForShorts(script, warnings) {
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

async function generateScripts(evidence, keyInfo, options, warnings) {
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
- Creator line lab. Every script MUST contain one line with this exact level of casual fan truth:
  "Home advantage is cute until your own fans start sounding like the comment section."
  You may adapt it to the topic, but it must be short, funny, and instantly quotable.
- Do not use harsh pundit phrases like "national humiliation", "psychological death trap", "sucker's bet", "delusional", "glass cannon", "destined to break", "crushed", or "failure".
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
  "One bad pass and suddenly everyone has a coaching license."
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
- harsh doom language like "national humiliation", "death trap", "sucker's bet", "delusional", "glass cannon", "destined to break", "crushed", or "failure"
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

function heuristicScriptScore(script) {
  const text = script.text || "";
  const words = text.split(/\s+/).filter(Boolean);
  const hasJoke = /court|jail|rent|panic|group chat|comment section|coaching license|receipts|chaos|aura|cooked|oops|hype|almost|spreadsheet|laptop|ferrari|roundabout|restart button/i.test(text);
  const hasQuestion = /\?/.test(text) || /comments|tell me|who|what/i.test(text);
  const notTooLong = words.length >= 75 && words.length <= 120;
  const tooHeavy = /absolute failure|funeral march|silent killer|crumble|melt|disaster/i.test(text);
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

function totalJudgeScore(scores) {
  return Object.values(scores || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function scoreViral2Script(script, evidence, viralStrategy = {}) {
  const text = cleanText(script?.text || "");
  const words = text.split(/\s+/).filter(Boolean);
  const opening = firstSentence(text);
  const firstThree = scoreFirstThreeSecondHook(text, evidence);
  const hasQuestion = /\?/.test(text) || /\b(comment|tell me|agree|overthinking|cynical|verdict)\b/i.test(text);
  const evidenceWeak = Boolean(evidence?.evidenceQuality?.needsReview) || trustedSourceClaims(evidence).length === 0;
  const unsupportedHardStat = hasHardStat(`${text} ${script?.dataPoint || ""}`) && !trustedSourceClaims(evidence).some((claim) => hasHardStat(claim.claim));
  const generic =
    /\b(the 2026 world cup is coming|this match will be interesting|anything can happen|both teams will try|football is unpredictable|at the end of the day)\b/i.test(text) ||
    !/\b(world cup|usmnt|usa|mexico|brazil|argentina|france|spain|england|paraguay|home|host|pressure|favorite|underdog|crowd|group)\b/i.test(text);
  const harshPunditTone = /\b(national humiliation|psychological death trap|death trap|sucker'?s bet|delusional|glass cannon|destined to break|crushed|failure|crack under|shatter)\b/i.test(text);
  const dimensions = {
    hook: hasViralContradiction(opening) && opening.length <= 115 ? 18 : hasViralContradiction(opening) ? 14 : 7,
    clarity: words.length >= 65 && words.length <= 118 ? 12 : words.length <= 130 ? 9 : 5,
    personality: hasMemorableFootballLine(`${text} ${script?.memorableLine || ""}`) ? 15 : /panic|trap|chaos|pressure|comment|court|jail|career mode|coaching license/i.test(text) ? 10 : 4,
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
    opening,
    firstThreeSeconds: firstThree,
    checkedAt: nowIso(),
  };
}

function hardenedOpeningForEvidence(evidence = {}, viralStrategy = {}) {
  const text = cleanText(`${evidence.topic || ""} ${evidence.match?.teamA || ""} ${evidence.match?.teamB || ""}`).toLowerCase();
  if (/usmnt|usa|united states/.test(text) && /germany/.test(text) && /paraguay/.test(text)) {
    return "Germany just gave Paraguay the blueprint, and that should terrify the USMNT.";
  }
  if (/usmnt|usa|united states/.test(text) && /home|host|pressure/.test(text)) {
    return "Home advantage might be the USMNT's biggest trap, not their biggest weapon.";
  }
  const strategyHook = (Array.isArray(viralStrategy?.hooks) ? viralStrategy.hooks : []).find((hook) => {
    const scored = scoreFirstThreeSecondHook(hook, evidence);
    return scored.decision === "pass" && !/^(is|are|can|could|do|does|did|will|would|should|what|why|how)\b/i.test(cleanText(hook));
  });
  return strategyHook || "The obvious World Cup story is hiding the real pressure point.";
}

function hardenViralOpening(script, evidence = {}, viralStrategy = {}, warnings = []) {
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

async function reviseViral2Script({ script, evidence, viralStrategy, keyInfo, warnings }) {
  if (!keyInfo?.apiKey) {
    return null;
  }
  const prompt = `
You are the brutal Shorts editor for "World Cup Chaos Desk".
The script below failed Viral 2.0 quality gates. Rewrite it once.

Keep:
- Same topic and safe evidence.
- 70-110 spoken words.
- One complete first-sentence contradiction.
- First 12-16 words must pass the first-3-second gate: recognizable target + pressure/debate + curiosity gap.
- Never open with a question. Rewrite any "Is/Are/Can/Will..." opener into a direct claim.
- One memorable football-native line.
- One clear opinion.
- One debate-ending question.
- No unsupported hard stats.
- Keep the tone soft, funny, and nervous, not angry or doom-heavy.
- Avoid: national humiliation, psychological death trap, sucker's bet, delusional, glass cannon, destined to break, crushed, failure.
- Prefer: panic button, career mode with no restart button, group chat courtroom, football court hearing, souffle during an earthquake.
- The rewritten script MUST include one quotable creator line in this style:
  "Home advantage is cute until your own fans start sounding like the comment section."
  "The crowd is an extra man until it opens the group chat."
  "One bad pass and suddenly everyone has a coaching license."

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
Penalize any hard number, ranking, injury, odds, or recent-form claim that is not clearly supported by evidence.sourcedClaims with a sourceUrl.
Reward scripts that use urgent, mysterious, controversial, contrarian, story, data-shock, or risk hooks without becoming clickbait misinformation.
Strongly prefer scripts that feel like a funny, soft, natural football creator, not a TV analyst.
Prefer 80-115 spoken words. Penalize scripts over 125 words unless they are exceptional.
Penalize heavy negative phrases like "absolute failure", "funeral march", "silent killer", "crumble", or "disaster" when a softer funny version could work.
Reward pitch-friendly writing: short sentences, playful questions, pauses before punchlines, and one memorable joke.
Strongly penalize scripts that do not contain one quotable creator/fan line like:
- "Home advantage is cute until your own fans start sounding like the comment section."
- "The crowd is an extra man until it opens the group chat."
- "One bad pass and suddenly everyone has a coaching license."

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
Use a sharper comment-driving hook. Avoid generic openings.
If evidence is weak, remove hard stats and frame the argument as opinion or pressure-read.
Keep or add one quotable creator-native line in the actual script, like:
- "Home advantage is cute until your own fans start sounding like the comment section."
- "The crowd is an extra man until it opens the group chat."
- "One bad pass and suddenly everyone has a coaching license."

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

function fallbackTtsRewrite(selectedScript) {
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

async function rewriteForTts({ selectedScript, evidence, keyInfo, options, warnings }) {
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

function commonsAssetFromImageInfo({ page, info, sourcePlayer = "", sourceTeam = "", query = "" }) {
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

async function searchLicensedCommonsImage(query, { sourcePlayer = "", sourceTeam = "" } = {}) {
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

async function resolveWikimediaPlayerImage(playerName, team) {
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

async function resolveWikimediaTeamImage(teamName) {
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

async function searchPexelsVideos(query, apiKey, page = 1) {
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

async function searchPixabayVideos(query, apiKey, page = 1) {
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

function visualCandidateText(candidate) {
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

function localVisualReview(candidate, evidence) {
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

async function fetchInlineImagePart(candidate) {
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

function attachVisualReviews(candidates, reviewedItems, model, evidence = {}) {
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

async function reviewVisualCandidatesWithGemma({ keyInfo, candidates, evidence, selectedScript, warnings }) {
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
- Do not reject Wikimedia/Pexels/Pixabay only because a player/team appears. Use the source/license metadata.
- Prefer real team/player Wikimedia images when license metadata is valid and relevance is high.

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

async function refineVisualScoutWithGemini({ keyInfo, candidates, evidence, selectedScript, warnings }) {
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
- Prefer real licensed Wikimedia team/player images for the first 1-2 proof beats.
- Prefer football/stadium/fan clips over generic intensity clips.
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

function scriptVisualScoutQueries(selectedScript, evidence) {
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

function evidenceAssetTerms(evidence = {}) {
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

function curatedAssetTargetForTeam(teamOrTopic) {
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

function assetPackMatchesEvidence(manifest, evidence) {
  const terms = evidenceAssetTerms(evidence);
  const haystack = cleanText(
    `${manifest.team || ""} ${(manifest.players || []).join(" ")} ${(manifest.aliases || []).join(" ")} ${(manifest.topic || "")}`,
  ).toLowerCase();
  return terms.some((term) => term.length > 2 && haystack.includes(term));
}

async function loadLocalAssetPackAssets(evidence) {
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

async function resolveWikimediaVisualAssets(evidence) {
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

async function discoverAssetPackTargets({ team, players = [], topic = "", keyInfo, offline = false, warnings = [] }) {
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

async function saveAssetPackImage(asset, packDir) {
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

async function searchStockCandidatesParallel({ queries, pexelsKey, pixabayKey, warnings }) {
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

async function scoutWorldCupVisualAssets({ evidence, selectedScript, keyInfo, options, warnings }) {
  const startedAt = nowIso();
  const wikimedia = options.offline ? { assets: [], attributions: [] } : await resolveWikimediaVisualAssets(evidence);
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

function segmentSearchQueries(segment, evidence) {
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

function stockProviderQuery(query, segment, evidence) {
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

function clipLooksContextMismatched(clip, evidence) {
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

function selectVisualClip(candidates, { usedAssetIds, memoryAssetIds, segment, evidence }) {
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
      const providerBonus = clip.provider === "pexels" ? 1 : 0.5;
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
        (repeated ? 9 : 0) -
        (wrongSport ? 30 : 0) -
        relevancePenalty -
        riskPenalty;
      return { clip, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.find((item) => item.score > 0)?.clip || null;
}

function selectBackupFootballClip(candidates, { usedAssetIds, segment, evidence }) {
  const text = cleanText(segment?.text || "").toLowerCase();
  const footballCandidates = candidates
    .filter((clip) => clip?.url && !usedAssetIds.has(clip.id) && candidateAllowedByReview(clip) && !clipLooksContextMismatched(clip, evidence))
    .map((clip) => {
      const haystack = visualCandidateText(clip).toLowerCase();
      const portrait = Number(clip.height || 0) >= Number(clip.width || 0);
      const highEnough = Number(clip.height || 0) >= 540;
      const football = /soccer|football|stadium|crowd|fans?|supporters|goal|match|pitch|player|training|coach|tactic|formation/.test(haystack);
      const wrongSport = /basketball|baseball|american-football|cricket|tennis|mma|mixed-martial|martial-arts|bodybuilding|weight-training|gym-workout|fighters|combat/.test(haystack);
      const beatMatch =
        (/fan|crowd|noise|watch|pressure|home/.test(text) && /stadium|crowd|fans?|supporters/.test(haystack)) ||
        (/tactic|pochettino|3-2-5|press|formation|possession/.test(text) && /coach|tactic|formation|training|players/.test(haystack)) ||
        (/panic|touch|shaky|nervous|break/.test(text) && /player|training|match|pressure|stadium|crowd/.test(haystack));
      const score = (portrait ? 10 : 0) + (highEnough ? 4 : 0) + (football ? 12 : 0) + (beatMatch ? 8 : 0) - (wrongSport ? 40 : 0);
      return { clip, score };
    })
    .filter((item) => item.score > 10)
    .sort((a, b) => b.score - a.score);
  return footballCandidates[0]?.clip || null;
}

function impliedTeamNames(evidence) {
  const names = [evidence.match?.teamA, evidence.match?.teamB].filter(Boolean);
  const topic = `${evidence.topic || ""} ${JSON.stringify(evidence.sourcedClaims || [])}`;
  if (/usa|usmnt|united states|yanks/i.test(topic)) {
    names.push("United States men's national soccer team");
  }
  return [...new Set(names.map(cleanText).filter(Boolean))].slice(0, 4);
}

function assetMatchTerms(asset) {
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

function assetMatchesSegment(asset, segment, evidence) {
  const haystack = cleanText(`${segment.text || ""} ${evidence.topic || ""}`);
  return assetMatchTerms(asset).some((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(haystack));
}

function candidateAllowedByReview(candidate) {
  const review = candidate.visualReview || {};
  const risk = cleanText(review.risk).toLowerCase();
  if (candidate.visualSelection?.blocked || risk === "high") {
    return false;
  }
  const flags = Array.isArray(review.flags) ? review.flags.join(" ").toLowerCase() : "";
  return !/(source-risk|off-topic|watermark|broadcast|getty|ap\/fifa|fifa source)/i.test(flags);
}

function isLocalProofAsset(asset) {
  return cleanText(asset?.provider).toLowerCase() === "local-asset-pack" || Boolean(asset?.backupOnly);
}

function stockCandidateMatchesSegment(candidate, segment, evidence) {
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

function chooseImageForSegment({
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

function imageProofShouldOverrideClip({ image, clip, segment, evidence, imageSlotsUsed, totalSegments }) {
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

async function buildVisualPlan({ evidence, srtSegments, keyInfo, options, warnings, visualScout = null }) {
  const attributions = [];
  let wikimediaAssets = Array.isArray(visualScout?.wikimediaAssets) ? visualScout.wikimediaAssets : [];
  const memory = await loadWorldCupMemory({ excludeId: options.id, limit: 12 });
  const memoryAssetIds = new Set(memory.visualAssetIds || []);
  const usedAssetIds = new Set();
  if (!wikimediaAssets.length && !visualScout && !options.offline) {
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
      selectedClip = selectBackupFootballClip(uniqueCandidates, { usedAssetIds, segment, evidence });
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
    if (!imageProofShouldOverrideClip({ image: selectedImage, clip: selectedClip, segment, evidence, imageSlotsUsed, totalSegments: srtSegments.length })) {
      selectedImage = null;
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
      candidates: uniqueCandidates.slice(0, 6),
      fallbackVisual: fallbackVisualForSegment(segment, evidence),
      rightsStatus: selectedImage || selectedClip ? "approved" : "fallback_used",
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

function visualPlanRealVisualRatio(visualPlan = {}) {
  const segments = Array.isArray(visualPlan.segments) ? visualPlan.segments : [];
  if (!segments.length) {
    return 0;
  }
  return segments.filter((segment) => segment.selectedClip || segment.selectedImage).length / segments.length;
}

function visualPlanFallbackCount(visualPlan = {}) {
  const segments = Array.isArray(visualPlan.segments) ? visualPlan.segments : [];
  return segments.filter((segment) => !segment.selectedClip && !segment.selectedImage).length;
}

function visualPlanNeedsRetry(visualPlan = {}) {
  const segments = Array.isArray(visualPlan.segments) ? visualPlan.segments : [];
  if (segments.length < 4) {
    return false;
  }
  return visualPlanFallbackCount(visualPlan) > 0 || visualPlanRealVisualRatio(visualPlan) < WORLD_CUP_MIN_REAL_VISUAL_RATIO;
}

function visualIntentForSegment(segment, evidence) {
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

function fallbackVisualForSegment(segment, evidence) {
  const teams = [evidence.match?.teamA, evidence.match?.teamB].filter(Boolean);
  const palette = segment.number % 3 === 0 ? "emerald and gold" : segment.number % 3 === 1 ? "navy and yellow" : "black, white, and red";
  const text = cleanText(segment.text);
  const topic = cleanText(evidence.topic || "");
  if (segment.number === 1) {
    return {
      type: "hook-card",
      palette: "black, yellow, and deep green",
      headline: evidence.viralStrategy?.coverText || (/usmnt|usa|united states/i.test(`${text} ${topic}`) ? "HOME ADVANTAGE TRAP?" : "WORLD CUP WARNING"),
      subline: text.slice(0, 110),
    };
  }
  if (/career mode|fifa|formation|tinkering/i.test(text)) {
    return {
      type: "formation-gag-card",
      palette: "navy and yellow",
      headline: "CAREER MODE FC",
      subline: "Not the World Cup.",
    };
  }
  if (/panic|pressure|trap|headache/i.test(text)) {
    return {
      type: "pressure-card",
      palette: "black, white, and red",
      headline: /usmnt|usa|united states/i.test(`${text} ${topic}`) ? "USMNT PANIC MODE" : "PRESSURE TEST",
      subline: text.slice(0, 110),
    };
  }
  return {
    type: /press|midfield|tactic/i.test(segment.text) ? "tactical-board" : "worldcup-card",
    palette,
    headline: teams.length === 2 ? `${teams[0]} vs ${teams[1]}` : "World Cup Chaos Desk",
    subline: text.slice(0, 110),
  };
}

function buildDirectorSummary(evidence) {
  const topic = evidence.match?.teamA && evidence.match?.teamB ? `${evidence.match.teamA} vs ${evidence.match.teamB}` : evidence.topic;
  const keyClaim = evidence.sourcedClaims?.[0]?.claim || evidence.tacticalMatchup?.[0]?.claim || "pressure and fan emotion drive the story";
  if (evidence.viralStrategy?.version === "viral2") {
    return `Viral 2.0 reel about ${topic}. One-sentence promise: ${evidence.viralStrategy.oneSentenceContradiction || keyClaim}. Visual language: ${evidence.viralStrategy.visualStyle?.summary || "real proof beat, crowd pressure, tactical cards, and joke overlays"}. Pacing: ${evidence.viralStrategy.visualStyle?.pacing || "change visual every 2.5 to 5 seconds"}.`;
  }
  return `Fast football creator reel about ${topic}. Visual language should feel like a smart fan desk: quick cards, tactical boards, safe stock crowd/action clips, and player cards only when rights are approved. Main visual thesis: ${keyClaim}`;
}

function buildRightsManifest(visualPlan) {
  const assetRows = [];
  for (const segment of visualPlan.segments || []) {
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

function reviewWorldCupRun(run) {
  const issues = [];
  const evidenceQuality = run.evidence?.evidenceQuality || {};
  if (evidenceQuality.needsReview) {
    issues.push("Evidence needs review before publishing hard claims.");
  }
  if (hasHardStat(`${run.selectedScript?.text || ""} ${run.selectedScript?.dataPoint || ""}`) && !trustedSourceClaims(run.evidence).some((claim) => hasHardStat(claim.claim))) {
    issues.push("Selected script may contain hard stats without trusted sourced claims.");
  }
  const visualSegments = Array.isArray(run.visualPlan?.segments) ? run.visualPlan.segments : [];
  const visualIds = visualSegments.map((segment) => segment.selectedClip?.id || segment.selectedImage?.id || "").filter(Boolean);
  const uniqueVisualCount = new Set(visualIds).size;
  const realVisualCount = visualSegments.filter((segment) => segment.selectedClip || segment.selectedImage).length;
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

function combinedViralDecision(run) {
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

async function createRunSkeleton(options) {
  await ensureWorldCupDirs();
  const runDir = path.join(runsRoot, options.id);
  await fs.mkdir(runDir, { recursive: true });
  const createdAt = nowIso();
  return {
    id: options.id,
    type: options.type,
    strategy: options.strategy,
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

async function planWorldCupVisualsWithRetries({ run, keyInfo, options, initialVisualScoutPromise = null }) {
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

  let plan = await buildVisualPlan({ evidence: run.evidence, srtSegments: run.srt.segments, keyInfo, options, warnings, visualScout });
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
    plan = await buildVisualPlan({ evidence: run.evidence, srtSegments: run.srt.segments, keyInfo, options: retryOptions, warnings, visualScout });
  }

  return plan;
}

function runSummary(run) {
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
    voice: run.tts?.voice || "",
    bgm: run.bgm || {},
    review: run.review || {},
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
      retryAttempts: WORLD_CUP_VISUAL_RETRY_ATTEMPTS,
      assetPackRoot,
    },
    defaultCaptionStyle: WORLD_CUP_CAPTION_PRESET,
    defaultCaptionAnimation: "slide-lift",
    maxVideosPerDay: MAX_VIDEOS_PER_DAY,
    scheduleHoursUtc: scheduledHours(),
  };
}

export async function generateWorldCupRun(input = {}) {
  const options = normalizeWorldCupInput(input);
  const keyInfo = await getActiveGeminiKey();
  let run = await createRunSkeleton(options);
  run.warnings = [];
  run.apiUsage = createApiUsageLedger();
  activeWorldCupApiUsage = run.apiUsage;

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

  const scriptResult = await generateScripts(run.evidence, keyInfo, options, run.warnings);
  run.scripts = scriptResult.scripts;
  const judgeResult = await judgeScripts({ scripts: run.scripts, evidence: run.evidence, keyInfo, options, warnings: run.warnings });
  let polishedSelectedScript = polishScriptForShorts(judgeResult.selected, run.warnings);
  if (isViral2(options)) {
    let viralQuality = scoreViral2Script(polishedSelectedScript, run.evidence, run.viralStrategy);
    if (viralQuality.decision !== "publish_candidate" && keyInfo?.apiKey && !options.offline) {
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
    const hardened = hardenViralOpening(polishedSelectedScript, run.evidence, run.viralStrategy, run.warnings);
    polishedSelectedScript = hardened.script;
    viralQuality = hardened.quality;
    polishedSelectedScript.viralQuality = viralQuality;
    run.viralStrategy.scriptGate = {
      selectedStyleId: polishedSelectedScript.styleId,
      quality: viralQuality,
    };
  }
  run.selectedScript = {
    ...polishedSelectedScript,
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
  run.srt = {
    source: srtResult.source,
    model: srtResult.model || "",
    audioSummary: srtResult.audioSummary || "",
    segments: srtResult.segments,
    durationSeconds: srtResult.segments.at(-1)?.endTime || 0,
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
  run.files.srt = await writeRunFile(run, "srt.srt", srtResult.srt, "utf8");
  run.files.captions = await writeRunFile(
    run,
    "captions.json",
    `${JSON.stringify({ ...run.srt, srt: srtResult.srt }, null, 2)}\n`,
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
    await renderWorldCupRun(run.id, input);
  } else if (options.render && run.status === "needs_visual_review") {
    run.warnings.push("Render skipped because visual retries still left fallback boards. Script, TTS, and SRT were preserved.");
    await saveRun(run);
  }
  if (options.upload) {
    await uploadWorldCupRun(run.id, input);
  }
    run = await readWorldCupRun(run.id);
    run.apiUsage = activeWorldCupApiUsage || run.apiUsage || {};
    run.apiUsage.completedAt = nowIso();
    run.files.apiUsage = await writeRunFile(run, "api-usage.json", `${JSON.stringify(run.apiUsage, null, 2)}\n`, "utf8");
    await saveRun(run);
    return await readWorldCupRun(run.id);
  } finally {
    if (activeWorldCupApiUsage === run.apiUsage) {
      activeWorldCupApiUsage = null;
    }
  }
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

function splitCaptionWords(text, maxWords = 3, maxChars = 18) {
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

function captionSafeScale(text, placement, requestedScale = 1) {
  const chars = cleanText(text).length;
  const safeChars = placement === "middle" ? 15 : 18;
  const widthScale = chars > safeChars ? safeChars / chars : 1;
  const requested = Number(requestedScale || 1) || 1;
  return Math.max(0.76, Math.min(placement === "middle" ? 1.12 : 1.08, requested * widthScale));
}

function assOverrideColor(hex) {
  const clean = String(hex || "#ffffff").replace("#", "").padEnd(6, "f").slice(0, 6);
  return `&H${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}&`;
}

function escapeAssPart(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

function captionSegmentPlan(captionPlan = {}, number = 0) {
  const segments = Array.isArray(captionPlan.segments) ? captionPlan.segments : [];
  return segments.find((segment) => Number(segment.number) === Number(number)) || {};
}

function normalizeCaptionAnimation(value, fallback = "pop") {
  const cleaned = cleanText(value).toLowerCase();
  return ["pop", "punch", "slide-lift", "impact", "glitch", "calm", "kinetic"].includes(cleaned) ? cleaned : fallback;
}

function normalizeCaptionPlacement(value, fallback = "bottom") {
  const cleaned = cleanText(value).toLowerCase();
  return ["bottom", "middle"].includes(cleaned) ? cleaned : fallback;
}

function emphasisWordsForCaption(captionPlan = {}, segmentPlan = {}) {
  const globalWords = Array.isArray(captionPlan.emphasisWords) ? captionPlan.emphasisWords : [];
  const localWords = Array.isArray(segmentPlan.emphasisWords) ? segmentPlan.emphasisWords : [];
  return [...new Set([...localWords, ...globalWords].map(cleanText).filter(Boolean))].slice(0, 14);
}

function emphasizeCaptionText(text, captionPlan = {}, segmentPlan = {}, scale = 1) {
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

function captionAnimationTag({ placement, animation, startY, endY, fontScale, isFirstChunk }) {
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

function buildAssFromSrt(srtText, captionPlan = {}) {
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

function isApprovedMediaHost(hostname) {
  return STOCK_VIDEO_HOSTS.has(hostname) || hostname.endsWith("wikimedia.org") || hostname.endsWith("wikimedia.commons");
}

async function downloadAsset(url, tempDir, fileName) {
  if (!/^https?:\/\//i.test(String(url || ""))) {
    const resolved = path.resolve(String(url || ""));
    const assetRootResolved = path.resolve(assetPackRoot);
    if (!resolved.startsWith(assetRootResolved)) {
      throw new Error("Blocked local media outside World Cup asset packs.");
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

function wrapCardLine(text, maxChars = 24) {
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

async function renderFallbackCard(ffmpegPath, tempDir, segment, index) {
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

async function renderImageSegment(ffmpegPath, tempDir, imageUrl, segment, index) {
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

function visualSegmentsForRender(visualSegments = [], totalDuration = 0) {
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

function bgmMoodForRun(run) {
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

function resolveBgmMood(run, options = {}) {
  const preset = normalizeWorldCupBgmPreset(options.bgmPreset || WORLD_CUP_BGM_PRESET);
  if (preset === "off") {
    return "off";
  }
  return preset === "auto" ? bgmMoodForRun(run) : preset;
}

function defaultBgmVolumeForMood(mood) {
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

function resolveBgmVolume(options = {}, mood = "analysis") {
  const explicit = Number(options.bgmVolume);
  if (Number.isFinite(explicit) && explicit > 0 && Math.abs(explicit - WORLD_CUP_BGM_VOLUME) > 0.001) {
    return Math.min(0.35, Math.max(0.02, explicit));
  }
  return Math.min(0.35, Math.max(0.02, defaultBgmVolumeForMood(mood)));
}

async function ensureSyntheticBgmTrack(ffmpegPath, mood, warnings) {
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

async function resolveBgmTrack({ run, options, ffmpegPath, warnings }) {
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

function voiceAudioFilter(runOrOptions = {}) {
  if (isViral2(runOrOptions)) {
    const volume = Math.max(WORLD_CUP_VOICE_VOLUME, 1.65).toFixed(2);
    return `volume=${volume},acompressor=threshold=-22dB:ratio=3.2:attack=4:release=80,loudnorm=I=-16:LRA=9:TP=-1.5,alimiter=limit=0.96`;
  }
  return `volume=${WORLD_CUP_VOICE_VOLUME.toFixed(2)},acompressor=threshold=-18dB:ratio=2.5:attack=6:release=90,alimiter=limit=0.95`;
}

function bgmAudioFilter(volume, duration, fadeOutStart) {
  return `volume=${volume},acompressor=threshold=-24dB:ratio=1.5:attack=20:release=180,atrim=0:${duration},afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutStart}:d=1.2,asetpts=PTS-STARTPTS`;
}

function maxCaptionGap(segments = [], totalDuration = 0) {
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

async function analyzeRenderedAudio(ffmpegPath, outputPath) {
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

async function buildPostRenderQuality({ run, outputPath, ffmpegPath, renderLog = null }) {
  const totalDuration = Number(run.audio?.durationSeconds || run.srt?.durationSeconds || 0) || 0;
  const segments = Array.isArray(run.srt?.segments) ? run.srt.segments : [];
  const visualSegments = Array.isArray(run.visualPlan?.segments) ? run.visualPlan.segments : [];
  const renderedSegments = Array.isArray(renderLog?.segments) ? renderLog.segments : [];
  const actualVisuals = renderedSegments.length
    ? renderedSegments.map((segment, index) => ({
        id: `${segment.source || "unknown"}-${segment.number || index + 1}`,
        source: cleanText(segment.source || "unknown"),
        selectedClip: /pexels|pixabay|stock/i.test(segment.source || ""),
        selectedImage: /image|wikimedia|local-asset-pack/i.test(segment.source || ""),
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
        if (segment.selectedImage?.url) {
          segmentPath = await renderImageSegment(ffmpegPath, tempDir, segment.selectedImage.url, segment, index);
        } else if (safeSelectedClip?.url) {
          segmentPath = await renderClipSegment(ffmpegPath, tempDir, safeSelectedClip.url, segment, index);
        } else {
          segmentPath = await renderFallbackCard(ffmpegPath, tempDir, segment, index);
        }
        segmentPaths.push(segmentPath);
        renderLog.segments.push({
          number: segment.number,
          source: segment.selectedImage ? segment.selectedImage.provider || "image" : safeSelectedClip ? safeSelectedClip.provider : "fallback-card",
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
    ["viral-strategy.json", run.files.viralStrategy, "application/json; charset=utf-8"],
    ["visual-scout.json", run.files.visualScout, "application/json; charset=utf-8"],
    ["srt.srt", run.files.srt, "application/x-subrip; charset=utf-8"],
    ["visuals.json", run.files.visuals, "application/json; charset=utf-8"],
    ["attribution.json", run.files.attribution, "application/json; charset=utf-8"],
    ["rights.json", run.files.rights, "application/json; charset=utf-8"],
    ["quality.json", run.files.quality, "application/json; charset=utf-8"],
    ["render-log.json", run.files.renderLog, "application/json; charset=utf-8"],
    ["api-usage.json", run.files.apiUsage, "application/json; charset=utf-8"],
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
    ["viral-strategy.json", run.files.viralStrategy, "application/json; charset=utf-8"],
    ["visual-scout.json", run.files.visualScout, "application/json; charset=utf-8"],
    ["srt.srt", run.files.srt, "application/x-subrip; charset=utf-8"],
    ["visuals.json", run.files.visuals, "application/json; charset=utf-8"],
    ["attribution.json", run.files.attribution, "application/json; charset=utf-8"],
    ["rights.json", run.files.rights, "application/json; charset=utf-8"],
    ["quality.json", run.files.quality, "application/json; charset=utf-8"],
    ["render-log.json", run.files.renderLog, "application/json; charset=utf-8"],
    ["api-usage.json", run.files.apiUsage, "application/json; charset=utf-8"],
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
    viralStrategy: run.files.viralStrategy,
    viralstrategy: run.files.viralStrategy,
    quality: run.files.quality,
    postRenderQuality: run.files.quality,
    postrenderquality: run.files.quality,
    visualScout: run.files.visualScout,
    visualscout: run.files.visualScout,
    visuals: run.files.visuals,
    attribution: run.files.attribution,
    rights: run.files.rights,
    renderLog: run.files.renderLog,
    renderlog: run.files.renderLog,
    apiUsage: run.files.apiUsage,
    apiusage: run.files.apiUsage,
    usage: run.files.apiUsage,
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
