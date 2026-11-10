'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const $ = selector => document.querySelector(selector);
    const list = $('#text-blocks');
    const title = $('#block-title');
    const text = $('#new-text');
    const tagInput = $('#block-tags');
    const add = $('#add-button');
    const filter = $('#tag-filter');
    let blocks = [];
    let editing = null;
    let selectedColor = '#f8f8f8';
    let storageBlocked = false;
    let dragging = null;
    const openQR = new WeakSet();
    const qrViews = new WeakMap();
    const chipTargets = new WeakMap();
    const notify = message => { $('#status').textContent = message; };
    function read(key) {
        try { return localStorage.getItem(key); }
        catch { notify('Browser storage is unavailable. Export your blocks before closing.'); return null; }
    }
    function write(key, value) {
        try { localStorage.setItem(key, value); return true; }
        catch { notify('Could not save in this browser. Export your blocks before closing.'); return false; }
    }
    function normalizeTags(values) {
        const unique = new Map();
        for (const value of values.flatMap(value => value.split(','))) {
            const label = value.trim().replace(/^(?:#\s*)+/, '').trim();
            const key = label.toLowerCase();
            if (label && !unique.has(key)) unique.set(key, label);
        }
        return [...unique.values()];
    }
    function validate(data) {
        if (!Array.isArray(data) || data.some(b => !b || typeof b.text !== 'string' ||
            (b.title !== undefined && typeof b.title !== 'string') ||
            (b.color !== undefined && typeof b.color !== 'string') ||
            (b.tags !== undefined && (!Array.isArray(b.tags) || b.tags.some(tag => typeof tag !== 'string'))))) throw new Error('Invalid backup');
        return data.map(b => ({ title: b.title || 'Untitled', text: b.text, tags: normalizeTags(b.tags || []),
            color: b.color && CSS.supports('color', b.color) ? b.color : '#f8f8f8' }));
    }
    function save() {
        if (storageBlocked) { notify('Existing saved data could not be read. Export this session or import a valid backup before replacing it.'); return; }
        write('textBlocks', JSON.stringify(blocks));
    }
    const tags = block => block.tags.map(tag => tag.toLowerCase());
    function chooseColor(color) {
        selectedColor = color;
        document.querySelectorAll('.color-dot').forEach(dot => {
            dot.classList.toggle('selected', dot.dataset.color === color);
            dot.setAttribute('aria-pressed', String(dot.dataset.color === color));
        });
    }
    function resetEditor() {
        editing = null; title.value = ''; text.value = ''; tagInput.value = ''; add.textContent = 'Add Text Block';
        $('#cancel-edit').hidden = true;
        updateDetectedLinks();
    }
    async function copy(value) {
        try {
            if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
            else {
                const field = document.createElement('textarea');
                field.value = value; field.style.position = 'fixed'; field.style.left = '-9999px';
                const focused = document.activeElement;
                document.body.append(field); field.select();
                try { if (!document.execCommand('copy')) throw new Error('Copy failed'); }
                finally { field.remove(); focused?.focus(); }
            }
            notify('Copied!');
        } catch { notify('Copy failed. Check clipboard permissions or select and copy the text manually.'); }
    }
    function button(label, action) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
        b.addEventListener('click', event => { event.stopPropagation(); action(); }); return b;
    }
    function linksIn(value) {
        const links = new Set();
        // Explicit HTTP(S), at a word boundary; never interpret the body as HTML.
        const candidates = value.matchAll(/(?:^|[\s([{<"'“‘])(https?:\/\/[^\s<>"'`“”‘’]+)/giu);
        for (const match of candidates) {
            let candidate = match[1];
            // Trim sentence punctuation and unmatched closing delimiters only.
            let previous;
            do {
                previous = candidate;
                candidate = candidate.replace(/[.,!?:;]+$/u, '');
                for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
                    while (candidate.endsWith(close) && candidate.split(close).length > candidate.split(open).length) {
                        candidate = candidate.slice(0, -1);
                    }
                }
            } while (candidate !== previous);
            try {
                const url = new URL(candidate);
                if (url.protocol === 'http:' || url.protocol === 'https:') links.add(url.href);
            } catch { /* Ignore malformed URLs; the original text is still copyable. */ }
        }
        return [...links];
    }
    function linkList(urls) {
        const items = document.createElement('ul'); items.className = 'link-list';
        for (const url of urls) {
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            link.textContent = url;
            link.setAttribute('aria-label', `${url} (opens in new tab)`);
            link.draggable = false;
            link.addEventListener('click', event => event.stopPropagation());
            link.addEventListener('dragstart', event => { event.preventDefault(); event.stopPropagation(); });
            item.append(link); items.append(item);
        }
        return items;
    }
    function updateDetectedLinks() {
        const urls = linksIn(text.value);
        const preview = $('#detected-links-list');
        preview.replaceChildren(...linkList(urls).children);
        preview.hidden = !urls.length;
        $('#no-detected-links').hidden = !!urls.length;
    }
    function qrView(block) {
        const cached = qrViews.get(block);
        if (cached && cached.text === block.text && cached.title === block.title) return cached.element;
        const element = document.createElement('div'); element.className = 'qr-view';
        try {
            element.append(window.CopyBlocksQR.createCanvas(block.text, block.title));
            const caption = document.createElement('p');
            caption.textContent = 'Scan to read the full block text.';
            element.append(caption);
        } catch (error) {
            const message = document.createElement('p'); message.className = 'qr-error';
            message.setAttribute('role', 'status');
            message.textContent = error.message || 'Could not generate this QR code. Copying still works.';
            element.append(message);
        }
        qrViews.set(block, { text: block.text, title: block.title, element });
        return element;
    }
    function render() {
        const focusedChip = chipTargets.get(document.activeElement);
        let restoredChip = null;
        const currentFilter = filter.value;
        const blockLinks = new Map(blocks.map(block => [block, linksIn(block.text)]));
        const tagLabels = new Map();
        blocks.forEach(block => block.tags.forEach(tag => {
            if (!tagLabels.has(tag.toLowerCase())) tagLabels.set(tag.toLowerCase(), tag);
        }));
        filter.replaceChildren(new Option('All blocks', ''));
        for (const [label, prefix, values] of [
            ['Tags', 'tag:', [...tagLabels.keys()].sort()],
            ['Detected links', 'link:', [...new Set([...blockLinks.values()].flat())].sort()]
        ]) {
            if (!values.length) continue;
            const group = document.createElement('optgroup'); group.label = label;
            values.forEach(value => group.append(new Option(prefix === 'tag:' ? tagLabels.get(value) : value, prefix + value)));
            filter.append(group);
        }
        filter.value = [...filter.options].some(o => o.value === currentFilter) ? currentFilter : '';
        list.replaceChildren();
        blocks.forEach((block, index) => {
            if (filter.value.startsWith('tag:') && !tags(block).includes(filter.value.slice(4))) return;
            if (filter.value.startsWith('link:') && !blockLinks.get(block).includes(filter.value.slice(5))) return;
            const card = document.createElement('article'); card.className = 'text-block';
            card.style.backgroundColor = block.color; card.draggable = !filter.value;
            card.dataset.index = index;
            const heading = document.createElement('h2'); heading.className = 'block-title'; heading.textContent = block.title;
            const content = document.createElement('div'); content.className = 'text-content'; content.textContent = block.text;
            const actions = document.createElement('div'); actions.className = 'block-actions';
            actions.append(button('Copy', () => copy(block.text)), button('Edit', () => {
                editing = block; title.value = block.title; text.value = block.text; chooseColor(block.color);
                tagInput.value = block.tags.join(', ');
                updateDetectedLinks();
                add.textContent = 'Save Changes'; $('#cancel-edit').hidden = false; title.focus();
            }), button('Delete', () => {
                if (!confirm(`Delete "${block.title}"?`)) return;
                if (editing === block) resetEditor();
                blocks.splice(index, 1); save(); render();
            }));
            for (const [label, offset] of [['Move up', -1], ['Move down', 1]]) {
                const move = button(label, () => {
                    [blocks[index], blocks[index + offset]] = [blocks[index + offset], blocks[index]];
                    save(); render();
                });
                move.disabled = !!filter.value || index + offset < 0 || index + offset >= blocks.length;
                actions.append(move);
            }
            card.append(heading, content);
            if (block.tags.length) {
                const chips = document.createElement('ul'); chips.className = 'block-tags';
                chips.setAttribute('aria-label', 'Tags');
                block.tags.forEach(tag => {
                    const item = document.createElement('li');
                    const key = tag.toLowerCase();
                    const value = 'tag:' + key;
                    const chip = button(tag, () => {
                        chip.focus({ preventScroll: true });
                        filter.value = filter.value === value ? '' : value;
                        render();
                    });
                    chip.className = 'tag-chip'; chip.draggable = false;
                    chip.setAttribute('aria-label', `Filter by tag ${tag}`);
                    chip.setAttribute('aria-pressed', String(filter.value === value));
                    chipTargets.set(chip, { block, key });
                    chip.addEventListener('dragstart', event => { event.preventDefault(); event.stopPropagation(); });
                    if (focusedChip?.block === block && focusedChip.key === key) restoredChip = chip;
                    item.append(chip); chips.append(item);
                });
                card.append(chips);
            }
            const urls = blockLinks.get(block);
            if (urls.length) {
                const links = document.createElement('div'); links.className = 'block-links';
                const label = document.createElement('h3'); label.textContent = 'Detected links';
                links.append(label, linkList(urls));
                card.append(links);
            }
            card.append(actions);
            const qrButton = button(openQR.has(block) ? 'Hide QR' : 'Show QR', () => {
                if (openQR.has(block)) {
                    openQR.delete(block); qrViews.delete(block);
                    card.querySelector('.qr-view')?.remove();
                } else {
                    openQR.add(block); card.append(qrView(block));
                }
                qrButton.textContent = openQR.has(block) ? 'Hide QR' : 'Show QR';
                qrButton.setAttribute('aria-expanded', String(openQR.has(block)));
            });
            qrButton.setAttribute('aria-expanded', String(openQR.has(block)));
            actions.append(qrButton);
            if (openQR.has(block)) card.append(qrView(block));
            card.addEventListener('click', () => copy(block.text));
            // A draggable ancestor must not turn a chip press into a card drag.
            card.addEventListener('pointerdown', event => {
                card.draggable = !filter.value && !event.target.closest('.tag-chip');
            });
            for (const eventName of ['pointerup', 'pointercancel']) {
                card.addEventListener(eventName, () => { card.draggable = !filter.value; });
            }
            card.addEventListener('dragstart', event => {
                if (!card.draggable) { event.preventDefault(); return; }
                dragging = block; card.classList.add('dragging'); event.dataTransfer.setData('text/plain', String(index));
            });
            card.addEventListener('dragend', () => { dragging = null; card.classList.remove('dragging'); });
            card.addEventListener('dragover', event => { if (dragging && !filter.value) event.preventDefault(); });
            card.addEventListener('drop', event => {
                event.preventDefault();
                if (!dragging || dragging === block || filter.value) return;
                const from = blocks.indexOf(dragging);
                blocks.splice(from, 1); blocks.splice(index, 0, dragging); dragging = null; save(); render();
            });
            list.append(card);
        });
        $('#empty-state').hidden = list.children.length > 0;
        $('#block-count').textContent = `${list.children.length} of ${blocks.length} blocks`;
        if (focusedChip) (restoredChip || filter).focus({ preventScroll: true });
    }
    add.addEventListener('click', () => {
        if (!text.value.trim()) { notify('Enter some text first.'); text.focus(); return; }
        const value = { title: title.value.trim() || 'Untitled', text: text.value, tags: normalizeTags([tagInput.value]), color: selectedColor };
        if (editing) Object.assign(editing, value); else blocks.push(value);
        resetEditor(); save(); render();
    });
    $('#cancel-edit').addEventListener('click', resetEditor);
    text.addEventListener('input', updateDetectedLinks);
    filter.addEventListener('change', render);
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.setAttribute('role', 'button'); dot.tabIndex = 0; dot.setAttribute('aria-label', dot.title);
        dot.addEventListener('click', () => chooseColor(dot.dataset.color));
    });
    function collapse() {
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('show'));
        $('#layout-button').setAttribute('aria-expanded', 'false'); $('#color-button').setAttribute('aria-expanded', 'false');
    }
    for (const kind of ['layout', 'color']) {
        const trigger = $(`#${kind}-button`); const menu = $(`.${kind}-dropdown`);
        trigger.setAttribute('aria-expanded', 'false');
        trigger.addEventListener('click', event => {
            event.stopPropagation(); const open = !menu.classList.contains('show'); collapse();
            menu.classList.toggle('show', open); trigger.setAttribute('aria-expanded', String(open));
        });
    }
    document.addEventListener('click', collapse);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') collapse();
        if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.color-dot, .layout-option, .color-option')) {
            event.preventDefault(); event.target.click();
        }
    });
    document.querySelectorAll('.layout-option, .color-option').forEach(option => { option.tabIndex = 0; option.setAttribute('role', 'button'); });
    document.querySelectorAll('.layout-option').forEach(option => option.addEventListener('click', () => {
        list.style.setProperty('--columns', option.dataset.columns); write('preferredColumns', option.dataset.columns);
    }));
    document.querySelectorAll('.color-option').forEach(option => option.addEventListener('click', () => {
        document.body.style.backgroundColor = option.dataset.color; write('preferredColor', option.dataset.color);
    }));
    $('#export-button').addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(blocks, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'text-blocks-backup.json';
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $('#import-button').addEventListener('click', () => $('#file-input').click());
    $('#file-input').addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const imported = validate(JSON.parse(await file.text()));
            if ((blocks.length || storageBlocked) && !confirm('Replace all blocks with this backup? Export first to keep your current blocks.')) return;
            blocks = imported; storageBlocked = false; resetEditor(); save(); render();
        } catch { notify('Invalid backup. Blocks need text, optional title and color, and optional tags as an array of strings. Current blocks were kept.'); }
        finally { event.target.value = ''; }
    });
    $('#clear-button').addEventListener('click', () => {
        if (!confirm('Delete all text blocks? Export a backup first to keep them.')) return;
        blocks = []; storageBlocked = false; resetEditor(); save(); render();
    });
    const saved = read('textBlocks');
    if (saved !== null) {
        try { blocks = validate(JSON.parse(saved)); }
        catch { storageBlocked = true; notify('Saved data could not be read and has been left untouched. Import a valid backup to recover.'); }
    }
    const columns = read('preferredColumns');
    if (['1', '2', '3'].includes(columns)) list.style.setProperty('--columns', columns);
    const background = read('preferredColor');
    if (background && CSS.supports('color', background)) document.body.style.backgroundColor = background;
    chooseColor(selectedColor); render();
});
