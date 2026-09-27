/* =====================================================================
 * sound.js — Petits sons synthétisés (aucun fichier audio à charger).
 * ---------------------------------------------------------------------
 * On utilise la Web Audio API : chaque son est une note courte générée
 * par un oscillateur, avec une enveloppe douce (attaque rapide, fondu)
 * pour éviter les "clics" et les sons criards.
 *
 * Pour changer un son : modifie la fréquence (Hz), la durée (s),
 * la forme d'onde ('sine' = doux, 'triangle' = rond, 'square' = rétro)
 * ou le volume dans la méthode correspondante plus bas.
 * ===================================================================== */

class Sound {
  constructor() {
    this.ctx = null;       // créé au premier clic/touche (règle des navigateurs)
    this.master = null;
    this.enabled = this.loadPreference();
  }

  /** Les navigateurs exigent une action de l'utilisateur avant de jouer du son. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return; // navigateur sans audio : on reste silencieux
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = CONFIG.SOUND_VOLUME;
    this.master.connect(this.ctx.destination);
  }

  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem('tetris.sound', this.enabled ? 'on' : 'off'); } catch (e) { /* stockage indisponible */ }
    return this.enabled;
  }

  loadPreference() {
    try { return localStorage.getItem('tetris.sound') !== 'off'; } catch (e) { return true; }
  }

  /* ------------------------------------------------------------------
   * Briques de base
   * ------------------------------------------------------------------ */

  /**
   * Joue une note.
   * @param {number} freq    fréquence de départ (Hz)
   * @param {number} dur     durée (secondes)
   * @param {object} opts    type d'onde, volume, fréquence d'arrivée (glissando), délai
   */
  tone(freq, dur, { type = 'sine', vol = 0.2, slideTo = null, delay = 0 } = {}) {
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    // Enveloppe : montée en 5 ms, puis fondu exponentiel jusqu'au silence
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Bref souffle filtré (bruit blanc adouci), utilisé pour le "thud" du hard drop. */
  noise(dur, { vol = 0.1, cutoff = 600 } = {}) {
    const t0 = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  /* ------------------------------------------------------------------
   * Les sons du jeu
   * ------------------------------------------------------------------ */

  play(name, arg) {
    if (!this.enabled || !this.ctx) return;
    switch (name) {
      case 'rotate':   // petit "tic" aigu et léger
        this.tone(720, 0.05, { type: 'triangle', vol: 0.12, slideTo: 860 });
        break;

      case 'lock':     // "toc" grave et court
        this.tone(200, 0.08, { type: 'triangle', vol: 0.2, slideTo: 140 });
        break;

      case 'hardDrop': // impact sourd : note qui plonge + souffle
        this.tone(160, 0.12, { type: 'sine', vol: 0.4, slideTo: 55 });
        this.noise(0.06, { vol: 0.12, cutoff: 500 });
        break;

      case 'lines': {  // arpège montant : plus de lignes = plus de notes
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // do mi sol do mi
        const count = Math.min(arg || 1, 4);
        for (let i = 0; i <= count; i++) {
          this.tone(notes[i], 0.14, { type: 'triangle', vol: 0.14, delay: i * 0.045 });
        }
        break;
      }

      case 'levelup':  // deux notes discrètes
        this.tone(880, 0.1, { type: 'sine', vol: 0.1 });
        this.tone(1174.7, 0.16, { type: 'sine', vol: 0.1, delay: 0.08 });
        break;

      case 'victory': { // petite fanfare douce
        const melody = [523.25, 659.25, 783.99, 1046.5];
        melody.forEach((f, i) => {
          const last = i === melody.length - 1;
          this.tone(f, last ? 0.45 : 0.14, { type: 'triangle', vol: 0.16, delay: i * 0.1 });
          if (last) this.tone(f * 1.5, 0.45, { type: 'sine', vol: 0.06, delay: i * 0.1 });
        });
        break;
      }

      case 'gameover': // trois notes descendantes
        [392, 329.6, 261.6].forEach((f, i) => {
          this.tone(f, 0.18, { type: 'triangle', vol: 0.14, delay: i * 0.12 });
        });
        break;
    }
  }
}
