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
const INITIAL_ROW = ['rook','rooster','knight','bishop','tiger','queen','king','tiger','bishop','knight','rooster','rook'];
const TERRAIN_CONFIG = [
    { row: 4, col: 5, type: 'forest' }, { row: 7, col: 6, type: 'forest' },
    { row: 3, col: 3, type: 'water' }, { row: 8, col: 8, type: 'water' },
    { row: 2, col: 4, type: 'temple' }, { row: 9, col: 7, type: 'temple' }
];

// ─── GAME CLASS ───
class ChessGame {
    constructor() {
        this.board = [];
        this.terrain = [];
        this.currentPlayer = 'white';
        this.moveNumber = 1;
        this.capturedPieces = { white: [], black: [] }; // white means captured BY white
        this.history = []; // For undo
        this.selectedSquare = null;
        this.validMoves = [];
        this.gameOver = false;
        this.enPassantTarget = null;
        this.lastMove = null;
        this.pieceIdCounter = 0;
        this.moveLog = [];
        this.currentMoveEntry = null;
        this.redoStack = [];
        
        this.initTerrain();
    }
    
    // Board Management
    initBoard() {
        this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        this.pieceIdCounter = 0;
        
        // White pieces
        for (let c = 0; c < BOARD_SIZE; c++) {
            this.board[0][c] = this.createPiece(INITIAL_ROW[c], 'white');
            this.board[1][c] = this.createPiece('pawn', 'white');
        }
        
        // Black pieces
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
            waterDebuff: 0,
            id: `${color}-${type}-${this.pieceIdCounter++}`
        };
    }
    
    initTerrain() {
        this.terrain = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        
        // Randomize terrain positions each game
        // Place in rows 2-9 (avoid starting rows), symmetric for fairness
        const usedPositions = new Set();
        const terrainTypes = ['forest', 'forest', 'water', 'water', 'temple', 'temple'];
        
        for (let i = 0; i < terrainTypes.length; i += 2) {
            let r, c;
            do {
                r = Math.floor(Math.random() * 4) + 2; // rows 2-5
                c = Math.floor(Math.random() * BOARD_SIZE);
            } while (usedPositions.has(`${r},${c}`));
            
            usedPositions.add(`${r},${c}`);
            usedPositions.add(`${BOARD_SIZE - 1 - r},${BOARD_SIZE - 1 - c}`);
            
            this.terrain[r][c] = terrainTypes[i];
            this.terrain[BOARD_SIZE - 1 - r][BOARD_SIZE - 1 - c] = terrainTypes[i + 1];
        }
    }
    
    deepCopyBoard(boardToCopy) {
        let newBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (boardToCopy[r][c]) {
                    newBoard[r][c] = { ...boardToCopy[r][c] };
                }
            }
        }
        return newBoard;
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
            lastMove: this.lastMove ? { ...this.lastMove } : null
        });
    }
    
    isInBounds(r, c) {
        return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
    }
    
    getPiece(r, c) {
        return this.isInBounds(r, c) ? this.board[r][c] : null;
    }
    
    getSquareElement(r, c) {
        return document.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
    }
    
    // Rendering
    renderBoard() {
        const boardEl = document.getElementById('board');
        if (!boardEl) return;
        boardEl.innerHTML = '';
        
        for (let r = BOARD_SIZE - 1; r >= 0; r--) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const square = document.createElement('div');
                square.className = 'square';
                if ((r + c) % 2 === 0) square.classList.add('light');
                else square.classList.add('dark');
                
                if (this.terrain[r][c]) {
                    square.classList.add(`terrain-${this.terrain[r][c]}`);
                }
                
                square.dataset.row = r;
                square.dataset.col = c;
                
                const piece = this.board[r][c];
                if (piece) {
                    const pieceEl = document.createElement('span');
                    pieceEl.className = `piece ${piece.color}`;
                    pieceEl.dataset.type = piece.type;
                    pieceEl.textContent = PIECE_SYMBOLS[piece.color][piece.type];
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
                let s1 = document.createElement('span'); s1.textContent = c; topCols.appendChild(s1);
                let s2 = document.createElement('span'); s2.textContent = c; bottomCols.appendChild(s2);
            });
            for (let r = BOARD_SIZE; r >= 1; r--) {
                let s1 = document.createElement('span'); s1.textContent = r; leftRows.appendChild(s1);
                let s2 = document.createElement('span'); s2.textContent = r; rightRows.appendChild(s2);
            }
        }
    }
    
    updateUI() {
        const turnInd = document.getElementById('turn-indicator');
        if(turnInd) turnInd.textContent = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
        
        const moveNum = document.getElementById('move-number');
        if(moveNum) moveNum.textContent = this.moveNumber;
        
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
            let el = document.createElement('span');
            el.className = 'captured-piece black';
            el.textContent = PIECE_SYMBOLS.black[p.type];
            wContainer.appendChild(el);
        });
        
        this.capturedPieces.black.forEach(p => {
            let el = document.createElement('span');
            el.className = 'captured-piece white';
            el.textContent = PIECE_SYMBOLS.white[p.type];
            bContainer.appendChild(el);
        });
    }
    
    updateStatusEffects() {
        const effectsEl = document.getElementById('status-effects');
        if (!effectsEl) return;
        effectsEl.innerHTML = '';
        
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                let p = this.board[r][c];
                if (p) {
                    if (p.type === 'tiger' && p.forestBuff) {
                        let el = document.createElement('div');
                        el.className = 'status-effect-item';
                        el.textContent = `${p.color} Tiger: Forest Buff (+range)`;
                        effectsEl.appendChild(el);
                    }
                    if (p.type === 'rooster' && p.waterDebuff > 0) {
                        let el = document.createElement('div');
                        el.className = 'status-effect-item';
                        el.textContent = `${p.color} Rooster: Water Debuff (${p.waterDebuff} moves left)`;
                        effectsEl.appendChild(el);
                    }
                }
            }
        }
    }
    
    // Highlighting
    clearHighlights() {
        document.querySelectorAll('.square').forEach(sq => {
            sq.classList.remove('selected', 'valid-move', 'valid-capture', 'check');
        });
        this.highlightLastMoveIndicator();
    }
    
    highlightLastMoveIndicator() {
        document.querySelectorAll('.square').forEach(sq => sq.classList.remove('last-move-from', 'last-move-to'));
        if (this.lastMove) {
            let fromSq = this.getSquareElement(this.lastMove.fromR, this.lastMove.fromC);
            let toSq = this.getSquareElement(this.lastMove.toR, this.lastMove.toC);
            if(fromSq) fromSq.classList.add('last-move-from');
            if(toSq) toSq.classList.add('last-move-to');
        }
    }
    
    highlightMoves(moves) {
        moves.forEach(m => {
            let sq = this.getSquareElement(m.toRow, m.toCol);
            if (sq) {
                if (m.isCapture) sq.classList.add('valid-capture');
                else sq.classList.add('valid-move');
            }
        });
    }
    
    highlightCheck() {
        const kingPos = this.findKing(this.currentPlayer);
        if (kingPos && this.isInCheck(this.currentPlayer)) {
            let sq = this.getSquareElement(kingPos.r, kingPos.c);
            if (sq) sq.classList.add('check');
        }
    }
    
    // Move Generation
    getValidMoves(r, c) {
        let piece = this.board[r][c];
        if (!piece) return [];
        
        let rawMoves = [];
        switch (piece.type) {
            case 'king': rawMoves = this.getKingMoves(r, c, piece); break;
            case 'queen': rawMoves = this.getQueenMoves(r, c, piece); break;
            case 'rook': rawMoves = this.getRookMoves(r, c, piece); break;
            case 'bishop': rawMoves = this.getBishopMoves(r, c, piece); break;
            case 'knight': rawMoves = this.getKnightMoves(r, c, piece); break;
            case 'pawn': rawMoves = this.getPawnMoves(r, c, piece); break;
            case 'tiger': rawMoves = this.getTigerMoves(r, c, piece); break;
            case 'rooster': rawMoves = this.getRoosterMoves(r, c, piece); break;
        }
        
        return this.filterLegalMoves(r, c, rawMoves);
    }
    
    getKingMoves(r, c, piece) {
        let moves = [];
        const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        for (let [dr, dc] of dirs) {
            let nr = r + dr, nc = c + dc;
            if (this.isInBounds(nr, nc)) {
                let target = this.board[nr][nc];
                if (!target || target.color !== piece.color) {
                    moves.push({ toRow: nr, toCol: nc, isCapture: !!target });
                }
            }
        }
        
        // Castling
        if (!piece.hasMoved && !this.isInCheck(piece.color)) {
            // Kingside (col 8, rook at 11)
            if (c === 6) {
                let rook1 = this.board[r][11];
                if (rook1 && rook1.type === 'rook' && rook1.color === piece.color && !rook1.hasMoved) {
                    if (!this.board[r][7] && !this.board[r][8] && !this.board[r][9] && !this.board[r][10]) {
                        if (!this.isSquareAttacked(r, 7, piece.color === 'white' ? 'black' : 'white') && 
                            !this.isSquareAttacked(r, 8, piece.color === 'white' ? 'black' : 'white')) {
                            moves.push({ toRow: r, toCol: 8, isCastle: true, rookFromC: 11, rookToC: 7 });
                        }
                    }
                }
                
                // Queenside (col 4, rook at 0)
                let rook2 = this.board[r][0];
                if (rook2 && rook2.type === 'rook' && rook2.color === piece.color && !rook2.hasMoved) {
                    if (!this.board[r][1] && !this.board[r][2] && !this.board[r][3] && !this.board[r][4] && !this.board[r][5]) {
                        if (!this.isSquareAttacked(r, 5, piece.color === 'white' ? 'black' : 'white') &&
                            !this.isSquareAttacked(r, 4, piece.color === 'white' ? 'black' : 'white')) {
                            moves.push({ toRow: r, toCol: 4, isCastle: true, rookFromC: 0, rookToC: 5 });
                        }
                    }
                }
            }
        }
        return moves;
    }
    
    getSlidingMoves(r, c, dirs, piece) {
        let moves = [];
        for (let [dr, dc] of dirs) {
            let nr = r + dr, nc = c + dc;
            while (this.isInBounds(nr, nc)) {
                let target = this.board[nr][nc];
                if (!target) {
                    moves.push({ toRow: nr, toCol: nc, isCapture: false });
                } else {
                    if (target.color !== piece.color) {
                        moves.push({ toRow: nr, toCol: nc, isCapture: true });
                    }
                    break;
                }
                nr += dr; nc += dc;
            }
        }
        return moves;
    }
    
    getQueenMoves(r, c, piece) {
        const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        return this.getSlidingMoves(r, c, dirs, piece);
    }
    
    getRookMoves(r, c, piece) {
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        return this.getSlidingMoves(r, c, dirs, piece);
    }
    
    getBishopMoves(r, c, piece) {
        const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
        return this.getSlidingMoves(r, c, dirs, piece);
    }
    
    getKnightMoves(r, c, piece) {
        let moves = [];
        const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (let [dr, dc] of jumps) {
            let nr = r + dr, nc = c + dc;
            if (this.isInBounds(nr, nc)) {
                let target = this.board[nr][nc];
                if (!target || target.color !== piece.color) {
                    moves.push({ toRow: nr, toCol: nc, isCapture: !!target });
                }
            }
        }
        return moves;
    }
    
    getPawnMoves(r, c, piece) {
        let moves = [];
        let dir = piece.color === 'white' ? 1 : -1;
        let startRow = piece.color === 'white' ? 1 : 10;
        let lastRank = piece.color === 'white' ? 11 : 0;
        
        let nr = r + dir;
        if (this.isInBounds(nr, c) && !this.board[nr][c]) {
            moves.push({ toRow: nr, toCol: c, isCapture: false, isPromotion: nr === lastRank });
            
            // Double push
            if (r === startRow) {
                let nnr = r + 2 * dir;
                if (this.isInBounds(nnr, c) && !this.board[nnr][c]) {
                    moves.push({ toRow: nnr, toCol: c, isCapture: false, isDoublePush: true });
                }
            }
        }
        
        // Captures
        for (let dc of [-1, 1]) {
            let nc = c + dc;
            if (this.isInBounds(nr, nc)) {
                let target = this.board[nr][nc];
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
        let moves = [];
        const diags = [[1,1], [1,-1], [-1,1], [-1,-1]];
        const capRange = piece.forestBuff ? 2 : 1;
        
        for (let [dr, dc] of diags) {
            let nr = r + dr, nc = c + dc;
            while (this.isInBounds(nr, nc)) {
                let target = this.board[nr][nc];
                if (target) {
                    if (target.color !== piece.color) {
                        break; // Blocked by enemy on diagonal
                    }
                    // Own piece: jump over, continue scanning
                } else {
                    // Empty diagonal square — check H/V for capturable enemies
                    // Tiger moves TO the enemy's position (not the diagonal square)
                    const hvDirs = [[-1,0],[1,0],[0,-1],[0,1]];
                    for (let [hdr, hdc] of hvDirs) {
                        for (let dist = 1; dist <= capRange; dist++) {
                            let cr = nr + hdr * dist;
                            let cc = nc + hdc * dist;
                            if (!this.isInBounds(cr, cc)) break;
                            let capTarget = this.board[cr][cc];
                            if (capTarget) {
                                if (capTarget.color !== piece.color && capTarget.type !== 'king' && this.terrain[cr][cc] !== 'temple') {
                                    moves.push({ toRow: cr, toCol: cc, isCapture: true, isTigerMove: true });
                                }
                                break; // blocked by any piece
                            }
                        }
                    }
                }
                nr += dr; nc += dc;
            }
        }
        // Deduplicate (same target reachable from different diag squares)
        let unique = [];
        let seen = new Set();
        for (let m of moves) {
            let key = `${m.toRow},${m.toCol}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(m);
            }
        }
        return unique;
    }
    
    getRoosterMoves(r, c, piece) {
        let moves = [];
        let dir = piece.color === 'white' ? 1 : -1;
        
        // Diagonal forward movement — always 45° angle
        // Normal: 2 squares diag forward. Debuffed (water): 1 square diag forward.
        let dist = piece.waterDebuff > 0 ? 1 : 2;
        for (let dcDir of [-1, 1]) {
            let nr = r + dir * dist;
            let nc = c + dcDir * dist;
            if (this.isInBounds(nr, nc) && !this.board[nr][nc]) {
                moves.push({ toRow: nr, toCol: nc, isCapture: false });
            }
        }
        
        // Straight-ahead capture (1 square forward, same column)
        let capR = r + dir, capC = c;
        if (this.isInBounds(capR, capC)) {
            let target = this.board[capR][capC];
            if (target && target.color !== piece.color && this.terrain[capR][capC] !== 'temple') {
                moves.push({ toRow: capR, toCol: capC, isCapture: true });
            }
        }
        
        return moves;
    }
    
    filterLegalMoves(r, c, rawMoves) {
        let piece = this.board[r][c];
        let color = piece.color;
        let legalMoves = [];
        
        for (let move of rawMoves) {
            // Temple protection: can't capture pieces on temple squares
            if (move.isCapture && !move.isEnPassant) {
                if (this.terrain[move.toRow][move.toCol] === 'temple') continue;
            }
            if (move.isEnPassant) {
                if (this.terrain[r][move.toCol] === 'temple') continue;
            }
            
            // Check legality (doesn't leave own king in check)
            if (!this.wouldBeInCheck(r, c, move, color)) {
                legalMoves.push(move);
            }
        }
        return legalMoves;
    }
    
    wouldBeInCheck(fromR, fromC, move, color) {
        // Simulate the move on a temp board
        let savedBoard = this.deepCopyBoard(this.board);
        
        let piece = this.board[fromR][fromC];
        this.board[move.toRow][move.toCol] = piece;
        this.board[fromR][fromC] = null;
        
        // En passant: also remove the captured pawn
        if (move.isEnPassant) {
            this.board[fromR][move.toCol] = null;
        }
        
        let inCheck = this.isInCheck(color);
        
        this.board = savedBoard;
        return inCheck;
    }
    
    findKing(color) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                let p = this.board[r][c];
                if (p && p.type === 'king' && p.color === color) {
                    return { r, c };
                }
            }
        }
        return null;
    }
    
    isInCheck(color) {
        let kingPos = this.findKing(color);
        if (!kingPos) return false;
        return this.isSquareAttacked(kingPos.r, kingPos.c, color === 'white' ? 'black' : 'white');
    }
    
    isSquareAttacked(r, c, byColor) {
        for (let rr = 0; rr < BOARD_SIZE; rr++) {
            for (let cc = 0; cc < BOARD_SIZE; cc++) {
                let p = this.board[rr][cc];
                if (p && p.color === byColor && p.type !== 'tiger') {
                    if (this.canPieceAttack(rr, cc, r, c)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    canPieceAttack(fromR, fromC, toR, toC) {
        let piece = this.board[fromR][fromC];
        let dr = toR - fromR, dc = toC - fromC;
        
        switch (piece.type) {
            case 'king':
                return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
            case 'queen':
                return (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) && this.canSlideTo(fromR, fromC, toR, toC, [[Math.sign(dr), Math.sign(dc)]]);
            case 'rook':
                return (dr === 0 || dc === 0) && this.canSlideTo(fromR, fromC, toR, toC, [[Math.sign(dr), Math.sign(dc)]]);
            case 'bishop':
                return (Math.abs(dr) === Math.abs(dc)) && this.canSlideTo(fromR, fromC, toR, toC, [[Math.sign(dr), Math.sign(dc)]]);
            case 'knight':
                return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
            case 'pawn':
                let dir = piece.color === 'white' ? 1 : -1;
                return dr === dir && Math.abs(dc) === 1;
            case 'rooster':
                let rdir = piece.color === 'white' ? 1 : -1;
                return dr === rdir && dc === 0;
            default:
                return false;
        }
    }
    
    canSlideTo(fromR, fromC, toR, toC, dirs) {
        let [dr, dc] = dirs[0];
        let r = fromR + dr, c = fromC + dc;
        while (this.isInBounds(r, c)) {
            if (r === toR && c === toC) return true;
            if (this.board[r][c]) return false;
            r += dr; c += dc;
        }
        return false;
    }
    
    isCheckmate(color) {
        if (!this.isInCheck(color)) return false;
        return !this.hasLegalMoves(color);
    }
    
    isStalemate(color) {
        if (this.isInCheck(color)) return false;
        return !this.hasLegalMoves(color);
    }
    
    hasLegalMoves(color) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                let p = this.board[r][c];
                if (p && p.color === color) {
                    if (this.getValidMoves(r, c).length > 0) return true;
                }
            }
        }
        return false;
    }
    
    // Execution
    async handleSquareClick(r, c) {
        if (online.isOnline && !online.isMyTurn()) return;
        if (this.gameOver) return;
        
        let p = this.board[r][c];
        
        if (this.selectedSquare) {
            let fromR = this.selectedSquare.r, fromC = this.selectedSquare.c;
            
            if (fromR === r && fromC === c) {
                this.deselectPiece();
                return;
            }
            
            if (p && p.color === this.currentPlayer) {
                this.selectPiece(r, c);
                return;
            }
            
            let move = this.validMoves.find(m => m.toRow === r && m.toCol === c);
            if (move) {
                this.deselectPiece();
                
                if (move.isPromotion) {
                    let type = await this.showPromotionModal(this.currentPlayer);
                    if (!type) return;
                    move.promotionType = type;
                }
                
                this.makeMove(fromR, fromC, move);
                if (online.isOnline) {
                    online.sendMove({ fromR, fromC, move });
                }
            } else {
                this.deselectPiece();
            }
        } else {
            if (p && p.color === this.currentPlayer) {
                this.selectPiece(r, c);
            }
        }
    }
    
    selectPiece(r, c) {
        this.deselectPiece();
        this.selectedSquare = { r, c };
        this.validMoves = this.getValidMoves(r, c);
        
        let sq = this.getSquareElement(r, c);
        if(sq) sq.classList.add('selected');
        this.highlightMoves(this.validMoves);
    }
    
    deselectPiece() {
        this.selectedSquare = null;
        this.validMoves = [];
        this.clearHighlights();
    }
    
    makeMove(fromR, fromC, move) {
        this.saveState();
        
        let piece = this.board[fromR][fromC];
        this.redoStack = []; // New move clears redo history
        if (piece.type === 'rooster' && piece.waterDebuff > 0) {
            piece.waterDebuff--;
        }
        
        // Execute move
        this.board[move.toRow][move.toCol] = piece;
        this.board[fromR][fromC] = null;
        piece.hasMoved = true;
        
        // Captures — tiger now moves TO the enemy's square (standard capture)
        if (move.isEnPassant) {
            this.handleCapture(this.board[fromR][move.toCol]);
            this.board[fromR][move.toCol] = null;
        } else if (move.isCapture) {
            // The captured piece was at toRow/toCol before we overwrote it
            let oldBoard = this.history[this.history.length - 1].board;
            let target = oldBoard[move.toRow][move.toCol];
            if (target) this.handleCapture(target);
        }
        
        // Tiger: consume forest buff after any capture
        if (move.isTigerMove && move.isCapture) {
            piece.forestBuff = false;
        }
        
        // Castling
        if (move.isCastle) {
            let rook = this.board[fromR][move.rookFromC];
            this.board[fromR][move.rookToC] = rook;
            this.board[fromR][move.rookFromC] = null;
            rook.hasMoved = true;
        }
        
        // Promotion
        if (move.promotionType) {
            this.board[move.toRow][move.toCol] = this.createPiece(move.promotionType, piece.color);
            this.board[move.toRow][move.toCol].hasMoved = true;
        }
        
        // En Passant Target
        this.enPassantTarget = null;
        if (move.isDoublePush) {
            this.enPassantTarget = { r: (fromR + move.toRow) / 2, c: move.toCol };
        }
        
        // Terrain post-move
        if (piece.type === 'tiger' && this.terrain[move.toRow][move.toCol] === 'forest') {
            piece.forestBuff = true;
        }
        if (piece.type === 'rooster' && this.terrain[move.toRow][move.toCol] === 'water') {
            piece.waterDebuff = 3;
        }
        
        this.lastMove = { fromR, fromC, toR: move.toRow, toC: move.toCol };
        
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
        const COLUMNS = ['a','b','c','d','e','f','g','h','i','j','k','l'];
        
        let notation = '';
        let pieceLetter = PIECE_LETTERS[piece.type] || '';
        let from = COLUMNS[fromC] + (fromR + 1);
        let to = COLUMNS[toC] + (toR + 1);
        let capture = move.isCapture || move.isTigerMove ? '×' : '→';
        
        if (move.isCastle) {
            notation = toC > fromC ? 'O-O' : 'O-O-O';
        } else if (move.promotionType) {
            notation = `${from}${capture}${to}=${PIECE_LETTERS[move.promotionType]}`;
        } else {
            notation = `${pieceLetter}${from}${capture}${to}`;
        }
        
        // Add check/checkmate symbol after switch turn
        // (will be appended in switchTurn)
        
        if (piece.color === 'white') {
            this.currentMoveEntry = { moveNum: this.moveNumber, white: notation, black: '' };
            this.moveLog.push(this.currentMoveEntry);
        } else {
            if (this.currentMoveEntry) {
                this.currentMoveEntry.black = notation;
            }
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
            document.getElementById('game-status').textContent = 'Checkmate!';
            this.showGameOverModal('Checkmate!', `${this.currentPlayer === 'white' ? 'Black' : 'White'} wins!`);
        } else if (this.isStalemate(this.currentPlayer)) {
            this.gameOver = true;
            document.getElementById('game-status').textContent = 'Stalemate!';
            this.showGameOverModal('Stalemate', 'Draw.');
        } else if (this.isInCheck(this.currentPlayer)) {
            document.getElementById('game-status').textContent = 'Check!';
        } else {
            document.getElementById('game-status').textContent = '';
        }

        // Append check symbols to move notation
        if (this.currentMoveEntry) {
            const lastMove = this.currentPlayer === 'white' ? 'black' : 'white';
            const key = lastMove === 'white' ? 'white' : 'black';
            if (this.isCheckmate(this.currentPlayer)) {
                this.currentMoveEntry[key] += '#';
            } else if (this.isInCheck(this.currentPlayer)) {
                this.currentMoveEntry[key] += '+';
            }
            this.renderMoveHistory();
        }
    }
    
    replayMove(data) {
        let { fromR, fromC, move } = data;
        this.makeMove(fromR, fromC, move);
    }
    
    undo() {
        if (this.history.length === 0) return;
        if (online.isOnline) return;
        
        // Save current state for redo
        this.redoStack.push({
            board: this.deepCopyBoard(this.board),
            currentPlayer: this.currentPlayer,
            moveNumber: this.moveNumber,
            capturedPieces: JSON.parse(JSON.stringify(this.capturedPieces)),
            enPassantTarget: this.enPassantTarget ? {...this.enPassantTarget} : null,
            lastMove: this.lastMove ? {...this.lastMove} : null,
            moveLog: JSON.parse(JSON.stringify(this.moveLog)),
            currentMoveEntry: this.currentMoveEntry ? {...this.currentMoveEntry} : null
        });
        
        let state = this.history.pop();
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
        if (this.redoStack.length === 0) return;
        if (online.isOnline) return;
        
        // Save current to history
        this.history.push({
            board: this.deepCopyBoard(this.board),
            currentPlayer: this.currentPlayer,
            moveNumber: this.moveNumber,
            capturedPieces: JSON.parse(JSON.stringify(this.capturedPieces)),
            enPassantTarget: this.enPassantTarget ? {...this.enPassantTarget} : null,
            lastMove: this.lastMove ? {...this.lastMove} : null,
            moveLog: JSON.parse(JSON.stringify(this.moveLog)),
            currentMoveEntry: this.currentMoveEntry ? {...this.currentMoveEntry} : null
        });
        
        let next = this.redoStack.pop();
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
        const moveHistoryEl = document.getElementById('move-history');
        if (moveHistoryEl) moveHistoryEl.innerHTML = '';
        this.deselectPiece();
        this.initBoard();
        this.renderBoard();
        this.updateUI();
        document.getElementById('game-status').textContent = 'New game started.';
    }
    
    // Modals
    showPromotionModal(color) {
        return new Promise(resolve => {
            const modal = document.getElementById('promotion-modal');
            const opts = document.getElementById('promotion-options');
            opts.innerHTML = '';
            
            ['queen', 'rook', 'bishop', 'knight'].forEach(type => {
                let btn = document.createElement('button');
                btn.className = 'btn-option';
                btn.textContent = PIECE_SYMBOLS[color][type];
                btn.onclick = () => {
                    modal.classList.remove('active');
                    resolve(type);
                };
                opts.appendChild(btn);
            });
            
            modal.classList.add('active');
        });
    }
    
    showCaptureChoiceModal(captures) {
        return new Promise(resolve => {
            const modal = document.getElementById('capture-modal');
            const opts = document.getElementById('capture-options');
            opts.innerHTML = '';
            
            captures.forEach(cap => {
                let btn = document.createElement('button');
                btn.className = 'btn-option';
                let p = this.board[cap.row][cap.col];
                btn.textContent = `${PIECE_SYMBOLS[p.color][p.type]} at ${COLUMNS[cap.col]}${cap.row + 1}`;
                btn.onclick = () => {
                    modal.classList.remove('active');
                    resolve(cap);
                };
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

// ─── ONLINE MANAGER ───
class OnlineManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.conn = null;
        this.isOnline = false;
        this.myColor = null;
        this.roomCode = null;
    }

    createRoom() {
        if(typeof Peer === 'undefined') { alert("PeerJS not loaded"); return; }
        this.peer = new Peer();
        this.peer.on('open', (id) => {
            this.roomCode = id;
            this.myColor = 'white';
            document.getElementById('room-code').textContent = id;
            document.getElementById('room-code-display').style.display = 'block';
            document.getElementById('connection-status').textContent = 'Waiting for opponent...';
        });
        this.peer.on('connection', (conn) => {
            this.conn = conn;
            this.setupConnection();
            document.getElementById('connection-status').textContent = 'Opponent connected!';
            setTimeout(() => {
                document.getElementById('online-modal').classList.remove('active');
                this.game.newGame();
                this.isOnline = true;
                this.game.updateUI();
            }, 1000);
        });
    }

    joinRoom(code) {
        if(typeof Peer === 'undefined') { alert("PeerJS not loaded"); return; }
        this.peer = new Peer();
        this.peer.on('open', () => {
            this.conn = this.peer.connect(code);
            this.myColor = 'black';
            this.conn.on('open', () => {
                this.setupConnection();
                document.getElementById('connection-status').textContent = 'Connected! You play Black.';
                setTimeout(() => {
                    document.getElementById('online-modal').classList.remove('active');
                    this.game.newGame();
                    this.isOnline = true;
                    this.game.updateUI();
                }, 1000);
            });
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
                // Balloon notification for emojis
                if (data.isEmoji) {
                    const board = document.querySelector('.board-wrapper');
                    if (board) {
                        const rect = board.getBoundingClientRect();
                        const el = document.createElement('div');
                        el.className = 'emoji-balloon';
                        el.textContent = data.text;
                        el.style.left = (rect.left + rect.width * 0.3 + Math.random() * rect.width * 0.4) + 'px';
                        el.style.top = (rect.top + rect.height * 0.5) + 'px';
                        document.body.appendChild(el);
                        el.addEventListener('animationend', () => el.remove());
                    }
                }
            }
        });
        this.conn.on('close', () => {
            this.isOnline = false;
            document.getElementById('game-status').textContent = 'Opponent disconnected';
        });
    }

    sendMove(moveData) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type: 'move', ...moveData });
        }
    }

    isMyTurn() {
        return !this.isOnline || this.myColor === this.game.currentPlayer;
    }
}

// ─── INITIALIZATION ───
const game = new ChessGame();
const online = new OnlineManager(game);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('new-game-btn')?.addEventListener('click', () => {
        online.isOnline = false;
        game.newGame();
    });
    document.getElementById('undo-btn')?.addEventListener('click', () => game.undo());
    document.getElementById('redo-btn')?.addEventListener('click', () => game.redo());
    document.getElementById('online-btn')?.addEventListener('click', () => {
        document.getElementById('online-modal').classList.add('active');
    });
    
    // Fullscreen toggle
    document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                document.body.classList.add('fullscreen-mode');
                document.getElementById('fullscreen-btn').textContent = '⛶ Exit';
            }).catch(() => {});
        } else {
            document.exitFullscreen().then(() => {
                document.body.classList.remove('fullscreen-mode');
                document.getElementById('fullscreen-btn').textContent = '⛶ Fullscreen';
            }).catch(() => {});
        }
    });
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('fullscreen-mode');
            document.getElementById('fullscreen-btn').textContent = '⛶ Fullscreen';
            // Close panels when exiting fullscreen
            document.getElementById('panel-left')?.classList.remove('panel-open');
            document.getElementById('panel-right')?.classList.remove('panel-open');
        }
        // Resize 3D canvas to match new viewport
        setTimeout(() => {
            if (renderer3d) renderer3d.onResize();
        }, 100);
    });
    
    // Panel drawer toggles (fullscreen mode)
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
    // Close panels when clicking outside them in fullscreen
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
    
    // Balloon emoji helper — spawns a floating emoji over the board
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
    
    document.getElementById('create-room-btn')?.addEventListener('click', () => online.createRoom());
    document.getElementById('join-room-btn')?.addEventListener('click', () => {
        let code = document.getElementById('join-code-input').value.trim();
        if(code) online.joinRoom(code);
    });
    document.getElementById('copy-code-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(online.roomCode || '');
    });
    document.getElementById('close-online-modal')?.addEventListener('click', () => {
        document.getElementById('online-modal').classList.remove('active');
    });
    
    // 3D View Toggle
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
            if (renderer3d) {
                renderer3d.show();
                renderer3d.syncBoard(game.board, game.terrain);
            }
        } else {
            boardWrapper.classList.remove('mode-3d');
            btn.textContent = '🎲 3D View';
            btn.classList.remove('active-toggle');
            if (renderer3d) renderer3d.hide();
        }
    });
    
    // Day/Night Toggle
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
    
    // Biome cycling (3D ground environments)
    const biomes = ['desert', 'snow', 'ocean', 'volcano', 'forest'];
    const biomeIcons = ['🏜️ Desert', '❄️ Snow', '🌊 Ocean', '🌋 Volcano', '🌲 Forest'];
    let biomeIndex = 0;
    document.getElementById('biome-btn')?.addEventListener('click', () => {
        biomeIndex = (biomeIndex + 1) % biomes.length;
        document.getElementById('biome-btn').textContent = biomeIcons[biomeIndex];
        if (renderer3d && typeof renderer3d.setBiome === 'function') {
            renderer3d.setBiome(biomes[biomeIndex]);
        }
    });
    
    // Board theme cycling
    const boardThemes = ['classic', 'walnut', 'marble', 'metallic', 'emerald', 'midnight', 'cherry'];
    const boardThemeIcons = ['🪵 Classic', '🌰 Walnut', '🪨 Marble', '⚙️ Metallic', '💎 Emerald', '🌙 Midnight', '🍒 Cherry'];
    let boardThemeIndex = 0;
    document.getElementById('board-theme-btn')?.addEventListener('click', () => {
        boardThemeIndex = (boardThemeIndex + 1) % boardThemes.length;
        const theme = boardThemes[boardThemeIndex];
        document.getElementById('board-theme-btn').textContent = boardThemeIcons[boardThemeIndex];
        if (theme === 'classic') {
            document.documentElement.removeAttribute('data-board-theme');
        } else {
            document.documentElement.setAttribute('data-board-theme', theme);
        }
        // Update 3D board colors too
        if (renderer3d && renderer3d.updateBoardColors) {
            const style = getComputedStyle(document.documentElement);
            const light = style.getPropertyValue('--board-light').trim();
            const dark = style.getPropertyValue('--board-dark').trim();
            renderer3d.updateBoardColors(light, dark);
        }
    });
    
    // Emoji chat
    function addChatMessage(text, sender, isEmoji) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const div = document.createElement('div');
        const isMine = sender === (online.myColor || 'white');
        div.className = `chat-msg ${isMine ? 'mine' : 'theirs'}${isEmoji ? ' emoji-msg' : ''}`;
        if (!isEmoji) {
            div.innerHTML = `<span class="chat-sender">${sender}</span>${text}`;
        } else {
            div.textContent = text;
        }
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        while (container.children.length > 50) container.removeChild(container.firstChild);
    }
    
    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.dataset.emoji;
            addChatMessage(emoji, online.myColor || 'white', true);
            spawnBalloonEmoji(emoji); // Balloon over board
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
    
    // Sync 3D after moves
    const origRenderBoard = game.renderBoard.bind(game);
    game.renderBoard = function() {
        origRenderBoard();
        if (is3D && renderer3d) {
            renderer3d.syncBoard(game.board, game.terrain);
            if (game.lastMove) {
                renderer3d.highlightLastMove(game.lastMove.fromR, game.lastMove.fromC, game.lastMove.toR, game.lastMove.toC);
            }
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
    
    game.newGame();
});
