# CopyBlocks

I need to revamp it. Why are the edit boxes not in the blocks??

A simple, local-first clipboard for reusable text. No build, account, or internet connection required.

## Use

Open `index.html` in your browser, or right-click it in your editor and choose **Open in Integrated Browser**. Refresh after saving changes.

- Create, copy, edit, color, and arrange notes.
- Open **Colors** to adjust page and interface colors or choose a preset, including **coffeeblocks**. Text contrast adjusts automatically; presets also set the next note's color.
- Adjust the **Columns** slider for live density. Its range adapts to your screen and remembers your preferred setting.
- Choose **Use icons / Use words** for block actions. While editing, the block's Edit/Delete controls become Save/Cancel.
- Edited notes stay in place. **Duplicate** creates a separate note from the current draft while keeping the original edit open.
- Use a note's Reorder handle to drag it into the dotted slot, or press Space, use arrow keys, and press Space again. Escape cancels.
- Add separate tags and click chips to filter notes. The strip fits available width; **Show all tags** reveals every tag.
- Toggle **Priority** at the top right of saved notes to view P0–P99 tags in priority order. Turn it off to restore your custom arrangement; filters work in either view.
- Use the browser's normal **Ctrl+F / Cmd+F** to find text.
- Detect links and generate QR or Code 128 barcodes locally with **Show QR/Barcode**.
- QR opens on the first link when available. Click the code to copy its contents; pin it open or close it with the red X.
- Pinned overlays retain their format and content after reload. Unpin leaves the overlay open temporarily; the red X closes it and clears the saved pin.
- Code overlays match their block's width. If a barcode says **Too wide. Reduce columns.**, reduce the Columns slider; it appears automatically when it fits. Unsupported text can use QR instead.
- Click a note's HEX label to reuse its color.
- Use **Backups** to export all saved notes or preview and restore a JSON backup.
- Open **Connect Four** to play against the CPU beside the note editor (below it on small screens). Collapse preserves the game; **New game / ↻** restarts with the selected difficulty. Scores and moves survive reload independently of notes and are excluded from note backups.

Notes and preferences live in this browser's local storage. Export a backup before clearing browser data or switching browsers. Unsaved drafts are excluded from backups.

## Development

See [ROADMAP.md](ROADMAP.md) for planned features and completed work. To start a step, ask **"Begin work on Step X in ROADMAP.md"**.

Run tests in an isolated Chrome/Edge profile on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\run-browser-tests.ps1
```

Do not open `tests/browser.html` in your normal browser profile: it clears app data for its origin. See the [verification details](ROADMAP.md#verification).

[Request a feature or report a bug](https://github.com/ajklicker33/copyblocks/issues).
