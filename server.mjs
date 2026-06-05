import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  generateWorldCupRun,
  listWorldCupRuns,
  readWorldCupRun,
  renderWorldCupRun,
  resolveWorldCupAsset,
  uploadWorldCupRun,
  worldCupConfigSummary,
} from "./worldcup/pipeline.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const geminiKeyStorePath = path.join(__dirname, ".gemini-keys.json");
const stockKeyStorePath = path.join(__dirname, ".stock-keys.json");
const voiceTempRoot = path.join(__dirname, ".tmp-audio");
const stockTempRoot = path.join(__dirname, ".tmp-stock-video");
const port = Number(process.env.PORT || 3000);
const execFileAsync = promisify(execFile);
const MAX_SAVED_GEMINI_KEYS = 4;
const MAX_SAVED_STOCK_KEYS = 4;
const portableFfmpegPath = "C:\\tmp\\ffmpeg-portable\\bin\\ffmpeg.exe";
let cachedFfmpegPath = null;
const STOCK_VIDEO_WIDTH = 1080;
const STOCK_VIDEO_HEIGHT = 1920;
const STOCK_VIDEO_FPS = 30;
const STOCK_VIDEO_PROVIDERS = ["pexels", "pixabay"];
const STOCK_VIDEO_HOSTS = new Set([
  "player.vimeo.com",
  "vod-progressive.akamaized.net",
  "videos.pexels.com",
  "static-videos.pexels.com",
  "images.pexels.com",
  "cdn.pixabay.com",
  "pixabay.com",
]);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const GEMINI_TTS_MODELS = [
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
];

const STORYBOARD_MODEL = "gemini-2.5-flash";
const SCRIPT_REWRITE_MODEL = "gemini-3-flash-preview";
const SCRIPT_STUDIO_RESEARCH_MODEL = "gemini-2.5-flash";
const SCRIPT_STUDIO_WRITER_MODEL = SCRIPT_REWRITE_MODEL;
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

const GEMINI_MODEL_LABELS = {
  "gemini-3.1-flash-tts-preview": "Gemini 3.1 Flash TTS Preview",
  "gemini-2.5-flash-preview-tts": "Gemini 2.5 Flash TTS Preview",
  "gemini-2.5-pro-preview-tts": "Gemini 2.5 Pro TTS Preview",
};

const GOOGLE_VOICE_OPTIONS = [
  { id: "Zephyr", label: "Zephyr", trait: "Bright" },
  { id: "Puck", label: "Puck", trait: "Upbeat" },
  { id: "Charon", label: "Charon", trait: "Informative" },
  { id: "Kore", label: "Kore", trait: "Firm" },
  { id: "Fenrir", label: "Fenrir", trait: "Excitable" },
  { id: "Leda", label: "Leda", trait: "Youthful" },
  { id: "Orus", label: "Orus", trait: "Firm" },
  { id: "Aoede", label: "Aoede", trait: "Breezy" },
  { id: "Callirrhoe", label: "Callirrhoe", trait: "Easy-going" },
  { id: "Autonoe", label: "Autonoe", trait: "Bright" },
  { id: "Enceladus", label: "Enceladus", trait: "Breathy" },
  { id: "Iapetus", label: "Iapetus", trait: "Clear" },
  { id: "Umbriel", label: "Umbriel", trait: "Easy-going" },
  { id: "Algieba", label: "Algieba", trait: "Smooth" },
  { id: "Despina", label: "Despina", trait: "Smooth" },
  { id: "Erinome", label: "Erinome", trait: "Clear" },
  { id: "Algenib", label: "Algenib", trait: "Gravelly" },
  { id: "Rasalgethi", label: "Rasalgethi", trait: "Informative" },
  { id: "Laomedeia", label: "Laomedeia", trait: "Upbeat" },
  { id: "Achernar", label: "Achernar", trait: "Soft" },
  { id: "Alnilam", label: "Alnilam", trait: "Firm" },
  { id: "Schedar", label: "Schedar", trait: "Even" },
  { id: "Gacrux", label: "Gacrux", trait: "Mature" },
  { id: "Pulcherrima", label: "Pulcherrima", trait: "Forward" },
  { id: "Achird", label: "Achird", trait: "Friendly" },
  { id: "Zubenelgenubi", label: "Zubenelgenubi", trait: "Casual" },
  { id: "Vindemiatrix", label: "Vindemiatrix", trait: "Gentle" },
  { id: "Sadachbia", label: "Sadachbia", trait: "Lively" },
  { id: "Sadaltager", label: "Sadaltager", trait: "Knowledgeable" },
  { id: "Sulafat", label: "Sulafat", trait: "Warm" },
];

const GOOGLE_VOICES = GOOGLE_VOICE_OPTIONS.map((voice) => voice.id);

const NVIDIA_TTS_MODELS = [
  {
    id: "magpie-tts-multilingual",
    label: "Magpie TTS Multilingual",
    supportsHindi: true,
    note: "Hindi-capable model; currently shown by NVIDIA as downloadable/self-hosted rather than a simple hosted REST endpoint.",
  },
  {
    id: "magpie-tts-zeroshot",
    label: "Magpie TTS Zeroshot",
    supportsHindi: false,
    note: "Free endpoint, expressive voice cloning, but public docs list English support only.",
  },
];

const NVIDIA_VOICES = [
  "hi-IN Female",
  "hi-IN Male",
  "Magpie-ZeroShot.Female-1",
  "Magpie-ZeroShot.Female-Calm",
  "Magpie-ZeroShot.Female-Fearful",
  "Magpie-ZeroShot.Male-1",
  "Magpie-ZeroShot.Male-Calm",
  "Magpie-ZeroShot.Male-Fearful",
  "Magpie-ZeroShot.Male-Angry",
];

const MOODS = [
  {
    id: "none",
    label: "None",
    description: "No global voice mood; follow script tags and custom direction.",
    prompt: "",
  },
  {
    id: "thriller",
    label: "Thriller",
    description: "Mysterious start, rising suspense, fear, urgency, and dramatic pauses.",
    prompt:
      "Read as a gripping thriller narrator: start calm and mysterious, build suspense, add fear and urgency, use dramatic pauses, and keep the listener emotionally invested",
  },
  {
    id: "emotional",
    label: "Emotional",
    description: "Intimate story delivery with warmth, ache, and a memorable final line.",
    prompt:
      "Read emotionally like an intense story scene, with natural pauses, rising tension, vulnerability, and a memorable final line",
  },
  {
    id: "documentary",
    label: "Documentary",
    description: "Calm, grounded, informative narration.",
    prompt: "Read like a calm documentary narrator with authority, warmth, and natural pacing",
  },
  {
    id: "youtube",
    label: "YouTube",
    description: "High-energy intro style with excitement and punch.",
    prompt: "Read with high energy, like a Hindi YouTube story intro, while staying natural and clear",
  },
  {
    id: "horror",
    label: "Horror",
    description: "Low, tense, unsettling delivery with controlled fear.",
    prompt:
      "Read as a chilling horror storyteller: quiet tension, whispered dread, sharp pauses, and a frightening final beat",
  },
  {
    id: "calm",
    label: "Calm",
    description: "Slow, clear, soothing voice for clean narration.",
    prompt: "Read slowly and clearly in a calm, soothing Hindi voice with clean pronunciation",
  },
];

const REWRITE_MOODS = [
  {
    id: "suspense",
    label: "Suspense",
    description: "Tense, hook-heavy, full of pauses and reveals.",
    prompt: "suspenseful, tense, hook-heavy, cinematic, with pauses, secrets, and reveals",
  },
  {
    id: "horror",
    label: "Horror",
    description: "Fearful, eerie, unsettling, non-graphic.",
    prompt: "atmospheric horror, fearful, eerie, unsettling, non-graphic, with whispered dread",
  },
  {
    id: "funny",
    label: "Funny",
    description: "Light, witty, comic timing.",
    prompt: "funny, witty, conversational, with comic timing and playful reactions",
  },
  {
    id: "energetic",
    label: "Energetic",
    description: "Fast, bold, punchy reel delivery.",
    prompt: "energetic, fast-paced, bold, punchy, made for short-form retention",
  },
  {
    id: "podcast",
    label: "Podcast",
    description: "Natural two-person discussion.",
    prompt: "natural podcast conversation, curious, grounded, with realistic back-and-forth",
  },
  {
    id: "emotional",
    label: "Emotional",
    description: "Intimate, dramatic, heartfelt.",
    prompt: "emotional, intimate, dramatic, heartfelt, with vulnerable pauses",
  },
  {
    id: "thriller",
    label: "Thriller",
    description: "Cinematic danger and rising tension.",
    prompt: "cinematic thriller, dangerous, urgent, mysterious, with rising tension",
  },
];

const IMAGE_MOODS = [
  {
    id: "kids-cartoon",
    label: "Kids Cartoon",
    description: "Bright safe Indian cartoon visuals for children, animals, friendship, school, and adventure.",
    prompt:
      "safe Indian kids cartoon look, colorful 3D/2D hybrid animation, cute expressive characters, rounded shapes, playful animals, friendly school or home or festival settings, bright balanced palette, clean composition, no scary visuals, no text in image",
  },
  {
    id: "psychological-sketch",
    label: "Psych Sketch",
    description: "Dark symbolic sketch frames for psychology, thoughts, fear, and inner conflict.",
    prompt:
      "dark psychological sketch illustration, charcoal and ink texture, minimal muted color accents, symbolic visual metaphors, shadowy negative space, expressive but not photorealistic, premium editorial reel art",
  },
  {
    id: "abstract-metaphor",
    label: "Abstract",
    description: "Conceptual metaphor visuals for mindset, motivation, and ideas.",
    prompt:
      "conceptual visual metaphor, surreal editorial illustration, dark background, symbolic objects, no literal talking heads, cohesive minimal palette, cinematic shadow and light, high-retention short-form frame",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    description: "Premium short-film realism with dramatic light and crisp frames.",
    prompt: "cinematic realistic Indian short film, premium lighting, crisp 9:16 vertical composition, natural faces, detailed environment",
  },
  {
    id: "thriller",
    label: "Thriller",
    description: "Suspense, shadows, tension, and visual hooks.",
    prompt: "psychological thriller visual language, tense shadows, suspenseful framing, mysterious atmosphere, rich contrast",
  },
  {
    id: "emotional",
    label: "Emotional",
    description: "Close character moments with expressive faces and warm realism.",
    prompt: "emotional cinematic realism, expressive faces, intimate closeups, warm practical lighting, grounded Indian setting",
  },
  {
    id: "relationship-drama",
    label: "Relationship",
    description: "Love, breakup, affairs, jealousy, and personal emotional drama.",
    prompt:
      "personalized relationship drama visuals, intimate Indian love story mood, breakup melancholy, secret affair tension, emotional closeups, rain-window lighting, phone glow without readable text, personal objects, soft shadows, tasteful non-explicit romance",
  },
  {
    id: "horror",
    label: "Horror",
    description: "Chilling, unsettling, non-graphic fear.",
    prompt: "atmospheric horror, unsettling shadows, eerie empty spaces, non-graphic fear, controlled dread, cinematic realism",
  },
  {
    id: "documentary",
    label: "Documentary",
    description: "Natural, grounded, factual visual storytelling.",
    prompt: "documentary realism, authentic Indian locations, natural light, observational camera, believable people and spaces",
  },
  {
    id: "mythic",
    label: "Mythic",
    description: "Epic, symbolic, larger-than-life drama.",
    prompt: "mythic cinematic Indian drama, symbolic lighting, epic composition, rich textures, emotionally heightened realism",
  },
];

const PROMPT_QUALITY_MODES = [
  {
    id: "fast",
    label: "Fast",
    description: "Shorter usable prompts for quick batches.",
    prompt: "fast practical Flow prompts, concise but clear visual detail, simple production language",
    rules: [
      "Keep each prompt compact, around 70 to 110 words.",
      "Prioritize the subject, setting, lighting, expression, and one strong visual hook.",
      "Avoid overloading the prompt with too many camera or texture details.",
    ],
  },
  {
    id: "detailed",
    label: "Detailed",
    description: "Balanced cinematic prompts for most reels.",
    prompt: "detailed cinematic Flow prompts with clear standalone character, scene, lighting, camera, emotion, and composition",
    rules: [
      "Write each prompt around 110 to 160 words.",
      "Include subject, clothing, expression, setting, time of day, lighting, camera angle, mood, foreground, and background.",
      "Make every prompt complete enough to work without seeing any other prompt.",
    ],
  },
  {
    id: "conceptual-sketch",
    label: "Conceptual sketch",
    description: "Best for psychology, motivation, mindset, and abstract inner-conflict reels.",
    prompt:
      "conceptual dark sketch prompt mode, symbolic metaphor over literal people, charcoal and ink style continuity, recurring motifs, editorial psychology visuals",
    rules: [
      "Write prompts around 110 to 170 words with a clear symbolic object or faceless silhouette motif.",
      "Do not create random realistic people; if a person is needed, use the same anonymous faceless silhouette described fully each time.",
      "Use dark sketch, charcoal, ink, paper texture, shadow, negative space, and one muted accent color for continuity.",
      "Make the visual metaphor understandable instantly on a phone screen.",
    ],
  },
  {
    id: "ultra-cinematic",
    label: "Ultra cinematic",
    description: "Heavier film-director prompts with lens and lighting detail.",
    prompt: "premium ultra-cinematic Indian short-film look, production-grade lighting, lens language, rich atmosphere, polished composition",
    rules: [
      "Write each prompt around 140 to 190 words.",
      "Use film language: shot size, lens feel, depth of field, practical light source, color contrast, foreground layering, and emotional blocking.",
      "Every frame should feel like a crisp still from a high-budget short film.",
    ],
  },
  {
    id: "consistent-character",
    label: "Consistent character",
    description: "Repeats full character details so separate image generations match better.",
    prompt: "character-consistency focused prompts with repeated full identity details, stable clothing, face, age, posture, and environment cues",
    rules: [
      "Repeat the full recurring character description in every prompt: age, gender, face, hair, clothing, expression, posture, and key prop.",
      "Use the same clothing, physical traits, and environment cues unless the story clearly changes them.",
      "Never depend on character names alone; each prompt must stand independently.",
    ],
  },
  {
    id: "horror-realism",
    label: "Horror realism",
    description: "Grounded Indian horror frames without gore.",
    prompt: "grounded Indian horror realism, believable home details, low light, dread, uneasy shadows, non-graphic fear",
    rules: [
      "Make fear feel realistic and atmospheric, not fantasy-heavy or gory.",
      "Use believable Indian locations, practical light sources, shadows, empty space, and restrained dread.",
      "Keep faces natural, expressions tense, and the reveal visually clear without graphic violence.",
    ],
  },
  {
    id: "youtube-thumbnail",
    label: "YouTube thumbnail",
    description: "Bold, readable frames with a clear hook, but no text inside images.",
    prompt: "YouTube Shorts thumbnail-ready composition, bold focal subject, expressive face, high contrast, clear visual hook, vivid but realistic color",
    rules: [
      "Create a simple high-impact frame with one obvious subject and one dramatic hook.",
      "Use expressive faces, strong contrast, clean background separation, and readable composition for phone screens.",
      "Do not include text, captions, arrows, logos, UI, speech bubbles, or thumbnail graphics inside the image.",
    ],
  },
  {
    id: "kids-cartoon-flow",
    label: "Kids cartoon",
    description: "Standalone Flow prompts for child-safe Indian cartoon episodes.",
    prompt:
      "child-safe Indian cartoon prompt mode, bright but not chaotic colors, cute rounded characters, expressive faces, readable action, local Indian home school park festival settings, moral story clarity",
    rules: [
      "Write each prompt around 120 to 170 words with one clear action that a child can understand instantly.",
      "Repeat the full recurring character description in every prompt: age, species if animal, face, clothing, colors, personality, key prop, and safe expression.",
      "Use bright balanced colors, rounded shapes, clean backgrounds, playful props, and friendly Indian details such as school bag, courtyard, kite, tiffin, mango tree, rangoli, bicycle, or festival lights when relevant.",
      "Keep visuals non-scary, non-violent, non-romantic, and safe for young children. No weapons, gore, bullying humiliation, dangerous stunts, creepy faces, text, logos, or speech bubbles.",
      "Prefer entertainment-first moments with gentle learning: friendship, sharing, courage, honesty, curiosity, problem solving, family warmth, animals, music, rhythm, and repeatable catchphrases.",
    ],
  },
];

const SCRIPT_CATEGORIES = [
  {
    id: "kids-cartoon",
    label: "Kids Cartoon",
    description: "Safe Indian children's cartoon stories with fun, friendship, and a gentle lesson.",
    prompt:
      "Indian children's cartoon storytelling for ages 5-10: entertainment first, simple conflict, cute recurring characters, humor, music or repeatable phrase, friendship, family warmth, animals or school adventure, gentle moral, no fear, no violence, no unsafe behavior",
  },
  {
    id: "psychology",
    label: "Psychology",
    description: "Human behavior, thinking traps, emotions, and everyday mind patterns.",
    prompt:
      "psychology content rooted in relatable behavior, cognitive bias, emotion, relationships with self, and everyday examples; avoid medical diagnosis or therapy claims",
  },
  {
    id: "real-story",
    label: "Real Story",
    description: "True-story style narration with facts, stakes, and a memorable turn.",
    prompt:
      "real-story style narration with grounded details, clear timeline, human stakes, curiosity gaps, and a responsible distinction between verified facts and dramatized narration",
  },
  {
    id: "motivation",
    label: "Motivation",
    description: "Short inspirational reels with practical, non-generic emotional punch.",
    prompt:
      "motivational short-form content that feels specific, honest, practical, emotionally charged, and avoids generic hustle clichés",
  },
  {
    id: "horror",
    label: "Horror",
    description: "Suspense, fear, eerie reveals, and non-graphic Hindi storytelling.",
    prompt:
      "Hindi horror storytelling with atmosphere, suspense, slow reveals, sensory details, and non-graphic fear that keeps viewers listening",
  },
  {
    id: "crime-mystery",
    label: "Crime Mystery",
    description: "Mystery and investigation-style reels without unsafe instructions.",
    prompt:
      "crime mystery narration focused on suspense, clues, consequences, and ethical storytelling; avoid instructional criminal details or graphic violence",
  },
  {
    id: "relationship",
    label: "Relationship",
    description: "Love, friendship, family, heartbreak, and social behavior stories.",
    prompt:
      "relationship content with emotional truth, conflict, psychology, subtle lessons, and realistic Hindi conversational phrasing",
  },
  {
    id: "mythology",
    label: "Mythology",
    description: "Indian mythology and symbolic lessons for modern audiences.",
    prompt:
      "Indian mythology content that is respectful, cinematic, symbolic, and connects ancient stories to modern human lessons",
  },
  {
    id: "history",
    label: "History",
    description: "Historical facts and stories with cinematic short-form pacing.",
    prompt:
      "history storytelling with accurate context, surprising details, human stakes, and a cinematic arc without inventing fake facts",
  },
  {
    id: "business",
    label: "Business",
    description: "Founder, money, career, startup, and market stories.",
    prompt:
      "business and career storytelling with sharp hooks, practical insight, market psychology, founder decisions, and clear audience takeaway",
  },
];

const SCRIPT_TONES = [
  { id: "playful", label: "Playful", prompt: "warm, funny, curious, child-safe, lively, easy to understand, with a repeatable catchphrase" },
  { id: "suspense", label: "Suspense", prompt: "suspenseful, curiosity-driven, controlled tension, strong payoff" },
  { id: "emotional", label: "Emotional", prompt: "warm, intimate, heartfelt, human, memorable final line" },
  { id: "energetic", label: "Energetic", prompt: "fast, punchy, confident, reel-native, high-retention" },
  { id: "calm", label: "Calm", prompt: "clear, grounded, soothing, slow enough for comprehension" },
  { id: "horror", label: "Horror", prompt: "low, eerie, unsettling, pause-heavy, non-graphic dread" },
  { id: "funny", label: "Funny", prompt: "witty, playful, conversational, light but still useful" },
  { id: "documentary", label: "Documentary", prompt: "credible, observational, factual, calm but engaging" },
];

const SCRIPT_CONTENT_TYPES = [
  {
    id: "kids-cartoon",
    label: "Kids Cartoon",
    description: "Child-safe cartoon episode script for Indian kids.",
    prompt:
      "kids cartoon episode: entertainment first, simple language, fast visible problem, cute recurring hero, playful dialogue, repeatable phrase, gentle humor, safe stakes, clear moral payoff, no scary intensity, no romance, no violence",
  },
  {
    id: "reel",
    label: "Reel / Short",
    description: "Fast short-form narration for Instagram Reels and YouTube Shorts.",
    prompt:
      "short-form reel/short: hook must land in the first 1-2 seconds, no slow setup, no long whisper intro, short lines, fast clarity, energetic but natural delivery",
  },
  {
    id: "long-story",
    label: "Long story",
    description: "Longer narrated story that can breathe while staying clear.",
    prompt:
      "long narrated story: allow atmosphere and slower emotional beats, but keep every scene moving and avoid dragging the opening",
  },
  {
    id: "podcast",
    label: "Podcast",
    description: "Conversational explanation or dialogue-style audio.",
    prompt:
      "podcast-style narration: conversational, natural, clear, thoughtful, with clean transitions and no overacting",
  },
  {
    id: "documentary",
    label: "Documentary",
    description: "Calm factual storytelling with authority.",
    prompt:
      "documentary-style voiceover: grounded, credible, precise, calm but not sleepy, with clear emphasis on important facts",
  },
];

const SCRIPT_ENERGIES = [
  {
    id: "low",
    label: "Low",
    description: "Calm and controlled.",
    prompt: "low energy: calm, controlled, intimate, slower than average, no shouting",
  },
  {
    id: "medium",
    label: "Medium",
    description: "Balanced reel-native delivery.",
    prompt: "medium energy: clear, focused, natural short-form pace, emotionally present without overacting",
  },
  {
    id: "high",
    label: "High",
    description: "Punchy and fast for hooks.",
    prompt: "high energy: punchy, confident, fast hook, crisp lines, strong emphasis, still natural and non-cartoonish",
  },
];

const SCRIPT_DURATIONS = [
  { id: "30", label: "30 sec", seconds: 30, targetWords: "70-85", targetCharacters: "450-800" },
  { id: "45", label: "45 sec", seconds: 45, targetWords: "105-125", targetCharacters: "700-1050" },
  { id: "60", label: "60 sec", seconds: 60, targetWords: "140-165", targetCharacters: "950-1350" },
  { id: "90", label: "90 sec", seconds: 90, targetWords: "210-245", targetCharacters: "1400-2000" },
  { id: "120", label: "2 min", seconds: 120, targetWords: "280-330", targetCharacters: "1900-2600" },
  { id: "180", label: "3 min", seconds: 180, targetWords: "420-500", targetCharacters: "2800-3600" },
  { id: "240", label: "4 min", seconds: 240, targetWords: "560-650", targetCharacters: "3500-4200" },
  { id: "300", label: "5 min", seconds: 300, targetWords: "650-760", targetCharacters: "4000-4500" },
];

const SCRIPT_TEMPLATES = [
  {
    id: "custom",
    label: "Custom",
    category: "",
    tone: "",
    scriptMode: "advanced-narrator",
    description: "Use the selected category and tone without a fixed formula.",
    formula:
      "No fixed template. Build the structure from the user's topic, chosen category, tone, and research context.",
  },
  {
    id: "kids-cartoon-adventure",
    label: "Kids cartoon adventure",
    category: "kids-cartoon",
    tone: "playful",
    contentType: "kids-cartoon",
    scriptMode: "advanced-narrator",
    imageMood: "kids-cartoon",
    promptQuality: "kids-cartoon-flow",
    imageStyle:
      "Create a child-safe Indian cartoon episode look: cute rounded recurring characters, bright balanced colors, clean readable backgrounds, playful home/school/park/festival details, gentle humor, no scary or unsafe visuals.",
    description: "Child-safe Indian cartoon story with a cute hero, visual comedy, and a gentle lesson.",
    formula:
      "Structure: 1) cheerful hook with cute hero and repeatable phrase, 2) simple everyday problem at home, school, park, or festival, 3) funny failed attempt, 4) friend/family/animal helps with kindness or cleverness, 5) colorful payoff and gentle moral. Keep it safe, visual, musical, and easy for ages 5-10.",
  },
  {
    id: "psychology-dark-hook",
    label: "Psychology dark hook",
    category: "psychology",
    tone: "suspense",
    scriptMode: "advanced-narrator",
    description: "A dark psychology reel with a curiosity hook and personal realization.",
    formula:
      "Structure: 1) unsettling question about a common mental pattern, 2) relatable everyday example, 3) hidden mechanism explained simply, 4) emotional mirror moment, 5) one practical line or memorable warning. Use symbolic tension, not medical claims.",
  },
  {
    id: "relationship-heartbreak",
    label: "Relationship heartbreak",
    category: "relationship",
    tone: "emotional",
    scriptMode: "advanced-narrator",
    description: "Love, breakup, affairs, and attachment content with a personal emotional arc.",
    formula:
      "Structure: 1) one intimate relationship truth, 2) a specific moment like late-night message, silence, apology, betrayal, or memory, 3) emotional contradiction, 4) painful realization, 5) final line that feels personal and shareable. Avoid generic love quotes.",
  },
  {
    id: "real-story-suspense",
    label: "Real story suspense",
    category: "real-story",
    tone: "suspense",
    scriptMode: "advanced-narrator",
    description: "True-story style narration with grounded facts and a slow reveal.",
    formula:
      "Structure: 1) shocking but responsible opening fact, 2) who/where/when with concrete detail, 3) rising complication, 4) reveal or turning point, 5) consequence and reflection. Clearly avoid inventing facts when sources are weak.",
  },
  {
    id: "motivation-punch",
    label: "Motivation punch",
    category: "motivation",
    tone: "energetic",
    scriptMode: "advanced-narrator",
    description: "Short practical motivation without cringe or empty hustle lines.",
    formula:
      "Structure: 1) direct challenge, 2) expose a self-sabotage pattern, 3) one specific example, 4) punchy mindset shift, 5) concrete action line. Keep it sharp, honest, and non-generic.",
  },
  {
    id: "horror-twist",
    label: "Horror twist",
    category: "horror",
    tone: "horror",
    scriptMode: "advanced-narrator",
    description: "Hindi horror story with atmosphere, pauses, and a final twist.",
    formula:
      "Structure: 1) ordinary scene with one wrong detail, 2) repeated sound/object/light, 3) character ignores warning, 4) reveal that changes the meaning of earlier detail, 5) final chilling line. Keep fear non-graphic and audio-first.",
  },
  {
    id: "business-lesson",
    label: "Business lesson",
    category: "business",
    tone: "documentary",
    scriptMode: "advanced-narrator",
    description: "Founder, career, money, or market lesson with a clean takeaway.",
    formula:
      "Structure: 1) surprising business decision or mistake, 2) market/customer psychology behind it, 3) stakes and tradeoff, 4) what changed, 5) one practical lesson for creators, founders, or professionals.",
  },
  {
    id: "crime-mystery",
    label: "Crime mystery",
    category: "crime-mystery",
    tone: "suspense",
    scriptMode: "advanced-narrator",
    description: "Mystery reel built around clues, contradiction, and consequence.",
    formula:
      "Structure: 1) mystery hook, 2) clue one, 3) contradiction, 4) overlooked detail, 5) reveal or unresolved question with ethical framing. Avoid graphic violence and never include criminal instructions.",
  },
];

class AppError extends Error {
  constructor(message, { status = 500, code = "APP_ERROR", provider = null, model = null, keyId = null, details = null } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.provider = provider;
    this.model = model;
    this.keyId = keyId;
    this.details = details;
  }
}

function envGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function maskApiKey(key) {
  const trimmed = String(key || "").trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 10) {
    return `${trimmed.slice(0, 3)}...`;
  }
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function normalizeGeminiKeyStore(store) {
  const slots = Array.isArray(store?.slots)
    ? store.slots
        .filter((slot) => slot?.apiKey)
        .slice(0, MAX_SAVED_GEMINI_KEYS)
        .map((slot, index) => ({
          id: String(slot.id || `slot-${index + 1}`),
          label: String(slot.label || `Gemini key ${index + 1}`),
          apiKey: String(slot.apiKey || "").trim(),
          createdAt: slot.createdAt || new Date().toISOString(),
          updatedAt: slot.updatedAt || slot.createdAt || new Date().toISOString(),
        }))
    : [];

  const activeKeyId = store?.activeKeyId || (envGeminiKey() ? "env" : slots[0]?.id || null);
  return { activeKeyId, slots };
}

async function loadGeminiKeyStore() {
  try {
    const raw = await fs.readFile(geminiKeyStorePath, "utf8");
    return normalizeGeminiKeyStore(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") {
      return normalizeGeminiKeyStore({});
    }
    throw new AppError("Unable to read saved Gemini key settings.", {
      status: 500,
      code: "KEY_STORE_READ_FAILED",
      details: error.message,
    });
  }
}

async function saveGeminiKeyStore(store) {
  const normalized = normalizeGeminiKeyStore(store);
  await fs.writeFile(geminiKeyStorePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

function publicGeminiKeys(store) {
  const keys = [];
  const envKey = envGeminiKey();
  if (envKey) {
    keys.push({
      id: "env",
      label: "Default .env key",
      masked: maskApiKey(envKey),
      source: ".env",
      readOnly: true,
      active: store.activeKeyId === "env" || !store.activeKeyId,
    });
  }

  for (const slot of store.slots) {
    keys.push({
      id: slot.id,
      label: slot.label,
      masked: maskApiKey(slot.apiKey),
      source: "saved",
      readOnly: false,
      active: store.activeKeyId === slot.id,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
    });
  }

  return {
    activeKeyId: resolveActiveGeminiKey(store)?.id || null,
    maxSavedKeys: MAX_SAVED_GEMINI_KEYS,
    keys,
  };
}

function resolveActiveGeminiKey(store) {
  const envKey = envGeminiKey();
  if (store.activeKeyId && store.activeKeyId !== "env") {
    const activeSlot = store.slots.find((slot) => slot.id === store.activeKeyId && slot.apiKey);
    if (activeSlot) {
      return { id: activeSlot.id, label: activeSlot.label, apiKey: activeSlot.apiKey, source: "saved" };
    }
  }

  if (envKey) {
    return { id: "env", label: "Default .env key", apiKey: envKey, source: ".env" };
  }

  const firstSlot = store.slots.find((slot) => slot.apiKey);
  return firstSlot ? { id: firstSlot.id, label: firstSlot.label, apiKey: firstSlot.apiKey, source: "saved" } : null;
}

async function getActiveGeminiKey() {
  const store = await loadGeminiKeyStore();
  return resolveActiveGeminiKey(store);
}

async function updateGeminiKeys(actionBody) {
  const store = await loadGeminiKeyStore();
  const action = String(actionBody.action || "").trim();

  if (action === "select") {
    const keyId = String(actionBody.keyId || "").trim();
    if (keyId === "env" && envGeminiKey()) {
      store.activeKeyId = "env";
      return publicGeminiKeys(await saveGeminiKeyStore(store));
    }
    if (!store.slots.some((slot) => slot.id === keyId)) {
      throw new AppError("That Gemini key slot does not exist.", { status: 404, code: "KEY_NOT_FOUND" });
    }
    store.activeKeyId = keyId;
    return publicGeminiKeys(await saveGeminiKeyStore(store));
  }

  if (action === "save") {
    const keyId = String(actionBody.keyId || "").trim();
    const label = String(actionBody.label || "").trim() || "Gemini API key";
    const apiKey = String(actionBody.apiKey || "").trim();
    if (!apiKey || apiKey.length < 20) {
      throw new AppError("Enter a complete Gemini API key before saving.", { status: 400, code: "INVALID_KEY_INPUT" });
    }

    const existing = keyId ? store.slots.find((slot) => slot.id === keyId) : null;
    if (existing) {
      existing.label = label;
      existing.apiKey = apiKey;
      existing.updatedAt = new Date().toISOString();
      store.activeKeyId = existing.id;
    } else {
      if (store.slots.length >= MAX_SAVED_GEMINI_KEYS) {
        throw new AppError(`You can save up to ${MAX_SAVED_GEMINI_KEYS} Gemini keys. Delete one before adding another.`, {
          status: 400,
          code: "KEY_LIMIT_REACHED",
        });
      }
      const id = randomUUID();
      store.slots.push({
        id,
        label,
        apiKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      store.activeKeyId = id;
    }

    return publicGeminiKeys(await saveGeminiKeyStore(store));
  }

  if (action === "delete") {
    const keyId = String(actionBody.keyId || "").trim();
    if (keyId === "env") {
      throw new AppError("The .env key is read-only. Remove it from .env manually if needed.", {
        status: 400,
        code: "ENV_KEY_READ_ONLY",
      });
    }
    const before = store.slots.length;
    store.slots = store.slots.filter((slot) => slot.id !== keyId);
    if (before === store.slots.length) {
      throw new AppError("That Gemini key slot does not exist.", { status: 404, code: "KEY_NOT_FOUND" });
    }
    if (store.activeKeyId === keyId) {
      store.activeKeyId = envGeminiKey() ? "env" : store.slots[0]?.id || null;
    }
    return publicGeminiKeys(await saveGeminiKeyStore(store));
  }

  throw new AppError("Unsupported Gemini key settings action.", { status: 400, code: "UNKNOWN_KEY_ACTION" });
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

function normalizeStockProviderStore(provider, providerStore = {}) {
  const slots = Array.isArray(providerStore?.slots)
    ? providerStore.slots
        .filter((slot) => slot?.apiKey)
        .slice(0, MAX_SAVED_STOCK_KEYS)
        .map((slot, index) => ({
          id: String(slot.id || `${provider}-slot-${index + 1}`),
          label: String(slot.label || `${provider} key ${index + 1}`),
          apiKey: String(slot.apiKey || "").trim(),
          createdAt: slot.createdAt || new Date().toISOString(),
          updatedAt: slot.updatedAt || slot.createdAt || new Date().toISOString(),
        }))
    : [];
  const activeKeyId = providerStore?.activeKeyId || (stockEnvKey(provider) ? "env" : slots[0]?.id || null);
  return { activeKeyId, slots };
}

function normalizeStockKeyStore(store) {
  return {
    providers: {
      pexels: normalizeStockProviderStore("pexels", store?.providers?.pexels || store?.pexels),
      pixabay: normalizeStockProviderStore("pixabay", store?.providers?.pixabay || store?.pixabay),
    },
  };
}

async function loadStockKeyStore() {
  try {
    const raw = await fs.readFile(stockKeyStorePath, "utf8");
    return normalizeStockKeyStore(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") {
      return normalizeStockKeyStore({});
    }
    throw new AppError("Unable to read saved stock media key settings.", {
      status: 500,
      code: "STOCK_KEY_STORE_READ_FAILED",
      details: error.message,
    });
  }
}

async function saveStockKeyStore(store) {
  const normalized = normalizeStockKeyStore(store);
  await fs.writeFile(stockKeyStorePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

function resolveActiveStockKey(store, provider) {
  if (!STOCK_VIDEO_PROVIDERS.includes(provider)) {
    return null;
  }
  const providerStore = normalizeStockProviderStore(provider, store?.providers?.[provider]);
  const envKey = stockEnvKey(provider);
  if (providerStore.activeKeyId && providerStore.activeKeyId !== "env") {
    const activeSlot = providerStore.slots.find((slot) => slot.id === providerStore.activeKeyId && slot.apiKey);
    if (activeSlot) {
      return { id: activeSlot.id, label: activeSlot.label, apiKey: activeSlot.apiKey, source: "saved", provider };
    }
  }
  if (envKey) {
    return { id: "env", label: `Default ${provider} .env key`, apiKey: envKey, source: ".env", provider };
  }
  const firstSlot = providerStore.slots.find((slot) => slot.apiKey);
  return firstSlot ? { id: firstSlot.id, label: firstSlot.label, apiKey: firstSlot.apiKey, source: "saved", provider } : null;
}

function publicStockProviderKeys(store, provider) {
  const providerStore = normalizeStockProviderStore(provider, store?.providers?.[provider]);
  const keys = [];
  const envKey = stockEnvKey(provider);
  if (envKey) {
    keys.push({
      id: "env",
      label: `Default ${provider} .env key`,
      masked: maskApiKey(envKey),
      source: ".env",
      readOnly: true,
      active: providerStore.activeKeyId === "env" || !providerStore.activeKeyId,
    });
  }
  for (const slot of providerStore.slots) {
    keys.push({
      id: slot.id,
      label: slot.label,
      masked: maskApiKey(slot.apiKey),
      source: "saved",
      readOnly: false,
      active: providerStore.activeKeyId === slot.id,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
    });
  }
  return {
    activeKeyId: resolveActiveStockKey(store, provider)?.id || null,
    maxSavedKeys: MAX_SAVED_STOCK_KEYS,
    keys,
  };
}

function publicStockKeys(store) {
  return {
    pexels: publicStockProviderKeys(store, "pexels"),
    pixabay: publicStockProviderKeys(store, "pixabay"),
  };
}

async function updateStockKeys(actionBody) {
  const provider = String(actionBody.provider || "").trim().toLowerCase();
  const action = String(actionBody.action || "").trim();
  if (!STOCK_VIDEO_PROVIDERS.includes(provider)) {
    throw new AppError("Choose Pexels or Pixabay before saving a stock media key.", { status: 400, code: "UNKNOWN_STOCK_PROVIDER" });
  }

  const store = await loadStockKeyStore();
  const providerStore = normalizeStockProviderStore(provider, store.providers[provider]);
  store.providers[provider] = providerStore;

  if (action === "select") {
    const keyId = String(actionBody.keyId || "").trim();
    if (keyId === "env" && stockEnvKey(provider)) {
      providerStore.activeKeyId = "env";
      return publicStockKeys(await saveStockKeyStore(store));
    }
    if (!providerStore.slots.some((slot) => slot.id === keyId)) {
      throw new AppError("That stock media key slot does not exist.", { status: 404, code: "STOCK_KEY_NOT_FOUND" });
    }
    providerStore.activeKeyId = keyId;
    return publicStockKeys(await saveStockKeyStore(store));
  }

  if (action === "save") {
    const keyId = String(actionBody.keyId || "").trim();
    const label = String(actionBody.label || "").trim() || `${provider} API key`;
    const apiKey = String(actionBody.apiKey || "").trim();
    if (!apiKey || apiKey.length < 12) {
      throw new AppError(`Enter a complete ${provider} API key before saving.`, { status: 400, code: "INVALID_STOCK_KEY_INPUT" });
    }

    const existing = keyId ? providerStore.slots.find((slot) => slot.id === keyId) : null;
    if (existing) {
      existing.label = label;
      existing.apiKey = apiKey;
      existing.updatedAt = new Date().toISOString();
      providerStore.activeKeyId = existing.id;
    } else {
      if (providerStore.slots.length >= MAX_SAVED_STOCK_KEYS) {
        throw new AppError(`You can save up to ${MAX_SAVED_STOCK_KEYS} ${provider} keys. Delete one before adding another.`, {
          status: 400,
          code: "STOCK_KEY_LIMIT_REACHED",
        });
      }
      const id = randomUUID();
      providerStore.slots.push({
        id,
        label,
        apiKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      providerStore.activeKeyId = id;
    }
    return publicStockKeys(await saveStockKeyStore(store));
  }

  if (action === "delete") {
    const keyId = String(actionBody.keyId || "").trim();
    if (keyId === "env") {
      throw new AppError("The .env stock key is read-only. Remove it from .env manually if needed.", {
        status: 400,
        code: "STOCK_ENV_KEY_READ_ONLY",
      });
    }
    const before = providerStore.slots.length;
    providerStore.slots = providerStore.slots.filter((slot) => slot.id !== keyId);
    if (before === providerStore.slots.length) {
      throw new AppError("That stock media key slot does not exist.", { status: 404, code: "STOCK_KEY_NOT_FOUND" });
    }
    if (providerStore.activeKeyId === keyId) {
      providerStore.activeKeyId = stockEnvKey(provider) ? "env" : providerStore.slots[0]?.id || null;
    }
    return publicStockKeys(await saveStockKeyStore(store));
  }

  throw new AppError("Unsupported stock media key settings action.", { status: 400, code: "UNKNOWN_STOCK_KEY_ACTION" });
}

async function resolveFfmpegPath() {
  if (cachedFfmpegPath) {
    return cachedFfmpegPath;
  }

  const candidates = [process.env.FFMPEG_PATH, portableFfmpegPath, "ffmpeg"].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["-version"], { timeout: 5000 });
      cachedFfmpegPath = candidate;
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("FFmpeg was not found. Install it, add it to PATH, or set FFMPEG_PATH.");
}

async function hasFfmpeg() {
  try {
    await resolveFfmpegPath();
    return true;
  } catch {
    return false;
  }
}

function configuredCorsOrigins() {
  return String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function addVaryHeader(res, value) {
  const current = res.getHeader("Vary");
  if (!current) {
    res.setHeader("Vary", value);
    return;
  }
  const values = String(current)
    .split(",")
    .map((item) => item.trim().toLowerCase());
  if (!values.includes(value.toLowerCase())) {
    res.setHeader("Vary", `${current}, ${value}`);
  }
}

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }

  const allowedOrigins = configuredCorsOrigins();
  const allowedOrigin = allowedOrigins.includes("*")
    ? "*"
    : allowedOrigins.find((item) => item === origin);

  if (!allowedOrigin) {
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  addVaryHeader(res, "Origin");
  return true;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendStockMp4(res, result) {
  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Content-Disposition": `attachment; filename="${result.filename || "stock-video.mp4"}"`,
    "Content-Length": result.video.length,
    "Cache-Control": "no-store",
    "X-Video-Width": String(result.width || STOCK_VIDEO_WIDTH),
    "X-Video-Height": String(result.height || STOCK_VIDEO_HEIGHT),
    "X-Video-Fps": String(result.fps || STOCK_VIDEO_FPS),
    "X-Video-Duration-Seconds": String(result.durationSeconds || ""),
    "X-Audio-Track": result.audioTrack || "none",
    "X-Subtitles": result.subtitles || "none",
    "X-Stock-Clips": String(result.clipCount || 0),
  });
  res.end(result.video);
}

async function sendWorldCupAsset(res, asset) {
  const file = await fs.readFile(asset.path);
  res.writeHead(200, {
    "Content-Type": asset.mime,
    "Content-Disposition": `attachment; filename="${asset.filename || "worldcup-asset"}"`,
    "Content-Length": file.length,
    "Cache-Control": "no-store",
  });
  res.end(file);
}

function sendError(res, error, fallbackMessage = "Something went wrong.") {
  const status = Number(error.status || 500);
  sendJson(res, status, {
    error: error.message || fallbackMessage,
    code: error.code || "UNKNOWN_ERROR",
    provider: error.provider || null,
    model: error.model || null,
    keyId: error.keyId || null,
    details: error.details || null,
  });
}

function classifyGeminiError(errorData, httpStatus, { model, keyId }) {
  const geminiError = errorData?.error || {};
  const message = geminiError.message || `Gemini request failed with HTTP ${httpStatus}.`;
  const status = geminiError.status || "";
  const lower = message.toLowerCase();

  let code = status || "GEMINI_REQUEST_FAILED";
  if (httpStatus === 400 || lower.includes("too long") || lower.includes("token")) {
    code = "REQUEST_TOO_LONG_OR_INVALID";
  }
  if (httpStatus === 401 || httpStatus === 403 || lower.includes("api key")) {
    code = "INVALID_OR_UNAUTHORIZED_KEY";
  }
  if (httpStatus === 429 || lower.includes("quota") || lower.includes("rate")) {
    code = "QUOTA_OR_RATE_LIMIT";
  }
  if (httpStatus >= 500) {
    code = "GEMINI_SERVER_ERROR";
  }

  return new AppError(message, {
    status: httpStatus >= 400 && httpStatus < 500 ? httpStatus : 502,
    code,
    provider: "gemini",
    model,
    keyId,
    details: {
      geminiStatus: status || null,
      httpStatus,
      raw: geminiError,
    },
  });
}

function wrapNetworkError(error, { provider, model, keyId }) {
  return new AppError(`${provider} network request failed: ${error.message}`, {
    status: 502,
    code: "NETWORK_OR_SERVER_UNREACHABLE",
    provider,
    model,
    keyId,
  });
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25_000_000) {
        reject(
          new AppError("Request is too large. Audio-aware storyboard requests must stay under 25 MB.", {
            status: 413,
            code: "REQUEST_TOO_LARGE",
          }),
        );
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

async function convertWavToMp3(wavBuffer) {
  const ffmpegPath = await resolveFfmpegPath();
  await fs.mkdir(voiceTempRoot, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(voiceTempRoot, "hindi-voice-"));
  const inputPath = path.join(tempDir, "input.wav");
  const outputPath = path.join(tempDir, "output.mp3");

  try {
    await fs.writeFile(inputPath, wavBuffer);
    await execFileAsync(ffmpegPath, ["-y", "-i", inputPath, "-codec:a", "libmp3lame", "-b:a", "192k", outputPath], {
      timeout: 60000,
    });
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function resolveMoodPrompt(moodId, style) {
  const customStyle = String(style || "").trim();
  if (customStyle) {
    return customStyle;
  }

  const selectedMood = MOODS.find((mood) => mood.id === moodId);
  if (selectedMood) {
    return selectedMood.prompt;
  }
  return MOODS.find((mood) => mood.id === "thriller")?.prompt || "";
}

function resolveRewriteMoodPrompt(moodId) {
  return REWRITE_MOODS.find((mood) => mood.id === moodId)?.prompt || REWRITE_MOODS[0].prompt;
}

function buildHindiPrompt(text, moodId, style) {
  const trimmed = String(text || "").trim();
  const performance = resolveMoodPrompt(moodId, style);
  const direction = performance
    ? `${performance}. Pronounce Hindi naturally for India. Keep the delivery cinematic, human, and emotionally specific without sounding cartoonish.`
    : "Read naturally in Hindi with a warm, realistic Indian voice.";

  if (hasTtsDirectionTags(trimmed)) {
    return buildTaggedSingleSpeakerPrompt(trimmed, direction);
  }

  return `${direction}\n\n${trimmed}`;
}

function hasTtsDirectionTags(text) {
  return /^\s*\[[^\]]+\]\s*$/m.test(String(text || ""));
}

function parseTtsTag(tag) {
  const parts = String(tag || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    raw: String(tag || "").trim(),
    parts,
    head: String(parts[0] || "").trim(),
    voice: parts.find((part) => GOOGLE_VOICES.includes(part)) || "",
    direction: parts.slice(1).filter((part) => !GOOGLE_VOICES.includes(part)).join(", "),
  };
}

function isPauseTag(tag) {
  return /^pause$/i.test(parseTtsTag(tag).head);
}

function pauseInstructionFromTag(tag) {
  const parsed = parseTtsTag(tag);
  const duration = parsed.parts.find((part) => /\d/.test(part)) || "short";
  return `Insert a ${duration} silent pause. Do not speak the word pause.`;
}

function buildTaggedSingleSpeakerPrompt(script, direction) {
  return [
    "You are a professional Hindi reel narrator performing a TTS screenplay.",
    direction,
    "Treat bracketed lines as director instructions, never as spoken words.",
    "Section tags such as [Hook | direct, controlled | medium-fast] control the delivery of the following spoken lines until the next bracketed tag.",
    "Pause tags such as [Pause | 0.6s] mean insert silence for about that duration. Do not say 'pause', 'intro', 'main', or any bracket text aloud.",
    "Keep the spoken Hindi/Hinglish exact, but use the tags for emotion, pace, breath, intensity, and dramatic timing.",
    "Use natural Indian pronunciation and short-form reel energy. Avoid cartoon acting.",
    "",
    "TTS SCREENPLAY:",
    script,
  ].join("\n");
}

function buildHindiDialoguePrompt(text, moodId, style, speakers) {
  const trimmed = String(text || "").trim();
  const dialogue = normalizeDialogueText(trimmed, speakers);
  const performance = resolveMoodPrompt(moodId, style);
  const speakerNames = speakers.map((speaker) => speaker.name).join(" and ");
  const direction = performance
    ? `${performance}. Pronounce Hindi naturally for India. Keep the delivery cinematic, human, and emotionally specific without sounding cartoonish.`
    : "Read naturally in Hindi with realistic Indian voices.";

  return [
    `${direction}`,
    `This is a two-speaker dialogue between ${speakerNames}.`,
    `Official speaker mapping: ${speakers.map((speaker) => `${speaker.name} uses ${speaker.voice}`).join("; ")}.`,
    "Use the speaker labels only to assign voices. Do not read the speaker names aloud unless they are part of the spoken line after the colon.",
    "If a line contains an acting direction in square brackets after the speaker label, treat it as emotion, pacing, and delivery guidance; do not read that direction aloud.",
    "If a line says [pause 0.6 seconds] or similar, insert silence and do not read the pause instruction aloud.",
    "Keep each speaker's voice consistent throughout the whole script.",
    "",
    dialogue,
  ].join("\n");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpeakerName(value, fallback) {
  return String(value || fallback)
    .trim()
    .replace(/[:：]+$/g, "")
    .slice(0, 40);
}

function resolveGeminiSpeakers(rawSpeakers) {
  const source = Array.isArray(rawSpeakers) ? rawSpeakers : [];
  const first = source[0] || {};
  const second = source[1] || {};
  const speakers = [
    {
      name: normalizeSpeakerName(first.name, "Speaker 1"),
      voice: GOOGLE_VOICES.includes(first.voice) ? first.voice : "Kore",
    },
    {
      name: normalizeSpeakerName(second.name, "Speaker 2"),
      voice: GOOGLE_VOICES.includes(second.voice) ? second.voice : "Puck",
    },
  ];

  if (!speakers[0].name || !speakers[1].name) {
    throw new AppError("Both speaker names are required for dialogue mode.", {
      status: 400,
      code: "SPEAKER_NAMES_REQUIRED",
      provider: "gemini",
    });
  }
  if (speakers[0].name.toLowerCase() === speakers[1].name.toLowerCase()) {
    throw new AppError("Speaker names must be different for dialogue mode.", {
      status: 400,
      code: "SPEAKER_NAMES_MUST_DIFFER",
      provider: "gemini",
    });
  }

  return speakers;
}

function assertDialogueLabels(text, speakers) {
  const missing = speakers.filter((speaker) => {
    const pattern = new RegExp(`(^|\\n)\\s*${escapeRegex(speaker.name)}\\s*[:：]`, "i");
    return !pattern.test(text);
  });

  if (missing.length) {
    throw new AppError(
      `Dialogue mode needs matching speaker labels in the script: ${speakers.map((speaker) => `${speaker.name}:`).join(" and ")}`,
      {
        status: 400,
        code: "MISSING_DIALOGUE_LABELS",
        provider: "gemini",
        details: { missingSpeakers: missing.map((speaker) => speaker.name) },
      },
    );
  }
}

function speakerAliases(speaker, index) {
  return [
    speaker.name,
    speaker.voice,
    `Speaker ${index + 1}`,
    `Speaker${index + 1}`,
    `S${index + 1}`,
  ]
    .map((alias) => String(alias || "").trim())
    .filter(Boolean);
}

function findSpeakerFromTag(tag, speakers) {
  const parts = String(tag || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  for (let speakerIndex = 0; speakerIndex < speakers.length; speakerIndex += 1) {
    const speaker = speakers[speakerIndex];
    const aliases = speakerAliases(speaker, speakerIndex).map((alias) => alias.toLowerCase());
    if (parts.some((part) => aliases.includes(part.toLowerCase()))) {
      return { speaker, instruction: parts.slice(1).filter((part) => !aliases.includes(part.toLowerCase())).join(", ") };
    }
  }

  return null;
}

function normalizeDialogueText(text, speakers) {
  const output = [];
  let activeSpeaker = speakers[0];
  let activeInstruction = "";

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      output.push("");
      continue;
    }

    const pureTagMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (pureTagMatch) {
      const tag = pureTagMatch[1];
      if (isPauseTag(tag)) {
        output.push(`${activeSpeaker.name}: [${pauseInstructionFromTag(tag)}]`);
        continue;
      }
      if (tag.includes("|")) {
        const matched = findSpeakerFromTag(tag, speakers);
        if (matched) {
          activeSpeaker = matched.speaker;
          activeInstruction = matched.instruction;
          continue;
        }
      }
      activeInstruction = tag;
      continue;
    }

    const inlineTagMatch = line.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
    if (inlineTagMatch?.[1]) {
      const tag = inlineTagMatch[1];
      const rest = inlineTagMatch[2].trim();
      if (isPauseTag(tag)) {
        output.push(`${activeSpeaker.name}: [${pauseInstructionFromTag(tag)}]${rest ? ` ${rest}` : ""}`);
        continue;
      }
      const matched = tag.includes("|") ? findSpeakerFromTag(tag, speakers) : null;
      if (matched) {
        activeSpeaker = matched.speaker;
        activeInstruction = matched.instruction;
        if (rest) {
          const instruction = activeInstruction ? `[${activeInstruction}] ` : "";
          output.push(`${activeSpeaker.name}: ${instruction}${rest}`);
        }
        continue;
      }
    }

    let handled = false;
    for (let speakerIndex = 0; speakerIndex < speakers.length; speakerIndex += 1) {
      const speaker = speakers[speakerIndex];
      for (const alias of speakerAliases(speaker, speakerIndex)) {
        const bracketPattern = new RegExp(`^\\s*\\[\\s*${escapeRegex(alias)}\\s*\\]\\s*[:\\uFF1A\\-\\u2013\\u2014]?\\s*`, "i");
        const labelPattern = new RegExp(`^\\s*${escapeRegex(alias)}\\s*[:\\uFF1A\\-\\u2013\\u2014]\\s*`, "i");
        if (bracketPattern.test(line)) {
          output.push(`${speaker.name}: ${line.replace(bracketPattern, "").trim()}`);
          handled = true;
          break;
        }
        if (labelPattern.test(line)) {
          output.push(`${speaker.name}: ${line.replace(labelPattern, "").trim()}`);
          handled = true;
          break;
        }
      }
      if (handled) {
        break;
      }
    }

    if (!handled) {
      const instruction = activeInstruction ? `[${activeInstruction}] ` : "";
      output.push(`${activeSpeaker.name}: ${instruction}${line}`);
    }
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractSpeakersFromTaggedScript(text) {
  const speakers = [];
  const seen = new Set();
  const matches = String(text || "").matchAll(/^\s*\[([^\]]+)\]/gm);

  for (const match of matches) {
    const parts = String(match[1] || "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length < 2) {
      continue;
    }

    const name = normalizeSpeakerName(parts[0], "");
    const voice = GOOGLE_VOICES.includes(parts[1]) ? parts[1] : "";
    if (!name || !voice) {
      continue;
    }

    const key = name.toLowerCase();
    if (!seen.has(key)) {
      speakers.push({ name, voice });
      seen.add(key);
    }
    if (speakers.length === 2) {
      break;
    }
  }

  return speakers;
}

function buildGeminiSpeechConfig({ voiceMode, voice, speakers }) {
  if (voiceMode === "multi") {
    return {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: speakers.map((speaker) => ({
          speaker: speaker.name,
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: speaker.voice,
            },
          },
        })),
      },
    };
  }

  return {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: voice,
      },
    },
  };
}

function resolveRewriteVoicePlan(body) {
  const selectedPool = (Array.isArray(body.voicePool) ? body.voicePool : [])
    .map((voice) => String(voice || "").trim())
    .filter((voice) => GOOGLE_VOICES.includes(voice));
  const uniquePool = [...new Set(selectedPool)].slice(0, 2);

  if (body.voicePreference === "selected" && uniquePool.length === 2) {
    return {
      mode: "selected",
      allowedVoices: uniquePool,
      instruction: `Use exactly these two selected voices: ${uniquePool.join(" and ")}. You must still choose story-appropriate role labels such as Narrator, Father, Child Voice, TV Voice, or Character Voice. Do not use arbitrary names from the UI.`,
    };
  }

  return {
    mode: "auto",
    allowedVoices: GOOGLE_VOICES,
    instruction:
      "Choose exactly two voices from the voice catalog that best fit the story roles. Prefer contrasting voices when the story has narration plus a quoted character or supernatural voice.",
  };
}

function voiceCatalogForPrompt(voices) {
  const allowed = new Set(voices);
  return GOOGLE_VOICE_OPTIONS.filter((voice) => allowed.has(voice.id))
    .map((voice) => `${voice.id} (${voice.trait})`)
    .join(", ");
}

function resolveScriptCategory(categoryId) {
  return SCRIPT_CATEGORIES.find((category) => category.id === categoryId) || SCRIPT_CATEGORIES.find((category) => category.id === "psychology") || SCRIPT_CATEGORIES[0];
}

function resolveScriptTone(toneId) {
  return SCRIPT_TONES.find((tone) => tone.id === toneId) || SCRIPT_TONES.find((tone) => tone.id === "suspense") || SCRIPT_TONES[0];
}

function resolveScriptContentType(typeId) {
  return SCRIPT_CONTENT_TYPES.find((type) => type.id === typeId) || SCRIPT_CONTENT_TYPES.find((type) => type.id === "reel") || SCRIPT_CONTENT_TYPES[0];
}

function resolveScriptEnergy(energyId) {
  return SCRIPT_ENERGIES.find((energy) => energy.id === energyId) || SCRIPT_ENERGIES[1];
}

function resolveScriptDuration(durationId) {
  return SCRIPT_DURATIONS.find((duration) => duration.id === String(durationId)) || SCRIPT_DURATIONS[2];
}

function resolveScriptTemplate(templateId) {
  return SCRIPT_TEMPLATES.find((template) => template.id === templateId) || SCRIPT_TEMPLATES[0];
}

function normalizeScriptMode(mode) {
  return ["single", "advanced-narrator", "dialogue"].includes(mode) ? mode : "advanced-narrator";
}

function normalizeResearchDepth(depth) {
  return ["off", "light", "deep"].includes(depth) ? depth : "light";
}

function buildDialogueRewritePrompt({ text, voicePlan, rewriteMood, style }) {
  const rewriteStyle = [resolveRewriteMoodPrompt(rewriteMood), String(style || "").trim()].filter(Boolean).join(", ");
  const voiceCatalog = voiceCatalogForPrompt(voicePlan.allowedVoices);

  return `
You are an expert Hindi dialogue writer, voice director, and short-form retention editor.
Convert the user's normal Hindi story into an advanced Gemini TTS script using exactly two audio roles.

Voice selection:
- ${voicePlan.instruction}
- Voice catalog: ${voiceCatalog}

Rewrite mood and format:
- Style: ${rewriteStyle}
- Preserve the original story meaning and important details.
- Output Hindi in Devanagari script only. Never romanize Hindi into Latin letters.
- First understand the story, characters, narration, quotes, and unseen voices.
- Do not blindly alternate speakers line-by-line.
- Do not invent a fake two-person conversation between arbitrary names.
- If most of the script is narration, use one role as Narrator for the narration and the second role only for important quoted speech, memories, father/mother warnings, TV voice, child voice, or supernatural voice.
- Use exactly two speaker labels across the whole output. The labels should be audio roles chosen from the story, such as Narrator, Father Voice, Child Voice, TV Voice, Mysterious Voice, Character Voice, or Podcast Host.
- If several minor voices exist, merge them into the second audio role and use the emotion tag to show the exact acting style.
- Keep it suitable for reels/shorts with hooks, tension, pauses, and emotional turns.
- Add line-level performance tags for emotion, pace, and delivery.
- Use tags in this exact form: [Story Role | VoiceName | emotion, delivery]
- Keep each spoken line concise and performable.
- Good delivery tags: whisper, fearful, tense, angry, slow, fast, shocked, soft, crying, laughing, suspicious, dramatic pause, urgent, podcast tone.
- Do not include markdown, subtitles, timestamps, image prompts, or commentary.
- The final taggedScript must contain only the rewritten script. No explanations.

Return JSON only in this exact shape:
{
  "title": "short title",
  "rewriteMood": "${rewriteMood || "suspense"}",
  "speakerPlan": [
    { "speaker": "Narrator", "voice": "one selected voice", "role": "what this audio role performs" },
    { "speaker": "Second story role", "voice": "second selected voice", "role": "what this audio role performs" }
  ],
  "taggedScript": "[Narrator | VoiceName | tense, slow]\\nदेवनागरी हिंदी लाइन\\n\\n[Second story role | VoiceName | scared, whisper]\\nदेवनागरी हिंदी लाइन"
}

Original story:
${String(text || "").trim()}
`.trim();
}

async function rewriteDialogueScript(body) {
  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo?.apiKey) {
    throw new AppError("Missing Gemini API key. Add one in Settings before rewriting scripts.", {
      status: 400,
      code: "MISSING_GEMINI_KEY",
      provider: "gemini",
      model: SCRIPT_REWRITE_MODEL,
    });
  }

  const text = String(body.text || "").trim();
  if (text.length < 10) {
    throw new AppError("Paste a longer story before rewriting it into dialogue.", {
      status: 400,
      code: "SCRIPT_TOO_SHORT",
      provider: "gemini",
      model: SCRIPT_REWRITE_MODEL,
    });
  }

  const voicePlan = resolveRewriteVoicePlan(body);
  const rewriteMood = REWRITE_MOODS.some((mood) => mood.id === body.rewriteMood) ? body.rewriteMood : REWRITE_MOODS[0].id;
  const prompt = buildDialogueRewritePrompt({
    text,
    voicePlan,
    rewriteMood,
    style: body.rewriteStyle,
  });

  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${SCRIPT_REWRITE_MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": keyInfo.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          responseMimeType: "application/json",
        },
        model: SCRIPT_REWRITE_MODEL,
      }),
    });
  } catch (error) {
    throw wrapNetworkError(error, { provider: "gemini", model: SCRIPT_REWRITE_MODEL, keyId: keyInfo.id });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw classifyGeminiError(data, response.status, { model: SCRIPT_REWRITE_MODEL, keyId: keyInfo.id });
  }

  const responseText = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
  const parsed = extractJson(responseText);
  if (!parsed?.taggedScript) {
    throw new AppError("Gemini rewrote the story but did not return a taggedScript field.", {
      status: 502,
      code: "REWRITE_SCRIPT_MISSING",
      provider: "gemini",
      model: SCRIPT_REWRITE_MODEL,
      keyId: keyInfo.id,
      details: data,
    });
  }

  return {
    title: parsed.title || "Advanced dialogue script",
    rewriteMood,
    model: SCRIPT_REWRITE_MODEL,
    modelLabel: "Gemini 3 Flash Preview",
    voicePreference: voicePlan.mode,
    speakerPlan: parsed.speakerPlan || extractSpeakersFromTaggedScript(parsed.taggedScript).map((speaker) => ({ speaker: speaker.name, voice: speaker.voice })),
    taggedScript: String(parsed.taggedScript).trim(),
    keyId: keyInfo.id,
    keyLabel: keyInfo.label,
  };
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
    throw new Error("Gemini returned an empty storyboard response.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonText = extractFirstJsonObject(trimmed);
    if (!jsonText) {
      throw new Error("Gemini did not return valid storyboard JSON.");
    }
    return JSON.parse(jsonText);
  }
}

function resolveImageMoodPrompt(imageMoodId) {
  return IMAGE_MOODS.find((mood) => mood.id === imageMoodId)?.prompt || IMAGE_MOODS.find((mood) => mood.id === "cinematic")?.prompt || IMAGE_MOODS[0].prompt;
}

function resolvePromptQualityMode(promptQualityId) {
  return PROMPT_QUALITY_MODES.find((mode) => mode.id === promptQualityId) || PROMPT_QUALITY_MODES[1];
}

function qualityRulesText(promptQualityId) {
  const quality = resolvePromptQualityMode(promptQualityId);
  return quality.rules.map((rule) => `- ${rule}`).join("\n");
}

function srtTimestamp(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const totalMilliseconds = Math.round(safeSeconds * 1000);
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const secs = Math.floor((totalMilliseconds % 60000) / 1000);
  const millis = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function cleanSubtitleText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSubtitleSegment(segment, index) {
  const startTime = Math.max(0, Number(segment?.startTime ?? segment?.start ?? 0) || 0);
  const fallbackDuration = Math.max(1, Number(segment?.durationSeconds ?? segment?.duration ?? 2.5) || 2.5);
  const rawEnd = Number(segment?.endTime ?? segment?.end ?? startTime + fallbackDuration);
  const endTime = rawEnd > startTime ? rawEnd : startTime + fallbackDuration;
  const text = cleanSubtitleText(
    segment?.text ||
      segment?.subtitle ||
      segment?.caption ||
      segment?.transcriptHindi ||
      segment?.transcript ||
      segment?.line,
  );

  if (!text) {
    return null;
  }

  return {
    number: Number(segment?.number || index + 1),
    startTime,
    endTime,
    durationSeconds: Math.max(0.1, endTime - startTime),
    text,
    transcriptHindi: text,
    transcriptEnglish: cleanSubtitleText(segment?.transcriptEnglish || ""),
    emotion: cleanSubtitleText(segment?.emotion || ""),
    pace: cleanSubtitleText(segment?.pace || ""),
  };
}

function subtitleSegmentsFromTimeline(timeline) {
  return (Array.isArray(timeline?.segments) ? timeline.segments : [])
    .map((segment, index) => normalizeSubtitleSegment(segment, index))
    .filter(Boolean);
}

function subtitleSegmentsFromStoryboard(storyboard) {
  const rawSegments = Array.isArray(storyboard?.subtitleSegments)
    ? storyboard.subtitleSegments
    : Array.isArray(storyboard?.subtitles)
      ? storyboard.subtitles
      : Array.isArray(storyboard?.captions)
        ? storyboard.captions
        : [];
  return rawSegments.map((segment, index) => normalizeSubtitleSegment(segment, index)).filter(Boolean);
}

function buildSrt(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment, index) => {
      const start = srtTimestamp(segment.startTime);
      const end = srtTimestamp(segment.endTime);
      const text = cleanSubtitleText(segment.text || segment.transcriptHindi);
      return text ? `${index + 1}\n${start} --> ${end}\n${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function parseSrtTimestamp(value) {
  const match = String(value || "").trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!match) {
    return 0;
  }
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(millis.padEnd(3, "0")) / 1000;
}

function timelineFromSrt(srtText) {
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
      const transcriptHindi = cleanSubtitleText(lines.slice(timeIndex + 1).join(" "));
      if (!transcriptHindi || endTime <= startTime) {
        return null;
      }
      return {
        number: index + 1,
        startTime,
        endTime,
        durationSeconds: Math.max(0.1, endTime - startTime),
        transcriptHindi,
        transcriptEnglish: "",
        emotion: "",
        pace: "",
        pauseOrBeat: "",
        visualBeat: transcriptHindi,
        importance: 1,
      };
    })
    .filter(Boolean);

  return {
    title: "Cached SRT transcript",
    language: "Hindi",
    audioSummary: "",
    directorNotes: "This timeline was rebuilt from an existing SRT file and reused to avoid re-listening to audio.",
    segments,
  };
}

function parseSrtEvents(srtText) {
  return timelineFromSrt(srtText).segments.map((segment) => ({
    number: segment.number,
    start: segment.startTime,
    end: segment.endTime,
    text: segment.transcriptHindi,
  }));
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
  const words = cleanSubtitleText(text).split(/\s+/).filter(Boolean);
  if (words.length <= 4) {
    return words.join(" ");
  }
  const midpoint = Math.ceil(words.length / 2);
  return `${words.slice(0, midpoint).join(" ")}\n${words.slice(midpoint).join(" ")}`;
}

function highlightAssText(text, highlights, color) {
  let marked = cleanSubtitleText(text);
  const phrases = (Array.isArray(highlights) ? highlights : [])
    .map(cleanSubtitleText)
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
  const events = parseSrtEvents(srtText);
  if (!events.length) {
    throw new AppError("Subtitle text did not contain valid SRT timing blocks.", { status: 400, code: "NO_VALID_SRT_FOR_CAPTIONS" });
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
      const segment = { start, end, number: event.number, position: preset.alignment === 5 ? "center" : "bottom" };
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
    throw new AppError("Smart caption plan did not include valid segments.", { status: 400, code: "NO_VALID_SMART_CAPTIONS" });
  }

  const header = buildAssHeader({ width, height, preset, primaryOverride: preset.smartPrimary || preset.primary });
  const centerRules = parseCenterCaptionSpec(centerSpec);
  const lines = segments.map((segment, index) => {
    const animation = resolveCaptionAnimation(animationMode, segment.animation || preset.animation);
    const position = captionPositionForSegment(segment, index, { placementMode, centerRules });
    const text = `${smartAnimationTag(animation, { width, height, preset, position })}${highlightAssText(segment.text, segment.highlight, segment.highlightColor || preset.highlight || preset.primary)}`;
    return `Dialogue: 0,${secondsForAss(segment.start)},${secondsForAss(segment.end)},Caption,,0,0,0,,${text}`;
  });
  return `${header.concat(lines).join("\n")}\n`;
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
  return captionOverlapSeconds(segment, event) >= Math.min(0.3, eventDuration * 0.35) || (segment.start <= midpoint && segment.end >= midpoint);
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
      fallbackCaptionCount > 0 ? `${fallbackCaptionCount} SRT captions were automatically kept because the smart plan did not cover them.` : "",
  };
}

function normalizeSmartCaptionPlan(plan, { srtText, styleId, model, fallbackOnly = false }) {
  const events = parseSrtEvents(srtText);
  const totalEnd = events.reduce((max, event) => Math.max(max, event.end), 0);
  const rawSegments = Array.isArray(plan?.segments) ? plan.segments : [];
  const sourceSegments = rawSegments.length ? rawSegments : events;
  const normalizedSegments = sourceSegments
    .map((segment, index) => {
      const fallback = events[Math.min(index, Math.max(0, events.length - 1))] || { start: 0, end: 1, text: "" };
      const start = Math.max(0, Number(segment.start ?? fallback.start) || 0);
      const rawEnd = Number(segment.end ?? fallback.end);
      const end = Math.min(Math.max(start + 0.35, rawEnd > start ? rawEnd : fallback.end), totalEnd || start + 8);
      const text = cleanSubtitleText(segment.text || fallback.text);
      if (!text || end <= start) {
        return null;
      }
      const animation = CAPTION_ANIMATIONS.has(String(segment.animation || "")) ? String(segment.animation) : captionPreset(styleId).animation;
      const position = ["bottom", "center", "top"].includes(segment.position) ? segment.position : "bottom";
      return {
        start,
        end,
        text,
        highlight: Array.isArray(segment.highlight) ? segment.highlight.map(cleanSubtitleText).filter(Boolean).slice(0, 3) : [],
        emotion: cleanSubtitleText(segment.emotion || ""),
        animation,
        position,
        highlightColor: cleanSubtitleText(segment.highlightColor || ""),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start)
    .slice(0, 240);

  if (!normalizedSegments.length && !fallbackOnly) {
    throw new AppError("Smart captions could not find valid SRT timing blocks.", { status: 400, code: "NO_VALID_SRT_FOR_CAPTIONS" });
  }

  const requestedStyle = cleanSubtitleText(plan?.stylePreset || styleId);
  const coverage = fillSmartCaptionCoverage(normalizedSegments, events, styleId);
  return {
    model,
    contentType: cleanSubtitleText(plan?.contentType || "auto"),
    captionStyle: cleanSubtitleText(plan?.captionStyle || "Short punchy reel captions with selective keyword highlights."),
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
  const srtText = String(body.srtText || body.srt || "").trim();
  const events = parseSrtEvents(srtText);
  if (!events.length) {
    throw new AppError("Create a valid SRT before using Smart captions.", { status: 400, code: "SMART_CAPTIONS_NEED_SRT" });
  }

  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo?.apiKey) {
    throw new AppError("No Gemini API key is available for Smart captions.", {
      status: 400,
      code: "MISSING_GEMINI_KEY",
      provider: "gemini",
    });
  }

  const styleId = CAPTION_STYLE_IDS.has(String(body.styleId || "")) ? String(body.styleId) : "creator-yellow";
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
      const rawPlan = await requestGeminiJson({
        keyInfo,
        model,
        parts: [{ text: prompt }],
        temperature: 0.45,
      });
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
      if (error.code === "NETWORK_ERROR" || error.code === "CAPTION_NETWORK_FAILED") {
        throw error;
      }
    }
  }

  throw new AppError("Smart captions failed on all lightweight caption models.", {
    status: 502,
    code: "SMART_CAPTION_MODELS_FAILED",
    provider: "gemini",
    details: failures,
  });
}

function normalizeCachedTimeline(value) {
  const timeline = typeof value === "object" && value ? value : null;
  const segments = Array.isArray(timeline?.segments) ? timeline.segments : [];
  const normalizedSegments = segments
    .map((segment, index) => {
      const normalized = normalizeSubtitleSegment(segment, index);
      return normalized
        ? {
            number: index + 1,
            startTime: normalized.startTime,
            endTime: normalized.endTime,
            durationSeconds: normalized.durationSeconds,
            transcriptHindi: normalized.text,
            transcriptEnglish: cleanSubtitleText(segment?.transcriptEnglish || ""),
            emotion: cleanSubtitleText(segment?.emotion || ""),
            pace: cleanSubtitleText(segment?.pace || ""),
            pauseOrBeat: cleanSubtitleText(segment?.pauseOrBeat || ""),
            visualBeat: cleanSubtitleText(segment?.visualBeat || normalized.text),
            importance: Number(segment?.importance || 1),
          }
        : null;
    })
    .filter(Boolean)
    .map((segment, index) => ({ ...segment, number: index + 1 }));
  return normalizedSegments.length
    ? {
        title: cleanSubtitleText(timeline.title || "Cached audio timeline"),
        language: cleanSubtitleText(timeline.language || "Hindi"),
        audioSummary: cleanSubtitleText(timeline.audioSummary || ""),
        directorNotes: cleanSubtitleText(timeline.directorNotes || "Reused cached timeline."),
        segments: normalizedSegments,
      }
    : null;
}

function cachedTimelineFromRequest(body) {
  return normalizeCachedTimeline(body.cachedTimeline) || (String(body.cachedSrt || "").trim() ? timelineFromSrt(body.cachedSrt) : null);
}

function inferStoryboardVisualStrategy({ text, imageMood, style, promptQuality }) {
  const mood = String(imageMood || "").toLowerCase();
  const quality = String(promptQuality || "").toLowerCase();
  const textOnly = String(text || "").toLowerCase();

  if (mood === "psychological-sketch" || mood === "abstract-metaphor") {
    return "conceptual";
  }
  if (mood === "kids-cartoon" || quality === "kids-cartoon-flow") {
    return "kids-cartoon";
  }
  if (mood === "relationship-drama") {
    return "relationship";
  }
  if (quality === "conceptual-sketch") {
    return "conceptual";
  }
  if (mood === "horror" || mood === "thriller" || quality === "horror-realism") {
    return "story";
  }
  if (mood === "documentary" || mood === "mythic") {
    return "hybrid";
  }
  if (mood === "emotional" || ["ultra-cinematic", "consistent-character", "youtube-thumbnail"].includes(quality)) {
    return "story";
  }
  if (/kids|children|child|cartoon|nursery|moral story|animal story|school story|friendship story|bacch|bachch|बच्च|कार्टून|जानवर|दोस्ती|स्कूल|खेल|नैतिक|कहानी/.test(textOnly)) {
    return "kids-cartoon";
  }
  if (/relationship|love|breakup|affair|cheating|jealousy|heartbreak|marriage|crush|ex\b|girlfriend|boyfriend|romance|\u092a\u094d\u092f\u093e\u0930|\u0930\u093f\u0936\u094d\u0924|\u092c\u094d\u0930\u0947\u0915\u0905\u092a|\u0926\u093f\u0932|\u0927\u094b\u0916\u093e|\u0936\u093e\u0926\u0940/.test(textOnly)) {
    return "relationship";
  }
  const combined = `${text || ""} ${imageMood || ""}`.toLowerCase();
  if (
    /psychology|overthinking|mind|brain|thought|thoughts|anxiety|confidence|emotion|habit|dopamine|mindset|self[-\s]?doubt|inner voice|mental|behavior|behaviour|relationship|motivation|discipline|focus|stress|fear|trauma|ego|comparison|burnout|procrastination|सोच|दिमाग|मन|डर|आत्मविश्वास|आदत|रिश्ता|प्यार|अकेला|तनाव|चिंता/.test(
      combined,
    )
  ) {
    return "conceptual";
  }
  if (/horror|ghost|haunted|crime|mystery|murder|missing|killer|डराव|भूत|रात|कमरा|हत्या|गायब|खून/.test(combined)) {
    return "story";
  }
  if (/history|myth|mythology|business|founder|war|king|startup|इतिहास|राजा|युद्ध|व्यापार/.test(combined)) {
    return "hybrid";
  }
  return "adaptive";
}

function visualStrategyText(strategy) {
  const rules = {
    "kids-cartoon": `
Visual strategy: Indian kids cartoon episode.
- Target Indian children roughly ages 5-10: entertainment first, safe, colorful, simple, and emotionally warm.
- Use one cute recurring hero or a small friendly duo. Good choices: child hero, animal friend, talking object, school friends, sibling pair, or village/city neighborhood friends.
- Every prompt must fully describe the same cartoon characters again: age/species, face, colors, clothing, personality, key prop, and expression.
- Use bright balanced colors, rounded shapes, clean backgrounds, playful props, and local Indian details such as school bag, tiffin, courtyard, kite, mango tree, rangoli, bicycle, festival lights, monsoon puddle, or family kitchen.
- Make each frame instantly readable on a phone: one clear action, one emotion, one visual gag or story beat.
- Keep it child-safe: no gore, weapons, bullying humiliation, creepy horror, romance, dangerous stunts, realistic injury, text, logos, UI, or speech bubbles.
- Add gentle learning through story, not lecture: sharing, honesty, curiosity, courage, helping family, protecting nature, teamwork, or kindness.
`.trim(),
    conceptual: `
Visual strategy: conceptual psychology/metaphor reel.
- Do NOT default to a different human portrait in every frame.
- Prefer symbolic visuals: a silhouetted figure, faceless shadow, maze, cracked mirror, tangled threads, dark room, floating thoughts, paper cutouts, sketch diagrams, split face, empty chair, hourglass, stairs, doorway, cage, mask, spotlight, storm cloud, or hand-drawn metaphor.
- If a person appears, make them a consistent anonymous silhouette or faceless figure, not a new realistic model. Use the same silhouette description in every prompt.
- Use a dark sketch / charcoal / ink / editorial illustration look when appropriate.
- Every frame should feel part of the same illustrated series, not separate photos.
- Avoid photorealistic influencer portraits, smiling stock faces, random young women/men, glamour shots, or unrelated lifestyle scenes.
`.trim(),
    story: `
Visual strategy: character-led story reel.
- Use a small cast only when the script clearly has characters.
- Keep recurring characters consistent by repeating the same full description in every prompt.
- Do not change gender, age, clothing, face, or setting randomly.
- Use cinematic realism only when it serves the story.
`.trim(),
    relationship: `
Visual strategy: personalized relationship reel.
- Use intimate, emotionally specific visuals for love, breakup, affairs, jealousy, regret, longing, trust, and separation.
- Prefer recurring relationship symbols: two tea cups, phone glow without readable text, rain on a window, empty chair, ring, bracelet, scarf, train platform, cafe corner, bedroom doorway, shadow of a couple, or one person alone after a conversation.
- If a couple appears, fully describe the same two people in every prompt; do not switch to random attractive models.
- Keep it tasteful and non-explicit. Avoid glamour shoots, stock romance photos, and unrelated happy-couple poses unless the script needs that contrast.
- Every frame should feel personal, cinematic, and emotionally lived-in.
`.trim(),
    hybrid: `
Visual strategy: hybrid symbolic + grounded reel.
- Mix symbolic editorial frames with a few grounded environment/object frames.
- Prefer artifacts, locations, documents, maps, objects, shadows, or silhouettes over random portraits.
- If a recurring person is needed, fully describe the same person consistently in every prompt.
`.trim(),
    adaptive: `
Visual strategy: adaptive reel.
- First decide whether this topic needs characters, objects, environments, or abstract metaphor.
- Do not create random unrelated humans. Use people only when they are essential to the visual idea.
- Keep the whole prompt set visually consistent through one style bible, palette, lighting, and subject logic.
`.trim(),
  };
  return rules[strategy] || rules.adaptive;
}

function normalizeImageStyle(style, strategy) {
  const text = String(style || "").trim();
  if (!text) {
    return "";
  }
  const isLegacyPsychologyDefault =
    /for psychology, mindset, motivation, and inner-conflict scripts/i.test(text) &&
    /dark symbolic sketch|charcoal metaphor|random human portraits/i.test(text);
  if (strategy !== "conceptual" && isLegacyPsychologyDefault) {
    return "Keep every image in one cohesive visual series. Repeat the same palette, lighting, texture, and recurring character or symbolic motif. Avoid random unrelated portraits unless the selected image mood needs them.";
  }
  return text;
}

function buildVisualStyle({ imageMood, style, promptQuality, strategy }) {
  const quality = resolvePromptQualityMode(promptQuality);
  const styleText = normalizeImageStyle(style, strategy);
  const strategyStyle =
    strategy === "kids-cartoon"
      ? "cohesive Indian kids cartoon series, cute rounded characters, bright balanced colors, clean readable backgrounds, playful local Indian details, gentle humor, safe adventure, child-friendly moral"
      : strategy === "conceptual"
      ? "cohesive dark symbolic sketch series, charcoal ink texture, deep black negative space, muted amber or cyan accent, metaphor-driven frames, not photorealistic portraits"
      : strategy === "relationship"
        ? "cohesive personalized relationship reel, intimate cinematic realism with symbolic love and heartbreak objects, consistent recurring couple or relationship motif, soft shadows, rain-window light, phone glow without readable text, tasteful non-explicit emotion"
      : strategy === "hybrid"
        ? "cohesive editorial visual series, symbolic objects mixed with grounded cinematic details, controlled palette, consistent lighting"
        : "";
  return [strategyStyle, resolveImageMoodPrompt(imageMood), quality.prompt, styleText].filter(Boolean).join(", ");
}

function normalizeVisualBible(bible, { visualStrategy, styleBible }) {
  const source = typeof bible === "object" && bible ? bible : {};
  const isRelationship = visualStrategy === "relationship";
  const isConceptual = visualStrategy === "conceptual";
  const isKidsCartoon = visualStrategy === "kids-cartoon";
  return {
    overallLook: cleanSubtitleText(
      source.overallLook ||
        source.look ||
        (isKidsCartoon
          ? "bright child-safe Indian cartoon episode with cute rounded characters, expressive faces, clean backgrounds, and playful local details"
          : isConceptual
          ? "dark symbolic sketch editorial reel with charcoal texture, deep negative space, and metaphor-driven frames"
          : isRelationship
            ? "personalized Indian relationship drama reel with intimate cinematic realism and emotional object symbolism"
            : styleBible || "cohesive cinematic short-form visual series"),
    ),
    recurringSubject: cleanSubtitleText(
      source.recurringSubject ||
        source.subject ||
        source.recurringMotif ||
        (isKidsCartoon
          ? "one cute recurring Indian child hero or animal friend with full age/species, clothing, color, personality, and key prop described in every prompt"
          : isConceptual
          ? "a faceless black silhouette with tangled charcoal thought-lines and one repeated symbolic object"
          : isRelationship
            ? "a recurring relationship motif such as two tea cups, phone glow without readable text, rain on a window, ring, scarf, or one person alone in soft shadow"
            : "one consistent character, object, location, or symbolic motif chosen from the script"),
    ),
    palette: cleanSubtitleText(
      source.palette ||
        (isKidsCartoon
          ? "bright mango yellow, sky blue, leaf green, warm coral, and soft cream balanced with clean contrast"
          : isConceptual
          ? "deep black, charcoal grey, muted amber or cyan accent"
          : isRelationship
            ? "warm shadows, muted rose, rain-blue, soft amber practical light"
            : "consistent limited palette chosen for the selected image mood"),
    ),
    lighting: cleanSubtitleText(
      source.lighting ||
        (isKidsCartoon
          ? "sunny soft daylight, gentle festival glow, or warm home light with clear readable faces"
          : isConceptual
          ? "high-contrast spotlight, heavy shadow, paper texture"
          : isRelationship
            ? "soft practical light, phone glow, rain-window reflections, intimate shadows"
            : "consistent motivated cinematic lighting"),
    ),
    cameraStyle: cleanSubtitleText(
      source.cameraStyle ||
        source.camera ||
        "9:16 vertical short-form composition, strong foreground/background separation, phone-readable focal point",
    ),
    environmentLogic: cleanSubtitleText(
      source.environmentLogic ||
        source.environment ||
        "Keep locations and props logically connected to the story beat; avoid random unrelated scenes.",
    ),
    continuityRules: Array.isArray(source.continuityRules)
      ? source.continuityRules.map(cleanSubtitleText).filter(Boolean).slice(0, 6)
      : [
          "Repeat the visual bible inside every prompt because each image is generated separately.",
          "Do not rely on character names alone; fully describe recurring subjects.",
          "Keep palette, lighting, texture, and camera language consistent across all frames.",
        ],
    negativePrompt: cleanSubtitleText(
      source.negativePrompt ||
        (isKidsCartoon
          ? "text, watermark, logo, subtitles, speech bubbles, scary faces, creepy horror, weapons, gore, injury, bullying humiliation, romance, unsafe stunts, distorted hands, extra fingers, random unrelated characters, inconsistent character design"
          : "text, watermark, logo, subtitles, blurry, low quality, distorted hands, extra fingers, random unrelated people, inconsistent faces"),
    ),
  };
}

function visualBiblePromptPrefix(visualBible) {
  const rules = Array.isArray(visualBible.continuityRules) ? visualBible.continuityRules.join("; ") : "";
  return `Visual bible: ${visualBible.overallLook}. Recurring subject or motif: ${visualBible.recurringSubject}. Palette: ${visualBible.palette}. Lighting: ${visualBible.lighting}. Camera style: ${visualBible.cameraStyle}. Environment logic: ${visualBible.environmentLogic}. Continuity rules: ${rules}.`;
}

function buildStoryboardPrompt({ text, imageMood, style, platform, audioDuration, targetSecondsPerImage, promptQuality }) {
  const selectedPlatform = String(platform || "shorts").trim();
  const visualStrategy = inferStoryboardVisualStrategy({ text, imageMood, style, promptQuality });
  const visualStyle = buildVisualStyle({ imageMood, style, promptQuality, strategy: visualStrategy });
  const duration = Number(audioDuration) > 0 ? Number(audioDuration) : null;
  const maxSecondsPerImage = Math.min(Math.max(Number(targetSecondsPerImage) || 5, 3), 6);
  const minimumFrames = duration ? Math.max(1, Math.ceil(duration / maxSecondsPerImage)) : 5;
  const timingRule = duration
    ? `The generated narration audio is ${duration.toFixed(2)} seconds long. Create at least ${minimumFrames} images because no image should stay on screen longer than about ${maxSecondsPerImage} seconds. Cover the full timeline from 0.0s to ${duration.toFixed(2)}s without gaps. Segment timing should follow story pacing: use 3-4 second images for quick hooks, reveals, or emotional turns; use 5-6 seconds only for slower moments.`
    : `No exact audio duration is available. Estimate a timeline and use at least ${minimumFrames} images.`;

  return `
You are an expert film director, storyboard artist, and retention editor for short-form vertical video.
Analyze this Hindi story like a director whose job is to keep viewers engaged until the end.
Create a timed image plan for ${selectedPlatform}.
${timingRule}
You may add more images than the minimum for fast emotional turns, pauses, hooks, reveals, or suspense beats, but avoid filler.
The final images will be generated with Google Flow, so write prompts that are visual, cinematic, and specific.
${visualStrategyText(visualStrategy)}

Rules:
- Output JSON only.
- Use a 9:16 vertical composition for every prompt.
- First create a visualBible object, then make every frame prompt obey it.
- The visualBible must define overallLook, recurringSubject, palette, lighting, cameraStyle, environmentLogic, continuityRules, and negativePrompt.
- Keep the style bible, palette, subject logic, lighting, texture, and visual language consistent across every frame.
- Stay faithful to the script. Do not invent major new characters, objects, backstory, or locations unless the story leaves a visual detail unspecified.
- If the selected visual strategy is conceptual, do not create a literal protagonist unless the script clearly requires one.
- If no character is needed, use recurring symbolic elements instead and describe the same symbol style in every prompt.
- Every prompt must be fully standalone because each image is generated separately.
- Every frame duration should usually be 3-5 seconds and must not exceed 6 seconds unless the total audio is shorter than that.
- Do not say "same character", "same style", "as before", "previous frame", "continue", or reference another prompt.
- Re-describe the visual style, recurring subject/symbol, palette, texture, lighting, composition, camera/framing, and mood in every single prompt.
- Reuse the visualBible details inside every prompt. Since images are generated separately, each prompt must include the full recurring subject/motif, palette, lighting, and camera style.
- For conceptual frames only, mention "no realistic human portrait, no random person, no stock photo look" inside the prompt when helpful.
- No text, subtitles, watermarks, logos, UI, captions, or speech bubbles inside images.
- Avoid gore or graphic violence.
- Make each frame progress the story visually.
- Prompts should be in English so image models follow them better, but preserve Indian/Hindi cultural details.
- Add detailed camera language: shot type, lens feel, lighting, mood, foreground/background, composition, emotion, and visual hook.
- Follow the selected prompt quality mode for prompt length and detail density while keeping every prompt standalone.
- Prompt quality mode rules:
${qualityRulesText(promptQuality)}
- Use this visual style: ${visualStyle}

Return this exact JSON shape:
{
  "title": "short title",
  "visualStyle": "one sentence style bible",
  "visualStrategy": "${visualStrategy}",
  "visualBible": {
    "overallLook": "specific overall image style",
    "recurringSubject": "full recurring character, object, or symbolic motif description",
    "palette": "limited palette",
    "lighting": "consistent lighting plan",
    "cameraStyle": "consistent camera/framing language",
    "environmentLogic": "how locations/props stay coherent",
    "continuityRules": ["rule 1", "rule 2", "rule 3"],
    "negativePrompt": "global negative prompt"
  },
  "directorPlan": "why this number of images keeps viewers engaged",
  "characters": ["consistent character or recurring symbolic element description"],
  "frames": [
    {
      "number": 1,
      "startTime": 0,
      "endTime": 5,
      "moment": "short story beat",
      "durationSeconds": 5,
      "prompt": "Flow-ready image prompt",
      "negativePrompt": "text, watermark, logo, subtitles, blurry, low quality, distorted hands, extra fingers"
    }
  ]
}

Hindi story:
${text}
`.trim();
}

function strengthenStoryboardFrames(storyboard, { visualStrategy, imageMood, style, promptQuality }) {
  const styleBible = buildVisualStyle({ imageMood, style, promptQuality, strategy: visualStrategy });
  const visualBible = normalizeVisualBible(storyboard?.visualBible, { visualStrategy, styleBible });
  const visualBiblePrefix = visualBiblePromptPrefix(visualBible);
  const strategyPrefix =
    visualStrategy === "kids-cartoon"
      ? `Cohesive Indian kids cartoon series, cute rounded recurring characters, bright balanced colors, simple readable action, playful local Indian home/school/park/festival details, gentle humor, child-safe moral, no scary or unsafe imagery. `
      : visualStrategy === "conceptual"
      ? `Cohesive dark psychological sketch illustration series, charcoal and ink texture, deep black negative space, muted amber or cyan accent, symbolic visual metaphor, no realistic human portrait, no random person, no stock photo look. `
      : visualStrategy === "relationship"
        ? `Cohesive personalized relationship drama visual series, intimate Indian cinematic realism, soft shadows, rain-window or phone-glow atmosphere without readable text, emotionally specific love or heartbreak symbolism, tasteful non-explicit mood, no stock romance photo. `
      : visualStrategy === "hybrid"
        ? `Cohesive editorial visual series, controlled palette and lighting, symbolic objects mixed with grounded context, no random unrelated portraits. `
        : `Cohesive visual series with consistent subject logic, palette, lighting, and style. `;

  const frames = Array.isArray(storyboard?.frames) ? storyboard.frames : [];
  return {
    ...storyboard,
    visualStrategy: storyboard?.visualStrategy || visualStrategy,
    visualStyle: storyboard?.visualStyle || styleBible,
    visualBible,
    characters:
      Array.isArray(storyboard?.characters) && storyboard.characters.length
        ? storyboard.characters
        : visualStrategy === "kids-cartoon"
          ? ["Recurring kids cartoon character: a cute Indian child hero or animal friend with rounded features, bright clothing or colors, playful expression, and one signature prop repeated in every prompt."]
        : visualStrategy === "conceptual"
          ? ["Recurring symbolic element: a faceless black silhouette and tangled charcoal thought-lines in a dark sketch world, repeated as a visual motif when a human figure is needed."]
          : visualStrategy === "relationship"
            ? ["Recurring relationship motif: intimate Indian love or heartbreak symbols such as two tea cups, a phone glow with no readable text, rain on a window, a ring, a scarf, or one person alone in soft cinematic shadow."]
          : [],
    frames: frames.map((frame) => {
      const prompt = String(frame.prompt || "").trim();
      const needsPrefix =
        (visualStrategy === "conceptual" &&
          !/charcoal|sketch|symbolic|metaphor|silhouette|no realistic human portrait|no random person/i.test(prompt)) ||
        (visualStrategy === "kids-cartoon" &&
          !/cartoon|child-safe|kids|cute|rounded|bright|school|animal|friend|Indian/i.test(prompt)) ||
        (visualStrategy === "relationship" &&
          !/relationship|breakup|love|heartbreak|couple|phone glow|rain|ring|scarf|intimate|personal|soft shadow/i.test(prompt));
      const promptWithStrategy = `${needsPrefix ? strategyPrefix : ""}${prompt}`.trim();
      const strengthenedPrompt = `${visualBiblePrefix} Frame-specific moment: ${promptWithStrategy}`.trim();
      const negativePrompt = [
        visualBible.negativePrompt,
        frame.negativePrompt || "",
        visualStrategy === "conceptual"
          ? "photorealistic portrait, random different person, stock photo, glamour model, inconsistent face, lifestyle photoshoot"
          : visualStrategy === "kids-cartoon"
            ? "scary face, horror, weapons, gore, injury, bullying humiliation, romance, dangerous stunt, text, logo, speech bubble, random different character, inconsistent character design"
          : visualStrategy === "relationship"
            ? "random different couple, stock romance photo, glamour shoot, explicit sexual content, inconsistent faces, unrelated portrait"
            : "random different person, inconsistent face, unrelated portrait",
        "text, watermark, logo, subtitles, blurry, low quality, distorted hands, extra fingers",
      ]
        .filter(Boolean)
        .join(", ");
      return {
        ...frame,
        prompt: strengthenedPrompt,
        negativePrompt,
      };
    }),
  };
}

function buildAudioAwareStoryboardPrompt({ imageMood, style, platform, audioDuration, targetSecondsPerImage, promptQuality }) {
  const selectedPlatform = String(platform || "shorts").trim();
  const visualStrategy = inferStoryboardVisualStrategy({ text: "", imageMood, style, promptQuality });
  const visualStyle = buildVisualStyle({ imageMood, style, promptQuality, strategy: visualStrategy });
  const duration = Number(audioDuration) > 0 ? Number(audioDuration) : null;
  const maxSecondsPerImage = Math.min(Math.max(Number(targetSecondsPerImage) || 5, 3), 6);
  const minimumFrames = duration ? Math.max(1, Math.ceil(duration / maxSecondsPerImage)) : 5;
  const timingRule = duration
    ? `The audio is ${duration.toFixed(2)} seconds long. Create at least ${minimumFrames} image prompts because no image should stay on screen longer than about ${maxSecondsPerImage} seconds. Cover 0.0s to ${duration.toFixed(2)}s without gaps. Segment timing should follow the narration: use 3-4 second images around suspense, pauses, reveals, or emotional turns; use 5-6 seconds only for slower sections.`
    : `Use at least ${minimumFrames} image prompts and infer timing from the narration pace.`;

  return `
You are an expert film director, storyboard artist, retention editor, and audio-aware visual planner for short-form video.
Listen to the attached Hindi narration audio only. Do not rely on a transcript.
Infer the story, emotional pacing, pauses, suspense beats, scene changes, and key visual moments from the audio.
Create a timed Flow image prompt plan for ${selectedPlatform}.
${timingRule}
${visualStrategyText(visualStrategy)}

Rules:
- Output JSON only.
- Use a 9:16 vertical composition for every prompt.
- First create a visualBible object, then make every frame prompt obey it.
- The visualBible must define overallLook, recurringSubject, palette, lighting, cameraStyle, environmentLogic, continuityRules, and negativePrompt.
- Every frame must include startTime, endTime, durationSeconds, moment, prompt, and negativePrompt.
- Also return subtitleSegments with exact or near-exact Hindi subtitles inferred from the audio.
- Subtitle segment timings must follow the spoken words, not the image prompts. Keep subtitle text concise and subtitle-ready.
- Align image changes with narration pacing, pauses, reveals, emotional turns, and hooks.
- Every frame duration should usually be 3-5 seconds and must not exceed 6 seconds unless the total audio is shorter than that.
- Every prompt must be fully standalone because each image is generated separately.
- Do not say "same character", "as before", "previous frame", "continue", or reference another prompt.
- Re-describe the full visual style, recurring subject/symbol or character, palette, texture, lighting, camera/framing, and mood in every single prompt.
- Reuse the visualBible details inside every prompt. Since images are generated separately, each prompt must include the full recurring subject/motif, palette, lighting, and camera style.
- If the selected visual strategy is conceptual, prefer symbolic sketch/metaphor frames over random photorealistic people.
- If the audio implies recurring characters, keep them visually consistent by fully describing them in every prompt. If no character is required, use recurring symbols instead.
- No text, subtitles, watermarks, logos, UI, captions, or speech bubbles inside images.
- Avoid gore or graphic violence.
- Prompts should be in English for Flow, while preserving Indian/Hindi cultural details inferred from the audio.
- Add detailed camera language: shot type, lens feel, lighting, mood, foreground/background, composition, emotion, and visual hook.
- Follow the selected prompt quality mode for prompt length and detail density while keeping every prompt standalone.
- Prompt quality mode rules:
${qualityRulesText(promptQuality)}
- Use this visual style: ${visualStyle}

Return this exact JSON shape:
{
  "title": "short title",
  "visualStyle": "one sentence style bible",
  "visualStrategy": "${visualStrategy}",
  "visualBible": {
    "overallLook": "specific overall image style inferred from audio",
    "recurringSubject": "full recurring character, object, or symbolic motif description",
    "palette": "limited palette",
    "lighting": "consistent lighting plan",
    "cameraStyle": "consistent camera/framing language",
    "environmentLogic": "how locations/props stay coherent",
    "continuityRules": ["rule 1", "rule 2", "rule 3"],
    "negativePrompt": "global negative prompt"
  },
  "directorPlan": "how the frame count and timing follow the audio pace",
  "characters": ["consistent character or recurring symbolic element description inferred from audio"],
  "subtitleSegments": [
    {
      "number": 1,
      "startTime": 0,
      "endTime": 3.2,
      "durationSeconds": 3.2,
      "text": "Hindi subtitle text heard in this time range"
    }
  ],
  "frames": [
    {
      "number": 1,
      "startTime": 0,
      "endTime": 5,
      "moment": "short story beat heard in this time range",
      "durationSeconds": 5,
      "prompt": "Flow-ready image prompt",
      "negativePrompt": "text, watermark, logo, subtitles, blurry, low quality, distorted hands, extra fingers"
    }
  ]
}
`.trim();
}

function buildAudioTimelinePrompt({ platform, audioDuration, targetSecondsPerImage }) {
  const selectedPlatform = String(platform || "shorts").trim();
  const duration = Number(audioDuration) > 0 ? Number(audioDuration) : null;
  const maxSecondsPerImage = Math.min(Math.max(Number(targetSecondsPerImage) || 5, 3), 6);
  const minimumSegments = duration ? Math.max(1, Math.ceil(duration / maxSecondsPerImage)) : 5;
  const timingRule = duration
    ? `The audio is ${duration.toFixed(2)} seconds long. Create at least ${minimumSegments} timeline segments. Cover 0.0s to ${duration.toFixed(2)}s without gaps. Segment lengths should follow narration pace: 2.5-4 seconds for hooks, emotional turns, reveals, or fast delivery; 5-6 seconds for calm or slow delivery. Never make a segment longer than 6 seconds unless the total audio is shorter than that.`
    : `Create at least ${minimumSegments} timeline segments. Segment lengths should usually be 2.5-6 seconds.`;

  return `
You are a Hindi audio transcription specialist, story analyst, and retention editor for ${selectedPlatform}.
Listen to the attached Hindi narration audio only. Do not use any transcript.
Create a very detailed timed transcript and visual beat sheet that can later be used to generate reel/short image prompts.
${timingRule}

Rules:
- Output JSON only.
- Transcribe the Hindi narration as accurately as possible, segment by segment.
- Make transcriptHindi subtitle-ready: concise, readable, and faithful to the spoken Hindi.
- Segment boundaries must follow natural audio pacing: pauses, suspense beats, sentence endings, emotional turns, and reveals.
- Do not force equal 5-second chunks. Use the audio rhythm.
- Each segment should be detailed enough for a second model call to create a visual prompt without hearing the audio.
- If a segment has no clear visual change, still describe the emotional or atmospheric reason to keep or change the image.
- Keep timestamps numeric seconds, not strings.
- Do not create image prompts in this step.

Return this exact JSON shape:
{
  "title": "short inferred title",
  "language": "Hindi",
  "audioSummary": "detailed summary of the narration",
  "directorNotes": "how the pace, pauses, and reveals should influence image timing",
  "segments": [
    {
      "number": 1,
      "startTime": 0,
      "endTime": 4.2,
      "durationSeconds": 4.2,
      "transcriptHindi": "exact or near-exact Hindi words heard in this segment",
      "transcriptEnglish": "meaning of this segment in English",
      "emotion": "emotion/tone heard in the voice",
      "pace": "slow, medium, fast, pause-heavy, urgent, etc.",
      "pauseOrBeat": "important pause, breath, suspense beat, or transition",
      "visualBeat": "what image moment this segment suggests",
      "importance": 1
    }
  ]
}
`.trim();
}

function buildStoryboardFromTimelinePrompt({ timeline, imageMood, style, platform, targetSecondsPerImage, promptQuality }) {
  const selectedPlatform = String(platform || "shorts").trim();
  const timelineText = JSON.stringify(timeline || {});
  const visualStrategy = inferStoryboardVisualStrategy({ text: timelineText, imageMood, style, promptQuality });
  const visualStyle = buildVisualStyle({ imageMood, style, promptQuality, strategy: visualStrategy });
  const maxSecondsPerImage = Math.min(Math.max(Number(targetSecondsPerImage) || 5, 3), 6);

  return `
You are an expert film director, storyboard artist, image prompt writer, and retention editor for short-form video.
Use the provided audio-derived timed transcript to create Google Flow image prompts for ${selectedPlatform}.
The timeline was created by listening to the narration audio. Treat it as the source of truth for pacing and story beats.
${visualStrategyText(visualStrategy)}

Timing rules:
- Create one image prompt for every timeline segment unless two neighboring segments are clearly the same visual moment and together stay under ${maxSecondsPerImage} seconds.
- No final frame should last longer than 6 seconds unless the entire audio is shorter than that.
- Prefer 3-4 second images when suspense, reveals, pauses, or emotional shifts happen.
- Preserve the startTime and endTime from the timeline whenever possible.
- Cover the full timeline without gaps.

Prompt rules:
- Output JSON only.
- Use a 9:16 vertical composition for every prompt.
- First create a visualBible object, then make every frame prompt obey it.
- The visualBible must define overallLook, recurringSubject, palette, lighting, cameraStyle, environmentLogic, continuityRules, and negativePrompt.
- Every prompt must be fully standalone because each image is generated separately.
- Do not say "same character", "as before", "previous frame", "continue", or reference another prompt.
- Re-describe recurring visual elements fully in every prompt: subject/symbol or character, style, palette, texture, lighting, framing, environment, and mood.
- Reuse the visualBible details inside every prompt. Since images are generated separately, each prompt must include the full recurring subject/motif, palette, lighting, and camera style.
- If the selected visual strategy is conceptual, prefer dark symbolic sketch/metaphor frames over random photorealistic humans.
- If no character is essential, use recurring symbols such as a faceless silhouette, cracked mirror, tangled thread, empty chair, maze, shadow, door, cage, mask, or paper cutout.
- Keep visual identity consistent across frames through repeated full descriptions, not references.
- Preserve Indian/Hindi cultural details inferred from the transcript.
- No text, subtitles, watermarks, logos, UI, captions, or speech bubbles inside images.
- Avoid gore or graphic violence.
- Follow the selected prompt quality mode for prompt length and detail density while keeping every prompt standalone.
- Add camera language: shot size, lens feel, lighting, foreground/background, composition, emotion, and visual hook.
- Prompt quality mode rules:
${qualityRulesText(promptQuality)}
- Use this visual style: ${visualStyle}

Return this exact JSON shape:
{
  "title": "short title",
  "visualStyle": "one sentence style bible",
  "visualStrategy": "${visualStrategy}",
  "visualBible": {
    "overallLook": "specific overall image style based on the audio timeline",
    "recurringSubject": "full recurring character, object, or symbolic motif description",
    "palette": "limited palette",
    "lighting": "consistent lighting plan",
    "cameraStyle": "consistent camera/framing language",
    "environmentLogic": "how locations/props stay coherent",
    "continuityRules": ["rule 1", "rule 2", "rule 3"],
    "negativePrompt": "global negative prompt"
  },
  "directorPlan": "how the prompt timing follows the audio-derived transcript",
  "characters": ["consistent character or recurring symbolic element descriptions"],
  "frames": [
    {
      "number": 1,
      "startTime": 0,
      "endTime": 4.2,
      "durationSeconds": 4.2,
      "moment": "story beat from the timeline",
      "prompt": "Flow-ready image prompt",
      "negativePrompt": "text, watermark, logo, subtitles, blurry, low quality, distorted hands, extra fingers"
    }
  ]
}

Audio-derived timed transcript JSON:
${JSON.stringify(timeline, null, 2)}
`.trim();
}

function compactTimelineForPrompt(timeline) {
  return {
    title: timeline?.title || "",
    language: timeline?.language || "Hindi",
    audioSummary: timeline?.audioSummary || "",
    directorNotes: timeline?.directorNotes || "",
    segments: (Array.isArray(timeline?.segments) ? timeline.segments : []).map((segment, index) => ({
      number: Number(segment.number || index + 1),
      startTime: Number(segment.startTime || 0),
      endTime: Number(segment.endTime || 0),
      transcriptHindi: cleanSubtitleText(segment.transcriptHindi || segment.text || ""),
      transcriptEnglish: cleanSubtitleText(segment.transcriptEnglish || ""),
      emotion: cleanSubtitleText(segment.emotion || ""),
      pace: cleanSubtitleText(segment.pace || ""),
      pauseOrBeat: cleanSubtitleText(segment.pauseOrBeat || ""),
      visualBeat: cleanSubtitleText(segment.visualBeat || ""),
    })),
  };
}

function buildDirectorSummaryPrompt({
  timeline,
  imageMood,
  style,
  platform,
  promptQuality,
  voiceContext,
  text,
}) {
  const timelineText = JSON.stringify(compactTimelineForPrompt(timeline), null, 2);
  const visualStrategy = inferStoryboardVisualStrategy({ text: timelineText, imageMood, style, promptQuality });
  const visualStyle = buildVisualStyle({ imageMood, style, promptQuality, strategy: visualStrategy });
  const imageMoodPrompt = resolveImageMoodPrompt(imageMood);
  const contextText = JSON.stringify(voiceContext || {}, null, 2);

  return `
You are a senior short-form video director, visual strategist, and Google Flow prompt supervisor.
You are NOT writing image prompts yet.
Your job is to read the SRT-style timed transcript, understand the content, and create a strict director summary + visual bible that later image prompts must obey.

Source:
- Platform / format: ${platform || "reels/shorts"}
- Preferred image mood from user: ${imageMood || "default"}
- Preferred image mood instruction: ${imageMoodPrompt}
- Prompt quality mode: ${promptQuality}
- User visual direction: ${String(style || "").trim() || "none"}
- Initial script/story context: ${String(text || "").trim() || "not provided"}
- Audio/TTS generation context from earlier phases:
${contextText}

${visualStrategyText(visualStrategy)}

Audio-derived SRT/timeline:
${timelineText}

Rules:
- Output JSON only.
- First identify the real content type: kids-cartoon, psychology, relationship, horror, motivation, real-story, business, mythology, history, documentary, or mixed.
- Decide the best image type and theme from the transcript plus user preference: sketch, realistic, cinematic, dark, cartoon, documentary, symbolic, relationship-realism, horror-realism, etc.
- If user visual direction conflicts with the automatic theme, user direction wins unless it would make the visuals incoherent.
- Create a visualBible that is specific enough to stop random images: recurring subject/motif, palette, lighting, camera style, environment logic, continuity rules, and global negative prompt.
- Decide how caption lines should become images. A tiny caption like "Do you know that?" should become an image based on the visualBible and full surrounding context, not a random generic person.
- Mention what to avoid very clearly: unnecessary characters, random models, unrelated scenes, text in image, changing visual styles, and mismatched emotions.
- The visual plan must be suitable for separate image generation, so every later prompt can stand alone.

Return this exact JSON shape:
{
  "contentType": "kids-cartoon|psychology|relationship|horror|motivation|real-story|business|mythology|history|documentary|mixed",
  "visualStrategy": "${visualStrategy}",
  "visualTheme": "short theme name",
  "imageType": "sketch|realistic|cinematic|cartoon|documentary|symbolic|mixed",
  "aspectRatio": "9:16 vertical",
  "designLanguage": "how the images should feel visually",
  "audienceEmotion": "what viewer should feel",
  "storySummary": "concise story/content summary based on SRT",
  "visualStyle": "one sentence style bible",
  "visualBible": {
    "overallLook": "specific overall image style",
    "recurringSubject": "full recurring character, object, or symbolic motif description",
    "palette": "limited palette",
    "lighting": "consistent lighting plan",
    "cameraStyle": "consistent camera/framing language",
    "environmentLogic": "how locations/props stay coherent",
    "continuityRules": ["rule 1", "rule 2", "rule 3"],
    "negativePrompt": "global negative prompt"
  },
  "captionToImageLogic": "how each caption/beat should become a visual without inventing unnecessary things",
  "beatGroupingRules": ["when to group captions into one image", "when to cut to a new image"],
  "avoid": ["specific thing to avoid"],
  "directorPlan": "how this summary will keep prompts consistent and synced"
}

Baseline selected visual style:
${visualStyle}
`.trim();
}

function normalizeDirectorSummary(summary, { timeline, imageMood, style, promptQuality }) {
  const timelineText = JSON.stringify(compactTimelineForPrompt(timeline));
  const requestedStrategy = cleanSubtitleText(summary?.visualStrategy);
  const visualStrategy = ["kids-cartoon", "conceptual", "relationship", "story", "hybrid", "adaptive"].includes(requestedStrategy)
    ? requestedStrategy
    : inferStoryboardVisualStrategy({ text: timelineText, imageMood, style, promptQuality });
  const styleBible = buildVisualStyle({ imageMood, style, promptQuality, strategy: visualStrategy });
  const visualBible = normalizeVisualBible(summary?.visualBible, { visualStrategy, styleBible });
  return {
    contentType: cleanSubtitleText(summary?.contentType || "mixed"),
    visualStrategy,
    visualTheme: cleanSubtitleText(summary?.visualTheme || visualStrategy),
    imageType: cleanSubtitleText(summary?.imageType || "mixed"),
    aspectRatio: cleanSubtitleText(summary?.aspectRatio || "9:16 vertical"),
    designLanguage: cleanSubtitleText(summary?.designLanguage || styleBible),
    audienceEmotion: cleanSubtitleText(summary?.audienceEmotion || ""),
    storySummary: cleanSubtitleText(summary?.storySummary || timeline?.audioSummary || ""),
    visualStyle: cleanSubtitleText(summary?.visualStyle || styleBible),
    visualBible,
    captionToImageLogic: cleanSubtitleText(
      summary?.captionToImageLogic ||
        "Use each caption's meaning plus surrounding context to choose a visual beat that follows the visual bible; avoid literal random portraits.",
    ),
    beatGroupingRules: Array.isArray(summary?.beatGroupingRules)
      ? summary.beatGroupingRules.map(cleanSubtitleText).filter(Boolean).slice(0, 6)
      : [
          "Group neighboring captions into one image when they share the same visual idea.",
          "Cut to a new image when emotion, argument, scene, reveal, or object focus changes.",
          "Keep most image beats between 2 and 6 seconds.",
        ],
    avoid: Array.isArray(summary?.avoid)
      ? summary.avoid.map(cleanSubtitleText).filter(Boolean).slice(0, 10)
      : ["random unrelated people", "text inside images", "style changes between frames"],
    directorPlan: cleanSubtitleText(summary?.directorPlan || "Use SRT timing as the source of truth and visual bible as the consistency lock."),
  };
}

function buildSrtDirectorStoryboardPrompt({ timeline, directorSummary, platform, targetSecondsPerImage, promptQuality }) {
  const maxSecondsPerImage = Math.min(Math.max(Number(targetSecondsPerImage) || 5, 3), 6);
  return `
You are a Google Flow prompt director creating image prompts from an SRT-timed transcript.
Use the director summary as the visual law. Use the SRT line text as the moment-by-moment source of truth.

Platform: ${platform || "reels/shorts"}
Max preferred seconds per image: ${maxSecondsPerImage}
Prompt quality mode: ${promptQuality}

Director summary:
${JSON.stringify(directorSummary, null, 2)}

SRT/timeline:
${JSON.stringify(compactTimelineForPrompt(timeline), null, 2)}

Timing rules:
- Do not create an image for every tiny SRT caption automatically.
- Group neighboring captions into a visual beat when they share the same visual idea.
- Create a new image when the caption meaning, emotion, argument, reveal, subject, or scene changes.
- Most frames should last 2-6 seconds. Never exceed 6 seconds unless the total audio is shorter.
- Cover the full timeline without gaps.
- Preserve exact start/end timing from grouped SRT captions.

Prompt rules:
- Output JSON only.
- Each frame prompt must be fully standalone for Google Flow.
- Every prompt must include the visualBible details: overall look, recurring subject/motif, palette, lighting, camera style, environment logic.
- Use the caption text to decide the frame-specific visual, but do not become literal and random.
- Example: if caption says "Do you know that?" and the visualBible is dark psychology sketch, create a faceless silhouette/question motif. If the visualBible is realistic relationship drama, create an emotionally specific real scene that fits the context.
- Do not add unnecessary things. No random new characters, no changing faces, no unrelated locations, no text/captions/logos/UI in images.
- Prompts should be in English, while preserving Indian/Hindi cultural details when relevant.
- Include negativePrompt for every frame using the visualBible negative prompt plus frame-specific risks.
- Follow prompt quality rules:
${qualityRulesText(promptQuality)}

Return this exact JSON shape:
{
  "title": "short title",
  "visualStyle": "one sentence style bible",
  "visualStrategy": "${directorSummary.visualStrategy}",
  "visualBible": ${JSON.stringify(directorSummary.visualBible, null, 2)},
  "directorPlan": "how SRT grouping and visual bible were applied",
  "characters": ["recurring character or motif descriptions"],
  "frames": [
    {
      "number": 1,
      "startTime": 0,
      "endTime": 4.2,
      "durationSeconds": 4.2,
      "sourceCaptionNumbers": [1, 2],
      "captionText": "caption text used for this visual beat",
      "moment": "what this image communicates",
      "prompt": "Flow-ready standalone image prompt",
      "negativePrompt": "global + frame-specific negative prompt"
    }
  ]
}
`.trim();
}

function safeStockQuery(value) {
  return cleanSubtitleText(value)
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7)
    .join(" ")
    .slice(0, 90);
}

function normalizeStockTimeline(body) {
  const timeline = typeof body?.timeline === "object" && body.timeline ? body.timeline : null;
  const rawSegments = Array.isArray(timeline?.segments)
    ? timeline.segments
    : Array.isArray(timeline?.frames)
      ? timeline.frames
      : Array.isArray(body?.frames)
        ? body.frames
        : [];
  let segments = rawSegments
    .map((segment, index) => {
      const startTime = Math.max(0, Number(segment?.startTime ?? segment?.start ?? 0) || 0);
      const fallbackDuration = Math.max(1, Number(segment?.durationSeconds ?? segment?.duration ?? 4) || 4);
      const rawEnd = Number(segment?.endTime ?? segment?.end ?? startTime + fallbackDuration);
      const endTime = rawEnd > startTime ? rawEnd : startTime + fallbackDuration;
      const text = cleanSubtitleText(
        segment?.transcriptHindi ||
          segment?.text ||
          segment?.captionText ||
          segment?.caption ||
          segment?.visualBeat ||
          segment?.moment ||
          segment?.prompt,
      );
      if (!text) {
        return null;
      }
      return {
        number: Number(segment?.number || index + 1),
        startTime,
        endTime,
        durationSeconds: Math.max(0.1, endTime - startTime),
        text,
        visualBeat: cleanSubtitleText(segment?.visualBeat || segment?.moment || text),
        emotion: cleanSubtitleText(segment?.emotion || ""),
        pace: cleanSubtitleText(segment?.pace || ""),
      };
    })
    .filter(Boolean);

  if (!segments.length && body?.srt) {
    segments = timelineFromSrt(body.srt).segments;
  }

  return {
    title: cleanSubtitleText(timeline?.title || body?.title || "Stock video timeline"),
    language: cleanSubtitleText(timeline?.language || "Hindi"),
    audioSummary: cleanSubtitleText(timeline?.audioSummary || ""),
    segments,
  };
}

function buildStockVideoPlanPrompt({ text, timeline, source, platform, visualStyle, imageMood }) {
  const timelineText = JSON.stringify(
    {
      title: timeline.title,
      language: timeline.language,
      audioSummary: timeline.audioSummary,
      segments: timeline.segments.map((segment) => ({
        number: segment.number,
        startTime: segment.startTime,
        endTime: segment.endTime,
        durationSeconds: segment.durationSeconds,
        text: segment.text,
        visualBeat: segment.visualBeat,
        emotion: segment.emotion,
        pace: segment.pace,
      })),
    },
    null,
    2,
  );
  const selectedMood = resolveImageMoodPrompt(imageMood);
  return `
You are a stock-footage director for Hindi reels and shorts.
Create a Pexels/Pixabay search plan from this timed narration timeline.

Goal:
- Select stock-footage-searchable visual ideas for every segment.
- Use English search queries only because Pexels/Pixabay search works best in English.
- Keep each segment visually connected to the narration, but avoid over-specific impossible queries.
- Prefer real, cinematic, usable footage: people from behind, silhouettes, hands, streets, homes, school, office, nature, symbolic objects, crowds, phone, rain, shadows, city, rural India-like scenes when relevant.
- For psychology/motivation, prefer symbolic real footage instead of random smiling stock faces.
- For relationship content, prefer tasteful emotional footage and personal objects; avoid explicit or glamour content.
- For horror/suspense, prefer dark homes, empty corridors, shadows, doors, night roads; no gore.
- For kids cartoon content, stock video is usually weak; use safe playful children, school, toys, animals, playground, bright family-friendly scenes.

Output rules:
- JSON only.
- Create exactly one plan segment for each input timeline segment.
- Preserve startTime and endTime exactly.
- Each segment gets 2 to 4 short English search queries, 2 to 5 words each.
- Do not include celebrity names, brands, movie titles, copyrighted characters, or unsafe content.
- Do not include image generation prompts.

Context:
- Target format: ${cleanSubtitleText(platform || "9:16 reels/shorts")}
- Preferred stock source: ${cleanSubtitleText(source || "both")}
- Existing visual mood: ${selectedMood}
- User visual direction: ${cleanSubtitleText(visualStyle || "")}
- Script excerpt: ${cleanSubtitleText(text || "").slice(0, 1200)}

Timeline:
${timelineText}

Return this exact JSON shape:
{
  "title": "short stock video plan title",
  "visualStyle": "one sentence stock footage style direction",
  "segments": [
    {
      "number": 1,
      "startTime": 0,
      "endTime": 4.2,
      "durationSeconds": 4.2,
      "captionText": "caption or narration beat",
      "visualIntent": "what the stock footage should communicate",
      "searchQueries": ["lonely man window", "dark empty room"],
      "motion": "slow push, handheld, static, aerial, etc.",
      "avoid": "what would make this segment feel wrong"
    }
  ]
}
`.trim();
}

function normalizeStockVideoPlan(plan, timeline) {
  const inputSegments = timeline.segments;
  const returnedSegments = Array.isArray(plan?.segments) ? plan.segments : [];
  return {
    title: cleanSubtitleText(plan?.title || timeline.title || "Stock video plan"),
    visualStyle: cleanSubtitleText(plan?.visualStyle || "Cinematic vertical stock footage matched to narration beats."),
    segments: inputSegments.map((segment, index) => {
      const returned = returnedSegments.find((item) => Number(item?.number) === segment.number) || returnedSegments[index] || {};
      const queries = (Array.isArray(returned.searchQueries) ? returned.searchQueries : [])
        .map(safeStockQuery)
        .filter(Boolean)
        .slice(0, 4);
      const fallbackQuery = safeStockQuery(returned.visualIntent || segment.visualBeat || segment.text);
      return {
        number: segment.number,
        startTime: segment.startTime,
        endTime: segment.endTime,
        durationSeconds: segment.durationSeconds,
        captionText: cleanSubtitleText(returned.captionText || segment.text),
        visualIntent: cleanSubtitleText(returned.visualIntent || segment.visualBeat || segment.text),
        searchQueries: queries.length ? queries : [fallbackQuery || "cinematic emotional scene"],
        motion: cleanSubtitleText(returned.motion || "natural cinematic movement"),
        avoid: cleanSubtitleText(returned.avoid || "unrelated stock smiles, text overlays, logos, watermarks"),
      };
    }),
  };
}

function resolveStockSourceOrder(source, stockStore) {
  const requested = String(source || "both").toLowerCase();
  const order = requested === "pexels" ? ["pexels"] : requested === "pixabay" ? ["pixabay"] : ["pexels", "pixabay"];
  return order
    .map((provider) => ({ provider, keyInfo: resolveActiveStockKey(stockStore, provider) }))
    .filter((item) => item.keyInfo?.apiKey);
}

function stockVideoScore(candidate, targetDuration) {
  const durationScore = candidate.duration >= targetDuration ? 30 : Math.max(0, candidate.duration * 4);
  const portraitScore = candidate.height >= candidate.width ? 25 : 8;
  const resolutionScore = Math.min(25, ((candidate.width || 0) * (candidate.height || 0)) / (1080 * 1920) * 18);
  const providerScore = candidate.provider === "pexels" ? 4 : 2;
  return durationScore + portraitScore + resolutionScore + providerScore;
}

function choosePexelsVideoFile(videoFiles = []) {
  const mp4Files = videoFiles.filter((file) => String(file.file_type || "").includes("mp4") && file.link);
  return mp4Files
    .map((file) => ({
      ...file,
      score:
        (Number(file.height) >= Number(file.width) ? 40 : 10) +
        Math.min(35, ((Number(file.width) || 0) * (Number(file.height) || 0)) / (1080 * 1920) * 25) +
        (String(file.quality || "").toLowerCase() === "hd" ? 8 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0];
}

async function searchPexelsVideos(query, { keyInfo, minimumDuration = 2 }) {
  const params = new URLSearchParams({
    query,
    orientation: "portrait",
    per_page: "18",
  });
  const response = await fetch(`https://api.pexels.com/v1/videos/search?${params.toString()}`, {
    headers: {
      Authorization: keyInfo.apiKey,
      "User-Agent": "HindiVoiceStudio/1.0",
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(data?.error || `Pexels search failed with HTTP ${response.status}.`, {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      code: response.status === 429 ? "PEXELS_RATE_LIMIT" : "PEXELS_SEARCH_FAILED",
      provider: "pexels",
      keyId: keyInfo.id,
      details: data,
    });
  }
  return (Array.isArray(data.videos) ? data.videos : [])
    .map((video) => {
      const file = choosePexelsVideoFile(video.video_files || []);
      if (!file || Number(video.duration || 0) < minimumDuration) {
        return null;
      }
      return {
        id: `pexels-${video.id}-${file.id || createHash("md5").update(file.link).digest("hex").slice(0, 8)}`,
        provider: "pexels",
        query,
        url: file.link,
        pageUrl: video.url || "",
        preview: video.image || video.video_pictures?.[0]?.picture || "",
        duration: Number(video.duration || 0),
        width: Number(file.width || video.width || 0),
        height: Number(file.height || video.height || 0),
        fps: Number(file.fps || 0),
        creator: video.user?.name || "",
        creatorUrl: video.user?.url || "",
      };
    })
    .filter(Boolean);
}

function choosePixabayVideoFile(videos = {}) {
  return Object.entries(videos)
    .map(([quality, file]) => ({
      quality,
      ...file,
      score:
        (Number(file.height) >= Number(file.width) ? 40 : 10) +
        Math.min(35, ((Number(file.width) || 0) * (Number(file.height) || 0)) / (1080 * 1920) * 25),
    }))
    .filter((file) => file.url)
    .sort((a, b) => b.score - a.score)[0];
}

async function searchPixabayVideos(query, { keyInfo, minimumDuration = 2 }) {
  const params = new URLSearchParams({
    key: keyInfo.apiKey,
    q: query,
    video_type: "all",
    safesearch: "true",
    per_page: "24",
  });
  const response = await fetch(`https://pixabay.com/api/videos/?${params.toString()}`, {
    headers: { "User-Agent": "HindiVoiceStudio/1.0" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new AppError(data?.error || `Pixabay search failed with HTTP ${response.status}.`, {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      code: response.status === 429 ? "PIXABAY_RATE_LIMIT" : "PIXABAY_SEARCH_FAILED",
      provider: "pixabay",
      keyId: keyInfo.id,
      details: data,
    });
  }
  return (Array.isArray(data.hits) ? data.hits : [])
    .map((video) => {
      const file = choosePixabayVideoFile(video.videos || {});
      if (!file || Number(video.duration || 0) < minimumDuration) {
        return null;
      }
      return {
        id: `pixabay-${video.id}-${file.quality || "video"}`,
        provider: "pixabay",
        query,
        url: file.url,
        pageUrl: video.pageURL || "",
        preview: video.picture_id ? `https://i.vimeocdn.com/video/${video.picture_id}_640x360.jpg` : "",
        duration: Number(video.duration || 0),
        width: Number(file.width || 0),
        height: Number(file.height || 0),
        fps: 0,
        creator: video.user || "",
        creatorUrl: video.user_id && video.user ? `https://pixabay.com/users/${encodeURIComponent(video.user)}-${video.user_id}/` : "",
        tags: video.tags || "",
      };
    })
    .filter(Boolean);
}

async function findStockCandidatesForSegment(segment, sourceOrder) {
  const collected = [];
  const errors = [];
  const seenUrls = new Set();
  const minimumDuration = Math.min(Math.max(segment.durationSeconds * 0.45, 1.5), 4);
  for (const query of segment.searchQueries.slice(0, 3)) {
    for (const { provider, keyInfo } of sourceOrder) {
      try {
        const results =
          provider === "pexels"
            ? await searchPexelsVideos(query, { keyInfo, minimumDuration })
            : await searchPixabayVideos(query, { keyInfo, minimumDuration });
        for (const candidate of results) {
          if (!seenUrls.has(candidate.url)) {
            seenUrls.add(candidate.url);
            collected.push({
              ...candidate,
              score: stockVideoScore(candidate, segment.durationSeconds),
            });
          }
        }
      } catch (error) {
        errors.push({
          provider,
          query,
          code: error.code || "STOCK_SEARCH_FAILED",
          message: error.message,
        });
      }
      if (collected.length >= 4) {
        break;
      }
    }
    if (collected.length >= 4) {
      break;
    }
  }
  const candidates = collected.sort((a, b) => b.score - a.score).slice(0, 4);
  return {
    candidates,
    selectedClip: candidates[0] || null,
    searchErrors: errors.slice(0, 3),
  };
}

async function generateStockVideoTimeline(body) {
  const existingTimeline = normalizeStockTimeline(body);
  if (existingTimeline.segments.length) {
    const subtitleSegments = subtitleSegmentsFromTimeline(existingTimeline);
    return {
      schema: "hindi-voice-studio.stock-video-timeline.v1",
      model: "cached",
      source: body.srt ? "srt" : "timeline",
      timeline: existingTimeline,
      subtitleSegments,
      srt: buildSrt(subtitleSegments),
    };
  }

  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo?.apiKey) {
    throw new AppError("Missing Gemini API key. Add one in Settings before creating the video SRT.", {
      status: 400,
      code: "MISSING_GEMINI_KEY",
      provider: "gemini",
      model: STORYBOARD_MODEL,
    });
  }

  const audioBase64 = String(body.audioBase64 || "").replace(/^data:[^,]+,/, "");
  const audioMimeType = String(body.audioMimeType || "audio/wav").trim();
  if (audioBase64.length < 1000) {
    throw new AppError("Generate or select a voice take first so Video mode can create a timed SRT from the audio.", {
      status: 400,
      code: "AUDIO_REQUIRED",
      provider: "gemini",
      model: STORYBOARD_MODEL,
      keyId: keyInfo.id,
    });
  }

  const timelinePrompt = buildAudioTimelinePrompt({
    platform: body.platform,
    audioDuration: body.audioDuration,
    targetSecondsPerImage: body.maxClipDuration || body.targetSecondsPerImage || 5,
  }).replace("reel/short image prompts", "reel/short stock video clip selection");
  const timeline = await requestGeminiJson({
    keyInfo,
    parts: [
      { text: timelinePrompt },
      {
        inlineData: {
          mimeType: audioMimeType,
          data: audioBase64,
        },
      },
    ],
    temperature: 0.35,
  });

  if (!Array.isArray(timeline?.segments) || timeline.segments.length === 0) {
    throw new AppError("Video mode could not create timed SRT segments from the audio.", {
      status: 502,
      code: "NO_TIMELINE_RETURNED",
      provider: "gemini",
      model: STORYBOARD_MODEL,
      keyId: keyInfo.id,
      details: timeline,
    });
  }

  const normalizedTimeline = normalizeStockTimeline({ timeline, title: timeline.title });
  const subtitleSegments = subtitleSegmentsFromTimeline(normalizedTimeline);
  return {
    schema: "hindi-voice-studio.stock-video-timeline.v1",
    model: STORYBOARD_MODEL,
    keyId: keyInfo.id,
    keyLabel: keyInfo.label,
    source: "audio",
    timeline: normalizedTimeline,
    subtitleSegments,
    srt: buildSrt(subtitleSegments),
  };
}

async function generateStockVideoPlan(body) {
  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo?.apiKey) {
    throw new AppError("Missing Gemini API key. Add one in Settings before creating a stock video plan.", {
      status: 400,
      code: "MISSING_GEMINI_KEY",
      provider: "gemini",
    });
  }

  const stockStore = await loadStockKeyStore();
  const sourceOrder = resolveStockSourceOrder(body.source, stockStore);
  if (!sourceOrder.length) {
    throw new AppError("Add a Pexels or Pixabay API key in Settings before finding stock clips.", {
      status: 400,
      code: "MISSING_STOCK_MEDIA_KEY",
      provider: "stock",
    });
  }

  const timeline = normalizeStockTimeline(body);
  if (!timeline.segments.length) {
    throw new AppError("Generate an SRT/timeline first, then create a stock video plan.", {
      status: 400,
      code: "MISSING_STOCK_TIMELINE",
    });
  }

  const prompt = buildStockVideoPlanPrompt({
    text: body.text,
    timeline,
    source: body.source,
    platform: body.platform,
    visualStyle: body.visualStyle,
    imageMood: body.imageMood,
  });
  const rawPlan = await requestGeminiJson({
    keyInfo,
    model: STORYBOARD_MODEL,
    parts: [{ text: prompt }],
    temperature: 0.45,
  });
  const plan = normalizeStockVideoPlan(rawPlan, timeline);
  const maxSegments = Math.min(Math.max(Number(body.maxSegments || plan.segments.length) || plan.segments.length, 1), 80);
  const searchedSegments = [];
  for (const segment of plan.segments.slice(0, maxSegments)) {
    const searchResult = await findStockCandidatesForSegment(segment, sourceOrder);
    searchedSegments.push({ ...segment, ...searchResult });
  }

  return {
    schema: "hindi-voice-studio.stock-video-plan.v1",
    model: STORYBOARD_MODEL,
    keyId: keyInfo.id,
    title: plan.title,
    visualStyle: plan.visualStyle,
    source: body.source || "both",
    providersUsed: sourceOrder.map((item) => item.provider),
    width: STOCK_VIDEO_WIDTH,
    height: STOCK_VIDEO_HEIGHT,
    fps: STOCK_VIDEO_FPS,
    segments: searchedSegments,
    attributionRequired: true,
    attribution: [
      "Stock videos from Pexels and/or Pixabay. Keep provider/creator attribution where your final publishing flow requires it.",
    ],
  };
}

function validateStockVideoUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && STOCK_VIDEO_HOSTS.has(parsed.hostname.toLowerCase());
}

async function downloadStockClip(url, tempDir, index) {
  if (!validateStockVideoUrl(url)) {
    throw new AppError("A selected stock clip URL is not from an allowed Pexels/Pixabay host.", {
      status: 400,
      code: "UNTRUSTED_STOCK_CLIP_URL",
      details: { url },
    });
  }
  const response = await fetch(url, {
    headers: { "User-Agent": "HindiVoiceStudio/1.0" },
  });
  if (!response.ok) {
    throw new AppError(`Unable to download stock clip (${response.status}).`, {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      code: "STOCK_CLIP_DOWNLOAD_FAILED",
      details: { url, status: response.status },
    });
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) {
    throw new AppError("Downloaded stock clip is empty or invalid.", {
      status: 502,
      code: "STOCK_CLIP_EMPTY",
      details: { url },
    });
  }
  const clipPath = path.join(tempDir, `source-${String(index + 1).padStart(3, "0")}.mp4`);
  await fs.writeFile(clipPath, buffer);
  return clipPath;
}

function ffmpegConcatPath(filePath) {
  return filePath.replaceAll("\\", "/").replaceAll("'", "'\\''");
}

function stockH264Args({ preset = "veryfast", crf = "21" } = {}) {
  const gopSize = STOCK_VIDEO_FPS * 2;
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
    String(gopSize),
    "-keyint_min",
    String(gopSize),
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

async function renderStockVideo(body) {
  const ffmpegPath = await resolveFfmpegPath();
  const rawSegments = Array.isArray(body?.segments) ? body.segments : [];
  const segments = rawSegments
    .map((segment, index) => {
      const startTime = Math.max(0, Number(segment?.startTime ?? 0) || 0);
      const fallbackDuration = Math.max(0.5, Number(segment?.durationSeconds ?? 4) || 4);
      const endTime = Math.max(startTime + 0.5, Number(segment?.endTime ?? startTime + fallbackDuration) || startTime + fallbackDuration);
      const selectedClip = segment?.selectedClip || segment?.clip || null;
      return {
        number: Number(segment?.number || index + 1),
        startTime,
        endTime,
        durationSeconds: Math.max(0.5, endTime - startTime),
        captionText: cleanSubtitleText(segment?.captionText || ""),
        selectedClip,
      };
    })
    .filter((segment) => segment.selectedClip?.url);

  if (!segments.length) {
    throw new AppError("Choose at least one stock clip before rendering.", { status: 400, code: "NO_STOCK_CLIPS_SELECTED" });
  }

  await fs.mkdir(stockTempRoot, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(stockTempRoot, "stock-video-"));
  try {
    const segmentPaths = [];
    for (const [index, segment] of segments.entries()) {
      const sourcePath = await downloadStockClip(segment.selectedClip.url, tempDir, index);
      const segmentPath = path.join(tempDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
      const duration = Math.max(0.5, segment.durationSeconds);
      await execFileAsync(
        ffmpegPath,
        [
          "-y",
          "-stream_loop",
          "-1",
          "-i",
          sourcePath,
          "-t",
          duration.toFixed(3),
          "-vf",
          `scale=${STOCK_VIDEO_WIDTH}:${STOCK_VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${STOCK_VIDEO_WIDTH}:${STOCK_VIDEO_HEIGHT},setsar=1,fps=${STOCK_VIDEO_FPS},format=yuv420p`,
          "-an",
          ...stockH264Args({ crf: "20" }),
          segmentPath,
        ],
        { timeout: 180000, maxBuffer: 20_000_000 },
      );
      segmentPaths.push(segmentPath);
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
      ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-fps_mode", "cfr", "-r", String(STOCK_VIDEO_FPS), ...stockH264Args(), visualPath],
      { timeout: 180000, maxBuffer: 20_000_000 },
    );

    const includeAudio = body.includeAudio !== false && body.audioBase64;
    const burnSubtitles = body.burnSubtitles === true && body.srt;
    const audioPath = path.join(tempDir, "voice-audio");
    const subtitlePath = path.join(tempDir, "captions.ass");
    let outputPath = path.join(tempDir, "stock-video.mp4");
    let filterArgs = [];
    if (burnSubtitles) {
      const captionStyle = CAPTION_STYLE_IDS.has(String(body.captionStyle || "")) ? String(body.captionStyle) : "creator-yellow";
      const captionAnimation = String(body.captionAnimation || "auto");
      const captionPlacement = String(body.captionPlacement || "auto");
      const captionCenterSpec = String(body.captionCenterSpec || "");
      const assText = body.smartCaptions?.segments?.length
        ? buildAssFromSmartCaptions({
            plan: body.smartCaptions,
            fallbackSrtText: String(body.srt || ""),
            width: STOCK_VIDEO_WIDTH,
            height: STOCK_VIDEO_HEIGHT,
            styleId: captionStyle,
            animationMode: captionAnimation,
            placementMode: captionPlacement,
            centerSpec: captionCenterSpec,
          })
        : buildAssFromSrt({
            srtText: String(body.srt || ""),
            width: STOCK_VIDEO_WIDTH,
            height: STOCK_VIDEO_HEIGHT,
            styleId: captionStyle,
            animationMode: captionAnimation,
            placementMode: captionPlacement,
            centerSpec: captionCenterSpec,
          });
      await fs.writeFile(subtitlePath, assText, "utf8");
      filterArgs = ["-vf", "subtitles=captions.ass"];
    }

    if (includeAudio) {
      const mime = String(body.audioMimeType || "audio/wav");
      const extension = mime.includes("mpeg") || mime.includes("mp3") ? ".mp3" : ".wav";
      const fullAudioPath = `${audioPath}${extension}`;
      await fs.writeFile(fullAudioPath, Buffer.from(String(body.audioBase64 || ""), "base64"));
      await execFileAsync(
        ffmpegPath,
        [
          "-y",
          "-i",
          visualPath,
          "-i",
          fullAudioPath,
          ...filterArgs,
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
        { cwd: tempDir, timeout: 240000, maxBuffer: 20_000_000 },
      );
    } else if (filterArgs.length) {
      await execFileAsync(
        ffmpegPath,
        ["-y", "-i", visualPath, ...filterArgs, ...stockH264Args(), outputPath],
        { cwd: tempDir, timeout: 240000, maxBuffer: 20_000_000 },
      );
    } else {
      outputPath = visualPath;
    }

    const video = await fs.readFile(outputPath);
    return {
      video,
      filename: `${String(body.title || "stock-video").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "stock-video"}.mp4`,
      width: STOCK_VIDEO_WIDTH,
      height: STOCK_VIDEO_HEIGHT,
      fps: STOCK_VIDEO_FPS,
      durationSeconds: segments.reduce((sum, segment) => sum + segment.durationSeconds, 0),
      clipCount: segments.length,
      audioTrack: includeAudio ? "included" : "none",
      subtitles: burnSubtitles ? (body.smartCaptions?.segments?.length ? "smart-burned" : "burned") : "none",
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function synthesizeWithGemini({ text, voice, mood, style, model, voiceMode, speakers }) {
  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo?.apiKey) {
    throw new AppError("Missing Gemini API key. Add one in Settings before generating audio.", {
      status: 400,
      code: "MISSING_GEMINI_KEY",
      provider: "gemini",
    });
  }

  const selectedModel = GEMINI_TTS_MODELS.includes(model) ? model : GEMINI_TTS_MODELS[0];
  const selectedVoice = GOOGLE_VOICES.includes(voice) ? voice : "Kore";
  const selectedVoiceMode = voiceMode === "multi" ? "multi" : "single";
  const taggedSpeakers = selectedVoiceMode === "multi" ? extractSpeakersFromTaggedScript(text) : [];
  const resolvedSpeakers =
    selectedVoiceMode === "multi" && taggedSpeakers.length === 2 ? taggedSpeakers : selectedVoiceMode === "multi" ? resolveGeminiSpeakers(speakers) : [];
  const prompt =
    selectedVoiceMode === "multi"
      ? buildHindiDialoguePrompt(text, mood, style, resolvedSpeakers)
      : buildHindiPrompt(text, mood, style);
  const speechConfig = buildGeminiSpeechConfig({
    voiceMode: selectedVoiceMode,
    voice: selectedVoice,
    speakers: resolvedSpeakers,
  });

  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": keyInfo.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            temperature: 1.2,
            speechConfig,
          },
          model: selectedModel,
        }),
      },
    );
  } catch (error) {
    throw wrapNetworkError(error, { provider: "gemini", model: selectedModel, keyId: keyInfo.id });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw classifyGeminiError(data, response.status, { model: selectedModel, keyId: keyInfo.id });
  }

  const inlineData = data?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!inlineData?.data) {
    throw new AppError("Gemini did not return audio data. Try a shorter script, another voice, or another Gemini key.", {
      status: 502,
      code: "NO_AUDIO_RETURNED",
      provider: "gemini",
      model: selectedModel,
      keyId: keyInfo.id,
      details: data,
    });
  }

  const rawAudio = Buffer.from(inlineData.data, "base64");
  const mimeType = inlineData.mimeType || "audio/pcm";
  const audioBuffer = mimeType.includes("wav") ? rawAudio : createWavBuffer(rawAudio);
  let mp3Base64 = null;

  if (await hasFfmpeg()) {
    try {
      const mp3Buffer = await convertWavToMp3(audioBuffer);
      mp3Base64 = mp3Buffer.toString("base64");
    } catch {
      mp3Base64 = null;
    }
  }

  return {
    audioBase64: audioBuffer.toString("base64"),
    mimeType: "audio/wav",
    mp3Base64,
    mp3MimeType: mp3Base64 ? "audio/mpeg" : null,
    provider: "gemini",
    model: selectedModel,
    modelLabel: GEMINI_MODEL_LABELS[selectedModel] || selectedModel,
    voice: selectedVoiceMode === "multi" ? resolvedSpeakers.map((speaker) => `${speaker.name}: ${speaker.voice}`).join(", ") : selectedVoice,
    voiceMode: selectedVoiceMode,
    speakers: resolvedSpeakers,
    keyId: keyInfo.id,
    keyLabel: keyInfo.label,
  };
}

async function synthesizeWithNvidia({ text, voice, mood, style, model }) {
  const apiKey = process.env.NVIDIA_API_KEY;
  const endpoint = process.env.NVIDIA_TTS_URL;
  if (!apiKey || !endpoint) {
    throw new AppError("NVIDIA_TTS_URL and NVIDIA_API_KEY are required for the NVIDIA provider.", {
      status: 400,
      code: "MISSING_NVIDIA_CONFIG",
      provider: "nvidia",
    });
  }

  const selectedModel = NVIDIA_TTS_MODELS.some((item) => item.id === model) ? model : NVIDIA_TTS_MODELS[0].id;
  const selectedVoice = NVIDIA_VOICES.includes(voice) ? voice : NVIDIA_VOICES[0];
  const selectedStyle = resolveMoodPrompt(mood, style);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        text,
        voice: selectedVoice,
        model: selectedModel,
        language: "hi-IN",
        style: selectedStyle,
      }),
    });
  } catch (error) {
    throw wrapNetworkError(error, { provider: "nvidia", model: selectedModel, keyId: "NVIDIA_API_KEY" });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.detail || data?.error || data?.message || `NVIDIA request failed with HTTP ${response.status}.`;
    throw new AppError(message, {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      code: response.status === 429 ? "QUOTA_OR_RATE_LIMIT" : "NVIDIA_REQUEST_FAILED",
      provider: "nvidia",
      model: selectedModel,
      keyId: "NVIDIA_API_KEY",
      details: data,
    });
  }

  const audioBase64 =
    data.audio_base64 ||
    data.audioBase64 ||
    data.audio ||
    data?.artifacts?.[0]?.base64 ||
    data?.data?.[0]?.b64_json;

  if (!audioBase64) {
    throw new AppError("NVIDIA returned a response, but no recognizable base64 audio field was found.", {
      status: 502,
      code: "NO_AUDIO_RETURNED",
      provider: "nvidia",
      model: selectedModel,
      keyId: "NVIDIA_API_KEY",
      details: data,
    });
  }

  return {
    audioBase64,
    mimeType: data.mimeType || data.mime_type || "audio/wav",
    provider: "nvidia",
    model: selectedModel,
    modelLabel: NVIDIA_TTS_MODELS.find((item) => item.id === selectedModel)?.label || selectedModel,
    voice: selectedVoice,
  };
}

async function requestGeminiJsonDetailed({ keyInfo, parts, model = STORYBOARD_MODEL, temperature = 0.8, tools = null }) {
  let response;
  const hasTools = Array.isArray(tools) && tools.length > 0;
  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature,
    },
  };
  if (!hasTools) {
    body.generationConfig.responseMimeType = "application/json";
  }
  if (hasTools) {
    body.tools = tools;
  }

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
    throw wrapNetworkError(error, { provider: "gemini", model, keyId: keyInfo.id });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw classifyGeminiError(data, response.status, { model, keyId: keyInfo.id });
  }

  const textResponse = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n");
  return {
    json: extractJson(textResponse),
    groundingMetadata: data?.candidates?.[0]?.groundingMetadata || null,
    raw: data,
  };
}

async function requestGeminiJson({ keyInfo, parts, model = STORYBOARD_MODEL, temperature = 0.8, tools = null }) {
  const result = await requestGeminiJsonDetailed({ keyInfo, parts, model, temperature, tools });
  return result.json;
}

function extractGroundingSources(groundingMetadata) {
  const chunks = groundingMetadata?.groundingChunks || [];
  return chunks
    .map((chunk) => chunk.web)
    .filter((web) => web?.uri)
    .map((web) => ({ title: String(web.title || "Source"), uri: String(web.uri || "") }))
    .slice(0, 8);
}

function buildScriptResearchPrompt({ topic, contentType, category, duration, languageStyle, tone, energy, template, audience, researchDepth, history }) {
  const isKidsCartoon = contentType.id === "kids-cartoon" || category.id === "kids-cartoon";
  const depthLine =
    researchDepth === "deep"
      ? "Search broadly for current trends, niche sub-angles, audience questions, recent examples, and creator-friendly hooks."
      : "Search only enough to find current niche angles, fresh hooks, and audience language.";
  const historyLine = history?.length
    ? `Avoid repeating these recent user scripts or angles:\n${history
        .slice(0, 8)
        .map((item, index) => `${index + 1}. ${item.title || "Untitled"} - ${String(item.script || "").slice(0, 180)}`)
        .join("\n")}`
    : "No previous history was provided.";
  const kidsCartoonRules = isKidsCartoon
    ? `
Kids cartoon research lens for Indian children:
- Entertainment is the first filter; learning and morals should ride inside a fun story, not feel like a lecture.
- Prefer familiar Indian child worlds: home, school, tiffin break, park, monsoon, kite, festival, grandparents, siblings, pets, friendly animals, small neighborhood adventure.
- Favor cute recurring characters, visual comedy, simple problem-solving, music/rhythm, repeatable catchphrase, and a warm family/friendship payoff.
- Keep everything safe for children: no horror, gore, weapons, romance, dangerous dares, bullying humiliation, adult politics, scams, or heavy fear.
- For visuals, assume bright balanced colors, rounded shapes, expressive faces, readable action, and clean uncluttered frames.
`.trim()
    : "";

  return `
You are a short-form content researcher for Hindi/Indian creators.
Research and plan a reel script idea. Do not write the final script yet.

Topic: ${topic}
Content type: ${contentType.label} - ${contentType.prompt}
Category: ${category.label} - ${category.prompt}
Template: ${template.label} - ${template.description}
Template formula: ${template.formula}
Target duration: ${duration.label}
Language style: ${languageStyle}
Tone: ${tone.label} - ${tone.prompt}
Energy: ${energy.label} - ${energy.prompt}
Audience: ${audience || "Hindi short-form viewers in India"}
Research depth: ${researchDepth}
${depthLine}
${historyLine}
${kidsCartoonRules}

Rules:
- Output JSON only.
- Find niche, non-obvious angles instead of generic advice.
- Prefer angles that can open with a strong 2-second hook.
- Make the suggested angle fit the selected template formula. Do not return a generic category angle if the template implies a sharper structure.
- For psychology/motivation/relationship content, avoid medical diagnosis, therapy claims, or fake certainty.
- For real story/history/crime/business content, separate verified facts from dramatized storytelling.
- For kids-cartoon content, prioritize safe entertainment, humor, curiosity, friendship, family warmth, animal/child characters, and a gentle moral.
- Keep every idea suitable for Hindi/Hinglish reels.

Return this JSON shape:
{
  "researchSummary": "short summary of what is currently useful for this topic",
  "audienceInsight": "what the target viewer cares about",
  "trendSignals": ["current or evergreen signals found"],
  "nicheAngles": [
    {
      "angle": "specific angle",
      "whyItWorks": "why people will watch",
      "risk": "accuracy or sensitivity risk if any",
      "freshnessScore": 8,
      "retentionScore": 9
    }
  ],
  "hookBank": ["hook option 1", "hook option 2", "hook option 3"],
  "avoid": ["generic or risky angle to avoid"],
  "suggestedAngle": "best angle to write now"
}
`.trim();
}

function buildScriptWriterPrompt({
  topic,
  contentType,
  category,
  duration,
  languageStyle,
  tone,
  energy,
  template,
  scriptMode,
  audience,
  userVoice,
  selectedVoice,
  speakerOneVoice,
  speakerTwoVoice,
  customDirection,
  research,
  sources,
  history,
}) {
  const isKidsCartoon = contentType.id === "kids-cartoon" || category.id === "kids-cartoon";
  const modeRules = {
    single:
      "Write a one-voice TTS screenplay. ttsReadyScript must include separate bracketed direction tags like [Hook | direct, controlled | medium-fast] and [Pause | 0.6s]. Do not include speaker names or voice names.",
    "advanced-narrator":
      "Write a high-control one-voice TTS screenplay. ttsReadyScript must include frequent separate bracketed tags for sections, emotions, pace, pauses, breath, reveal, and final payoff.",
    dialogue:
      "Write a two-audio-role TTS screenplay. ttsReadyScript must use separate bracketed tags in the exact form [Story Role | VoiceName | emotion, delivery] before each spoken block, plus [Pause | 0.6s] tags where useful. Use exactly two roles and exactly two voices.",
  };
  const historyLine = history?.length
    ? `Recent user history to avoid repeating:\n${history
        .slice(0, 8)
        .map((item, index) => `${index + 1}. ${item.title || "Untitled"} - ${String(item.script || "").slice(0, 220)}`)
        .join("\n")}`
    : "No recent user history was provided.";
  const sourceLine = sources?.length
    ? `Research sources available for factual grounding:\n${sources.map((source, index) => `${index + 1}. ${source.title} - ${source.uri}`).join("\n")}`
    : "No live research sources were provided; write evergreen content and do not invent current facts.";
  const voiceCatalog = voiceCatalogForPrompt(GOOGLE_VOICES);
  const spokenLanguageRule =
    languageStyle === "Hinglish"
      ? "Spoken lines may use natural Hindi/Hinglish, but avoid fully romanized Hindi unless the user specifically asks for it. Prefer Devanagari Hindi words with familiar English terms only where they sound natural."
      : languageStyle === "Simple Hindi"
        ? "Spoken lines must be simple Devanagari Hindi. Do not romanize Hindi into Latin script. Keep bracketed direction tags in English."
      : "Spoken lines must be Devanagari Hindi. Do not romanize Hindi into Latin script. Keep bracketed direction tags in English.";
  const kidsCartoonRules = isKidsCartoon
    ? `
Kids cartoon episode rules for Indian children:
- Audience: Indian children roughly ages 5-10, with parent-safe viewing.
- Write entertainment first: funny visual action, cute character behavior, simple curiosity, music/rhythm, and one repeatable catchphrase.
- Use a small cast: one cute hero plus one friend/family/animal/object helper. Keep names simple and Indian-friendly.
- Preserve the user's given hero, animal, object, setting, and lesson. If the topic says squirrel and mango, do not change it to rabbit and carrot. Only invent missing details.
- Treat the topic's core setting and action as locked anchors. If the topic says school tiffin and sharing mangoes, the story must happen around school/tiffin sharing, not a different park/tree adventure.
- Story world should feel familiar: home, school, playground, park, village lane, apartment courtyard, market, festival, monsoon, grandparents, siblings, tiffin, kite, bicycle, mango tree.
- Keep conflict safe and small: lost toy, messy room, forgotten homework, shy friend, broken kite, sharing snacks, helping an animal, saving a plant, telling the truth.
- Gentle moral must be earned by action: kindness, teamwork, honesty, patience, courage, curiosity, cleanliness, caring for nature, respecting elders and friends.
- Avoid scary tone, horror, violence, weapons, injuries, dangerous dares, romance, bullying humiliation, adult themes, political/religious arguments, or manipulative fear.
- Voice tags should be lively, warm, playful, bright, curious, surprised, giggly, musical, and gentle. Do not use horror tags, seductive tone, heavy thriller tension, or adult-style suspense.
- Keep sentences short and easy. Prefer Simple Hindi when Hindi is selected. Add 2-4 short repeatable phrases children can remember.
`.trim()
    : "";

  return `
You are Script Writing 2.0: a senior Hindi reel scriptwriter, Gemini TTS voice director, retention editor, and audio screenplay formatter.
Your job is not to write plain content. Your job is to write a TTS PERFORMANCE SCREENPLAY optimized for Gemini 3.1 Flash TTS-style prompting.

Goal:
- Create an engaging ${duration.label} audio script on: ${topic}
- Content type: ${contentType.label} - ${contentType.prompt}
- Category: ${category.label} - ${category.prompt}
- Audience: ${audience || "Hindi short-form viewers in India"}
- Language style: ${languageStyle}
- Spoken language rule: ${spokenLanguageRule}
- Tone: ${tone.label} - ${tone.prompt}
- Voice energy: ${energy.label} - ${energy.prompt}
- Script template: ${template.label} - ${template.description}
- Template formula to follow: ${template.formula}
- User voice preference: ${userVoice || "natural Hindi creator voice"}
- User custom direction: ${customDirection || "none"}
- Target words: ${duration.targetWords}
- Target characters: ${duration.targetCharacters}; never exceed 4,500 characters in ttsReadyScript so the current TTS call stays under the 5,000 character limit.
- Script mode: ${scriptMode}
- Mode rule: ${modeRules[scriptMode]}
- Preferred single voice: ${selectedVoice || "Kore"}
- Dialogue voice choices: ${speakerOneVoice || "Kore"} and ${speakerTwoVoice || "Puck"}
- Available Gemini TTS voices: ${voiceCatalog}

Research context:
${JSON.stringify(research || {}, null, 2)}

${sourceLine}

${historyLine}

${kidsCartoonRules}

Writing rules:
- Output JSON only.
- First create a rough idea, then internally critique hook, retention, TTS performability, and tag quality, then revise once before returning the final JSON.
- Follow the selected template formula as the main story architecture. Do not drift into a generic listicle unless the template explicitly asks for it.
- Stay faithful to the user's topic. Do not replace named characters, animals, props, places, or core lesson with a different story.
- Hook must create curiosity in the first 1-2 lines.
- If content type is Reel / Short, keep the opening direct and clear. Do not start with a very slow intro or whisper unless the category is horror/suspense and it still feels swipe-proof.
- If content type is Kids Cartoon, open with a cheerful visual moment, a cute character action, or a repeatable phrase instead of fear, dark suspense, or adult motivational pressure.
- Whisper, very slow, breathy, and long-pause tags are allowed only when they improve the selected content type and category. For most reels, prefer clear, medium-fast, controlled tags.
- Tags must agree with the selected content type and energy. Do not create conflicting instructions like "slow whisper" plus "high-energy YouTube" in the same opening beat.
- Follow the spoken language rule exactly. Do not write Roman Hindi when Hindi or Simple Hindi is selected.
- Keep Hindi/Hinglish natural for Indian short-form viewers. Do not use awkward translation.
- Make the middle section build tension, insight, emotion, or story progression. No flat listicle unless the category demands it.
- End with a memorable payoff, twist, lesson, or question.
- Optimize for Gemini TTS: natural-language acting direction, short performable spoken lines, clear punctuation, dramatic pauses, emotional shifts, and speaker consistency.
- Do not include markdown fences.
- Do not include image prompts.
- Avoid false claims. If a topic needs facts but sources are weak, use careful language.
- For kids-cartoon content, never include unsafe behavior that children might imitate unless it is clearly corrected gently and safely.
- ttsReadyScript is the main output and MUST be a bracket-tagged TTS screenplay.
- Tags must be on their own line. The spoken Hindi/Hinglish text comes after the tag on the next line.
- Use [Pause | 0.4s], [Pause | 0.6s], or [Pause | 0.8s] between important beats. Do not overuse pauses.
- For single and advanced narrator modes, use section tags only: [Hook | direct, controlled | medium-fast], [Build | curious, focused | medium], [Reveal | shocked, low voice], [Payoff | firm, memorable | medium].
- For dialogue mode, use exactly two speaker roles. Prefer Narrator + Inner Voice/Expert/Character depending on category. Do not invent random names unless the story needs them.
- For dialogue mode, every speaker tag must use one of these voices exactly: ${speakerOneVoice || "Kore"} or ${speakerTwoVoice || "Puck"}.
- For dialogue mode, tag format must be: [Narrator | ${speakerOneVoice || "Kore"} | tense, slow]
- Never put English bracket tags inside spoken Hindi sentences. Tags are separate direction lines only.
- cleanScript must remove all bracket tags and keep only the spoken script.
- voiceDirection must explain the Audio Profile, Scene, and Director's Notes for the TTS backend.

Good single/advanced narrator format:
[Hook | direct, controlled | medium-fast]
क्या आपने कभी सोचा है कि आपका दिमाग आपको सबसे ज़्यादा कब धोखा देता है?

[Pause | 0.6s]

[Main | curious, focused | medium]
जब आप अकेले होते हैं...

Good dialogue format:
[Narrator | ${speakerOneVoice || "Kore"} | tense, slow]
उस रात घर में सिर्फ रवि था।

[Pause | 0.5s]

[Inner Voice | ${speakerTwoVoice || "Puck"} | whisper, fearful]
लेकिन ऊपर वाले कमरे से आवाज़ आ रही थी...

Quality rubric:
- Hook strength
- Retention curve
- Freshness of angle
- TTS readability
- TTS tag quality
- Category fit
- Specificity and emotional clarity
Revise until the overall qualityScore and ttsTagScore are at least 8.5. If it cannot reach 8.5 due to missing topic details, state the limitation in quality.notes but still return the best script.

Return this exact JSON shape:
{
  "title": "short reel title",
  "category": "${category.id}",
  "templateId": "${template.id}",
  "templateLabel": "${template.label}",
  "topic": "${topic}",
  "durationSeconds": ${duration.seconds},
  "targetCharacters": "${duration.targetCharacters}",
  "contentType": "${contentType.id}",
  "energy": "${energy.id}",
  "languageStyle": "${languageStyle}",
  "selectedAngle": "the angle used",
  "hookOptions": ["alternate hook 1", "alternate hook 2", "alternate hook 3"],
  "nicheAngles": ["angle 1", "angle 2", "angle 3"],
  "researchSummary": "what research/context influenced the script",
  "ttsReadyScript": "[Hook | direct, controlled | medium-fast]\\nspoken line\\n\\n[Pause | 0.6s]\\n\\n[Main | curious, focused | medium]\\nspoken line",
  "cleanScript": "same script with all bracket tags removed",
  "taggedPreview": "same as ttsReadyScript",
  "voiceDirection": "Audio Profile: ... Scene: ... Director's Notes: ... Explain that bracketed tags are acting directions and must not be spoken.",
  "recommendedVoice": "one Gemini voice name",
  "recommendedMood": "none|thriller|emotional|documentary|youtube|horror|calm",
  "voiceModeRecommendation": "single|multi",
  "speakerPlan": [
    { "speaker": "Narrator", "voice": "Kore", "role": "what this role performs" },
    { "speaker": "Second Role", "voice": "Puck", "role": "what this role performs" }
  ],
  "beatPlan": [
    { "beat": "Hook", "purpose": "why viewer keeps watching", "approxSeconds": "0-3" }
  ],
  "quality": {
    "qualityScore": 9,
    "hookScore": 9,
    "retentionScore": 9,
    "ttsReadinessScore": 9,
    "ttsTagScore": 9,
    "freshnessScore": 8,
    "notes": "short critique",
    "improvementsApplied": ["specific improvement made"]
  },
  "safetyNotes": ["claim or sensitivity note if any"]
}
`.trim();
}

function cleanTaggedScript(script) {
  return String(script || "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*\[[^\]]+\]\s*$/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countTtsTags(script) {
  return [...String(script || "").matchAll(/^\s*\[[^\]]+\]\s*$/gm)].length;
}

function ensureTaggedNarratorScript(script, tone, contentType, energy) {
  const trimmed = String(script || "").trim();
  if (countTtsTags(trimmed) >= 2) {
    return trimmed;
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return trimmed;
  }

  const first = lines.slice(0, Math.max(1, Math.ceil(lines.length / 3))).join("\n");
  const second = lines.slice(Math.max(1, Math.ceil(lines.length / 3)), Math.max(2, Math.ceil((lines.length * 2) / 3))).join("\n");
  const third = lines.slice(Math.max(2, Math.ceil((lines.length * 2) / 3))).join("\n");
  const isReel = contentType?.id === "reel";
  const isKidsCartoon = contentType?.id === "kids-cartoon";
  const isHighEnergy = energy?.id === "high";
  const toneHint =
    isKidsCartoon
      ? "playful, warm"
      : tone?.id === "horror"
      ? "eerie, tense"
      : isHighEnergy || tone?.id === "energetic"
        ? "direct, punchy"
        : "curious, controlled";
  const openingPace = isReel ? (isHighEnergy ? "fast" : "medium-fast") : "medium";
  const payoffPace = isReel ? "medium-fast" : "medium";

  return [
    `[Hook | ${toneHint} | ${openingPace}]`,
    first,
    "",
    "[Pause | 0.6s]",
    "",
    "[Main | rising tension | medium]",
    second || first,
    "",
    "[Pause | 0.5s]",
    "",
    `[Payoff | firm, memorable | ${payoffPace}]`,
    third || second || first,
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function validateScriptStudioV2(script, scriptMode) {
  const ttsReadyScript = String(script.ttsReadyScript || script.taggedPreview || script.cleanScript || "").trim();
  const tagCount = countTtsTags(ttsReadyScript);
  const hasPause = /^\s*\[\s*Pause\s*\|/im.test(ttsReadyScript);
  const hasDialogueTags = /^\s*\[[^\]|]+\s*\|\s*(?:Zephyr|Puck|Charon|Kore|Fenrir|Leda|Orus|Aoede|Callirrhoe|Autonoe|Enceladus|Iapetus|Umbriel|Algieba|Despina|Erinome|Algenib|Rasalgethi|Laomedeia|Achernar|Alnilam|Schedar|Gacrux|Pulcherrima|Achird|Zubenelgenubi|Vindemiatrix|Sadachbia|Sadaltager|Sulafat)\s*\|/m.test(
    ttsReadyScript,
  );

  if (!ttsReadyScript) {
    return ["missing ttsReadyScript"];
  }

  const issues = [];
  if (tagCount < 2) {
    issues.push("too few TTS direction tags");
  }
  if (!hasPause) {
    issues.push("missing pause tag");
  }
  if (scriptMode === "dialogue" && !hasDialogueTags) {
    issues.push("dialogue mode missing speaker voice tags");
  }
  return issues;
}

function normalizeScriptStudioV2(script, { scriptMode, tone, contentType, energy }) {
  const normalized = { ...script };
  normalized.version = "script-writing-2.0";
  normalized.ttsReadyScript =
    scriptMode === "dialogue"
      ? String(normalized.ttsReadyScript || normalized.taggedPreview || normalized.cleanScript || "").trim()
      : ensureTaggedNarratorScript(normalized.ttsReadyScript || normalized.taggedPreview || normalized.cleanScript, tone, contentType, energy);
  normalized.cleanScript = cleanTaggedScript(normalized.cleanScript || normalized.ttsReadyScript);
  normalized.taggedPreview = normalized.ttsReadyScript;
  normalized.voiceDirection =
    normalized.voiceDirection ||
    "Audio Profile: Hindi short-form narrator. Scene: close, intimate reel narration. Director's Notes: follow all bracketed screenplay tags as acting directions and pauses; never speak the bracketed text aloud.";
  normalized.quality = normalized.quality || {};
  normalized.quality.ttsTagScore = normalized.quality.ttsTagScore || Math.min(10, Math.max(6, countTtsTags(normalized.ttsReadyScript)));
  normalized.quality.validationNotes = validateScriptStudioV2(normalized, scriptMode);
  return normalized;
}

async function generateScriptStudio(body) {
  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo?.apiKey) {
    throw new AppError("Missing Gemini API key. Add one in Settings before generating scripts.", {
      status: 400,
      code: "MISSING_GEMINI_KEY",
      provider: "gemini",
      model: SCRIPT_STUDIO_WRITER_MODEL,
    });
  }

  const topic = String(body.topic || "").trim();
  if (topic.length < 4) {
    throw new AppError("Enter a topic or rough idea before generating a script.", {
      status: 400,
      code: "SCRIPT_TOPIC_REQUIRED",
      provider: "gemini",
      model: SCRIPT_STUDIO_WRITER_MODEL,
      keyId: keyInfo.id,
    });
  }

  const template = resolveScriptTemplate(body.scriptTemplate);
  const contentType = resolveScriptContentType(template.contentType || body.contentType);
  const category = resolveScriptCategory(template.category || body.category);
  const tone = resolveScriptTone(template.tone || body.tone);
  const energy = resolveScriptEnergy(body.energy);
  const duration = resolveScriptDuration(body.duration);
  const scriptMode = normalizeScriptMode(template.scriptMode || body.scriptMode);
  const researchDepth = normalizeResearchDepth(body.researchDepth);
  const languageStyle = ["Hindi", "Hinglish", "Simple Hindi"].includes(body.languageStyle) ? body.languageStyle : "Hinglish";
  const history = Array.isArray(body.history)
    ? body.history
        .map((item) => ({
          title: String(item?.title || "").slice(0, 90),
          script: String(item?.script || "").slice(0, 350),
        }))
        .filter((item) => item.title || item.script)
        .slice(0, 8)
    : [];

  let research = {
    researchSummary: "Search disabled. Using evergreen creator strategy and provided user context.",
    audienceInsight: "",
    trendSignals: [],
    nicheAngles: [],
    hookBank: [],
    avoid: [],
    suggestedAngle: "",
  };
  let sources = [];
  let searchQueries = [];
  let researchWarning = "";

  if (researchDepth !== "off") {
    const researchPrompt = buildScriptResearchPrompt({
      topic,
      contentType,
      category,
      duration,
      languageStyle,
      tone,
      energy,
      template,
      audience: body.audience,
      researchDepth,
      history,
    });
    try {
      const researchResult = await requestGeminiJsonDetailed({
        keyInfo,
        model: SCRIPT_STUDIO_RESEARCH_MODEL,
        parts: [{ text: researchPrompt }],
        temperature: researchDepth === "deep" ? 0.55 : 0.45,
        tools: [{ google_search: {} }],
      });
      research = researchResult.json;
      sources = extractGroundingSources(researchResult.groundingMetadata);
      searchQueries = researchResult.groundingMetadata?.webSearchQueries || [];
    } catch (error) {
      researchWarning = `${error.message || "Search grounding failed."} Continuing without live search.`;
      research = {
        ...research,
        researchSummary: `Search grounding failed, so the script used evergreen creator strategy instead. Original search error: ${error.message || "unknown"}`,
      };
    }
  }

  const writerPrompt = buildScriptWriterPrompt({
    topic,
    contentType,
    category,
    duration,
    languageStyle,
    tone,
    energy,
    template,
    scriptMode,
    audience: body.audience,
    userVoice: body.userVoice,
    selectedVoice: GOOGLE_VOICES.includes(body.selectedVoice) ? body.selectedVoice : "Kore",
    speakerOneVoice: GOOGLE_VOICES.includes(body.speakerOneVoice) ? body.speakerOneVoice : "Kore",
    speakerTwoVoice: GOOGLE_VOICES.includes(body.speakerTwoVoice) ? body.speakerTwoVoice : "Puck",
    customDirection: body.customDirection,
    research,
    sources,
    history,
  });

  const rawScript = await requestGeminiJson({
    keyInfo,
    model: SCRIPT_STUDIO_WRITER_MODEL,
    parts: [{ text: writerPrompt }],
    temperature: 0.9,
  });
  const script = normalizeScriptStudioV2(rawScript, { scriptMode, tone, contentType, energy });

  if (!script?.ttsReadyScript) {
    throw new AppError("Gemini returned a script response without ttsReadyScript.", {
      status: 502,
      code: "SCRIPT_STUDIO_MISSING_SCRIPT",
      provider: "gemini",
      model: SCRIPT_STUDIO_WRITER_MODEL,
      keyId: keyInfo.id,
      details: script,
    });
  }

  return {
    model: SCRIPT_STUDIO_WRITER_MODEL,
    modelLabel: "Gemini 3 Flash Preview",
    researchModel: researchDepth === "off" ? null : SCRIPT_STUDIO_RESEARCH_MODEL,
    keyId: keyInfo.id,
    keyLabel: keyInfo.label,
    researchDepth,
    researchWarning,
    searchQueries,
    sources,
    ...script,
    category: category.id,
    contentType: contentType.id,
    energy: energy.id,
    topic: script.topic || topic,
    durationSeconds: duration.seconds,
    languageStyle,
    templateId: script.templateId || template.id,
    templateLabel: script.templateLabel || template.label,
  };
}

async function generateStoryboard(body) {
  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo?.apiKey) {
    throw new AppError("Missing Gemini API key. Add one in Settings before generating storyboard prompts.", {
      status: 400,
      code: "MISSING_GEMINI_KEY",
      provider: "gemini",
      model: STORYBOARD_MODEL,
    });
  }

  const mode = ["audio-aware", "audio-detailed", "srt-director"].includes(body.mode) ? body.mode : "fast";
  const text = String(body.text || "").trim();
  const audioBase64 = String(body.audioBase64 || "").replace(/^data:[^,]+,/, "");
  const audioMimeType = String(body.audioMimeType || "audio/wav").trim();
  const promptQuality = resolvePromptQualityMode(body.promptQuality).id;
  const fallbackVisualStrategy = inferStoryboardVisualStrategy({
    text,
    imageMood: body.imageMood,
    style: body.imageStyle,
    promptQuality,
  });

  if (mode === "fast" && text.length < 20) {
    throw new AppError("Paste a longer story/script so the storyboard can follow the progression.", {
      status: 400,
      code: "SCRIPT_TOO_SHORT",
      provider: "gemini",
      model: STORYBOARD_MODEL,
      keyId: keyInfo.id,
    });
  }

  const cachedTimeline = mode === "srt-director" ? cachedTimelineFromRequest(body) : null;

  if ((mode === "audio-aware" || mode === "audio-detailed" || (mode === "srt-director" && !cachedTimeline)) && audioBase64.length < 1000) {
    throw new AppError("Generate voice first, then use an audio-aware mode so Gemini can inspect the narration audio.", {
      status: 400,
      code: "AUDIO_REQUIRED",
      provider: "gemini",
      model: STORYBOARD_MODEL,
      keyId: keyInfo.id,
    });
  }

  if (mode === "srt-director") {
    let timeline = cachedTimeline;
    let transcriptSource = "cached";
    if (!timeline) {
      transcriptSource = "audio";
      const timelinePrompt = buildAudioTimelinePrompt({
        platform: body.platform,
        audioDuration: body.audioDuration,
        targetSecondsPerImage: body.targetSecondsPerImage,
      });
      const audioPart = {
        inlineData: {
          mimeType: audioMimeType,
          data: audioBase64,
        },
      };
      timeline = await requestGeminiJson({
        keyInfo,
        parts: [{ text: timelinePrompt }, audioPart],
        temperature: 0.32,
      });
    }

    if (!Array.isArray(timeline?.segments) || timeline.segments.length === 0) {
      throw new AppError("SRT-first Director Mode could not create or reuse transcript segments.", {
        status: 502,
        code: "NO_TIMELINE_RETURNED",
        provider: "gemini",
        model: STORYBOARD_MODEL,
        keyId: keyInfo.id,
        details: timeline,
      });
    }

    const subtitleSegments = subtitleSegmentsFromTimeline(timeline);
    const srt = buildSrt(subtitleSegments);
    const summaryPrompt = buildDirectorSummaryPrompt({
      timeline,
      imageMood: body.imageMood,
      style: body.imageStyle,
      platform: body.platform,
      promptQuality,
      voiceContext: body.voiceContext,
      text,
    });
    const rawDirectorSummary = await requestGeminiJson({
      keyInfo,
      parts: [{ text: summaryPrompt }],
      temperature: 0.55,
    });
    const directorSummary = normalizeDirectorSummary(rawDirectorSummary, {
      timeline,
      imageMood: body.imageMood,
      style: body.imageStyle,
      promptQuality,
    });
    const storyboardPrompt = buildSrtDirectorStoryboardPrompt({
      timeline,
      directorSummary,
      platform: body.platform,
      targetSecondsPerImage: body.targetSecondsPerImage,
      promptQuality,
    });
    const storyboard = await requestGeminiJson({
      keyInfo,
      parts: [{ text: storyboardPrompt }],
      temperature: 0.72,
    });

    if (!Array.isArray(storyboard.frames) || storyboard.frames.length === 0) {
      throw new AppError("SRT-first Director Mode created a visual plan but did not return image prompt frames.", {
        status: 502,
        code: "NO_STORYBOARD_FRAMES_RETURNED",
        provider: "gemini",
        model: STORYBOARD_MODEL,
        keyId: keyInfo.id,
        details: storyboard,
      });
    }

    const storyboardWithDirectorPlan = {
      ...storyboard,
      visualStrategy: storyboard.visualStrategy || directorSummary.visualStrategy,
      visualStyle: storyboard.visualStyle || directorSummary.visualStyle,
      visualBible: storyboard.visualBible || directorSummary.visualBible,
      directorPlan: storyboard.directorPlan || directorSummary.directorPlan,
    };
    const strengthenedStoryboard = strengthenStoryboardFrames(storyboardWithDirectorPlan, {
      visualStrategy: storyboardWithDirectorPlan.visualStrategy || fallbackVisualStrategy,
      imageMood: body.imageMood,
      style: body.imageStyle,
      promptQuality,
    });

    return {
      model: STORYBOARD_MODEL,
      mode,
      keyId: keyInfo.id,
      keyLabel: keyInfo.label,
      promptQuality,
      audioCacheKey: body.audioCacheKey || "",
      transcriptSource,
      reusedTranscript: transcriptSource === "cached",
      timeline,
      directorSummary,
      ...strengthenedStoryboard,
      subtitleSegments,
      srt,
    };
  }

  if (mode === "audio-detailed") {
    const timelinePrompt = buildAudioTimelinePrompt({
      platform: body.platform,
      audioDuration: body.audioDuration,
      targetSecondsPerImage: body.targetSecondsPerImage,
    });
    const audioPart = {
      inlineData: {
        mimeType: audioMimeType,
        data: audioBase64,
      },
    };
    const timeline = await requestGeminiJson({
      keyInfo,
      parts: [{ text: timelinePrompt }, audioPart],
      temperature: 0.35,
    });

    if (!Array.isArray(timeline.segments) || timeline.segments.length === 0) {
      throw new AppError("Gemini listened to the audio but did not return timeline segments.", {
        status: 502,
        code: "NO_TIMELINE_RETURNED",
        provider: "gemini",
        model: STORYBOARD_MODEL,
        keyId: keyInfo.id,
        details: timeline,
      });
    }

    const storyboardPrompt = buildStoryboardFromTimelinePrompt({
      timeline,
      imageMood: body.imageMood,
      style: body.imageStyle,
      platform: body.platform,
      targetSecondsPerImage: body.targetSecondsPerImage,
      promptQuality,
    });
    const storyboard = await requestGeminiJson({
      keyInfo,
      parts: [{ text: storyboardPrompt }],
      temperature: 0.75,
    });

    if (!Array.isArray(storyboard.frames) || storyboard.frames.length === 0) {
      throw new AppError("Gemini created a timeline but did not return image prompt frames.", {
        status: 502,
        code: "NO_STORYBOARD_FRAMES_RETURNED",
        provider: "gemini",
        model: STORYBOARD_MODEL,
        keyId: keyInfo.id,
        details: storyboard,
      });
    }

    const subtitleSegments = subtitleSegmentsFromTimeline(timeline);
    const srt = buildSrt(subtitleSegments);
    const strengthenedStoryboard = strengthenStoryboardFrames(storyboard, {
      visualStrategy: storyboard.visualStrategy || fallbackVisualStrategy,
      imageMood: body.imageMood,
      style: body.imageStyle,
      promptQuality,
    });

    return {
      model: STORYBOARD_MODEL,
      mode,
      keyId: keyInfo.id,
      keyLabel: keyInfo.label,
      promptQuality,
      audioCacheKey: body.audioCacheKey || "",
      timeline,
      ...strengthenedStoryboard,
      subtitleSegments,
      srt,
    };
  }

  const prompt =
    mode === "audio-aware"
      ? buildAudioAwareStoryboardPrompt({
          imageMood: body.imageMood,
          style: body.imageStyle,
          platform: body.platform,
          audioDuration: body.audioDuration,
          targetSecondsPerImage: body.targetSecondsPerImage,
          promptQuality,
        })
      : buildStoryboardPrompt({
          text,
          imageMood: body.imageMood,
          style: body.imageStyle,
          platform: body.platform,
          audioDuration: body.audioDuration,
          targetSecondsPerImage: body.targetSecondsPerImage,
          promptQuality,
        });

  const parts =
    mode === "audio-aware"
      ? [
          { text: prompt },
          {
            inlineData: {
              mimeType: audioMimeType,
              data: audioBase64,
            },
          },
        ]
      : [{ text: prompt }];

  const storyboard = await requestGeminiJson({ keyInfo, parts });

  if (!Array.isArray(storyboard.frames) || storyboard.frames.length === 0) {
    throw new AppError("Storyboard response did not include frames.", {
      status: 502,
      code: "NO_STORYBOARD_FRAMES_RETURNED",
      provider: "gemini",
      model: STORYBOARD_MODEL,
      keyId: keyInfo.id,
      details: storyboard,
    });
  }

  const subtitleSegments = mode === "audio-aware" ? subtitleSegmentsFromStoryboard(storyboard) : [];
  const srt = buildSrt(subtitleSegments);
  const strengthenedStoryboard = strengthenStoryboardFrames(storyboard, {
    visualStrategy: storyboard.visualStrategy || fallbackVisualStrategy,
    imageMood: body.imageMood,
    style: body.imageStyle,
    promptQuality,
  });

  return {
    model: STORYBOARD_MODEL,
    mode,
    keyId: keyInfo.id,
    keyLabel: keyInfo.label,
    promptQuality,
    audioCacheKey: body.audioCacheKey || "",
    ...strengthenedStoryboard,
    subtitleSegments,
    srt,
  };
}

async function handleApi(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  if (req.method === "GET" && req.url === "/api/config") {
    const mp3Ready = await hasFfmpeg();
    const geminiStore = await loadGeminiKeyStore();
    const stockStore = await loadStockKeyStore();
    const activeGeminiKey = resolveActiveGeminiKey(geminiStore);
    const geminiReady = Boolean(activeGeminiKey?.apiKey);
    return sendJson(res, 200, {
      geminiReady,
      nvidiaReady: Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_TTS_URL),
      mp3Ready,
      geminiKeys: publicGeminiKeys(geminiStore),
      stockKeys: publicStockKeys(stockStore),
      stockVideoReady: Boolean(resolveActiveStockKey(stockStore, "pexels") || resolveActiveStockKey(stockStore, "pixabay")),
      providers: {
        gemini: {
          ready: geminiReady,
          models: GEMINI_TTS_MODELS.map((id) => ({ id, label: GEMINI_MODEL_LABELS[id] || id })),
          voices: GOOGLE_VOICE_OPTIONS,
          moods: MOODS,
        },
        nvidia: {
          ready: Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_TTS_URL),
          models: NVIDIA_TTS_MODELS,
          voices: NVIDIA_VOICES,
          moods: MOODS,
        },
      },
      models: GEMINI_TTS_MODELS,
      voices: GOOGLE_VOICE_OPTIONS,
      moods: MOODS,
      imageMoods: IMAGE_MOODS,
      promptQualityModes: PROMPT_QUALITY_MODES,
      scriptCategories: SCRIPT_CATEGORIES,
      scriptTones: SCRIPT_TONES,
      scriptContentTypes: SCRIPT_CONTENT_TYPES,
      scriptEnergies: SCRIPT_ENERGIES,
      scriptDurations: SCRIPT_DURATIONS,
      scriptTemplates: SCRIPT_TEMPLATES,
      rewriteMoods: REWRITE_MOODS,
      storyboardModel: STORYBOARD_MODEL,
      scriptRewriteModel: SCRIPT_REWRITE_MODEL,
      scriptStudioModel: SCRIPT_STUDIO_WRITER_MODEL,
      scriptStudioResearchModel: SCRIPT_STUDIO_RESEARCH_MODEL,
      worldCup: await worldCupConfigSummary(),
    });
  }

  if (req.method === "GET" && pathname === "/api/worldcup/runs") {
    try {
      return sendJson(res, 200, await listWorldCupRuns());
    } catch (error) {
      return sendError(res, error, "Unable to load World Cup runs.");
    }
  }

  if (req.method === "GET" && pathname.startsWith("/api/worldcup/runs/")) {
    try {
      const id = decodeURIComponent(pathname.slice("/api/worldcup/runs/".length));
      return sendJson(res, 200, await readWorldCupRun(id));
    } catch (error) {
      return sendError(res, error, "Unable to load World Cup run.");
    }
  }

  if (req.method === "GET" && pathname.startsWith("/api/worldcup/assets/")) {
    try {
      const parts = pathname.slice("/api/worldcup/assets/".length).split("/").filter(Boolean);
      const id = decodeURIComponent(parts[0] || "");
      const fileKey = decodeURIComponent(parts[1] || parsedUrl.searchParams.get("file") || "mp4");
      return await sendWorldCupAsset(res, await resolveWorldCupAsset(id, fileKey));
    } catch (error) {
      return sendError(res, error, "Unable to load World Cup asset.");
    }
  }

  if (req.method === "POST" && pathname === "/api/worldcup/generate") {
    try {
      const body = await readRequestJson(req);
      return sendJson(res, 200, await generateWorldCupRun(body));
    } catch (error) {
      return sendError(res, error, "Unable to generate World Cup short.");
    }
  }

  if (req.method === "POST" && pathname === "/api/worldcup/render") {
    try {
      const body = await readRequestJson(req);
      return sendJson(res, 200, await renderWorldCupRun(body.id, body));
    } catch (error) {
      return sendError(res, error, "Unable to render World Cup short.");
    }
  }

  if (req.method === "POST" && pathname === "/api/worldcup/upload") {
    try {
      const body = await readRequestJson(req);
      return sendJson(res, 200, await uploadWorldCupRun(body.id, body));
    } catch (error) {
      return sendError(res, error, "Unable to upload World Cup short.");
    }
  }

  if (req.method === "GET" && req.url === "/api/gemini-keys") {
    try {
      return sendJson(res, 200, publicGeminiKeys(await loadGeminiKeyStore()));
    } catch (error) {
      return sendError(res, error, "Unable to load Gemini key settings.");
    }
  }

  if (req.method === "POST" && req.url === "/api/gemini-keys") {
    try {
      const body = await readRequestJson(req);
      return sendJson(res, 200, await updateGeminiKeys(body));
    } catch (error) {
      return sendError(res, error, "Unable to update Gemini key settings.");
    }
  }

  if (req.method === "GET" && req.url === "/api/stock-keys") {
    try {
      return sendJson(res, 200, publicStockKeys(await loadStockKeyStore()));
    } catch (error) {
      return sendError(res, error, "Unable to load stock media key settings.");
    }
  }

  if (req.method === "POST" && req.url === "/api/stock-keys") {
    try {
      const body = await readRequestJson(req);
      return sendJson(res, 200, await updateStockKeys(body));
    } catch (error) {
      return sendError(res, error, "Unable to update stock media key settings.");
    }
  }

  if (req.method === "POST" && req.url === "/api/storyboard") {
    try {
      const body = await readRequestJson(req);
      const result = await generateStoryboard(body);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendError(res, error, "Unable to generate storyboard prompts.");
    }
  }

  if (req.method === "POST" && req.url === "/api/stock-video-timeline") {
    try {
      const body = await readRequestJson(req);
      return sendJson(res, 200, await generateStockVideoTimeline(body));
    } catch (error) {
      return sendError(res, error, "Unable to create stock video SRT.");
    }
  }

  if (req.method === "POST" && req.url === "/api/stock-video-smart-captions") {
    try {
      const body = await readRequestJson(req);
      return sendJson(res, 200, await generateSmartCaptions(body));
    } catch (error) {
      return sendError(res, error, "Unable to design smart captions.");
    }
  }

  if (req.method === "POST" && req.url === "/api/stock-video-plan") {
    try {
      const body = await readRequestJson(req);
      const result = await generateStockVideoPlan(body);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendError(res, error, "Unable to create stock video plan.");
    }
  }

  if (req.method === "POST" && req.url === "/api/stock-video-render") {
    try {
      const body = await readRequestJson(req);
      return sendStockMp4(res, await renderStockVideo(body));
    } catch (error) {
      return sendError(res, error, "Unable to render stock video.");
    }
  }

  if (req.method === "POST" && req.url === "/api/script-studio") {
    try {
      const body = await readRequestJson(req);
      const result = await generateScriptStudio(body);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendError(res, error, "Unable to generate script.");
    }
  }

  if (req.method === "POST" && req.url === "/api/rewrite-dialogue") {
    try {
      const body = await readRequestJson(req);
      const result = await rewriteDialogueScript(body);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendError(res, error, "Unable to rewrite script.");
    }
  }

  if (req.method === "POST" && req.url === "/api/tts") {
    try {
      const body = await readRequestJson(req);
      const text = String(body.text || "").trim();
      if (text.length < 2) {
        return sendError(
          res,
          new AppError("Please enter a Hindi script first.", { status: 400, code: "SCRIPT_EMPTY" }),
          "Please enter a Hindi script first.",
        );
      }
      if (text.length > 5000) {
        return sendError(
          res,
          new AppError(`Script is ${text.length} characters. Please keep scripts under 5,000 characters for this starter app.`, {
            status: 400,
            code: "SCRIPT_TOO_LONG",
            details: { length: text.length, maxLength: 5000 },
          }),
          "Please keep scripts under 5,000 characters.",
        );
      }

      const result =
        body.provider === "nvidia"
          ? await synthesizeWithNvidia(body)
          : await synthesizeWithGemini(body);

      return sendJson(res, 200, result);
    } catch (error) {
      return sendError(res, error, "Unable to generate audio.");
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
    const corsAllowed = applyCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(corsAllowed ? 204 : 403);
      res.end();
      return;
    }
    if (!corsAllowed) {
      sendJson(res, 403, { error: "Origin is not allowed.", code: "CORS_ORIGIN_NOT_ALLOWED" });
      return;
    }
    handleApi(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(port, () => {
  console.log(`Hindi Voice Studio running at http://localhost:${port}`);
});
