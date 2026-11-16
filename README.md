# CopyBlocks

A simple, local-first clipboard for reusable text. No build, account, or internet connection required.

## Use

Open `index.html` in your browser, or right-click it in your editor and choose **Open in Integrated Browser**. Refresh after saving changes.

- Choose **New block** in the blocks toolbar to open a draft card. Add saves it; Cancel new block discards it.
- Press a block's **Edit** button to edit inside that card. Title, body text, and tags have separate text boxes. **Save text** saves all three together and closes editing; Cancel discards their unsaved changes. Switching away from an unsaved draft offers Save, Discard, or Keep editing.
- Open **Colors** to adjust page and interface colors or choose a preset, including **coffeeblocks**. Text contrast adjusts automatically; presets also set the next note's color.
- Adjust the **Columns** slider for live density. Its range adapts to your screen and remembers your preferred setting.
- Select **Color** inside the block editor to change color separately. Picking a color or entering a valid HEX value saves immediately; **Done** closes the color editor. Invalid colors and failed saves leave the saved note unchanged. Choose **Use icons / Use words** for block actions.
- In a block's **Color** tab, choose **Solid**, **Smooth gradient**, **Dithered**, or **Halftone dots** (the windshield-style dot fade). Gradients support two to four colors, arranged left to right; Add color and Remove adjust the palette. Changes save immediately for existing blocks. New-block colors save when you press Add. Patterned blocks keep text on an opaque surface for readability.
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
- Open **Connect Four** to play against the CPU in its utility panel above the blocks. Collapse preserves the game; **New game / ↻** restarts with the selected difficulty. Scores and moves survive reload independently of notes and are excluded from note backups.

Notes and preferences live in this browser's local storage. Export a backup before clearing browser data or switching browsers. Unsaved drafts are excluded from backups.

Multi-color block fills are included in backups. Older single-color backups still import normally; older versions of CopyBlocks display a patterned block's first color as a solid fallback.

## Development

See [ROADMAP.md](ROADMAP.md) for planned features and completed work. To start a step, ask **"Begin work on Step X in ROADMAP.md"**.

Run tests in an isolated Chrome/Edge profile on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\run-browser-tests.ps1
```

Do not open `tests/browser.html` in your normal browser profile: it clears app data for its origin. See the [verification details](ROADMAP.md#verification).

[Request a feature or report a bug](https://github.com/ajklicker33/copyblocks/issues).
