'use strict';

// Vector fills use CSS-pixel geometry, so browser rasterization handles zoom/DPR.
window.BlockFills = (() => {
    const styles = ['smooth', 'dithered', 'dots'];
    function validate(fill) {
        if (!fill || typeof fill !== 'object' || !styles.includes(fill.style) || !Array.isArray(fill.colors) ||
            fill.colors.length < 2 || fill.colors.length > 4 || fill.colors.some(color => typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color))) throw new Error('Invalid block fill');
        if (fill.direction !== undefined && !['horizontal', 'vertical', 'diagonal-down', 'diagonal-up'].includes(fill.direction)) throw new Error('Invalid fill direction');
        if (fill.opacities !== undefined && (!Array.isArray(fill.opacities) || fill.opacities.length !== fill.colors.length || fill.opacities.some(a => !validOpacity(a)))) throw new Error('Invalid fill opacities');
        return { style: fill.style, colors: fill.colors.map(color => color.toUpperCase()), direction: fill.direction || 'horizontal', ...(fill.opacities?.some(a => a !== 1) ? { opacities: [...fill.opacities] } : {}) };
    }
    const validOpacity = a => typeof a === 'number' && Number.isFinite(a) && a >= 0 && a <= 1;
    const rgba = (hex, alpha = 1) => alpha === 1 ? hex : `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha})`;
    const cache = new Map();
    let cacheBytes = 0;
    const cacheLimit = 4 * 1024 * 1024;
    function background(fill, width = 512, height = 64) {
        if (!fill) return '';
        fill = validate(fill);
        const angles = { horizontal: '90deg', vertical: '180deg', 'diagonal-down': 'to bottom right', 'diagonal-up': 'to top right' };
        if (fill.style === 'smooth') return `linear-gradient(${angles[fill.direction]}, ${fill.colors.map((c, i) => rgba(c, fill.opacities?.[i])).join(', ')})`;
        width = Math.max(1, Math.round(width * 100) / 100);
        height = Math.max(1, Math.round(height * 100) / 100);
        const key = JSON.stringify([fill, width, height]);
        if (cache.has(key)) {
            const value = cache.get(key); cache.delete(key); cache.set(key, value); return value;
        }
        const positionAt = (x, y) => {
            const nx = x / width, ny = y / height;
            const progress = fill.direction === 'horizontal' ? nx : fill.direction === 'vertical' ? ny : fill.direction === 'diagonal-up' ? (nx + 1 - ny) / 2 : (nx + ny) / 2;
            return Math.max(0, Math.min(1, progress)) * (fill.colors.length - 1);
        };
        const marks = fill.colors.map(() => []);
        const alpha = index => fill.opacities ? ` fill-opacity="${fill.opacities[index]}"` : '';
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
        if (fill.style === 'dots') {
            const coordinates = { horizontal: 'x1="0%" y1="0%" x2="100%" y2="0%"', vertical: 'x1="0%" y1="0%" x2="0%" y2="100%"', 'diagonal-down': 'x1="0%" y1="0%" x2="100%" y2="100%"', 'diagonal-up': 'x1="0%" y1="100%" x2="100%" y2="0%"' };
            // A delayed base-color transition lets separated circles dissolve into solid color.
            svg += `<defs><linearGradient id="base" ${coordinates[fill.direction]}>`;
            fill.colors.forEach((color, index) => {
                const opacity = fill.opacities ? ` stop-opacity="${fill.opacities[index]}"` : '';
                svg += `<stop offset="${index / (fill.colors.length - 1)}" stop-color="${color}"${opacity}/>`;
                if (index < fill.colors.length - 1) svg += `<stop offset="${(index + .35) / (fill.colors.length - 1)}" stop-color="${color}"${opacity}/>`;
            });
            svg += '</linearGradient></defs><rect width="100%" height="100%" fill="url(#base)"/>';
            for (let row = -1; row * 7 < height + 7; row++) for (let x = -4 + (row % 2 ? 4 : 0); x < width + 8; x += 8) {
                const y = row * 7 + 3.5, position = positionAt(x, y);
                const index = Math.min(fill.colors.length - 2, Math.floor(position)), amount = position - index;
                const eased = amount * amount * (3 - 2 * amount);
                const radius = Number((3.4 * Math.sqrt(eased)).toFixed(3));
                if (radius) marks[index + 1].push(`<circle cx="${x}" cy="${y}" r="${radius}"/>`);
            }
        } else {
            if (!fill.opacities) svg += `<rect width="100%" height="100%" fill="${fill.colors[0]}"/>`;
            // Restore Step 32's two-CSS-pixel ordered dither, retaining actual-size geometry.
            const cell = 2, bases = fill.colors.map(() => []);
            const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
            const rect = (x, y) => `M${x} ${y}h2v2h-2z`;
            for (let y = 0; y < height; y += cell) for (let x = 0; x < width; x += cell) {
                const position = positionAt(x + 1, y + 1), index = Math.min(fill.colors.length - 2, Math.floor(position));
                const next = position - index > (bayer[(y / cell) % 4][(x / cell) % 4] + .5) / 16;
                if (fill.opacities) marks[next ? index + 1 : index].push(rect(x, y));
                else {
                    if (index > 0) bases[index].push(rect(x, y));
                    if (next) marks[index + 1].push(rect(x, y));
                }
            }
            bases.forEach((parts, index) => {
                if (parts.length) svg += `<path fill="${fill.colors[index]}" shape-rendering="crispEdges" d="${parts.join('')}"/>`;
            });
        }
        if (fill.style === 'dots' && fill.opacities) {
            // Knock the dots out of the base before painting translucent stops.
            // Otherwise alpha would accumulate over an unrelated base color.
            svg = svg.replace('fill="url(#base)"', 'fill="url(#base)" mask="url(#holes)"');
            svg += `<defs><mask id="holes" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><g fill="black">${marks.flat().join('')}</g></mask></defs>`;
        }
        marks.forEach((parts, index) => {
            if (!parts.length) return;
            svg += fill.style === 'dots' ? `<g fill="${fill.colors[index]}"${alpha(index)}>${parts.join('')}</g>` : `<path fill="${fill.colors[index]}"${alpha(index)} shape-rendering="crispEdges" d="${parts.join('')}"/>`;
        });
        const result = `url("data:image/svg+xml,${encodeURIComponent(svg + '</svg>')}")`;
        const bytes = result.length * 2;
        while (cache.size && (cacheBytes + bytes > cacheLimit || cache.size >= 24)) {
            const oldest = cache.keys().next().value; cacheBytes -= cache.get(oldest).length * 2; cache.delete(oldest);
        }
        if (bytes <= cacheLimit) { cache.set(key, result); cacheBytes += bytes; }
        return result;
    }
    const tracked = new Map(), pending = new Set();
    let frame = 0;
    const observer = new ResizeObserver(entries => {
        for (const entry of entries) if (tracked.has(entry.target)) schedule(entry.target);
    });
    function release(element) {
        observer.unobserve(element); tracked.delete(element); pending.delete(element);
    }
    function schedule(element) {
        pending.add(element);
        if (!frame) frame = requestAnimationFrame(flush);
    }
    function flush() {
        frame = 0;
        const start = performance.now();
        for (const element of pending) {
            pending.delete(element);
            const state = tracked.get(element);
            if (!state) continue;
            if (!element.isConnected) { release(element); continue; }
            // Computed padding-box dimensions exclude transforms and include fractional CSS pixels.
            const style = getComputedStyle(element);
            let width = parseFloat(style.width), height = parseFloat(style.height);
            if (style.boxSizing === 'border-box') {
                width -= parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
                height -= parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
            } else {
                width += parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
                height += parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
            }
            if (!element.getClientRects().length || !(width > 0 && height > 0)) continue;
            const size = `${width.toFixed(2)}x${height.toFixed(2)}`;
            if (state.size !== size) {
                element.style.backgroundImage = background(state.fill, width, height);
                state.size = size;
            }
            if (performance.now() - start >= 8) break;
        }
        if (pending.size) frame = requestAnimationFrame(flush);
    }
    // Grid rebuilds replace cards. Release removed elements without retaining detached trees.
    new MutationObserver(() => {
        for (const element of tracked.keys()) if (!element.isConnected) release(element);
    }).observe(document.documentElement, { childList: true, subtree: true });
    function apply(element, fill, color, opacity = 1) {
        fill = fill ? validate(fill) : null;
        element.classList.toggle('patterned-block', !!fill || opacity < 1);
        if (color) element.style.backgroundColor = fill ? 'transparent' : rgba(color, opacity);
        element.style.backgroundSize = 'auto';
        element.style.backgroundRepeat = 'no-repeat';
        if (!fill || fill.style === 'smooth') {
            release(element); element.style.backgroundImage = background(fill); return;
        }
        const key = JSON.stringify(fill), previous = tracked.get(element);
        if (previous?.key === key) { schedule(element); return; }
        tracked.set(element, { fill, key, size: '' });
        observer.observe(element); schedule(element);
    }
    return { validate, background, apply, validOpacity };
})();
