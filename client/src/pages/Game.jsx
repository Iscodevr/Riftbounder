import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useApi } from "../hooks/useApi";
import { getSocket, useSocket } from "../hooks/useSocket";

// ── Drag context ─────────────────────────────────────────────────────────────
// We store drag state in a module-level ref so it survives renders
const drag = { card: null, fromZone: null };

// ── Lobby ────────────────────────────────────────────────────────────────────
function Lobby({ onJoined }) {
  const { user } = useAuth();
  const [mode, setMode] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useSocket({
    "game:joined": ({ code, room }) => onJoined(code, room),
    "game:error": (msg) => setError(msg),
  });

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
            <input className="input text-center text-2xl tracking-widest uppercase font-bold"
              maxLength={4} placeholder="CODE" value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus />
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
  useSocket({ "game:state": ({ room }) => onState(room), "game:error": (m) => setError(m) });

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
      ) : <p className="text-gray-400">Deck envoyé, en attente…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

// ── Battlefield select ────────────────────────────────────────────────────────
function BattlefieldSelect({ code, room, mySocketId, onState }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  useSocket({ "game:state": ({ room }) => onState(room), "game:error": (m) => setError(m) });

  const me = room.players.find((p) => p.socketId === mySocketId);
  const opp = room.players.find((p) => p.socketId !== mySocketId);
  const battlefields = me?.battlefields || [];

  const select = (instanceId) => {
    setSent(true);
    getSocket().emit("game:select_battlefield", { code, instanceId });
  };

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-6 gap-5">
      <h2 className="text-xl font-bold text-white">Choisis ton Battlefield</h2>
      <div className="flex gap-3 text-sm">
        <div className={`px-3 py-1.5 rounded-lg ${me?._bfDone ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-300"}`}>Toi {me?._bfDone ? "✓" : "…"}</div>
        <div className={`px-3 py-1.5 rounded-lg ${opp?._bfDone ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-400"}`}>Adversaire {opp?._bfDone ? "✓" : "…"}</div>
      </div>
      {!sent ? (
        <>
          {battlefields.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucun Battlefield dans ce deck.</p>
          ) : (
            <div className="flex gap-3 flex-wrap justify-center max-w-lg">
              {battlefields.map((c) => (
                <div key={c.instanceId} onClick={() => select(c.instanceId)}
                  className="cursor-pointer border-2 border-gray-700 hover:border-gold-400 rounded-xl overflow-hidden transition-all w-28">
                  {c.image_small
                    ? <img src={c.image_small} alt={c.name} className="w-full aspect-[3.5/2.5] object-cover" />
                    : <div className="w-full aspect-[3.5/2.5] bg-gray-800 flex items-center justify-center text-xs text-gray-500 p-1">{c.name}</div>}
                  <p className="text-xs text-center text-gray-300 p-1 truncate">{c.name}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => select(null)} className="btn-ghost text-sm px-4">
            {battlefields.length === 0 ? "Continuer sans Battlefield" : "Passer (aucun)"}
          </button>
        </>
      ) : <p className="text-gray-400">En attente de l'adversaire…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

// ── Mulligan ──────────────────────────────────────────────────────────────────
function Mulligan({ code, room, mySocketId, onState }) {
  const [kept, setKept] = useState(new Set());
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  useSocket({ "game:state": ({ room }) => onState(room), "game:error": (m) => setError(m) });

  const me = room.players.find((p) => p.socketId === mySocketId);
  const opp = room.players.find((p) => p.socketId !== mySocketId);
  const hand = me?.hand || [];

  // Start with all kept
  useEffect(() => { setKept(new Set(hand.map((c) => c.instanceId))); }, []);

  const toggle = (id) => setKept((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const confirm = () => {
    setSent(true);
    getSocket().emit("game:mulligan", { code, keepInstanceIds: [...kept] });
  };

  const toReturn = hand.length - kept.size;

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-4 gap-4">
      <h2 className="text-xl font-bold text-white">Mulligan</h2>
      <p className="text-sm text-gray-400">Clique sur les cartes à remplacer. {toReturn > 0 ? `${toReturn} carte(s) seront remplacées.` : "Main gardée intégralement."}</p>
      <div className="flex gap-3 text-xs">
        <div className={`px-3 py-1 rounded-lg ${me?.mulliganDone ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-300"}`}>Toi {me?.mulliganDone ? "✓" : "…"}</div>
        <div className={`px-3 py-1 rounded-lg ${opp?.mulliganDone ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-400"}`}>Adversaire {opp?.mulliganDone ? "✓" : "…"}</div>
      </div>
      {!sent ? (
        <>
          <div className="flex gap-2 flex-wrap justify-center max-w-2xl">
            {hand.map((card) => {
              const keep = kept.has(card.instanceId);
              return (
                <div key={card.instanceId} onClick={() => toggle(card.instanceId)}
                  className={`cursor-pointer border-2 rounded-xl overflow-hidden transition-all w-20 sm:w-24 ${keep ? "border-gold-400" : "border-red-600 opacity-50"}`}>
                  {card.image_small
                    ? <img src={card.image_small} alt={card.name} className="w-full aspect-[2.5/3.5] object-cover" />
                    : <div className="w-full aspect-[2.5/3.5] bg-gray-800 flex items-center justify-center text-xs text-gray-500 p-1">{card.name}</div>}
                  <p className="text-[10px] text-center truncate px-1 pb-1 text-gray-400">{keep ? "✓ Garder" : "✗ Changer"}</p>
                </div>
              );
            })}
          </div>
          <button onClick={confirm} className="btn-primary px-8">Confirmer ma main</button>
        </>
      ) : <p className="text-gray-400">En attente de l'adversaire…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

// ── Card component ────────────────────────────────────────────────────────────
function GameCard({ card, onTap, draggable: isDraggable = false, zone, small = false }) {
  const w = small ? "w-10" : "w-14 sm:w-16";
  const h = small ? "h-14" : "h-[76px] sm:h-[88px]";
  const faceDown = card.faceDown;

  const handleDragStart = (e) => {
    drag.card = card;
    drag.fromZone = zone;
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable={isDraggable}
      onDragStart={isDraggable ? handleDragStart : undefined}
      onClick={() => onTap?.(card, zone)}
      className={`relative flex-shrink-0 ${w} ${h} rounded-lg overflow-hidden cursor-pointer border border-gray-700 hover:border-gold-400 transition-all select-none`}
      style={card.exhausted ? { transform: "rotate(12deg)", opacity: 0.8 } : undefined}
    >
      {faceDown ? (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600 text-xl">🂠</div>
      ) : card.image_small ? (
        <img src={card.image_small} alt={card.name} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center p-1">
          <span className="text-[8px] text-gray-400 text-center leading-tight">{card.name}</span>
        </div>
      )}
      {card.counters > 0 && (
        <div className="absolute bottom-0.5 right-0.5 bg-gold-500 text-gray-950 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{card.counters}</div>
      )}
      {card.hidden && !faceDown && (
        <div className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-purple-600 rounded-full" />
      )}
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ label, cards = [], onDrop, onCardTap, isMe, small = false, className = "", single = false }) {
  const [over, setOver] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); setOver(true); };
  const handleDragLeave = () => setOver(false);
  const handleDrop = (e) => { e.preventDefault(); setOver(false); if (drag.card) onDrop?.(drag.card, drag.fromZone); };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-wrap gap-1 content-start rounded-xl border transition-colors min-h-[60px] p-1 ${over ? "border-gold-400 bg-gold-400/5" : "border-gray-800/60 bg-gray-900/40"} ${className}`}
    >
      {label && cards.length === 0 && (
        <span className="text-[10px] text-gray-700 self-center w-full text-center">{label}</span>
      )}
      {cards.map((card) => (
        <GameCard
          key={card.instanceId}
          card={card}
          zone={isMe ? "legend" : undefined}
          draggable={isMe && !card.faceDown}
          onTap={isMe ? onCardTap : undefined}
          small={small}
        />
      ))}
    </div>
  );
}

// ── Card context menu ─────────────────────────────────────────────────────────
function CardMenu({ card, zone, onAction, onClose }) {
  const actions = [];
  if (zone === "hand") {
    actions.push(
      { label: "→ Légende", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "legend" } },
      { label: "→ Champion", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "champion" } },
      { label: "→ Champ", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "field" } },
      { label: "→ Sort", action: { type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: "spellZone" } },
      { label: "Défausser", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "graveyard" } },
    );
  } else {
    actions.push(
      { label: card.exhausted ? "Désépuiser" : "Épuiser", action: { type: "EXHAUST", instanceId: card.instanceId } },
      { label: "+1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: 1 } },
      { label: "-1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: -1 } },
      { label: card.hidden ? "Révéler" : "Cacher", action: { type: "HIDE", instanceId: card.instanceId } },
      { label: "→ Main", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "hand" } },
      { label: "→ Défausse", action: { type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone: "graveyard" } },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl w-full max-w-xs p-2 space-y-1" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs text-gray-500 px-3 pt-1 pb-1 font-semibold truncate">{card.name}</p>
        {actions.map((a) => (
          <button key={a.label} onClick={() => { onAction(a.action); onClose(); }}
            className="w-full text-left px-4 py-2 rounded-xl text-sm text-white hover:bg-gray-800 transition-colors">
            {a.label}
          </button>
        ))}
        <button onClick={onClose} className="w-full text-center px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-800 transition-colors">Annuler</button>
      </div>
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

  const handleDrop = (toZone) => (card, fromZone) => {
    if (fromZone === "hand") {
      send({ type: "PLAY_TO_ZONE", instanceId: card.instanceId, zone: toZone });
    } else {
      send({ type: "MOVE_TO_ZONE", instanceId: card.instanceId, toZone });
    }
  };

  const onCardTap = (card, zone) => setMenu({ card, zone });

  const bfImg = me?.battlefieldCard?.image_large || me?.battlefieldCard?.image_small;

  // Zone label for DropZone card tap handler — always send zone name from parent
  const makeCardTap = (zone) => (card) => setMenu({ card, zone });

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col overflow-hidden select-none"
      style={{ touchAction: "manipulation" }}>

      {/* Battlefield background */}
      {bfImg && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <img src={bfImg} alt="" className="w-full h-full object-cover opacity-10" />
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-2 py-1 bg-gray-900/80 border-b border-gray-800 text-xs text-gray-400 shrink-0">
          <span>Adv · 🃏 {opp?.hand?.length ?? 0} · 🗑 {opp?.graveyardSize ?? 0}</span>
          <span className="font-mono text-gray-600 tracking-widest">{code}</span>
          <span>Deck {opp?.deckSize ?? 0}</span>
        </div>

        {/* ── Opponent board (flipped) ── */}
        <div className="shrink-0 flex gap-1 px-1 py-0.5 border-b border-gray-800/50"
          style={{ transform: "scaleY(-1)" }}>
          {/* Opp hand (face down) */}
          <div className="flex gap-0.5 items-start flex-wrap w-16 shrink-0">
            {(opp?.hand || []).map((c) => (
              <GameCard key={c.instanceId} card={{ ...c, faceDown: true }} zone="opp-hand" small />
            ))}
          </div>
          {/* Opp zones */}
          <div className="flex gap-1 flex-1 min-w-0" style={{ transform: "scaleY(-1)" }}>
            <div className="w-16 shrink-0">
              <div className="text-[9px] text-gray-600 mb-0.5">Légende</div>
              {(opp?.legend || []).map((c) => <GameCard key={c.instanceId} card={c} zone="opp-legend" small />)}
            </div>
            <div className="w-16 shrink-0">
              <div className="text-[9px] text-gray-600 mb-0.5">Champion</div>
              {(opp?.champion || []).map((c) => <GameCard key={c.instanceId} card={c} zone="opp-champion" small />)}
            </div>
            <div className="flex-1 flex flex-wrap gap-0.5 content-start">
              {(opp?.field || []).map((c) => <GameCard key={c.instanceId} card={c} zone="opp-field" small />)}
            </div>
            <div className="w-16 shrink-0 flex flex-wrap gap-0.5 content-start">
              {(opp?.spellZone || []).map((c) => <GameCard key={c.instanceId} card={c} zone="opp-spell" small />)}
            </div>
          </div>
        </div>

        {/* ── My board ── */}
        <div className="flex-1 flex gap-1 px-1 py-1 min-h-0 overflow-hidden">

          {/* Left: Legend + Champion */}
          <div className="flex flex-col gap-1 shrink-0 w-[68px]">
            <DropZone label="Légende" cards={me?.legend || []} onDrop={handleDrop("legend")}
              onCardTap={makeCardTap("legend")} isMe className="flex-1" />
            <DropZone label="Champion" cards={me?.champion || []} onDrop={handleDrop("champion")}
              onCardTap={makeCardTap("champion")} isMe className="flex-1" />
          </div>

          {/* Center: Main field */}
          <DropZone label="Champ de bataille" cards={me?.field || []} onDrop={handleDrop("field")}
            onCardTap={makeCardTap("field")} isMe className="flex-1 overflow-y-auto" />

          {/* Right: Spell zone */}
          <DropZone label="Sorts" cards={me?.spellZone || []} onDrop={handleDrop("spellZone")}
            onCardTap={makeCardTap("spellZone")} isMe className="w-[72px] overflow-y-auto shrink-0" />

          {/* Far right: Deck + GY */}
          <div className="flex flex-col gap-1 shrink-0 w-14">
            <button onClick={() => send({ type: "DRAW" })}
              className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs text-center text-gray-400 transition-colors flex flex-col items-center justify-center gap-0.5">
              <span className="text-lg">🂠</span>
              <span>{me?.deckSize ?? 0}</span>
              <span className="text-[9px]">Piocher</span>
            </button>
            <DropZone label="GY" cards={me?.graveyard?.slice(0, 1) || []} onDrop={handleDrop("graveyard")}
              onCardTap={makeCardTap("graveyard")} isMe className="h-20 shrink-0" />
          </div>
        </div>

        {/* ── Hand ── */}
        <div className="shrink-0 flex gap-1 overflow-x-auto px-1 pb-1 pt-0.5 border-t border-gray-800 bg-gray-900/60">
          {(me?.hand || []).map((card) => (
            <GameCard key={card.instanceId} card={card} zone="hand"
              draggable onTap={(c) => setMenu({ card: c, zone: "hand" })} />
          ))}
          {(me?.hand?.length ?? 0) === 0 && (
            <span className="text-xs text-gray-700 self-center px-2">Main vide</span>
          )}
        </div>

        {/* ── Bottom bar ── */}
        <div className="shrink-0 flex items-center justify-between px-2 py-1 bg-gray-900/80 border-t border-gray-800 text-xs text-gray-500">
          <span>Main : {me?.hand?.length ?? 0} · Défausse : {me?.graveyardSize ?? 0}</span>
          <span className="font-mono text-gray-700">{code}</span>
          <span>Deck : {me?.deckSize ?? 0}</span>
        </div>
      </div>

      {error && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-red-900 text-red-200 text-xs px-4 py-2 rounded-xl z-50">
          {error}
        </div>
      )}

      {menu && (
        <CardMenu card={menu.card} zone={menu.zone} onAction={send} onClose={() => setMenu(null)} />
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

  const onState = (newRoom) => {
    setRoom(newRoom);
    if (newRoom.phase !== phase) setPhase(newRoom.phase);
  };

  if (phase === "lobby") {
    return <Lobby onJoined={(c, r) => { setCode(c); setRoom(r); setPhase(r.phase); }} />;
  }

  if (phase === "deck_select") {
    return <DeckSelect code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  }

  if (phase === "battlefield_select") {
    return <BattlefieldSelect code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  }

  if (phase === "mulligan") {
    return <Mulligan code={code} room={room} mySocketId={mySocketId} onState={onState} />;
  }

  return <Board room={room} mySocketId={mySocketId} code={code} />;
}
