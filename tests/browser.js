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
const add = (title, text) => {
    d.querySelector('#block-title').value = title;
    d.querySelector('#new-text').value = text;
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
    filter.value = value; filter.dispatchEvent(new w.Event('change'));
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
        click('#color-button'); click('.color-option[data-color="#FFB0FF"]');
        check(w.localStorage.getItem('preferredColor') === '#FFB0FF', 'background persists');
        const exactText = '  Hello 🍒\n<svg onload=alert(1)>  ';
        add('First #Work', exactText); add('Second', 'x'.repeat(500) + ' #other');
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
        filterBy('#other'); check(d.querySelectorAll('.text-block').length === 1, 'dynamic hashtag filtering');
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
            { title: 'Linked #work', text: 'https://example.com/a https://example.com/a' },
            { title: 'Other link', text: 'https://example.org/b' },
            { title: 'Plain #work', text: 'No link' }
        ]));
        check(d.querySelectorAll('#tag-filter optgroup[label="Detected links"] option').length === 2, 'filter contains distinct detected links');
        filterBy('https://example.com/a');
        check(d.querySelectorAll('.text-block').length === 1 && d.querySelector('.block-title').textContent === 'Linked #work', 'URL filter shows matching blocks only');
        check(!d.querySelector('.text-block').draggable, 'link filtering disables ambiguous reordering');
        action('Edit'); editor.value = 'https://example.net/replaced'; click('#add-button');
        check(d.querySelector('#tag-filter').value === '' && d.querySelectorAll('.text-block').length === 3, 'removed URL filter resets to All blocks');
        check(![...d.querySelector('#tag-filter').options].some(option => option.value === 'https://example.com/a'), 'filter removes stale edited links');
        filterBy('#work'); check(d.querySelectorAll('.text-block').length === 2, 'hashtag filtering remains available alongside link filtering');
        await importJSON(JSON.stringify([{ text: 'https://example.org/new-import' }]));
        check(d.querySelectorAll('#tag-filter optgroup[label="Detected links"] option').length === 1 && d.querySelector('#tag-filter').value === '', 'import refreshes combined filter and resets missing selection');
        if (new URLSearchParams(location.search).has('forceFailure')) check(false, 'intentional runner failure probe');
        output.dataset.status = 'passed';
        output.textContent = results.join('\n') + `\nALL PASSED (${results.length} assertions)`;
    } catch (error) {
        output.dataset.status = 'failed';
        output.textContent = results.join('\n') + '\nFAIL ' + error.stack;
    }
};

