const { randomUUID } = require("crypto");

const rooms = new Map();

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do { code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""); }
  while (rooms.has(code));
  return code;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makePlayerState(userId, socketId) {
  return {
    userId, socketId,
    deck: [],
    runeDeck: [],
    hand: [],
    runeHand: [],       // runes disponibles
    legend: [],
    champion: [],
    field: [],
    spellZone: [],
    graveyard: [],
    battlefieldCard: null,
    _battlefields: [],
    mulliganDone: false,
    _bfDone: false,
    ready: false,
    playerIndex: 0,
  };
}

function inst(card) {
  return { ...card, instanceId: randomUUID(), exhausted: false, counters: 0, hidden: false };
}

function findInZones(player, instanceId) {
  const zoneNames = ["hand", "runeHand", "legend", "champion", "field", "spellZone", "graveyard"];
  for (const z of zoneNames) {
    const arr = player[z];
    const idx = arr.findIndex((c) => c.instanceId === instanceId);
    if (idx !== -1) return { zone: z, idx };
  }
  return null;
}

function removeFromZone(player, zone, idx) {
  return player[zone].splice(idx, 1)[0];
}

// ── Room management ──────────────────────────────────────────────────────────

function createRoom(hostSocketId, hostUserId, solo = false) {
  const code = makeCode();
  const host = makePlayerState(hostUserId, hostSocketId);
  host.playerIndex = 0;
  const players = [host];
  if (solo) {
    const dummy = makePlayerState("bot", "bot");
    dummy.playerIndex = 1;
    dummy.ready = true;
    dummy._bfDone = true;
    dummy.mulliganDone = true;
    players.push(dummy);
  }
  const room = { code, phase: "deck_select", solo, players, turn: 0 };
  rooms.set(code, room);
  return room;
}

function joinRoom(code, socketId, userId) {
  const room = rooms.get(code);
  if (!room) return { error: "Salle introuvable" };
  if (room.players.length >= 2) return { error: "Salle pleine" };
  if (room.players[0].socketId === socketId) return { error: "Déjà dans la salle" };
  const p = makePlayerState(userId, socketId);
  p.playerIndex = 1;
  room.players.push(p);
  return { room };
}

function setDeck(code, socketId, deckCards) {
  const room = rooms.get(code);
  if (!room) return { error: "Salle introuvable" };
  const p = room.players.find((p) => p.socketId === socketId);
  if (!p) return { error: "Joueur non trouvé" };

  const cards = deckCards.map(inst);

  // Separate card types
  p._battlefields = cards.filter((c) => c.card_type === "Battlefield");
  p.legend        = cards.filter((c) => c.card_type === "Legend");
  p.champion      = cards.filter((c) => /Champion/.test(c.card_type || ""));
  p.runeDeck      = shuffle(cards.filter((c) => c.card_type === "Rune" || c.card_type === "Token Rune"));
  p.deck          = shuffle(cards.filter((c) =>
    c.card_type !== "Battlefield" &&
    c.card_type !== "Legend" &&
    !/Champion/.test(c.card_type || "") &&
    c.card_type !== "Rune" &&
    c.card_type !== "Token Rune"
  ));

  p.hand = []; p.runeHand = [];
  p.field = []; p.spellZone = []; p.graveyard = [];
  p.battlefieldCard = null;
  p._bfDone = false;
  p.mulliganDone = false;
  p.ready = true;

  if (room.players.every((pl) => pl.ready)) {
    room.phase = "battlefield_select";
  }
  return { room };
}

function selectBattlefield(code, socketId, instanceId) {
  const room = rooms.get(code);
  if (!room) return { error: "Salle introuvable" };
  const p = room.players.find((p) => p.socketId === socketId);
  if (!p) return { error: "Joueur non trouvé" };

  p.battlefieldCard = instanceId
    ? (p._battlefields || []).find((c) => c.instanceId === instanceId) || null
    : null;
  p._bfDone = true;

  const allDone = room.players.every((pl) => pl._bfDone || pl.userId === "bot");
  if (allDone) {
    room.phase = "mulligan";
    // Draw 4 opening cards; starting runes: P1=2, P2=3
    for (const pl of room.players) {
      if (pl.userId === "bot") continue;
      pl.hand = pl.deck.splice(0, 4);
      const startRunes = pl.playerIndex === 0 ? 2 : 3;
      pl.runeHand = pl.runeDeck.splice(0, startRunes);
    }
  }
  return { room };
}

function doMulligan(code, socketId, returnInstanceIds) {
  const room = rooms.get(code);
  if (!room) return { error: "Salle introuvable" };
  const p = room.players.find((p) => p.socketId === socketId);
  if (!p) return { error: "Joueur non trouvé" };

  // Max 2 cards to return
  const toReturn = p.hand.filter((c) => returnInstanceIds.slice(0, 2).includes(c.instanceId));
  p.hand = p.hand.filter((c) => !returnInstanceIds.slice(0, 2).includes(c.instanceId));
  p.deck = shuffle([...p.deck, ...toReturn.map(inst)]);
  p.hand.push(...p.deck.splice(0, toReturn.length));
  p.mulliganDone = true;

  if (room.players.every((pl) => pl.mulliganDone)) {
    room.phase = "playing";
    room.turn = 1;
  }
  return { room };
}

// ── In-game actions ──────────────────────────────────────────────────────────

function applyAction(code, socketId, action) {
  const room = rooms.get(code);
  if (!room || room.phase !== "playing") return { error: "Partie non active" };
  const p = room.players.find((p) => p.socketId === socketId);
  if (!p) return { error: "Joueur non trouvé" };

  switch (action.type) {

    case "DRAW_TURN": {
      // Draw 1 card + 2 runes
      if (p.deck.length > 0) p.hand.push(p.deck.shift());
      const drawn = p.runeDeck.splice(0, 2);
      p.runeHand.push(...drawn);
      room.turn = (room.turn || 0) + 1;
      break;
    }

    case "DRAW": {
      if (p.deck.length === 0) return { error: "Deck vide" };
      p.hand.push(p.deck.shift());
      break;
    }

    case "DRAW_RUNE": {
      if (p.runeDeck.length === 0) return { error: "Plus de runes" };
      p.runeHand.push(p.runeDeck.shift());
      break;
    }

    case "PLAY_TO_ZONE": {
      // From hand or runeHand
      let card;
      const hIdx = p.hand.findIndex((c) => c.instanceId === action.instanceId);
      const rIdx = p.runeHand.findIndex((c) => c.instanceId === action.instanceId);
      if (hIdx !== -1) card = p.hand.splice(hIdx, 1)[0];
      else if (rIdx !== -1) card = p.runeHand.splice(rIdx, 1)[0];
      else return { error: "Carte non trouvée" };
      card.exhausted = false;
      const dest = ["legend", "champion", "field", "spellZone", "runeHand"].includes(action.zone)
        ? action.zone : "field";
      p[dest].push(card);
      break;
    }

    case "MOVE_TO_ZONE": {
      const found = findInZones(p, action.instanceId);
      if (!found) return { error: "Carte non trouvée" };
      const card = removeFromZone(p, found.zone, found.idx);
      const dest = ["hand", "runeHand", "legend", "champion", "field", "spellZone", "graveyard"].includes(action.toZone)
        ? action.toZone : "field";
      p[dest].push(card);
      break;
    }

    case "EXHAUST": {
      const found = findInZones(p, action.instanceId);
      if (!found) return { error: "Carte non trouvée" };
      p[found.zone][found.idx].exhausted = !p[found.zone][found.idx].exhausted;
      break;
    }

    case "COUNTER": {
      const found = findInZones(p, action.instanceId);
      if (!found) return { error: "Carte non trouvée" };
      const card = p[found.zone][found.idx];
      card.counters = Math.max(0, (card.counters || 0) + action.delta);
      break;
    }

    case "HIDE": {
      const found = findInZones(p, action.instanceId);
      if (!found) return { error: "Carte non trouvée" };
      p[found.zone][found.idx].hidden = !p[found.zone][found.idx].hidden;
      break;
    }

    case "UNEXHAUST_ALL": {
      for (const zone of ["legend", "champion", "field", "spellZone", "runeHand"]) {
        p[zone].forEach((c) => { c.exhausted = false; });
      }
      break;
    }

    default:
      return { error: "Action inconnue" };
  }

  return { room };
}

function removePlayer(socketId) {
  for (const [code, room] of rooms) {
    const idx = room.players.findIndex((p) => p.socketId === socketId);
    if (idx !== -1) {
      room.players.splice(idx, 1);
      if (room.players.length === 0) rooms.delete(code);
      return { code, room: rooms.get(code) || null };
    }
  }
  return null;
}

module.exports = { createRoom, joinRoom, setDeck, selectBattlefield, doMulligan, applyAction, removePlayer };
