# CopyBlocks roadmap

Implementation priorities, stable numbered steps, and validation history. See [README.md](README.md) for usage.

## Feature priorities and decisions

| Priority | Feature | Decision / next implementation |
| --- | --- | --- |
| P0 | Restore existing controls and persistence | Implemented; preserve the original backup shape and storage keys. |
| P1 | Edit existing blocks | Implemented with Save Changes and Cancel Edit. |
| P1 | Tag filtering | Implemented in Step 7: separate tag metadata, safe chips and case-insensitive filtering. Legacy body/title hashtags remain unchanged and are not inferred as tags. |
| P1 | Tag chip appearance and interaction | Implemented in Step 8: smaller, muted button chips toggle the matching tag filter with a checkmark and keyboard support. |
| P1 | Color picker and color value | Implemented in Step 10: native note/background pickers, synchronized HEX fields, per-note color labels and contrast-aware text. |
| P1 | Editing visibility | Implemented in Step 13: temporarily show the edited block first with an Editing badge and animated dotted outline; saved order stays unchanged. |
| P1 | Block action placement | Implemented in Step 14: evenly spaced top Copy/Edit/Delete controls and bottom code controls. Step 16 replaces movement buttons with drag-and-drop. |
| P1 | Drag destination preview | Planned in Step 16: drag-and-drop replaces Move up/down, with an empty dotted insertion placeholder and keyboard/touch support. |
| P2 | Words/icons toggle | Planned in Step 15: a top-of-page preference switches block action labels between words and accessible icons. |
| P1 | Popular tag filters | Implemented in Step 17: responsive frequent-tag buttons/counts, collapsible searchable overflow and a visible active tag; detected links are not filterable. |
| P1 | Color reuse shortcut | Implemented in Step 18: note HEX buttons fill the note picker without entering edit mode or saving. |
| P1 | Compact interface | Implemented in Step 14: a smaller page/block title area and adjacent responsive control groups. |
| P2 | Backup interface | Implemented in Step 19: compact Backups dialog, validation, preview counts, explicit replacement and storage-failure recovery. |
| P1 | Wrapping / separate blocks div | Implemented responsive wrapping and a separate saved-blocks section. |
| P2 | Detect links | Detected-link lists and live editor preview preserve card-click copying. Step 17 removed URL filtering. |
| P2 | Barcode / QR | QR implemented in Step 3 with a bundled encoder and independent decode tests. Linear barcodes remain deferred pending scanner/symbology requirements. Veto case normalization: exact text is preserved. |
| P2 | Matching link and QR numbers | Planned in Step 9: numbered detected links and matching per-link QR codes, with the full-text QR clearly separate. |
| P1 | Per-note creation options | Planned in Step 11: saved Generate QR and Detect links checkboxes; enabled QR is shown alongside text by default. Step 12 adds the working Generate barcode checkbox. |
| P2 | Barcode generation | Planned in Step 12: local barcode generation, validated payloads, default display when checked, and independent scan tests. |
| P2 | Request feature | Use [GitHub issues](https://github.com/ajklicker33/Copyblocks/issues) now. Defer an in-app submission service until there is a need for authentication, spam controls and maintenance. |
| P3 | Document Picture-in-Picture | Optional experiment: detect the API at runtime, expose the control only when available, and keep the main window fully usable. Test lifecycle and shared state before shipping; do not rely on a hard-coded browser list. |
| P3 | Electron | Defer packaging until a concrete desktop-only need exists. Veto adding a desktop runtime solely to fix browser controls. |

## Executable implementation plan

To start a task, prompt **"Begin work on Step X in ROADMAP.md"**. The numbered steps below are stable identifiers; do not renumber them when a step finishes. Steps 1–3, 7, 8, 10, 13–14 and 17–19 are **Complete**; Steps 4–6, 9, 11–12 and 15–16 are **Not started**. Recommended order: **16 → 15 → 11 → 9 → 12 → 4**. Steps 5–6 remain lower-priority optional work. The earlier regression fix and working features above are already implemented.

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

### Step 9 — Centered QR overlays and numbered link codes

**Status:** Not started. **Priority:** P2. **Dependencies:** Steps 2–3.

Presentation refinement: show QR codes in an overlay centered on their own block instead of inserting them into the text flow. This supersedes Step 14's inline QR placement when Step 9 ships. Keep the block's size and position stable. Provide a clearly labeled Close control, Escape dismissal, focus return to the opening control, and prevent overlay interactions from copying or dragging the block. Fit short cards and 320px screens without clipping the QR quiet zone; preserve scannability and accessible error messages. For multiple link codes, use a compact labeled selector within the overlay, retaining the matching link numbers and distinct Full text QR label. Verify positioning, dismissal, keyboard access and independent QR decoding.

Scope: render Detected links as an ordered list in both the editor preview and saved blocks. Number distinct links 1, 2, 3 in first-appearance order within each block; repeated occurrences of the same parsed URL share one number. On saved blocks, provide on-demand QR views for those links, labeled **Link 1**, **Link 2**, etc., so the list and QR images can be matched at a glance. Each link QR encodes exactly the destination represented by its matching detected link, using the existing URL parser's normalization. Do not include the display number in the encoded payload.

Preserve the existing exact-body QR under a distinct **Full text QR** label; it must not be numbered as if it represents one detected link. With no detected links, only the full-text QR is available. Keep generation local, with Show/Hide controls and accessible descriptions identifying the block and link number. If Step 11 is implemented, honor its saved QR/default-visibility and Detect links settings: checked QR shows the full-text QR and available numbered link QR views by default; unchecked QR stays on demand. The editor needs numbered link preview only; QR generation remains on saved blocks. Numbering is derived presentation state, not stored metadata, and restarts at 1 for each block.

Acceptance: a block with three distinct links shows three matching link/QR identifiers, and an independent decoder recovers the correct destination from each image. Full-text QR continues to decode to the complete original body. Deduplication, punctuation handling, edits, imports and link removals update list order, labels and visible QR payloads together without stale associations. Reordering or filtering blocks does not change their internal link numbering. QR controls and link clicks do not copy the body; ordinary card clicks still do. Verify zero/one/multiple links, repeated URLs, long destinations, failed QR generation and 320px layout. Numbers never enter copied text, stored bodies or backup metadata.

### Step 10 — Replace color presets with a picker and HEX value

**Status:** Complete (2026-11-10). **Priority:** P1.

Scope: replace the existing note color dots and page-background preset menu with native color pickers and synchronized editable HEX fields. Use the existing `color` and `preferredColor` storage fields, normalizing supported opaque colors to `#RRGGBB`. Show a small, muted color-value label on each note, such as `#F8F8F8`. This is presentation metadata, not a filtering tag, copied text or QR/barcode payload. HEX is the default numeric representation; a separate RGB entry mode is optional only if it materially improves usability.

Acceptance: picker changes update the HEX field and vice versa; invalid/incomplete input shows validation without replacing the last valid color. Existing HEX, RGB and named CSS colors load compatibly; define and document a deterministic opaque fallback for legacy transparent colors. Create/edit/cancel/reload/export/import preserve the intended color. Arbitrary selected colors retain readable text, links, controls, chip labels and focus indicators through contrast-aware styling. Changes to background color never overwrite note colors. Verify keyboard access and narrow layouts.

Implementation: native note/background color inputs replace the preset dots and color menu. Six-digit HEX fields accept an optional `#`, normalize to uppercase, and synchronize with their pickers. Invalid or incomplete entries retain the last valid color, show an inline message and prevent saving a note until corrected. Editing loads the stored note color; cancel/save restore the creator's previous color. Background changes use `preferredColor` independently of note colors. Each note displays a neutral HEX label excluded from tags, copied text and QR payloads.

Legacy behavior: existing supported opaque CSS HEX/RGB/named colors normalize to sRGB `#RRGGBB` on load/import. Partially transparent, transparent, invalid or context-dependent colors use `#F8F8F8` for notes and `#F0F0F0` for the page. Storage is not rewritten merely by loading; normalized values are saved/exported on the next relevant action. The fallback deliberately avoids background-dependent alpha compositing.

Validation: all 177 browser assertions plus actual downloaded JSON verification passed. Checks cover field synchronization, invalid input, edit/cancel, reloads, backup round trips, legacy conversion, transparent fallback, background/note isolation, copy/QR exclusion, input labels/focus and 320px fit. Computed body/title/link contrast and opaque chip/label/button surfaces passed a 4.5:1 check across black, white, gray and primary-color notes. Text uses black or white based on relative luminance; focus rings use dark and white layers. Native operating-system picker dialog interaction remains a manual check; automated tests exercise its input events and editable HEX alternative.

### Step 11 — Saved QR and Detect links creation options

**Status:** Not started. **Priority:** P1. **Dependencies:** Steps 2–3.

Scope: add labeled **Generate QR code** and **Detect links** checkboxes to the block creator/editor. Save a validated per-note options object, defaulting to `showQr: false` and `detectLinks: true` for new and legacy notes. Include `showBarcode: false` in the same schema for Step 12; do not expose a nonfunctional barcode checkbox before the generator exists. Optional fields must be booleans, and malformed imported options must not replace the current collection.

When Generate QR code is checked, display the code alongside the body immediately after saving and by default after reload or re-render. Keep full text visible and unchanged. Unchecked notes retain the existing on-demand Show QR control. A per-card Hide QR action temporarily hides the view for the current session; the editor checkbox controls the saved default. Preserve temporary visibility choices during unrelated renders and reset them when the saved option changes. Generate codes only for rendered notes; cache unchanged views and invalidate them when payload/settings change. If Step 9 exists, apply the default to full-text and numbered per-link QR views.

Detect links controls live preview, saved link lists and any per-link QR views. Step 17 removes link filtering entirely; do not restore it here. Turning it off never removes URLs from the body or disables full-text QR/copy. Tag filtering remains independent of link detection. The control is useful because URL extraction is optional interpretation of text; explicit Tags remain independent. Do not add automatic hashtag extraction, case conversion, trimming or generic parsing switches. Add future parsing controls only when a concrete feature and its behavior are defined.

Acceptance: options survive edit/cancel/reload/export/import and legacy records retain existing behavior. Checked QR appears by default with the correct decoded body; unchecked QR remains on demand. Detect links can be turned off/on without changing text, metadata tags or copied/encoded content. Test option combinations, malformed imports, temporary Show/Hide behavior, filtered collections, tag-filter preservation, unsupported/oversized QR payloads and narrow screens. Checkboxes must be keyboard accessible and must not accidentally copy a block.

### Step 12 — Barcode generation with default display

**Status:** Not started. **Priority:** P2. **Dependency:** Step 11.

Scope: implement a bundled, licensed barcode encoder and expose the functional **Generate barcode** checkbox next to Generate QR code in the creator/editor. First establish and document the supported barcode symbology, scanner requirements and payload character/length limits; ask for the intended scanner or identifier format if those constraints cannot be determined. Do not assume a linear barcode can represent every body that a QR code supports.

Checked notes display their barcode alongside the full text by default, persist `showBarcode`, and restore the default after reload. QR and barcode checkboxes are independent and may both be checked. Provide accessible descriptions and session Show/Hide behavior consistent with Step 11. Encode the complete original body where supported; never silently trim, uppercase, truncate, substitute characters or encode a different field. Unsupported content gets an explanatory message and leaves copying/QR functional. Keep link-specific barcode generation out of this step; link/QR numbering remains governed by Step 9.

Acceptance: an independent decoder recovers exact supported payloads from rendered barcodes. Test checked/unchecked/both-code defaults, editing, reloads, imports, blank/oversized/unsupported Unicode payloads, invalid settings, hiding/reopening and narrow layouts. Record encoder version/license, symbology and tested limits. Confirm scan compatibility on the intended physical scanner before claiming that hardware workflow is validated; automated decoding alone is not hardware validation. No network service or CDN at runtime.

### Step 13 — Bring the edited block to the top and highlight it

**Status:** Complete (2026-11-10). **Priority:** P1.

Scope: while editing, temporarily show the existing block first in the saved-block section, immediately below the creator/editor, with a moving dotted outline. Mark it visibly as **Editing** and expose that state to assistive technology. Use a lightweight CSS animation that does not shift layout or interfere with buttons, links, focus indicators or text selection. Honor `prefers-reduced-motion` with a static dotted outline.

The promotion is display-only: preserve the underlying saved order and export order. Save or Cancel removes the edit highlight and restores normal placement. Editing a different block moves the highlight to that block without creating a duplicate. If filtering would hide the edited block, keep it visible in the first position as an explicitly labeled editing exception; report filtered matches separately from that exception. Freeze reordering while editing to avoid confusing temporary placement with a saved order change. Delete, clear and confirmed replacement import must cleanly end the affected edit session.

Acceptance: only one block is marked Editing; it remains discoverable during filtering and after unrelated renders. Save/Cancel, switching edits, deletion and imports clear or transfer the state correctly. Saved/exported order never changes merely from entering/exiting edit mode. The outline stays visible on all note colors and at 320px, has a reduced-motion fallback, and does not disrupt keyboard focus or existing QR/tag/link behavior. Edit highlighting and temporary placement are never persisted in backups.

Implementation: the renderer promotes the existing edited record in a temporary display sequence while all mutations and exports retain the original array indices/order. An Editing badge and two-tone moving dotted outline identify the block; reduced-motion mode uses the same static outline. Filter exceptions remain first with an explicit label and a separate match/exception count. Movement buttons and drag/drop are disabled throughout editing. Save, Cancel, switching edits, deletion, clearing and confirmed replacement imports restore or transfer the state, with Edit focusing the text entry without scrolling the page; Cancel returns focus to the title field.

Validation: all 198 browser assertions plus actual downloaded JSON verification passed. New checks cover display versus saved/export order, one accessible editing marker, focus, visible QR/link preservation, reorder prevention, filtered exceptions/counts, save/cancel/switch cleanup, deletion/clear/import cleanup, 320px fit and native browser reduced-motion emulation. The outline ignores pointer events and adds no layout dimensions. Animated styling is implemented; full visual review on physical devices remains part of manual release checks.

### Step 14 — Compact layout and block action placement

**Status:** Complete (2026-11-11). **Priority:** P1.

Layout refinement: reduce the page title/header height and block-title padding without truncating meaningful titles. Use adjacent, aligned controls for related fields (title/tags where space permits, color/HEX, action groups and backup controls) rather than separate full-width stacked panels. Keep the body textarea comfortably usable. Use responsive grid/flex layouts: compact rows on desktop, sensible wrapping/stacking at narrow widths, visible labels and a tab order matching the visual order. Do not shrink interactive hit areas merely to save space. Coordinate the backup entry point with Step 19.

Scope: place **Copy**, **Edit** and **Delete** in an evenly spaced row aligned to the top border of each block. Reserve space so the controls do not overlap the title, the editing outline or content. Place **Show/Hide QR** and, when implemented, **Show/Hide barcode** in an evenly spaced row anchored at the bottom of the block, even when neighboring cards have different content heights. The newer Step 16 request supersedes the previous Move up/down row: use drag-and-drop with a destination placeholder instead. If Step 16 is not yet complete, retain existing movement controls temporarily rather than removing the keyboard reordering path.

Rendered code images remain content above the bottom code-control row; opening a code must not move those controls into the middle of the block. Do not add a nonfunctional barcode control before Step 12. When barcode support arrives, use the same code-control row. Maintain equal spacing for whichever code controls exist. Preserve all current confirmation, filtering, editing, copy and Show/Hide behavior.

Acceptance: verify reduced header/title whitespace and adjacent control groups without horizontal overflow at 320px or overlap at 200% zoom. Inspect short/long text, titles, tags, multiple links, visible QR images and error messages at mobile and desktop widths. Top and bottom controls remain evenly distributed without overflow, clipped focus rings or title overlap. Keyboard tab order follows the visual order; control clicks never trigger the card's copy handler. Existing disabled movement rules, including editing rules if Step 13 is present, remain effective. Test with the words/icons preference if Step 15 is already implemented.

Implementation: the smaller header wraps its toolbar, title/tags share a desktop row, and note color/save controls sit alongside one another when space permits. Narrow layouts stack in DOM order. Each card starts with equal-width Copy/Edit/Delete buttons and ends with a bottom-aligned footer containing QR controls and the temporary movement row. QR images and errors remain above that footer; titles remain fully readable.

Validation: all 259 browser assertions and actual downloaded JSON verification passed. New checks cover desktop adjacency, equal action widths, unequal-height card footer alignment, visible QR/error placement, native Tab order, 320px wrapping and 200% CSS zoom. Physical-device visual review and browser-level zoom remain manual release checks.

### Step 15 — Toggle block actions between words and icons

**Status:** Not started. **Priority:** P2. **Dependency:** Step 14.

Scope: add a clearly labeled button at the top of the page that toggles block action controls between words and icons. Default to words and persist the preference in its own local-storage setting. Apply it to Copy, Edit, Delete, the Editing/Save control and Show/Hide QR/barcode when available. The Editing control becomes a Save icon in icon mode, retaining its save handler, validation, accessible Save changes name and tooltip. Do not restore Move up/down controls removed by Step 16; its drag handle keeps a consistent recognizable appearance and accessible name in both modes. The toggle itself retains a readable text label describing the available switch, such as **Use icons** / **Use words**; do not turn it into an unexplained icon.

Use small local SVG icons with no network dependency. Keep native button semantics and meaningful accessible names in both modes; SVG decoration is hidden from assistive technology. Provide descriptive hover/focus tooltips for icon-only controls. Keep disabled states, destructive-action distinctions, pressed/expanded state and Show-versus-Hide meaning clear. The preference changes presentation only, never action behavior, note data, copied text, code payloads or backup format.

Acceptance: toggling updates existing blocks immediately, newly added/imported blocks use the selected mode, and the preference survives reload independently of note content. Switching during editing, filtering or QR display preserves those states and focus. Test mouse and keyboard activation, accessible names, tooltips, disabled movement, Show/Hide transitions, narrow layouts and unavailable storage. Step 12 must extend this presentation to barcode controls when they become available.

### Step 16 — Drag-and-drop with a dotted destination placeholder

**Status:** Not started. **Priority:** P1. Supersedes the Move up/down button layout previously requested in Step 14.

Scope: replace Move up / Move down buttons with drag-and-drop reordering and a clear drag handle on each block. While moving a block, insert an empty dotted-outline placeholder at the exact grid position where it will land on release. Size the placeholder to the dragged block, keep a distinct dragged-block preview, and update the insertion target as the pointer crosses neighboring cards. The placeholder must occupy layout space rather than merely decorating the hovered card. Distinguish its static empty dotted outline from Step 13's animated outline on the populated edited block.

Use insertion positions, not swaps, with consistent before/after behavior in one-, two- and three-column layouts. Support the first and last positions, unequal card heights, responsive row wrapping and scrolling near viewport edges. Save the new order only after a successful drop; cancel, Escape, pointer cancellation, releasing outside a valid destination or dropping in the original position must preserve the prior order and remove all previews/placeholders. Never persist placeholder state or duplicate the dragged block in storage/export. Freeze reordering while filtered or editing, with an understandable disabled handle state.

Accessibility and touch: use a focusable drag handle with an accessible name and concise instructions. Space/Enter on the handle picks up a block; arrow keys move its prospective position with the same dotted placeholder; Space/Enter drops and Escape cancels. Announce pickup, destination and completion via a live region, and retain focus on the moved handle. Support touch dragging through the handle while preserving normal page scrolling elsewhere. Text selection, links, chips, action buttons and QR controls must not start a drag. A completed or cancelled drag must not trigger the block's copy handler.

Acceptance: exercise real pointer dragging plus keyboard and touch paths, including movement in both directions, across rows, to first/last positions, past unequal-height blocks and during edge scrolling. Verify the dotted placeholder predicts the final position exactly. Reload/export must reflect only committed drops; cancellations and invalid drops leave the saved order unchanged. Test filtered/editing restrictions, deleted/imported collections, interruption cleanup, native keyboard focus, 320px layouts, no accidental copying and preservation of tag/link/QR behavior. Remove the old Move up/down controls and their obsolete tests only once these replacement interactions are verified; document any physical-device checks that remain manual.

### Step 17 — Compact popular tags with live counts

**Status:** Complete (2026-11-11). **Priority:** P1. **Dependencies:** Steps 7–8.

Scope: replace the filter dropdown with a responsive shortlist of clickable tag buttons showing each label and quantity, for example `Work (12)`. Count notes containing each case-insensitive tag once per note, across the entire collection rather than the filtered subset. Sort by count descending, then normalized label ascending for deterministic ties; retain a consistent display spelling. Recompute after save, tag edit, delete, clear and import without reload. Unsaved editor drafts do not change collection counts.

Clicking a tag filters matching notes; clicking it again clears the filter. Keep an explicit All/reset control and the existing per-note chip toggles. Show up to three frequent tags at widths of 640px or less, and five above that. Put the rest in a collapsed More tags panel with a search field; search can also find popular tags. If an active tag is outside the shortlist, show its pressed chip and count separately, so it remains visible when the panel is closed. Reset only when the selected tag no longer exists. Preserve the editing exception and distinct match count from Step 13. Announce count/filter changes accessibly without stealing focus.

Remove detected URLs from filter choices and matching logic entirely. Links remain displayed, clickable and available for their planned QR views; their bodies/payloads do not change. This supersedes dropdown/link-filter requirements in completed Steps 2, 7 and 8 and any earlier planned URL-filter checks. Do not rewrite historical completion reports; update current UI documentation/tests when implementing.

Acceptance: test zero through many tags, deterministic ties, casing variants, deduplication, live count/rank changes after mutations, active tags falling out of the responsive shortlist, less-common chip selection, tag removal, edits/imports and 320px layout. Counts must not shrink when a filter activates. No URL filter remains, while link opening, copying, editing highlights and QR behavior still pass their checks.

Implementation: a compact All/count button and muted frequent-tag chips replace the select menu. The strip shows three suggestions on narrow screens and five on wider screens. Additional tags live inside native More tags disclosure; its search supports case-insensitive Unicode matching and reports an empty result. A selected overflow tag remains separately visible. Counts use the entire saved collection and update after add/edit/delete/import/clear, not unsaved drafts. Responsive changes and native keyboard activation preserve relevant focus; a polite live result count announces filtering outcomes. No URL filtering remains, but detected links and QR views still work.

Validation: all 221 browser assertions and real downloaded JSON verification passed. Updated obsolete dropdown/link-filter checks and added ranking/tie/deduplication tests, global counts under filtering, collapsed overflow, search, responsive limits, active-filter retention, live mutation counts, draft isolation, native Enter/Space, 320px fit and zero-tag/clear cases. Existing edit exceptions, inline Editing-save validation, copy behavior, QR decoding and persistence checks also pass.

### Step 18 — Reuse a note color by clicking its HEX label

**Status:** Complete (2026-11-11). **Priority:** P1. **Dependency:** Step 10.

Scope: make each note's displayed HEX value a compact native button. Clicking it fills the note color picker and HEX input with that value through their existing synchronization/validation path. Do not enter edit mode, alter the source note, save any note, copy text or change the page-background picker. If the editor already contains a draft or an active edit, update only its selected color; apply it to that note only on an explicit Add/Save.

Acceptance: mouse, Enter and Space select the exact source color without scrolling or losing the current draft. Both picker/HEX fields update and any invalid draft HEX state clears. Stored blocks, tag filters, existing edit state and page background remain unchanged until the normal save action. Label remains readable, compact and explicitly named for assistive technology, for example `Use note color #123456`. Color-label clicks must not bubble into copying or initiate dragging.

Implementation: each HEX value is a compact native button with a descriptive accessible name and tooltip. It uses the existing color synchronization path to fill the note picker/HEX field and clear invalid draft color input. It does not focus the editor, scroll, enter edit mode, change the background, or save anything. Pointer presses and drag events on the color button are isolated from block dragging; clicks are isolated from copying. Drafts and active edits apply the chosen color only through the normal Add/Save action.

Validation: all 234 browser assertions and actual downloaded JSON verification passed. New checks cover native Enter/Space and clicks, picker synchronization, validation recovery, draft/filter/edit preservation, unchanged scroll and storage, no clipboard activity, drag prevention and explicit Add/Save behavior. Physical pointer dragging remains part of the existing manual release checks.

### Step 19 — Clearer import/export interface

**Status:** Complete (2026-11-11). **Priority:** P2.

Scope: group import/export behind one compact **Backups** entry point in the header, coordinated with Step 14's denser layout. Provide clearly labeled Export all notes and Import backup actions with short explanations. Export must always include the full saved collection, including filtered-out notes, and say that unsaved drafts are excluded. Preserve the compatible JSON backup shape; a date-stamped filename is an optional convenience.

Before replacing notes, parse and validate the selected file, show its filename and valid note count, and explicitly explain that import replaces the existing collection. Offer Cancel and a clear Replace confirmation, with an Export current notes action available before replacement. Validation errors must preserve stored notes and the editor draft. Cancel must retain the current UI state and allow choosing the same file again. Confirmed replacement follows existing edit/filter cleanup rules. Keep the interface local, keyboard accessible, and usable at 320px; use inline status rather than silent failures. Do not add cloud sync, accounts or automatic imports.

Acceptance: verify full-collection export while filtered and editing, preview counts, malformed JSON/schema rejection, cancellation, same-file retry, confirmed replacement, empty backups, storage failures and recovery messaging. Check keyboard focus when opening/closing the backup UI and protect unsaved drafts until replacement is explicitly confirmed. Continue actual downloaded-file verification in the isolated browser runner.

Implementation: a single Backups header button opens a native modal with Export all notes and Import backup actions. Validated files show their filename and note count before an explicit Replace all notes action, including empty backups. Cancel/Close/Escape discard the pending import and restore focus; file selection resets for same-file retries. Invalid files preserve the collection and draft. Replacement writes successfully to storage before changing the session or clearing the editor, so quota failures retain the preview for retry and offer export/recovery guidance. Export retains the existing compatible JSON format and full-collection behavior.

Validation: all 273 browser assertions plus actual downloaded JSON verification passed. New coverage checks modal focus, malformed input, filename/count preview, draft preservation, cancellation, same-file retry, simulated storage failure/recovery, empty replacement, 320px layout and native Escape dismissal. Existing filtered/editing export checks still pass. OS file-picker interaction remains a manual release check.

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
