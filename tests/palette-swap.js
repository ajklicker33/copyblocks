'use strict';

async function testPaletteSwap() {
    const q = selector => d.querySelector(selector), tap = selector => q(selector).click();
    const colors = ['#123456', '#ABCDEF', '#CC8844', '#559977'];
    const input = (selector, value) => { q(selector).value = value; q(selector).dispatchEvent(new w.Event('input', { bubbles: true })); };
    for (const count of [2, 3, 4]) {
        const palette = colors.slice(0, count);
        await importJSON(JSON.stringify([{ title: 'Swap', text: 'Exact body', tags: ['keep'], color: palette[0], fill: { style: 'dots', direction: 'diagonal-up', colors: palette } }]));
        tap('[data-label="Edit"]'); tap('[data-component="color"]');
        const before = JSON.stringify(stored());
        q('#reverse-fill-colors').focus(); tap('#reverse-fill-colors');
        check(stored()[0].fill.colors.join() === [...palette].reverse().join() && stored()[0].color === palette.at(-1), `swap: ${count} colors reverse and save immediately`);
        check(q('#note-color-hex').value === palette.at(-1) && q('#fill-color-1').value.toUpperCase() === palette.at(-2), `swap: ${count} color controls reflect reversed values`);
        check(d.activeElement.id === 'reverse-fill-colors' && stored()[0].fill.direction === 'diagonal-up' && stored()[0].text === 'Exact body' && stored()[0].tags[0] === 'keep', `swap: ${count} color reversal preserves focus orientation and content`);
        tap('#reverse-fill-colors'); check(JSON.stringify(stored()) === before, `swap: reversing ${count} colors twice restores exact saved values`);
    }
    const beforeKeys = JSON.stringify(stored());
    for (const key of ['Enter', 'Space']) {
        q('#reverse-fill-colors').focus(); window.testKey = key;
        await until(() => window.testKey === null, 'native palette swap');
        check(d.activeElement.id === 'reverse-fill-colors', `swap: native ${key} activates swap and retains focus`);
    }
    check(JSON.stringify(stored()) === beforeKeys, 'swap: Enter and Space together restore palette');
    for (const direction of ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up']) {
        tap(`[data-fill-direction="${direction}"]`); tap('#reverse-fill-colors');
        check(stored()[0].fill.direction === direction, `swap: reversal preserves ${direction} orientation`);
        tap('#reverse-fill-colors');
    }
    const originalSet = w.Storage.prototype.setItem, beforeFailure = JSON.stringify(stored());
    w.Storage.prototype.setItem = () => { throw new Error('Full'); };
    try { tap('#reverse-fill-colors'); } finally { w.Storage.prototype.setItem = originalSet; }
    check(JSON.stringify(stored()) === beforeFailure && q('#note-color-hex').value === colors[3] && status().includes('Could not save'), 'swap: failed write preserves saved palette and retains reversed draft');
    tap('#done-edit'); tap('#draft-save');
    check(stored()[0].fill.colors.join() === [...colors].reverse().join() && !q('.is-editing'), 'swap: failed reversal can be saved through draft recovery');
    await reload(); check(stored()[0].fill.colors.join() === [...colors].reverse().join(), 'swap: reversal survives reload');
    await importJSON(JSON.stringify(stored())); check(stored()[0].fill.colors[0] === colors[3], 'swap: backup import retains reversed order');
    tap('[data-label="Edit"]'); tap('[data-component="color"]');
    input('#note-color-hex', '#12'); const valid = JSON.stringify(stored()); tap('#reverse-fill-colors');
    check(JSON.stringify(stored()) === valid && q('#note-color-hex').value === '#12', 'swap: invalid primary HEX blocks reversal without losing input');
    tap('#cancel-edit');
    tap('#new-block'); input('#new-text', 'Draft palette');
    check(q('#reverse-fill-colors').hidden, 'swap: Solid has no reverse action');
    q('#note-fill-style').value = 'smooth'; q('#note-fill-style').dispatchEvent(new w.Event('change'));
    input('#note-color-picker', '#123456'); input('#fill-color-1', '#abcdef'); tap('#reverse-fill-colors');
    check(stored().length === 1 && q('#note-color-hex').value === '#ABCDEF', 'swap: creation reversal stays unsaved');
    for (const width of [1200, 320]) {
        frame.style.width = width + 'px'; await new Promise(resolve => setTimeout(resolve, 50));
        const first = q('#primary-color-row'), swap = q('#reverse-fill-colors'), second = q('#fill-colors .fill-color-row');
        const a = first.getBoundingClientRect(), b = swap.getBoundingClientRect(), c = second.getBoundingClientRect();
        check(first.nextElementSibling === swap && swap.nextElementSibling === q('#fill-colors') && a.bottom <= b.top && b.bottom <= c.top && c.top - b.bottom <= 8, `swap: Color 1 / flat swap / Color 2 stack at ${width}px`);
        check(b.height >= 24 && b.height <= 32 && b.width >= a.width - 1 && d.documentElement.scrollWidth <= w.innerWidth, `swap: compact full-width hit target and no overflow at ${width}px`);
    }
    tap('#add-button'); check(stored()[1].color === '#ABCDEF' && stored()[1].fill.colors.join() === '#ABCDEF,#123456', 'swap: Add saves the reversed creation palette');
    tap('[data-index="1"] [data-label="Edit"]'); tap('[data-component="color"]');
    check(!q('#fill-preview'), 'palette: separate live preview is removed');
    input('#fill-color-1-hex', 'a1b2c3');
    check(stored()[1].fill.colors[1] === '#A1B2C3' && q('#fill-color-1').value === '#a1b2c3' && q('#fill-color-1-hex').value === '#A1B2C3', 'palette: Color 2 HEX normalizes synchronizes and saves');
    const savedHex = JSON.stringify(stored()); input('#fill-color-1-hex', '#12');
    check(JSON.stringify(stored()) === savedHex && q('#fill-color-1-hex').getAttribute('aria-invalid') === 'true', 'palette: incomplete secondary HEX leaves saved color unchanged');
    tap('#reverse-fill-colors'); check(q('#fill-color-1-hex').value === '#12' && JSON.stringify(stored()) === savedHex, 'palette: invalid secondary HEX blocks swap');
    tap('[data-component="text"]'); check(q('#draft-dialog').open, 'palette: invalid secondary HEX participates in draft protection');
    tap('#draft-save'); check(q('.is-editing') && q('#fill-color-1-hex').value === '#12', 'palette: Save cannot discard invalid secondary HEX');
    input('#fill-color-1', '#123456'); check(q('#fill-color-1-hex').value === '#123456' && q('#fill-color-1-hex').getAttribute('aria-invalid') === 'false', 'palette: secondary picker fixes invalid HEX');
    const savedBeforeFailure = JSON.stringify(stored());
    w.Storage.prototype.setItem = () => { throw new Error('Full'); };
    try { input('#fill-color-1-hex', '#556677'); } finally { w.Storage.prototype.setItem = originalSet; }
    check(JSON.stringify(stored()) === savedBeforeFailure && q('#fill-color-1-hex').value === '#556677', 'palette: secondary HEX storage failure retains draft');
    input('#fill-color-1-hex', '#556677'); tap('#add-fill-color'); tap('#add-fill-color');
    input('#fill-color-2-hex', '#334455'); input('#fill-color-3-hex', '#667788');
    check(stored()[1].fill.colors.slice(1).join() === '#556677,#334455,#667788', 'palette: all secondary HEX inputs save independently');
    const rows = [...d.querySelectorAll('.fill-color-row')];
    check(rows.every(row => Math.abs(row.querySelector('input[type=color]').getBoundingClientRect().top - row.querySelector('.hex-input').getBoundingClientRect().top) <= 8) && d.documentElement.scrollWidth <= w.innerWidth, 'palette: picker and HEX remain single-line above compact opacity at narrow width');
    check(q('#primary-color-row label').getBoundingClientRect().width <= 1 && q('#note-color-picker').labels.length === 1 && q('#fill-color-1-hex').getAttribute('aria-label') === 'Color 2 HEX', 'palette: narrow labels collapse but accessible names remain');
    tap('#done-edit');
    frame.style.width = '1200px'; await reload();
}
