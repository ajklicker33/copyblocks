# CopyBlocks

A simple, local-first clipboard for reusable text. No build, account, or internet connection required.

## Use

Open `index.html` in your browser, or right-click it in your editor and choose **Open in Integrated Browser**. Refresh after saving changes.

- Create, copy, edit, color, and arrange notes.
- Add separate tags and click chips to filter notes.
- Detect links and generate QR codes locally.
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
