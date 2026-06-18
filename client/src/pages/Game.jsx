import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useApi } from "../hooks/useApi";
import { getSocket, useSocket } from "../hooks/useSocket";

const drag = { card: null, fromZone: null, bfIndex: null };

// ── Lobby ─────────────────────────────────────────────────────────────────────
function Lobby({ onJoined }) {
  const { user } = useAuth();
  const [mode, setMode] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  useSocket({ "game:joined": ({ code, room }) => onJoined(code, room), "game:error": setError });
  const create = (solo = false) => { setError(""); getSocket().emit("game:create", { userId: user.id, solo }); };
  const join = (e) => {
    e.preventDefault();
    if (code.trim().length !== 4) return setError("Code de 4 caractères requis");
    setError(""); getSocket().emit("game:join", { code: code.trim().toUpperCase(), userId: user.id });
  };
  return (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-white text-center">Jouer une partie</h1>
        {!mode && (
          <div className="space-y-3">
            <button onClick={() => create(false)} className="btn-primary w-full">Créer une partie</button>
            <button onClick={() => setMode("join")} className="btn-ghost w-full">Rejoindre avec un code</button>
            <button onClick={() => create(true)} className="btn-ghost w-full text-gray-500">🧪 Mode solo (test)</button>
          </div>
        )}
        {mode === "join" && (
          <form onSubmit={join} className="space-y-3">
            <input className="input text-center text-2xl tracking-widest uppercase font-bold" maxLength={4}
              placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus />
            <button type="submit" className="btn-primary w-full">Rejoindre</button>
            <button type="button" onClick={() => setMode(null)} className="btn-ghost w-full">Retour</button>
          </form>
        )}
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}

// ── Deck select ───────────────────────────────────────────────────────────────
function DeckSelect({ code, room, mySocketId, onState }) {
  const api = useApi();
  const [decks, setDecks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/decks").then(setDecks).catch(console.error); }, []);
  useSocket({ "game:state": ({ room }) => onState(room), "game:error": setError });
  const me = room.players.find((p) => p.socketId === mySocketId);
  const opp = room.players.find((p) => p.socketId !== mySocketId);
  const confirm = () => { if (!selected) return; setSent(true); getSocket().emit("game:set_deck", { code, deckId: selected }); };
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-6 gap-5">
      <h2 className="text-xl font-bold text-white">Choisis ton deck</h2>
      <div className="flex gap-3 text-sm">
        <div className={`px-4 py-2 rounded-lg ${me?.ready ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-300"}`}>Toi {me?.ready ? "✓" : "…"}</div>
        <div className={`px-4 py-2 rounded-lg ${opp?.ready ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-400"}`}>Adversaire {opp ? (opp.ready ? "✓" : "…") : "en attente…"}</div>
      </div>
      {!sent ? (
        <>
          <div className="w-full max-w-sm space-y-2 max-h-64 overflow-y-auto">
            {decks.map((d) => (
              <button key={d.id} onClick={() => setSelected(d.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${selected === d.id ? "border-yellow-500 bg-yellow-500/10 text-white" : "border-gray-700 text-gray-300 hover:border-gray-500"}`}>
                {d.name} <span className="text-gray-500 text-xs">{d.card_count} cartes</span>
              </button>
            ))}
          </div>
          <button onClick={confirm} disabled={!selected} className="btn-primary w-full max-w-sm">Confirmer</button>
        </>
      ) : <p className="text-gray-400">En attente de l'adversaire…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

// ── Battlefield select ────────────────────────────────────────────────────────
function BattlefieldSelect({ code, room, mySocketId, onState }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  useSocket({ "game:state": ({ room }) => onState(room), "game:error": setError });
  const me = room.players.find((p) => p.socketId === mySocketId);
  const opp = room.players.find((p) => p.socketId !== mySocketId);
  const bfs = me?.battlefields || [];
  const select = (instanceId) => { setSent(true); getSocket().emit("game:select_battlefield", { code, instanceId }); };
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-6 gap-5">
      <h2 className="text-xl font-bold text-white">Choisis ton Battlefield</h2>
      <div className="flex gap-3 text-sm">
        <div className={`px-3 py-1.5 rounded-lg ${me?._bfDone ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-300"}`}>Toi {me?._bfDone ? "✓" : "…"}</div>
        <div className={`px-3 py-1.5 rounded-lg ${opp?._bfDone ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-400"}`}>Adversaire {opp?._bfDone ? "✓" : "…"}</div>
      </div>
      {!sent ? (
        <>
          {bfs.length > 0 && (
            <div className="flex gap-3 flex-wrap justify-center max-w-lg">
              {bfs.map((c) => (
                <div key={c.instanceId} onClick={() => select(c.instanceId)}
                  className="cursor-pointer border-2 border-gray-700 hover:border-yellow-400 rounded-xl overflow-hidden transition-all w-32">
                  {c.image_small
                    ? <img src={c.image_small} alt={c.name} className="w-full aspect-[3.5/2.5] object-cover" />
                    : <div className="w-full aspect-[3.5/2.5] bg-gray-800 flex items-center justify-center text-xs text-gray-500 p-1">{c.name}</div>}
                  <p className="text-xs text-center text-gray-300 p-1 truncate">{c.name}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => select(null)} className="btn-ghost text-sm px-4">
            {bfs.length === 0 ? "Continuer sans Battlefield" : "Passer"}
          </button>
        </>
      ) : <p className="text-gray-400">En attente de l'adversaire…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

// ── Mulligan ──────────────────────────────────────────────────────────────────
function Mulligan({ code, room, mySocketId, onState }) {
  const [toReturn, setToReturn] = useState(new Set());
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  useSocket({ "game:state": ({ room }) => onState(room), "game:error": setError });
  const me = room.players.find((p) => p.socketId === mySocketId);
  const opp = room.players.find((p) => p.socketId !== mySocketId);
  const hand = me?.hand || [];
  const runeHand = me?.runeHand || [];

  const toggle = (id) => setToReturn((s) => {
    const n = new Set(s);
    if (n.has(id)) { n.delete(id); return n; }
    if (n.size >= 2) return s;
    n.add(id); return n;
  });

  const confirm = () => { setSent(true); getSocket().emit("game:mulligan", { code, returnInstanceIds: [...toReturn] }); };

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-4 gap-4 overflow-y-auto">
      <h2 className="text-xl font-bold text-white">Mulligan</h2>
      <p className="text-sm text-gray-400 text-center">
        Sélectionne jusqu'à <span className="text-yellow-400 font-bold">2 cartes</span> à remettre en bas du deck.
        {toReturn.size > 0 ? ` (${toReturn.size} sélectionnée${toReturn.size > 1 ? "s" : ""})` : ""}
      </p>
      <div className="flex gap-2 text-xs">
        <div className={`px-3 py-1 rounded-lg ${me?.mulliganDone ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-300"}`}>Toi {me?.mulliganDone ? "✓" : "…"}</div>
        <div className={`px-3 py-1 rounded-lg ${opp?.mulliganDone ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-400"}`}>Adversaire {opp?.mulliganDone ? "✓" : "…"}</div>
      </div>
      {!sent ? (
        <>
          <div className="flex gap-2 flex-wrap justify-center max-w-2xl">
            {hand.map((card) => {
              const marked = toReturn.has(card.instanceId);
              return (
                <div key={card.instanceId} onClick={() => toggle(card.instanceId)}
                  className={`cursor-pointer border-2 rounded-xl overflow-hidden transition-all w-20 sm:w-24 ${marked ? "border-red-500 opacity-60" : "border-gray-700 hover:border-yellow-400"}`}>
                  {card.image_small
                    ? <img src={card.image_small} alt={card.name} className="w-full aspect-[2.5/3.5] object-cover" draggable={false} />
                    : <div className="w-full aspect-[2.5/3.5] bg-gray-800 flex items-center justify-center text-xs text-gray-500 p-1">{card.name}</div>}
                  <p className="text-[10px] text-center px-1 pb-1 text-gray-400">{marked ? "✗ Retourner" : "✓ Garder"}</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Runes de départ :</span>
            <div className="flex gap-1">
              {runeHand.map((c) => (
                <div key={c.instanceId} className="w-8 h-11 rounded overflow-hidden border border-gray-700">
                  {c.image_small ? <img src={c.image_small} alt={c.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-800" />}
                </div>
              ))}
            </div>
            <span className="text-yellow-400">({runeHand.length})</span>
          </div>
          <button onClick={confirm} className="btn-primary px-8">
            {toReturn.size === 0 ? "Garder ma main" : `Retourner ${toReturn.size} carte${toReturn.size > 1 ? "s" : ""}`}
          </button>
        </>
      ) : <p className="text-gray-400">En attente de l'adversaire…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

// ── Game card ─────────────────────────────────────────────────────────────────
function GameCard({ card, zone, bfIndex = null, isMe, onTap, onLongPress, size = "md" }) {
  const pressTimer = useRef(null);
  const faceDown = card.faceDown;
  const sizeClass = size === "sm" ? "w-9 h-12" : size === "lg" ? "w-16 h-22" : "w-11 h-[60px]";

  const handleDragStart = (e) => {
    drag.card = card; drag.fromZone = zone; drag.bfIndex = bfIndex;
    e.dataTransfer.effectAllowed = "move";
  };
  const startPress = () => { pressTimer.current = setTimeout(() => { clearTimeout(pressTimer.current); pressTimer.current = null; onLongPress?.(card, zone, bfIndex); }, 600); };
  const endPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };
  const handleClick = () => { if (!faceDown && isMe) onTap?.(card, zone, bfIndex); };

  return (
    <div
      draggable={isMe && !faceDown}
      onDragStart={isMe && !faceDown ? handleDragStart : undefined}
      onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
      onTouchStart={startPress} onTouchEnd={endPress}
      onClick={handleClick}
      title={!faceDown ? card.name : undefined}
      className={`relative flex-shrink-0 ${sizeClass} rounded overflow-hidden border cursor-pointer select-none transition-all
        ${card.exhausted ? "border-gray-600 opacity-70" : "border-gray-700 hover:border-yellow-400"}`}
      style={card.exhausted ? { transform: "rotate(90deg)" } : undefined}
    >
      {faceDown ? (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600 text-sm">🂠</div>
      ) : card.image_small ? (
        <img src={card.image_small} alt={card.name} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center p-0.5">
          <span className="text-[6px] text-gray-400 text-center leading-tight">{card.name}</span>
        </div>
      )}
      {!faceDown && card.counters > 0 && (
        <div className="absolute bottom-0.5 right-0.5 bg-yellow-500 text-gray-950 text-[7px] font-bold w-3 h-3 rounded-full flex items-center justify-center">{card.counters}</div>
      )}
      {!faceDown && card.might && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-center text-[7px] text-white leading-tight px-0.5">{card.might}</div>
      )}
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ label, cards = [], onDrop, onCardTap, onCardLongPress, isMe, size = "md", className = "", horizontal = false }) {
  const [over, setOver] = useState(false);
  const handleDragOver = (e) => { e.preventDefault(); setOver(true); };
  const handleDragLeave = () => setOver(false);
  const handleDrop = (e) => { e.preventDefault(); setOver(false); if (drag.card) onDrop?.(drag.card, drag.fromZone, drag.bfIndex); };
  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      className={`${horizontal ? "flex gap-0.5 overflow-x-auto" : "flex flex-wrap gap-0.5"} content-start rounded border transition-colors p-0.5
        ${over ? "border-yellow-400 bg-yellow-400/5" : "border-gray-800/50 bg-black/20"} ${className}`}>
      {label && cards.length === 0 && (
        <span className="text-[8px] text-gray-700 self-center w-full text-center py-0.5">{label}</span>
      )}
      {cards.map((card) => (
        <GameCard key={card.instanceId} card={card} zone={label} isMe={isMe} size={size}
          onTap={onCardTap} onLongPress={onCardLongPress} />
      ))}
    </div>
  );
}

// ── Card menu ─────────────────────────────────────────────────────────────────
function CardMenu({ card, zone, bfIndex, battlefields, onAction, onClose }) {
  const fromHand = zone === "hand";
  const fromChampion = zone === "champion";
  const fromBF = typeof bfIndex === "number";
  const fromRune = zone === "runeHand";

  let actions = [];

  if (fromRune) {
    actions = [
      { label: "Épuiser (→ +1 énergie)", action: { type: "EXHAUST_RUNE", instanceId: card.instanceId } },
      { label: "Recycler (→ +1 énergie domaine)", action: { type: "RECYCLE_RUNE", instanceId: card.instanceId } },
    ];
  } else if (fromHand) {
    actions = [
      { label: "→ Base (jouer unité/gear)", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "field" } },
      { label: "→ Zone Sort", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "spellZone" } },
      { label: "Défausser", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "graveyard" } },
      { label: "Bannir", action: { type: "BANISH", instanceId: card.instanceId } },
    ];
  } else if (fromChampion) {
    actions = [
      { label: "→ Base (déployer champion)", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "field" } },
      ...(battlefields || []).map((bf, i) => ({
        label: `→ Battlefield ${i + 1} (${bf.card?.name || "sans nom"})`,
        action: { type: "MOVE_TO_BF", instanceId: card.instanceId, bfIndex: bf.id },
      })),
    ];
  } else if (fromBF) {
    actions = [
      { label: "Épuiser / Désépuiser", action: { type: "EXHAUST", instanceId: card.instanceId } },
      { label: "→ Base (retraite)", action: { type: "MOVE_FROM_BF", instanceId: card.instanceId, bfIndex } },
      { label: "→ Défausse", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "graveyard" } },
      { label: "+1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: 1 } },
      { label: "-1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: -1 } },
    ];
  } else {
    actions = [
      { label: card.exhausted ? "Désépuiser" : "Épuiser", action: { type: "EXHAUST", instanceId: card.instanceId } },
      ...(battlefields || []).map((bf, i) => ({
        label: `→ Battlefield ${i + 1} (${bf.card?.name || "sans nom"})`,
        action: { type: "MOVE_TO_BF", instanceId: card.instanceId, bfIndex: bf.id },
      })),
      { label: "+1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: 1 } },
      { label: "-1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: -1 } },
      { label: card.hidden ? "Révéler" : "Cacher", action: { type: "HIDE", instanceId: card.instanceId } },
      { label: "→ Main", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "hand" } },
      { label: "→ Défausse", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "graveyard" } },
      { label: "Bannir", action: { type: "BANISH", instanceId: card.instanceId } },
    ];
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl w-full max-w-sm p-2 space-y-0.5 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 pt-1 pb-2">
          {card.image_small && <img src={card.image_small} alt="" className="w-8 h-11 object-cover rounded" />}
          <div>
            <p className="text-xs text-white font-semibold">{card.name || "Carte"}</p>
            {card.might && <p className="text-[10px] text-gray-500">Might : {card.might}</p>}
            {card.energy_cost && <p className="text-[10px] text-blue-400">Coût : {card.energy_cost}</p>}
          </div>
        </div>
        {actions.map((a) => (
          <button key={a.label} onClick={() => { onAction(a.action); onClose(); }}
            className="w-full text-left px-4 py-2 rounded-xl text-sm text-white hover:bg-gray-800 transition-colors">{a.label}</button>
        ))}
        <button onClick={onClose} className="w-full text-center px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-800">Annuler</button>
      </div>
    </div>
  );
}

// ── Écran de fin ──────────────────────────────────────────────────────────────
function EndScreen({ room, mySocketId }) {
  const navigate = useNavigate();
  const me = room.players.find((p) => p.socketId === mySocketId);
  const won = room.winner === me?.playerIndex;
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-6">
      <div className={`text-6xl font-black ${won ? "text-yellow-400" : "text-gray-400"}`}>
        {won ? "Victoire !" : "Défaite"}
      </div>
      <div className="flex gap-8 text-lg text-gray-300">
        {room.players.map((p) => (
          <div key={p.socketId} className="text-center">
            <div className={`text-3xl font-bold ${p.socketId === mySocketId ? "text-yellow-400" : "text-gray-400"}`}>{p.score} pts</div>
            <div className="text-xs text-gray-500">{p.socketId === mySocketId ? "Toi" : "Adversaire"}</div>
          </div>
        ))}
      </div>
      <button onClick={() => navigate("/decks")} className="btn-ghost px-6">Retour aux decks</button>
    </div>
  );
}

// ── Battlefield zone partagée ─────────────────────────────────────────────────
function BattlefieldZone({ bf, myPlayerIndex, isMe, onCardTap, onCardLongPress, onDrop, onResolveCombat }) {
  const [over, setOver] = useState(false);
  const myUnits = bf.units[myPlayerIndex] || [];
  const oppUnits = bf.units[myPlayerIndex === 0 ? 1 : 0] || [];
  const hasCombat = myUnits.length > 0 && oppUnits.length > 0;
  const controller = bf.controller;
  const controlColor = controller === myPlayerIndex ? "border-green-500" : controller !== null ? "border-red-500" : "border-gray-700";

  const handleDragOver = (e) => { e.preventDefault(); setOver(true); };
  const handleDragLeave = () => setOver(false);
  const handleDrop = (e) => { e.preventDefault(); setOver(false); if (drag.card && isMe) onDrop?.(drag.card, drag.fromZone, bf.id); };

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      className={`flex-1 rounded-lg border-2 transition-colors overflow-hidden ${over ? "border-yellow-400 bg-yellow-400/5" : controlColor} bg-black/30`}>
      {/* Header BF */}
      <div className="flex items-center gap-1 px-1 py-0.5 bg-black/40">
        {bf.card?.image_small && (
          <img src={bf.card.image_small} alt={bf.card.name} className="w-10 h-7 object-cover rounded opacity-80" />
        )}
        <span className="text-[9px] text-gray-400 flex-1 truncate">{bf.card?.name || `BF ${bf.id + 1}`}</span>
        {bf.conquered && (
          <span className={`text-[8px] font-bold ${controller === myPlayerIndex ? "text-green-400" : "text-red-400"}`}>
            {controller === myPlayerIndex ? "✓ Conquis" : "✗ Adverse"}
          </span>
        )}
      </div>

      {/* Unités adverses (haut) */}
      <div className="flex flex-wrap gap-0.5 p-0.5 min-h-[36px] border-b border-gray-800/40">
        {oppUnits.map((card) => (
          <GameCard key={card.instanceId} card={card} zone={`bf-opp`} bfIndex={bf.id} isMe={false} size="sm" />
        ))}
        {oppUnits.length === 0 && <span className="text-[7px] text-gray-800 self-center w-full text-center">— adversaire —</span>}
      </div>

      {/* Combat button */}
      {hasCombat && isMe && (
        <div className="flex justify-center py-0.5 bg-red-950/30">
          <button onClick={() => onResolveCombat(bf.id)}
            className="text-[9px] text-red-400 hover:text-red-200 font-bold px-2 py-0.5 rounded bg-red-900/30 hover:bg-red-900/60 transition-colors">
            ⚔️ Résoudre combat
          </button>
        </div>
      )}

      {/* Mes unités (bas) */}
      <div className="flex flex-wrap gap-0.5 p-0.5 min-h-[36px]">
        {myUnits.map((card) => (
          <GameCard key={card.instanceId} card={card} zone={`bf`} bfIndex={bf.id} isMe={isMe} size="sm"
            onTap={onCardTap} onLongPress={onCardLongPress} />
        ))}
        {myUnits.length === 0 && <span className="text-[7px] text-gray-800 self-center w-full text-center">— tes unités —</span>}
      </div>
    </div>
  );
}

// ── Rune row ──────────────────────────────────────────────────────────────────
function RuneRow({ p, isMe, onCardTap, onCardLongPress }) {
  const SLOTS = 6;
  const runes = p?.runeHand || [];
  return (
    <div className="flex items-center gap-1 h-full">
      {/* Pioche rune */}
      <div className="w-9 h-full shrink-0 bg-blue-950/30 border border-blue-900/40 rounded text-[8px] text-blue-500 flex flex-col items-center justify-center gap-0.5">
        <span>🔷</span><span>{p?.runeDeckSize ?? 0}</span>
      </div>
      {/* Emplacements */}
      {Array.from({ length: SLOTS }).map((_, i) => {
        const card = runes[i];
        if (!card) return (
          <div key={i} className="flex-1 h-full min-w-0 rounded border border-dashed border-blue-900/20 bg-blue-950/5" />
        );
        if (!isMe) return (
          <div key={card.instanceId} className="flex-1 h-full min-w-0 rounded overflow-hidden border border-blue-800/30 bg-blue-950/20 flex items-center justify-center">
            <span className="text-[9px] text-blue-700">🔷</span>
          </div>
        );
        return (
          <div key={card.instanceId} className="flex-1 h-full min-w-0 rounded overflow-hidden border border-blue-700/40">
            <GameCard card={card} zone="runeHand" isMe size="sm" onTap={onCardTap} onLongPress={onCardLongPress} />
          </div>
        );
      })}
      {/* Surplus */}
      {runes.slice(SLOTS).map((card) => (
        <div key={card.instanceId} className="w-8 h-full shrink-0 rounded overflow-hidden border border-blue-700/40">
          {isMe ? <GameCard card={card} zone="runeHand" isMe size="sm" onTap={onCardTap} onLongPress={onCardLongPress} /> : <div className="w-full h-full bg-blue-950/20" />}
        </div>
      ))}
    </div>
  );
}

// ── Score badge ───────────────────────────────────────────────────────────────
function ScoreBadge({ score, isMe }) {
  const pct = Math.min(score / 8, 1);
  return (
    <div className={`flex items-center gap-1 ${isMe ? "flex-row" : "flex-row-reverse"}`}>
      <div className={`text-lg font-black ${isMe ? "text-yellow-400" : "text-gray-400"}`}>{score}</div>
      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${isMe ? "bg-yellow-500" : "bg-gray-500"}`} style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="text-[9px] text-gray-600">/8</div>
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────────────────────
function Board({ room: initialRoom, mySocketId, code }) {
  const [room, setRoom] = useState(initialRoom);
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState("");

  useSocket({
    "game:state": ({ room }) => setRoom(room),
    "game:error": (msg) => { setError(msg); setTimeout(() => setError(""), 3000); },
    "game:opponent_left": () => setError("L'adversaire a quitté la partie."),
  });

  const me = room.players.find((p) => p.socketId === mySocketId);
  const opp = room.players.find((p) => p.socketId !== mySocketId);
  const myIdx = me?.playerIndex ?? 0;
  const send = useCallback((action) => getSocket().emit("game:action", { code, action }), [code]);

  if (room.phase === "ended") return <EndScreen room={room} mySocketId={mySocketId} />;

  const onCardTap = (card, zone, bfIndex) => {
    // Click simple sur rune = épuiser pour énergie
    if (zone === "runeHand") { send({ type: "EXHAUST_RUNE", instanceId: card.instanceId }); return; }
    // Sinon ouvrir le menu
    setMenu({ card, zone, bfIndex });
  };
  const onCardLongPress = (card, zone, bfIndex) => setMenu({ card, zone, bfIndex });

  const handleDrop = (toZone) => (card, fromZone, fromBfIndex) => {
    if (toZone === "bf") return; // géré par BattlefieldZone
    if (fromZone === "hand" || fromZone === "champion") {
      send({ type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: toZone });
    } else if (typeof fromBfIndex === "number") {
      send({ type: "MOVE_FROM_BF", instanceId: card.instanceId, bfIndex: fromBfIndex });
    } else {
      send({ type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone });
    }
  };

  const handleDropToBF = (card, fromZone, bfId) => {
    send({ type: "MOVE_TO_BF", instanceId: card.instanceId, bfIndex: bfId });
  };

  const handleResolveCombat = (bfId) => send({ type: "RESOLVE_COMBAT", bfIndex: bfId });

  const bfs = room.battlefields || [];

  return (
    <div className="fixed inset-0 bg-gray-950 overflow-hidden select-none flex flex-col" style={{ touchAction: "manipulation" }}>

      {/* ══ Top info bar ══ */}
      <div className="shrink-0 flex items-center gap-2 px-2 py-1 bg-gray-900 border-b border-gray-800 text-[10px]">
        {/* Score adversaire */}
        <ScoreBadge score={opp?.score ?? 0} isMe={false} />
        <div className="w-px h-4 bg-gray-700 mx-1" />
        <span className="text-gray-600 font-mono">{code}</span>
        <span className="text-gray-700">·</span>
        <span className="text-gray-600">Tour {room.turn ?? 1}</span>
        {/* Énergie */}
        <div className="flex items-center gap-1 ml-1">
          <span className="text-blue-400">⚡</span>
          <span className="text-blue-400 font-bold">{me?.energy ?? 0}</span>
        </div>
        <div className="flex-1" />
        {/* Actions */}
        <button onClick={() => send({ type: "START_TURN" })}
          className="bg-green-700/30 hover:bg-green-700/60 text-green-400 rounded px-2 py-0.5 font-semibold text-[10px] transition-colors">
          ▶ Début de tour
        </button>
        <button onClick={() => send({ type: "FIN_TOUR" })}
          className="bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-400 rounded px-2 py-0.5 font-semibold text-[10px] transition-colors ml-1">
          ■ Fin de tour
        </button>
        <div className="w-px h-4 bg-gray-700 mx-1" />
        {/* Score moi */}
        <ScoreBadge score={me?.score ?? 0} isMe />
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* ══ Zone ADVERSAIRE ══ */}
        <div className="flex flex-col gap-0.5 px-1 pt-0.5 shrink-0">

          {/* Légende adversaire (fixe, jamais en jeu) + infos */}
          <div className="flex items-center gap-1 h-7">
            {opp?.legendCard?.image_small && (
              <img src={opp.legendCard.image_small} alt={opp.legendCard.name} title={opp.legendCard.name}
                className="h-full aspect-[2.5/3.5] object-cover rounded opacity-80 border border-gray-700" />
            )}
            <span className="text-[8px] text-gray-600 italic truncate">{opp?.legendCard?.name || "Légende inconnue"}</span>
            <div className="flex-1" />
            <span className="text-[8px] text-gray-600">🃏{opp?.hand?.length ?? 0}</span>
            <span className="text-[8px] text-gray-600 ml-1">🂠{opp?.deckSize ?? 0}</span>
            <span className="text-[8px] text-gray-600 ml-1">💀{opp?.graveyardSize ?? 0}</span>
          </div>

          {/* Runes adversaire */}
          <div className="h-8">
            <RuneRow p={opp} isMe={false} onCardTap={() => {}} onCardLongPress={() => {}} />
          </div>

          {/* Base adversaire : Champion | Field | Sort | Deck */}
          <div className="flex gap-1 h-[62px]">
            {/* Champion zone */}
            <div className="w-10 shrink-0 h-full rounded border border-purple-900/40 bg-purple-950/10 flex flex-col items-center justify-center gap-0.5 overflow-hidden">
              {(opp?.champion || []).slice(0, 1).map((c) => (
                <GameCard key={c.instanceId} card={c} zone="opp-champion" isMe={false} size="sm" />
              ))}
              {(opp?.champion || []).length === 0 && <span className="text-[7px] text-purple-900">Champ.</span>}
            </div>
            {/* Field/Base */}
            <DropZone label="Base adv." cards={opp?.field || []} isMe={false} className="flex-1 h-full overflow-x-auto" horizontal size="sm" />
            {/* Sort */}
            <DropZone label="Sort" cards={opp?.spellZone || []} isMe={false} className="w-10 shrink-0 h-full" size="sm" />
            {/* Deck */}
            <div className="w-9 shrink-0 h-full bg-gray-800/30 border border-gray-700/30 rounded text-[8px] text-gray-600 flex flex-col items-center justify-center gap-0.5">
              <span>🂠</span><span>{opp?.deckSize ?? 0}</span>
            </div>
          </div>
        </div>

        {/* ══ Zone BATTLEFIELDS partagée ══ */}
        <div className="shrink-0 px-1 py-0.5">
          {bfs.length > 0 ? (
            <div className="flex gap-1 h-[110px]">
              {bfs.map((bf) => (
                <BattlefieldZone key={bf.id} bf={bf} myPlayerIndex={myIdx} isMe
                  onCardTap={onCardTap} onCardLongPress={onCardLongPress}
                  onDrop={handleDropToBF} onResolveCombat={handleResolveCombat} />
              ))}
            </div>
          ) : (
            <div className="h-6 flex items-center justify-center text-[8px] text-gray-800 border border-dashed border-gray-800 rounded">
              Aucun Battlefield sélectionné
            </div>
          )}
        </div>

        {/* ══ Zone MOI ══ */}
        <div className="flex flex-col gap-0.5 px-1 pb-0.5 flex-1 min-h-0">

          {/* Ma base : Champion | Field | Sort | Deck */}
          <div className="flex gap-1 flex-1 min-h-0">
            {/* Champion zone — la carte part d'ici, jamais reshufflée */}
            <div className="w-10 shrink-0 h-full rounded border border-purple-700/40 bg-purple-950/10 flex flex-col items-center justify-center gap-0.5 overflow-hidden">
              {(me?.champion || []).slice(0, 1).map((c) => (
                <GameCard key={c.instanceId} card={c} zone="champion" isMe size="sm"
                  onTap={onCardTap} onLongPress={onCardLongPress} />
              ))}
              {(me?.champion || []).length === 0 && <span className="text-[7px] text-purple-700">Champ.</span>}
            </div>
            {/* Field / Base */}
            <DropZone label="Base" cards={me?.field || []}
              onDrop={handleDrop("field")} onCardTap={onCardTap} onCardLongPress={onCardLongPress}
              isMe className="flex-1 h-full overflow-auto" horizontal size="sm" />
            {/* Sort */}
            <DropZone label="Sort" cards={me?.spellZone || []}
              onDrop={handleDrop("spellZone")} onCardTap={onCardTap} onCardLongPress={onCardLongPress}
              isMe className="w-10 shrink-0 h-full" size="sm" />
            {/* Pioche */}
            <button onClick={() => send({ type: "DRAW" })}
              className="w-9 shrink-0 h-full bg-gray-800/60 hover:bg-gray-700 border border-gray-700 rounded text-[8px] text-gray-400 flex flex-col items-center justify-center gap-0.5 transition-colors">
              <span>🂠</span><span>{me?.deckSize ?? 0}</span>
            </button>
          </div>

          {/* Mes runes */}
          <div className="h-9 flex gap-1">
            <div className="flex-1">
              <RuneRow p={me} isMe onCardTap={onCardTap} onCardLongPress={onCardLongPress} />
            </div>
            {/* Défausse */}
            <DropZone label="GY" cards={(me?.graveyard || []).slice(-1)}
              onDrop={handleDrop("graveyard")} onCardTap={onCardTap} onCardLongPress={onCardLongPress}
              isMe className="w-9 shrink-0 h-full" size="sm" />
          </div>

          {/* Légende (fixe, jamais en jeu) */}
          <div className="flex items-center gap-1 h-6">
            {me?.legendCard?.image_small && (
              <img src={me.legendCard.image_small} alt={me.legendCard.name} title={me.legendCard.name}
                className="h-full aspect-[2.5/3.5] object-cover rounded border border-gray-600" />
            )}
            <span className="text-[8px] text-gray-500 italic">{me?.legendCard?.name || "Légende"}</span>
            <div className="flex-1" />
            <span className="text-[8px] text-gray-600">💀{me?.graveyardSize ?? 0}</span>
            <span className="text-[8px] text-gray-600 ml-1">🚫{me?.banishmentSize ?? 0}</span>
          </div>
        </div>
      </div>

      {/* ══ Main ══ */}
      <div className="shrink-0 flex gap-1 overflow-x-auto px-2 py-1.5 bg-gray-900/95 border-t border-gray-800 min-h-[72px] items-end">
        {(me?.hand || []).map((card) => (
          <GameCard key={card.instanceId} card={card} zone="hand" isMe size="md"
            onTap={(c, z) => setMenu({ card: c, zone: z, bfIndex: null })}
            onLongPress={(c, z) => setMenu({ card: c, zone: z, bfIndex: null })} />
        ))}
        {(me?.hand?.length ?? 0) === 0 && <span className="text-[10px] text-gray-700 self-center px-2">Main vide</span>}
      </div>

      {/* ══ Toast erreur ══ */}
      {error && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-red-900 text-red-200 text-xs px-4 py-2 rounded-xl z-50 shadow-lg whitespace-nowrap">
          {error}
        </div>
      )}

      {menu && (
        <CardMenu card={menu.card} zone={menu.zone} bfIndex={menu.bfIndex}
          battlefields={bfs} onAction={send} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────
export default function Game() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("lobby");
  const [code, setCode] = useState(null);
  const [room, setRoom] = useState(null);

  useEffect(() => {
    if (!user) navigate("/login");
    if (screen.orientation?.lock) screen.orientation.lock("landscape").catch(() => {});
    return () => screen.orientation?.unlock?.();
  }, [user]);

  if (!user) return null;

  const mySocketId = getSocket().id;

  const onState = (newRoom) => { setRoom(newRoom); setPhase(newRoom.phase); };

  if (phase === "lobby") return <Lobby onJoined={(c, r) => { setCode(c); setRoom(r); setPhase(r.phase); }} />;
  if (phase === "deck_select") return <DeckSelect code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  if (phase === "battlefield_select") return <BattlefieldSelect code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  if (phase === "mulligan") return <Mulligan code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  return <Board room={room} mySocketId={mySocketId} code={code} />;
}
