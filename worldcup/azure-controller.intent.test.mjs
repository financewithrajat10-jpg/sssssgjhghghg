import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildEvergreenFallbackCandidate,
  candidateKey,
  controllerWorkflowConclusion,
  controllerConfig,
  espnCandidateFromMatch,
  intentToWorldCupCommand,
  isVipMatch,
  loadControllerState,
  localYouTubeClusterCandidate,
  noCandidateNoticeDecision,
  normalizeEspnEvent,
  openControllerDb,
  parseGemmaIntentPayload,
  parseTelegramWorldCupCommand,
  persistControllerState,
  mp4EvidenceFromZip,
  runYouTubeDiscoveryIfDue,
  runYouTubeStatsRefreshIfDue,
  buildYouTubeClusterCandidates,
  selectCandidate,
  validateWorldCupIntent,
  workflowInputs,
  youtubeRollingSpikeMetrics,
  youtubeSpikeMetrics,
} from "./azure-controller.mjs";

function mockYoutubeResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
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

test("auto-trending intent routes to discovery without trusting a model topic", () => {
  const intent = validateWorldCupIntent(
    {
      action: "discover_and_dispatch",
      type: "pre-tournament",
      topic: "Mbappe injury rumor from model memory",
      selectionMode: "auto_trending",
    },
    "create a video on any trending World Cup topic",
  );
  assert.equal(intent.action, "discover_and_dispatch");
  assert.equal(intent.topic, "");
  assert.equal(intent.needsTrendDiscovery, true);

  const command = intentToWorldCupCommand(intent);
  assert.equal(command.action, "discover_and_dispatch");
  assert.equal(command.candidate, undefined);
});

test("specific prediction intent becomes workflow-ready candidate inputs", () => {
  const intent = validateWorldCupIntent({
    action: "dispatch_specific",
    type: "prediction",
    teamA: "USA",
    teamB: "Paraguay",
    topic: "USA vs Paraguay pressure prediction",
    kickoff: "2026-06-13T02:00:00Z",
  });
  const command = intentToWorldCupCommand(intent);
  assert.equal(command.action, "dispatch");
  assert.equal(command.candidate.type, "prediction");
  assert.equal(command.candidate.teamA, "USA");
  assert.equal(command.candidate.teamB, "Paraguay");
  assert.equal(command.candidate.source, "telegram-intent");

  const inputs = workflowInputs(command.candidate);
  assert.equal(inputs.mode, "prediction");
  assert.equal(inputs.team_a, "USA");
  assert.equal(inputs.team_b, "Paraguay");
  assert.equal(inputs.topic, "USA vs Paraguay pressure prediction");
  assert.equal(inputs.upload_target, "telegram");
});

test("slash-prefixed natural auto trend request routes to discovery", () => {
  const command = parseTelegramWorldCupCommand("/wc Create a video on any trending World Cup topic");
  assert.equal(command.action, "discover_and_dispatch");
  assert.equal(command.intent.topic, "");
  assert.equal(command.intent.selectionMode, "auto_trending");
});

test("breaking-news intent is blocked until verification exists", () => {
  const intent = validateWorldCupIntent(
    {
      action: "dispatch_specific",
      type: "breaking-news",
      topic: "Mbappe injury before France match",
      event: "injury",
      entity: "Kylian Mbappe",
      needsVerification: true,
    },
    "make a breaking news short about Mbappe injury",
  );
  const command = intentToWorldCupCommand(intent);
  assert.equal(intent.needsVerification, true);
  assert.equal(command.action, "blocked_verification");
  assert.match(command.message, /verified current sources/i);
});

test("unclear model intent stays in clarify mode", () => {
  const intent = validateWorldCupIntent({
    action: "clarify",
    clarifyingQuestion: "Which match or topic should I use?",
  });
  const command = intentToWorldCupCommand(intent);
  assert.equal(command.action, "clarify");
  assert.match(command.message, /Which match/i);
});

test("invalid model JSON payload is rejected", () => {
  assert.throws(
    () => parseGemmaIntentPayload({ choices: [{ message: { content: "not json" } }] }),
    /JSON|intent/i,
  );
});

test("duplicate gate still blocks auto-discovered trend candidates", () => {
  const candidate = {
    type: "pre-tournament",
    topic: "USMNT World Cup pressure update",
    teamA: "USA",
    teamB: "",
    kickoff: "",
    score: 99,
    reason: "YouTube velocity signal.",
    source: "youtube",
    youtube: {
      id: "video-1",
      publishedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      views: 60000,
      comments: 300,
    },
  };
  const state = {
    dispatched: {
      [candidateKey(candidate)]: {
        candidate,
        dispatchedAt: new Date().toISOString(),
        workflowRun: { id: 123, conclusion: "success" },
      },
    },
  };
  const config = {
    dailyTotalLimit: 5,
    dailyTrendLimit: 5,
    requiredGroundedSources: 2,
    staleDispatchRetryMinutes: 120,
    trendCooldownMinutes: 0,
    trendThreshold: 95,
  };

  const result = selectCandidate([candidate], state, config);
  assert.equal(result.selected, null);
  assert.match(result.candidates[0].gate.reasons.join(" "), /duplicate/i);
});

test("recent failed fixture dispatch is cooled down instead of immediately repeated", () => {
  const candidate = {
    type: "prediction",
    topic: "Norway vs Iraq match planning: the pressure angle fans should watch",
    teamA: "Norway",
    teamB: "Iraq",
    kickoff: "2026-06-16T22:00:00.000Z",
    score: 100,
    reason: "Scheduled match window.",
    source: "espn-scoreboard",
  };
  const config = {
    dailyTotalLimit: 5,
    dailyTrendLimit: 5,
    failedDispatchCooldownMinutes: 360,
    requiredGroundedSources: 1,
    staleDispatchRetryMinutes: 120,
    trendCooldownMinutes: 0,
    trendThreshold: 95,
  };

  const recentFailed = {
    dispatched: {
      [candidateKey(candidate)]: {
        candidate,
        dispatchedAt: new Date().toISOString(),
        workflowRun: { id: 123, conclusion: "failure", completedAt: new Date().toISOString() },
      },
    },
  };
  const blocked = selectCandidate([candidate], recentFailed, config);
  assert.equal(blocked.selected, null);
  assert.match(blocked.candidates[0].gate.reasons.join(" "), /duplicate/i);

  const oldFailedAt = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
  const oldFailed = {
    dispatched: {
      [candidateKey(candidate)]: {
        candidate,
        dispatchedAt: oldFailedAt,
        workflowRun: { id: 124, conclusion: "failure", completedAt: oldFailedAt },
      },
    },
  };
  const allowed = selectCandidate([candidate], oldFailed, config);
  assert.equal(allowed.selected?.key, candidateKey(candidate));
});

test("ESPN event parsing creates VIP pre-match candidate inside configured window", () => {
  const event = {
    id: "401",
    date: "2026-06-14T20:00:00Z",
    name: "Argentina vs Brazil",
    status: { type: { description: "Scheduled", state: "pre", completed: false } },
    competitions: [
      {
        competitors: [
          { homeAway: "home", score: "0", team: { displayName: "Brazil" } },
          { homeAway: "away", score: "0", team: { displayName: "Argentina" } },
        ],
      },
    ],
  };
  const match = normalizeEspnEvent(event);
  assert.equal(match.home, "Brazil");
  assert.equal(match.away, "Argentina");
  assert.equal(isVipMatch(match, { vipTeams: ["Argentina"], vipPlayers: [] }), true);

  const candidate = espnCandidateFromMatch(
    match,
    { vipTeams: ["Argentina"], vipPlayers: [], prematchWindowStartHours: 12, prematchWindowEndHours: 24, postmatchDelayMinutes: 20 },
    new Date("2026-06-14T04:00:00Z"),
  );
  assert.equal(candidate.type, "prediction");
  assert.equal(candidate.source, "espn-scoreboard");
  assert.match(candidate.reason, /pre-match/i);
});

test("default ESPN pre-match trigger fires around 36 hours before kickoff", () => {
  const config = controllerConfig({ vipTeams: "France", vipPlayers: "" });
  assert.equal(config.prematchTargetHours, 36);
  assert.equal(config.postmatchDelayMinutes, 15);

  const match = {
    id: "403",
    name: "Senegal vs France",
    kickoff: "2026-06-16T19:00:00Z",
    status: "Scheduled",
    completed: false,
    home: "France",
    away: "Senegal",
    score: "Senegal 0 - 0 France",
  };
  assert.equal(espnCandidateFromMatch(match, config, new Date("2026-06-14T16:00:00Z")), null);
  const candidate = espnCandidateFromMatch(match, config, new Date("2026-06-15T07:00:00Z"));
  assert.equal(candidate.type, "prediction");
  assert.equal(candidate.source, "espn-scoreboard");
  assert.equal(candidate.dueAt, "2026-06-15T07:00:00.000Z");
});

test("broad ESPN filter catches major World Cup pre-match fixtures beyond the old env list", () => {
  const staleVmConfig = {
    vipTeams: ["France"],
    vipPlayers: [],
    prematchWindowStartHours: 12,
    prematchWindowEndHours: 72,
    postmatchDelayMinutes: 20,
  };
  const match = {
    id: "760428",
    name: "Cape Verde at Spain",
    kickoff: "2026-06-15T16:00:00Z",
    status: "Scheduled",
    completed: false,
    home: "Spain",
    away: "Cape Verde",
    score: "Spain 0 - 0 Cape Verde",
  };
  assert.equal(isVipMatch(match, staleVmConfig), true);

  const candidate = espnCandidateFromMatch(match, staleVmConfig, new Date("2026-06-14T16:30:00Z"));
  assert.equal(candidate.type, "prediction");
  assert.equal(candidate.teamA, "Cape Verde");
  assert.equal(candidate.teamB, "Spain");
});

test("broad ESPN filter catches Germany and Ivory Coast completed-match analysis", () => {
  const staleVmConfig = {
    vipTeams: ["France"],
    vipPlayers: [],
    prematchWindowStartHours: 12,
    prematchWindowEndHours: 72,
    postmatchDelayMinutes: 20,
  };
  const germany = {
    id: "760422",
    name: "Cura\u00e7ao at Germany",
    kickoff: "2026-06-14T17:00:00Z",
    status: "Full Time",
    completed: true,
    home: "Germany",
    away: "Cura\u00e7ao",
    score: "Germany 7 - 1 Cura\u00e7ao",
  };
  const ivoryCoast = {
    id: "760423",
    name: "Ecuador at Ivory Coast",
    kickoff: "2026-06-14T23:00:00Z",
    status: "Full Time",
    completed: true,
    home: "Ivory Coast",
    away: "Ecuador",
    score: "Ivory Coast 1 - 0 Ecuador",
  };

  const germanyCandidate = espnCandidateFromMatch(germany, staleVmConfig, new Date("2026-06-14T20:00:00Z"));
  const ivoryCoastCandidate = espnCandidateFromMatch(ivoryCoast, staleVmConfig, new Date("2026-06-15T02:00:00Z"));
  assert.equal(germanyCandidate.type, "postmatch");
  assert.equal(ivoryCoastCandidate.type, "postmatch");
});

test("VIP team matching avoids substring false positives", () => {
  assert.equal(
    isVipMatch(
      { home: "New Mexico United", away: "Orange County SC", name: "Orange County SC at New Mexico United" },
      { vipTeams: ["Mexico", "Arsenal"], vipPlayers: [] },
    ),
    false,
  );
  assert.equal(
    isVipMatch(
      { home: "Camioneros", away: "Arsenal Sarandi", name: "Arsenal Sarandi at Camioneros" },
      { vipTeams: ["Arsenal"], vipPlayers: [] },
    ),
    false,
  );
  assert.equal(
    isVipMatch({ home: "Brazil", away: "Morocco", name: "Morocco at Brazil" }, { vipTeams: ["Brazil"], vipPlayers: [] }),
    true,
  );
});

test("VIP player matching uses word boundaries", () => {
  assert.equal(isVipMatch({ home: "Team A", away: "Team B", name: "Messi returns for Team A" }, { vipTeams: [], vipPlayers: ["Messi"] }), true);
  assert.equal(isVipMatch({ home: "Team A", away: "Team B", name: "Messina derby preview" }, { vipTeams: [], vipPlayers: ["Messi"] }), false);
});

test("ESPN final status creates post-match candidate", () => {
  const match = {
    id: "402",
    name: "France vs England",
    kickoff: "2026-06-14T18:00:00Z",
    status: "Final",
    completed: true,
    home: "England",
    away: "France",
    score: "England 1 - 2 France",
  };
  const candidate = espnCandidateFromMatch(
    match,
    { vipTeams: ["France"], vipPlayers: [], prematchWindowStartHours: 12, prematchWindowEndHours: 24, postmatchDelayMinutes: 20 },
    new Date("2026-06-14T21:00:00Z"),
  );
  assert.equal(candidate.type, "postmatch");
  assert.match(candidate.reason, /Final score/i);
});

test("ESPN post-match waits for first completed seen time plus delay", () => {
  const match = {
    id: "402",
    name: "France vs England",
    kickoff: "2026-06-14T18:00:00Z",
    status: "Final",
    completed: true,
    firstCompletedSeenAt: "2026-06-14T20:10:00Z",
    home: "England",
    away: "France",
    score: "England 1 - 2 France",
  };
  const config = { vipTeams: ["France"], vipPlayers: [], postmatchDelayMinutes: 15, postmatchMaxAgeHours: 12 };
  assert.equal(espnCandidateFromMatch(match, config, new Date("2026-06-14T20:20:00Z")), null);
  const candidate = espnCandidateFromMatch(match, config, new Date("2026-06-14T20:25:00Z"));
  assert.equal(candidate.type, "postmatch");
  assert.equal(candidate.dueAt, "2026-06-14T20:25:00.000Z");
});

test("source types are scheduled equally by due time instead of hard priority", () => {
  const trend = {
    type: "pre-tournament",
    topic: "Germany World Cup reaction trend",
    teamA: "Germany",
    teamB: "",
    kickoff: "",
    score: 95,
    source: "youtube-spike-cluster",
    dueAt: "2026-06-14T10:00:00Z",
    evidence: Array.from({ length: 10 }, (_, index) => ({ title: `Germany trend ${index}`, channelTitle: `Channel ${index}` })),
  };
  const prediction = {
    type: "prediction",
    topic: "France vs England match planning: the pressure angle fans should watch",
    teamA: "France",
    teamB: "England",
    kickoff: "2026-06-16T22:00:00Z",
    score: 100,
    source: "espn-scoreboard",
    dueAt: "2026-06-15T10:00:00Z",
  };
  const result = selectCandidate([prediction, trend], { dispatched: {} }, {
    dailyTotalLimit: 10,
    dailyTrendLimit: 10,
    failedDispatchCooldownMinutes: 360,
    requiredGroundedSources: 1,
    staleDispatchRetryMinutes: 120,
    trendCooldownMinutes: 0,
    trendThreshold: 90,
  }, new Date("2026-06-15T12:00:00Z"));
  assert.equal(result.selected?.topic, trend.topic);
});

test("ESPN match dispatches do not consume the YouTube trend quota", () => {
  const trend = {
    type: "pre-tournament",
    topic: "Germany World Cup reaction trend",
    teamA: "Germany",
    teamB: "",
    kickoff: "",
    score: 95,
    source: "youtube-spike-cluster",
    dueAt: "2026-06-16T10:00:00Z",
    evidence: Array.from({ length: 10 }, (_, index) => ({ title: `Germany trend ${index}`, channelTitle: `Channel ${index}` })),
  };
  const espn = {
    type: "prediction",
    topic: "France vs England match planning: the pressure angle fans should watch",
    teamA: "France",
    teamB: "England",
    kickoff: "2026-06-16T22:00:00Z",
    score: 100,
    source: "espn-scoreboard",
  };
  const state = {
    dispatched: {
      [candidateKey(espn)]: {
        candidate: espn,
        dispatchedAt: "2026-06-16T01:00:00.000Z",
        workflowRun: { id: 1, conclusion: "success" },
      },
    },
  };
  const result = selectCandidate([trend], state, {
    dailyTotalLimit: 10,
    dailyTrendLimit: 1,
    failedDispatchCooldownMinutes: 360,
    requiredGroundedSources: 1,
    staleDispatchRetryMinutes: 120,
    trendCooldownMinutes: 0,
    trendThreshold: 90,
  }, new Date("2026-06-16T12:00:00Z"));
  assert.equal(result.selected?.topic, trend.topic);
});

test("ESPN candidate maps to GitHub workflow_dispatch inputs", () => {
  const candidate = {
    type: "prediction",
    topic: "Argentina vs Brazil match planning: the pressure angle fans should watch",
    teamA: "Argentina",
    teamB: "Brazil",
    kickoff: "2026-06-14T20:00:00Z",
    matchId: "espn-401",
    score: 100,
    source: "espn-scoreboard",
  };
  const previous = {
    WORLD_CUP_YOUTUBE_UPLOAD: process.env.WORLD_CUP_YOUTUBE_UPLOAD,
    WORLD_CUP_YOUTUBE_PRIVACY: process.env.WORLD_CUP_YOUTUBE_PRIVACY,
    WORLD_CUP_YOUTUBE_MAX_PER_DAY: process.env.WORLD_CUP_YOUTUBE_MAX_PER_DAY,
  };
  process.env.WORLD_CUP_YOUTUBE_UPLOAD = "true";
  process.env.WORLD_CUP_YOUTUBE_PRIVACY = "public";
  process.env.WORLD_CUP_YOUTUBE_MAX_PER_DAY = "5";
  try {
    const inputs = workflowInputs(candidate);
    assert.deepEqual(Object.keys(inputs).sort(), [
      "allow_needs_review_upload",
      "date",
      "force",
      "kickoff",
      "match_id",
      "max_script_retries",
      "max_visual_retries",
      "mode",
      "quality_mode",
      "render",
      "strategy",
      "strict_publish",
      "team_a",
      "team_b",
      "telegram_send_failed_mp4",
      "topic",
      "upload",
      "upload_target",
      "youtube_max_per_day",
      "youtube_privacy",
      "youtube_upload",
    ]);
    assert.equal(inputs.mode, "prediction");
    assert.equal(inputs.match_id, "espn-401");
    assert.equal(inputs.team_a, "Argentina");
    assert.equal(inputs.team_b, "Brazil");
    assert.equal(inputs.topic, candidate.topic);
    assert.equal(inputs.allow_needs_review_upload, "true");
    assert.equal(inputs.strict_publish, "false");
    assert.equal(inputs.telegram_send_failed_mp4, "true");
    assert.equal(inputs.youtube_upload, "true");
    assert.equal(inputs.youtube_privacy, "public");
    assert.equal(inputs.youtube_max_per_day, "5");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("cloud workflow classifier accepts failed GitHub run when match MP4 artifact exists", () => {
  const candidate = {
    type: "prediction",
    topic: "Norway vs Iraq match planning: the pressure angle fans should watch",
    teamA: "Norway",
    teamB: "Iraq",
    kickoff: "2026-06-16T22:00:00.000Z",
    source: "espn-scoreboard",
  };
  const classified = controllerWorkflowConclusion(candidate, { conclusion: "failure" }, { hasMp4: true });
  assert.equal(classified.conclusion, "success");
  assert.equal(classified.githubConclusion, "failure");
  assert.equal(classified.cloudSuccessReason, "mp4_artifact_present");
});

test("cloud workflow classifier keeps non-MP4 failures retryable", () => {
  const candidate = {
    type: "prediction",
    topic: "Norway vs Iraq match planning: the pressure angle fans should watch",
    teamA: "Norway",
    teamB: "Iraq",
    kickoff: "2026-06-16T22:00:00.000Z",
    source: "espn-scoreboard",
  };
  const classified = controllerWorkflowConclusion(candidate, { conclusion: "failure" }, { hasMp4: false });
  assert.equal(classified.conclusion, "failure");
  assert.equal(classified.githubConclusion, "failure");
  assert.equal(classified.cloudSuccessReason, "");
});

test("artifact ZIP MP4 detector finds non-empty MP4 entries", () => {
  const name = Buffer.from("runs/demo/video.mp4");
  const payload = Buffer.from("mp4");
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt32LE(0, 10);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(payload.length, 18);
  localHeader.writeUInt32LE(payload.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28);
  const local = Buffer.concat([localHeader, name, payload]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt32LE(0, 12);
  centralHeader.writeUInt32LE(0, 16);
  centralHeader.writeUInt32LE(payload.length, 20);
  centralHeader.writeUInt32LE(payload.length, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);
  const central = Buffer.concat([centralHeader, name]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length, 16);
  eocd.writeUInt16LE(0, 20);

  const evidence = mp4EvidenceFromZip(Buffer.concat([local, central, eocd]));
  assert.equal(evidence.hasMp4, true);
  assert.equal(evidence.mp4Entries[0].name, "runs/demo/video.mp4");
});

test("legacy trigger config defaults off", () => {
  const config = controllerConfig({});
  assert.equal(config.legacyTriggerEnabled, false);
});

test("SQLite controller state persists dispatched duplicates", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wc-controller-"));
  const config = controllerConfig({
    dbFile: path.join(tempDir, "controller.sqlite"),
    stateFile: path.join(tempDir, "legacy.json"),
  });
  const db = await openControllerDb(config);
  try {
    const candidate = {
      type: "prediction",
      topic: "USA vs Mexico World Cup pressure prediction",
      teamA: "USA",
      teamB: "Mexico",
      kickoff: "2026-06-15T20:00:00Z",
      score: 100,
      source: "espn-scoreboard",
    };
    const key = candidateKey(candidate);
    const state = await loadControllerState(config, db);
    state.dispatched[key] = {
      key,
      candidate,
      dispatchedAt: "2026-06-14T12:00:00.000Z",
      workflowRun: { id: 99, conclusion: "success" },
    };
    persistControllerState(db, state);

    const reloaded = await loadControllerState(config, db);
    const result = selectCandidate([candidate], reloaded, {
      dailyTotalLimit: 5,
      dailyTrendLimit: 5,
      requiredGroundedSources: 1,
      staleDispatchRetryMinutes: 120,
      trendCooldownMinutes: 0,
      trendThreshold: 95,
    });
    assert.equal(result.selected, null);
    assert.match(result.candidates[0].gate.reasons.join(" "), /duplicate/i);
  } finally {
    db.close();
  }
});

test("YouTube spike metrics detect stronger current velocity", () => {
  const now = new Date("2026-06-14T12:00:00Z");
  const metrics = youtubeSpikeMetrics(
    {
      title: "USA World Cup lineup pressure is exploding",
      publishedAt: "2026-06-14T09:00:00Z",
      views: 5000,
      comments: 80,
    },
    {
      scanned_at: "2026-06-14T11:30:00Z",
      views: 1000,
      comments: 10,
    },
    now,
  );
  assert.equal(metrics.hasPrevious, true);
  assert.ok(metrics.deltaViewsPerHour > metrics.lifetimeViewsPerHour);
  assert.ok(metrics.viewMultiplier > 1);
  assert.ok(metrics.score >= 80);
});

test("local YouTube cluster fallback requires the configured repeated-topic threshold", () => {
  const twoVideoCluster = localYouTubeClusterCandidate(
    [
      { id: "a", title: "USA World Cup lineup pressure explained", channelTitle: "One", views: 5000, comments: 50, spike: { score: 86 } },
      { id: "b", title: "USMNT World Cup lineup problem grows", channelTitle: "Two", views: 7000, comments: 70, spike: { score: 88 } },
    ],
    { vipTeams: ["USA", "USMNT"], vipPlayers: [] },
  );
  assert.equal(twoVideoCluster, null);

  const candidate = localYouTubeClusterCandidate(
    Array.from({ length: 10 }, (_, index) => ({
      id: `usa-${index}`,
      title: `USA World Cup lineup pressure explained part ${index}`,
      channelTitle: `Channel ${index % 4}`,
      views: 5000 + index,
      comments: 50,
      spike: { score: 90, deltaViews: 2000, growthPercent: 120 },
    })),
    {
      vipTeams: ["USA", "USMNT"],
      vipPlayers: [],
      youtubeTopicMinSpikeVideos: 10,
      youtubeTopicMinChannels: 4,
      youtubeTopicMinConfidence: 75,
    },
  );
  assert.equal(candidate.source, "youtube-spike-cluster");
  assert.ok(candidate.score >= 88);
  assert.match(candidate.reason, /cluster/i);
});

test("rolling YouTube spike metrics require baseline and doubled 30-minute growth", () => {
  const config = controllerConfig({ youtubeApiKeys: "test" });
  const now = new Date("2026-06-14T12:30:00Z");
  const eligible = youtubeRollingSpikeMetrics(
    { title: "USA World Cup lineup pressure explained", views: 2200, comments: 40 },
    { scanned_at: "2026-06-14T12:00:00Z", views: 1000, comments: 20 },
    config,
    now,
  );
  assert.equal(eligible.eligible, true);
  assert.equal(Math.round(eligible.growthPercent), 120);

  const tinyBaseline = youtubeRollingSpikeMetrics(
    { title: "USA World Cup lineup pressure explained", views: 200, comments: 4 },
    { scanned_at: "2026-06-14T12:00:00Z", views: 50, comments: 1 },
    config,
    now,
  );
  assert.equal(tinyBaseline.eligible, false);
  assert.match(tinyBaseline.rejectionReason, /baseline/i);

  const strongDelta = youtubeRollingSpikeMetrics(
    { title: "USA World Cup lineup pressure explained", views: 17000, comments: 80 },
    { scanned_at: "2026-06-14T12:00:00Z", views: 6000, comments: 20 },
    config,
    now,
  );
  assert.equal(strongDelta.eligible, true);
});

test("rolling YouTube discovery collects 100 videos with two search calls", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wc-youtube-discovery-"));
  const previousQueries = process.env.WORLD_CUP_TREND_QUERIES;
  process.env.WORLD_CUP_TREND_QUERIES = "FIFA World Cup 2026|football World Cup";
  const config = controllerConfig({
    dbFile: path.join(tempDir, "controller.sqlite"),
    youtubeApiKeys: "test-key",
    youtubeDiscoveryMaxPerRun: 100,
    youtubeDiscoveryIntervalMinutes: 60,
  });
  const db = await openControllerDb(config);
  const fetchCalls = [];
  try {
    await withMockedFetch(async (url) => {
      fetchCalls.push(String(url));
      const parsed = new URL(String(url));
      assert.equal(parsed.pathname, "/youtube/v3/search");
      const query = parsed.searchParams.get("q").replace(/\W+/g, "-").toLowerCase();
      const items = Array.from({ length: 50 }, (_, index) => ({
        id: { videoId: `${query}-${index}` },
        snippet: {
          title: `USA World Cup lineup pressure ${query} ${index}`,
          channelTitle: `Discovery Channel ${index}`,
          publishedAt: "2026-06-14T12:00:00Z",
        },
      }));
      return mockYoutubeResponse({ items });
    }, async () => {
      const result = await runYouTubeDiscoveryIfDue(config, db, [], new Date("2026-06-14T13:00:00Z"));
      assert.equal(result.ran, true);
      assert.equal(result.apiCalls, 2);
      assert.equal(result.videosFound, 100);
      assert.equal(result.newVideos, 100);
      assert.equal(result.activePoolSize, 100);
    });
    assert.equal(fetchCalls.length, 2);
  } finally {
    if (previousQueries === undefined) delete process.env.WORLD_CUP_TREND_QUERIES;
    else process.env.WORLD_CUP_TREND_QUERIES = previousQueries;
    db.close();
  }
});

test("rolling YouTube stats refresh batches pool and detects 100 percent spikes", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wc-youtube-stats-"));
  const previousQueries = process.env.WORLD_CUP_TREND_QUERIES;
  process.env.WORLD_CUP_TREND_QUERIES = "FIFA World Cup 2026|football World Cup";
  const config = controllerConfig({
    dbFile: path.join(tempDir, "controller.sqlite"),
    youtubeApiKeys: "test-key",
    youtubeDiscoveryMaxPerRun: 100,
    youtubeDiscoveryIntervalMinutes: 60,
    youtubeStatsIntervalMinutes: 30,
    youtubeTopicMinSpikeVideos: 10,
    youtubeTopicMinChannels: 4,
  });
  const db = await openControllerDb(config);
  try {
    await withMockedFetch(async (url) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith("/search")) {
        const query = parsed.searchParams.get("q").replace(/\W+/g, "-").toLowerCase();
        return mockYoutubeResponse({
          items: Array.from({ length: 50 }, (_, index) => ({
            id: { videoId: `${query}-${index}` },
            snippet: {
              title: `USA World Cup lineup pressure ${query} ${index}`,
              channelTitle: `Channel ${index % 8}`,
              publishedAt: "2026-06-14T12:00:00Z",
            },
          })),
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }, async () => {
      await runYouTubeDiscoveryIfDue(config, db, [], new Date("2026-06-14T13:00:00Z"));
    });

    let statsCallCount = 0;
    await withMockedFetch(async (url) => {
      const parsed = new URL(String(url));
      assert.equal(parsed.pathname, "/youtube/v3/videos");
      statsCallCount += 1;
      const ids = parsed.searchParams.get("id").split(",");
      return mockYoutubeResponse({
        items: ids.map((id) => ({
          id,
          snippet: {
            title: `USA World Cup lineup pressure ${id}`,
            channelTitle: `Channel ${id.split("-").at(-1) % 8}`,
            publishedAt: "2026-06-14T12:00:00Z",
          },
          statistics: { viewCount: "1000", commentCount: "20" },
        })),
      });
    }, async () => {
      const first = await runYouTubeStatsRefreshIfDue(config, db, [], new Date("2026-06-14T13:30:00Z"));
      assert.equal(first.batchesRequested, 2);
      assert.equal(first.videosUpdated, 100);
      assert.equal(first.spikeEligible, 0);
    });
    assert.equal(statsCallCount, 2);

    await withMockedFetch(async (url) => {
      const ids = new URL(String(url)).searchParams.get("id").split(",");
      return mockYoutubeResponse({
        items: ids.map((id) => ({
          id,
          snippet: {
            title: `USA World Cup lineup pressure ${id}`,
            channelTitle: `Channel ${id.split("-").at(-1) % 8}`,
            publishedAt: "2026-06-14T12:00:00Z",
          },
          statistics: { viewCount: "2200", commentCount: "50" },
        })),
      });
    }, async () => {
      const second = await runYouTubeStatsRefreshIfDue(config, db, [], new Date("2026-06-14T14:00:00Z"));
      assert.equal(second.batchesRequested, 2);
      assert.equal(second.videosUpdated, 100);
      assert.equal(second.spikeEligible, 100);
    });
  } finally {
    if (previousQueries === undefined) delete process.env.WORLD_CUP_TREND_QUERIES;
    else process.env.WORLD_CUP_TREND_QUERIES = previousQueries;
    db.close();
  }
});

test("rolling YouTube cluster requires 10 spike videos before creating workflow inputs", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wc-youtube-cluster-"));
  const config = controllerConfig({
    dbFile: path.join(tempDir, "controller.sqlite"),
    youtubeApiKeys: "test-key",
    youtubeTopicMinSpikeVideos: 10,
    youtubeTopicMinChannels: 4,
    youtubeTopicMinConfidence: 75,
    youtubeClusterAnalyzer: "local",
  });
  const db = await openControllerDb(config);
  try {
    const nine = {
      eligibleVideos: Array.from({ length: 9 }, (_, index) => ({
        id: `usa-${index}`,
        title: `USA World Cup lineup pressure ${index}`,
        channelTitle: `Channel ${index % 4}`,
        views: 2200,
        comments: 50,
        spike: { score: 90, deltaViews: 1200, growthPercent: 120 },
      })),
    };
    const nineResult = await buildYouTubeClusterCandidates(config, db, [], nine, new Date("2026-06-14T14:00:00Z"));
    assert.equal(nineResult.candidates.length, 0);

    const ten = {
      eligibleVideos: Array.from({ length: 10 }, (_, index) => ({
        id: `usa-${index}`,
        title: `USA World Cup lineup pressure ${index}`,
        channelTitle: `Channel ${index % 4}`,
        views: 2200,
        comments: 50,
        spike: { score: 90, deltaViews: 1200, growthPercent: 120 },
      })),
    };
    const tenResult = await buildYouTubeClusterCandidates(config, db, [], ten, new Date("2026-06-14T14:30:00Z"));
    assert.equal(tenResult.candidates.length, 1);
    const inputs = workflowInputs(tenResult.candidates[0]);
    assert.equal(inputs.topic.includes("USA"), true);
    assert.equal(inputs.force, "true");
  } finally {
    db.close();
  }
});

test("evergreen fallback can pass the gate when strict trend threshold would block normal trends", () => {
  const config = {
    evergreenFallback: true,
    dailyTotalLimit: 5,
    dailyTrendLimit: 5,
    requiredGroundedSources: 1,
    staleDispatchRetryMinutes: 120,
    trendCooldownMinutes: 0,
    trendThreshold: 95,
  };
  const state = { dispatched: {} };
  const fallback = buildEvergreenFallbackCandidate(state, config, new Date("2026-06-14T12:00:00Z"));
  const result = selectCandidate([fallback], state, config, new Date("2026-06-14T12:00:00Z"));
  assert.equal(result.selected.source, "evergreen-fallback");
});

test("duplicate-only no-candidate scans do not spam Telegram notices", () => {
  const decision = noCandidateNoticeDecision(
    {},
    {
      candidates: [
        {
          key: "espn-duplicate",
          score: 99,
          gate: { reasons: ["duplicate candidate already dispatched"] },
        },
      ],
      diagnostics: {
        espnCandidates: 1,
        youtubeSpikeCandidates: 0,
        youtubeCandidates: 0,
        geminiTrendCandidate: false,
        evergreenCandidate: true,
      },
    },
    { skipNoticeCooldownMinutes: 180 },
    new Date("2026-06-14T12:00:00Z"),
  );

  assert.equal(decision.send, false);
  assert.match(decision.reason, /duplicate/i);
});

test("routine daily-limit no-candidate scans do not spam Telegram notices", () => {
  const decision = noCandidateNoticeDecision(
    {},
    {
      candidates: [
        {
          key: "fallback-limit",
          score: 80,
          gate: {
            reasons: [
              "daily trend limit reached (1/1)",
              "trend cooldown active (24/120 minutes)",
            ],
          },
        },
      ],
      diagnostics: {
        espnCandidates: 0,
        youtubeSpikeCandidates: 0,
        youtubeCandidates: 0,
        geminiTrendCandidate: false,
        evergreenCandidate: true,
      },
    },
    { skipNoticeCooldownMinutes: 180 },
    new Date("2026-06-14T12:00:00Z"),
  );

  assert.equal(decision.send, false);
  assert.match(decision.reason, /daily trend limit|cooldown/i);
});

test("non-duplicate no-candidate notices are throttled by notice key", () => {
  const scan = {
    candidates: [
      {
        key: "trend-too-weak",
        score: 82,
        gate: { reasons: ["trend score 82 is below strict threshold 95"] },
      },
    ],
    diagnostics: {
      espnCandidates: 0,
      youtubeSpikeCandidates: 1,
      youtubeCandidates: 0,
      geminiTrendCandidate: false,
      evergreenCandidate: false,
    },
  };
  const config = { skipNoticeCooldownMinutes: 180 };
  const first = noCandidateNoticeDecision({}, scan, config, new Date("2026-06-14T12:00:00Z"));
  const second = noCandidateNoticeDecision(
    {
      lastNoCandidateNoticeKey: first.key,
      lastNoCandidateNoticeAt: "2026-06-14T12:00:00.000Z",
    },
    scan,
    config,
    new Date("2026-06-14T13:00:00Z"),
  );

  assert.equal(first.send, true);
  assert.equal(second.send, false);
  assert.match(second.reason, /cooldown/i);
});
