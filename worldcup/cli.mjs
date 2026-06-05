#!/usr/bin/env node
import { generateWorldCupRun, renderWorldCupRun, runWorldCupScheduler, uploadWorldCupRun } from "./pipeline.mjs";

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
    if (next && !next.startsWith("--")) {
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

function summarize(run) {
  return {
    id: run.id,
    type: run.type,
    status: run.status,
    topic: run.topic,
    match: run.match,
    selectedStyle: run.selectedScript?.styleId,
    voice: run.tts?.voice,
    durationSeconds: run.audio?.durationSeconds || run.srt?.durationSeconds,
    files: run.files,
    r2: run.r2,
    warnings: run.warnings,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {
    id: args.id,
    mode: args.mode,
    type: args.type || args.mode,
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
    commentaryUrl: args.commentaryUrl,
    commentaryText: args.commentaryText,
    durationSeconds: args.durationSeconds,
    render: boolArg(args.render, false),
    upload: boolArg(args.upload, false),
    offline: boolArg(args.offline, false),
    generateAudio: boolArg(args.generateAudio, true),
    force: boolArg(args.force, false),
    limit: args.limit,
  };

  if (boolArg(args.scheduled, false)) {
    const result = await runWorldCupScheduler(options);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (args.renderOnly || args.uploadOnly) {
    if (!args.id) {
      throw new Error("--id is required for --render-only or --upload-only.");
    }
    let run = null;
    if (args.renderOnly) {
      run = await renderWorldCupRun(args.id, options);
    }
    if (args.uploadOnly) {
      run = await uploadWorldCupRun(args.id);
    }
    console.log(JSON.stringify(summarize(run), null, 2));
    return;
  }

  let run = await generateWorldCupRun(options);
  if (options.render && run.status !== "rendered" && run.status !== "uploaded") {
    run = await renderWorldCupRun(run.id, options);
  }
  if (options.upload && run.status !== "uploaded") {
    run = await uploadWorldCupRun(run.id);
  }
  console.log(JSON.stringify(summarize(run), null, 2));
}

main().catch((error) => {
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
