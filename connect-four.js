'use strict';

// Original local game engine. Also serialized into a worker, so file:// needs no fetch.
function createConnectFourEngine() {
    const order = [3, 2, 4, 1, 5, 0, 6];
    function drop(board, column, player) {
        if (!Number.isInteger(column) || column < 0 || column > 6) return -1;
        for (let row = 5; row >= 0; row--) {
            const at = row * 7 + column;
            if (!board[at]) { board[at] = player; return at; }
        }
        return -1;
    }
    function line(board) {
        for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) {
            for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
                const cells = [0, 1, 2, 3].map(n => (row + dr * n) * 7 + col + dc * n);
                if (row + dr * 3 > 5 || col + dc * 3 < 0 || col + dc * 3 > 6) continue;
                if (board[cells[0]] && cells.every(at => board[at] === board[cells[0]])) return cells;
            }
        }
        return [];
    }
    function result(board) { const win = line(board); return win.length ? board[win[0]] : board.every(Boolean) ? 3 : 0; }
    function replay(moves) {
        if (!Array.isArray(moves) || moves.length > 42) throw new Error('Invalid game');
        const board = Array(42).fill(0);
        moves.forEach((col, turn) => { if (result(board) || drop(board, col, turn % 2 + 1) < 0) throw new Error('Invalid move'); });
        return board;
    }
    function choose(board, difficulty) {
        board = board.slice();
        if (result(board)) return -1;
        const legal = order.filter(col => !board[col]);
        const limits = { easy: [2, 35], medium: [4, 140], hard: [7, 450] };
        const [maxDepth, budget] = limits[difficulty] || limits.medium;
        const deadline = Date.now() + budget;
        // All levels take immediate wins and defend immediate losses.
        for (const player of [2, 1]) for (const col of legal) {
            const at = drop(board, col, player), wins = result(board) === player;
            board[at] = 0; if (wins) return col;
        }
        function evaluate() {
            let value = 0;
            for (let row = 0; row < 6; row++) {
                if (board[row * 7 + 3] === 2) value += 4;
                if (board[row * 7 + 3] === 1) value -= 4;
                for (let col = 0; col < 7; col++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
                    if (row + dr * 3 > 5 || col + dc * 3 < 0 || col + dc * 3 > 6) continue;
                    let us = 0, them = 0;
                    for (let n = 0; n < 4; n++) { const p = board[(row + dr * n) * 7 + col + dc * n]; us += p === 2; them += p === 1; }
                    if (!them) value += [0, 1, 8, 50, 10000][us];
                    if (!us) value -= [0, 1, 8, 60, 10000][them];
                }
            }
            return value;
        }
        function search(depth, player, alpha, beta) {
            if (Date.now() >= deadline) throw new Error('budget');
            const outcome = result(board);
            if (outcome) return outcome === 3 ? 0 : outcome === 2 ? 100000 + depth : -100000 - depth;
            if (!depth) return evaluate();
            let best = player === 2 ? -Infinity : Infinity;
            for (const col of order) if (!board[col]) {
                const at = drop(board, col, player);
                let score;
                try { score = search(depth - 1, 3 - player, alpha, beta); } finally { board[at] = 0; }
                best = player === 2 ? Math.max(best, score) : Math.min(best, score);
                if (player === 2) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
                if (alpha >= beta) break;
            }
            return best;
        }
        let chosen = legal[0];
        for (let depth = 1; depth <= maxDepth; depth++) {
            let best = -Infinity, candidate = chosen;
            try {
                for (const col of legal) {
                    const at = drop(board, col, 2);
                    let score;
                    try { score = search(depth - 1, 1, -Infinity, Infinity); } finally { board[at] = 0; }
                    if (score > best) { best = score; candidate = col; }
                }
                chosen = candidate;
            } catch { break; }
        }
        return chosen;
    }
    return { drop, line, result, replay, choose };
}
window.ConnectFourEngine = createConnectFourEngine();

(() => {
    const $ = selector => document.querySelector(selector), engine = window.ConnectFourEngine;
    const panel = $('#connect-four'), toggle = $('#connect-four-toggle'), workspace = $('.editor-workspace');
    const difficulty = $('#game-difficulty'), status = $('#game-status'), boardView = $('#game-board');
    const key = 'copyblocks.connectFour.v1', levels = ['easy', 'medium', 'hard'];
    const emptyScores = () => Object.fromEntries(levels.map(level => [level, { wins: 0, losses: 0, draws: 0 }]));
    let state = { moves: [], difficulty: 'medium', scores: emptyScores() }, worker, workerUrl, timer, generation = 0;
    try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved && levels.includes(saved.difficulty)) {
            engine.replay(saved.moves);
            if (!levels.every(level => ['wins', 'losses', 'draws'].every(name => Number.isSafeInteger(saved.scores?.[level]?.[name]) && saved.scores[level][name] >= 0))) throw new Error('Invalid scores');
            state = { moves: saved.moves, difficulty: saved.difficulty, scores: saved.scores };
        }
    } catch { $('#game-storage').textContent = 'Game storage unavailable or invalid. Playing locally.'; }
    difficulty.value = state.difficulty;
    let board = engine.replay(state.moves);
    function save() {
        try { localStorage.setItem(key, JSON.stringify(state)); $('#game-storage').textContent = ''; }
        catch { $('#game-storage').textContent = 'Game not saved. Keep this page open.'; }
    }
    function stopCPU() {
        generation++; clearTimeout(timer); worker?.terminate(); worker = null;
        if (workerUrl) URL.revokeObjectURL(workerUrl); workerUrl = null;
    }
    function draw() {
        const outcome = engine.result(board), winning = engine.line(board);
        const turn = state.moves.length % 2;
        status.textContent = outcome ? ['','You win!','CPU wins.','Draw.'][outcome] : turn ? (panel.hidden ? 'CPU paused.' : 'CPU thinking…') : 'Your turn.';
        $('#game-moves').textContent = `${state.moves.length} moves · ${state.difficulty}${difficulty.value !== state.difficulty ? ' · new difficulty next game' : ''}`;
        $('#game-history').textContent = state.moves.length ? `Columns: ${state.moves.map(col => col + 1).join(', ')}` : 'No moves yet.';
        const score = state.scores[state.difficulty];
        $('#game-scores').textContent = `${state.difficulty}: ${score.wins} wins · ${score.losses} losses · ${score.draws} draws`;
        for (let col = 0; col < 7; col++) {
            const button = boardView.children[col];
            button.disabled = !!(outcome || turn || board[col]);
            const contents = [];
            for (let row = 0; row < 6; row++) {
                const at = row * 7 + col, cell = button.children[row], player = board[at];
                cell.dataset.player = player; cell.classList.toggle('game-winning', winning.includes(at));
                cell.textContent = player === 1 ? '×' : player === 2 ? '○' : '';
                contents.push(player === 1 ? 'you' : player === 2 ? 'CPU' : 'empty');
            }
            button.setAttribute('aria-label', `Column ${col + 1}${board[col] ? ', full' : ', drop piece'}. Top to bottom: ${contents.join(', ')}`);
        }
    }
    function move(col) {
        if (engine.result(board)) return;
        const player = state.moves.length % 2 + 1;
        if (engine.drop(board, col, player) < 0) return;
        state.moves.push(col);
        const outcome = engine.result(board);
        if (outcome) state.scores[state.difficulty][outcome === 1 ? 'wins' : outcome === 2 ? 'losses' : 'draws']++;
        save(); draw();
    }
    function cpu() {
        if (panel.hidden || state.moves.length % 2 === 0 || engine.result(board)) return;
        stopCPU(); const token = generation;
        const finish = col => { if (token !== generation || panel.hidden) return; stopCPU(); move(col); };
        const fallback = () => { worker?.terminate(); worker = null; timer = setTimeout(() => { if (token === generation) finish(engine.choose(board, 'easy')); }, 30); };
        try {
            workerUrl = URL.createObjectURL(new Blob([`const engine = (${createConnectFourEngine.toString()})(); onmessage = e => postMessage(engine.choose(e.data.board, e.data.difficulty));`], { type: 'text/javascript' }));
            worker = new Worker(workerUrl);
            worker.onmessage = event => finish(event.data); worker.onerror = event => { event.preventDefault(); fallback(); };
            worker.postMessage({ board, difficulty: state.difficulty });
        } catch { fallback(); }
    }
    for (let col = 0; col < 7; col++) {
        const button = document.createElement('button'); button.type = 'button';
        for (let row = 0; row < 6; row++) { const cell = document.createElement('span'); cell.setAttribute('aria-hidden', 'true'); button.append(cell); }
        button.addEventListener('click', () => { if (state.moves.length % 2 || panel.hidden) return; move(col); cpu(); });
        button.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const buttons = [...boardView.children].filter(el => !el.disabled), at = buttons.indexOf(button);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (at + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next]?.focus({ preventScroll: true });
        });
        boardView.append(button);
    }
    function visibility(open) {
        panel.hidden = !open; workspace.classList.toggle('game-visible', open); toggle.setAttribute('aria-expanded', String(open));
        if (!open) { stopCPU(); toggle.focus({ preventScroll: true }); }
        draw(); if (open) cpu();
    }
    toggle.addEventListener('click', () => visibility(panel.hidden));
    $('#game-collapse').addEventListener('click', () => visibility(false));
    $('#game-new').addEventListener('click', () => { stopCPU(); state.moves = []; state.difficulty = difficulty.value; board = engine.replay([]); save(); draw(); });
    difficulty.addEventListener('change', () => { if (!state.moves.length) { state.difficulty = difficulty.value; save(); } draw(); });
    $('#game-reset-scores').addEventListener('click', () => { if (confirm('Reset all Connect Four scores?')) { state.scores = emptyScores(); save(); draw(); } });
    const styleButton = $('#action-style-button');
    function present() { $('#game-new').textContent = styleButton.getAttribute('aria-pressed') === 'true' ? '↻' : 'New game'; }
    new MutationObserver(present).observe(styleButton, { attributes: true, attributeFilter: ['aria-pressed'] });
    window.addEventListener('pagehide', stopCPU);
    present(); draw();
})();
