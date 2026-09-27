/* =====================================================================
 * config.js — Tous les réglages du jeu au même endroit.
 * ---------------------------------------------------------------------
 * Modifie les valeurs ici pour changer la difficulté, les couleurs,
 * la durée des animations ou le volume, sans toucher au reste du code.
 * ===================================================================== */

const CONFIG = {
  /* --- Plateau ------------------------------------------------------- */
  COLS: 10,          // largeur du plateau (en cases)
  ROWS: 20,          // hauteur visible du plateau (en cases)
  HIDDEN_ROWS: 2,    // lignes invisibles au-dessus, où les pièces apparaissent

  /* --- Mode "simple" : objectif de lignes ---------------------------- */
  TARGET_OPTIONS: [10, 20, 40], // choix proposés sur l'écran d'accueil
  DEFAULT_TARGET: 20,           // objectif sélectionné par défaut

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
  SCORE_LINES: [0, 100, 300, 500, 800], // pour 0, 1, 2, 3, 4 lignes (× niveau)
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
