# CopyBlocks

A local-first text clipboard. Open `index.html` in a browser; no build or external dependencies are required. Blocks and preferences are saved in browser local storage. Export JSON backups before clearing browser data or moving to a different browser/origin.

## Working features

- Add, copy, edit, delete and arrange text blocks, including emoji and multiline text.
- Drag blocks onto another block to reorder, or use Move up / Move down.
- Export all blocks as JSON and restore validated backups. Imports replace the collection after confirmation; invalid backups leave existing blocks untouched.
- Existing `textBlocks`, `preferredColumns` and `preferredColor` storage remains compatible.
- Per-block colors, background colors and column layout preferences.
- Local Show QR / Hide QR per block, generated on demand from exact text with Unicode support; no network service or CDN.
- Dedicated comma-separated Tags field, separate tag chips and case-insensitive filtering from tag metadata, including Unicode labels. Tags are excluded from copied text and QR codes. Options refresh after edits and imports. Reordering is disabled while filtered to avoid ambiguous ordering.
- Long strings wrap inside responsive cards. Saved blocks have their own section.
- Keyboard-accessible controls and visible clipboard/storage error feedback.
- Live Detected links lists beneath the editor and saved-block text show HTTP(S) URLs without an action prefix; card clicks still copy the exact body. The filter groups tags and detected URLs.

## Regression fixed

Commit `a24a0ae` replaced the application with unused class scaffolding, removing initialization and every event handler. The script now initializes the UI and uses one rendering path for new, restored and edited blocks. Text is rendered as text, never HTML. The unused Bootstrap CDN dependencies were removed.

## Feature priorities and decisions

| Priority | README item | Decision / next implementation |
| --- | --- | --- |
| P0 | Restore existing controls and persistence | Implemented; preserve the original backup shape and storage keys. |
| P1 | Edit existing blocks | Implemented with Save Changes and Cancel Edit. |
| P1 | Tag filtering | Implemented in Step 7: separate tag metadata, safe chips and case-insensitive filtering. Legacy body/title hashtags remain unchanged and are not inferred as tags. |
| P1 | Tag chip appearance and interaction | Implemented in Step 8: smaller, muted button chips toggle the matching tag filter with a checkmark and keyboard support. |
| P1 | Color picker and color value | Planned in Step 10: replace preset block/background selectors with pickers and synchronized HEX fields; display each note's color value separately from its tags/body. |
| P1 | Wrapping / separate blocks div | Implemented responsive wrapping and a separate saved-blocks section. |
| P2 | Detect links | Implemented in Step 2: detected-link lists, live editor preview and URL filtering preserve card-click copying. |
| P2 | Barcode / QR | QR implemented in Step 3 with a bundled encoder and independent decode tests. Linear barcodes remain deferred pending scanner/symbology requirements. Veto case normalization: exact text is preserved. |
| P2 | Matching link and QR numbers | Planned in Step 9: numbered detected links and matching per-link QR codes, with the full-text QR clearly separate. |
| P1 | Per-note creation options | Planned in Step 11: saved Generate QR and Detect links checkboxes; enabled QR is shown alongside text by default. Step 12 adds the working Generate barcode checkbox. |
| P2 | Barcode generation | Planned in Step 12: local barcode generation, validated payloads, default display when checked, and independent scan tests. |
| P2 | Request feature | Use [GitHub issues](https://github.com/ajklicker33/Copyblocks/issues) now. Defer an in-app submission service until there is a need for authentication, spam controls and maintenance. |
| P3 | Document Picture-in-Picture | Optional experiment: detect the API at runtime, expose the control only when available, and keep the main window fully usable. Test lifecycle and shared state before shipping; do not rely on a hard-coded browser list. |
| P3 | Electron | Defer packaging until a concrete desktop-only need exists. Veto adding a desktop runtime solely to fix browser controls. |

## Run and preview

In an editor that provides it, right-click `index.html` and choose **Open in Integrated Browser**. Refresh after saving changes if the preview does not refresh automatically. No build command or Codex conversation is required.

## Executable implementation plan

To start a task, prompt **"Begin work on Step X in README.md"**. The numbered steps below are stable identifiers; do not renumber them when a step finishes. Steps 1–3, 7 and 8 are **Complete**; Steps 4–6 and 9–12 are **Not started**. Recommended order: **10 → 11 → 9 → 12 → 4**: improve colors, establish per-note options, then expand code presentation/generation. Steps 5–6 remain lower-priority optional work. The earlier regression fix and working features above are already implemented.

### Instructions for the implementing agent

- Treat the selected step as authorization to implement its stated scope, including necessary local fixes and checks. Read the current code and repository instructions first; do not stop at proposing another plan.
- Execute only the requested step. Check the dependencies listed under that step and preserve features from steps already completed. Later refinements do not reopen the historical completion status of earlier steps.
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

Planned refinement: Step 9 adds ordered link lists and corresponding per-link QR numbers.

Step 11 makes link detection optional per note, including the editor preview and detected-link filter entries.

Scope: derive distinct HTTP(S) links dynamically from each block's text, using URL parsing and safe DOM construction. Show detected URLs as a list under a Detected links heading, without an Open link prefix. Preview links live under the text editor and include detected URLs in the filter alongside hashtags. Recompute after edits and imports; do not store redundant link metadata. Leave ambiguous punctuation outside a link where possible and document the detection rule.

Acceptance: clicking the card still copies the exact text; link actions open a new tab with `noopener` and `noreferrer` and do not copy; non-HTTP(S) schemes and HTML payloads cannot become executable links. Test multiple links, duplicates, punctuation, edits, imports and text without links.

Implementation: HTTP(S) URLs are parsed and deduplicated dynamically at render time, with no added stored fields. Native links open a new tab with `noopener noreferrer`, display their destination and do not trigger card copying. Links refresh after edits, imports and reloads, and long destinations wrap on narrow screens. The editor has a live Detected links list; saved cards show the same list below their body. Filter by hashtag or detected link groups the available choices and matches an exact detected URL. A removed selection resets to All blocks; reordering stays disabled while filtered.

Detection rule: recognize explicit `http://` or `https://` at the start of text or after whitespace, an opening bracket, angle bracket or opening quote. Stop at whitespace, quotes or angle brackets. Trim trailing sentence punctuation (`.,!?:;`) and unmatched closing brackets; retain balanced parentheses inside URLs. Normalize with the browser URL parser and deduplicate the parsed result. Bare domains, relative paths and other schemes are not detected. Ambiguous literal trailing punctuation must be percent-encoded to remain part of a detected URL. The original body is never rewritten.

Validation: all 67 browser assertions (40 baseline plus 27 link/list/filter checks) and actual JSON download verification passed. Checks cover duplicates, punctuation, query parameters, safe schemes, inert HTML, edit/import/reload refresh, exact copying, isolated-tab attributes, 320px wrapping, live preview updates, combined filtering and stale-selection resets. Navigation is suppressed during the click-isolation test to avoid opening external sites; actual destination loading remains a manual check using an ordinary native link.

### Step 3 — Generate QR codes on demand

**Status:** Complete (2026-11-09). **Priority:** P2.

Planned refinement: Step 9 adds numbered per-link QR codes. The current implementation generates one full-body QR per block, so multiple matching link/QR pairs require new behavior rather than only labels.

Step 11 adds a saved Generate QR checkbox that displays QR alongside the text by default when enabled. Step 12 separately adds barcode generation.

Scope: implement QR first, using a bundled, licensed encoder with no network requests or CDN dependency. Add a Show QR / Hide QR action per block, encoding the exact text on demand. Keep generation lazy; regenerate visible codes after an edit and release removed views. Provide an accessible text description and an understandable message for content that exceeds the encoder's capacity.

Acceptance: independent decoding round trips preserve mixed case, Unicode, URLs and multiline text; ordinary block clicks still copy; QR actions do not accidentally copy; oversized input leaves the application usable; imports and edits cannot display stale codes. Record the library version/license and tested capacity. Veto case normalization. Linear barcodes remain deferred until a symbology and scanner requirement are supplied; they are not part of this step.

Implementation: local canvas rendering uses the bundled MIT-licensed Project Nayuki encoder (publisher snapshot dated 2026-11-09, pinned by SHA-256). Show QR generates lazily; Hide QR removes its cached view. Visible codes update after edits, unchanged codes are reused, and replacement imports/deletions discard old views. The exact UTF-8 body is encoded with ECI 26 and medium error correction. Canvas descriptions support assistive technology; oversized or invalid Unicode input produces a message while copying remains available. QR visibility and images are never persisted in backups.

Validation: all 104 browser assertions plus real JSON download verification passed. The independent jsQR 1.4.0 decoder recovered exact mixed case, Unicode/emoji, combining characters, URLs, multiline whitespace and leading BOM text from rendered canvas pixels. Tests also cover lazy generation, show/hide isolation, regeneration after edits/imports, deletion, accessible description, 320px fit and the 2,330-byte limit. Both 2,331 ASCII bytes and 2,332 UTF-8 bytes fail gracefully; shorter edits recover. Invalid surrogate text is rejected without substitution. Dependency source identifiers, hashes and licenses are in [vendor/README.md](vendor/README.md).

Limitation: physical camera/scanner testing remains manual, particularly for dense codes reduced to fit a narrow card. The automated decoder reads the original canvas pixels, not a photograph or CSS-scaled screenshot. Linear barcodes are still outside this step.

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

**Status:** Complete (2026-11-10). **Priority:** P1. Numbered 7 to preserve existing step identifiers.

Completed refinement: Step 8 makes the chips visually subtler and clickable to toggle filtering.

Scope: add a dedicated Tags field to the editor and store tags as a `tags` array on each block, separate from `title` and `text`. Accept comma-separated labels, trim whitespace and an optional leading `#`, remove empty labels, and deduplicate case-insensitively. Render tags as separate chips and build the filter from tag metadata only. Editing, export, import and reload must preserve tags. Copy always uses the exact body; never append metadata.

Migration default: legacy blocks without `tags` load with an empty array. Do not silently strip or rewrite existing body/title hashtags, infer new tags, or change copied text. Users can move old hashtags into the new field during editing. Validate optional `tags` as an array of strings; malformed imports leave the current collection untouched. Existing backups without tags remain supported. Update the earlier hashtag tests to use explicit metadata rather than body text.

Acceptance: a block with body `Hello` and tags `work, urgent` copies only `Hello`; a literal `#example` in the body remains literal text and does not create a filter tag. Tags can be added, edited and removed independently, survive reload/export/import, filter case-insensitively, and render safely with Unicode and HTML-like input. Invalid tag data cannot replace valid stored blocks. Existing text, whitespace and emoji remain byte-for-byte unchanged through migration.

Implementation: a dedicated Tags input stores a `tags` array independently of title/body and displays inert text chips. Commas delimit labels, whitespace and an optional leading `#` are trimmed, and empty/case-insensitive duplicates are removed while retaining the first spelling. The same normalization applies to imports. Tags and detected links have distinct filter identifiers, so even a URL-shaped tag cannot collide with a detected URL. Edits/cancel/reset update the tag field, and deleting the final selected tag resets the filter to All blocks.

Migration: old browser storage is read without rewriting it on page load; missing tags become an empty array in memory and are included on the next save/export. Old body/title hashtags are not moved or removed. Add them manually in the Tags field if desired. Copy and QR always use the unmodified body.

Validation: 126 browser assertions plus actual downloaded JSON verification passed. Added checks cover normalization, chips, editing/removing/cancelling, reload persistence, tag exclusion from copy/independently decoded QR, legacy imports/storage, invalid tag schemas, safe Unicode/HTML-like labels, case-insensitive filtering, URL/tag collisions and backup round trips. The downloaded backup includes explicit tags for visible and filtered-out blocks. No new manual-test limitation beyond the existing browser/clipboard/physical-scanner checks.

### Step 8 — Subtle tag chips with filter toggles

**Status:** Complete (2026-11-10). **Priority:** P1. **Dependency:** Step 7.

Scope: reduce chip visual weight with slightly smaller text/padding, a light-gray background and a softer border, while retaining readable text and a clear focus indicator on every block color. Make chips native buttons with an accessible pressed state. Keep them comfortable to click even when visually compact.

Interaction default: clicking an inactive chip shows blocks containing that tag, case-insensitively; clicking the active tag again clears the filter and shows all blocks. Clicking a different tag replaces the current selection. This toggles the tag filter on/off; it does not delete tags, hide chips or introduce an exclusion filter. Use the existing single-selection filter and synchronize its dropdown, active chip appearance and `aria-pressed` state across every visible matching chip. Clicking a chip while a detected-link filter is active switches to that tag filter.

Acceptance: mouse, Enter and Space toggle the same behavior; chip clicks do not copy text or initiate block dragging. An active tag is recognizable without relying on color alone. Re-rendering preserves keyboard focus where the selected chip still exists. Clearing the last instance of a selected tag restores All blocks. Verify mixed-case tags, Unicode, URL-shaped tags, link-to-tag switching, repeat clicks, edits/imports and narrow layouts. Existing copy, QR and saved-data behavior remains unchanged.

Implementation: tag chips are native buttons with smaller text, a muted gray background, softer borders and a minimum 28px height. A pressed chip uses bold text plus a checkmark; a two-tone focus ring stays visible against different block colors. Clicking a tag toggles the existing dropdown filter, synchronizes matching chip states and restores focus to the same block/tag after rendering. Chip pointer gestures are excluded from block dragging, and chip activation never copies the body. Removing a focused chip falls back to the filter control.

Validation: all 145 browser assertions plus actual downloaded JSON verification passed. The runner now sends native Enter/Space key events through Chrome's debugging protocol. Checks cover repeated clicks, focus retention, pressed states, non-color indicators, Unicode, URL-shaped tags, dropdown synchronization, link-to-tag switching, drag prevention, compact target height, 320px wrapping, imports and removal of the last selected tag. Existing copy, QR decoding and persistence checks still pass. Physical pointer-driven dragging remains a manual release check; chip drag isolation is exercised with synthetic pointer/drag events.

### Step 9 — Number detected links and their matching QR codes

**Status:** Not started. **Priority:** P2. **Dependencies:** Steps 2–3.

Scope: render Detected links as an ordered list in both the editor preview and saved blocks. Number distinct links 1, 2, 3 in first-appearance order within each block; repeated occurrences of the same parsed URL share one number. On saved blocks, provide on-demand QR views for those links, labeled **Link 1**, **Link 2**, etc., so the list and QR images can be matched at a glance. Each link QR encodes exactly the destination represented by its matching detected link, using the existing URL parser's normalization. Do not include the display number in the encoded payload.

Preserve the existing exact-body QR under a distinct **Full text QR** label; it must not be numbered as if it represents one detected link. With no detected links, only the full-text QR is available. Keep generation local, with Show/Hide controls and accessible descriptions identifying the block and link number. If Step 11 is implemented, honor its saved QR/default-visibility and Detect links settings: checked QR shows the full-text QR and available numbered link QR views by default; unchecked QR stays on demand. The editor needs numbered link preview only; QR generation remains on saved blocks. Numbering is derived presentation state, not stored metadata, and restarts at 1 for each block.

Acceptance: a block with three distinct links shows three matching link/QR identifiers, and an independent decoder recovers the correct destination from each image. Full-text QR continues to decode to the complete original body. Deduplication, punctuation handling, edits, imports and link removals update list order, labels and visible QR payloads together without stale associations. Reordering or filtering blocks does not change their internal link numbering. QR controls and link clicks do not copy the body; ordinary card clicks still do. Verify zero/one/multiple links, repeated URLs, long destinations, failed QR generation and 320px layout. Numbers never enter copied text, stored bodies or backup metadata.

### Step 10 — Replace color presets with a picker and HEX value

**Status:** Not started. **Priority:** P1.

Scope: replace the existing note color dots and page-background preset menu with native color pickers and synchronized editable HEX fields. Use the existing `color` and `preferredColor` storage fields, normalizing supported opaque colors to `#RRGGBB`. Show a small, muted color-value label on each note, such as `#F8F8F8`. This is presentation metadata, not a filtering tag, copied text or QR/barcode payload. HEX is the default numeric representation; a separate RGB entry mode is optional only if it materially improves usability.

Acceptance: picker changes update the HEX field and vice versa; invalid/incomplete input shows validation without replacing the last valid color. Existing HEX, RGB and named CSS colors load compatibly; define and document a deterministic opaque fallback for legacy transparent colors. Create/edit/cancel/reload/export/import preserve the intended color. Arbitrary selected colors retain readable text, links, controls, chip labels and focus indicators through contrast-aware styling. Changes to background color never overwrite note colors. Verify keyboard access and narrow layouts.

### Step 11 — Saved QR and Detect links creation options

**Status:** Not started. **Priority:** P1. **Dependencies:** Steps 2–3.

Scope: add labeled **Generate QR code** and **Detect links** checkboxes to the block creator/editor. Save a validated per-note options object, defaulting to `showQr: false` and `detectLinks: true` for new and legacy notes. Include `showBarcode: false` in the same schema for Step 12; do not expose a nonfunctional barcode checkbox before the generator exists. Optional fields must be booleans, and malformed imported options must not replace the current collection.

When Generate QR code is checked, display the code alongside the body immediately after saving and by default after reload or re-render. Keep full text visible and unchanged. Unchecked notes retain the existing on-demand Show QR control. A per-card Hide QR action temporarily hides the view for the current session; the editor checkbox controls the saved default. Preserve temporary visibility choices during unrelated renders and reset them when the saved option changes. Generate codes only for rendered notes; cache unchanged views and invalidate them when payload/settings change. If Step 9 exists, apply the default to full-text and numbered per-link QR views.

Detect links controls live preview, saved link lists, link-filter participation and any per-link QR views. Turning it off never removes URLs from the body or disables full-text QR/copy. A selected URL filter that no longer has matches resets to All blocks. The control is useful because URL extraction is optional interpretation of text; explicit Tags remain independent. Do not add automatic hashtag extraction, case conversion, trimming or generic parsing switches. Add future parsing controls only when a concrete feature and its behavior are defined.

Acceptance: options survive edit/cancel/reload/export/import and legacy records retain existing behavior. Checked QR appears by default with the correct decoded body; unchecked QR remains on demand. Detect links can be turned off/on without changing text, metadata tags or copied/encoded content. Test option combinations, malformed imports, temporary Show/Hide behavior, filtered collections, stale selected links, unsupported/oversized QR payloads and narrow screens. Checkboxes must be keyboard accessible and must not accidentally copy a block.

### Step 12 — Barcode generation with default display

**Status:** Not started. **Priority:** P2. **Dependency:** Step 11.

Scope: implement a bundled, licensed barcode encoder and expose the functional **Generate barcode** checkbox next to Generate QR code in the creator/editor. First establish and document the supported barcode symbology, scanner requirements and payload character/length limits; ask for the intended scanner or identifier format if those constraints cannot be determined. Do not assume a linear barcode can represent every body that a QR code supports.

Checked notes display their barcode alongside the full text by default, persist `showBarcode`, and restore the default after reload. QR and barcode checkboxes are independent and may both be checked. Provide accessible descriptions and session Show/Hide behavior consistent with Step 11. Encode the complete original body where supported; never silently trim, uppercase, truncate, substitute characters or encode a different field. Unsupported content gets an explanatory message and leaves copying/QR functional. Keep link-specific barcode generation out of this step; link/QR numbering remains governed by Step 9.

Acceptance: an independent decoder recovers exact supported payloads from rendered barcodes. Test checked/unchecked/both-code defaults, editing, reloads, imports, blank/oversized/unsupported Unicode payloads, invalid settings, hiding/reopening and narrow layouts. Record encoder version/license, symbology and tested limits. Confirm scan compatibility on the intended physical scanner before claiming that hardware workflow is validated; automated decoding alone is not hardware validation. No network service or CDN at runtime.

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
