import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useApi } from "../hooks/useApi";
import { getSocket, useSocket } from "../hooks/useSocket";

// ─── Lobby ──────────────────────────────────────────────────────────────────

function Lobby({ onJoined }) {
  const { user } = useAuth();
  const [mode, setMode] = useState(null); // "create" | "join"
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useSocket({
    "game:joined": ({ code, room }) => onJoined(code, room),
    "game:error": (msg) => setError(msg),
  });

  const create = () => {
    setError("");
    getSocket().emit("game:create", { userId: user.id });
  };

  const join = (e) => {
    e.preventDefault();
    if (code.trim().length !== 4) return setError("Le code fait 4 caractères");
    setError("");
    getSocket().emit("game:join", { code: code.trim().toUpperCase(), userId: user.id });
  };

  return (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-white text-center">Jouer une partie</h1>

        {!mode && (
          <div className="space-y-3">
            <button onClick={create} className="btn-primary w-full">Créer une partie</button>
            <button onClick={() => setMode("join")} className="btn-ghost w-full">Rejoindre avec un code</button>
          </div>
        )}

        {mode === "join" && (
          <form onSubmit={join} className="space-y-3">
            <input
              className="input text-center text-2xl tracking-widest uppercase font-bold"
              maxLength={4}
              placeholder="CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoFocus
            />
            <button type="submit" className="btn-primary w-full">Rejoindre</button>
            <button type="button" onClick={() => setMode(null)} className="btn-ghost w-full">Retour</button>
          </form>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}

// ─── Deck selection ──────────────────────────────────────────────────────────

function DeckSelect({ code, room, mySocketId, onStarted }) {
  const api = useApi();
  const [decks, setDecks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.get("/decks").then(setDecks).catch(console.error); }, []);

  useSocket({
    "game:started": ({ room }) => onStarted(room),
    "game:state": ({ room }) => { /* waiting for opponent to pick */ },
    "game:error": (msg) => setError(msg),
    "game:opponent_left": () => setError("L'adversaire a quitté la partie."),
  });

  const me = room.players.find((p) => p.socketId === mySocketId);
  const opponent = room.players.find((p) => p.socketId !== mySocketId);

  const confirm = () => {
    if (!selected) return;
    setSent(true);
    getSocket().emit("game:set_deck", { code, deckId: selected });
  };

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-6 gap-6">
      <h2 className="text-xl font-bold text-white">Choisis ton deck</h2>

      <div className="flex gap-3 text-sm text-center">
        <div className={`px-4 py-2 rounded-lg ${me?.ready ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-300"}`}>
          Toi {me?.ready ? "✓" : "…"}
        </div>
        <div className={`px-4 py-2 rounded-lg ${opponent?.ready ? "bg-green-800 text-green-200" : "bg-gray-800 text-gray-400"}`}>
          Adversaire {opponent ? (opponent.ready ? "✓" : "…") : "en attente…"}
        </div>
      </div>

      {!sent ? (
        <>
          <div className="w-full max-w-sm space-y-2 max-h-64 overflow-y-auto">
            {decks.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelected(d.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                  selected === d.id
                    ? "border-gold-500 bg-gold-500/10 text-white"
                    : "border-gray-700 text-gray-300 hover:border-gray-500"
                }`}
              >
                {d.name} <span className="text-gray-500 text-xs">{d.card_count} cartes</span>
              </button>
            ))}
          </div>
          <button onClick={confirm} disabled={!selected} className="btn-primary w-full max-w-sm">
            Confirmer
          </button>
        </>
      ) : (
        <p className="text-gray-400">Deck envoyé, en attente de l'adversaire…</p>
      )}

      <p className="text-xs text-gray-600">Code de salle : <span className="font-bold text-gray-400 tracking-widest">{code}</span></p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

// ─── Card context menu ───────────────────────────────────────────────────────

function CardMenu({ card, zone, onAction, onClose }) {
  const actions = [];
  if (zone === "hand") {
    actions.push({ label: "Jouer", action: { type: "PLAY", instanceId: card.instanceId } });
    actions.push({ label: "Défausser", action: { type: "DISCARD", from: "hand", instanceId: card.instanceId } });
  }
  if (zone === "battlefield") {
    actions.push({ label: card.exhausted ? "Désépuiser" : "Épuiser", action: { type: "EXHAUST", instanceId: card.instanceId } });
    actions.push({ label: "+1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: 1 } });
    actions.push({ label: "-1 compteur", action: { type: "COUNTER", instanceId: card.instanceId, delta: -1 } });
    actions.push({ label: card.hidden ? "Révéler" : "Cacher", action: { type: "HIDE", instanceId: card.instanceId } });
    actions.push({ label: "Retourner en main", action: { type: "RETURN_TO_HAND", instanceId: card.instanceId } });
    actions.push({ label: "Défausser", action: { type: "DISCARD", from: "battlefield", instanceId: card.instanceId } });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full max-w-xs p-2 space-y-1" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs text-gray-500 px-3 pt-1 pb-2 font-semibold truncate">{card.name}</p>
        {actions.map((a) => (
          <button key={a.label} onClick={() => { onAction(a.action); onClose(); }}
            className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-white hover:bg-gray-800 transition-colors">
            {a.label}
          </button>
        ))}
        <button onClick={onClose} className="w-full text-center px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-800 transition-colors">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Card display ─────────────────────────────────────────────────────────────

function GameCard({ card, zone, onTap, small = false }) {
  const size = small ? "w-10 h-14" : "w-14 h-20 sm:w-16 sm:h-[88px]";
  const faceDown = card.faceDown || (card.hidden && zone !== "hand");

  return (
    <div
      onClick={() => onTap?.(card)}
      className={`relative flex-shrink-0 ${size} rounded-lg overflow-hidden cursor-pointer border transition-all
        ${card.exhausted ? "opacity-70 rotate-12 origin-bottom" : ""}
        ${zone === "hand" ? "border-gray-600 hover:border-gold-400" : "border-gray-700 hover:border-gold-400"}`}
      style={card.exhausted ? { transform: "rotate(12deg)" } : {}}
    >
      {faceDown ? (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
          <span className="text-gray-600 text-lg">🂠</span>
        </div>
      ) : card.image_small ? (
        <img src={card.image_small} alt={card.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center p-1">
          <span className="text-gray-400 text-[8px] text-center leading-tight">{card.name}</span>
        </div>
      )}
      {card.counters > 0 && (
        <div className="absolute bottom-0.5 right-0.5 bg-gold-500 text-gray-950 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
          {card.counters}
        </div>
      )}
      {card.hidden && !card.faceDown && (
        <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-purple-600 rounded-full" />
      )}
    </div>
  );
}

// ─── Player board ─────────────────────────────────────────────────────────────

function PlayerBoard({ player, isMe, onCardTap }) {
  return (
    <div className={`flex flex-col gap-1 ${isMe ? "" : "scale-y-[-1]"}`}
      style={isMe ? {} : { transform: "scaleY(-1)" }}>
      {/* Champ de bataille */}
      <div className="flex gap-1 flex-wrap min-h-[84px] px-1">
        {player.battlefield.map((card) => (
          <GameCard key={card.instanceId} card={card} zone="battlefield" onTap={isMe ? onCardTap("battlefield") : null} />
        ))}
        {player.battlefield.length === 0 && (
          <div className="text-gray-700 text-xs self-center px-2">Champ vide</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Game board ──────────────────────────────────────────────────────────

function Board({ room, mySocketId, code }) {
  const [menu, setMenu] = useState(null); // { card, zone }
  const [error, setError] = useState("");
  const [currentRoom, setCurrentRoom] = useState(room);

  useSocket({
    "game:state": ({ room }) => setCurrentRoom(room),
    "game:error": (msg) => { setError(msg); setTimeout(() => setError(""), 3000); },
    "game:opponent_left": () => setError("L'adversaire a quitté la partie."),
  });

  const me = currentRoom.players.find((p) => p.socketId === mySocketId);
  const opp = currentRoom.players.find((p) => p.socketId !== mySocketId);

  const send = useCallback((action) => {
    getSocket().emit("game:action", { code, action });
  }, [code]);

  const draw = () => send({ type: "DRAW" });

  const onCardTap = (zone) => (card) => setMenu({ card, zone });

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col select-none overflow-hidden"
      style={{ touchAction: "manipulation" }}>

      {/* Barre du haut – adversaire */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-900 border-b border-gray-800 text-xs text-gray-400">
        <span>Adversaire · 🃏 {opp?.handSize ?? 0} · 🗑 {opp?.graveyardSize ?? 0}</span>
        <span className="font-mono text-gray-600">{code}</span>
        <span>Deck : {opp?.deckSize ?? 0}</span>
      </div>

      {/* Zone adversaire */}
      <div className="flex-1 flex flex-col border-b border-gray-800/50 overflow-hidden px-1 py-1 gap-1 min-h-0">
        {/* Main adversaire (face cachée) */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {(opp?.hand || []).map((c) => (
            <GameCard key={c.instanceId} card={{ ...c, faceDown: true }} zone="opp-hand" small />
          ))}
        </div>
        {/* Champ adversaire (retourné) */}
        <div className="flex gap-1 flex-wrap flex-1 min-h-0 overflow-y-auto content-start"
          style={{ transform: "scaleY(-1)" }}>
          {(opp?.battlefield || []).map((card) => (
            <div key={card.instanceId} style={{ transform: "scaleY(-1)" }}>
              <GameCard card={card} zone="opp-battlefield" small />
            </div>
          ))}
        </div>
      </div>

      {/* Zone joueur */}
      <div className="flex-1 flex flex-col overflow-hidden px-1 py-1 gap-1 min-h-0">
        {/* Champ du joueur */}
        <div className="flex gap-1 flex-wrap flex-1 min-h-0 overflow-y-auto content-start">
          {(me?.battlefield || []).map((card) => (
            <GameCard key={card.instanceId} card={card} zone="battlefield" onTap={onCardTap("battlefield")} />
          ))}
          {(me?.battlefield?.length ?? 0) === 0 && (
            <span className="text-gray-700 text-xs self-center px-2">Ton champ</span>
          )}
        </div>
        {/* Main du joueur */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {(me?.hand || []).map((card) => (
            <GameCard key={card.instanceId} card={card} zone="hand" onTap={onCardTap("hand")} />
          ))}
        </div>
      </div>

      {/* Barre du bas – actions */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-900 border-t border-gray-800">
        <button onClick={draw}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors">
          Piocher ({me?.deckSize ?? 0})
        </button>
        <div className="flex-1" />
        <span className="text-xs text-gray-600">Main : {me?.handSize ?? 0}</span>
        <span className="text-xs text-gray-600">Défausse : {me?.graveyardSize ?? 0}</span>
      </div>

      {error && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-red-900 text-red-200 text-xs px-4 py-2 rounded-xl z-40">
          {error}
        </div>
      )}

      {menu && (
        <CardMenu
          card={menu.card}
          zone={menu.zone}
          onAction={send}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function Game() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("lobby"); // lobby | deck_select | playing
  const [code, setCode] = useState(null);
  const [room, setRoom] = useState(null);
  const mySocketId = getSocket().id;

  useEffect(() => {
    if (!user) navigate("/login");
    // Force landscape hint on mobile
    if (screen.orientation?.lock) screen.orientation.lock("landscape").catch(() => {});
    return () => { screen.orientation?.unlock?.(); };
  }, [user]);

  if (!user) return null;

  if (phase === "lobby") {
    return (
      <Lobby
        onJoined={(code, room) => {
          setCode(code);
          setRoom(room);
          setPhase("deck_select");
        }}
      />
    );
  }

  if (phase === "deck_select") {
    return (
      <DeckSelect
        code={code}
        room={room}
        mySocketId={getSocket().id}
        onStarted={(room) => { setRoom(room); setPhase("playing"); }}
      />
    );
  }

  return <Board room={room} mySocketId={getSocket().id} code={code} />;
}
