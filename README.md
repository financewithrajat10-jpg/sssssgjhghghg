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
- Resolves moving visuals from Pexels/Pixabay clips, then places matching local player/team images as large overlays above the clip when available.
- Starts a parallel visual-scout branch after script selection so stock clips and local entity overlays are prepared while TTS/SRT work continues.
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

Publish-ready V2 quality mode:

- Enable with `--quality-mode v2` or `WORLD_CUP_QUALITY_MODE=v2`. GitHub/Azure production runs default to V2.
- V2 is a quality-control layer inside the existing World Cup factory, not a separate pipeline.
- It blocks before TTS when the selected script fails the publish gate, then retries the script up to `WORLD_CUP_V2_MAX_SCRIPT_RETRIES`.
- It blocks before render when storyboard, visual, caption, or pre-render audio gates fail. Visual retries keep the same script, TTS, audio, and SRT.
- It blocks pre-render failures when no acceptable MP4 can be made. If a video renders but final QC is below the publish score, Telegram receives it as a review copy with the V2 score and top issues in the caption.
- Blocked no-render runs still save `quality-v2.json`, `storyboard.json`, `retry-log.json`, `api-usage.json`, and a Telegram text alert explaining the failed gate.
- Use `--allow-needs-review-upload true` only for private debug uploads of a rejected MP4.

Default World Cup models:

- Text-heavy work now defaults to `gemini-3.1-flash-lite`: search/evidence, script writing, script evaluation, TTS rewrite, and audio-aware SRT.
- Search falls back to `gemini-2.5-flash-lite` then `gemini-2.5-flash` if the Lite default is temporarily blocked.
- Evidence now uses multiple grounded research passes, then a separate JSON consolidation pass so malformed search-grounded text does not create fake-specific stats.
- World Cup runs keep light memory of recent topics, hooks, angles, and visual assets to reduce repeated ideas and repeated stock clips.
- Visual selection dedupes clips within the run, avoids recently used clips where possible, uses player/team-aware queries for USMNT and other team-focused topics, and tries a backup football clip before falling back to a board.
- Live Wikimedia/Commons player images are off by default with `WORLD_CUP_ENABLE_WIKIMEDIA_VISUALS=false`. Production runs prefer stock clips plus local entity images from your downloads library as overlays; set `WORLD_CUP_LOCAL_ENTITY_OVERLAY_SCREEN_RATIO=0.72` to keep those overlays around 70-75% of the frame.
- Gemma visual review (`WORLD_CUP_VISUAL_REVIEW_MODEL`, default `gemma-4-26b-a4b-it`) performs a generic logo/watermark/off-topic/source-risk check; Gemini 2.5 Flash Lite (`WORLD_CUP_VISUAL_SELECTION_MODEL`) then reviews relevance and can request retry searches, falling back to `WORLD_CUP_VISUAL_SELECTION_FALLBACK_MODELS` on quota/server errors.
- Local asset packs can be built from the dashboard or CLI. They save reviewed Wikimedia images under `.tmp-worldcup/asset-packs/` and index reviewed stock candidates for future runs.
- Caption design now uses `WORLD_CUP_CAPTION_DESIGN_MODEL` to choose per-SRT emphasis words and animation style. Mid-screen punchlines are off by default to avoid duplicate-looking captions; set `WORLD_CUP_CAPTION_MIDSCREEN=auto` or `on` only when you want that optional treatment.
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

Asset-pack discovery uses `WORLD_CUP_ASSET_SEARCH_MODEL` first, default `gemini-2.5-pro`, then falls back to the configured lower-quota models and curated team/player seeds. Production visual planning now keeps Wikimedia/Commons live image sourcing disabled by default and uses Pexels/Pixabay clips plus local entity image overlays.

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
  - Alternative split-secret setup: `GOOGLE_SERVICE_ACCOUNT_EMAIL` plus `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
  - Also accepted: `GOOGLE_CLIENT_EMAIL` plus `GOOGLE_PRIVATE_KEY`
  - `GOOGLE_DRIVE_FOLDER_ID`
- Share that Drive folder with the service account `client_email`, giving it Editor access.
- `GOOGLE_SERVICE_ACCOUNT_JSON` must be the full service account JSON file, not only the `private_key` value. Workspace domain-wide delegation is not required for direct service-account uploads when the folder is shared with the service account.
- `GOOGLE_DRIVE_FOLDER_ID` must point to a Drive folder, not a file. A full folder URL is accepted.
- Optional Drive variables:
  - `GOOGLE_DRIVE_MAKE_PUBLIC=false`. Set to `true` only if you want generated files shared by link.
  - `GOOGLE_DRIVE_SCOPE=https://www.googleapis.com/auth/drive`
  - `WORLD_CUP_DRIVE_FALLBACK_TELEGRAM=true`
- Optional upload target variable: `WORLD_CUP_UPLOAD_TARGET=auto`, `telegram`, `google-drive`, or `r2`.
- Optional variable: `WORLD_CUP_STRATEGY=classic` or `viral2`. Keep `classic` when you want the baseline; switch to `viral2` for the stricter viral-content gates.
- Optional V2 quality variables:
  - `WORLD_CUP_QUALITY_MODE=v2`
  - `WORLD_CUP_V2_SCRIPT_PUBLISH_SCORE=85`
  - `WORLD_CUP_V2_FINAL_PUBLISH_SCORE=88`
  - `WORLD_CUP_V2_MAX_SCRIPT_RETRIES=2`
  - `WORLD_CUP_V2_MAX_VISUAL_RETRIES=3`
  - `WORLD_CUP_V2_REQUIRE_ZERO_FALLBACKS=true`
  - `WORLD_CUP_V2_TELEGRAM_SEND_FAILED_MP4=true`
- Optional R2 fallback secrets:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_R2_ACCESS_KEY_ID`
  - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
- Add repository variable `R2_PUBLIC_BASE_URL` only if using R2 with a public domain.
- Optional secrets: `PEXELS_API_KEY`, `PIXABAY_API_KEY`.
- Google Drive output is saved under `worldcup/YYYY-MM-DD/team-a-vs-team-b/` inside the configured folder when Drive is selected or used as fallback.

Azure/VM trend controller:

- The controller does not render video. It watches match windows/trends, then triggers the GitHub Actions video factory through `workflow_dispatch`.
- The controller requires Node 24+ because it uses Node's built-in SQLite runtime for persistent trigger state.
- Before enabling live dispatch on Azure, verify that `WORLD_CUP_CONTROLLER_DB_FILE` is on persistent VM disk, not temporary storage:

```bash
node -v
df -h
readlink -f .tmp-worldcup
```

- Restart the VM once in dry-run mode and confirm the SQLite DB file still exists before enabling real dispatch.
- Dry-run locally:

```bash
npm run worldcup:controller:dry -- --offline
```

- Run once on a VM:

```bash
npm run worldcup:controller -- --once
```

- Run continuously every 15 minutes:

```bash
npm run worldcup:controller
```

- Required controller env:
  - `WORLD_CUP_GITHUB_REPO=owner/repo`
  - `WORLD_CUP_GITHUB_TOKEN` with fine-grained Actions write access
  - `YOUTUBE_API_KEY` for YouTube trend signals
- Optional controller env:
  - `WORLD_CUP_GITHUB_REF=main`
  - `WORLD_CUP_WORKFLOW_FILE=worldcup-pipeline.yml`
  - `WORLD_CUP_CONTROLLER_INTERVAL_MINUTES=15`
  - `WORLD_CUP_TREND_THRESHOLD=95`
  - `WORLD_CUP_CONTROLLER_DAILY_TOTAL_LIMIT=6`
  - `WORLD_CUP_CONTROLLER_DAILY_TREND_LIMIT=3`
  - `WORLD_CUP_CONTROLLER_TREND_COOLDOWN_MINUTES=60`
  - `WORLD_CUP_CONTROLLER_SKIP_NOTICE_COOLDOWN_MINUTES=180`
  - `WORLD_CUP_CONTROLLER_DB_FILE=.tmp-worldcup/azure-controller-state.sqlite`
  - `WORLD_CUP_ESPN_ENABLED=true` enables ESPN scoreboard match-window triggers.
  - `WORLD_CUP_MATCH_LOOKAHEAD_DAYS=3`
  - `WORLD_CUP_PREMATCH_WINDOW_HOURS=12,72`
  - `WORLD_CUP_POSTMATCH_DELAY_MINUTES=20`
  - `WORLD_CUP_VIP_TEAMS=Real Madrid|Barcelona|Manchester City|Arsenal|Bayern Munich|Liverpool|Paris Saint-Germain|Manchester United|Juventus|Inter Milan|Argentina|Algeria|Australia|Austria|Belgium|Portugal|France|Brazil|England|Spain|Germany|Netherlands|Croatia|Uruguay|Colombia|Italy|Morocco|Senegal|Ghana|Nigeria|Ivory Coast|Cote d'Ivoire|Egypt|South Africa|Cameroon|Japan|South Korea|Ecuador|Paraguay|Chile|Peru|Switzerland|Denmark|Sweden|Norway|Poland|Serbia|Turkey|Czechia|Costa Rica|Panama|New Zealand|Saudi Arabia|Iran|Qatar|Tunisia|Scotland|Wales|Cape Verde|Cabo Verde|Curacao|USA|USMNT|United States|Mexico|Canada`
  - `WORLD_CUP_VIP_PLAYERS=Messi|Ronaldo|Mbappe|Haaland|Yamal|Bellingham|Vinicius|De Bruyne|Pulisic|Neymar|Kane|Saka|Foden|Palmer|Musiala|Wirtz|Kimmich|Havertz|Modric|Salah|Son|Lewandowski|Griezmann|Pedri|Gavi|Rodri|Morata|Valverde|Darwin Nunez|Luis Diaz|Davies|David|Reyna`
  - `WORLD_CUP_YOUTUBE_SPIKE_ENABLED=true` enables the rolling YouTube trend finder.
  - `WORLD_CUP_YOUTUBE_SCAN_MAX=100`
  - `WORLD_CUP_YOUTUBE_DISCOVERY_ENABLED=true`
  - `WORLD_CUP_YOUTUBE_DISCOVERY_INTERVAL_MINUTES=60`
  - `WORLD_CUP_YOUTUBE_DISCOVERY_MAX_PER_RUN=100`
  - `WORLD_CUP_YOUTUBE_STATS_INTERVAL_MINUTES=30`
  - `WORLD_CUP_YOUTUBE_POOL_RETENTION_HOURS=24`
  - `WORLD_CUP_YOUTUBE_POOL_MAX=2400`
  - `WORLD_CUP_YOUTUBE_MIN_BASELINE_VIEWS=1000`
  - `WORLD_CUP_YOUTUBE_SPIKE_GROWTH_PERCENT=100`
  - `WORLD_CUP_YOUTUBE_SPIKE_MIN_DELTA_VIEWS=1000`
  - `WORLD_CUP_YOUTUBE_STRONG_DELTA_VIEWS=10000`
  - `WORLD_CUP_YOUTUBE_STRONG_DELTA_MIN_GROWTH_PERCENT=50`
  - `WORLD_CUP_YOUTUBE_TOPIC_MIN_SPIKE_VIDEOS=10`
  - `WORLD_CUP_YOUTUBE_TOPIC_MIN_CHANNELS=4`
  - `WORLD_CUP_YOUTUBE_TOPIC_MIN_CONFIDENCE=75`
  - `WORLD_CUP_YOUTUBE_CLUSTER_ANALYZER=gemini`
  - `WORLD_CUP_YOUTUBE_DIAGNOSTIC_RETENTION_HOURS=24`
  - `WORLD_CUP_YOUTUBE_API_KEYS=key1|key2` optionally rotates multiple YouTube Data API keys without exposing them in logs.
  - Discovery uses about 48 YouTube `search.list` calls/day by default; 30-minute stats refresh uses `videos.list` on the saved 24-hour pool.
  - `npm run worldcup:youtube-health` prints the last-24-hour trend finder diagnostics from SQLite.
  - `WORLD_CUP_ANALYZER_MODEL=gemini-3.1-flash-lite` clusters repeated YouTube spike topics; set this to your Gemini 4-compatible model when available.
  - `WORLD_CUP_EVERGREEN_FALLBACK=true` lets the controller dispatch a safe evergreen World Cup topic when no spike or match-window candidate passes.
  - `WORLD_CUP_CONTROLLER_ENABLE_GEMINI_TRENDS=false` keeps trend discovery on fixtures plus YouTube Data API. Set it to `true` only when you intentionally want to spend Gemini search-grounding quota.
  - `WORLD_CUP_LEGACY_TRIGGER_ENABLED=false` keeps the old checked-in fixture/old YouTube/old Gemini trend finder dormant. Set to `true` only for rollback comparison.
  - `WORLD_CUP_CONTROLLER_TELEGRAM_COMMANDS=true` lets the VM listen for manual Telegram commands.
  - `WORLD_CUP_INTENT_LLM_ENABLED=true` lets the Telegram controller parse natural-language text requests through a Gemma-compatible API.
  - `WORLD_CUP_INTENT_LLM_PROVIDER=gemma-api`
  - `WORLD_CUP_INTENT_LLM_URL=https://your-gemma-endpoint`
  - `WORLD_CUP_INTENT_LLM_API_KEY=...` optional bearer token.
  - `WORLD_CUP_INTENT_LLM_MODEL=gemma-4-31b-it`
  - `WORLD_CUP_INTENT_LLM_API_STYLE=openai-chat` for OpenAI-compatible chat endpoints, or `prompt` for simple local prompt endpoints.
  - `WORLD_CUP_INTENT_LLM_TIMEOUT_MS=15000`
  - `WORLD_CUP_FIXTURES_JSON=[{"date":"2026-06-12","teamA":"USA","teamB":"Paraguay","kickoff":"2026-06-13T02:00:00Z","topic":"USA vs Paraguay World Cup prediction"}]`
- Prediction videos trigger when a VIP fixture is between 12 and 72 hours before kickoff by default. Postmatch videos trigger after expected full-time plus a safety delay.
- ESPN VIP matches now create the main pre-match and post-match candidates. YouTube spike scans and the analyzer run before match-window candidates, and evergreen fallback runs last so the controller does not silently starve on empty trend data. The selected candidate is sent to the existing `worldcup-pipeline.yml` `workflow_dispatch` inputs so GitHub Actions starts the same scraping, evidence, content, render, and upload pipeline.
- Telegram manual dispatch commands:
  - `/wc topic Ronaldo vs Messi 2026 World Cup bracket`
  - `/wc prediction USA vs Paraguay | USA vs Paraguay pressure prediction | 2026-06-13T02:00:00Z`
  - `/wc post USA vs Paraguay | USA vs Paraguay post-match: the moment that changed the game`
  - `/wc status`
- Telegram natural-language examples when the intent LLM is enabled:
  - `Create a video on any trending World Cup topic`
  - `Make a prediction video for USA vs Paraguay about pressure`
  - `What is the controller status?`
  - Breaking-news requests such as injuries or red cards are parsed, but blocked until a verified-source path is available.

## World Cup research mode

World Cup evidence collection defaults to `WORLD_CUP_RESEARCH_MODE=scrape`. The pipeline scrapes public web/RSS/search-result pages first, then asks `WORLD_CUP_WRITER_MODEL` (`gemini-3.1-flash-lite` by default) to convert the raw scraped excerpts into the existing evidence JSON shape. This avoids spending Gemini search-grounding quota on every research pass. Set `WORLD_CUP_RESEARCH_MODE=grounding` only for manual comparison runs.

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
