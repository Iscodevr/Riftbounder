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
    deck: [], hand: [],
    legend: [],     // 1 card slot
    champion: [],   // 1 card slot
    field: [],      // main field
    spellZone: [],  // right side
    graveyard: [],
    battlefieldCard: null,
    mulliganDone: false,
    ready: false,
  };
}

function inst(card) {
  return { ...card, instanceId: randomUUID(), exhausted: false, counters: 0, hidden: false };
}

function findInZones(player, instanceId) {
  const zoneNames = ["hand", "legend", "champion", "field", "spellZone", "graveyard"];
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
  const players = [makePlayerState(hostUserId, hostSocketId)];
  if (solo) {
    const dummy = makePlayerState("bot", "bot");
    dummy.ready = true;
    dummy.mulliganDone = true;
    players.push(dummy);
  }
  const room = { code, phase: "deck_select", solo, players };
  rooms.set(code, room);
  return room;
}

function joinRoom(code, socketId, userId) {
  const room = rooms.get(code);
  if (!room) return { error: "Salle introuvable" };
  if (room.players.length >= 2) return { error: "Salle pleine" };
  if (room.players[0].socketId === socketId) return { error: "Déjà dans la salle" };
  room.players.push(makePlayerState(userId, socketId));
  return { room };
}

function setDeck(code, socketId, deckCards) {
  const room = rooms.get(code);
  if (!room) return { error: "Salle introuvable" };
  const p = room.players.find((p) => p.socketId === socketId);
  if (!p) return { error: "Joueur non trouvé" };

  const cards = deckCards.map(inst);
  p._battlefields = cards.filter((c) => c.card_type === "Battlefield");
  // Legend and Champion start directly in their zones, not in the deck
  p.legend   = cards.filter((c) => c.card_type === "Legend");
  p.champion = cards.filter((c) => /Champion/.test(c.card_type || ""));
  p.deck = shuffle(cards.filter((c) =>
    c.card_type !== "Battlefield" &&
    c.card_type !== "Legend" &&
    !/Champion/.test(c.card_type || "")
  ));
  p.hand = [];
  p.field = []; p.spellZone = []; p.graveyard = [];
  p.battlefieldCard = null;
  p.mulliganDone = false;
  p.ready = true;

  // Move to battlefield_select if both ready
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

  const bf = instanceId
    ? (p._battlefields || []).find((c) => c.instanceId === instanceId)
    : null;
  p.battlefieldCard = bf || null;
  p._bfDone = true;

  // Move to mulligan if both done (solo: bot is auto-done)
  const allDone = room.players.every((pl) => pl._bfDone || pl.userId === "bot");
  if (allDone) {
    room.phase = "mulligan";
    // Draw opening hand of 6
    for (const pl of room.players) {
      if (pl.userId === "bot") continue;
      pl.hand = pl.deck.splice(0, 6);
    }
  }
  return { room };
}

function doMulligan(code, socketId, keepInstanceIds) {
  const room = rooms.get(code);
  if (!room) return { error: "Salle introuvable" };
  const p = room.players.find((p) => p.socketId === socketId);
  if (!p) return { error: "Joueur non trouvé" };

  const toReturn = p.hand.filter((c) => !keepInstanceIds.includes(c.instanceId));
  const kept = p.hand.filter((c) => keepInstanceIds.includes(c.instanceId));
  // Shuffle returned cards back, redraw
  p.deck = shuffle([...p.deck, ...toReturn.map(inst)]);
  const drawn = p.deck.splice(0, toReturn.length);
  p.hand = [...kept, ...drawn];
  p.mulliganDone = true;

  if (room.players.every((pl) => pl.mulliganDone)) {
    room.phase = "playing";
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
    case "DRAW": {
      if (p.deck.length === 0) return { error: "Deck vide" };
      p.hand.push(p.deck.shift());
      break;
    }
    case "PLAY_TO_ZONE": {
      const idx = p.hand.findIndex((c) => c.instanceId === action.instanceId);
      if (idx === -1) return { error: "Carte non trouvée" };
      const [card] = p.hand.splice(idx, 1);
      card.exhausted = false;
      const dest = ["legend", "champion", "field", "spellZone"].includes(action.zone)
        ? action.zone : "field";
      p[dest].push(card);
      break;
    }
    case "MOVE_TO_ZONE": {
      const found = findInZones(p, action.instanceId);
      if (!found) return { error: "Carte non trouvée" };
      const card = removeFromZone(p, found.zone, found.idx);
      const dest = ["hand", "legend", "champion", "field", "spellZone", "graveyard"].includes(action.toZone)
        ? action.toZone : "field";
      p[dest].push(card);
      break;
    }
    case "EXHAUST": {
      const found = findInZones(p, action.instanceId);
      if (!found) return { error: "Carte non trouvée" };
      const card = p[found.zone][found.idx];
      card.exhausted = !card.exhausted;
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
      const card = p[found.zone][found.idx];
      card.hidden = !card.hidden;
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

function getRoom(code) { return rooms.get(code) || null; }

module.exports = { createRoom, joinRoom, setDeck, selectBattlefield, doMulligan, applyAction, removePlayer, getRoom };
