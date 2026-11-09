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

## Regression fixed

Commit `a24a0ae` replaced the application with unused class scaffolding, removing initialization and every event handler. The script now initializes the UI and uses one rendering path for new, restored and edited blocks. Text is rendered as text, never HTML. The unused Bootstrap CDN dependencies were removed.

## Feature priorities and decisions

| Priority | README item | Decision / next implementation |
| --- | --- | --- |
| P0 | Restore existing controls and persistence | Implemented; preserve the original backup shape and storage keys. |
| P1 | Edit existing blocks | Implemented with Save Changes and Cancel Edit. |
| P1 | Hashtag filtering | Implemented dynamically from current content. |
| P1 | Wrapping / separate blocks div | Implemented responsive wrapping and a separate saved-blocks section. |
| P2 | Detect links | Defer until needed. Add a separate Open link action for validated HTTP(S) URLs; preserve card-click copying. Veto automatic navigation on card click. |
| P2 | Barcode / QR | Defer pending scanner and payload requirements. Use a bundled encoder and generate on demand from the current text; test Unicode, size limits and scan round trips. Veto case normalization: changing case can corrupt URLs, passwords and identifiers. Font appearance does not alter encoded data. |
| P2 | Request feature | Use [GitHub issues](https://github.com/ajklicker33/Copyblocks/issues) now. Defer an in-app submission service until there is a need for authentication, spam controls and maintenance. |
| P3 | Document Picture-in-Picture | Optional experiment: detect the API at runtime, expose the control only when available, and keep the main window fully usable. Test lifecycle and shared state before shipping; do not rely on a hard-coded browser list. |
| P3 | Electron | Defer packaging until a concrete desktop-only need exists. Veto adding a desktop runtime solely to fix browser controls. |

## Run and preview

In an editor that provides it, right-click `index.html` and choose **Open in Integrated Browser**. Refresh after saving changes if the preview does not refresh automatically. No build command or Codex conversation is required.

## Executable implementation plan

To start a task, prompt **"Begin work on Step X in README.md"**. The numbered steps below are stable identifiers; do not renumber them when a step finishes. All steps are currently **Not started**. The earlier regression fix and working features above are already implemented.

### Instructions for the implementing agent

- Treat the selected step as authorization to implement its stated scope, including necessary local fixes and checks. Read the current code and repository instructions first; do not stop at proposing another plan.
- Execute only the requested step. Check its dependencies; all steps depend on the restored baseline, but none requires another numbered step to be completed first. Preserve features from steps already completed.
- Use the defaults below without asking the user to repeat decisions. Ask only when a genuine blocker or a change outside the stated scope requires input.
- Preserve existing local storage keys, legacy JSON backups, exact copied text and offline operation. Render user content safely. Optional APIs must be detected at runtime.
- Run the existing regression harness in an isolated profile and add focused checks for the new behavior. Never run the destructive harness against the user's working data.
- Update the selected step's status to **Complete** only after its acceptance criteria pass. Record changed behavior, validation evidence and remaining limitations under that step. If blocked, record the specific blocker and leave the step incomplete.
- End with a concise implementation and validation report. Commit or push only if requested in that work session; this roadmap does not authorize future automatic publication.

### Step 1 — Close the remaining regression coverage gaps

**Status:** Not started. **Priority:** P1.

Scope: extend the browser harness to cover reload persistence, clipboard success and rejection, downloaded JSON contents, drag-and-drop, corrupt saved JSON, storage write failure and narrow-screen wrapping. Use controlled browser mocks for permission/storage failures and identify those checks as simulated. Add a repeatable runner using an isolated temporary browser profile; document prerequisites and one command to run it. Keep the app build-free.

Acceptance: the runner exits unsuccessfully on assertion failures; baseline checks and new checks pass; failed clipboard operations never report success; corrupt stored data stays untouched until explicit replacement; export includes every block even while filtered; long unbroken text fits at 320px and desktop widths. Document anything that still requires a physical browser permission prompt or manual interaction.

### Step 2 — Detect links without changing copy behavior

**Status:** Not started. **Priority:** P2.

Scope: derive distinct HTTP(S) links dynamically from each block's text, using URL parsing and safe DOM construction. Show separate, clearly labeled Open link actions. Recompute after edits and imports; do not store redundant link metadata. Leave ambiguous punctuation outside a link where possible and document the detection rule.

Acceptance: clicking the card still copies the exact text; link actions open a new tab with `noopener` and `noreferrer` and do not copy; non-HTTP(S) schemes and HTML payloads cannot become executable links. Test multiple links, duplicates, punctuation, edits, imports and text without links.

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

## Verification

`tests/browser.html` is a dependency-free browser regression harness covering controls, persistence, editing, filtering, reordering, plain-text rendering, legacy import, invalid import, deletion and clearing. **Run only in an isolated browser profile:** the harness clears CopyBlocks storage for its origin. Headless Chrome needs `--allow-file-access-from-files` when running the harness from disk.

Manual release checks: clipboard success and denied permission, actual downloaded JSON, reload persistence, drag-and-drop, unavailable/full storage, corrupt stored JSON, and mobile long-string wrapping. A failed clipboard operation reports an error instead of claiming success.
