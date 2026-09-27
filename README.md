# Tetris Sprint 🎮

Un Tetris coloré et auto-hébergé, qui tourne entièrement dans le navigateur.
Mode « sprint » : détruis 10, 20 ou 40 lignes le plus vite possible.

Aucune base de données, aucun compte, aucune dépendance à installer : juste des fichiers HTML/CSS/JS servis par nginx.

---

## 🚀 Lancer le jeu

### Avec Docker Compose (le plus simple)

```bash
docker compose up -d --build
```

Puis ouvre **http://localhost:8080**

Pour arrêter : `docker compose down`

### Avec Docker seul

```bash
docker build -t tetris .
docker run -d -p 8080:80 --name tetris tetris
```

### Sans Docker (pour tester vite)

```bash
cd public
python3 -m http.server 8080
```

Tu peux aussi simplement double-cliquer sur `public/index.html`.

---

## 🕹️ Commandes

| Touche            | Action                          |
|-------------------|---------------------------------|
| ← →               | Déplacer                        |
| ↑ (ou X)          | Tourner (sens horaire)          |
| Z (ou Y)          | Tourner (sens inverse)          |
| ↓                 | Chute douce                     |
| Espace            | Chute instantanée (hard drop)   |
| P / Échap         | Pause                           |
| M                 | Couper / remettre le son        |
| Entrée            | Lancer / rejouer                |

Le jeu se met aussi en pause tout seul si tu changes de fenêtre.

---

## 📁 Organisation des fichiers

```
public/
├── index.html      → la structure de la page
├── css/style.css   → l'apparence (couleurs, cartes, boutons)
└── js/
    ├── config.js   → ⭐ TOUS LES RÉGLAGES (commence ici)
    ├── game.js     → la logique pure : pièces, collisions, lignes, score
    ├── sound.js    → les sons, générés en direct (pas de fichiers audio)
    ├── renderer.js → le dessin du plateau et les effets visuels
    └── main.js     → le chef d'orchestre : clavier, écrans, boucle de jeu
Dockerfile          → image nginx qui sert le dossier public/
nginx.conf          → configuration du serveur
docker-compose.yml  → lancement en une commande (port 8080)
```

---

## 🔧 Modifier le jeu facilement

Presque tout se règle dans **`public/js/config.js`** :

| Tu veux…                          | Change…                                  |
|-----------------------------------|------------------------------------------|
| Un autre objectif de lignes       | `TARGET_OPTIONS`, `DEFAULT_TARGET`       |
| Que ça accélère plus/moins vite   | `LINES_PER_LEVEL`                        |
| D'autres couleurs de pièces       | `COLORS`                                 |
| Des animations plus courtes/longues | `ANIM`                                 |
| Un son plus fort ou plus faible   | `SOUND_VOLUME`                           |
| Des déplacements plus réactifs    | `DAS` (délai) et `ARR` (répétition)      |

Autres pistes :
- **Changer un son** → `sound.js`, méthode `play()` : chaque son est une ou deux notes (fréquence, durée, forme d'onde).
- **Changer le fond ou les couleurs de l'interface** → haut de `style.css` (bloc `:root`).
- **Changer le look des blocs** → `renderer.js`, méthode `getSprite()`.

Après une modification avec Docker : `docker compose up -d --build`.

---

## ✨ Ce qui est inclus

- Les 7 tétrominos, rotation officielle « SRS » avec *wall kicks* (la pièce se décale si un mur la gêne)
- Tirage « sac de 7 » : pas de longue attente pour une pièce
- Pièce fantôme (où la pièce va tomber) et aperçu de la pièce suivante
- Vitesse qui augmente d'un niveau toutes les 4 lignes
- Écran de victoire avec le temps, et **record personnel** gardé dans le navigateur (par objectif)
- Effets courts et non bloquants : flash des lignes, retombée fluide des blocs, traînée du hard drop, léger éclat à la pose
- Sons doux pour rotation, pose, hard drop, lignes, montée de niveau, victoire (coupables avec `M`)
