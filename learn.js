// ═══════════════════════════════════════════════════════════
// CHADURANGA 2.0 — Interactive Lesson Engine
// ═══════════════════════════════════════════════════════════

// ─── Piece symbols ───
const SYMBOLS = {
    white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙', tiger: '🐅', rooster: '🐓' },
    black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟', tiger: '🐅', rooster: '🐓' }
};

// ─── Column labels for the 12×12 board ───
const COLS = ['a','b','c','d','e','f','g','h','i','j','k','l'];
const ROWS = [12,11,10,9,8,7,6,5,4,3,2,1];  // top to bottom

// ═══════════════════════════════════════════════════════════
// Coordinate shift: lessons are defined on an 8×8 grid,
// but we display them centered on a 12×12 board.
// ═══════════════════════════════════════════════════════════
const BOARD_OFFSET = 2;
const BOARD_SIZE = 12;

function expandTo12x12(rawStep) {
    if (!rawStep) return rawStep;
    const shift = (p) => p ? { ...p, r: p.r + BOARD_OFFSET, c: p.c + BOARD_OFFSET } : p;
    const shiftArr = (arr) => arr ? arr.map(shift) : arr;
    const expanded = {
        ...rawStep,
        setup: shiftArr(rawStep.setup),
        highlights: shiftArr(rawStep.highlights),
        danger: shiftArr(rawStep.danger),
        source: shift(rawStep.source)
    };
    if (rawStep.expectedMove) {
        expanded.expectedMove = {
            from: shift(rawStep.expectedMove.from),
            to: shift(rawStep.expectedMove.to)
        };
    }
    return expanded;
}

// ═══════════════════════════════════════════════════════════
// PROGRESS TRACKING (localStorage)
// ═══════════════════════════════════════════════════════════
const PROGRESS_KEY = 'chaduranga_lessons_done';

function getCompletedLessons() {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
}

function markLessonComplete(id) {
    try {
        const done = getCompletedLessons();
        done[id] = Date.now();
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(done));
    } catch (e) { /* ignore */ }
}

function isLessonComplete(id) {
    return !!getCompletedLessons()[id];
}

// ═══════════════════════════════════════════════════════════
// LESSON DATA (positions in 8×8 coordinates — auto-shifted)
// ═══════════════════════════════════════════════════════════
const LESSONS = {

    // ═══════════ KING ═══════════
    king: {
        icon: '♔',
        title: 'The King',
        subtitle: 'Move 1 square in any direction. Protect it at all costs.',
        intro: 'The King is your most important piece — lose it and you lose the game. It moves slowly, one square per turn, so you must guard it carefully.',
        steps: [
            {
                title: 'One square, any direction',
                text: 'The King can move exactly one square: horizontally, vertically, or diagonally. Pick it up and drop it on any highlighted square.',
                setup: [{ piece: 'king', color: 'white', r: 4, c: 4 }],
                source: { r: 4, c: 4 },
                highlights: [
                    { r: 3, c: 3, type: 'move' }, { r: 3, c: 4, type: 'move' }, { r: 3, c: 5, type: 'move' },
                    { r: 4, c: 3, type: 'move' }, { r: 4, c: 5, type: 'move' },
                    { r: 5, c: 3, type: 'move' }, { r: 5, c: 4, type: 'move' }, { r: 5, c: 5, type: 'move' }
                ],
                expectedMove: { from: { r: 4, c: 4 }, to: { r: 4, c: 5 } }
            },
            {
                title: 'Cannot move into check',
                text: 'The King can never step onto a square attacked by an enemy. The black rook rules the e-file — the King cannot approach it. Move to a safe square.',
                setup: [
                    { piece: 'king', color: 'white', r: 4, c: 2 },
                    { piece: 'rook', color: 'black', r: 0, c: 4 }
                ],
                source: { r: 4, c: 2 },
                danger: [{ r: 4, c: 4 }, { r: 3, c: 4 }, { r: 5, c: 4 }],
                highlights: [
                    { r: 3, c: 2, type: 'move' },
                    { r: 5, c: 2, type: 'move' },
                    { r: 4, c: 1, type: 'move' },
                    { r: 4, c: 3, type: 'move' }
                ],
                expectedMove: { from: { r: 4, c: 2 }, to: { r: 3, c: 2 } }
            },
            {
                title: "Castling — the King's escape",
                text: "Once per game, if the King and a Rook haven't moved, they can swap positions in one move. The King slides two squares; the Rook jumps over to the other side.",
                setup: [
                    { piece: 'king', color: 'white', r: 7, c: 4 },
                    { piece: 'rook', color: 'white', r: 7, c: 7 }
                ],
                source: { r: 7, c: 4 },
                highlights: [
                    { r: 7, c: 5, type: 'move' },
                    { r: 7, c: 6, type: 'target' }
                ]
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'king', color: 'white', r: 7, c: 4 },
                { piece: 'rook', color: 'white', r: 7, c: 0 },
                { piece: 'rook', color: 'white', r: 7, c: 7 },
                { piece: 'pawn', color: 'white', r: 6, c: 3 },
                { piece: 'pawn', color: 'white', r: 6, c: 5 },
                { piece: 'king', color: 'black', r: 0, c: 4 },
                { piece: 'pawn', color: 'black', r: 1, c: 3 },
                { piece: 'pawn', color: 'black', r: 1, c: 5 }
            ]
        },
        next: 'queen'
    },

    // ═══════════ QUEEN ═══════════
    queen: {
        icon: '♕',
        title: 'The Queen',
        subtitle: 'Unlimited range in all eight directions.',
        intro: "The Queen is the most powerful piece on the board. She combines the Rook's straight-line power with the Bishop's diagonal reach — in every direction, any distance.",
        steps: [
            {
                title: 'All eight directions',
                text: 'From a central square, the Queen controls 27 squares. She sweeps along rows, columns, and both diagonals. Drop her on any highlighted square.',
                setup: [{ piece: 'queen', color: 'white', r: 3, c: 3 }],
                source: { r: 3, c: 3 },
                highlights: [
                    { r: 0, c: 3 }, { r: 1, c: 3 }, { r: 2, c: 3 }, { r: 4, c: 3 }, { r: 5, c: 3 }, { r: 6, c: 3 }, { r: 7, c: 3 },
                    { r: 3, c: 0 }, { r: 3, c: 1 }, { r: 3, c: 2 }, { r: 3, c: 4 }, { r: 3, c: 5 }, { r: 3, c: 6 }, { r: 3, c: 7 },
                    { r: 0, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 2 }, { r: 4, c: 4 }, { r: 5, c: 5 }, { r: 6, c: 6 }, { r: 7, c: 7 },
                    { r: 0, c: 6 }, { r: 1, c: 5 }, { r: 2, c: 4 }, { r: 4, c: 2 }, { r: 5, c: 1 }, { r: 6, c: 0 }
                ].map(s => ({ ...s, type: 'move' })),
                expectedMove: { from: { r: 3, c: 3 }, to: { r: 3, c: 6 } }
            },
            {
                title: 'Capture and stop',
                text: 'The Queen can take any piece in her line — but she stops on that square. She cannot jump over pieces. Capture the bishop!',
                setup: [
                    { piece: 'queen', color: 'white', r: 4, c: 2 },
                    { piece: 'bishop', color: 'black', r: 2, c: 4 }
                ],
                source: { r: 4, c: 2 },
                highlights: [{ r: 2, c: 4, type: 'capture' }],
                expectedMove: { from: { r: 4, c: 2 }, to: { r: 2, c: 4 } }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'queen', color: 'white', r: 7, c: 3 },
                { piece: 'pawn', color: 'white', r: 6, c: 3 },
                { piece: 'knight', color: 'black', r: 4, c: 5 },
                { piece: 'king', color: 'black', r: 0, c: 6 }
            ]
        },
        next: 'rook'
    },

    // ═══════════ ROOK ═══════════
    rook: {
        icon: '♖',
        title: 'The Rook',
        subtitle: 'Straight lines only — but any distance.',
        intro: 'The Rook is a powerhouse that slides along rows and columns. It teams up with the King for castling and dominates open files.',
        steps: [
            {
                title: 'Rows and columns',
                text: 'A Rook slides any number of empty squares in the four straight directions. Drop it on any highlighted square.',
                setup: [{ piece: 'rook', color: 'white', r: 4, c: 4 }],
                source: { r: 4, c: 4 },
                highlights: [
                    { r: 0, c: 4, type: 'move' }, { r: 1, c: 4, type: 'move' }, { r: 2, c: 4, type: 'move' }, { r: 3, c: 4, type: 'move' },
                    { r: 5, c: 4, type: 'move' }, { r: 6, c: 4, type: 'move' }, { r: 7, c: 4, type: 'move' },
                    { r: 4, c: 0, type: 'move' }, { r: 4, c: 1, type: 'move' }, { r: 4, c: 2, type: 'move' }, { r: 4, c: 3, type: 'move' },
                    { r: 4, c: 5, type: 'move' }, { r: 4, c: 6, type: 'move' }, { r: 4, c: 7, type: 'move' }
                ],
                expectedMove: { from: { r: 4, c: 4 }, to: { r: 4, c: 6 } }
            },
            {
                title: 'Blocked by own piece',
                text: 'A Rook cannot jump over any piece. It stops just before its own pieces and captures the first enemy in its line. Capture the knight!',
                setup: [
                    { piece: 'rook', color: 'white', r: 4, c: 2 },
                    { piece: 'pawn', color: 'white', r: 4, c: 4 },
                    { piece: 'knight', color: 'black', r: 4, c: 6 }
                ],
                source: { r: 4, c: 2 },
                highlights: [
                    { r: 4, c: 3, type: 'move' },
                    { r: 4, c: 6, type: 'capture' }
                ],
                expectedMove: { from: { r: 4, c: 2 }, to: { r: 4, c: 6 } }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'rook', color: 'white', r: 7, c: 0 },
                { piece: 'rook', color: 'white', r: 7, c: 7 },
                { piece: 'king', color: 'white', r: 7, c: 4 },
                { piece: 'pawn', color: 'white', r: 6, c: 0 },
                { piece: 'pawn', color: 'black', r: 4, c: 4 },
                { piece: 'king', color: 'black', r: 0, c: 0 }
            ]
        },
        next: 'bishop'
    },

    // ═══════════ BISHOP ═══════════
    bishop: {
        icon: '♗',
        title: 'The Bishop',
        subtitle: 'Diagonals for life — never leaves its color.',
        intro: 'The Bishop glides along diagonals of any length. Each Bishop is permanently bound to a single color — the light-squared or dark-squared diagonal network.',
        steps: [
            {
                title: 'The four diagonals',
                text: 'The Bishop sweeps in four diagonal directions. Notice it always stays on the same color. Drop it on any highlighted square.',
                setup: [{ piece: 'bishop', color: 'white', r: 4, c: 3 }],
                source: { r: 4, c: 3 },
                highlights: [
                    { r: 3, c: 2, type: 'move' }, { r: 2, c: 1, type: 'move' }, { r: 1, c: 0, type: 'move' },
                    { r: 5, c: 2, type: 'move' }, { r: 6, c: 1, type: 'move' }, { r: 7, c: 0, type: 'move' },
                    { r: 3, c: 4, type: 'move' }, { r: 2, c: 5, type: 'move' }, { r: 1, c: 6, type: 'move' }, { r: 0, c: 7, type: 'move' },
                    { r: 5, c: 4, type: 'move' }, { r: 6, c: 5, type: 'move' }, { r: 7, c: 6, type: 'move' }
                ],
                expectedMove: { from: { r: 4, c: 3 }, to: { r: 2, c: 5 } }
            },
            {
                title: 'Capturing diagonally',
                text: 'The Bishop stops at the first enemy in its line and takes it. Capture the black pawn!',
                setup: [
                    { piece: 'bishop', color: 'white', r: 5, c: 2 },
                    { piece: 'pawn', color: 'black', r: 3, c: 4 }
                ],
                source: { r: 5, c: 2 },
                highlights: [{ r: 3, c: 4, type: 'capture' }],
                expectedMove: { from: { r: 5, c: 2 }, to: { r: 3, c: 4 } }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'bishop', color: 'white', r: 7, c: 2 },
                { piece: 'bishop', color: 'white', r: 7, c: 5 },
                { piece: 'knight', color: 'black', r: 4, c: 5 },
                { piece: 'king', color: 'black', r: 0, c: 4 }
            ]
        },
        next: 'knight'
    },

    // ═══════════ KNIGHT ═══════════
    knight: {
        icon: '♘',
        title: 'The Knight',
        subtitle: 'The only piece that jumps.',
        intro: "The Knight moves in an L-shape: two squares in one direction, then one more at a right angle. It's the only piece that can leap over others.",
        steps: [
            {
                title: 'The L-shape',
                text: 'A Knight always moves 2+1. From its current square, it can reach eight squares. Drop it on any highlighted square.',
                setup: [{ piece: 'knight', color: 'white', r: 4, c: 3 }],
                source: { r: 4, c: 3 },
                highlights: [
                    { r: 2, c: 2, type: 'move' }, { r: 2, c: 4, type: 'move' },
                    { r: 3, c: 1, type: 'move' }, { r: 3, c: 5, type: 'move' },
                    { r: 5, c: 1, type: 'move' }, { r: 5, c: 5, type: 'move' },
                    { r: 6, c: 2, type: 'move' }, { r: 6, c: 4, type: 'move' }
                ],
                expectedMove: { from: { r: 4, c: 3 }, to: { r: 2, c: 4 } }
            },
            {
                title: 'Jumps over anything',
                text: "The Knight doesn't care what's in its path. Even a wall of pieces can't stop it. Capture the rook!",
                setup: [
                    { piece: 'knight', color: 'white', r: 5, c: 3 },
                    { piece: 'pawn', color: 'white', r: 4, c: 3 },
                    { piece: 'pawn', color: 'white', r: 4, c: 4 },
                    { piece: 'pawn', color: 'white', r: 4, c: 5 },
                    { piece: 'rook', color: 'black', r: 3, c: 4 }
                ],
                source: { r: 5, c: 3 },
                highlights: [{ r: 3, c: 4, type: 'capture' }],
                expectedMove: { from: { r: 5, c: 3 }, to: { r: 3, c: 4 } }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'knight', color: 'white', r: 7, c: 1 },
                { piece: 'knight', color: 'white', r: 7, c: 6 },
                { piece: 'pawn', color: 'white', r: 6, c: 1 },
                { piece: 'pawn', color: 'black', r: 3, c: 4 },
                { piece: 'king', color: 'black', r: 0, c: 4 }
            ]
        },
        next: 'pawn'
    },

    // ═══════════ PAWN ═══════════
    pawn: {
        icon: '♙',
        title: 'The Pawn',
        subtitle: 'March forward. Capture diagonally. Promote at the end.',
        intro: 'The Pawn is the humblest piece, but its promotion rule makes it a threat. It moves forward one square, captures diagonally, and can become a Queen on the last rank.',
        steps: [
            {
                title: 'Forward one square',
                text: 'The Pawn advances forward — never sideways, never backward. Drop it on a highlighted square to move.',
                setup: [{ piece: 'pawn', color: 'white', r: 6, c: 4 }],
                source: { r: 6, c: 4 },
                highlights: [
                    { r: 5, c: 4, type: 'move' },
                    { r: 4, c: 4, type: 'move' }
                ],
                expectedMove: { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } }
            },
            {
                title: 'Captures diagonally',
                text: 'When an enemy is diagonally in front, the Pawn captures it. It cannot capture straight ahead. Take the knight!',
                setup: [
                    { piece: 'pawn', color: 'white', r: 4, c: 3 },
                    { piece: 'knight', color: 'black', r: 3, c: 4 }
                ],
                source: { r: 4, c: 3 },
                highlights: [{ r: 3, c: 4, type: 'capture' }],
                expectedMove: { from: { r: 4, c: 3 }, to: { r: 3, c: 4 } }
            },
            {
                title: 'Promotion',
                text: 'Reach the last rank and the Pawn transforms into a Queen, Rook, Bishop, or Knight — usually a Queen. Push forward!',
                setup: [{ piece: 'pawn', color: 'white', r: 1, c: 4 }],
                source: { r: 1, c: 4 },
                highlights: [{ r: 0, c: 4, type: 'target' }],
                expectedMove: { from: { r: 1, c: 4 }, to: { r: 0, c: 4 } }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'pawn', color: 'white', r: 6, c: 4 },
                { piece: 'pawn', color: 'white', r: 6, c: 3 },
                { piece: 'pawn', color: 'black', r: 4, c: 4 },
                { piece: 'knight', color: 'black', r: 3, c: 3 },
                { piece: 'king', color: 'black', r: 0, c: 4 }
            ]
        },
        next: 'tiger'
    },

    // ═══════════ TIGER ═══════════
    tiger: {
        icon: '🐅',
        title: 'The Tiger — The Hunter',
        subtitle: 'One-shot. Invincible. A hunter with a designated forest.',
        intro: 'The Tiger is unlike any other piece. It cannot be captured. It travels to its own designated Forest, then strikes ONE target before leaving the board forever.',
        steps: [
            {
                title: 'The journey to the Forest',
                text: 'Each Tiger is assigned a designated Forest square. It takes two turns to reach it — moving diagonally toward the forest. Take the first step.',
                setup: [
                    { piece: 'tiger', color: 'white', r: 6, c: 2 },
                    { piece: 'forest', color: 'terrain', r: 4, c: 4 }
                ],
                source: { r: 6, c: 2 },
                highlights: [
                    { r: 5, c: 3, type: 'move' },
                    { r: 4, c: 4, type: 'target' }
                ],
                expectedMove: { from: { r: 6, c: 2 }, to: { r: 5, c: 3 } }
            },
            {
                title: 'Hunting — one strike only',
                text: 'Once on its Forest, the Tiger hunts. It attacks any enemy in the 8 surrounding squares — but the King and other Tigers are immune. Capture the knight!',
                setup: [
                    { piece: 'tiger', color: 'white', r: 4, c: 4 },
                    { piece: 'forest', color: 'terrain', r: 4, c: 4 },
                    { piece: 'knight', color: 'black', r: 3, c: 5 }
                ],
                source: { r: 4, c: 4 },
                highlights: [{ r: 3, c: 5, type: 'capture' }],
                expectedMove: { from: { r: 4, c: 4 }, to: { r: 3, c: 5 } }
            },
            {
                title: 'Cannot be captured',
                text: 'Enemy pieces can never take the Tiger. It leaves on its own terms — after its one hunt. Study the position and click Next.',
                setup: [
                    { piece: 'tiger', color: 'white', r: 4, c: 4 },
                    { piece: 'forest', color: 'terrain', r: 4, c: 4 },
                    { piece: 'rook', color: 'black', r: 0, c: 4 }
                ],
                source: { r: 4, c: 4 }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'tiger', color: 'white', r: 6, c: 2 },
                { piece: 'forest', color: 'terrain', r: 4, c: 4 },
                { piece: 'pawn', color: 'black', r: 3, c: 5 },
                { piece: 'king', color: 'black', r: 0, c: 4 }
            ]
        },
        next: 'rooster'
    },

    // ═══════════ ROOSTER ═══════════
    rooster: {
        icon: '🐓',
        title: 'The Rooster — The Sentinel',
        subtitle: 'Two-square diagonal leap, then capture straight ahead.',
        intro: 'The Rooster is a reconnaissance piece that lands diagonally, then strikes forward. Water cripples it permanently — after that, it can only hop a single square.',
        steps: [
            {
                title: 'Diagonal leap',
                text: 'The Rooster leaps exactly two squares diagonally forward. It jumps over whatever is in between. Drop it on a highlighted square.',
                setup: [{ piece: 'rooster', color: 'white', r: 5, c: 3 }],
                source: { r: 5, c: 3 },
                highlights: [
                    { r: 3, c: 1, type: 'move' },
                    { r: 3, c: 5, type: 'move' }
                ],
                expectedMove: { from: { r: 5, c: 3 }, to: { r: 3, c: 5 } }
            },
            {
                title: 'Then strike forward',
                text: 'After landing, the Rooster can capture any piece directly in front of it. Land on either highlighted square.',
                setup: [
                    { piece: 'rooster', color: 'white', r: 4, c: 2 },
                    { piece: 'pawn', color: 'black', r: 2, c: 2 }
                ],
                source: { r: 4, c: 2 },
                highlights: [
                    { r: 2, c: 4, type: 'move' }
                ],
                expectedMove: { from: { r: 4, c: 2 }, to: { r: 2, c: 4 } }
            },
            {
                title: 'Water cripples it — permanently',
                text: 'If the Rooster ever lands on a water square, its flight is permanently reduced: from then on it can only hop a single diagonal square. No timer — it never recovers. Try moving onto the water square.',
                setup: [
                    { piece: 'rooster', color: 'white', r: 5, c: 3 },
                    { piece: 'water', color: 'terrain', r: 4, c: 4 }
                ],
                source: { r: 5, c: 3 },
                highlights: [{ r: 4, c: 4, type: 'move' }],
                expectedMove: { from: { r: 5, c: 3 }, to: { r: 4, c: 4 } }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'rooster', color: 'white', r: 5, c: 3 },
                { piece: 'water', color: 'terrain', r: 4, c: 4 },
                { piece: 'pawn', color: 'black', r: 3, c: 3 },
                { piece: 'king', color: 'black', r: 0, c: 4 }
            ]
        },
        next: 'forest'
    },

    // ═══════════ FOREST ═══════════
    forest: {
        icon: '🌲',
        title: 'Forest Squares',
        subtitle: "The Tiger's home ground.",
        intro: "Four Forest squares are placed on the board at the start of every game. Each Forest is assigned to a single Tiger — it's where they gain their hunting power.",
        steps: [
            {
                title: 'The designated Forest',
                text: 'Every Tiger has its own Forest. The Tiger can only enter ITS OWN forest. The star (★) marks the designated forest.',
                setup: [
                    { piece: 'forest', color: 'terrain', r: 4, c: 4 },
                    { piece: 'tiger', color: 'white', r: 5, c: 5 }
                ],
                source: { r: 5, c: 5 },
                highlights: [{ r: 4, c: 4, type: 'target' }]
            },
            {
                title: 'Forest grants the buff',
                text: 'When a Tiger lands on its forest, it gains +2 attack range for its hunt — reaching the black pawn.',
                setup: [
                    { piece: 'forest', color: 'terrain', r: 4, c: 4 },
                    { piece: 'tiger', color: 'white', r: 4, c: 4 },
                    { piece: 'pawn', color: 'black', r: 2, c: 6 }
                ],
                source: { r: 4, c: 4 },
                highlights: [{ r: 2, c: 6, type: 'capture' }]
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'forest', color: 'terrain', r: 4, c: 4 },
                { piece: 'tiger', color: 'white', r: 6, c: 2 },
                { piece: 'king', color: 'black', r: 0, c: 4 }
            ]
        },
        next: 'water'
    },

    // ═══════════ WATER ═══════════
    water: {
        icon: '🌊',
        title: 'Water Squares',
        subtitle: 'Permanently cripples any Rooster that lands on it.',
        intro: 'Four Water squares are placed randomly each game. Roosters are the only piece affected — once a Rooster lands on water, its flight is permanently cut to a single diagonal square for the rest of the game.',
        steps: [
            {
                title: 'Water cripples Roosters',
                text: 'Landing on water is a permanent penalty for the Rooster. It can never again make the 2-square diagonal leap — only a single step.',
                setup: [
                    { piece: 'water', color: 'terrain', r: 4, c: 4 },
                    { piece: 'rooster', color: 'white', r: 4, c: 4 }
                ],
                source: { r: 4, c: 4 }
            },
            {
                title: 'The 💧 badge is permanent',
                text: 'A 💧 badge sticks to the Rooster for the rest of the game — there is no recovery. It becomes a slow, short-range piece from that moment on.',
                setup: [
                    { piece: 'water', color: 'terrain', r: 4, c: 4 },
                    { piece: 'rooster', color: 'white', r: 4, c: 4 }
                ],
                source: { r: 4, c: 4 }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'water', color: 'terrain', r: 4, c: 4 },
                { piece: 'rooster', color: 'white', r: 5, c: 3 },
                { piece: 'king', color: 'black', r: 0, c: 4 }
            ]
        },
        next: 'temple'
    },

    // ═══════════ TEMPLE ═══════════
    temple: {
        icon: '🛕',
        title: 'Temple (Safe Zone)',
        subtitle: 'Temporary protection from one attack.',
        intro: 'Two Temples are placed on the board. A piece standing on a Temple cannot be captured — but that protection is used up after one attempted attack.',
        steps: [
            {
                title: 'Protected on the Temple',
                text: 'A piece on a Temple square gets a 🛡 badge. It cannot be captured while it sits there.',
                setup: [
                    { piece: 'temple', color: 'terrain', r: 4, c: 4 },
                    { piece: 'bishop', color: 'white', r: 4, c: 4 }
                ],
                source: { r: 4, c: 4 }
            },
            {
                title: 'Protection disappears when moving off',
                text: 'The moment the protected piece steps off the Temple, the shield is gone. The black rook can now capture it.',
                setup: [
                    { piece: 'temple', color: 'terrain', r: 4, c: 4 },
                    { piece: 'bishop', color: 'white', r: 3, c: 3 },
                    { piece: 'rook', color: 'black', r: 0, c: 3 }
                ],
                source: { r: 0, c: 3 },
                highlights: [{ r: 3, c: 3, type: 'capture' }]
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'temple', color: 'terrain', r: 4, c: 4 },
                { piece: 'knight', color: 'white', r: 4, c: 4 },
                { piece: 'rook', color: 'black', r: 4, c: 0 },
                { piece: 'king', color: 'black', r: 0, c: 7 }
            ]
        },
        next: 'castling'
    },

    // ═══════════ CASTLING ═══════════
    castling: {
        icon: '🏰',
        title: 'Castling',
        subtitle: 'One move — two pieces, twice the safety.',
        intro: "Castling is a King move that also activates a Rook. It's the fastest way to safety and the only move that touches two pieces at once.",
        steps: [
            {
                title: 'Setup for castling',
                text: 'Castling requires: the King and Rook have never moved; the squares between them are empty; the King is not in check; and the King does not cross an attacked square.',
                setup: [
                    { piece: 'king', color: 'white', r: 7, c: 4 },
                    { piece: 'rook', color: 'white', r: 7, c: 7 }
                ],
                source: { r: 7, c: 4 }
            },
            {
                title: 'Kingside castling',
                text: 'The King slides two squares toward the Rook. The Rook jumps over the King to land right beside it. Move the King to the castle square!',
                setup: [
                    { piece: 'king', color: 'white', r: 7, c: 4 },
                    { piece: 'rook', color: 'white', r: 7, c: 7 }
                ],
                source: { r: 7, c: 4 },
                highlights: [
                    { r: 7, c: 5, type: 'move' },
                    { r: 7, c: 6, type: 'target' }
                ],
                expectedMove: { from: { r: 7, c: 4 }, to: { r: 7, c: 6 } }
            },
            {
                title: 'Queenside castling',
                text: 'Castling the other direction works the same way — the King moves two squares left and the Rook jumps to its other side.',
                setup: [
                    { piece: 'king', color: 'white', r: 7, c: 4 },
                    { piece: 'rook', color: 'white', r: 7, c: 0 }
                ],
                source: { r: 7, c: 4 },
                highlights: [
                    { r: 7, c: 3, type: 'move' },
                    { r: 7, c: 2, type: 'target' }
                ],
                expectedMove: { from: { r: 7, c: 4 }, to: { r: 7, c: 2 } }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'king', color: 'white', r: 7, c: 4 },
                { piece: 'rook', color: 'white', r: 7, c: 0 },
                { piece: 'rook', color: 'white', r: 7, c: 7 },
                { piece: 'king', color: 'black', r: 0, c: 4 }
            ]
        },
        next: 'enpassant'
    },

    // ═══════════ EN PASSANT ═══════════
    enpassant: {
        icon: '⚔️',
        title: 'En Passant',
        subtitle: 'The sneakiest capture in chess.',
        intro: 'When a pawn tries to leap past an enemy pawn using its two-square first move, the enemy pawn can capture it "in passing" — as if it had only moved one square.',
        steps: [
            {
                title: 'The trap is set',
                text: 'Your pawn sits beside an enemy pawn that just advanced two squares. En passant lets you capture as if it had only moved one — land behind it!',
                setup: [
                    { piece: 'pawn', color: 'white', r: 3, c: 4 },
                    { piece: 'pawn', color: 'black', r: 3, c: 3 }
                ],
                source: { r: 3, c: 4 },
                highlights: [{ r: 2, c: 3, type: 'capture' }],
                expectedMove: { from: { r: 3, c: 4 }, to: { r: 2, c: 3 } }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'pawn', color: 'white', r: 3, c: 4 },
                { piece: 'pawn', color: 'black', r: 1, c: 3 },
                { piece: 'king', color: 'white', r: 7, c: 4 },
                { piece: 'king', color: 'black', r: 0, c: 4 }
            ]
        },
        next: 'coordination'
    },

    // ═══════════ COORDINATION ═══════════
    coordination: {
        icon: '🤝',
        title: 'Piece Coordination',
        subtitle: 'Pieces protect and amplify each other.',
        intro: 'Winning chess is about coordination. Pieces that protect each other are safe. Pieces that combine attacks are dangerous.',
        steps: [
            {
                title: 'Defend your pieces',
                text: 'When two pieces defend each other, capturing one is a losing trade for your opponent.',
                setup: [
                    { piece: 'bishop', color: 'white', r: 5, c: 2 },
                    { piece: 'rook', color: 'white', r: 5, c: 6 }
                ],
                source: { r: 5, c: 2 }
            },
            {
                title: 'Double attack',
                text: 'A single piece attacking two enemies at once forces your opponent to lose one. Capture the rook!',
                setup: [
                    { piece: 'knight', color: 'white', r: 4, c: 3 },
                    { piece: 'king', color: 'black', r: 2, c: 4 },
                    { piece: 'rook', color: 'black', r: 6, c: 4 }
                ],
                source: { r: 4, c: 3 },
                highlights: [
                    { r: 2, c: 4, type: 'capture' },
                    { r: 6, c: 4, type: 'capture' }
                ],
                expectedMove: { from: { r: 4, c: 3 }, to: { r: 6, c: 4 } }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'knight', color: 'white', r: 4, c: 3 },
                { piece: 'bishop', color: 'white', r: 5, c: 2 },
                { piece: 'rook', color: 'white', r: 5, c: 6 },
                { piece: 'king', color: 'white', r: 7, c: 4 },
                { piece: 'king', color: 'black', r: 0, c: 4 },
                { piece: 'rook', color: 'black', r: 6, c: 4 },
                { piece: 'bishop', color: 'black', r: 2, c: 1 }
            ]
        },
        next: 'checkmate'
    },

    // ═══════════ CHECKMATE ═══════════
    checkmate: {
        icon: '👑',
        title: 'Checkmate Patterns',
        subtitle: 'The classic finishes every player should know.',
        intro: 'Checkmate = the King is in check and has no escape. Recognising common patterns lets you spot your own chances and avoid getting caught.',
        steps: [
            {
                title: 'Back-rank mate',
                text: 'A Rook or Queen delivers mate along the back rank when the enemy King is trapped behind its own pawns.',
                setup: [
                    { piece: 'king', color: 'black', r: 0, c: 4 },
                    { piece: 'pawn', color: 'black', r: 1, c: 3 },
                    { piece: 'pawn', color: 'black', r: 1, c: 4 },
                    { piece: 'pawn', color: 'black', r: 1, c: 5 },
                    { piece: 'rook', color: 'white', r: 0, c: 0 }
                ],
                source: { r: 0, c: 0 },
                highlights: [{ r: 0, c: 4, type: 'capture' }]
            },
            {
                title: 'Smothered mate',
                text: 'A Knight can mate a King that has no escape squares. The King is literally smothered by its own pieces.',
                setup: [
                    { piece: 'king', color: 'black', r: 0, c: 7 },
                    { piece: 'rook', color: 'black', r: 1, c: 6 },
                    { piece: 'pawn', color: 'black', r: 1, c: 7 },
                    { piece: 'knight', color: 'white', r: 2, c: 5 }
                ],
                source: { r: 2, c: 5 }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'rook', color: 'white', r: 0, c: 0 },
                { piece: 'king', color: 'white', r: 7, c: 4 },
                { piece: 'king', color: 'black', r: 0, c: 4 },
                { piece: 'pawn', color: 'black', r: 1, c: 3 },
                { piece: 'pawn', color: 'black', r: 1, c: 4 },
                { piece: 'pawn', color: 'black', r: 1, c: 5 }
            ]
        },
        next: 'puzzle1'
    },

    // ═══════════ PUZZLE 1 ═══════════
    puzzle1: {
        icon: '🧩',
        title: 'Puzzle — Fork Attack',
        subtitle: 'Find the winning move.',
        intro: 'Your Knight can attack two pieces at once — forcing your opponent to lose one. Spot the square.',
        steps: [
            {
                title: 'Read the position',
                text: "Black's King and Rook are on the same rank. Find a Knight move that attacks BOTH simultaneously. Nf5 does the trick!",
                setup: [
                    { piece: 'knight', color: 'white', r: 5, c: 3 },
                    { piece: 'king', color: 'black', r: 3, c: 4 },
                    { piece: 'rook', color: 'black', r: 3, c: 6 }
                ],
                source: { r: 5, c: 3 },
                highlights: [{ r: 4, c: 5, type: 'target' }],
                expectedMove: { from: { r: 5, c: 3 }, to: { r: 4, c: 5 } }
            }
        ],
        sandbox: {
            pieces: [
                { piece: 'knight', color: 'white', r: 5, c: 3 },
                { piece: 'king', color: 'white', r: 7, c: 7 },
                { piece: 'king', color: 'black', r: 3, c: 4 },
                { piece: 'rook', color: 'black', r: 3, c: 6 }
            ]
        },
        next: null
    }
};

// ═══════════════════════════════════════════════════════════
// DEMO BOARD — 12×12 grid with INTERACTIVE support
// ═══════════════════════════════════════════════════════════
class DemoBoard {
    constructor(containerEl) {
        this.el = containerEl;
        this.size = BOARD_SIZE;
        this.el.innerHTML = '';
        this.cells = [];
        this.state = [];
        this.mode = 'locked'; // 'locked' | 'playable' | 'sandbox'
        this.expectedMove = null;
        this.allowedMoves = [];
        this.selected = null;
        this.onCorrectMove = null;
        this.onWrongMove = null;
        this._terrainMap = {};

        for (let r = 0; r < this.size; r++) {
            this.state[r] = [];
            this.cells[r] = [];
            for (let c = 0; c < this.size; c++) {
                this.state[r][c] = null;
                const sq = document.createElement('div');
                sq.className = 'square ' + ((r + c) % 2 === 0 ? 'dark' : 'light');
                sq.dataset.r = r;
                sq.dataset.c = c;
                sq.addEventListener('click', () => this.handleClick(r, c));
                this.el.appendChild(sq);
                this.cells[r][c] = sq;
            }
        }
    }

    reset() {
        for (let r = 0; r < this.size; r++)
            for (let c = 0; c < this.size; c++)
                this.state[r][c] = null;
        this.selected = null;
        this.expectedMove = null;
        this.allowedMoves = [];
        this.clearHighlights();
        this.render();
    }

    // Store a shadow terrain map so we can render both terrain AND piece on the same cell
    _buildTerrainMap(pieces) {
        this._terrainMap = {};
        (pieces || []).forEach(p => {
            if ((p.piece === 'forest' || p.piece === 'water' || p.piece === 'temple') &&
                p.r >= 0 && p.r < this.size && p.c >= 0 && p.c < this.size) {
                this._terrainMap[`${p.r},${p.c}`] = p.piece;
            }
        });
    }

    getTerrainAt(r, c) {
        return this._terrainMap[`${r},${c}`] || null;
    }

    // Apply terrain first, then pieces ON TOP so tiger is not overwritten by forest
    setState(pieces) {
        for (let r = 0; r < this.size; r++)
            for (let c = 0; c < this.size; c++)
                this.state[r][c] = null;

        const allPieces = pieces || [];
        const isTerrain = (p) => p.piece === 'forest' || p.piece === 'water' || p.piece === 'temple';

        // Pass 1: terrain
        allPieces.forEach(p => {
            if (p.r >= 0 && p.r < this.size && p.c >= 0 && p.c < this.size && isTerrain(p)) {
                this.state[p.r][p.c] = { piece: p.piece, color: p.color };
            }
        });
        // Pass 2: pieces (overwrite terrain if same square)
        allPieces.forEach(p => {
            if (p.r >= 0 && p.r < this.size && p.c >= 0 && p.c < this.size && !isTerrain(p)) {
                this.state[p.r][p.c] = { piece: p.piece, color: p.color };
            }
        });
        this.render();
    }

    // Render terrain overlay even when a piece is on top of it
    render() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const cell = this.cells[r][c];
                cell.innerHTML = '';
                cell.className = 'square ' + ((r + c) % 2 === 0 ? 'dark' : 'light');

                const s = this.state[r][c];
                const terrainHere = this.getTerrainAt(r, c);

                // Apply terrain classes even if a piece is on top
                if (s) {
                    if (s.piece === 'forest') {
                        cell.classList.add('terrain-designated-forest');
                        continue;
                    }
                    if (s.piece === 'water') {
                        cell.classList.add('terrain-water');
                        continue;
                    }
                    if (s.piece === 'temple') {
                        cell.classList.add('terrain-temple');
                        continue;
                    }

                    // Piece on top of terrain
                    if (terrainHere === 'forest') cell.classList.add('terrain-designated-forest');
                    if (terrainHere === 'water')  cell.classList.add('terrain-water');
                    if (terrainHere === 'temple') cell.classList.add('terrain-temple');

                    const pieceEl = document.createElement('span');
                    pieceEl.className = `piece ${s.color}`;
                    pieceEl.dataset.type = s.piece;

                    // ★ Try custom image first — fall back to emoji if missing
                    const img = document.createElement('img');
                    img.src = `assets/models/pieces/${s.color}-${s.piece}.png`;
                    img.alt = (SYMBOLS[s.color] && SYMBOLS[s.color][s.piece]) || '?';
                    img.className = 'piece-img';
                    img.draggable = false;
                    img.onerror = () => {
                        img.remove();
                        pieceEl.textContent = (SYMBOLS[s.color] && SYMBOLS[s.color][s.piece]) || '?';
                    };
                    pieceEl.appendChild(img);

                    cell.appendChild(pieceEl);
                } else if (terrainHere) {
                    // Terrain-only cell (no shadow map overlap)
                    if (terrainHere === 'forest') cell.classList.add('terrain-designated-forest');
                    if (terrainHere === 'water')  cell.classList.add('terrain-water');
                    if (terrainHere === 'temple') cell.classList.add('terrain-temple');
                }
            }
        }
    }

    applyHighlights(items) {
        if (!items) return;
        items.forEach(h => {
            const cell = this.cells[h.r] && this.cells[h.r][h.c];
            if (!cell) return;
            if (h.type === 'move')    cell.classList.add('tut-move');
            if (h.type === 'target')  cell.classList.add('tut-target');
            if (h.type === 'capture') cell.classList.add('tut-capture');
        });
    }

    applySource(source) {
        if (!source) return;
        const cell = this.cells[source.r] && this.cells[source.r][source.c];
        if (cell) cell.classList.add('tut-source');
    }

    applyDanger(items) {
        if (!items) return;
        items.forEach(h => {
            const cell = this.cells[h.r] && this.cells[h.r][h.c];
            if (cell) cell.classList.add('tut-danger');
        });
    }

    clearHighlights() {
        for (let r = 0; r < this.size; r++)
            for (let c = 0; c < this.size; c++) {
                const cell = this.cells[r][c];
                if (cell) cell.classList.remove(
                    'tut-source', 'tut-target', 'tut-move', 'tut-capture', 'tut-danger',
                    'selected', 'valid-move', 'valid-capture'
                );
            }
    }

    setMode(mode) {
        this.mode = mode;
        this.el.classList.remove('tut-locked', 'tut-playable');
        if (mode === 'locked') this.el.classList.add('tut-locked');
        if (mode === 'playable' || mode === 'sandbox') this.el.classList.add('tut-playable');
    }

    setExpectedMove(move, allowedDestinations) {
        this.expectedMove = move;
        this.allowedMoves = allowedDestinations || [];
    }

    // Accepts ANY highlighted destination, not just the one expected
    handleClick(r, c) {
        if (this.mode === 'sandbox') return this.handleSandboxClick(r, c);
        if (this.mode !== 'playable' || !this.expectedMove) return;

        const from = this.expectedMove.from;

        if (!this.selected) {
            // First click — must be the source piece
            if (r === from.r && c === from.c) {
                this.selected = { r, c };
                this.cells[r][c].classList.add('selected');
            } else {
                if (this.onWrongMove) this.onWrongMove();
            }
            return;
        }

        // Second click — check if destination is allowed
        if (r === from.r && c === from.c) {
            this.selected = null;
            this.cells[r][c].classList.remove('selected');
            return;
        }

        const isAllowed = this.allowedMoves.some(m => m.r === r && m.c === c);

        if (isAllowed) {
            // ✓ Correct move — execute it
            const piece = this.state[from.r][from.c];
            this.state[r][c] = piece;
            this.state[from.r][from.c] = null;
            this.selected = null;
            this.clearHighlights();
            this.render();
            this.mode = 'locked';
            this.expectedMove = null;
            this.allowedMoves = [];
            if (this.onCorrectMove) this.onCorrectMove();
        } else {
            // ✗ Not a valid destination — deselect + flash
            this.selected = null;
            this.cells[from.r][from.c].classList.remove('selected');
            if (this.onWrongMove) this.onWrongMove();
        }
    }

    // ─── Sandbox mode: user can move any white piece freely ───
    handleSandboxClick(r, c) {
        const s = this.state[r][c];
        const selected = this.selected;

        if (selected) {
            const fromR = selected.r, fromC = selected.c;
            const legal = this.sandboxLegalMoves(fromR, fromC);
            const match = legal.find(m => m.r === r && m.c === c);

            if (match) {
                const piece = this.state[fromR][fromC];
                this.state[r][c] = piece;
                this.state[fromR][fromC] = null;
                this.selected = null;
                this.clearHighlights();
                this.render();
                return;
            }

            if (s && s.color === 'white' && !['forest','water','temple'].includes(s.piece)) {
                this.selected = { r, c };
                this.clearHighlights();
                this.cells[r][c].classList.add('selected');
                const moves = this.sandboxLegalMoves(r, c);
                moves.forEach(m => {
                    this.cells[m.r][m.c].classList.add(m.capture ? 'valid-capture' : 'valid-move');
                });
            } else {
                this.selected = null;
                this.clearHighlights();
            }
        } else {
            if (s && s.color === 'white' && !['forest','water','temple'].includes(s.piece)) {
                this.selected = { r, c };
                this.cells[r][c].classList.add('selected');
                const moves = this.sandboxLegalMoves(r, c);
                moves.forEach(m => {
                    this.cells[m.r][m.c].classList.add(m.capture ? 'valid-capture' : 'valid-move');
                });
            }
        }
    }

    sandboxLegalMoves(r, c) {
        const s = this.state[r][c];
        if (!s) return [];
        const moves = [];
        const N = this.size;

        // Detect if a rooster is standing on water (permanent cripple)
        const isRoosterCrippled = (piece, row, col) => {
            return piece === 'rooster' && this.getTerrainAt(row, col) === 'water';
        };

        const add = (nr, nc) => {
            if (nr < 0 || nr >= N || nc < 0 || nc >= N) return false;
            const target = this.state[nr][nc];
            if (!target) {
                moves.push({ r: nr, c: nc, capture: false });
                return true;
            }
            if (target.color !== s.color && !['forest','water','temple'].includes(target.piece)) {
                moves.push({ r: nr, c: nc, capture: true });
            }
            return false;
        };

        const sliding = (dirs) => {
            dirs.forEach(([dr, dc]) => {
                let nr = r + dr, nc = c + dc;
                while (add(nr, nc)) { nr += dr; nc += dc; }
            });
        };

        switch (s.piece) {
            case 'king':
                [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr, dc]) => {
                    const nr = r + dr, nc = c + dc;
                    if (nr < 0 || nr >= N || nc < 0 || nc >= N) return;
                    const t = this.state[nr][nc];
                    if (!t) moves.push({ r: nr, c: nc, capture: false });
                    else if (t.color !== s.color && !['forest','water','temple'].includes(t.piece))
                        moves.push({ r: nr, c: nc, capture: true });
                });
                break;
            case 'queen': sliding([[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]); break;
            case 'rook':  sliding([[-1,0],[1,0],[0,-1],[0,1]]); break;
            case 'bishop':sliding([[-1,-1],[-1,1],[1,-1],[1,1]]); break;
            case 'knight':
                [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, dc]) => {
                    const nr = r + dr, nc = c + dc;
                    if (nr < 0 || nr >= N || nc < 0 || nc >= N) return;
                    const t = this.state[nr][nc];
                    if (!t) moves.push({ r: nr, c: nc, capture: false });
                    else if (t.color !== s.color && !['forest','water','temple'].includes(t.piece))
                        moves.push({ r: nr, c: nc, capture: true });
                });
                break;
            case 'pawn': {
                const dir = s.color === 'white' ? -1 : 1;
                const startRow = s.color === 'white' ? 6 : 1;
                const nr = r + dir;
                if (nr >= 0 && nr < N && !this.state[nr][c]) {
                    moves.push({ r: nr, c, capture: false });
                    if (r === startRow) {
                        const nn = r + 2 * dir;
                        if (nn >= 0 && nn < N && !this.state[nn][c]) moves.push({ r: nn, c, capture: false });
                    }
                }
                [-1, 1].forEach(dc => {
                    const nc = c + dc;
                    if (nr < 0 || nr >= N || nc < 0 || nc >= N) return;
                    const t = this.state[nr][nc];
                    if (t && t.color !== s.color && !['forest','water','temple'].includes(t.piece)) {
                        moves.push({ r: nr, c: nc, capture: true });
                    }
                });
                break;
            }
            case 'rooster': {
                const dir = s.color === 'white' ? -1 : 1;
                // ★ NEW: If rooster is on water (permanent cripple), only allow 1-square diagonal hops
                const step = isRoosterCrippled('rooster', r, c) ? 1 : 2;

                [-1, 1].forEach(dc => {
                    const nr = r + step * dir, nc = c + step * dc;
                    if (nr < 0 || nr >= N || nc < 0 || nc >= N) return;
                    if (!this.state[nr][nc]) moves.push({ r: nr, c: nc, capture: false });
                });
                const capR = r + dir;
                if (capR >= 0 && capR < N) {
                    const t = this.state[capR][c];
                    if (t && t.color !== s.color && !['forest','water','temple'].includes(t.piece)) {
                        moves.push({ r: capR, c, capture: true });
                    }
                }
                break;
            }
            case 'tiger':
                [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr, dc]) => {
                    for (let dist = 1; dist <= 2; dist++) {
                        const nr = r + dr*dist, nc = c + dc*dist;
                        if (nr < 0 || nr >= N || nc < 0 || nc >= N) break;
                        if (!this.state[nr][nc]) moves.push({ r: nr, c: nc, capture: false });
                        else break;
                    }
                });
                [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr, dc]) => {
                    const nr = r + dr, nc = c + dc;
                    if (nr < 0 || nr >= N || nc < 0 || nc >= N) return;
                    const t = this.state[nr][nc];
                    if (t && t.color !== s.color && !['forest','water','temple','king','tiger'].includes(t.piece)) {
                        moves.push({ r: nr, c: nc, capture: true });
                    }
                });
                break;
        }

        return moves;
    }
}

// ═══════════════════════════════════════════════════════════
// COACH — drives the coach card + step flow
// ═══════════════════════════════════════════════════════════
class Coach {
    constructor(lesson, lessonId, board) {
        this.lesson = lesson;
        this.lessonId = lessonId;
        this.board = board;
        this.currentStep = 0;
        this.solved = false;
        this.finished = false;

        board.onCorrectMove = () => this.onStepSolved();
        board.onWrongMove = () => this.onStepWrong();

        const nextBtn = document.getElementById('coach-next');
        const skipBtn = document.getElementById('coach-skip');

        const newNext = nextBtn.cloneNode(true);
        const newSkip = skipBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNext, nextBtn);
        skipBtn.parentNode.replaceChild(newSkip, skipBtn);

        newNext.addEventListener('click', () => this.nextStep());
        newSkip.addEventListener('click', () => this.finish());
    }

    start() {
        this.showStep(0);
    }

    showStep(index) {
        this.currentStep = index;
        this.solved = false;

        if (index >= this.lesson.steps.length) {
            this.finish();
            return;
        }

        const rawStep = this.lesson.steps[index];
        const step = expandTo12x12(rawStep);

        // Build a shadow terrain map so terrain + piece can coexist
        this.board._buildTerrainMap(step.setup);

        // Render board
        this.board.reset();
        this.board.setState(step.setup || []);
        this.board.applySource(step.source);
        this.board.applyHighlights(step.highlights);
        this.board.applyDanger(step.danger);

        // Pass BOTH the expected move AND the list of allowed destinations
        const isInteractive = !!step.expectedMove;
        if (isInteractive) {
            const allowed = (step.highlights || [])
                .filter(h => h.type === 'move' || h.type === 'capture' || h.type === 'target')
                .map(h => ({ r: h.r, c: h.c }));
            if (!allowed.some(a => a.r === step.expectedMove.to.r && a.c === step.expectedMove.to.c)) {
                allowed.push({ r: step.expectedMove.to.r, c: step.expectedMove.to.c });
            }
            this.board.setExpectedMove(step.expectedMove, allowed);
            this.board.setMode('playable');
        } else {
            this.board.setExpectedMove(null, []);
            this.board.setMode('locked');
        }

        // Update coach card
        document.getElementById('coach-step').textContent = `STEP ${index + 1} OF ${this.lesson.steps.length}`;
        document.getElementById('coach-title').textContent = step.title;
        document.getElementById('coach-text').textContent = step.text;

        const statusEl = document.getElementById('coach-status');
        statusEl.classList.remove('waiting', 'correct', 'hint');
        if (isInteractive) {
            statusEl.classList.add('waiting');
            statusEl.textContent = 'Pick up the piece, then drop it on a highlighted square';
        } else {
            statusEl.classList.add('hint');
            statusEl.textContent = 'Read the tip, then click Next';
        }

        const nextBtn = document.getElementById('coach-next');
        nextBtn.disabled = isInteractive;
        nextBtn.textContent = (index === this.lesson.steps.length - 1) ? 'Finish' : 'Next';

        const coachCard = document.getElementById('coach-card');
        coachCard.classList.remove('waiting', 'correct');
        if (isInteractive) coachCard.classList.add('waiting');

        this.updateProgress();
        this.updateDots();
    }

    onStepSolved() {
        this.solved = true;

        const statusEl = document.getElementById('coach-status');
        statusEl.classList.remove('waiting', 'hint');
        statusEl.classList.add('correct');
        statusEl.textContent = 'Correct! Click Next to continue';

        document.getElementById('coach-next').disabled = false;

        const coachCard = document.getElementById('coach-card');
        coachCard.classList.remove('waiting');
        coachCard.classList.add('correct');

        this.updateProgress();
    }

    onStepWrong() {
        const statusEl = document.getElementById('coach-status');
        const original = statusEl.textContent;
        statusEl.classList.remove('waiting', 'correct');
        statusEl.classList.add('hint');
        statusEl.textContent = 'Not quite — try one of the highlighted squares';
        setTimeout(() => {
            if (!this.solved) {
                statusEl.classList.remove('hint');
                statusEl.classList.add('waiting');
                statusEl.textContent = original || 'Pick up the piece, then drop it on a highlighted square';
            }
        }, 1400);
    }

    nextStep() {
        if (this.currentStep + 1 >= this.lesson.steps.length) {
            this.finish();
            return;
        }
        this.showStep(this.currentStep + 1);
    }

    finish() {
        if (this.finished) return;
        this.finished = true;

        // Mark complete
        markLessonComplete(this.lessonId);

        document.getElementById('lesson-pct').textContent = '100%';
        document.getElementById('lesson-bar-fill').style.width = '100%';

        // Enter sandbox
        if (this.lesson.sandbox) {
            const sandboxPieces = expandTo12x12({ setup: this.lesson.sandbox.pieces }).setup;
            this.board._buildTerrainMap(sandboxPieces);
            this.board.reset();
            this.board.setState(sandboxPieces);
            this.board.setMode('sandbox');

            const statusEl = document.getElementById('coach-status');
            statusEl.classList.remove('waiting', 'correct', 'hint');
            statusEl.classList.add('hint');
            statusEl.textContent = 'Free play — move any white piece!';

            document.getElementById('coach-step').textContent = 'SANDBOX';
            document.getElementById('coach-title').textContent = 'Your turn to explore';
            document.getElementById('coach-text').textContent = 'Practice the movement on the board. Click any white piece to see its legal moves.';

            document.getElementById('coach-next').disabled = true;
            document.getElementById('coach-skip').textContent = 'Finish';
        }

        setTimeout(() => this.showComplete(), 700);
    }

    showComplete() {
        const modal = document.getElementById('lesson-complete');
        const titleEl = document.getElementById('complete-title');
        const msg = document.getElementById('complete-msg');

        titleEl.textContent = 'Lesson Complete!';
        msg.textContent = `You've mastered the ${this.lesson.title}. Ready for the next challenge?`;

        const nextBtn = document.getElementById('complete-next-btn');
        const newBtn = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newBtn, nextBtn);

        if (this.lesson.next && LESSONS[this.lesson.next]) {
            newBtn.textContent = `Next: ${LESSONS[this.lesson.next].title} →`;
            newBtn.style.display = '';
            newBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                location.hash = '#' + this.lesson.next;
            });
        } else {
            newBtn.textContent = '🎉 Back to Lessons';
            newBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                location.hash = '';
            });
        }

        modal.classList.add('active');
    }

    updateProgress() {
        const total = this.lesson.steps.length;
        const done = Math.min(this.currentStep + (this.solved ? 1 : 0), total);
        const pct = Math.round((done / total) * 100);
        document.getElementById('lesson-pct').textContent = pct + '%';
        document.getElementById('lesson-bar-fill').style.width = pct + '%';
    }

    updateDots() {
        const dotsEl = document.getElementById('coach-dots');
        if (!dotsEl) return;
        dotsEl.innerHTML = '';
        for (let i = 0; i < this.lesson.steps.length; i++) {
            const dot = document.createElement('span');
            dot.className = 'dot';
            if (i < this.currentStep) dot.classList.add('done');
            if (i === this.currentStep) dot.classList.add('active');
            dotsEl.appendChild(dot);
        }
    }
}

// ═══════════════════════════════════════════════════════════
// COORDINATE LABEL HELPERS — build (a–l / 1–12) strips around
// the lesson board using the .lesson-board-with-coords layout
// ═══════════════════════════════════════════════════════════
function wrapBoardWithCoords(boardEl) {
    // If already wrapped, don't double-wrap
    if (boardEl.parentElement && boardEl.parentElement.classList.contains('lesson-board-with-coords')) {
        return boardEl.parentElement;
    }

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'lesson-board-with-coords';

    // Insert wrapper in place of boardEl
    boardEl.parentNode.insertBefore(wrapper, boardEl);

    // Build coordinate strips
    const topStrip    = document.createElement('div');
    const bottomStrip = document.createElement('div');
    const leftStrip   = document.createElement('div');
    const rightStrip  = document.createElement('div');
    topStrip.className    = 'lesson-coords-top';
    bottomStrip.className = 'lesson-coords-bottom';
    leftStrip.className   = 'lesson-coords-left';
    rightStrip.className  = 'lesson-coords-right';

    COLS.forEach(col => {
        const s1 = document.createElement('span'); s1.textContent = col;
        const s2 = document.createElement('span'); s2.textContent = col;
        topStrip.appendChild(s1);
        bottomStrip.appendChild(s2);
    });

    ROWS.forEach(row => {
        const s1 = document.createElement('span'); s1.textContent = String(row);
        const s2 = document.createElement('span'); s2.textContent = String(row);
        leftStrip.appendChild(s1);
        rightStrip.appendChild(s2);
    });

    // Grid layout: strips + board
    wrapper.appendChild(topStrip);
    wrapper.appendChild(leftStrip);
    wrapper.appendChild(boardEl);
    wrapper.appendChild(rightStrip);
    wrapper.appendChild(bottomStrip);

    return wrapper;
}

// ═══════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════
let currentBoard = null;
let currentCoach = null;

function route() {
    const hash = (location.hash || '').replace('#', '');
    const lessonId = hash || null;
    const learnView = document.getElementById('learn-view');
    const lessonView = document.getElementById('lesson-view');
    const completeModal = document.getElementById('lesson-complete');

    completeModal.classList.remove('active');

    if (!lessonId || !LESSONS[lessonId]) {
        learnView.style.display = '';
        lessonView.style.display = 'none';
        window.scrollTo(0, 0);
        refreshLandingBadges();
        return;
    }

    const lesson = LESSONS[lessonId];
    learnView.style.display = 'none';
    lessonView.style.display = '';
    window.scrollTo(0, 0);

    document.getElementById('lesson-icon').textContent = lesson.icon;
    document.getElementById('lesson-title').textContent = lesson.title;
    document.getElementById('lesson-subtitle').textContent = lesson.subtitle;

    document.getElementById('coach-skip').textContent = 'Skip';

    // Get the board area and reset it so no old wrapper lingers
    const boardArea = document.querySelector('.lesson-board-area');
    boardArea.innerHTML = '';

    // Create a fresh board element
    const boardEl = document.createElement('div');
    boardEl.id = 'lesson-board';
    boardEl.className = 'lesson-board';
    boardArea.appendChild(boardEl);

    // ★ Wrap board with coordinate strips (a–l / 1–12)
    wrapBoardWithCoords(boardEl);

    currentBoard = new DemoBoard(boardEl);

    currentCoach = new Coach(lesson, lessonId, currentBoard);
    currentCoach.start();

    document.getElementById('lesson-next-btn').onclick = () => {
        if (lesson.next && LESSONS[lesson.next]) location.hash = '#' + lesson.next;
        else location.hash = '';
    };
}

// Add a small ✓ badge to completed lesson cards
function refreshLandingBadges() {
    document.querySelectorAll('.learn-card').forEach(card => {
        const id = card.dataset.lesson;
        if (!id) return;
        // Remove old badge
        card.querySelector('.learn-card-done')?.remove();
        if (isLessonComplete(id)) {
            const badge = document.createElement('span');
            badge.className = 'learn-card-done';
            badge.textContent = '✓';
            badge.title = 'Completed';
            card.appendChild(badge);
        }
    });
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
window.addEventListener('hashchange', route);

window.addEventListener('DOMContentLoaded', () => {
    // Route all [data-lesson] click targets (hero buttons + cards) to hash navigation
    document.querySelectorAll('[data-lesson]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            location.hash = '#' + el.dataset.lesson;
        });
    });
    route();
});