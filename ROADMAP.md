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
| P1 | Drag destination preview | Implemented in Step 16: drag handles replace Move up/down, with an empty dotted insertion placeholder and keyboard/touch support. |
| P2 | Words/icons toggle | Implemented in Step 15: persistent words/icons preference, inline Save/Cancel while editing and red Delete/Cancel controls. |
| P1 | Popular tag filters | Implemented in Step 17: as many frequent-tag chips/counts as fit, collapsible Show all tags and a visible active tag; no search boxes or URL filtering. |
| P1 | Color reuse shortcut | Implemented in Step 18: note HEX buttons fill the note picker without entering edit mode or saving. |
| P1 | Compact interface | Implemented in Step 14: a smaller page/block title area and adjacent responsive control groups. |
| P2 | Backup interface | Implemented in Step 19: compact Backups dialog, validation, preview counts, explicit replacement and storage-failure recovery. |
| P1 | Wrapping / separate blocks div | Implemented responsive wrapping and a separate saved-blocks section. |
| P2 | Detect links | Detected-link lists and live editor preview preserve card-click copying. Step 17 removed URL filtering. |
| P2 | Barcode / QR | QR and Code 128 implemented with bundled open-source encoders and independent decode tests. Veto case normalization: exact text is preserved. |
| P2 | Matching link and QR numbers | Implemented in Step 9: centered QR overlays; number links/codes only when multiple distinct links exist. Full text QR stays separate. |
| P1 | Persistent code pinning | Implemented Step 11: restore pinned code overlays after reload; no creation checkboxes or inline code images. |
| P2 | Barcode generation | Implemented Step 12: block-width QR/Barcode overlay, automatic retry after width changes, persistent pinned format and combined action label/icon. |
| — | Request feature entry point | Discontinued at user request; do not implement Step 4. |
| — | Document Picture-in-Picture | Discontinued at user request; do not implement Step 5. |
| — | Desktop packaging | Discontinued at user request; do not implement Step 6. |

## Executable implementation plan

To start a task, prompt **"Begin work on Step X in ROADMAP.md"**. The numbered steps below are stable identifiers; do not renumber them when a step finishes. Steps 1–3, 7–22 and 24–26 are **Complete**; Step 23 is **Superseded**. Steps 4–6 are **Discontinued**. Step 27A is **Complete**; optional Stages 27B–C remain unimplemented. Step 28 is **Postponed** at user request. Review the standard Connect Four game before selecting a variant; Stage 27B requires clarification of the removal rule. Do not resume discontinued or postponed steps unless explicitly requested. New requests are scoped below; they are not implemented merely by being added to this plan.

### Instructions for the implementing agent

- Version control: use one active feature branch based on current `main` and one PR targeting `main`. Do not create stacked PRs unless explicitly requested. Explain what is local, pushed, and merged. When authorized to clean up, verify merged content before deleting branch names. The assistant handles implementation, testing and requested commit/push/PR preparation; the user reviews/merges unless they explicitly delegate merging. Push does not mean merge.
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

Link detection remains automatic. The former Step 11 Detect links checkbox proposal is deferred; Steps 11–12 now concern persistent code overlays.

Scope: derive distinct HTTP(S) links dynamically from each block's text, using URL parsing and safe DOM construction. Show detected URLs as a list under a Detected links heading, without an Open link prefix. Preview links live under the text editor and include detected URLs in the filter alongside hashtags. Recompute after edits and imports; do not store redundant link metadata. Leave ambiguous punctuation outside a link where possible and document the detection rule.

Acceptance: clicking the card still copies the exact text; link actions open a new tab with `noopener` and `noreferrer` and do not copy; non-HTTP(S) schemes and HTML payloads cannot become executable links. Test multiple links, duplicates, punctuation, edits, imports and text without links.

Implementation: HTTP(S) URLs are parsed and deduplicated dynamically at render time, with no added stored fields. Native links open a new tab with `noopener noreferrer`, display their destination and do not trigger card copying. Links refresh after edits, imports and reloads, and long destinations wrap on narrow screens. The editor has a live Detected links list; saved cards show the same list below their body. Filter by hashtag or detected link groups the available choices and matches an exact detected URL. A removed selection resets to All blocks; reordering stays disabled while filtered.

Detection rule: recognize explicit `http://` or `https://` at the start of text or after whitespace, an opening bracket, angle bracket or opening quote. Stop at whitespace, quotes or angle brackets. Trim trailing sentence punctuation (`.,!?:;`) and unmatched closing brackets; retain balanced parentheses inside URLs. Normalize with the browser URL parser and deduplicate the parsed result. Bare domains, relative paths and other schemes are not detected. Ambiguous literal trailing punctuation must be percent-encoded to remain part of a detected URL. The original body is never rewritten.

Validation: all 67 browser assertions (40 baseline plus 27 link/list/filter checks) and actual JSON download verification passed. Checks cover duplicates, punctuation, query parameters, safe schemes, inert HTML, edit/import/reload refresh, exact copying, isolated-tab attributes, 320px wrapping, live preview updates, combined filtering and stale-selection resets. Navigation is suppressed during the click-isolation test to avoid opening external sites; actual destination loading remains a manual check using an ordinary native link.

### Step 3 — Generate QR codes on demand

**Status:** Complete (2026-11-09). **Priority:** P2.

Planned refinement: Step 9 adds numbered per-link QR codes. The current implementation generates one full-body QR per block, so multiple matching link/QR pairs require new behavior rather than only labels.

Step 11 adds persistent overlay pinning; Step 12 adds barcode format selection in that overlay. Neither step adds creation checkboxes or inline code images.

Scope: implement QR first, using a bundled, licensed encoder with no network requests or CDN dependency. Add a Show QR / Hide QR action per block, encoding the exact text on demand. Keep generation lazy; regenerate visible codes after an edit and release removed views. Provide an accessible text description and an understandable message for content that exceeds the encoder's capacity.

Acceptance: independent decoding round trips preserve mixed case, Unicode, URLs and multiline text; ordinary block clicks still copy; QR actions do not accidentally copy; oversized input leaves the application usable; imports and edits cannot display stale codes. Record the library version/license and tested capacity. Veto case normalization. Linear barcodes remain deferred until a symbology and scanner requirement are supplied; they are not part of this step.

Implementation: local canvas rendering uses the bundled MIT-licensed Project Nayuki encoder (publisher snapshot dated 2026-11-09, pinned by SHA-256). Show QR generates lazily; Hide QR removes its cached view. Visible codes update after edits, unchanged codes are reused, and replacement imports/deletions discard old views. The exact UTF-8 body is encoded with ECI 26 and medium error correction. Canvas descriptions support assistive technology; oversized or invalid Unicode input produces a message while copying remains available. QR visibility and images are never persisted in backups.

Validation: all 104 browser assertions plus real JSON download verification passed. The independent jsQR 1.4.0 decoder recovered exact mixed case, Unicode/emoji, combining characters, URLs, multiline whitespace and leading BOM text from rendered canvas pixels. Tests also cover lazy generation, show/hide isolation, regeneration after edits/imports, deletion, accessible description, 320px fit and the 2,330-byte limit. Both 2,331 ASCII bytes and 2,332 UTF-8 bytes fail gracefully; shorter edits recover. Invalid surrogate text is rejected without substitution. Dependency source identifiers, hashes and licenses are in [vendor/README.md](vendor/README.md).

Limitation: physical camera/scanner testing remains manual, particularly for dense codes reduced to fit a narrow card. The automated decoder reads the original canvas pixels, not a photograph or CSS-scaled screenshot. Linear barcodes are still outside this step.

### Step 4 — Add a feature-request entry point

**Status:** Discontinued (2026-11-13), at user request. Do not add an in-app feature-request entry point. Step number retained for history.

### Step 5 — Add optional Document Picture-in-Picture

**Status:** Discontinued (2026-11-13), at user request. Do not implement a pop-out window or Document Picture-in-Picture. Step number retained for history.

### Step 6 — Evaluate desktop packaging

**Status:** Discontinued (2026-11-13), at user request. Do not evaluate or implement desktop packaging. Step number retained for history.

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

**Status:** Complete (2026-11-12). **Priority:** P2. **Dependencies:** Steps 2–3.

Completed refinement (2026-11-12): opening QR defaults to the first detected link, or Full text QR when no link exists. The QR image is a keyboard-accessible copy button for exactly its selected payload; it does not copy the entire note when a link code is selected. A top-left pin icon holds the overlay open against outside clicks and Escape, with an accessible pressed state. A red X at top right explicitly closes even a pinned overlay and returns focus. Unpin restores normal dismissal. Pinning is session-only, survives unrelated renders and does not enter backups; explicit closure resets it. This refinement supersedes any earlier assumption that the full-body QR is the default or QR-image clicks do nothing.

Refinement validation: all 379 browser assertions and actual downloaded JSON verification passed, including first-link defaults, exact link/body copying through mouse/native Enter, pin placement/state, outside/Escape behavior, retained selection across rerenders, explicit red-X closure and unpinning. No separate roadmap step was needed.

Additional presentation requests: remove the redundant “Scan to read full block text” caption. Keep a concise Full text QR / Link N identifier where needed. Clicking outside the QR panel dismisses it, as do Close and Escape, without copying the underlying block or starting a drag. Return focus to the opener; interactions inside the panel must not dismiss it.

Presentation refinement: show QR codes in an overlay centered on their own block instead of inserting them into the text flow. This supersedes Step 14's inline QR placement when Step 9 ships. Keep the block's size and position stable. Provide a clearly labeled Close control, Escape dismissal, focus return to the opening control, and prevent overlay interactions from copying or dragging the block. Fit short cards and 320px screens without clipping the QR quiet zone; preserve scannability and accessible error messages. For multiple link codes, use a compact labeled selector within the overlay, retaining the matching link numbers and distinct Full text QR label. Verify positioning, dismissal, keyboard access and independent QR decoding.

Scope: number detected links and link codes only when a block contains more than one distinct link. A single link uses an unnumbered list entry and a Link code label. For multiple links, use ordered lists in the editor preview and saved blocks, numbered 1, 2, 3 in first-appearance order; repeated occurrences of the same parsed URL share one number. On saved blocks, provide on-demand QR views for those links, labeled **Link 1**, **Link 2**, etc., so the list and QR images can be matched at a glance. Each link QR encodes exactly the destination represented by its matching detected link, using the existing URL parser's normalization. Do not include the display number in the encoded payload.

Preserve the existing exact-body QR under a distinct **Full text QR** label; it must not be numbered as if it represents one detected link. With no detected links, only the full-text QR is available. Keep generation local, with Show/Hide controls and accessible descriptions identifying the block and link number. If Step 11 is implemented, restore only pinned overlays and their selected payload; unpinned codes remain on demand. Step 12 adds the alternative barcode format in the same overlay. The editor needs numbered link preview only; QR generation remains on saved blocks. Numbering is derived presentation state, not stored metadata, and restarts at 1 for each block.

Acceptance: a block with three distinct links shows three matching link/QR identifiers, and an independent decoder recovers the correct destination from each image. Full-text QR continues to decode to the complete original body. Deduplication, punctuation handling, edits, imports and link removals update list order, labels and visible QR payloads together without stale associations. Reordering or filtering blocks does not change their internal link numbering. QR controls and link clicks do not copy the body; ordinary card clicks still do. Verify zero/one/multiple links, repeated URLs, long destinations, failed QR generation and 320px layout. Numbers never enter copied text, stored bodies or backup metadata.

Implementation: QR content uses a centered absolute overlay without changing card dimensions. A compact selector switches between exact Full text QR and normalized detected-link payloads; only multiple distinct links receive Link 1/2/3 labels. Single-link blocks use Link. Numbering is derived in first-appearance order and duplicates share one entry. The old scan caption is removed. Close, Escape and outside mouse/touch activation dismiss the panel and restore opener focus; inside interaction stays usable. Outside pointer presses cannot start block dragging or copy the underlying note. Cached views survive unrelated rendering and regenerate after text edits.

Validation: all 354 browser assertions plus actual downloaded JSON verification passed. Independent decoding covers three matching numbered link codes, single/repeated links and exact full-body QR; additional checks cover stable card dimensions, centered placement, Close/Escape/outside mouse and touch dismissal, focus, 320px fit, caption removal and edited payload refresh. Existing oversized/invalid Unicode and filtering/reorder tests remain passing. Physical scanning and screen-reader behavior remain manual release checks.
### Step 10 — Replace color presets with a picker and HEX value

**Status:** Complete (2026-11-10). **Priority:** P1.

Scope: replace the existing note color dots and page-background preset menu with native color pickers and synchronized editable HEX fields. Use the existing `color` and `preferredColor` storage fields, normalizing supported opaque colors to `#RRGGBB`. Show a small, muted color-value label on each note, such as `#F8F8F8`. This is presentation metadata, not a filtering tag, copied text or QR/barcode payload. HEX is the default numeric representation; a separate RGB entry mode is optional only if it materially improves usability.

Acceptance: picker changes update the HEX field and vice versa; invalid/incomplete input shows validation without replacing the last valid color. Existing HEX, RGB and named CSS colors load compatibly; define and document a deterministic opaque fallback for legacy transparent colors. Create/edit/cancel/reload/export/import preserve the intended color. Arbitrary selected colors retain readable text, links, controls, chip labels and focus indicators through contrast-aware styling. Changes to background color never overwrite note colors. Verify keyboard access and narrow layouts.

Implementation: native note/background color inputs replace the preset dots and color menu. Six-digit HEX fields accept an optional `#`, normalize to uppercase, and synchronize with their pickers. Invalid or incomplete entries retain the last valid color, show an inline message and prevent saving a note until corrected. Editing loads the stored note color; cancel/save restore the creator's previous color. Background changes use `preferredColor` independently of note colors. Each note displays a neutral HEX label excluded from tags, copied text and QR payloads.

Legacy behavior: existing supported opaque CSS HEX/RGB/named colors normalize to sRGB `#RRGGBB` on load/import. Partially transparent, transparent, invalid or context-dependent colors use `#F8F8F8` for notes and `#F0F0F0` for the page. Storage is not rewritten merely by loading; normalized values are saved/exported on the next relevant action. The fallback deliberately avoids background-dependent alpha compositing.

Validation: all 177 browser assertions plus actual downloaded JSON verification passed. Checks cover field synchronization, invalid input, edit/cancel, reloads, backup round trips, legacy conversion, transparent fallback, background/note isolation, copy/QR exclusion, input labels/focus and 320px fit. Computed body/title/link contrast and opaque chip/label/button surfaces passed a 4.5:1 check across black, white, gray and primary-color notes. Text uses black or white based on relative luminance; focus rings use dark and white layers. Native operating-system picker dialog interaction remains a manual check; automated tests exercise its input events and editable HEX alternative.

### Step 11 — Persistent code-overlay pinning

**Status:** Complete (2026-11-12). **Priority:** P1. **Dependencies:** Steps 3, 9.

Replace the creation-checkbox proposal with persistent pinning from the existing code overlay. Do not add Generate QR or Generate barcode controls to the creator/editor. Codes appear only in centered overlays, never as inline content in the block body. Keep note dimensions and body text unchanged. Link detection retains its current automatic behavior; the previously proposed Detect links checkbox is deferred outside these steps.

Proposed interaction: one code overlay per note, with the existing pin at top left, flexible content selector between controls, and red X at top right. Pinning saves the overlay's open state and chosen payload so reload restores the same code. Step 12 extends this state with QR/Barcode format selection. Pinned overlays ignore outside clicks and Escape; unpinning leaves the panel open for this session but removes automatic reopening. Explicit X/Hide closes it and clears its saved pin. Ordinary unpinned openings stay session-only. These close/unpin semantics are part of this draft for review.

Persist validated per-note presentation settings, not generated images. New and legacy notes default to unpinned. Keep settings in JSON backups, preserve them through edits and unrelated renders, and reject malformed settings without replacing existing notes. Store full-text versus a link destination rather than a fragile link-list index; if editing removes the selected destination, fall back to the first remaining link or full text and announce the change. Duplicate notes start unpinned. Filtered-out notes must not force themselves visible merely because they are pinned; restore the overlay when they become visible again. Pin persistence must not save an unfinished editor draft or reorder notes. A failed settings write must report the error without claiming the pin was saved.

Acceptance: test pin/unpin/X/Hide behavior, reload, export/import, legacy defaults, invalid settings, edits/removal of selected links, duplicate defaults, filters/search/priority views, inaccessible storage, focus return, and 320px overlays. Keep QR payloads independently decodable and copied text exact. Preserve conditional numbering: one link is unnumbered; multiple links have matching numbers. Do not generate codes for hidden notes.

Implementation: optional per-note codePin settings store QR format and full-text/null or the exact normalized link destination. Pin, unpin, selected payload and explicit closure persist transactionally without saving editor drafts. Reload/import restores only visible pinned notes; duplicates remain unpinned. Removing a selected link during a saved edit chooses the first remaining link or full text and announces the fallback. Failed writes retain the prior state and draft. Generated code images remain runtime-only overlay content.

Validation: all 443 browser assertions and actual JSON download verification pass. Tests cover selected-link restoration, full-text selection without draft saving, backup restoration, hidden notes, fallback after editing, duplicate defaults, unpin versus close, malformed pin settings and simulated pin/close persistence failures. Note saves now preserve the unsaved editor draft on storage failure instead of adding an unsaved card to the session.
### Step 12 — Barcode support in the shared code overlay

**Status:** Complete (2026-11-13). **Priority:** P2. **Dependency:** Step 11.

Implementation: bundled JsBarcode 3.11.6 (MIT) generates Code 128 with automatic code-set selection and checksum. Supports printable ASCII U+0020–U+007E, up to 512 characters; rejects controls, Unicode and empty payloads without changing text. Bars use 2px modules, 80px height and 20px quiet zones. The shared overlay spans its parent block. If the encoded width cannot fit, show **Too wide. Reduce columns.** and a Use QR fallback. Changing Columns or resizing automatically retries and displays the barcode once it fits, without another click. Pinned format/payload survives reload and backup restoration. The combined action supports words and QR / barcode icons.

Validation: all **451 browser assertions** and actual downloaded JSON verification passed. Independent ZXing decoding checks numeric, mixed-case, punctuation/space and URL payloads from rendered pixels. Checks include narrow-width error and automatic recovery after reducing columns, format/payload persistence, unsupported inputs, copy accuracy and QR fallback. See [vendor provenance and limits](vendor/README.md). Physical scanner accuracy remains best effort.

Implement Code 128 using only free/open-source code or an original open-source implementation, bundled locally. No proprietary software, paid dependencies, license keys or hosted encoder services. Retain required open-source license notices; open source is licensed, not license-free. Add the encoder to the same overlay; no creation checkboxes and no inline barcode images. Use Code 128 and document the supported code sets, character/encoding limits, checksum, quiet zones and sizing rules. Apply a conservative functional-width/module-size limit based on the rendering space; if a payload is too long to produce a usable barcode, show an explicit too-long error and offer QR. Reject prohibited characters or unsupported encoding with a specific error; do not replace, truncate or silently transcode them. Accuracy is best effort supported by independent decoding tests, not an unverified scan guarantee. Ask for the intended scanner/identifier format if needed. Do not assume a barcode can represent every QR payload.

When barcode support is functional, rename the block action **Show QR/Barcode**, with **Hide QR/Barcode** while open. In icon mode, show a local QR symbol, a slash, and a distinct barcode symbol, with an accessible name and tooltip matching the word version. Until that support exists, retain the truthful Show QR/Hide QR label rather than offering a nonfunctional barcode action.

Proposed interaction: select QR or Barcode within the shared overlay; show one format at a time. Persist the selected format and payload with the pin, so either a pinned QR or a pinned barcode returns after reload. The pin and red X apply to the shared overlay. Keep the payload selector between those corner controls; integrate format selection compactly without adding clutter to the main block. A format switch retains the selected payload. Clicking the rendered QR/barcode, or activating it by keyboard, copies exactly the represented text/link, never its display label or priority tag. This extends barcode payload choices to the same full-text/link choices as QR.

Unsupported payloads show a clear error inside the overlay and offer switching to QR; never silently trim, uppercase, truncate, substitute text, or change the selected payload. Preserve the original note, copied text and custom arrangement. Cache generated content only while appropriate and invalidate after payload/format changes. No network encoder or CDN at runtime.

Acceptance: independently decode supported barcode payloads exactly; verify both formats' pin/reload/import behavior, selected link/full-text preservation, format switching, edits, invalid settings, unsupported Unicode/length, copy activation, combined word/icon labels, X/unpin semantics, and narrow layouts. Document encoder version/license, symbology and limits. Physical scanner validation remains separate from automated decoding.
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

Historical placement (superseded by Step 9 and revised Steps 11–12): rendered code images remain content above the bottom code-control row; opening a code must not move those controls into the middle of the block. Do not add a nonfunctional barcode control before Step 12. When barcode support arrives, use the same code-control row. Maintain equal spacing for whichever code controls exist. Preserve all current confirmation, filtering, editing, copy and Show/Hide behavior.

Acceptance: verify reduced header/title whitespace and adjacent control groups without horizontal overflow at 320px or overlap at 200% zoom. Inspect short/long text, titles, tags, multiple links, visible QR images and error messages at mobile and desktop widths. Top and bottom controls remain evenly distributed without overflow, clipped focus rings or title overlap. Keyboard tab order follows the visual order; control clicks never trigger the card's copy handler. Existing disabled movement rules, including editing rules if Step 13 is present, remain effective. Test with the words/icons preference if Step 15 is already implemented.

Implementation: the smaller header wraps its toolbar, title/tags share a desktop row, and note color/save controls sit alongside one another when space permits. Narrow layouts stack in DOM order. Each card starts with equal-width Copy/Edit/Delete buttons and ends with a bottom-aligned footer containing QR controls and the temporary movement row. QR images and errors remain above that footer; titles remain fully readable.

Validation: all 259 browser assertions and actual downloaded JSON verification passed. New checks cover desktop adjacency, equal action widths, unequal-height card footer alignment, visible QR/error placement, native Tab order, 320px wrapping and 200% CSS zoom. Physical-device visual review and browser-level zoom remain manual release checks.

### Step 15 — Toggle block actions between words and icons

**Status:** Complete (2026-11-11). **Priority:** P2. **Dependency:** Step 14.

Editing controls refinement: remove the separate Editing badge/save button. On the block being edited, replace Edit with Save and Delete with Cancel in the existing top row; keep Copy available. Save uses the current editor validation/save path and Cancel discards the draft through the existing cancel path. Preserve the dotted outline and accessible editing state without a separate visible Editing label. Delete and Cancel always use visible red foreground text (and red icons in icon mode) on a contrast-safe control surface, independent of the note color. Apply this rule to other Delete/Cancel controls, including backup cancellation. This supersedes Step 13's badge and the Editing-control wording below. Test invalid Save, Cancel restoration, focus, disabled reordering and contrast in both modes.

Scope: add a clearly labeled button at the top of the page that toggles block action controls between words and icons. Default to words and persist the preference in its own local-storage setting. Apply it to Copy, Edit, Delete, the Editing/Save control and Show/Hide QR/barcode when available. The Editing control becomes a Save icon in icon mode, retaining its save handler, validation, accessible Save changes name and tooltip. Do not restore Move up/down controls removed by Step 16; its drag handle keeps a consistent recognizable appearance and accessible name in both modes. The toggle itself retains a readable text label describing the available switch, such as **Use icons** / **Use words**; do not turn it into an unexplained icon.

Use small local SVG icons with no network dependency. Keep native button semantics and meaningful accessible names in both modes; SVG decoration is hidden from assistive technology. Provide descriptive hover/focus tooltips for icon-only controls. Keep disabled states, destructive-action distinctions, pressed/expanded state and Show-versus-Hide meaning clear. The preference changes presentation only, never action behavior, note data, copied text, code payloads or backup format.

Acceptance: toggling updates existing blocks immediately, newly added/imported blocks use the selected mode, and the preference survives reload independently of note content. Switching during editing, filtering or QR display preserves those states and focus. Test mouse and keyboard activation, accessible names, tooltips, disabled movement, Show/Hide transitions, narrow layouts and unavailable storage. Step 12 must extend this presentation to barcode controls when they become available.

Implementation: the header's Use icons / Use words button updates existing action buttons in place and stores the separate actionIconMode preference. Local SVGs have accessible action names and hover/focus tooltips. The edited card keeps its outline and accessible editing state, with Copy/Save/Cancel in the top row and no Editing badge. Filter exceptions retain a concise explanatory label. Delete/Cancel controls use red foregrounds on white surfaces in either mode; the Reorder handle retains its label. QR Show/Hide names, icons and expanded state update together. Drafts, filters, focus, visible QR canvases and note data survive presentation changes.

Validation: all 321 browser assertions plus actual downloaded JSON verification passed. Checks include word/icon Save validation, Cancel preserving the note, native Enter/Space activation, red-on-white controls, descriptive SVG buttons, Show/Hide QR decoding/state, draft/filter/focus preservation, reload/new/imported note presentation, 320px fit and simulated preference-write failure. Physical screen-reader and tooltip appearance review remain manual release checks.

### Step 16 — Drag-and-drop with a dotted destination placeholder

**Status:** Complete (2026-11-11). **Priority:** P1. Supersedes the Move up/down button layout previously requested in Step 14.

Scope: replace Move up / Move down buttons with drag-and-drop reordering and a clear drag handle on each block. While moving a block, insert an empty dotted-outline placeholder at the exact grid position where it will land on release. Size the placeholder to the dragged block, keep a distinct dragged-block preview, and update the insertion target as the pointer crosses neighboring cards. The placeholder must occupy layout space rather than merely decorating the hovered card. Distinguish its static empty dotted outline from Step 13's animated outline on the populated edited block.

Use insertion positions, not swaps, with consistent before/after behavior in one-, two- and three-column layouts. Support the first and last positions, unequal card heights, responsive row wrapping and scrolling near viewport edges. Save the new order only after a successful drop; cancel, Escape, pointer cancellation, releasing outside a valid destination or dropping in the original position must preserve the prior order and remove all previews/placeholders. Never persist placeholder state or duplicate the dragged block in storage/export. Freeze reordering while filtered or editing, with an understandable disabled handle state.

Accessibility and touch: use a focusable drag handle with an accessible name and concise instructions. Space/Enter on the handle picks up a block; arrow keys move its prospective position with the same dotted placeholder; Space/Enter drops and Escape cancels. Announce pickup, destination and completion via a live region, and retain focus on the moved handle. Support touch dragging through the handle while preserving normal page scrolling elsewhere. Text selection, links, chips, action buttons and QR controls must not start a drag. A completed or cancelled drag must not trigger the block's copy handler.

Acceptance: exercise real pointer dragging plus keyboard and touch paths, including movement in both directions, across rows, to first/last positions, past unequal-height blocks and during edge scrolling. Verify the dotted placeholder predicts the final position exactly. Reload/export must reflect only committed drops; cancellations and invalid drops leave the saved order unchanged. Test filtered/editing restrictions, deleted/imported collections, interruption cleanup, native keyboard focus, 320px layouts, no accidental copying and preservation of tag/link/QR behavior. Remove the old Move up/down controls and their obsolete tests only once these replacement interactions are verified; document any physical-device checks that remain manual.

Implementation: a dedicated Reorder handle uses pointer capture for mouse/touch, with a fixed dragged-card preview and an empty dotted placeholder occupying the prospective grid slot. Keyboard Space/Enter picks up/drops, arrows move by slot/row, and Escape cancels. Edge scrolling follows the pointer. Only successful drops write the new insertion order; invalid drops, cancellation, resize, lost capture and storage failures restore the original order. Handles are disabled while filtered/editing, and normal card contents never start a drag. Focus and live announcements follow reordering. No placeholder state enters stored notes or backups.

Validation: all 302 browser assertions and actual JSON download verification pass. Native browser-protocol mouse, touch and keyboard input covers one/two/three columns, cross-row moves, first/last placement, unequal-height cards, edge scrolling, outside and same-position drops, Escape/touch cancellation, focus, no accidental copying, filtered/editing restrictions, import interruption, 320px fit, simulated storage failure and reload persistence. Physical-device touch feel and screen-reader announcements remain manual checks.

### Step 17 — Compact popular tags with live counts

Refinement completed 2026-11-13: the strip measures available width and fits as many chips as possible instead of fixed three/five limits. **Show all tags** expands every tag with counts; an active overflow tag stays visible. Removed the tag-search field and note-search interface (superseding Step 23); Ctrl+F/Cmd+F remains browser Find. Counts and fitting update live. The following original implementation notes are historical where they describe fixed limits/search.

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

### Step 20 — Dismiss backups by clicking outside

**Status:** Complete (2026-11-12). **Priority:** P1. **Dependency:** Step 19.

Clicking the Backups backdrop closes the dialog, discards only the pending import preview, and returns focus to Backups. Retain notes, tags, filters and editor drafts. Require both pointer press and release outside the panel so dragging from inside does not dismiss it. Inside clicks, including empty panel space, must not close it. Preserve Close/Escape behavior and ignore late file reads after dismissal. Step 9 applies matching behavior to QR overlays.

Implementation: Backups tracks the primary pointer's press and release against the actual dialog bounds. A click or tap dismisses only when both occur outside; inside whitespace, cross-boundary drags and cancelled gestures leave it open. Dismissal consumes the click, invalidates pending file reads immediately, clears the import preview and restores focus to Backups without changing notes or editor state. Close and Escape retain their existing behavior.

Validation: all 330 browser assertions and actual downloaded JSON verification passed. Native mouse/touch checks cover inside whitespace, both cross-boundary drag directions, outside dismissal, touch cancellation, focus return, saved-note/draft/filter preservation and 320px layout. A controlled delayed file read verifies that closing and reopening cannot restore a stale preview. Physical-device touch testing remains a manual release check.

### Step 21 — Foreground surface color preference

Refinement completed 2026-11-13: compact presets **Classic**, **coffeeblocks**, **Midnight** and **Sage** set page, interface surfaces and the current note draft color with automatic contrast. Existing saved notes retain their colors; page/surface preferences persist. Covered by the 451-assertion regression run.

**Status:** Complete (2026-11-12). **Priority:** P2. **Dependency:** Step 10.

Add a synchronized color picker/HEX preference for foreground interface surfaces: header, editor and saved-notes container backgrounds. Keep existing per-note colors and page background independently configurable. Default to current white surfaces and persist in a separate preference key; do not change note backup data. Reuse automatic foreground contrast selection for text on those surfaces; explicitly style labels, links, borders, inputs and focus rings so inherited colors remain readable. Preserve red Delete/Cancel controls on readable button surfaces. Test dark/light colors, invalid HEX, reload and unavailable storage. Keep preferences grouped compactly rather than exposing another large permanent panel.

Implementation: a collapsed Colors disclosure groups page background and Interface surfaces picker/HEX controls. Surface color uses its own surfaceColor preference; the header, editor and saved-note containers inherit automatic black/white text. Inputs, error messages, focus rings and destructive controls retain readable surfaces. Per-note colors, page background and backup data remain independent. The popup clamps to its containing width on narrow screens.

Validation: all 414 browser assertions and actual downloaded JSON verification passed. Checks cover dark/light foreground contrast, helper labels, independent note/background data, invalid HEX, picker synchronization, reload, collapsed defaults, 320px expanded-panel geometry and simulated storage failure. Physical screen-reader and browser zoom checks remain manual.
### Step 22 — Brief in-block copy confirmation

**Status:** Complete (2026-11-12). **Priority:** P1.

After successful card-click or Copy-button copying, show “Copied!” as a non-interactive overlay centered inside that block for about 1.5 seconds. No layout shift; reset the timer for repeated copies and clear it on deletion/rerender. Keep an accessible live announcement. Clipboard failure must show an error, never a success overlay. Test concurrent copies on different blocks, repeated clicks, clipboard rejection, edited/filtered blocks and interaction with QR overlays. The overlay must not intercept clicks or initiate dragging.

Implementation: successful card or Copy-button actions show a centered, non-interactive Copied! overlay for 1.5 seconds alongside the existing accessible status announcement. Each card has its own resettable timer; rerenders clear feedback, and detached cards or superseded copy requests cannot display late success. Failed copies clear previous success feedback and retain the existing error message. Copied payloads and saved note data are unchanged.

Validation: all 339 browser assertions and actual downloaded JSON verification passed. Focused checks cover exact copied body, centered placement without layout shift, pointer-transparent feedback, independent/restarted timers, expiry, simulated clipboard rejection, filtered/editing cards with QR content, rerender cleanup and late clipboard completion after deletion. OS clipboard permissions remain a manual release check.

### Step 23 — Compact note search with Ctrl+F

**Status:** Superseded (2026-11-13), previously complete (2026-11-12). **Priority:** P1. **Dependency:** Step 17.

Removed at user request along with tag search. Tag chips provide filtering and Ctrl+F/Cmd+F uses native browser Find. The implementation and validation below describe historical behavior.

Provide an accessible compact search control that filters saved notes live by title, body and separate tags, case-insensitively. Ctrl+F (Cmd+F on macOS) opens/focuses this app search while the page is active; prevent the browser default only when the control can be opened. Escape clears/closes search and restores focus. Do not intercept shortcuts in an open modal. Combine search with the selected tag using AND, show result counts/empty state, and keep active edits visible as labeled exceptions. Disable reordering while search restricts the collection. Search is presentation state only: export still includes all notes. Test Unicode, clearing, keyboard access, filtered editing and no hidden-note loss. Offer a discoverable way to use browser Find if needed.

Implementation: the compact Search button reveals a labeled search field. Ctrl+F/Cmd+F opens and focuses it; repeating that shortcut in the field passes through to browser Find, with visible instructions. Live case-insensitive substring matching covers titles, bodies and separate tags and combines with the tag filter using AND. Counts and empty-state guidance update, active edits remain visible as exceptions, and search disables reordering. Escape/Close clears search and restores focus without changing drafts or tag selection. Modal shortcuts remain untouched; exports retain the full saved collection.

Validation: all 369 browser assertions and actual JSON download verification passed. New checks cover native Ctrl+F, simulated Cmd+F/browser-Find pass-through, Unicode, title/body/tag matching, AND filtering, typing focus, counts, editing exceptions/draft preservation, full export, empty results, clearing/reorder recovery, modal exclusions and 320px fit. Browser Find UI and physical macOS keyboard testing remain manual checks.
### Step 24 — Live density slider

**Status:** Complete (2026-11-12). **Priority:** P2. **Dependency:** Step 16.

Replace the waffle layout menu with a compact accessible range slider for columns, from 1 to a responsive maximum X determined by available width and a usable minimum card width. Changing columns adjusts row density live; retain the preferred value but clamp the effective columns on narrow screens. Migrate existing preferredColumns values, with no backup changes. Label the current effective column count, support keyboard arrows/Home/End, and use a single column at 320px. Cancel an active reorder before changing grid geometry. Test resizing, restored preferences, long content, QR overlays, enlarged rendering and reduced motion.

Implementation: a labeled native Columns range slider replaces the waffle menu and updates the grid on input. Its maximum derives from actual grid width, gaps and a 280px minimum card width; narrow layouts use one column. The saved-note section can expand across wide screens. The existing preferredColumns key retains the chosen value across temporary viewport clamping, with legacy values restored unchanged. A ResizeObserver updates limits without rerendering notes or QR views; geometry changes cancel active reordering. Native arrow/Home/End keys and the visible/accessible effective count work without animation.

Validation: all 390 browser assertions plus actual downloaded JSON verification passed. Coverage includes wide maximum above three, narrow clamping and restoration without overwriting preference, reload/legacy values, native Home/End/arrows, pinned QR preservation, drag cancellation without writes, long content and 200% CSS zoom. Existing reduced-motion checks remain passing; physical browser zoom remains a manual release check.
### Step 25 — Prioritize by P0–P99 tags

Refinement completed 2026-11-13: an **Other notes** separator spans the grid between visible priority notes and unranked notes. It appears only in Priority view when both groups are visible, respects tag filters and leaves saved custom order unchanged. Covered by the 451-assertion regression run. Search references below are historical; Step 23 has been removed.

**Status:** Complete (2026-11-12). **Priority:** P2. **Dependencies:** Steps 7, 16.

Use a compact top-right Priority toggle above the saved blocks. Custom arrangement is the default, including after reload. Priority mode changes only the displayed order, sorting separate metadata tags P0 through P99 numerically and case-insensitively; P0 is highest. Use the lowest number when several priority tags exist. Keep ties and unranked notes stable relative to custom order, with unranked notes last. Ignore malformed tags and body/title mentions. Keep tag/search filters functional in both views and restore custom relative order when toggled off. Preserve the established active-edit exception behavior.

The toggle follows Use icons / Use words with an accessible icon alternative and pressed state. Disable drag reordering only while priority view is active (in addition to existing edit/filter restrictions). Exports and storage retain custom order; no saved sort or Undo action is needed. Changing priority tags updates the derived view. This supersedes the earlier plan to persist a sorted collection or disable priority while filtering.
Implementation: the top-right Priority button sorts a temporary render sequence by each note's lowest valid priority tag, with saved array indices breaking ties. Toggling off restores custom order without any storage write. Priority state is session-only and defaults off. Filters/search and active-edit handling remain available; drag handles explain that Priority must be switched off to arrange notes. The button uses the shared SVG presentation and accessible pressed state.

Validation: all 401 browser assertions plus actual downloaded JSON verification passed. Checks cover numeric P0/P1/P9/P10/P99 ordering, multiple tags, stable ties, invalid/body-only priorities, combined search/tag filtering, filtered custom-order restoration, unchanged stored/export order, disabled dragging, icon presentation, native Space/focus, edited priorities and custom view after reload.


### Step 26 — Stationary editing and duplicate action

**Status:** Complete (2026-11-12). **Priority:** P1. Supersedes Step 13's temporary promotion and refines Steps 15/22.

Keep an edited note in its existing displayed position, retaining the dotted border. Preserve its position when it becomes a filter exception, and keep scroll stable through Edit/Save/Cancel. Remove visible Copied! feedback from the editor/status section; retain the brief in-block overlay and a separate visually hidden live announcement. Clipboard errors remain visible.

While editing, replace Copy with Duplicate (Dupe only if needed for space) and use a distinct duplicate-with-plus SVG icon in icon mode. Duplicate validates and creates a separate note from the current draft, inserted after the source in custom order, without overwriting the source. Keep the original edit/draft active and report success; failed validation or persistence must create nothing. Sorting/filtering remains derived from saved records. QR clicking continues to copy its represented payload. Test draft independence, saved order, filters/priority view, scroll, duplicate clicks, storage failure, and accessible word/icon controls.

Implementation: editing no longer promotes the note in the render sequence; the dotted outline and filter-exception label remain. During editing, Duplicate replaces Copy with a distinct plus/duplicate icon. It validates the current draft, writes the proposed collection before updating the session, inserts after the source in custom order, and preserves the original edit and draft. Copy success uses only the in-block overlay and a separate visually hidden live region; errors remain visible. Save/Cancel and duplication preserve scroll.

Validation: all 425 browser assertions plus actual downloaded JSON verification passed. Checks cover stationary display/filter exceptions, empty/invalid drafts, simulated duplicate storage failure, custom insertion order, unchanged original, independent later edits, retained focus/draft, filtered priority view, distinct icon/native Enter, hidden success announcement and existing scroll/QR behavior.
### Step 27 — Collapsible Connect Four beside the editor

**Status:** Stage 27A complete (2026-11-13); Stages 27B–C not started. **Priority:** P2. Selected by the user; inline panel supersedes the original subpage proposal.

Stage 27A: a header Connect Four button reveals a panel to the right of the submission box, reserving side space only while visible. Below 850px it stacks beneath the editor. Collapse preserves the board and pauses a pending CPU turn; reopening resumes it. Reload restores the saved round but keeps the panel collapsed. New game uses the shared words/icons preference and restarts with the selected difficulty. Changing difficulty during a round applies to the next game without resetting the current board.

Implementation: original local `connect-four.js` provides standard 7×6 gravity rules, four-direction wins, full-board draws and highlighted winning pieces. Column buttons support mouse/touch, native Enter/Space and arrow/Home/End navigation; symbols distinguish players without relying on color. Human plays first. Easy/Medium/Hard use progressively deeper, time-bounded CPU search with immediate win/block detection, in a Blob worker compatible with local files. A short bounded easy-search fallback handles unavailable workers. Restart/collapse cancels stale work. Hard is a heuristic opponent, not a perfect-play solver.

Moves, active difficulty and per-difficulty wins/losses/draws persist under a separate game key. Saved moves are replay-validated; invalid data recovers to a new game, storage failures are visible, finished games do not increment scores on reload. Scores/history are in a collapsed disclosure; resetting scores requires confirmation. Note drafts, saved notes and backup format remain independent. No external dependencies, video or wake-lock behavior added.

Future keep-awake integration is postponed with Step 28. If explicitly resumed, reuse its mechanism during play through an explicit toggle; verify actual idle behavior rather than relying on game animation. Gameplay and scoring work independently.

Validation: all **490 browser assertions** and actual downloaded JSON verification passed. Added direction/edge/gravity/draw fixtures, CPU immediate win/block checks at all levels, live CPU victory, worker fallback, desktop and 320px placement, collapse/resume, restart cancellation, score reset/cancellation, replay persistence, invalid storage, storage failure, icon mode, keyboard navigation and note/draft isolation. Physical touchscreen and screen-reader usability remain manual checks.

Stage 27B adds the requested “checkered columns disappear” variant. Before implementing it, clarify whether this means alternating columns, a checker-pattern of pieces, or periodic removal; define timing, gravity after removal, simultaneous wins and repetition/draw rules. Show the active rules and upcoming removal clearly. Keep statistics separate from standard play.

Stage 27C adds position analysis for the selected ruleset: distinguish proven win/loss/draw and exact moves-to-result from heuristic estimates, search-depth bounds, remaining empty cells and unknown results. Only claim perfect-play outcome/remaining turns when exhaustive search or a verified ruleset-specific solver proves it. Account for cycles/removal mechanics; a time-limited CPU estimate is not proof. Never label remaining empty cells as guaranteed turns remaining.

Optional variety proposal: a seeded “shifting board” mode announces a randomly selected column removal one turn ahead, with deterministic replay of the seed. This changes the planning problem and adds uncertainty; do not claim it makes the game mathematically unsolvable. Prototype and compare fairness, pacing and CPU handling before adopting it. Confirm whether the user wants randomness or a fully deterministic variant. Validate rules with hand-checked positions and independent win-detection tests before expanding AI strength.

### Step 28 — Keep awake toggle

**Status:** Postponed (2026-11-13), at user request. **Priority:** P2. Do not implement until explicitly resumed; retain the scope below for later.

Add one compact Keep awake toggle with word/icon presentation and a clear active state. Default off; start only on explicit activation, stop on toggle-off/page exit, and never change note or backup data. User request: an embedded video that is automatically muted and loops. Use a tiny bundled, original or freely licensed local video with `muted`, `loop` and `playsinline`; handle rejected playback without disrupting the app. No external video service, runtime download or proprietary dependency.

Recommended implementation: request the native Screen Wake Lock API when available, with the requested looping video as a best-effort fallback. Distinguish an acquired wake lock from fallback video playback; never claim that playback guarantees the device stays awake. Feature-detect support and context restrictions, handle rejection/release, and reacquire when the page becomes visible only if the user still has Keep awake enabled. Stop fallback playback when unnecessary or disabled. Keep status concise and expose unsupported/blocked states accessibly. This feature targets keeping the visible screen awake, not bypassing OS policy or guaranteeing background execution.

Acceptance: test on/off, acquired/released/rejected locks, visibility changes, playback rejection, no audio, looping, resource cleanup, keyboard access, word/icon state, offline use and unchanged notes. Physically verify idle-screen behavior in the intended regular and integrated browsers before claiming fallback effectiveness. References: [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) and [muted autoplay behavior](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

Review order: review completed Stage 27A; select the optional game variants/analysis only when wanted. Step 28 is postponed and Steps 4–6 are discontinued. When resumed, Connect Four may expose the same Keep awake toggle and reuse its implementation; an effective game-integrated solution is acceptable instead of a separate video-only experience. Game animation or CPU activity alone must not be treated as proof that sleep is prevented. Keep the capability usable without starting a game, and release it on game exit when the game owns the request. Test shared ownership so leaving the game does not release a separately enabled note-page wake lock.

## Verification

Reorder refinement (2026-11-13): Step 16 now restores the scroll position captured at release after rebuilding/restoring the grid and returning focus. Intentional edge scrolling during a drag is retained. Regression coverage includes native scrolled drops, failed persistence and same-position release. All **454 browser assertions** and actual downloaded JSON verification passed.

Latest refinements (2026-11-12): active Priority uses animated gold lettering or a filled star, with a static gold appearance under reduced-motion preferences. Both block and editor Cancel actions preserve page scroll and return keyboard focus to the note's Edit control without scrolling (or Add when the note is filtered out). All 406 browser assertions and downloaded JSON verification pass, including top/scrolled cancellation and reduced-motion checks.

Prerequisites: Windows PowerShell 5.1+ and installed Google Chrome or Microsoft Edge. No Node, Python, packages or app build are required. From the repository root, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\run-browser-tests.ps1
```

The execution-policy option applies only to that process. The runner auto-detects standard Chrome/Edge locations; pass `-BrowserPath "C:\path\to\chrome.exe"` for another installation. A temporary profile isolates the tests from your normal browser data. The runner uses a local debugging connection for this test browser only, verifies the real JSON download, closes the browser and removes its temporary files. Browser startup/test completion and debugging requests have timeouts. Exit code 0 means success; assertions, incomplete tests, missing downloads or mismatched export contents return 1.

To verify failure reporting, append `-ForceFailure`; this deliberately fails the final assertion and must return exit code 1.

`tests/browser.html` loads the dependency-free `tests/browser.js` harness. **Use the runner rather than opening the harness in your normal profile:** the harness clears CopyBlocks storage for its origin. Open `index.html` for ordinary integrated-browser preview.

Automated coverage: controls, exact Unicode/whitespace persistence, editing, filtering, ordering, real reloads, plain-text rendering, legacy/invalid imports, deletion, clearing, actual downloaded JSON including filtered-out blocks, corrupt JSON recovery, and long-string layout at 320px/1200px. Clipboard success/rejection and fallback outcomes, storage quota failures and drag events are explicitly simulated; these check application behavior rather than OS/browser permissions or physical input.

Manual release checks: native permission prompts and OS clipboard contents, pointer-driven drag-and-drop, actual browser storage restrictions/quota exhaustion, and visual usability on mobile devices. Automated layout assertions check overflow, not full visual appearance.
