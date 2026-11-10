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
    const filter = d.querySelector('#tag-filter');
    filter.value = value ? (value.startsWith('#') ? 'tag:' + value.slice(1).toLowerCase() : 'link:' + value) : '';
    filter.dispatchEvent(new w.Event('change'));
}
async function importJSON(value) {
    const input = d.querySelector('#file-input');
    const transfer = new w.DataTransfer();
    transfer.items.add(new w.File([value], 'backup.json', { type: 'application/json' }));
    input.files = transfer.files; input.dispatchEvent(new w.Event('change'));
    await until(() => !input.value, 'import completion');
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
        check(d.querySelectorAll('#tag-filter optgroup[label="Detected links"] option').length === 2, 'filter contains distinct detected links');
        filterBy('https://example.com/a');
        check(d.querySelectorAll('.text-block').length === 1 && d.querySelector('.block-title').textContent === 'Linked #work', 'URL filter shows matching blocks only');
        check(!d.querySelector('.text-block').draggable, 'link filtering disables ambiguous reordering');
        action('Edit'); editor.value = 'https://example.net/replaced'; click('#add-button');
        check(d.querySelector('#tag-filter').value === '' && d.querySelectorAll('.text-block').length === 3, 'removed URL filter resets to All blocks');
        check(![...d.querySelector('#tag-filter').options].some(option => option.value === 'link:https://example.com/a'), 'filter removes stale edited links');
        filterBy('#work'); check(d.querySelectorAll('.text-block').length === 2, 'tag filtering remains available alongside link filtering');
        await importJSON(JSON.stringify([{ text: 'https://example.org/new-import' }]));
        check(d.querySelectorAll('#tag-filter optgroup[label="Detected links"] option').length === 1 && d.querySelector('#tag-filter').value === '', 'import refreshes combined filter and resets missing selection');
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
        check(stored()[0].tags.length === 0 && !d.querySelector('.tag-chip') && d.querySelector('#tag-filter').value === '', 'removing final tag clears chips and stale filter');
        const legacyBody = '  Literal #example 🍒\nhttps://example.com/#fragment  ';
        await importJSON(JSON.stringify([{ title: '#TitleTag', text: legacyBody }]));
        check(stored()[0].text === legacyBody && stored()[0].title === '#TitleTag' && stored()[0].tags.length === 0, 'legacy import defaults tags without changing text or title');
        check(!d.querySelector('#tag-filter optgroup[label="Tags"]'), 'body/title hashtags and URL fragments do not create metadata tags');
        // Verify old browser storage follows the same migration without rewriting it on load.
        const legacyStored = JSON.stringify([{ title: '#TitleTag', text: legacyBody }]);
        w.localStorage.setItem('textBlocks', legacyStored); await reload();
        check(w.localStorage.getItem('textBlocks') === legacyStored && !d.querySelector('.tag-chip'), 'legacy storage is not rewritten or inferred on load');
        action('Edit'); d.querySelector('#block-tags').value = 'migrated'; click('#add-button');
        check(stored()[0].text === legacyBody && stored()[0].tags[0] === 'migrated', 'editing legacy tags preserves exact original body');
        const beforeInvalidTags = w.localStorage.getItem('textBlocks');
        for (const tags of [null, 'work', [42], [{}]]) {
            await importJSON(JSON.stringify([{ text: 'Should not replace', tags }]));
            check(w.localStorage.getItem('textBlocks') === beforeInvalidTags && status().startsWith('Invalid backup.'), 'invalid tag schema preserves existing collection');
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
        filterBy('https://example.com/');
        check(d.querySelectorAll('.text-block').length === 1 && d.querySelector('.block-title').textContent === 'Actual link', 'link filter does not match URL-shaped tag metadata');
        filterBy('');
        const tagBackup = JSON.stringify(stored());
        await importJSON(tagBackup);
        check(JSON.stringify(stored()) === tagBackup, 'tagged backup round trip preserves metadata and exact bodies');
        const chip = label => [...d.querySelectorAll('.tag-chip')].find(el => el.textContent.toLowerCase() === label.toLowerCase());
        let chipCopies = 0;
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { chipCopies++; } } });
        chip('Work').click();
        check(d.querySelector('#tag-filter').value === 'tag:work' && d.querySelectorAll('.text-block').length === 2, 'chip activates matching tag filter');
        check([...d.querySelectorAll('.tag-chip')].filter(el => el.textContent.toLowerCase() === 'work').every(el => el.getAttribute('aria-pressed') === 'true'), 'all matching chip pressed states are synchronized');
        check(d.activeElement === chip('Work'), 'chip focus survives filtered render');
        check(w.getComputedStyle(chip('Work'), '::before').content.includes('✓'), 'selected chip has a non-color checkmark indicator');
        chip('work').click();
        check(d.querySelector('#tag-filter').value === '' && d.querySelectorAll('.text-block').length === 4, 'repeat chip click clears filter');
        check(chipCopies === 0, 'chip clicks never copy body');
        // Browser protocol input invokes native button behavior, not synthetic key listeners.
        async function pressChipKey(key) {
            window.testKey = key;
            await until(() => window.testKey === null, `runner dispatches ${key}`);
        }
        chip('Work').focus(); await pressChipKey('Enter');
        check(d.querySelector('#tag-filter').value === 'tag:work' && d.activeElement === chip('Work'), 'native Enter activates filter and retains focus');
        await pressChipKey('Space');
        check(d.querySelector('#tag-filter').value === '' && d.activeElement === chip('Work'), 'native Space clears filter and retains focus');
        check(chipCopies === 0, 'keyboard chip activation never copies body');
        chip('Work').click(); chip('日本語').click();
        check(d.querySelector('#tag-filter').value === 'tag:日本語' && d.querySelectorAll('.text-block').length === 1, 'different Unicode chip replaces active filter');
        filterBy('#WORK');
        check(chip('Work').getAttribute('aria-pressed') === 'true' && chip('日本語').getAttribute('aria-pressed') === 'false', 'dropdown changes refresh chip states');
        filterBy(''); chip('https://example.com/').click();
        check(d.querySelector('#tag-filter').value === 'tag:https://example.com/' && d.querySelector('.block-title').textContent === 'URL-shaped tag', 'URL-shaped chip selects tag namespace only');
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
        filterBy('https://example.org/'); chip('shared').click();
        check(d.querySelector('#tag-filter').value === 'tag:shared' && d.querySelectorAll('.text-block').length === 2, 'chip switches from URL filter to tag filter');
        await importJSON(JSON.stringify([{ text: 'Replacement', tags: ['replacement'] }]));
        check(d.querySelector('#tag-filter').value === '' && chip('replacement').getAttribute('aria-pressed') === 'false', 'import clears missing selected tag and pressed state');
        chip('replacement').click(); action('Edit'); d.querySelector('#block-tags').value = ''; click('#add-button');
        check(d.querySelector('#tag-filter').value === '' && !d.querySelector('.tag-chip'), 'editing away final active chip restores All blocks');
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
        if (new URLSearchParams(location.search).has('forceFailure')) check(false, 'intentional runner failure probe');
        output.dataset.status = 'passed';
        output.textContent = results.join('\n') + `\nALL PASSED (${results.length} assertions)`;
    } catch (error) {
        output.dataset.status = 'failed';
        output.textContent = results.join('\n') + '\nFAIL ' + error.stack;
    }
};

