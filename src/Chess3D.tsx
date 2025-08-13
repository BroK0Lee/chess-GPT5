import React, { useMemo, useState, useRef, useCallback } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Html, Environment } from "@react-three/drei";
import { Chess } from "chess.js";
import type { Color, Move, PieceSymbol, ShortMove, Square } from "chess.js";
import * as THREE from "three";

/** Utilitaires coordonnées echiquier */
const files = ["a","b","c","d","e","f","g","h"] as const;
const ranks = ["1","2","3","4","5","6","7","8"] as const;
const toSquare = (fIdx: number, rIdx: number) => `${files[fIdx]}${ranks[rIdx]}` as Square;

/** Couleurs & matériaux */
const colorLight = new THREE.Color("#e7dfcf");
const colorDark  = new THREE.Color("#7b766a");
const colorLegal = new THREE.Color("#22c55e");
const colorSel   = new THREE.Color("#fbbf24");
const whiteMat = new THREE.MeshStandardMaterial({ color: "#f5f5f5", metalness: 0.1, roughness: 0.35 });
const blackMat = new THREE.MeshStandardMaterial({ color: "#1f2937", metalness: 0.1, roughness: 0.4 });

/** Pièces minimalistes en primitives — remplaçables plus tard par des GLTF */
function PieceMesh({ type, color }: { type: PieceSymbol; color: Color }) {
  const mat = color === "w" ? whiteMat : blackMat;

  // On compose rapidement des formes : base cylindre + “tête” simple.
  switch (type) {
    case "p":
      return (
        <group>
          <mesh material={mat} castShadow receiveShadow>
            <cylinderGeometry args={[0.32, 0.36, 0.28, 24]} />
          </mesh>
          <mesh position={[0, 0.28, 0]} material={mat} castShadow>
            <sphereGeometry args={[0.28, 24, 16]} />
          </mesh>
        </group>
      );
    case "r":
      return (
        <group>
          <mesh material={mat} castShadow>
            <cylinderGeometry args={[0.4, 0.42, 0.5, 24]} />
          </mesh>
          <mesh position={[0, 0.36, 0]} material={mat} castShadow>
            <boxGeometry args={[0.55, 0.12, 0.55]} />
          </mesh>
        </group>
      );
    case "n":
      return (
        <group>
          <mesh material={mat} castShadow>
            <cylinderGeometry args={[0.38, 0.4, 0.45, 24]} />
          </mesh>
          <mesh position={[0, 0.45, -0.05]} rotation={[0, 0, 0.15]} material={mat} castShadow>
            <boxGeometry args={[0.20, 0.35, 0.40]} />
          </mesh>
        </group>
      );
    case "b":
      return (
        <group>
          <mesh material={mat} castShadow>
            <cylinderGeometry args={[0.35, 0.38, 0.5, 24]} />
          </mesh>
          <mesh position={[0, 0.45, 0]} material={mat} castShadow>
            <coneGeometry args={[0.30, 0.35, 24]} />
          </mesh>
        </group>
      );
    case "q":
      return (
        <group>
          <mesh material={mat} castShadow>
            <cylinderGeometry args={[0.45, 0.48, 0.55, 24]} />
          </mesh>
          <mesh position={[0, 0.52, 0]} material={mat} castShadow>
            <sphereGeometry args={[0.25, 24, 16]} />
          </mesh>
          <mesh position={[0, 0.78, 0]} material={mat} castShadow>
            <torusGeometry args={[0.22, 0.06, 12, 24]} />
          </mesh>
        </group>
      );
    case "k":
      return (
        <group>
          <mesh material={mat} castShadow>
            <cylinderGeometry args={[0.45, 0.5, 0.6, 24]} />
          </mesh>
          <mesh position={[0, 0.65, 0]} material={mat} castShadow>
            <sphereGeometry args={[0.22, 24, 16]} />
          </mesh>
          <mesh position={[0, 0.92, 0]} material={mat} castShadow>
            <boxGeometry args={[0.06, 0.25, 0.06]} />
          </mesh>
          <mesh position={[0, 1.02, 0]} rotation={[0, 0, Math.PI/2]} material={mat} castShadow>
            <boxGeometry args={[0.06, 0.18, 0.06]} />
          </mesh>
        </group>
      );
  }
}

/** Case de l’échiquier (XZ) */
function SquareTile({
  x, z, isLight, isSelected, isLast, onClick
}: {
  x: number; z: number; isLight: boolean; isSelected: boolean; isLast: boolean;
  onClick: (x: number, z: number) => void;
}) {
  const color = isSelected ? colorSel : (isLight ? colorLight : colorDark);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 }), [color]);
  return (
    <mesh
      position={[x, 0, z]}
      rotation={[-Math.PI/2, 0, 0]}
      receiveShadow
      onPointerDown={(e) => { e.stopPropagation(); onClick(x, z); }}
    >
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial attach="material" {...mat} />
      {isLast && (
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <ringGeometry args={[0.42, 0.48, 32]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.9} />
        </mesh>
      )}
    </mesh>
  );
}

/** Indicateur de coup légal */
function LegalDot({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.02, z]} rotation={[-Math.PI/2, 0, 0]}>
      <circleGeometry args={[0.12, 20]} />
      <meshBasicMaterial color={colorLegal} transparent opacity={0.8} />
    </mesh>
  );
}

/** Ui promotion (HTML overlay) */
function PromotionPicker({
  color, onPick
}: { color: Color; onPick: (p: PieceSymbol) => void }) {
  const opts: PieceSymbol[] = ["q","r","b","n"];
  return (
    <Html center>
      <div style={{
        background: "white", borderRadius: 12, padding: 12,
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)", display: "flex", gap: 8
      }}>
        {opts.map(o => (
          <button
            key={o}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
            onClick={() => onPick(o)}
            title={`Promouvoir en ${o.toUpperCase()}`}
          >
            <span style={{fontWeight:600, color: color==="w"?"#111":"#111"}}>{o.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </Html>
  );
}

/** Plateau + pièces + règles chess.js */
function ChessWorld() {
  const [chess] = useState(() => new Chess());
  const [, tick] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTo, setLegalTo] = useState<Square[]>([]);
  const [history, setHistory] = useState<Move[]>([]);
  const last = history[history.length - 1];

  const [promotionCtx, setPromotionCtx] = useState<{from: Square; to: Square; color: Color} | null>(null);

  // Rendu des cases et pièces (orientation côté Blancs: x = file 0..7, z = rank 0..7)
  const board = useMemo(() => chess.board(), [tick]); // 8x8 de haut en bas

  const toSq = useCallback((x: number, z: number): Square => toSquare(x, z), []);

  const handleSquareClick = (x: number, z: number) => {
    if (promotionCtx) return;
    const sq = toSq(x, z);
    // Si clic sur une destination légale depuis selected → jouer
    if (selected && legalTo.includes(sq)) {
      const moving = chess.get(selected);
      const pawn = moving?.type === "p";
      const backRank = (z === 7 && moving?.color === "w") || (z === 0 && moving?.color === "b");
      if (pawn && backRank) {
        setPromotionCtx({ from: selected, to: sq, color: moving!.color });
        return;
      }
      doMove({ from: selected, to: sq });
      return;
    }
    // Sinon, (ré)sélection si la pièce est du trait
    const p = chess.get(sq);
    if (p && p.color === chess.turn()) {
      setSelected(sq);
      const moves = chess.moves({ square: sq, verbose: true }) as Move[];
      setLegalTo(moves.map(m => m.to as Square));
    } else {
      setSelected(null);
      setLegalTo([]);
    }
  };

  function doMove(m: ShortMove) {
    const res = chess.move(m);
    if (res) {
      setHistory(h => [...h, res]);
      setSelected(null);
      setLegalTo([]);
      tick(t => t + 1);
    }
  }

  function onPromotePick(piece: PieceSymbol) {
    if (!promotionCtx) return;
    doMove({ from: promotionCtx.from, to: promotionCtx.to, promotion: piece });
    setPromotionCtx(null);
  }

  function undo() {
    chess.undo();
    setHistory(h => h.slice(0, -1));
    setSelected(null);
    setLegalTo([]);
    setPromotionCtx(null);
    tick(t => t + 1);
  }

  function reset() {
    chess.reset();
    setHistory([]);
    setSelected(null);
    setLegalTo([]);
    setPromotionCtx(null);
    tick(t => t + 1);
  }

  // Aide: marqueurs case dernière origine/destination
  const lastFrom = last?.from;
  const lastTo = last?.to;

  return (
    <>
      {/* Échiquier 8x8 (cases de 1x1), centré visuellement autour de 3.5,0,3.5 */}
      <group position={[-3.5, 0, -3.5]}>
        {Array.from({ length: 8 }).map((_, rz) =>
          Array.from({ length: 8 }).map((__, fx) => {
            const square = toSq(fx, rz);
            const isLight = (fx + rz) % 2 === 0;
            const isSelected = selected === square;
            const isLast = square === lastFrom || square === lastTo;
            return (
              <SquareTile
                key={`sq-${fx}-${rz}`}
                x={fx}
                z={rz}
                isLight={isLight}
                isSelected={isSelected}
                isLast={isLast}
                onClick={handleSquareClick}
              />
            );
          })
        )}

        {/* Points de coups légaux */}
        {selected && legalTo.map((sq) => {
          const fx = files.indexOf(sq[0] as typeof files[number]);
          const rz = ranks.indexOf(sq[1] as typeof ranks[number]);
          return <LegalDot key={`ld-${sq}`} x={fx} z={rz} />;
        })}

        {/* Pièces */}
        {board.map((rank, rIdxFromTop) =>
          rank.map((p, fIdx) => {
            if (!p) return null;
            // chess.board() renvoie rang 8->1 (haut->bas). On mappe vers z 7->0:
            const rz = 7 - rIdxFromTop;
            const x = fIdx, z = rz;
            return (
              <group key={`piece-${x}-${z}-${p.type}-${p.color}`} position={[x, 0.5, z]} onPointerDown={(e) => {
                e.stopPropagation();
                handleSquareClick(x, z); // cliquer une pièce = sélectionner sa case
              }}>
                <PieceMesh type={p.type as PieceSymbol} color={p.color as Color} />
              </group>
            );
          })
        )}
      </group>

      {/* Lumières & sol (ombres de contact) */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} blur={2.8} far={10} resolution={1024} />

      {/* Environnement doux */}
      <Environment preset="city" />

      {/* Contrôles caméra */}
      <OrbitControls makeDefault target={[0, 0.3, 0]} />
      
      {/* UI simple (HTML) */}
      <Html position={[-5.2, 2.8, 0]} transform occlude>
        <div style={{ background: "rgba(255,255,255,0.9)", padding: 10, borderRadius: 12, boxShadow: "0 6px 18px rgba(0,0,0,0.2)" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Tour : {chess.turn() === "w" ? "Blancs" : "Noirs"} {chess.inCheck() ? " (échec)" : ""}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={undo}>Annuler</button>
            <button onClick={reset}>Réinitialiser</button>
          </div>
        </div>
      </Html>

      {/* Promotion */}
      {promotionCtx && <PromotionPicker color={promotionCtx.color} onPick={onPromotePick} />}
    </>
  );
}

/** Scène */
export default function Chess3D() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Canvas
        shadows
        camera={{ position: [7.5, 8, 10], fov: 45, near: 0.1, far: 100 }}
      >
        <ChessWorld />
      </Canvas>
    </div>
  );
}
