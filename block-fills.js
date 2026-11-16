'use strict';

// Local, deterministic fills. Only validated colors enter generated SVG/CSS.
window.BlockFills = (() => {
    const styles = ['smooth', 'dithered', 'dots'];
    function validate(fill) {
        if (!fill || typeof fill !== 'object' || !styles.includes(fill.style) || !Array.isArray(fill.colors) ||
            fill.colors.length < 2 || fill.colors.length > 4 || fill.colors.some(color => typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color))) throw new Error('Invalid block fill');
        return { style: fill.style, colors: fill.colors.map(color => color.toUpperCase()) };
    }
    const cache = new Map();
    function background(fill) {
        if (!fill) return '';
        fill = validate(fill);
        if (fill.style === 'smooth') return `linear-gradient(90deg, ${fill.colors.join(', ')})`;
        const key = JSON.stringify(fill);
        if (cache.has(key)) return cache.get(key);
        const width = 512, height = 64, cell = fill.style === 'dots' ? 8 : 2;
        const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
        let marks = '';
        for (let x = 0; x < width; x += cell) {
            const position = (x + cell / 2) / width * (fill.colors.length - 1);
            const index = Math.min(fill.colors.length - 2, Math.floor(position)), amount = position - index;
            svg += `<rect x="${x}" width="${cell}" height="${height}" fill="${fill.colors[index]}"/>`;
            for (let y = 0; y < height; y += cell) {
                if (fill.style === 'dots') marks += `<circle cx="${x + cell / 2}" cy="${y + cell / 2}" r="${(Math.sqrt(amount) * cell / Math.sqrt(2)).toFixed(2)}" fill="${fill.colors[index + 1]}"/>`;
                else if (amount > (bayer[(y / cell) % 4][(x / cell) % 4] + .5) / 16) marks += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill.colors[index + 1]}"/>`;
            }
        }
        const result = `url("data:image/svg+xml,${encodeURIComponent(svg + marks + '</svg>')}")`;
        if (cache.size >= 48) cache.clear();
        cache.set(key, result); return result;
    }
    function apply(element, fill) {
        element.style.backgroundImage = background(fill);
        element.style.backgroundSize = fill && fill.style !== 'smooth' ? '100% 64px' : '';
        element.classList.toggle('patterned-block', !!fill);
    }
    return { validate, background, apply };
})();
