# Chess Local – Vite + React + TypeScript

Un échiquier jouable en local (type chess.com), basé sur **Vite + React + TypeScript**, avec **chess.js** pour les règles et **TailwindCSS** pour le style.

## Lancer le projet
```bash
npm install
npm run dev
```

Puis ouvre l'URL locale affichée (par défaut http://localhost:5173).

## Remplacer les icônes des pièces
Ouvre `src/ChessApp.tsx` et modifie l'objet `PIECE_ASSETS`. Si tu mets un chemin/URL d'image (png/jpg/webp/svg), le rendu se fera via `<img>`. Sinon, c'est le symbole Unicode par défaut.

Exemple :
```ts
PIECE_ASSETS.w.p = "/assets/white_pawn.png";
PIECE_ASSETS.b.k = "/assets/black_king.svg";
```

## Scripts dispo
- `npm run dev` : lance le serveur de dev Vite
- `npm run build` : build de production
- `npm run preview` : prévisualisation locale du build

---

_Stack_: Vite 5, React 18, TypeScript 5, TailwindCSS 3, chess.js 1.x.
