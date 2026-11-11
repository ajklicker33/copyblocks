'use strict';
const frame = document.querySelector('iframe');
const output = document.querySelector('#results');
const results = [];
let w, d;
function check(condition, label) {
    if (!condition) throw new Error(label);
    results.push('PASS ' + label);
    output.textContent = results.join('\n');
}
function attach() { w = frame.contentWindow; d = w.document; w.confirm = () => true; }
const click = selector => d.querySelector(selector).click();
const action = label => [...d.querySelectorAll('.block-actions button')].find(b => b.textContent === label).click();
const status = () => d.querySelector('#status').textContent;
const stored = () => JSON.parse(w.localStorage.getItem('textBlocks'));
const add = (title, text, tags = '') => {
    d.querySelector('#block-title').value = title;
    d.querySelector('#new-text').value = text;
    d.querySelector('#block-tags').value = tags;
    click('#add-button');
};
async function until(predicate, label) {
    for (let i = 0; i < 200; i++) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Timed out: ' + label);
}
async function reload() {
    await new Promise(resolve => {
        frame.onload = () => { attach(); resolve(); };
        w.location.reload();
    });
}
function filterBy(value) {
    const wanted = value ? 'tag:' + value.replace(/^#/, '').toLowerCase() : '';
    if (!wanted) { click('#all-tags'); return; }
    if (d.querySelector('#tag-filter').dataset.activeTag === wanted) return;
    const target = [...d.querySelectorAll('[data-tag-filter]')].find(el => el.dataset.tagFilter === wanted);
    if (!target) throw new Error('Tag not found: ' + value);
    if (target.closest('details')) d.querySelector('#more-tags').open = true;
    target.click();
}
async function previewImport(value) {
    if (!d.querySelector('#backups-dialog').open) click('#backups-button');
    const input = d.querySelector('#file-input');
    const transfer = new w.DataTransfer();
    transfer.items.add(new w.File([value], 'backup.json', { type: 'application/json' }));
    input.files = transfer.files; input.dispatchEvent(new w.Event('change'));
    await until(() => d.querySelector('#backup-status').textContent !== 'Reading backup…', 'import validation');
}
async function importJSON(value) {
    await previewImport(value);
    if (!d.querySelector('#import-preview').hidden) click(w.confirm() ? '#replace-import' : '#cancel-import');
    await new Promise(resolve => {
        d.querySelector('#backups-dialog').addEventListener('close', resolve, { once: true });
        click('#close-backups');
    });
}
frame.onload = async () => {
    attach();
    try {
        click('#clear-button');
        click('#layout-button'); check(d.querySelector('.layout-dropdown').classList.contains('show'), 'layout opens');
        click('[data-columns="2"]'); check(w.localStorage.getItem('preferredColumns') === '2', 'layout persists');
        d.querySelector('#background-color-picker').value = '#ffb0ff';
        d.querySelector('#background-color-picker').dispatchEvent(new w.Event('input'));
        check(w.localStorage.getItem('preferredColor') === '#FFB0FF', 'background persists');
        const exactText = '  Hello 🍒\n<svg onload=alert(1)>  ';
        add('First #Work', exactText, 'Work'); add('Second', 'x'.repeat(500) + ' #other', 'other');
        check(d.querySelectorAll('.text-block').length === 2, 'add buttons create blocks');
        check(!d.querySelector('.text-content svg'), 'block text is not executable HTML');
        check(stored()[0].text === exactText, 'Unicode and whitespace persist exactly');
        await reload();
        check(d.querySelectorAll('.text-block').length === 2 && d.querySelector('.text-content').textContent === exactText, 'blocks survive real iframe reload');
        check(w.getComputedStyle(d.body).backgroundColor === 'rgb(255, 176, 255)' && d.querySelector('#text-blocks').style.getPropertyValue('--columns') === '2', 'preferences survive reload');

        // Controlled mocks verify app outcomes, not native clipboard permissions.
        let copied;
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied = value; } } });
        check(w.isSecureContext, 'secure context exercises Clipboard API path');
        action('Copy'); await until(() => status() === 'Copied!', 'copy success');
        check(copied === exactText, 'simulated clipboard receives exact text');
        w.navigator.clipboard.writeText = async () => { throw new w.DOMException('Denied', 'NotAllowedError'); };
        action('Copy'); await until(() => status().startsWith('Copy failed.'), 'clipboard rejection');
        check(status() !== 'Copied!', 'simulated permission rejection replaces previous success');
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        w.document.execCommand = () => false;
        action('Copy');
        check(status().startsWith('Copy failed.') && d.querySelectorAll('textarea').length === 1, 'simulated fallback failure reports error and removes temporary field');
        w.document.execCommand = () => true;
        action('Copy'); check(status() === 'Copied!', 'simulated fallback success');

        action('Edit'); d.querySelector('#new-text').value = 'Changed #new'; click('#add-button');
        check(d.querySelector('.text-content').textContent === 'Changed #new', 'editing updates existing block');
        check(d.querySelectorAll('.text-block').length === 2, 'editing does not duplicate');
        filterBy('#other'); check(d.querySelectorAll('.text-block').length === 1, 'dynamic metadata tag filtering');
        check(d.querySelector('.block-title').textContent === 'Second', 'filter selects correct block');
        // Actual anchor download; the PowerShell runner checks the resulting file.
        document.querySelector('#export-expected').dataset.json = encodeURIComponent(JSON.stringify(stored(), null, 2));
        click('#export-button');
        check(stored().length === 2 && d.querySelectorAll('.text-block').length === 1, 'export requested with hidden blocks in collection');
        filterBy('');
        action('Move down'); check(d.querySelector('.block-title').textContent === 'Second', 'button reordering persists');
        action('Edit'); click('#cancel-edit'); check(d.querySelector('#add-button').textContent === 'Add Text Block', 'cancel editing');
        const cards = d.querySelectorAll('.text-block');
        const transfer = new w.DataTransfer();
        cards[0].dispatchEvent(new w.DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
        const over = new w.DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer });
        cards[1].dispatchEvent(over);
        check(over.defaultPrevented, 'synthetic dragover accepts internal block');
        cards[1].dispatchEvent(new w.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        cards[0].dispatchEvent(new w.DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
        check(stored()[0].title === 'First #Work', 'synthetic drag/drop saves new order');
        await reload(); check(d.querySelector('.block-title').textContent === 'First #Work', 'drag order survives reload');
        for (const width of [320, 1200]) {
            frame.style.width = width + 'px';
            await new Promise(resolve => setTimeout(resolve, 40));
            check(w.innerWidth === width, `viewport is ${width}px`);
            check([...d.querySelectorAll('.text-block, .text-content')].every(el => el.scrollWidth <= el.clientWidth + 1), `long strings fit cards at ${width}px`);
            check(d.documentElement.scrollWidth <= w.innerWidth, `page fits at ${width}px`);
        }
        await importJSON('{"wrong":true}'); check(d.querySelectorAll('.text-block').length === 2, 'invalid import preserves blocks');
        await importJSON('[{"title":"Restored","text":"Legacy backup"}]');
        check(d.querySelector('.text-content').textContent === 'Legacy backup', 'legacy backup imports');
        check(d.querySelectorAll('.text-block').length === 1, 'import replaces only after validation');
        const beforeFailure = w.localStorage.getItem('textBlocks');
        const originalSet = w.Storage.prototype.setItem;
        w.Storage.prototype.setItem = () => { throw new w.DOMException('Full', 'QuotaExceededError'); };
        add('Unsaved', 'Keep this in memory');
        check(status().startsWith('Could not save'), 'simulated storage write failure is visible');
        check(w.localStorage.getItem('textBlocks') === beforeFailure && d.querySelectorAll('.text-block').length === 2, 'write failure preserves saved data and current session');
        w.Storage.prototype.setItem = originalSet;
        w.localStorage.setItem('textBlocks', '{broken json');
        await reload(); check(status().includes('left untouched'), 'corrupt stored JSON reports recovery message');
        add('Session only', 'Do not overwrite corruption');
        check(w.localStorage.getItem('textBlocks') === '{broken json', 'adding cannot overwrite corrupt saved data');
        w.confirm = () => false;
        await importJSON('[{"text":"Replacement"}]');
        check(w.localStorage.getItem('textBlocks') === '{broken json', 'cancelled replacement preserves corrupt data');
        w.confirm = () => true;
        await importJSON('[{"text":"Replacement"}]');
        check(stored()[0].text === 'Replacement', 'confirmed valid import replaces corrupt data');
        action('Delete'); check(d.querySelectorAll('.text-block').length === 0, 'delete button');
        add('Clear', 'Clear me'); click('#clear-button'); check(stored().length === 0, 'clear saves empty collection');
        const linkText = '  Visit https://example.com/path, then (https://example.org/wiki/Topic_(one)).\n' +
            'Duplicate HTTPS://EXAMPLE.COM/path and http://example.net/?a=1&b=2.  ';
        add('Links', linkText);
        const links = () => [...d.querySelectorAll('.block-links a')];
        check(links().length === 3, 'multiple HTTP(S) links are deduplicated by parsed URL');
        check(links()[0].href === 'https://example.com/path' && links()[1].href === 'https://example.org/wiki/Topic_(one)', 'sentence punctuation stripped while balanced parentheses retained');
        check(links()[2].href === 'http://example.net/?a=1&b=2', 'HTTP and query parameters preserved');
        check(links().every(link => link.target === '_blank' && link.relList.contains('noopener') && link.relList.contains('noreferrer')), 'link actions request isolated new tabs without referrer');
        check(links().every(link => link.textContent === link.href && link.tabIndex === 0), 'links are labeled and keyboard focusable');
        let linkCopyCount = 0;
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied = value; linkCopyCount++; } } });
        links()[0].addEventListener('click', event => event.preventDefault(), { once: true });
        links()[0].click();
        await Promise.resolve();
        check(linkCopyCount === 0, 'opening link does not copy (navigation suppressed in test)');
        click('.text-content'); await until(() => linkCopyCount === 1, 'card text copy');
        check(copied === linkText, 'card click copies exact body including URLs and whitespace');
        action('Copy'); await until(() => linkCopyCount === 2, 'copy button with links');
        check(copied === linkText, 'Copy action preserves exact body with links');
        action('Edit'); d.querySelector('#new-text').value = 'https://example.net/edited'; click('#add-button');
        check(links().length === 1 && links()[0].href === 'https://example.net/edited', 'editing replaces stale link actions');
        await importJSON(JSON.stringify([{ text: 'https://example.org/imported' }]));
        check(links().length === 1 && links()[0].href === 'https://example.org/imported', 'import regenerates link actions');
        await reload();
        check(links().length === 1 && links()[0].href === 'https://example.org/imported', 'reload regenerates link actions');
        check(!Object.hasOwn(stored()[0], 'links'), 'derived links are not stored in backups');
        await importJSON(JSON.stringify([{ text: 'javascript:alert(1) data:text/html,<script>alert(1)</script> file:///tmp/test ftp://example.com javascript:https://example.com https:// https://[bad <img src=x onerror=alert(1)>' }]));
        check(links().length === 0 && !d.querySelector('.text-content script, .text-content img'), 'unsafe schemes, malformed URLs and HTML remain inert text');
        action('Edit'); d.querySelector('#new-text').value = 'Plain text without a URL'; click('#add-button');
        check(!d.querySelector('.block-links'), 'text without links has no link action group');
        action('Edit'); d.querySelector('#new-text').value = 'https://example.com/' + 'a'.repeat(500); click('#add-button');
        frame.style.width = '320px';
        await new Promise(resolve => setTimeout(resolve, 40));
        check([...d.querySelectorAll('.link-list li')].every(item => item.scrollWidth <= item.clientWidth + 1) && d.documentElement.scrollWidth <= w.innerWidth, 'long link actions fit a 320px viewport');
        const editor = d.querySelector('#new-text');
        editor.value = 'https://example.com/preview https://example.com/preview https://example.org/second';
        editor.dispatchEvent(new w.Event('input'));
        check(d.querySelectorAll('#detected-links-list li').length === 2 && d.querySelector('#no-detected-links').hidden, 'editor detects and deduplicates links live');
        check([...d.querySelectorAll('#detected-links-list a')].every(link => link.textContent === link.href), 'preview lists URLs without Open link prefix');
        editor.value = 'No URLs'; editor.dispatchEvent(new w.Event('input'));
        check(d.querySelector('#detected-links-list').hidden && !d.querySelector('#no-detected-links').hidden, 'removing URLs clears live preview');
        action('Edit');
        check(d.querySelectorAll('#detected-links-list li').length === 1, 'editing fills detected links preview');
        click('#cancel-edit');
        check(d.querySelectorAll('#detected-links-list li').length === 0, 'cancel clears detected links preview');
        await importJSON(JSON.stringify([
            { title: 'Linked #work', text: 'https://example.com/a https://example.com/a', tags: ['Work'] },
            { title: 'Other link', text: 'https://example.org/b' },
            { title: 'Plain #work', text: 'No link', tags: ['work'] }
        ]));
        check(!d.querySelector('select#tag-filter') && ![...d.querySelectorAll('[data-tag-filter]')].some(el => el.dataset.tagFilter.startsWith('link:')), 'dropdown and detected-link filters are removed');
        filterBy('#work'); check(d.querySelectorAll('.text-block').length === 2, 'tag filters remain independent of detected links');
        action('Edit'); editor.value = 'https://example.net/replaced'; click('#add-button');
        check(d.querySelector('#tag-filter').dataset.activeTag === 'tag:work' && d.querySelectorAll('.text-block').length === 2, 'editing URLs preserves tag selection');
        await importJSON(JSON.stringify([{ text: 'https://example.org/new-import' }]));
        check(!d.querySelector('[data-tag-filter]') && d.querySelector('#tag-filter').dataset.activeTag === '', 'link-only import creates no tag suggestions');
        // jsQR is a separate, test-only decoder. Decode pixels from the actual UI canvas.
        const decodeQR = () => {
            const canvas = d.querySelector('.qr-code');
            if (!canvas) throw new Error('Missing QR canvas');
            const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
            return jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' });
        };
        let qrGenerations = 0;
        const originalEncode = w.qrcodegen.QrCode.encodeSegments;
        w.qrcodegen.QrCode.encodeSegments = function (...args) {
            qrGenerations++; return originalEncode.apply(this, args);
        };
        const samples = [
            ['mixed case', 'AbCdEf 123'],
            ['Unicode', '🍒 café 日本語 e\u0301'],
            ['URL', 'https://example.com/CaseSensitive?Token=aB12#Section'],
            ['multiline whitespace', '  first line\nSecond line\n  '],
            ['leading Unicode BOM', '\uFEFFKeep this character']
        ];
        for (const [label, payload] of samples) {
            const before = qrGenerations;
            await importJSON(JSON.stringify([{ title: label, text: payload }]));
            check(!d.querySelector('.qr-view') && qrGenerations === before, `QR stays lazy on import: ${label}`);
            action('Show QR');
            const decoded = decodeQR();
            check(decoded?.data === payload, `independent QR pixel decode preserves ${label}`);
            check(decoded.chunks.some(chunk => chunk.type === 'eci' && chunk.assignmentNumber === 26), `QR declares UTF-8: ${label}`);
            action('Hide QR');
            check(!d.querySelector('.qr-view'), `Hide QR releases canvas: ${label}`);
        }
        let qrCopyCount = 0;
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied = value; qrCopyCount++; } } });
        action('Show QR'); action('Hide QR'); action('Show QR');
        check(qrCopyCount === 0, 'QR controls do not copy block text');
        click('.text-content'); await until(() => qrCopyCount === 1, 'copy while QR visible');
        check(copied === samples.at(-1)[1], 'ordinary block click still copies exact body while QR visible');
        const beforeEdit = qrGenerations;
        action('Edit'); d.querySelector('#new-text').value = 'Edited 🍒\nKeep CASE'; click('#add-button');
        check(qrGenerations === beforeEdit + 1 && decodeQR()?.data === 'Edited 🍒\nKeep CASE', 'visible QR regenerates after edit');
        const beforeLayout = qrGenerations;
        filterBy('');
        check(qrGenerations === beforeLayout && !!d.querySelector('.qr-code'), 'unrelated render reuses current QR image');
        check(d.querySelector('.qr-code').getAttribute('role') === 'img' && d.querySelector('.qr-code').getAttribute('aria-label').includes('exact block text'), 'QR canvas has accessible description');
        await importJSON(JSON.stringify([{ text: 'New import' }]));
        check(!d.querySelector('.qr-view'), 'replacement import removes stale visible QR');
        action('Show QR'); check(decodeQR()?.data === 'New import', 'new import generates its own QR');
        action('Delete'); check(!d.querySelector('.qr-code'), 'deleting block removes QR view');
        await importJSON(JSON.stringify([{ text: 'a'.repeat(2330) }]));
        action('Show QR');
        check(decodeQR()?.data === 'a'.repeat(2330), 'maximum 2330-byte payload round trips at medium correction');
        check(d.documentElement.scrollWidth <= w.innerWidth && d.querySelector('.qr-code').getBoundingClientRect().width <= d.querySelector('.text-block').clientWidth, 'QR fits 320px viewport');
        for (const payload of ['a'.repeat(2331), '🍒'.repeat(583)]) {
            await importJSON(JSON.stringify([{ text: payload }])); action('Show QR');
            check(!d.querySelector('.qr-code') && d.querySelector('.qr-error').textContent.includes('2,330 UTF-8 bytes'), 'oversized QR shows useful byte-limit message');
            action('Copy'); await until(() => copied === payload, 'oversized block still copies');
            check(copied === payload, 'QR size error leaves exact copying usable');
            action('Edit'); d.querySelector('#new-text').value = 'Shortened'; click('#add-button');
            check(decodeQR()?.data === 'Shortened', 'shortening oversized block recovers visible QR');
        }
        await importJSON(JSON.stringify([{ text: '\ud800' }])); action('Show QR');
        check(!d.querySelector('.qr-code') && d.querySelector('.qr-error').textContent.includes('invalid Unicode'), 'invalid surrogate is rejected instead of silently changing QR data');
        click('#clear-button');
        add('Tagged', 'Hello', ' ##Work, # #work, work, , urgent, #, URGENT, 日本語 ');
        check(JSON.stringify(stored()[0].tags) === JSON.stringify(['Work', 'urgent', '日本語']), 'tags trim prefixes, empties and case-insensitive duplicates');
        check([...d.querySelectorAll('.tag-chip')].map(el => el.textContent).join('|') === 'Work|urgent|日本語', 'tag chips display separate metadata safely');
        action('Copy'); await until(() => copied === 'Hello', 'copy tagged block');
        check(copied === 'Hello', 'tag metadata never enters copied body');
        action('Show QR'); check(decodeQR()?.data === 'Hello', 'tag metadata never enters QR payload');
        const taggedSnapshot = JSON.stringify(stored());
        await reload();
        check(JSON.stringify(stored()) === taggedSnapshot && d.querySelectorAll('.tag-chip').length === 3, 'tags survive real reload');
        action('Edit');
        check(d.querySelector('#block-tags').value === 'Work, urgent, 日本語', 'editor loads stored tags');
        d.querySelector('#block-tags').value = 'cancelled'; click('#cancel-edit');
        check(d.querySelector('#block-tags').value === '' && JSON.stringify(stored()) === taggedSnapshot, 'cancel clears editor without changing saved tags');
        action('Edit'); d.querySelector('#block-tags').value = 'changed'; click('#add-button');
        check(stored()[0].text === 'Hello' && stored()[0].tags.join() === 'changed', 'editing tags leaves body unchanged');
        filterBy('#CHANGED');
        action('Edit'); d.querySelector('#block-tags').value = ''; click('#add-button');
        check(stored()[0].tags.length === 0 && !d.querySelector('.tag-chip') && d.querySelector('#tag-filter').dataset.activeTag === '', 'removing final tag clears chips and stale filter');
        const legacyBody = '  Literal #example 🍒\nhttps://example.com/#fragment  ';
        await importJSON(JSON.stringify([{ title: '#TitleTag', text: legacyBody }]));
        check(stored()[0].text === legacyBody && stored()[0].title === '#TitleTag' && stored()[0].tags.length === 0, 'legacy import defaults tags without changing text or title');
        check(!d.querySelector('[data-tag-filter]'), 'body/title hashtags and URL fragments do not create metadata tags');
        // Verify old browser storage follows the same migration without rewriting it on load.
        const legacyStored = JSON.stringify([{ title: '#TitleTag', text: legacyBody }]);
        w.localStorage.setItem('textBlocks', legacyStored); await reload();
        check(w.localStorage.getItem('textBlocks') === legacyStored && !d.querySelector('.tag-chip'), 'legacy storage is not rewritten or inferred on load');
        action('Edit'); d.querySelector('#block-tags').value = 'migrated'; click('#add-button');
        check(stored()[0].text === legacyBody && stored()[0].tags[0] === 'migrated', 'editing legacy tags preserves exact original body');
        const beforeInvalidTags = w.localStorage.getItem('textBlocks');
        for (const tags of [null, 'work', [42], [{}]]) {
            await importJSON(JSON.stringify([{ text: 'Should not replace', tags }]));
            check(w.localStorage.getItem('textBlocks') === beforeInvalidTags && d.querySelector('#backup-status').textContent.startsWith('Invalid backup.'), 'invalid tag schema preserves existing collection');
        }
        await importJSON(JSON.stringify([
            { title: 'HTML tag', text: 'Safe', tags: ['<img src=x onerror=alert(1)>', '日本語', 'Work'] },
            { title: 'Case variant', text: 'Still safe', tags: ['work'] },
            { title: 'URL-shaped tag', text: 'No links', tags: ['https://example.com/'] },
            { title: 'Actual link', text: 'https://example.com/', tags: [] }
        ]));
        check(!d.querySelector('.tag-chip img') && d.querySelector('.tag-chip').textContent === '<img src=x onerror=alert(1)>', 'HTML-like and Unicode tags remain inert labels');
        filterBy('#WORK'); check(d.querySelectorAll('.text-block').length === 2, 'case-insensitive tag filter matches casing variants');
        filterBy('#https://example.com/');
        check(d.querySelectorAll('.text-block').length === 1 && d.querySelector('.block-title').textContent === 'URL-shaped tag', 'URL-shaped tag cannot collide with link filter');
        check(![...d.querySelectorAll('[data-tag-filter]')].some(el => el.dataset.tagFilter.startsWith('link:')), 'URL-shaped metadata does not restore detected URL filtering');
        filterBy('');
        const tagBackup = JSON.stringify(stored());
        await importJSON(tagBackup);
        check(JSON.stringify(stored()) === tagBackup, 'tagged backup round trip preserves metadata and exact bodies');
        const chip = label => [...d.querySelectorAll('.tag-chip')].find(el => el.textContent.toLowerCase() === label.toLowerCase());
        let chipCopies = 0;
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { chipCopies++; } } });
        chip('Work').click();
        check(d.querySelector('#tag-filter').dataset.activeTag === 'tag:work' && d.querySelectorAll('.text-block').length === 2, 'chip activates matching tag filter');
        check([...d.querySelectorAll('.tag-chip')].filter(el => el.textContent.toLowerCase() === 'work').every(el => el.getAttribute('aria-pressed') === 'true'), 'all matching chip pressed states are synchronized');
        check(d.activeElement === chip('Work'), 'chip focus survives filtered render');
        check(w.getComputedStyle(chip('Work'), '::before').content.includes('✓'), 'selected chip has a non-color checkmark indicator');
        chip('work').click();
        check(d.querySelector('#tag-filter').dataset.activeTag === '' && d.querySelectorAll('.text-block').length === 4, 'repeat chip click clears filter');
        check(chipCopies === 0, 'chip clicks never copy body');
        // Browser protocol input invokes native button behavior, not synthetic key listeners.
        async function pressChipKey(key) {
            window.testKey = key;
            await until(() => window.testKey === null, `runner dispatches ${key}`);
        }
        chip('Work').focus(); await pressChipKey('Enter');
        check(d.querySelector('#tag-filter').dataset.activeTag === 'tag:work' && d.activeElement === chip('Work'), 'native Enter activates filter and retains focus');
        await pressChipKey('Space');
        check(d.querySelector('#tag-filter').dataset.activeTag === '' && d.activeElement === chip('Work'), 'native Space clears filter and retains focus');
        check(chipCopies === 0, 'keyboard chip activation never copies body');
        chip('Work').click(); chip('日本語').click();
        check(d.querySelector('#tag-filter').dataset.activeTag === 'tag:日本語' && d.querySelectorAll('.text-block').length === 1, 'different Unicode chip replaces active filter');
        filterBy('#WORK');
        check(chip('Work').getAttribute('aria-pressed') === 'true' && chip('日本語').getAttribute('aria-pressed') === 'false', 'filter strip changes refresh chip states');
        filterBy(''); chip('https://example.com/').click();
        check(d.querySelector('#tag-filter').dataset.activeTag === 'tag:https://example.com/' && d.querySelector('.block-title').textContent === 'URL-shaped tag', 'URL-shaped chip selects tag namespace only');
        filterBy('');
        const dragChip = chip('Work'); const dragCard = dragChip.closest('.text-block');
        dragChip.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true }));
        const chipDrag = new w.DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new w.DataTransfer() });
        dragChip.dispatchEvent(chipDrag);
        check(!dragCard.draggable && chipDrag.defaultPrevented && !dragCard.classList.contains('dragging'), 'chip pointer press cannot initiate ancestor drag');
        dragChip.dispatchEvent(new w.PointerEvent('pointerup', { bubbles: true }));
        check(dragCard.draggable, 'chip pointer release restores ordinary card dragging');
        check(parseFloat(w.getComputedStyle(dragChip).fontSize) < parseFloat(w.getComputedStyle(dragCard).fontSize) && dragChip.getBoundingClientRect().height >= 28, 'chip is visually smaller with usable click height');
        frame.style.width = '320px';
        check([...d.querySelectorAll('.tag-chip')].every(el => el.scrollWidth <= el.clientWidth + 1), 'chips wrap without overflow at 320px');
        await importJSON(JSON.stringify([{ title: 'Both', text: 'https://example.org/', tags: ['shared'] }, { title: 'Tag only', text: 'Plain', tags: ['SHARED'] }]));
        chip('shared').click();
        check(d.querySelector('#tag-filter').dataset.activeTag === 'tag:shared' && d.querySelectorAll('.text-block').length === 2, 'chip selects shared tag across notes with and without URLs');
        await importJSON(JSON.stringify([{ text: 'Replacement', tags: ['replacement'] }]));
        check(d.querySelector('#tag-filter').dataset.activeTag === '' && chip('replacement').getAttribute('aria-pressed') === 'false', 'import clears missing selected tag and pressed state');
        chip('replacement').click(); action('Edit'); d.querySelector('#block-tags').value = ''; click('#add-button');
        check(d.querySelector('#tag-filter').dataset.activeTag === '' && !d.querySelector('.tag-chip'), 'editing away final active chip restores All blocks');
        const setColorField = (selector, value) => {
            const field = d.querySelector(selector); field.value = value;
            field.dispatchEvent(new w.Event('input', { bubbles: true }));
        };
        check(!d.querySelector('.color-dot, .color-option, #color-button'), 'preset color selectors are replaced');
        setColorField('#note-color-picker', '#123456');
        check(d.querySelector('#note-color-hex').value === '#123456', 'note picker synchronizes HEX field');
        setColorField('#note-color-hex', 'aabbcc');
        check(d.querySelector('#note-color-picker').value === '#aabbcc' && d.querySelector('#note-color-hex').value === '#AABBCC', 'HEX entry normalizes and updates picker');
        const beforeBadHex = JSON.stringify(stored());
        setColorField('#note-color-hex', '#12');
        add('Invalid draft', 'Must not save');
        check(d.querySelector('#note-color-hex').getAttribute('aria-invalid') === 'true' && !!d.querySelector('#note-color-error').textContent && JSON.stringify(stored()) === beforeBadHex, 'incomplete HEX shows validation and prevents saving');
        check(d.querySelector('#note-color-picker').value === '#aabbcc', 'invalid input preserves last valid picker color');
        setColorField('#note-color-hex', '#000000');
        click('#clear-button'); add('Dark', 'Color never enters copied text', 'dark');
        check(stored()[0].color === '#000000' && d.querySelector('.note-color-value').textContent === '#000000', 'note saves canonical HEX and displays color label');
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied = value; } } });
        action('Copy'); await until(() => copied === 'Color never enters copied text', 'copy colored note');
        check(copied === 'Color never enters copied text', 'color label stays out of copied text');
        action('Show QR'); check(decodeQR()?.data === 'Color never enters copied text', 'color label stays out of QR data');
        setColorField('#note-color-hex', '#ABCDEF');
        action('Edit');
        check(d.querySelector('#note-color-hex').value === '#000000', 'editing loads stored note color');
        setColorField('#note-color-hex', '#ffffff'); click('#cancel-edit');
        check(stored()[0].color === '#000000' && d.querySelector('#note-color-hex').value === '#ABCDEF', 'cancel preserves saved color and restores creator color');
        action('Edit'); setColorField('#note-color-hex', '#FF0000'); click('#add-button');
        check(stored()[0].color === '#FF0000' && d.querySelector('.note-color-value').textContent === '#FF0000', 'edit saves changed color and refreshes label');
        setColorField('#background-color-hex', '#102030');
        check(d.querySelector('#background-color-picker').value === '#102030' && w.localStorage.getItem('preferredColor') === '#102030' && stored()[0].color === '#FF0000', 'background HEX persists without modifying notes');
        setColorField('#background-color-hex', 'not-a-color');
        check(w.localStorage.getItem('preferredColor') === '#102030' && w.getComputedStyle(d.body).backgroundColor === 'rgb(16, 32, 48)', 'invalid background input retains applied color');
        setColorField('#background-color-picker', '#fedcba');
        check(d.querySelector('#background-color-hex').value === '#FEDCBA' && d.querySelector('#background-color-error').textContent === '', 'picker recovers invalid background HEX state');
        await reload();
        check(stored()[0].color === '#FF0000' && d.querySelector('#background-color-hex').value === '#FEDCBA', 'note and page colors survive reload');
        const legacyColors = ['#abc', 'rgb(12, 34, 56)', 'navy', 'rgba(1, 2, 3, 0.5)', 'transparent'];
        await importJSON(JSON.stringify(legacyColors.map(color => ({ text: 'Legacy', color }))));
        check(stored().map(block => block.color).join() === '#AABBCC,#0C2238,#000080,#F8F8F8,#F8F8F8', 'legacy HEX RGB names and transparency normalize deterministically');
        const colorBackup = JSON.stringify(stored()); await importJSON(colorBackup);
        check(JSON.stringify(stored()) === colorBackup, 'normalized colors round trip through backup');
        w.localStorage.setItem('preferredColor', 'rgba(0, 0, 0, 0.5)'); await reload();
        check(d.querySelector('#background-color-hex').value === '#F0F0F0', 'legacy transparent background uses opaque page default');
        const palette = ['#000000', '#FFFFFF', '#777777', '#FF0000', '#00FF00', '#0000FF'];
        await importJSON(JSON.stringify(palette.map(color => ({ title: 'Contrast', text: 'https://example.org/', color, tags: ['contrast'] }))));
        const luminance = css => {
            const channels = css.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
            return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        };
        const contrast = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        for (const card of d.querySelectorAll('.text-block')) {
            const background = luminance(w.getComputedStyle(card).backgroundColor);
            check(['.block-title', '.text-content', '.link-list a'].every(selector => contrast(luminance(w.getComputedStyle(card.querySelector(selector)).color), background) >= 4.5), `readable title body and link contrast on ${card.querySelector('.note-color-value').textContent}`);
            check(['.tag-chip', '.note-color-value', '.block-actions button'].every(selector => {
                const style = w.getComputedStyle(card.querySelector(selector));
                return contrast(luminance(style.color), luminance(style.backgroundColor)) >= 4.5;
            }), 'chips labels and controls have readable opaque surfaces');
        }
        check(d.documentElement.scrollWidth <= w.innerWidth, 'color controls fit the 320px viewport');
        check(['note-color', 'background-color'].every(prefix => ['picker', 'hex'].every(suffix => {
            const field = d.querySelector(`#${prefix}-${suffix}`); field.focus();
            return d.activeElement === field && field.labels.length === 1;
        })), 'color inputs are focusable with explicit labels');
        const editFixtures = [
            { title: 'First', text: 'First body', tags: ['first'], color: '#FFFFFF' },
            { title: 'Second', text: 'https://example.org/second', tags: ['second'], color: '#000000' },
            { title: 'Third', text: 'Third body', tags: ['third'], color: '#FF0000' }
        ];
        await importJSON(JSON.stringify(editFixtures));
        const cardAction = (name, label) => {
            const card = [...d.querySelectorAll('.text-block')].find(el => el.querySelector('.block-title').textContent === name);
            [...card.querySelectorAll('.block-actions button')].find(el => el.textContent === label).click();
        };
        const displayOrder = () => [...d.querySelectorAll('.block-title')].map(el => el.textContent).join(',');
        const savedOrder = () => stored().map(block => block.title).join(',');
        cardAction('Second', 'Show QR');
        const originalEditStorage = w.localStorage.getItem('textBlocks');
        w.scrollTo(0, 120);
        const scrollBeforeEdit = w.scrollY;
        cardAction('Second', 'Edit');
        check(displayOrder() === 'Second,First,Third' && savedOrder() === 'First,Second,Third', 'editing promotes display without changing saved order');
        check(d.querySelectorAll('.is-editing').length === 1 && d.querySelector('.is-editing').getAttribute('aria-label').includes('Editing'), 'one edited card has visible and accessible state');
        check(d.activeElement === d.querySelector('#new-text'), 'starting edit focuses text entry');
        check(w.scrollY === scrollBeforeEdit, 'edit focus does not scroll the page');
        check(decodeQR()?.data === editFixtures[1].text, 'edit promotion preserves visible QR payload');
        check([...d.querySelectorAll('.text-block')].every(card => !card.draggable) && [...d.querySelectorAll('.block-actions button')].filter(el => el.textContent.startsWith('Move ')).every(el => el.disabled), 'all reordering is disabled during editing');
        const editDrag = new w.DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new w.DataTransfer() });
        d.querySelector('.is-editing').dispatchEvent(editDrag);
        check(editDrag.defaultPrevented && !d.querySelector('.dragging'), 'drag cannot reorder promoted editing card');
        let exportedWhileEditing;
        const originalCreateURL = w.URL.createObjectURL;
        const originalAnchorClick = w.HTMLAnchorElement.prototype.click;
        try {
            w.URL.createObjectURL = blob => { exportedWhileEditing = blob; return originalCreateURL.call(w.URL, blob); };
            w.HTMLAnchorElement.prototype.click = function () {};
            click('#export-button');
        } finally {
            w.URL.createObjectURL = originalCreateURL; w.HTMLAnchorElement.prototype.click = originalAnchorClick;
        }
        const editExport = JSON.parse(await exportedWhileEditing.text());
        check(editExport.map(block => block.title).join(',') === 'First,Second,Third' && editExport.every(block => !('editing' in block)), 'export uses saved order without edit presentation state');
        filterBy('#first');
        check(displayOrder() === 'Second,First' && d.querySelector('.editing-badge').textContent.includes('outside the current filter'), 'edited card stays first as explicit filter exception');
        check(d.querySelector('#block-count').textContent === '1 of 3 blocks match the filter (+1 editing block)', 'filter count separates matches from editing exception');
        check(d.querySelector('.is-editing .link-list a').href === 'https://example.org/second', 'editing exception retains detected links');
        click('#cancel-edit');
        check(displayOrder() === 'First' && !d.querySelector('.is-editing') && w.localStorage.getItem('textBlocks') === originalEditStorage, 'cancel restores filtered placement without writing storage');
        filterBy(''); cardAction('Third', 'Edit'); cardAction('First', 'Edit');
        check(displayOrder() === 'First,Second,Third' && d.querySelectorAll('.is-editing').length === 1 && d.querySelector('#block-title').value === 'First', 'switching edits transfers the highlight without duplication');
        click('#cancel-edit'); cardAction('Third', 'Edit');
        d.querySelector('#new-text').value = 'Saved third'; click('#add-button');
        check(displayOrder() === 'First,Second,Third' && savedOrder() === 'First,Second,Third' && stored()[2].text === 'Saved third' && !d.querySelector('.is-editing'), 'save updates original record and restores normal placement');
        cardAction('Second', 'Edit');
        window.testMotion = 'no-preference'; await until(() => window.testMotion === null, 'default motion preference');
        check(w.getComputedStyle(d.querySelector('.is-editing'), '::after').animationName === 'editing-dots' && w.getComputedStyle(d.querySelector('.is-editing'), '::after').pointerEvents === 'none', 'moving dotted outline does not intercept controls');
        window.testMotion = 'reduce'; await until(() => window.testMotion === null, 'reduced motion preference');
        check(w.getComputedStyle(d.querySelector('.is-editing'), '::after').animationName === 'none' && w.getComputedStyle(d.querySelector('.is-editing'), '::after').backgroundImage.includes('radial-gradient'), 'reduced motion keeps static dotted outline');
        check(d.documentElement.scrollWidth <= w.innerWidth, 'edited outline fits narrow layout');
        window.testMotion = 'no-preference'; await until(() => window.testMotion === null, 'restore motion preference');
        cardAction('Second', 'Delete');
        check(!d.querySelector('.is-editing') && d.querySelector('#cancel-edit').hidden && savedOrder() === 'First,Third', 'deleting edited record ends edit session with correct order');
        cardAction('Third', 'Edit');
        w.confirm = () => false; await importJSON(JSON.stringify([{ text: 'Cancelled import' }]));
        check(!!d.querySelector('.is-editing'), 'cancelled import preserves editing state');
        w.confirm = () => true; await importJSON(JSON.stringify([{ title: 'Imported', text: 'New collection' }]));
        check(!d.querySelector('.is-editing') && d.querySelector('#cancel-edit').hidden, 'confirmed replacement import clears edit state');
        action('Edit'); click('#clear-button');
        check(!d.querySelector('.is-editing') && stored().length === 0 && d.querySelector('#cancel-edit').hidden, 'clear ends editing and removes promoted card');
        add('Badge save', 'Original body', 'original'); action('Edit');
        let badgeCopies = 0;
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { badgeCopies++; } } });
        check(d.querySelector('.editing-badge').tagName === 'BUTTON' && d.querySelector('.editing-badge').getAttribute('aria-label').startsWith('Save changes'), 'Editing label is an accessible save button');
        d.querySelector('#new-text').value = '   '; click('.editing-badge');
        check(stored()[0].text === 'Original body' && !!d.querySelector('.is-editing'), 'Editing save respects empty-body validation');
        d.querySelector('#new-text').value = 'New body'; setColorField('#note-color-hex', '#12'); click('.editing-badge');
        check(stored()[0].text === 'Original body' && !!d.querySelector('.is-editing'), 'Editing save respects HEX validation');
        setColorField('#note-color-hex', '#123456');
        d.querySelector('#block-title').value = 'Updated title'; d.querySelector('#block-tags').value = 'updated';
        d.querySelector('.editing-badge').focus(); await pressChipKey('Enter');
        check(stored()[0].text === 'New body' && stored()[0].title === 'Updated title' && stored()[0].tags[0] === 'updated' && stored()[0].color === '#123456', 'Editing button saves all current editor fields via native Enter');
        check(!d.querySelector('.is-editing') && badgeCopies === 0, 'Editing save exits edit state without copying');
        action('Edit'); d.querySelector('#new-text').value = 'Mouse save'; click('.editing-badge');
        check(stored()[0].text === 'Mouse save' && !d.querySelector('.is-editing') && badgeCopies === 0, 'clicking Editing saves without copying');
        const manyTags = [
            { title: 'One', text: 'one', tags: ['Alpha', 'alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', '日本語'] },
            { title: 'Two', text: 'two', tags: ['ALPHA', 'Beta', 'Gamma'] },
            { title: 'Three', text: 'three', tags: ['alpha', 'Beta'] },
            { title: 'Four', text: 'four', tags: ['alpha'] }
        ];
        frame.style.width = '1200px';
        await importJSON(JSON.stringify(manyTags));
        await until(() => d.querySelectorAll('#popular-tags button').length === 5, 'wide-screen suggestions');
        const suggestionKeys = () => [...d.querySelectorAll('#popular-tags [data-tag-filter]')].map(el => el.dataset.tagFilter);
        const tagCount = key => [...d.querySelectorAll('[data-tag-filter]')].find(el => el.dataset.tagFilter === 'tag:' + key)?.querySelector('.tag-count').textContent;
        check(suggestionKeys().join() === 'tag:alpha,tag:beta,tag:gamma,tag:delta,tag:epsilon', 'wide strip ranks five frequent tags with deterministic ties');
        check(tagCount('alpha') === '4' && tagCount('beta') === '3', 'counts deduplicate casing variants once per note');
        check(!d.querySelector('#more-tags').open && !d.querySelector('#more-tags').hidden, 'overflow tags are collapsed by default');
        filterBy('#gamma');
        check(tagCount('alpha') === '4' && tagCount('beta') === '3' && d.querySelectorAll('.text-block').length === 2, 'filtering does not shrink global tag counts');
        filterBy('#zeta');
        check(d.querySelector('#active-tag [data-tag-filter]').dataset.tagFilter === 'tag:zeta', 'selected overflow tag stays visible outside suggestions');
        d.querySelector('#more-tags').open = false;
        check(d.querySelector('#active-tag button').getAttribute('aria-pressed') === 'true', 'collapsing overflow keeps active filter visible');
        d.querySelector('#active-tag button').click();
        check(d.querySelector('#tag-filter').dataset.activeTag === '' && d.querySelectorAll('.text-block').length === 4, 'active overflow chip toggles filter off');
        d.querySelector('#more-tags').open = true;
        const searchTags = value => {
            const field = d.querySelector('#tag-search'); field.focus(); field.value = value; field.dispatchEvent(new w.Event('input'));
        };
        searchTags('日本');
        check(d.querySelectorAll('#more-tag-list button').length === 1 && d.querySelector('#more-tag-list button').dataset.tagFilter === 'tag:日本語' && d.activeElement === d.querySelector('#tag-search'), 'expanded search supports Unicode and preserves typing focus');
        searchTags('missing'); check(!d.querySelector('#tag-search-empty').hidden, 'tag search reports no matches');
        searchTags('ALPHA'); check(d.querySelector('#more-tag-list button').dataset.tagFilter === 'tag:alpha', 'search finds popular tags case-insensitively');
        searchTags('');
        filterBy('#zeta');
        add('Five', 'extra', 'Zeta');
        check(tagCount('zeta') === '2' && suggestionKeys().includes('tag:zeta') && d.querySelector('#tag-filter').dataset.activeTag === 'tag:zeta', 'saving tags updates rank and count without clearing selection');
        const countBeforeDraft = tagCount('zeta'); d.querySelector('#block-tags').value = 'zeta, draft-only';
        check(tagCount('zeta') === countBeforeDraft && !tagCount('draft-only'), 'unsaved drafts do not affect tag statistics');
        frame.style.width = '320px';
        await until(() => d.querySelectorAll('#popular-tags button').length === 3, 'compact suggestions');
        check(d.querySelector('#active-tag button')?.dataset.tagFilter === 'tag:zeta', 'active tag remains visible when responsive limit shrinks');
        check(d.documentElement.scrollWidth <= w.innerWidth, 'collapsible tag strip fits 320px');
        filterBy('');
        const popular = d.querySelector('#popular-tags button'); popular.focus(); await pressChipKey('Enter');
        check(d.querySelector('#tag-filter').dataset.activeTag === 'tag:alpha' && d.activeElement.dataset.tagFilter === 'tag:alpha', 'native keyboard selection preserves strip focus');
        await pressChipKey('Space'); check(d.querySelector('#tag-filter').dataset.activeTag === '', 'native Space clears strip selection');
        filterBy('#zeta'); cardAction('Five', 'Delete');
        check(tagCount('zeta') === '1' && d.querySelector('#active-tag button')?.dataset.tagFilter === 'tag:zeta', 'delete updates counts while retaining a lower-ranked active tag');
        action('Edit'); d.querySelector('#block-tags').value = 'alpha'; click('#add-button');
        check(!tagCount('zeta') && d.querySelector('#tag-filter').dataset.activeTag === '', 'removing final selected tag clears selection and suggestions');
        await importJSON(JSON.stringify([{ text: 'https://example.org/', tags: [] }]));
        check(!d.querySelector('[data-tag-filter]') && d.querySelector('#more-tags').hidden && !!d.querySelector('.block-links a'), 'zero tags hide tag clutter while keeping detected links usable');
        click('#clear-button');
        check(d.querySelector('#all-tags').textContent === 'All (0)' && !d.querySelector('[data-tag-filter]'), 'clearing notes resets all tag quantities');
        await importJSON(JSON.stringify([
            { title: 'Source', text: 'Source body', color: '#123456', tags: ['shared'] },
            { title: 'Target', text: 'Target body', color: '#ABCDEF', tags: ['shared'] }
        ]));
        const colorButton = name => [...d.querySelectorAll('.text-block')].find(card => card.querySelector('.block-title').textContent === name).querySelector('.note-color-value');
        let colorCopies = 0;
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { colorCopies++; } } });
        const beforeColorReuse = w.localStorage.getItem('textBlocks');
        const originalBackground = w.localStorage.getItem('preferredColor');
        d.querySelector('#block-title').value = 'Unsaved draft'; d.querySelector('#new-text').value = 'Keep draft text'; d.querySelector('#block-tags').value = 'draft';
        setColorField('#note-color-hex', '#bad');
        w.scrollTo(0, 120); const beforeColorScroll = w.scrollY;
        colorButton('Source').click();
        check(d.querySelector('#note-color-picker').value === '#123456' && d.querySelector('#note-color-hex').value === '#123456', 'HEX button synchronizes note color controls');
        check(d.querySelector('#note-color-hex').getAttribute('aria-invalid') === 'false' && !d.querySelector('#note-color-error').textContent, 'HEX reuse clears invalid draft color');
        check(d.querySelector('#block-title').value === 'Unsaved draft' && d.querySelector('#new-text').value === 'Keep draft text' && d.querySelector('#block-tags').value === 'draft' && !d.querySelector('.is-editing'), 'color reuse preserves draft and does not enter edit mode');
        check(w.scrollY === beforeColorScroll && w.localStorage.getItem('textBlocks') === beforeColorReuse && colorCopies === 0, 'color reuse does not scroll save or copy');
        check(w.localStorage.getItem('preferredColor') === originalBackground, 'color reuse leaves page background unchanged');
        check(colorButton('Source').tagName === 'BUTTON' && colorButton('Source').getAttribute('aria-label') === 'Use note color #123456', 'HEX shortcut has native button semantics and descriptive name');
        for (const key of ['Enter', 'Space']) {
            setColorField('#note-color-hex', '#ffffff');
            colorButton('Source').focus({ preventScroll: true }); const keyScroll = w.scrollY;
            await pressChipKey(key);
            check(d.querySelector('#note-color-hex').value === '#123456' && w.scrollY === keyScroll && colorCopies === 0, `native ${key} reuses HEX without scrolling or copying`);
        }
        const colorDragButton = colorButton('Source'), colorCard = colorDragButton.closest('.text-block');
        colorDragButton.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true }));
        const colorDrag = new w.DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new w.DataTransfer() }); colorDragButton.dispatchEvent(colorDrag);
        check(colorDrag.defaultPrevented && !colorCard.draggable && !colorCard.classList.contains('dragging'), 'HEX button cannot initiate block dragging');
        colorDragButton.dispatchEvent(new w.PointerEvent('pointerup', { bubbles: true }));
        click('#add-button');
        check(stored()[2].color === '#123456' && stored()[2].text === 'Keep draft text', 'explicit Add applies reused color to draft');
        filterBy('#shared'); cardAction('Target', 'Edit'); colorButton('Source').click();
        check(d.querySelector('#tag-filter').dataset.activeTag === 'tag:shared' && d.querySelector('.is-editing .block-title').textContent === 'Target' && d.querySelector('#new-text').value === 'Target body', 'reuse while editing preserves selected filter and edit target');
        check(stored()[1].color === '#ABCDEF' && stored()[0].color === '#123456', 'reuse does not mutate source or target before Save');
        click('.editing-badge');
        check(stored()[1].color === '#123456' && stored()[0].color === '#123456' && stored()[1].text === 'Target body', 'explicit Save applies source color only to edited note');
        filterBy(''); frame.style.width = '1200px';
        await importJSON(JSON.stringify([
            { title: 'Short', text: 'Small note', tags: ['layout'] },
            { title: 'A longer title that must remain readable without clipping', text: 'Long text\n'.repeat(20), tags: ['layout', 'long'] },
            { title: 'Too large for QR', text: 'x'.repeat(2400), tags: ['oversize'] }
        ]));
        await new Promise(resolve => setTimeout(resolve, 40));
        click('[data-columns="2"]');
        const rect = element => element.getBoundingClientRect();
        check(Math.abs(rect(d.querySelector('#block-title')).top - rect(d.querySelector('#block-tags')).top) < 2, 'title and tags are adjacent on desktop');
        check(rect(d.querySelector('.editor-actions')).left > rect(d.querySelector('.editor-footer .color-control')).left, 'editor color and save controls share a compact row');
        const layoutCards = [...d.querySelectorAll('.text-block')];
        for (const card of layoutCards) {
            const topButtons = [...card.querySelectorAll('.block-top-actions button')];
            check(topButtons.map(button => button.textContent).join() === 'Copy,Edit,Delete' && card.firstElementChild.classList.contains('block-top-actions'), 'copy edit delete occupy the first visual and DOM row');
            check(Math.max(...topButtons.map(button => rect(button).width)) - Math.min(...topButtons.map(button => rect(button).width)) < 2, 'top action widths are evenly distributed');
            check(rect(card.querySelector('.block-title')).top >= rect(card.querySelector('.block-top-actions')).bottom, 'top controls do not overlap title');
            check(card.lastElementChild.classList.contains('block-footer') && card.querySelector('.block-move-actions').children.length === 2, 'footer retains temporary keyboard movement controls');
        }
        check(Math.abs(rect(layoutCards[0].querySelector('.block-footer')).bottom - rect(layoutCards[1].querySelector('.block-footer')).bottom) < 2, 'unequal-height content keeps neighboring footers aligned');
        cardAction('Short', 'Show QR');
        const firstCard = d.querySelector('.text-block');
        check(rect(firstCard.querySelector('.qr-view')).bottom <= rect(firstCard.querySelector('.block-footer')).top, 'QR image stays above bottom control rows');
        check(Math.abs(rect(firstCard.querySelector('.block-footer')).bottom - rect(layoutCards[1].querySelector('.block-footer')).bottom) < 2, 'opening QR keeps row footers aligned');
        cardAction('Too large for QR', 'Show QR');
        check(layoutCards[2].querySelector('.qr-error') && rect(layoutCards[2].querySelector('.qr-view')).bottom <= rect(layoutCards[2].querySelector('.block-footer')).top, 'QR error remains content above controls');
        firstCard.querySelector('.block-top-actions button').focus();
        await pressChipKey('Tab'); check(d.activeElement.textContent === 'Edit', 'native Tab follows visual top action order to Edit');
        await pressChipKey('Tab'); check(d.activeElement.textContent === 'Delete', 'native Tab follows visual top action order to Delete');
        frame.style.width = '320px'; await new Promise(resolve => setTimeout(resolve, 40));
        check(d.documentElement.scrollWidth <= w.innerWidth, 'compact header editor and cards fit 320px');
        check(rect(d.querySelector('#block-tags')).top > rect(d.querySelector('#block-title')).bottom, 'editor fields stack in DOM order on narrow screens');
        check([...d.querySelectorAll('.block-actions button')].every(button => rect(button).height >= 32 && button.scrollWidth <= button.clientWidth + 1), 'compact actions preserve usable height and wrap labels');
        frame.style.width = '1200px'; d.body.style.zoom = '2';
        await new Promise(resolve => setTimeout(resolve, 40));
        check(d.documentElement.scrollWidth <= w.innerWidth, 'layout fits at 200 percent CSS zoom');
        check([...d.querySelectorAll('.text-block')].every(card => rect(card.querySelector('.block-title')).top >= rect(card.querySelector('.block-top-actions')).bottom), 'enlarged rendering preserves title/action separation');
        d.body.style.zoom = '';
        // Backups require a reviewed preview and preserve drafts until replacement succeeds.
        action('Edit');
        d.querySelector('#new-text').value = 'Unsaved backup draft';
        const backupBefore = w.localStorage.getItem('textBlocks');
        click('#backups-button');
        check(d.querySelector('#backups-dialog').open && d.activeElement.id === 'export-button', 'Backups opens a modal with export focus');
        await previewImport('{bad json');
        check(d.querySelector('#import-preview').hidden && d.querySelector('#backup-status').textContent.startsWith('Invalid backup.'), 'malformed backup reports inline error without replacement');
        await previewImport(JSON.stringify([{ text: 'New backup note' }]));
        check(d.querySelector('#import-summary').textContent.includes('backup.json: 1 valid notes'), 'backup preview shows filename and validated count');
        check(w.localStorage.getItem('textBlocks') === backupBefore && d.querySelector('#new-text').value === 'Unsaved backup draft', 'preview keeps stored notes and unsaved edit intact');
        check(d.activeElement.id === 'cancel-import', 'preview focuses the safe Cancel action');
        click('#cancel-import');
        check(d.querySelector('#import-preview').hidden && d.activeElement.id === 'import-button' && !d.querySelector('#file-input').value, 'Cancel resets file selection and returns import focus');
        await previewImport(JSON.stringify([{ text: 'New backup note' }]));
        const backupSet = w.Storage.prototype.setItem;
        w.Storage.prototype.setItem = () => { throw new w.DOMException('Full', 'QuotaExceededError'); };
        try { click('#replace-import'); } finally { w.Storage.prototype.setItem = backupSet; }
        check(w.localStorage.getItem('textBlocks') === backupBefore && d.querySelector('#new-text').value === 'Unsaved backup draft' && !!d.querySelector('.is-editing'), 'failed replacement preserves stored collection and active draft');
        check(d.querySelector('#backup-status').textContent.includes('try Replace again') && !d.querySelector('#import-preview').hidden, 'storage failure retains preview and offers recovery');
        click('#replace-import');
        check(stored().length === 1 && stored()[0].text === 'New backup note' && !d.querySelector('#new-text').value && !d.querySelector('.is-editing'), 'retry after storage recovery replaces notes and clears edit');
        await previewImport('[]');
        check(d.querySelector('#import-summary').textContent.includes('0 valid notes') && stored().length === 1, 'empty backup still requires confirmation');
        click('#replace-import');
        check(stored().length === 0 && d.querySelector('#backup-status').textContent === 'Imported 0 notes.', 'explicit empty replacement clears collection');
        frame.style.width = '320px';
        await previewImport(JSON.stringify([{ text: 'Narrow preview' }]));
        check(d.querySelector('#backups-dialog').scrollWidth <= d.querySelector('#backups-dialog').clientWidth && rect(d.querySelector('#backups-dialog')).right <= w.innerWidth, 'backup preview fits 320px');
        await pressChipKey('Escape');
        await until(() => !d.querySelector('#backups-dialog').open, 'Escape closes backups');
        check(d.activeElement.id === 'backups-button' && stored().length === 0, 'Escape cancels preview and returns focus without replacement');
        click('#backups-button');
        check(d.querySelector('#import-preview').hidden, 'reopening backups never retains stale replacement');
        click('#close-backups');
        if (new URLSearchParams(location.search).has('forceFailure')) check(false, 'intentional runner failure probe');
        output.dataset.status = 'passed';
        output.textContent = results.join('\n') + `\nALL PASSED (${results.length} assertions)`;
    } catch (error) {
        output.dataset.status = 'failed';
        output.textContent = results.join('\n') + '\nFAIL ' + error.stack;
    }
};

