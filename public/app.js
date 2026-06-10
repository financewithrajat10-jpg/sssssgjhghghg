const elements = {
  statusPill: document.querySelector("#statusPill"),
  scriptText: document.querySelector("#scriptText"),
  charCount: document.querySelector("#charCount"),
  clearButton: document.querySelector("#clearButton"),
  provider: document.querySelector("#provider"),
  voice: document.querySelector("#voice"),
  voiceMode: document.querySelector("#voiceMode"),
  speakerPanel: document.querySelector("#speakerPanel"),
  speakerOneLabel: document.querySelector("#speakerOneLabel"),
  speakerOneName: document.querySelector("#speakerOneName"),
  speakerOneVoice: document.querySelector("#speakerOneVoice"),
  speakerTwoLabel: document.querySelector("#speakerTwoLabel"),
  speakerTwoName: document.querySelector("#speakerTwoName"),
  speakerTwoVoice: document.querySelector("#speakerTwoVoice"),
  rewritePanel: document.querySelector("#rewritePanel"),
  rewriteVoiceChoice: document.querySelector("#rewriteVoiceChoice"),
  rewriteMood: document.querySelector("#rewriteMood"),
  rewriteStyle: document.querySelector("#rewriteStyle"),
  rewriteButton: document.querySelector("#rewriteButton"),
  model: document.querySelector("#model"),
  modelHint: document.querySelector("#modelHint"),
  moodGrid: document.querySelector("#moodGrid"),
  style: document.querySelector("#style"),
  generateButton: document.querySelector("#generateButton"),
  audioPlayer: document.querySelector("#audioPlayer"),
  downloadLink: document.querySelector("#downloadLink"),
  mp3DownloadLink: document.querySelector("#mp3DownloadLink"),
  outputTitle: document.querySelector("#outputTitle"),
  voiceVariantPanel: document.querySelector("#voiceVariantPanel"),
  message: document.querySelector("#message"),
  errorDetail: document.querySelector("#errorDetail"),
  platform: document.querySelector("#platform"),
  storyboardMode: document.querySelector("#storyboardMode"),
  storyboardModeHint: document.querySelector("#storyboardModeHint"),
  targetSecondsPerImage: document.querySelector("#targetSecondsPerImage"),
  imageMoodGrid: document.querySelector("#imageMoodGrid"),
  imageStyle: document.querySelector("#imageStyle"),
  promptQuality: document.querySelector("#promptQuality"),
  storyboardButton: document.querySelector("#storyboardButton"),
  copyAllPromptsButton: document.querySelector("#copyAllPromptsButton"),
  copyTimelineButton: document.querySelector("#copyTimelineButton"),
  timelineExport: document.querySelector("#timelineExport"),
  copySrtButton: document.querySelector("#copySrtButton"),
  downloadSrtButton: document.querySelector("#downloadSrtButton"),
  srtExport: document.querySelector("#srtExport"),
  storyboardResult: document.querySelector("#storyboardResult"),
  stockSource: document.querySelector("#stockSource"),
  stockMaxClipDuration: document.querySelector("#stockMaxClipDuration"),
  stockCaptionStyle: document.querySelector("#stockCaptionStyle"),
  stockCaptionAnimation: document.querySelector("#stockCaptionAnimation"),
  stockCaptionPlacement: document.querySelector("#stockCaptionPlacement"),
  stockCaptionMood: document.querySelector("#stockCaptionMood"),
  stockCaptionCenter: document.querySelector("#stockCaptionCenter"),
  stockIncludeAudio: document.querySelector("#stockIncludeAudio"),
  stockBurnSubtitles: document.querySelector("#stockBurnSubtitles"),
  stockSmartCaptions: document.querySelector("#stockSmartCaptions"),
  stockCaptionSummary: document.querySelector("#stockCaptionSummary"),
  stockTimelineButton: document.querySelector("#stockTimelineButton"),
  stockSmartCaptionButton: document.querySelector("#stockSmartCaptionButton"),
  stockPlanButton: document.querySelector("#stockPlanButton"),
  stockRenderButton: document.querySelector("#stockRenderButton"),
  stockDownloadLink: document.querySelector("#stockDownloadLink"),
  stockVideoResult: document.querySelector("#stockVideoResult"),
  exportPackButton: document.querySelector("#exportPackButton"),
  voiceDemosButton: document.querySelector("#voiceDemosButton"),
  voiceDemoGrid: document.querySelector("#voiceDemoGrid"),
  memoryGrid: document.querySelector("#memoryGrid"),
  clearMemoryButton: document.querySelector("#clearMemoryButton"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsModal: document.querySelector("#settingsModal"),
  closeSettingsButton: document.querySelector("#closeSettingsButton"),
  keyList: document.querySelector("#keyList"),
  keyLabelInput: document.querySelector("#keyLabelInput"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  saveKeyButton: document.querySelector("#saveKeyButton"),
  pexelsKeyList: document.querySelector("#pexelsKeyList"),
  pexelsKeyLabelInput: document.querySelector("#pexelsKeyLabelInput"),
  pexelsApiKeyInput: document.querySelector("#pexelsApiKeyInput"),
  savePexelsKeyButton: document.querySelector("#savePexelsKeyButton"),
  pixabayKeyList: document.querySelector("#pixabayKeyList"),
  pixabayKeyLabelInput: document.querySelector("#pixabayKeyLabelInput"),
  pixabayApiKeyInput: document.querySelector("#pixabayApiKeyInput"),
  savePixabayKeyButton: document.querySelector("#savePixabayKeyButton"),
  settingsMessage: document.querySelector("#settingsMessage"),
  scriptStudioTopic: document.querySelector("#scriptStudioTopic"),
  scriptTemplate: document.querySelector("#scriptTemplate"),
  scriptContentType: document.querySelector("#scriptContentType"),
  scriptCategory: document.querySelector("#scriptCategory"),
  scriptDuration: document.querySelector("#scriptDuration"),
  scriptLanguage: document.querySelector("#scriptLanguage"),
  scriptResearchDepth: document.querySelector("#scriptResearchDepth"),
  scriptModeSelect: document.querySelector("#scriptModeSelect"),
  scriptTone: document.querySelector("#scriptTone"),
  scriptEnergy: document.querySelector("#scriptEnergy"),
  scriptVoice: document.querySelector("#scriptVoice"),
  scriptAudience: document.querySelector("#scriptAudience"),
  scriptUserVoice: document.querySelector("#scriptUserVoice"),
  cartoonModeButton: document.querySelector("#cartoonModeButton"),
  scriptGenerateButton: document.querySelector("#scriptGenerateButton"),
  scriptUseButton: document.querySelector("#scriptUseButton"),
  scriptCopyButton: document.querySelector("#scriptCopyButton"),
  scriptStudioResult: document.querySelector("#scriptStudioResult"),
  scriptSourceList: document.querySelector("#scriptSourceList"),
  worldCupPane: document.querySelector("#worldCupPane"),
  worldCupRefreshButton: document.querySelector("#worldCupRefreshButton"),
  worldCupGenerateButton: document.querySelector("#worldCupGenerateButton"),
  worldCupStatus: document.querySelector("#worldCupStatus"),
  worldCupMode: document.querySelector("#worldCupMode"),
  worldCupStrategy: document.querySelector("#worldCupStrategy"),
  worldCupDate: document.querySelector("#worldCupDate"),
  worldCupTeamA: document.querySelector("#worldCupTeamA"),
  worldCupTeamB: document.querySelector("#worldCupTeamB"),
  worldCupKickoff: document.querySelector("#worldCupKickoff"),
  worldCupDuration: document.querySelector("#worldCupDuration"),
  worldCupTopic: document.querySelector("#worldCupTopic"),
  worldCupAssetTeam: document.querySelector("#worldCupAssetTeam"),
  worldCupAssetPlayers: document.querySelector("#worldCupAssetPlayers"),
  worldCupAssetPackButton: document.querySelector("#worldCupAssetPackButton"),
  worldCupAssetPackStatus: document.querySelector("#worldCupAssetPackStatus"),
  worldCupRender: document.querySelector("#worldCupRender"),
  worldCupUpload: document.querySelector("#worldCupUpload"),
  worldCupOffline: document.querySelector("#worldCupOffline"),
  worldCupRunGrid: document.querySelector("#worldCupRunGrid"),
};

const apiBaseUrl = String(window.CONTENT_STUDIO_API_BASE_URL || "").replace(/\/+$/, "");

function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}

function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}

let selectedMood = "thriller";
let selectedImageMood = "cinematic";
let lastScriptStudioResult = null;
let lastStoryboard = null;
let lastStoryboardPrompts = [];
let lastStockVideoPlan = null;
let lastStockVideoTimeline = null;
let lastStockSmartCaptions = null;
let lastWorldCupRuns = [];
let lastTimelineJson = "";
let lastSrtText = "";
let lastAudioCacheKey = "";
let lastStoryboardAudioCacheKey = "";
let lastAudioBase64 = "";
let lastAudioMimeType = "";
let lastAudioDuration = 0;
let currentMemoryId = "";
let currentMemoryItem = null;
let config = {
  geminiReady: false,
  nvidiaReady: false,
  mp3Ready: false,
  stockVideoReady: false,
  stockKeys: null,
  worldCup: null,
  imageMoods: [],
  scriptTemplates: [],
  scriptContentTypes: [],
  scriptCategories: [],
  scriptTones: [],
  scriptEnergies: [],
  scriptDurations: [],
  rewriteMoods: [],
  providers: {
    gemini: {
      ready: false,
      voices: ["Kore"],
      models: [{ id: "gemini-3.1-flash-tts-preview", label: "Gemini 3.1 Flash TTS Preview" }],
      moods: [],
    },
    nvidia: {
      ready: false,
      voices: ["hi-IN Female"],
      models: [{ id: "magpie-tts-multilingual", label: "Magpie TTS Multilingual" }],
      moods: [],
    },
  },
};

const MEMORY_DB_NAME = "hindi-voice-studio-memory";
const MEMORY_STORE = "projects";
const MEMORY_LIMIT = 80;
const MAX_PROJECT_VOICE_VARIANTS = 12;

function currentProviderConfig() {
  return config.providers?.[elements.provider.value] || config.providers.gemini;
}

function openMemoryDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEMORY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEMORY_STORE)) {
        const store = db.createObjectStore(MEMORY_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function memoryTransaction(mode, callback) {
  const db = await openMemoryDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MEMORY_STORE, mode);
    const store = transaction.objectStore(MEMORY_STORE);
    let callbackResult;
    transaction.oncomplete = () => {
      db.close();
      resolve(callbackResult);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    callbackResult = callback(store);
  });
}

function memoryRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getMemoryItems() {
  const items = await memoryTransaction("readonly", (store) => memoryRequest(store.getAll()));
  return (items || []).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function getMemoryItem(id) {
  return memoryTransaction("readonly", (store) => memoryRequest(store.get(id)));
}

async function putMemoryItem(item) {
  await memoryTransaction("readwrite", (store) => {
    store.put(item);
  });
  await trimMemoryItems();
}

async function deleteMemoryItem(id) {
  await memoryTransaction("readwrite", (store) => {
    store.delete(id);
  });
}

async function clearMemoryItems() {
  await memoryTransaction("readwrite", (store) => {
    store.clear();
  });
}

async function trimMemoryItems() {
  const items = await getMemoryItems();
  const overflow = items.slice(MEMORY_LIMIT);
  if (!overflow.length) {
    return;
  }
  await memoryTransaction("readwrite", (store) => {
    for (const item of overflow) {
      store.delete(item.id);
    }
  });
}

function shortTitle(text) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, 62) : "Untitled voice";
}

function scriptSignature(text) {
  const compact = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  let hash = 0;
  for (let index = 0; index < compact.length; index += 1) {
    hash = (hash * 31 + compact.charCodeAt(index)) >>> 0;
  }
  return `${compact.length}-${hash.toString(16)}`;
}

function voiceVariantsForItem(item) {
  const variants = Array.isArray(item?.voiceVariants) ? item.voiceVariants.filter((variant) => variant?.audioBase64) : [];
  if (variants.length) {
    return variants;
  }
  if (!item?.audioBase64) {
    return [];
  }
  return [
    {
      id: item.selectedVoiceVariantId || item.id || crypto.randomUUID(),
      createdAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      label: "Saved take 1",
      provider: item.provider,
      model: item.model,
      modelLabel: item.modelLabel,
      voice: item.voice,
      voiceMode: item.voiceMode,
      speakers: item.speakers || [],
      mood: item.mood,
      style: item.style,
      audioBase64: item.audioBase64,
      audioMimeType: item.audioMimeType || "audio/wav",
      audioDuration: item.audioDuration || 0,
      mp3Base64: item.mp3Base64 || "",
      mp3MimeType: item.mp3MimeType || "",
      scriptSignature: scriptSignature(item.script),
    },
  ];
}

function selectedVoiceVariant(item, variantId = "") {
  const variants = voiceVariantsForItem(item);
  if (!variants.length) {
    return null;
  }
  return (
    variants.find((variant) => variant.id === variantId) ||
    variants.find((variant) => variant.id === item?.selectedVoiceVariantId) ||
    variants[variants.length - 1]
  );
}

function voiceVariantLabel(variant, index) {
  const model = variant.modelLabel || variant.model || "TTS";
  const voice = variant.voice || "voice";
  const duration = variant.audioDuration ? `${Number(variant.audioDuration).toFixed(1)}s` : "audio";
  return `Take ${index + 1}: ${voice} - ${duration} - ${model}`;
}

function createVoiceVariant(result) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    label: `Take ${new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    provider: result.provider || elements.provider.value,
    model: result.model || elements.model.value,
    modelLabel: result.modelLabel || elements.model.options[elements.model.selectedIndex]?.textContent || result.model || elements.model.value,
    voice: result.voice || elements.voice.value,
    voiceMode: elements.voiceMode.value,
    speakers: selectedSpeakers(),
    mood: selectedMood,
    style: elements.style.value,
    audioBase64: result.audioBase64 || "",
    audioMimeType: result.mimeType || lastAudioMimeType || "audio/wav",
    audioDuration: lastAudioDuration || 0,
    mp3Base64: result.mp3Base64 || "",
    mp3MimeType: result.mp3MimeType || "",
    scriptLength: elements.scriptText.value.trim().length,
    scriptSignature: scriptSignature(elements.scriptText.value),
  };
}

function applyVoiceVariantToItem(item, variant) {
  if (!item || !variant) {
    return item;
  }
  item.selectedVoiceVariantId = variant.id;
  item.provider = variant.provider || item.provider;
  item.model = variant.model || item.model;
  item.modelLabel = variant.modelLabel || item.modelLabel;
  item.voice = variant.voice || item.voice;
  item.voiceMode = variant.voiceMode || item.voiceMode;
  item.speakers = variant.speakers || item.speakers || [];
  item.mood = variant.mood || item.mood;
  item.style = variant.style || item.style || "";
  item.audioBase64 = variant.audioBase64 || "";
  item.audioMimeType = variant.audioMimeType || "audio/wav";
  item.audioDuration = variant.audioDuration || 0;
  item.mp3Base64 = variant.mp3Base64 || "";
  item.mp3MimeType = variant.mp3MimeType || "";
  return item;
}

function setSelectValue(select, value) {
  if ([...select.options].some((option) => option.value === value)) {
    select.value = value;
  }
}

function setMessage(text, isError = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("error", isError);
  if (!isError) {
    elements.errorDetail.textContent = "";
    elements.errorDetail.classList.remove("visible");
  }
}

function showApiError(payload, fallback = "Request failed.") {
  const message = payload?.error || payload?.message || fallback;
  setMessage(message, true);

  const detailLines = apiErrorDetailLines(payload);

  if (detailLines.length) {
    elements.errorDetail.textContent = detailLines.join("\n");
    elements.errorDetail.classList.add("visible");
  } else {
    elements.errorDetail.textContent = "";
    elements.errorDetail.classList.remove("visible");
  }
}

function apiErrorDetailLines(payload) {
  const detailLines = [];
  if (payload?.code) detailLines.push(`Code: ${payload.code}`);
  if (payload?.provider) detailLines.push(`Provider: ${payload.provider}`);
  if (payload?.model) detailLines.push(`Model: ${payload.model}`);
  if (payload?.keyId) detailLines.push(`Active key: ${payload.keyId}`);
  if (payload?.details?.httpStatus) detailLines.push(`HTTP: ${payload.details.httpStatus}`);
  if (payload?.details?.geminiStatus) detailLines.push(`Gemini status: ${payload.details.geminiStatus}`);
  return detailLines;
}

function renderInlineApiError(payload, fallback = "Request failed.") {
  const message = payload?.error || payload?.message || fallback;
  const detailLines = apiErrorDetailLines(payload);
  return `
    <article class="script-error-card">
      <strong>${escapeHtml(message)}</strong>
      ${detailLines.length ? `<pre>${escapeHtml(detailLines.join("\n"))}</pre>` : ""}
    </article>
  `;
}

function throwApiError(result, fallback) {
  const error = new Error(result?.error || fallback);
  error.payload = result;
  throw error;
}

function updateCharCount() {
  const count = elements.scriptText.value.trim().length;
  elements.charCount.textContent = `${count.toLocaleString()} characters`;
}

function audioCacheKey(audioBase64 = lastAudioBase64) {
  const value = String(audioBase64 || "");
  return value ? `${value.length}:${value.slice(0, 32)}:${value.slice(-32)}` : "";
}

function clearStoryboardState({ clearUi = true } = {}) {
  lastStoryboard = null;
  lastStoryboardAudioCacheKey = "";
  lastStoryboardPrompts = [];
  lastStockVideoPlan = null;
  lastStockVideoTimeline = null;
  lastStockSmartCaptions = null;
  lastTimelineJson = "";
  lastSrtText = "";
  if (clearUi) {
    elements.timelineExport.value = "";
    elements.storyboardResult.innerHTML = "";
    if (elements.stockVideoResult) {
      elements.stockVideoResult.innerHTML = "";
    }
    if (elements.stockRenderButton) {
      elements.stockRenderButton.disabled = true;
    }
    if (elements.stockDownloadLink) {
      elements.stockDownloadLink.removeAttribute("href");
      elements.stockDownloadLink.classList.remove("visible");
    }
    if (elements.stockCaptionSummary) {
      elements.stockCaptionSummary.textContent = "Normal captions are ready. Smart captions can redesign rhythm, highlights, and placement.";
    }
    if (elements.stockSmartCaptions) {
      elements.stockSmartCaptions.checked = false;
    }
    elements.copyAllPromptsButton.hidden = true;
    setSrtExport("");
  }
}

function updateStoryboardModeHint() {
  const seconds = Number(elements.targetSecondsPerImage.value || 5);
  const minimum = lastAudioDuration ? Math.ceil(lastAudioDuration / seconds) : null;
  const timing = minimum
    ? ` Current audio is ${lastAudioDuration.toFixed(1)}s, so minimum images: ${minimum}; Gemini can add shorter 3-4s cuts when the pace needs it.`
    : " Generate voice first for exact timeline alignment.";

  const modeText = {
    fast: "Fast mode uses the script plus generated audio duration for timed prompts.",
    "audio-aware": "Audio-aware direct sends only the generated audio to the configured Lite text model and writes prompts in one call.",
    "audio-detailed": "Audio-aware detailed sends only the generated audio first, builds a detailed timed transcript, then creates prompts from that timeline in a second call.",
    "srt-director": "SRT-first Director Mode creates or reuses the audio transcript, writes a director summary, then builds prompts from caption beats.",
  };

  elements.storyboardModeHint.textContent = `${modeText[elements.storyboardMode.value] || modeText.fast}${timing}`;
}

function wavDurationFromBase64(audioBase64) {
  try {
    const binary = atob(audioBase64.slice(0, 256));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const view = new DataView(bytes.buffer);
    const sampleRate = view.getUint32(24, true);
    const dataSize = view.getUint32(40, true);
    const channels = view.getUint16(22, true);
    const bitsPerSample = view.getUint16(34, true);
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    return byteRate ? dataSize / byteRate : 0;
  } catch {
    return 0;
  }
}

function populateSelect(select, values) {
  select.innerHTML = "";
  for (const item of values) {
    const option = document.createElement("option");
    option.value = typeof item === "string" ? item : item.id;
    option.textContent = typeof item === "string" ? item : `${item.label}${item.trait ? ` - ${item.trait}` : ""}`;
    if (item.note) {
      option.dataset.note = item.note;
    }
    if (item.supportsHindi === false) {
      option.textContent += " - English only";
    }
    select.append(option);
  }
}

function findConfigItem(items, id) {
  return (Array.isArray(items) ? items : []).find((item) => item?.id === id) || null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""), window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function renderMoods(moods) {
  elements.moodGrid.innerHTML = "";
  const moodList = moods.length ? moods : config.providers.gemini.moods;

  for (const mood of moodList) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mood-button";
    button.dataset.mood = mood.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(mood.id === selectedMood));
    button.innerHTML = `<span>${mood.label}</span><small>${mood.description}</small>`;
    button.addEventListener("click", () => {
      selectedMood = mood.id;
      renderMoods(moodList);
    });
    elements.moodGrid.append(button);
  }
}

function renderImageMoods(moods) {
  elements.imageMoodGrid.innerHTML = "";

  for (const mood of moods) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mood-button";
    button.dataset.mood = mood.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(mood.id === selectedImageMood));
    button.innerHTML = `<span>${escapeHtml(mood.label)}</span><small>${escapeHtml(mood.description)}</small>`;
    button.addEventListener("click", () => {
      selectedImageMood = mood.id;
      renderImageMoods(moods);
    });
    elements.imageMoodGrid.append(button);
  }
}

function populateGeminiSpeakerVoices() {
  const geminiVoices = config.providers?.gemini?.voices || [];
  const firstVoice = elements.speakerOneVoice.value || "Kore";
  const secondVoice = elements.speakerTwoVoice.value || "Puck";
  const scriptVoice = elements.scriptVoice.value || elements.voice.value || "Kore";
  populateSelect(elements.speakerOneVoice, geminiVoices);
  populateSelect(elements.speakerTwoVoice, geminiVoices);
  populateSelect(elements.scriptVoice, geminiVoices);
  setSelectValue(elements.speakerOneVoice, firstVoice);
  setSelectValue(elements.speakerTwoVoice, secondVoice);
  setSelectValue(elements.scriptVoice, scriptVoice);
}

function populateRewriteMoods() {
  populateSelect(elements.rewriteMood, config.rewriteMoods || []);
}

function populateScriptStudioSelects() {
  const templateValue = elements.scriptTemplate.value;
  const contentTypeValue = elements.scriptContentType.value;
  const categoryValue = elements.scriptCategory.value;
  const toneValue = elements.scriptTone.value;
  const energyValue = elements.scriptEnergy.value;
  const durationValue = elements.scriptDuration.value;

  if (config.scriptTemplates?.length) {
    populateSelect(elements.scriptTemplate, config.scriptTemplates);
    setSelectValue(elements.scriptTemplate, templateValue || "custom");
  }
  if (config.scriptContentTypes?.length) {
    populateSelect(elements.scriptContentType, config.scriptContentTypes);
    setSelectValue(elements.scriptContentType, contentTypeValue || "reel");
  }
  if (config.scriptCategories?.length) {
    populateSelect(elements.scriptCategory, config.scriptCategories);
    setSelectValue(elements.scriptCategory, categoryValue || "psychology");
  }
  if (config.scriptTones?.length) {
    populateSelect(elements.scriptTone, config.scriptTones);
    setSelectValue(elements.scriptTone, toneValue || "suspense");
  }
  if (config.scriptEnergies?.length) {
    populateSelect(elements.scriptEnergy, config.scriptEnergies);
    setSelectValue(elements.scriptEnergy, energyValue || "medium");
  }
  if (config.scriptDurations?.length) {
    populateSelect(elements.scriptDuration, config.scriptDurations);
    setSelectValue(elements.scriptDuration, durationValue || "60");
  }
  if (!elements.scriptVoice.options.length) {
    populateGeminiSpeakerVoices();
  }
}

function applyScriptTemplateDefaults() {
  const template = (config.scriptTemplates || []).find((item) => item.id === elements.scriptTemplate.value);
  if (!template || template.id === "custom") {
    return;
  }
  if (template.category) {
    setSelectValue(elements.scriptCategory, template.category);
  }
  if (template.contentType) {
    setSelectValue(elements.scriptContentType, template.contentType);
  }
  if (template.tone) {
    setSelectValue(elements.scriptTone, template.tone);
  }
  if (template.scriptMode) {
    setSelectValue(elements.scriptModeSelect, template.scriptMode);
  }
  if (template.imageMood) {
    selectedImageMood = template.imageMood;
    renderImageMoods(config.imageMoods || []);
  }
  if (template.promptQuality) {
    setSelectValue(elements.promptQuality, template.promptQuality);
  }
  if (template.imageStyle) {
    elements.imageStyle.value = template.imageStyle;
  }
}

function applyCartoonModeDefaults() {
  setSelectValue(elements.scriptTemplate, "kids-cartoon-adventure");
  setSelectValue(elements.scriptContentType, "kids-cartoon");
  setSelectValue(elements.scriptCategory, "kids-cartoon");
  setSelectValue(elements.scriptTone, "playful");
  setSelectValue(elements.scriptEnergy, "medium");
  setSelectValue(elements.scriptModeSelect, "advanced-narrator");
  setSelectValue(elements.scriptLanguage, "Simple Hindi");
  setSelectValue(elements.scriptDuration, "60");
  selectedMood = "none";
  renderMoods(currentProviderConfig().moods || []);
  selectedImageMood = "kids-cartoon";
  renderImageMoods(config.imageMoods || []);
  setSelectValue(elements.promptQuality, "kids-cartoon-flow");
  elements.imageStyle.value =
    "Create a child-safe Indian cartoon episode look: cute rounded recurring characters, bright balanced colors, clean readable backgrounds, playful home/school/park/festival details, gentle humor, no scary or unsafe visuals.";
  elements.scriptUserVoice.value =
    elements.scriptUserVoice.value ||
    "For Indian children ages 5-10. Make it funny, warm, simple, colorful, parent-safe, and entertainment-first with a gentle moral.";
  setMessage("Cartoon mode is ready: Script Studio and Storyboard are set for child-safe Indian cartoon content.");
}

function updateVoiceModeUi() {
  const isGemini = elements.provider.value === "gemini";
  let mode = elements.voiceMode.value;
  elements.voiceMode.disabled = !isGemini;
  if (!isGemini) {
    elements.voiceMode.value = "single";
    mode = "single";
  }
  const needsSpeakers =
    isGemini && (mode === "multi" || (mode === "rewrite" && elements.rewriteVoiceChoice.value === "selected"));
  elements.speakerPanel.hidden = !needsSpeakers;
  elements.rewritePanel.hidden = !(isGemini && mode === "rewrite");
  const voicePoolMode = isGemini && mode === "rewrite" && elements.rewriteVoiceChoice.value === "selected";
  elements.speakerPanel.classList.toggle("voice-pool-mode", voicePoolMode);
  elements.speakerOneLabel.textContent = voicePoolMode ? "Voice 1" : "Speaker 1";
  elements.speakerTwoLabel.textContent = voicePoolMode ? "Voice 2" : "Speaker 2";
}

function updateModelHint() {
  const selected = elements.model.options[elements.model.selectedIndex];
  const note = selected?.dataset?.note || "";

  if (elements.provider.value === "gemini") {
    elements.modelHint.textContent =
      "Gemini TTS currently supports 3.1 Flash TTS and 2.5 Flash/Pro TTS here. A 3.5 Flash TTS model is not available on this key.";
  } else {
    elements.modelHint.textContent =
      note || "Set NVIDIA_API_KEY and NVIDIA_TTS_URL in .env before generating with NVIDIA.";
  }
}

function updateStatus() {
  elements.statusPill.className = "status-pill";
  const provider = elements.provider.value;
  const providerConfig = currentProviderConfig();

  if (providerConfig.ready) {
    const keyInfo = provider === "gemini" ? config.geminiKeys?.keys?.find((key) => key.active) : null;
    elements.statusPill.textContent = keyInfo ? `Gemini: ${keyInfo.label}` : `${provider === "gemini" ? "Gemini" : "NVIDIA"} connected`;
    elements.statusPill.classList.add("ready");
    return;
  }

  elements.statusPill.textContent = provider === "gemini" ? "Add GEMINI_API_KEY" : "Add NVIDIA key + URL";
  elements.statusPill.classList.add("warning");
}

function refreshProviderControls() {
  const providerConfig = currentProviderConfig();
  populateSelect(elements.model, providerConfig.models || []);
  populateSelect(elements.voice, providerConfig.voices || []);
  populateGeminiSpeakerVoices();
  populateRewriteMoods();
  renderMoods(providerConfig.moods || []);
  updateVoiceModeUi();
  updateModelHint();
  updateStatus();
}

async function loadConfig() {
  try {
    const response = await apiFetch("/api/config");
    config = await response.json();
    populateScriptStudioSelects();
    refreshProviderControls();
    renderImageMoods(config.imageMoods || []);
    updateWorldCupStatus();
    loadWorldCupRuns();
    elements.copyAllPromptsButton.hidden = true;
  } catch {
    elements.statusPill.textContent = "Server unavailable";
    elements.statusPill.classList.add("warning");
  }
}

function selectedSpeakers() {
  return [
    { name: elements.speakerOneName.value.trim() || "Speaker 1", voice: elements.speakerOneVoice.value || "Kore" },
    { name: elements.speakerTwoName.value.trim() || "Speaker 2", voice: elements.speakerTwoVoice.value || "Puck" },
  ];
}

function selectedRewriteVoicePool() {
  return [elements.speakerOneVoice.value || "Kore", elements.speakerTwoVoice.value || "Puck"];
}

function looksLikeTaggedDialogue(text) {
  return /^\s*\[[^\]]+\|[^\]]+\]/m.test(String(text || ""));
}

async function rewriteScriptToDialogue({ silent = false } = {}) {
  const text = elements.scriptText.value.trim();
  if (!text) {
    setMessage("Paste or type your story before rewriting it.", true);
    return false;
  }
  if (elements.provider.value !== "gemini") {
    setMessage("Auto rewrite uses Gemini. Switch provider to Gemini first.", true);
    return false;
  }

  elements.rewriteButton.disabled = true;
  const originalButtonText = elements.rewriteButton.textContent;
  elements.rewriteButton.textContent = "Rewriting...";
  if (!silent) {
    setMessage(`Rewriting with ${config.scriptRewriteModel || "gemini-3.1-flash-lite"}...`);
  }

  try {
    const response = await apiFetch("/api/rewrite-dialogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voicePreference: elements.rewriteVoiceChoice.value,
        voicePool: selectedRewriteVoicePool(),
        rewriteMood: elements.rewriteMood.value,
        rewriteStyle: elements.rewriteStyle.value,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to rewrite script.");
    }
    elements.scriptText.value = result.taggedScript || text;
    updateCharCount();
    currentMemoryId = "";
    currentMemoryItem = null;
    renderActiveVoiceVariants();
    if (!silent) {
      setMessage(`Script rewritten with ${result.modelLabel || result.model}. Review it, then generate voice.`);
    }
    return true;
  } catch (error) {
    showApiError(error.payload || error, error.message || "Unable to rewrite script.");
    return false;
  } finally {
    elements.rewriteButton.disabled = false;
    elements.rewriteButton.textContent = originalButtonText;
  }
}

async function generateVoice() {
  if (elements.provider.value === "gemini" && elements.voiceMode.value === "rewrite" && !looksLikeTaggedDialogue(elements.scriptText.value)) {
    const rewritten = await rewriteScriptToDialogue({ silent: true });
    if (!rewritten) {
      return;
    }
  }

  const text = elements.scriptText.value.trim();
  if (!text) {
    setMessage("Paste or type your Hindi script first.", true);
    return;
  }

  elements.generateButton.disabled = true;
  elements.generateButton.textContent = "Generating...";
  elements.outputTitle.textContent = "Recording a new take";
  setMessage("This can take a few seconds depending on the provider.");

  try {
    const response = await apiFetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: elements.provider.value,
        text,
        voice: elements.voice.value,
        voiceMode: elements.provider.value === "gemini" && elements.voiceMode.value !== "single" ? "multi" : "single",
        speakers: selectedSpeakers(),
        model: elements.model.value,
        mood: selectedMood,
        style: elements.style.value,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to generate voice.");
    }

    const audioUrl = `data:${result.mimeType};base64,${result.audioBase64}`;
    lastAudioBase64 = result.audioBase64;
    lastAudioMimeType = result.mimeType;
    lastAudioCacheKey = audioCacheKey(result.audioBase64);
    clearStoryboardState();
    lastAudioDuration = result.mimeType === "audio/wav" ? wavDurationFromBase64(result.audioBase64) : 0;
    elements.audioPlayer.src = audioUrl;
    elements.audioPlayer.onloadedmetadata = () => {
      lastAudioDuration = Number.isFinite(elements.audioPlayer.duration) ? elements.audioPlayer.duration : 0;
      updateStoryboardModeHint();
    };
    elements.downloadLink.href = audioUrl;
    elements.downloadLink.classList.add("visible");
    if (result.mp3Base64) {
      elements.mp3DownloadLink.href = `data:${result.mp3MimeType};base64,${result.mp3Base64}`;
      elements.mp3DownloadLink.classList.add("visible");
    } else {
      elements.mp3DownloadLink.removeAttribute("href");
      elements.mp3DownloadLink.classList.remove("visible");
    }
    elements.outputTitle.textContent = "Voice generated";
    const mp3Note = result.mp3Base64 ? " MP3 is ready too." : " MP3 needs ffmpeg installed on this machine.";
    setMessage(`${result.provider} generated ${result.voice || "selected voice"} using ${result.modelLabel || result.model}.${mp3Note}`);
    await saveVoiceMemory(result).catch(() => {});
  } catch (error) {
    elements.outputTitle.textContent = "Generation failed";
    showApiError(error.payload || error, error.message || "Unable to generate voice.");
  } finally {
    elements.generateButton.disabled = false;
    elements.generateButton.textContent = "Generate voice";
  }
}

function renderStoryboard(storyboard) {
  lastStoryboardAudioCacheKey = storyboard.audioCacheKey || lastAudioCacheKey;
  lastStoryboard = { ...storyboard, audioCacheKey: lastStoryboardAudioCacheKey };
  lastStockVideoPlan = null;
  lastStockVideoTimeline = storyboard.timeline || null;
  lastStockSmartCaptions = null;
  if (elements.stockVideoResult) {
    elements.stockVideoResult.innerHTML = "";
  }
  if (elements.stockRenderButton) {
    elements.stockRenderButton.disabled = true;
  }
  if (elements.stockDownloadLink) {
    elements.stockDownloadLink.removeAttribute("href");
    elements.stockDownloadLink.classList.remove("visible");
  }
  const frames = storyboard.frames || [];
  const timelineSegments = storyboard.timeline?.segments || [];
  const subtitleSegments = subtitleSegmentsForStoryboard(storyboard);
  const srtText = storyboard.srt || buildSrtFromSegments(subtitleSegments);
  setSrtExport(srtText);
  const timelineFrames = frames.map((frame, index) => {
    const startTime = Number(frame.startTime ?? 0);
    const endTime = Number(frame.endTime ?? startTime + Number(frame.durationSeconds || 3));
    return {
      number: Number(frame.number || index + 1),
      imageIndex: index,
      startTime,
      endTime,
      durationSeconds: Math.max(0.1, endTime - startTime),
      sourceCaptionNumbers: Array.isArray(frame.sourceCaptionNumbers) ? frame.sourceCaptionNumbers : [],
      captionText: frame.captionText || "",
      prompt: frame.prompt || "",
      moment: frame.moment || "",
    };
  });
  const outputDuration = timelineFrames.reduce((max, frame) => Math.max(max, frame.endTime), 0);
  const timelineExport = {
    schema: "hindi-voice-studio.image-timeline.v1",
    targetApp: "image-reel-builder",
    format: elements.platform.value.includes("landscape") ? "16:9" : "9:16",
    width: elements.platform.value.includes("landscape") ? 1920 : 1080,
    height: elements.platform.value.includes("landscape") ? 1080 : 1920,
    fps: 30,
    durationSeconds: outputDuration,
    promptQuality: storyboard.promptQuality || elements.promptQuality.value,
    visualBible: storyboard.visualBible || null,
    directorSummary: storyboard.directorSummary || null,
    createdAt: new Date().toISOString(),
    frames: timelineFrames,
  };
  lastTimelineJson = JSON.stringify(timelineExport, null, 2);
  elements.timelineExport.value = lastTimelineJson;
  lastStoryboardPrompts = frames
    .map((frame) => {
      const start = frame.startTime ?? "";
      const end = frame.endTime ?? "";
      return `${start}s - ${end}s\n${frame.prompt || ""}`.trim();
    })
    .filter(Boolean);
  elements.copyAllPromptsButton.hidden = lastStoryboardPrompts.length === 0;
  const cards = frames
    .map(
      (frame) => `
        <article class="prompt-card">
          <div class="prompt-card-top">
            <span>Frame ${escapeHtml(frame.number)}</span>
            <button class="copy-button" type="button" data-copy="${encodeURIComponent(frame.prompt || "")}">Copy prompt</button>
          </div>
          <h3>${escapeHtml(frame.moment || "Story moment")}</h3>
          <p class="duration">${escapeHtml(frame.startTime ?? "")}s - ${escapeHtml(frame.endTime ?? "")}s · ${escapeHtml(frame.durationSeconds || 3)}s image beat</p>
          <textarea readonly>${escapeHtml(frame.prompt || "")}</textarea>
          <details>
            <summary>Negative prompt</summary>
            <p>${escapeHtml(frame.negativePrompt || "text, watermark, logo, subtitles, blurry, low quality")}</p>
          </details>
        </article>
      `,
    )
    .join("");
  const timelineHtml = timelineSegments.length
    ? `
      <details class="timeline-details" open>
        <summary>Audio timeline transcript (${timelineSegments.length} segments)</summary>
        <div class="timeline-list">
          ${timelineSegments
            .map(
              (segment) => `
                <article class="timeline-item">
                  <strong>${escapeHtml(segment.startTime ?? "")}s - ${escapeHtml(segment.endTime ?? "")}s</strong>
                  <p>${escapeHtml(segment.transcriptHindi || "")}</p>
                  <small>${escapeHtml(segment.emotion || "")}${segment.pace ? ` · ${escapeHtml(segment.pace)}` : ""}</small>
                  <span>${escapeHtml(segment.visualBeat || "")}</span>
                </article>
              `,
            )
            .join("")}
        </div>
      </details>
    ` 
    : "";
  const visualBible = storyboard.visualBible || null;
  const directorSummary = storyboard.directorSummary || null;
  const directorSummaryHtml = directorSummary
    ? `
      <details class="visual-bible-details director-summary-details" open>
        <summary>Director summary</summary>
        <div class="visual-bible-grid">
          <article><strong>Content</strong><p>${escapeHtml(directorSummary.contentType || "")}</p></article>
          <article><strong>Theme</strong><p>${escapeHtml(directorSummary.visualTheme || "")}</p></article>
          <article><strong>Image type</strong><p>${escapeHtml(directorSummary.imageType || "")}</p></article>
          <article><strong>Design</strong><p>${escapeHtml(directorSummary.designLanguage || "")}</p></article>
          <article><strong>Caption logic</strong><p>${escapeHtml(directorSummary.captionToImageLogic || "")}</p></article>
          <article><strong>Avoid</strong><p>${escapeHtml((directorSummary.avoid || []).join(", "))}</p></article>
        </div>
      </details>
    `
    : "";
  const visualBibleHtml = visualBible
    ? `
      <details class="visual-bible-details" open>
        <summary>Visual bible</summary>
        <div class="visual-bible-grid">
          <article><strong>Look</strong><p>${escapeHtml(visualBible.overallLook || "")}</p></article>
          <article><strong>Recurring subject</strong><p>${escapeHtml(visualBible.recurringSubject || "")}</p></article>
          <article><strong>Palette</strong><p>${escapeHtml(visualBible.palette || "")}</p></article>
          <article><strong>Lighting</strong><p>${escapeHtml(visualBible.lighting || "")}</p></article>
          <article><strong>Camera</strong><p>${escapeHtml(visualBible.cameraStyle || "")}</p></article>
          <article><strong>Environment</strong><p>${escapeHtml(visualBible.environmentLogic || "")}</p></article>
        </div>
      </details>
    `
    : "";

  elements.storyboardResult.innerHTML = `
    <div class="storyboard-summary">
      <div>
        <p class="eyebrow">${escapeHtml(storyboard.model || "gemini-2.5-flash")} · ${escapeHtml(storyboard.mode || "fast")}</p>
        <h3>${escapeHtml(storyboard.title || "Generated storyboard")}</h3>
      </div>
      <p>${escapeHtml(storyboard.visualStyle || "")}</p>
      <p>${escapeHtml(storyboard.directorPlan || "")}</p>
    </div>
    <div class="character-strip">
      ${(storyboard.characters || []).map((character) => `<span>${escapeHtml(character)}</span>`).join("")}
    </div>
    ${directorSummaryHtml}
    ${visualBibleHtml}
    ${timelineHtml}
    <div class="prompt-grid">${cards}</div>
  `;

  for (const button of elements.storyboardResult.querySelectorAll(".copy-button")) {
    button.addEventListener("click", async () => {
      const prompt = decodeURIComponent(button.dataset.copy || "");
      await navigator.clipboard.writeText(prompt);
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy prompt";
      }, 1200);
    });
  }
}

async function renderMemory() {
  if (!elements.memoryGrid) {
    return;
  }

  const items = await getMemoryItems().catch(() => []);
  if (!items.length) {
    elements.memoryGrid.innerHTML = `<p class="empty-memory">No saved work yet. Generate a voice and it will appear here.</p>`;
    return;
  }

  elements.memoryGrid.innerHTML = items
    .map((item) => {
      const date = new Date(item.updatedAt || item.createdAt).toLocaleString();
      const frameCount = item.storyboard?.frames?.length || 0;
      const variants = voiceVariantsForItem(item);
      const selectedVariant = selectedVoiceVariant(item);
      const duration = selectedVariant ? (selectedVariant.audioDuration ? `${Number(selectedVariant.audioDuration).toFixed(1)}s` : "audio") : "script";
      const contentTag = frameCount ? `${frameCount} prompts` : variants.length ? `${variants.length} voice take${variants.length === 1 ? "" : "s"}` : "script only";
      return `
        <article class="memory-card" data-memory-id="${escapeHtml(item.id)}">
          <div class="memory-card-head">
            <strong>${escapeHtml(item.title || "Untitled voice")}</strong>
            <span>${escapeHtml(date)}</span>
          </div>
          <p>${escapeHtml(selectedVariant?.modelLabel || item.modelLabel || item.model || "Gemini")} - ${escapeHtml(selectedVariant?.voice || item.voice || "voice")} - ${escapeHtml(duration)}</p>
          <div class="memory-tags">
            <span>${escapeHtml(item.mood || "mood")}</span>
            <span>${escapeHtml(contentTag)}</span>
          </div>
          ${
            variants.length
              ? `<div class="memory-variant-list">
                  ${variants
                    .map((variant, index) => {
                      const selected = variant.id === (item.selectedVoiceVariantId || selectedVariant?.id);
                      return `
                        <div class="memory-variant-row ${selected ? "is-selected" : ""}">
                          <span>${escapeHtml(voiceVariantLabel(variant, index))}${selected ? " - selected" : ""}</span>
                          <div>
                            <button class="ghost-action-button" type="button" data-memory-action="play" data-variant-id="${escapeHtml(variant.id)}">Play</button>
                            <button class="ghost-action-button" type="button" data-memory-action="use-variant" data-variant-id="${escapeHtml(variant.id)}">Use</button>
                          </div>
                        </div>
                      `;
                    })
                    .join("")}
                </div>`
              : ""
          }
          <div class="memory-actions">
            <button class="ghost-action-button" type="button" data-memory-action="restore">Restore</button>
            <button class="ghost-action-button" type="button" data-memory-action="play">Play</button>
            <button class="ghost-action-button" type="button" data-memory-action="prompts">Prompts</button>
            <button class="ghost-action-button danger-button" type="button" data-memory-action="delete">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");

  for (const button of elements.memoryGrid.querySelectorAll("button[data-memory-action]")) {
    button.addEventListener("click", () =>
      handleMemoryAction(button.closest(".memory-card")?.dataset.memoryId, button.dataset.memoryAction, button.dataset.variantId),
    );
  }
}

function renderActiveVoiceVariants() {
  if (!elements.voiceVariantPanel) {
    return;
  }

  const item = currentMemoryItem;
  const variants = voiceVariantsForItem(item);
  if (!item || !variants.length) {
    elements.voiceVariantPanel.innerHTML = `
      <div class="voice-variant-head">
        <div>
          <p class="eyebrow">Project takes</p>
          <h3>Voice comparisons</h3>
        </div>
        <span>No takes yet</span>
      </div>
      <p class="hint">Generate multiple voices from the same script; each take stays attached to this project so you can compare and choose one before SRT or image prompts.</p>
    `;
    return;
  }

  const selectedId = item.selectedVoiceVariantId || selectedVoiceVariant(item)?.id || "";
  elements.voiceVariantPanel.innerHTML = `
    <div class="voice-variant-head">
      <div>
        <p class="eyebrow">Project takes</p>
        <h3>${escapeHtml(item.title || "Current project")}</h3>
      </div>
      <span>${variants.length} saved take${variants.length === 1 ? "" : "s"}</span>
    </div>
    <div class="voice-variant-list">
      ${variants
        .map((variant, index) => {
          const isSelected = variant.id === selectedId;
          const date = new Date(variant.createdAt || item.updatedAt || Date.now()).toLocaleString();
          return `
            <article class="voice-variant-card ${isSelected ? "is-selected" : ""}">
              <div>
                <strong>${escapeHtml(voiceVariantLabel(variant, index))}</strong>
                <span>${escapeHtml(date)}${isSelected ? " - selected" : ""}</span>
              </div>
              <div class="voice-variant-actions">
                <button class="ghost-action-button" type="button" data-memory-id="${escapeHtml(item.id)}" data-variant-id="${escapeHtml(variant.id)}" data-memory-action="play">Play</button>
                <button class="ghost-action-button" type="button" data-memory-id="${escapeHtml(item.id)}" data-variant-id="${escapeHtml(variant.id)}" data-memory-action="use-variant">Use</button>
                <button class="ghost-action-button danger-button" type="button" data-memory-id="${escapeHtml(item.id)}" data-variant-id="${escapeHtml(variant.id)}" data-memory-action="delete-variant">Delete</button>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  for (const button of elements.voiceVariantPanel.querySelectorAll("button[data-memory-action]")) {
    button.addEventListener("click", () => handleMemoryAction(button.dataset.memoryId, button.dataset.memoryAction, button.dataset.variantId));
  }
}

function memorySnapshotFromCurrent(result = {}) {
  const text = elements.scriptText.value.trim();
  return {
    schema: "hindi-voice-studio.project.v2",
    id: currentMemoryId || crypto.randomUUID(),
    title: shortTitle(text),
    script: text,
    provider: elements.provider.value,
    model: elements.model.value,
    modelLabel: result.modelLabel || elements.model.options[elements.model.selectedIndex]?.textContent || elements.model.value,
    voice: elements.voice.value,
    voiceMode: elements.voiceMode.value,
    speakers: selectedSpeakers(),
    rewriteVoiceChoice: elements.rewriteVoiceChoice.value,
    rewriteMood: elements.rewriteMood.value,
    rewriteStyle: elements.rewriteStyle.value,
    mood: selectedMood,
    style: elements.style.value,
    audioBase64: result.audioBase64 || lastAudioBase64,
    audioMimeType: result.mimeType || lastAudioMimeType || "audio/wav",
    audioDuration: lastAudioDuration,
    mp3Base64: result.mp3Base64 || "",
    mp3MimeType: result.mp3MimeType || "",
    selectedVoiceVariantId: "",
    voiceVariants: [],
    storyboardSettings: {
      mode: elements.storyboardMode.value,
      platform: elements.platform.value,
      targetSecondsPerImage: elements.targetSecondsPerImage.value,
      imageMood: selectedImageMood,
      imageStyle: elements.imageStyle.value,
      promptQuality: elements.promptQuality.value,
    },
    storyboard: null,
    scriptStudioSettings: {
      contentType: elements.scriptContentType.value,
      energy: elements.scriptEnergy.value,
      voice: elements.scriptVoice.value,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function saveVoiceMemory(result) {
  let item = currentMemoryId ? await getMemoryItem(currentMemoryId) : null;
  if (!item) {
    item = memorySnapshotFromCurrent();
  }
  const variant = createVoiceVariant(result);
  const existingVariants = voiceVariantsForItem(item).filter((saved) => saved.id !== variant.id);
  const nextVariants = [...existingVariants, variant].slice(-MAX_PROJECT_VOICE_VARIANTS);
  item.schema = "hindi-voice-studio.project.v2";
  item.script = elements.scriptText.value.trim();
  item.title = item.title && item.title !== "Untitled voice" ? item.title : shortTitle(item.script);
  item.provider = elements.provider.value;
  item.model = elements.model.value;
  item.modelLabel = result.modelLabel || elements.model.options[elements.model.selectedIndex]?.textContent || result.model || elements.model.value;
  item.voiceMode = elements.voiceMode.value;
  item.speakers = selectedSpeakers();
  item.rewriteVoiceChoice = elements.rewriteVoiceChoice.value;
  item.rewriteMood = elements.rewriteMood.value;
  item.rewriteStyle = elements.rewriteStyle.value;
  item.mood = selectedMood;
  item.style = elements.style.value;
  item.voiceVariants = nextVariants;
  item.updatedAt = new Date().toISOString();
  applyVoiceVariantToItem(item, variant);
  currentMemoryId = item.id;
  currentMemoryItem = item;
  loadAudioVariant(variant);
  await putMemoryItem(item);
  await renderMemory();
  renderActiveVoiceVariants();
}

async function saveScriptStudioMemory(result) {
  const item = memorySnapshotFromCurrent();
  item.id = crypto.randomUUID();
  item.title = result.title || shortTitle(result.ttsReadyScript || result.cleanScript || elements.scriptStudioTopic.value);
  item.script = result.ttsReadyScript || result.cleanScript || "";
  item.voiceMode = result.voiceModeRecommendation === "multi" ? "multi" : "single";
  item.voice = result.recommendedVoice || elements.voice.value;
  item.mood = result.recommendedMood || selectedMood;
  item.style = result.voiceDirection || elements.style.value;
  item.audioBase64 = "";
  item.audioMimeType = "";
  item.audioDuration = 0;
  item.mp3Base64 = "";
  item.mp3MimeType = "";
  item.selectedVoiceVariantId = "";
  item.voiceVariants = [];
  item.scriptStudio = {
    topic: result.topic || elements.scriptStudioTopic.value,
    templateId: result.templateId || elements.scriptTemplate.value,
    templateLabel: result.templateLabel || elements.scriptTemplate.options[elements.scriptTemplate.selectedIndex]?.textContent || "Custom",
    contentType: result.contentType || elements.scriptContentType.value,
    category: result.category || elements.scriptCategory.value,
    energy: result.energy || elements.scriptEnergy.value,
    voice: result.recommendedVoice || elements.scriptVoice.value,
    durationSeconds: result.durationSeconds || Number(elements.scriptDuration.value || 60),
    researchDepth: result.researchDepth,
    model: result.model,
    quality: result.quality,
    selectedAngle: result.selectedAngle,
  };
  item.updatedAt = new Date().toISOString();
  currentMemoryId = item.id;
  currentMemoryItem = item;
  await putMemoryItem(item);
  await renderMemory();
  renderActiveVoiceVariants();
}

async function saveStoryboardMemory(storyboard) {
  let item = currentMemoryId ? await getMemoryItem(currentMemoryId) : null;
  if (!item) {
    item = memorySnapshotFromCurrent();
    currentMemoryId = item.id;
  }
  item.script = elements.scriptText.value.trim();
  item.title = shortTitle(item.script);
  item.storyboardSettings = {
    mode: elements.storyboardMode.value,
    platform: elements.platform.value,
    targetSecondsPerImage: elements.targetSecondsPerImage.value,
    imageMood: selectedImageMood,
    imageStyle: elements.imageStyle.value,
    promptQuality: elements.promptQuality.value,
  };
  item.storyboard = { ...storyboard, audioCacheKey: lastStoryboardAudioCacheKey || lastAudioCacheKey };
  item.updatedAt = new Date().toISOString();
  currentMemoryItem = item;
  await putMemoryItem(item);
  await renderMemory();
  renderActiveVoiceVariants();
}

async function saveStockVideoMemory() {
  let item = currentMemoryId ? await getMemoryItem(currentMemoryId) : null;
  if (!item) {
    item = memorySnapshotFromCurrent();
    currentMemoryId = item.id;
  }
  item.script = elements.scriptText.value.trim();
  item.title = item.title && item.title !== "Untitled voice" ? item.title : shortTitle(item.script);
  item.stockVideo = {
    timeline: lastStockVideoTimeline,
    srt: lastSrtText,
    plan: lastStockVideoPlan,
    smartCaptions: lastStockSmartCaptions,
    settings: {
      source: elements.stockSource.value,
      maxClipDuration: elements.stockMaxClipDuration.value,
      captionStyle: elements.stockCaptionStyle.value,
      captionAnimation: elements.stockCaptionAnimation.value,
      captionPlacement: elements.stockCaptionPlacement.value,
      captionMood: elements.stockCaptionMood.value,
      captionCenter: elements.stockCaptionCenter.value,
      includeAudio: elements.stockIncludeAudio.checked,
      burnSubtitles: elements.stockBurnSubtitles.checked,
      useSmartCaptions: elements.stockSmartCaptions.checked,
    },
  };
  item.updatedAt = new Date().toISOString();
  currentMemoryItem = item;
  await putMemoryItem(item);
  await renderMemory();
  renderActiveVoiceVariants();
}

function loadAudioVariant(variant) {
  if (!variant?.audioBase64) {
    lastAudioBase64 = "";
    lastAudioMimeType = "";
    lastAudioDuration = 0;
    lastAudioCacheKey = "";
    elements.audioPlayer.removeAttribute("src");
    elements.downloadLink.removeAttribute("href");
    elements.downloadLink.classList.remove("visible");
    elements.mp3DownloadLink.removeAttribute("href");
    elements.mp3DownloadLink.classList.remove("visible");
    updateStoryboardModeHint();
    return;
  }
  lastAudioBase64 = variant.audioBase64;
  lastAudioMimeType = variant.audioMimeType || "audio/wav";
  lastAudioDuration = variant.audioDuration || 0;
  lastAudioCacheKey = audioCacheKey(lastAudioBase64);
  const audioUrl = `data:${lastAudioMimeType};base64,${lastAudioBase64}`;
  elements.audioPlayer.src = audioUrl;
  elements.downloadLink.href = audioUrl;
  elements.downloadLink.classList.add("visible");
  if (variant.mp3Base64) {
    elements.mp3DownloadLink.href = `data:${variant.mp3MimeType || "audio/mpeg"};base64,${variant.mp3Base64}`;
    elements.mp3DownloadLink.classList.add("visible");
  } else {
    elements.mp3DownloadLink.removeAttribute("href");
    elements.mp3DownloadLink.classList.remove("visible");
  }
  updateStoryboardModeHint();
}

function loadAudioFromMemory(item, variantId = "") {
  loadAudioVariant(selectedVoiceVariant(item, variantId));
}

function ensureActiveAudioLoaded() {
  if (lastAudioBase64) {
    return true;
  }
  const variant = selectedVoiceVariant(currentMemoryItem);
  if (!variant?.audioBase64) {
    return false;
  }
  loadAudioVariant(variant);
  return true;
}

async function restoreMemoryItem(item) {
  currentMemoryId = item.id;
  const chosenVariant = selectedVoiceVariant(item);
  if (chosenVariant) {
    applyVoiceVariantToItem(item, chosenVariant);
  }
  currentMemoryItem = item;
  elements.scriptText.value = item.script || "";
  updateCharCount();
  elements.provider.value = item.provider || "gemini";
  refreshProviderControls();
  setSelectValue(elements.model, item.model);
  setSelectValue(elements.voice, item.voice);
  elements.voiceMode.value = item.voiceMode || "single";
  elements.speakerOneName.value = item.speakers?.[0]?.name || "";
  elements.speakerTwoName.value = item.speakers?.[1]?.name || "";
  setSelectValue(elements.speakerOneVoice, item.speakers?.[0]?.voice || "Kore");
  setSelectValue(elements.speakerTwoVoice, item.speakers?.[1]?.voice || "Puck");
  elements.rewriteVoiceChoice.value = item.rewriteVoiceChoice || "auto";
  setSelectValue(elements.rewriteMood, item.rewriteMood);
  elements.rewriteStyle.value = item.rewriteStyle || "";
  updateVoiceModeUi();
  selectedMood = item.mood || selectedMood;
  renderMoods(currentProviderConfig().moods || []);
  elements.style.value = item.style || "";
  if (item.storyboardSettings) {
    setSelectValue(elements.storyboardMode, item.storyboardSettings.mode);
    setSelectValue(elements.platform, item.storyboardSettings.platform);
    setSelectValue(elements.targetSecondsPerImage, item.storyboardSettings.targetSecondsPerImage);
    setSelectValue(elements.promptQuality, item.storyboardSettings.promptQuality);
    selectedImageMood = item.storyboardSettings.imageMood || selectedImageMood;
    elements.imageStyle.value = item.storyboardSettings.imageStyle || elements.imageStyle.value;
    renderImageMoods(config.imageMoods || []);
    updateStoryboardModeHint();
  }
  if (item.scriptStudio) {
    elements.scriptStudioTopic.value = item.scriptStudio.topic || elements.scriptStudioTopic.value;
    setSelectValue(elements.scriptTemplate, item.scriptStudio.templateId);
    setSelectValue(elements.scriptContentType, item.scriptStudio.contentType);
    setSelectValue(elements.scriptCategory, item.scriptStudio.category);
    setSelectValue(elements.scriptEnergy, item.scriptStudio.energy);
    setSelectValue(elements.scriptVoice, item.scriptStudio.voice);
    setSelectValue(elements.scriptDuration, String(item.scriptStudio.durationSeconds || ""));
    setSelectValue(elements.scriptResearchDepth, item.scriptStudio.researchDepth);
  }
  loadAudioFromMemory(item);
  if (item.storyboard) {
    renderStoryboard(item.storyboard);
  } else {
    clearStoryboardState();
  }
  if (item.stockVideo) {
    const stockSettings = item.stockVideo.settings || {};
    setSelectValue(elements.stockSource, stockSettings.source);
    setSelectValue(elements.stockMaxClipDuration, stockSettings.maxClipDuration);
    setSelectValue(elements.stockCaptionStyle, stockSettings.captionStyle);
    setSelectValue(elements.stockCaptionAnimation, stockSettings.captionAnimation);
    setSelectValue(elements.stockCaptionPlacement, stockSettings.captionPlacement);
    setSelectValue(elements.stockCaptionMood, stockSettings.captionMood);
    elements.stockCaptionCenter.value = stockSettings.captionCenter || "";
    elements.stockIncludeAudio.checked = stockSettings.includeAudio !== false;
    elements.stockBurnSubtitles.checked = stockSettings.burnSubtitles !== false;
    lastStockVideoTimeline = item.stockVideo.timeline || lastStockVideoTimeline;
    lastStockVideoPlan = item.stockVideo.plan || null;
    lastStockSmartCaptions = item.stockVideo.smartCaptions || null;
    elements.stockSmartCaptions.checked = Boolean(stockSettings.useSmartCaptions && lastStockSmartCaptions);
    setSrtExport(item.stockVideo.srt || lastSrtText);
    if (lastStockVideoPlan) {
      renderStockVideoPlan(lastStockVideoPlan);
    }
    if (elements.stockCaptionSummary) {
      elements.stockCaptionSummary.textContent = lastStockSmartCaptions
        ? `${lastStockSmartCaptions.smartCaptionCount || lastStockSmartCaptions.segments?.length || 0} smart captions restored.`
        : "Stock video settings restored.";
    }
  }
  const voiceTab = document.querySelector('.tab-button[data-tab-target="voicePane"]:not([data-tab-action])');
  if (voiceTab) {
    activateTab(voiceTab);
  }
  elements.outputTitle.textContent = "Memory restored";
  setMessage("Restored script, settings, audio, and prompts from memory.");
  renderActiveVoiceVariants();
}

async function handleMemoryAction(id, action, variantId = "") {
  if (!id) {
    return;
  }
  const item = await getMemoryItem(id);
  if (!item) {
    await renderMemory();
    return;
  }

  if (action === "restore") {
    await restoreMemoryItem(item);
    return;
  }

  if (action === "play") {
    const variant = selectedVoiceVariant(item, variantId);
    if (!variant?.audioBase64) {
      setMessage("This memory does not have saved audio yet.", true);
      return;
    }
    currentMemoryId = item.id;
    currentMemoryItem = item;
    loadAudioVariant(variant);
    const voiceTab = document.querySelector('.tab-button[data-tab-target="voicePane"]:not([data-tab-action])');
    if (voiceTab) {
      activateTab(voiceTab);
    }
    await elements.audioPlayer.play().catch(() => {});
    setMessage(`Playing ${variant.label || "saved voice take"} from memory.`);
    renderActiveVoiceVariants();
    return;
  }

  if (action === "use-variant") {
    const variant = selectedVoiceVariant(item, variantId);
    if (!variant) {
      setMessage("This voice take is no longer available.", true);
      return;
    }
    item.voiceVariants = voiceVariantsForItem(item);
    applyVoiceVariantToItem(item, variant);
    item.updatedAt = new Date().toISOString();
    await putMemoryItem(item);
    await restoreMemoryItem(item);
    await renderMemory();
    setMessage(`Selected ${variant.label || "voice take"} for SRT, prompts, and export.`);
    return;
  }

  if (action === "delete-variant") {
    const variants = voiceVariantsForItem(item).filter((variant) => variant.id !== variantId);
    item.voiceVariants = variants;
    const nextVariant = selectedVoiceVariant({ ...item, voiceVariants: variants, selectedVoiceVariantId: "" });
    if (nextVariant) {
      applyVoiceVariantToItem(item, nextVariant);
    } else {
      item.selectedVoiceVariantId = "";
      item.audioBase64 = "";
      item.audioMimeType = "";
      item.audioDuration = 0;
      item.mp3Base64 = "";
      item.mp3MimeType = "";
    }
    item.updatedAt = new Date().toISOString();
    await putMemoryItem(item);
    if (currentMemoryId === item.id) {
      currentMemoryItem = item;
      loadAudioFromMemory(item);
      renderActiveVoiceVariants();
    }
    await renderMemory();
    setMessage("Deleted that voice take from the project.");
    return;
  }

  if (action === "prompts") {
    currentMemoryId = item.id;
    if (item.storyboard) {
      renderStoryboard(item.storyboard);
      const storyboardTab = document.querySelector('.tab-button[data-tab-target="storyboardPane"]');
      if (storyboardTab) {
        activateTab(storyboardTab);
      }
      setMessage("Loaded saved storyboard prompts.");
    } else {
      setMessage("This memory does not have storyboard prompts yet.", true);
    }
    return;
  }

  if (action === "delete") {
    await deleteMemoryItem(id);
    if (currentMemoryId === id) {
      currentMemoryId = "";
      currentMemoryItem = null;
      renderActiveVoiceVariants();
    }
    await renderMemory();
  }
}

async function scriptHistoryContext() {
  const items = await getMemoryItems().catch(() => []);
  return items
    .filter((item) => item?.script)
    .slice(0, 8)
    .map((item) => ({
      title: item.title || shortTitle(item.script),
      script: item.script,
      category: item.scriptStudio?.category || "",
      updatedAt: item.updatedAt || item.createdAt || "",
    }));
}

function renderScriptStudioResult(result) {
  lastScriptStudioResult = result;
  const quality = result.quality || {};
  const score = Number(quality.qualityScore || 0);
  const beatPlan = Array.isArray(result.beatPlan) ? result.beatPlan : [];
  const angles = Array.isArray(result.nicheAngles) ? result.nicheAngles : [];
  const hooks = Array.isArray(result.hookOptions) ? result.hookOptions : [];
  const improvements = Array.isArray(quality.improvementsApplied) ? quality.improvementsApplied : [];
  const validationNotes = Array.isArray(quality.validationNotes) ? quality.validationNotes : [];

  elements.scriptStudioResult.innerHTML = `
    <article class="script-result-card">
      <div class="script-result-head">
        <div>
          <p class="eyebrow">${escapeHtml(result.modelLabel || result.model || "Script Studio")}</p>
          <h3>${escapeHtml(result.title || "Generated script")}</h3>
        </div>
        <span class="score-pill">Score ${score ? score.toFixed(1) : "?"}/10</span>
      </div>
      <div class="script-meta-grid">
        <span>${escapeHtml(result.durationSeconds || elements.scriptDuration.value)} sec</span>
        <span>${escapeHtml(result.contentType || elements.scriptContentType.value)}</span>
        <span>${escapeHtml(result.energy || elements.scriptEnergy.value)} energy</span>
        <span>${escapeHtml(result.languageStyle || elements.scriptLanguage.value)}</span>
        <span>${escapeHtml(result.templateLabel || elements.scriptTemplate.options[elements.scriptTemplate.selectedIndex]?.textContent || "Custom")}</span>
        <span>${escapeHtml(result.voiceModeRecommendation || "single")}</span>
      </div>
      <div class="field-group">
        <label>Selected angle</label>
        <p class="hint">${escapeHtml(result.selectedAngle || result.researchSummary || "Generated from your topic.")}</p>
      </div>
      ${
        result.researchWarning
          ? `<article class="script-warning-card"><strong>Search fallback used</strong><p>${escapeHtml(result.researchWarning)}</p></article>`
          : ""
      }
      <div class="field-group">
        <label>TTS screenplay</label>
        <textarea class="generated-script-box" readonly>${escapeHtml(result.ttsReadyScript || "")}</textarea>
      </div>
      ${
        result.cleanScript
          ? `<details class="script-clean-details"><summary>Clean spoken script</summary><textarea class="generated-script-box" readonly>${escapeHtml(result.cleanScript)}</textarea></details>`
          : ""
      }
      ${
        result.voiceDirection
          ? `<div class="field-group"><label>TTS voice direction</label><p class="hint">${escapeHtml(result.voiceDirection)}</p></div>`
          : ""
      }
      ${
        hooks.length
          ? `<div class="script-angle-list"><label>Hook options</label>${hooks
              .slice(0, 3)
              .map((hook) => `<article><strong>${escapeHtml(hook)}</strong></article>`)
              .join("")}</div>`
          : ""
      }
      ${
        angles.length
          ? `<div class="script-angle-list"><label>Niche angles</label>${angles
              .slice(0, 4)
              .map((angle) => `<article><strong>${escapeHtml(angle)}</strong></article>`)
              .join("")}</div>`
          : ""
      }
      ${
        beatPlan.length
          ? `<div class="script-quality-list"><label>Retention beat plan</label>${beatPlan
              .map(
                (beat) => `
                  <article>
                    <strong>${escapeHtml(beat.beat || "Beat")} ${beat.approxSeconds ? `- ${escapeHtml(beat.approxSeconds)}` : ""}</strong>
                    <p>${escapeHtml(beat.purpose || "")}</p>
                  </article>
                `,
              )
              .join("")}</div>`
          : ""
      }
      <div class="script-quality-list">
        <label>Quality notes</label>
        <article>
          <strong>Hook ${escapeHtml(quality.hookScore || "?")} / Retention ${escapeHtml(quality.retentionScore || "?")} / TTS ${escapeHtml(quality.ttsReadinessScore || "?")} / Tags ${escapeHtml(quality.ttsTagScore || "?")}</strong>
          <p>${escapeHtml(quality.notes || "No critique returned.")}</p>
          ${improvements.length ? `<p>${escapeHtml(improvements.join(" - "))}</p>` : ""}
          ${validationNotes.length ? `<p>${escapeHtml(`Validation: ${validationNotes.join(", ")}`)}</p>` : ""}
        </article>
      </div>
    </article>
  `;

  const sources = Array.isArray(result.sources) ? result.sources : [];
  elements.scriptSourceList.innerHTML = sources
    .map((source) => `<a class="source-chip" href="${escapeHtml(source.uri)}" target="_blank" rel="noreferrer">${escapeHtml(source.title || "Source")}</a>`)
    .join("");

  elements.scriptUseButton.hidden = false;
  elements.scriptCopyButton.hidden = false;
}

async function generateScriptStudio() {
  const topic = elements.scriptStudioTopic.value.trim();
  if (!topic) {
    const payload = { error: "Enter a topic or rough idea in Script Studio first.", code: "SCRIPT_TOPIC_REQUIRED", provider: "gemini" };
    elements.scriptStudioResult.innerHTML = renderInlineApiError(payload, payload.error);
    showApiError(payload, payload.error);
    return;
  }

  elements.scriptGenerateButton.disabled = true;
  elements.scriptGenerateButton.textContent = "Writing...";
  elements.scriptUseButton.hidden = true;
  elements.scriptCopyButton.hidden = true;
  elements.scriptStudioResult.innerHTML = `<p class="message">Researching the angle, writing the script, then running a quality pass.</p>`;
  elements.scriptSourceList.innerHTML = "";

  try {
    const history = await scriptHistoryContext();
    const response = await apiFetch("/api/script-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        scriptTemplate: elements.scriptTemplate.value,
        contentType: elements.scriptContentType.value,
        category: elements.scriptCategory.value,
        duration: elements.scriptDuration.value,
        languageStyle: elements.scriptLanguage.value,
        researchDepth: elements.scriptResearchDepth.value,
        scriptMode: elements.scriptModeSelect.value,
        tone: elements.scriptTone.value,
        energy: elements.scriptEnergy.value,
        audience: elements.scriptAudience.value,
        userVoice: elements.scriptUserVoice.value,
        customDirection: elements.scriptUserVoice.value,
        selectedVoice: elements.scriptVoice.value || elements.voice.value,
        speakerOneVoice: elements.speakerOneVoice.value || "Kore",
        speakerTwoVoice: elements.speakerTwoVoice.value || "Puck",
        history,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to generate script.");
    }

    renderScriptStudioResult(result);
    await saveScriptStudioMemory(result).catch(() => {});
    setMessage(`Script Studio created a ${result.durationSeconds || elements.scriptDuration.value}s ${result.category || elements.scriptCategory.value} script.`);
  } catch (error) {
    lastScriptStudioResult = null;
    const payload = error.payload || error;
    elements.scriptStudioResult.innerHTML = renderInlineApiError(payload, error.message || "Unable to generate script.");
    showApiError(payload, error.message || "Unable to generate script.");
  } finally {
    elements.scriptGenerateButton.disabled = false;
    elements.scriptGenerateButton.textContent = "Generate script";
  }
}

async function copyScriptStudioScript() {
  if (!lastScriptStudioResult?.ttsReadyScript) {
    setMessage("Generate a script first.", true);
    return;
  }
  await navigator.clipboard.writeText(lastScriptStudioResult.ttsReadyScript);
  elements.scriptCopyButton.textContent = "Copied";
  setTimeout(() => {
    elements.scriptCopyButton.textContent = "Copy script";
  }, 1200);
}

function useScriptStudioScript() {
  const result = lastScriptStudioResult;
  if (!result?.ttsReadyScript) {
    setMessage("Generate a script first.", true);
    return;
  }

  elements.scriptText.value = result.ttsReadyScript;
  updateCharCount();
  elements.provider.value = "gemini";
  refreshProviderControls();
  if (result.recommendedVoice) {
    setSelectValue(elements.voice, result.recommendedVoice);
    setSelectValue(elements.scriptVoice, result.recommendedVoice);
  }
  selectedMood = "none";
  renderMoods(currentProviderConfig().moods || []);
  if (result.voiceDirection) {
    elements.style.value = result.voiceDirection;
  }

  const speakerPlan = Array.isArray(result.speakerPlan) ? result.speakerPlan : [];
  if (result.voiceModeRecommendation === "multi" || elements.scriptModeSelect.value === "dialogue") {
    elements.voiceMode.value = "multi";
    const first = speakerPlan[0] || {};
    const second = speakerPlan[1] || {};
    elements.speakerOneName.value = first.speaker || "Narrator";
    elements.speakerTwoName.value = second.speaker || "Second Voice";
    setSelectValue(elements.speakerOneVoice, first.voice || elements.speakerOneVoice.value || "Kore");
    setSelectValue(elements.speakerTwoVoice, second.voice || elements.speakerTwoVoice.value || "Puck");
  } else {
    elements.voiceMode.value = "single";
  }
  updateVoiceModeUi();

  const voiceTab = document.querySelector('.tab-button[data-tab-target="voicePane"]:not([data-tab-action])');
  if (voiceTab) {
    activateTab(voiceTab);
  }
  setMessage("Script moved to Voice with mood set to None so the visible tags and audio profile stay in control.");
}

function formatSrtTime(seconds) {
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

  return text
    ? {
        number: Number(segment?.number || index + 1),
        startTime,
        endTime,
        durationSeconds: Math.max(0.1, endTime - startTime),
        text,
      }
    : null;
}

function subtitleSegmentsForStoryboard(storyboard) {
  const rawSegments = Array.isArray(storyboard?.subtitleSegments) && storyboard.subtitleSegments.length
    ? storyboard.subtitleSegments
    : Array.isArray(storyboard?.timeline?.segments)
      ? storyboard.timeline.segments
      : [];
  return rawSegments.map((segment, index) => normalizeSubtitleSegment(segment, index)).filter(Boolean);
}

function buildSrtFromSegments(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment, index) => {
      const text = cleanSubtitleText(segment.text || segment.transcriptHindi);
      return text ? `${index + 1}\n${formatSrtTime(segment.startTime)} --> ${formatSrtTime(segment.endTime)}\n${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function setSrtExport(value) {
  lastSrtText = String(value || "").trim();
  elements.srtExport.value = lastSrtText;
  elements.copySrtButton.disabled = !lastSrtText;
  elements.downloadSrtButton.disabled = !lastSrtText;
}

async function generateStoryboard() {
  const text = elements.scriptText.value.trim();
  const mode = elements.storyboardMode.value;
  const reusableTranscript =
    mode === "srt-director" &&
    lastSrtText &&
    lastStoryboard?.timeline?.segments?.length &&
    lastStoryboardAudioCacheKey &&
    lastStoryboardAudioCacheKey === lastAudioCacheKey;
  const cachedSrt = reusableTranscript ? lastSrtText : "";
  const cachedTimeline = reusableTranscript ? lastStoryboard.timeline : null;
  const previousTimelineJson = lastTimelineJson;
  if (mode === "fast" && !text) {
    setMessage("Paste or type your Hindi story before generating image prompts.", true);
    return;
  }
  if ((mode === "audio-aware" || mode === "audio-detailed" || (mode === "srt-director" && !reusableTranscript)) && !ensureActiveAudioLoaded()) {
    setMessage("Generate voice first, then use an audio-aware mode with the generated narration audio.", true);
    return;
  }

  elements.storyboardButton.disabled = true;
  elements.storyboardButton.textContent = "Writing prompts...";
  elements.copyAllPromptsButton.hidden = true;
  if (!reusableTranscript) {
    setSrtExport("");
  }
  const loadingText =
    mode === "srt-director"
      ? reusableTranscript
        ? "Reusing the current SRT, writing a new director summary, then regenerating Flow prompts from caption beats."
        : "Listening to audio, creating SRT, writing a director summary, then generating Flow prompts from caption beats."
      : mode === "audio-detailed"
      ? "Listening to audio, building a detailed timeline, then writing Flow prompts with the configured Lite text model."
      : mode === "audio-aware"
        ? "Listening to generated audio with the configured Lite text model."
        : "Analyzing the script and audio duration with the configured Lite text model.";
  elements.storyboardResult.innerHTML = `<p class="message">${loadingText}</p>`;

  try {
    const voiceMood = findConfigItem(currentProviderConfig().moods || [], selectedMood);
    const imageMood = findConfigItem(config.imageMoods || [], selectedImageMood);
    const promptQuality = findConfigItem(config.promptQualityModes || [], elements.promptQuality.value);
    const response = await apiFetch("/api/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        text,
        platform: elements.platform.value,
        imageMood: selectedImageMood,
        imageStyle: elements.imageStyle.value,
        promptQuality: elements.promptQuality.value,
        audioDuration: lastAudioDuration,
        audioBase64: mode === "audio-aware" || mode === "audio-detailed" || (mode === "srt-director" && !reusableTranscript) ? lastAudioBase64 : "",
        audioMimeType: lastAudioMimeType || "audio/wav",
        targetSecondsPerImage: elements.targetSecondsPerImage.value,
        cachedSrt,
        cachedTimeline,
        audioCacheKey: lastAudioCacheKey,
        voiceContext: {
          provider: elements.provider.value,
          model: elements.model.value,
          modelLabel: elements.model.options[elements.model.selectedIndex]?.textContent || elements.model.value,
          voice: elements.voice.value,
          voiceMode: elements.voiceMode.value,
          voiceMood: selectedMood,
          voiceMoodLabel: voiceMood?.label || selectedMood,
          voiceMoodDescription: voiceMood?.description || "",
          voiceDirection: elements.style.value,
          imageMood: selectedImageMood,
          imageMoodLabel: imageMood?.label || selectedImageMood,
          imageMoodDescription: imageMood?.description || "",
          promptQuality: elements.promptQuality.value,
          promptQualityLabel: promptQuality?.label || elements.promptQuality.value,
          scriptStudio: lastScriptStudioResult
            ? {
                title: lastScriptStudioResult.title,
                category: lastScriptStudioResult.category,
                templateId: lastScriptStudioResult.templateId,
                templateLabel: lastScriptStudioResult.templateLabel,
                selectedAngle: lastScriptStudioResult.selectedAngle,
                recommendedMood: lastScriptStudioResult.recommendedMood,
                voiceDirection: lastScriptStudioResult.voiceDirection,
              }
            : null,
        },
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to generate storyboard prompts.");
    }

    renderStoryboard(result);
    await saveStoryboardMemory(result).catch(() => {});
    setMessage(result.reusedTranscript ? "Storyboard prompts are ready for Flow. Reused the current SRT transcript." : "Storyboard prompts are ready for Flow.");
  } catch (error) {
    elements.storyboardResult.innerHTML = "";
    if (reusableTranscript && cachedSrt) {
      setSrtExport(cachedSrt);
      lastTimelineJson = previousTimelineJson;
      elements.timelineExport.value = previousTimelineJson;
    }
    showApiError(error.payload || error, error.message || "Unable to generate storyboard prompts.");
  } finally {
    elements.storyboardButton.disabled = false;
    elements.storyboardButton.textContent = "Generate Flow prompts";
  }
}

function stockTimelinePayload() {
  if (lastStockVideoTimeline?.segments?.length) {
    return lastStockVideoTimeline;
  }
  if (lastStoryboard?.timeline?.segments?.length) {
    return lastStoryboard.timeline;
  }
  const timeline = parseJsonOrNull(lastTimelineJson);
  if (timeline?.frames?.length) {
    return { title: timeline.title || "Image timeline", frames: timeline.frames };
  }
  if (lastSrtText) {
    return null;
  }
  return null;
}

function renderStockVideoPlan(plan) {
  lastStockVideoPlan = plan;
  const segments = Array.isArray(plan?.segments) ? plan.segments : [];
  const readyCount = segments.filter((segment) => segment.selectedClip?.url).length;
  if (elements.stockRenderButton) {
    elements.stockRenderButton.disabled = readyCount === 0;
  }
  if (elements.stockDownloadLink) {
    elements.stockDownloadLink.removeAttribute("href");
    elements.stockDownloadLink.classList.remove("visible");
  }
  if (!elements.stockVideoResult) {
    return;
  }

  const cards = segments
    .map((segment) => {
      const clip = segment.selectedClip;
      const start = Number(segment.startTime || 0).toFixed(1);
      const end = Number(segment.endTime || 0).toFixed(1);
      const previewUrl = safeHttpUrl(clip?.preview);
      const preview = previewUrl
        ? `<img class="stock-preview" src="${escapeHtml(previewUrl)}" alt="Selected stock clip preview" />`
        : `<div class="stock-preview stock-preview-placeholder">No clip</div>`;
      const sourceUrl = safeHttpUrl(clip?.pageUrl);
      const sourceLink = sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">source</a>` : "";
      const creator = clip?.creator ? `<span>${escapeHtml(clip.creator)}</span>` : "";
      const selectedMeta = clip
        ? `
          <div class="stock-chip-row">
            <span>${escapeHtml(clip.provider)}</span>
            <span>${Number(clip.duration || 0).toFixed(1)}s</span>
            <span>${Number(clip.width || 0)}x${Number(clip.height || 0)}</span>
            ${creator}
            ${sourceLink}
          </div>
        `
        : `<p>No matching stock clip found. Try another source or regenerate the plan.</p>`;
      const candidateButtons = (Array.isArray(segment.candidates) ? segment.candidates : [])
        .map((candidate, candidateIndex) => {
          const isActive = candidate.id && clip?.id && candidate.id === clip.id;
          const duration = Number(candidate.duration || 0) ? `${Number(candidate.duration || 0).toFixed(1)}s` : "clip";
          return `
            <button class="stock-candidate-button${isActive ? " is-active" : ""}" type="button" data-segment-number="${escapeHtml(segment.number)}" data-clip-id="${escapeHtml(candidate.id)}">
              <span>${escapeHtml(candidate.provider || "stock")} ${candidateIndex + 1}</span>
              <small>${escapeHtml(`${duration} | ${candidate.query || ""}`)}</small>
            </button>
          `;
        })
        .join("");
      const candidateControls = candidateButtons ? `<div class="stock-candidates">${candidateButtons}</div>` : "";
      const queries = (segment.searchQueries || []).map((query) => `<span>${escapeHtml(query)}</span>`).join("");
      const warnings = (segment.searchErrors || []).length
        ? `<p class="hint">${escapeHtml(segment.searchErrors.map((error) => `${error.provider}: ${error.message}`).join(" | "))}</p>`
        : "";
      return `
        <article class="stock-segment-card ${clip ? "" : "stock-warning"}">
          ${preview}
          <div class="stock-card-body">
            <div class="stock-card-head">
              <strong>${escapeHtml(start)}s - ${escapeHtml(end)}s</strong>
              <span>${clip ? "Ready" : "Needs clip"}</span>
            </div>
            <p>${escapeHtml(segment.visualIntent || segment.captionText || "")}</p>
            <div class="stock-chip-row">${queries}</div>
            ${candidateControls}
            ${selectedMeta}
            ${warnings}
          </div>
        </article>
      `;
    })
    .join("");

  elements.stockVideoResult.innerHTML = `
    <section class="stock-summary">
      <div>
        <p class="eyebrow">${escapeHtml(plan.source || "stock")} · ${escapeHtml(plan.model || "gemini-2.5-flash")}</p>
        <h3>${escapeHtml(plan.title || "Stock video plan")}</h3>
      </div>
      <p>${escapeHtml(plan.visualStyle || "")}</p>
      <p>${readyCount} of ${segments.length} timeline beats have selected stock clips.</p>
    </section>
    <div class="stock-segment-grid">${cards}</div>
  `;

  for (const button of elements.stockVideoResult.querySelectorAll(".stock-candidate-button")) {
    button.addEventListener("click", () => selectStockClip(button.dataset.segmentNumber, button.dataset.clipId));
  }
}

function selectStockClip(segmentNumber, clipId) {
  const segments = Array.isArray(lastStockVideoPlan?.segments) ? lastStockVideoPlan.segments : [];
  const segment = segments.find((item) => String(item.number) === String(segmentNumber));
  const candidate = segment?.candidates?.find((item) => String(item.id) === String(clipId));
  if (!segment || !candidate) {
    return;
  }
  segment.selectedClip = candidate;
  renderStockVideoPlan(lastStockVideoPlan);
  saveStockVideoMemory().catch(() => {});
  setMessage(`Stock clip selected for beat ${segment.number}.`);
}

async function generateStockVideoTimeline({ quiet = false } = {}) {
  if (!ensureActiveAudioLoaded()) {
    setMessage("Generate or select a voice take before creating the video SRT.", true);
    return null;
  }

  if (elements.stockTimelineButton) {
    elements.stockTimelineButton.disabled = true;
    elements.stockTimelineButton.textContent = "Creating SRT...";
  }
  if (!quiet) {
    setMessage("Video mode is listening to the current voice audio and creating timed SRT beats.");
  }
  try {
    const response = await apiFetch("/api/stock-video-timeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64: lastAudioBase64,
        audioMimeType: lastAudioMimeType || "audio/wav",
        audioDuration: lastAudioDuration || 0,
        platform: elements.platform.value,
        maxClipDuration: elements.stockMaxClipDuration.value,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to create stock video SRT.");
    }
    lastStockVideoTimeline = result.timeline || null;
    lastStockVideoPlan = null;
    lastStockSmartCaptions = null;
    if (elements.stockSmartCaptions) {
      elements.stockSmartCaptions.checked = false;
    }
    setSrtExport(result.srt || "");
    if (elements.stockVideoResult) {
      elements.stockVideoResult.innerHTML = `
        <section class="stock-summary">
          <div>
            <p class="eyebrow">${escapeHtml(result.source || "audio")} | ${escapeHtml(result.model || "timeline")}</p>
            <h3>${escapeHtml(result.timeline?.title || "Video SRT ready")}</h3>
          </div>
          <p>${escapeHtml(result.timeline?.audioSummary || "Timed SRT is ready for stock clip search.")}</p>
          <p>${escapeHtml(String(result.timeline?.segments?.length || 0))} caption beats created.</p>
        </section>
      `;
    }
    setMessage("Video SRT is ready. Now find stock clips or design captions.");
    await saveStockVideoMemory().catch(() => {});
    return result;
  } catch (error) {
    showApiError(error.payload || error, error.message || "Unable to create stock video SRT.");
    return null;
  } finally {
    if (elements.stockTimelineButton) {
      elements.stockTimelineButton.disabled = false;
      elements.stockTimelineButton.textContent = "Create SRT";
    }
  }
}

async function designStockSmartCaptions() {
  if (!lastSrtText) {
    const timelineResult = await generateStockVideoTimeline({ quiet: true });
    if (!timelineResult?.srt) {
      return null;
    }
  }

  elements.stockSmartCaptionButton.disabled = true;
  elements.stockSmartCaptionButton.textContent = "Designing...";
  elements.stockCaptionSummary.textContent = "Designing caption rhythm, highlights, placement, and animation.";
  try {
    const response = await apiFetch("/api/stock-video-smart-captions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srtText: lastSrtText,
        styleId: elements.stockCaptionStyle.value,
        mood: elements.stockCaptionMood.value,
        format: elements.platform.value,
        audioDuration: lastAudioDuration || 0,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to design smart captions.");
    }
    lastStockSmartCaptions = result;
    elements.stockSmartCaptions.checked = true;
    const coverage = result.coveragePercent ? ` Coverage ${result.coveragePercent}%.` : "";
    const warning = result.coverageWarning ? ` ${result.coverageWarning}` : "";
    elements.stockCaptionSummary.textContent = `${result.smartCaptionCount || 0} smart caption beats via ${result.model || "caption model"}.${coverage} ${result.captionStyle || ""}${warning}`.trim();
    setMessage("Smart captions are ready for the stock video render.");
    await saveStockVideoMemory().catch(() => {});
    return result;
  } catch (error) {
    lastStockSmartCaptions = null;
    elements.stockSmartCaptions.checked = false;
    elements.stockCaptionSummary.textContent = "Smart captions failed. Normal animated captions are still available.";
    showApiError(error.payload || error, error.message || "Unable to design smart captions.");
    return null;
  } finally {
    elements.stockSmartCaptionButton.disabled = false;
    elements.stockSmartCaptionButton.textContent = "Design captions";
  }
}

async function generateStockVideoPlan() {
  const timeline = stockTimelinePayload();
  let usableTimeline = timeline;
  if (!usableTimeline && !lastSrtText) {
    const timelineResult = await generateStockVideoTimeline({ quiet: true });
    usableTimeline = timelineResult?.timeline || null;
  }
  if (!usableTimeline && !lastSrtText) {
    setMessage("Create a video SRT first, or generate/select a voice take so Video mode can create one.", true);
    return;
  }

  elements.stockPlanButton.disabled = true;
  elements.stockRenderButton.disabled = true;
  elements.stockPlanButton.textContent = "Finding clips...";
  elements.stockVideoResult.innerHTML = `<p class="message">Writing stock search queries, then checking Pexels/Pixabay for matching vertical clips.</p>`;
  try {
    const response = await apiFetch("/api/stock-video-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: elements.scriptText.value,
        timeline: usableTimeline,
        srt: lastSrtText,
        source: elements.stockSource.value,
        maxClipDuration: elements.stockMaxClipDuration.value,
        platform: elements.platform.value,
        imageMood: selectedImageMood,
        visualStyle: elements.imageStyle.value,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to create stock video plan.");
    }
    renderStockVideoPlan(result);
    await saveStockVideoMemory().catch(() => {});
    setMessage("Stock clips are ready. Review them, then render MP4.");
  } catch (error) {
    elements.stockVideoResult.innerHTML = "";
    showApiError(error.payload || error, error.message || "Unable to create stock video plan.");
  } finally {
    elements.stockPlanButton.disabled = false;
    elements.stockPlanButton.textContent = "Find stock clips";
  }
}

async function renderStockVideo() {
  const segments = Array.isArray(lastStockVideoPlan?.segments) ? lastStockVideoPlan.segments : [];
  if (!segments.some((segment) => segment.selectedClip?.url)) {
    setMessage("Find stock clips first, then render MP4.", true);
    return;
  }
  if (elements.stockIncludeAudio.checked && !ensureActiveAudioLoaded()) {
    setMessage("Generate or select a voice take before rendering stock video with audio.", true);
    return;
  }
  if (elements.stockBurnSubtitles.checked && !lastSrtText) {
    const timelineResult = await generateStockVideoTimeline({ quiet: true });
    if (!timelineResult?.srt) {
      return;
    }
  }
  if (elements.stockBurnSubtitles.checked && elements.stockSmartCaptions.checked && !lastStockSmartCaptions) {
    const smartResult = await designStockSmartCaptions();
    if (!smartResult) {
      return;
    }
  }

  elements.stockRenderButton.disabled = true;
  elements.stockRenderButton.textContent = "Rendering...";
  setMessage("FFmpeg is downloading, trimming, cropping, and combining the stock clips.");
  try {
    const response = await apiFetch("/api/stock-video-render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: lastStockVideoPlan.title || shortTitle(elements.scriptText.value),
        segments,
        maxClipDuration: elements.stockMaxClipDuration.value,
        includeAudio: elements.stockIncludeAudio.checked,
        audioBase64: elements.stockIncludeAudio.checked ? lastAudioBase64 : "",
        audioMimeType: lastAudioMimeType || "audio/wav",
        burnSubtitles: elements.stockBurnSubtitles.checked,
        srt: elements.stockBurnSubtitles.checked ? lastSrtText : "",
        captionStyle: elements.stockCaptionStyle.value,
        captionAnimation: elements.stockCaptionAnimation.value,
        captionPlacement: elements.stockCaptionPlacement.value,
        captionCenterSpec: elements.stockCaptionCenter.value,
        smartCaptions: elements.stockBurnSubtitles.checked && elements.stockSmartCaptions.checked ? lastStockSmartCaptions : null,
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throwApiError(result, "Unable to render stock video.");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const filename = `${safeFilePart(lastStockVideoPlan.title || shortTitle(elements.scriptText.value) || "stock-video")}.mp4`;
    elements.stockDownloadLink.href = objectUrl;
    elements.stockDownloadLink.download = filename;
    elements.stockDownloadLink.classList.add("visible");
    setMessage("Stock MP4 is ready. Use the MP4 download button in the Stock Video panel.");
  } catch (error) {
    showApiError(error.payload || error, error.message || "Unable to render stock video.");
  } finally {
    elements.stockRenderButton.disabled = false;
    elements.stockRenderButton.textContent = "Render MP4";
  }
}

function worldCupAssetUrl(run, fileKey) {
  if (fileKey === "mp4" && run?.r2?.publicUrl) {
    return run.r2.publicUrl;
  }
  return apiUrl(`/api/worldcup/assets/${encodeURIComponent(run.id)}?file=${encodeURIComponent(fileKey)}`);
}

function updateWorldCupStatus() {
  if (!elements.worldCupStatus) {
    return;
  }
  const worldCup = config.worldCup || {};
  const checks = [
    worldCup.ready ? "Gemini ready" : "Gemini key missing",
    worldCup.ffmpegReady ? "FFmpeg ready" : "FFmpeg missing",
    worldCup.stockReady ? "stock keys ready" : "fallback visuals",
    worldCup.telegramReady ? "Telegram ready" : "Telegram not configured",
    worldCup.driveReady ? "Drive ready" : "Drive not configured",
    worldCup.r2Ready ? "R2 fallback ready" : "R2 fallback off",
  ];
  const schedule = Array.isArray(worldCup.scheduleHoursUtc) ? ` Schedule UTC: ${worldCup.scheduleHoursUtc.join(", ")}.` : "";
  elements.worldCupStatus.textContent = `Pipeline: ${checks.join(" | ")}. Strategy default: ${worldCup.strategy || "classic"}. Models: writer ${worldCup.models?.writer || "default"}, TTS ${worldCup.models?.tts || "default"}.${schedule}`;
  elements.worldCupStatus.classList.toggle("warning", !worldCup.ready || !worldCup.ffmpegReady);
}

function worldCupRunActions(run) {
  const actions = [];
  if (!run.files?.mp4) {
    actions.push(`<button class="ghost-action-button" type="button" data-worldcup-action="render" data-run-id="${escapeHtml(run.id)}">Render</button>`);
  }
  actions.push(`<button class="ghost-action-button" type="button" data-worldcup-action="telegram" data-run-id="${escapeHtml(run.id)}">Send Telegram</button>`);
  actions.push(`<button class="ghost-action-button" type="button" data-worldcup-action="upload" data-run-id="${escapeHtml(run.id)}">Upload Auto</button>`);
  return actions.join("");
}

function renderWorldCupRuns(index = {}) {
  lastWorldCupRuns = Array.isArray(index.runs) ? index.runs : [];
  if (!elements.worldCupRunGrid) {
    return;
  }
  if (!lastWorldCupRuns.length) {
    elements.worldCupRunGrid.innerHTML = `
      <p class="empty-memory">No World Cup runs yet. Generate a prediction, post-match, or pre-tournament short to start the desk.</p>
    `;
    return;
  }

  elements.worldCupRunGrid.innerHTML = lastWorldCupRuns
    .map((run) => {
      const teams = [run.match?.teamA, run.match?.teamB].filter(Boolean).join(" vs ");
      const label = teams || run.topic || "World Cup topic";
      const warnings = (run.warnings || []).length
        ? `<div class="worldcup-warning-list">${run.warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join("")}</div>`
        : "";
      const viralBadge =
        run.strategy === "viral2"
          ? `<span>Viral ${Number(run.viralScore || 0).toFixed(0)}${run.viralTopicScore ? ` / topic ${Number(run.viralTopicScore || 0).toFixed(0)}` : ""}${run.viralDecision ? ` | ${escapeHtml(run.viralDecision)}` : ""}</span>`
          : `<span>Classic</span>`;
      const mp4Link = run.files?.mp4 || run.r2?.publicUrl ? `<a href="${escapeHtml(worldCupAssetUrl(run, "mp4"))}" target="_blank" rel="noreferrer">MP4</a>` : "";
      const driveLink = run.drive?.folderUrl ? `<a href="${escapeHtml(run.drive.folderUrl)}" target="_blank" rel="noreferrer">Drive folder</a>` : "";
      const telegramBadge = run.telegram?.uploadedAt ? `<span>Telegram sent</span>` : "";
      const sidecarLinks = [
        driveLink,
        telegramBadge,
        run.files?.srt ? `<a href="${escapeHtml(worldCupAssetUrl(run, "srt"))}" target="_blank" rel="noreferrer">SRT</a>` : "",
        run.files?.script ? `<a href="${escapeHtml(worldCupAssetUrl(run, "script"))}" target="_blank" rel="noreferrer">Script</a>` : "",
        run.files?.evidence ? `<a href="${escapeHtml(worldCupAssetUrl(run, "evidence"))}" target="_blank" rel="noreferrer">Evidence</a>` : "",
        run.files?.viralStrategy ? `<a href="${escapeHtml(worldCupAssetUrl(run, "viralStrategy"))}" target="_blank" rel="noreferrer">Viral plan</a>` : "",
        run.files?.quality ? `<a href="${escapeHtml(worldCupAssetUrl(run, "quality"))}" target="_blank" rel="noreferrer">QC</a>` : "",
        run.files?.visuals ? `<a href="${escapeHtml(worldCupAssetUrl(run, "visuals"))}" target="_blank" rel="noreferrer">Visuals</a>` : "",
        run.files?.attribution ? `<a href="${escapeHtml(worldCupAssetUrl(run, "attribution"))}" target="_blank" rel="noreferrer">Attribution</a>` : "",
      ]
        .filter(Boolean)
        .join("");
      return `
        <article class="worldcup-run-card">
          <div class="worldcup-card-head">
            <div>
              <p class="eyebrow">${escapeHtml(run.type || "worldcup")} | ${escapeHtml(run.status || "draft")}</p>
              <h3>${escapeHtml(label)}</h3>
            </div>
            <span>${escapeHtml(run.voice || "voice pending")}</span>
          </div>
          <p>${escapeHtml(run.scriptPreview || "Script preview will appear after generation.")}</p>
          <div class="worldcup-meta-row">
            ${viralBadge}
            <span>${escapeHtml(run.selectedStyle || "style pending")}</span>
            <span>${Number(run.durationSeconds || 0).toFixed(1)}s</span>
            <span>${Number(run.srtSegments || 0)} captions</span>
          </div>
          <div class="worldcup-link-row">${mp4Link}${sidecarLinks}</div>
          ${warnings}
          <div class="worldcup-action-row">${worldCupRunActions(run)}</div>
        </article>
      `;
    })
    .join("");

  for (const button of elements.worldCupRunGrid.querySelectorAll("button[data-worldcup-action]")) {
    button.addEventListener("click", () => {
      const runId = button.dataset.runId;
      const action = button.dataset.worldcupAction;
      if (action === "render") {
        renderWorldCupRunFromUi(runId);
      }
      if (action === "upload") {
        uploadWorldCupRunFromUi(runId, "auto");
      }
      if (action === "telegram") {
        uploadWorldCupRunFromUi(runId, "telegram");
      }
    });
  }
}

async function loadWorldCupRuns() {
  if (!elements.worldCupRunGrid) {
    return;
  }
  try {
    const response = await apiFetch("/api/worldcup/runs");
    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to load World Cup runs.");
    }
    renderWorldCupRuns(result);
  } catch (error) {
    showApiError(error.payload || error, error.message || "Unable to load World Cup runs.");
  }
}

async function generateWorldCupRunFromUi() {
  if (!elements.worldCupGenerateButton) {
    return;
  }
  elements.worldCupGenerateButton.disabled = true;
  elements.worldCupGenerateButton.textContent = elements.worldCupRender.checked ? "Generating + rendering..." : "Generating...";
  if (elements.worldCupStatus) {
    elements.worldCupStatus.textContent = "Collecting evidence, writing three scripts, judging, preparing TTS, captions, and visuals.";
  }
  try {
    const response = await apiFetch("/api/worldcup/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: elements.worldCupMode.value,
        strategy: elements.worldCupStrategy?.value || "classic",
        date: elements.worldCupDate.value,
        teamA: elements.worldCupTeamA.value,
        teamB: elements.worldCupTeamB.value,
        kickoff: elements.worldCupKickoff.value,
        durationSeconds: elements.worldCupDuration.value,
        topic: elements.worldCupTopic.value,
        render: elements.worldCupRender.checked,
        upload: elements.worldCupUpload.checked,
        uploadTarget: "auto",
        offline: elements.worldCupOffline.checked,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to generate World Cup short.");
    }
    setMessage(`World Cup run ready: ${result.topic || result.id}`);
    await loadWorldCupRuns();
  } catch (error) {
    showApiError(error.payload || error, error.message || "Unable to generate World Cup short.");
  } finally {
    elements.worldCupGenerateButton.disabled = false;
    elements.worldCupGenerateButton.textContent = "Generate run";
    updateWorldCupStatus();
  }
}

async function renderWorldCupRunFromUi(runId) {
  setMessage("Rendering World Cup MP4 with captions and audio.");
  try {
    const response = await apiFetch("/api/worldcup/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: runId, burnSubtitles: true }),
    });
    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to render World Cup short.");
    }
    setMessage(`Rendered World Cup MP4: ${result.topic || result.id}`);
    await loadWorldCupRuns();
  } catch (error) {
    showApiError(error.payload || error, error.message || "Unable to render World Cup short.");
  }
}

async function uploadWorldCupRunFromUi(runId, destination = "auto") {
  setMessage(destination === "telegram" ? "Sending World Cup run to Telegram." : "Uploading World Cup run using the configured auto target.");
  try {
    const response = await apiFetch("/api/worldcup/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: runId, destination }),
    });
    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to upload World Cup short.");
    }
    if (result.telegram?.uploadedAt) {
      setMessage("Sent World Cup run to Telegram.");
    } else if (result.drive?.folderUrl) {
      setMessage(`Uploaded to Google Drive: ${result.drive.folderUrl}`);
    } else {
      setMessage("World Cup files uploaded.");
    }
    await loadWorldCupRuns();
  } catch (error) {
    showApiError(error.payload || error, error.message || "Unable to upload World Cup short.");
  }
}

async function buildWorldCupAssetPackFromUi() {
  if (!elements.worldCupAssetPackButton) {
    return;
  }
  const team = elements.worldCupAssetTeam.value.trim() || elements.worldCupTeamA.value.trim() || elements.worldCupTopic.value.trim();
  if (!team) {
    setMessage("Enter a team or topic for the asset pack.", true);
    return;
  }
  elements.worldCupAssetPackButton.disabled = true;
  elements.worldCupAssetPackButton.textContent = "Building...";
  if (elements.worldCupAssetPackStatus) {
    elements.worldCupAssetPackStatus.textContent = "Searching targets, reviewing images, and saving local pack assets.";
  }
  try {
    const response = await apiFetch("/api/worldcup/asset-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team,
        topic: elements.worldCupTopic.value,
        players: elements.worldCupAssetPlayers.value,
        offline: elements.worldCupOffline.checked,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throwApiError(result, "Unable to build World Cup asset pack.");
    }
    const summary = `${result.assets?.length || 0} images saved, ${result.stockCandidates?.length || 0} stock candidates indexed.`;
    if (elements.worldCupAssetPackStatus) {
      elements.worldCupAssetPackStatus.textContent = `Asset pack ready: ${result.team || team}. ${summary}`;
    }
    setMessage(`World Cup asset pack ready: ${result.team || team}`);
  } catch (error) {
    if (elements.worldCupAssetPackStatus) {
      elements.worldCupAssetPackStatus.textContent = "Asset pack failed. Check error details and try a more specific team/player list.";
    }
    showApiError(error.payload || error, error.message || "Unable to build World Cup asset pack.");
  } finally {
    elements.worldCupAssetPackButton.disabled = false;
    elements.worldCupAssetPackButton.textContent = "Build pack";
  }
}

async function generateVoiceDemos() {
  const providerConfig = currentProviderConfig();
  const voices = providerConfig.voices || [];

  if (elements.provider.value !== "gemini") {
    setMessage("Voice demos are currently wired for Gemini voices. Add a working NVIDIA endpoint first for NVIDIA demos.", true);
    return;
  }

  elements.voiceDemosButton.disabled = true;
  elements.voiceDemosButton.textContent = "Generating demos...";
  elements.voiceDemoGrid.innerHTML = voices
    .map((voice) => {
      const id = typeof voice === "string" ? voice : voice.id;
      const label = typeof voice === "string" ? voice : voice.label;
      const trait = typeof voice === "string" ? "" : voice.trait;
      return `
        <article class="voice-demo-card" data-voice="${escapeHtml(id)}">
          <div>
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(trait)}</span>
          </div>
          <p>Queued</p>
        </article>
      `;
    })
    .join("");

  try {
    for (let index = 0; index < voices.length; index += 1) {
      const voice = voices[index];
      const id = typeof voice === "string" ? voice : voice.id;
      const card = elements.voiceDemoGrid.querySelector(`[data-voice="${CSS.escape(id)}"]`);
      const status = card?.querySelector("p");
      if (status) status.textContent = "Generating...";

      if (index > 0 && index % 8 === 0) {
        if (status) status.textContent = "Cooling down for quota...";
        await new Promise((resolve) => setTimeout(resolve, 20000));
      }

      let result = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await apiFetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "gemini",
            text: "नमस्ते, यह मेरी आवाज़ का छोटा सा डेमो है।",
            voice: id,
            voiceMode: "single",
            model: elements.model.value,
            mood: selectedMood,
            style: "",
          }),
        });

        result = await response.json();
        if (response.ok) {
          break;
        }

        const errorText = result.error || `Unable to generate ${id}.`;
        if (attempt === 0 && errorText.toLowerCase().includes("quota")) {
          if (status) status.textContent = "Waiting for quota...";
          await new Promise((resolve) => setTimeout(resolve, 20000));
          continue;
        }

        throwApiError(result, errorText);
      }

      if (card) {
        card.insertAdjacentHTML("beforeend", `<audio controls src="data:${result.mimeType};base64,${result.audioBase64}"></audio>`);
        const latestStatus = card.querySelector("p");
        if (latestStatus) latestStatus.textContent = "Ready";
      }
    }
    setMessage("All Gemini voice demos are ready.");
  } catch (error) {
    showApiError(error.payload || error, error.message || "Unable to generate demos.");
  } finally {
    elements.voiceDemosButton.disabled = false;
    elements.voiceDemosButton.textContent = "Generate demos";
  }
}

function setSettingsMessage(text, isError = false) {
  elements.settingsMessage.textContent = text;
  elements.settingsMessage.classList.toggle("error", isError);
}

function renderKeyList(keyData) {
  config.geminiKeys = keyData;
  elements.keyList.innerHTML = "";

  for (const key of keyData.keys || []) {
    const item = document.createElement("article");
    item.className = "key-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(key.label)}</strong>
        <span>${escapeHtml(key.masked)}${key.active ? " · active" : ""}${key.readOnly ? " · read-only" : ""}</span>
      </div>
      <div class="key-actions">
        <button class="ghost-action-button" type="button" data-action="select" data-key-id="${escapeHtml(key.id)}">Use</button>
        ${
          key.readOnly
            ? ""
            : `<button class="ghost-action-button danger-button" type="button" data-action="delete" data-key-id="${escapeHtml(key.id)}">Delete</button>`
        }
      </div>
    `;
    elements.keyList.append(item);
  }

  for (const button of elements.keyList.querySelectorAll("button[data-action]")) {
    button.addEventListener("click", () => updateKeySettings(button.dataset.action, button.dataset.keyId));
  }

  updateStatus();
}

async function loadKeySettings() {
  const response = await apiFetch("/api/gemini-keys");
  const result = await response.json();
  if (!response.ok) {
    throwApiError(result, "Unable to load Gemini keys.");
  }
  renderKeyList(result);
}

async function updateKeySettings(action, keyId = "") {
  setSettingsMessage("");
  const body = { action, keyId };

  if (action === "save") {
    body.label = elements.keyLabelInput.value.trim();
    body.apiKey = elements.apiKeyInput.value.trim();
  }

  const response = await apiFetch("/api/gemini-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    setSettingsMessage(result.error || "Unable to update key settings.", true);
    return;
  }

  elements.apiKeyInput.value = "";
  elements.keyLabelInput.value = "";
  renderKeyList(result);
  await loadConfig();
  setSettingsMessage(action === "select" ? "Active key switched." : "Gemini key settings saved.");
}

function stockKeyElements(provider) {
  return provider === "pexels"
    ? {
        list: elements.pexelsKeyList,
        label: elements.pexelsKeyLabelInput,
        input: elements.pexelsApiKeyInput,
      }
    : {
        list: elements.pixabayKeyList,
        label: elements.pixabayKeyLabelInput,
        input: elements.pixabayApiKeyInput,
      };
}

function renderStockProviderKeyList(provider, providerData = {}) {
  const refs = stockKeyElements(provider);
  if (!refs.list) {
    return;
  }
  refs.list.innerHTML = "";
  const keys = providerData.keys || [];
  if (!keys.length) {
    refs.list.innerHTML = `<p class="hint">No ${provider} key saved yet.</p>`;
    return;
  }

  for (const key of keys) {
    const item = document.createElement("article");
    item.className = "key-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(key.label)}</strong>
        <span>${escapeHtml(key.masked)}${key.active ? " - active" : ""}${key.readOnly ? " - read-only" : ""}</span>
      </div>
      <div class="key-actions">
        <button class="ghost-action-button" type="button" data-provider="${provider}" data-action="select" data-key-id="${escapeHtml(key.id)}">Use</button>
        ${
          key.readOnly
            ? ""
            : `<button class="ghost-action-button danger-button" type="button" data-provider="${provider}" data-action="delete" data-key-id="${escapeHtml(key.id)}">Delete</button>`
        }
      </div>
    `;
    refs.list.append(item);
  }

  for (const button of refs.list.querySelectorAll("button[data-action]")) {
    button.addEventListener("click", () => updateStockKeySettings(button.dataset.provider, button.dataset.action, button.dataset.keyId));
  }
}

function renderStockKeyLists(stockKeys) {
  config.stockKeys = stockKeys;
  renderStockProviderKeyList("pexels", stockKeys?.pexels || {});
  renderStockProviderKeyList("pixabay", stockKeys?.pixabay || {});
}

async function loadStockKeySettings() {
  const response = await apiFetch("/api/stock-keys");
  const result = await response.json();
  if (!response.ok) {
    throwApiError(result, "Unable to load stock media keys.");
  }
  renderStockKeyLists(result);
}

async function updateStockKeySettings(provider, action, keyId = "") {
  setSettingsMessage("");
  const refs = stockKeyElements(provider);
  const body = { provider, action, keyId };
  if (action === "save") {
    body.label = refs.label.value.trim();
    body.apiKey = refs.input.value.trim();
  }

  const response = await apiFetch("/api/stock-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    setSettingsMessage(result.error || "Unable to update stock media key settings.", true);
    return;
  }

  if (action === "save") {
    refs.label.value = "";
    refs.input.value = "";
  }
  renderStockKeyLists(result);
  await loadConfig();
  setSettingsMessage(action === "select" ? `${provider} key switched.` : `${provider} key settings saved.`);
}

async function openSettings() {
  try {
    await loadKeySettings();
    await loadStockKeySettings();
    setSettingsMessage("");
    elements.settingsModal.showModal();
  } catch (error) {
    showApiError(error.payload || error, error.message || "Unable to open settings.");
  }
}

async function copyAllPrompts() {
  if (!lastStoryboardPrompts.length) {
    setMessage("Generate storyboard prompts first.", true);
    return;
  }

  await navigator.clipboard.writeText(lastStoryboardPrompts.join("\n\n\n"));
  elements.copyAllPromptsButton.textContent = "Copied all";
  setTimeout(() => {
    elements.copyAllPromptsButton.textContent = "Copy all prompts";
  }, 1300);
}

async function copyTimelineJson() {
  if (!lastTimelineJson) {
    setMessage("Generate storyboard prompts first to create timeline JSON.", true);
    return;
  }

  await navigator.clipboard.writeText(lastTimelineJson);
  elements.copyTimelineButton.textContent = "Copied timeline";
  setTimeout(() => {
    elements.copyTimelineButton.textContent = "Copy timeline JSON";
  }, 1300);
}

async function copySrtText() {
  if (!lastSrtText) {
    setMessage("Use audio-aware detailed or SRT-first Director Mode to create subtitle SRT first.", true);
    return;
  }

  await navigator.clipboard.writeText(lastSrtText);
  elements.copySrtButton.textContent = "Copied SRT";
  setTimeout(() => {
    elements.copySrtButton.textContent = "Copy SRT";
  }, 1300);
}

function downloadSrtText() {
  if (!lastSrtText) {
    setMessage("Use audio-aware detailed or SRT-first Director Mode to create subtitle SRT first.", true);
    return;
  }

  const title = safeFilePart(shortTitle(elements.scriptText.value));
  downloadBlob(new Blob([lastSrtText], { type: "application/x-subrip;charset=utf-8" }), `${title || "subtitles"}.srt`);
  setMessage("Subtitle SRT downloaded.");
}

function safeFilePart(value) {
  return (
    String(value || "hindi-voice-project")
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "hindi-voice-project"
  );
}

function base64ToBytes(base64) {
  const binary = atob(String(base64 || "").replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function dataUrlToBytes(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,(.*)$/);
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1],
    bytes: base64ToBytes(match[2]),
  };
}

function crc32(bytes) {
  if (!crc32.table) {
    crc32.table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crc32.table[index] = value >>> 0;
    }
  }

  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crc32.table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const { dosTime, dosDate } = dosDateTime();
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name.replaceAll("\\", "/"));
    const data = file.data instanceof Uint8Array ? file.data : encoder.encode(String(file.data ?? ""));
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endHeader], { type: "application/zip" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function parseJsonOrNull(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function buildExportProject() {
  const title = shortTitle(elements.scriptText.value);
  return {
    schema: "hindi-voice-studio.project.v1",
    exportedAt: new Date().toISOString(),
    title,
    script: elements.scriptText.value,
    voice: {
      provider: elements.provider.value,
      model: elements.model.value,
      modelLabel: elements.model.options[elements.model.selectedIndex]?.textContent || elements.model.value,
      voice: elements.voice.value,
      voiceMode: elements.voiceMode.value,
      speakers: selectedSpeakers(),
      rewriteVoiceChoice: elements.rewriteVoiceChoice.value,
      rewriteMood: elements.rewriteMood.value,
      rewriteStyle: elements.rewriteStyle.value,
      mood: selectedMood,
      customDirection: elements.style.value,
    },
    audio: {
      durationSeconds: lastAudioDuration || 0,
      mimeType: lastAudioMimeType || "",
      hasWav: Boolean(elements.downloadLink.getAttribute("href") || lastAudioBase64),
      hasMp3: Boolean(elements.mp3DownloadLink.getAttribute("href")),
    },
    selectedVoiceVariantId: currentMemoryItem?.selectedVoiceVariantId || "",
    voiceVariants: voiceVariantsForItem(currentMemoryItem).map((variant, index) => ({
      id: variant.id,
      label: variant.label || `Take ${index + 1}`,
      provider: variant.provider,
      model: variant.model,
      modelLabel: variant.modelLabel,
      voice: variant.voice,
      voiceMode: variant.voiceMode,
      mood: variant.mood,
      durationSeconds: variant.audioDuration || 0,
      createdAt: variant.createdAt,
    })),
    storyboardSettings: {
      mode: elements.storyboardMode.value,
      platform: elements.platform.value,
      targetSecondsPerImage: elements.targetSecondsPerImage.value,
      imageMood: selectedImageMood,
      imageStyle: elements.imageStyle.value,
      promptQuality: elements.promptQuality.value,
    },
    scriptStudio: lastScriptStudioResult,
    storyboard: lastStoryboard,
    timeline: parseJsonOrNull(lastTimelineJson),
    stockVideoPlan: lastStockVideoPlan,
    stockVideoTimeline: lastStockVideoTimeline,
    stockSmartCaptions: lastStockSmartCaptions,
    srt: lastSrtText,
    prompts: lastStoryboardPrompts,
  };
}

async function exportPack() {
  const project = buildExportProject();
  const folder = safeFilePart(project.title);
  const files = [
    {
      name: `${folder}/project.json`,
      data: JSON.stringify(project, null, 2),
    },
  ];

  if (lastStoryboardPrompts.length) {
    files.push({
      name: `${folder}/prompts.txt`,
      data: lastStoryboardPrompts.join("\n\n\n"),
    });
  }

  if (lastTimelineJson) {
    files.push({
      name: `${folder}/timeline.json`,
      data: lastTimelineJson,
    });
  }

  if (lastStoryboard?.visualBible) {
    files.push({
      name: `${folder}/visual-bible.json`,
      data: JSON.stringify(lastStoryboard.visualBible, null, 2),
    });
  }

  if (lastStoryboard?.directorSummary) {
    files.push({
      name: `${folder}/director-summary.json`,
      data: JSON.stringify(lastStoryboard.directorSummary, null, 2),
    });
  }

  if (lastSrtText) {
    files.push({
      name: `${folder}/subtitles.srt`,
      data: lastSrtText,
    });
  }

  if (lastStockVideoPlan) {
    files.push({
      name: `${folder}/stock-video-plan.json`,
      data: JSON.stringify(lastStockVideoPlan, null, 2),
    });
    if (Array.isArray(lastStockVideoPlan.attribution) && lastStockVideoPlan.attribution.length) {
      files.push({
        name: `${folder}/stock-attribution.txt`,
        data: lastStockVideoPlan.attribution.join("\n"),
      });
    }
  }

  if (lastStockVideoTimeline) {
    files.push({
      name: `${folder}/stock-video-timeline.json`,
      data: JSON.stringify(lastStockVideoTimeline, null, 2),
    });
  }

  if (lastStockSmartCaptions) {
    files.push({
      name: `${folder}/stock-smart-captions.json`,
      data: JSON.stringify(lastStockSmartCaptions, null, 2),
    });
  }

  const wavHref = elements.downloadLink.getAttribute("href") || (lastAudioBase64 ? `data:${lastAudioMimeType || "audio/wav"};base64,${lastAudioBase64}` : "");
  const wavAudio = dataUrlToBytes(wavHref);
  if (wavAudio) {
    files.push({ name: `${folder}/audio.wav`, data: wavAudio.bytes });
  }

  const mp3Audio = dataUrlToBytes(elements.mp3DownloadLink.getAttribute("href"));
  if (mp3Audio) {
    files.push({ name: `${folder}/audio.mp3`, data: mp3Audio.bytes });
  }

  for (const [index, variant] of voiceVariantsForItem(currentMemoryItem).entries()) {
    const takeName = `voice-takes/take-${String(index + 1).padStart(2, "0")}-${safeFilePart(variant.voice || "voice")}`;
    const wavTake = variant.audioBase64 ? dataUrlToBytes(`data:${variant.audioMimeType || "audio/wav"};base64,${variant.audioBase64}`) : null;
    if (wavTake) {
      files.push({ name: `${folder}/${takeName}.wav`, data: wavTake.bytes });
    }
    const mp3Take = dataUrlToBytes(variant.mp3Base64 ? `data:${variant.mp3MimeType || "audio/mpeg"};base64,${variant.mp3Base64}` : "");
    if (mp3Take) {
      files.push({ name: `${folder}/${takeName}.mp3`, data: mp3Take.bytes });
    }
  }

  const zip = createZip(files);
  downloadBlob(zip, `${folder}-export-pack.zip`);
  setMessage(`Export pack ready: ${files.length} file${files.length === 1 ? "" : "s"} saved in one ZIP.`);
}

function activateTab(button) {
  const action = button.dataset.tabAction;
  if (action === "settings") {
    openSettings();
    return;
  }

  const targetId = button.dataset.tabTarget;
  if (!targetId) {
    return;
  }

  for (const panel of document.querySelectorAll("[data-tab-panel]")) {
    const active = panel.id === targetId;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  }

  for (const tabButton of document.querySelectorAll(".tab-button")) {
    tabButton.classList.toggle("is-active", tabButton === button);
  }

  updateWorkflowStrip(targetId);

  if (action === "rewrite") {
    elements.provider.value = "gemini";
    refreshProviderControls();
    elements.voiceMode.value = "rewrite";
    updateVoiceModeUi();
    elements.rewriteStyle.focus();
  }
}

function updateWorkflowStrip(targetId) {
  for (const step of document.querySelectorAll("[data-workflow-step]")) {
    step.classList.toggle("is-live", step.dataset.workflowStep === targetId);
  }
}

elements.provider.addEventListener("change", refreshProviderControls);
elements.scriptTemplate.addEventListener("change", applyScriptTemplateDefaults);
elements.cartoonModeButton.addEventListener("click", applyCartoonModeDefaults);
elements.voiceMode.addEventListener("change", updateVoiceModeUi);
elements.rewriteVoiceChoice.addEventListener("change", updateVoiceModeUi);
elements.scriptVoice.addEventListener("change", () => {
  setSelectValue(elements.voice, elements.scriptVoice.value);
});
elements.model.addEventListener("change", updateModelHint);
elements.storyboardMode.addEventListener("change", updateStoryboardModeHint);
elements.targetSecondsPerImage.addEventListener("change", updateStoryboardModeHint);
elements.scriptText.addEventListener("input", updateCharCount);
elements.clearButton.addEventListener("click", () => {
  elements.scriptText.value = "";
  currentMemoryId = "";
  currentMemoryItem = null;
  renderActiveVoiceVariants();
  updateCharCount();
  elements.scriptText.focus();
});
elements.generateButton.addEventListener("click", generateVoice);
elements.rewriteButton.addEventListener("click", () => rewriteScriptToDialogue());
elements.storyboardButton.addEventListener("click", generateStoryboard);
elements.stockTimelineButton.addEventListener("click", () => generateStockVideoTimeline());
elements.stockSmartCaptionButton.addEventListener("click", designStockSmartCaptions);
elements.stockPlanButton.addEventListener("click", generateStockVideoPlan);
elements.stockRenderButton.addEventListener("click", renderStockVideo);
elements.stockSmartCaptions.addEventListener("change", () => {
  if (elements.stockSmartCaptions.checked && !lastStockSmartCaptions) {
    elements.stockSmartCaptions.checked = false;
    setMessage("Design Smart captions first, then enable this option.", true);
  }
});
for (const captionControl of [elements.stockCaptionStyle, elements.stockCaptionMood]) {
  captionControl.addEventListener("change", () => {
    lastStockSmartCaptions = null;
    elements.stockSmartCaptions.checked = false;
    elements.stockCaptionSummary.textContent = "Caption settings changed. Design Smart captions again, or render with normal animated captions.";
  });
}
elements.copyAllPromptsButton.addEventListener("click", copyAllPrompts);
elements.copyTimelineButton.addEventListener("click", copyTimelineJson);
elements.copySrtButton.addEventListener("click", copySrtText);
elements.downloadSrtButton.addEventListener("click", downloadSrtText);
elements.exportPackButton.addEventListener("click", exportPack);
elements.scriptGenerateButton.addEventListener("click", generateScriptStudio);
elements.scriptUseButton.addEventListener("click", useScriptStudioScript);
elements.scriptCopyButton.addEventListener("click", copyScriptStudioScript);
elements.worldCupGenerateButton.addEventListener("click", generateWorldCupRunFromUi);
elements.worldCupRefreshButton.addEventListener("click", loadWorldCupRuns);
elements.worldCupAssetPackButton?.addEventListener("click", buildWorldCupAssetPackFromUi);
elements.voiceDemosButton.addEventListener("click", generateVoiceDemos);
elements.clearMemoryButton.addEventListener("click", async () => {
  await clearMemoryItems();
  currentMemoryId = "";
  currentMemoryItem = null;
  await renderMemory();
  renderActiveVoiceVariants();
  setMessage("Local memory cleared.");
});
elements.settingsButton.addEventListener("click", openSettings);
elements.closeSettingsButton.addEventListener("click", () => elements.settingsModal.close());
elements.saveKeyButton.addEventListener("click", () => updateKeySettings("save"));
elements.savePexelsKeyButton.addEventListener("click", () => updateStockKeySettings("pexels", "save"));
elements.savePixabayKeyButton.addEventListener("click", () => updateStockKeySettings("pixabay", "save"));
for (const button of document.querySelectorAll(".tab-button")) {
  button.addEventListener("click", () => activateTab(button));
}

updateCharCount();
if (elements.worldCupDate && !elements.worldCupDate.value) {
  elements.worldCupDate.value = new Date().toISOString().slice(0, 10);
}
updateWorkflowStrip("scriptStudioPane");
updateStoryboardModeHint();
loadConfig();
renderMemory();
renderActiveVoiceVariants();
