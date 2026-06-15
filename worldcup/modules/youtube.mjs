import {
  fileExists,
  fs,
  path,
  cleanText,
  getActiveGeminiKey,
  normalizeBool,
  normalizeWorldCupYouTubePrivacy,
  nowIso,
  recordApiUsage,
  repairCommonMojibake,
  requestGeminiJsonWithFallbacks,
  runsRoot,
  slugify,
  sleep,
  WorldCupError,
  WORLD_CUP_YOUTUBE_MAX_PER_DAY,
  WORLD_CUP_YOUTUBE_METADATA_MODEL,
  WORLD_CUP_YOUTUBE_NOTIFY_SUBSCRIBERS,
  WORLD_CUP_YOUTUBE_PRIVACY,
} from "./utils.mjs";
import { listWorldCupRuns, readWorldCupRun, saveRun, writeRunFile } from "./memory.mjs";

const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const YOUTUBE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_WATCH_BASE_URL = "https://www.youtube.com/watch?v=";
const TITLE_LIMIT = 95;
const DESCRIPTION_LIMIT = 1800;
const TAG_TOTAL_LIMIT = 450;
const YOUTUBE_METADATA_RETRY_DELAYS_MS = [5000, 10000, 15000];

export function youtubeCredentials(env = process.env) {
  return {
    clientId: cleanText(env.YOUTUBE_CLIENT_ID || env.WORLD_CUP_YOUTUBE_CLIENT_ID || ""),
    clientSecret: cleanText(env.YOUTUBE_CLIENT_SECRET || env.WORLD_CUP_YOUTUBE_CLIENT_SECRET || ""),
    refreshToken: cleanText(env.YOUTUBE_REFRESH_TOKEN || env.WORLD_CUP_YOUTUBE_REFRESH_TOKEN || ""),
  };
}

export function hasYouTubeCredentials(env = process.env) {
  const credentials = youtubeCredentials(env);
  return Boolean(credentials.clientId && credentials.clientSecret && credentials.refreshToken);
}

export function buildYouTubeTokenRequestBody(credentials) {
  const body = new URLSearchParams();
  body.set("client_id", credentials.clientId);
  body.set("client_secret", credentials.clientSecret);
  body.set("refresh_token", credentials.refreshToken);
  body.set("grant_type", "refresh_token");
  return body;
}

let cachedYouTubeAccessToken = null;

export async function getYouTubeAccessToken(credentials = youtubeCredentials()) {
  if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
    throw new WorldCupError("Missing YouTube OAuth upload credentials.", {
      status: 400,
      code: "MISSING_YOUTUBE_CREDENTIALS",
      details: { required: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"] },
    });
  }
  if (cachedYouTubeAccessToken && cachedYouTubeAccessToken.expiresAt > Date.now() + 60000) {
    return cachedYouTubeAccessToken.accessToken;
  }
  const response = await fetch(YOUTUBE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildYouTubeTokenRequestBody(credentials),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    recordApiUsage({ provider: "youtube", operation: "oauth.refresh", status: "failed", details: { status: response.status } });
    throw new WorldCupError(`YouTube OAuth refresh failed with HTTP ${response.status}.`, {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      code: "YOUTUBE_OAUTH_REFRESH_FAILED",
      details: data,
    });
  }
  recordApiUsage({ provider: "youtube", operation: "oauth.refresh", status: "success" });
  cachedYouTubeAccessToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000,
  };
  return cachedYouTubeAccessToken.accessToken;
}

export function hasMetadataArtifact(value) {
  return /(?:Ã|Â|â€|�|return json|evidence pack|sourcedclaims|source url|sourceurl)/i.test(String(value || ""));
}

function cleanMetadataText(value) {
  return repairCommonMojibake(value)
    .replace(/\u00c3\u00a9/g, "e")
    .replace(/\u00c3\u00a8/g, "e")
    .replace(/\u00c3\u00a1/g, "a")
    .replace(/\u00c3\u00ad/g, "i")
    .replace(/\u00c3\u00b3/g, "o")
    .replace(/\u00c3\u00ba/g, "u")
    .replace(/\u00c3\u00b1/g, "n")
    .replace(/\u00c3\u00a7/g, "c")
    .replace(/\s+/g, " ")
    .replace(/[`*_~]+/g, "")
    .trim();
}

function truncateText(value, limit) {
  const text = cleanMetadataText(value);
  if (text.length <= limit) {
    return text;
  }
  const clipped = text.slice(0, Math.max(0, limit - 1)).replace(/\s+\S*$/, "").trim();
  return clipped || text.slice(0, limit).trim();
}

function normalizeHashtag(value) {
  const cleaned = cleanMetadataText(value)
    .replace(/^#+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 40);
  return cleaned ? `#${cleaned}` : "";
}

function uniqueCleanList(values, limit) {
  const list = [];
  for (const value of Array.isArray(values) ? values : []) {
    const cleaned = cleanMetadataText(value);
    if (cleaned && !list.some((item) => item.toLowerCase() === cleaned.toLowerCase())) {
      list.push(cleaned);
    }
    if (list.length >= limit) {
      break;
    }
  }
  return list;
}

function entityTags(run = {}) {
  const rows = [
    run.match?.teamA,
    run.match?.teamB,
    ...(Array.isArray(run.evidence?.keyPlayers) ? run.evidence.keyPlayers.map((player) => player.name) : []),
  ];
  return uniqueCleanList(rows, 8);
}

export function inferContainsSyntheticMedia(run = {}, candidate = {}) {
  if (candidate.containsSyntheticMedia === true || candidate.containsSyntheticMedia === false) {
    return {
      value: Boolean(candidate.containsSyntheticMedia),
      rationale: cleanMetadataText(candidate.rationale?.syntheticMedia || candidate.syntheticMediaRationale || ""),
    };
  }
  const haystack = [
    run.selectedScript?.text,
    run.tts?.screenplay,
    run.visualPlan?.directorSummary,
    ...(run.warnings || []),
  ]
    .map(cleanText)
    .join(" ");
  const realisticSynthetic = /\b(?:deepfake|voice clone|cloned voice|fake footage|synthetic footage|generated match footage|realistic ai scene|made .* appear|say something they did not)\b/i.test(haystack);
  return {
    value: realisticSynthetic,
    rationale: realisticSynthetic
      ? "The run contains language suggesting realistic synthetic or altered real-world content."
      : "Normal AI narration, editing, captions, stock clips, and non-deceptive overlays do not require the synthetic-media toggle by default.",
  };
}

export function fallbackYouTubeMetadata(run = {}, options = {}) {
  const entities = entityTags(run);
  const topic = cleanMetadataText(run.selectedScript?.title || run.topic || "World Cup short");
  const teams = [run.match?.teamA, run.match?.teamB].map(cleanMetadataText).filter(Boolean);
  const titleBase = topic || (teams.length ? `${teams.join(" vs ")} World Cup Short` : "World Cup Chaos Desk");
  const hashtags = [
    "#Shorts",
    "#WorldCup",
    "#Football",
    ...teams.map((team) => normalizeHashtag(team)).filter(Boolean),
  ];
  const visibleHashtags = [...new Map(hashtags.map((tag) => [tag.toLowerCase(), tag])).values()].slice(0, 5);
  const hook = cleanMetadataText(run.selectedScript?.text || "").split(/(?<=[.!?])\s+/)[0] || titleBase;
  const description = [
    `${hook}`,
    "",
    "World Cup Chaos Desk breaks down the football story fans are debating right now.",
    "",
    visibleHashtags.join(" "),
  ].join("\n");
  const synthetic = inferContainsSyntheticMedia(run, {});
  return {
    title: truncateText(titleBase, TITLE_LIMIT),
    description: truncateText(description, DESCRIPTION_LIMIT),
    hashtags: visibleHashtags,
    tags: uniqueCleanList(["World Cup 2026", "football", "soccer", "YouTube Shorts", "football shorts", ...teams, ...entities], 15),
    categoryId: "17",
    privacyStatus: normalizeWorldCupYouTubePrivacy(options.youtubePrivacy || WORLD_CUP_YOUTUBE_PRIVACY),
    madeForKids: false,
    containsSyntheticMedia: synthetic.value,
    notifySubscribers: normalizeBool(options.youtubeNotifySubscribers, WORLD_CUP_YOUTUBE_NOTIFY_SUBSCRIBERS),
    rationale: {
      title: "Fallback metadata from run topic and teams.",
      audience: "Football fans following World Cup narratives and match debates.",
      syntheticMedia: synthetic.rationale,
    },
    source: "fallback",
  };
}

export function sanitizeYouTubeMetadata(candidate = {}, run = {}, options = {}) {
  const fallback = fallbackYouTubeMetadata(run, options);
  const synthetic = inferContainsSyntheticMedia(run, candidate);
  const privacyStatus = normalizeWorldCupYouTubePrivacy(candidate.privacyStatus || candidate.privacy || options.youtubePrivacy || WORLD_CUP_YOUTUBE_PRIVACY);
  const title = truncateText(candidate.title || fallback.title, TITLE_LIMIT) || fallback.title;
  const rawHashtags = [
    ...(Array.isArray(candidate.hashtags) ? candidate.hashtags : []),
    ...String(candidate.description || "")
      .match(/#[a-zA-Z0-9_]+/g)
      ?.slice(0, 5) || [],
    ...fallback.hashtags,
  ];
  const hashtags = [...new Map(rawHashtags.map(normalizeHashtag).filter(Boolean).map((tag) => [tag.toLowerCase(), tag])).values()].slice(0, 5);
  const descriptionBase = truncateText(candidate.description || fallback.description, DESCRIPTION_LIMIT - 80) || fallback.description;
  const descriptionHashtagLine = hashtags.join(" ");
  const description = descriptionBase.toLowerCase().includes("#shorts") ? descriptionBase : truncateText(`${descriptionBase}\n\n${descriptionHashtagLine}`, DESCRIPTION_LIMIT);
  let tags = uniqueCleanList([...(Array.isArray(candidate.tags) ? candidate.tags : []), ...fallback.tags], 20);
  while (tags.join(",").length > TAG_TOTAL_LIMIT && tags.length > 1) {
    tags = tags.slice(0, -1);
  }
  return {
    title,
    description,
    hashtags,
    tags,
    categoryId: /^\d+$/.test(cleanText(candidate.categoryId)) ? cleanText(candidate.categoryId) : "17",
    privacyStatus,
    madeForKids: Boolean(candidate.madeForKids === true),
    containsSyntheticMedia: synthetic.value,
    notifySubscribers: normalizeBool(candidate.notifySubscribers ?? options.youtubeNotifySubscribers, WORLD_CUP_YOUTUBE_NOTIFY_SUBSCRIBERS),
    rationale: {
      title: cleanMetadataText(candidate.rationale?.title || candidate.titleRationale || fallback.rationale.title),
      audience: cleanMetadataText(candidate.rationale?.audience || candidate.audienceRationale || fallback.rationale.audience),
      syntheticMedia: cleanMetadataText(candidate.rationale?.syntheticMedia || candidate.syntheticMediaRationale || synthetic.rationale),
    },
    source: cleanMetadataText(candidate.source || "gemini"),
  };
}

export function validateYouTubeMetadata(metadata = {}) {
  const issues = [];
  if (!cleanText(metadata.title)) issues.push("Missing YouTube title.");
  if (cleanText(metadata.title).length > 100) issues.push("YouTube title exceeds 100 characters.");
  if (!cleanText(metadata.description)) issues.push("Missing YouTube description.");
  if (!["private", "unlisted", "public"].includes(cleanText(metadata.privacyStatus).toLowerCase())) issues.push("Invalid YouTube privacy status.");
  if (!/^\d+$/.test(cleanText(metadata.categoryId))) issues.push("Invalid YouTube category id.");
  if (metadata.hashtags?.length > 5) issues.push("Too many visible hashtags.");
  if (hasMetadataArtifact(`${metadata.title}\n${metadata.description}\n${(metadata.tags || []).join("\n")}\n${(metadata.hashtags || []).join("\n")}`)) {
    issues.push("Metadata contains encoding/prompt/source artifacts.");
  }
  return issues;
}

export function blockedRightsAssets(run = {}) {
  const manifest = run.rightsManifest || {};
  const rows = [
    ...(Array.isArray(manifest.blocked) ? manifest.blocked : []),
    ...(Array.isArray(manifest.assets) ? manifest.assets.filter((asset) => cleanText(asset.rightsStatus).toLowerCase() === "blocked") : []),
  ];
  return rows.filter(Boolean);
}

export function youtubeUploadGate({ run = {}, metadata = {}, credentialsPresent = false, mp4Ready = false, uploadedToday = 0, maxPerDay = WORLD_CUP_YOUTUBE_MAX_PER_DAY } = {}) {
  const hardFails = [];
  const warnings = [];
  if (!mp4Ready) hardFails.push("Rendered MP4 is missing or empty.");
  if (!credentialsPresent) hardFails.push("Missing YouTube OAuth credentials.");
  const blockedAssets = blockedRightsAssets(run);
  if (blockedAssets.length) hardFails.push(`${blockedAssets.length} asset(s) are explicitly rights-blocked.`);
  const metadataIssues = validateYouTubeMetadata(metadata);
  hardFails.push(...metadataIssues);
  const privacyStatus = normalizeWorldCupYouTubePrivacy(metadata.privacyStatus);
  if (privacyStatus !== "private" && Number(maxPerDay) > 0 && Number(uploadedToday) >= Number(maxPerDay)) {
    hardFails.push(`YouTube daily public/unlisted cap reached (${uploadedToday}/${maxPerDay}).`);
  }
  if (run.qualityV2?.finalDecision && run.qualityV2.finalDecision !== "publish_candidate") {
    warnings.push(`V2 advisory only: ${run.qualityV2.finalDecision}.`);
  }
  for (const issue of run.qualityV2?.issues || []) {
    const cleaned = cleanText(issue);
    if (cleaned) warnings.push(`V2 advisory: ${cleaned}`);
    if (warnings.length >= 8) break;
  }
  return {
    allowed: hardFails.length === 0,
    hardFails,
    warnings,
    blockedAssets,
    metadataIssues,
    uploadedToday: Number(uploadedToday) || 0,
    maxPerDay: Number(maxPerDay) || 0,
  };
}

export function buildYouTubeMetadataPrompt(run = {}, options = {}) {
  const compact = {
    channel: "World Cup Chaos Desk",
    audience: run.audience,
    topic: run.topic,
    type: run.type,
    match: run.match,
    selectedScript: {
      title: run.selectedScript?.title,
      text: run.selectedScript?.text,
      dataPoint: run.selectedScript?.dataPoint,
      opinion: run.selectedScript?.opinion,
      commentTrigger: run.selectedScript?.commentTrigger,
    },
    evidence: {
      sourcedClaims: (run.evidence?.sourcedClaims || []).slice(0, 6),
      keyPlayers: (run.evidence?.keyPlayers || []).slice(0, 6),
      contentAngles: (run.evidence?.contentAngles || []).slice(0, 6),
      hookBank: (run.evidence?.hookBank || []).slice(0, 6),
      uncertaintyNotes: (run.evidence?.uncertaintyNotes || []).slice(0, 4),
    },
    viralStrategy: {
      topicScore: run.viralStrategy?.topicScore,
      coverText: run.viralStrategy?.coverText,
      oneSentenceContradiction: run.viralStrategy?.oneSentenceContradiction,
    },
    qualityV2Advisory: {
      finalDecision: run.qualityV2?.finalDecision || "",
      finalScore: run.qualityV2?.finalScore || 0,
      issues: (run.qualityV2?.issues || []).slice(0, 6),
    },
    visualRights: {
      blocked: blockedRightsAssets(run).length,
      needsReview: run.rightsManifest?.needsReview?.length || 0,
      assets: (run.rightsManifest?.assets || []).slice(0, 12).map((asset) => ({
        provider: asset.provider,
        rightsStatus: asset.rightsStatus,
        flags: asset.flags,
        entity: asset.entity,
      })),
    },
  };
  return `
You are a YouTube Shorts metadata producer for a football channel called World Cup Chaos Desk.
Create metadata for one short. Optimize for clarity, curiosity, and audience match, but do not promise guaranteed virality.

Rules:
- Return strict JSON only.
- Do not invent stats or claims beyond the supplied evidence/script.
- Do not include raw source URLs, prompt artifacts, "return JSON", or encoding artifacts.
- Title must be under ${TITLE_LIMIT} characters and should feel like a football Shorts title, not spam.
- Description should be short, natural, and include the visible hashtags at the end.
- Include 3-5 visible hashtags. Always include #Shorts.
- Category must be "17" for Sports.
- madeForKids must be false.
- containsSyntheticMedia should be true only for realistic synthetic/altered real-world content, fake match footage, or real people made to appear to do/say something they did not. Normal AI narration/captions/stock clips are false.
- Privacy status must be "${normalizeWorldCupYouTubePrivacy(options.youtubePrivacy || WORLD_CUP_YOUTUBE_PRIVACY)}".

Run:
${JSON.stringify(compact, null, 2)}

Return JSON:
{
  "title": "",
  "description": "",
  "hashtags": ["#Shorts"],
  "tags": [""],
  "categoryId": "17",
  "privacyStatus": "${normalizeWorldCupYouTubePrivacy(options.youtubePrivacy || WORLD_CUP_YOUTUBE_PRIVACY)}",
  "madeForKids": false,
  "containsSyntheticMedia": false,
  "rationale": {
    "title": "",
    "audience": "",
    "syntheticMedia": ""
  }
}
`.trim();
}

function isRetryableYouTubeMetadataError(error = {}) {
  const message = error.message || "";
  return (
    error.code === "QUOTA_OR_RATE_LIMIT" ||
    error.code === "GEMINI_SERVER_ERROR" ||
    error.code === "NETWORK_OR_SERVER_UNREACHABLE" ||
    Number(error.status) === 429 ||
    Number(error.status) >= 500 ||
    /quota|rate|high demand|overloaded|temporar|server|network|fetch failed/i.test(message)
  );
}

function normalizeRetryDelaysMs(delays) {
  if (!Array.isArray(delays)) return YOUTUBE_METADATA_RETRY_DELAYS_MS;
  const normalized = delays.map((delay) => Number(delay)).filter((delay) => Number.isFinite(delay) && delay >= 0);
  return normalized.length ? normalized : YOUTUBE_METADATA_RETRY_DELAYS_MS;
}

export async function generateYouTubeMetadata(run = {}, options = {}) {
  const fallback = fallbackYouTubeMetadata(run, options);
  const keyInfo = await getActiveGeminiKey();
  if (!keyInfo?.apiKey || normalizeBool(options.offline, false)) {
    return { metadata: fallback, raw: null, model: "fallback", warnings: ["Fallback YouTube metadata used because Gemini metadata generation was unavailable."] };
  }
  const retryDelaysMs = normalizeRetryDelaysMs(options.youtubeMetadataRetryDelaysMs);
  const requestMetadataJson = options.youtubeMetadataRequester || requestGeminiJsonWithFallbacks;
  const sleepForRetry = options.youtubeMetadataSleep || sleep;
  const prompt = buildYouTubeMetadataPrompt(run, options);
  const errors = [];
  try {
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        const result = await requestMetadataJson({
          keyInfo,
          primaryModel: options.youtubeMetadataModel || WORLD_CUP_YOUTUBE_METADATA_MODEL,
          fallbackModels: [],
          prompt,
          temperature: 0.45,
        });
        const metadata = sanitizeYouTubeMetadata(result.json || {}, run, options);
        const warnings =
          attempt > 0
            ? [`Gemini YouTube metadata succeeded after ${attempt + 1} attempts. Earlier errors: ${errors.join(" | ")}`]
            : [];
        return { metadata, raw: result.rawText || "", model: result.model, warnings };
      } catch (error) {
        errors.push(`attempt ${attempt + 1}: ${error.message}`);
        if (attempt >= retryDelaysMs.length || !isRetryableYouTubeMetadataError(error)) {
          throw error;
        }
        await sleepForRetry(retryDelaysMs[attempt]);
      }
    }
  } catch (error) {
    return {
      metadata: fallback,
      raw: null,
      model: "fallback",
      warnings: [`Fallback YouTube metadata used because Gemini metadata generation failed after ${errors.length || 1} attempts: ${errors.join(" | ") || error.message}`],
    };
  }
}

export function buildYouTubeVideoResource(metadata = {}) {
  return {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags || [],
      categoryId: metadata.categoryId || "17",
      defaultLanguage: "en",
      defaultAudioLanguage: "en",
    },
    status: {
      privacyStatus: normalizeWorldCupYouTubePrivacy(metadata.privacyStatus),
      selfDeclaredMadeForKids: Boolean(metadata.madeForKids),
      containsSyntheticMedia: Boolean(metadata.containsSyntheticMedia),
    },
  };
}

export function buildYouTubeUploadSessionUrl(metadata = {}) {
  const url = new URL(YOUTUBE_UPLOAD_URL);
  url.searchParams.set("uploadType", "resumable");
  url.searchParams.set("part", "snippet,status");
  url.searchParams.set("notifySubscribers", normalizeBool(metadata.notifySubscribers, false) ? "true" : "false");
  return url;
}

export async function startYouTubeUploadSession({ accessToken, metadata, contentLength }) {
  const response = await fetch(buildYouTubeUploadSessionUrl(metadata), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(contentLength),
    },
    body: JSON.stringify(buildYouTubeVideoResource(metadata)),
  });
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    recordApiUsage({ provider: "youtube", operation: "videos.insert.session", status: "failed", details: { status: response.status } });
    throw new WorldCupError(`YouTube upload session failed with HTTP ${response.status}.`, {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      code: "YOUTUBE_UPLOAD_SESSION_FAILED",
      details: parseMaybeJson(text),
    });
  }
  const uploadUrl = response.headers.get("location");
  if (!uploadUrl) {
    throw new WorldCupError("YouTube did not return a resumable upload URL.", {
      status: 502,
      code: "YOUTUBE_UPLOAD_URL_MISSING",
      details: parseMaybeJson(text),
    });
  }
  recordApiUsage({ provider: "youtube", operation: "videos.insert.session", status: "success" });
  return uploadUrl;
}

function parseMaybeJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: String(text || "").slice(0, 1200) };
  }
}

export async function uploadVideoBytesToYouTube({ uploadUrl, buffer }) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(buffer.length),
    },
    body: buffer,
  });
  const text = await response.text().catch(() => "");
  const data = parseMaybeJson(text);
  if (!response.ok || !data.id) {
    recordApiUsage({ provider: "youtube", operation: "videos.insert.upload", status: "failed", details: { status: response.status } });
    throw new WorldCupError(`YouTube video upload failed with HTTP ${response.status}.`, {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      code: "YOUTUBE_UPLOAD_FAILED",
      details: data,
    });
  }
  recordApiUsage({ provider: "youtube", operation: "videos.insert.upload", status: "success" });
  return data;
}

async function countYouTubeUploadsToday({ excludeId = "", privacyStatus = "private" } = {}) {
  if (normalizeWorldCupYouTubePrivacy(privacyStatus) === "private") {
    return 0;
  }
  const today = nowIso().slice(0, 10);
  const index = await listWorldCupRuns();
  return (index.runs || []).filter((run) => {
    if (run.id === excludeId) return false;
    const youtube = run.youtube || {};
    return youtube.status === "uploaded" && youtube.uploadedAt?.slice(0, 10) === today && normalizeWorldCupYouTubePrivacy(youtube.privacyStatus) !== "private";
  }).length;
}

export async function buildYouTubeGateForRun(run, metadata, options = {}) {
  const runDir = path.join(runsRoot, run.id);
  const mp4Path = run.files?.mp4 ? path.join(runDir, run.files.mp4) : "";
  const stat = mp4Path && (await fileExists(mp4Path)) ? await fs.stat(mp4Path) : null;
  const uploadedToday = await countYouTubeUploadsToday({ excludeId: run.id, privacyStatus: metadata.privacyStatus });
  return youtubeUploadGate({
    run,
    metadata,
    credentialsPresent: hasYouTubeCredentials(),
    mp4Ready: Boolean(stat?.size),
    uploadedToday,
    maxPerDay: Number(options.youtubeMaxPerDay ?? WORLD_CUP_YOUTUBE_MAX_PER_DAY),
  });
}

export async function uploadWorldCupRunToYouTube(id, options = {}) {
  let run = await readWorldCupRun(id);
  if (run.youtube?.status === "uploaded" && run.youtube?.videoId && !normalizeBool(options.youtubeForceUpload, false)) {
    return run;
  }
  run.files ||= {};
  run.youtube = run.youtube || {};
  run.youtube.startedAt = nowIso();

  const metadataResult = await generateYouTubeMetadata(run, options);
  const metadata = metadataResult.metadata;
  run.files.youtubeMetadata = await writeRunFile(
    run,
    "youtube-metadata.json",
    `${JSON.stringify({ ...metadataResult, metadata }, null, 2)}\n`,
    "utf8",
  );
  const gate = await buildYouTubeGateForRun(run, metadata, options);
  if (!gate.allowed) {
    run.youtube = {
      status: "blocked",
      blockedAt: nowIso(),
      hardFails: gate.hardFails,
      warnings: [...metadataResult.warnings, ...gate.warnings],
      privacyStatus: metadata.privacyStatus,
      metadata,
      gate,
    };
    run.files.youtube = await writeRunFile(run, "youtube.json", `${JSON.stringify(run.youtube, null, 2)}\n`, "utf8");
    await saveRun(run);
    throw new WorldCupError("YouTube upload blocked by hard upload gate.", {
      status: 422,
      code: "YOUTUBE_UPLOAD_GATE_BLOCKED",
      details: { runId: run.id, hardFails: gate.hardFails },
    });
  }

  const runDir = path.join(runsRoot, run.id);
  const mp4Path = path.join(runDir, run.files.mp4);
  try {
    const buffer = await fs.readFile(mp4Path);
    const accessToken = await getYouTubeAccessToken();
    const uploadUrl = await startYouTubeUploadSession({ accessToken, metadata, contentLength: buffer.length });
    const video = await uploadVideoBytesToYouTube({ uploadUrl, buffer });
    const videoId = cleanText(video.id);
    run.youtube = {
      status: "uploaded",
      uploadedAt: nowIso(),
      videoId,
      url: videoId ? `${YOUTUBE_WATCH_BASE_URL}${encodeURIComponent(videoId)}` : "",
      privacyStatus: metadata.privacyStatus,
      containsSyntheticMedia: Boolean(metadata.containsSyntheticMedia),
      madeForKids: Boolean(metadata.madeForKids),
      notifySubscribers: Boolean(metadata.notifySubscribers),
      metadata,
      metadataModel: metadataResult.model,
      metadataWarnings: metadataResult.warnings,
      gate,
      response: {
        id: videoId,
        kind: video.kind || "",
        etag: video.etag || "",
      },
    };
    run.files.youtube = await writeRunFile(run, "youtube.json", `${JSON.stringify(run.youtube, null, 2)}\n`, "utf8");
    run.status = run.status === "sent_telegram" ? "sent_telegram_youtube" : "uploaded_youtube";
    return await saveRun(run);
  } catch (error) {
    run.youtube = {
      status: "failed",
      failedAt: nowIso(),
      error: error.message,
      code: error.code || "YOUTUBE_UPLOAD_FAILED",
      privacyStatus: metadata.privacyStatus,
      metadata,
      metadataModel: metadataResult.model,
      metadataWarnings: metadataResult.warnings,
      gate,
    };
    run.files.youtube = await writeRunFile(run, "youtube.json", `${JSON.stringify(run.youtube, null, 2)}\n`, "utf8");
    await saveRun(run);
    throw error;
  }
}

export function youtubeTelegramSummary(run = {}) {
  const youtube = run.youtube || {};
  if (youtube.status === "uploaded") {
    return [
      "YouTube upload complete",
      youtube.url || (youtube.videoId ? `${YOUTUBE_WATCH_BASE_URL}${encodeURIComponent(youtube.videoId)}` : ""),
      `Privacy: ${youtube.privacyStatus || ""}`,
      `Title: ${youtube.metadata?.title || ""}`,
      `Hashtags: ${(youtube.metadata?.hashtags || []).join(" ")}`,
      `Synthetic media: ${youtube.containsSyntheticMedia ? "yes" : "no"}`,
      run.qualityV2?.finalDecision && run.qualityV2.finalDecision !== "publish_candidate" ? `V2 advisory ignored: ${run.qualityV2.finalDecision}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 3900);
  }
  return [
    "YouTube upload did not complete",
    `Status: ${youtube.status || "unknown"}`,
    youtube.error ? `Error: ${youtube.error}` : "",
    youtube.hardFails?.length ? `Hard fails: ${youtube.hardFails.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 3900);
}

export const __youtubeInternals = {
  TITLE_LIMIT,
  DESCRIPTION_LIMIT,
  TAG_TOTAL_LIMIT,
  YOUTUBE_UPLOAD_SCOPE,
};
