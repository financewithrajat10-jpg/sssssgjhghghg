import { createHash, createHmac, createSign, fileExists, fs, path } from "./utils.mjs";
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
  WORLD_CUP_V2_TELEGRAM_SEND_FAILED_MP4,
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

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function hmac(key, data, encoding) {
  return createHmac("sha256", key).update(data).digest(encoding);
}

export function amzDates(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

export function encodeS3Path(key) {
  return String(key || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export async function uploadR2Object({ key, body, contentType }) {
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

export function publicR2Url(key) {
  const base = String(process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  return base ? `${base}/${encodeS3Path(key)}` : "";
}

export function r2BasePrefix(run) {
  const date = cleanText(run.match?.date || run.createdAt?.slice(0, 10) || todayDate());
  const matchSlug =
    run.match?.teamA && run.match?.teamB
      ? `${slugify(run.match.teamA)}-vs-${slugify(run.match.teamB)}`
      : slugify(run.topic, "world-cup-topic");
  return `worldcup/${date}/${matchSlug}`;
}

export function googleDriveFolderUrl(folderId) {
  return folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : "";
}

export function normalizeGoogleDriveId(value) {
  const raw = cleanText(value);
  if (!raw) {
    return "";
  }
  const patterns = [
    /\/folders\/([^/?#]+)/i,
    /\/file\/d\/([^/?#]+)/i,
    /[?&]id=([^&#]+)/i,
    /^([a-zA-Z0-9_-]{10,})$/,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return raw;
}

export function base64Url(data) {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function parseGoogleServiceAccount() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "";
  const rawBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64 || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64 || "";
  const rawJsonText = String(rawJson || "").trim();
  if (rawJsonText) {
    if (rawJsonText.startsWith("{")) {
      return JSON.parse(rawJsonText);
    }
    const fromPrivateKey = buildGoogleServiceAccountFromParts(rawJsonText);
    if (fromPrivateKey) {
      return fromPrivateKey;
    }
    return JSON.parse(rawJsonText);
  }
  const rawBase64Text = String(rawBase64 || "").trim();
  if (rawBase64Text) {
    return JSON.parse(Buffer.from(rawBase64Text, "base64").toString("utf8"));
  }
  return buildGoogleServiceAccountFromParts();
}

export function buildGoogleServiceAccountFromParts(privateKeyOverride = "") {
  const privateKey = String(
    privateKeyOverride ||
      process.env.GOOGLE_PRIVATE_KEY ||
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
      process.env.GOOGLE_DRIVE_PRIVATE_KEY ||
      "",
  ).trim();
  const clientEmail = cleanText(
    process.env.GOOGLE_CLIENT_EMAIL ||
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      process.env.GOOGLE_DRIVE_CLIENT_EMAIL ||
      process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL ||
      "",
  );
  if (!privateKey || !clientEmail) {
    return null;
  }
  return {
    type: "service_account",
    project_id: cleanText(process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID || ""),
    private_key_id: cleanText(process.env.GOOGLE_PRIVATE_KEY_ID || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID || ""),
    private_key: privateKey.replace(/\\n/g, "\n"),
    client_email: clientEmail,
    client_id: cleanText(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID || ""),
    token_uri: cleanText(process.env.GOOGLE_TOKEN_URI || process.env.GOOGLE_SERVICE_ACCOUNT_TOKEN_URI || "https://oauth2.googleapis.com/token"),
  };
}

export function googleDriveSetupHint() {
  let serviceAccountEmail = "the service account client_email";
  try {
    serviceAccountEmail = parseGoogleServiceAccount()?.client_email || serviceAccountEmail;
  } catch {
    // Keep the hint useful even when the secret JSON is malformed.
  }
  return `Share the target GOOGLE_DRIVE_FOLDER_ID folder with ${serviceAccountEmail} as Editor, or use upload target telegram. Workspace domain-wide delegation is only needed when impersonating a Workspace user's Drive.`;
}

export function hasGoogleDriveCredentials() {
  try {
    const credentials = parseGoogleServiceAccount();
    return Boolean(credentials?.client_email && credentials?.private_key);
  } catch {
    return false;
  }
}

export let cachedGoogleDriveToken = null;

export async function getGoogleDriveAccessToken() {
  let credentials = null;
  try {
    credentials = parseGoogleServiceAccount();
  } catch (error) {
    throw new WorldCupError("Google Drive service account credentials are not valid JSON.", {
      status: 400,
      code: "INVALID_GOOGLE_SERVICE_ACCOUNT_JSON",
      details: {
        error: error.message,
        setupHint: "GOOGLE_SERVICE_ACCOUNT_JSON must be the full service account JSON object, not only the private_key field. GOOGLE_SERVICE_ACCOUNT_BASE64 can contain the base64-encoded full JSON file.",
      },
    });
  }
  if (!credentials?.client_email || !credentials?.private_key) {
    throw new WorldCupError("Missing Google Drive service account JSON credentials.", {
      status: 400,
      code: "MISSING_GOOGLE_DRIVE_CREDENTIALS",
      details: {
        setupHint: "The Drive secret needs at least client_email and private_key from the full Google service account JSON file.",
      },
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
      scope: GOOGLE_DRIVE_SCOPE,
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

export function driveQueryValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function driveRequest(pathname, { method = "GET", query = {}, headers = {}, body = null, contentType = "application/json" } = {}) {
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
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new WorldCupError(`Google Drive request failed with HTTP ${response.status}.`, {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      code: "GOOGLE_DRIVE_REQUEST_FAILED",
      details: { response: data || text, setupHint: googleDriveSetupHint() },
    });
  }
  return data;
}

export async function getOrCreateDriveFolder(name, parentId) {
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

export async function assertGoogleDriveRootFolder(folderId) {
  const safeFolderId = normalizeGoogleDriveId(folderId);
  if (!safeFolderId) {
    throw new WorldCupError("Missing GOOGLE_DRIVE_FOLDER_ID for World Cup Google Drive uploads.", {
      status: 400,
      code: "MISSING_GOOGLE_DRIVE_FOLDER_ID",
      details: { setupHint: googleDriveSetupHint() },
    });
  }
  const folder = await driveRequest(`/drive/v3/files/${encodeURIComponent(safeFolderId)}`, {
    query: {
      fields: "id,name,mimeType,webViewLink",
      supportsAllDrives: "true",
    },
  });
  if (folder.mimeType !== "application/vnd.google-apps.folder") {
    throw new WorldCupError("GOOGLE_DRIVE_FOLDER_ID points to a Drive file, not a folder.", {
      status: 400,
      code: "GOOGLE_DRIVE_ROOT_NOT_FOLDER",
      details: {
        id: folder.id,
        name: folder.name,
        mimeType: folder.mimeType,
        setupHint: "Use the ID from a Google Drive folder URL like https://drive.google.com/drive/folders/<folder-id>, then share that folder with the service account as Editor.",
      },
    });
  }
  return folder;
}

export async function uploadGoogleDriveFile({ folderId, name, body, contentType }) {
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
      details: { response: data, setupHint: googleDriveSetupHint() },
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
      details: { response: data, setupHint: googleDriveSetupHint() },
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

export function driveBaseParts(run) {
  const date = cleanText(run.match?.date || run.createdAt?.slice(0, 10) || todayDate());
  const matchSlug =
    run.match?.teamA && run.match?.teamB
      ? `${slugify(run.match.teamA)}-vs-${slugify(run.match.teamB)}`
      : slugify(run.topic, "world-cup-topic");
  return { date, matchSlug };
}

export function hasR2Credentials() {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}

export function telegramConfig() {
  return {
    botToken: cleanText(process.env.TELEGRAM_BOT_TOKEN || process.env.WORLD_CUP_TELEGRAM_BOT_TOKEN || ""),
    chatId: cleanText(process.env.TELEGRAM_CHAT_ID || process.env.WORLD_CUP_TELEGRAM_CHAT_ID || ""),
    threadId: cleanText(process.env.TELEGRAM_THREAD_ID || process.env.WORLD_CUP_TELEGRAM_THREAD_ID || ""),
  };
}

export function hasTelegramCredentials() {
  const config = telegramConfig();
  return Boolean(config.botToken && config.chatId);
}

export async function assertWorldCupMp4Ready(run) {
  const runDir = path.join(runsRoot, run.id);
  const mp4Path = run.files?.mp4 ? path.join(runDir, run.files.mp4) : "";
  if (!mp4Path || !(await fileExists(mp4Path))) {
    throw new WorldCupError("World Cup upload requires a rendered MP4, but no MP4 file exists.", {
      status: 422,
      code: "WORLD_CUP_UPLOAD_MISSING_MP4",
      details: { runId: run.id, status: run.status, file: run.files?.mp4 || "" },
    });
  }
  const stat = await fs.stat(mp4Path);
  if (!stat.size) {
    throw new WorldCupError("World Cup upload requires a non-empty MP4 file.", {
      status: 422,
      code: "WORLD_CUP_UPLOAD_EMPTY_MP4",
      details: { runId: run.id, file: run.files.mp4 },
    });
  }
  return mp4Path;
}

export function telegramMessageSummary(result, type, label) {
  return {
    type,
    label,
    messageId: result?.message_id || 0,
    date: result?.date || 0,
    chatId: result?.chat?.id || "",
  };
}

export function worldCupTelegramCaption(run, suffix = "") {
  const topic = cleanText(run.topic || run.selectedScript?.title || run.match?.title || "World Cup short");
  const teams = [run.match?.teamA, run.match?.teamB].filter(Boolean).join(" vs ");
  const score = Number(run.qualityV2?.finalScore || run.postRenderQuality?.score || run.selectedScript?.viralQuality?.total || run.viralStrategy?.topicScore?.total || 0);
  const qualityDecision = cleanText(run.qualityV2?.finalDecision || run.postRenderQuality?.decision || "");
  const qualityIssues = Array.isArray(run.qualityV2?.issues) ? run.qualityV2.issues.map(cleanText).filter(Boolean).slice(0, 2) : [];
  const lines = [
    "World Cup Chaos Desk",
    teams || topic,
    `Type: ${run.type || "short"} | Strategy: ${run.strategy || "classic"}${score ? ` | Score: ${score.toFixed(0)}/100` : ""}`,
    qualityDecision ? `V2 QC: ${qualityDecision}${qualityDecision !== "publish_candidate" ? " | REVIEW COPY" : ""}` : "",
    qualityIssues.length ? `Issues: ${qualityIssues.join(" | ")}` : "",
    run.tts?.voice ? `Voice: ${run.tts.voice}` : "",
    suffix,
  ].filter(Boolean);
  return lines.join("\n").slice(0, 1000);
}

export async function telegramRequest(method, fields = {}, file = null) {
  const config = telegramConfig();
  if (!config.botToken || !config.chatId) {
    throw new WorldCupError("Missing Telegram bot upload credentials.", {
      status: 400,
      code: "MISSING_TELEGRAM_CONFIG",
      details: { required: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] },
    });
  }
  const form = new FormData();
  form.set("chat_id", config.chatId);
  if (config.threadId) {
    form.set("message_thread_id", config.threadId);
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== "") {
      form.set(key, String(value));
    }
  }
  if (file?.path) {
    const payload = await fs.readFile(file.path);
    form.set(file.field, new Blob([payload], { type: file.contentType || "application/octet-stream" }), file.name || path.basename(file.path));
  }
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/${method}`, {
    method: "POST",
    body: form,
  });
  const text = await response.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok || data.ok === false) {
    throw new WorldCupError(`Telegram ${method} failed with HTTP ${response.status}.`, {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      code: "TELEGRAM_UPLOAD_FAILED",
      details: data,
    });
  }
  return data.result || data;
}

export async function sendWorldCupTelegramAlert(runOrId, text, label = "quality-alert") {
  const run = typeof runOrId === "string" ? await readWorldCupRun(runOrId) : runOrId;
  const message = String(text || "").trim().slice(0, 3900);
  const result = await telegramRequest("sendMessage", { text: message || `World Cup alert for ${run.id}` });
  run.telegram = run.telegram || { uploadedAt: "", messages: [] };
  run.telegram.uploadedAt = nowIso();
  run.telegram.chatId = telegramConfig().chatId;
  run.telegram.threadId = telegramConfig().threadId;
  run.telegram.messages = [...(run.telegram.messages || []), telegramMessageSummary(result, "message", label)];
  run.files = run.files || {};
  run.files.telegram = await writeRunFile(run, "telegram.json", `${JSON.stringify(run.telegram, null, 2)}\n`, "utf8");
  return await saveRun(run);
}

export async function uploadWorldCupRunToTelegram(id, options = {}) {
  const run = await readWorldCupRun(id);
  const runDir = path.join(runsRoot, run.id);
  const sentSidecars = normalizeBool(options.sendSidecars ?? WORLD_CUP_TELEGRAM_SEND_SIDECARS, WORLD_CUP_TELEGRAM_SEND_SIDECARS);
  const requireMp4 = normalizeBool(options.requireMp4 ?? options.requireVideo, false);
  const allowV2FailedMp4 =
    normalizeBool(options.allowNeedsReviewUpload ?? options.allowReviewUpload, false) ||
    normalizeBool(options.telegramSendFailedMp4 ?? options.v2TelegramSendFailedMp4, WORLD_CUP_V2_TELEGRAM_SEND_FAILED_MP4);
  if ((run.qualityMode === "v2" || run.qualityV2?.mode === "v2") && run.qualityV2?.finalDecision !== "publish_candidate" && run.files?.mp4 && !allowV2FailedMp4) {
    throw new WorldCupError("Telegram MP4 upload blocked because V2 quality did not approve this run.", {
      status: 422,
      code: "WORLD_CUP_V2_UPLOAD_BLOCKED",
      details: {
        runId: run.id,
        status: run.status,
        finalDecision: run.qualityV2?.finalDecision || "",
        issues: run.qualityV2?.issues || [],
      },
    });
  }
  if (requireMp4) {
    await assertWorldCupMp4Ready(run);
  }
  const messages = [];
  const config = telegramConfig();

  if (run.files.mp4) {
    const mp4Path = path.join(runDir, run.files.mp4);
    if (await fileExists(mp4Path)) {
      try {
        const videoMessage = await telegramRequest(
          "sendVideo",
          { caption: worldCupTelegramCaption(run), supports_streaming: "true" },
          { field: "video", path: mp4Path, name: `${run.id}.mp4`, contentType: "video/mp4" },
        );
        messages.push(telegramMessageSummary(videoMessage, "video", "mp4"));
      } catch (error) {
        run.warnings = run.warnings || [];
        run.warnings.push(`Telegram sendVideo failed, retrying as document: ${error.message}`);
        const documentMessage = await telegramRequest(
          "sendDocument",
          { caption: worldCupTelegramCaption(run, "Video sent as a document fallback.") },
          { field: "document", path: mp4Path, name: `${run.id}.mp4`, contentType: "video/mp4" },
        );
        messages.push(telegramMessageSummary(documentMessage, "document", "mp4"));
      }
    }
  }

  const sidecars = [
    ["srt", "srt.srt", run.files.srt, "application/x-subrip; charset=utf-8"],
    ["script", "script.json", run.files.script, "application/json; charset=utf-8"],
    ["quality", "quality.json", run.files.quality, "application/json; charset=utf-8"],
    ["quality-v2", "quality-v2.json", run.files.qualityV2, "application/json; charset=utf-8"],
    ["storyboard", "storyboard.json", run.files.storyboard, "application/json; charset=utf-8"],
    ["retry-log", "retry-log.json", run.files.retryLog, "application/json; charset=utf-8"],
    ["evidence", "evidence.json", run.files.evidence, "application/json; charset=utf-8"],
  ];
  if (sentSidecars) {
    for (const [type, targetName, fileName, contentType] of sidecars) {
      if (!fileName) {
        continue;
      }
      const localPath = path.join(runDir, fileName);
      if (!(await fileExists(localPath))) {
        continue;
      }
      const result = await telegramRequest(
        "sendDocument",
        { caption: `${targetName} for ${run.id}`.slice(0, 1000) },
        { field: "document", path: localPath, name: targetName, contentType },
      );
      messages.push(telegramMessageSummary(result, "document", type));
    }
  }

  if (!messages.length) {
    if (requireMp4) {
      throw new WorldCupError("Telegram upload did not send the required World Cup MP4.", {
        status: 502,
        code: "TELEGRAM_REQUIRED_MP4_NOT_SENT",
        details: { runId: run.id, file: run.files?.mp4 || "" },
      });
    }
    const result = await telegramRequest("sendMessage", { text: `${worldCupTelegramCaption(run)}\nNo MP4 or sidecar files were available to send.` });
    messages.push(telegramMessageSummary(result, "message", "empty-run"));
  }

  if (requireMp4 && !messages.some((message) => message.label === "mp4")) {
    throw new WorldCupError("Telegram upload completed without sending the required MP4.", {
      status: 502,
      code: "TELEGRAM_REQUIRED_MP4_NOT_SENT",
      details: { runId: run.id, messages },
    });
  }

  run.telegram = {
    uploadedAt: nowIso(),
    chatId: config.chatId,
    threadId: config.threadId,
    sentSidecars,
    messages,
  };
  run.files.telegram = await writeRunFile(run, "telegram.json", `${JSON.stringify(run.telegram, null, 2)}\n`, "utf8");
  run.status = run.files.mp4 ? "sent_telegram" : "sidecars_sent_telegram";
  return await saveRun(run);
}

export async function appendWorldCupUploadWarning(id, warning) {
  try {
    const run = await readWorldCupRun(id);
    run.warnings = Array.from(new Set([...(run.warnings || []), cleanText(warning)].filter(Boolean)));
    await saveRun(run);
  } catch {
    // Upload fallback warnings should never hide the original upload error.
  }
}

export function isTelegramOversizeError(error) {
  const status = Number(error?.status || error?.details?.error_code || 0);
  const code = cleanText(error?.code);
  const description = cleanText(error?.details?.description || error?.message);
  return code === "TELEGRAM_UPLOAD_FAILED" && status === 413 || /request entity too large|payload too large|file is too big/i.test(description);
}

async function uploadWorldCupRunAfterTelegramOversize(id, options = {}, originalError = null) {
  const warning = `Telegram rejected MP4 as too large${originalError?.message ? `: ${originalError.message}` : "."}`;
  if (hasGoogleDriveCredentials() && (process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.WORLD_CUP_GOOGLE_DRIVE_FOLDER_ID)) {
    await appendWorldCupUploadWarning(id, `${warning} Falling back to Google Drive.`);
    const uploaded = await uploadWorldCupRunToDrive(id);
    await sendWorldCupTelegramAlert(
      uploaded,
      `${worldCupTelegramCaption(uploaded)}\nTelegram rejected the MP4 as too large, so it was uploaded to Google Drive instead:\n${uploaded.drive?.folderUrl || ""}`.trim(),
      "telegram-oversize-drive-fallback",
    ).catch((error) => appendWorldCupUploadWarning(id, `Telegram Drive fallback notice failed: ${error.message}`));
    return uploaded;
  }
  if (hasR2Credentials()) {
    await appendWorldCupUploadWarning(id, `${warning} Falling back to R2.`);
    const uploaded = await uploadWorldCupRunToR2(id);
    await sendWorldCupTelegramAlert(
      uploaded,
      `${worldCupTelegramCaption(uploaded)}\nTelegram rejected the MP4 as too large, so it was uploaded to R2 instead:\n${uploaded.r2?.publicUrl || ""}`.trim(),
      "telegram-oversize-r2-fallback",
    ).catch((error) => appendWorldCupUploadWarning(id, `Telegram R2 fallback notice failed: ${error.message}`));
    return uploaded;
  }
  throw originalError;
}

export async function uploadWorldCupRunToR2(id) {
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
    ["quality-v2.json", run.files.qualityV2, "application/json; charset=utf-8"],
    ["storyboard.json", run.files.storyboard, "application/json; charset=utf-8"],
    ["retry-log.json", run.files.retryLog, "application/json; charset=utf-8"],
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

export async function uploadWorldCupRunToDrive(id) {
  const run = await readWorldCupRun(id);
  const rootFolderId = normalizeGoogleDriveId(process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.WORLD_CUP_GOOGLE_DRIVE_FOLDER_ID || "");
  if (!rootFolderId) {
    throw new WorldCupError("Missing GOOGLE_DRIVE_FOLDER_ID for World Cup Google Drive uploads.", {
      status: 400,
      code: "MISSING_GOOGLE_DRIVE_FOLDER_ID",
      details: { setupHint: googleDriveSetupHint() },
    });
  }

  const runDir = path.join(runsRoot, run.id);
  const { date, matchSlug } = driveBaseParts(run);
  const rootFolder = await assertGoogleDriveRootFolder(rootFolderId);
  const worldcupFolder = await getOrCreateDriveFolder("worldcup", rootFolder.id);
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
    ["quality-v2.json", run.files.qualityV2, "application/json; charset=utf-8"],
    ["storyboard.json", run.files.storyboard, "application/json; charset=utf-8"],
    ["retry-log.json", run.files.retryLog, "application/json; charset=utf-8"],
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
    rootFolderId: rootFolder.id,
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
  const destination = String(options.destination || options.uploadTarget || DEFAULT_UPLOAD_TARGET || "auto").toLowerCase();
  if (normalizeBool(options.requireMp4 ?? options.requireVideo, false)) {
    await assertWorldCupMp4Ready(await readWorldCupRun(id));
  }
  if (destination === "telegram" || destination === "tg" || destination === "telegram-bot") {
    try {
      return await uploadWorldCupRunToTelegram(id, options);
    } catch (error) {
      if (isTelegramOversizeError(error)) {
        return await uploadWorldCupRunAfterTelegramOversize(id, options, error);
      }
      throw error;
    }
  }
  if (destination === "r2" || destination === "cloudflare-r2") {
    return await uploadWorldCupRunToR2(id);
  }
  if (destination === "auto") {
    const attempts = [];
    if (hasTelegramCredentials()) {
      attempts.push(["telegram", () => uploadWorldCupRunToTelegram(id, options)]);
    }
    if (hasGoogleDriveCredentials() && (process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.WORLD_CUP_GOOGLE_DRIVE_FOLDER_ID)) {
      attempts.push(["google-drive", () => uploadWorldCupRunToDrive(id)]);
    }
    if (hasR2Credentials()) {
      attempts.push(["r2", () => uploadWorldCupRunToR2(id)]);
    }
    if (!attempts.length) {
      throw new WorldCupError("No World Cup upload target is configured.", {
        status: 400,
        code: "NO_UPLOAD_TARGET_CONFIGURED",
        details: {
          supported: ["telegram", "google-drive", "r2"],
          telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
          googleDrive: ["GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_BASE64", "GOOGLE_DRIVE_FOLDER_ID"],
          r2: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"],
        },
      });
    }
    let lastError = null;
    for (const [target, uploader] of attempts) {
      try {
        return await uploader();
      } catch (error) {
        lastError = error;
        await appendWorldCupUploadWarning(id, `Upload target ${target} failed: ${error.message}`);
      }
    }
    throw lastError;
  }
  if (destination === "google-drive" || destination === "drive" || destination === "gdrive") {
    try {
      return await uploadWorldCupRunToDrive(id);
    } catch (error) {
      if (WORLD_CUP_DRIVE_FALLBACK_TELEGRAM && hasTelegramCredentials()) {
        await appendWorldCupUploadWarning(id, `Google Drive upload failed, falling back to Telegram: ${error.message}`);
        return await uploadWorldCupRunToTelegram(id, options);
      }
      throw error;
    }
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
