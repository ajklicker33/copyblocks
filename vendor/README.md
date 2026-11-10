# Bundled QR dependencies

These files are checked into the repository. The app and test runner do not fetch a CDN or transmit block text to a service.

## Production encoder

- Project: [Project Nayuki QR Code generator](https://www.nayuki.io/page/qr-code-generator-library).
- File: `vendor/qrcodegen.js`, unmodified compiled JavaScript from [the publisher's distribution](https://www.nayuki.io/res/qr-code-generator-library/qrcodegen.js).
- Version identifier: publisher snapshot retrieved 2026-11-09, SHA-256 `2511BC17F40A3C41D4A0578995DB956B38997334D3D20113A5D4DC5C49C69480`. The compiled distribution does not declare a semantic version; this digest pins the exact vendored version.
- License: MIT, including the original copyright and full license text in the file header. No additional runtime dependencies.
- Adapter: `qr-code.js` selects UTF-8 ECI 26, byte mode, medium error correction, versions 1–40 and a four-module white border. The tested application limit is 2,330 UTF-8 bytes. Generation does not change case, normalize Unicode or trim whitespace. Invalid Unicode surrogate input is rejected rather than silently substituted.

## Test-only decoder

- Project: [cozmo/jsQR](https://github.com/cozmo/jsQR), npm package `jsqr` **1.4.0**.
- File: `tests/vendor/jsQR.js`, unmodified from `https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js`.
- SHA-256: `BC40C8A15196236B2314DB0856F72CA0B49980CD5413B8C852A7349F5FEE0859`.
- License: Apache-2.0; preserved in `tests/vendor/jsQR-LICENSE.txt`. The published package metadata is retained in `tests/vendor/jsQR-package.json`.
- Loaded only by the regression harness, never by `index.html`. Tests decode pixels from the application's rendered canvas rather than reusing encoder internals.

When updating either dependency, retain its license, record the new source/version/hash, and rerun the independent decoding and byte-boundary tests. Physical phone/scanner behavior can vary, especially for dense codes displayed at small sizes; the automated checks decode the original canvas pixels.
