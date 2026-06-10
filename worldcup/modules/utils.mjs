import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash, createHmac, createSign, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const __dirname = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const repoRoot = path.dirname(__dirname);
loadLocalEnvFiles();
export const geminiKeyStorePath = path.join(repoRoot, ".gemini-keys.json");
export const stockKeyStorePath = path.join(repoRoot, ".stock-keys.json");
export const worldCupRoot = path.join(repoRoot, ".tmp-worldcup");
export const runsRoot = path.join(worldCupRoot, "runs");
export const tempRoot = path.join(worldCupRoot, "tmp");
export const bgmRoot = path.join(worldCupRoot, "bgm");
export const assetPackRoot = path.join(worldCupRoot, "asset-packs");
export const localDownloadsRoot = path.resolve(process.env.WORLD_CUP_LOCAL_DOWNLOADS_DIR || path.join(repoRoot, "downloads"));
export const localEntityPreviewRoot = path.join(worldCupRoot, "local-entity-previews");
export const indexPath = path.join(worldCupRoot, "index.json");
export const portableFfmpegPath = "C:\\tmp\\ffmpeg-portable\\bin\\ffmpeg.exe";
export const execFileAsync = promisify(execFile);
export { fsSync, fs, path, createHash, createHmac, createSign, randomUUID };

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;
export const MAX_SAVED_KEYS = 4;
export const DEFAULT_LANGUAGE = process.env.WORLD_CUP_DEFAULT_LANGUAGE || "en";
export const DEFAULT_WORLD_CUP_STRATEGY = normalizeWorldCupStrategy(process.env.WORLD_CUP_STRATEGY || "classic");
export const LITE_TEXT_MODEL = process.env.WORLD_CUP_LITE_TEXT_MODEL || "gemini-3.1-flash-lite";
export const SEARCH_MODEL = process.env.WORLD_CUP_SEARCH_MODEL || process.env.WORLD_CUP_RESEARCH_MODEL || "gemini-2.5-flash-lite";
export const SEARCH_FALLBACK_MODELS = String(process.env.WORLD_CUP_SEARCH_FALLBACK_MODELS || "gemini-2.5-flash,gemini-3.1-flash-lite")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
export const WRITER_MODEL = process.env.WORLD_CUP_WRITER_MODEL || LITE_TEXT_MODEL;
export const EVALUATOR_MODEL = process.env.WORLD_CUP_EVALUATOR_MODEL || LITE_TEXT_MODEL;
export const TTS_REWRITE_MODEL = process.env.WORLD_CUP_TTS_REWRITE_MODEL || WRITER_MODEL;
export const TTS_MODEL = process.env.WORLD_CUP_TTS_MODEL || "gemini-3.1-flash-tts-preview";
export const AUDIO_SRT_MODEL = process.env.WORLD_CUP_AUDIO_SRT_MODEL || LITE_TEXT_MODEL;
export const AUDIO_SRT_FALLBACK_MODELS = String(process.env.WORLD_CUP_AUDIO_SRT_FALLBACK_MODELS || "gemini-2.5-flash")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
export const VISUAL_REVIEW_MODEL = process.env.WORLD_CUP_VISUAL_REVIEW_MODEL || "gemma-4-26b-a4b-it";
export const VISUAL_SELECTION_MODEL = process.env.WORLD_CUP_VISUAL_SELECTION_MODEL || "gemini-2.5-flash-lite";
export const VISUAL_SELECTION_FALLBACK_MODELS = String(process.env.WORLD_CUP_VISUAL_SELECTION_FALLBACK_MODELS || "gemini-3.1-flash-lite,gemini-2.5-flash")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
export const VISUAL_SCOUT_PAGES = Math.max(1, Math.min(3, Number(process.env.WORLD_CUP_VISUAL_SCOUT_PAGES || 1) || 1));
export const VISUAL_REVIEW_MAX_ITEMS = Math.max(6, Math.min(40, Number(process.env.WORLD_CUP_VISUAL_REVIEW_MAX_ITEMS || 24) || 24));
export const WORLD_CUP_VOICE_VOLUME = Math.min(2.2, Math.max(1, Number(process.env.WORLD_CUP_VOICE_VOLUME || 1.35) || 1.35));
export const WORLD_CUP_CAPTION_DESIGN_MODEL = process.env.WORLD_CUP_CAPTION_DESIGN_MODEL || VISUAL_REVIEW_MODEL;
export const WORLD_CUP_ASSET_SEARCH_MODEL = process.env.WORLD_CUP_ASSET_SEARCH_MODEL || "gemini-2.5-pro";
export const WORLD_CUP_ASSET_SEARCH_FALLBACK_MODELS = String(process.env.WORLD_CUP_ASSET_SEARCH_FALLBACK_MODELS || `${SEARCH_MODEL},gemini-2.5-flash-lite,gemini-2.5-flash`)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
export const WORLD_CUP_CAPTION_MIDSCREEN = cleanText(process.env.WORLD_CUP_CAPTION_MIDSCREEN || "off").toLowerCase();
export const WORLD_CUP_VISUAL_RETRY_ATTEMPTS = Math.max(0, Math.min(4, Number(process.env.WORLD_CUP_VISUAL_RETRY_ATTEMPTS || 2) || 2));
export const GEMINI_REQUEST_TIMEOUT_MS = Math.max(30000, Number(process.env.WORLD_CUP_GEMINI_REQUEST_TIMEOUT_MS || 120000) || 120000);
export const MEDIA_REQUEST_TIMEOUT_MS = Math.max(5000, Number(process.env.WORLD_CUP_MEDIA_REQUEST_TIMEOUT_MS || 20000) || 20000);
export const VISUAL_SCOUT_TIMEOUT_MS = Math.max(30000, Number(process.env.WORLD_CUP_VISUAL_SCOUT_TIMEOUT_MS || 180000) || 180000);
export const VISUAL_PREVIEW_TIMEOUT_MS = Math.max(3000, Number(process.env.WORLD_CUP_VISUAL_PREVIEW_TIMEOUT_MS || 8000) || 8000);
export const WORLD_CUP_MIN_REAL_VISUAL_RATIO = Math.max(0, Math.min(1, Number(process.env.WORLD_CUP_MIN_REAL_VISUAL_RATIO || 0.75) || 0.75));
export const WORLD_CUP_MIN_CLIP_RATIO = Math.max(0, Math.min(1, Number(process.env.WORLD_CUP_MIN_CLIP_RATIO || 0.55) || 0.55));
export const WORLD_CUP_MAX_IMAGE_SEGMENTS = Math.max(0, Math.min(4, Number(process.env.WORLD_CUP_MAX_IMAGE_SEGMENTS || 2) || 2));
export const WORLD_CUP_LOCAL_PROOF_MAX_PER_VIDEO = Math.max(0, Math.min(2, Number(process.env.WORLD_CUP_LOCAL_PROOF_MAX_PER_VIDEO || 1) || 1));
export const WORLD_CUP_ENABLE_LOCAL_ENTITY_ASSETS = normalizeBool(process.env.WORLD_CUP_ENABLE_LOCAL_ENTITY_ASSETS, true);
export const WORLD_CUP_LOCAL_ENTITY_MAX_ENTITIES = Math.max(0, Math.min(6, Number(process.env.WORLD_CUP_LOCAL_ENTITY_MAX_ENTITIES || 4) || 4));
export const WORLD_CUP_LOCAL_ENTITY_CANDIDATES_PER_ENTITY = Math.max(3, Math.min(12, Number(process.env.WORLD_CUP_LOCAL_ENTITY_CANDIDATES_PER_ENTITY || 10) || 10));
export const WORLD_CUP_LOCAL_ENTITY_SELECTIONS_PER_ENTITY = Math.max(1, Math.min(4, Number(process.env.WORLD_CUP_LOCAL_ENTITY_SELECTIONS_PER_ENTITY || 3) || 3));
export const WORLD_CUP_LOCAL_ENTITY_MIN_SCORE = Math.max(1, Math.min(10, Number(process.env.WORLD_CUP_LOCAL_ENTITY_MIN_SCORE || 6) || 6));
export const MAX_VIDEOS_PER_DAY = Number(process.env.WORLD_CUP_MAX_VIDEOS_PER_DAY || 3);
export const DEFAULT_SCHEDULE_HOURS = process.env.WORLD_CUP_SCHEDULE_HOURS || "9,15,21";
export const DEFAULT_UPLOAD_TARGET = process.env.WORLD_CUP_UPLOAD_TARGET || "auto";
export const GOOGLE_DRIVE_SCOPE = cleanText(process.env.GOOGLE_DRIVE_SCOPE || process.env.WORLD_CUP_GOOGLE_DRIVE_SCOPE || "https://www.googleapis.com/auth/drive");
export const WORLD_CUP_DRIVE_FALLBACK_TELEGRAM = normalizeBool(process.env.WORLD_CUP_DRIVE_FALLBACK_TELEGRAM, true);
export const WORLD_CUP_TELEGRAM_SEND_SIDECARS = normalizeBool(process.env.WORLD_CUP_TELEGRAM_SEND_SIDECARS, true);
export const WORLD_CUP_RESEARCH_PASSES = Math.max(1, Math.min(5, Number(process.env.WORLD_CUP_RESEARCH_PASSES || 4) || 4));
export const WORLD_CUP_ENABLE_BGM = normalizeBool(process.env.WORLD_CUP_ENABLE_BGM, true);
export const WORLD_CUP_BGM_MODE = cleanText(process.env.WORLD_CUP_BGM_MODE || "auto").toLowerCase();
export const WORLD_CUP_BGM_PRESET = normalizeWorldCupBgmPreset(process.env.WORLD_CUP_BGM_PRESET || "auto");
export const WORLD_CUP_BGM_FILE = process.env.WORLD_CUP_BGM_FILE || "";
export const WORLD_CUP_BGM_VOLUME = Math.min(0.35, Math.max(0.02, Number(process.env.WORLD_CUP_BGM_VOLUME || 0.18) || 0.18));
export const WORLD_CUP_CAPTION_PRESET = normalizeWorldCupCaptionPreset(process.env.WORLD_CUP_CAPTION_PRESET || "creator-yellow-pop");
export const GEMINI_RETRY_DELAYS_MS = String(process.env.WORLD_CUP_GEMINI_RETRY_DELAYS || "5000,10000,15000")
  .split(",")
  .map((delay) => Number(delay.trim()))
  .filter((delay) => Number.isFinite(delay) && delay > 0);
export const STOCK_VIDEO_HOSTS = new Set([
  "player.vimeo.com",
  "vod-progressive.akamaized.net",
  "videos.pexels.com",
  "static-videos.pexels.com",
  "images.pexels.com",
  "i.vimeocdn.com",
  "cdn.pixabay.com",
  "pixabay.com",
]);
export const WORLD_CUP_VOICES = [
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

export function loadLocalEnvFiles() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(repoRoot, fileName);
    if (!fsSync.existsSync(filePath)) {
      continue;
    }
    const lines = fsSync.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const equalsIndex = trimmed.indexOf("=");
      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

export const MAJOR_WORLD_CUP_ASSET_TARGETS = [
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

export const LOCAL_ENTITY_FOLDER_HINTS = [
  { name: "Lionel Messi", folder: "leomessi", type: "player", aliases: ["messi", "lionel messi", "leo messi"] },
  { name: "Cristiano Ronaldo", folder: "cristiano", type: "player", aliases: ["ronaldo", "cristiano", "cristiano ronaldo", "cr7"] },
  { name: "Argentina", folder: "afaseleccion", type: "team", aliases: ["argentina", "albiceleste", "la albiceleste"] },
  { name: "Portugal", folder: "portugal", type: "team", aliases: ["portugal", "portuguese"] },
  { name: "USMNT", folder: "usmnt", type: "team", aliases: ["usmnt", "usa", "united states", "america", "american"] },
  { name: "Christian Pulisic", folder: "cmpulisic", type: "player", aliases: ["pulisic", "christian pulisic"] },
  { name: "Weston McKennie", folder: "west.mckennie", type: "player", aliases: ["mckennie", "weston mckennie"] },
  { name: "Tyler Adams", folder: "tyler.adams", type: "player", aliases: ["tyler adams", "adams"] },
  { name: "Gio Reyna", folder: "gioareyna", type: "player", aliases: ["gio reyna", "reyna"] },
  { name: "Timothy Weah", folder: "timothyweah", type: "player", aliases: ["timothy weah", "weah"] },
  { name: "England", folder: "england", type: "team", aliases: ["england", "three lions"] },
  { name: "France", folder: "equipedefrance", type: "team", aliases: ["france", "les bleus"] },
  { name: "Kylian Mbappe", folder: "k.mbappe", type: "player", aliases: ["mbappe", "kylian mbappe"] },
  { name: "Brazil", folder: "cbf_futebol", type: "team", aliases: ["brazil", "brasil", "selecao", "seleção"] },
  { name: "Vinicius Junior", folder: "vinijr", type: "player", aliases: ["vinicius", "vini", "vini jr", "vinicius junior"] },
  { name: "Neymar", folder: "neymarjr", type: "player", aliases: ["neymar", "neymar jr"] },
  { name: "Germany", folder: "dfb_team", type: "team", aliases: ["germany", "dfb", "die mannschaft"] },
  { name: "Jamal Musiala", folder: "jamalmusiala10", type: "player", aliases: ["musiala", "jamal musiala"] },
  { name: "Florian Wirtz", folder: "flowirtz27", type: "player", aliases: ["wirtz", "florian wirtz"] },
  { name: "Spain", folder: "sefutbol", type: "team", aliases: ["spain", "la roja", "españa", "espana"] },
  { name: "Lamine Yamal", folder: "lamineyamal", type: "player", aliases: ["lamine yamal", "yamal"] },
  { name: "Pedri", folder: "pedri", type: "player", aliases: ["pedri"] },
  { name: "Mexico", folder: "miseleccionmx", type: "team", aliases: ["mexico", "méxico", "el tri"] },
  { name: "Canada", folder: "canadasoccer", type: "team", aliases: ["canada"] },
  { name: "Alphonso Davies", folder: "alphonsodavies", type: "player", aliases: ["alphonso davies", "davies"] },
  { name: "Netherlands", folder: "onsoranje", type: "team", aliases: ["netherlands", "oranje", "holland"] },
  { name: "Belgium", folder: "belgianreddevils", type: "team", aliases: ["belgium", "red devils"] },
  { name: "Kevin De Bruyne", folder: "kevindebruyne", type: "player", aliases: ["de bruyne", "kevin de bruyne", "kdb"] },
  { name: "Uruguay", folder: "aufoficial", type: "team", aliases: ["uruguay", "la celeste"] },
  { name: "Federico Valverde", folder: "fedevalverde", type: "player", aliases: ["valverde", "fede valverde", "federico valverde"] },
  { name: "Colombia", folder: "fcfseleccioncol", type: "team", aliases: ["colombia", "cafeteros"] },
  { name: "Morocco", folder: "equipedumaroc", type: "team", aliases: ["morocco", "maroc", "atlas lions"] },
  { name: "Achraf Hakimi", folder: "achrafhakimi", type: "player", aliases: ["hakimi", "achraf hakimi"] },
  { name: "Japan", folder: "japanfootballassociation", type: "team", aliases: ["japan", "samurai blue"] },
  { name: "South Korea", folder: "thekfa", type: "team", aliases: ["south korea", "korea", "kfa"] },
  { name: "Son Heung-min", folder: "hm_son7", type: "player", aliases: ["son", "heung-min son", "son heung-min"] },
  { name: "Senegal", folder: "footballsenegal", type: "team", aliases: ["senegal"] },
  { name: "Ghana", folder: "blackstarsofghana_", type: "team", aliases: ["ghana", "black stars"] },
  { name: "Nigeria", folder: "ng_supereagles", type: "team", aliases: ["nigeria", "super eagles"] },
  { name: "Australia", folder: "socceroos", type: "team", aliases: ["australia", "socceroos"] },
  { name: "Saudi Arabia", folder: "saudint", type: "team", aliases: ["saudi arabia", "saudi"] },
];

export const LOCAL_ENTITY_PREFERRED_IMAGES = {
  cristiano: ["image_10.jpg", "image_2.jpg", "image_1.jpg"],
  leomessi: ["image_2.jpg", "image_7.jpg", "image_1.jpg"],
};

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

export let cachedFfmpegPath = null;

export function nowIso() {
  return new Date().toISOString();
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function cleanText(value) {
  return String(value || "")
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac[\u0153\u009d]/g, '"')
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€“|â€”/g, "-")
    .replace(/Â/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanInputText(value) {
  if (value === true || value === false || value === null || value === undefined) {
    return "";
  }
  const cleaned = cleanText(value);
  return /^(?:true|false|null|undefined)$/i.test(cleaned) ? "" : cleaned;
}

export function repairCommonMojibake(value) {
  return String(value || "")
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac[\u0153\u009d]/g, '"')
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

export function slugify(value, fallback = "world-cup-short") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

export function safeFilePart(value, fallback = "asset") {
  return slugify(value, fallback).slice(0, 64);
}

export function normalizeBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return ["1", "true", "yes", "y", "on"].includes(String(value).trim().toLowerCase());
}

export function normalizeWorldCupStrategy(value) {
  const strategy = cleanText(value || "classic").toLowerCase();
  if (["viral", "viral2", "viral-2", "viral_2", "shorts2", "shorts-2"].includes(strategy)) {
    return "viral2";
  }
  return "classic";
}

export function normalizeWorldCupCaptionPreset(value) {
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

export function normalizeWorldCupBgmPreset(value) {
  const preset = cleanText(value || "auto").toLowerCase();
  if (["off", "none"].includes(preset)) {
    return "off";
  }
  if (["funny", "debate", "dramatic", "emotional", "analysis", "hype", "auto"].includes(preset)) {
    return preset;
  }
  return "auto";
}

export function isViral2(optionsOrRun = {}) {
  return normalizeWorldCupStrategy(optionsOrRun.strategy || optionsOrRun.contentStrategy || "classic") === "viral2";
}

export function stripTagsForSpeech(text) {
  return String(text || "")
    .replace(/^\s*\[[^\]]+\]\s*/gm, "")
    .replace(/\[Pause\s*\|\s*[\d.]+s\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashText(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

export function envGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

export function normalizeGeminiKeyStore(store) {
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

export async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getActiveGeminiKey() {
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

export function stockEnvKey(provider) {
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

export async function getActiveStockKey(provider) {
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

export async function ensureWorldCupDirs() {
  await fs.mkdir(runsRoot, { recursive: true });
  await fs.mkdir(tempRoot, { recursive: true });
  await fs.mkdir(bgmRoot, { recursive: true });
  await fs.mkdir(assetPackRoot, { recursive: true });
  await fs.mkdir(localEntityPreviewRoot, { recursive: true });
}

export async function resolveFfmpegPath() {
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

export async function hasFfmpeg() {
  try {
    await resolveFfmpegPath();
    return true;
  } catch {
    return false;
  }
}

export function classifyGeminiError(data, status, model) {
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

export function extractJson(text) {
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

export function extractGroundingSources(groundingMetadata) {
  const chunks = Array.isArray(groundingMetadata?.groundingChunks) ? groundingMetadata.groundingChunks : [];
  return chunks
    .map((chunk) => chunk.web)
    .filter((web) => web?.uri)
    .map((web) => ({ title: cleanText(web.title || "Source"), uri: String(web.uri || "") }))
    .slice(0, 12);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTimeout(promise, ms, label) {
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

export async function fetchWithTimeout(url, options = {}, timeoutMs = MEDIA_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export let activeWorldCupApiUsage = null;

export function createApiUsageLedger() {
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

export function recordApiUsage({ provider = "other", model = "", operation = "", status = "success", count = 1, details = null } = {}) {
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

export function isHardGeminiQuotaError(error) {
  const text = `${error?.message || ""} ${JSON.stringify(error?.details || {})}`.toLowerCase();
  return /limit:\s*0/.test(text) || /free_tier.*limit:\s*0/.test(text);
}

export function isRetryableGeminiError(error) {
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

export async function requestGeminiGenerateContent({ keyInfo, model, body }) {
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

export async function requestGeminiJson({ keyInfo, model, prompt, temperature = 0.6, search = false, parts = null }) {
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

export async function requestGeminiText({ keyInfo, model, prompt, temperature = 0.45, search = false }) {
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

export async function requestGeminiJsonWithFallbacks({ keyInfo, primaryModel, fallbackModels = [], prompt, temperature = 0.6, search = false, parts = null }) {
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

export async function requestGeminiTextWithFallbacks({ keyInfo, primaryModel, fallbackModels = [], prompt, temperature = 0.45, search = false }) {
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

export function createWavBuffer(pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
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

export function wavDurationSeconds(buffer) {
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

export async function synthesizeWorldCupAudio({ keyInfo, screenplay, voice, mood }) {
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


export function normalizeWorldCupInput(input = {}) {
  const type = String(input.type || input.mode || "pre-tournament").trim().toLowerCase();
  const strategy = normalizeWorldCupStrategy(input.strategy || input.contentStrategy || DEFAULT_WORLD_CUP_STRATEGY);
  const teamA = cleanInputText(input.teamA || input.team_a || input.match?.teamA || input.match?.homeTeam || "");
  const teamB = cleanInputText(input.teamB || input.team_b || input.match?.teamB || input.match?.awayTeam || "");
  const date = (cleanInputText(input.date || input.match?.date || "") || todayDate()).slice(0, 10);
  const matchId = cleanInputText(input.matchId || input.match_id || input.match?.id || "");
  const topic =
    cleanInputText(input.topic) ||
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
      kickoff: cleanInputText(input.kickoff || input.match?.kickoff || ""),
      teamA,
      teamB,
      competition: cleanInputText(input.competition || input.match?.competition || "") || "FIFA World Cup 2026",
      venue: cleanInputText(input.venue || input.match?.venue || ""),
    },
    audience: cleanInputText(input.audience) || "US, Europe, and South America football fans",
    language: cleanInputText(input.language) || DEFAULT_LANGUAGE,
    render: normalizeBool(input.render, false),
    upload: normalizeBool(input.upload, false),
    offline: normalizeBool(input.offline, false),
    generateAudio: normalizeBool(input.generateAudio, true),
    source: cleanInputText(input.source) || "auto",
    bgm: normalizeBool(input.bgm ?? input.backgroundMusic, WORLD_CUP_ENABLE_BGM),
    bgmFile: cleanInputText(input.bgmFile || input.backgroundMusicFile || WORLD_CUP_BGM_FILE),
    bgmMode: (cleanInputText(input.bgmMode) || WORLD_CUP_BGM_MODE || "auto").toLowerCase(),
    bgmPreset: normalizeWorldCupBgmPreset(input.bgmPreset || input.musicPreset || WORLD_CUP_BGM_PRESET),
    bgmVolume: Math.min(0.35, Math.max(0.02, Number(input.bgmVolume || WORLD_CUP_BGM_VOLUME) || WORLD_CUP_BGM_VOLUME)),
    captionMidScreen: (cleanInputText(input.captionMidScreen || input.midScreenCaptions) || WORLD_CUP_CAPTION_MIDSCREEN || "off").toLowerCase(),
    captionPreset: normalizeWorldCupCaptionPreset(input.captionPreset || input.captionStyle || WORLD_CUP_CAPTION_PRESET),
    captionDesign: normalizeBool(input.captionDesign ?? input.smartCaptions, true),
    commentaryText: String(input.commentaryText || ""),
    commentaryUrl: cleanText(input.commentaryUrl || ""),
    durationSeconds: Math.max(25, Math.min(65, Number(input.durationSeconds || 48) || 48)),
  };
}


export function setActiveWorldCupApiUsage(ledger) {
  activeWorldCupApiUsage = ledger;
}

export function getActiveWorldCupApiUsage() {
  return activeWorldCupApiUsage;
}
