# CopyBlocks

A simple, local-first clipboard for reusable text. No build, account, or internet connection required.

## Use

Open `index.html` in your browser, or right-click it in your editor and choose **Open in Integrated Browser**. Refresh after saving changes.

- Create, copy, edit, color, and arrange notes.
- Adjust the **Columns** slider for live density. Its range adapts to your screen and remembers your preferred setting.
- Choose **Use icons / Use words** for block actions. While editing, the block's Edit/Delete controls become Save/Cancel.
- Use a note's Reorder handle to drag it into the dotted slot, or press Space, use arrow keys, and press Space again. Escape cancels.
- Add separate tags and click chips to filter notes.
- Toggle **Priority** at the top right of saved notes to view P0–P99 tags in priority order. Turn it off to restore your custom arrangement; filters work in either view.
- Use **Search** or **Ctrl+F / Cmd+F** to find notes by title, text or tags. Escape clears search; repeat the shortcut in the search field for browser Find.
- Detect links and generate QR codes locally.
- QR opens on the first link when available. Click the code to copy its contents; pin it open or close it with the red X.
- Click a note's HEX label to reuse its color.
- Use **Backups** to export all saved notes or preview and restore a JSON backup.

Notes and preferences live in this browser's local storage. Export a backup before clearing browser data or switching browsers. Unsaved drafts are excluded from backups.

## Development

See [ROADMAP.md](ROADMAP.md) for planned features and completed work. To start a step, ask **"Begin work on Step X in ROADMAP.md"**.

Run tests in an isolated Chrome/Edge profile on Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\run-browser-tests.ps1
```

Do not open `tests/browser.html` in your normal browser profile: it clears app data for its origin. See the [verification details](ROADMAP.md#verification).

[Request a feature or report a bug](https://github.com/ajklicker33/copyblocks/issues).
