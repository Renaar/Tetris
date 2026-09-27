/* =====================================================================
 * editor.js — L'éditeur de pièces du mode Pentominos Lab.
 * ---------------------------------------------------------------------
 * L'élève :
 *   1. choisit (ou crée) un set,
 *   2. dessine une pièce sur une grille 5×5 (clic ou glisser),
 *   3. choisit une couleur,
 *   4. voit les 4 rotations calculées en direct,
 *   5. ajoute la pièce au set (seulement si elle est valide).
 *
 * Toutes les vérifications (5 cases, cases reliées par un côté) sont
 * dans pentominos.js. Ici, on ne fait que l'interface.
 * ===================================================================== */

class Editor {
  /**
   * @param {Renderer} renderer  pour dessiner les miniatures avec le même style que le jeu
   * @param {(setId: string|null) => void} onClose  appelé au retour vers le menu
   */
  constructor(renderer, onClose) {
    this.renderer = renderer;
    this.onClose = onClose;
    this.el = id => document.getElementById(id);
    this.section = this.el('editor');

    this.sets = [];
    this.setId = null;         // set affiché
    this.cells = new Set();    // cases dessinées, sous la forme "ligne,colonne"
    this.color = CONFIG.LAB_COLORS[0];
    this.editingId = null;     // id de la pièce en cours de modification (null = nouvelle pièce)

    this.buildGrid();
    this.buildColors();
    this.buildRotationSlots();
    this.bindButtons();
  }

  /* ------------------------------------------------------------------
   * Ouvrir / fermer
   * ------------------------------------------------------------------ */

  open(setId) {
    this.sets = loadSets();
    if (this.sets.length === 0) this.createSet();
    this.setId = this.sets.some(s => s.id === setId) ? setId : this.sets[0].id;
    this.resetDrawing();
    this.section.hidden = false;
    document.getElementById('layout').hidden = true;
    this.renderAll();
  }

  close() {
    this.section.hidden = true;
    document.getElementById('layout').hidden = false;
    this.onClose(this.setId);
  }

  get isOpen() {
    return !this.section.hidden;
  }

  get currentSet() {
    return this.sets.find(s => s.id === this.setId) || null;
  }

  persist() {
    saveSets(this.sets);
  }

  /* ------------------------------------------------------------------
   * Construction de l'interface (une seule fois)
   * ------------------------------------------------------------------ */

  /** La grille 5×5 : on peut cliquer case par case ou "peindre" en glissant. */
  buildGrid() {
    const grid = this.el('ed-grid');
    const size = CONFIG.LAB_GRID;
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    let painting = null; // true = on remplit, false = on efface, null = souris relâchée

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'ed-cell';
        cell.dataset.key = `${r},${c}`;
        cell.addEventListener('pointerdown', e => {
          e.preventDefault();
          painting = !this.cells.has(cell.dataset.key);
          this.setCell(cell.dataset.key, painting);
        });
        cell.addEventListener('pointerenter', () => {
          if (painting !== null) this.setCell(cell.dataset.key, painting);
        });
        grid.appendChild(cell);
      }
    }
    window.addEventListener('pointerup', () => { painting = null; });
  }

  buildColors() {
    const box = this.el('ed-colors');
    CONFIG.LAB_COLORS.forEach(color => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.background = color;
      b.dataset.color = color;
      b.title = color;
      b.addEventListener('click', () => this.setColor(color));
      box.appendChild(b);
    });
    // Sélecteur libre pour n'importe quelle couleur
    const custom = document.createElement('input');
    custom.type = 'color';
    custom.className = 'swatch swatch-custom';
    custom.title = 'Autre couleur…';
    custom.addEventListener('input', () => this.setColor(custom.value));
    box.appendChild(custom);
    this.customColor = custom;
  }

  buildRotationSlots() {
    const box = this.el('ed-rotations');
    this.rotCanvases = ['0°', '90°', '180°', '270°'].map(label => {
      const fig = document.createElement('figure');
      const canvas = document.createElement('canvas');
      const cap = document.createElement('figcaption');
      cap.textContent = label;
      fig.append(canvas, cap);
      box.appendChild(fig);
      return canvas;
    });
  }

  bindButtons() {
    this.el('ed-back').addEventListener('click', () => this.close());
    this.el('ed-clear').addEventListener('click', () => { this.cells.clear(); this.renderDrawing(); });
    this.el('ed-cancel').addEventListener('click', () => { this.resetDrawing(); this.renderAll(); });
    this.el('ed-save').addEventListener('click', () => this.savePiece());

    this.el('ed-set-select').addEventListener('change', e => {
      this.setId = e.target.value;
      this.resetDrawing();
      this.renderAll();
    });
    this.el('ed-set-new').addEventListener('click', () => {
      this.createSet();
      this.resetDrawing();
      this.renderAll();
      this.el('ed-set-name').select();
    });
    this.el('ed-set-delete').addEventListener('click', () => this.deleteSet());
    this.el('ed-set-name').addEventListener('input', e => {
      const set = this.currentSet;
      if (!set) return;
      set.name = e.target.value.trim() || 'Sans nom';
      this.persist();
      this.renderSetSelect();
    });
  }

  /* ------------------------------------------------------------------
   * Actions
   * ------------------------------------------------------------------ */

  setCell(key, filled) {
    if (filled) this.cells.add(key); else this.cells.delete(key);
    this.renderDrawing();
  }

  setColor(color) {
    this.color = color;
    this.renderDrawing();
  }

  /** Remet la grille à zéro, avec une couleur pas encore utilisée dans le set si possible. */
  resetDrawing() {
    this.cells.clear();
    this.editingId = null;
    const used = new Set((this.currentSet?.pieces || []).map(p => p.color));
    this.color = CONFIG.LAB_COLORS.find(c => !used.has(c)) || CONFIG.LAB_COLORS[0];
  }

  createSet() {
    let n = this.sets.length + 1;
    while (this.sets.some(s => s.name === `Mon set ${n}`)) n++;
    const set = { id: makeId('set'), name: `Mon set ${n}`, pieces: [] };
    this.sets.push(set);
    this.setId = set.id;
    this.persist();
  }

  deleteSet() {
    const set = this.currentSet;
    if (!set) return;
    if (!confirm(`Supprimer le set « ${set.name} » et ses ${set.pieces.length} pièce(s) ?`)) return;
    this.sets = this.sets.filter(s => s.id !== set.id);
    if (this.sets.length === 0) this.createSet();
    this.setId = this.sets[0].id;
    this.persist();
    this.resetDrawing();
    this.renderAll();
  }

  /** Cases dessinées sous forme de liste [[ligne, colonne], …]. */
  cellList() {
    return [...this.cells].map(k => k.split(',').map(Number));
  }

  savePiece() {
    const set = this.currentSet;
    const cells = this.cellList();
    if (!set || !validateShape(cells).ok) return;

    const piece = { id: this.editingId || makeId('p'), cells: normalizeShape(cells), color: this.color };
    if (this.editingId) {
      const i = set.pieces.findIndex(p => p.id === this.editingId);
      set.pieces[i] = piece;
    } else {
      if (set.pieces.length >= CONFIG.LAB_MAX_PIECES_PER_SET) return;
      set.pieces.push(piece);
    }
    this.persist();
    this.resetDrawing();
    this.renderAll();
  }

  editPiece(piece) {
    this.editingId = piece.id;
    this.cells = new Set(piece.cells.map(([r, c]) => `${r},${c}`));
    this.color = piece.color;
    this.renderAll();
  }

  deletePiece(piece) {
    const set = this.currentSet;
    set.pieces = set.pieces.filter(p => p.id !== piece.id);
    if (this.editingId === piece.id) this.resetDrawing();
    this.persist();
    this.renderAll();
  }

  /* ------------------------------------------------------------------
   * Affichage
   * ------------------------------------------------------------------ */

  renderAll() {
    this.renderSetSelect();
    this.el('ed-set-name').value = this.currentSet ? this.currentSet.name : '';
    this.renderPieces();
    this.renderDrawing();
  }

  renderSetSelect() {
    const select = this.el('ed-set-select');
    select.innerHTML = '';
    this.sets.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = `${s.name} (${s.pieces.length})`;
      select.appendChild(o);
    });
    select.value = this.setId;
  }

  /** Miniatures des pièces du set, avec un bouton × pour supprimer. */
  renderPieces() {
    const box = this.el('ed-pieces');
    const set = this.currentSet;
    box.innerHTML = '';
    const pieces = set ? set.pieces : [];
    this.el('ed-piece-count').textContent = `${pieces.length} / ${CONFIG.LAB_MAX_PIECES_PER_SET}`;

    if (pieces.length === 0) {
      box.innerHTML = '<p class="hint">Aucune pièce pour l\'instant : dessine-en une !</p>';
      return;
    }
    pieces.forEach(piece => {
      const item = document.createElement('div');
      item.className = 'ed-piece' + (piece.id === this.editingId ? ' editing' : '');
      item.title = 'Modifier cette pièce';
      const canvas = document.createElement('canvas');
      this.renderer.drawThumbnail(canvas, cellsToMatrix(piece.cells), piece.color, 52, 52);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'ed-piece-del';
      del.textContent = '×';
      del.title = 'Supprimer';
      del.addEventListener('click', e => { e.stopPropagation(); this.deletePiece(piece); });
      item.addEventListener('click', () => this.editPiece(piece));
      item.append(canvas, del);
      box.appendChild(item);
    });
  }

  /** Grille + message de validation + couleurs + rotations + bouton d'enregistrement. */
  renderDrawing() {
    // Grille
    this.el('ed-grid').querySelectorAll('.ed-cell').forEach(cell => {
      const on = this.cells.has(cell.dataset.key);
      cell.classList.toggle('on', on);
      cell.style.background = on ? this.color : '';
    });

    // Couleur sélectionnée
    this.el('ed-colors').querySelectorAll('.swatch[data-color]').forEach(s => {
      s.classList.toggle('selected', s.dataset.color === this.color);
    });
    this.customColor.classList.toggle('selected', !CONFIG.LAB_COLORS.includes(this.color));
    this.customColor.value = this.color;

    // Validation
    const cells = this.cellList();
    const status = this.el('ed-status');
    const result = validateShape(cells);
    const set = this.currentSet;
    const others = set ? set.pieces.filter(p => p.id !== this.editingId) : [];
    const full = !this.editingId && others.length >= CONFIG.LAB_MAX_PIECES_PER_SET;

    if (cells.length === 0) {
      status.className = 'ed-status';
      status.textContent = `Clique ou glisse sur la grille pour dessiner ${CONFIG.LAB_PIECE_SIZE} cases.`;
    } else if (!result.ok) {
      status.className = 'ed-status error';
      status.textContent = result.error;
    } else if (full) {
      status.className = 'ed-status error';
      status.textContent = `Ce set est plein (${CONFIG.LAB_MAX_PIECES_PER_SET} pièces maximum).`;
    } else if (others.some(p => sameShape(p.cells, cells))) {
      status.className = 'ed-status warn';
      status.textContent = '✓ Valide, mais cette forme existe déjà dans le set (en la tournant).';
    } else {
      status.className = 'ed-status ok';
      status.textContent = '✓ Pentomino valide !';
    }

    // Titre et bouton
    this.el('ed-draw-title').textContent = this.editingId ? 'Modifier la pièce' : 'Nouvelle pièce';
    const save = this.el('ed-save');
    save.textContent = this.editingId ? 'Enregistrer' : 'Ajouter au set';
    save.disabled = !result.ok || full || !set;
    this.el('ed-cancel').hidden = !this.editingId;

    // Rotations (affichées en direct, même pendant le dessin)
    const rotations = cells.length ? shapeRotations(cells) : [null, null, null, null];
    this.rotCanvases.forEach((canvas, i) => {
      this.renderer.drawThumbnail(canvas, rotations[i], this.color, 76, 76);
    });
  }
}
