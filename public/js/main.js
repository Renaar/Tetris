/* =====================================================================
 * main.js — Le chef d'orchestre.
 * ---------------------------------------------------------------------
 * Relie tout ensemble :
 *   - lit le clavier et envoie les ordres au jeu (game.js),
 *   - réagit aux événements du jeu en jouant sons (sound.js) et effets (renderer.js),
 *   - met à jour l'affichage (score, lignes, temps…) et les écrans (menu, pause, victoire).
 * ===================================================================== */

/* --- Raccourcis vers les éléments de la page ------------------------- */
const $ = id => document.getElementById(id);
const ui = {
  score: $('score'), lines: $('lines'), target: $('target'), level: $('level'),
  time: $('time'), progress: $('progress'),
  overlay: $('overlay'), picker: $('target-picker'), bestStart: $('best-start'),
  winTime: $('win-time'), winRecord: $('win-record'), winScore: $('win-score'),
  winLines: $('win-lines'), winBest: $('win-best'),
  overLines: $('over-lines'), overTime: $('over-time'),
  soundToggle: $('sound-toggle'),
};

const sound = new Sound();
const renderer = new Renderer($('board'), $('next'));
const game = new Game(handleGameEvent);

let target = loadNumber('tetris.target', CONFIG.DEFAULT_TARGET);
if (!CONFIG.TARGET_OPTIONS.includes(target)) target = CONFIG.DEFAULT_TARGET;

/* ---------------------------------------------------------------------
 * Petits utilitaires
 * --------------------------------------------------------------------- */

/** Formate un temps en ms → "m:ss.d" (ou "m:ss.cc" avec precise = true). */
function formatTime(ms, precise = false) {
  const totalCs = Math.floor(ms / 10);
  const m = Math.floor(totalCs / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  const frac = precise ? String(cs).padStart(2, '0') : Math.floor(cs / 10);
  return `${m}:${String(s).padStart(2, '0')}.${frac}`;
}

const formatScore = n => n.toLocaleString('fr-CH');

function loadNumber(key, fallback) {
  try {
    const v = parseFloat(localStorage.getItem(key));
    return Number.isFinite(v) ? v : fallback;
  } catch (e) { return fallback; }
}

function saveNumber(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) { /* stockage indisponible */ }
}

const bestKey = t => `tetris.best.${t}`;

/** Petite pulsation CSS sur un élément (ex. quand le score change). */
function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth; // force le navigateur à relancer l'animation
  el.classList.add('bump');
}

/* ---------------------------------------------------------------------
 * Écrans superposés (menu, pause, victoire, défaite)
 * --------------------------------------------------------------------- */

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (name) {
    $(`screen-${name}`).classList.add('active');
    ui.overlay.classList.add('visible');
  } else {
    ui.overlay.classList.remove('visible');
  }
}

/** Boutons de choix de l'objectif (10 / 20 / 40 lignes). */
function buildTargetPicker() {
  ui.picker.innerHTML = '';
  CONFIG.TARGET_OPTIONS.forEach(n => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${n} lignes`;
    b.className = n === target ? 'selected' : '';
    b.addEventListener('click', () => {
      target = n;
      saveNumber('tetris.target', n);
      buildTargetPicker();
    });
    ui.picker.appendChild(b);
  });
  const best = loadNumber(bestKey(target), null);
  ui.bestStart.textContent = best ? `Record : ${formatTime(best, true)}` : 'Pas encore de record';
  ui.target.textContent = target;
}

function showMenu() {
  game.state = 'idle';
  game.piece = null;
  renderer.clearEffects();
  buildTargetPicker();
  showScreen('start');
}

function startGame() {
  sound.unlock();
  renderer.clearEffects();
  resetInput();
  game.start(target);
  showScreen(null);
}

function updateSoundButton() {
  ui.soundToggle.textContent = sound.enabled ? '🔊  Son activé' : '🔇  Son coupé';
  ui.soundToggle.classList.toggle('off', !sound.enabled);
}

function toggleSound() {
  sound.unlock();
  sound.toggle();
  updateSoundButton();
}

/* ---------------------------------------------------------------------
 * Réactions aux événements du jeu → sons + effets + interface
 * --------------------------------------------------------------------- */

function handleGameEvent(name, data) {
  switch (name) {
    case 'rotate':
      sound.play('rotate');
      break;

    case 'hardDrop':
      renderer.onHardDrop(data);
      sound.play('hardDrop');
      break;

    case 'lock':
      renderer.onLock(data.cells, data.hard);
      if (!data.hard) sound.play('lock'); // le hard drop a déjà son propre son
      break;

    case 'lines':
      renderer.onLines(data);
      sound.play('lines', data.count);
      bump(ui.lines);
      bump(ui.score);
      break;

    case 'levelup':
      sound.play('levelup');
      bump(ui.level);
      break;

    case 'pause':
      showScreen(data.paused ? 'pause' : null);
      if (!data.paused) resetInput();
      break;

    case 'win': {
      sound.play('victory');
      const previous = loadNumber(bestKey(game.target), null);
      const isRecord = !previous || data.time < previous;
      if (isRecord) saveNumber(bestKey(game.target), data.time);
      ui.winTime.textContent = formatTime(data.time, true);
      ui.winRecord.style.visibility = isRecord ? 'visible' : 'hidden';
      ui.winScore.textContent = formatScore(data.score);
      ui.winLines.textContent = data.lines;
      ui.winBest.textContent = formatTime(isRecord ? data.time : previous, true);
      // Petite attente pour laisser voir le dernier flash de ligne
      setTimeout(() => showScreen('win'), 250);
      break;
    }

    case 'gameover':
      sound.play('gameover');
      ui.overLines.textContent = data.lines;
      ui.overTime.textContent = formatTime(data.time);
      setTimeout(() => showScreen('over'), 300);
      break;
  }
}

/* ---------------------------------------------------------------------
 * Clavier
 * ---------------------------------------------------------------------
 * Pour ← et →, on gère nous-mêmes la répétition (DAS/ARR) plutôt que
 * d'utiliser la répétition du système : c'est plus réactif et régulier.
 * --------------------------------------------------------------------- */

const input = {
  left: false,
  right: false,
  dir: 0,        // direction actuellement répétée (-1, 0, 1)
  dasTimer: 0,   // temps depuis l'appui
  arrTimer: 0,   // temps depuis la dernière répétition
};

function resetInput() {
  input.left = input.right = false;
  input.dir = 0;
  game.setSoftDrop(false);
}

function pressHorizontal(dir) {
  input.dir = dir;
  input.dasTimer = 0;
  input.arrTimer = CONFIG.ARR; // → répétition immédiate dès que le DAS est atteint
  game.move(dir);
}

function releaseHorizontal() {
  // Si l'autre flèche est encore enfoncée, on repart dans sa direction
  input.dir = input.left ? -1 : input.right ? 1 : 0;
  input.dasTimer = 0;
  input.arrTimer = CONFIG.ARR;
}

function updateInput(dt) {
  if (game.state !== 'playing' || input.dir === 0) return;
  input.dasTimer += dt;
  if (input.dasTimer < CONFIG.DAS) return;
  input.arrTimer += dt;
  while (input.arrTimer >= CONFIG.ARR) {
    input.arrTimer -= CONFIG.ARR;
    if (!game.move(input.dir)) { input.arrTimer = 0; break; }
  }
}

// Touches dont on empêche le comportement par défaut (défilement de la page)
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];

document.addEventListener('keydown', e => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  sound.unlock();

  // --- Touches valables partout
  if (e.code === 'KeyM') { toggleSound(); return; }

  // --- Menu / fin de partie
  if (game.state === 'idle' || game.state === 'won' || game.state === 'over') {
    if (e.code === 'Enter' || e.code === 'Space') startGame();
    if (e.code === 'Escape' && game.state !== 'idle') showMenu();
    return;
  }

  // --- Pause
  if (game.state === 'paused') {
    if (e.code === 'KeyP' || e.code === 'Enter') game.togglePause();
    if (e.code === 'Escape') showMenu();
    return;
  }

  // --- En jeu
  if (e.repeat && e.code !== 'ArrowUp') return; // on gère la répétition nous-mêmes
  switch (e.code) {
    case 'ArrowLeft':  input.left = true;  pressHorizontal(-1); break;
    case 'ArrowRight': input.right = true; pressHorizontal(1); break;
    case 'ArrowDown':  game.setSoftDrop(true); break;
    case 'ArrowUp':
    case 'KeyX':       if (!e.repeat) game.rotate(1); break;
    case 'KeyZ':
    case 'KeyY':       game.rotate(-1); break; // Y aussi, pour les claviers suisses/allemands (QWERTZ)
    case 'Space':      game.hardDrop(); break;
    case 'KeyP':
    case 'Escape':     game.togglePause(); break;
  }
});

document.addEventListener('keyup', e => {
  switch (e.code) {
    case 'ArrowLeft':  input.left = false;  if (input.dir === -1) releaseHorizontal(); break;
    case 'ArrowRight': input.right = false; if (input.dir === 1) releaseHorizontal(); break;
    case 'ArrowDown':  game.setSoftDrop(false); break;
  }
});

// Mise en pause automatique si on change de fenêtre/onglet
window.addEventListener('blur', () => {
  if (game.state === 'playing') game.togglePause();
  resetInput();
});

/* --- Boutons à la souris --------------------------------------------- */
$('btn-start').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', () => game.togglePause());
document.querySelectorAll('[data-action="restart"]').forEach(b => b.addEventListener('click', startGame));
document.querySelectorAll('[data-action="menu"]').forEach(b => b.addEventListener('click', showMenu));
ui.soundToggle.addEventListener('click', e => { toggleSound(); e.currentTarget.blur(); });

/* ---------------------------------------------------------------------
 * Affichage des statistiques (seulement si la valeur a changé)
 * --------------------------------------------------------------------- */

const shown = {};
function setText(el, key, value) {
  if (shown[key] !== value) {
    shown[key] = value;
    el.textContent = value;
  }
}

function updateHud() {
  const playing = game.state !== 'idle';
  const lines = playing ? game.lines : 0;
  const tgt = playing ? game.target : target;
  setText(ui.score, 'score', formatScore(playing ? game.score : 0));
  setText(ui.lines, 'lines', String(lines));
  setText(ui.target, 'target', String(tgt));
  setText(ui.level, 'level', String(playing ? game.level : 1));
  setText(ui.time, 'time', formatTime(playing ? game.elapsed : 0));
  const pct = `${Math.min(100, (lines / tgt) * 100)}%`;
  if (shown.progress !== pct) {
    shown.progress = pct;
    ui.progress.style.width = pct;
  }
}

/* ---------------------------------------------------------------------
 * Boucle principale : ~60 fois par seconde
 * --------------------------------------------------------------------- */

let lastTime = performance.now();

function frame(now) {
  // dt limité : si l'onglet était en arrière-plan, on ne "rattrape" pas des secondes
  const dt = Math.min(now - lastTime, 50);
  lastTime = now;

  updateInput(dt);
  game.update(dt);

  renderer.draw(game);
  renderer.drawNext(game.state === 'idle' ? null : game.nextType);
  updateHud();

  requestAnimationFrame(frame);
}

/* --- Lancement ------------------------------------------------------- */
window.addEventListener('resize', () => renderer.resize());
renderer.resize();
updateSoundButton();
showMenu();
requestAnimationFrame(frame);
