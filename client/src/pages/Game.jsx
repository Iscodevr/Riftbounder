import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useApi } from "../hooks/useApi";
import { getSocket, useSocket } from "../hooks/useSocket";

const drag = { card: null, fromZone: null };

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
    if (code.trim().length !== 4) return setError("Code de 4 caractères");
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
            <button onClick={() => create(true)} className="btn-ghost w-full text-gray-500">🧪 Tester seul</button>
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
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${selected === d.id ? "border-gold-500 bg-gold-500/10 text-white" : "border-gray-700 text-gray-300 hover:border-gray-500"}`}>
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
  const battlefields = me?.battlefields || [];
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
          {battlefields.length > 0 && (
            <div className="flex gap-3 flex-wrap justify-center max-w-lg">
              {battlefields.map((c) => (
                <div key={c.instanceId} onClick={() => select(c.instanceId)}
                  className="cursor-pointer border-2 border-gray-700 hover:border-gold-400 rounded-xl overflow-hidden transition-all w-32">
                  {c.image_small
                    ? <img src={c.image_small} alt={c.name} className="w-full aspect-[3.5/2.5] object-cover" />
                    : <div className="w-full aspect-[3.5/2.5] bg-gray-800 flex items-center justify-center text-xs text-gray-500 p-1">{c.name}</div>}
                  <p className="text-xs text-center text-gray-300 p-1 truncate">{c.name}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => select(null)} className="btn-ghost text-sm px-4">
            {battlefields.length === 0 ? "Continuer sans Battlefield" : "Passer"}
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
    if (n.size >= 2) return s; // max 2
    n.add(id); return n;
  });

  const confirm = () => {
    setSent(true);
    getSocket().emit("game:mulligan", { code, returnInstanceIds: [...toReturn] });
  };

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-4 gap-4 overflow-y-auto">
      <h2 className="text-xl font-bold text-white">Mulligan</h2>
      <p className="text-sm text-gray-400 text-center">
        Sélectionne jusqu'à <span className="text-gold-400 font-bold">2 cartes</span> à remplacer.
        {toReturn.size > 0 ? ` (${toReturn.size} sélectionnée${toReturn.size > 1 ? "s" : ""})` : ""}
      </p>
      <div className="flex gap-2 text-xs">
        <div className={`px-3 py-1 rounded-lg ${me?.mulliganDone ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-300"}`}>Toi {me?.mulliganDone ? "✓" : "…"}</div>
        <div className={`px-3 py-1 rounded-lg ${opp?.mulliganDone ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-400"}`}>Adversaire {opp?.mulliganDone ? "✓" : "…"}</div>
      </div>
      {!sent ? (
        <>
          {/* Main cards */}
          <div className="flex gap-2 flex-wrap justify-center max-w-2xl">
            {hand.map((card) => {
              const marked = toReturn.has(card.instanceId);
              return (
                <div key={card.instanceId} onClick={() => toggle(card.instanceId)}
                  className={`cursor-pointer border-2 rounded-xl overflow-hidden transition-all w-20 sm:w-24 ${marked ? "border-red-500 opacity-60" : "border-gray-700 hover:border-gold-400"}`}>
                  {card.image_small
                    ? <img src={card.image_small} alt={card.name} className="w-full aspect-[2.5/3.5] object-cover" draggable={false} />
                    : <div className="w-full aspect-[2.5/3.5] bg-gray-800 flex items-center justify-center text-xs text-gray-500 p-1">{card.name}</div>}
                  <p className="text-[10px] text-center px-1 pb-1 text-gray-400">{marked ? "✗ Remplacer" : "✓ Garder"}</p>
                </div>
              );
            })}
          </div>
          {/* Starting runes info */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Runes de départ :</span>
            <div className="flex gap-1">
              {runeHand.map((c) => (
                <div key={c.instanceId} className="w-8 h-11 rounded overflow-hidden border border-gray-700">
                  {c.image_small
                    ? <img src={c.image_small} alt={c.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gray-800" />}
                </div>
              ))}
            </div>
            <span className="text-gold-400">({runeHand.length})</span>
          </div>
          <button onClick={confirm} className="btn-primary px-8">
            {toReturn.size === 0 ? "Garder ma main" : `Remplacer ${toReturn.size} carte${toReturn.size > 1 ? "s" : ""}`}
          </button>
        </>
      ) : <p className="text-gray-400">En attente de l'adversaire…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

// ── Game card ─────────────────────────────────────────────────────────────────
function GameCard({ card, zone, isMe, onTap, onLongPress, small = false }) {
  const pressTimer = useRef(null);
  const w = small ? "w-9" : "w-13 sm:w-15";
  const h = small ? "h-12" : "h-[68px] sm:h-[80px]";
  const faceDown = card.faceDown;

  const handleDragStart = (e) => {
    drag.card = card; drag.fromZone = zone;
    e.dataTransfer.effectAllowed = "move";
  };
  const startPress = () => { pressTimer.current = setTimeout(() => { onLongPress?.(card, zone); }, 600); };
  const endPress = (e) => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };
  const handleClick = () => { if (!faceDown && isMe) onTap?.(card, zone); };

  return (
    <div
      draggable={isMe && !faceDown}
      onDragStart={isMe && !faceDown ? handleDragStart : undefined}
      onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
      onTouchStart={startPress} onTouchEnd={endPress}
      onClick={handleClick}
      className={`relative flex-shrink-0 ${w} ${h} rounded-md overflow-hidden border transition-all cursor-pointer select-none
        ${card.exhausted ? "border-gray-600" : "border-gray-700 hover:border-gold-400"}`}
      style={card.exhausted ? { transform: "rotate(90deg)", transformOrigin: "center" } : undefined}
    >
      {faceDown ? (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600">🂠</div>
      ) : card.image_small ? (
        <img src={card.image_small} alt={card.name} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center p-0.5">
          <span className="text-[7px] text-gray-400 text-center leading-tight">{card.name}</span>
        </div>
      )}
      {!faceDown && card.counters > 0 && (
        <div className="absolute bottom-0.5 right-0.5 bg-gold-500 text-gray-950 text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">{card.counters}</div>
      )}
      {!faceDown && card.hidden && (
        <div className="absolute top-0.5 left-0.5 w-2 h-2 bg-purple-600 rounded-full" />
      )}
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ label, icon, cards = [], onDrop, onCardTap, onCardLongPress, isMe, small = false, className = "", flipped = false }) {
  const [over, setOver] = useState(false);
  const handleDragOver = (e) => { e.preventDefault(); setOver(true); };
  const handleDragLeave = () => setOver(false);
  const handleDrop = (e) => { e.preventDefault(); setOver(false); if (drag.card) onDrop?.(drag.card, drag.fromZone); };
  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      className={`flex flex-wrap gap-0.5 content-start rounded-lg border transition-colors p-0.5 ${over ? "border-gold-400 bg-gold-400/5" : "border-gray-800/50 bg-black/20"} ${className}`}>
      {label && cards.length === 0 && (
        <span className="text-[9px] text-gray-700 self-center w-full text-center py-1">{icon} {label}</span>
      )}
      {cards.map((card) => (
        <GameCard key={card.instanceId} card={card} zone={label} isMe={isMe} small={small}
          onTap={onCardTap} onLongPress={onCardLongPress} />
      ))}
    </div>
  );
}

// ── Card menu ─────────────────────────────────────────────────────────────────
function CardMenu({ card, zone, onAction, onClose }) {
  const fromHand = zone === "hand" || zone === "runeHand";
  const actions = fromHand ? [
    { label: "→ Légende", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "legend" } },
    { label: "→ Champion", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "champion" } },
    { label: "→ Champ", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "field" } },
    { label: "→ Sort", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "spellZone" } },
    { label: "Défausser", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "graveyard" } },
  ] : [
    { label: card.exhausted ? "Désépuiser" : "Épuiser", action: { type: "EXHAUST", instanceId: card.instanceId } },
    { label: "+1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: 1 } },
    { label: "-1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: -1 } },
    { label: card.hidden ? "Révéler" : "Cacher", action: { type: "HIDE", instanceId: card.instanceId } },
    { label: "→ Main", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "hand" } },
    { label: "→ Défausse", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "graveyard" } },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl w-full max-w-xs p-2 space-y-0.5" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs text-gray-500 px-3 pt-1 pb-1.5 font-semibold truncate">{card.name || "Carte"}</p>
        {actions.map((a) => (
          <button key={a.label} onClick={() => { onAction(a.action); onClose(); }}
            className="w-full text-left px-4 py-2 rounded-xl text-sm text-white hover:bg-gray-800 transition-colors">{a.label}</button>
        ))}
        <button onClick={onClose} className="w-full text-center px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-800">Annuler</button>
      </div>
    </div>
  );
}

// ── Rune row ──────────────────────────────────────────────────────────────────
function RuneRow({ p, isMe, onCardTap, onCardLongPress, onDrop, onDrawRune }) {
  const MAX_SLOTS = 6;
  const runes = p?.runeHand || [];
  return (
    <div className="flex items-center gap-1 h-full">
      {/* Pioche rune */}
      {isMe ? (
        <button onClick={onDrawRune}
          className="w-10 h-full shrink-0 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/50 rounded text-[9px] text-blue-400 flex flex-col items-center justify-center gap-0.5 transition-colors">
          <span className="text-sm">🔷</span><span>{p?.runeDeckSize ?? 0}</span>
        </button>
      ) : (
        <div className="w-10 h-full shrink-0 bg-blue-950/20 border border-blue-900/30 rounded text-[9px] text-blue-700 flex flex-col items-center justify-center gap-0.5">
          <span className="text-sm">🔷</span><span>{p?.runeDeckSize ?? 0}</span>
        </div>
      )}
      {/* Emplacements rune */}
      {Array.from({ length: MAX_SLOTS }).map((_, i) => {
        const card = runes[i];
        if (!card) return (
          <div key={i} className="flex-1 h-full rounded border border-dashed border-blue-900/30 bg-blue-950/10 flex items-center justify-center min-w-0">
            <span className="text-[7px] text-blue-900/40">◇</span>
          </div>
        );
        if (!isMe) return (
          <div key={card.instanceId} className="flex-1 h-full rounded overflow-hidden border border-blue-800/40 bg-blue-950/30 flex items-center justify-center min-w-0">
            <span className="text-[10px] text-blue-600">🔷</span>
          </div>
        );
        return (
          <div key={card.instanceId} className="flex-1 h-full rounded overflow-hidden border border-blue-700/50 min-w-0">
            <GameCard card={card} zone="runeHand" isMe small onTap={onCardTap} onLongPress={onCardLongPress} />
          </div>
        );
      })}
      {/* Runes supplémentaires au-delà de MAX_SLOTS */}
      {runes.slice(MAX_SLOTS).map((card) => (
        <div key={card.instanceId} className="w-8 h-full rounded overflow-hidden border border-blue-700/50 shrink-0">
          {isMe ? <GameCard card={card} zone="runeHand" isMe small onTap={onCardTap} onLongPress={onCardLongPress} /> : <div className="w-full h-full bg-blue-950/30" />}
        </div>
      ))}
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
    "game:opponent_left": () => setError("L'adversaire a quitté."),
  });

  const me = room.players.find((p) => p.socketId === mySocketId);
  const opp = room.players.find((p) => p.socketId !== mySocketId);
  const send = useCallback((action) => getSocket().emit("game:action", { code, action }), [code]);

  const onCardTap = (card, zone) => {
    const tapExhaust = ["legend", "champion", "field", "spellZone", "runeHand"];
    if (tapExhaust.includes(zone)) send({ type: "EXHAUST", instanceId: card.instanceId });
    else setMenu({ card, zone });
  };
  const onCardLongPress = (card, zone) => setMenu({ card, zone });
  const handleDrop = (toZone) => (card, fromZone) => {
    if (fromZone === "hand" || fromZone === "runeHand") send({ type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: toZone });
    else send({ type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone });
  };

  // BF background for my side
  const myBfImg = me?.battlefieldCard?.image_large || me?.battlefieldCard?.image_small;
  const oppBfImg = opp?.battlefieldCard?.image_large || opp?.battlefieldCard?.image_small;

  const BFSlot = ({ p, img }) => (
    <div className="flex-1 h-full rounded border border-gray-700/40 overflow-hidden flex items-center justify-center bg-black/20">
      {img
        ? <img src={img} alt="" className="w-full h-full object-cover opacity-80" />
        : <span className="text-[8px] text-gray-800">Battlefield</span>}
    </div>
  );

  const DeckBtn = ({ p, isMe }) => isMe
    ? <button onClick={() => send({ type: "DRAW" })} className="w-11 h-full shrink-0 bg-gray-800/60 hover:bg-gray-700 border border-gray-700 rounded text-[9px] text-gray-400 flex flex-col items-center justify-center gap-0.5 transition-colors"><span>🂠</span><span>{p?.deckSize ?? 0}</span></button>
    : <div className="w-11 h-full shrink-0 bg-gray-800/30 border border-gray-700/40 rounded text-[9px] text-gray-600 flex flex-col items-center justify-center gap-0.5"><span>🂠</span><span>{p?.deckSize ?? 0}</span></div>;

  const GYSlot = ({ p, isMe }) => (
    <DropZone label="GY" icon="💀" cards={(p?.graveyard || []).slice(-1)}
      onDrop={isMe ? handleDrop("graveyard") : undefined}
      onCardTap={isMe ? onCardTap : undefined} onCardLongPress={isMe ? onCardLongPress : undefined}
      isMe={isMe} className="w-11 h-full shrink-0" />
  );

  return (
    <div className="fixed inset-0 bg-gray-950 overflow-hidden select-none flex flex-col text-white"
      style={{ touchAction: "manipulation" }}>

      {/* ════ OPPONENT HALF ════ */}
      <div className="flex flex-col flex-1 min-h-0 px-1 pt-1 gap-0.5">

        {/* Opp Row 1 — Rune pioche | Rune slots | GY */}
        <div className="flex gap-1 h-[42px] shrink-0">
          <div className="w-10 h-full shrink-0 bg-blue-950/20 border border-blue-900/30 rounded text-[9px] text-blue-700 flex flex-col items-center justify-center gap-0.5">
            <span>🔷</span><span>{opp?.runeDeckSize ?? 0}</span>
          </div>
          {Array.from({ length: 6 }).map((_, i) => {
            const card = (opp?.runeHand || [])[i];
            return card
              ? <div key={card.instanceId} className="flex-1 h-full rounded overflow-hidden border border-blue-800/40 bg-blue-950/30 flex items-center justify-center"><span className="text-[10px] text-blue-600">🔷</span></div>
              : <div key={i} className="flex-1 h-full rounded border border-dashed border-blue-900/20 bg-blue-950/5" />;
          })}
          <GYSlot p={opp} isMe={false} />
        </div>

        {/* Opp Row 2 — Champion | Legend | Field | Sort | Deck */}
        <div className="flex gap-1 h-[72px] shrink-0">
          <DropZone label="⚔" icon="" cards={opp?.champion || []} isMe={false} className="w-12 shrink-0 h-full" />
          <DropZone label="👑" icon="" cards={opp?.legend || []} isMe={false} className="w-12 shrink-0 h-full" />
          <DropZone label="Base" icon="🛡" cards={opp?.field || []} isMe={false} className="flex-1 h-full overflow-x-auto" />
          <DropZone label="Sort" icon="✨" cards={opp?.spellZone || []} isMe={false} className="w-12 shrink-0 h-full" />
          <DeckBtn p={opp} isMe={false} />
        </div>

        {/* Opp Row 3 — BF1 | BF2 */}
        <div className="flex gap-1 h-[42px] shrink-0">
          <BFSlot p={opp} img={oppBfImg} />
          <BFSlot p={opp} img={null} />
          {/* Opponent hand (face down) aligned right */}
          <div className="flex gap-0.5 items-center ml-1 shrink-0">
            {(opp?.hand || []).map((c) => (
              <div key={c.instanceId} className="w-7 h-10 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-600 text-[10px]">🂠</div>
            ))}
            {(opp?.hand?.length ?? 0) === 0 && <span className="text-[9px] text-gray-700 px-1">🃏 0</span>}
          </div>
        </div>
      </div>

      {/* ════ CENTER BAR ════ */}
      <div className="shrink-0 flex items-center gap-2 px-2 py-1 bg-gray-900 border-y border-gray-800 text-[10px]">
        <span className="font-mono text-gray-700 tracking-widest">{code}</span>
        <span className="text-gray-600">Tour {room.turn ?? 1}</span>
        <div className="flex-1" />
        <button onClick={() => send({ type: "UNEXHAUST_ALL" })} className="text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-gray-800 transition-colors">↺ Désépuiser</button>
        <button onClick={() => send({ type: "DRAW_TURN" })} className="bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-400 rounded px-3 py-0.5 font-semibold transition-colors">
          Fin de tour
        </button>
      </div>

      {/* ════ MY HALF ════ */}
      <div className="flex flex-col flex-1 min-h-0 px-1 pb-1 gap-0.5">

        {/* My Row 1 — BF1 | BF2 */}
        <div className="flex gap-1 h-[42px] shrink-0 mt-0.5">
          <BFSlot p={me} img={myBfImg} />
          <BFSlot p={me} img={null} />
        </div>

        {/* My Row 2 — Champion | Legend | Field | Sort | Deck */}
        <div className="flex gap-1 flex-1 min-h-0">
          <DropZone label="Champ." icon="⚔️" cards={me?.champion || []}
            onDrop={handleDrop("champion")} onCardTap={onCardTap} onCardLongPress={onCardLongPress}
            isMe className="w-12 shrink-0 h-full" />
          <DropZone label="Légende" icon="👑" cards={me?.legend || []}
            onDrop={handleDrop("legend")} onCardTap={onCardTap} onCardLongPress={onCardLongPress}
            isMe className="w-12 shrink-0 h-full" />
          <DropZone label="Base" icon="🛡" cards={me?.field || []}
            onDrop={handleDrop("field")} onCardTap={onCardTap} onCardLongPress={onCardLongPress}
            isMe className="flex-1 h-full overflow-x-auto" />
          <DropZone label="Sort" icon="✨" cards={me?.spellZone || []}
            onDrop={handleDrop("spellZone")} onCardTap={onCardTap} onCardLongPress={onCardLongPress}
            isMe className="w-12 shrink-0 h-full" />
          <DeckBtn p={me} isMe />
        </div>

        {/* My Row 3 — RuneDeck | Rune slots | GY */}
        <div className="flex gap-1 h-[50px] shrink-0">
          <RuneRow p={me} isMe onCardTap={onCardTap} onCardLongPress={onCardLongPress}
            onDrop={handleDrop} onDrawRune={() => send({ type: "DRAW_RUNE" })} />
          <GYSlot p={me} isMe />
        </div>
      </div>

      {/* ════ HAND ════ */}
      <div className="shrink-0 flex gap-1 overflow-x-auto px-2 py-1.5 bg-gray-900/90 border-t border-gray-800 min-h-[80px] items-center">
        {(me?.hand || []).map((card) => (
          <GameCard key={card.instanceId} card={card} zone="hand" isMe
            onTap={(c, z) => setMenu({ card: c, zone: z })}
            onLongPress={(c, z) => setMenu({ card: c, zone: z })} />
        ))}
        {(me?.hand?.length ?? 0) === 0 && <span className="text-[10px] text-gray-700 px-2">Main vide</span>}
      </div>

      {error && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-red-900 text-red-200 text-xs px-4 py-2 rounded-xl z-50 shadow-lg">
          {error}
        </div>
      )}
      {menu && <CardMenu card={menu.card} zone={menu.zone} onAction={send} onClose={() => setMenu(null)} />}
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

  const onState = (newRoom) => {
    setRoom(newRoom);
    setPhase(newRoom.phase);
  };

  if (phase === "lobby") return <Lobby onJoined={(c, r) => { setCode(c); setRoom(r); setPhase(r.phase); }} />;
  if (phase === "deck_select") return <DeckSelect code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  if (phase === "battlefield_select") return <BattlefieldSelect code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  if (phase === "mulligan") return <Mulligan code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  return <Board room={room} mySocketId={mySocketId} code={code} />;
}
