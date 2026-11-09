# CopyBlocks

A local-first text clipboard. Open `index.html` in a browser; no build or external dependencies are required. Blocks and preferences are saved in browser local storage. Export JSON backups before clearing browser data or moving to a different browser/origin.

## Working features

- Add, copy, edit, delete and arrange text blocks, including emoji and multiline text.
- Drag blocks onto another block to reorder, or use Move up / Move down.
- Export all blocks as JSON and restore validated backups. Imports replace the collection after confirmation; invalid backups leave existing blocks untouched.
- Existing `textBlocks`, `preferredColumns` and `preferredColor` storage remains compatible.
- Per-block colors, background colors and column layout preferences.
- Dynamic, case-insensitive hashtag filtering from titles and text, including Unicode tags. Options refresh after edits and imports. Reordering is disabled while filtered to avoid ambiguous ordering.
- Long strings wrap inside responsive cards. Saved blocks have their own section.
- Keyboard-accessible controls and visible clipboard/storage error feedback.
- Live Detected links lists beneath the editor and saved-block text show HTTP(S) URLs without an action prefix; card clicks still copy the exact body. The filter groups hashtags and detected URLs.

## Regression fixed

Commit `a24a0ae` replaced the application with unused class scaffolding, removing initialization and every event handler. The script now initializes the UI and uses one rendering path for new, restored and edited blocks. Text is rendered as text, never HTML. The unused Bootstrap CDN dependencies were removed.

## Feature priorities and decisions

| Priority | README item | Decision / next implementation |
| --- | --- | --- |
| P0 | Restore existing controls and persistence | Implemented; preserve the original backup shape and storage keys. |
| P1 | Edit existing blocks | Implemented with Save Changes and Cancel Edit. |
| P1 | Hashtag filtering | Current filtering derives from body/title text. Step 7 replaces this with separate tag metadata; prioritize Step 7 before Steps 3–6. |
| P1 | Wrapping / separate blocks div | Implemented responsive wrapping and a separate saved-blocks section. |
| P2 | Detect links | Implemented in Step 2: detected-link lists, live editor preview and URL filtering preserve card-click copying. |
| P2 | Barcode / QR | Defer pending scanner and payload requirements. Use a bundled encoder and generate on demand from the current text; test Unicode, size limits and scan round trips. Veto case normalization: changing case can corrupt URLs, passwords and identifiers. Font appearance does not alter encoded data. |
| P2 | Request feature | Use [GitHub issues](https://github.com/ajklicker33/Copyblocks/issues) now. Defer an in-app submission service until there is a need for authentication, spam controls and maintenance. |
| P3 | Document Picture-in-Picture | Optional experiment: detect the API at runtime, expose the control only when available, and keep the main window fully usable. Test lifecycle and shared state before shipping; do not rely on a hard-coded browser list. |
| P3 | Electron | Defer packaging until a concrete desktop-only need exists. Veto adding a desktop runtime solely to fix browser controls. |

## Run and preview

In an editor that provides it, right-click `index.html` and choose **Open in Integrated Browser**. Refresh after saving changes if the preview does not refresh automatically. No build command or Codex conversation is required.

## Executable implementation plan

To start a task, prompt **"Begin work on Step X in README.md"**. The numbered steps below are stable identifiers; do not renumber them when a step finishes. Steps 1–2 are **Complete**; Steps 3–7 are **Not started**. Step 7 (separate tag metadata) is the recommended next task. The earlier regression fix and working features above are already implemented.

### Instructions for the implementing agent

- Treat the selected step as authorization to implement its stated scope, including necessary local fixes and checks. Read the current code and repository instructions first; do not stop at proposing another plan.
- Execute only the requested step. Check its dependencies; all steps depend on the restored baseline, but none requires another numbered step to be completed first. Preserve features from steps already completed.
- Use the defaults below without asking the user to repeat decisions. Ask only when a genuine blocker or a change outside the stated scope requires input.
- Preserve existing local storage keys, legacy JSON backups, exact copied text and offline operation. Render user content safely. Optional APIs must be detected at runtime.
- Run the existing regression harness in an isolated profile and add focused checks for the new behavior. Never run the destructive harness against the user's working data.
- Update the selected step's status to **Complete** only after its acceptance criteria pass. Record changed behavior, validation evidence and remaining limitations under that step. If blocked, record the specific blocker and leave the step incomplete.
- End with a concise implementation and validation report. Commit or push only if requested in that work session; this roadmap does not authorize future automatic publication.

### Step 1 — Close the remaining regression coverage gaps

**Status:** Complete (2026-11-09). **Priority:** P1.

Scope: extend the browser harness to cover reload persistence, clipboard success and rejection, downloaded JSON contents, drag-and-drop, corrupt saved JSON, storage write failure and narrow-screen wrapping. Use controlled browser mocks for permission/storage failures and identify those checks as simulated. Add a repeatable runner using an isolated temporary browser profile; document prerequisites and one command to run it. Keep the app build-free.

Acceptance: the runner exits unsuccessfully on assertion failures; baseline checks and new checks pass; failed clipboard operations never report success; corrupt stored data stays untouched until explicit replacement; export includes every block even while filtered; long unbroken text fits at 320px and desktop widths. Document anything that still requires a physical browser permission prompt or manual interaction.

Implementation: expanded `tests/browser.js` to 40 assertions and added `tests/run-browser-tests.ps1`. The runner launches Chrome/Edge with a unique temporary profile, polls completion through the local debugging connection, verifies the actual downloaded JSON against the full collection while filtered, and removes its temporary profile/downloads. The app remains build-free; no application changes were needed.

Validation: all 40 assertions plus actual download verification passed in headless Chrome. The `-ForceFailure` probe failed intentionally with exit code 1. Real reloads preserve blocks, preferences and drag order; layout checks pass at 320px and 1200px. Simulated clipboard rejection replaces prior success feedback, a simulated quota failure preserves stored data, and corrupt JSON remains untouched until confirmed replacement. Clipboard APIs and drag events are controlled simulations; physical permission dialogs, OS clipboard integration and pointer-driven drag gestures remain manual release checks.

### Step 2 — Detect links without changing copy behavior

**Status:** Complete (2026-11-09). **Priority:** P2.

Scope: derive distinct HTTP(S) links dynamically from each block's text, using URL parsing and safe DOM construction. Show detected URLs as a list under a Detected links heading, without an Open link prefix. Preview links live under the text editor and include detected URLs in the filter alongside hashtags. Recompute after edits and imports; do not store redundant link metadata. Leave ambiguous punctuation outside a link where possible and document the detection rule.

Acceptance: clicking the card still copies the exact text; link actions open a new tab with `noopener` and `noreferrer` and do not copy; non-HTTP(S) schemes and HTML payloads cannot become executable links. Test multiple links, duplicates, punctuation, edits, imports and text without links.

Implementation: HTTP(S) URLs are parsed and deduplicated dynamically at render time, with no added stored fields. Native links open a new tab with `noopener noreferrer`, display their destination and do not trigger card copying. Links refresh after edits, imports and reloads, and long destinations wrap on narrow screens. The editor has a live Detected links list; saved cards show the same list below their body. Filter by hashtag or detected link groups the available choices and matches an exact detected URL. A removed selection resets to All blocks; reordering stays disabled while filtered.

Detection rule: recognize explicit `http://` or `https://` at the start of text or after whitespace, an opening bracket, angle bracket or opening quote. Stop at whitespace, quotes or angle brackets. Trim trailing sentence punctuation (`.,!?:;`) and unmatched closing brackets; retain balanced parentheses inside URLs. Normalize with the browser URL parser and deduplicate the parsed result. Bare domains, relative paths and other schemes are not detected. Ambiguous literal trailing punctuation must be percent-encoded to remain part of a detected URL. The original body is never rewritten.

Validation: all 67 browser assertions (40 baseline plus 27 link/list/filter checks) and actual JSON download verification passed. Checks cover duplicates, punctuation, query parameters, safe schemes, inert HTML, edit/import/reload refresh, exact copying, isolated-tab attributes 320px wrapping, live preview updates, combined filtering and stale-selection resets. Navigation is suppressed during the click-isolation test to avoid opening external sites; actual destination loading remains a manual check using an ordinary native link.

### Step 3 — Generate QR codes on demand

**Status:** Not started. **Priority:** P2.

Scope: implement QR first, using a bundled, licensed encoder with no network requests or CDN dependency. Add a Show QR / Hide QR action per block, encoding the exact text on demand. Keep generation lazy; regenerate visible codes after an edit and release removed views. Provide an accessible text description and an understandable message for content that exceeds the encoder's capacity.

Acceptance: independent decoding round trips preserve mixed case, Unicode, URLs and multiline text; ordinary block clicks still copy; QR actions do not accidentally copy; oversized input leaves the application usable; imports and edits cannot display stale codes. Record the library version/license and tested capacity. Veto case normalization. Linear barcodes remain deferred until a symbology and scanner requirement are supplied; they are not part of this step.

### Step 4 — Add a feature-request entry point

**Status:** Not started. **Priority:** P2.

Scope: add a visible Request feature link to `https://github.com/ajklicker33/Copyblocks/issues/new`, with a generic feature-request title/body template. Explain that it opens GitHub. Keep this as a simple link; do not introduce a submission backend or send anything automatically.

Acceptance: the action opens the correct repository's issue composer, does not include saved blocks or other user data, works by keyboard, and leaves all existing toolbar controls working. No issue is submitted during validation.

### Step 5 — Add optional Document Picture-in-Picture

**Status:** Not started. **Priority:** P3.

Scope: feature-detect `window.documentPictureInPicture?.requestWindow` and secure context at runtime. Offer a pop-out action only when available; request the window from a user gesture. Prefer moving the existing saved-block section into the pop-out and restoring it on close so there is one source of state. Copy styles locally and handle denied requests without disrupting the main view.

Acceptance: supported browsers can open, copy, filter and close the pop-out; edits/imports remain synchronized; closing restores the section exactly once; repeated opening does not duplicate listeners or lose data. Unsupported browsers retain full baseline functionality. Validate the supported path in a browser exposing the API and the unsupported path with the API absent; if no supported environment is available, record that validation blocker rather than declaring completion.

### Step 6 — Evaluate desktop packaging

**Status:** Not started. **Priority:** P3. **Deliverable:** decision, not an Electron build.

Scope: review the completed web app and write a short decision in this section comparing continued browser use, an installable web app and Electron. Assess concrete desktop needs, offline behavior, clipboard permissions, data migration, update maintenance and distribution cost. Default to retaining the browser app unless evidence establishes a desktop-only requirement.

Acceptance: record a go/no-go decision, reasons and measurable criteria that would change it. If Electron is justified, specify a separately scoped implementation proposal and verification plan. Do not add a desktop runtime, installer or publishing credentials as part of this evaluation.

### Step 7 — Separate tags from copied content

**Status:** Not started. **Priority:** P1; recommended next after Step 2. Numbered 7 to preserve existing step identifiers.

Scope: add a dedicated Tags field to the editor and store tags as a `tags` array on each block, separate from `title` and `text`. Accept comma-separated labels, trim whitespace and an optional leading `#`, remove empty labels, and deduplicate case-insensitively. Render tags as separate chips and build the filter from tag metadata only. Editing, export, import and reload must preserve tags. Copy always uses the exact body; never append metadata.

Migration default: legacy blocks without `tags` load with an empty array. Do not silently strip or rewrite existing body/title hashtags, infer new tags, or change copied text. Users can move old hashtags into the new field during editing. Validate optional `tags` as an array of strings; malformed imports leave the current collection untouched. Existing backups without tags remain supported. Update the earlier hashtag tests to use explicit metadata rather than body text.

Acceptance: a block with body `Hello` and tags `work, urgent` copies only `Hello`; a literal `#example` in the body remains literal text and does not create a filter tag. Tags can be added, edited and removed independently, survive reload/export/import, filter case-insensitively, and render safely with Unicode and HTML-like input. Invalid tag data cannot replace valid stored blocks. Existing text, whitespace and emoji remain byte-for-byte unchanged through migration.

## Verification

Prerequisites: Windows PowerShell 5.1+ and installed Google Chrome or Microsoft Edge. No Node, Python, packages or app build are required. From the repository root, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\run-browser-tests.ps1
```

The execution-policy option applies only to that process. The runner auto-detects standard Chrome/Edge locations; pass `-BrowserPath "C:\path\to\chrome.exe"` for another installation. A temporary profile isolates the tests from your normal browser data. The runner uses a local debugging connection for this test browser only, verifies the real JSON download, closes the browser and removes its temporary files. Browser startup/test completion and debugging requests have timeouts. Exit code 0 means success; assertions, incomplete tests, missing downloads or mismatched export contents return 1.

To verify failure reporting, append `-ForceFailure`; this deliberately fails the final assertion and must return exit code 1.

`tests/browser.html` loads the dependency-free `tests/browser.js` harness. **Use the runner rather than opening the harness in your normal profile:** the harness clears CopyBlocks storage for its origin. Open `index.html` for ordinary integrated-browser preview.

Automated coverage: controls, exact Unicode/whitespace persistence, editing, filtering, ordering, real reloads, plain-text rendering, legacy/invalid imports, deletion, clearing, actual downloaded JSON including filtered-out blocks, corrupt JSON recovery, and long-string layout at 320px/1200px. Clipboard success/rejection and fallback outcomes, storage quota failures and drag events are explicitly simulated; these check application behavior rather than OS/browser permissions or physical input.

Manual release checks: native permission prompts and OS clipboard contents, pointer-driven drag-and-drop, actual browser storage restrictions/quota exhaustion, and visual usability on mobile devices. Automated layout assertions check overflow, not full visual appearance.
