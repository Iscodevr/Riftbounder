const { createRoom, joinRoom, setDeck, selectBattlefield, doMulligan, applyAction, removePlayer } = require("./state");
const db = require("../db/index");

function randomId() { return Math.random().toString(36).slice(2); }

function safeRoom(room, viewerSocketId) {
  if (!room) return null;
  return {
    code: room.code,
    phase: room.phase,
    solo: room.solo,
    turn: room.turn,
    winner: room.winner,
    log: (room.log || []).slice(-30),
    // Battlefields partagés — visibles par tous avec leurs unités
    battlefields: (room.battlefields || []).map((bf) => ({
      id: bf.id,
      playerIndex: bf.playerIndex,
      card: bf.card,
      controller: bf.controller,
      conquered: bf.conquered,
      units: {
        0: bf.units[0] || [],
        1: bf.units[1] || [],
      },
    })),
    players: room.players.map((p) => ({
      userId: p.userId,
      socketId: p.socketId,
      playerIndex: p.playerIndex,
      ready: p.ready,
      _bfDone: p._bfDone,
      mulliganDone: p.mulliganDone,
      score: p.score,
      energy: p.energy,
      deckSize: p.deck.length,
      runeDeckSize: p.runeDeck.length,
      graveyardSize: p.graveyard.length,
      banishmentSize: p.banishment.length,
      battlefieldCard: p.battlefieldCard,
      legendCard: p.legendCard,  // La légende est visible par tous
      // Cartes privées du viewer — face visible ; celles de l'adversaire — face cachée
      hand: p.socketId === viewerSocketId
        ? p.hand
        : p.hand.map(() => ({ instanceId: randomId(), faceDown: true })),
      runeHand: p.socketId === viewerSocketId
        ? p.runeHand
        : p.runeHand.map(() => ({ instanceId: randomId(), faceDown: true })),
      champion: p.champion,
      field: p.field,
      spellZone: p.spellZone,
      graveyard: p.graveyard,
      // Seulement visible au setup
      battlefields: p.socketId === viewerSocketId ? (p._battlefields || []) : undefined,
    })),
  };
}

function broadcast(io, room) {
  for (const p of room.players) {
    if (p.socketId === "bot") continue;
    io.to(p.socketId).emit("game:state", { room: safeRoom(room, p.socketId) });
  }
}

module.exports = function registerGame(io) {
  io.on("connection", (socket) => {

    socket.on("game:create", ({ userId, solo }) => {
      const room = createRoom(socket.id, userId, !!solo);
      socket.join(room.code);
      socket.emit("game:joined", { code: room.code, room: safeRoom(room, socket.id) });
    });

    socket.on("game:join", ({ code, userId }) => {
      const result = joinRoom(code.toUpperCase(), socket.id, userId);
      if (result.error) return socket.emit("game:error", result.error);
      socket.join(code.toUpperCase());
      broadcast(io, result.room);
      socket.emit("game:joined", { code: code.toUpperCase(), room: safeRoom(result.room, socket.id) });
    });

    socket.on("game:set_deck", async ({ code, deckId }) => {
      try {
        const { rows } = await db.query(
          `SELECT c.* FROM deck_cards dc JOIN cards c ON c.id = dc.card_id WHERE dc.deck_id = $1`,
          [deckId]
        );
        const result = setDeck(code, socket.id, rows);
        if (result.error) return socket.emit("game:error", result.error);
        broadcast(io, result.room);
      } catch (e) { socket.emit("game:error", e.message); }
    });

    socket.on("game:select_battlefield", ({ code, instanceId }) => {
      const result = selectBattlefield(code, socket.id, instanceId);
      if (result.error) return socket.emit("game:error", result.error);
      broadcast(io, result.room);
    });

    socket.on("game:mulligan", ({ code, returnInstanceIds }) => {
      const result = doMulligan(code, socket.id, returnInstanceIds || []);
      if (result.error) return socket.emit("game:error", result.error);
      broadcast(io, result.room);
    });

    socket.on("game:action", ({ code, action }) => {
      const result = applyAction(code, socket.id, action);
      if (result.error) return socket.emit("game:error", result.error);
      broadcast(io, result.room);
    });

    socket.on("disconnect", () => {
      const result = removePlayer(socket.id);
      if (result?.code && result.room) io.to(result.code).emit("game:opponent_left");
    });
  });
};
