'use strict';

// JsBarcode 3.11.6 (MIT), Code 128 automatic A/B/C selection.
window.CopyBlocksBarcode = {
    createCanvas(value, title, availableWidth) {
        if (!value.length) throw new Error('Code 128 needs a nonempty payload. Choose QR or edit the text.');
        if (/[^\x20-\x7E]/.test(value)) throw new Error('Code 128 supports printable ASCII only here (U+0020–U+007E). Control characters, line breaks and Unicode are unsupported. Choose QR; the original text is unchanged.');
        if (value.length > 512) throw new Error('Too long for a usable Code 128 barcode. Shorten the payload or choose QR.');
        if (!window.JsBarcode) throw new Error('The local barcode encoder could not load. Refresh or choose QR.');
        const options = { format: 'CODE128', width: 2, height: 80, margin: 20, displayValue: false, background: '#fff', lineColor: '#000' };
        const encoded = {};
        window.JsBarcode(encoded, value, options);
        const modules = encoded.encodings.reduce((sum, encoding) => sum + encoding.data.length, 0);
        const required = modules * 2 + 40;
        if (required > availableWidth) throw new Error('Too wide. Reduce columns.');
        const canvas = document.createElement('canvas');
        window.JsBarcode(canvas, value, options);
        canvas.className = 'barcode-code'; canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `Code 128 for ${title}. Encodes the selected payload exactly.`);
        return canvas;
    }
};
