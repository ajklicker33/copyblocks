'use strict';

// Local-only adapter: fixed UTF-8 byte mode + ECI 26 keeps scanner interpretation explicit.
window.CopyBlocksQR = {
    maxBytes: 2330,
    createCanvas(text, title) {
        const bytes = new TextEncoder().encode(text);
        if (new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) !== text) {
            throw new Error('This text contains an invalid Unicode character. Edit it before generating a QR code.');
        }
        if (bytes.length > this.maxBytes) {
            throw new Error('Text is too long for one QR code (maximum 2,330 UTF-8 bytes). Shorten or split the block; copying still works.');
        }
        if (!window.qrcodegen) throw new Error('The local QR encoder could not load. Refresh and try again.');
        const { QrCode, QrSegment } = window.qrcodegen;
        const qr = QrCode.encodeSegments([
            QrSegment.makeEci(26), QrSegment.makeBytes(bytes)
        ], QrCode.Ecc.MEDIUM, 1, 40, -1, false);
        const scale = 4;
        const border = 4;
        const canvas = document.createElement('canvas');
        canvas.className = 'qr-code';
        canvas.width = canvas.height = (qr.size + border * 2) * scale;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `QR code for ${title}. Encodes the exact block text.`);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('This browser cannot draw a QR code. Copying still works.');
        context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#000';
        for (let y = 0; y < qr.size; y++) {
            for (let x = 0; x < qr.size; x++) {
                if (qr.getModule(x, y)) context.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
            }
        }
        return canvas;
    }
};
