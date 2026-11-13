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

    let priorityView = false;

    const compactFilters = window.matchMedia('(max-width: 640px)');
    let blocks = [];
    let editing = null;
    let selectedColor = '#F8F8F8';
    let creatorColor = selectedColor;
    let noteColorControl;
    let storageBlocked = false;
    let dragging = null;
    let iconMode = false;
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
        return data.map(b => {
            const block = { title: b.title || 'Untitled', text: b.text, tags: normalizeTags(b.tags || []), color: opaqueHex(b.color, '#F8F8F8') };
            if (b.codePin !== undefined) {
                const pin = b.codePin;
                if (!pin || typeof pin !== 'object' || Array.isArray(pin) || !['qr', 'barcode'].includes(pin.format) ||
                    !(pin.payload === null || typeof pin.payload === 'string' && /^https?:\/\//i.test(pin.payload))) throw new Error('Invalid pinned code settings');
                if (pin.payload !== null) { const url = new URL(pin.payload); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid pin URL'); }
                block.codePin = resolvedPin(block, pin);
            }
            return block;
        });
    }
    function resolvedPin(block, pin) {
        const urls = linksIn(block.text);
        return { format: pin.format, payload: pin.payload === null || urls.includes(pin.payload) ? pin.payload : urls[0] || null };
    }
    function persistPin(block, pin) {
        if (storageBlocked) { notify('Saved data could not be read. Recover it before saving pins.'); return false; }
        const updated = { ...block }; if (pin) updated.codePin = pin; else delete updated.codePin;
        if (!write('textBlocks', JSON.stringify(blocks.map(value => value === block ? updated : value)))) return false;
        if (pin) block.codePin = pin; else delete block.codePin;
        return true;
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
    const copyTimers = new Map();
    const copyRequests = new WeakMap();
    function clearCopyFeedback(card) {
        clearTimeout(copyTimers.get(card)); copyTimers.delete(card);
        card.querySelector('.copy-overlay')?.remove();
    }
    async function copy(value, card) {
        $('#copy-status').textContent = '';
        const request = {}; copyRequests.set(card, request); clearCopyFeedback(card);
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
            if (!card.isConnected || copyRequests.get(card) !== request) return;
            const overlay = document.createElement('span'); overlay.className = 'copy-overlay';
            overlay.textContent = 'Copied!'; overlay.setAttribute('aria-hidden', 'true');
            card.append(overlay);
            copyTimers.set(card, setTimeout(() => clearCopyFeedback(card), 1500));
            notify(''); $('#copy-status').textContent = 'Copied!';
        } catch {
            if (!card.isConnected || copyRequests.get(card) !== request) return;
            clearCopyFeedback(card);
            notify('Copy failed. Check clipboard permissions or select and copy the text manually.');
        }
    }
    function button(label, action) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
        b.addEventListener('click', event => { event.stopPropagation(); action(); }); return b;
    }
    const actionPaths = {
        Priority: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z',
        Copy: 'M8 8h12v12H8z M16 8V4H4v12h4',
        Duplicate: 'M4 3h10v4 M3 4v13h4 M8 8h13v13H8z M11 14h7 M14.5 11v7',
        Edit: 'm4 16 12-12 4 4-12 12H4z M13 7l4 4',
        Delete: 'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
        Save: 'M4 3h13l4 4v14H3V3z M7 3v6h10V3 M7 21v-8h10v8',
        Cancel: 'm5 5 14 14 M19 5 5 19',
        'Show QR/Barcode': 'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 13v8 M12 16h9 M18 19h3',
        'Hide QR/Barcode': 'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M14 17h8'
    };
    function presentAction(control, label = control.dataset.label) {
        control.dataset.label = label;
        control.setAttribute('aria-label', label === 'Save' ? 'Save changes' : label);
        control.title = label === 'Save' ? 'Save changes' : label;
        control.classList.toggle('danger-action', label === 'Delete' || label === 'Cancel');
        control.classList.toggle('icon-action', iconMode);
        control.replaceChildren();
        if (iconMode) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
            const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', actionPaths[label]);
            svg.append(path); control.append(svg);
            if (label.endsWith('QR/Barcode')) {
                svg.setAttribute('viewBox', '0 0 54 24'); svg.classList.add('combined-code-icon');
                const bars = document.createElementNS(svg.namespaceURI, 'path');
                bars.setAttribute('d', 'M30 3 25 21 M35 4v16 M39 4v16 M42 4v16 M47 4v16 M51 4v16'); svg.append(bars);
            }
        } else control.textContent = label;
    }
    function actionButton(label, action) {
        const control = button(label, action); presentAction(control, label); return control;
    }
    function updateActionStyle() {
        $('#action-style-button').textContent = iconMode ? 'Use words' : 'Use icons';
        $('#action-style-button').setAttribute('aria-pressed', String(iconMode));
        list.querySelectorAll('button[data-label]').forEach(control => presentAction(control));
        updatePriorityControl();
    }
    function updatePriorityControl() {
        const control = $('#priority-toggle');
        presentAction(control, 'Priority');
        control.setAttribute('aria-pressed', String(priorityView));
        control.setAttribute('aria-label', priorityView ? 'Priority view: switch to custom order' : 'Show priority view');
        control.title = priorityView ? 'Show your custom arrangement' : 'View by P0–P99 tags without changing your arrangement';
    }
    $('#priority-toggle').addEventListener('click', () => {
        endMove(false, false); priorityView = !priorityView; updatePriorityControl(); render();
    });
    function priorityOf(block) {
        const values = block.tags.filter(tag => /^p(?:0|[1-9]\d?)$/i.test(tag)).map(tag => Number(tag.slice(1)));
        return values.length ? Math.min(...values) : Infinity;
    }
    $('#action-style-button').addEventListener('click', () => {
        iconMode = !iconMode; write('actionIconMode', String(iconMode)); updateActionStyle();
    });
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
        const items = document.createElement(urls.length > 1 ? 'ol' : 'ul'); items.className = 'link-list';
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
        preview.style.listStyleType = urls.length > 1 ? 'decimal' : 'disc';
        preview.hidden = !urls.length;
        $('#no-detected-links').hidden = !!urls.length;
    }
    function qrView(block) {
        const cached = qrViews.get(block);
        const columnWidth = parseFloat(getComputedStyle(list).gridTemplateColumns) || list.clientWidth;
        const maxBarcodeWidth = Math.max(0, columnWidth - 28);
        if (cached && cached.text === block.text && cached.title === block.title) return cached.element;
        const element = document.createElement('div'); element.className = 'qr-view';
        element.setAttribute('role', 'region'); element.setAttribute('aria-label', `QR codes for ${block.title}`);
        element.addEventListener('click', event => event.stopPropagation());
        element.addEventListener('pointerdown', event => event.stopPropagation());
        const controls = document.createElement('div'); controls.className = 'qr-controls';
        const selector = document.createElement('select'); selector.setAttribute('aria-label', `QR content for ${block.title}`);
        const format = document.createElement('select'); format.className = 'code-format'; format.setAttribute('aria-label', 'Code format');
        for (const [value, label] of [['qr', 'QR'], ['barcode', 'Code 128']]) {
            const option = document.createElement('option'); option.value = value; option.textContent = label; format.append(option);
        }
        format.value = block.codePin?.format || cached?.format || 'qr';
        const urls = linksIn(block.text);
        ['Full text QR', ...urls.map((_, i) => urls.length > 1 ? `Link ${i + 1}` : 'Link')].forEach((label, i) => {
            const option = document.createElement('option'); option.value = i; option.textContent = label; selector.append(option);
        });
        selector.value = urls.length ? '1' : '0';
        if (block.codePin) selector.value = block.codePin.payload === null ? '0' : String(urls.indexOf(block.codePin.payload) + 1);
        else if (cached?.payload === null || urls.includes(cached?.payload)) selector.value = cached.payload === null ? '0' : String(urls.indexOf(cached.payload) + 1);
        const pin = button('', () => {
            if (!persistPin(block, block.codePin ? null : { format: format.value, payload: Number(selector.value) ? urls[Number(selector.value) - 1] : null })) return;
            updatePin();
        }); pin.className = 'qr-pin';
        const pinSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        pinSvg.setAttribute('viewBox', '0 0 24 24'); pinSvg.setAttribute('aria-hidden', 'true');
        const pinPath = document.createElementNS(pinSvg.namespaceURI, 'path');
        pinPath.setAttribute('d', 'M8 3h8 M9 3v7l-3 4h12l-3-4V3 M12 14v7');
        pinSvg.append(pinPath); pin.append(pinSvg);
        function updatePin() {
            pin.setAttribute('aria-pressed', String(!!block.codePin));
            pin.setAttribute('aria-label', block.codePin ? 'Unpin QR' : 'Pin QR');
            pin.title = block.codePin ? 'Unpin QR to stop reopening after reload' : 'Pin QR open across reloads';
        }
        updatePin();
        const close = button('×', () => closeQR(block)); close.className = 'qr-close';
        close.setAttribute('aria-label', 'Close QR'); close.title = 'Close QR';
        controls.append(pin, selector, close);
        const content = document.createElement('div'); content.className = 'qr-content';
        element.append(controls, format, content);
        function showCode() {
            content.replaceChildren();
            const index = Number(selector.value);
            const width = element.isConnected ? element.clientWidth - 24 : maxBarcodeWidth;
            const currentState = qrViews.get(block); if (currentState) currentState.width = width;
            try {
                const payload = index ? urls[index - 1] : block.text;
                const canvas = format.value === 'barcode' ? window.CopyBlocksBarcode.createCanvas(payload, block.title, width) : window.CopyBlocksQR.createCanvas(payload, block.title);
                if (index) canvas.setAttribute('aria-label', `${selector.selectedOptions[0].textContent} ${format.value} for ${block.title}: ${urls[index - 1]}`);
                const copyCode = button('', () => copy(payload, element.closest('.text-block')));
                copyCode.className = 'qr-copy'; copyCode.setAttribute('aria-label', `Copy ${selector.selectedOptions[0].textContent} content`);
                copyCode.title = 'Copy the text represented by this QR code'; copyCode.append(canvas);
                content.append(copyCode);
            } catch (error) {
                const message = document.createElement('p'); message.className = 'qr-error'; message.setAttribute('role', 'status');
                message.textContent = error.message || 'Could not generate this QR code. Copying still works.'; content.append(message);
                if (format.value === 'barcode') content.append(button('Use QR', () => { format.value = 'qr'; format.dispatchEvent(new Event('change')); }));
            }
        }
        function changeCode() {
            if (block.codePin && !persistPin(block, { format: format.value, payload: Number(selector.value) ? urls[Number(selector.value) - 1] : null })) {
                selector.value = block.codePin.payload === null ? '0' : String(urls.indexOf(block.codePin.payload) + 1); format.value = block.codePin.format; return;
            }
            selector.options[0].textContent = format.value === 'qr' ? 'Full text QR' : 'Full text barcode';
            const state = qrViews.get(block); if (state) { state.format = format.value; state.payload = Number(selector.value) ? urls[Number(selector.value) - 1] : null; }
            showCode();
        }
        selector.addEventListener('change', changeCode); format.addEventListener('change', changeCode);
        selector.options[0].textContent = format.value === 'qr' ? 'Full text QR' : 'Full text barcode'; showCode();
        qrViews.set(block, { text: block.text, title: block.title, element, width: maxBarcodeWidth, format: format.value, payload: Number(selector.value) ? urls[Number(selector.value) - 1] : null, refresh: showCode });
        return element;
    }
    function closeQR(block, focus = true) {
        if (block.codePin && !persistPin(block, null)) return;
        const view = qrViews.get(block)?.element;
        const opener = view?.closest('.text-block')?.querySelector('.block-code-actions button');
        openQR.delete(block); qrViews.delete(block); view?.remove();
        if (opener) { presentAction(opener, 'Show QR/Barcode'); opener.setAttribute('aria-expanded', 'false'); if (focus) opener.focus({ preventScroll: true }); }
    }
    let qrOutside = [];
    document.addEventListener('pointerdown', event => {
        qrOutside = event.isPrimary && event.button === 0 ? blocks.filter(block => {
            const view = qrViews.get(block)?.element;
            return !block.codePin && view?.isConnected && !view.contains(event.target);
        }) : [];
        if (qrOutside.length && !event.target.closest('.qr-view')) {
            event.preventDefault(); event.stopPropagation();
        }
    }, true);
    document.addEventListener('pointercancel', () => { qrOutside = []; }, true);
    document.addEventListener('click', event => {
        const dismiss = qrOutside.filter(block => !qrViews.get(block)?.element.contains(event.target)); qrOutside = [];
        if (!dismiss.length) return;
        event.preventDefault(); event.stopPropagation(); dismiss.forEach(block => closeQR(block));
    }, true);
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || $('#backups-dialog').open) return;
        const open = blocks.filter(block => !block.codePin && qrViews.get(block)?.element.isConnected);
        if (open.length) { event.preventDefault(); open.forEach(block => closeQR(block)); }
    });
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
        const popular = $('#popular-tags');
        popular.replaceChildren(...ordered.map(tagButton));
        $('#all-tags').textContent = `All (${blocks.length})`;
        const rowWidth = filter.clientWidth;
        const allWidth = $('#all-tags').getBoundingClientRect().width;
        const candidates = [...popular.children].map((control, i) => ({ control, tag: ordered[i], width: control.getBoundingClientRect().width }));
        function fitting(extraWidth) {
            let used = 0;
            return candidates.filter(candidate => {
                if (used + candidate.width > Math.max(0, rowWidth - allWidth - extraWidth - 12)) return false;
                used += candidate.width + 6; return true;
            });
        }
        let visible = fitting(0);
        const extra = counts.get(activeFilter.slice(4));
        if (extra && !visible.some(candidate => candidate.tag === extra)) {
            const activeWidth = candidates.find(candidate => candidate.tag === extra)?.width || 0;
            visible = fitting(activeWidth + 6);
        }
        const top = visible.map(candidate => candidate.tag);
        candidates.forEach(candidate => { if (!visible.includes(candidate)) candidate.control.remove(); });
        $('#active-tag').replaceChildren(...(extra && !top.includes(extra) ? [tagButton(extra)] : []));
        $('#all-tags').setAttribute('aria-pressed', String(!activeFilter));
        $('#all-tags').textContent = `All (${blocks.length})`;
        const details = $('#more-tags');
        details.hidden = !ordered.length;
        if (details.hidden) {
            if (details.contains(document.activeElement)) $('#all-tags').focus({ preventScroll: true });
            details.open = false;
        }
        $('#more-tags-label').textContent = `Show all tags (${ordered.length})`;
        $('#more-tag-list').replaceChildren(...ordered.map(tagButton));
        if (focusedKey !== undefined) {
            const replacement = [...filter.querySelectorAll('[data-tag-filter]')].find(control =>
                control.dataset.tagFilter === focusedKey && (!control.closest('details') || details.open));
            (replacement || $('#all-tags')).focus({ preventScroll: true });
        }
    }
    const announceMove = message => { $('#reorder-status').textContent = message; };
    function endMove(commit = false, focus = true) {
        if (!dragging) return;
        const x = window.scrollX, y = window.scrollY;
        const move = dragging; dragging = null;
        cancelAnimationFrame(move.frame);
        if (move.handle.hasPointerCapture(move.pointerId)) move.handle.releasePointerCapture(move.pointerId);
        move.card.classList.remove('dragging');
        for (const key of ['width', 'height', 'left', 'top']) move.card.style[key] = '';
        move.placeholder.replaceWith(move.card);
        move.handle.setAttribute('aria-pressed', 'false');
        let saved = false;
        if (commit && move.position !== move.from && !editing && !activeFilter && !priorityView) {
            const reordered = blocks.filter(block => block !== move.block);
            reordered.splice(move.position, 0, move.block);
            if (write('textBlocks', JSON.stringify(reordered))) { blocks = reordered; saved = true; }
        }
        announceMove(saved ? `Moved ${move.block.title} to position ${move.position + 1} of ${blocks.length}.` : 'Reordering cancelled; order unchanged.');
        if (saved) render();
        else {
            // Restore the original DOM position after a cancelled preview.
            const siblings = [...list.querySelectorAll('.text-block')].filter(card => card !== move.card);
            list.insertBefore(move.card, siblings[move.from] || null);
        }
        if (focus) list.querySelector(`[data-index="${blocks.indexOf(move.block)}"] .drag-handle`)?.focus({ preventScroll: true });
        // Rebuilding the grid can temporarily shrink the page and clamp its scroll.
        // Preserve the release position, including any intentional drag-edge scrolling.
        window.scrollTo(x, y);
    }
    function placeMove(position) {
        if (!dragging) return;
        const move = dragging;
        move.position = Math.max(0, Math.min(blocks.length - 1, position));
        const cards = [...list.querySelectorAll('.text-block')].filter(card => card !== move.card);
        list.insertBefore(move.placeholder, cards[move.position] || null);
        if (move.pointerId === undefined) {
            move.placeholder.scrollIntoView({ block: 'nearest' });
            const rect = move.placeholder.getBoundingClientRect();
            move.card.style.left = `${rect.left}px`; move.card.style.top = `${rect.top}px`;
        }
        announceMove(`${move.block.title}: position ${move.position + 1} of ${blocks.length}. Space or Enter drops; Escape cancels.`);
    }
    function pointerDestination(x, y) {
        const move = dragging;
        if (!move) return false;
        const bounds = list.getBoundingClientRect();
        const valid = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom && y >= 0 && y <= innerHeight;
        move.valid = valid;
        move.placeholder.classList.toggle('invalid-drop', !valid);
        if (!valid) return false;
        const hole = move.placeholder.getBoundingClientRect();
        if (x >= hole.left && x <= hole.right && y >= hole.top && y <= hole.bottom) return true;
        const cards = [...list.querySelectorAll('.text-block')].filter(card => card !== move.card);
        let closest, distance = Infinity;
        cards.forEach((card, index) => {
            const rect = card.getBoundingClientRect();
            const dx = Math.max(rect.left - x, 0, x - rect.right);
            const dy = Math.max(rect.top - y, 0, y - rect.bottom);
            const score = dx * dx + dy * dy;
            if (score < distance) { distance = score; closest = { rect, index }; }
        });
        if (closest) {
            const { rect, index } = closest;
            const columns = getComputedStyle(list).gridTemplateColumns.split(' ').length;
            const after = y > rect.bottom || (y >= rect.top && (columns === 1 ? y > (rect.top + rect.bottom) / 2 : x > (rect.left + rect.right) / 2));
            const position = index + Number(after);
            if (position !== move.position) placeMove(position);
        }
        return true;
    }
    function startMove(block, card, handle, event) {
        if (editing || activeFilter || priorityView || blocks.length < 2 || dragging) return;
        const rect = card.getBoundingClientRect();
        const placeholder = document.createElement('div'); placeholder.className = 'drop-placeholder';
        placeholder.style.height = `${rect.height}px`; placeholder.setAttribute('aria-hidden', 'true');
        card.before(placeholder);
        dragging = { block, card, handle, placeholder, from: blocks.indexOf(block), position: blocks.indexOf(block),
            pointerId: event?.pointerId, x: event?.clientX, y: event?.clientY, offsetX: (event?.clientX ?? rect.left) - rect.left,
            offsetY: (event?.clientY ?? rect.top) - rect.top, valid: true };
        card.style.width = `${rect.width}px`; card.style.height = `${rect.height}px`;
        card.style.left = `${rect.left}px`; card.style.top = `${rect.top}px`;
        card.classList.add('dragging'); handle.setAttribute('aria-pressed', 'true');
        handle.focus({ preventScroll: true });
        if (event) {
            handle.setPointerCapture(event.pointerId);
            const scroll = () => {
                if (!dragging) return;
                const move = dragging, bounds = list.getBoundingClientRect();
                if (move.x >= bounds.left && move.x <= bounds.right) {
                    const delta = move.y < 60 ? -14 : move.y > innerHeight - 60 ? 14 : 0;
                    if (delta) { window.scrollBy(0, delta); pointerDestination(move.x, move.y); }
                }
                move.frame = requestAnimationFrame(scroll);
            };
            dragging.frame = requestAnimationFrame(scroll);
        }
        announceMove(`Picked up ${block.title}, position ${dragging.from + 1} of ${blocks.length}. Use arrows to move; Escape cancels.`);
    }
    function wireHandle(block, card, handle) {
        handle.addEventListener('pointerdown', event => {
            if (event.button !== 0 || !event.isPrimary || handle.disabled) return;
            event.preventDefault(); event.stopPropagation(); startMove(block, card, handle, event);
        });
        handle.addEventListener('pointermove', event => {
            if (!dragging || dragging.pointerId !== event.pointerId) return;
            dragging.x = event.clientX; dragging.y = event.clientY;
            card.style.left = `${event.clientX - dragging.offsetX}px`; card.style.top = `${event.clientY - dragging.offsetY}px`;
            pointerDestination(event.clientX, event.clientY);
        });
        handle.addEventListener('pointerup', event => {
            if (dragging?.pointerId !== event.pointerId) return;
            const bounds = list.getBoundingClientRect();
            const valid = dragging.valid && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= Math.max(0, bounds.top) && event.clientY <= Math.min(innerHeight, bounds.bottom);
            endMove(valid);
        });
        for (const kind of ['pointercancel', 'lostpointercapture']) handle.addEventListener(kind, () => { if (dragging?.handle === handle) endMove(); });
        handle.addEventListener('keydown', event => {
            if (handle.disabled) return;
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault(); if (event.repeat) return;
                if (dragging) endMove(true); else startMove(block, card, handle);
            } else if (dragging?.handle === handle && event.key.startsWith('Arrow')) {
                event.preventDefault();
                const columns = getComputedStyle(list).gridTemplateColumns.split(' ').length;
                const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
                placeMove(dragging.position + offset);
            } else if (dragging && (event.key === 'Escape' || event.key === 'Tab')) {
                if (event.key === 'Escape') event.preventDefault(); endMove();
            }
        });
    }
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && dragging) { event.preventDefault(); endMove(); } });
    window.addEventListener('blur', () => endMove(false, false));
    window.addEventListener('resize', () => endMove());
    document.addEventListener('visibilitychange', () => { if (document.hidden) endMove(false, false); });
    function render() {
        for (const card of copyTimers.keys()) clearCopyFeedback(card);
        endMove(false, false);
        const focusedChip = chipTargets.get(document.activeElement);
        let restoredChip = null;
        const blockLinks = new Map(blocks.map(block => [block, linksIn(block.text)]));
        renderTagFilters();
        const matchesFilter = block => !activeFilter || tags(block).includes(activeFilter.slice(4));
        const matchingCount = blocks.filter(matchesFilter).length;
        const editingException = editing && !matchesFilter(editing);
        const displayBlocks = blocks.map((block, index) => ({ block, index }));
        if (priorityView) displayBlocks.sort((a, b) => priorityOf(a.block) - priorityOf(b.block) || a.index - b.index);
        list.replaceChildren();
        const visibleBlocks = displayBlocks.filter(({ block }) => block === editing || matchesFilter(block));
        const hasPriority = priorityView && visibleBlocks.some(({ block }) => priorityOf(block) < Infinity);
        let divided = false;
        displayBlocks.forEach(({ block, index }) => {
            if (block !== editing && !matchesFilter(block)) return;
            if (hasPriority && !divided && priorityOf(block) === Infinity) {
                const separator = document.createElement('div'); separator.className = 'priority-separator';
                separator.setAttribute('role', 'separator'); separator.setAttribute('aria-label', 'Other notes');
                separator.textContent = 'Other notes'; list.append(separator); divided = true;
            }
            if (block.codePin) openQR.add(block);
            const card = document.createElement('article'); card.className = 'text-block';
            card.style.backgroundColor = block.color; card.draggable = false;
            card.style.color = foregroundFor(block.color);
            card.dataset.index = index;
            if (block === editing) {
                card.classList.add('is-editing');
                card.setAttribute('aria-label', `${block.title} — Editing`);
                if (editingException) {
                    const exception = document.createElement('p'); exception.className = 'filter-exception';
                    exception.textContent = 'Shown outside the current filter'; card.append(exception);
                }
            }
            const heading = document.createElement('h2'); heading.className = 'block-title'; heading.textContent = block.title;
            const content = document.createElement('div'); content.className = 'text-content'; content.textContent = block.text;
            const actions = document.createElement('div'); actions.className = 'block-actions block-top-actions';
            const footer = document.createElement('div'); footer.className = 'block-footer';
            const codeActions = document.createElement('div'); codeActions.className = 'block-actions block-code-actions';
            const handle = button('⠿ Reorder', () => {}); handle.className = 'drag-handle';
            handle.setAttribute('aria-label', `Reorder ${block.title}`);
            handle.setAttribute('aria-describedby', 'reorder-help'); handle.setAttribute('aria-pressed', 'false');
            handle.disabled = !!editing || !!activeFilter || priorityView || blocks.length < 2;
            handle.title = priorityView ? 'Switch off Priority to arrange notes.' : editing ? 'Finish editing before reordering.' : activeFilter ? 'Clear the tag filter to reorder.' : 'Drag to reorder, or use Space and arrow keys.';
            wireHandle(block, card, handle);
            footer.append(codeActions, handle);
            actions.append(actionButton(block === editing ? 'Duplicate' : 'Copy', () => {
                if (block === editing) duplicateDraft(); else copy(block.text, card);
            }), actionButton(block === editing ? 'Save' : 'Edit', () => {
                if (block === editing) { add.click(); if (!editing) text.focus({ preventScroll: true }); return; }
                if (!editing) creatorColor = selectedColor;
                editing = block; title.value = block.title; text.value = block.text; chooseColor(block.color);
                tagInput.value = block.tags.join(', ');
                updateDetectedLinks();
                add.textContent = 'Save Changes'; $('#cancel-edit').hidden = false;
                render(); text.focus({ preventScroll: true });
            }), actionButton(block === editing ? 'Cancel' : 'Delete', () => {
                if (block === editing) { $('#cancel-edit').click(); return; }
                if (!confirm(`Delete "${block.title}"?`)) return;
                if (editing === block) resetEditor();
                blocks.splice(index, 1); save(); render();
            }));
            card.prepend(actions);
            card.append(heading, content);
            const colorLabel = button(block.color.toUpperCase(), () => chooseColor(block.color));
            colorLabel.className = 'note-color-value'; colorLabel.draggable = false;
            colorLabel.setAttribute('aria-label', `Use note color ${block.color.toUpperCase()}`);
            colorLabel.title = 'Use this color for the note being created or edited';
            colorLabel.addEventListener('dragstart', event => { event.preventDefault(); event.stopPropagation(); });
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
            card.append(footer);
            const qrButton = actionButton(openQR.has(block) ? 'Hide QR/Barcode' : 'Show QR/Barcode', () => {
                if (openQR.has(block)) {
                    closeQR(block);
                } else {
                    openQR.add(block); card.insertBefore(qrView(block), footer);
                    card.querySelector('.qr-view select').focus({ preventScroll: true });
                }
                presentAction(qrButton, openQR.has(block) ? 'Hide QR/Barcode' : 'Show QR/Barcode');
                qrButton.setAttribute('aria-expanded', String(openQR.has(block)));
            });
            qrButton.setAttribute('aria-expanded', String(openQR.has(block)));
            codeActions.append(qrButton);
            if (openQR.has(block)) card.insertBefore(qrView(block), footer);
            card.addEventListener('click', () => copy(block.text, card));
            card.addEventListener('dragstart', event => event.preventDefault());
            list.append(card);
        });
        $('#empty-state').hidden = list.children.length > 0;
        $('#empty-state').textContent = activeFilter ? 'No notes match. Clear the tag filter.' : 'No blocks to show. Add a text block above.';
        $('#block-count').textContent = `${matchingCount} of ${blocks.length} blocks${editingException ? ' match the filter (+1 editing block)' : ''}`;
        if (focusedChip) (restoredChip || $('#all-tags')).focus({ preventScroll: true });
    }
    function draftValue() {
        if (!noteColorControl.valid()) return null;
        if (!text.value.trim()) { notify('Enter some text first.'); text.focus({ preventScroll: true }); return null; }
        return { title: title.value.trim() || 'Untitled', text: text.value, tags: normalizeTags([tagInput.value]), color: selectedColor };
    }
    function duplicateDraft() {
        if (!editing) return;
        const value = draftValue(); if (!value) return;
        if (storageBlocked) { notify('Saved data could not be read. Recover it before duplicating notes.'); return; }
        const source = editing, x = scrollX, y = scrollY;
        const next = [...blocks]; next.splice(blocks.indexOf(source) + 1, 0, value);
        if (!write('textBlocks', JSON.stringify(next))) return;
        blocks = next; render();
        list.querySelector(`[data-index="${blocks.indexOf(source)}"] [data-label="Duplicate"]`)?.focus({ preventScroll: true });
        window.scrollTo(x, y); notify('Draft duplicated. Original note is still being edited.');
    }
    add.addEventListener('click', () => {
        const value = draftValue(); if (!value) return;
        const x = scrollX, y = scrollY;
        let changedPin = false;
        if (editing?.codePin) {
            value.codePin = resolvedPin(value, editing.codePin);
            changedPin = value.codePin.payload !== editing.codePin.payload;
        }
        if (storageBlocked) { notify('Saved data could not be read. Recover it before saving notes.'); return; }
        const next = editing ? blocks.map(block => block === editing ? value : block) : [...blocks, value];
        if (!write('textBlocks', JSON.stringify(next))) return;
        if (editing) Object.assign(editing, value); else blocks.push(value);
        resetEditor(); render();
        if (changedPin) notify('Pinned link was removed. The code now uses the first remaining link or full text.');
        window.scrollTo(x, y);
    });
    $('#cancel-edit').addEventListener('click', () => {
        const block = editing, x = window.scrollX, y = window.scrollY;
        resetEditor(); render();
        const editButton = list.querySelector(`[data-index="${blocks.indexOf(block)}"] [data-label="Edit"]`);
        (editButton || add).focus({ preventScroll: true });
        window.scrollTo(x, y);
    });
    text.addEventListener('input', updateDetectedLinks);
    $('#all-tags').addEventListener('click', () => { activeFilter = ''; render(); });
    compactFilters.addEventListener('change', render);
    noteColorControl = colorControl('note-color', '#F8F8F8', chooseColor);
    const backgroundColor = opaqueHex(read('preferredColor'), '#F0F0F0');
    const backgroundControl = colorControl('background-color', backgroundColor, color => {
        document.body.style.backgroundColor = color; write('preferredColor', color);
    });
    document.body.style.backgroundColor = backgroundColor;
    function applySurfaceColor(color) {
        document.documentElement.style.setProperty('--surface-color', color);
        document.documentElement.style.setProperty('--surface-text', foregroundFor(color));
    }
    const surfaceColor = opaqueHex(read('surfaceColor'), '#FFFFFF');
    const surfaceControl = colorControl('surface-color', surfaceColor, color => { applySurfaceColor(color); write('surfaceColor', color); });
    applySurfaceColor(surfaceColor);
    const palettes = {
        classic: ['#F0F0F0', '#FFFFFF', '#F8F8F8'],
        coffeeblocks: ['#38281F', '#E8D8C3', '#C6A27A'],
        midnight: ['#141B29', '#25324A', '#DCE5F2'],
        sage: ['#D5DED2', '#F1F4EB', '#B9CCA9']
    };
    $('#color-preset').addEventListener('change', () => {
        const palette = palettes[$('#color-preset').value]; if (!palette) return;
        const [background, surface, note] = palette;
        backgroundControl.set(background); surfaceControl.set(surface); chooseColor(note);
        document.body.style.backgroundColor = background; applySurfaceColor(surface);
        write('preferredColor', background); write('surfaceColor', surface);
    });
    for (const id of ['background-color-picker', 'background-color-hex', 'surface-color-picker', 'surface-color-hex', 'note-color-picker', 'note-color-hex']) {
        $(`#${id}`).addEventListener('input', () => { $('#color-preset').value = ''; });
    }
    let tagWidth = 0;
    new ResizeObserver(entries => {
        const width = entries[0].contentRect.width;
        if (Math.abs(width - tagWidth) > 1) { tagWidth = width; renderTagFilters(); }
    }).observe(filter);
    const densitySlider = $('#density-slider');
    const savedDensity = Number(read('preferredColumns'));
    let preferredDensity = Number.isSafeInteger(savedDensity) && savedDensity >= 1 ? savedDensity : 3;
    let effectiveDensity = 0;
    function updateDensity() {
        const gap = parseFloat(getComputedStyle(list).columnGap) || 15;
        const maximum = compactFilters.matches ? 1 : Math.max(1, Math.floor((list.clientWidth + gap) / (280 + gap)));
        const effective = Math.min(preferredDensity, maximum);
        if (effective !== effectiveDensity) endMove(false, false);
        effectiveDensity = effective;
        densitySlider.max = maximum; densitySlider.value = effective;
        densitySlider.setAttribute('aria-valuetext', `${effective} ${effective === 1 ? 'column' : 'columns'}`);
        $('#density-value').textContent = effective;
        densitySlider.title = `Columns: ${effective} of ${maximum} available`;
        list.style.setProperty('--columns', effective);
        requestAnimationFrame(() => {
            for (const block of blocks) {
                const view = qrViews.get(block);
                if (view?.element.isConnected && view.format === 'barcode' && view.width !== view.element.clientWidth - 24) view.refresh();
            }
        });
    }
    densitySlider.addEventListener('input', () => {
        endMove(false, false);
        preferredDensity = Number(densitySlider.value);
        write('preferredColumns', String(preferredDensity)); updateDensity();
    });
    const densityObserver = new ResizeObserver(updateDensity);
    densityObserver.observe(list);
    compactFilters.addEventListener('change', updateDensity);
    updateDensity();
    const backupDialog = $('#backups-dialog');
    const backupStatus = message => { $('#backup-status').textContent = message; };
    let pendingImport = null;
    let importVersion = 0;
    let backdropPress = null;
    let backdropClick = false;
    function outsideBackups(event) {
        const bounds = backupDialog.getBoundingClientRect();
        return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    }
    function closeBackups() {
        cancelImport(); backdropPress = null; backdropClick = false; backupDialog.close();
    }
    backupDialog.addEventListener('pointerdown', event => {
        backdropClick = false;
        backdropPress = event.isPrimary && event.button === 0 && outsideBackups(event) ? event.pointerId : null;
    });
    backupDialog.addEventListener('pointerup', event => {
        backdropClick = backdropPress === event.pointerId && outsideBackups(event);
        backdropPress = null;
    });
    backupDialog.addEventListener('pointercancel', () => { backdropPress = null; backdropClick = false; });
    backupDialog.addEventListener('click', event => {
        const dismiss = backdropClick && event.target === backupDialog && outsideBackups(event);
        backdropClick = false;
        if (dismiss) { event.preventDefault(); event.stopPropagation(); closeBackups(); }
    });
    function cancelImport() {
        importVersion++;
        pendingImport = null;
        $('#import-preview').hidden = true;
        $('#file-input').value = '';
        $('#replace-import').disabled = true;
    }
    $('#backups-button').addEventListener('click', () => {
        cancelImport(); backupStatus(''); backupDialog.showModal(); $('#export-button').focus();
    });
    $('#close-backups').addEventListener('click', closeBackups);
    backupDialog.addEventListener('close', () => {
        if (backupDialog.open) return;
        cancelImport(); backdropPress = null; backdropClick = false; $('#backups-button').focus({ preventScroll: true });
    });
    backupDialog.addEventListener('cancel', () => cancelImport());
    $('#cancel-import').addEventListener('click', () => {
        cancelImport(); backupStatus('Import cancelled. Notes and draft kept.'); $('#import-button').focus();
    });
    $('#export-button').addEventListener('click', () => {
        try {
        const url = URL.createObjectURL(new Blob([JSON.stringify(blocks, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'text-blocks-backup.json';
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        backupStatus(`Download requested for ${blocks.length} saved notes. Unsaved drafts are excluded.`);
        } catch { backupStatus('Export failed. Please try again.'); }
    });
    $('#import-button').addEventListener('click', () => $('#file-input').click());
    $('#file-input').addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        cancelImport();
        const version = importVersion;
        backupStatus('Reading backup…');
        try {
            const imported = validate(JSON.parse(await file.text()));
            if (version !== importVersion) return;
            pendingImport = imported;
            $('#import-summary').textContent = `${file.name}: ${imported.length} valid notes. Replaces ${blocks.length} current notes${storageBlocked ? ' and unreadable saved data' : ''}.`;
            $('#import-preview').hidden = false;
            $('#replace-import').disabled = false;
            backupStatus('Backup validated. Review before replacing.');
            $('#cancel-import').focus();
        } catch {
            if (version !== importVersion) return;
            backupStatus('Invalid backup. Expected a JSON array of notes with text, optional title and color, and optional tags as an array of strings. Notes and draft kept.');
            $('#import-button').focus();
        }
    });
    $('#replace-import').addEventListener('click', () => {
        if (!pendingImport) return;
        if (!write('textBlocks', JSON.stringify(pendingImport))) {
            backupStatus('Could not save the backup in this browser. Existing notes and draft were kept. Export current notes, or free storage and try Replace again.');
            return;
        }
        blocks = pendingImport; storageBlocked = false; resetEditor(); render(); cancelImport();
        backupStatus(`Imported ${blocks.length} notes.`); notify(`Imported ${blocks.length} notes.`);
        $('#import-button').focus();
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
    iconMode = read('actionIconMode') === 'true'; updateActionStyle();
    chooseColor(selectedColor); render();
});
