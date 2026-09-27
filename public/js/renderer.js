/* =====================================================================
 * renderer.js — Tout ce qui se dessine sur les <canvas>.
 * ---------------------------------------------------------------------
 * - Le plateau (grille, blocs posés, pièce active, pièce fantôme)
 * - L'aperçu de la pièce suivante
 * - Les petits effets visuels ("juice"), tous très courts :
 *     • flash + disparition des lignes détruites
 *     • retombée fluide des blocs au-dessus
 *     • éclat quand une pièce se pose
 *     • traînée lumineuse du hard drop
 *
 * Les effets sont purement visuels : la logique du jeu continue
 * normalement pendant qu'ils se jouent, ils ne bloquent jamais l'input.
 * ===================================================================== */

/* --- Petits outils ---------------------------------------------------- */

const clamp01 = t => Math.max(0, Math.min(1, t));
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

/** Mélange une couleur hex avec du blanc (amount > 0) ou du noir (amount < 0). */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  r = Math.round(r + (target - r) * a);
  g = Math.round(g + (target - g) * a);
  b = Math.round(b + (target - b) * a);
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Trace un rectangle aux coins arrondis. */
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

class Renderer {
  constructor(boardCanvas, nextCanvas) {
    this.canvas = boardCanvas;
    this.ctx = boardCanvas.getContext('2d');
    this.nextCanvas = nextCanvas;
    this.nextCtx = nextCanvas.getContext('2d');
    this.cell = 30;           // taille d'une case en pixels (recalculée au redimensionnement)
    this.sprites = new Map(); // images de blocs pré-dessinées (plus rapide)
    this.effects = [];        // effets visuels en cours
    this.rowFall = null;      // animation de retombée en cours
  }

  /* ------------------------------------------------------------------
   * Taille : le plateau s'adapte à la hauteur de la fenêtre
   * ------------------------------------------------------------------ */

  resize() {
    const available = window.innerHeight - 90;
    this.cell = Math.max(18, Math.min(38, Math.floor(available / CONFIG.ROWS)));
    this.dpr = window.devicePixelRatio || 1;

    const w = this.cell * CONFIG.COLS;
    const h = this.cell * CONFIG.ROWS;
    this.setupCanvas(this.canvas, this.ctx, w, h);

    const nextSize = this.cell * 4.2;
    this.setupCanvas(this.nextCanvas, this.nextCtx, nextSize, nextSize * 0.7);

    this.sprites.clear();
  }

  /** Canvas net sur les écrans haute résolution (Retina, etc.). */
  setupCanvas(canvas, ctx, w, h) {
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * this.dpr);
    canvas.height = Math.round(h * this.dpr);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /* ------------------------------------------------------------------
   * Dessin d'un bloc : carré arrondi avec dégradé et reflet
   * ------------------------------------------------------------------ */

  /** Renvoie (et met en cache) l'image d'un bloc d'une couleur et d'une taille données. */
  getSprite(color, size) {
    const key = `${color}-${size}`;
    if (this.sprites.has(key)) return this.sprites.get(key);

    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * this.dpr);
    const g = c.getContext('2d');
    g.scale(this.dpr, this.dpr);

    const pad = Math.max(1, size * 0.06);  // petit espace entre les blocs
    const s = size - pad * 2;
    const radius = s * 0.2;

    // Corps : dégradé vertical, plus clair en haut
    const grad = g.createLinearGradient(0, pad, 0, pad + s);
    grad.addColorStop(0, shade(color, 0.28));
    grad.addColorStop(1, shade(color, -0.12));
    roundRectPath(g, pad, pad, s, s, radius);
    g.fillStyle = grad;
    g.fill();

    // Reflet doux en haut
    roundRectPath(g, pad + s * 0.14, pad + s * 0.1, s * 0.72, s * 0.22, s * 0.11);
    g.fillStyle = 'rgba(255, 255, 255, 0.28)';
    g.fill();

    // Liseré intérieur
    roundRectPath(g, pad + 0.5, pad + 0.5, s - 1, s - 1, radius);
    g.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    g.lineWidth = 1;
    g.stroke();

    this.sprites.set(key, c);
    return c;
  }

  /** spriteSize : taille de l'image source (utile pour réduire un bloc sans recréer d'image). */
  drawBlock(ctx, type, x, y, size = this.cell, alpha = 1, spriteSize = size) {
    const sprite = this.getSprite(CONFIG.COLORS[type], spriteSize);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x, y, size, size);
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------
   * Déclencheurs d'effets (appelés depuis main.js)
   * ------------------------------------------------------------------ */

  addEffect(type, data, duration) {
    this.effects.push({ type, data, duration, start: performance.now() });
  }

  onLock(cells, strong) {
    this.addEffect('glow', { cells, strength: strong ? 0.75 : 0.4 }, CONFIG.ANIM.LOCK_GLOW);
  }

  onHardDrop(data) {
    this.addEffect('trail', data, CONFIG.ANIM.HARD_DROP_TRAIL);
  }

  onLines(data) {
    this.addEffect('lineFlash', data, CONFIG.ANIM.LINE_FLASH);
    this.rowFall = { drops: data.drops, start: performance.now() };
  }

  clearEffects() {
    this.effects = [];
    this.rowFall = null;
  }

  /* ------------------------------------------------------------------
   * Dessin du plateau, appelé à chaque image
   * ------------------------------------------------------------------ */

  draw(game) {
    const ctx = this.ctx;
    const cell = this.cell;
    const now = performance.now();
    const W = cell * CONFIG.COLS;
    const H = cell * CONFIG.ROWS;
    const hidden = CONFIG.HIDDEN_ROWS;

    // On retire les effets terminés
    this.effects = this.effects.filter(e => now - e.start < e.duration);

    ctx.clearRect(0, 0, W, H);
    this.drawGrid(ctx, W, H);

    // --- 1. Blocs posés (avec retombée animée après une ligne détruite)
    let fallProgress = 1;
    if (this.rowFall) {
      const t = (now - this.rowFall.start - CONFIG.ANIM.ROW_FALL_DELAY) / CONFIG.ANIM.ROW_FALL;
      fallProgress = easeOutCubic(clamp01(t));
      if (t >= 1) this.rowFall = null;
    }
    for (let r = hidden; r < game.totalRows; r++) {
      const drop = this.rowFall ? this.rowFall.drops[r] : 0;
      const offset = drop * (1 - fallProgress); // en cases, diminue jusqu'à 0
      const y = (r - hidden - offset) * cell;
      const row = game.board[r];
      for (let c = 0; c < CONFIG.COLS; c++) {
        if (row[c]) this.drawBlock(ctx, row[c], c * cell, y);
      }
    }

    // --- 2. Lignes détruites : flash blanc + les blocs rétrécissent et s'effacent
    for (const e of this.effects.filter(e => e.type === 'lineFlash')) {
      const t = clamp01((now - e.start) / e.duration);
      const scale = 1 - easeOutCubic(t);
      for (const { row, cells } of e.data.cleared) {
        if (row < hidden) continue;
        const y = (row - hidden) * cell;
        cells.forEach((type, c) => {
          const s = cell * scale;
          if (s > 0.5) this.drawBlock(ctx, type, c * cell + (cell - s) / 2, y + (cell - s) / 2, s, 1 - t, cell);
        });
        ctx.fillStyle = `rgba(255, 255, 255, ${0.75 * Math.pow(1 - t, 2)})`;
        roundRectPath(ctx, 1, y + 1, W - 2, cell - 2, cell * 0.2);
        ctx.fill();
      }
    }

    // --- 3. Traînée du hard drop (colonne lumineuse qui s'estompe)
    for (const e of this.effects.filter(e => e.type === 'trail')) {
      const t = clamp01((now - e.start) / e.duration);
      const color = CONFIG.COLORS[e.data.type];
      // Pour chaque colonne : du haut de la pièce au départ jusqu'au haut de la pièce à l'arrivée
      const cols = {};
      e.data.fromCells.forEach(({ x, y }) => { cols[x] = Math.min(cols[x] ?? Infinity, y); });
      const landing = {};
      e.data.toCells.forEach(({ x, y }) => { landing[x] = Math.min(landing[x] ?? Infinity, y); });
      for (const x of Object.keys(cols)) {
        const top = Math.max(0, (cols[x] - hidden) * cell);
        const bottom = (landing[x] - hidden) * cell;
        if (bottom <= top) continue;
        const grad = ctx.createLinearGradient(0, top, 0, bottom);
        grad.addColorStop(0, hexToRgba(color, 0));
        grad.addColorStop(1, hexToRgba(color, 0.32 * (1 - t)));
        ctx.fillStyle = grad;
        ctx.fillRect(x * cell + cell * 0.15, top, cell * 0.7, bottom - top);
      }
    }

    // --- 4. Pièce fantôme (où la pièce va atterrir) + pièce active
    if (game.piece && (game.state === 'playing' || game.state === 'paused')) {
      const color = CONFIG.COLORS[game.piece.type];
      const ghostY = game.ghostY();
      for (const { x, y } of game.pieceCells(game.piece, ghostY)) {
        if (y < hidden) continue;
        const px = x * cell, py = (y - hidden) * cell;
        const pad = cell * 0.1;
        roundRectPath(ctx, px + pad, py + pad, cell - pad * 2, cell - pad * 2, cell * 0.18);
        ctx.fillStyle = hexToRgba(color, 0.08);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(color, 0.45);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // La pièce pâlit très légèrement pendant le délai de verrouillage
      const lockFade = 1 - 0.25 * clamp01(game.lockTimer / CONFIG.LOCK_DELAY);
      for (const { x, y, type } of game.pieceCells()) {
        if (y < hidden) continue;
        this.drawBlock(ctx, type, x * cell, (y - hidden) * cell, cell, lockFade);
      }
    }

    // --- 5. Éclat des blocs qui viennent de se poser
    for (const e of this.effects.filter(e => e.type === 'glow')) {
      const t = clamp01((now - e.start) / e.duration);
      ctx.fillStyle = `rgba(255, 255, 255, ${e.data.strength * (1 - t)})`;
      for (const { x, y } of e.data.cells) {
        if (y < hidden) continue;
        const pad = cell * 0.06;
        roundRectPath(ctx, x * cell + pad, (y - hidden) * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.2);
        ctx.fill();
      }
    }
  }

  /** Grille discrète en fond de plateau. */
  drawGrid(ctx, W, H) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < CONFIG.COLS; c++) {
      ctx.moveTo(c * this.cell + 0.5, 0);
      ctx.lineTo(c * this.cell + 0.5, H);
    }
    for (let r = 1; r < CONFIG.ROWS; r++) {
      ctx.moveTo(0, r * this.cell + 0.5);
      ctx.lineTo(W, r * this.cell + 0.5);
    }
    ctx.stroke();
  }

  /* ------------------------------------------------------------------
   * Aperçu de la pièce suivante (centré dans sa boîte)
   * ------------------------------------------------------------------ */

  drawNext(type) {
    const ctx = this.nextCtx;
    const W = parseFloat(this.nextCanvas.style.width);
    const H = parseFloat(this.nextCanvas.style.height);
    ctx.clearRect(0, 0, W, H);
    if (!type) return;

    // On ne garde que les lignes/colonnes réellement occupées
    const m = PIECES[type];
    const rows = m.map((row, r) => row.some(v => v) ? r : -1).filter(r => r >= 0);
    const cols = m[0].map((_, c) => m.some(row => row[c]) ? c : -1).filter(c => c >= 0);
    const size = Math.floor(this.cell * 0.9);
    const offX = (W - cols.length * size) / 2;
    const offY = (H - rows.length * size) / 2;

    rows.forEach((r, i) => cols.forEach((c, j) => {
      if (m[r][c]) this.drawBlock(ctx, type, offX + j * size, offY + i * size, size);
    }));
  }
}
