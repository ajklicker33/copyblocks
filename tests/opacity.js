'use strict';
async function testOpacity() {
    const q = s => d.querySelector(s), tap = s => q(s).click();
    const input = (s, v) => { q(s).value = v; q(s).dispatchEvent(new w.Event('input', { bubbles: true })); };
    const sample = { title: 'Opacity', text: 'Opaque readable text', color: '#FF0000', tags: [] };
    await importJSON(JSON.stringify([sample])); tap('[data-label="Edit"]'); tap('[data-component="color"]');
    check(q('#color-opacity-value-0').value === '100', 'opacity: legacy Solid defaults to 100%');
    for (const value of [0, 37, 100]) {
        input('#color-opacity-value-0', value);
        check((stored()[0].colorOpacity ?? 1) === value / 100 && w.getComputedStyle(q('.is-editing')).opacity === '1', `opacity: Solid ${value}% saves without fading the card`);
    }
    input('#color-opacity-value-0', 37);
    const saved = JSON.stringify(stored()); input('#color-opacity-value-0', ''); tap('#reverse-fill-colors');
    check(JSON.stringify(stored()) === saved && !q('#color-opacity-value-0').checkValidity(), 'opacity: empty numeric value cannot save');
    input('#color-opacity-0', 25);
    check(stored()[0].colorOpacity === .25 && q('#color-opacity-value-0').value === '25', 'opacity: slider repairs invalid numeric draft');
    const setItem = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = () => { throw Error('Full'); };
    try { input('#color-opacity-value-0', 70); } finally { w.Storage.prototype.setItem = setItem; }
    check(stored()[0].colorOpacity === .25 && q('#color-opacity-value-0').value === '70', 'opacity: failed storage retains saved appearance and retryable draft');
    input('#color-opacity-value-0', 70); tap('#done-edit'); await reload();
    check(stored()[0].colorOpacity === .7, 'opacity: Solid survives reload');
    tap('[data-label="Edit"]'); tap('.is-editing [data-label="Duplicate"]');
    check(stored()[1].colorOpacity === .7, 'opacity: duplicate preserves Solid alpha'); tap('#cancel-edit');
    tap('.note-color-value'); tap('#new-block'); input('#new-text', 'Alpha draft');
    check(q('#color-opacity-value-0').value === '70', 'opacity: reused color carries alpha into creation');
    input('#color-opacity-value-0', 0);
    check(stored().length === 2 && w.getComputedStyle(q('.new-block-card')).backgroundColor === 'rgba(255, 0, 0, 0)', 'opacity: creation previews transparency without saving');
    tap('#add-button'); check(stored()[2].colorOpacity === 0, 'opacity: Add saves zero alpha');
    for (const value of [null, '0.5', -1, 2]) {
        const before = JSON.stringify(stored()); await previewImport(JSON.stringify([{ ...sample, colorOpacity: value }]));
        check(q('#import-preview').hidden && JSON.stringify(stored()) === before, `opacity: invalid Solid alpha ${JSON.stringify(value)} cannot replace data`); tap('#close-backups');
    }
    for (const count of [2, 3, 4]) {
        const fill = { style: 'dots', colors: ['#FF0000', '#0000FF', '#00FF00', '#FFFFFF'].slice(0, count), opacities: [0, .5, 1, .25].slice(0, count) };
        await importJSON(JSON.stringify([{ ...sample, fill }])); tap('[data-label="Edit"]'); tap('[data-component="color"]');
        tap('#reverse-fill-colors');
        check(stored()[0].fill.opacities.join() === [...fill.opacities].reverse().join(), `opacity: reversal carries ${count} alpha values`);
        tap('#reverse-fill-colors'); check(stored()[0].fill.opacities.join() === fill.opacities.join(), `opacity: swap twice restores ${count} stops`);
        tap('#done-edit'); await reload();
        check(stored()[0].fill.opacities.join() === fill.opacities.join(), `opacity: ${count} stops survive reload`);
    }
    for (const opacities of [[0], [0, 2], [null, 1], ['0', 1], [0, -1]]) {
        let rejected = false; try { w.BlockFills.validate({ style: 'dots', colors: ['#FF0000', '#0000FF'], opacities }); } catch { rejected = true; }
        check(rejected, `opacity: rejects malformed alpha ${JSON.stringify(opacities)}`);
    }
    for (const style of ['dithered', 'dots']) for (const direction of ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up']) {
        const source = w.BlockFills.background({ style, direction, colors: ['#FF0000', '#0000FF'], opacities: [.5, .5] }, 120, 80);
        const img = new Image(); img.src = source.slice(5, -2); await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 120, 80); ctx.drawImage(img, 0, 0);
        const p = ctx.getImageData(20, 20, 1, 1).data;
        check(p[1] >= 126 && p[1] <= 145 && p[3] === 255, `opacity: ${style} ${direction} composites half alpha on white without stacking`);
        const zero = new Image(); zero.src = w.BlockFills.background({ style, direction, colors: ['#FF0000', '#0000FF'], opacities: [0, 0] }, 120, 80).slice(5, -2); await zero.decode();
        ctx.clearRect(0, 0, 120, 80); ctx.drawImage(zero, 0, 0);
        check(ctx.getImageData(0, 0, 120, 80).data.every((v, i) => i % 4 !== 3 || v === 0), `opacity: ${style} ${direction} fully transparent stops have no opaque base`);
    }
    for (const direction of ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up']) {
        check(w.BlockFills.background({style:'smooth',direction,colors:['#FF0000','#0000FF'],opacities:[0,.5]}).includes('rgba(255, 0, 0, 0)'), `opacity: smooth ${direction} uses native alpha stops`);
    }
    tap('[data-label="Edit"]'); tap('[data-component="color"]');
    check(w.getComputedStyle(q('.is-editing')).backgroundColor === 'rgba(0, 0, 0, 0)' && w.getComputedStyle(q('.is-editing .text-content')).backgroundColor === 'rgb(255, 255, 255)', 'opacity: transparent patterned base and opaque content surfaces');
    frame.style.width = '320px'; await new Promise(r => setTimeout(r, 50));
    check(d.documentElement.scrollWidth <= w.innerWidth && q('#color-opacity-0').getBoundingClientRect().width > 20, 'opacity: controls fit at 320px');
    q('#color-opacity-0').focus(); window.testKey = 'ArrowRight'; await until(() => window.testKey === null, 'opacity keyboard');
    check(stored()[0].fill.opacities[0] === .01, 'opacity: native keyboard adjusts slider and saves');
    tap('#done-edit'); frame.style.width = '1200px'; await reload();
}
