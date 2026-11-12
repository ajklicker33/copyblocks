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
const action = label => [...d.querySelectorAll('.block-actions button')].find(b => b.dataset.label === label).click();
const status = () => d.querySelector('#status').textContent;
const stored = () => JSON.parse(w.localStorage.getItem('textBlocks'));
const setDensity = value => { const slider = d.querySelector('#density-slider'); slider.value = value; slider.dispatchEvent(new w.Event('input')); };
const keyHandle = (key, handle = d.querySelector('.drag-handle')) => handle.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
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
        check(!!d.querySelector('#density-slider') && !d.querySelector('#layout-button'), 'density slider replaces layout menu');
        setDensity(2); check(w.localStorage.getItem('preferredColumns') === '2', 'layout persists');
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
        keyHandle(' '); keyHandle('ArrowRight'); keyHandle(' ');
        check(d.querySelector('.block-title').textContent === 'Second', 'handle keyboard reordering persists');
        action('Edit'); click('#cancel-edit'); check(d.querySelector('#add-button').textContent === 'Add Text Block', 'cancel editing');
        keyHandle(' '); keyHandle('ArrowRight');
        check(!!d.querySelector('.drop-placeholder') && stored()[0].title === 'Second', 'keyboard placeholder previews without saving');
        keyHandle(' ');
        check(stored()[0].title === 'First #Work', 'keyboard drop commits insertion order');
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
        check(!dragCard.draggable, 'card body stays non-draggable after chip release');
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
            [...card.querySelectorAll('.block-actions button')].find(el => el.dataset.label === label).click();
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
        check([...d.querySelectorAll('.text-block')].every(card => !card.draggable) && [...d.querySelectorAll('.drag-handle')].every(el => el.disabled), 'all reordering is disabled during editing');
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
        check(displayOrder() === 'Second,First' && d.querySelector('.filter-exception').textContent.includes('outside the current filter'), 'edited card stays first as explicit filter exception');
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
        cardAction('Second', 'Cancel');
        check(savedOrder() === 'First,Second,Third', 'Cancel keeps the edited note');
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
        check(d.querySelector('[data-label=Save]').tagName === 'BUTTON' && d.querySelector('[data-label=Save]').getAttribute('aria-label').startsWith('Save changes'), 'Editing label is an accessible save button');
        d.querySelector('#new-text').value = '   '; click('[data-label=Save]');
        check(stored()[0].text === 'Original body' && !!d.querySelector('.is-editing'), 'Editing save respects empty-body validation');
        d.querySelector('#new-text').value = 'New body'; setColorField('#note-color-hex', '#12'); click('[data-label=Save]');
        check(stored()[0].text === 'Original body' && !!d.querySelector('.is-editing'), 'Editing save respects HEX validation');
        setColorField('#note-color-hex', '#123456');
        d.querySelector('#block-title').value = 'Updated title'; d.querySelector('#block-tags').value = 'updated';
        d.querySelector('[data-label=Save]').focus(); await pressChipKey('Enter');
        check(stored()[0].text === 'New body' && stored()[0].title === 'Updated title' && stored()[0].tags[0] === 'updated' && stored()[0].color === '#123456', 'Editing button saves all current editor fields via native Enter');
        check(!d.querySelector('.is-editing') && badgeCopies === 0, 'Editing save exits edit state without copying');
        action('Edit'); d.querySelector('#new-text').value = 'Mouse save'; click('[data-label=Save]');
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
        click('[data-label=Save]');
        check(stored()[1].color === '#123456' && stored()[0].color === '#123456' && stored()[1].text === 'Target body', 'explicit Save applies source color only to edited note');
        filterBy(''); frame.style.width = '1200px';
        await importJSON(JSON.stringify([
            { title: 'Short', text: 'Small note', tags: ['layout'] },
            { title: 'A longer title that must remain readable without clipping', text: 'Long text\n'.repeat(20), tags: ['layout', 'long'] },
            { title: 'Too large for QR', text: 'x'.repeat(2400), tags: ['oversize'] }
        ]));
        await new Promise(resolve => setTimeout(resolve, 40));
        setDensity(2);
        const rect = element => element.getBoundingClientRect();
        check(Math.abs(rect(d.querySelector('#block-title')).top - rect(d.querySelector('#block-tags')).top) < 2, 'title and tags are adjacent on desktop');
        check(rect(d.querySelector('.editor-actions')).left > rect(d.querySelector('.editor-footer .color-control')).left, 'editor color and save controls share a compact row');
        const layoutCards = [...d.querySelectorAll('.text-block')];
        for (const card of layoutCards) {
            const topButtons = [...card.querySelectorAll('.block-top-actions button')];
            check(topButtons.map(button => button.textContent).join() === 'Copy,Edit,Delete' && card.firstElementChild.classList.contains('block-top-actions'), 'copy edit delete occupy the first visual and DOM row');
            check(Math.max(...topButtons.map(button => rect(button).width)) - Math.min(...topButtons.map(button => rect(button).width)) < 2, 'top action widths are evenly distributed');
            check(rect(card.querySelector('.block-title')).top >= rect(card.querySelector('.block-top-actions')).bottom, 'top controls do not overlap title');
            check(card.lastElementChild.classList.contains('block-footer') && !!card.querySelector('.drag-handle') && !card.querySelector('.block-move-actions'), 'footer provides one drag handle instead of movement buttons');
        }
        check(Math.abs(rect(layoutCards[0].querySelector('.block-footer')).bottom - rect(layoutCards[1].querySelector('.block-footer')).bottom) < 2, 'unequal-height content keeps neighboring footers aligned');
        cardAction('Short', 'Show QR');
        const firstCard = d.querySelector('.text-block');
        check(Math.abs(rect(firstCard.querySelector('.qr-view')).top + rect(firstCard.querySelector('.qr-view')).height / 2 - rect(firstCard).top - rect(firstCard).height / 2) < 2, 'QR overlay is vertically centered on its block');
        check(Math.abs(rect(firstCard.querySelector('.block-footer')).bottom - rect(layoutCards[1].querySelector('.block-footer')).bottom) < 2, 'opening QR keeps row footers aligned');
        cardAction('Too large for QR', 'Show QR');
        check(layoutCards[2].querySelector('.qr-error') && w.getComputedStyle(layoutCards[2].querySelector('.qr-view')).position === 'absolute', 'QR errors remain in the overlay without changing layout');
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
        await new Promise(resolve => { d.querySelector('#backups-dialog').addEventListener('close', resolve, { once: true }); click('#close-backups'); });
        // Native browser pointer/touch input targets the app iframe in an isolated profile.
        frame.style.position = 'fixed'; frame.style.inset = '0';
        frame.style.height = '700px'; frame.style.width = '1000px';
        const fixtures = Array.from({ length: 6 }, (_, i) => ({ title: `Drag ${i}`, text: 'Body ' + i + '\n'.repeat(i * 3), tags: ['drag'] }));
        const pointer = async (type, x = 0, y = 0) => {
            const frameRect = frame.getBoundingClientRect();
            window.testPointer = { type, x: frameRect.left + frame.clientLeft + x, y: frameRect.top + frame.clientTop + y };
            await until(() => window.testPointer === null, 'native ' + type);
        };
        const handleFor = title => [...d.querySelectorAll('.text-block')].find(card => card.querySelector('.block-title').textContent === title).querySelector('.drag-handle');
        const placeholderIndex = () => [...d.querySelector('#text-blocks').children].filter(el => !el.classList.contains('dragging')).indexOf(d.querySelector('.drop-placeholder'));
        const beginPointer = async (title, type = 'mousePressed') => {
            const handle = handleFor(title); handle.scrollIntoView({ block: 'center' });
            const r = rect(handle); await pointer(type, r.left + r.width / 2, r.top + r.height / 2);
        };
        let reorderCopies = 0;
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { reorderCopies++; } } });
        for (const columns of [1, 2, 3]) {
            await importJSON(JSON.stringify(fixtures)); setDensity(columns);
            handleFor('Drag 0').focus(); await pressChipKey('Space');
            check(d.querySelector('.drop-placeholder')?.children.length === 0 && d.querySelectorAll('.dragging').length === 1, `empty placeholder and distinct preview in ${columns} columns`);
            await pressChipKey('ArrowDown');
            check(placeholderIndex() === columns && stored()[0].title === 'Drag 0', `vertical keyboard move predicts destination across ${columns} columns`);
            await pressChipKey('Enter');
            check(stored()[columns].title === 'Drag 0' && d.activeElement === handleFor('Drag 0'), `native keyboard drop commits and restores focus in ${columns} columns`);
            await beginPointer('Drag 0');
            check(!!d.querySelector('.drop-placeholder'), `native mouse picks up handle in ${columns} columns`);
            w.scrollTo(0, d.querySelector('#text-blocks').offsetTop - 80);
            const first = rect([...d.querySelectorAll('.text-block:not(.dragging)')][0]);
            await pointer('mouseMoved', first.left + 12, first.top + 12);
            const target = placeholderIndex();
            const hole = rect(d.querySelector('.drop-placeholder'));
            await pointer('mouseReleased', hole.left + 12, Math.max(10, hole.top + 12));
            check(target === 0 && stored()[target].title === 'Drag 0' && !d.querySelector('.drop-placeholder'), `native mouse drop matches first-slot preview in ${columns} columns`);
        }
        const beforeCancel = w.localStorage.getItem('textBlocks');
        handleFor('Drag 0').focus(); await pressChipKey('Space'); await pressChipKey('ArrowRight'); await pressChipKey('Escape');
        check(w.localStorage.getItem('textBlocks') === beforeCancel && !d.querySelector('.dragging'), 'native Escape restores original order and removes preview');
        await beginPointer('Drag 0'); await pointer('mouseMoved', 1, 100); await pointer('mouseReleased', 1, 100);
        check(w.localStorage.getItem('textBlocks') === beforeCancel && !d.querySelector('.drop-placeholder'), 'outside drop cancels without saving');
        await beginPointer('Drag 0', 'touchStart');
        check(!!d.querySelector('.drop-placeholder'), 'native touch starts from handle');
        await pointer('touchCancel');
        check(!d.querySelector('.drop-placeholder') && w.localStorage.getItem('textBlocks') === beforeCancel, 'native touch cancellation cleans up without changing order');
        await beginPointer('Drag 0', 'touchStart');
        w.scrollTo(0, d.querySelector('#text-blocks').offsetTop - 100);
        const second = rect([...d.querySelectorAll('.text-block:not(.dragging)')][0]);
        await pointer('touchMove', second.right - 12, second.top + 12);
        const touchTarget = placeholderIndex();
        await pointer('touchEnd');
        check(touchTarget > 0 && stored()[touchTarget].title === 'Drag 0', 'native touch drop commits exactly the previewed insertion');
        check(reorderCopies === 0, 'pointer keyboard and touch reordering never copy notes');
        filterBy('#drag');
        check([...d.querySelectorAll('.drag-handle')].every(handle => handle.disabled), 'tag filtering disables drag handles'); filterBy('');
        handleFor('Drag 0').focus(); await pressChipKey('Space');
        await importJSON(JSON.stringify(fixtures));
        check(!d.querySelector('.drop-placeholder') && !d.querySelector('.dragging') && stored().length === 6, 'replacement import interrupts drag and removes transient state');
        frame.style.width = '320px'; await new Promise(resolve => setTimeout(resolve, 40));
        handleFor('Drag 0').focus(); await pressChipKey('Space'); await pressChipKey('ArrowDown');
        check(d.documentElement.scrollWidth <= w.innerWidth && placeholderIndex() === 1, 'drag placeholder fits 320px and follows single-column movement');
        await pressChipKey('Escape');
        frame.style.width = '1000px'; await new Promise(resolve => setTimeout(resolve, 40));
        setDensity(1);
        await beginPointer('Drag 0');
        const scrollStart = w.scrollY;
        const gridBounds = rect(d.querySelector('#text-blocks'));
        await pointer('mouseMoved', gridBounds.left + 30, w.innerHeight - 15);
        await until(() => w.scrollY > scrollStart + 50, 'edge scrolling moves viewport');
        check(!!d.querySelector('.drop-placeholder') && stored()[0].title === 'Drag 0', 'edge scrolling retains unsaved drag preview');
        // Release in the last slot after scrolling the remaining grid into view.
        w.scrollTo(0, d.body.scrollHeight);
        const lastCard = rect([...d.querySelectorAll('.text-block:not(.dragging)')].at(-1));
        await pointer('mouseMoved', lastCard.left + 30, lastCard.bottom - 20);
        const finalTarget = placeholderIndex();
        w.scrollTo(0, d.body.scrollHeight);
        const finalBounds = rect(d.querySelector('.drop-placeholder'));
        await pointer('mouseMoved', finalBounds.left + 30, Math.min(w.innerHeight - 80, finalBounds.top + finalBounds.height / 2));
        await pointer('mouseReleased', finalBounds.left + 30, Math.min(w.innerHeight - 80, finalBounds.top + finalBounds.height / 2));
        check(finalTarget === 5 && stored()[5].title === 'Drag 0', 'native drag reaches last slot after edge scrolling');
        const savedDragOrder = w.localStorage.getItem('textBlocks');
        handleFor('Drag 0').focus(); await pressChipKey('Space'); await pressChipKey('ArrowUp');
        const setBeforeDrop = w.Storage.prototype.setItem;
        w.Storage.prototype.setItem = () => { throw new w.DOMException('Full', 'QuotaExceededError'); };
        try { keyHandle('Enter', handleFor('Drag 0')); } finally { w.Storage.prototype.setItem = setBeforeDrop; }
        check(w.localStorage.getItem('textBlocks') === savedDragOrder && [...d.querySelectorAll('.block-title')].at(-1).textContent === 'Drag 0' && !d.querySelector('.drop-placeholder'), 'failed reorder save restores displayed and stored order');
        await beginPointer('Drag 0');
        const unchangedHandle = rect(handleFor('Drag 0'));
        await pointer('mouseReleased', unchangedHandle.left + unchangedHandle.width / 2, unchangedHandle.top + unchangedHandle.height / 2);
        check(w.localStorage.getItem('textBlocks') === savedDragOrder && !d.querySelector('.dragging'), 'same-position drop preserves order and clears preview');
        await reload();
        check(w.localStorage.getItem('textBlocks') === savedDragOrder && !d.querySelector('.drop-placeholder'), 'only committed drag order survives reload');
        frame.style.position = ''; frame.style.inset = '';
        await importJSON(JSON.stringify([{ title: 'Icons', text: 'Exact QR body', tags: ['icons'], color: '#000000' }, { title: 'Other', text: 'Untouched', color: '#FF0000' }]));
        action('Show QR'); filterBy('#icons'); action('Edit');
        d.querySelector('#new-text').value = 'Unsaved icon draft';
        const beforeIcons = w.localStorage.getItem('textBlocks');
        const saveControl = d.querySelector('[data-label=Save]'); saveControl.focus();
        click('#action-style-button');
        check(d.activeElement === saveControl && d.querySelector('[data-label=Save]') === saveControl, 'presentation toggle preserves existing action and focus');
        check(!d.querySelector('.editing-badge') && [...d.querySelectorAll('.block-top-actions button')].map(b => b.dataset.label).join(',') === 'Copy,Save,Cancel', 'edited top row substitutes Save Cancel without Editing badge');
        check(d.querySelector('#new-text').value === 'Unsaved icon draft' && d.querySelector('#tag-filter').dataset.activeTag === 'tag:icons' && decodeQR()?.data === 'Exact QR body', 'icons preserve draft filter and visible QR');
        check(w.localStorage.getItem('textBlocks') === beforeIcons && w.localStorage.getItem('actionIconMode') === 'true', 'icon preference is stored independently of note data');
        check([...d.querySelectorAll('.block-actions button')].every(b => b.querySelector('svg[aria-hidden=true]') && b.getAttribute('aria-label') && b.title), 'all icon actions have names tooltips and decorative SVGs');
        check(d.querySelector('.drag-handle').disabled && d.querySelector('.drag-handle').textContent.includes('Reorder'), 'icon mode retains labeled disabled reorder handle');
        check(w.getComputedStyle(d.querySelector('[data-label=Cancel]')).color === 'rgb(176, 0, 32)' && w.getComputedStyle(d.querySelector('[data-label=Cancel]')).backgroundColor === 'rgb(255, 255, 255)', 'Cancel uses readable red on white regardless of dark note');
        d.querySelector('#new-text').value = ' '; action('Save');
        check(!!d.querySelector('.is-editing') && stored()[0].text === 'Exact QR body', 'icon Save preserves empty-body validation');
        action('Cancel');
        check(!d.querySelector('.is-editing') && !d.querySelector('#new-text').value && stored()[0].text === 'Exact QR body', 'icon Cancel discards draft without deleting note');
        action('Hide QR'); check(!d.querySelector('.qr-view') && d.querySelector('[data-label="Show QR"]').getAttribute('aria-expanded') === 'false', 'icon QR hide updates accessible state');
        action('Show QR'); check(decodeQR()?.data === 'Exact QR body' && d.querySelector('[data-label="Hide QR"]').getAttribute('aria-expanded') === 'true', 'icon QR show preserves exact payload and state');
        action('Edit'); d.querySelector('#new-text').value = 'Saved by icon';
        d.querySelector('[data-label=Save]').focus(); await pressChipKey('Enter');
        check(stored()[0].text === 'Saved by icon' && !d.querySelector('.is-editing'), 'native Enter activates icon Save');
        const iconToggle = d.querySelector('#action-style-button'); iconToggle.focus(); await pressChipKey('Space');
        check(iconToggle.textContent === 'Use icons' && !d.querySelector('.icon-action') && d.activeElement === iconToggle, 'native Space restores words and retains toggle focus');
        click('#action-style-button'); await reload();
        check(d.querySelector('#action-style-button').textContent === 'Use words' && !!d.querySelector('.icon-action'), 'icon preference survives reload');
        await importJSON(JSON.stringify([{ text: 'Imported icons', color: '#FFFFFF' }]));
        check(!!d.querySelector('[data-label=Delete] svg') && w.getComputedStyle(d.querySelector('[data-label=Delete]')).color === 'rgb(176, 0, 32)', 'imported notes inherit icons and red Delete');
        add('New icon note', 'New body'); check(d.querySelectorAll('[data-label=Edit] svg').length === 2, 'new notes inherit icon preference');
        frame.style.width = '320px'; await new Promise(resolve => setTimeout(resolve, 40));
        check(d.documentElement.scrollWidth <= w.innerWidth && [...d.querySelectorAll('.icon-action')].every(b => b.getBoundingClientRect().height >= 32), 'icon controls fit 320px with usable hit areas');
        const iconSet = w.Storage.prototype.setItem;
        w.Storage.prototype.setItem = () => { throw new w.DOMException('Full', 'QuotaExceededError'); };
        try { click('#action-style-button'); } finally { w.Storage.prototype.setItem = iconSet; }
        check(!d.querySelector('.icon-action') && status().includes('Could not save'), 'unavailable storage still changes presentation and reports persistence failure');
        frame.style.position = 'fixed'; frame.style.inset = '0'; frame.style.width = '1000px';
        await importJSON(JSON.stringify([{ title: 'Backdrop', text: 'Keep body', tags: ['keep'] }, { text: 'Hidden note', tags: ['other'] }]));
        filterBy('#keep'); action('Edit'); d.querySelector('#new-text').value = 'Keep unsaved draft';
        const beforeBackdrop = w.localStorage.getItem('textBlocks');
        await previewImport(JSON.stringify([{ text: 'Do not import' }]));
        const dialog = d.querySelector('#backups-dialog');
        let bounds = rect(dialog);
        await pointer('mousePressed', bounds.left + 4, bounds.top + 4);
        await pointer('mouseReleased', bounds.left + 4, bounds.top + 4);
        check(dialog.open, 'empty space inside Backups does not dismiss');
        await pointer('mousePressed', bounds.left + 4, bounds.top + 4);
        await pointer('mouseMoved', 3, 3); await pointer('mouseReleased', 3, 3);
        check(dialog.open, 'dragging from panel to backdrop does not dismiss');
        await pointer('mousePressed', 3, 3);
        await pointer('mouseMoved', bounds.left + 4, bounds.top + 4); await pointer('mouseReleased', bounds.left + 4, bounds.top + 4);
        check(dialog.open, 'dragging from backdrop into panel does not dismiss');
        await pointer('mousePressed', 3, 3); await pointer('mouseReleased', 3, 3);
        await until(() => !dialog.open && d.activeElement.id === 'backups-button', 'backdrop dismissal and focus');
        check(d.querySelector('#import-preview').hidden && w.localStorage.getItem('textBlocks') === beforeBackdrop, 'outside click discards preview without replacing notes');
        check(d.querySelector('#new-text').value === 'Keep unsaved draft' && d.querySelector('#tag-filter').dataset.activeTag === 'tag:keep' && !!d.querySelector('.is-editing'), 'backdrop dismissal preserves draft filter and edit state');
        click('#backups-button');
        await pointer('touchStart', 3, 3); await pointer('touchCancel');
        check(dialog.open, 'cancelled backdrop touch does not dismiss');
        await pointer('touchStart', 3, 3); await pointer('touchEnd');
        await until(() => !dialog.open, 'touch backdrop dismissal');
        check(d.activeElement.id === 'backups-button', 'touch backdrop tap closes and restores focus');
        click('#backups-button');
        const originalFileText = w.File.prototype.text;
        let finishLateRead;
        w.File.prototype.text = () => new Promise(resolve => { finishLateRead = resolve; });
        try {
            const transfer = new w.DataTransfer(); transfer.items.add(new w.File(['[]'], 'late.json'));
            d.querySelector('#file-input').files = transfer.files;
            d.querySelector('#file-input').dispatchEvent(new w.Event('change'));
            await pointer('mousePressed', 3, 3); await pointer('mouseReleased', 3, 3);
            await until(() => !dialog.open, 'dismiss pending read');
            click('#backups-button'); finishLateRead('[]'); await new Promise(resolve => setTimeout(resolve, 20));
            check(d.querySelector('#import-preview').hidden && d.querySelector('#backup-status').textContent === '' && w.localStorage.getItem('textBlocks') === beforeBackdrop, 'late file read cannot populate reopened Backups or replace notes');
        } finally { w.File.prototype.text = originalFileText; }
        frame.style.width = '320px'; await new Promise(resolve => setTimeout(resolve, 40));
        await pointer('mousePressed', 2, 2); await pointer('mouseReleased', 2, 2);
        await until(() => !dialog.open, 'narrow backdrop dismissal');
        check(d.activeElement.id === 'backups-button' && d.querySelector('#new-text').value === 'Keep unsaved draft', '320px backdrop dismissal keeps draft and returns focus');
        frame.style.position = ''; frame.style.inset = '';
        await importJSON(JSON.stringify([{ title: 'Copy A', text: 'Exact body A', tags: ['copy'] }, { title: 'Copy B', text: 'Body B', tags: ['copy'] }]));
        const copiedValues = [];
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copiedValues.push(value); } } });
        const copyCards = [...d.querySelectorAll('.text-block')];
        const initialCopyBounds = rect(copyCards[0]);
        copyCards[0].click(); await until(() => !!copyCards[0].querySelector('.copy-overlay'), 'card copy overlay');
        const feedback = copyCards[0].querySelector('.copy-overlay');
        check(feedback.textContent === 'Copied!' && copiedValues[0] === 'Exact body A' && status() === 'Copied!', 'successful card copy shows local feedback and accessible status for exact body');
        check(rect(copyCards[0]).height === initialCopyBounds.height && Math.abs(rect(feedback).left + rect(feedback).width / 2 - initialCopyBounds.left - initialCopyBounds.width / 2) < 1, 'copy overlay is centered without layout shift');
        check(w.getComputedStyle(feedback).pointerEvents === 'none' && feedback.getAttribute('aria-hidden') === 'true', 'copy overlay does not intercept input or duplicate announcements');
        await new Promise(resolve => setTimeout(resolve, 850));
        copyCards[0].querySelector('[data-label=Copy]').click(); await new Promise(resolve => setTimeout(resolve, 20));
        copyCards[1].querySelector('[data-label=Copy]').click(); await new Promise(resolve => setTimeout(resolve, 750));
        check(d.querySelectorAll('.copy-overlay').length === 2 && copiedValues.join('|') === 'Exact body A|Exact body A|Body B', 'repeated copies restart timer and different cards retain independent feedback');
        await until(() => !d.querySelector('.copy-overlay'), 'copy feedback expires');
        check(!d.querySelector('.copy-overlay'), 'feedback disappears after brief timer');
        copyCards[0].click(); await until(() => !!d.querySelector('.copy-overlay'), 'feedback before failure');
        w.navigator.clipboard.writeText = async () => { throw new Error('Denied'); };
        copyCards[0].click(); await until(() => status().startsWith('Copy failed'), 'copy failure');
        check(!d.querySelector('.copy-overlay'), 'clipboard rejection clears prior success and shows no success overlay');
        w.navigator.clipboard.writeText = async () => {};
        filterBy('#copy'); action('Edit'); action('Show QR'); action('Copy');
        await until(() => !!d.querySelector('.copy-overlay'), 'editing copy feedback');
        check(!!d.querySelector('.is-editing .copy-overlay') && decodeQR()?.data === 'Exact body A', 'feedback works while filtered editing and showing QR');
        action('Cancel'); check(!d.querySelector('.copy-overlay'), 'rerender clears feedback');
        let finishCopy;
        w.navigator.clipboard.writeText = () => new Promise(resolve => { finishCopy = resolve; });
        action('Copy'); action('Delete'); finishCopy(); await new Promise(resolve => setTimeout(resolve, 20));
        check(!d.querySelector('.copy-overlay') && stored().length === 1, 'late copy completion cannot show feedback for a deleted card');
        const multiBody = 'https://example.org/one https://example.org/two https://example.org/one https://example.org/three';
        await importJSON(JSON.stringify([{ title: 'Links', text: multiBody }]));
        const qrCard = d.querySelector('.text-block'); const closedHeight = rect(qrCard).height;
        action('Show QR');
        let qrSelect = d.querySelector('.qr-view select');
        check([...qrSelect.options].map(o => o.text).join('|') === 'Full text QR|Link 1|Link 2|Link 3' && d.querySelector('.block-links ol').children.length === 3, 'multiple distinct links share numbered list and code identifiers');
        check(decodeQR()?.data === 'https://example.org/one' && qrSelect.value === '1', 'QR defaults to first detected link');
        qrSelect.value = '0'; qrSelect.dispatchEvent(new w.Event('change'));
        check(decodeQR()?.data === multiBody && rect(qrCard).height === closedHeight, 'full text QR stays exact and opening overlay preserves block size');
        for (let i = 1; i <= 3; i++) {
            qrSelect.value = String(i); qrSelect.dispatchEvent(new w.Event('change'));
            check(decodeQR()?.data === ['https://example.org/one', 'https://example.org/two', 'https://example.org/three'][i - 1], `independent decode matches Link ${i} without number in payload`);
        }
        check(!d.querySelector('.qr-view').textContent.includes('Scan to read'), 'redundant scan caption is removed');
        qrSelect.focus(); await pressChipKey('Escape');
        check(!d.querySelector('.qr-view') && d.activeElement.dataset.label === 'Show QR', 'Escape closes QR and restores opener focus');
        action('Show QR'); click('.qr-close');
        check(!d.querySelector('.qr-view') && d.activeElement.dataset.label === 'Show QR', 'Close dismisses QR and restores opener focus');
        await importJSON(JSON.stringify([{ title: 'Single', text: 'https://example.org/solo https://example.org/solo' }]));
        action('Show QR'); qrSelect = d.querySelector('.qr-view select');
        check([...qrSelect.options].map(o => o.text).join('|') === 'Full text QR|Link' && !!d.querySelector('.block-links ul'), 'one distinct link is unnumbered even when repeated');
        qrSelect.value = '1'; qrSelect.dispatchEvent(new w.Event('change'));
        check(decodeQR()?.data === 'https://example.org/solo', 'single link code decodes exact normalized destination');
        frame.style.position = 'fixed'; frame.style.inset = '0';
        d.querySelector('.qr-view').scrollIntoView({ block: 'center' });
        let qrCopies = 0; w.navigator.clipboard.writeText = async () => { qrCopies++; };
        const panel = rect(d.querySelector('.qr-view'));
        await pointer('mousePressed', panel.left + 4, panel.top + 4); await pointer('mouseReleased', panel.left + 4, panel.top + 4);
        check(!!d.querySelector('.qr-view'), 'inside QR panel clicks do not dismiss');
        await pointer('mousePressed', 2, 2); await pointer('mouseReleased', 2, 2);
        check(!d.querySelector('.qr-view') && qrCopies === 0 && d.activeElement.dataset.label === 'Show QR', 'outside QR click closes without copying and restores focus');
        action('Show QR');
        await pointer('touchStart', 2, 2); await pointer('touchEnd');
        check(!d.querySelector('.qr-view') && qrCopies === 0 && !d.querySelector('.dragging'), 'outside QR tap dismisses without copying or dragging');
        action('Show QR');
        check(rect(d.querySelector('.qr-view')).width <= d.querySelector('.text-block').clientWidth + 2 && d.documentElement.scrollWidth <= w.innerWidth, 'QR panel fits narrow viewport');
        action('Edit'); d.querySelector('#new-text').value = 'https://example.org/new'; action('Save');
        qrSelect = d.querySelector('.qr-view select'); qrSelect.value = '1'; qrSelect.dispatchEvent(new w.Event('change'));
        check(decodeQR()?.data === 'https://example.org/new', 'editing replaces stale link QR payloads');
        frame.style.position = ''; frame.style.inset = '';
        await importJSON(JSON.stringify([
            { title: 'Alpha', text: 'Café 日本語 body', tags: ['work'] },
            { title: 'Beta', text: 'alpha in body', tags: ['home'] },
            { title: 'Gamma', text: 'Other', tags: ['ALPHA', 'work'] }
        ]));
        const beforeSearch = w.localStorage.getItem('textBlocks');
        d.querySelector('#new-text').focus(); await pressChipKey('Ctrl+F');
        const searchBox = d.querySelector('#note-search');
        check(!d.querySelector('#note-search-panel').hidden && d.activeElement === searchBox, 'native Ctrl F opens and focuses app search');
        const searchFor = value => { searchBox.value = value; searchBox.dispatchEvent(new w.Event('input')); };
        searchFor('ALPHA');
        check(d.querySelectorAll('.text-block').length === 3 && d.activeElement === searchBox, 'search matches title body and separate tags case-insensitively while retaining typing focus');
        check([...d.querySelectorAll('.drag-handle')].every(b => b.disabled), 'search disables reorder handles');
        filterBy('#work');
        check(d.querySelectorAll('.text-block').length === 2 && d.querySelector('#block-count').textContent.startsWith('2 of 3'), 'search and tag filters combine using AND with correct count');
        searchFor('日本語'); check(d.querySelectorAll('.text-block').length === 1, 'search supports Unicode body text');
        action('Edit'); searchFor('no matches');
        check(d.querySelectorAll('.text-block').length === 1 && !!d.querySelector('.is-editing .filter-exception') && d.querySelector('#block-count').textContent.startsWith('0 of 3'), 'nonmatching active edit stays visible as counted exception');
        d.querySelector('#new-text').value = 'Keep search draft';
        let searchExport;
        const searchCreateURL = w.URL.createObjectURL, searchAnchorClick = w.HTMLAnchorElement.prototype.click;
        try {
            w.URL.createObjectURL = blob => { searchExport = blob; return searchCreateURL.call(w.URL, blob); };
            w.HTMLAnchorElement.prototype.click = () => {};
            click('#export-button');
        } finally { w.URL.createObjectURL = searchCreateURL; w.HTMLAnchorElement.prototype.click = searchAnchorClick; }
        check((await searchExport.text()) === JSON.stringify(stored(), null, 2) && stored().length === 3, 'export includes full saved collection while searching and editing');
        searchBox.focus(); await pressChipKey('Escape');
        check(d.querySelector('#note-search-panel').hidden && !searchBox.value && d.activeElement.id === 'new-text' && d.querySelector('#new-text').value === 'Keep search draft', 'Escape clears closes and restores focus without discarding edit');
        check(d.querySelector('#tag-filter').dataset.activeTag === 'tag:work' && w.localStorage.getItem('textBlocks') === beforeSearch, 'closing search preserves selected tag and saved notes');
        action('Cancel'); filterBy(''); click('#search-button'); searchFor('missing');
        check(!d.querySelector('.text-block') && !d.querySelector('#empty-state').hidden && d.querySelector('#empty-state').textContent.includes('No notes match'), 'empty search results explain how to recover');
        searchFor(''); check(d.querySelectorAll('.text-block').length === 3 && [...d.querySelectorAll('.drag-handle')].every(b => !b.disabled), 'clearing query restores all notes and reordering');
        const browserFind = new w.KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true });
        searchBox.focus(); searchBox.dispatchEvent(browserFind);
        check(!browserFind.defaultPrevented && d.querySelector('#note-search-help').textContent.includes('browser Find'), 'second Ctrl F in search passes through to discoverable browser Find');
        click('#close-search');
        const macFind = new w.KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true, cancelable: true });
        d.dispatchEvent(macFind);
        check(macFind.defaultPrevented && d.activeElement === searchBox, 'Cmd F also opens app search');
        click('#backups-button');
        const modalFind = new w.KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true });
        d.querySelector('#export-button').dispatchEvent(modalFind);
        check(!modalFind.defaultPrevented && d.querySelector('#backups-dialog').open, 'search shortcut is not intercepted in a modal');
        await new Promise(resolve => { d.querySelector('#backups-dialog').addEventListener('close', resolve, { once: true }); click('#close-backups'); });
        frame.style.width = '320px'; await new Promise(resolve => setTimeout(resolve, 40));
        check(d.documentElement.scrollWidth <= w.innerWidth, 'expanded search fits 320px');
        click('#close-search');
        await importJSON(JSON.stringify([{ title: 'Pinned QR', text: 'Body https://example.org/pinned trailing text', tags: ['pin'] }]));
        action('Show QR');
        const qrPayloads = []; w.navigator.clipboard.writeText = async value => { qrPayloads.push(value); };
        click('.qr-code'); await until(() => qrPayloads.length === 1, 'QR click copy');
        check(qrPayloads[0] === 'https://example.org/pinned' && !!d.querySelector('.qr-view'), 'clicking link QR copies its destination without closing');
        let pinnedSelect = d.querySelector('.qr-view select'); pinnedSelect.value = '0'; pinnedSelect.dispatchEvent(new w.Event('change'));
        d.querySelector('.qr-copy').focus(); await pressChipKey('Enter');
        check(qrPayloads.length === 2 && qrPayloads[1] === stored()[0].text, 'keyboard QR activation copies exact selected full text once');
        click('.qr-pin');
        check(d.querySelector('.qr-pin').getAttribute('aria-pressed') === 'true' && rect(d.querySelector('.qr-pin')).left < rect(d.querySelector('.qr-close')).left && w.getComputedStyle(d.querySelector('.qr-close')).color === 'rgb(176, 0, 32)', 'pin sits top left opposite accessible red X with pressed state');
        frame.style.position = 'fixed'; frame.style.inset = '0';
        await pointer('mousePressed', 2, 2); await pointer('mouseReleased', 2, 2);
        check(!!d.querySelector('.qr-view'), 'pinned QR survives outside click');
        pinnedSelect.focus(); await pressChipKey('Escape');
        check(!!d.querySelector('.qr-view'), 'pinned QR survives Escape');
        filterBy('#pin');
        check(d.querySelector('.qr-pin').getAttribute('aria-pressed') === 'true' && d.querySelector('.qr-view select').value === '0', 'pin and selected payload survive unrelated render');
        click('.qr-close');
        check(!d.querySelector('.qr-view') && d.activeElement.dataset.label === 'Show QR', 'red X closes pinned QR and restores focus');
        action('Show QR');
        check(d.querySelector('.qr-pin').getAttribute('aria-pressed') === 'false' && d.querySelector('.qr-view select').value === '1', 'explicit close resets pin and reopening defaults to link');
        click('.qr-pin'); click('.qr-pin'); d.querySelector('.qr-view select').focus(); await pressChipKey('Escape');
        check(!d.querySelector('.qr-view'), 'unpin restores normal Escape dismissal');
        frame.style.position = ''; frame.style.inset = '';
        filterBy(''); frame.style.width = '1800px';
        await until(() => Number(d.querySelector('#density-slider').max) >= 5, 'wide density capacity');
        let density = d.querySelector('#density-slider'); density.focus(); await pressChipKey('End');
        const widePreference = density.value;
        check(Number(widePreference) >= 5 && d.querySelector('#text-blocks').style.getPropertyValue('--columns') === widePreference, 'native End selects responsive maximum above old three-column limit');
        frame.style.width = '320px';
        await until(() => density.max === '1', 'narrow density clamp');
        check(density.value === '1' && w.localStorage.getItem('preferredColumns') === widePreference && d.documentElement.scrollWidth <= w.innerWidth, 'narrow viewport uses one column without overwriting wider preference');
        frame.style.width = '1800px'; await until(() => density.value === widePreference, 'restore wider preference');
        check(d.querySelector('#density-value').textContent === widePreference, 'widening restores preferred density and visible count');
        await reload(); density = d.querySelector('#density-slider');
        check(density.value === widePreference, 'density preference survives reload');
        density.focus(); await pressChipKey('Home');
        check(density.value === '1', 'native Home selects one column');
        await pressChipKey('ArrowRight'); check(density.value === '2' && density.getAttribute('aria-valuetext') === '2 columns', 'native arrow changes density with accessible count');
        await importJSON(JSON.stringify([{ title: 'Density A', text: 'https://example.org/long' }, { title: 'Density B', text: 'x'.repeat(1000) }]));
        action('Show QR'); click('.qr-pin');
        const densityQR = d.querySelector('.qr-view'); setDensity(3);
        check(d.querySelector('.qr-view') === densityQR && decodeQR()?.data === 'https://example.org/long' && d.querySelector('.qr-pin').getAttribute('aria-pressed') === 'true', 'live density preserves pinned QR view and payload');
        const densityOrder = w.localStorage.getItem('textBlocks');
        keyHandle(' '); check(!!d.querySelector('.drop-placeholder'), 'reorder starts before density change');
        setDensity(2); check(!d.querySelector('.drop-placeholder') && w.localStorage.getItem('textBlocks') === densityOrder, 'density change cancels reorder without saving preview');
        d.body.style.zoom = '2'; await new Promise(resolve => setTimeout(resolve, 60));
        check(d.documentElement.scrollWidth <= w.innerWidth && Number(density.value) <= Number(density.max), 'enlarged rendering clamps density and fits content');
        d.body.style.zoom = '';
        w.localStorage.setItem('preferredColumns', '3'); await reload();
        check(d.querySelector('#density-slider').value === '3', 'legacy three-column preference migrates unchanged');
        const priorityFixtures = [
            { title: 'Unranked P0', text: 'P0 only in body', tags: ['work'] },
            { title: 'Ten', text: 'match', tags: ['P10', 'work'] },
            { title: 'One', text: 'match', tags: ['p1', 'work'] },
            { title: 'Zero', text: 'match', tags: ['P99', 'P0', 'home'] },
            { title: 'Nine', text: 'match', tags: ['P9'] },
            { title: 'Tie', text: 'match', tags: ['P1', 'work'] },
            { title: 'Last priority', text: 'match', tags: ['P99'] },
            { title: 'Invalid', text: 'match', tags: ['P100', 'P-1', 'P01'] }
        ];
        await importJSON(JSON.stringify(priorityFixtures));
        const customPriorityOrder = stored().map(b => b.title).join('|');
        const visiblePriorityOrder = () => [...d.querySelectorAll('.block-title')].map(el => el.textContent).join('|');
        check(d.querySelector('#priority-toggle').getAttribute('aria-pressed') === 'false' && visiblePriorityOrder() === customPriorityOrder, 'custom arrangement is default view');
        click('#priority-toggle');
        check(visiblePriorityOrder() === 'Zero|One|Tie|Nine|Ten|Last priority|Unranked P0|Invalid', 'priority view sorts numeric tags with stable ties and unranked notes last');
        check(stored().map(b => b.title).join('|') === customPriorityOrder && [...d.querySelectorAll('.drag-handle')].every(b => b.disabled), 'priority view preserves custom storage and disables ambiguous dragging');
        filterBy('#work'); check(visiblePriorityOrder() === 'One|Tie|Ten|Unranked P0', 'tag filtering remains functional in priority view');
        click('#search-button'); d.querySelector('#note-search').value = 'match'; d.querySelector('#note-search').dispatchEvent(new w.Event('input'));
        check(visiblePriorityOrder() === 'One|Tie|Ten', 'search combines with priority and tag filtering');
        click('#priority-toggle'); check(visiblePriorityOrder() === 'Ten|One|Tie', 'deselect restores custom order within active filters');
        click('#close-search'); filterBy(''); click('#priority-toggle');
        let priorityExport;
        const priorityURL = w.URL.createObjectURL, priorityAnchor = w.HTMLAnchorElement.prototype.click;
        try {
            w.URL.createObjectURL = blob => { priorityExport = blob; return priorityURL.call(w.URL, blob); };
            w.HTMLAnchorElement.prototype.click = () => {}; click('#export-button');
        } finally { w.URL.createObjectURL = priorityURL; w.HTMLAnchorElement.prototype.click = priorityAnchor; }
        check(JSON.parse(await priorityExport.text()).map(b => b.title).join('|') === customPriorityOrder, 'export retains full custom order in priority view');
        const priorityToggle = d.querySelector('#priority-toggle');
        if (!priorityToggle.querySelector('svg')) click('#action-style-button');
        check(!!priorityToggle.querySelector('svg[aria-hidden=true]') && priorityToggle.getAttribute('aria-pressed') === 'true', 'priority toggle follows icon mode and retains pressed state');
        priorityToggle.focus(); await pressChipKey('Space');
        check(visiblePriorityOrder() === customPriorityOrder && d.activeElement === priorityToggle, 'native Space restores custom view and retains toggle focus');
        click('#priority-toggle'); action('Edit');
        d.querySelector('#block-tags').value = 'P98'; action('Save');
        check(visiblePriorityOrder().startsWith('One|Tie|Nine|Ten|Zero') && stored()[3].tags[0] === 'P98', 'editing priority updates sorted view without moving saved record');
        await reload();
        check(d.querySelector('#priority-toggle').getAttribute('aria-pressed') === 'false' && visiblePriorityOrder() === customPriorityOrder, 'reload defaults to custom arrangement regardless of previous priority view');
        click('#priority-toggle');
        check(w.getComputedStyle(d.querySelector('#priority-toggle')).animationName === 'priority-gold', 'active Priority animates gold presentation');
        window.testMotion = 'reduce'; await until(() => window.testMotion === null, 'priority reduced motion');
        check(w.getComputedStyle(d.querySelector('#priority-toggle')).animationName === 'none', 'Priority respects reduced motion');
        window.testMotion = 'no-preference'; await until(() => window.testMotion === null, 'restore priority motion');
        click('#priority-toggle');
        await importJSON(JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ title: 'Scroll ' + i, text: 'Long note\n'.repeat(15) }))));
        setDensity(1);
        for (const y of [0, 700]) {
            w.scrollTo(0, y);
            cardAction('Scroll 8', 'Edit');
            const cancelY = w.scrollY;
            cardAction('Scroll 8', 'Cancel');
            await new Promise(resolve => setTimeout(resolve, 40));
            check(w.scrollY === cancelY && d.activeElement.dataset.label === 'Edit' && d.activeElement.closest('.text-block').querySelector('.block-title').textContent === 'Scroll 8', `block Cancel preserves scroll and restores Edit focus at ${y}`);
        }
        cardAction('Scroll 6', 'Edit'); w.scrollTo(0, 500); click('#cancel-edit');
        await new Promise(resolve => setTimeout(resolve, 40));
        check(w.scrollY === 500 && d.activeElement.dataset.label === 'Edit', 'editor Cancel also preserves page position');
        if (new URLSearchParams(location.search).has('forceFailure')) check(false, 'intentional runner failure probe');
        output.dataset.status = 'passed';
        output.textContent = results.join('\n') + `\nALL PASSED (${results.length} assertions)`;
    } catch (error) {
        output.dataset.status = 'failed';
        output.textContent = results.join('\n') + '\nFAIL ' + error.stack;
    }
};

