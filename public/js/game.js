/* =====================================================================
 * game.js — La logique pure du jeu.
 * ---------------------------------------------------------------------
 * Ce fichier ne dessine rien et ne joue aucun son. Il gère :
 *   - le plateau (une grille de cases),
 *   - les pièces (forme, rotation, déplacement, chute),
 *   - les lignes, le score, le niveau et la fin de partie.
 *
 * Quand quelque chose d'intéressant se passe (rotation, pose, ligne…),
 * il "émet un événement" via la fonction onEvent(nom, données).
 * Le fichier main.js écoute ces événements pour déclencher sons et effets.
 * ===================================================================== */

/* --- Les 7 tétrominos ------------------------------------------------
 * 1 = case pleine. Les formes suivent le standard "SRS" (celui des
 * Tetris modernes) : tourner la matrice donne directement la bonne
 * rotation officielle.
 */
const PIECES = {
  I: [[0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]],
  O: [[1, 1],
      [1, 1]],
  T: [[0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]],
  S: [[0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]],
  Z: [[1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]],
  J: [[1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]],
  L: [[0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]],
};

const PIECE_TYPES = Object.keys(PIECES);

/* --- "Wall kicks" SRS -------------------------------------------------
 * Si une rotation est bloquée (contre un mur ou d'autres blocs), le jeu
 * essaie de décaler légèrement la pièce. Chaque liste donne les décalages
 * [x, y] à tester dans l'ordre. Clé "a>b" = passage de l'orientation a à b
 * (0 = départ, 1 = droite, 2 = retournée, 3 = gauche).
 * Attention : dans ces tables, y positif = vers le HAUT.
 */
const KICKS = {
  JLSTZ: {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  },
  I: {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  },
};

/** Tourne une matrice carrée d'un quart de tour (dir = 1 horaire, -1 anti-horaire). */
function rotateMatrix(m, dir) {
  const n = m.length;
  const out = [];
  for (let r = 0; r < n; r++) {
    out.push([]);
    for (let c = 0; c < n; c++) {
      out[r][c] = dir > 0 ? m[n - 1 - c][r] : m[c][n - 1 - r];
    }
  }
  return out;
}

class Game {
  /** @param {(name: string, data?: object) => void} onEvent */
  constructor(onEvent) {
    this.onEvent = onEvent || (() => {});
    this.totalRows = CONFIG.ROWS + CONFIG.HIDDEN_ROWS;
    this.state = 'idle'; // 'idle' | 'playing' | 'paused' | 'won' | 'over'
    this.board = this.createBoard();
    this.piece = null;
    this.nextType = null;
  }

  /* ------------------------------------------------------------------
   * Démarrage / état général
   * ------------------------------------------------------------------ */

  start(targetLines) {
    this.board = this.createBoard();
    this.bag = [];
    this.target = targetLines;
    this.score = 0;
    this.lines = 0;
    this.elapsed = 0;       // temps de jeu en ms (hors pause)
    this.softDrop = false;
    this.nextType = this.drawFromBag();
    this.state = 'playing';
    this.emit('start');
    this.spawn();
  }

  get level() {
    return 1 + Math.floor(this.lines / CONFIG.LINES_PER_LEVEL);
  }

  togglePause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
    else return;
    this.emit('pause', { paused: this.state === 'paused' });
  }

  emit(name, data) {
    this.onEvent(name, data || {});
  }

  /** Grille vide : tableau de lignes, chaque case vaut null ou une lettre de pièce. */
  createBoard() {
    return Array.from({ length: this.totalRows }, () => Array(CONFIG.COLS).fill(null));
  }

  /* ------------------------------------------------------------------
   * Tirage des pièces : système du "sac de 7"
   * On met les 7 pièces dans un sac, on les mélange et on les pioche une
   * par une. Résultat : jamais de longue attente pour une pièce donnée.
   * ------------------------------------------------------------------ */

  drawFromBag() {
    if (this.bag.length === 0) {
      this.bag = PIECE_TYPES.slice();
      for (let i = this.bag.length - 1; i > 0; i--) { // mélange de Fisher-Yates
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  /** Fait apparaître la pièce suivante en haut du plateau. */
  spawn() {
    const type = this.nextType;
    this.nextType = this.drawFromBag();
    const matrix = PIECES[type].map(row => row.slice());
    this.piece = {
      type,
      matrix,
      rot: 0,
      x: Math.floor((CONFIG.COLS - matrix.length) / 2),
      // La ligne la plus basse de la pièce arrive juste sur la 1re ligne visible
      y: CONFIG.HIDDEN_ROWS - 1,
    };
    this.gravityTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lowestY = this.piece.y;

    // Plus de place pour apparaître → partie perdue
    if (this.collides(matrix, this.piece.x, this.piece.y)) {
      this.gameOver();
      return;
    }
    this.emit('spawn', { type });
  }

  /* ------------------------------------------------------------------
   * Collisions et déplacements
   * ------------------------------------------------------------------ */

  /** Vrai si la matrice placée en (x, y) sort du plateau ou touche un bloc. */
  collides(matrix, x, y) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const bx = x + c;
        const by = y + r;
        if (bx < 0 || bx >= CONFIG.COLS || by >= this.totalRows) return true;
        if (by >= 0 && this.board[by][bx]) return true;
      }
    }
    return false;
  }

  /** Liste des cases occupées par la pièce active (coordonnées plateau). */
  pieceCells(piece = this.piece, y = piece.y) {
    const cells = [];
    piece.matrix.forEach((row, r) => row.forEach((v, c) => {
      if (v) cells.push({ x: piece.x + c, y: y + r, type: piece.type });
    }));
    return cells;
  }

  isGrounded() {
    return this.collides(this.piece.matrix, this.piece.x, this.piece.y + 1);
  }

  /** Ligne où la pièce atterrirait si on la lâchait (sert au "fantôme"). */
  ghostY() {
    let y = this.piece.y;
    while (!this.collides(this.piece.matrix, this.piece.x, y + 1)) y++;
    return y;
  }

  /** Déplacement latéral (dx = -1 gauche, +1 droite). Renvoie true si réussi. */
  move(dx) {
    if (this.state !== 'playing' || !this.piece) return false;
    if (this.collides(this.piece.matrix, this.piece.x + dx, this.piece.y)) return false;
    this.piece.x += dx;
    this.onPieceAdjusted();
    this.emit('move');
    return true;
  }

  /** Rotation (dir = 1 horaire, -1 anti-horaire), avec wall kicks SRS. */
  rotate(dir) {
    if (this.state !== 'playing' || !this.piece) return false;
    const p = this.piece;
    if (p.type === 'O') return false; // le carré ne change pas en tournant

    const newRot = (p.rot + dir + 4) % 4;
    const matrix = rotateMatrix(p.matrix, dir);
    const kicks = KICKS[p.type === 'I' ? 'I' : 'JLSTZ'][`${p.rot}>${newRot}`];

    for (const [kx, ky] of kicks) {
      const nx = p.x + kx;
      const ny = p.y - ky; // la table utilise y vers le haut, notre plateau y vers le bas
      if (!this.collides(matrix, nx, ny)) {
        p.matrix = matrix;
        p.x = nx;
        p.y = ny;
        p.rot = newRot;
        this.onPieceAdjusted();
        this.emit('rotate');
        return true;
      }
    }
    return false;
  }

  /**
   * Appelé après chaque mouvement/rotation réussi : si la pièce est posée,
   * on relance le délai de verrouillage (limité pour éviter de "tricher").
   */
  onPieceAdjusted() {
    if (this.lockTimer > 0 && this.lockResets < CONFIG.MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
  }

  /** Descend la pièce d'une case. Renvoie false si elle est bloquée. */
  stepDown() {
    const p = this.piece;
    if (this.collides(p.matrix, p.x, p.y + 1)) return false;
    p.y++;
    if (p.y > this.lowestY) { // nouvelle profondeur atteinte → compteur remis à zéro
      this.lowestY = p.y;
      this.lockResets = 0;
      this.lockTimer = 0;
    }
    return true;
  }

  setSoftDrop(active) {
    this.softDrop = active;
  }

  /** Chute instantanée : la pièce tombe tout en bas et se pose aussitôt. */
  hardDrop() {
    if (this.state !== 'playing' || !this.piece) return;
    const fromY = this.piece.y;
    while (this.stepDown()) { /* on descend jusqu'en bas */ }
    const distance = this.piece.y - fromY;
    this.score += distance * CONFIG.SCORE_HARD_DROP;
    this.emit('hardDrop', {
      type: this.piece.type,
      fromCells: this.pieceCells(this.piece, fromY),
      toCells: this.pieceCells(),
      distance,
    });
    this.lock(true);
  }

  /* ------------------------------------------------------------------
   * Boucle de jeu : appelée à chaque image avec le temps écoulé (ms)
   * ------------------------------------------------------------------ */

  update(dt) {
    if (this.state !== 'playing' || !this.piece) return;
    this.elapsed += dt;

    // 1) Gravité : la pièce descend à intervalle régulier
    let interval = gravityInterval(this.level);
    if (this.softDrop) interval = Math.min(interval, CONFIG.SOFT_DROP_INTERVAL);

    this.gravityTimer += dt;
    while (this.gravityTimer >= interval) {
      this.gravityTimer -= interval;
      if (this.stepDown()) {
        if (this.softDrop) this.score += CONFIG.SCORE_SOFT_DROP;
      } else {
        this.gravityTimer = 0;
        break;
      }
    }

    // 2) Verrouillage : posée trop longtemps sur un support → elle se fige
    if (this.isGrounded()) {
      this.lockTimer += dt;
      if (this.lockTimer >= CONFIG.LOCK_DELAY) this.lock(false);
    } else {
      this.lockTimer = 0;
    }
  }

  /** Fige la pièce dans le plateau, puis gère lignes, victoire et pièce suivante. */
  lock(fromHardDrop) {
    const cells = this.pieceCells();
    cells.forEach(({ x, y, type }) => {
      if (y >= 0) this.board[y][x] = type;
    });
    this.piece = null;
    this.emit('lock', { cells, hard: fromHardDrop });

    // Pièce entièrement posée dans la zone invisible → partie perdue
    if (cells.every(c => c.y < CONFIG.HIDDEN_ROWS)) {
      this.gameOver();
      return;
    }

    this.clearLines();
    if (this.state === 'playing') this.spawn();
  }

  /** Supprime les lignes complètes et fait descendre ce qui est au-dessus. */
  clearLines() {
    const full = [];
    this.board.forEach((row, r) => {
      if (row.every(cell => cell !== null)) full.push(r);
    });
    if (full.length === 0) return;

    const levelBefore = this.level;
    const cleared = full.map(r => ({ row: r, cells: this.board[r].slice() }));

    // Nouveau plateau = lignes vides en haut + lignes conservées
    const kept = [];
    this.board.forEach((row, r) => { if (!full.includes(r)) kept.push({ row, oldIndex: r }); });
    const newBoard = full.map(() => Array(CONFIG.COLS).fill(null));

    // drops[i] = de combien de cases la ligne i (nouvel index) est descendue.
    // Sert à animer la retombée des blocs.
    const drops = Array(this.totalRows).fill(0);
    kept.forEach(({ row, oldIndex }) => {
      drops[newBoard.length] = newBoard.length - oldIndex;
      newBoard.push(row);
    });
    this.board = newBoard;

    const count = full.length;
    this.lines += count;
    this.score += CONFIG.SCORE_LINES[count] * levelBefore;
    this.emit('lines', { count, rows: full, cleared, drops });

    if (this.level > levelBefore) this.emit('levelup', { level: this.level });

    if (this.lines >= this.target) this.win();
  }

  win() {
    this.state = 'won';
    this.piece = null;
    this.emit('win', { time: this.elapsed, score: this.score, lines: this.lines });
  }

  gameOver() {
    this.state = 'over';
    this.piece = null;
    this.emit('gameover', { time: this.elapsed, score: this.score, lines: this.lines });
  }
}
