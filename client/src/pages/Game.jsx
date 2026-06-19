import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import { useApi } from "../hooks/useApi";
import { getSocket, useSocket } from "../hooks/useSocket";
import "../game-board.css";

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
  const [copied, setCopied] = useState(false);
  const copyCode = () => {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-6 gap-5">
      <h2 className="text-xl font-bold text-white">Choisis ton deck</h2>

      {/* Code à partager — proéminent si l'adversaire n'a pas encore rejoint */}
      {!opp && (
        <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Code de la partie</p>
          <p className="text-5xl font-black tracking-[0.25em] text-yellow-400 font-mono">{code}</p>
          <button onClick={copyCode}
            className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1 rounded-lg border border-gray-700 hover:border-gray-500">
            {copied ? "✓ Copié !" : "Copier le code"}
          </button>
          <p className="text-xs text-gray-600">En attente de l'adversaire…</p>
        </div>
      )}

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
            <div className="w-full max-w-sm space-y-3">
              {bfs.map((c) => (
                <div key={c.instanceId} onClick={() => select(c.instanceId)}
                  className="cursor-pointer border-2 border-gray-700 hover:border-yellow-400 rounded-2xl overflow-hidden transition-all active:scale-95">
                  {c.image_small
                    ? <img src={c.image_small} alt={c.name} className="w-full aspect-[16/9] object-cover" />
                    : <div className="w-full aspect-[16/9] bg-gray-800 flex items-center justify-center text-sm text-gray-400 p-2">{c.name}</div>}
                  <p className="text-sm font-semibold text-center text-gray-200 py-2 px-3">{c.name}</p>
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
          <div className="flex gap-3 flex-wrap justify-center w-full max-w-sm">
            {hand.map((card) => {
              const marked = toReturn.has(card.instanceId);
              return (
                <div key={card.instanceId} onClick={() => toggle(card.instanceId)}
                  className={`cursor-pointer border-2 rounded-2xl overflow-hidden transition-all active:scale-95 w-[calc(50%-6px)] ${marked ? "border-red-500 opacity-60" : "border-gray-700 hover:border-yellow-400"}`}>
                  {card.image_small
                    ? <img src={card.image_small} alt={card.name} className="w-full aspect-[2.5/3.5] object-contain bg-gray-900" draggable={false} />
                    : <div className="w-full aspect-[2.5/3.5] bg-gray-800 flex items-center justify-center text-sm text-gray-400 p-2">{card.name}</div>}
                  <p className={`text-xs text-center py-1.5 font-semibold ${marked ? "text-red-400" : "text-gray-300"}`}>{marked ? "✗ Retourner" : "✓ Garder"}</p>
                </div>
              );
            })}
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

// ── Card back ─────────────────────────────────────────────────────────────────
function CardBack({ className = "", rune = false }) {
  return (
    <div className={`relative overflow-hidden rounded bg-[#1a1040] border border-purple-900/60 flex items-center justify-center ${className}`}
      style={{ background: "linear-gradient(135deg, #1a1040 0%, #0d0820 50%, #1a1040 100%)" }}>
      <div className="absolute inset-[3px] rounded border border-purple-800/30" />
      <div className="absolute inset-[5px] rounded border border-purple-700/20" />
      <span className={`text-purple-400/70 ${rune ? "text-lg" : "text-2xl"}`}>{rune ? "◆" : "❖"}</span>
    </div>
  );
}

// ── Stacked cards zone ────────────────────────────────────────────────────────
// Cartes empilées en éventail — s'écrasent si trop nombreuses, jamais de scroll
function StackedCards({ cards, cardW = 36, renderCard }) {
  const n = cards.length;
  const overlap = n > 1 ? Math.min(0, -(cardW * n - cardW * 3) / (n - 1)) : 0;
  return (
    <div className="flex h-full w-full items-center overflow-hidden p-0.5">
      {cards.map((c, i) => (
        <div key={c.instanceId} className="shrink-0 h-full"
          style={{ width: cardW, marginLeft: i === 0 ? 0 : Math.min(-2, overlap), zIndex: i }}>
          {renderCard(c, i)}
        </div>
      ))}
      {n === 0 && <span className="text-[9px] text-white/20 w-full text-center">—</span>}
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
        <CardBack className="w-full h-full" />
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
function CardMenu({ card, zone, bfIndex, battlefields, onAction, onClose, myEnergy = 0, myRuneCount = 0 }) {
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
    const availableRunes = myRuneCount;
    const totalPayable = myEnergy + availableRunes;
    const cantAfford = cost > totalPayable;
    const costLabel = cost > 0 ? ` — ${cost} rune(s)` : " — gratuit";
    actions = [
      zoomAction,
      { label: `Jouer${costLabel}`, action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "field" }, disabled: cantAfford },
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

// ── BF : carte centrale (92px) ────────────────────────────────────────────────
function BFCenterCard({ bf, myPlayerIndex, onDrop }) {
  const [over, setOver] = useState(false);
  const controller = bf.controller;
  const ctrlColor = controller === myPlayerIndex ? "#22c55e" : controller !== null ? "#ef4444" : null;
  return (
    <div className="flex-1 relative overflow-hidden"
      style={{ border: `1px solid ${over ? "#facc15" : "#1e2d3d"}`, borderRadius: 4, background: "#060d18" }}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (drag.card) onDrop(drag.card, drag.fromZone, bf.id); }}>
      {/* Fond flouté depuis l'image de la carte BF */}
      {bf.card?.image_small && (
        <img src={bf.card.image_small} className="absolute inset-0 w-full h-full object-cover opacity-[0.12] pointer-events-none" alt="" />
      )}
      <div className="relative z-10 h-full flex items-center gap-3 px-4">
        {bf.card?.image_small
          ? <img src={bf.card.image_small} className="shrink-0 rounded object-cover shadow-lg" style={{ width: 46, height: 64 }} alt={bf.card.name} />
          : <div className="shrink-0 rounded bg-gray-800" style={{ width: 46, height: 64 }} />
        }
        <div>
          <div className="text-sm font-bold text-gray-100">{bf.card?.name || `Battlefield ${bf.id + 1}`}</div>
          {ctrlColor && (
            <div className="text-xs font-semibold mt-0.5" style={{ color: ctrlColor }}>
              {controller === myPlayerIndex ? "● Contrôlé" : "● Adversaire"}
            </div>
          )}
          {!bf.conquered && <div className="text-[10px] text-gray-600 mt-0.5">Glisser pour déployer</div>}
        </div>
      </div>
      {over && <div className="absolute inset-0 border-2 border-yellow-400/50 pointer-events-none rounded" />}
    </div>
  );
}

// ── BF : zone d'unités (flex-1) ───────────────────────────────────────────────
function BFUnitSlot({ bf, playerIndex, isMySlot, onCardTap, onCardLongPress, onResolveCombat, myPlayerIndex }) {
  const units = bf.units[playerIndex] || [];
  const oppIdx = playerIndex === 0 ? 1 : 0;
  const oppUnits = bf.units[oppIdx] || [];
  const hasCombat = isMySlot && units.length > 0 && oppUnits.length > 0;
  return (
    <div className="flex-1 relative flex items-center justify-center gap-1 px-2 overflow-hidden"
      style={{ borderLeft: "1px solid #1a2235", borderRight: "1px solid #1a2235" }}>
      {units.length === 0
        ? <span className="text-[10px] text-gray-800 select-none">{isMySlot ? "— déposer ici —" : "— vide —"}</span>
        : units.map(card => (
            <div key={card.instanceId} className="h-4/5 shrink-0" style={{ width: 52 }}>
              <GameCard card={card} zone={isMySlot ? "bf" : "bf-opp"} bfIndex={bf.id}
                isMe={isMySlot} size="fill"
                onTap={isMySlot ? onCardTap : undefined}
                onLongPress={isMySlot ? onCardLongPress : undefined} />
            </div>
          ))
      }
      {hasCombat && (
        <button onClick={() => onResolveCombat(bf.id)}
          className="absolute bottom-1 right-1 px-2 py-0.5 rounded text-[9px] font-bold text-red-200 z-20"
          style={{ background: "#7f1d1d" }}>⚔️ Combat</button>
      )}
    </div>
  );
}

// ── Ancien composant conservé mais non utilisé ─────────────────────────────────
function BattlefieldZone({ bf, myPlayerIndex, isMe, onCardTap, onCardLongPress, onDrop, onResolveCombat }) {
  const [over, setOver] = useState(false);
  const myUnits = bf.units[myPlayerIndex] || [];
  const oppUnits = bf.units[myPlayerIndex === 0 ? 1 : 0] || [];
  const hasCombat = myUnits.length > 0 && oppUnits.length > 0;
  const controller = bf.controller;
  const borderColor = over ? "#facc15" : controller === myPlayerIndex ? "#22c55e" : controller !== null ? "#ef4444" : "#374151";

  const handleDragOver = (e) => { e.preventDefault(); setOver(true); };
  const handleDragLeave = () => setOver(false);
  const handleDrop = (e) => { e.preventDefault(); setOver(false); if (drag.card && isMe) onDrop?.(drag.card, drag.fromZone, bf.id); };

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ border: `1px solid ${borderColor}`, background: "#0d1520", borderRadius: 4 }}>

      {/* Header : thumbnail de la carte BF + nom */}
      <div className="shrink-0 flex items-center gap-2 px-2 py-1" style={{ background: "#060b13", borderBottom: "1px solid #1e2d3d" }}>
        {bf.card?.image_small
          ? <img src={bf.card.image_small} alt={bf.card?.name}
              className="shrink-0 rounded object-cover"
              style={{ width: 28, height: 40 }} />
          : <div className="shrink-0 rounded" style={{ width: 28, height: 40, background: "#1a2535" }} />
        }
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-200 truncate">{bf.card?.name || `Battlefield ${bf.id + 1}`}</div>
          {bf.conquered && (
            <div className={`text-[10px] font-bold ${controller === myPlayerIndex ? "text-green-400" : "text-red-400"}`}>
              {controller === myPlayerIndex ? "● Contrôlé" : "● Adversaire"}
            </div>
          )}
        </div>
      </div>

      {/* Zone unités adverses */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center gap-1 px-1"
        style={{ borderBottom: "1px solid #1e2d3d" }}>
        {oppUnits.length === 0
          ? <span className="text-[9px] text-gray-700 select-none">— adversaire —</span>
          : oppUnits.map(card =>
              <GameCard key={card.instanceId} card={card} zone="bf-opp" bfIndex={bf.id} isMe={false} size="sm" />
            )
        }
      </div>

      {/* Zone mes unités + drop + bouton combat */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center gap-1 px-1">
        {myUnits.length === 0 && !over
          ? <span className="text-[9px] text-gray-700 select-none">— déposer ici —</span>
          : myUnits.map(card =>
              <GameCard key={card.instanceId} card={card} zone="bf" bfIndex={bf.id} isMe={isMe} size="sm"
                onTap={onCardTap} onLongPress={onCardLongPress} />
            )
        }
        {over && <div className="absolute inset-0 rounded border-2 border-yellow-400/60 bg-yellow-400/5 pointer-events-none" />}
        {hasCombat && isMe && (
          <button onClick={() => onResolveCombat(bf.id)}
            className="absolute bottom-1 right-1 px-2 py-0.5 rounded text-[9px] font-bold text-red-200 z-20"
            style={{ background: "#7f1d1d" }}>
            ⚔️ Combat
          </button>
        )}
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
  const [gameMenu, setGameMenu] = useState(false);
  const { logout } = useAuth();
  const { lang, toggleLang } = useLanguage();

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

  // START_TURN automatique dès que c'est notre tour
  useEffect(() => {
    if (isMyTurn && me && !me.turnStarted) {
      send({ type: "START_TURN" });
    }
  }, [isMyTurn, me?.turnStarted]);

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

  // Cellule avec bordures décoratives Riftbound (corner brackets + mid dots)
  const RiftCell = ({ label, className = "", children, onClick, accent = "white" }) => {
    const c = accent === "blue" ? "border-blue-400/40" : accent === "purple" ? "border-purple-400/40" : accent === "amber" ? "border-amber-400/40" : "border-white/25";
    const cc = accent === "blue" ? "border-blue-300/50" : accent === "purple" ? "border-purple-300/50" : accent === "amber" ? "border-amber-300/50" : "border-white/45";
    const dot = accent === "blue" ? "bg-blue-300/35" : accent === "purple" ? "bg-purple-300/35" : accent === "amber" ? "bg-amber-300/35" : "bg-white/25";
    return (
      <div onClick={onClick}
        className={`relative bg-black/50 ${className} ${onClick ? "cursor-pointer active:bg-white/5" : ""}`}>
        {/* thin outer border */}
        <div className={`absolute inset-0 border ${c}`} />
        {/* corner brackets */}
        <div className={`absolute top-0 left-0 w-2.5 h-2.5 border-t-[1.5px] border-l-[1.5px] ${cc}`} />
        <div className={`absolute top-0 right-0 w-2.5 h-2.5 border-t-[1.5px] border-r-[1.5px] ${cc}`} />
        <div className={`absolute bottom-0 left-0 w-2.5 h-2.5 border-b-[1.5px] border-l-[1.5px] ${cc}`} />
        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-b-[1.5px] border-r-[1.5px] ${cc}`} />
        {/* mid dots */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-1 h-[3px] ${dot}`} />
        <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-[3px] ${dot}`} />
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 w-[3px] ${dot}`} />
        <div className={`absolute right-0 top-1/2 -translate-y-1/2 h-1 w-[3px] ${dot}`} />
        {/* content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center">
          {children}
        </div>
        {/* label */}
        {label && <span className="absolute bottom-0.5 left-0 right-0 text-center text-[7px] text-white/35 leading-none z-10 pointer-events-none">{label}</span>}
      </div>
    );
  };

  // Runes inline (pour les lignes de runes)
  const InlineRunes = ({ runeHand = [], isMe: rIsMe }) => (
    <StackedCards cards={runeHand} cardW={28} renderCard={(card) =>
      rIsMe
        ? <GameCard card={card} zone="runeHand" isMe size="fill" onTap={onCardTap} onLongPress={onCardLongPress} />
        : <CardBack className="w-full h-full" rune />
    } />
  );

  // Landscape detection
  const [isLandscape, setIsLandscape] = useState(() => window.innerWidth > window.innerHeight);
  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", check);
    screen.orientation?.lock?.("landscape").catch(() => {});
    return () => window.removeEventListener("resize", check);
  }, []);

  const NARROW = "w-[52px] shrink-0";
  const CARD_SM = "w-[32px] h-[44px]";

  // Section horizontale d'un joueur (une ligne de zones)
  const PlayerRow = ({ p, isMe: pIsMe, flipped = false }) => {
    const runes = p?.runeHand || [];
    const runeSlots = Array.from({ length: Math.max(6, runes.length) });

    const deckCell = (
      <RiftCell key="deck" label="Deck" className={NARROW}
        onClick={pIsMe && isMyTurn ? () => send({ type: "DRAW" }) : undefined}>
        <CardBack className={CARD_SM} />
        <span className="text-[8px] text-white/40 absolute bottom-0.5">{p?.deckSize ?? 0}</span>
      </RiftCell>
    );
    const legendCell = (
      <RiftCell key="legend" label="Legend" accent="amber" className={NARROW}
        onClick={() => p?.legendCard && setZoom(p.legendCard)}>
        {p?.legendCard
          ? <GameCard card={p.legendCard} zone={pIsMe ? "legend" : "opp-legend"} isMe={false} size="fill" className={CARD_SM} />
          : <span className="text-amber-500/50 text-base">♛</span>}
      </RiftCell>
    );
    const champCell = (
      <RiftCell key="champ" label="Champion" accent="purple" className={NARROW}>
        <StackedCards cards={p?.champion || []} cardW={26} renderCard={(c) =>
          <GameCard card={c} zone={pIsMe ? "champion" : "opp-champion"} isMe={pIsMe} size="fill"
            onTap={pIsMe ? onCardTap : undefined} onLongPress={pIsMe ? onCardLongPress : undefined} />
        } />
      </RiftCell>
    );
    const baseCell = (
      <div key="base" className="flex-1 relative min-w-0"
        onDragOver={pIsMe ? (e) => e.preventDefault() : undefined}
        onDrop={pIsMe ? (e) => { e.preventDefault(); if (drag.card) handleDrop("field")(drag.card, drag.fromZone, drag.bfIndex); } : undefined}>
        <RiftCell label="Base" className="h-full w-full">
          <StackedCards cards={p?.field || []} cardW={28} renderCard={(c) =>
            <GameCard card={c} zone={pIsMe ? "field" : "opp-field"} isMe={pIsMe} size="fill"
              onTap={pIsMe ? onCardTap : undefined} onLongPress={pIsMe ? onCardLongPress : undefined} />
          } />
        </RiftCell>
      </div>
    );
    const runesCell = (
      <RiftCell key="runes" label="Runes" accent="blue" className="flex-1 min-w-0">
        <div className="flex h-full w-full items-center gap-px p-0.5 overflow-hidden">
          {runeSlots.map((_, i) => {
            const card = runes[i];
            if (!card) return <div key={i} className="flex-1 h-full rounded border border-dashed border-blue-900/20 shrink-0 min-w-[20px]" />;
            if (!pIsMe) return (
              <div key={card.instanceId} className="flex-1 h-full min-w-[20px] rounded border border-blue-800/30 bg-blue-950/20 flex items-center justify-center shrink-0">
                <span className="text-[8px] text-blue-800">◆</span>
              </div>
            );
            return (
              <div key={card.instanceId} className="flex-1 h-full min-w-[20px] shrink-0 rounded overflow-hidden border border-blue-700/40">
                <GameCard card={card} zone="runeHand" isMe size="fill" onTap={onCardTap} onLongPress={onCardLongPress} />
              </div>
            );
          })}
        </div>
      </RiftCell>
    );
    const runedeckCell = (
      <RiftCell key="runedeck" label="R.Deck" accent="blue" className={NARROW}>
        <CardBack className={CARD_SM} rune />
        <span className="text-[8px] text-blue-300/50 absolute bottom-0.5">{p?.runeDeckSize ?? 0}</span>
      </RiftCell>
    );
    const trashCell = (
      <RiftCell key="trash" label="Trash" className={NARROW}
        onClick={() => setZoneViewer({ title: pIsMe ? "Ma défausse" : "Défausse adv.", cards: p?.graveyard || [], isMe: pIsMe })}>
        {p?.graveyard?.length > 0
          ? <GameCard card={p.graveyard[p.graveyard.length - 1]} zone={pIsMe ? "gy" : "opp-gy"} isMe={false} size="fill" className={CARD_SM} />
          : <span className="text-[8px] text-white/20">{p?.graveyardSize ?? 0}</span>}
      </RiftCell>
    );

    // Ordre des zones — mirrored pour l'adversaire (flipped)
    const cells = flipped
      ? [trashCell, runedeckCell, runesCell, baseCell, champCell, legendCell, deckCell]
      : [deckCell, legendCell, champCell, baseCell, runesCell, runedeckCell, trashCell];

    return (
      <div className="flex gap-0.5 h-full w-full">
        {cells}
      </div>
    );
  };

  // ── Zone row helper (108px, utilisée pour OPP et ME) ──
  const ZoneRow = ({ p, isMeRow }) => {
    const runes = p?.runeHand || [];

    const runeDeckCell = (
      <RiftCell key="rdeck" label="R.Deck" accent="blue" className="shrink-0" style={{ width: 79 }}
        onClick={undefined}>
        <CardBack className="w-[42px] h-[58px]" rune />
        <span className="absolute bottom-0.5 text-[8px] text-blue-400/60">{p?.runeDeckSize ?? 0}</span>
      </RiftCell>
    );
    const runesCell = (
      <RiftCell key="runes" label="Runes" accent="blue" className="flex-[416] min-w-0">
        <div className="flex h-full w-full items-center gap-px p-1 overflow-hidden">
          {Array.from({ length: Math.max(6, runes.length) }).map((_, i) => {
            const card = runes[i];
            if (!card) return <div key={i} className="flex-1 h-full rounded border border-dashed border-blue-900/20" />;
            return (
              <div key={card.instanceId} className="flex-1 h-full min-w-0 rounded overflow-hidden border border-blue-700/40">
                {isMeRow
                  ? <GameCard card={card} zone="runeHand" isMe size="fill" onTap={onCardTap} onLongPress={onCardLongPress} />
                  : <CardBack className="w-full h-full" rune />
                }
              </div>
            );
          })}
        </div>
      </RiftCell>
    );
    const baseCell = (
      <div key="base" className="flex-[537] min-w-0"
        onDragOver={isMeRow ? e => e.preventDefault() : undefined}
        onDrop={isMeRow ? e => { e.preventDefault(); if (drag.card) handleDrop("field")(drag.card, drag.fromZone, drag.bfIndex); } : undefined}>
        <RiftCell label="Base" className="h-full w-full">
          <StackedCards cards={p?.field || []} cardW={40} renderCard={c =>
            <GameCard card={c} zone={isMeRow ? "field" : "opp-field"} isMe={isMeRow} size="fill"
              onTap={isMeRow ? onCardTap : undefined} onLongPress={isMeRow ? onCardLongPress : undefined} />
          } />
        </RiftCell>
      </div>
    );
    const legendCell = (
      <RiftCell key="legend" label="Legend" accent="amber" className="shrink-0" style={{ width: 79 }}
        onClick={() => p?.legendCard && setZoom(p.legendCard)}>
        {p?.legendCard
          ? <GameCard card={p.legendCard} zone={isMeRow ? "legend" : "opp-legend"} isMe={false} size="fill" className="w-[42px] h-[58px]" />
          : <span className="text-amber-500/40 text-lg">♛</span>}
      </RiftCell>
    );
    const champCell = (
      <RiftCell key="champ" label="Champion" accent="purple" className="shrink-0" style={{ width: 79 }}>
        <StackedCards cards={p?.champion || []} cardW={42} renderCard={c =>
          <GameCard card={c} zone={isMeRow ? "champion" : "opp-champion"} isMe={isMeRow} size="fill"
            onTap={isMeRow ? onCardTap : undefined} onLongPress={isMeRow ? onCardLongPress : undefined} />
        } />
      </RiftCell>
    );
    const deckCell = (
      <RiftCell key="deck" label="Deck" className="shrink-0" style={{ width: 79 }}
        onClick={isMeRow && isMyTurn ? () => send({ type: "DRAW" }) : undefined}>
        <CardBack className="w-[42px] h-[58px]" />
        <span className="absolute bottom-0.5 text-[8px] text-white/30">{p?.deckSize ?? 0}</span>
      </RiftCell>
    );
    const trashCell = (
      <RiftCell key="trash" label="Défausse" className="shrink-0" style={{ width: 79 }}
        onClick={() => setZoneViewer({ title: isMeRow ? "Ma défausse" : "Défausse adv.", cards: p?.graveyard || [], isMe: isMeRow })}>
        {p?.graveyard?.length > 0
          ? <GameCard card={p.graveyard[p.graveyard.length - 1]} zone="gy" isMe={false} size="fill" className="w-[42px] h-[58px]" />
          : <span className="text-[9px] text-white/20">{p?.graveyardSize ?? 0}</span>}
      </RiftCell>
    );

    // Ordre ME: RunesDeck | Runes | Base | Legend | Champion | Deck | Trash
    // Ordre OPP (miroir): Trash | Deck | Champion | Legend | Base | Runes | RunesDeck
    const cells = isMeRow
      ? [runeDeckCell, runesCell, baseCell, legendCell, champCell, deckCell, trashCell]
      : [trashCell, deckCell, champCell, legendCell, baseCell, runesCell, runeDeckCell];

    return <div className="flex h-full w-full gap-px">{cells}</div>;
  };

  // ── helpers de rendu de section ──
  const oppIdx = myIdx === 0 ? 1 : 0;

  const renderBFColumns = (forMe) => bfs.map(bf => {
    const pIdx = forMe ? myIdx : oppIdx;
    const units = bf.units[pIdx] || [];
    const foeUnits = bf.units[forMe ? oppIdx : myIdx] || [];
    const hasCombat = forMe && units.length > 0 && foeUnits.length > 0;
    return (
      <div key={bf.id} className="layout-board-section flex flex-col relative"
        style={{ flex: 1, height: "24.25vh", margin: "0.25vh" }}
        onDragOver={forMe ? e => e.preventDefault() : undefined}
        onDrop={forMe ? e => { e.preventDefault(); if (drag.card) handleDropToBF(drag.card, drag.fromZone, bf.id); } : undefined}>

        {/* Carte BF flottante (cachée côté adversaire par CSS .opponent-section .section-top-visual { display:none }) */}
        <div className="section-top-visual">
          <div className="board-section relative h-full w-full" style={{ cursor: forMe ? "pointer" : "default" }}
            onClick={() => forMe && bf.card && setZoom(bf.card)}>
            <div className="blurred-background" />
            {bf.card?.image_small
              ? <img src={bf.card.image_small} className="absolute inset-0 w-full h-full"
                  style={{ objectFit: "cover", borderRadius: "1vh", opacity: 0.9 }} alt={bf.card.name} />
              : <div className="absolute inset-0" style={{ borderRadius: "1vh", background: "#1a2535" }} />}
            <div style={{ position: "absolute", bottom: "0.5vh", left: 0, right: 0, textAlign: "center",
              fontSize: "1.4vh", fontWeight: 700, color: "white", textShadow: "0 0 0.5vh black", padding: "0 0.5vh" }}>
              {bf.card?.name || `BF ${bf.id + 1}`}
            </div>
          </div>
        </div>

        {/* Zone d'unités (marginTop:auto pour pousser en bas) */}
        <div className="board-section-wrapper w-full relative" style={{ marginTop: "auto", flex: 1 }}>
          <div className={`board-section mouse-dropable-section flex flex-row h-full w-full items-center justify-center relative section-B${bf.id + 1}`}
            style={{ gap: "0.5vh", padding: "0.5vh" }}>
            <div className="blurred-background" />
            <div className="section-title">{bf.card?.name || `BF ${bf.id + 1}`}</div>
            {units.map(card => (
              <div key={card.instanceId} style={{ height: "85%", aspectRatio: "63/88", position: "relative", zIndex: 1 }}>
                <GameCard card={card} zone={forMe ? "bf" : "bf-opp"} bfIndex={bf.id} isMe={forMe} size="fill"
                  onTap={forMe ? onCardTap : undefined} onLongPress={forMe ? onCardLongPress : undefined} />
              </div>
            ))}
            {hasCombat && (
              <button onClick={() => handleResolveCombat(bf.id)}
                className="absolute bottom-1 right-1 z-10 text-xs font-bold px-2 py-0.5 rounded"
                style={{ background: "#7f1d1d", color: "#fecaca", fontSize: "1vh" }}>
                ⚔️ Combat
              </button>
            )}
          </div>
        </div>
      </div>
    );
  });

  const renderZoneRow = (forMe) => {
    const p = forMe ? me : opp;
    return (
      <div className="layout-board-section flex flex-row" style={{ flex: 1, gap: "0.25vh" }}>

        {/* Runes Deck */}
        <div className="board-section-wrapper" style={{ width: "auto" }}>
          <div className={`board-section alignment-Deck section-Runes relative h-full flex flex-col items-center justify-center ${forMe ? "cursor-pointer" : ""}`}
            style={{ padding: "0.5vh", minWidth: "7vh" }}
            onClick={forMe ? () => send({ type: "DRAW" }) : undefined}>
            <div className="blurred-background" />
            <div className="mouse-dropable-section flex flex-col items-center justify-center h-full w-full relative" style={{ zIndex: 1 }}>
              <div style={{ height: "70%", aspectRatio: "63/88", background: "#1a2535", borderRadius: "0.5vh" }} />
              <div className="section-card-count">{forMe ? (p?.deckSize ?? 0) : (p?.runeDeckSize ?? 0)}</div>
            </div>
            <div className="section-title">{forMe ? "Deck" : "R.Deck"}</div>
          </div>
        </div>

        {/* Mana (runes actives) */}
        <div className="board-section-wrapper" style={{ width: "35%" }}>
          <div className="board-section alignment-Center section-Mana relative h-full">
            <div className="blurred-background" />
            <div className="mouse-dropable-section flex flex-row h-full items-center relative" style={{ gap: "0.3vh", padding: "0.5vh", zIndex: 1 }}>
              <div className="section-title">Mana</div>
              {(p?.runeHand || []).map(card => (
                <div key={card.instanceId} style={{ height: "85%", aspectRatio: "63/88", cursor: forMe && !card.exhausted ? "pointer" : "default",
                  opacity: card.exhausted ? 0.5 : 1 }}
                  onClick={forMe && !card.exhausted ? () => isMyTurn && send({ type: "EXHAUST_RUNE", instanceId: card.instanceId }) : undefined}>
                  <GameCard card={card} zone="runeHand" isMe={forMe} size="fill" />
                </div>
              ))}
              {!(p?.runeHand?.length) && <span style={{ fontSize: "1.2vh", color: "rgba(255,255,255,0.2)" }}>—</span>}
            </div>
          </div>
        </div>

        {/* Base */}
        <div className="board-section-wrapper" style={{ flex: 1 }}
          onDragOver={forMe ? e => e.preventDefault() : undefined}
          onDrop={forMe ? e => { e.preventDefault(); if (drag.card) handleDrop("field")(drag.card, drag.fromZone, drag.bfIndex); } : undefined}>
          <div className="board-section alignment-Center section-Base relative h-full">
            <div className="blurred-background" />
            <div className="mouse-dropable-section flex flex-row h-full items-center relative" style={{ gap: "0.3vh", padding: "0.5vh", zIndex: 1 }}>
              <div className="section-title">Base</div>
              {(p?.field || []).map(card => (
                <div key={card.instanceId} style={{ height: "85%", aspectRatio: "63/88" }}>
                  <GameCard card={card} zone={forMe ? "field" : "opp-field"} isMe={forMe} size="fill"
                    onTap={forMe ? onCardTap : undefined} onLongPress={forMe ? onCardLongPress : undefined} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="board-section-wrapper" style={{ width: "10.2vh" }}>
          <div className="board-section alignment-Center section-Legend relative h-full"
            onClick={() => p?.legendCard && setZoom(p.legendCard)} style={{ cursor: p?.legendCard ? "pointer" : "default" }}>
            <div className="blurred-background" />
            <div className="flex items-center justify-center h-full relative" style={{ zIndex: 1, padding: "0.5vh" }}>
              {p?.legendCard
                ? <div style={{ height: "85%", aspectRatio: "63/88" }}>
                    <GameCard card={p.legendCard} zone={forMe ? "legend" : "opp-legend"} isMe={forMe} size="fill" />
                  </div>
                : <span style={{ fontSize: "3vh", color: "rgba(180,140,30,0.3)" }}>♛</span>}
            </div>
            <div className="section-title">Legend</div>
          </div>
        </div>

        {/* Champion */}
        <div className="board-section-wrapper" style={{ width: "10.2vh" }}>
          <div className="board-section alignment-Center section-Champion relative h-full">
            <div className="blurred-background" />
            <div className="flex flex-col items-center justify-center h-full relative" style={{ zIndex: 1, padding: "0.3vh", gap: "0.3vh" }}>
              {(p?.champion || []).map((card, i) => (
                <div key={card.instanceId} style={{ height: `${85 / Math.max(1, p.champion.length)}%`, aspectRatio: "63/88" }}>
                  <GameCard card={card} zone={forMe ? "champion" : "opp-champion"} isMe={forMe} size="fill"
                    onTap={forMe ? onCardTap : undefined} onLongPress={forMe ? onCardLongPress : undefined} />
                </div>
              ))}
            </div>
            <div className="section-title">Champion</div>
          </div>
        </div>

        {/* Défausse (seulement côté joueur) */}
        {forMe && (
          <div className="board-section-wrapper" style={{ width: "auto" }}>
            <div className="board-section alignment-Deck relative h-full flex flex-col items-center justify-center"
              style={{ padding: "0.5vh", minWidth: "7vh", cursor: "pointer" }}
              onClick={() => setZoneViewer({ title: "Ma défausse", cards: p?.graveyard || [], isMe: true })}>
              <div className="blurred-background" />
              <div className="flex flex-col items-center justify-center h-full w-full relative" style={{ zIndex: 1 }}>
                {p?.graveyard?.length > 0
                  ? <div style={{ height: "70%", aspectRatio: "63/88" }}>
                      <GameCard card={p.graveyard[p.graveyard.length - 1]} zone="gy" isMe={false} size="fill" />
                    </div>
                  : <span style={{ fontSize: "2.5vh", color: "#374151" }}>💀</span>}
                <div className="section-card-count">{p?.graveyardSize ?? 0}</div>
              </div>
              <div className="section-title">Défausse</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="game fixed inset-0 overflow-hidden select-none flex flex-row" style={{ background: "#0a0f1a" }}>

      {/* ══ LEFT BAR ══ */}
      <div className="left-bar flex flex-col items-center py-3 gap-3"
        style={{ width: "10vh", minWidth: 56, background: "#06090f", borderRight: "1px solid #1a2235", zIndex: 100 }}>

        {/* Score adversaire */}
        <div className="flex flex-col items-center gap-1 w-full px-2">
          <div style={{ fontSize: "1.4vh", fontWeight: 700, color: "#9ca3af" }}>{opp?.score ?? 0}<span style={{ color: "#374151" }}>/8</span></div>
          <div style={{ width: "100%", height: 3, background: "#1a2235", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${Math.min((opp?.score ?? 0) / 8, 1) * 100}%`, height: "100%", background: "#6b7280" }} />
          </div>
        </div>

        {/* Fin de tour */}
        <button onClick={() => isMyTurn && send({ type: "FIN_TOUR" })} disabled={!isMyTurn}
          style={{ width: "calc(100% - 8px)", padding: "1vh 0", fontSize: "1.1vh", fontWeight: 700, lineHeight: 1.3,
            background: isMyTurn ? "linear-gradient(135deg,#1a6b3a,#22c55e)" : "#1f2937",
            color: isMyTurn ? "#fff" : "#4b5563", border: "none", borderRadius: "0.5vh", cursor: isMyTurn ? "pointer" : "default",
            whiteSpace: "pre-line", transition: "background 0.2s" }}>
          {isMyTurn ? "Fin\ndu tour" : "Tour\nAdv."}
        </button>

        {/* Tour + énergie */}
        <div className="text-center" style={{ fontSize: "1.1vh", color: "#94a3b8", lineHeight: 1.6 }}>
          <div>T{room.turn ?? 1}</div>
          <div style={{ color: "#60a5fa" }}>⚡{me?.energy ?? 0}</div>
          <div style={{ color: "#374151", fontSize: "0.9vh" }}>{code}</div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions secondaires */}
        <button onClick={() => isMyTurn && setTokenPicker(true)} disabled={!isMyTurn}
          style={{ background: "none", border: "none", fontSize: "1.8vh", cursor: isMyTurn ? "pointer" : "default",
            opacity: isMyTurn ? 1 : 0.3, color: "#9ca3af" }}>🪙</button>
        <button onClick={() => setZoneViewer({ title: "Mes banissements", cards: me?.banishment || [], isMe: false })}
          style={{ background: "none", border: "none", fontSize: "1.1vh", color: "#4b5563", cursor: "pointer" }}>
          🚫{me?.banishmentSize ?? 0}
        </button>
        <button onClick={() => setGameMenu(true)}
          style={{ background: "none", border: "none", fontSize: "1.8vh", color: "#4b5563", cursor: "pointer" }}>☰</button>

        {/* Score joueur */}
        <div className="flex flex-col items-center gap-1 w-full px-2">
          <div style={{ width: "100%", height: 3, background: "#1a2235", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${Math.min((me?.score ?? 0) / 8, 1) * 100}%`, height: "100%", background: "#eab308" }} />
          </div>
          <div style={{ fontSize: "1.4vh", fontWeight: 700, color: "#eab308" }}>{me?.score ?? 0}<span style={{ color: "#374151" }}>/8</span></div>
        </div>
      </div>

      {/* ══ BOARD PRINCIPAL ══ */}
      <div className="flex flex-col" style={{ flex: 1, minWidth: 0, position: "relative" }}>

        {/* ── SECTION ADVERSAIRE (h-50, CSS rotate 180°) ── */}
        <div className="opponent-section flex flex-col w-full relative" style={{ height: "50%" }}>
          <div className="background player-playmat absolute left-0 top-0 w-full h-full"
            style={{ backgroundImage: "url(https://russeus.github.io/RB-TCG-Arena/Images/PM_Volibear-1.png)" }} />
          <div className="justify-content-after flex flex-col w-full h-full relative">
            {/* Board 38vh */}
            <div style={{ height: "38vh" }}>
              <div className="layout-board-section flex flex-col h-full">
                {/* Ligne BF */}
                <div className="layout-board-section flex flex-row" style={{ height: "24.25vh" }}>
                  {bfs.length > 0 ? renderBFColumns(false)
                    : <div className="flex-1 flex items-center justify-center" style={{ color: "#374151", fontSize: "1rem" }}>Aucun Battlefield</div>}
                </div>
                {/* Ligne zones */}
                {renderZoneRow(false)}
              </div>
            </div>
            {/* Main adversaire (face cachée, absolute bottom) */}
            <div className="hand-board-section">
              <div className="hand flex flex-row items-end h-full" style={{ gap: "0.4vh", padding: "0.3vh", overflow: "hidden" }}>
                {Array.from({ length: opp?.handSize ?? 0 }).map((_, i) => (
                  <div key={i} style={{ height: "100%", aspectRatio: "63/88", background: "#1a2535", borderRadius: "0.5vh", flexShrink: 0 }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── MA SECTION (h-50, player-section current-player) ── */}
        <div className="player-section current-player flex flex-col w-full relative" style={{ height: "50%" }}>
          <div className="background player-playmat absolute left-0 top-0 w-full h-full"
            style={{ backgroundImage: "url(https://russeus.github.io/RB-TCG-Arena/Images/PM_Yasuo-1.png)" }} />
          <div className="justify-content-after flex flex-col w-full h-full relative">
            {/* Board 38vh */}
            <div style={{ height: "38vh" }}>
              <div className="layout-board-section flex flex-col h-full">
                {/* Ligne BF */}
                <div className="layout-board-section flex flex-row" style={{ height: "24.25vh" }}>
                  {bfs.length > 0 ? renderBFColumns(true)
                    : <div className="flex-1 flex items-center justify-center" style={{ color: "#374151", fontSize: "1rem" }}>Aucun BF — glissez depuis la Base</div>}
                </div>
                {/* Ligne zones */}
                {renderZoneRow(true)}
              </div>
            </div>
            {/* Ma main (absolute bottom) */}
            <div className="hand-board-section">
              <div className="hand flex flex-row items-end h-full" style={{ gap: "0.5vh", padding: "0.5vh", overflowX: "auto" }}>
                {(me?.hand || []).map(card => (
                  <div key={card.instanceId} style={{ height: "100%", aspectRatio: "63/88", cursor: "pointer", flexShrink: 0 }}
                    onClick={() => setMenu({ card, zone: "hand", bfIndex: null })}>
                    <GameCard card={card} zone="hand" isMe size="fill" className="h-full w-auto" />
                  </div>
                ))}
                {!me?.hand?.length && <span style={{ color: "#374151", alignSelf: "center", padding: "0 1vh", fontSize: "1.2vh" }}>Main vide</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ TOAST ERREUR ══ */}
      {error && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg"
          style={{ background: "#7f1d1d", color: "#fecaca", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
          {error}
        </div>
      )}

      {/* ══ GAME LOG ══ */}
      <div className="fixed" style={{ bottom: "0.5vh", right: "0.5vh", zIndex: 200 }}>
        <GameLog log={room.log || []} myPlayerIndex={myIdx} />
      </div>

      {/* ══ MODALES ══ */}
      {gameMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setGameMenu(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-t-2xl w-full max-w-sm p-4 space-y-2" onClick={e => e.stopPropagation()}>
            <p className="text-xs text-gray-500 text-center pb-1">Menu partie — {code}</p>
            <button onClick={() => { toggleFullscreen(); setGameMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white hover:bg-gray-800">
              <span className="text-lg">{isFullscreen ? "⊡" : "⛶"}</span>
              {isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            </button>
            <button onClick={() => { toggleLang(); setGameMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white hover:bg-gray-800">
              <span className="text-lg">{lang === "fr" ? "🇫🇷" : "🇬🇧"}</span>
              Langue : {lang === "fr" ? "Français" : "English"}
            </button>
            <button onClick={() => navigate("/decks")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-yellow-400 hover:bg-gray-800">
              <span className="text-lg">🚪</span>Quitter la partie
            </button>
            <button onClick={() => { logout(); navigate("/login"); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-gray-800">
              <span className="text-lg">⏻</span>Déconnexion
            </button>
            <button onClick={() => setGameMenu(false)} className="w-full py-3 text-sm text-gray-500 hover:text-gray-300">Annuler</button>
          </div>
        </div>
      )}
      {menu && (
        <CardMenu card={menu.card} zone={menu.zone} bfIndex={menu.bfIndex}
          battlefields={bfs} onAction={(a) => { if (a === "__zoom__") { setZoom(menu.card); return; } send(a); }}
          onClose={() => setMenu(null)} myEnergy={me?.energy ?? 0}
          myRuneCount={(me?.runeHand || []).filter(r => !r.exhausted).length} />
      )}
      {zoom && <CardZoom card={zoom} onClose={() => setZoom(null)} />}
      {zoneViewer && (
        <ZoneViewer title={zoneViewer.title} cards={zoneViewer.cards} isMe={zoneViewer.isMe}
          onAction={(a) => { send(a); setZoneViewer(null); }}
          onClose={() => setZoneViewer(null)} onZoom={(card) => setZoom(card)} />
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
  const [mySocketId, setMySocketId] = useState(null);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user]);

  if (!user) return null;

  const onJoined = (c, r) => {
    const sid = getSocket().id;
    setMySocketId(sid);
    setCode(c);
    setRoom(r);
    setPhase(r.phase);
  };

  const onState = (newRoom) => { setRoom(newRoom); setPhase(newRoom.phase); };

  if (phase === "lobby") return <Lobby onJoined={onJoined} />;
  if (!mySocketId || !room) return null;
  if (phase === "deck_select") return <DeckSelect code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  if (phase === "battlefield_select") return <BattlefieldSelect code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  if (phase === "mulligan") return <Mulligan code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  return <Board room={room} mySocketId={mySocketId} code={code} />;
}
