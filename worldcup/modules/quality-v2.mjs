import {
  cleanText,
  nowIso,
  stripTagsForSpeech,
  WORLD_CUP_V2_FINAL_PUBLISH_SCORE,
  WORLD_CUP_V2_SCRIPT_PUBLISH_SCORE,
} from "./utils.mjs";
import { firstSentence, hasViralContradiction, scoreFirstThreeSecondHook, scoreViral2Script } from "./script.mjs";

export const V2_BLOCKED_STATUSES = new Set(["pre_render_blocked", "rendered_needs_review"]);

export const V2_OVERUSED_PHRASES = [
  "comment section",
  "coaching license",
  "group chat becomes a courtroom",
  "football jail",
  "career mode with no restart button",
];

export function qualityV2Enabled(options = {}) {
  return cleanText(options.qualityMode || options.quality_mode || "").toLowerCase() === "v2";
}

export function ensureQualityV2(run, options = {}) {
  run.qualityV2 ||= {};
  run.qualityV2.version ||= "worldcup-quality-v2";
  run.qualityV2.mode ||= qualityV2Enabled(options) ? "v2" : "off";
  run.qualityV2.strictPublish = Boolean(options.strictPublish);
  run.qualityV2.statusHistory = Array.isArray(run.qualityV2.statusHistory) ? run.qualityV2.statusHistory : [];
  run.qualityV2.gates = run.qualityV2.gates && typeof run.qualityV2.gates === "object" ? run.qualityV2.gates : {};
  run.qualityV2.finalDecision ||= "";
  run.qualityV2.finalScore ||= 0;
  run.qualityV2.issues = Array.isArray(run.qualityV2.issues) ? run.qualityV2.issues : [];
  run.qualityV2.checkedAt ||= "";
  run.retryLog ||= {};
  run.retryLog.version ||= "worldcup-retry-log-v2";
  run.retryLog.entries = Array.isArray(run.retryLog.entries) ? run.retryLog.entries : [];
  return run.qualityV2;
}

export function setV2Status(run, status, details = {}) {
  const quality = ensureQualityV2(run, { qualityMode: "v2", strictPublish: true });
  const row = { at: nowIso(), status, ...details };
  quality.statusHistory.push(row);
  quality.statusHistory = quality.statusHistory.slice(-80);
  run.status = status;
  return row;
}

export function addRetryLog(run, stage, attempt, result = {}) {
  ensureQualityV2(run, { qualityMode: "v2", strictPublish: true });
  run.retryLog.entries.push({
    at: nowIso(),
    stage,
    attempt,
    score: Number(result.score || result.total || 0),
    pass: Boolean(result.pass),
    issues: Array.isArray(result.issues) ? result.issues.slice(0, 8) : [],
    hardFails: Array.isArray(result.hardFails) ? result.hardFails.slice(0, 8) : [],
  });
  run.retryLog.entries = run.retryLog.entries.slice(-80);
}

export function scriptWordCount(script = {}) {
  return stripTagsForSpeech(script.text || script.screenplay || "")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function firstSentenceOf(text) {
  return firstSentence(text) || cleanText(text).slice(0, 140);
}

export function recentForbiddenPhrases(memory = {}) {
  const haystack = [
    ...(memory.recentHooks || []),
    ...(memory.recentAngles || []),
    ...(memory.recentMemorableLines || []),
    ...(memory.recentTopics || []),
  ].join(" | ").toLowerCase();
  return V2_OVERUSED_PHRASES.filter((phrase) => haystack.includes(phrase));
}

export function scoreScriptGateV2({ script, evidence, viralStrategy, memory, options = {} }) {
  const base = scoreViral2Script(script, evidence, viralStrategy);
  const text = cleanText(script?.text || "");
  const lower = text.toLowerCase();
  const opening = firstSentenceOf(text);
  const words = scriptWordCount(script);
  const firstThree = scoreFirstThreeSecondHook(text, evidence);
  const forbiddenRecent = recentForbiddenPhrases(memory);
  const issues = [];
  const hardFails = [...(base.hardFails || [])];

  if (base.decision !== "publish_candidate") {
    issues.push(`Viral 2.0 base gate returned ${base.decision}.`);
  }
  if (Number(base.total || 0) < Number(options.scriptPublishScore || WORLD_CUP_V2_SCRIPT_PUBLISH_SCORE)) {
    issues.push(`Script score ${Number(base.total || 0).toFixed(0)} is below V2 publish score ${options.scriptPublishScore || WORLD_CUP_V2_SCRIPT_PUBLISH_SCORE}.`);
  }
  if (!hasViralContradiction(opening) || firstThree.decision !== "pass") {
    hardFails.push("First sentence does not create opinion, contradiction, risk, or curiosity in the first 1-3 seconds.");
  }
  if (words < 75 || words > 115) {
    hardFails.push(`Spoken length must be 75-115 words; current length is ${words}.`);
  }
  for (const phrase of forbiddenRecent) {
    if (lower.includes(phrase)) {
      hardFails.push(`Recent overused phrase repeated: "${phrase}".`);
    }
  }

  const uniqueHardFails = [...new Set(hardFails.map(cleanText).filter(Boolean))];
  const scorePenalty = uniqueHardFails.length * 4 + Math.max(0, issues.length - 1) * 2;
  const total = Math.max(0, Math.min(100, Number(base.total || 0) - scorePenalty));
  const threshold = Number(options.scriptPublishScore || WORLD_CUP_V2_SCRIPT_PUBLISH_SCORE);
  const pass = total >= threshold && uniqueHardFails.length === 0 && base.decision === "publish_candidate";
  return {
    version: "script-v2",
    pass,
    total,
    threshold,
    decision: pass ? "publish_candidate" : "revise",
    opening,
    words,
    issues,
    hardFails: uniqueHardFails,
    forbiddenRecent,
    base,
    checkedAt: nowIso(),
  };
}

export function visualId(segment = {}) {
  if (segment.selectedClip?.id) return `clip:${segment.selectedClip.id}`;
  if (segment.selectedImage?.id) return `image:${segment.selectedImage.id}`;
  const overlayIds = (segment.entityOverlay?.assets || []).map((item) => item.asset?.id).filter(Boolean);
  if (overlayIds.length) return `overlay:${overlayIds.join("+")}`;
  return "";
}

export function segmentHasRealVisual(segment = {}) {
  return Boolean(segment.selectedClip || segment.selectedImage || segment.entityOverlay?.assets?.length);
}

export function segmentVisualSource(segment = {}) {
  if (segment.selectedClip && segment.entityOverlay?.assets?.length) return `${segment.selectedClip.provider || "stock"}+local-entity`;
  if (segment.selectedClip) return segment.selectedClip.provider || "stock";
  if (segment.selectedImage) return segment.selectedImage.provider || "image";
  if (segment.entityOverlay?.assets?.length) return "local-entity";
  return "fallback";
}

export function segmentVisualLabel(segment = {}) {
  const overlayLabel = (segment.entityOverlay?.assets || [])
    .map((item) => cleanText(item.entity || item.asset?.localEntity?.name || item.asset?.title || item.asset?.id))
    .filter(Boolean)
    .join(" + ");
  if (segment.selectedClip) {
    const clipLabel = cleanText(segment.selectedClip.title || segment.selectedClip.id || "stock clip");
    return overlayLabel ? `${overlayLabel} over ${clipLabel}` : clipLabel;
  }
  if (segment.selectedImage) return cleanText(segment.selectedImage.title || segment.selectedImage.id || "image");
  if (overlayLabel) return overlayLabel;
  return cleanText(segment.fallback?.headline || segment.visualPrompt || "fallback board");
}

export function evidenceEntities(evidence = {}) {
  const rows = [];
  for (const team of [evidence.match?.teamA, evidence.match?.teamB]) {
    if (cleanText(team)) rows.push({ name: cleanText(team), type: "team" });
  }
  for (const player of Array.isArray(evidence.keyPlayers) ? evidence.keyPlayers : []) {
    if (cleanText(player.name)) rows.push({ name: cleanText(player.name), type: "player", team: cleanText(player.team || "") });
  }
  return [...new Map(rows.map((row) => [row.name.toLowerCase(), row])).values()];
}

export function centralEntitiesForText(text, evidence = {}) {
  const lower = cleanText(text).toLowerCase();
  return evidenceEntities(evidence).filter((entity) => {
    const name = entity.name.toLowerCase();
    const last = name.split(/\s+/).slice(-1)[0];
    return lower.includes(name) || (last.length >= 4 && lower.includes(last));
  });
}

export function buildStoryboard(run = {}) {
  const srtSegments = Array.isArray(run.srt?.segments) ? run.srt.segments : [];
  const visualSegments = Array.isArray(run.visualPlan?.segments) ? run.visualPlan.segments : [];
  return srtSegments.map((caption, index) => {
    const visual = visualSegments[index] || {};
    const entities = centralEntitiesForText(caption.text, run.evidence);
    const id = visualId(visual);
    const retryReasons = [];
    if (!segmentHasRealVisual(visual)) retryReasons.push("fallback visual");
    if (entities.length && !visual.entityOverlay?.assets?.length && !visual.selectedImage) retryReasons.push("central entity has no entity image/overlay");
    if (index === 0 && !visual.entityOverlay?.assets?.length && segmentVisualSource(visual) !== "local-entity" && !visual.selectedImage && /stadium|crowd|football atmosphere/i.test(segmentVisualLabel(visual))) {
      retryReasons.push("first visual appears generic for the hook");
    }
    return {
      segment: caption.number || index + 1,
      timeRange: `${Number(caption.startTime || 0).toFixed(2)}-${Number(caption.endTime || 0).toFixed(2)}s`,
      caption: cleanText(caption.text),
      entityOrTopic: entities.map((entity) => entity.name).join(", ") || cleanText(run.topic || run.evidence?.topic || ""),
      selectedVisual: segmentVisualLabel(visual),
      visualId: id,
      source: segmentVisualSource(visual),
      reason: cleanText(visual.reason || visual.intent || visual.visualIntent || ""),
      risk: cleanText(visual.risk || visual.rightsStatus || visual.selectedClip?.rightsStatus || visual.selectedImage?.rightsStatus || "approved"),
      retryReason: retryReasons.join("; "),
    };
  });
}

export function scoreStoryboardGateV2({ run, storyboard, options = {} }) {
  const rows = Array.isArray(storyboard) ? storyboard : buildStoryboard(run);
  const segments = Array.isArray(run.visualPlan?.segments) ? run.visualPlan.segments : [];
  const total = Math.max(1, segments.length);
  const fallbackCount = segments.filter((segment) => !segmentHasRealVisual(segment)).length;
  const realVisualRatio = segments.filter(segmentHasRealVisual).length / total;
  const clipRatio = segments.filter((segment) => Boolean(segment.selectedClip)).length / total;
  const ids = segments.map(visualId).filter(Boolean);
  const uniqueVisualRatio = ids.length ? new Set(ids).size / ids.length : 0;
  const stockIds = segments.filter((segment) => segment.selectedClip).map((segment) => segment.selectedClip.id).filter(Boolean);
  const repeatedStockIds = [...new Set(stockIds.filter((id, index) => stockIds.indexOf(id) !== index))];
  const entityMisses = rows.filter((row) => /central entity has no entity image\/overlay/i.test(row.retryReason));
  const firstRow = rows[0] || {};
  const issues = [];
  const blocking = [];

  if (fallbackCount > 0) {
    blocking.push(`Fallback visuals are not allowed in V2 publish mode (${fallbackCount} found).`);
  }
  if (realVisualRatio < 1) blocking.push(`Real visual coverage is ${Math.round(realVisualRatio * 100)}%, below required 100%.`);
  if (uniqueVisualRatio < 0.82) blocking.push(`Unique visual ratio is ${uniqueVisualRatio.toFixed(2)}, below 0.82.`);
  if (clipRatio < 0.6) blocking.push(`Clip ratio is ${clipRatio.toFixed(2)}, below 0.60.`);
  if (repeatedStockIds.length) blocking.push(`Same stock clip reused in this video: ${repeatedStockIds.slice(0, 3).join(", ")}.`);
  if (entityMisses.length) blocking.push(`${entityMisses.length} central entity segment(s) have no entity image/overlay.`);
  if (/generic|stadium|crowd|football atmosphere/i.test(firstRow.retryReason || "")) blocking.push("First visual does not clearly match the hook entity/topic.");
  if (!segments.length) blocking.push("No visual segments were planned.");
  if (rows.some((row) => row.retryReason)) {
    issues.push(...rows.map((row) => row.retryReason).filter(Boolean).slice(0, 6));
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        fallbackCount * 18 -
        Math.max(0, 1 - realVisualRatio) * 35 -
        Math.max(0, 0.82 - uniqueVisualRatio) * 40 -
        Math.max(0, 0.6 - clipRatio) * 30 -
        repeatedStockIds.length * 10 -
        entityMisses.length * 8,
    ),
  );
  return {
    version: "storyboard-visual-v2",
    pass: blocking.length === 0,
    score,
    fallbackCount,
    realVisualRatio,
    uniqueVisualRatio,
    clipRatio,
    repeatedStockIds,
    entityMisses: entityMisses.map((row) => row.segment),
    issues,
    hardFails: blocking,
    checkedAt: nowIso(),
  };
}

export function scoreCaptionAudioGateV2({ run, options = {} }) {
  const segments = Array.isArray(run.srt?.segments) ? [...run.srt.segments].sort((a, b) => Number(a.startTime || 0) - Number(b.startTime || 0)) : [];
  const audioDuration = Number(run.audio?.durationSeconds || run.srt?.durationSeconds || options.durationSeconds || 0) || 0;
  const captionedSeconds = segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.endTime || 0) - Number(segment.startTime || 0)), 0);
  const coverage = audioDuration ? Math.min(1, captionedSeconds / audioDuration) : segments.length ? 1 : 0;
  let maxGap = 0;
  for (let index = 1; index < segments.length; index += 1) {
    maxGap = Math.max(maxGap, Math.max(0, Number(segments[index].startTime || 0) - Number(segments[index - 1].endTime || 0)));
  }
  const captionPlanSegments = Array.isArray(run.captionPlan?.segments) ? run.captionPlan.segments : [];
  const mode = cleanText(options.captionMidScreen || run.captionPlan?.midScreenMode || "off").toLowerCase();
  const middleLimit = mode === "on" ? 3 : mode === "auto" ? 2 : 0;
  const middleSegments = captionPlanSegments.filter((segment) => cleanText(segment.placement).toLowerCase() === "middle");
  const duplicateMiddleBottom = captionPlanSegments
    .map((segment) => segment.segment || segment.number)
    .filter((value, index, list) => value && list.indexOf(value) !== index);
  const issues = [];
  const hardFails = [];

  if (coverage < 0.92) hardFails.push(`Caption coverage is ${coverage.toFixed(2)}, below 0.92.`);
  if (maxGap > 0.8) hardFails.push(`Max caption gap is ${maxGap.toFixed(2)}s, above 0.80s.`);
  if (middleSegments.length > middleLimit) hardFails.push(`Middle captions ${middleSegments.length} exceed mode limit ${middleLimit}.`);
  if (duplicateMiddleBottom.length) hardFails.push("Duplicate middle and bottom caption placement detected for the same segment.");
  for (const segment of middleSegments) {
    const text = cleanText(segment.text || segments.find((item) => item.number === segment.segment)?.text || "");
    if (text.split(/\s+/).filter(Boolean).length > 5) {
      hardFails.push(`Middle caption segment ${segment.segment || segment.number || "?"} has more than 5 words.`);
    }
  }
  for (const segment of captionPlanSegments) {
    const text = cleanText(segment.text || segments.find((item) => item.number === segment.segment)?.text || "");
    if (cleanText(segment.placement).toLowerCase() !== "middle" && text.length > 84) {
      issues.push(`Bottom caption segment ${segment.segment || segment.number || "?"} is long and must safe-scale.`);
    }
    const emphasisWords = Array.isArray(segment.emphasisWords) ? segment.emphasisWords : [];
    if (emphasisWords.length > 3) hardFails.push(`Segment ${segment.segment || segment.number || "?"} highlights more than 3 words.`);
    for (const word of emphasisWords) {
      const phrase = cleanText(word);
      if (!phrase) continue;
      if (phrase.split(/\s+/).filter(Boolean).length > 3) hardFails.push(`Highlight phrase "${phrase}" is longer than 3 words.`);
      if (text && !text.toLowerCase().includes(phrase.toLowerCase())) hardFails.push(`Highlight phrase "${phrase}" does not appear in its caption.`);
    }
  }

  const audioHardFails = [];
  if (!run.files?.audio || !run.audio?.durationSeconds) {
    audioHardFails.push("No generated TTS audio file is attached before render.");
  }
  if (run.bgm?.enabled === false && options.bgm !== false) {
    issues.push("BGM is expected by V2 but not resolved yet.");
  }

  const score = Math.max(0, Math.min(100, 100 - hardFails.length * 12 - audioHardFails.length * 20 - issues.length * 3));
  return {
    version: "caption-audio-v2",
    pass: hardFails.length === 0 && audioHardFails.length === 0,
    score,
    coverage,
    maxGap,
    middleCount: middleSegments.length,
    middleLimit,
    issues,
    hardFails: [...new Set([...hardFails, ...audioHardFails])],
    checkedAt: nowIso(),
  };
}

export function scorePostRenderGateV2({ run, options = {} }) {
  const post = run.postRenderQuality || {};
  const audio = post.audio || {};
  const hardFails = [];
  const issues = Array.isArray(post.issues) ? [...post.issues] : [];
  const baseScore = Number(post.score || 0);
  const finalThreshold = Number(options.finalPublishScore || WORLD_CUP_V2_FINAL_PUBLISH_SCORE);
  if (post.decision !== "publish_candidate") hardFails.push(`Post-render base QC returned ${post.decision || "unknown"}.`);
  if (baseScore < finalThreshold) hardFails.push(`Post-render score ${baseScore.toFixed(0)} is below V2 publish score ${finalThreshold}.`);
  if (Number.isFinite(audio.meanVolumeDb) && (audio.meanVolumeDb < -20 || audio.meanVolumeDb > -14)) {
    hardFails.push(`Rendered mean volume ${audio.meanVolumeDb.toFixed(1)} dB is outside -20 dB to -14 dB.`);
  }
  if (options.bgm !== false) {
    const bgmVolume = Number(run.bgm?.volume);
    if (run.bgm?.enabled === false) {
      hardFails.push("BGM is disabled after render, but V2 publish mode expects a ducked background bed.");
    } else if (Number.isFinite(bgmVolume) && (bgmVolume < 0.16 || bgmVolume > 0.22)) {
      hardFails.push(`BGM volume ${bgmVolume.toFixed(2)} is outside V2 target 0.16-0.22.`);
    }
  }
  if (run.qualityV2?.gates?.preRender && run.qualityV2.gates.preRender.pass === false) {
    hardFails.push("Pre-render V2 gate did not pass.");
  }
  const score = Math.max(0, Math.min(100, baseScore - hardFails.length * 5 - Math.max(0, issues.length - 1) * 2));
  return {
    version: "post-render-v2",
    pass: hardFails.length === 0 && score >= finalThreshold,
    score,
    threshold: finalThreshold,
    decision: hardFails.length === 0 && score >= finalThreshold ? "publish_candidate" : "rendered_needs_review",
    audio,
    issues,
    hardFails: [...new Set(hardFails)],
    checkedAt: nowIso(),
  };
}

export function updateQualityGate(run, gateName, result) {
  const quality = ensureQualityV2(run, { qualityMode: "v2", strictPublish: true });
  quality.gates[gateName] = result;
  quality.checkedAt = nowIso();
  const gates = Object.values(quality.gates).filter(Boolean);
  const hardFails = gates.flatMap((gate) => gate.hardFails || []);
  const issues = gates.flatMap((gate) => gate.issues || []);
  quality.issues = [...new Set([...hardFails, ...issues].map(cleanText).filter(Boolean))].slice(0, 12);
  const scored = gates.map((gate) => Number(gate.score || gate.total || 0)).filter(Number.isFinite);
  quality.finalScore = scored.length ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length) : 0;
  quality.finalDecision = hardFails.length ? "blocked" : gates.every((gate) => gate.pass !== false) ? "publish_candidate" : "needs_review";
  return quality;
}

export function buildV2FailureAlert(run, failedGate = "") {
  const quality = run.qualityV2 || {};
  const gate = failedGate ? quality.gates?.[failedGate] : null;
  const issues = [
    ...(gate?.hardFails || []),
    ...(gate?.issues || []),
    ...(quality.issues || []),
  ].map(cleanText).filter(Boolean);
  const topIssues = [...new Set(issues)].slice(0, 3);
  return [
    "World Cup V2 quality blocked this video.",
    `Run: ${run.id}`,
    `Topic: ${cleanText(run.topic || run.selectedScript?.title || "World Cup short")}`,
    `Failed gate: ${failedGate || "unknown"}`,
    `Score: ${Number(gate?.score || gate?.total || quality.finalScore || 0).toFixed(0)}/100`,
    topIssues.length ? `Top issues:\n- ${topIssues.join("\n- ")}` : "Top issues: not available",
    "MP4 was not sent because strict publish mode is enabled.",
  ].join("\n");
}
