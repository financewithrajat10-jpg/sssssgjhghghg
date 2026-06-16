# World Cup Pipeline Report

This report explains the World Cup short-video automation in simple language. It is written for operating the system, improving it, and understanding what happens when a GitHub Actions run starts.

---

## Page 1 of 10 - The Whole System In One View

The pipeline is an automatic short-video factory for the football channel. Its job is to choose a useful World Cup topic, research it, write a short script, create voice/audio/captions, choose visuals, render an MP4, and publish the result.

The normal intended flow is:

1. GitHub Actions starts the workflow.
2. The scheduler decides whether to run now.
3. The pipeline chooses a match/topic.
4. It gathers evidence and avoids repeating recent topics.
5. Gemini creates or improves scripts.
6. The pipeline chooses the best script.
7. It rewrites the script for natural TTS.
8. It creates audio and timed captions.
9. It selects visuals and writes rights/attribution records.
10. FFmpeg renders the final vertical MP4.
11. Telegram receives the MP4 when possible.
12. YouTube receives the MP4 when YouTube upload is enabled.
13. Telegram receives a text confirmation with YouTube status/link.

The key principle is that YouTube is now treated as a real publishing channel, not just a backup file host. Telegram is useful for review and delivery, but Telegram size limits should not decide whether a finished MP4 reaches YouTube.

Important current production settings:

- `WORLD_CUP_YOUTUBE_UPLOAD=true`
- `WORLD_CUP_YOUTUBE_PRIVACY=public`
- `WORLD_CUP_YOUTUBE_MAX_PER_DAY=5`
- `WORLD_CUP_YOUTUBE_NOTIFY_SUBSCRIBERS=false`
- `WORLD_CUP_YOUTUBE_METADATA_MODEL=gemini-3.1-flash-lite`

The safety rule is still strict where it matters. YouTube upload should continue past V2 quality warnings, Telegram file-size problems, Drive fallback problems, or R2 fallback problems. But YouTube should still stop for real hard failures: missing MP4, empty MP4, missing OAuth credentials, YouTube API rejection, invalid metadata, or an asset explicitly marked with `rightsStatus: "blocked"`.

Every run writes sidecar JSON files. These files are the audit trail. They let you see what topic was chosen, what evidence was used, what script was selected, what visuals were picked, what the quality system warned about, what metadata was sent to YouTube, and what upload result came back.

---

## Page 2 of 10 - How A Run Starts

The GitHub workflow is `.github/workflows/worldcup-pipeline.yml`.

It has two start methods:

1. `schedule`
   The workflow has a cron schedule. GitHub wakes it up automatically.

2. `workflow_dispatch`
   A manual or API-triggered run. This can be started from GitHub UI, GitHub CLI, or another automation.

After GitHub starts the workflow, the workflow runs:

```bash
node worldcup/cli.mjs --scheduled ...
```

The CLI reads inputs such as:

- `mode`
- `strategy`
- `date`
- `team_a`
- `team_b`
- `topic`
- `render`
- `upload`
- `upload_target`
- `youtube_upload`
- `youtube_privacy`
- `youtube_max_per_day`
- `quality_mode`
- `strict_publish`
- `force`

For scheduled runs, the code does not blindly create a video every time GitHub wakes it up. The scheduler checks:

- Is this an allowed hour?
- Did we already hit the daily video limit?
- Did the user give a specific topic or match?
- Are we inside the World Cup tournament window?
- Should this be a prediction, post-match video, or pre-tournament idea?

The daily limit comes from `WORLD_CUP_MAX_VIDEOS_PER_DAY`. The YouTube public/unlisted cap comes separately from `WORLD_CUP_YOUTUBE_MAX_PER_DAY`.

This means there are two different caps:

- General pipeline cap: how many videos the pipeline should make in a day.
- YouTube cap: how many non-private YouTube uploads should happen in a day.

Manual runs with `force=true` can bypass the general schedule and daily limit. This is useful for testing, but it also means manual/API workflow dispatch can start a long run at any time.

Important lesson from the recent 36 minute run:

That run was `workflow_dispatch` on `main`, not a schedule run. It was triggered by the GitHub account or an automation using that account. It spent most of its time doing the normal generation/render process, then failed at the final upload stage because Google Drive rejected service-account storage.

---

## Page 3 of 10 - How It Finds A Trend Or Topic

The scheduler lives mainly in `worldcup/modules/scheduler.mjs`.

If you give a specific topic, team, match id, or match pairing, the pipeline uses that. This is the explicit path.

If you do not give a specific topic, the pipeline chooses automatically. It uses a few layers:

1. Memory
   It loads recent runs so it can avoid repeating the same hooks, topics, jokes, and angles.

2. Tournament window check
   The code treats June 11, 2026 through July 19, 2026 as the World Cup tournament window. During this window, matchday content is preferred.

3. Matchday opportunity
   It asks Gemini with Google Search grounding to choose the best World Cup short-video opportunity for the current date. The prompt tells it to prefer actual matches today or in the next 18 hours. If a match has not started, the topic becomes a prediction. If a match has ended and enough reliable result detail exists, the topic becomes post-match analysis.

4. Fallback fixture list
   If search is unavailable or weak, the code has a small fallback list of known opening fixtures. That prevents total failure when the search model cannot return a clean answer.

5. Pre-tournament topic fallback
   Outside a matchday situation, it chooses a broader World Cup topic. Examples include trap teams, host pressure, stars needing a final moment, and midfield pressure.

The topic selection is not meant to be random. It is trying to find a topic with:

- recognizable teams or players
- current fan interest
- clear debate
- visual potential
- a comment-friendly angle
- low repetition compared with recent channel memory

The system also avoids overusing some generic topics. For example, it tries not to keep repeating the same "home advantage" idea unless there is genuinely fresh news.

The final output of this stage is a run input like:

- type: `prediction`, `postmatch`, or `pre-tournament`
- topic
- team A
- team B
- match id
- kickoff time
- venue

That becomes the seed for the rest of the run.

---

## Page 4 of 10 - How It Gets Data And Evidence

Evidence collection lives mainly in `worldcup/modules/script.mjs`.

The pipeline does not want scripts that make unsupported claims. So before writing the final short, it builds an evidence pack. The evidence pack is a structured summary of what the system knows about the topic.

The evidence stage can use:

- Gemini with search grounding
- scraped text from web pages
- local extraction from live commentary or match text
- fallback evidence when external data is weak
- recent memory from older runs

The evidence pack can include:

- topic
- match information
- key players
- key claims
- tactical angles
- possible turning points
- source summaries
- trusted source claims
- risks or missing data

The system is careful about hard facts. A "hard fact" means something like a score, stat, injury claim, quote, or specific event. The script quality system checks whether hard facts are backed by trusted source claims.

If the evidence is weak, the script should be more opinion-based and less factual. For example:

Good with weak evidence:

> This match has pressure written all over it.

Risky with weak evidence:

> This team has lost 7 of its last 8 matches.

The second claim needs a reliable source. If the evidence pack cannot support it, the script should not say it.

The pipeline writes evidence to `evidence.json`. This is one of the most important audit files. When a video performs badly or a claim feels suspicious, check `evidence.json` first.

Simple rule:

The evidence stage is the pipeline's "do we actually know this?" layer.

---

## Page 5 of 10 - How It Writes The Script

The script system is mainly in `worldcup/modules/script.mjs`.

The current main style is `viral2`. This is not just "make it viral." It is a structure for short football videos:

- fast first sentence
- clear conflict or contradiction
- evidence-backed angle
- simple football language
- memorable line
- comment trigger
- TTS-friendly wording

The script process has several steps:

1. Build viral strategy
   The system turns the evidence into a plan. It decides the angle, likely audience, hook style, comment trigger, and what kind of emotional pressure the video should use.

2. Generate script candidates
   Gemini writes multiple candidate scripts. They should be short enough for Shorts, usually around the 35 to 55 second range.

3. Polish or edit
   The pipeline can edit scripts if they are too generic, too weak, too long, or not aligned with the evidence.

4. Score scripts
   The scripts are judged. The judge looks at hook strength, clarity, evidence use, football feel, comment potential, and safety.

5. Pick the best script
   The selected script becomes the run's spoken script.

6. Rewrite for TTS
   A spoken script is different from a written caption. The pipeline rewrites for natural voice delivery, removes awkward tags, and keeps the script listenable.

7. Create caption timing
   The system creates or estimates timed captions from the script/audio.

The script must avoid:

- invented facts
- copied source text
- raw URLs
- prompt artifacts such as "return JSON"
- spammy claims
- too much complexity
- unsupported statistics

The output files for this stage include:

- `script.json`
- `viral-strategy.json`
- later, `srt.srt` and `captions.json`

Simple rule:

The script stage turns evidence into a watchable opinion, not a fake news report.

---

## Page 6 of 10 - How Quality V2 Works

Quality V2 lives in `worldcup/modules/quality-v2.mjs`.

V2 is a quality advisor. It checks the video at several stages:

1. Script gate
   Checks the selected script. It looks for unsafe claims, prompt artifacts, unsupported stats, length problems, weak first sentence, and repeated phrases.

2. Visual gate
   Checks storyboard and visual plan. It looks for fallback visuals, missing central entities, repeated visuals, weak first visual, and rights problems.

3. Caption/audio gate
   Checks whether captions and audio are likely usable.

4. Post-render gate
   Checks the final MP4 after FFmpeg renders it. It checks duration, caption coverage, audio volume, and similar final-output signals.

The important decision we made:

V2 must not block YouTube upload by itself.

That means if V2 says "blocked" because the hook is weak or the visual mix is not ideal, YouTube can still upload the MP4. V2 warnings still get written into sidecars and Telegram notes, but they do not prevent publishing.

This matches the business goal:

- keep improving quality every day
- avoid losing uploads because a diagnostic system is too strict
- spend human time improving the pipeline instead of manually uploading files

V2 can still block some pre-render situations when there is no MP4 or when rendering is not allowed. But once an MP4 exists, YouTube should only stop for hard technical/compliance failures.

The most useful V2 files are:

- `quality-v2.json`
- `storyboard.json`
- `retry-log.json`
- `quality.json`

Simple rule:

V2 tells us what to improve. It should not act like the final business owner of publishing.

---

## Page 7 of 10 - Visuals, Rights, Voice, Captions, And Audio

The visual system is mainly in `worldcup/modules/visuals.mjs`.

The render system is mainly in `worldcup/modules/render.mjs`.

The pipeline tries to avoid cheap-looking automation. It does this by planning visuals around the script. It can use:

- stock clips
- stock images
- local entity assets
- Wikimedia visuals if enabled
- fallback cards when no real visual is available

The visual plan is written to `visuals.json`.

Rights and attribution are written to:

- `rights.json`
- `attribution.json`

The rights manifest is important. If an asset is explicitly marked `rightsStatus: "blocked"`, YouTube upload should stop. That is one of the real hard blockers.

Captions are built from the script/audio timing. The pipeline writes:

- `srt.srt`
- `captions.json`

The audio process includes:

- TTS voice generation
- optional background music
- audio normalization during render
- caption coverage checks after render

The render process uses FFmpeg. It creates a vertical MP4 suitable for Shorts:

- 1080 x 1920 style vertical frame
- segment-by-segment video
- burned captions
- voice audio
- optional background music
- final quality sidecar

If a segment has no selected visual, the renderer can create fallback cards so the video still renders. Those fallback visuals are useful for reliability, but too many fallback cards can make the video look automated. That is why V2 tracks fallback visuals and visual quality.

Simple rule:

Visuals and captions are not just decoration. They are part of the retention system.

---

## Page 8 of 10 - What Files A Run Produces

Each pipeline run creates a run folder under the World Cup run storage area. The exact folder path depends on the local/GitHub environment, but the run id is the key.

Common files:

- `run.json`
- `script.json`
- `evidence.json`
- `viral-strategy.json`
- `visual-scout.json`
- `visuals.json`
- `attribution.json`
- `rights.json`
- `quality.json`
- `quality-v2.json`
- `storyboard.json`
- `retry-log.json`
- `captions.json`
- `srt.srt`
- `render-log.json`
- `api-usage.json`
- final MP4
- `telegram.json`
- `youtube-metadata.json`
- `youtube.json`

The most important files for debugging:

1. `run.json`
   The full current state of the run.

2. `evidence.json`
   What the script was allowed to rely on.

3. `script.json`
   What was written and selected.

4. `visuals.json`
   Which visuals were chosen for each segment.

5. `rights.json`
   Whether any asset has a rights problem.

6. `quality-v2.json`
   Quality warnings and gate results.

7. `render-log.json`
   How FFmpeg rendered the video and what fallback visuals/audio choices happened.

8. `youtube-metadata.json`
   The title, description, hashtags, tags, category, privacy, and synthetic-media decision.

9. `youtube.json`
   The final YouTube status, video id, URL, gate result, metadata, and warnings.

10. `api-usage.json`
   API usage summary for the run.

Simple rule:

If something feels wrong, do not guess. Read the sidecars.

---

## Page 9 of 10 - Uploads, Telegram Limit, And YouTube Publishing

Telegram is useful, but Telegram has file-size limits. If the MP4 is too large, Telegram can reject it.

Before the latest fix, the risky path was:

1. MP4 renders successfully.
2. Pipeline tries Telegram.
3. Telegram rejects the MP4 because it is too large.
4. Pipeline tries Google Drive fallback.
5. Drive fails because the service account has no storage quota.
6. Pipeline fails before YouTube gets a chance.

That is not the desired production behavior.

The fixed intended behavior is:

1. MP4 renders successfully.
2. Pipeline tries the primary delivery path.
3. If Telegram/Drive/R2 delivery fails, the error is saved as a warning.
4. If YouTube upload is enabled and the MP4 exists, YouTube still uploads.
5. Telegram receives a text message with the YouTube result if Telegram text is available.

YouTube metadata is generated in `worldcup/modules/youtube.mjs`.

The metadata includes:

- title
- description
- hashtags
- tags
- category id
- privacy status
- made for kids
- synthetic media flag
- rationale

Defaults:

- category id: `17` for Sports
- made for kids: `false`
- notify subscribers: `false`
- privacy: from `WORLD_CUP_YOUTUBE_PRIVACY`

The metadata model is currently `gemini-3.1-flash-lite`.

Because Gemini can sometimes have transient server issues, YouTube metadata generation now retries with staged delays:

- first retry after 5 seconds
- second retry after 10 seconds
- third retry after 15 seconds

If all metadata attempts fail, the system creates fallback metadata from the run topic, teams, and script. That prevents a temporary metadata-model problem from wasting a finished MP4.

Simple rule:

Telegram is delivery. YouTube is publishing. Telegram size should not stop YouTube publishing.

---

## Page 10 of 10 - Operations, Risks, And Daily Runbook

Current GitHub requirements:

Secrets:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Variables:

- `WORLD_CUP_YOUTUBE_UPLOAD=true`
- `WORLD_CUP_YOUTUBE_PRIVACY=public`
- `WORLD_CUP_YOUTUBE_MAX_PER_DAY=5`
- `WORLD_CUP_YOUTUBE_NOTIFY_SUBSCRIBERS=false`
- `WORLD_CUP_YOUTUBE_METADATA_MODEL=gemini-3.1-flash-lite`

Recommended daily operating rule:

- Keep max public YouTube uploads at 5 per day.
- Review Telegram confirmation messages.
- Watch `youtube.json` for upload status.
- Watch `quality-v2.json` for improvement ideas.
- If a run takes too long, check the active GitHub Actions step first.
- If it fails at upload, read the final error and `telegram.json` / `youtube.json`.

Common failures and what they mean:

1. Telegram file too big
   The MP4 crossed Telegram's practical upload limit. YouTube should still upload if enabled.

2. Google Drive service account storage quota
   Service accounts do not have normal personal Drive storage. Use Shared Drives/OAuth delegation, or do not rely on Drive fallback.

3. Gemini server/overload issue
   Metadata generation has retries. Other Gemini stages also have fallback behavior, but some generation stages can still fail if all model attempts fail.

4. YouTube OAuth failure
   Refresh token, client id, or client secret is wrong/expired/missing.

5. YouTube API rejection
   YouTube rejected the upload request. Check `youtube.json` and GitHub logs.

6. Rights blocked
   An asset was explicitly marked blocked. This should stop YouTube.

7. Daily cap reached
   The pipeline or YouTube cap prevented another run/upload.

The most important production review:

- The YouTube path is now the final publishing path.
- Telegram should not block YouTube.
- V2 quality is advisory for YouTube.
- Public uploads are enabled, so every scheduled/default successful MP4 can publish publicly once this branch is merged into the branch that scheduled Actions use.

Recommended next improvement:

Add a dedicated "publishing summary" sidecar that shows one clean row for each publishing channel:

- Telegram: sent / failed / skipped
- YouTube: uploaded / blocked / failed / skipped
- Drive: uploaded / failed / skipped
- R2: uploaded / failed / skipped

That would make operations even easier because the final status would be readable without opening multiple sidecar files.
