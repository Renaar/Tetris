/* =====================================================================
 * pentominos.js — Outils pour les pièces personnalisées (mode Lab).
 * ---------------------------------------------------------------------
 *   1. Validation d'un dessin (exactement 5 cases, toutes reliées par un côté)
 *   2. Normalisation (on recentre le dessin dans la grille 5×5)
 *   3. Génération automatique des 4 rotations (0°, 90°, 180°, 270°)
 *   4. Sauvegarde des "sets" de pièces dans le navigateur (localStorage)
 *
 * Une pièce est stockée comme une liste de cases [ligne, colonne],
 * par exemple la barre droite : [[2,0],[2,1],[2,2],[2,3],[2,4]].
 * ===================================================================== */

const LAB_STORAGE_KEY = 'tetris.pentoSets';

/* ---------------------------------------------------------------------
 * 1. Validation
 * --------------------------------------------------------------------- */

/**
 * Vérifie un dessin. Renvoie { ok: true } ou { ok: false, error: "message" }.
 * @param {number[][]} cells liste de [ligne, colonne]
 */
function validateShape(cells) {
  const need = CONFIG.LAB_PIECE_SIZE;
  if (cells.length !== need) {
    const diff = need - cells.length;
    return {
      ok: false,
      error: diff > 0
        ? `Il faut exactement ${need} cases : encore ${diff} à ajouter.`
        : `Il faut exactement ${need} cases : ${-diff} de trop.`,
    };
  }
  if (!isConnected(cells)) {
    return { ok: false, error: 'Toutes les cases doivent se toucher par un côté (un coin ne suffit pas).' };
  }
  return { ok: true };
}

/**
 * "Flood-fill" (remplissage par diffusion) : on part d'une case et on
 * se propage à ses voisines haut/bas/gauche/droite (pas en diagonale).
 * Si on a atteint toutes les cases, la forme est d'un seul tenant.
 */
function isConnected(cells) {
  if (cells.length === 0) return false;
  const remaining = new Set(cells.map(([r, c]) => `${r},${c}`));
  const stack = [cells[0]];
  remaining.delete(`${cells[0][0]},${cells[0][1]}`);
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${r + dr},${c + dc}`;
      if (remaining.has(key)) {
        remaining.delete(key);
        stack.push([r + dr, c + dc]);
      }
    }
  }
  return remaining.size === 0;
}

/* ---------------------------------------------------------------------
 * 2. Normalisation et 3. rotations
 * --------------------------------------------------------------------- */

/**
 * Recentre le dessin dans la grille 5×5.
 * Pourquoi ? La pièce tourne autour du centre de la grille : si l'élève
 * dessine dans un coin, la pièce "sauterait" en tournant. Une fois centrée,
 * elle tourne proprement sur elle-même.
 */
function normalizeShape(cells) {
  const size = CONFIG.LAB_GRID;
  const rows = cells.map(c => c[0]);
  const cols = cells.map(c => c[1]);
  const minR = Math.min(...rows), maxR = Math.max(...rows);
  const minC = Math.min(...cols), maxC = Math.max(...cols);
  const offR = Math.floor((size - (maxR - minR + 1)) / 2) - minR;
  const offC = Math.floor((size - (maxC - minC + 1)) / 2) - minC;
  return cells
    .map(([r, c]) => [r + offR, c + offC])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Liste de cases → matrice 5×5 de 0 et 1 (format utilisé par le jeu). */
function cellsToMatrix(cells) {
  const size = CONFIG.LAB_GRID;
  const m = Array.from({ length: size }, () => Array(size).fill(0));
  cells.forEach(([r, c]) => { m[r][c] = 1; });
  return m;
}

/** Les 4 états de rotation (0°, 90°, 180°, 270°), calculés depuis le dessin de base. */
function shapeRotations(cells) {
  const r0 = cellsToMatrix(normalizeShape(cells));
  const r1 = rotateMatrix(r0, 1);
  const r2 = rotateMatrix(r1, 1);
  const r3 = rotateMatrix(r2, 1);
  return [r0, r1, r2, r3];
}

/**
 * Deux dessins représentent-ils la même pièce (à une rotation près) ?
 * Le miroir compte comme une pièce différente, comme S et Z dans Tetris.
 */
function sameShape(cellsA, cellsB) {
  const key = m => {
    // on "rogne" la matrice aux cases occupées pour comparer la forme seule
    const cells = [];
    m.forEach((row, r) => row.forEach((v, c) => { if (v) cells.push([r, c]); }));
    return JSON.stringify(normalizeShape(cells));
  };
  const target = key(cellsToMatrix(normalizeShape(cellsB)));
  return shapeRotations(cellsA).some(m => key(m) === target);
}

/** Convertit un set sauvegardé en définitions de pièces pour le jeu. */
function setToPieceDefs(set) {
  return set.pieces.map(p => ({
    id: p.id,
    color: p.color,
    rotations: shapeRotations(p.cells),
  }));
}

/* ---------------------------------------------------------------------
 * 4. Sauvegarde locale des sets
 * --------------------------------------------------------------------- */

const makeId = prefix => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Lit tous les sets. Au tout premier lancement, crée un set d'exemple. */
function loadSets() {
  try {
    const raw = localStorage.getItem(LAB_STORAGE_KEY);
    if (raw === null) {
      const sets = [exampleSet()];
      saveSets(sets);
      return sets;
    }
    const sets = JSON.parse(raw);
    return Array.isArray(sets) ? sets : [];
  } catch (e) {
    return [exampleSet()]; // stockage indisponible : on joue quand même avec l'exemple
  }
}

function saveSets(sets) {
  try { localStorage.setItem(LAB_STORAGE_KEY, JSON.stringify(sets)); } catch (e) { /* stockage indisponible */ }
}

/**
 * Set d'exemple : les 12 pentominos "officiels" (F, I, L, N, P, T, U, V, W, X, Y, Z).
 * '#' = case pleine. L'élève peut le modifier ou le supprimer.
 */
function exampleSet() {
  const shapes = {
    F: ['.##', '##.', '.#.'],
    I: ['#####'],
    L: ['#.', '#.', '#.', '##'],
    N: ['.#', '.#', '##', '#.'],
    P: ['##', '##', '#.'],
    T: ['###', '.#.', '.#.'],
    U: ['#.#', '###'],
    V: ['#..', '#..', '###'],
    W: ['#..', '##.', '.##'],
    X: ['.#.', '###', '.#.'],
    Y: ['.#', '##', '.#', '.#'],
    Z: ['##.', '.#.', '.##'],
  };
  const pieces = Object.entries(shapes).map(([name, rows], i) => {
    const cells = [];
    rows.forEach((line, r) => [...line].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
    return { id: `ex${name}`, cells: normalizeShape(cells), color: CONFIG.LAB_COLORS[i % CONFIG.LAB_COLORS.length] };
  });
  return { id: 'example', name: 'Les 12 pentominos', pieces };
}
