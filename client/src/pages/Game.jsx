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
function GameCard({ card, zone, bfIndex = null, isMe, onTap, onLongPress, size = "md", className = "" }) {
  const pressTimer = useRef(null);
  const faceDown = card.faceDown;
  const sizeClass = size === "fill" ? "w-full h-full" : size === "sm" ? "w-9 h-12" : size === "lg" ? "w-16 h-22" : "w-11 h-[60px]";

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
      className={`relative flex-shrink-0 ${sizeClass} ${className} rounded border cursor-pointer select-none transition-all flex items-center justify-center bg-gray-900
        ${card.exhausted ? "border-gray-600 opacity-70" : "border-gray-700 hover:border-yellow-400"}`}
      style={card.exhausted ? { transform: "rotate(90deg)" } : undefined}
    >
      {faceDown ? (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600 text-sm rounded">🂠</div>
      ) : card.image_small ? (
        <img src={card.image_small} alt={card.name} className="max-w-full max-h-full object-contain rounded" draggable={false} />
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
      {zone === "hand" && !faceDown && card.energy_cost && Number(card.energy_cost) > 0 && (
        <div className="absolute top-0.5 right-0.5 bg-blue-600 text-white text-[7px] font-bold px-0.5 rounded">
          {card.energy_cost}⚡
        </div>
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
function CardMenu({ card, zone, bfIndex, battlefields, onAction, onClose, myEnergy = 0 }) {
  const fromHand = zone === "hand";
  const fromChampion = zone === "champion";
  const fromBF = typeof bfIndex === "number";
  const fromRune = zone === "runeHand";

  const zoomAction = { label: "🔍 Voir la carte", action: "__zoom__" };
  let actions = [];

  if (fromRune) {
    actions = [
      zoomAction,
      { label: "Épuiser (→ +1 énergie)", action: { type: "EXHAUST_RUNE", instanceId: card.instanceId } },
      { label: "Recycler (→ +1 énergie domaine)", action: { type: "RECYCLE_RUNE", instanceId: card.instanceId } },
    ];
  } else if (fromHand) {
    const cost = Number(card.energy_cost) || 0;
    const cantAfford = cost > myEnergy;
    const costLabel = cost > 0 ? ` (coût: ${cost}⚡)` : "";
    actions = [
      zoomAction,
      { label: `→ Base (jouer unité/gear)${costLabel}`, action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "field" }, disabled: cantAfford },
      { label: `→ Zone Sort${costLabel}`, action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "spellZone" }, disabled: cantAfford },
      { label: "Défausser", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "graveyard" } },
      { label: "Bannir", action: { type: "BANISH", instanceId: card.instanceId } },
    ];
  } else if (fromChampion) {
    actions = [
      zoomAction,
      { label: "→ Base (déployer champion)", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "field" } },
      ...(battlefields || []).map((bf, i) => ({
        label: `→ Battlefield ${i + 1} (${bf.card?.name || "sans nom"})`,
        action: { type: "MOVE_TO_BF", instanceId: card.instanceId, bfIndex: bf.id },
      })),
    ];
  } else if (fromBF) {
    actions = [
      zoomAction,
      { label: "Épuiser / Désépuiser", action: { type: "EXHAUST", instanceId: card.instanceId } },
      { label: "→ Base (retraite)", action: { type: "MOVE_FROM_BF", instanceId: card.instanceId, bfIndex } },
      { label: "→ Défausse", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "graveyard" } },
      { label: "+1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: 1 } },
      { label: "-1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: -1 } },
    ];
  } else {
    actions = [
      zoomAction,
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
          <button key={a.label} onClick={() => { if (!a.disabled) { onAction(a.action); onClose(); } }}
            disabled={a.disabled}
            className={`w-full text-left px-4 py-2 rounded-xl text-sm transition-colors ${a.disabled ? "text-gray-600 cursor-not-allowed" : "text-white hover:bg-gray-800"}`}>{a.label}{a.disabled ? " — pas assez d'⚡" : ""}</button>
        ))}
        <button onClick={onClose} className="w-full text-center px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-800">Annuler</button>
      </div>
    </div>
  );
}

// ── GameLog ───────────────────────────────────────────────────────────────────
function GameLog({ log, myPlayerIndex }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [log]);
  const last = log[log.length - 1];
  return (
    <div className="relative flex items-center">
      {open && (
        <div ref={ref} className="absolute bottom-7 right-0 w-56 max-h-44 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl p-2 space-y-0.5 text-[10px] z-40 shadow-xl">
          {log.map((e) => (
            <div key={e.id} className={e.playerIndex === myPlayerIndex ? "text-yellow-300" : "text-gray-400"}>
              <span className="text-gray-600">T{e.turn} </span>{e.text}
            </div>
          ))}
          {!log.length && <span className="text-gray-700">Aucune action</span>}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)}
        className="text-[10px] text-gray-500 hover:text-gray-300 px-1 transition-colors">
        📋{open ? "▾" : "▸"}
      </button>
    </div>
  );
}

// ── CardZoom ──────────────────────────────────────────────────────────────────
function CardZoom({ card, onClose }) {
  if (!card) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
        {card.image_large || card.image_small
          ? <img src={card.image_large || card.image_small} alt={card.name} className="w-full rounded-2xl shadow-2xl" />
          : <div className="w-full aspect-[2.5/3.5] bg-gray-800 rounded-2xl flex items-center justify-center text-white">{card.name}</div>}
        {card.description && (
          <div className="mt-2 bg-gray-900/90 rounded-xl p-3 text-xs text-gray-300 leading-relaxed">{card.description}</div>
        )}
        {(card.might || card.energy_cost) && (
          <div className="mt-1 flex gap-3 justify-center text-xs text-gray-400">
            {card.energy_cost && <span>⚡ Coût : {card.energy_cost}</span>}
            {card.might && <span>⚔️ Might : {card.might}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ZoneViewer ────────────────────────────────────────────────────────────────
function ZoneViewer({ title, cards, isMe, onAction, onClose, onZoom }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 p-3 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-white">{title} ({cards.length})</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">×</button>
        </div>
        <div className="flex flex-wrap gap-2 overflow-y-auto flex-1">
          {cards.map(card => (
            <div key={card.instanceId} className="relative cursor-pointer" onClick={() => onZoom(card)}>
              {card.image_small
                ? <img src={card.image_small} alt={card.name} className="w-16 rounded-lg border border-gray-700 hover:border-yellow-400 transition-colors" />
                : <div className="w-16 h-22 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center text-[8px] text-gray-500 p-1">{card.name}</div>}
              {isMe && (
                <button onClick={e => { e.stopPropagation(); onAction({ type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "hand" }); }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full text-[8px] text-gray-950 font-bold flex items-center justify-center hover:bg-yellow-400">↑</button>
              )}
            </div>
          ))}
          {cards.length === 0 && <p className="text-gray-600 text-sm w-full text-center py-4">Vide</p>}
        </div>
      </div>
    </div>
  );
}

// ── TokenPicker ───────────────────────────────────────────────────────────────
function TokenPicker({ onPick, onClose }) {
  const api = useApi();
  const [tokens, setTokens] = useState([]);
  useEffect(() => { api.get("/cards?type=Token&limit=40").then(d => setTokens(d.cards || [])).catch(console.error); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 p-3 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-white">Créer un token</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">×</button>
        </div>
        <div className="flex flex-wrap gap-2 overflow-y-auto flex-1">
          {tokens.map(t => (
            <div key={t.id} onClick={() => { onPick(t); onClose(); }} className="cursor-pointer">
              {t.image_small
                ? <img src={t.image_small} alt={t.name} className="w-16 rounded-lg border border-gray-700 hover:border-yellow-400 transition-colors" />
                : <div className="w-16 h-22 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center text-[7px] text-gray-500 p-1 text-center">{t.name}</div>}
            </div>
          ))}
        </div>
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
  const [zoom, setZoom] = useState(null);
  const [zoneViewer, setZoneViewer] = useState(null);
  const [tokenPicker, setTokenPicker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useSocket({
    "game:state": ({ room }) => setRoom(room),
    "game:error": (msg) => { setError(msg); setTimeout(() => setError(""), 3000); },
    "game:opponent_left": () => setError("L'adversaire a quitté la partie."),
  });

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  };

  const me = room.players.find((p) => p.socketId === mySocketId);
  const opp = room.players.find((p) => p.socketId !== mySocketId);
  const myIdx = me?.playerIndex ?? 0;
  const isMyTurn = room.activePlayer === myIdx;
  const send = useCallback((action) => getSocket().emit("game:action", { code, action }), [code]);

  if (room.phase === "ended") return <EndScreen room={room} mySocketId={mySocketId} />;

  const onCardTap = (card, zone, bfIndex) => {
    if (zone === "runeHand") {
      if (isMyTurn) send({ type: "EXHAUST_RUNE", instanceId: card.instanceId });
      return;
    }
    setMenu({ card, zone, bfIndex });
  };
  const onCardLongPress = (card, zone, bfIndex) => setMenu({ card, zone, bfIndex });

  const handleDrop = (toZone) => (card, fromZone, fromBfIndex) => {
    if (!isMyTurn) return;
    if (fromZone === "hand" || fromZone === "champion") {
      send({ type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: toZone });
    } else if (typeof fromBfIndex === "number") {
      send({ type: "MOVE_FROM_BF", instanceId: card.instanceId, bfIndex: fromBfIndex });
    } else {
      send({ type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone });
    }
  };

  const handleDropToBF = (card, fromZone, bfId) => {
    if (!isMyTurn) return;
    send({ type: "MOVE_TO_BF", instanceId: card.instanceId, bfIndex: bfId });
  };

  const handleResolveCombat = (bfId) => send({ type: "RESOLVE_COMBAT", bfIndex: bfId });

  const bfs = room.battlefields || [];
  const canStartTurn = room.activePlayer === null || room.activePlayer === opp?.playerIndex;

  // Helper: une ligne de runes (6 slots)
  const RuneSlots = ({ runeHand = [], runeDeckSize = 0, isMe: rIsMe, gy = null, gySize = 0, onGy }) => (
    <div className="flex gap-px h-full">
      <div className="w-7 shrink-0 h-full bg-blue-950/30 border border-blue-900/40 rounded text-[7px] text-blue-500 flex flex-col items-center justify-center">
        <span>🔷</span><span>{runeDeckSize}</span>
      </div>
      {Array.from({ length: 6 }).map((_, i) => {
        const card = runeHand[i];
        if (!card) return <div key={i} className="flex-1 h-full rounded border border-dashed border-blue-900/20 bg-blue-950/5" />;
        if (!rIsMe) return (
          <div key={card.instanceId} className="flex-1 h-full rounded overflow-hidden border border-blue-800/30 bg-blue-950/20 flex items-center justify-center">
            <span className="text-[8px] text-blue-700">🔷</span>
          </div>
        );
        return (
          <div key={card.instanceId} className="flex-1 h-full min-w-0 rounded overflow-hidden border border-blue-700/40">
            <GameCard card={card} zone="runeHand" isMe size="sm" onTap={onCardTap} onLongPress={onCardLongPress} />
          </div>
        );
      })}
      {gy !== null && (
        <button onClick={onGy} className="w-7 shrink-0 h-full bg-gray-800/20 border border-gray-800 rounded text-[7px] text-gray-500 flex flex-col items-center justify-center hover:border-gray-600">
          <span>💀</span><span>{gySize}</span>
        </button>
      )}
    </div>
  );

  // Cellule zone avec label et contenu
  const ZoneCell = ({ label, border = "border-gray-700/40", bg = "bg-black/30", className = "", children, onClick }) => (
    <div onClick={onClick}
      className={`relative flex flex-col items-center justify-center rounded border ${border} ${bg} overflow-hidden ${className} ${onClick ? "cursor-pointer active:opacity-80" : ""}`}>
      {children}
      <span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] text-gray-600 leading-none truncate px-0.5">{label}</span>
    </div>
  );

  // Runes inline (pour les lignes de runes)
  const InlineRunes = ({ runeHand = [], isMe: rIsMe }) => (
    <div className="flex gap-0.5 h-full w-full p-0.5">
      {Array.from({ length: 6 }).map((_, i) => {
        const card = runeHand[i];
        if (!card) return <div key={i} className="flex-1 h-full rounded border border-dashed border-gray-700/30" />;
        if (!rIsMe) return (
          <div key={card.instanceId} className="flex-1 h-full rounded overflow-hidden border border-blue-800/30 bg-blue-950/20 flex items-center justify-center">
            <span className="text-[9px] text-blue-600">◆</span>
          </div>
        );
        return (
          <div key={card.instanceId} className="flex-1 h-full min-w-0 rounded overflow-hidden">
            <GameCard card={card} zone="runeHand" isMe size="fill" onTap={onCardTap} onLongPress={onCardLongPress} />
          </div>
        );
      })}
    </div>
  );

  const ROW = "h-[54px]";
  const SM = "w-[52px] shrink-0";

  return (
    <div className="fixed inset-0 bg-gray-950 overflow-hidden select-none flex flex-col" style={{ touchAction: "manipulation" }}>

      {/* ══ Barre top ══ */}
      <div className={`shrink-0 flex items-center gap-2 px-3 border-b h-[36px]
        ${isMyTurn ? "bg-green-950/70 border-green-900/60" : "bg-gray-900 border-gray-800"}`}>
        <span className="text-sm font-black text-gray-400">{opp?.score ?? 0}</span>
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gray-500 rounded-full" style={{ width: `${Math.min((opp?.score ?? 0) / 8, 1) * 100}%` }} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isMyTurn ? "bg-green-400" : "bg-gray-600"}`} />
          <span className="text-gray-600 font-mono text-[10px]">{code} T{room.turn ?? 1}</span>
        </div>
        <span className="text-blue-400 font-bold text-xs">⚡{me?.energy ?? 0}</span>
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${Math.min((me?.score ?? 0) / 8, 1) * 100}%` }} />
        </div>
        <span className="text-sm font-black text-yellow-400">{me?.score ?? 0}</span>
        <button onClick={toggleFullscreen} className="text-gray-500 hover:text-gray-300 text-base leading-none ml-1">
          {isFullscreen ? "⊡" : "⛶"}
        </button>
      </div>

      {/* ══ Main adversaire — face cachée ══ */}
      <div className="shrink-0 flex gap-1 overflow-x-auto px-2 py-1.5 bg-gray-900/60 border-b border-gray-800 h-[76px] items-center">
        {(opp?.hand || []).map((card) => (
          <GameCard key={card.instanceId} card={card} zone="opp-hand" isMe={false} size="fill"
            className="w-[44px] h-full shrink-0" />
        ))}
        {!(opp?.hand?.length) && <span className="text-xs text-gray-700 px-2">— main adv. —</span>}
      </div>

      {/* ══ Zone adversaire : 3 lignes ══ */}
      <div className="shrink-0 flex flex-col gap-0.5 px-1.5 py-0.5">

        {/* Adv ligne 1 : Trash | Runes | RuneDeck */}
        <div className={`flex gap-0.5 ${ROW}`}>
          <ZoneCell label="Trash" border="border-gray-700/40" className={SM}
            onClick={() => setZoneViewer({ title: "Défausse adv.", cards: opp?.graveyard || [], isMe: false })}>
            <span className="text-lg">🗑</span>
            <span className="text-[9px] text-gray-500">{opp?.graveyardSize ?? 0}</span>
          </ZoneCell>
          <ZoneCell label="Runes" border="border-blue-900/40" bg="bg-blue-950/10" className="flex-1">
            <InlineRunes runeHand={opp?.runeHand || []} isMe={false} />
          </ZoneCell>
          <ZoneCell label="Runes Deck" border="border-blue-900/40" bg="bg-blue-950/20" className={SM}>
            <span className="text-lg text-blue-600">◆</span>
            <span className="text-[9px] text-blue-400">{opp?.runeDeckSize ?? 0}</span>
          </ZoneCell>
        </div>

        {/* Adv ligne 2 : Main Deck | Base */}
        <div className={`flex gap-0.5 ${ROW}`}>
          <ZoneCell label="Main Deck" border="border-gray-700/40" className={SM}>
            <span className="text-lg">🂠</span>
            <span className="text-[9px] text-gray-500">{opp?.deckSize ?? 0}</span>
          </ZoneCell>
          <ZoneCell label="Base" border="border-gray-700/30" className="flex-1">
            <div className="flex gap-0.5 overflow-x-auto h-full w-full p-0.5 items-center">
              {(opp?.field || []).map((c) => (
                <GameCard key={c.instanceId} card={c} zone="opp-field" isMe={false} size="fill"
                  className="w-[36px] h-full shrink-0" />
              ))}
              {!(opp?.field?.length) && <span className="text-[9px] text-gray-700 w-full text-center">Base</span>}
            </div>
          </ZoneCell>
        </div>

        {/* Adv ligne 3 (proche BF) : Battlefield | Legend | Champion */}
        <div className={`flex gap-0.5 ${ROW}`}>
          <ZoneCell label="Battlefield" border="border-gray-600/40" className="flex-1">
            {opp?.battlefieldCard
              ? <GameCard card={opp.battlefieldCard} zone="opp-bf-card" isMe={false} size="fill" className="w-[36px] h-[44px]" />
              : <span className="text-[9px] text-gray-700">BF</span>}
          </ZoneCell>
          <ZoneCell label="Legend" border="border-amber-800/40" bg="bg-amber-950/10" className={SM}
            onClick={() => opp?.legendCard && setZoom(opp.legendCard)}>
            {opp?.legendCard
              ? <GameCard card={opp.legendCard} zone="opp-legend" isMe={false} size="fill" className="w-[36px] h-[44px]" />
              : <span className="text-sm text-amber-800">♛</span>}
          </ZoneCell>
          <ZoneCell label="Champion" border="border-purple-800/40" bg="bg-purple-950/10" className={SM}>
            {(opp?.champion || []).slice(0, 1).map((c) => (
              <GameCard key={c.instanceId} card={c} zone="opp-champion" isMe={false} size="fill" className="w-[36px] h-[44px]" />
            ))}
            {!(opp?.champion?.length) && <span className="text-sm text-purple-800">⚔</span>}
          </ZoneCell>
        </div>
      </div>

      {/* ══ Battlefields partagés ══ */}
      <div className="shrink-0 px-1.5 py-0.5">
        {bfs.length > 0 ? (
          <div className="flex gap-1 h-[80px]">
            {bfs.map((bf) => (
              <BattlefieldZone key={bf.id} bf={bf} myPlayerIndex={myIdx} isMe
                onCardTap={onCardTap} onCardLongPress={onCardLongPress}
                onDrop={handleDropToBF} onResolveCombat={handleResolveCombat} />
            ))}
          </div>
        ) : (
          <div className="h-[20px] flex items-center justify-center text-[9px] text-gray-700 border border-dashed border-gray-800 rounded">
            Aucun Battlefield
          </div>
        )}
      </div>

      {/* ══ Zone moi : 3 lignes ══ */}
      <div className="shrink-0 flex flex-col gap-0.5 px-1.5 py-0.5">

        {/* Moi ligne 1 (proche BF) : Champion | Legend | Battlefield */}
        <div className={`flex gap-0.5 ${ROW}`}>
          <ZoneCell label="Champion" border="border-purple-700/40" bg="bg-purple-950/10" className={SM}
            onClick={() => (me?.champion || [])[0] && setMenu({ card: me.champion[0], zone: "champion", bfIndex: null })}>
            {(me?.champion || []).slice(0, 1).map((c) => (
              <GameCard key={c.instanceId} card={c} zone="champion" isMe size="fill" className="w-[36px] h-[44px]"
                onTap={onCardTap} onLongPress={onCardLongPress} />
            ))}
            {!(me?.champion?.length) && <span className="text-sm text-purple-700">⚔</span>}
          </ZoneCell>
          <ZoneCell label="Legend" border="border-amber-700/40" bg="bg-amber-950/10" className={SM}
            onClick={() => me?.legendCard && setZoom(me.legendCard)}>
            {me?.legendCard
              ? <GameCard card={me.legendCard} zone="legend" isMe={false} size="fill" className="w-[36px] h-[44px]" />
              : <span className="text-sm text-amber-700">♛</span>}
          </ZoneCell>
          <ZoneCell label="Battlefield" border="border-gray-600/40" className="flex-1"
            onClick={() => me?.battlefieldCard && setZoom(me.battlefieldCard)}>
            {me?.battlefieldCard
              ? <GameCard card={me.battlefieldCard} zone="bf-card" isMe={false} size="fill" className="w-[36px] h-[44px]" />
              : <span className="text-[9px] text-gray-700">BF</span>}
          </ZoneCell>
        </div>

        {/* Moi ligne 2 : Main Deck | Base */}
        <div className={`flex gap-0.5 ${ROW}`}>
          <ZoneCell label="Main Deck" border="border-gray-700/40" className={SM}
            onClick={() => isMyTurn && send({ type: "DRAW" })}>
            <span className="text-lg">🂠</span>
            <span className="text-[9px] text-gray-400">{me?.deckSize ?? 0}</span>
          </ZoneCell>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (drag.card) handleDrop("field")(drag.card, drag.fromZone, drag.bfIndex); }}
            className="flex-1 rounded border border-gray-700/30 bg-black/30 relative">
            <div className="flex gap-0.5 overflow-x-auto h-full w-full p-0.5 items-center">
              {(me?.field || []).map((c) => (
                <GameCard key={c.instanceId} card={c} zone="field" isMe size="fill" className="w-[36px] h-full shrink-0"
                  onTap={onCardTap} onLongPress={onCardLongPress} />
              ))}
              {!(me?.field?.length) && <span className="text-[9px] text-gray-700 w-full text-center">Base</span>}
            </div>
            <span className="absolute bottom-0.5 left-0 right-0 text-center text-[8px] text-gray-600 leading-none pointer-events-none">Base</span>
          </div>
        </div>

        {/* Moi ligne 3 (proche main) : RuneDeck | Runes | Trash */}
        <div className={`flex gap-0.5 ${ROW}`}>
          <ZoneCell label="Runes Deck" border="border-blue-900/40" bg="bg-blue-950/20" className={SM}>
            <span className="text-lg text-blue-500">◆</span>
            <span className="text-[9px] text-blue-400">{me?.runeDeckSize ?? 0}</span>
          </ZoneCell>
          <ZoneCell label="Runes" border="border-blue-900/40" bg="bg-blue-950/10" className="flex-1">
            <InlineRunes runeHand={me?.runeHand || []} isMe />
          </ZoneCell>
          <ZoneCell label="Trash" border="border-gray-700/40" className={SM}
            onClick={() => setZoneViewer({ title: "Ma défausse", cards: me?.graveyard || [], isMe: true })}>
            <span className="text-lg">🗑</span>
            <span className="text-[9px] text-gray-400">{me?.graveyardSize ?? 0}</span>
          </ZoneCell>
        </div>
      </div>

      {/* ══ Ma main — flex-1 ══ */}
      <div className="flex-1 flex gap-1 overflow-x-auto px-2 py-2 bg-gray-900/80 border-t border-gray-700 items-center min-h-[100px]">
        {(me?.hand || []).map((card) => (
          <GameCard key={card.instanceId} card={card} zone="hand" isMe size="fill"
            className="w-[52px] h-full shrink-0"
            onTap={(c, z) => setMenu({ card: c, zone: z, bfIndex: null })}
            onLongPress={(c, z) => setMenu({ card: c, zone: z, bfIndex: null })} />
        ))}
        {!(me?.hand?.length) && <span className="text-sm text-gray-700 px-2">Main vide</span>}
      </div>

      {/* ══ Barre d'actions ══ */}
      <div className="shrink-0 flex items-center gap-2 px-3 bg-gray-900 border-t border-gray-800 h-[44px]">
        <button onClick={() => send({ type: "START_TURN" })} disabled={!canStartTurn}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${canStartTurn ? "bg-green-700/40 text-green-300 hover:bg-green-700/70" : "text-gray-700 cursor-not-allowed"}`}>
          ▶ Début
        </button>
        <button onClick={() => send({ type: "FIN_TOUR" })} disabled={!isMyTurn}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${isMyTurn ? "bg-yellow-700/40 text-yellow-300 hover:bg-yellow-700/70" : "text-gray-700 cursor-not-allowed"}`}>
          ■ Fin
        </button>
        <button onClick={() => isMyTurn && setTokenPicker(true)} disabled={!isMyTurn}
          className="text-sm text-gray-500 hover:text-gray-300 disabled:opacity-30">🪙</button>
        <button onClick={() => setZoneViewer({ title: "Mes banissements", cards: me?.banishment || [], isMe: false })}
          className="text-xs text-gray-700 hover:text-gray-500">🚫{me?.banishmentSize ?? 0}</button>
        <div className="flex-1" />
        <GameLog log={room.log || []} myPlayerIndex={myIdx} />
      </div>

      {/* ══ Toast erreur ══ */}
      {error && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-red-900 text-red-200 text-xs px-4 py-2 rounded-xl z-50 shadow-lg whitespace-nowrap">
          {error}
        </div>
      )}

      {menu && (
        <CardMenu card={menu.card} zone={menu.zone} bfIndex={menu.bfIndex}
          battlefields={bfs} onAction={(a) => { if (a === "__zoom__") { setZoom(menu.card); return; } send(a); }}
          onClose={() => setMenu(null)} myEnergy={me?.energy ?? 0} />
      )}
      {zoom && <CardZoom card={zoom} onClose={() => setZoom(null)} />}
      {zoneViewer && (
        <ZoneViewer title={zoneViewer.title} cards={zoneViewer.cards} isMe={zoneViewer.isMe}
          onAction={(a) => { send(a); setZoneViewer(null); }}
          onClose={() => setZoneViewer(null)}
          onZoom={(card) => setZoom(card)} />
      )}
      {tokenPicker && <TokenPicker onClose={() => setTokenPicker(false)} onPick={(card) => send({ type: "CREATE_TOKEN", card })} />}
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
