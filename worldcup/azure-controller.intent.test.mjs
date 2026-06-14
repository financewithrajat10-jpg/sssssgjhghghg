import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildEvergreenFallbackCandidate,
  candidateKey,
  controllerConfig,
  espnCandidateFromMatch,
  intentToWorldCupCommand,
  isVipMatch,
  loadControllerState,
  localYouTubeClusterCandidate,
  normalizeEspnEvent,
  openControllerDb,
  parseGemmaIntentPayload,
  parseTelegramWorldCupCommand,
  persistControllerState,
  selectCandidate,
  validateWorldCupIntent,
  workflowInputs,
  youtubeSpikeMetrics,
} from "./azure-controller.mjs";

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
  ]);
  assert.equal(inputs.mode, "prediction");
  assert.equal(inputs.match_id, "espn-401");
  assert.equal(inputs.team_a, "Argentina");
  assert.equal(inputs.team_b, "Brazil");
  assert.equal(inputs.topic, candidate.topic);
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

test("local YouTube cluster fallback returns a repeated-topic candidate", () => {
  const candidate = localYouTubeClusterCandidate(
    [
      { id: "a", title: "USA World Cup lineup pressure explained", channelTitle: "One", views: 5000, comments: 50, spike: { score: 86 } },
      { id: "b", title: "USMNT World Cup lineup problem grows", channelTitle: "Two", views: 7000, comments: 70, spike: { score: 88 } },
    ],
    { vipTeams: ["USA", "USMNT"], vipPlayers: [] },
  );
  assert.equal(candidate.source, "youtube-spike-cluster");
  assert.ok(candidate.score >= 88);
  assert.match(candidate.reason, /cluster/i);
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
