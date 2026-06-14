import assert from "node:assert/strict";
import test from "node:test";
import { scoreCaptionAudioGateV2, scoreStoryboardGateV2 } from "./modules/quality-v2.mjs";

function visualSegments(count) {
  return Array.from({ length: count }, (_, index) => ({
    selectedClip: {
      id: `clip-${index + 1}`,
      provider: "pexels",
    },
  }));
}

test("one missing central entity overlay is a review issue, not a pre-render block", () => {
  const run = {
    visualPlan: { segments: visualSegments(13) },
  };
  const storyboard = Array.from({ length: 13 }, (_, index) => ({
    segment: index + 1,
    retryReason: index === 11 ? "central entity has no entity image/overlay" : "",
  }));

  const gate = scoreStoryboardGateV2({ run, storyboard });

  assert.equal(gate.pass, true);
  assert.deepEqual(gate.hardFails, []);
  assert.deepEqual(gate.entityMisses, [12]);
  assert.equal(gate.entityMissTolerance, 1);
  assert.match(gate.issues.join("\n"), /tolerated because real visual coverage passed/i);
});

test("multiple missing central entity overlays still block pre-render publishing", () => {
  const run = {
    visualPlan: { segments: visualSegments(13) },
  };
  const storyboard = Array.from({ length: 13 }, (_, index) => ({
    segment: index + 1,
    retryReason: index === 4 || index === 11 ? "central entity has no entity image/overlay" : "",
  }));

  const gate = scoreStoryboardGateV2({ run, storyboard });

  assert.equal(gate.pass, false);
  assert.match(gate.hardFails.join("\n"), /2 central entity segment\(s\)/i);
});

test("caption coverage near the target warns instead of blocking", () => {
  const gate = scoreCaptionAudioGateV2({
    run: {
      files: { audio: "audio.wav" },
      audio: { durationSeconds: 48.5 },
      srt: {
        segments: [
          {
            number: 1,
            startTime: 0,
            endTime: 44.5,
            text: "A complete caption block with slight tail silence.",
          },
        ],
      },
      captionPlan: { segments: [] },
    },
  });

  assert.equal(gate.pass, true);
  assert.deepEqual(gate.hardFails, []);
  assert.ok(gate.coverage > 0.91 && gate.coverage < 0.92);
  assert.match(gate.issues.join("\n"), /below target 0\.92 but above hard floor 0\.90/i);
});

test("caption coverage below the hard floor still blocks", () => {
  const gate = scoreCaptionAudioGateV2({
    run: {
      files: { audio: "audio.wav" },
      audio: { durationSeconds: 50 },
      srt: {
        segments: [
          {
            number: 1,
            startTime: 0,
            endTime: 40,
            text: "This caption misses too much of the audio.",
          },
        ],
      },
      captionPlan: { segments: [] },
    },
  });

  assert.equal(gate.pass, false);
  assert.match(gate.hardFails.join("\n"), /below hard floor 0\.90/i);
});
