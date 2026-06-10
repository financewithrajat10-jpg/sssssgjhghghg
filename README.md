# Hindi Voice Studio

A small dependency-free web app for converting Hindi script into realistic speech.

## What works best

Use Google AI Studio Gemini TTS for Hindi. Current Gemini TTS documentation lists Hindi support and the app calls the REST API from the local Node server so your key is not exposed in browser JavaScript.

NVIDIA is included as an optional configurable provider. As of the current public NVIDIA Speech NIM docs, the Magpie TTS free endpoint is available, but NVIDIA's documented TTS language support is not the best Hindi default. If you receive a working NVIDIA Hindi-capable endpoint URL, set `NVIDIA_TTS_URL` and `NVIDIA_API_KEY`.

## Setup

1. Copy `.env.example` to `.env` or set environment variables in your terminal.
2. Add your Google AI Studio API key:

```powershell
$env:GEMINI_API_KEY="your_key_here"
```

3. Start the app:

```powershell
npm start
```

4. Open `http://localhost:3000`.

## One-click start on Windows

1. Copy `.env.example` to `.env`.
2. Put your key in `.env`.
3. Double-click `START_HINDI_VOICE_STUDIO.bat`.

The batch file loads `.env`, starts the local server, and opens the app.

## Cloudflare Pages frontend deploy

The repository includes `.github/workflows/cloudflare-pages.yml` to deploy the static frontend in `public/` to Cloudflare Pages on every push to `main`.

1. Create a Cloudflare Pages project named `money-printing-machine`, or set a different project name in the GitHub repository variable `CLOUDFLARE_PAGES_PROJECT_NAME`.
2. Add GitHub Actions secrets:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
3. Give the Cloudflare token `Account > Cloudflare Pages > Edit` permission.
4. If your Node API backend is hosted on a different domain, add a GitHub repository variable named `CONTENT_STUDIO_API_BASE_URL`, for example `https://your-backend.example.com`.
5. On the backend host, set `ALLOWED_ORIGINS` to your Cloudflare Pages URL, for example `https://money-printing-machine.pages.dev`.

Without `CONTENT_STUDIO_API_BASE_URL`, the deployed frontend will load but will look for `/api/*` on the same Cloudflare Pages domain.

## Controls

- Provider: switch between Gemini TTS and NVIDIA TTS.
- Model: Gemini exposes the available TTS models from this starter app. NVIDIA exposes Magpie model choices for when you add an NVIDIA key and endpoint URL.
- Mood: choose None, Thriller, Emotional, Documentary, YouTube, Horror, or Calm. Use None when line-level script tags should control the delivery.
- Custom direction: optional override for exact acting direction, pacing, pauses, or emotion.
- Voice mode: use `Single narrator`, `2-speaker dialogue`, or `Normal story -> advanced dialogue`. The advanced mode uses `gemini-3.1-flash-lite` by default to rewrite a normal story into tagged two-speaker dialogue before TTS.
- Tagged dialogue lines can use forms such as `[Narrator | Leda | tense, slow]` or `[Mysterious Voice | Kore | whisper, eerie]`; the backend reads these tags and builds the Gemini multi-speaker mapping from the script.
- Settings: keep the original `.env` Gemini key and save up to four extra Gemini keys in `.gemini-keys.json`. Switch the active key instantly from the frontend.
- API errors show structured details such as error code, provider, model, active key, HTTP status, and Gemini status when available.
- Memory: generated scripts, voice audio, settings, and storyboard prompts are saved locally in your browser so you can restore, replay, or delete recent work.

## Flow image prompts

Use the Storyboard prompts section after writing or pasting your story.

- Model used by default: `gemini-3.1-flash-lite`
- Fast mode uses the script plus generated audio duration.
- Audio-aware direct sends only the generated audio to the configured Lite text model and creates prompts in one call.
- Audio-aware detailed sends only the generated audio to the configured Lite text model, first creates a detailed timed transcript/beat sheet, then creates prompts from that timeline in a second call.
- Pick maximum image duration such as 3, 4, 5, or 6 seconds. At max 5 seconds, a 60-second audio generates at least 12 timed image prompts, but Gemini can still choose shorter 3-4 second cuts when the pace demands it.
- Output: detailed standalone 9:16 Flow-ready prompts for Facebook Reels, Instagram Reels, and YouTube Shorts.
- Each frame includes start time, end time, story beat, image prompt, and negative prompt.
- Use `Copy all prompts` to copy every prompt with two blank lines between prompts.
- Choose an image mood separately from the voice mood.

## Timeline export and reel builder

- The Storyboard section also creates timeline JSON in the `hindi-voice-studio.image-timeline.v1` format.
- Use `Copy timeline JSON` when you want to send image timings to the separate Image Reel Builder app.
- The existing `Copy all prompts` button still copies prompts with two blank lines between each prompt.
- Start the separate builder with `image-reel-builder\START_IMAGE_REEL_BUILDER.bat`, then paste the timeline JSON, upload images in order, adjust end times if needed, and export a silent MP4.

## Stock video mode

- The Storyboard section now has a separate Stock video panel for Pexels/Pixabay footage.
- Add up to four Pexels keys and four Pixabay keys in Settings. The original Gemini key flow is unchanged.
- Video mode can create its own SRT/timeline directly from the current voice audio, so Flow image prompts are not required.
- Click `Create SRT` to make timed caption beats, or click `Find stock clips` and the app will create the SRT first when needed. Gemini writes short English stock search queries for each timed beat, searches the selected provider, and selects portrait-friendly clips.
- Review each beat and switch between candidate stock clips before rendering.
- Caption styles from Image Reel Builder are available here too: creator yellow, bold pop, cinematic box, horror glow, clean lower third, psych teal, relationship soft, and motivation impact.
- Caption animations include auto, pop, punch, slide-up, kinetic, glitch, horror, whisper, impact, calm, and fade. Smart captions can redesign caption rhythm, highlights, placement, and animation with lightweight Gemma/Gemini models.
- `Render MP4` uses FFmpeg to download, crop, trim/loop, and combine the selected clips into a 1080x1920 H.264 MP4. Audio and burned animated ASS subtitles are optional.
- Export pack includes `stock-video-timeline.json`, `stock-video-plan.json`, `stock-smart-captions.json`, and stock attribution notes when they exist.

## World Cup automated short-video pipeline

The app now includes a separate `World Cup` dashboard and a standalone CLI subsystem in `worldcup/`.

- Local dashboard routes:
  - `GET /api/worldcup/runs`
  - `GET /api/worldcup/runs/:id`
  - `POST /api/worldcup/generate`
  - `POST /api/worldcup/render`
  - `POST /api/worldcup/upload`
  - `GET /api/worldcup/assets/:id?file=mp4|srt|script|evidence|visuals|attribution|rights|renderLog|audio`
- CLI:

```powershell
npm run worldcup -- --mode prediction --team-a "USA" --team-b "Brazil" --topic "why this match has trap-game energy" --render true --upload false
```

- Compare the original baseline with the Viral 2.0 gates:

```powershell
npm run worldcup -- --mode pre-tournament --topic "Everyone thinks home advantage helps the USMNT but it might break them" --strategy classic --render false --upload false
npm run worldcup -- --mode pre-tournament --topic "Everyone thinks home advantage helps the USMNT but it might break them" --strategy viral2 --render false --upload false
```

- Dry local test without Gemini calls:

```powershell
npm run worldcup:dry
```

Pipeline stages:

- Builds a compact evidence pack from search grounding, commentary/event extraction, and fallback match context.
- Writes three styles: `serious_analyst`, `funny_fan_analyst`, and `dramatic_storyteller`.
- Judges the three scripts and rewrites the winner into a Gemini TTS-ready screenplay with light tags.
- Generates one Gemini TTS take, creates audio-aware SRT when audio is available, and falls back to script timing when needed.
- Resolves safe visuals from Wikimedia/Wikidata/Commons, Pexels/Pixabay, and local tactical/card fallbacks.
- Starts a parallel visual-scout branch after script selection so player/team images and stock clips are searched while TTS/SRT work continues.
- Renders vertical 1080x1920 H.264/AAC MP4 with creator-yellow slide-lift captions.
- Refuses normal MP4 export when generated TTS audio is missing, or when real image/clip coverage is below `WORLD_CUP_MIN_REAL_VISUAL_RATIO`.
- Sends MP4 and key sidecars through the configured `auto` upload target. `auto` prefers Telegram when bot secrets are present, then Google Drive, then R2.
- Stores local run files under `.tmp-worldcup/`, which is ignored by Git.

Viral 2.0 comparison mode:

- Opt in with `--strategy viral2`, the dashboard `Strategy` dropdown, or `WORLD_CUP_STRATEGY=viral2`.
- Keeps the classic pipeline unchanged for baseline comparison.
- Adds a pre-writing topic score, hook lab, one-sentence contradiction, cover text, visual beat plan, caption emphasis words, and edit plan.
- Runs the selected script through local hard gates for first-sentence hook strength, unsupported hard stats, memorable football-native line, generic tone, visual moments, and comment trigger.
- Saves `viral-strategy.json` and, after rendering, `quality.json`.
- Viral 2.0 renders use a louder Shorts voice chain plus post-render QC for audio level, caption gaps, visual repetition, and first-hook strength.

Default World Cup models:

- Text-heavy work now defaults to `gemini-3.1-flash-lite`: search/evidence, script writing, script evaluation, TTS rewrite, and audio-aware SRT.
- Search falls back to `gemini-2.5-flash-lite` then `gemini-2.5-flash` if the Lite default is temporarily blocked.
- Evidence now uses multiple grounded research passes, then a separate JSON consolidation pass so malformed search-grounded text does not create fake-specific stats.
- World Cup runs keep light memory of recent topics, hooks, angles, and visual assets to reduce repeated ideas and repeated stock clips.
- Visual selection dedupes clips within the run, avoids recently used clips where possible, uses player/team-aware queries for USMNT and other team-focused topics, and tries a backup football clip before falling back to a board.
- Real player/team images are limited to license-tracked Wikimedia/Commons assets by default. Gemma visual review (`WORLD_CUP_VISUAL_REVIEW_MODEL`, default `gemma-4-26b-a4b-it`) performs a generic logo/watermark/off-topic/source-risk check; Gemini 2.5 Flash Lite (`WORLD_CUP_VISUAL_SELECTION_MODEL`) then reviews relevance and can request retry searches, falling back to `WORLD_CUP_VISUAL_SELECTION_FALLBACK_MODELS` on quota/server errors.
- Local asset packs can be built from the dashboard or CLI. They save reviewed Wikimedia images under `.tmp-worldcup/asset-packs/` and index reviewed stock candidates for future runs.
- Caption design now uses `WORLD_CUP_CAPTION_DESIGN_MODEL` to choose per-SRT emphasis words, animation style, and optional mid-screen punchline placement. Use `WORLD_CUP_CAPTION_MIDSCREEN=off` to force all captions to the bottom.
- TTS audio stays on `gemini-3.1-flash-tts-preview` by default because TTS audio models are separate from text-out Lite models.
- Gemini calls retry up to three times after `5s`, `10s`, and `15s` for transient network, server, high-demand, timeout, or rate-limit errors. Hard zero-quota/model-access errors fail fast so you can switch keys or models.
- Background music is optional and defaults to a locally generated mood bed with voice ducking when `WORLD_CUP_ENABLE_BGM=true`. Set `WORLD_CUP_BGM_FILE` to use your own approved royalty-free music instead.
- Rendered voice audio is lightly boosted/compressed by default with `WORLD_CUP_VOICE_VOLUME=1.35` so Shorts do not feel too quiet next to platform audio.
- For local layout tests only, `--allow-silent-render true` permits a silent placeholder render and `--allow-fallback-visuals true` permits fallback-heavy visuals. Keep both off for publishable runs.

Build a local asset pack:

```powershell
npm run worldcup -- --asset-pack --team "USA" --players "Christian Pulisic, Weston McKennie, Tyler Adams"
```

Build local packs for major World Cup teams:

```powershell
npm run worldcup -- --major-asset-packs --limit 6 --players-per-team 4 --stock false
```

Asset-pack discovery uses `WORLD_CUP_ASSET_SEARCH_MODEL` first, default `gemini-2.5-pro`, then falls back to the configured lower-quota models and curated team/player seeds. Production visual planning still uses both local asset packs and live online sourcing from Wikimedia/Commons, Pexels, and Pixabay.

Render with mid-screen punchlines disabled:

```powershell
npm run worldcup -- --mode pre-tournament --topic "USMNT pressure test" --strategy viral2 --caption-mid-screen off --render true --upload false
```

GitHub Actions:

- `.github/workflows/worldcup-pipeline.yml` runs hourly and can also be triggered manually.
- The hourly workflow only generates during `WORLD_CUP_SCHEDULE_HOURS` UTC, default `9,15,21`, unless manually triggered with `force=true`.
- Add this secret for live generation:
  - `GEMINI_API_KEY`
- Add these secrets for Telegram delivery:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`
- Optional Telegram variables:
  - `TELEGRAM_THREAD_ID` for forum topics/groups
  - `WORLD_CUP_TELEGRAM_SEND_SIDECARS=true`
- Optional Google Drive upload secrets:
  - `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_BASE64`
  - `GOOGLE_DRIVE_FOLDER_ID`
- Share that Drive folder with the service account `client_email`, giving it Editor access.
- `GOOGLE_SERVICE_ACCOUNT_JSON` must be the full service account JSON file, not only the `private_key` value. Workspace domain-wide delegation is not required for direct service-account uploads when the folder is shared with the service account.
- Optional Drive variables:
  - `GOOGLE_DRIVE_MAKE_PUBLIC=false`. Set to `true` only if you want generated files shared by link.
  - `GOOGLE_DRIVE_SCOPE=https://www.googleapis.com/auth/drive`
  - `WORLD_CUP_DRIVE_FALLBACK_TELEGRAM=true`
- Optional upload target variable: `WORLD_CUP_UPLOAD_TARGET=auto`, `telegram`, `google-drive`, or `r2`.
- Optional variable: `WORLD_CUP_STRATEGY=classic` or `viral2`. Keep `classic` when you want the baseline; switch to `viral2` for the stricter viral-content gates.
- Optional R2 fallback secrets:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_R2_ACCESS_KEY_ID`
  - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
- Add repository variable `R2_PUBLIC_BASE_URL` only if using R2 with a public domain.
- Optional secrets: `PEXELS_API_KEY`, `PIXABAY_API_KEY`.
- Google Drive output is saved under `worldcup/YYYY-MM-DD/team-a-vs-team-b/` inside the configured folder when Drive is selected or used as fallback.

## Voice demos and MP3

- `Generate demos` creates a short preview for every Gemini voice in the app.
- WAV download always works.
- MP3 download appears automatically when FFmpeg is available. The app checks `FFMPEG_PATH`, then `C:\tmp\ffmpeg-portable\bin\ffmpeg.exe`, then `ffmpeg` on PATH.

## NVIDIA options to check

- `magpie-tts-multilingual`: the best NVIDIA fit for Hindi because NVIDIA's support matrix lists Hindi (`hi-IN`). It may require self-hosting/deployment rather than a simple hosted free endpoint.
- `magpie-tts-zeroshot`: has a free endpoint and expressive voices, but NVIDIA's public docs list it as English-only.
- `magpie-tts-flow` and `radtts-hifigan-tts`: deprecated, so they are not good targets for this app.

## Notes

- The server wraps Gemini's raw PCM audio into a WAV file so the browser can play and download it.
- The app defaults to `gemini-3.1-flash-tts-preview` because it is the better starting point for Hindi thriller/emotional narration. Keep `gemini-2.5-flash-preview-tts` available for direct comparison. A Gemini `3.5 Flash TTS` model was not available from the current model list for this key.
- Keep scripts under 5,000 characters for this starter version.
- For production, add login, rate limiting, request logging, and a proper secret manager.

## Test samples

Two comparison WAV files were generated with the same Hindi thriller prompt and the same `Kore` voice:

- `samples/gemini-2.5-flash-preview-tts-thriller-kore.wav`
- `samples/gemini-3.1-flash-tts-preview-thriller-kore.wav`
