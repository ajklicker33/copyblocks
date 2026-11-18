'use strict';

// Vector fills use CSS-pixel geometry, so browser rasterization handles zoom/DPR.
window.Step32Fills = (() => {
    const styles = ['smooth', 'dithered', 'dots'];
    function validate(fill) {
        if (!fill || typeof fill !== 'object' || !styles.includes(fill.style) || !Array.isArray(fill.colors) ||
            fill.colors.length < 2 || fill.colors.length > 4 || fill.colors.some(color => typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color))) throw new Error('Invalid block fill');
        if (fill.direction !== undefined && !['horizontal', 'vertical', 'diagonal-down', 'diagonal-up'].includes(fill.direction)) throw new Error('Invalid fill direction');
        return { style: fill.style, colors: fill.colors.map(color => color.toUpperCase()), direction: fill.direction || 'horizontal' };
    }
    const cache = new Map();
    let cacheBytes = 0;
    const cacheLimit = 4 * 1024 * 1024;
    function background(fill, width = 512, height = 64) {
        if (!fill) return '';
        fill = validate(fill);
        const angles = { horizontal: '90deg', vertical: '180deg', 'diagonal-down': 'to bottom right', 'diagonal-up': 'to top right' };
        if (fill.style === 'smooth') return `linear-gradient(${angles[fill.direction]}, ${fill.colors.join(', ')})`;
        width = Math.max(1, Math.round(width * 100) / 100);
        height = Math.max(1, Math.round(height * 100) / 100);
        const key = JSON.stringify([fill, width, height]);
        if (cache.has(key)) {
            const value = cache.get(key); cache.delete(key); cache.set(key, value); return value;
        }
        const cell = fill.style === 'dots' ? 8 : 2;
        const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
        const bases = fill.colors.map(() => []), marks = fill.colors.map(() => []);
        const rect = (x, y) => `M${x} ${y}h${cell}v${cell}h-${cell}z`;
        for (let y = 0; y < height; y += cell) for (let x = 0; x < width; x += cell) {
            const nx = (x + cell / 2) / width, ny = (y + cell / 2) / height;
            const progress = fill.direction === 'horizontal' ? nx : fill.direction === 'vertical' ? ny : fill.direction === 'diagonal-up' ? (nx + 1 - ny) / 2 : (nx + ny) / 2;
            const position = Math.max(0, Math.min(1, progress)) * (fill.colors.length - 1);
            const index = Math.min(fill.colors.length - 2, Math.floor(position)), amount = position - index;
            if (index > 0) bases[index].push(rect(x, y));
            if (fill.style === 'dots') {
                const radius = Number((Math.sqrt(amount) * cell / Math.sqrt(2)).toFixed(3));
                if (radius) marks[index + 1].push(`<circle cx="${x + cell / 2}" cy="${y + cell / 2}" r="${radius}"/>`);
            } else if (amount > (bayer[(y / cell) % 4][(x / cell) % 4] + .5) / 16) marks[index + 1].push(rect(x, y));
        }
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${fill.colors[0]}"/>`;
        for (const paths of [bases, marks]) paths.forEach((parts, index) => {
            if (!parts.length) return;
            if (paths === marks && fill.style === 'dots') svg += `<g fill="${fill.colors[index]}">${parts.join('')}</g>`;
            else svg += `<path fill="${fill.colors[index]}" shape-rendering="crispEdges" d="${parts.join('')}"/>`;
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
    function apply(element, fill) {
        fill = fill ? validate(fill) : null;
        element.classList.toggle('patterned-block', !!fill);
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
    return { validate, background, apply };
})();
