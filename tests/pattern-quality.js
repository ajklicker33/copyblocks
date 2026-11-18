'use strict';

async function testPatternQuality() {
    const fill = { style: 'dithered', direction: 'horizontal', colors: ['#000000', '#FFFFFF'] };
    const render = async (value, width, height) => {
        const background = w.BlockFills.background(value, width, height);
        const image = new w.Image(); image.src = background.slice(5, -2); await image.decode();
        const canvas = d.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        return { background, pixels: context.getImageData(0, 0, width, height).data };
    };
    const { background, pixels } = await render(fill, 256, 96);
    for (let band = 0; band < 8; band++) {
        let white = 0;
        for (let y = 0; y < 96; y++) for (let x = band * 32; x < (band + 1) * 32; x++) white += pixels[(y * 256 + x) * 4] / 255;
        check(Math.abs(white / (32 * 96) - (band + .5) / 8) < .025, `quality: dither band ${band + 1} preserves target color coverage`);
    }
    let different = 0, compared = 0;
    for (let y = 0; y < 88; y++) for (let x = 96; x < 160; x++) {
        different += pixels[(y * 256 + x) * 4] !== pixels[((y + 8) * 256 + x) * 4] ? 1 : 0; compared++;
    }
    check(different === 0 && compared > 0, 'quality: requested ordered dither screen restored');
    for (const direction of ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up']) {
        for (const colors of [['#000000', '#FFFFFF'], ['#102030', '#809060', '#F0E0D0']]) {
            const value = { ...fill, direction, colors };
            check(w.BlockFills.background(value, 281.5, 173.25) === Step32Fills.background(value, 281.5, 173.25), `quality: ${direction} ${colors.length}-color dither matches the Step 32 renderer exactly`);
        }
    }
    for (let i = 0; i < 26; i++) w.BlockFills.background(fill, 30 + i, 12);
    check(w.BlockFills.background(fill, 256, 96) === background, 'quality: dither regenerates deterministically after cache eviction');
    for (const direction of ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up']) {
        const dots = { ...fill, style: 'dots', direction, colors: ['#102030', '#809060', '#F0E0D0'] };
        const result = await render(dots, 280, 180);
        const source = decodeURIComponent(result.background.slice(5, -2).split(',')[1]);
        const svg = new w.DOMParser().parseFromString(source, 'image/svg+xml');
        const circles = [...svg.querySelectorAll('circle')];
        check(circles.length > 200 && circles.every(circle => Number(circle.getAttribute('r')) <= 3.4), `quality: ${direction} dots remain separated on the eight-pixel staggered lattice`);
        check(svg.querySelectorAll('linearGradient stop').length === 5 && result.pixels.every((value, index) => index % 4 !== 3 || value === 255), `quality: ${direction} multi-color halftone has a continuous opaque base`);
        const rows = new Map();
        circles.forEach(circle => { const y = circle.getAttribute('cy'); if (!rows.has(y)) rows.set(y, Number(circle.getAttribute('cx'))); });
        check(new Set([...rows.values()].map(x => ((x % 8) + 8) % 8)).size === 2, `quality: ${direction} halftone alternates row offsets`);
        check(w.BlockFills.background(dots, 280, 180) === result.background, `quality: ${direction} halftone is deterministic`);
    }
}
