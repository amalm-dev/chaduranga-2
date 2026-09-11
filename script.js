// ═══════════════════════════════════════════════════════
// CHADURANGA 2.0 — 12×12 Chess Variant Engine
// ═══════════════════════════════════════════════════════

// ─── CONFIGURATION ───
const BOARD_SIZE = 12;
const COLUMNS = ['a','b','c','d','e','f','g','h','i','j','k','l'];
const PIECE_SYMBOLS = {
    white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙', tiger: '🐅', rooster: '🐓' },
    black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟', tiger: '🐅', rooster: '🐓' }
};

const INITIAL_ROW = ['rook','knight','rooster','bishop','tiger','queen','king','tiger','bishop','rooster','knight','rook'];

// Storage keys
const LS_SESSION_KEY  = 'chaduranga_online_session';
const LS_ENV_MODE_KEY = 'chaduranga_env_mode';

// ─── GAME CLASS ───
class ChessGame {
    constructor() {
        this.board = [];
        this.terrain = [];
        this.currentPlayer = 'white';
        this.moveNumber = 1;
        this.capturedPieces = { white: [], black: [] };
        this.history = [];
        this.selectedSquare = null;
        this.validMoves = [];
        this.gameOver = false;
        this.enPassantTarget = null;
        this.lastMove = null;
        this.pieceIdCounter = 0;
        this.moveLog = [];
        this.currentMoveEntry = null;
        this.redoStack = [];

        // Environment position mode
        this.envMode = localStorage.getItem(LS_ENV_MODE_KEY) || 'random'; // 'random' | 'permanent'

        // Timer
        this.timerSeconds = 0;
        this.timerInterval = null;
        this.timerRunning = false;

        this.initTerrain();
    }

    // ── Board init ──
    initBoard() {
        this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        this.pieceIdCounter = 0;

        for (let c = 0; c < BOARD_SIZE; c++) {
            this.board[0][c] = this.createPiece(INITIAL_ROW[c], 'white');
            this.board[1][c] = this.createPiece('pawn', 'white');
        }
        for (let c = 0; c < BOARD_SIZE; c++) {
            this.board[11][c] = this.createPiece(INITIAL_ROW[c], 'black');
            this.board[10][c] = this.createPiece('pawn', 'black');
        }
    }

    createPiece(type, color) {
        return {
            type: type,
            color: color,
            hasMoved: false,
            forestBuff: false,
            waterCrippled: false,       // ★ PERMANENT flag (was waterDebuff: 0)
            isProtected: false,
            designatedForest: null,
            id: `${color}-${type}-${this.pieceIdCounter++}`
        };
    }

    // ★ Support random vs. permanent (fixed) terrain
    initTerrain() {
        this.terrain = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

        if (this.envMode === 'permanent') {
            // Fixed symmetric layout for tournament play
            const PERMANENT = [
                { r: 3, c: 4, type: 'forest' }, { r: 8, c: 7, type: 'forest' },
                { r: 4, c: 7, type: 'forest' }, { r: 7, c: 4, type: 'forest' },
                { r: 2, c: 5, type: 'water'  }, { r: 9, c: 6, type: 'water' },
                { r: 5, c: 3, type: 'water'  }, { r: 6, c: 8, type: 'water' },
                { r: 4, c: 4, type: 'temple' }, { r: 7, c: 7, type: 'temple' }
            ];
            PERMANENT.forEach(t => { this.terrain[t.r][t.c] = t.type; });
            return;
        }

        // Random symmetric layout (default)
        const usedPositions = new Set();
        const placePair = (type) => {
            let r, c, attempts = 0;
            do {
                r = Math.floor(Math.random() * 4) + 2;
                c = Math.floor(Math.random() * BOARD_SIZE);
                attempts++;
            } while (usedPositions.has(`${r},${c}`) && attempts < 100);
            if (attempts >= 100) return false;
            const mirrorR = BOARD_SIZE - 1 - r;
            const mirrorC = BOARD_SIZE - 1 - c;
            usedPositions.add(`${r},${c}`);
            usedPositions.add(`${mirrorR},${mirrorC}`);
            this.terrain[r][c] = type;
            this.terrain[mirrorR][mirrorC] = type;
            return true;
        };
        placePair('forest'); placePair('forest');
        placePair('water');  placePair('water');
        placePair('temple');
    }

    setEnvMode(mode) {
        this.envMode = mode;
        localStorage.setItem(LS_ENV_MODE_KEY, mode);
        this.initTerrain();
        this.assignForests();
        this.renderBoard();
        this.updateUI();
    }

    assignForests() {
        const forests = [];
        for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE; c++)
                if (this.terrain[r][c] === 'forest') forests.push({ r, c });

        const tigers = [];
        for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = this.board[r][c];
                if (p && p.type === 'tiger') tigers.push({ piece: p, r, c });
            }

        const available = [...forests];
        for (const tiger of tigers) {
            if (available.length === 0) break;
            let bestIdx = 0, bestDist = Infinity;
            for (let i = 0; i < available.length; i++) {
                const f = available[i];
                const dist = Math.abs(tiger.r - f.r) + Math.abs(tiger.c - f.c);
                if (dist < bestDist) { bestDist = dist; bestIdx = i; }
            }
            const chosen = available.splice(bestIdx, 1)[0];
            tiger.piece.designatedForest = { r: chosen.r, c: chosen.c };
        }
    }

    deepCopyBoard(boardToCopy) {
        return boardToCopy.map(row => row.map(cell => cell ? { ...cell } : null));
    }

    saveState() {
        this.history.push({
            board: this.deepCopyBoard(this.board),
            currentPlayer: this.currentPlayer,
            moveNumber: this.moveNumber,
            capturedPieces: {
                white: [...this.capturedPieces.white],
                black: [...this.capturedPieces.black]
            },
            enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
            lastMove: this.lastMove ? { ...this.lastMove } : null,
            moveLog: JSON.parse(JSON.stringify(this.moveLog)),
            currentMoveEntry: this.currentMoveEntry ? { ...this.currentMoveEntry } : null
        });
    }

    isInBounds(r, c) { return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE; }
    getPiece(r, c) { return this.isInBounds(r, c) ? this.board[r][c] : null; }
    getSquareElement(r, c) { return document.querySelector(`.square[data-row="${r}"][data-col="${c}"]`); }

    // ═══ TIMER ═══
    startTimer() {
        if (this.timerRunning) return;
        this.timerRunning = true;
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            this.updateTimerUI();
        }, 1000);
    }

    stopTimer() {
        this.timerRunning = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    resetTimer() {
        this.stopTimer();
        this.timerSeconds = 0;
        this.updateTimerUI();
    }

    updateTimerUI() {
        const el = document.getElementById('game-timer');
        if (!el) return;
        const m = Math.floor(this.timerSeconds / 60).toString().padStart(2, '0');
        const s = (this.timerSeconds % 60).toString().padStart(2, '0');
        el.textContent = `${m}:${s}`;
    }

    // ═══ RENDERING ═══
    renderBoard() {
        const boardEl = document.getElementById('board');
        if (!boardEl) return;
        boardEl.innerHTML = '';

        for (let r = BOARD_SIZE - 1; r >= 0; r--) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const square = document.createElement('div');
                square.className = 'square';
                square.classList.add((r + c) % 2 === 0 ? 'dark' : 'light');

                if (this.terrain[r][c]) {
                    square.classList.add(`terrain-${this.terrain[r][c]}`);
                    for (let rr = 0; rr < BOARD_SIZE; rr++) {
                        for (let cc = 0; cc < BOARD_SIZE; cc++) {
                            const p = this.board[rr][cc];
                            if (p && p.type === 'tiger' && p.designatedForest &&
                                p.designatedForest.r === r && p.designatedForest.c === c) {
                                square.classList.add('terrain-designated-forest');
                            }
                        }
                    }
                }

                square.dataset.row = r;
                square.dataset.col = c;

                const piece = this.board[r][c];
                if (piece) {
                    const pieceEl = document.createElement('span');
                    pieceEl.className = `piece ${piece.color}`;
                    pieceEl.dataset.type = piece.type;

                    // ★ Try custom image first — fall back to emoji if missing
                    const img = document.createElement('img');
                    img.src = `assets/models/pieces/${piece.color}-${piece.type}.png`;
                    img.alt = PIECE_SYMBOLS[piece.color][piece.type];
                    img.className = 'piece-img';
                    img.draggable = false;
                    img.onerror = () => {
                        // Custom image missing — show emoji/text instead
                        img.remove();
                        pieceEl.textContent = PIECE_SYMBOLS[piece.color][piece.type];
                    };
                    pieceEl.appendChild(img);

                    if (piece.isProtected) pieceEl.classList.add('protected');
                    if (piece.type === 'tiger' && piece.forestBuff) pieceEl.classList.add('buffed');
                    if (piece.type === 'rooster' && piece.waterCrippled) pieceEl.classList.add('debuffed');

                    square.appendChild(pieceEl);
                }

                square.addEventListener('click', () => this.handleSquareClick(r, c));
                boardEl.appendChild(square);
            }
        }
        this.renderLabels();
        this.highlightLastMoveIndicator();
    }

    renderLabels() {
        const topCols = document.getElementById('top-col-labels');
        const bottomCols = document.getElementById('bottom-col-labels');
        const leftRows = document.getElementById('left-row-labels');
        const rightRows = document.getElementById('right-row-labels');

        if (topCols && topCols.children.length === 0) {
            COLUMNS.forEach(c => {
                const s1 = document.createElement('span'); s1.textContent = c; topCols.appendChild(s1);
                const s2 = document.createElement('span'); s2.textContent = c; bottomCols.appendChild(s2);
            });
            for (let r = BOARD_SIZE; r >= 1; r--) {
                const s1 = document.createElement('span'); s1.textContent = r; leftRows.appendChild(s1);
                const s2 = document.createElement('span'); s2.textContent = r; rightRows.appendChild(s2);
            }
        }
    }

    updateUI() {
        const turnInd = document.getElementById('turn-indicator');
        if (turnInd) turnInd.textContent = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);

        const moveNum = document.getElementById('move-number');
        if (moveNum) moveNum.textContent = this.moveNumber;

        document.getElementById('white-player-card')?.classList.toggle('active-player', this.currentPlayer === 'white');
        document.getElementById('black-player-card')?.classList.toggle('active-player', this.currentPlayer === 'black');

        this.updateCapturedPieces();
        this.updateStatusEffects();
        this.highlightCheck();
    }

    updateCapturedPieces() {
        const wContainer = document.getElementById('captured-by-white');
        const bContainer = document.getElementById('captured-by-black');
        if (!wContainer || !bContainer) return;

        wContainer.innerHTML = '';
        bContainer.innerHTML = '';

        this.capturedPieces.white.forEach(p => {
            const el = document.createElement('span');
            el.className = 'captured-piece black';
            el.textContent = PIECE_SYMBOLS.black[p.type];
            wContainer.appendChild(el);
        });

        this.capturedPieces.black.forEach(p => {
            const el = document.createElement('span');
            el.className = 'captured-piece white';
            el.textContent = PIECE_SYMBOLS.white[p.type];
            bContainer.appendChild(el);
        });
    }

    updateStatusEffects() {
        const effectsEl = document.getElementById('status-effects');
        if (!effectsEl) return;
        effectsEl.innerHTML = '';

        let any = false;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = this.board[r][c];
                if (!p) continue;

                if (p.type === 'tiger' && p.forestBuff) {
                    any = true;
                    const el = document.createElement('div');
                    el.className = 'status-effect-item';
                    el.textContent = `${p.color} Tiger: Forest Buff (+2 range)`;
                    effectsEl.appendChild(el);
                }
                if (p.type === 'rooster' && p.waterCrippled) {          // ★ permanent
                    any = true;
                    const el = document.createElement('div');
                    el.className = 'status-effect-item';
                    el.textContent = `${p.color} Rooster: Water-Crippled (permanent)`;
                    effectsEl.appendChild(el);
                }
                if (p.isProtected) {
                    any = true;
                    const el = document.createElement('div');
                    el.className = 'status-effect-item';
                    el.textContent = `${p.color} ${p.type} on Temple (protected)`;
                    effectsEl.appendChild(el);
                }
            }
        }
        if (!any) effectsEl.innerHTML = '<p class="no-effects">No active effects</p>';
    }

    clearHighlights() {
        document.querySelectorAll('.square').forEach(sq => {
            sq.classList.remove('selected', 'valid-move', 'valid-capture', 'check');
        });
        this.highlightLastMoveIndicator();
    }

    highlightLastMoveIndicator() {
        document.querySelectorAll('.square').forEach(sq => sq.classList.remove('last-move-from', 'last-move-to'));
        if (this.lastMove) {
            this.getSquareElement(this.lastMove.fromR, this.lastMove.fromC)?.classList.add('last-move-from');
            this.getSquareElement(this.lastMove.toR, this.lastMove.toC)?.classList.add('last-move-to');
        }
    }

    highlightMoves(moves) {
        moves.forEach(m => {
            const sq = this.getSquareElement(m.toRow, m.toCol);
            if (sq) sq.classList.add(m.isCapture ? 'valid-capture' : 'valid-move');
        });
    }

    highlightCheck() {
        const kingPos = this.findKing(this.currentPlayer);
        if (kingPos && this.isInCheck(this.currentPlayer)) {
            this.getSquareElement(kingPos.r, kingPos.c)?.classList.add('check');
        }
    }

    // ═══ MOVE GENERATION ═══
    getValidMoves(r, c) {
        const piece = this.board[r][c];
        if (!piece) return [];

        let rawMoves = [];
        switch (piece.type) {
            case 'king':    rawMoves = this.getKingMoves(r, c, piece);    break;
            case 'queen':   rawMoves = this.getQueenMoves(r, c, piece);   break;
            case 'rook':    rawMoves = this.getRookMoves(r, c, piece);    break;
            case 'bishop':  rawMoves = this.getBishopMoves(r, c, piece);  break;
            case 'knight':  rawMoves = this.getKnightMoves(r, c, piece);  break;
            case 'pawn':    rawMoves = this.getPawnMoves(r, c, piece);    break;
            case 'tiger':   rawMoves = this.getTigerMoves(r, c, piece);   break;
            case 'rooster': rawMoves = this.getRoosterMoves(r, c, piece); break;
        }
        return this.filterLegalMoves(r, c, rawMoves);
    }

    getKingMoves(r, c, piece) {
        const moves = [];
        const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (this.isInBounds(nr, nc)) {
                const target = this.board[nr][nc];
                if (!target || target.color !== piece.color) {
                    moves.push({ toRow: nr, toCol: nc, isCapture: !!target });
                }
            }
        }

        if (!piece.hasMoved && !this.isInCheck(piece.color) && c === 6) {
            const enemy = piece.color === 'white' ? 'black' : 'white';
            const rook1 = this.board[r][11];
            if (rook1 && rook1.type === 'rook' && rook1.color === piece.color && !rook1.hasMoved) {
                if (!this.board[r][7] && !this.board[r][8] && !this.board[r][9] && !this.board[r][10]) {
                    if (!this.isSquareAttacked(r, 7, enemy) && !this.isSquareAttacked(r, 8, enemy)) {
                        moves.push({ toRow: r, toCol: 8, isCastle: true, rookFromC: 11, rookToC: 7 });
                    }
                }
            }
            const rook2 = this.board[r][0];
            if (rook2 && rook2.type === 'rook' && rook2.color === piece.color && !rook2.hasMoved) {
                if (!this.board[r][1] && !this.board[r][2] && !this.board[r][3] && !this.board[r][4] && !this.board[r][5]) {
                    if (!this.isSquareAttacked(r, 5, enemy) && !this.isSquareAttacked(r, 4, enemy)) {
                        moves.push({ toRow: r, toCol: 4, isCastle: true, rookFromC: 0, rookToC: 5 });
                    }
                }
            }
        }
        return moves;
    }

    getSlidingMoves(r, c, dirs, piece) {
        const moves = [];
        for (const [dr, dc] of dirs) {
            let nr = r + dr, nc = c + dc;
            while (this.isInBounds(nr, nc)) {
                const target = this.board[nr][nc];
                if (!target) moves.push({ toRow: nr, toCol: nc, isCapture: false });
                else {
                    if (target.color !== piece.color) moves.push({ toRow: nr, toCol: nc, isCapture: true });
                    break;
                }
                nr += dr; nc += dc;
            }
        }
        return moves;
    }

    getQueenMoves(r, c, p) { return this.getSlidingMoves(r, c, [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]], p); }
    getRookMoves(r, c, p)  { return this.getSlidingMoves(r, c, [[-1,0],[1,0],[0,-1],[0,1]], p); }
    getBishopMoves(r, c, p){ return this.getSlidingMoves(r, c, [[-1,-1],[-1,1],[1,-1],[1,1]], p); }

    getKnightMoves(r, c, piece) {
        const moves = [];
        const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of jumps) {
            const nr = r + dr, nc = c + dc;
            if (this.isInBounds(nr, nc)) {
                const target = this.board[nr][nc];
                if (!target || target.color !== piece.color) {
                    moves.push({ toRow: nr, toCol: nc, isCapture: !!target });
                }
            }
        }
        return moves;
    }

    getPawnMoves(r, c, piece) {
        const moves = [];
        const dir = piece.color === 'white' ? 1 : -1;
        const startRow = piece.color === 'white' ? 1 : 10;
        const lastRank = piece.color === 'white' ? 11 : 0;
        const nr = r + dir;

        if (this.isInBounds(nr, c) && !this.board[nr][c]) {
            moves.push({ toRow: nr, toCol: c, isCapture: false, isPromotion: nr === lastRank });
            if (r === startRow) {
                const nnr = r + 2 * dir;
                if (this.isInBounds(nnr, c) && !this.board[nnr][c]) {
                    moves.push({ toRow: nnr, toCol: c, isCapture: false, isDoublePush: true });
                }
            }
        }
        for (const dc of [-1, 1]) {
            const nc = c + dc;
            if (this.isInBounds(nr, nc)) {
                const target = this.board[nr][nc];
                if (target && target.color !== piece.color) {
                    moves.push({ toRow: nr, toCol: nc, isCapture: true, isPromotion: nr === lastRank });
                } else if (!target && this.enPassantTarget && this.enPassantTarget.r === nr && this.enPassantTarget.c === nc) {
                    moves.push({ toRow: nr, toCol: nc, isCapture: true, isEnPassant: true });
                }
            }
        }
        return moves;
    }

    getTigerMoves(r, c, piece) {
        const moves = [];
        const forest = piece.designatedForest;
        if (!forest) return moves;

        const inForest = (r === forest.r && c === forest.c);

        if (inForest) {
            const range = piece.forestBuff ? 3 : 1;
            const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

            for (const [dr, dc] of dirs) {
                for (let dist = 1; dist <= range; dist++) {
                    const cr = r + dr * dist;
                    const cc = c + dc * dist;
                    if (!this.isInBounds(cr, cc)) break;

                    const target = this.board[cr][cc];
                    if (target) {
                        if (target.color !== piece.color &&
                            target.type !== 'king' &&
                            target.type !== 'tiger') {
                            const targetProtected = target.isProtected &&
                                                    this.terrain[cr][cc] === 'temple';
                            if (!targetProtected) {
                                moves.push({ toRow: cr, toCol: cc, isCapture: true, isTigerMove: true, fromForest: true });
                            }
                        }
                        break;
                    }
                }
            }
        } else {
            const dr = Math.sign(forest.r - r);
            const dc = Math.sign(forest.c - c);

            if (dr !== 0 && dc !== 0) {
                for (let dist = 1; dist <= 2; dist++) {
                    const nr = r + dr * dist;
                    const nc = c + dc * dist;
                    if (!this.isInBounds(nr, nc)) break;

                    const target = this.board[nr][nc];
                    const isDestination = (nr === forest.r && nc === forest.c);

                    if (!target) {
                        moves.push({ toRow: nr, toCol: nc, isCapture: false, fromForest: false });
                        if (isDestination) break;
                    } else {
                        if (isDestination &&
                            target.color !== piece.color &&
                            target.type !== 'king' &&
                            target.type !== 'tiger') {
                            const targetProtected = target.isProtected &&
                                                    this.terrain[nr][nc] === 'temple';
                            if (!targetProtected) {
                                moves.push({ toRow: nr, toCol: nc, isCapture: true, isTigerMove: true, fromForest: false });
                            }
                        }
                        break;
                    }
                }
            }
        }

        const seen = new Set();
        return moves.filter(m => {
            const k = `${m.toRow},${m.toCol}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }

    getRoosterMoves(r, c, piece) {
        const moves = [];
        const dir = piece.color === 'white' ? 1 : -1;
        const dist = piece.waterCrippled ? 1 : 2;      // ★ permanent cripple

        for (const dcDir of [-1, 1]) {
            const nr = r + dir * dist;
            const nc = c + dcDir * dist;
            if (this.isInBounds(nr, nc) && !this.board[nr][nc]) {
                moves.push({ toRow: nr, toCol: nc, isCapture: false });
            }
        }

        const capR = r + dir, capC = c;
        if (this.isInBounds(capR, capC)) {
            const target = this.board[capR][capC];
            if (target && target.color !== piece.color && target.type !== 'tiger') {
                const protectedHere = target.isProtected && this.terrain[capR][capC] === 'temple';
                if (!protectedHere) {
                    moves.push({ toRow: capR, toCol: capC, isCapture: true });
                }
            }
        }
        return moves;
    }

    filterLegalMoves(r, c, rawMoves) {
        const piece = this.board[r][c];
        const color = piece.color;
        const legalMoves = [];

        for (const move of rawMoves) {
            if (move.isCapture && !move.isEnPassant) {
                const target = this.board[move.toRow][move.toCol];
                if (target && target.type === 'tiger') continue;
                if (this.terrain[move.toRow][move.toCol] === 'temple' && target && target.isProtected) continue;
            }
            if (move.isEnPassant) {
                if (this.terrain[r][move.toCol] === 'temple') continue;
            }
            if (!this.wouldBeInCheck(r, c, move, color)) {
                legalMoves.push(move);
            }
        }
        return legalMoves;
    }

    wouldBeInCheck(fromR, fromC, move, color) {
        const savedBoard = this.deepCopyBoard(this.board);
        const piece = this.board[fromR][fromC];
        this.board[move.toRow][move.toCol] = piece;
        this.board[fromR][fromC] = null;
        if (move.isEnPassant) this.board[fromR][move.toCol] = null;

        const inCheck = this.isInCheck(color);
        this.board = savedBoard;
        return inCheck;
    }

    findKing(color) {
        for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = this.board[r][c];
                if (p && p.type === 'king' && p.color === color) return { r, c };
            }
        return null;
    }

    isInCheck(color) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;
        return this.isSquareAttacked(kingPos.r, kingPos.c, color === 'white' ? 'black' : 'white');
    }

    isSquareAttacked(r, c, byColor) {
        for (let rr = 0; rr < BOARD_SIZE; rr++)
            for (let cc = 0; cc < BOARD_SIZE; cc++) {
                const p = this.board[rr][cc];
                if (p && p.color === byColor && p.type !== 'tiger') {
                    if (this.canPieceAttack(rr, cc, r, c)) return true;
                }
            }
        return false;
    }

    canPieceAttack(fromR, fromC, toR, toC) {
        const piece = this.board[fromR][fromC];
        const dr = toR - fromR, dc = toC - fromC;

        switch (piece.type) {
            case 'king':   return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
            case 'queen':  return (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) && this.canSlideTo(fromR, fromC, toR, toC, [[Math.sign(dr), Math.sign(dc)]]);
            case 'rook':   return (dr === 0 || dc === 0) && this.canSlideTo(fromR, fromC, toR, toC, [[Math.sign(dr), Math.sign(dc)]]);
            case 'bishop': return (Math.abs(dr) === Math.abs(dc)) && this.canSlideTo(fromR, fromC, toR, toC, [[Math.sign(dr), Math.sign(dc)]]);
            case 'knight': return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
            case 'pawn': {
                const dir = piece.color === 'white' ? 1 : -1;
                return dr === dir && Math.abs(dc) === 1;
            }
            case 'rooster': {
                const rdir = piece.color === 'white' ? 1 : -1;
                return dr === rdir && dc === 0;
            }
            default: return false;
        }
    }

    canSlideTo(fromR, fromC, toR, toC, dirs) {
        const [dr, dc] = dirs[0];
        let r = fromR + dr, c = fromC + dc;
        while (this.isInBounds(r, c)) {
            if (r === toR && c === toC) return true;
            if (this.board[r][c]) return false;
            r += dr; c += dc;
        }
        return false;
    }

    isCheckmate(color) { return this.isInCheck(color) && !this.hasLegalMoves(color); }
    isStalemate(color) { return !this.isInCheck(color) && !this.hasLegalMoves(color); }

    hasLegalMoves(color) {
        for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = this.board[r][c];
                if (p && p.color === color && this.getValidMoves(r, c).length > 0) return true;
            }
        return false;
    }

    // ═══ EXECUTION ═══
    async handleSquareClick(r, c) {
        if (online.isOnline && !online.isMyTurn()) return;
        if (this.gameOver) return;

        const p = this.board[r][c];

        if (this.selectedSquare) {
            const { r: fromR, c: fromC } = this.selectedSquare;

            if (fromR === r && fromC === c) { this.deselectPiece(); return; }
            if (p && p.color === this.currentPlayer) { this.selectPiece(r, c); return; }

            const move = this.validMoves.find(m => m.toRow === r && m.toCol === c);
            if (move) {
                this.deselectPiece();
                if (move.isPromotion) {
                    const type = await this.showPromotionModal(this.currentPlayer);
                    if (!type) return;
                    move.promotionType = type;
                }
                this.makeMove(fromR, fromC, move);
                if (online.isOnline) online.sendMove({ fromR, fromC, move });
            } else {
                this.deselectPiece();
            }
        } else {
            if (p && p.color === this.currentPlayer) this.selectPiece(r, c);
        }
    }

    selectPiece(r, c) {
        this.deselectPiece();
        this.selectedSquare = { r, c };
        this.validMoves = this.getValidMoves(r, c);
        this.getSquareElement(r, c)?.classList.add('selected');
        this.highlightMoves(this.validMoves);
    }

    deselectPiece() {
        this.selectedSquare = null;
        this.validMoves = [];
        this.clearHighlights();
    }

    makeMove(fromR, fromC, move) {
        this.saveState();

        const piece = this.board[fromR][fromC];
        this.redoStack = [];

        this.board[move.toRow][move.toCol] = piece;
        this.board[fromR][fromC] = null;
        piece.hasMoved = true;

        if (move.isEnPassant) {
            const capturedPawn = this.board[fromR][move.toCol];
            this.handleCapture(capturedPawn);
            this.board[fromR][move.toCol] = null;
        } else if (move.isCapture) {
            const oldBoard = this.history[this.history.length - 1].board;
            const target = oldBoard[move.toRow][move.toCol];
            if (target) this.handleCapture(target);
        }

        if (move.isTigerMove && move.isCapture) {
            const wasInForest = move.fromForest === true;
            if (wasInForest) {
                piece.forestBuff = false;
                this.board[move.toRow][move.toCol] = null;
            } else {
                piece.forestBuff = true;
            }
        }

        if (move.isCastle) {
            const rook = this.board[fromR][move.rookFromC];
            this.board[fromR][move.rookToC] = rook;
            this.board[fromR][move.rookFromC] = null;
            rook.hasMoved = true;
        }

        if (move.promotionType) {
            this.board[move.toRow][move.toCol] = this.createPiece(move.promotionType, piece.color);
            this.board[move.toRow][move.toCol].hasMoved = true;
        }

        this.enPassantTarget = null;
        if (move.isDoublePush) {
            this.enPassantTarget = { r: (fromR + move.toRow) / 2, c: move.toCol };
        }

        const landedPiece = this.board[move.toRow][move.toCol];
        if (landedPiece) {
            if (landedPiece.type === 'tiger' && this.terrain[move.toRow][move.toCol] === 'forest') {
                if (landedPiece.designatedForest &&
                    landedPiece.designatedForest.r === move.toRow &&
                    landedPiece.designatedForest.c === move.toCol) {
                    landedPiece.forestBuff = true;
                }
            }
            if (landedPiece.type === 'rooster' && this.terrain[move.toRow][move.toCol] === 'water') {
                landedPiece.waterCrippled = true;      // ★ PERMANENT
            }
            if (this.terrain[move.toRow][move.toCol] === 'temple') {
                landedPiece.isProtected = true;
            } else {
                landedPiece.isProtected = false;
            }
        }

        this.lastMove = { fromR, fromC, toR: move.toRow, toC: move.toCol };

        // ★ Start timer on first move
        if (this.moveLog.length === 0 && !this.timerRunning && this.moveNumber === 1) {
            this.startTimer();
        }

        this.logMove(fromR, fromC, move.toRow, move.toCol, piece, move);
        this.switchTurn();
    }

    handleCapture(piece) {
        if (!piece) return;
        if (this.currentPlayer === 'white') this.capturedPieces.white.push(piece);
        else this.capturedPieces.black.push(piece);
    }

    logMove(fromR, fromC, toR, toC, piece, move) {
        const PIECE_LETTERS = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '', tiger: 'Ti', rooster: 'Ro' };
        const from = COLUMNS[fromC] + (fromR + 1);
        const to = COLUMNS[toC] + (toR + 1);
        const cap = move.isCapture || move.isTigerMove ? '×' : '→';

        let notation;
        if (move.isCastle) notation = toC > fromC ? 'O-O' : 'O-O-O';
        else if (move.promotionType) notation = `${from}${cap}${to}=${PIECE_LETTERS[move.promotionType]}`;
        else notation = `${PIECE_LETTERS[piece.type] || ''}${from}${cap}${to}`;

        if (piece.color === 'white') {
            this.currentMoveEntry = { moveNum: this.moveNumber, white: notation, black: '' };
            this.moveLog.push(this.currentMoveEntry);
        } else if (this.currentMoveEntry) {
            this.currentMoveEntry.black = notation;
        }
        this.renderMoveHistory();
    }

    renderMoveHistory() {
        const container = document.getElementById('move-history');
        if (!container) return;
        container.innerHTML = '';
        this.moveLog.forEach((entry, i) => {
            const div = document.createElement('div');
            div.className = 'move-entry' + (i === this.moveLog.length - 1 ? ' latest' : '');
            div.innerHTML = `<span class="move-number-col">${entry.moveNum}.</span><span class="move-white${entry.white.includes('×') ? ' move-capture' : ''}">${entry.white}</span><span class="move-black${entry.black.includes('×') ? ' move-capture' : ''}">${entry.black || ''}</span>`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    }

    switchTurn() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        if (this.currentPlayer === 'white') this.moveNumber++;

        // ★ REMOVED the waterDebuff decrement loop — cripple is now permanent

        this.renderBoard();
        this.updateUI();

        if (this.isCheckmate(this.currentPlayer)) {
            this.gameOver = true;
            this.stopTimer();
            document.getElementById('game-status').textContent = 'Checkmate!';
            this.showGameOverModal('Checkmate!', `${this.currentPlayer === 'white' ? 'Black' : 'White'} wins!`);
        } else if (this.isStalemate(this.currentPlayer)) {
            this.gameOver = true;
            this.stopTimer();
            document.getElementById('game-status').textContent = 'Stalemate';
            this.showGameOverModal('Stalemate', 'Draw.');
        } else if (this.isInCheck(this.currentPlayer)) {
            document.getElementById('game-status').textContent = 'Check!';
        } else {
            document.getElementById('game-status').textContent = '';
        }

        if (this.currentMoveEntry) {
            const lastColor = this.currentPlayer === 'white' ? 'black' : 'white';
            if (this.isCheckmate(this.currentPlayer)) this.currentMoveEntry[lastColor] += '#';
            else if (this.isInCheck(this.currentPlayer)) this.currentMoveEntry[lastColor] += '+';
            this.renderMoveHistory();
        }
    }

    replayMove(data) {
        this.makeMove(data.fromR, data.fromC, data.move);
    }

    undo() {
        if (this.history.length === 0 || online.isOnline) return;
        this.redoStack.push({
            board: this.deepCopyBoard(this.board),
            currentPlayer: this.currentPlayer,
            moveNumber: this.moveNumber,
            capturedPieces: JSON.parse(JSON.stringify(this.capturedPieces)),
            enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
            lastMove: this.lastMove ? { ...this.lastMove } : null,
            moveLog: JSON.parse(JSON.stringify(this.moveLog)),
            currentMoveEntry: this.currentMoveEntry ? { ...this.currentMoveEntry } : null
        });

        const state = this.history.pop();
        this.board = state.board;
        this.currentPlayer = state.currentPlayer;
        this.moveNumber = state.moveNumber;
        this.capturedPieces = state.capturedPieces;
        this.enPassantTarget = state.enPassantTarget;
        this.lastMove = state.lastMove;
        if (state.moveLog) {
            this.moveLog = state.moveLog;
            this.currentMoveEntry = state.currentMoveEntry || null;
        }
        this.gameOver = false;
        this.deselectPiece();
        this.renderBoard();
        this.updateUI();
        this.renderMoveHistory();
        document.getElementById('game-status').textContent = 'Move undone.';
    }

    redo() {
        if (this.redoStack.length === 0 || online.isOnline) return;
        this.history.push({
            board: this.deepCopyBoard(this.board),
            currentPlayer: this.currentPlayer,
            moveNumber: this.moveNumber,
            capturedPieces: JSON.parse(JSON.stringify(this.capturedPieces)),
            enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
            lastMove: this.lastMove ? { ...this.lastMove } : null,
            moveLog: JSON.parse(JSON.stringify(this.moveLog)),
            currentMoveEntry: this.currentMoveEntry ? { ...this.currentMoveEntry } : null
        });

        const next = this.redoStack.pop();
        this.board = next.board;
        this.currentPlayer = next.currentPlayer;
        this.moveNumber = next.moveNumber;
        this.capturedPieces = next.capturedPieces;
        this.enPassantTarget = next.enPassantTarget;
        this.lastMove = next.lastMove;
        if (next.moveLog) {
            this.moveLog = next.moveLog;
            this.currentMoveEntry = next.currentMoveEntry || null;
        }
        this.gameOver = false;
        this.deselectPiece();
        this.renderBoard();
        this.updateUI();
        this.renderMoveHistory();
        document.getElementById('game-status').textContent = 'Move redone.';
    }

    newGame() {
        this.history = [];
        this.currentPlayer = 'white';
        this.moveNumber = 1;
        this.capturedPieces = { white: [], black: [] };
        this.gameOver = false;
        this.enPassantTarget = null;
        this.lastMove = null;
        this.moveLog = [];
        this.currentMoveEntry = null;
        this.redoStack = [];
        this.initTerrain();
        this.initBoard();
        this.assignForests();
        const moveHistoryEl = document.getElementById('move-history');
        if (moveHistoryEl) moveHistoryEl.innerHTML = '';
        this.deselectPiece();
        this.renderBoard();
        this.updateUI();
        this.resetTimer();
        document.getElementById('game-status').textContent = 'New game started.';
    }

    showPromotionModal(color) {
        return new Promise(resolve => {
            const modal = document.getElementById('promotion-modal');
            const opts = document.getElementById('promotion-options');
            opts.innerHTML = '';
            ['queen', 'rook', 'bishop', 'knight'].forEach(type => {
                const btn = document.createElement('button');
                btn.className = 'btn-option';
                btn.textContent = PIECE_SYMBOLS[color][type];
                btn.onclick = () => { modal.classList.remove('active'); resolve(type); };
                opts.appendChild(btn);
            });
            modal.classList.add('active');
        });
    }

    showGameOverModal(title, msg) {
        const modal = document.getElementById('gameover-modal');
        document.getElementById('gameover-title').textContent = title;
        document.getElementById('gameover-message').textContent = msg;
        modal.classList.add('active');
        document.getElementById('gameover-new-game').onclick = () => {
            modal.classList.remove('active');
            this.newGame();
        };
    }
}

// ═══════════════════════════════════════════════════════
// ONLINE MANAGER
// ═══════════════════════════════════════════════════════
class OnlineManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.conn = null;
        this.isOnline = false;
        this.myColor = null;
        this.roomCode = null;
    }

    generateShortCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }

    peerIdForCode(code) { return 'chaduranga2-' + code.toUpperCase(); }

    setChatVisible(visible) {
        const chatCard = document.getElementById('chat-card');
        const offlineHint = document.getElementById('offline-hint');
        if (!chatCard || !offlineHint) return;
        if (visible) {
            chatCard.classList.remove('hidden');
            offlineHint.classList.add('hidden');
        } else {
            chatCard.classList.add('hidden');
            offlineHint.classList.remove('hidden');
        }
    }

    saveSession(role) {
        try {
            localStorage.setItem(LS_SESSION_KEY, JSON.stringify({
                role,
                roomCode: this.roomCode,
                myColor: this.myColor,
                savedAt: Date.now()
            }));
        } catch (e) { /* ignore */ }
    }

    clearSession() {
        try { localStorage.removeItem(LS_SESSION_KEY); } catch (e) { /* ignore */ }
    }

    static loadSession() {
        try {
            const raw = localStorage.getItem(LS_SESSION_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (Date.now() - data.savedAt > 15 * 60 * 1000) {
                localStorage.removeItem(LS_SESSION_KEY);
                return null;
            }
            return data;
        } catch (e) { return null; }
    }

    createRoom() {
        if (typeof Peer === 'undefined') { alert('PeerJS not loaded.'); return; }

        const attempt = (retriesLeft = 5) => {
            if (retriesLeft <= 0) {
                document.getElementById('connection-status').textContent =
                    'Could not allocate a room code. Please try again.';
                return;
            }

            const code = this.generateShortCode();
            const peerId = this.peerIdForCode(code);
            const peer = new Peer(peerId);

            const onError = (err) => {
                peer.destroy();
                if (err.type === 'unavailable-id') attempt(retriesLeft - 1);
                else {
                    console.error('Peer error:', err);
                    document.getElementById('connection-status').textContent =
                        'Connection error. Please try again.';
                }
            };
            peer.on('error', onError);

            peer.on('open', () => {
                peer.off('error', onError);
                this.peer = peer;
                this.roomCode = code;
                this.myColor = 'white';

                document.getElementById('room-code').textContent = code;
                document.getElementById('room-code-display').style.display = 'block';
                document.getElementById('connection-status').textContent = 'Waiting for opponent…';
                document.getElementById('create-room-btn').disabled = true;

                this.generateQR(code);
            });

            peer.on('connection', (conn) => {
                this.conn = conn;
                this.setupConnection();
                document.getElementById('connection-status').textContent = 'Opponent connected!';
                setTimeout(() => {
                    document.getElementById('online-modal').classList.remove('active');
                    this.game.newGame();
                    this.isOnline = true;
                    this.game.updateUI();
                    this.setChatVisible(true);
                    this.saveSession('host');
                }, 800);
            });
        };

        attempt();
    }

    joinRoom(rawCode) {
        if (typeof Peer === 'undefined') { alert('PeerJS not loaded.'); return; }
        const code = (rawCode || '').trim().toUpperCase();
        if (code.length !== 4) {
            document.getElementById('connection-status').textContent =
                'Please enter a valid 4-character code.';
            return;
        }

        this.roomCode = code;
        this.myColor = 'black';

        const peer = new Peer();
        this.peer = peer;

        document.getElementById('connection-status').textContent = 'Connecting…';

        peer.on('open', () => {
            const targetId = this.peerIdForCode(code);
            this.conn = peer.connect(targetId, { reliable: true });

            this.conn.on('open', () => {
                this.setupConnection();
                document.getElementById('connection-status').textContent = 'Connected! You play Black.';
                setTimeout(() => {
                    document.getElementById('online-modal').classList.remove('active');
                    this.game.newGame();
                    this.isOnline = true;
                    this.game.updateUI();
                    this.setChatVisible(true);
                    this.saveSession('joiner');
                }, 800);
            });

            this.conn.on('error', (err) => {
                console.error('Connection error:', err);
                document.getElementById('connection-status').textContent =
                    'Could not connect. Check the code and try again.';
            });
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
            document.getElementById('connection-status').textContent =
                err.type === 'peer-unavailable'
                    ? 'Room not found. Check the code.'
                    : 'Connection failed: ' + err.type;
        });
    }

    generateQR(code) {
        const canvas = document.getElementById('qr-code');
        if (!canvas || typeof QRious === 'undefined') return;

        const baseUrl = window.location.origin + window.location.pathname;
        const joinUrl = `${baseUrl}?join=${code}`;

        new QRious({
            element: canvas,
            value: joinUrl,
            size: 140,
            background: '#ffffff',
            foreground: '#1c1b19',
            level: 'M',
            padding: 8
        });
    }

    setupConnection() {
        this.conn.on('data', (data) => {
            if (data.type === 'move') {
                this.game.replayMove(data);
            } else if (data.type === 'chat') {
                const container = document.getElementById('chat-messages');
                if (container) {
                    const div = document.createElement('div');
                    div.className = `chat-msg theirs${data.isEmoji ? ' emoji-msg' : ''}`;
                    if (!data.isEmoji) {
                        div.innerHTML = `<span class="chat-sender">${data.sender || 'opponent'}</span>${data.text}`;
                    } else {
                        div.textContent = data.text;
                    }
                    container.appendChild(div);
                    container.scrollTop = container.scrollHeight;
                    while (container.children.length > 50) container.removeChild(container.firstChild);
                }
                if (data.isEmoji) spawnBalloonEmoji(data.text);
            }
        });

        this.conn.on('close', () => {
            this.isOnline = false;
            document.getElementById('game-status').textContent = 'Opponent disconnected';
            this.setChatVisible(false);
        });
    }

    sendMove(moveData) {
        if (this.conn && this.conn.open) this.conn.send({ type: 'move', ...moveData });
    }

    isMyTurn() { return !this.isOnline || this.myColor === this.game.currentPlayer; }
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function spawnBalloonEmoji(emoji) {
    const board = document.querySelector('.board-wrapper');
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'emoji-balloon';
    el.textContent = emoji;
    el.style.left = (rect.left + rect.width * 0.3 + Math.random() * rect.width * 0.4) + 'px';
    el.style.top = (rect.top + rect.height * 0.5) + 'px';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

// ═══════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════
const game = new ChessGame();
const online = new OnlineManager(game);

document.addEventListener('DOMContentLoaded', () => {

    // ─── Settings menu toggle ───
    const settingsBtn = document.getElementById('settings-menu-btn');
    const settingsMenu = document.getElementById('settings-menu');
    if (settingsBtn && settingsMenu) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = settingsMenu.classList.toggle('open');
            settingsBtn.setAttribute('aria-expanded', String(isOpen));
        });
        document.addEventListener('click', (e) => {
            if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
                settingsMenu.classList.remove('open');
                settingsBtn.setAttribute('aria-expanded', 'false');
            }
        });
        settingsMenu.querySelectorAll('.settings-item').forEach(item => {
            item.addEventListener('click', () => {
                setTimeout(() => {
                    settingsMenu.classList.remove('open');
                    settingsBtn.setAttribute('aria-expanded', 'false');
                }, 120);
            });
        });
    }

    // ─── Core controls ───
    document.getElementById('new-game-btn')?.addEventListener('click', () => {
        online.isOnline = false;
        online.clearSession();
        online.setChatVisible(false);
        game.newGame();
    });

    document.getElementById('undo-btn')?.addEventListener('click', () => game.undo());
    document.getElementById('redo-btn')?.addEventListener('click', () => game.redo());

    document.getElementById('online-btn')?.addEventListener('click', () => {
        document.getElementById('online-modal').classList.add('active');
    });

    // ─── Fullscreen ───
    document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                document.body.classList.add('fullscreen-mode');
            }).catch(() => {});
        } else {
            document.exitFullscreen().then(() => {
                document.body.classList.remove('fullscreen-mode');
            }).catch(() => {});
        }
    });
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('fullscreen-mode');
            document.getElementById('panel-left')?.classList.remove('panel-open');
            document.getElementById('panel-right')?.classList.remove('panel-open');
        }
        setTimeout(() => { if (renderer3d) renderer3d.onResize(); }, 100);
    });

    // ─── Reset view ───
    document.getElementById('reset-view-btn')?.addEventListener('click', () => {
        if (renderer3d && typeof renderer3d.camera !== 'undefined') {
            renderer3d.camera.position.set(6, 12, 16);
            renderer3d.controls?.target?.set(6, 0, 6);
            renderer3d.controls?.update();
        }
        document.querySelector('.board-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // ─── Panel toggles (fullscreen) ───
    document.getElementById('toggle-left-panel')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('panel-left')?.classList.toggle('panel-open');
        document.getElementById('panel-right')?.classList.remove('panel-open');
    });
    document.getElementById('toggle-right-panel')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('panel-right')?.classList.toggle('panel-open');
        document.getElementById('panel-left')?.classList.remove('panel-open');
    });
    document.addEventListener('click', (e) => {
        if (!document.body.classList.contains('fullscreen-mode')) return;
        const leftPanel = document.getElementById('panel-left');
        const rightPanel = document.getElementById('panel-right');
        if (leftPanel?.classList.contains('panel-open') && !leftPanel.contains(e.target) && !e.target.closest('.panel-toggle')) {
            leftPanel.classList.remove('panel-open');
        }
        if (rightPanel?.classList.contains('panel-open') && !rightPanel.contains(e.target) && !e.target.closest('.panel-toggle')) {
            rightPanel.classList.remove('panel-open');
        }
    });

    // ─── Online modal buttons ───
    document.getElementById('create-room-btn')?.addEventListener('click', () => online.createRoom());
    document.getElementById('join-room-btn')?.addEventListener('click', () => {
        const code = document.getElementById('join-code-input').value.trim().toUpperCase();
        if (code.length === 4) online.joinRoom(code);
        else document.getElementById('connection-status').textContent = 'Please enter a 4-character code.';
    });
    document.getElementById('copy-code-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(online.roomCode || '');
        const btn = document.getElementById('copy-code-btn');
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => btn.textContent = orig, 1200);
    });
    document.getElementById('share-btn')?.addEventListener('click', () => {
        const baseUrl = window.location.origin + window.location.pathname;
        const msg = `Join my Chaduranga game! Code: ${online.roomCode}\nOr tap: ${baseUrl}?join=${online.roomCode}`;
        navigator.clipboard.writeText(msg);
        const btn = document.getElementById('share-btn');
        const orig = btn.textContent;
        btn.textContent = '✓ Invite copied';
        setTimeout(() => btn.textContent = orig, 1200);
    });
    document.getElementById('close-online-modal')?.addEventListener('click', () => {
        document.getElementById('online-modal').classList.remove('active');
    });

    // ─── 3D View ───
    let is3D = false;
    let renderer3d = null;
    document.getElementById('toggle-3d-btn')?.addEventListener('click', () => {
        is3D = !is3D;
        const boardWrapper = document.querySelector('.board-wrapper');
        const btn = document.getElementById('toggle-3d-btn');
        if (is3D) {
            boardWrapper.classList.add('mode-3d');
            btn.textContent = '🎲 2D View';
            btn.classList.add('active-toggle');
            if (!renderer3d && typeof ChessRenderer3D !== 'undefined') {
                renderer3d = new ChessRenderer3D('canvas-3d');
                renderer3d.onSquareClick((row, col) => game.handleSquareClick(row, col));
            }
            if (renderer3d) { renderer3d.show(); renderer3d.syncBoard(game.board, game.terrain); }
        } else {
            boardWrapper.classList.remove('mode-3d');
            btn.textContent = '🎲 3D View';
            btn.classList.remove('active-toggle');
            if (renderer3d) renderer3d.hide();
        }
    });

    // ─── Day / Night ───
    const envModes = ['day', 'sunset', 'night'];
    const envIcons = ['☀️ Day', '🌅 Sunset', '🌙 Night'];
    let envIndex = -1;
    document.getElementById('toggle-daynight-btn')?.addEventListener('click', () => {
        document.body.classList.remove('env-day', 'env-sunset', 'env-night');
        envIndex = (envIndex + 1) % envModes.length;
        document.body.classList.add(`env-${envModes[envIndex]}`);
        document.getElementById('toggle-daynight-btn').textContent = envIcons[envIndex];
        if (renderer3d) renderer3d.setEnvironment(envModes[envIndex]);
    });

    // ─── Biome ───
    const biomes = ['desert', 'snow', 'ocean', 'volcano', 'forest'];
    const biomeIcons = ['🏜️ Desert', '❄️ Snow', '🌊 Ocean', '🌋 Volcano', '🌲 Forest'];
    let biomeIndex = 0;
    document.getElementById('biome-btn')?.addEventListener('click', () => {
        biomeIndex = (biomeIndex + 1) % biomes.length;
        document.getElementById('biome-btn').textContent = biomeIcons[biomeIndex];
        if (renderer3d && typeof renderer3d.setBiome === 'function') renderer3d.setBiome(biomes[biomeIndex]);
    });

    // ─── Board theme ───
    const boardThemes = ['classic', 'walnut', 'marble', 'metallic', 'emerald', 'midnight', 'cherry'];
    const boardThemeIcons = ['🪵 Classic', '🌰 Walnut', '🪨 Marble', '⚙️ Metallic', '💎 Emerald', '🌙 Midnight', '🍒 Cherry'];
    let boardThemeIndex = 0;
    document.getElementById('board-theme-btn')?.addEventListener('click', () => {
        boardThemeIndex = (boardThemeIndex + 1) % boardThemes.length;
        const theme = boardThemes[boardThemeIndex];
        document.getElementById('board-theme-btn').textContent = boardThemeIcons[boardThemeIndex];
        if (theme === 'classic') document.documentElement.removeAttribute('data-board-theme');
        else document.documentElement.setAttribute('data-board-theme', theme);
        if (renderer3d && renderer3d.updateBoardColors) {
            const style = getComputedStyle(document.documentElement);
            renderer3d.updateBoardColors(
                style.getPropertyValue('--board-light').trim(),
                style.getPropertyValue('--board-dark').trim()
            );
        }
    });

    // ─── Env position mode (Random / Permanent) ───
    document.getElementById('env-position-btn')?.addEventListener('click', () => {
        const btn = document.getElementById('env-position-btn');
        const nextMode = game.envMode === 'random' ? 'permanent' : 'random';
        game.setEnvMode(nextMode);
        btn.textContent = nextMode === 'random' ? '🎲 Env: Random' : '📌 Env: Permanent';
    });
    {
        const btn = document.getElementById('env-position-btn');
        if (btn) btn.textContent = game.envMode === 'random' ? '🎲 Env: Random' : '📌 Env: Permanent';
    }

    // ─── Chat ───
    function addChatMessage(text, sender, isEmoji) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const div = document.createElement('div');
        const isMine = sender === (online.myColor || 'white');
        div.className = `chat-msg ${isMine ? 'mine' : 'theirs'}${isEmoji ? ' emoji-msg' : ''}`;
        if (!isEmoji) div.innerHTML = `<span class="chat-sender">${sender}</span>${text}`;
        else div.textContent = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        while (container.children.length > 50) container.removeChild(container.firstChild);
    }

    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.dataset.emoji;
            addChatMessage(emoji, online.myColor || 'white', true);
            spawnBalloonEmoji(emoji);
            if (online.conn && online.conn.open) {
                online.conn.send({ type: 'chat', text: emoji, sender: online.myColor, isEmoji: true });
            }
        });
    });

    function sendChat() {
        const input = document.getElementById('chat-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        addChatMessage(text, online.myColor || 'white', false);
        if (online.conn && online.conn.open) {
            online.conn.send({ type: 'chat', text, sender: online.myColor, isEmoji: false });
        }
        input.value = '';
    }
    document.getElementById('chat-send-btn')?.addEventListener('click', sendChat);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChat();
    });

    // ─── 3D sync hooks ───
    const origRenderBoard = game.renderBoard.bind(game);
    game.renderBoard = function() {
        origRenderBoard();
        if (is3D && renderer3d) {
            renderer3d.syncBoard(game.board, game.terrain);
            if (game.lastMove) renderer3d.highlightLastMove(game.lastMove.fromR, game.lastMove.fromC, game.lastMove.toR, game.lastMove.toC);
            if (game.isInCheck(game.currentPlayer)) {
                const kp = game.findKing(game.currentPlayer);
                if (kp) renderer3d.showCheck(kp.r, kp.c);
            }
        }
    };
    const origSelectPiece = game.selectPiece.bind(game);
    game.selectPiece = function(r, c) {
        origSelectPiece(r, c);
        if (is3D && renderer3d) renderer3d.showValidMoves(game.validMoves);
    };
    const origDeselectPiece = game.deselectPiece.bind(game);
    game.deselectPiece = function() {
        origDeselectPiece();
        if (is3D && renderer3d) renderer3d.clearIndicators();
    };

    // ─── Auto-join via URL ?join=CODE ───
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');
    if (joinCode && joinCode.length === 4) {
        setTimeout(() => {
            document.getElementById('online-modal').classList.add('active');
            document.getElementById('join-code-input').value = joinCode.toUpperCase();
            online.joinRoom(joinCode);
        }, 400);
    }

    // ─── Resume banner (auto-reconnect) ───
    const session = OnlineManager.loadSession();
    const resumeBanner = document.getElementById('resume-banner');
    if (session && resumeBanner) {
        resumeBanner.classList.remove('hidden');
        document.getElementById('resume-yes-btn')?.addEventListener('click', () => {
            resumeBanner.classList.add('hidden');
            document.getElementById('online-modal').classList.add('active');
            document.getElementById('join-code-input').value = session.roomCode;
            document.getElementById('connection-status').textContent =
                session.role === 'host'
                    ? 'You were the host. Click "Create Room" to start a new game with your friend.'
                    : 'You were joining. Click "Join Room" to reconnect to ' + session.roomCode + '.';
        });
        document.getElementById('resume-no-btn')?.addEventListener('click', () => {
            resumeBanner.classList.add('hidden');
            OnlineManager.loadSession();
            localStorage.removeItem(LS_SESSION_KEY);
        });
    }

    // ─── Reconnect cancel ───
    document.getElementById('reconnect-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('reconnect-overlay')?.classList.add('hidden');
    });

    // ─── Initial state ───
    online.setChatVisible(false);
    game.newGame();
});