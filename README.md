# CopyBlocks

Edit notes directly inside their blocks, with separate text and color controls.

A simple, local-first clipboard for reusable text. No build, account, or internet connection required.

## Use

Open `index.html` in your browser, or right-click it in your editor and choose **Open in Integrated Browser**. Refresh after saving changes.

- Choose **New block** in the blocks toolbar to open a draft card. Add saves it; Cancel new block discards it.
- The blocks toolbar groups filters, Columns, Priority, Use icons / Use words and Colors. **Collection actions → Clear All** retains its confirmation. The compact header's **Utilities** menu contains Backups and Connect Four.
- Press a block's **Edit** button to edit inside that card. Title, body text, and tags have separate text boxes. **Save text** accepts the session and closes editing. **Cancel editing** or **Escape** restores the text, tags and every color setting to when Edit opened—even colors already auto-saved. Switching between Text and Color keeps that original cancellation baseline. Leaving a changed session offers Save, Discard, or Keep editing.
- Open **Colors** to adjust page and interface colors or choose a preset, including **coffeeblocks**. Text contrast adjusts automatically; presets also set the next note's color.
- Adjust the **Columns** slider for live density. Its range adapts to your screen and remembers your preferred setting.
- Select **Color** inside the block editor to change color separately. Picking a color or entering a valid HEX value saves immediately; **Done** closes the color editor. Every color has an editable HEX field. Invalid colors and failed saves leave the saved note unchanged. Color rows stay compact; narrow editors hide visual labels while retaining accessible names and tooltips. The block itself shows the result, without a separate preview box. Choose **Use icons / Use words** for block actions.
- In a block's **Color** tab, choose **Solid**, **Smooth gradient**, **Dithered**, or **Halftone dots** (the windshield-style dot fade). Gradients support two to four colors. Choose **↔** left to right, **↕** top to bottom, **↘** top-left to bottom-right, or **↗** bottom-left to top-right; Add color and Remove adjust the palette. The flat **⇅** button between Color 1 and Color 2 swaps two colors or reverses the full palette when there are more; it saves immediately on existing blocks. Changes save immediately for existing blocks. New-block colors save when you press Add. Dithered uses the restored ordered pattern; Halftone dots uses staggered circles fading into solid color. Patterns render at each block's actual size so dots stay round and texture spacing stays consistent when columns, content, or window size change. Patterned blocks keep text on an opaque surface for readability.
- Edited notes stay in place. **Duplicate** creates a separate note using the current title, body, and tags draft while keeping the original edit open.
- Use a note's Reorder handle to drag it into the dotted slot, or press Space, use arrow keys, and press Space again. Escape cancels.
- Add separate tags and click chips to filter notes. The strip fits available width; **Show all tags** reveals every tag.
- Toggle **Priority** at the top right of saved notes to view P0–P99 tags in priority order. Turn it off to restore your custom arrangement; filters work in either view.
- Use the browser's normal **Ctrl+F / Cmd+F** to find text.
- Detect links and generate QR or Code 128 barcodes locally with **Show QR/Barcode**.
- QR opens on the first link when available. Click the code to copy its contents; pin it open or close it with the red X.
- Pinned overlays retain their format and content after reload. Unpin leaves the overlay open temporarily; the red X closes it and clears the saved pin.
- Code overlays match their block's width. If a barcode says **Too wide. Reduce columns.**, reduce the Columns slider; it appears automatically when it fits. Unsupported text can use QR instead.
- Click a note's HEX label to reuse its color. In the color editor it saves immediately; otherwise it sets the creation draft or next new block's color.
- Use **Backups** to export all saved notes or preview and restore a JSON backup.
- Open **Utilities → Connect Four** to play against the CPU above the blocks on every screen size. The closed panel takes no space. Collapse preserves the game; **New game / ↻** restarts with the selected difficulty. Scores and moves survive reload independently of notes and are excluded from note backups.

Notes and preferences live in this browser's local storage. Export a backup before clearing browser data or switching browsers. Unsaved drafts are excluded from backups.

Each block color has an **Opacity** slider and editable percentage (0–100%). Changes save immediately for existing blocks; new blocks remain drafts until Add. Transparency reveals the interface surface while text, tags, controls and codes remain opaque. Reverse colors, Duplicate and clicking a note's HEX label carry opacity with the color.

Color changes apply and save automatically while editing, but **Done** (or Save text) accepts the whole session. Closing a native picker alone does not accept it. Cancel restores the session's original colors; if restoration cannot save, the editor stays open so you can retry. This cancellation history lasts only until the session ends or the page reloads. Escape dismisses nested dialogs first; in the unsaved-changes dialog it cancels the edit and pending navigation. Page/interface Colors preferences are separate—Escape closes that disclosure without reverting preferences.

Opacity backups use optional `colorOpacity` for Solid and `fill.opacities` for multi-color stops, with numeric values from 0 to 1. Missing values mean fully opaque; a supplied stop array must match the color count. Malformed/out-of-range values and conflicting first-color alpha are rejected. Fully opaque metadata is omitted when saving. Older versions may ignore opacity and display opaque colors.

Multi-color block fills are included in backups. Older single-color backups still import normally; older versions of CopyBlocks display a patterned block's first color as a solid fallback.

## Development

See [ROADMAP.md](ROADMAP.md) for planned features and completed work. To start a step, ask **"Begin work on Step X in ROADMAP.md"**.

Run tests in an isolated Chrome/Edge profile on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\run-browser-tests.ps1
```

Do not open `tests/browser.html` in your normal browser profile: it clears app data for its origin. See the [verification details](ROADMAP.md#verification).

[Request a feature or report a bug](https://github.com/ajklicker33/copyblocks/issues).
