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

const LS_SESSION_KEY  = 'chaduranga_online_session';
const LS_ENV_MODE_KEY = 'chaduranga_env_mode';

// ★ FIXED: Permanent terrain layout (never changes)
const PERMANENT_TERRAIN = [
    { r: 4, c: 2,  type: 'water'  },  // c5  — river
    { r: 4, c: 4,  type: 'forest' },  // e5  — white tiger 1 forest
    { r: 6, c: 3,  type: 'temple' },  // d7
    { r: 7, c: 2,  type: 'water'  },  // c8
    { r: 7, c: 4,  type: 'forest' },  // e8  — black tiger 1 forest
    { r: 4, c: 7,  type: 'forest' },  // h5  — white tiger 2 forest
    { r: 5, c: 8,  type: 'temple' },  // i6  — temple
    { r: 4, c: 9,  type: 'water'  },  // j5  — water
    { r: 7, c: 7,  type: 'forest' },  // h8  — black tiger 2 forest
    { r: 7, c: 9,  type: 'water'  }   // j8  — water
];

// ★ FIXED: Forest assignments (based on tiger starting column)
const WHITE_FORESTS = [{ r: 4, c: 4 }, { r: 4, c: 7 }];   // e5, h5
const BLACK_FORESTS = [{ r: 7, c: 4 }, { r: 7, c: 7 }];   // e8, h8

// ═══════════════════════════════════════════════════════
// GAME CLASS
// ═══════════════════════════════════════════════════════
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
        this.boardFlipped = false;
        this.envMode = 'permanent';

        this.timerSeconds = 0;
        this.timerInterval = null;
        this.timerRunning = false;

        this.initTerrain();
    }

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
            waterCrippled: false,
            isProtected: false,
            designatedForest: null,
            tigerStationary: false,   // ★ tiger post-hunt flag
            id: `${color}-${type}-${this.pieceIdCounter++}`
        };
    }

    initTerrain() {
        this.terrain = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        PERMANENT_TERRAIN.forEach(t => { this.terrain[t.r][t.c] = t.type; });
    }

    setEnvMode(mode) {
        this.envMode = 'permanent';
        this.initTerrain();
        this.assignForests();
        this.renderBoard();
        this.updateUI();
    }

    assignForests() {
        const whiteTigers = [];
        const blackTigers = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = this.board[r][c];
                if (p && p.type === 'tiger') {
                    if (p.color === 'white') whiteTigers.push({ piece: p, c });
                    else blackTigers.push({ piece: p, c });
                }
            }
        }
        whiteTigers.sort((a, b) => a.c - b.c);
        blackTigers.sort((a, b) => a.c - b.c);
        whiteTigers.forEach((t, i) => {
            if (i < WHITE_FORESTS.length) t.piece.designatedForest = { ...WHITE_FORESTS[i] };
        });
        blackTigers.forEach((t, i) => {
            if (i < BLACK_FORESTS.length) t.piece.designatedForest = { ...BLACK_FORESTS[i] };
        });
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
        if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    }
    resetTimer() { this.stopTimer(); this.timerSeconds = 0; this.updateTimerUI(); }
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
        const flipped = this.boardFlipped;

        // ★ First pass: compute special-effect squares
        const tigerHaloSquares = new Set();   // "r,c" — tiger on its own forest
        const tigerDangerSquares = new Set(); // "r,c" — 8 neighbours of an active tiger
        const waterCrippleSquares = new Set();// "r,c" — rooster currently crippled
        const templeHaloSquares = new Set();  // "r,c" — piece resting on a temple

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const p = this.board[r][c];
                if (!p) continue;

                if (p.type === 'tiger' && p.designatedForest) {
                    const df = p.designatedForest;
                    if (df.r === r && df.c === c) {
                        tigerHaloSquares.add(`${r},${c}`);
                        // Danger zone: 8 neighbours (whether or not they hold pieces)
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                if (dr === 0 && dc === 0) continue;
                                const nr = r + dr, nc = c + dc;
                                if (this.isInBounds(nr, nc)) tigerDangerSquares.add(`${nr},${nc}`);
                            }
                        }
                    }
                }
                if (p.type === 'rooster') {
                    const onWater = this.terrain[r][c] === 'water';
                    if (onWater || p.waterCrippled) waterCrippleSquares.add(`${r},${c}`);
                }
                if (this.terrain[r][c] === 'temple') {
                    templeHaloSquares.add(`${r},${c}`);
                }
            }
        }

        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                const r = flipped ? i : (BOARD_SIZE - 1 - i);
                const c = flipped ? (BOARD_SIZE - 1 - j) : j;

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

                // ★ Tiger effects
                const key = `${r},${c}`;
                if (tigerHaloSquares.has(key))     square.classList.add('tiger-activated');
                if (tigerDangerSquares.has(key))   square.classList.add('tiger-danger');
                if (waterCrippleSquares.has(key))  square.classList.add('water-effect-active');
                if (templeHaloSquares.has(key))    square.classList.add('temple-protected');

                square.dataset.row = r;
                square.dataset.col = c;

                const piece = this.board[r][c];
                if (piece) {
                    if (this.terrain[r][c]) {
                        const t = this.terrain[r][c];
                        const isTigerOnOwnForest = piece.type === 'tiger' &&
                            piece.designatedForest &&
                            piece.designatedForest.r === r && piece.designatedForest.c === c;
                        const isRoosterOnWater = piece.type === 'rooster' && t === 'water';
                        const isPieceOnTemple = t === 'temple';
                        if (isTigerOnOwnForest || isRoosterOnWater || isPieceOnTemple) {
                            square.classList.add('terrain-active');
                        }
                    }

                    const pieceEl = document.createElement('span');
                    pieceEl.className = `piece ${piece.color}`;
                    pieceEl.dataset.type = piece.type;

                    const img = document.createElement('img');
                    img.src = `assets/models/pieces/${piece.color}-${piece.type}.png`;
                    img.alt = PIECE_SYMBOLS[piece.color][piece.type];
                    img.className = 'piece-img';
                    img.draggable = false;
                    img.onerror = () => {
                        img.remove();
                        pieceEl.textContent = PIECE_SYMBOLS[piece.color][piece.type];
                    };
                    pieceEl.appendChild(img);

                    if (piece.isProtected) pieceEl.classList.add('protected');
                    if (piece.type === 'tiger' && piece.forestBuff) pieceEl.classList.add('buffed');
                    if (piece.type === 'rooster' && piece.waterCrippled) pieceEl.classList.add('debuffed');
                    if (piece.type === 'tiger' && piece.tigerStationary) pieceEl.classList.add('tiger-spent');

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
        if (!topCols || !bottomCols || !leftRows || !rightRows) return;

        topCols.innerHTML = ''; bottomCols.innerHTML = '';
        leftRows.innerHTML = ''; rightRows.innerHTML = '';

        const flipped = this.boardFlipped;
        const cols = flipped ? [...COLUMNS].reverse() : COLUMNS;
        cols.forEach(c => {
            const s1 = document.createElement('span'); s1.textContent = c; topCols.appendChild(s1);
            const s2 = document.createElement('span'); s2.textContent = c; bottomCols.appendChild(s2);
        });

        if (flipped) {
            for (let r = 1; r <= BOARD_SIZE; r++) {
                const s1 = document.createElement('span'); s1.textContent = r; leftRows.appendChild(s1);
                const s2 = document.createElement('span'); s2.textContent = r; rightRows.appendChild(s2);
            }
        } else {
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

                if (p.type === 'tiger') {
                    const df = p.designatedForest;
                    const onOwn = df && df.r === r && df.c === c;
                    if (p.tigerStationary) {
                        any = true;
                        const el = document.createElement('div');
                        el.className = 'status-effect-item';
                        el.textContent = `${p.color} Tiger: Spent — vulnerable, no more moves`;
                        effectsEl.appendChild(el);
                    } else if (onOwn) {
                        any = true;
                        const el = document.createElement('div');
                        el.className = 'status-effect-item';
                        el.textContent = `${p.color} Tiger: Activated — invulnerable, hunting ready`;
                        effectsEl.appendChild(el);
                    } else {
                        any = true;
                        const el = document.createElement('div');
                        el.className = 'status-effect-item';
                        el.textContent = `${p.color} Tiger: Travelling to forest — vulnerable`;
                        effectsEl.appendChild(el);
                    }
                }
                if (p.type === 'rooster' && p.waterCrippled) {
                    any = true;
                    const el = document.createElement('div');
                    el.className = 'status-effect-item';
                    el.textContent = `${p.color} Rooster: Water-crippled — leap halved until it steps off`;
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

    // ═══════════════════════════════════════════════════════
    // ★ TIGER — REWRITTEN
    //   1. Travelling: moves ONLY forward (toward its forest), exactly 2 squares
    //      (skipping 1). Cannot capture. Cannot move backward.
    //   2. On its own forest: invulnerable, can hunt 1 adjacent enemy once.
    //   3. After hunt: spent (stationary forever), capturable.
    //   4. Special: enemy sitting on its designated forest can be struck
    //      from a distance of 2.
    // ═══════════════════════════════════════════════════════
    getTigerMoves(r, c, piece) {
        const moves = [];
        const forest = piece.designatedForest;
        if (!forest) return moves;
        if (piece.tigerStationary) return moves;   // spent

        const onOwnForest = (r === forest.r && c === forest.c);

        // ── Case 1: activated (on own forest) ──
        if (onOwnForest) {
            const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
            for (const [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;
                if (!this.isInBounds(nr, nc)) continue;
                const target = this.board[nr][nc];
                if (target && target.color !== piece.color &&
                    target.type !== 'king' && target.type !== 'tiger') {
                    if (this.terrain[nr][nc] === 'temple') continue;
                    moves.push({ toRow: nr, toCol: nc, isCapture: true, isTigerHunt: true });
                }
            }
            return moves;
        }

        // ── Case 2: travelling — only forward, exactly 2-square jump ──
        let dr = 0, dc = 0;
        if (forest.r > r) dr = 1;
        else if (forest.r < r) dr = -1;
        else if (forest.c > c) dc = 1;
        else if (forest.c < c) dc = -1;
        else return moves; // already on forest (handled above)

        const stepR = r + dr * 2;
        const stepC = c + dc * 2;
        if (this.isInBounds(stepR, stepC)) {
            const target = this.board[stepR][stepC];
            const isTargetMyForest = (stepR === forest.r && stepC === forest.c);

            if (!target) {
                // Normal jump — empty landing
                moves.push({ toRow: stepR, toCol: stepC, isCapture: false, isTigerJump: true });
            } else if (isTargetMyForest &&
                       target.color !== piece.color &&
                       target.type !== 'king' && target.type !== 'tiger') {
                // Special: enemy is sitting on my designated forest — strike it
                if (this.terrain[stepR][stepC] !== 'temple') {
                    moves.push({
                        toRow: stepR, toCol: stepC,
                        isCapture: true, isTigerJump: true,
                        isTigerForestStrike: true
                    });
                }
            }
            // else: landing occupied and not our forest → blocked, no move
        }

        // Deduplicate
        const seen = new Set();
        return moves.filter(m => {
            const k = `${m.toRow},${m.toCol}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }

    // ═══════════════════════════════════════════════════════
    // ★ ROOSTER — REWRITTEN
    //   - Default: 2-square diagonal leap (skips 1)
    //   - Crippled: while on water OR if last leap skipped water
    //     → 1-square diagonal, no forward capture that turn
    //   - Bound: cannot pass opponent pawn start row
    //   - Can jump over any piece (own or enemy)
    //   - Can check the King (via forward capture)
    // ═══════════════════════════════════════════════════════
    getRoosterMoves(r, c, piece) {
        const moves = [];
        const dir = piece.color === 'white' ? 1 : -1;
        const onWater = this.terrain[r][c] === 'water';
        const crippled = onWater || piece.waterCrippled;
        const dist = crippled ? 1 : 2;
        const boundaryRow = piece.color === 'white' ? 10 : 1;

        // Diagonal leap(s) — forward only
        for (const dcDir of [-1, 1]) {
            const nr = r + dir * dist;
            const nc = c + dcDir * dist;
            if (!this.isInBounds(nr, nc)) continue;
            if (piece.color === 'white' && nr > boundaryRow) continue;
            if (piece.color === 'black' && nr < boundaryRow) continue;

            if (!this.board[nr][nc]) {
                const m = { toRow: nr, toCol: nc, isCapture: false };
                if (dist === 2) {
                    m.midR = r + dir;
                    m.midC = c + dcDir;
                }
                moves.push(m);
            }
        }

        // Forward capture (1 square) — disabled while crippled
        if (!crippled) {
            const capR = r + dir, capC = c;
            if (this.isInBounds(capR, capC)) {
                let allowed = true;
                if (piece.color === 'white' && capR > boundaryRow) allowed = false;
                if (piece.color === 'black' && capR < boundaryRow) allowed = false;

                if (allowed) {
                    const target = this.board[capR][capC];
                    if (target && target.color !== piece.color && target.type !== 'tiger') {
                        if (this.terrain[capR][capC] !== 'temple') {
                            moves.push({ toRow: capR, toCol: capC, isCapture: true });
                        }
                    }
                }
            }
        }

        return moves;
    }

    // ═══════════════════════════════════════════════════════
    // ★ FILTER — temple combined-attack + king-temple ban
    // ═══════════════════════════════════════════════════════
    filterLegalMoves(r, c, rawMoves) {
        const piece = this.board[r][c];
        const color = piece.color;
        const legalMoves = [];

        for (const move of rawMoves) {
            // ★ King can NEVER move onto a temple square
            if (piece.type === 'king' && this.terrain[move.toRow][move.toCol] === 'temple') {
                continue;
            }

            if (move.isCapture && !move.isEnPassant) {
                const target = this.board[move.toRow][move.toCol];
                if (target) {
                    // ★ Tiger capture rules
                    if (target.type === 'tiger') {
                        const tf = target.designatedForest;
                        const onOwnForest = tf && tf.r === move.toRow && tf.c === move.toCol;
                        // Invulnerable only while ACTIVE and on its own forest
                        if (onOwnForest && !target.tigerStationary) continue;
                    }
                    // ★ Temple protection — broken only by a combined attack (2+ attackers)
                    if (this.terrain[move.toRow][move.toCol] === 'temple') {
                        const attackers = this.countAttackers(move.toRow, move.toCol, color);
                        if (attackers < 2) continue;
                    }
                }
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

    // ★ Count pieces of `byColor` that can currently attack (r,c)
    countAttackers(r, c, byColor) {
        let count = 0;
        for (let rr = 0; rr < BOARD_SIZE; rr++) {
            for (let cc = 0; cc < BOARD_SIZE; cc++) {
                const p = this.board[rr][cc];
                if (p && p.color === byColor && p.type !== 'tiger') {
                    if (this.canPieceAttack(rr, cc, r, c)) count++;
                }
            }
        }
        return count;
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
        if (!piece) return false;
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
            // ★ Tiger does NOT attack/check the king
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

        // ★ Rooster — did the leap skip over water?
        let roosterSkippedWater = false;
        if (piece.type === 'rooster' && move.midR !== undefined) {
            if (this.terrain[move.midR] && this.terrain[move.midR][move.midC] === 'water') {
                roosterSkippedWater = true;
            }
        }

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

        // ★ Tiger: after hunting, becomes stationary forever
        if (move.isTigerHunt || move.isTigerForestStrike) {
            piece.tigerStationary = true;
            piece.forestBuff = false;
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
            // Tiger forest buff (visual only)
            if (landedPiece.type === 'tiger' && this.terrain[move.toRow][move.toCol] === 'forest') {
                if (landedPiece.designatedForest &&
                    landedPiece.designatedForest.r === move.toRow &&
                    landedPiece.designatedForest.c === move.toCol) {
                    landedPiece.forestBuff = true;
                }
            }

            // ★ Rooster water cripple — recalculated each move
            if (landedPiece.type === 'rooster') {
                const landedOnWater = this.terrain[move.toRow][move.toCol] === 'water';
                if (landedOnWater || roosterSkippedWater) {
                    landedPiece.waterCrippled = true;
                } else {
                    landedPiece.waterCrippled = false;
                }
            }

            // Temple protection
            if (this.terrain[move.toRow][move.toCol] === 'temple') {
                landedPiece.isProtected = true;
            } else {
                landedPiece.isProtected = false;
            }
        }

        this.lastMove = { fromR, fromC, toR: move.toRow, toC: move.toCol };

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
        const cap = move.isCapture || move.isTigerHunt || move.isTigerForestStrike ? '×' : '→';

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

    replayMove(data) { this.makeMove(data.fromR, data.fromC, data.move); }

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

    newGame(flipBoard = false) {
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
        this.boardFlipped = flipBoard;
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
            this.newGame(this.boardFlipped);
        };
    }
}

// ═══════════════════════════════════════════════════════
// ONLINE MANAGER (unchanged)
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
                role, roomCode: this.roomCode, myColor: this.myColor, savedAt: Date.now()
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
                    this.game.newGame(this.myColor === 'black');
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
                    this.game.newGame(this.myColor === 'black');
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
            element: canvas, value: joinUrl, size: 140,
            background: '#ffffff', foreground: '#1c1b19',
            level: 'M', padding: 8
        });
    }

    setupConnection() {
        this.conn.on('data', (data) => {
            if (data.type === 'move') this.game.replayMove(data);
            else if (data.type === 'chat') {
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
// HELPERS (unchanged)
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
// INITIALIZATION (unchanged)
// ═══════════════════════════════════════════════════════
const game = new ChessGame();
const online = new OnlineManager(game);

document.addEventListener('DOMContentLoaded', () => {
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

    document.getElementById('new-game-btn')?.addEventListener('click', () => {
        online.isOnline = false;
        online.clearSession();
        online.setChatVisible(false);
        game.newGame(false);
    });

    document.getElementById('undo-btn')?.addEventListener('click', () => game.undo());
    document.getElementById('redo-btn')?.addEventListener('click', () => game.redo());

    document.getElementById('online-btn')?.addEventListener('click', () => {
        document.getElementById('online-modal').classList.add('active');
    });

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

    document.getElementById('reset-view-btn')?.addEventListener('click', () => {
        if (renderer3d && typeof renderer3d.camera !== 'undefined') {
            renderer3d.camera.position.set(6, 12, 16);
            renderer3d.controls?.target?.set(6, 0, 6);
            renderer3d.controls?.update();
        }
        document.querySelector('.board-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

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

    const biomes = ['desert', 'snow', 'ocean', 'volcano', 'forest'];
    const biomeIcons = ['🏜️ Desert', '❄️ Snow', '🌊 Ocean', '🌋 Volcano', '🌲 Forest'];
    let biomeIndex = 0;
    document.getElementById('biome-btn')?.addEventListener('click', () => {
        biomeIndex = (biomeIndex + 1) % biomes.length;
        document.getElementById('biome-btn').textContent = biomeIcons[biomeIndex];
        if (renderer3d && typeof renderer3d.setBiome === 'function') renderer3d.setBiome(biomes[biomeIndex]);
    });

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

    {
        const btn = document.getElementById('env-position-btn');
        if (btn) btn.textContent = '📌 Env: Permanent (fixed)';
        btn?.addEventListener('click', () => {
            game.initTerrain();
            game.assignForests();
            game.renderBoard();
            game.updateUI();
        });
    }

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

    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');
    if (joinCode && joinCode.length === 4) {
        setTimeout(() => {
            document.getElementById('online-modal').classList.add('active');
            document.getElementById('join-code-input').value = joinCode.toUpperCase();
            online.joinRoom(joinCode);
        }, 400);
    }

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

    document.getElementById('reconnect-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('reconnect-overlay')?.classList.add('hidden');
    });

    online.setChatVisible(false);
    game.newGame(false);
});