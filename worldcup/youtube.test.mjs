import assert from "node:assert/strict";
import test from "node:test";
import {
  buildYouTubeTokenRequestBody,
  fallbackYouTubeMetadata,
  generateYouTubeMetadata,
  sanitizeYouTubeMetadata,
  uploadWorldCupRunToYouTube,
  validateYouTubeMetadata,
  youtubeUploadGate,
} from "./modules/youtube.mjs";
import { createRunSkeleton, readWorldCupRun, saveRun, writeRunFile } from "./modules/memory.mjs";
import { WorldCupError } from "./modules/utils.mjs";
import { uploadWorldCupRunForPrimaryDelivery } from "./pipeline.mjs";

function mockResponse({ ok = true, status = 200, json = {}, text = "", headers = {} } = {}) {
  return {
    ok,
    status,
    headers: new Headers(headers),
    async json() {
      return json;
    },
    async text() {
      return text || JSON.stringify(json);
    },
  };
}

async function withMockedFetch(mock, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function withYouTubeEnv(callback) {
  const previous = {
    YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
    YOUTUBE_REFRESH_TOKEN: process.env.YOUTUBE_REFRESH_TOKEN,
  };
  process.env.YOUTUBE_CLIENT_ID = "client-id";
  process.env.YOUTUBE_CLIENT_SECRET = "client-secret";
  process.env.YOUTUBE_REFRESH_TOKEN = "refresh-token";
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test("YouTube OAuth refresh body uses refresh-token grant", () => {
  const body = buildYouTubeTokenRequestBody({
    clientId: "client",
    clientSecret: "secret",
    refreshToken: "refresh",
  });

  assert.equal(body.get("client_id"), "client");
  assert.equal(body.get("client_secret"), "secret");
  assert.equal(body.get("refresh_token"), "refresh");
  assert.equal(body.get("grant_type"), "refresh_token");
});

test("YouTube metadata sanitizer enforces safe defaults", () => {
  const run = {
    topic: "France vs Senegal pressure trap",
    match: { teamA: "France", teamB: "Senegal" },
    selectedScript: { title: "France's Worst Nightmare?", text: "France is walking into a tactical trap. Tell me your score prediction." },
  };

  const metadata = sanitizeYouTubeMetadata(
    {
      title: "France vs Senegal is a tactical trap that nobody is taking seriously even though it could flip the entire group narrative",
      description: "A fast football breakdown.",
      hashtags: ["shorts", "#World Cup", "#France", "#Senegal", "#Football", "#Extra"],
      tags: ["football", "football", "World Cup 2026", "Senegal"],
      categoryId: "bad",
      privacyStatus: "public",
      madeForKids: true,
    },
    run,
    { youtubePrivacy: "private" },
  );

  assert.ok(metadata.title.length <= 95);
  assert.equal(metadata.categoryId, "17");
  assert.equal(metadata.privacyStatus, "public");
  assert.equal(metadata.madeForKids, true);
  assert.ok(metadata.hashtags.includes("#Shorts"));
  assert.ok(metadata.hashtags.length <= 5);
  assert.equal(new Set(metadata.tags.map((tag) => tag.toLowerCase())).size, metadata.tags.length);
  assert.deepEqual(validateYouTubeMetadata(metadata), []);
});

test("YouTube gate ignores V2 blocks but blocks real hard failures", () => {
  const metadata = fallbackYouTubeMetadata({
    topic: "France vs Senegal",
    selectedScript: { title: "France vs Senegal Trap", text: "This match has upset energy." },
    qualityV2: { finalDecision: "blocked", issues: ["V2 dislikes hook."] },
    rightsManifest: { assets: [], blocked: [] },
  });

  const allowed = youtubeUploadGate({
    run: { qualityV2: { finalDecision: "blocked", issues: ["V2 dislikes hook."] }, rightsManifest: { blocked: [] } },
    metadata,
    credentialsPresent: true,
    mp4Ready: true,
  });
  assert.equal(allowed.allowed, true);
  assert.match(allowed.warnings.join("\n"), /V2 advisory/i);

  const blocked = youtubeUploadGate({
    run: { rightsManifest: { blocked: [{ assetId: "bad-asset", rightsStatus: "blocked" }] } },
    metadata,
    credentialsPresent: false,
    mp4Ready: false,
  });
  assert.equal(blocked.allowed, false);
  assert.match(blocked.hardFails.join("\n"), /MP4/i);
  assert.match(blocked.hardFails.join("\n"), /credentials/i);
  assert.match(blocked.hardFails.join("\n"), /rights-blocked/i);
});

test("YouTube metadata retries transient Gemini failures with staged delays", async () => {
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "gemini-key";
  try {
    const attempts = [];
    const slept = [];
    const run = {
      topic: "France vs Senegal",
      match: { teamA: "France", teamB: "Senegal" },
      selectedScript: {
        title: "France vs Senegal Trap",
        text: "France is walking into a tactical trap. Tell me your score prediction.",
      },
    };

    const result = await generateYouTubeMetadata(run, {
      youtubePrivacy: "private",
      youtubeMetadataRetryDelaysMs: [5000, 10000, 15000],
      youtubeMetadataSleep: async (ms) => slept.push(ms),
      youtubeMetadataRequester: async () => {
        attempts.push(attempts.length + 1);
        if (attempts.length <= 3) {
          const error = new Error("Gemini server overloaded");
          error.code = "GEMINI_SERVER_ERROR";
          error.status = 503;
          throw error;
        }
        return {
          model: "gemini-3.1-flash-lite",
          rawText: "{}",
          json: {
            title: "France vs Senegal Trap",
            description: "A fast football breakdown. #Shorts #WorldCup #Football",
            hashtags: ["#Shorts", "#WorldCup", "#Football"],
            tags: ["football", "World Cup 2026", "France", "Senegal"],
            categoryId: "17",
            privacyStatus: "private",
            madeForKids: false,
            containsSyntheticMedia: false,
          },
        };
      },
    });

    assert.equal(attempts.length, 4);
    assert.deepEqual(slept, [5000, 10000, 15000]);
    assert.equal(result.model, "gemini-3.1-flash-lite");
    assert.equal(result.metadata.title, "France vs Senegal Trap");
    assert.match(result.warnings.join("\n"), /succeeded after 4 attempts/i);
  } finally {
    if (previousGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousGeminiKey;
    }
  }
});

test("mock YouTube upload writes youtube sidecars and ignores V2 decision", async () => {
  await withYouTubeEnv(async () => {
    const run = await createRunSkeleton({
      id: "youtube-test-v2-blocked",
      type: "prediction",
      strategy: "viral2",
      qualityMode: "v2",
      strictPublish: false,
      topic: "France vs Senegal",
      match: { teamA: "France", teamB: "Senegal", date: "2026-06-16" },
      language: "en",
    });
    run.selectedScript = {
      title: "France vs Senegal Trap",
      text: "France is walking into a trap. Tell me your score prediction.",
    };
    run.qualityV2 = { mode: "v2", finalDecision: "blocked", issues: ["V2 advisory should not block."] };
    run.rightsManifest = { assets: [], blocked: [] };
    run.files.mp4 = await writeRunFile(run, "youtube-test.mp4", Buffer.from("fake mp4 bytes"));
    await saveRun(run);

    const calls = [];
    await withMockedFetch(async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method, body: options.body });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return mockResponse({ json: { access_token: "access-token", expires_in: 3600 } });
      }
      if (String(url).includes("upload/youtube/v3/videos") && options.method === "POST") {
        return mockResponse({ text: "{}", headers: { location: "https://upload.youtube.test/session" } });
      }
      if (String(url) === "https://upload.youtube.test/session") {
        return mockResponse({ json: { id: "yt-video-123", kind: "youtube#video" } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }, async () => {
      await uploadWorldCupRunToYouTube(run.id, {
        offline: true,
        youtubeUpload: true,
        youtubePrivacy: "private",
        youtubeMaxPerDay: 5,
      });
    });

    const saved = await readWorldCupRun(run.id);
    assert.equal(saved.youtube.status, "uploaded");
    assert.equal(saved.youtube.videoId, "yt-video-123");
    assert.equal(saved.youtube.privacyStatus, "private");
    assert.equal(saved.files.youtube, "youtube.json");
    assert.equal(saved.files.youtubeMetadata, "youtube-metadata.json");
    assert.equal(calls.filter((call) => call.method === "POST").length, 2);
    assert.equal(calls.filter((call) => call.method === "PUT").length, 1);
  });
});

test("YouTube upload can complete after primary Telegram or Drive delivery fails", async () => {
  await withYouTubeEnv(async () => {
    const run = await createRunSkeleton({
      id: "youtube-test-primary-delivery-failed",
      type: "prediction",
      strategy: "viral2",
      qualityMode: "v2",
      strictPublish: false,
      topic: "Norway vs Iraq pressure angle",
      match: { teamA: "Norway", teamB: "Iraq", date: "2026-06-16" },
      language: "en",
    });
    run.selectedScript = {
      title: "Norway vs Iraq Pressure",
      text: "Norway and Iraq are walking into a pressure test. Tell me your score prediction.",
    };
    run.qualityV2 = { mode: "v2", finalDecision: "blocked", issues: ["Advisory only."] };
    run.rightsManifest = { assets: [], blocked: [] };
    run.files.mp4 = await writeRunFile(run, "youtube-primary-fallback-test.mp4", Buffer.from("fake mp4 bytes"));
    await saveRun(run);

    const afterPrimaryFailure = await uploadWorldCupRunForPrimaryDelivery(
      run,
      { youtubeUpload: true },
      { youtubeUpload: true },
      { requireMp4: true },
      async () => {
        throw new WorldCupError("Telegram rejected the MP4 as too large and Google Drive fallback failed.", {
          status: 502,
          code: "TELEGRAM_OVERSIZE_FALLBACKS_FAILED",
        });
      },
    );

    assert.equal(afterPrimaryFailure.delivery.primaryUpload.status, "failed");
    assert.match(afterPrimaryFailure.warnings.join("\n"), /Primary Telegram\/Drive\/R2 delivery failed/i);

    await withMockedFetch(async (url, options = {}) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return mockResponse({ json: { access_token: "access-token", expires_in: 3600 } });
      }
      if (String(url).includes("upload/youtube/v3/videos") && options.method === "POST") {
        return mockResponse({ text: "{}", headers: { location: "https://upload.youtube.test/primary-fallback-session" } });
      }
      if (String(url) === "https://upload.youtube.test/primary-fallback-session") {
        return mockResponse({ json: { id: "yt-video-primary-fallback", kind: "youtube#video" } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }, async () => {
      await uploadWorldCupRunToYouTube(run.id, {
        offline: true,
        youtubeUpload: true,
        youtubePrivacy: "public",
        youtubeMaxPerDay: 99,
      });
    });

    const saved = await readWorldCupRun(run.id);
    assert.equal(saved.youtube.status, "uploaded");
    assert.equal(saved.youtube.videoId, "yt-video-primary-fallback");
    assert.equal(saved.youtube.privacyStatus, "public");
    assert.equal(saved.delivery.primaryUpload.status, "failed");
  });
});
