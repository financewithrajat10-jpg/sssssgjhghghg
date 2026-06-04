const elements = {
  ffmpegStatus: document.querySelector("#ffmpegStatus"),
  imageInput: document.querySelector("#imageInput"),
  audioInput: document.querySelector("#audioInput"),
  audioSummary: document.querySelector("#audioSummary"),
  srtInput: document.querySelector("#srtInput"),
  srtSummary: document.querySelector("#srtSummary"),
  timelineInput: document.querySelector("#timelineInput"),
  applyTimelineButton: document.querySelector("#applyTimelineButton"),
  autoFiveButton: document.querySelector("#autoFiveButton"),
  clearButton: document.querySelector("#clearButton"),
  formatSelect: document.querySelector("#formatSelect"),
  fitSelect: document.querySelector("#fitSelect"),
  fpsSelect: document.querySelector("#fpsSelect"),
  compatibilitySelect: document.querySelector("#compatibilitySelect"),
  syncAudioCheckbox: document.querySelector("#syncAudioCheckbox"),
  burnCaptionsCheckbox: document.querySelector("#burnCaptionsCheckbox"),
  captionStyleSelect: document.querySelector("#captionStyleSelect"),
  captionAnimationSelect: document.querySelector("#captionAnimationSelect"),
  captionPlacementSelect: document.querySelector("#captionPlacementSelect"),
  captionCenterInput: document.querySelector("#captionCenterInput"),
  smartCaptionsCheckbox: document.querySelector("#smartCaptionsCheckbox"),
  captionMoodSelect: document.querySelector("#captionMoodSelect"),
  smartCaptionButton: document.querySelector("#smartCaptionButton"),
  smartCaptionSummary: document.querySelector("#smartCaptionSummary"),
  captionPreview: document.querySelector("#captionPreview"),
  exportButton: document.querySelector("#exportButton"),
  downloadLink: document.querySelector("#downloadLink"),
  message: document.querySelector("#message"),
  imageGrid: document.querySelector("#imageGrid"),
  timelineSummary: document.querySelector("#timelineSummary"),
};

let images = [];
let timeline = null;
let audioFile = null;
let subtitleFile = null;
let smartCaptionPlan = null;
let draggedImageIndex = null;
let currentDownloadUrl = "";

const fileNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function setMessage(text, isError = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

function audioDurationFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    audio.onerror = () => resolve(0);
    fetch(dataUrl)
      .then((response) => response.blob())
      .then((blob) => {
        audio.src = URL.createObjectURL(blob);
      })
      .catch(() => resolve(0));
  });
}

function parseSrtTimestamp(value) {
  const match = String(value || "").trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!match) {
    return 0;
  }
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(millis.padEnd(3, "0")) / 1000;
}

function srtSummary(text) {
  const blocks = String(text || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  let lastEnd = 0;
  let valid = 0;
  for (const block of blocks) {
    const timeLine = block.split("\n").find((line) => line.includes("-->"));
    if (!timeLine) continue;
    const [, endRaw] = timeLine.split("-->").map((part) => part.trim());
    lastEnd = Math.max(lastEnd, parseSrtTimestamp(endRaw));
    valid += 1;
  }
  return { count: valid, lastEnd };
}

function resetSmartCaptions(message = "Load an SRT, then let Gemma choose highlights and animations.") {
  smartCaptionPlan = null;
  elements.smartCaptionsCheckbox.checked = false;
  elements.smartCaptionSummary.textContent = message;
}

function dimensionsForFormat(format) {
  return format === "16:9" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
}

function recalculateFrom(index = 0) {
  for (let i = Math.max(0, index); i < images.length; i += 1) {
    const previousEnd = i === 0 ? 0 : Number(images[i - 1].endTime || 0);
    const savedDuration = Number(images[i].durationSeconds || 0);
    const currentDuration = Math.max(
      0.1,
      savedDuration || Number(images[i].endTime || previousEnd + 5) - Number(images[i].startTime || previousEnd) || 5,
    );
    images[i].startTime = previousEnd;
    images[i].endTime = previousEnd + currentDuration;
    images[i].durationSeconds = currentDuration;
  }
}

function syncTimingsWithTimeline() {
  if (!timeline) {
    return;
  }

  for (let index = 0; index < images.length; index += 1) {
    const frame = timeline.frames[index];
    if (!frame) {
      continue;
    }
    const start = Number(frame.startTime ?? 0);
    const fallbackDuration = Number(frame.durationSeconds || 5);
    const end = Number(frame.endTime ?? start + fallbackDuration);
    const duration = Math.max(0.1, Number(frame.durationSeconds || 0) || end - start || fallbackDuration || 5);
    images[index].startTime = start;
    images[index].endTime = start + duration;
    images[index].durationSeconds = duration;
  }

  recalculateFrom(0);
}

function clearDropState() {
  for (const card of elements.imageGrid.querySelectorAll(".image-card")) {
    card.classList.remove("is-drop-before", "is-drop-after", "is-dragging");
  }
}

function moveImage(fromIndex, insertionIndex) {
  if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= images.length) {
    return;
  }

  let nextIndex = Math.max(0, Math.min(images.length, insertionIndex));
  if (fromIndex < nextIndex) {
    nextIndex -= 1;
  }
  if (fromIndex === nextIndex) {
    clearDropState();
    return;
  }

  const [movedImage] = images.splice(fromIndex, 1);
  images.splice(nextIndex, 0, movedImage);
  if (timeline) {
    syncTimingsWithTimeline();
  } else {
    recalculateFrom(0);
  }
  renderImages();
  setMessage(`Moved ${movedImage.name} to position ${images.indexOf(movedImage) + 1}.`);
}

function renderImages() {
  recalculateFrom(0);
  const total = images.reduce((max, image) => Math.max(max, Number(image.endTime || 0)), 0);
  const audioNote = audioFile?.durationSeconds ? ` - audio ${audioFile.durationSeconds.toFixed(1)}s` : "";
  const subtitleNote = subtitleFile?.durationSeconds ? ` - SRT ${subtitleFile.durationSeconds.toFixed(1)}s` : "";
  elements.timelineSummary.textContent = images.length
    ? `${images.length} images - ${total.toFixed(1)}s total${audioNote}${subtitleNote}`
    : "No images yet";

  if (!images.length) {
    elements.imageGrid.innerHTML = `<p class="empty">Upload images to start building a timeline.</p>`;
    return;
  }

  elements.imageGrid.innerHTML = images
    .map((image, index) => {
      const safeName = escapeHtml(image.name);
      return `
        <article class="image-card" data-index="${index}">
          <button class="drag-handle" type="button" draggable="true" data-drag-index="${index}" aria-label="Drag ${safeName} to reorder">Drag</button>
          <img src="${image.dataUrl}" alt="${safeName}" />
          <div class="image-info">
            <strong>${index + 1}. ${safeName}</strong>
            <span>${Number(image.startTime || 0).toFixed(2)}s to ${Number(image.endTime || 0).toFixed(2)}s</span>
          </div>
          <label>
            End time
            <input type="number" min="0.1" step="0.1" value="${Number(image.endTime || 5).toFixed(1)}" data-end-input />
          </label>
          <p>${Number(image.durationSeconds || 5).toFixed(1)}s duration</p>
        </article>
      `;
    })
    .join("");

  for (const input of elements.imageGrid.querySelectorAll("[data-end-input]")) {
    input.addEventListener("change", () => {
      const card = input.closest(".image-card");
      const index = Number(card.dataset.index);
      const start = Number(images[index].startTime || 0);
      const end = Math.max(start + 0.1, Number(input.value || start + 5));
      images[index].endTime = end;
      images[index].durationSeconds = end - start;
      recalculateFrom(index + 1);
      renderImages();
    });
  }

  for (const handle of elements.imageGrid.querySelectorAll("[data-drag-index]")) {
    handle.addEventListener("dragstart", (event) => {
      draggedImageIndex = Number(handle.dataset.dragIndex);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(draggedImageIndex));
      handle.closest(".image-card")?.classList.add("is-dragging");
    });
    handle.addEventListener("dragend", () => {
      draggedImageIndex = null;
      clearDropState();
    });
  }

  for (const card of elements.imageGrid.querySelectorAll(".image-card")) {
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      clearDropState();
      const rect = card.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      card.classList.add(insertAfter ? "is-drop-after" : "is-drop-before");
    });
    card.addEventListener("dragleave", (event) => {
      if (!card.contains(event.relatedTarget)) {
        card.classList.remove("is-drop-before", "is-drop-after");
      }
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      const fromIndex = Number(event.dataTransfer.getData("text/plain") || draggedImageIndex);
      const targetIndex = Number(card.dataset.index);
      const rect = card.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      moveImage(fromIndex, targetIndex + (insertAfter ? 1 : 0));
    });
  }
}

async function loadImages(files) {
  const loaded = [];
  const sortedFiles = [...files].sort((a, b) => fileNameCollator.compare(a.name, b.name));
  for (const file of sortedFiles) {
    const dataUrl = await fileToDataUrl(file);
    loaded.push({
      id: crypto.randomUUID(),
      name: file.name,
      mimeType: file.type || "image/jpeg",
      dataUrl,
      data: dataUrl.split(",")[1],
      startTime: 0,
      endTime: 5,
      durationSeconds: 5,
    });
  }
  images = loaded;
  if (timeline) {
    applyTimeline();
  } else {
    autoDuration(5);
    setMessage(`Loaded ${loaded.length} images in filename order. Drag rows to adjust the sequence.`);
  }
}

async function loadAudio(files) {
  const file = files[0];
  if (!file) {
    audioFile = null;
    elements.audioSummary.textContent = "No audio loaded.";
    return;
  }
  const dataUrl = await fileToDataUrl(file);
  const duration = await audioDurationFromDataUrl(dataUrl);
  audioFile = {
    name: file.name,
    mimeType: file.type || "audio/mpeg",
    dataUrl,
    data: dataUrl.split(",")[1],
    durationSeconds: duration,
  };
  const durationText = duration ? `${duration.toFixed(2)}s` : "duration unknown";
  elements.audioSummary.textContent = `${file.name} - ${durationText}`;
  setMessage("Audio loaded. Export will mux it into the MP4.");
}

async function loadSubtitles(files) {
  const file = files[0];
  if (!file) {
    subtitleFile = null;
    elements.srtSummary.textContent = "No SRT loaded.";
    elements.burnCaptionsCheckbox.checked = false;
    resetSmartCaptions();
    return;
  }
  const text = await fileToText(file);
  const summary = srtSummary(text);
  if (!summary.count) {
    subtitleFile = null;
    elements.srtSummary.textContent = "Invalid SRT file.";
    elements.burnCaptionsCheckbox.checked = false;
    resetSmartCaptions();
    setMessage("The selected subtitle file does not look like valid SRT.", true);
    return;
  }
  subtitleFile = {
    name: file.name,
    text,
    count: summary.count,
    durationSeconds: summary.lastEnd,
  };
  elements.burnCaptionsCheckbox.checked = true;
  resetSmartCaptions("SRT loaded. Smart captions are optional.");
  elements.srtSummary.textContent = `${file.name} - ${summary.count} captions, ends at ${summary.lastEnd.toFixed(2)}s`;
  setMessage("SRT loaded. Captions will be burned in unless you uncheck the caption option.");
}

function updateCaptionPreview() {
  elements.captionPreview.className = `caption-preview ${elements.captionStyleSelect.value} anim-${elements.captionAnimationSelect.value} place-${elements.captionPlacementSelect.value}`;
  if (elements.smartCaptionsCheckbox.checked && smartCaptionPlan) {
    elements.captionPreview.classList.add("smart-active");
    elements.captionPreview.textContent = smartCaptionPlan.segments?.[0]?.text || "Smart captions ready";
  } else {
    elements.captionPreview.textContent = "आपकी कहानी यहीं से शुरू होती है";
  }
}

async function designSmartCaptions() {
  if (!subtitleFile) {
    setMessage("Load an SRT file before designing Smart captions.", true);
    return;
  }

  elements.smartCaptionButton.disabled = true;
  elements.smartCaptionButton.textContent = "Designing...";
  elements.smartCaptionSummary.textContent = "Gemma is choosing caption rhythm, highlights, and animations.";
  setMessage("Designing Smart captions with a lightweight Gemma model.");

  try {
    const response = await fetch("/api/smart-captions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srtText: subtitleFile.text,
        styleId: elements.captionStyleSelect.value,
        mood: elements.captionMoodSelect.value,
        format: elements.formatSelect.value,
        audioDuration: audioFile?.durationSeconds || subtitleFile.durationSeconds || 0,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to design Smart captions.");
    }

    smartCaptionPlan = result;
    elements.smartCaptionsCheckbox.checked = true;
    elements.burnCaptionsCheckbox.checked = true;
    const coverage = result.coveragePercent ? ` Coverage ${result.coveragePercent}%` : "";
    const fallback = result.fallbackCaptionCount ? ` ${result.fallbackCaptionCount} original SRT lines kept for full coverage.` : "";
    elements.smartCaptionSummary.textContent =
      `${result.smartCaptionCount || 0} smart captions via ${result.model || "Gemma"}.${coverage}. ${result.captionStyle || ""}${fallback}`.trim();
    updateCaptionPreview();
    setMessage("Smart captions ready. Export will burn highlighted animated captions.");
  } catch (error) {
    resetSmartCaptions("Smart caption design failed. Normal SRT captions are still available.");
    setMessage(error.message, true);
  } finally {
    elements.smartCaptionButton.disabled = false;
    elements.smartCaptionButton.textContent = "Design captions";
  }
}

function parseTimeline() {
  const raw = elements.timelineInput.value.trim();
  if (!raw) {
    throw new Error("Paste timeline JSON first.");
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.frames)) {
    throw new Error("Timeline JSON must include a frames array.");
  }
  return parsed;
}

function applyTimeline() {
  timeline = parseTimeline();
  if (timeline.format) {
    elements.formatSelect.value = timeline.format === "16:9" ? "16:9" : "9:16";
  }
  syncTimingsWithTimeline();
  renderImages();
  setMessage(`Applied ${Math.min(images.length, timeline.frames.length)} timeline entries.`);
}

function autoDuration(seconds) {
  let cursor = 0;
  for (const image of images) {
    image.startTime = cursor;
    image.endTime = cursor + seconds;
    image.durationSeconds = seconds;
    cursor = image.endTime;
  }
  renderImages();
}

function payloadForExport() {
  const { width, height } = dimensionsForFormat(elements.formatSelect.value);
  const burnCaptions = elements.burnCaptionsCheckbox.checked && subtitleFile;
  return {
    width,
    height,
    fps: Number(elements.fpsSelect.value || 30),
    fit: elements.fitSelect.value,
    compatibilityMode: elements.compatibilitySelect.value,
    syncToAudio: elements.syncAudioCheckbox.checked,
    captionStyle: elements.captionStyleSelect.value,
    captionAnimation: elements.captionAnimationSelect.value,
    captionPlacement: elements.captionPlacementSelect.value,
    captionCenterSpec: elements.captionCenterInput.value,
    audio: audioFile
      ? {
          name: audioFile.name,
          mimeType: audioFile.mimeType,
          data: audioFile.data,
          durationSeconds: audioFile.durationSeconds,
        }
      : null,
    subtitles: burnCaptions
      ? {
          enabled: true,
          name: subtitleFile.name,
          text: subtitleFile.text,
          animationMode: elements.captionAnimationSelect.value,
          placementMode: elements.captionPlacementSelect.value,
          centerSpec: elements.captionCenterInput.value,
          smartEnabled: elements.smartCaptionsCheckbox.checked && Boolean(smartCaptionPlan),
          smart: elements.smartCaptionsCheckbox.checked && smartCaptionPlan
            ? { ...smartCaptionPlan, stylePreset: elements.captionStyleSelect.value }
            : null,
        }
      : null,
    images: images.map((image) => ({
      name: image.name,
      mimeType: image.mimeType,
      data: image.data,
    })),
    clips: images.map((image) => ({
      startTime: Number(image.startTime || 0),
      endTime: Number(image.endTime || 0),
    })),
  };
}

async function exportMp4() {
  if (!images.length) {
    setMessage("Upload images before exporting.", true);
    return;
  }
  if (elements.burnCaptionsCheckbox.checked && !subtitleFile) {
    setMessage("Choose an SRT file or turn off burned captions before exporting.", true);
    return;
  }
  if (elements.smartCaptionsCheckbox.checked && !smartCaptionPlan) {
    setMessage("Click Design captions first, or turn off Smart captions before exporting.", true);
    return;
  }

  elements.exportButton.disabled = true;
  elements.exportButton.textContent = "Rendering...";
  const extras = [audioFile ? "audio" : "", elements.burnCaptionsCheckbox.checked ? "burned captions" : ""].filter(Boolean);
  setMessage(`Rendering MP4${extras.length ? ` with ${extras.join(" and ")}` : ""}. This can take a little while.`);
  elements.downloadLink.classList.remove("visible");
  if (currentDownloadUrl) {
    URL.revokeObjectURL(currentDownloadUrl);
    currentDownloadUrl = "";
  }

  try {
    const response = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadForExport()),
    });
    if (!response.ok) {
      const errorType = response.headers.get("Content-Type") || "";
      if (errorType.includes("application/json")) {
        const result = await response.json();
        throw new Error(result.error || "Unable to export MP4.");
      }
      throw new Error((await response.text()) || "Unable to export MP4.");
    }
    const blob = await response.blob();
    currentDownloadUrl = URL.createObjectURL(blob);
    elements.downloadLink.href = currentDownloadUrl;
    elements.downloadLink.download = "image-reel.mp4";
    elements.downloadLink.classList.add("visible");
    const width = response.headers.get("X-Video-Width") || "1080";
    const height = response.headers.get("X-Video-Height") || "1920";
    const fps = response.headers.get("X-Video-Fps") || elements.fpsSelect.value;
    const mode = response.headers.get("X-Video-Compatibility-Mode") || elements.compatibilitySelect.value;
    const audioTrack = response.headers.get("X-Audio-Track") || "none";
    const subtitles = response.headers.get("X-Subtitles") || "none";
    const duration = response.headers.get("X-Video-Duration-Seconds");
    const durationNote = duration ? ` ${Number(duration).toFixed(2)}s duration.` : "";
    setMessage(`MP4 ready: ${width}x${height} at ${fps} FPS.${durationNote} Mode: ${mode}. Audio: ${audioTrack}. Subtitles: ${subtitles}.`);
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    elements.exportButton.disabled = false;
    elements.exportButton.textContent = "Export MP4";
  }
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    const result = await response.json();
    elements.ffmpegStatus.textContent = result.ffmpegReady ? "FFmpeg ready" : "FFmpeg missing";
    elements.ffmpegStatus.classList.toggle("ready", Boolean(result.ffmpegReady));
    if (!result.ffmpegReady) {
      setMessage(result.error || "FFmpeg was not found.", true);
    }
  } catch {
    elements.ffmpegStatus.textContent = "Server unavailable";
  }
}

elements.imageInput.addEventListener("change", () => loadImages([...elements.imageInput.files]));
elements.audioInput.addEventListener("change", () => loadAudio([...elements.audioInput.files]).then(renderImages).catch((error) => setMessage(error.message, true)));
elements.srtInput.addEventListener("change", () => loadSubtitles([...elements.srtInput.files]).then(renderImages).catch((error) => setMessage(error.message, true)));
elements.captionStyleSelect.addEventListener("change", updateCaptionPreview);
elements.captionAnimationSelect.addEventListener("change", updateCaptionPreview);
elements.captionPlacementSelect.addEventListener("change", updateCaptionPreview);
elements.captionCenterInput.addEventListener("input", updateCaptionPreview);
elements.smartCaptionButton.addEventListener("click", designSmartCaptions);
elements.smartCaptionsCheckbox.addEventListener("change", () => {
  if (elements.smartCaptionsCheckbox.checked && !smartCaptionPlan) {
    elements.smartCaptionsCheckbox.checked = false;
    setMessage("Design Smart captions first, then enable this option.", true);
  }
  updateCaptionPreview();
});
elements.applyTimelineButton.addEventListener("click", () => {
  try {
    applyTimeline();
  } catch (error) {
    setMessage(error.message, true);
  }
});
elements.autoFiveButton.addEventListener("click", () => autoDuration(5));
elements.clearButton.addEventListener("click", () => {
  images = [];
  timeline = null;
  audioFile = null;
  subtitleFile = null;
  resetSmartCaptions();
  elements.imageInput.value = "";
  elements.audioInput.value = "";
  elements.srtInput.value = "";
  elements.timelineInput.value = "";
  elements.audioSummary.textContent = "No audio loaded.";
  elements.srtSummary.textContent = "No SRT loaded.";
  elements.burnCaptionsCheckbox.checked = false;
  elements.downloadLink.classList.remove("visible");
  if (currentDownloadUrl) {
    URL.revokeObjectURL(currentDownloadUrl);
    currentDownloadUrl = "";
  }
  setMessage("");
  renderImages();
});
elements.exportButton.addEventListener("click", exportMp4);

renderImages();
updateCaptionPreview();
loadHealth();
