'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const $ = selector => document.querySelector(selector);
    const list = $('#text-blocks');
    const title = $('#block-title');
    const text = $('#new-text');
    const tagInput = $('#block-tags');
    const add = $('#add-button');
    const filter = $('#tag-filter');
    let activeFilter = '';
    const compactFilters = window.matchMedia('(max-width: 640px)');
    let blocks = [];
    let editing = null;
    let selectedColor = '#F8F8F8';
    let creatorColor = selectedColor;
    let noteColorControl;
    let storageBlocked = false;
    let dragging = null;
    const openQR = new WeakSet();
    const qrViews = new WeakMap();
    const chipTargets = new WeakMap();
    const notify = message => { $('#status').textContent = message; };
    function opaqueHex(value, fallback) {
        if (!value || !CSS.supports('color', value) || /currentcolor|var\(|inherit|initial|unset|revert|light-dark/i.test(value)) return fallback;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        context.fillStyle = value; context.fillRect(0, 0, 1, 1);
        const rgba = context.getImageData(0, 0, 1, 1).data;
        if (rgba[3] !== 255) return fallback;
        return '#' + [...rgba].slice(0, 3).map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    function foregroundFor(hex) {
        const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
            .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? '#000000' : '#FFFFFF';
    }
    function colorControl(prefix, initial, onChange) {
        const picker = $(`#${prefix}-picker`), hex = $(`#${prefix}-hex`), error = $(`#${prefix}-error`);
        function set(value) {
            picker.value = value; hex.value = value.toUpperCase();
            hex.setCustomValidity(''); hex.setAttribute('aria-invalid', 'false'); error.textContent = '';
        }
        picker.addEventListener('input', () => { set(picker.value); onChange(picker.value.toUpperCase()); });
        hex.addEventListener('input', () => {
            const match = hex.value.trim().match(/^#?([\da-f]{6})$/i);
            if (!match) {
                const message = 'Enter six HEX digits, for example #669966.';
                hex.setCustomValidity(message); hex.setAttribute('aria-invalid', 'true'); error.textContent = message;
                return;
            }
            const value = '#' + match[1].toUpperCase(); set(value); onChange(value);
        });
        set(initial);
        return { set, valid: () => hex.reportValidity() };
    }
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
            color: opaqueHex(b.color, '#F8F8F8') }));
    }
    function save() {
        if (storageBlocked) { notify('Existing saved data could not be read. Export this session or import a valid backup before replacing it.'); return; }
        write('textBlocks', JSON.stringify(blocks));
    }
    const tags = block => block.tags.map(tag => tag.toLowerCase());
    function chooseColor(color) {
        selectedColor = color;
        noteColorControl?.set(color);
    }
    function resetEditor() {
        chooseColor(editing ? creatorColor : selectedColor);
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
    function renderTagFilters() {
        const focusedKey = document.activeElement.dataset?.tagFilter;
        const counts = new Map();
        blocks.forEach(block => block.tags.forEach(label => {
            const key = label.toLowerCase();
            if (!counts.has(key)) counts.set(key, { key, label, count: 0 });
            counts.get(key).count++;
        }));
        const ordered = [...counts.values()].sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        if (activeFilter && !counts.has(activeFilter.slice(4))) activeFilter = '';
        filter.dataset.activeTag = activeFilter;
        const limit = compactFilters.matches ? 3 : 5;
        const top = ordered.slice(0, limit);
        const remainder = ordered.slice(limit);
        function tagButton(tag) {
            const value = 'tag:' + tag.key;
            const control = button('', () => {
                control.focus({ preventScroll: true });
                activeFilter = activeFilter === value ? '' : value;
                render();
            });
            control.className = 'filter-tag'; control.dataset.tagFilter = value;
            control.title = `${tag.label} (${tag.count})`;
            control.setAttribute('aria-pressed', String(activeFilter === value));
            control.setAttribute('aria-label', `${tag.label}, ${tag.count} ${tag.count === 1 ? 'note' : 'notes'}`);
            const label = document.createElement('span'); label.className = 'filter-tag-label'; label.textContent = tag.label;
            const count = document.createElement('span'); count.className = 'tag-count'; count.textContent = tag.count;
            control.append(label, count);
            return control;
        }
        $('#popular-tags').replaceChildren(...top.map(tagButton));
        const extra = counts.get(activeFilter.slice(4));
        $('#active-tag').replaceChildren(...(extra && !top.includes(extra) ? [tagButton(extra)] : []));
        $('#all-tags').setAttribute('aria-pressed', String(!activeFilter));
        $('#all-tags').textContent = `All (${blocks.length})`;
        const details = $('#more-tags');
        details.hidden = !remainder.length;
        if (details.hidden) {
            if (details.contains(document.activeElement)) $('#all-tags').focus({ preventScroll: true });
            details.open = false;
        }
        $('#more-tags-label').textContent = `More tags (${remainder.length})`;
        const search = $('#tag-search');
        if (details.hidden) search.value = '';
        const query = search.value.trim().toLowerCase();
        const visible = (query ? ordered : remainder).filter(tag => tag.key.includes(query));
        $('#more-tag-list').replaceChildren(...visible.map(tagButton));
        $('#tag-search-empty').hidden = !!visible.length;
        if (focusedKey !== undefined) {
            const replacement = [...filter.querySelectorAll('[data-tag-filter]')].find(control =>
                control.dataset.tagFilter === focusedKey && (!control.closest('details') || details.open));
            (replacement || $('#all-tags')).focus({ preventScroll: true });
        }
    }
    function render() {
        const focusedChip = chipTargets.get(document.activeElement);
        let restoredChip = null;
        const blockLinks = new Map(blocks.map(block => [block, linksIn(block.text)]));
        renderTagFilters();
        const matchesFilter = block => !activeFilter || tags(block).includes(activeFilter.slice(4));
        const matchingCount = blocks.filter(matchesFilter).length;
        const editingException = editing && !matchesFilter(editing);
        const displayBlocks = blocks.map((block, index) => ({ block, index }));
        const editIndex = displayBlocks.findIndex(entry => entry.block === editing);
        if (editIndex >= 0) displayBlocks.unshift(...displayBlocks.splice(editIndex, 1));
        list.replaceChildren();
        displayBlocks.forEach(({ block, index }) => {
            if (block !== editing && !matchesFilter(block)) return;
            const card = document.createElement('article'); card.className = 'text-block';
            card.style.backgroundColor = block.color; card.draggable = !activeFilter && !editing;
            card.style.color = foregroundFor(block.color);
            card.dataset.index = index;
            if (block === editing) {
                card.classList.add('is-editing');
                card.setAttribute('aria-label', `${block.title} — Editing`);
                const badge = button(editingException ? 'Editing — shown outside the current filter' : 'Editing', () => {
                    add.click();
                    if (!editing) text.focus({ preventScroll: true });
                });
                badge.className = 'editing-badge'; badge.dataset.action = 'save';
                badge.setAttribute('aria-label', `Save changes to ${block.title}`);
                badge.title = 'Save changes';
                card.append(badge);
            }
            const heading = document.createElement('h2'); heading.className = 'block-title'; heading.textContent = block.title;
            const content = document.createElement('div'); content.className = 'text-content'; content.textContent = block.text;
            const actions = document.createElement('div'); actions.className = 'block-actions';
            actions.append(button('Copy', () => copy(block.text)), button('Edit', () => {
                if (!editing) creatorColor = selectedColor;
                editing = block; title.value = block.title; text.value = block.text; chooseColor(block.color);
                tagInput.value = block.tags.join(', ');
                updateDetectedLinks();
                dragging = null;
                add.textContent = 'Save Changes'; $('#cancel-edit').hidden = false;
                render(); text.focus({ preventScroll: true });
            }), button('Delete', () => {
                if (!confirm(`Delete "${block.title}"?`)) return;
                if (editing === block) resetEditor();
                blocks.splice(index, 1); save(); render();
            }));
            for (const [label, offset] of [['Move up', -1], ['Move down', 1]]) {
                const move = button(label, () => {
                    if (editing || activeFilter) return;
                    [blocks[index], blocks[index + offset]] = [blocks[index + offset], blocks[index]];
                    save(); render();
                });
                move.disabled = !!editing || !!activeFilter || index + offset < 0 || index + offset >= blocks.length;
                if (editing) move.title = 'Finish editing before reordering blocks.';
                actions.append(move);
            }
            card.append(heading, content);
            const colorLabel = document.createElement('span'); colorLabel.className = 'note-color-value';
            colorLabel.textContent = block.color.toUpperCase(); colorLabel.setAttribute('aria-label', `Note color ${block.color}`);
            card.append(colorLabel);
            if (block.tags.length) {
                const chips = document.createElement('ul'); chips.className = 'block-tags';
                chips.setAttribute('aria-label', 'Tags');
                block.tags.forEach(tag => {
                    const item = document.createElement('li');
                    const key = tag.toLowerCase();
                    const value = 'tag:' + key;
                    const chip = button(tag, () => {
                        chip.focus({ preventScroll: true });
                        activeFilter = activeFilter === value ? '' : value;
                        render();
                    });
                    chip.className = 'tag-chip'; chip.draggable = false;
                    chip.setAttribute('aria-label', `Filter by tag ${tag}`);
                    chip.setAttribute('aria-pressed', String(activeFilter === value));
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
                card.draggable = !editing && !activeFilter && !event.target.closest('.tag-chip');
            });
            for (const eventName of ['pointerup', 'pointercancel']) {
                card.addEventListener(eventName, () => { card.draggable = !editing && !activeFilter; });
            }
            card.addEventListener('dragstart', event => {
                if (!card.draggable) { event.preventDefault(); return; }
                dragging = block; card.classList.add('dragging'); event.dataTransfer.setData('text/plain', String(index));
            });
            card.addEventListener('dragend', () => { dragging = null; card.classList.remove('dragging'); });
            card.addEventListener('dragover', event => { if (dragging && !editing && !activeFilter) event.preventDefault(); });
            card.addEventListener('drop', event => {
                event.preventDefault();
                if (!dragging || dragging === block || editing || activeFilter) return;
                const from = blocks.indexOf(dragging);
                blocks.splice(from, 1); blocks.splice(index, 0, dragging); dragging = null; save(); render();
            });
            list.append(card);
        });
        $('#empty-state').hidden = list.children.length > 0;
        $('#block-count').textContent = `${matchingCount} of ${blocks.length} blocks${editingException ? ' match the filter (+1 editing block)' : ''}`;
        if (focusedChip) (restoredChip || $('#all-tags')).focus({ preventScroll: true });
    }
    add.addEventListener('click', () => {
        if (!noteColorControl.valid()) return;
        if (!text.value.trim()) { notify('Enter some text first.'); text.focus(); return; }
        const value = { title: title.value.trim() || 'Untitled', text: text.value, tags: normalizeTags([tagInput.value]), color: selectedColor };
        if (editing) Object.assign(editing, value); else blocks.push(value);
        resetEditor(); save(); render();
    });
    $('#cancel-edit').addEventListener('click', () => { resetEditor(); render(); title.focus(); });
    text.addEventListener('input', updateDetectedLinks);
    $('#all-tags').addEventListener('click', () => { activeFilter = ''; render(); });
    $('#tag-search').addEventListener('input', renderTagFilters);
    compactFilters.addEventListener('change', render);
    noteColorControl = colorControl('note-color', '#F8F8F8', chooseColor);
    const backgroundColor = opaqueHex(read('preferredColor'), '#F0F0F0');
    colorControl('background-color', backgroundColor, color => {
        document.body.style.backgroundColor = color; write('preferredColor', color);
    });
    document.body.style.backgroundColor = backgroundColor;
    function collapse() {
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('show'));
        $('#layout-button').setAttribute('aria-expanded', 'false');
    }
    for (const kind of ['layout']) {
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
        if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.layout-option')) {
            event.preventDefault(); event.target.click();
        }
    });
    document.querySelectorAll('.layout-option').forEach(option => { option.tabIndex = 0; option.setAttribute('role', 'button'); });
    document.querySelectorAll('.layout-option').forEach(option => option.addEventListener('click', () => {
        list.style.setProperty('--columns', option.dataset.columns); write('preferredColumns', option.dataset.columns);
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
    chooseColor(selectedColor); render();
});
