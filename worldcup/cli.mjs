#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { buildMajorWorldCupAssetPacks, buildWorldCupAssetPack, generateWorldCupRun, rebuildWorldCupVisuals, renderWorldCupRun, runWorldCupScheduler, uploadWorldCupRun, uploadWorldCupRunToYouTube } from "./pipeline.mjs";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const rawKey = token.slice(2);
    const [keyFromEquals, valueFromEquals] = rawKey.split(/=(.*)/s);
    const key = keyFromEquals.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (valueFromEquals !== undefined) {
      args[key] = valueFromEquals;
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !String(next).startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function boolArg(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return ["1", "true", "yes", "y", "on"].includes(String(value).trim().toLowerCase());
}

function combinedViralDecision(run) {
  if (run.strategy !== "viral2") {
    return "";
  }
  const decisions = [run.viralStrategy?.topicScore?.decision, run.selectedScript?.viralQuality?.decision, run.postRenderQuality?.decision].filter(Boolean);
  if (decisions.includes("discard")) {
    return "discard";
  }
  if (decisions.includes("revise") || run.review?.status === "needs_review") {
    return "revise";
  }
  return decisions.length ? "publish_candidate" : "";
}

function summarize(run) {
  return {
    id: run.id,
    type: run.type,
    strategy: run.strategy,
    status: run.status,
    topic: run.topic,
    match: run.match,
    selectedStyle: run.selectedScript?.styleId,
    viralScore: run.selectedScript?.viralQuality?.total || run.viralStrategy?.topicScore?.total || 0,
    viralTopicScore: run.viralStrategy?.topicScore?.total || 0,
    viralDecision: combinedViralDecision(run),
    qualityMode: run.qualityMode || run.qualityV2?.mode || "",
    qualityV2: run.qualityV2,
    voice: run.tts?.voice,
    durationSeconds: run.audio?.durationSeconds || run.srt?.durationSeconds,
    files: run.files,
    r2: run.r2,
    drive: run.drive,
    telegram: run.telegram,
    youtube: run.youtube,
    warnings: run.warnings,
  };
}

function renderAlreadyHandled(run) {
  return Boolean(
    run.files?.mp4 ||
      ["rendered", "publish_candidate", "sent_telegram", "sidecars_sent_telegram", "uploaded", "pre_render_blocked", "rendered_needs_review"].includes(run.status),
  );
}

function uploadAlreadyHandled(run) {
  return Boolean(
    ["sent_telegram", "sidecars_sent_telegram", "uploaded", "pre_render_blocked", "rendered_needs_review"].includes(run.status) ||
      (run.telegram?.messages || []).some((message) => message.label === "mp4"),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptTextFromFile = args.scriptFile || args.customScriptFile ? await readFile(args.scriptFile || args.customScriptFile, "utf8") : "";
  const options = {
    id: args.id,
    mode: args.mode,
    type: args.type || args.mode,
    strategy: args.strategy || args.contentStrategy,
    topic: args.topic,
    teamA: args.teamA,
    teamB: args.teamB,
    matchId: args.matchId,
    kickoff: args.kickoff,
    date: args.date,
    competition: args.competition,
    venue: args.venue,
    audience: args.audience,
    language: args.language,
    source: args.source,
    commentaryUrl: args.commentaryUrl,
    commentaryText: args.commentaryText,
    customScriptText: scriptTextFromFile || args.customScriptText || args.scriptText || "",
    customScriptTitle: args.customScriptTitle || args.scriptTitle || "",
    customScriptStyle: args.customScriptStyle || args.scriptStyle || "",
    customScriptDataPoint: args.customScriptDataPoint || args.dataPoint || "",
    customScriptOpinion: args.customScriptOpinion || args.opinion || "",
    customScriptCommentTrigger: args.customScriptCommentTrigger || args.commentTrigger || "",
    durationSeconds: args.durationSeconds,
    render: boolArg(args.render, false),
    upload: boolArg(args.upload, false),
    uploadTarget: args.uploadTarget || args.destination,
    youtubeUpload: boolArg(args.youtubeUpload ?? args.uploadYoutube, undefined),
    youtubePrivacy: args.youtubePrivacy || args.youtube_privacy,
    youtubeMaxPerDay: args.youtubeMaxPerDay || args.youtube_max_per_day,
    youtubeNotifySubscribers: boolArg(args.youtubeNotifySubscribers ?? args.youtube_notify_subscribers, undefined),
    youtubeMetadataModel: args.youtubeMetadataModel || args.youtube_metadata_model,
    bgm: boolArg(args.bgm ?? args.backgroundMusic, undefined),
    bgmFile: args.bgmFile || args.backgroundMusicFile,
    bgmMode: args.bgmMode,
    bgmPreset: args.bgmPreset || args.musicPreset,
    bgmVolume: args.bgmVolume,
    captionPreset: args.captionPreset || args.captionStyle,
    captionMidScreen: args.captionMidScreen || args.midScreenCaptions,
    captionDesign: boolArg(args.captionDesign ?? args.smartCaptions, true),
    qualityMode: args.qualityMode,
    strictPublish: boolArg(args.strictPublish, undefined),
    maxScriptRetries: args.maxScriptRetries,
    maxVisualRetries: args.maxVisualRetries,
    scriptPublishScore: args.scriptPublishScore || args.v2ScriptPublishScore,
    finalPublishScore: args.finalPublishScore || args.v2FinalPublishScore,
    requireZeroFallbacks: boolArg(args.requireZeroFallbacks ?? args.v2RequireZeroFallbacks, undefined),
    telegramSendFailedMp4: boolArg(args.telegramSendFailedMp4 ?? args.v2TelegramSendFailedMp4, undefined),
    allowSilentRender: boolArg(args.allowSilentRender ?? args.allowSilent ?? args.silentOk, false),
    allowFallbackVisuals: boolArg(args.allowFallbackVisuals ?? args.allowFallbackVisualRender ?? args.fallbackVisualsOk, false),
    allowNeedsReviewUpload: boolArg(args.allowNeedsReviewUpload ?? args.allowReviewUpload, false),
    requireMp4: boolArg(args.requireMp4 ?? args.requireVideo, false),
    offline: boolArg(args.offline, false),
    generateAudio: boolArg(args.generateAudio, true),
    force: boolArg(args.force, false),
    limit: args.limit,
  };

  if (args.majorAssetPacks || args.buildMajorAssetPacks) {
    const result = await buildMajorWorldCupAssetPacks({
      limit: args.limit,
      playersPerTeam: args.playersPerTeam,
      includeStock: boolArg(args.stock ?? args.includeStock, false),
      offline: options.offline,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (args.assetPack || args.buildAssetPack) {
    const result = await buildWorldCupAssetPack({
      team: args.team || args.teamA || args.topic,
      topic: args.topic,
      players: args.players,
      limit: args.limit,
      includeStock: boolArg(args.stock ?? args.includeStock, true),
      offline: options.offline,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (boolArg(args.scheduled, false)) {
    const result = await runWorldCupScheduler(options);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (args.visualsOnly || args.rebuildVisuals || args.renderOnly || args.uploadOnly || args.youtubeUploadOnly) {
    if (!args.id) {
      throw new Error("--id is required for --visuals-only, --render-only, --upload-only, or --youtube-upload-only.");
    }
    let run = null;
    if (args.visualsOnly || args.rebuildVisuals) {
      run = await rebuildWorldCupVisuals(args.id, options);
    }
    if (args.renderOnly) {
      run = await renderWorldCupRun(args.id, options);
    }
    if (args.uploadOnly) {
      run = await uploadWorldCupRun(args.id, options);
    }
    if (args.youtubeUploadOnly) {
      run = await uploadWorldCupRunToYouTube(args.id, { ...options, youtubeUpload: true });
    }
    console.log(JSON.stringify(summarize(run), null, 2));
    return;
  }

  let run = await generateWorldCupRun(options);
  if (options.render && !renderAlreadyHandled(run)) {
    run = await renderWorldCupRun(run.id, options);
  }
  if (options.upload && !uploadAlreadyHandled(run)) {
    run = await uploadWorldCupRun(run.id, options);
  }
  console.log(JSON.stringify(summarize(run), null, 2));
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          error: error.message,
          code: error.code || "WORLD_CUP_CLI_FAILED",
          status: error.status || 1,
          provider: error.provider || null,
          model: error.model || null,
          details: error.details || null,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  });
