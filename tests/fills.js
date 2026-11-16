'use strict';

async function testFills() {
    const q = selector => d.querySelector(selector);
    const tap = selector => q(selector).click();
    const input = (selector, value, event = 'input') => { q(selector).value = value; q(selector).dispatchEvent(new w.Event(event, { bubbles: true })); };
    await importJSON(JSON.stringify([{ title: 'Palette', text: ' Exact 🍒\nhttps://example.org/ ', tags: ['fill'], color: '#123456' }]));
    const original = stored()[0];
    tap('[data-label="Edit"]'); tap('[data-component="color"]');
    for (const style of ['smooth', 'dithered', 'dots']) {
        input('#note-fill-style', style, 'change');
        check(stored()[0].fill.style === style && stored()[0].fill.colors.length === 2, `fills: ${style} saves immediately`);
        check(q('.text-block').style.backgroundImage.includes(style === 'smooth' ? 'linear-gradient' : 'data:image/svg+xml'), `fills: ${style} renders locally`);
        if (style !== 'smooth') {
            const image = new w.Image(); image.src = q('.text-block').style.backgroundImage.slice(5, -2);
            await image.decode(); check(image.naturalWidth === 512, `fills: ${style} SVG decodes in browser`);
        }
    }
    input('#fill-color-1', '#abcdef'); tap('#add-fill-color'); tap('#add-fill-color');
    check(stored()[0].fill.colors.length === 4 && q('#add-fill-color').hidden, 'fills: add up to four colors');
    const picker = q('#fill-color-3'); picker.focus(); input('#fill-color-3', '#ff00ff');
    check(stored()[0].fill.colors[3] === '#FF00FF' && q('#fill-color-3') === picker && d.activeElement === picker, 'fills: extra color saves without replacing picker or focus');
    input('#note-color-picker', '#000000');
    check(stored()[0].color === '#000000' && stored()[0].fill.colors[0] === '#000000', 'fills: legacy solid fallback tracks first color');
    check(['title', 'text', 'tags'].every(key => JSON.stringify(stored()[0][key]) === JSON.stringify(original[key])), 'fills: appearance changes leave content unchanged');
    check(w.getComputedStyle(q('.text-content')).backgroundColor === 'rgb(255, 255, 255)' && w.getComputedStyle(q('.text-content')).color === 'rgb(17, 17, 17)', 'fills: patterned cards keep text on a readable opaque surface');
    frame.style.width = '320px'; await new Promise(resolve => setTimeout(resolve, 50));
    check(d.documentElement.scrollWidth <= w.innerWidth, 'fills: four-color controls fit 320px');
    tap('[aria-label="Remove color 3"]');
    check(stored()[0].fill.colors.length === 3 && !q('#add-fill-color').hidden, 'fills: removing a color saves and restores Add');
    const beforeFailure = JSON.stringify(stored());
    const originalSet = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = () => { throw new Error('Full'); };
    try { input('#fill-color-1', '#445566'); } finally { w.Storage.prototype.setItem = originalSet; }
    check(JSON.stringify(stored()) === beforeFailure && status().includes('Could not save'), 'fills: storage failure preserves saved palette');
    input('#fill-color-1', '#445566');
    check(stored()[0].fill.colors[1] === '#445566', 'fills: palette retry succeeds');
    const saved = JSON.stringify(stored());
    tap('#done-edit'); await reload();
    check(JSON.stringify(stored()) === saved && q('.text-block').classList.contains('patterned-block'), 'fills: palette and pattern survive reload');
    await importJSON(saved);
    check(JSON.stringify(stored()) === saved && q('.text-block').style.backgroundImage.includes('svg'), 'fills: backup import restores pattern');
    for (const fill of [{ style: 'script', colors: ['#000000', '#FFFFFF'] }, { style: 'dots', colors: ['red', '#FFFFFF'] }, { style: 'smooth', colors: ['#000000'] }]) {
        await previewImport(JSON.stringify([{ ...original, fill }]));
        check(q('#backup-status').textContent.startsWith('Invalid backup') && JSON.stringify(stored()) === saved, 'fills: invalid fill backup rejected without replacing notes');
        tap('#close-backups'); await new Promise(resolve => setTimeout(resolve, 0));
    }
    tap('[data-label="Edit"]'); input('#block-title', 'Updated'); tap('#add-button');
    check(JSON.stringify(stored()[0].fill) === JSON.stringify(JSON.parse(saved)[0].fill), 'fills: text save preserves fill settings');
    tap('[data-label="Edit"]'); tap('[data-label="Duplicate"]');
    check(JSON.stringify(stored()[1].fill) === JSON.stringify(stored()[0].fill), 'fills: Duplicate preserves palette independently');
    tap('#cancel-edit'); tap('[data-index="0"] [data-label="Edit"]'); tap('[data-component="color"]');
    w.Storage.prototype.setItem = () => { throw new Error('Full'); };
    try { input('#note-fill-style', 'solid', 'change'); } finally { w.Storage.prototype.setItem = originalSet; }
    check(!!stored()[0].fill && q('.is-editing').classList.contains('patterned-block'), 'fills: failed switch to Solid retains saved pattern');
    tap('[data-component="text"]'); tap('#draft-save');
    check(!stored()[0].fill && !q('.is-editing').style.backgroundImage && !!stored()[1].fill, 'fills: Solid clears only the edited block pattern');
    tap('#cancel-edit'); tap('#new-block'); input('#new-text', 'Created gradient'); input('#note-fill-style', 'smooth', 'change');
    check(stored().length === 2, 'fills: creation palette remains unsaved until Add');
    tap('#add-button');
    check(stored()[2].fill.style === 'smooth', 'fills: creation saves selected palette');
    frame.style.width = '1200px'; await reload();
}
