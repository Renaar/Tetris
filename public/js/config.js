/* =====================================================================
 * config.js — Tous les réglages du jeu au même endroit.
 * ---------------------------------------------------------------------
 * Modifie les valeurs ici pour changer la difficulté, les couleurs,
 * la durée des animations ou le volume, sans toucher au reste du code.
 * ===================================================================== */

const CONFIG = {
  /* --- Modes de jeu et taille du plateau ---------------------------
   * cols   : largeur du plateau (en cases)
   * rows   : hauteur visible (en cases)
   * hidden : lignes invisibles au-dessus, où les pièces apparaissent
   * kicks  : table de "wall kicks" utilisée ('srs' = Tetris officiel,
   *          'penta' = table adaptée aux pièces 5×5, voir game.js)
   */
  MODES: {
    classic: {
      id: 'classic',
      name: 'Tetris classique',
      description: 'Plateau 10×20 et les 7 tétrominos officiels.',
      cols: 10, rows: 20, hidden: 2, kicks: 'srs',
    },
    lab: {
      id: 'lab',
      name: 'Pentominos Lab',
      description: 'Plateau 12×20 et tes propres pièces de 5 cases.',
      // Plus large (12) et plus de lignes cachées (4) : une pièce 5×5
      // a besoin de place pour apparaître et tourner sans perdre injustement.
      cols: 12, rows: 20, hidden: 4, kicks: 'penta',
    },
  },
  DEFAULT_MODE: 'classic',

  /* --- Mode "simple" : objectif de lignes ---------------------------- */
  TARGET_OPTIONS: [10, 20, 40], // choix proposés sur l'écran d'accueil
  DEFAULT_TARGET: 20,           // objectif sélectionné par défaut

  /* --- Éditeur de pentominos ----------------------------------------- */
  LAB_GRID: 5,              // taille de la grille de dessin (5×5)
  LAB_PIECE_SIZE: 5,        // nombre exact de cases d'une pièce
  LAB_MAX_PIECES_PER_SET: 20,
  // Couleurs proposées dans l'éditeur (on peut aussi choisir librement)
  LAB_COLORS: [
    '#5ce1ff', '#ffd95c', '#c38bff', '#6ef3a5', '#ff6b8b', '#6b9bff',
    '#ffa65c', '#ff8fd8', '#b8f35c', '#5cffd6', '#ff5c5c', '#e0e4ff',
  ],

  /* --- Vitesse ------------------------------------------------------- */
  LINES_PER_LEVEL: 4,   // on monte d'un niveau toutes les N lignes
  MIN_GRAVITY_MS: 40,   // vitesse de chute maximale (ms par case)

  /* --- Contrôles (en millisecondes) ---------------------------------- */
  DAS: 150,                // délai avant la répétition quand on garde ← ou →
  ARR: 45,                 // intervalle de répétition ensuite
  SOFT_DROP_INTERVAL: 35,  // vitesse de chute quand on garde ↓
  LOCK_DELAY: 500,         // temps pour ajuster une pièce posée avant qu'elle se fige
  MAX_LOCK_RESETS: 15,     // nb max de fois où bouger/tourner relance ce délai

  /* --- Score --------------------------------------------------------- */
  SCORE_LINES: [0, 100, 300, 500, 800, 1200], // pour 0 à 5 lignes (× niveau) — 5 possible avec un pentomino
  SCORE_SOFT_DROP: 1,                   // points par case en chute douce
  SCORE_HARD_DROP: 2,                   // points par case en chute instantanée

  /* --- Animations (durées en ms, toutes courtes et non bloquantes) --- */
  ANIM: {
    LINE_FLASH: 220,      // flash + disparition d'une ligne détruite
    ROW_FALL_DELAY: 70,   // petite pause avant que les blocs retombent
    ROW_FALL: 150,        // durée de la retombée des blocs
    LOCK_GLOW: 140,       // léger éclat quand une pièce se pose
    HARD_DROP_TRAIL: 160, // traînée lumineuse du hard drop
  },

  /* --- Couleurs des pièces (palette néon pastel) --------------------- */
  // (mode classique ; en mode Lab, chaque pièce a sa propre couleur)
  COLORS: {
    I: '#5ce1ff', // cyan
    O: '#ffd95c', // jaune
    T: '#c38bff', // violet
    S: '#6ef3a5', // vert
    Z: '#ff6b8b', // rose-rouge
    J: '#6b9bff', // bleu
    L: '#ffa65c', // orange
  },

  /* --- Son ----------------------------------------------------------- */
  SOUND_VOLUME: 0.35, // volume général (0 = muet, 1 = maximum)
};

/**
 * Temps (en ms) que met une pièce pour descendre d'une case, selon le niveau.
 * Formule inspirée des Tetris modernes : la chute accélère à chaque niveau.
 * Niveau 1 ≈ 1000 ms, niveau 5 ≈ 355 ms, niveau 10 ≈ 64 ms.
 */
function gravityInterval(level) {
  const seconds = Math.pow(0.8 - (level - 1) * 0.007, level - 1);
  return Math.max(CONFIG.MIN_GRAVITY_MS, seconds * 1000);
}
