import React, { useMemo, useState } from "react";
import { Chess } from "chess.js";
import type { Color, PieceSymbol, Square, Move, ShortMove } from "chess.js";

const PIECE_ASSETS: Record<Color, Partial<Record<PieceSymbol, string>>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

function PieceIcon({ color, type }: { color: Color; type: PieceSymbol }) {
  const asset = PIECE_ASSETS[color]?.[type];
  if (!asset) return null;
  const isUrl = /\.(png|jpg|jpeg|gif|webp|svg)$/.test(asset) || /\//.test(asset);
  if (isUrl) {
    return (
      <img
        src={asset}
        alt={`${color}${type}`}
        className="w-full h-full object-contain select-none pointer-events-none"
        draggable={false}
      />
    );
  }
  return <span className="text-4xl md:text-5xl select-none leading-none">{asset}</span>;
}

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;
function idxToSquare(fileIdx: number, rankIdx: number): Square {
  return `${files[fileIdx]}${ranks[rankIdx]}` as Square;
}

function SquareCell({
  square,
  isLight,
  isSelected,
  isLegalMove,
  isLastMoveFrom,
  isLastMoveTo,
  piece,
  onClick,
}: {
  square: Square;
  isLight: boolean;
  isSelected: boolean;
  isLegalMove: boolean;
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
  piece: { color: Color; type: PieceSymbol } | null;
  onClick: (sq: Square) => void;
}) {
  const bg = isSelected
    ? "bg-amber-300"
    : isLastMoveFrom || isLastMoveTo
    ? "bg-amber-200"
    : isLight
    ? "bg-stone-200"
    : "bg-stone-500";

  return (
    <button
      onClick={() => onClick(square)}
      className={`relative aspect-square ${bg} flex items-center justify-center hover:outline hover:outline-2 hover:outline-emerald-400 transition-[outline,background] duration-100`}
    >
      {piece && (
        <div className="w-[84%] h-[84%] flex items-center justify-center">
          <PieceIcon color={piece.color} type={piece.type} />
        </div>
      )}
      {isLegalMove && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-3 h-3 rounded-full ${piece ? "bg-emerald-600/80" : "bg-emerald-900/30"}`}></div>
        </div>
      )}
      <div className="absolute left-1 top-1 text-[10px] md:text-xs text-black/60 select-none">
        {(square.endsWith("1") && square[0]) || (square.startsWith("a") && square[1])}
      </div>
    </button>
  );
}

function PromotionDialog({
  color,
  onPick,
}: {
  color: Color;
  onPick: (p: PieceSymbol) => void;
}) {
  const opts: PieceSymbol[] = ["q", "r", "b", "n"];
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-4 shadow-xl w-64">
        <div className="text-center mb-2 font-medium">Promotion</div>
        <div className="grid grid-cols-4 gap-2">
          {opts.map((t) => (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="aspect-square rounded-xl border border-stone-200 hover:border-emerald-500"
              title={t}
            >
              <div className="w-full h-full flex items-center justify-center">
                <PieceIcon color={color} type={t} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChessApp() {
  const [chess] = useState(() => new Chess());
  const [, forceTick] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTo, setLegalTo] = useState<Square[]>([]);
  const [promotionCtx, setPromotionCtx] = useState<{ from: Square; to: Square; color: Color } | null>(null);
  const [history, setHistory] = useState<Move[]>([]);
  const [orientationWhite, setOrientationWhite] = useState(true);

  const gameOver = chess.isGameOver();
  const inCheck = chess.inCheck();
  const turn = chess.turn();

  const last = history[history.length - 1];

  const boardSquares = useMemo(() => {
    const b = chess.board();
    const out: { square: Square; piece: { color: Color; type: PieceSymbol } | null }[] = [];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const rankIdx = orientationWhite ? 7 - r : r;
        const fileIdx = orientationWhite ? f : 7 - f;
        const square = idxToSquare(fileIdx, rankIdx);
        const piece = b[7 - rankIdx][fileIdx];
        out.push({ square, piece: piece ? { color: piece.color as Color, type: piece.type as PieceSymbol } : null });
      }
    }
    return out;
  }, [chess, orientationWhite, history.length]);

  function handleSelect(sq: Square) {
    if (promotionCtx) return;
    const p = chess.get(sq);
    if (selected && legalTo.includes(sq)) {
      const moving = chess.get(selected);
      const isPawn = moving?.type === "p";
      const isToBackRank = (sq.endsWith("8") && moving?.color === "w") || (sq.endsWith("1") && moving?.color === "b");
      if (isPawn && isToBackRank) {
        setPromotionCtx({ from: selected, to: sq, color: moving!.color });
        return;
      }
      doMove({ from: selected, to: sq });
      return;
    }
    if (p && p.color === turn) {
      setSelected(sq);
      const moves = chess.moves({ square: sq, verbose: true }) as Move[];
      setLegalTo(moves.map((m) => m.to as Square));
    } else {
      setSelected(null);
      setLegalTo([]);
    }
  }

  function doMove(m: ShortMove) {
    try {
      const res = chess.move(m);
      if (res) {
        setHistory((h) => [...h, res]);
        setSelected(null);
        setLegalTo([]);
        forceTick((t) => t + 1);
      }
    } catch {}
  }

  function onPromotePick(piece: PieceSymbol) {
    if (!promotionCtx) return;
    doMove({ from: promotionCtx.from, to: promotionCtx.to, promotion: piece });
    setPromotionCtx(null);
  }

  function reset() {
    chess.reset();
    setHistory([]);
    setSelected(null);
    setLegalTo([]);
    setPromotionCtx(null);
    forceTick((t) => t + 1);
  }

  function undo() {
    chess.undo();
    setHistory((h) => h.slice(0, -1));
    setSelected(null);
    setLegalTo([]);
    setPromotionCtx(null);
    forceTick((t) => t + 1);
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start gap-4 p-4 md:p-8 bg-gradient-to-b from-stone-50 to-stone-200">
      <div className="w-full max-w-5xl flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm" >
              {gameOver ? (
                <span className="font-semibold">Partie terminée</span>
              ) : (
                <span>Au tour des <span className="font-semibold">{turn === "w" ? "Blancs" : "Noirs"}</span>{inCheck ? " (échec)" : ""}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setOrientationWhite((o) => !o)} className="px-3 py-1.5 rounded-xl bg-white shadow border hover:bg-stone-50">
                Retourner
              </button>
              <button onClick={undo} className="px-3 py-1.5 rounded-xl bg-white shadow border hover:bg-stone-50">
                Annuler
              </button>
              <button onClick={reset} className="px-3 py-1.5 rounded-xl bg-white shadow border hover:bg-stone-50">
                Réinitialiser
              </button>
            </div>
          </div>
          <div className="grid grid-cols-8 rounded-2xl overflow-hidden shadow-2xl border border-stone-300">
            {boardSquares.map((cell, i) => {
              const fileIdx = i % 8;
              const rankIdx = Math.floor(i / 8);
              const isLight = (fileIdx + rankIdx) % 2 === 0;
              const isSelected = selected === cell.square;
              const isLegalMove = legalTo.includes(cell.square);
              const isLastFrom = last ? last.from === cell.square : false;
              const isLastTo = last ? last.to === cell.square : false;
              return (
                <SquareCell
                  key={cell.square}
                  square={cell.square}
                  isLight={isLight}
                  isSelected={isSelected}
                  isLegalMove={isLegalMove}
                  isLastMoveFrom={isLastFrom}
                  isLastMoveTo={isLastTo}
                  piece={cell.piece}
                  onClick={handleSelect}
                />
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-8 text-center text-xs text-stone-600">
            {(orientationWhite ? files : [...files].reverse()).map((f) => (
              <div key={f}>{f}</div>
            ))}
          </div>
        </div>
        <div className="w-full md:w-80 flex flex-col gap-3">
          <div className="bg-white rounded-2xl shadow border p-3 h-[480px] overflow-auto">
            <div className="mb-2 font-medium">Historique</div>
            <ol className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
              {history.map((m, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-stone-400 w-5 text-right">{Math.floor(idx / 2) + 1}.</span>
                  <span className="truncate">{m.san}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-white rounded-2xl shadow border p-3">
            <div className="font-medium mb-2">Options d'affichage</div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={orientationWhite}
                onChange={(e) => setOrientationWhite(e.target.checked)}
              />
              Vue côté Blancs
            </label>
            <p className="text-xs text-stone-500 mt-2">
              Remplace les icônes des pièces en éditant l'objet <code>PIECE_ASSETS</code> (URL d'image ou Unicode). Dimensions recommandées : images carrées avec fond transparent.
            </p>
          </div>
        </div>
      </div>
      {promotionCtx && (
        <PromotionDialog color={promotionCtx.color} onPick={onPromotePick} />)
      }
      <footer className="text-xs text-stone-500 mt-4">Moteur de règles : chess.js (roques, prise en passant, promotions, échecs & mates pris en charge).</footer>
    </div>
  );
}
