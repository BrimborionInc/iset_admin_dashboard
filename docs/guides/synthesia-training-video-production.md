# Synthesia Training Video Production

Status: maintained agent runbook.
Last reviewed: 2026-06-07.

Purpose: guide future Codex threads that help Bill produce PATH tutorial and staff-training videos with Synthesia.

## Access And Secrets

Bill's Synthesia API key is stored locally in the repo-root `.env` as `SYNTHESIA_API_KEY`. Keep the key out of chat, docs, commits, screenshots, and generated artifacts.

The repo-root `.env` is ignored by git. Load it with a dotenv-compatible tool such as `dotenv`, `env-cmd`, or a small Node script. Do not assume `.env` can be safely shell-sourced; at the time this runbook was created, the local `DB_PASS` line contained shell-significant characters that caused `source .env` noise even though dotenv parsing worked.

Verify access with a read-only API call before doing production work. The current low-impact smoke is:

```bash
node - <<'NODE'
require('dotenv').config({ path: '.env' });

async function main() {
  if (!process.env.SYNTHESIA_API_KEY) {
    throw new Error('Missing SYNTHESIA_API_KEY in .env');
  }

  const response = await fetch('https://api.synthesia.io/v2/videos?limit=1', {
    headers: {
      Authorization: process.env.SYNTHESIA_API_KEY,
    },
  });

  console.log(`Synthesia List videos status: ${response.status}`);
  if (!response.ok) {
    const body = await response.text();
    console.log(body.slice(0, 500));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
NODE
```

Verified on 2026-06-07: `GET https://api.synthesia.io/v2/videos?limit=1` returned `HTTP 200` using the local `SYNTHESIA_API_KEY`.

## Current API Surface

Use Synthesia's official docs as the current source before creating or modifying videos:

- Documentation index: https://docs.synthesia.io/llms.txt
- List videos: https://docs.synthesia.io/reference/list-videos.md
- Create video: https://docs.synthesia.io/reference/create-video.md
- List templates: https://docs.synthesia.io/reference/list-templates.md
- Template guide: https://docs.synthesia.io/reference/guide-create-a-video-from-template.md
- Create from template: https://docs.synthesia.io/reference/create-a-video-from-a-template.md
- Upload video/image asset: https://docs.synthesia.io/reference/create-an-asset.md
- Script XML controls: https://docs.synthesia.io/reference/script-supported-xml-tags.md
- Studio pronunciation controls: https://docs.synthesia.io/docs/pronunciation-controls.md
- Workspace glossary: https://docs.synthesia.io/docs/translation-glossary.md
- Retrieve video: https://docs.synthesia.io/reference/retrieve-a-video.md
- Update video: https://docs.synthesia.io/reference/update-a-video.md

As of the 2026-06-07 check, Synthesia's public API base URL is `https://api.synthesia.io`, video listing is `GET /v2/videos`, template listing is `GET /v2/templates`, and authentication is an API key sent in the `Authorization` header.

## Capability Boundaries

For PATH training shorts, prefer a Synthesia Studio template that Bill creates once with the desired talking-head/screen-capture layout. The API can then populate that template repeatedly with script text, canvas text, avatar variables, and background/media variables.

Confirmed API capabilities as of 2026-06-07:

- Create videos directly with `POST /v2/videos`, using one or more scene inputs. Each input can set an avatar, avatar settings, background, background settings, `scriptText` or uploaded `scriptAudio`, sound settings, and transition.
- Create videos from a Studio template with `POST /v2/videos/fromTemplate`, passing `templateId` and `templateData`.
- Use template variables for script text, canvas text, media elements, background media, and avatars when those variables were authored in Synthesia Studio and the template was published.
- Upload image/video assets to `https://upload.api.synthesia.io/v2/assets`; accepted types are `image/jpeg`, `image/png`, `image/svg+xml`, `video/mp4`, and `video/webm`. Uploaded assets can be used as backgrounds or template media variable values. For video variables, match the template placeholder aspect ratio to avoid stretching/cropping.
- Provide a screen capture as an MP4/WebM asset or as a URL value for a background/media variable. This supports Bill's manual pattern of a PATH screen capture demo with avatar narration.
- Control avatar style through API fields: `rectangular`, `circular`, or `voiceOnly`; horizontal alignment and scale are exposed, while vertical alignment is fixed to bottom for rectangular avatars.
- Specify voice by `input[].avatarSettings.voice`; if omitted, Synthesia assigns a default voice that may change, so use explicit voice IDs for repeatable training-video output.
- Use script XML tags `<break time="..."/>` and `<sub alias="...">...</sub>` for pauses and pronunciation/caption control.
- Verified on 2026-06-07: `POST /v2/videos` accepted `scriptText` containing `<sub alias="En-whack">NWAC</sub>` and the private test-mode render completed successfully.
- Create videos in `test` mode. Test videos are free and do not count toward quota, but include a watermark.
- Test-video creation is limited to 30 test videos per day.
- Poll video status with `GET /v2/videos/{video_id}`. Completed videos return a time-limited `download` URL. Webhooks can replace polling for completion events.
- Update title, description, call-to-action settings, and visibility with `PATCH /v2/videos/{video_id}`. Visibility can be `private` or `public`.
- List/retrieve templates, list/retrieve videos, retrieve thumbnails, delete videos, create/list/retrieve/delete webhooks, and run translation/XLIFF/dubbing workflows.

Confirmed practical limits:

- The public API index does not expose Synthesia's in-app Assistant, AI Playground, AI script generator, screen recorder, editor timeline, animation/effect editor, quiz/interactivity editor, or point-and-click canvas layout editing as API operations. Those remain Studio/manual setup unless a future API adds them.
- The current public API index does not expose a separate endpoint for creating or updating Synthesia's workspace pronunciation glossary. For API-created videos, apply known pronunciation fixes directly in `scriptText` or in template script variables with `<sub alias="spoken form">visible term</sub>`.
- The raw `POST /v2/videos` endpoint is useful for simple generated videos, but it is not the best fit for polished PATH shorts because it exposes a limited scene schema. Use published templates for consistent layout, canvas text, logos, and screen-capture placement.
- The API can use a screen capture file once it exists, but it does not itself record a live PATH browser session. Codex can help create screen captures separately with local browser/screen-recording tooling if explicitly requested and privacy-reviewed.
- The API can render the video and provide a download URL, but final human review in Synthesia or as an MP4 is still required before using the short for staff training.

Rate limits vary by Synthesia plan. As of 2026-06-07, the published Creator tier is 60 requests/minute, 300 write requests/hour, 1,000 write requests/day, and 20k read requests/day per endpoint. Enterprise tiers are higher. A `429 Too Many Requests` response includes `RateLimit-Limit` and `RateLimit-Reset` headers.

## PATH Tutorials Dashboard

Support > Tutorials (`/tutorials-dashboard`) is the PATH staff training hub. It combines:

- Training shorts: Synthesia-hosted videos listed from `src/tutorials/trainingShorts.js`.
- Guided tours: Cloudscape in-app walkthroughs with DB-backed completion/reset state.

Keep the visible training-short table intentionally lean: show the short title/description, length, and watch action. Review date, topic, audience, and draft/publication status can remain in metadata for production control, but do not expose them as visible columns unless Bill explicitly asks.

For training shorts and website-card videos, store metadata in PATH and host/play or review the video through Synthesia's player. Do not add generated MP4 files to the React app, git, or static build. As of 2026-06-25, do not download local MP4 review copies by default; Bill reviews drafts in Synthesia. Download rendered MP4s only when Bill explicitly asks for an offline copy, backup, external LMS/upload handoff, or another named archival/compliance reason.

When backfilling the Tutorials table from Synthesia, curate the workspace list. Include completed, public videos that are actual PATH training shorts, especially videos using the `PATH Training Shorts - ...` naming pattern, plus any explicitly approved watchable drafts. Do not automatically include long modules, private videos, release notes, smoke tests, or general introductions just because they exist in Synthesia.

Only mark a short `available` in `src/tutorials/trainingShorts.js` after the video is approved, generated outside test/watermark mode where appropriate, published/shareable in Synthesia, and safe for the staff audience. Draft or unapproved shorts should stay `inProduction` or `planned`. Avoid storing private/watermarked test-video IDs in app metadata unless Bill explicitly wants a test-only row; if he does, the row may be watchable while still showing a draft status. A `200` response from a Synthesia embed URL is not enough evidence; smoke the actual Tutorials modal and confirm the iframe plays instead of showing Synthesia's private/deleted-video message.

Synthesia share links are not search-discoverable, but published links and embeds are still publicly accessible to anyone with the URL unless Synthesia SSO/password protection is enabled. Keep PATH training shorts sanitized by default, with no applicant/client personal data.

## Prototype Findings

On 2026-06-07, a private watermarked sign-in prototype tested annotated PATH screenshots and a short animated screenshot clip. Findings:

- Subdued pulsing highlights work well for the initial click target when the motion is slow and the label is brief.
- Large arrows were too visually loud and risked covering meaningful screen content. Prefer rectangles, spotlight overlays, zoom crops, or numbered badges.
- A zoomed inset works well when the target is small or the full page contains too much surrounding detail.
- Form-entry steps are clearest with numbered badges, highlight boxes, and one short action label.
- Visual-QA annotated screenshots before upload; small coordinate mistakes are easier to catch locally than after Synthesia rendering.

On 2026-06-07, a private watermarked withdrawal-training draft was created from a disposable DEV Application Workspace fixture. Bill identified two required content corrections before this could become a real training short: withdrawal must cover both applicant-initiated withdrawal and staff/case-manager withdrawal when an applicant misses a document-response deadline, and the ending must show how a withdrawn application can be reopened. The obsolete Synthesia draft and local `tmp/synthesia-withdrawal-demo/` assets were deleted during cleanup after the corrected version replaced it.

On 2026-06-07, the corrected watermarked draft was created as Synthesia test video `c2cd268c-ad84-48cb-84a9-588f515d9a90`, titled `PATH training short - Withdrawing and reopening an application`, with duration `0:00:39.732`. Bill approved making this draft public/shareable for review while keeping the PATH row status as `Draft`. Source frames, capture summary, API result JSON, and the local review MP4 are under `tmp/synthesia-withdrawal-demo-v2/`; the review MP4 is `tmp/synthesia-withdrawal-demo-v2/path-withdrawing-and-reopening-application-draft.mp4`. This draft uses seven scenes and covers applicant/staff withdrawal reasons, factual withdrawal notes, automatic reporting records, reopening, reopen notes, and return to `In Review`.

Also on 2026-06-07, obsolete API/test videos were deleted from Synthesia after their lessons were captured: the duplicate withdrawal/reopen drafts, the earlier withdrawal-only draft, the NWAC pronunciation smoke, the sign-in annotation demo, and the hello-world API demo. Their local temporary asset folders were removed except for the current withdrawal/reopen draft.

Withdrawal-draft production notes:

- Use a temporary staff login and disposable DEV case/application fixture rather than real applicant data.
- Hide local-only Demo Controls before screenshot capture so staff do not learn a DEV-only visual landmark.
- Keep annotations on exact controls; broad text matching can accidentally highlight parent containers.
- The tested withdrawal flow verified application status `withdrawn`, lifecycle `closed`, the reporting-only `Actions leading to withdrawal` action plan, completed reporting interventions, and a ready ESDC submission row before fixture cleanup.
- Verify reopened state before cleanup when the training short includes reopen. The corrected draft verified the application returned to `in_review` and saved the reopen note.
- Render API background images at exact 1920x1080 when using a 16:9 Synthesia canvas with `backgroundSettings.scale = 1`. Smaller 16:9 assets such as 1440x810 are placed at pixel scale inside the 1920x1080 output, leaving Synthesia to fill the remaining canvas with blurred side/background areas.

On 2026-06-07, a watermarked ILMP submissions draft was created as Synthesia test video `4c3c1361-6e57-4bf9-aab1-37ae9232bd8c`, titled `PATH training short - ILMP submissions: preparing an export`, with duration `0:00:58.140`. Bill approved making this draft public/shareable and adding it to the Tutorials table as a watchable draft. Source frames, capture summary, API result JSON, and the local review MP4 are under `tmp/synthesia-ilmp-submissions-demo/`; the review MP4 is `tmp/synthesia-ilmp-submissions-demo/path-ilmp-submissions-draft.mp4`.

ILMP submissions draft production notes:

- The approved script used plain-English narration and per-script pronunciation tags for `<sub alias="I L M P">ILMP</sub>` and `<sub alias="E S D C">ESDC</sub>`.
- Browser capture used the live local PATH UI with Puppeteer, but intercepted ILMP queue/API responses with synthetic participant rows only. No real participant or DEV database record was used.
- The synthetic queue covered `Ready`, `Needs review`, and `Blocked`, plus the `Generate batch XML` modal with ready participants and excluded blocked records.
- The capture forced the browser-download variant of the XML action so the visual wording matched the approved script: `Download XML and mark exported`.
- Keep the `src/tutorials/trainingShorts.js` row status as `inProduction` and `lastReviewed` as `null` until Bill approves the video as final training content.

On 2026-06-07, a watermarked ILMP validation-and-repairs draft was created as Synthesia test video `77a83dc0-284b-4978-abdb-15a2f8b3d8cf`, titled `PATH training short - ILMP validation and repairs`, with duration `0:01:03.009`. Bill approved the script after removing case-level Export preview instructions; this short is about Case Workspace validation and repair, while the submission/export step belongs to the `ILMP Submissions & Exports` dashboard. Source frames, capture summary, API result JSON, and the local review MP4 are under `tmp/synthesia-ilmp-validation-repairs-demo/`; the review MP4 is `tmp/synthesia-ilmp-validation-repairs-demo/path-ilmp-validation-repairs-draft.mp4`. Bill approved making this draft public/shareable and adding it to the Tutorials table as a watchable draft for PROD release `20260607-prod-tutorials-training-shorts`.

ILMP validation-and-repairs draft production notes:

- The approved script used plain-English narration and per-script pronunciation tags for `<sub alias="I L M P">ILMP</sub>` and `<sub alias="E S D C">ESDC</sub>`.
- Browser capture used the live local Case Workspace and `ILMP Submissions & Exports` routes with intercepted API responses and synthetic participant/case data only. No real participant, DEV database record, or fixture cleanup was involved.
- The Case Workspace quick-layout label is `ILMP Validation and Export`, and the current quick layout includes the Export preview widget. Do not narrate case-level Export preview as the submission path; staff should repair and rerun validation in the case, then handle submission through the `ILMP Submissions & Exports` dashboard.
- Dismiss guided-tour overlays before screenshot capture. The Case Workspace route can show `Case workspace quick start`, which will otherwise obscure annotated frames.
- Exact text matching can hit repeated Case header summary text instead of the lower data widget. For repair scenes, target the Action plans or Interventions widget area specifically.

On 2026-06-09, a watermarked Financial Reports draft was created as Synthesia test video `110d0bf9-03b0-430a-bc23-e093768ba497`, titled `PATH training short - Financial Reports: ISET Advances and Active Clients`, with duration `0:01:02.774`. Bill approved making this draft public/shareable for review, but it is not listed in `src/tutorials/trainingShorts.js` yet. The short uses six annotated 1920x1080 frames generated from the sanitized local smoke screenshot `tmp/finance-reports-smoke-release-20260528/finance-reports-path-follow-up.png`; the account area is covered and the visible participant/payment data is synthetic. Source frames, capture summary, API result JSON, review thumbnails, and the local review MP4 are under `tmp/synthesia-financial-reports-demo/`; the review MP4 is `tmp/synthesia-financial-reports-demo/path-financial-reports-draft.mp4`.

On 2026-06-16, a first-pass refreshed `PATH Introduction` marketing asset pack was created for Bill to assemble manually in Synthesia, avoiding an API-rendered AI video. The pack targets a 91-second visual bed for a 90-second introduction and uses synthetic, marketing-oriented PATH-styled screens rather than real participant records or DEV database rows. Local files are under `tmp/synthesia-path-intro-asset-pack/`: 9 PNG frames in `frames-1080p/`, 9 silent MP4 scene clips plus `clips/path-introduction-90-second-visual-bed.mp4`, review frames, `path-intro-storyboard.md`, and `path-intro-asset-pack-manifest.json`. Ten MP4 assets were uploaded to Synthesia through the raw asset upload API: the continuous visual bed and the 9 individual scene clips. Keep asset IDs in the local manifest only unless Bill explicitly approves recording them in docs.

Also on 2026-06-16, a private watermarked Synthesia test draft was created as video `db2702dd-9952-4fec-acf3-d66c651376a0`, titled `CODEX VERSION - PATH Introduction`, with duration `0:01:40.371`. It uses `voiceOnly` narration, static CODEX-marked PNG scene backgrounds, and synthetic marketing data. The local review MP4 is `tmp/synthesia-path-intro-asset-pack/path-introduction-codex-version.mp4`, with result metadata in `tmp/synthesia-path-intro-asset-pack/path-introduction-codex-synthesia-result.json`. The first attempt to render against CODEX-marked MP4 background assets failed with Synthesia `ASSETS_LIMITED_ACCESS` for two uploaded video assets, so the completed draft intentionally uses PNG backgrounds for reliable guide-video generation.

Bill rejected this 2026-06-16 `CODEX VERSION - PATH Introduction` draft as unsuitable for production guidance because the visuals were synthetic PATH-like mockups, the narration was unnatural, and the panning/motion direction was poor. For future PATH introduction or sales videos, do not use invented PATH screens or stylized approximations. Capture actual PATH screens from the running DEV application, after seeding or intercepting polished synthetic data inside the real UI. Prefer clean cuts, static holds, and very restrained zooms over broad pan/zoom motion. If the real app cannot be captured, stop and say so instead of filling the gap with mock UI.

A corrected real-screen follow-up was produced later on 2026-06-16 as private Synthesia test video `2b746c78-493f-4a85-8509-cec3c9b65a68`, titled `CODEX REAL SCREEN DRAFT - PATH Introduction`, with duration about 91.6 seconds. It uses actual PATH/admin/portal screens captured from local DEV routes with sanitized synthetic data supplied through API interception, static scene holds, and no panning. Local review files are under `tmp/path-intro-real-captures/`, including `path-introduction-real-screens-codex-draft.mp4`, `path-introduction-real-screens-codex-result.json`, and `real-path-intro-assets-manifest.json`. The uploaded image assets cover guided intake, conditional document upload, participant file documents/messages, digital forms/signatures, finance reconciliation, and ILMP/ESDC reporting; keep uploaded asset IDs in the local manifest unless Bill explicitly asks to publish them elsewhere.

After Bill revised the narration tone, the non-test final render was created as private Synthesia video `d5ce6a7a-ca93-4eb9-a9af-653b3e28cf62`, titled `PATH Introduction - Real Screen Final`, with duration about 2:02.4. Local files are `tmp/path-intro-real-captures/path-introduction-real-screens-final.mp4` and `tmp/path-intro-real-captures/path-introduction-real-screens-final-result.json`; sampled review frames showed no Synthesia test watermark.

Bill then asked for a stronger opening visual because the first final render opened on a supporting-documents close-up. A better real admin homepage/workboard capture was added as asset `00-admin-homepage-workboard`, showing side navigation, work queues, queue items, metrics, and recent activity. The improved non-test render was created as private Synthesia video `b99505a5-d1cb-42b9-bcf7-22af10e43fcd`, titled `PATH Introduction - Real Screen Final v2`, with duration about 1:51.3. Local files are `tmp/path-intro-real-captures/path-introduction-real-screens-final-v2.mp4`, `tmp/path-intro-real-captures/path-introduction-real-screens-final-v2-result.json`, and review frames under `tmp/path-intro-real-captures/final-v2-review-frames/`. Prefer this v2 render over the earlier 2:02 final unless Bill explicitly asks to return to the older cut.

Later on 2026-06-16, Bill approved an expanded visual storyboard with more frequent real-screen cuts. The v3 non-test render was private Synthesia video `5a45cbe6-f037-411f-80fe-6a3f8acc3ddb`, titled `PATH Introduction - Real Screen Final v3`, with duration `0:02:07.963`. Local files are `tmp/path-intro-real-captures/path-introduction-real-screens-final-v3.mp4`, `tmp/path-intro-real-captures/path-introduction-real-screens-final-v3-result.json`, and review frames under `tmp/path-intro-real-captures/final-v3-review-frames/`. This version used actual PATH/public-portal captures only, with sanitized synthetic data supplied through browser/API harnesses. It opened on the NWAC public portal, cut to the admin homepage/workboard, then covered guided intake, conditional documents, applicant follow-up, digital signature, connected participant file, assessment, digital forms, audit trail, payment work, Sage Intacct reconciliation/configuration, ILMP/ESDC readiness and XML payload preview, financial reporting, and a homepage close. The too-long intermediate v3 render `1bed4234-886f-4fe8-8a95-dd763df18afd` ran 2:53 and was deleted from Synthesia after the shorter keeper was created.

Private non-test Synthesia video `d73a4431-12e7-4c84-a946-d7c24edec9cd`, titled `PATH Introduction - Real Screen Final v4`, with duration `0:03:06.281`, removed the public portal landing opening, started on the real admin console landing page, cut to the admin homepage/workboard, then showed applicant wizard steps 20 through 26 as separate Synthesia scenes before continuing through applicant messages/signature, connected participant file, assessment, forms, audit trail, payments, Sage Intacct reconciliation/configuration, ILMP/ESDC readiness and XML payload preview, financial reporting, and a homepage close. Local files are `tmp/path-intro-real-captures/path-introduction-real-screens-final-v4.mp4`, `tmp/path-intro-real-captures/path-introduction-real-screens-final-v4-result.json`, and review frames under `tmp/path-intro-real-captures/final-v4-review-frames/`.

The current keeper is private non-test Synthesia video `9897c1ae-cc59-4946-adcc-22f17a0a12bd`, titled `PATH Introduction - Real Screen Final v5`, with duration `0:02:56.494`. Local files are `tmp/path-intro-real-captures/path-introduction-real-screens-final-v5.mp4`, `tmp/path-intro-real-captures/path-introduction-real-screens-final-v5-result.json`, review frames under `tmp/path-intro-real-captures/final-v5-review-frames/`, and the uploaded intake slideshow source under `tmp/path-intro-real-captures/v5-intake-slideshow/`. This version keeps the v4 story but replaces the seven separate intake-step scenes with one merged Synthesia scene whose background is a silent MP4 slideshow of applicant wizard steps 20 through 26. The merged intake narration runs continuously, avoiding Synthesia's scene-boundary pauses inside that paragraph. It keeps Sage Intacct visible as a credibility point without making the narration finance-technical. Source screenshots are real local PATH/admin/portal screens with sanitized synthetic data supplied through browser/API harnesses.

Later on 2026-06-16, Bill asked to fix additional Synthesia pauses after scene 10 without overwriting manual Studio edits to earlier scenes. The Synthesia API update endpoint only supports metadata/publication updates, not scene-level patching, and `GET /v2/videos/:id` does not return editable scene input, so do not regenerate the whole v5 video from local scripts if Bill has made manual edits in Studio. Instead, post-scene-10 replacement slideshow assets were created and uploaded for manual Studio insertion: `v6-payments-sage-slideshow` (`user.bc573852-6b0e-45d4-9ed6-eec9b2d2f39d`) to replace v5 scenes 11-14, focused `v6-sage-intacct-bridge-slideshow` (`user.10d6920f-5358-40aa-a525-f176fae33b88`) to replace only scenes 13-14 when scenes 11-12 should be kept separate, `v6-ilmp-esdc-slideshow` (`user.75cc0740-1863-455c-998f-1dc829194944`) to replace scenes 15-16, and optional `v6-reporting-close-slideshow` (`user.ff96b878-1021-4693-9b09-82a6b590ef41`) to replace scenes 17-18 if the closing pause feels distracting. Local source MP4s, contact-sheet reviews, scripts, and upload metadata are under `tmp/path-intro-real-captures/v6-post10-slideshows/`.

On 2026-06-24, an initial private watermarked Synthesia test draft for the PATH website section `Documents & Evidence` was created as video `dae3e171-d11f-41a4-9989-9431fee06256`, titled `PATH website section - Documents & Evidence`, with duration `0:03:53.244`. Bill rejected it because several visuals were invented PATH-like mockups rather than actual PATH screens. Keep this as a durable correction: for PATH website, intro, and sales videos, use real PATH/admin/portal screenshots or real PATH generated-document templates with synthetic data supplied through browser/API harnesses. Do not create fake screenshots that merely resemble PATH.

The corrected real-screen review draft was created on 2026-06-24 as private watermarked Synthesia test video `d05ae69e-b158-42bc-90e0-523463fb35ff`, titled `PATH website section - Documents & Evidence - real screen draft v2`, with duration `0:03:53.244`. It uses 21 `voiceOnly` scenes and actual PATH/admin/portal captures plus real PATH PDF templates filled with synthetic Maya Cardinal demo data. The storyboard covers workflow-scoped supporting documents, applicant uploads, secure-message attachments, generated application records, case manager assessment PDFs, assessment redlines, decision evidence, approved assessment sign-off, approval letters, Client Funding Agreement signing, funding revision follow-up, a red-line revised Client Funding Agreement, payment evidence gates, a unified evidence library, and audit history. Local files are under `tmp/synthesia-documents-evidence-real/`: `create-real-assets.js`, `frames-1080p/`, `documents-evidence-real-contact-sheet.png`, `documents-evidence-real-assets-manifest.json`, `render-synthesia-real-draft.js`, the uploaded asset cache, result JSON, review MP4 `path-documents-evidence-real-draft.mp4`, and sampled review frames. The real-screen capture harness uses `/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu` for Puppeteer's cached Chrome NSS/NSPR dependencies. An intermediate real-screen draft `c03dbf99-bf50-44b0-93f7-ef8a8bbc532e` was superseded because its funding-revision scene was replaced with a cleaner real Case Workspace intervention follow-up capture.

After Bill approved the v2 content and screens but noted small jarring voiceover pauses, the final non-test render was created as private Synthesia video `bcd3094a-e541-476e-8790-0dfacf8a1480`, titled `PATH website section - Documents & Evidence - Final`, with duration `0:03:38.170`. This version removes the test watermark by rendering with `test: false` and reduces pause artifacts by replacing the 21 still-image scenes with 5 MP4 slideshow background scenes while preserving the approved screenshots and narration order. Local files are `tmp/synthesia-documents-evidence-real/path-documents-evidence-final.mp4`, `documents-evidence-final-synthesia-result.json`, `documents-evidence-final-assets-manifest.json`, `create-final-smooth-assets.js`, `render-synthesia-final-smooth.js`, and `review-frames/final-video-sample-contact-sheet.jpg`. Use this final render as the current keeper unless Bill asks to revise the content.

On 2026-06-25, a private watermarked Synthesia review draft was created for the fourth PATH website card as video `da7a70e9-1f51-4780-85c3-85badf6216ad`, titled `PATH website section - Funding, Reporting & Exports - real screen draft`, with duration `0:02:58.136`. This draft recommends retitling the card from `Funding Follow-Up & Reporting` to `Funding, Reporting & Exports` and uses four MP4 slideshow scenes to avoid most scene-boundary voiceover pauses. The storyboard covers participant-file funding follow-up, program-side payment packets, evidence gates, Intacct export preview/reconciliation as PATH-side handoff tracking, Financial Reports summary/drilldowns/export basis, and ILMP/ESDC XML export readiness. It uses real local PATH/admin screens plus the real local mock Sage Intacct dashboard as a supplemental capture, all with synthetic demo data only; do not replace these with invented PATH-like screenshots. Local files are under `tmp/synthesia-funding-reporting-real/`: `create-real-assets.js`, `raw-captures/`, `slideshows/`, `funding-reporting-real-contact-sheet.png`, `funding-reporting-real-assets-manifest.json`, `render-synthesia-real-draft.js`, uploaded-asset cache, and result JSON. Local downloaded review MP4s and sampled frames were purged after Bill asked to review in Synthesia only.

Bill found that first `Funding, Reporting & Exports` voice script too technical and inaccessible. The corrected private watermarked review draft was created on 2026-06-25 as video `519e1ea1-c5a1-48a7-8675-bcff68940430`, titled `PATH website section - Funding, Reporting & Exports - plain English draft v2`, with duration `0:02:58.136`. It keeps the same real-screen slideshow assets but rewrites the narration in plainer English: what happens after funding is approved, what staff can see, what is ready, what needs follow-up, and how reporting files stay tied to case history. Local files include `tmp/synthesia-funding-reporting-real/funding-reporting-real-plain-draft-v2-synthesia-result.json`; no local rendered MP4 should be kept unless Bill explicitly asks for one. For website-card videos, especially sales/overview material, avoid dense integration language in the voiceover. Prefer plain-English benefits and staff-visible outcomes over terms like reconciliation, downstream submission, payload, operational record, or export evidence unless the screen itself requires the term and the narration explains it simply.

Bill then clarified that the script still assumed too much product knowledge: a website viewer does not know what a `packet` is. Before rendering another `Funding, Reporting & Exports` revision, work on the script first. Open by introducing this as a PATH capability, not by diving straight into process, but avoid abstract capability "guff." The script must go top-down from the website viewer's problem and outcome before naming internal workflow objects. Do not lead with terms like payment packet, reconciliation, payload, export readiness, or operational records. The core message is that PATH helps programs move from approved support to payment follow-up with the right proof and a clear trail, while reporting draws from that same work. Define any necessary PATH term only after the viewer understands why it exists. Sage Intacct is an optional integration for organizations that use Sage Intacct; do not make it the main payment story, imply PATH requires Sage, or frame PATH as replacing Sage/the accounting system. Avoid staff-training phrasing unless the video is explicitly a staff tutorial.

After reviewing the payment code and help docs, Bill approved a shorter capability-led script and asked Codex to make the video. The current review draft is private watermarked Synthesia test video `d0b5f19b-10f8-47e6-9705-5cbf0383765e`, titled `PATH website section - Payment Requests & Funding Follow-Up - review draft v2`, with duration `0:02:02.204`. This draft recommends the card title `Payment Requests & Funding Follow-Up` and covers payment requests from approved supports, configurable evidence requirements, finance email handoff to configured recipients, optional Sage Intacct REST integration, reconciliation differences between email and Intacct routes, and reporting/export. Local files are under `tmp/synthesia-funding-reporting-real/`, including `funding-reporting-approved-script-assets-manifest.json`, `funding-reporting-approved-script-v2-synthesia-result.json`, `approved-slideshows/`, `create-approved-script-assets.js`, and `render-synthesia-approved-script.js`. No local rendered review MP4 was downloaded. A superseded pronunciation-test draft `f9f971cb-ab9d-4569-92f1-ae972308c735` was deleted from Synthesia after v2 completed.

## Working Pattern With Bill

Treat tutorial-video production as a content workflow first and an API workflow second. Keep chat conversational, avoid branching lists unless the list itself is the artifact, and guide Bill one decision at a time.

Default sequence:

1. Identify the training objective, audience, and screen/workflow being taught.
2. Draft the tutorial structure as scenes with narration, on-screen text, and visual direction.
3. Send Bill the script/storyboard for review before any Synthesia render or update that consumes credits, creates a new video, or replaces an existing draft.
4. Wait for Bill's explicit approval before creating/updating the Synthesia video. The only exception is when Bill explicitly waives the review checkpoint for that specific draft in the current thread.
5. Use Synthesia read-only calls to inspect available videos/templates when useful.
6. Use write/create API calls only after the content-review checkpoint is satisfied and the API action is allowed in the current thread.
7. After a keeper render is chosen, delete obsolete duplicate/prototype Synthesia videos and stale local temporary asset folders. Do not leave smoke tests, pronunciation tests, or replaced drafts in Bill's Synthesia workspace.
8. Record resulting video IDs, titles, and workflow notes in docs only when they are project-relevant; never record the API key.

For PATH staff tutorials, use existing project memory as the content source. Start with `docs/AGENTS.md`, then the relevant feature/dashboard/help docs, and use `docs/training/TRAINING_MODULES_September_2025_extracted.md` for staff-workflow language and compliance expectations. Verify current behavior from code or the running app before producing UI-specific narration.

## Content Standards

Write scripts as job aids, not product tours. Focus on what staff are trying to decide or complete, what evidence they need, what common mistakes to avoid, and what the next operational step is.

Keep narration plain English even when the video is short. Short scripts should still use complete, natural sentences and enough connecting words for staff to understand the workflow. Avoid overly compressed keyword phrases such as "withdraw reason, reporting record, reopen note" when a short sentence is clearer. Prefer "Use Withdraw application when review should stop, then add a clear note explaining why" over label-only narration. Aim for concise clarity, not the fewest possible words.

When trimming a video, remove side explanations and repeated setup before cutting the sentence-level meaning. It is better for a training short to run ten seconds longer than to become cryptic. Use on-screen text for very short anchors, but let the voiceover carry the plain-language instruction.

### Pronunciation

Known PATH pronunciation terms:

| Visible term | Spoken form | Notes |
| ------------ | ----------- | ----- |
| `NWAC` | `En-whack` | Two syllables, even stress. Use `<sub alias="En-whack">NWAC</sub>` in API scripts. |
| `ILMP` | `I L M P` | Speak as letters. Use `<sub alias="I L M P">ILMP</sub>` in API scripts if Synthesia does not spell it naturally. |
| `ESDC` | `E S D C` | Speak as letters. Use `<sub alias="E S D C">ESDC</sub>` in API scripts if Synthesia does not spell it naturally. |

Before creating a Synthesia video, scan the script for acronyms, Indigenous/community/program names, technical product terms, and any word Synthesia may mispronounce. If the pronunciation is known, update the API script yourself by wrapping the visible term with `<sub alias="...">...</sub>`. If the pronunciation is unknown or culturally sensitive, ask Bill before rendering. Do not knowingly create a draft that leaves likely mispronunciations unhandled.

Synthesia Studio also has pronunciation controls and a workspace glossary. If Bill wants a term fixed globally inside Synthesia rather than per video, guide him through the Studio/glossary UI or use it directly only when access and permission are clear. Until a public glossary API exists, do not claim that Codex can update workspace-wide pronunciation rules through the API.

For Synthesia-ready drafts, include:

- Video title.
- Audience and objective.
- Scene-by-scene narration.
- On-screen text.
- Visual direction or screen capture notes.
- Any expected call-to-action.
- Review checklist for accuracy, privacy, and current UI behavior.

Avoid exposing applicant/client personal data in videos unless Bill explicitly approves a sanitized training fixture. Prefer local/test/demo records, blurred screenshots, or synthetic examples.

## Stop Conditions

Pause and ask Bill before:

- Creating a new Synthesia video or generating a final video version.
- Making a video public or changing share visibility.
- Using real client/applicant data in narration, screenshots, or screen recordings.
- Deleting, revoking, replacing, or disabling Synthesia API keys.
- Recording any Synthesia workspace IDs, video IDs, or template details in docs when their sensitivity is unclear.
