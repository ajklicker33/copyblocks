'use strict';

async function testFillSizing() {
    const beforeStorage = w.localStorage.getItem('textBlocks');
    const host = d.createElement('div'); d.body.append(host);
    const box = d.createElement('div'); host.append(box);
    box.style.cssText = 'width:320px;height:180px;box-sizing:border-box';
    const fill = { style: 'dots', direction: 'diagonal-down', colors: ['#000000', '#FFFFFF'] };
    const svg = element => decodeURIComponent(element.style.backgroundImage.slice(5, -2).split(',')[1] || '');
    const ready = (element, width, height) => svg(element).includes(`viewBox="0 0 ${width} ${height}"`);
    w.BlockFills.apply(box, fill);
    for (const [width, height] of [[320, 180], [180, 320], [240, 240], [281.5, 173.25]]) {
        box.style.width = width + 'px'; box.style.height = height + 'px';
        await until(() => ready(box, width, height), 'measured pattern resize');
        check(box.style.backgroundSize === 'auto' && !svg(box).includes('transform='), `sizing: ${width}x${height} uses unscaled geometry`);
        const image = new w.Image(); image.src = box.style.backgroundImage.slice(5, -2); await image.decode();
        for (const scale of [1, 2]) {
            const canvas = d.createElement('canvas'); canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, width * scale, height * scale);
            // Locate an isolated mid-sized dot on the staggered lattice.
            const document = new w.DOMParser().parseFromString(svg(box), 'image/svg+xml');
            const circles = [...document.querySelectorAll('circle')].filter(circle => Number(circle.getAttribute('r')) > 1.8 && Number(circle.getAttribute('r')) < 2.6);
            circles.sort((a, b) => Math.hypot(Number(a.getAttribute('cx')) - width * .45, Number(a.getAttribute('cy')) - height * .45) - Math.hypot(Number(b.getAttribute('cx')) - width * .45, Number(b.getAttribute('cy')) - height * .45));
            const sampleX = Math.floor(Number(circles[0].getAttribute('cx'))) - 4, sampleY = Math.floor(Number(circles[0].getAttribute('cy'))) - 4;
            const pixels = context.getImageData(sampleX * scale, sampleY * scale, 8 * scale, 8 * scale).data;
            let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
            for (let y = 0; y < 8 * scale; y++) for (let x = 0; x < 8 * scale; x++) {
                if (pixels[(y * 8 * scale + x) * 4] < 128) continue;
                minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            }
            check(maxX >= 0 && Math.abs((maxX - minX) - (maxY - minY)) <= 2, `sizing: round dot at ${width}x${height}, raster scale ${scale} (${minX},${maxX}; ${minY},${maxY})`);
        }
    }
    const unchanged = box.style.backgroundImage;
    w.BlockFills.apply(box, fill); await new Promise(resolve => w.requestAnimationFrame(resolve));
    check(box.style.backgroundImage === unchanged, 'sizing: unchanged fill and size reuse output');
    box.style.zoom = '2'; await new Promise(resolve => setTimeout(resolve, 40));
    check(box.style.backgroundImage === unchanged, 'sizing: CSS zoom keeps vector CSS-pixel geometry');
    box.style.zoom = '';
    const preview = d.createElement('div'); preview.style.cssText = 'width:180px;height:48px'; host.append(preview);
    w.BlockFills.apply(preview, fill); await until(() => ready(preview, 180, 48), 'preview dimensions');
    check(preview.style.backgroundImage !== box.style.backgroundImage, 'sizing: preview gets its own measured render');
    const start = performance.now(), cards = [];
    for (let i = 0; i < 60; i++) {
        const card = d.createElement('div'); card.style.cssText = `width:${180 + i}px;height:96px`;
        host.append(card); w.BlockFills.apply(card, { ...fill, style: i % 2 ? 'dots' : 'dithered' }); cards.push(card);
    }
    await until(() => cards.every((card, i) => ready(card, 180 + i, 96)), 'large collection rendering');
    for (let round = 0; round < 3; round++) {
        cards.forEach((card, i) => { card.style.width = (200 + i + round) + 'px'; });
        await until(() => cards.every((card, i) => ready(card, 200 + i + round, 96)), 'large collection resizing');
    }
    check(performance.now() - start < 10000, `sizing: 60 patterned blocks and three resize passes complete in ${Math.round(performance.now() - start)}ms`);
    const retired = cards[0], retiredImage = retired.style.backgroundImage;
    retired.remove(); await new Promise(resolve => setTimeout(resolve, 30));
    retired.style.width = '500px'; host.append(retired); await new Promise(resolve => setTimeout(resolve, 30));
    check(retired.style.backgroundImage === retiredImage, 'sizing: removed blocks are no longer observed');
    w.BlockFills.apply(retired, fill); await until(() => ready(retired, 500, 96), 'reapplied element');
    w.BlockFills.apply(retired, null); retired.style.width = '510px'; await new Promise(resolve => setTimeout(resolve, 30));
    check(!retired.style.backgroundImage, 'sizing: clearing fill stops queued rendering');
    host.remove();
    check(w.localStorage.getItem('textBlocks') === beforeStorage, 'sizing: render and resize never write note storage');
}
