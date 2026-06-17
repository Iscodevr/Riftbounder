const { randomUUID } = require("crypto");

// rooms: Map<roomCode, Room>
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
  return { userId, socketId, deckId: null, deck: [], hand: [], battlefield: [], graveyard: [], ready: false };
}

function createRoom(hostSocketId, hostUserId) {
  const code = makeCode();
  const room = { code, phase: "lobby", players: [makePlayerState(hostUserId, hostSocketId)] };
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
  p.deck = shuffle(deckCards.map((c) => ({ ...c, instanceId: randomUUID() })));
  p.hand = [];
  p.battlefield = [];
  p.graveyard = [];
  p.ready = true;
  return { room };
}

function startGame(code) {
  const room = rooms.get(code);
  if (!room) return null;
  if (room.players.length < 2 || !room.players.every((p) => p.ready)) return null;
  // Draw opening hand (4 cards each)
  for (const p of room.players) {
    p.hand = p.deck.splice(0, 4).map((c) => ({ ...c, hidden: false }));
  }
  room.phase = "playing";
  return room;
}

function applyAction(code, socketId, action) {
  const room = rooms.get(code);
  if (!room || room.phase !== "playing") return { error: "Partie non active" };
  const p = room.players.find((p) => p.socketId === socketId);
  if (!p) return { error: "Joueur non trouvé" };

  switch (action.type) {
    case "DRAW": {
      if (p.deck.length === 0) return { error: "Deck vide" };
      const card = p.deck.shift();
      card.hidden = false;
      p.hand.push(card);
      break;
    }
    case "PLAY": {
      const idx = p.hand.findIndex((c) => c.instanceId === action.instanceId);
      if (idx === -1) return { error: "Carte non trouvée" };
      const [card] = p.hand.splice(idx, 1);
      card.exhausted = false;
      card.counters = 0;
      card.hidden = false;
      p.battlefield.push(card);
      break;
    }
    case "DISCARD": {
      const src = action.from === "battlefield" ? p.battlefield : p.hand;
      const idx = src.findIndex((c) => c.instanceId === action.instanceId);
      if (idx === -1) return { error: "Carte non trouvée" };
      const [card] = src.splice(idx, 1);
      p.graveyard.unshift(card);
      break;
    }
    case "RETURN_TO_HAND": {
      const idx = p.battlefield.findIndex((c) => c.instanceId === action.instanceId);
      if (idx === -1) return { error: "Carte non trouvée" };
      const [card] = p.battlefield.splice(idx, 1);
      p.hand.push(card);
      break;
    }
    case "EXHAUST": {
      const card = p.battlefield.find((c) => c.instanceId === action.instanceId);
      if (!card) return { error: "Carte non trouvée" };
      card.exhausted = !card.exhausted;
      break;
    }
    case "COUNTER": {
      const card = p.battlefield.find((c) => c.instanceId === action.instanceId);
      if (!card) return { error: "Carte non trouvée" };
      card.counters = Math.max(0, (card.counters || 0) + action.delta);
      break;
    }
    case "HIDE": {
      const card = p.battlefield.find((c) => c.instanceId === action.instanceId);
      if (!card) return { error: "Carte non trouvée" };
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

module.exports = { createRoom, joinRoom, setDeck, startGame, applyAction, removePlayer, getRoom };
