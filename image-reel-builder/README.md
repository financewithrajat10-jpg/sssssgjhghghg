# Image Reel Builder

A separate local app for turning generated images, optional voice audio, and optional SRT subtitles into an editor-friendly MP4.

## Use

1. Start the app with the one-click starter:

```powershell
.\START_IMAGE_REEL_BUILDER.bat
```

Or start it manually:

```powershell
npm start
```

2. Open `http://localhost:4010`.
3. Upload images in the order you want them to appear.
4. Paste the timeline JSON copied from Hindi Voice Studio.
5. Optionally add `audio.wav` / `audio.mp3`.
6. Optionally add `subtitles.srt` and enable burned captions.
7. Click `Apply timeline`.
8. Drag image rows to fix the final sequence, then adjust any image end time if needed.
9. Choose format, FPS, export mode, and caption style.
10. Click `Export MP4`.

The accepted timeline format is `hindi-voice-studio.image-timeline.v1` with a `frames` array containing `startTime`, `endTime`, `durationSeconds`, and prompt metadata.
Images are naturally sorted by filename on import, so names like `frame-1.png`, `frame-2.png`, and `frame-10.png` start in the expected order before manual drag-and-drop edits.

## FFmpeg

The app looks for FFmpeg in this order:

1. `FFMPEG_PATH` environment variable
2. `C:\tmp\ffmpeg-portable\bin\ffmpeg.exe`
3. `ffmpeg` on PATH

Audio is optional. If you import audio, the builder muxes it into the MP4 and can extend or trim the final image timing to match the audio duration. Subtitles are optional too. If you import SRT and enable burned captions, the builder converts SRT to styled ASS captions and burns them into the video with FFmpeg.

Caption presets include creator-style yellow pop, bold white pop, cinematic box, horror glow, clean lower-third, psych teal, relationship soft, and motivation impact styles. The SRT timings are preserved, while pop-style presets split long subtitle lines into short chunks inside each SRT time range for a more reel-native feel.

Smart captions are optional. Load an SRT, click **Design captions**, and the builder asks a lightweight Gemma model to create a caption plan with shorter beats, keyword highlights, emotion tags, and per-line animation choices. If Smart captions is enabled during export, the app burns that plan as ASS subtitles; otherwise it uses the normal SRT styling path.
