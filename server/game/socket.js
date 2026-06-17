const { createRoom, joinRoom, setDeck, selectBattlefield, doMulligan, applyAction, removePlayer } = require("./state");
const db = require("../db/index");

function safeRoom(room, viewerSocketId) {
  if (!room) return null;
  return {
    ...room,
    players: room.players.map((p) => ({
      userId: p.userId,
      socketId: p.socketId,
      ready: p.ready,
      _bfDone: p._bfDone,
      mulliganDone: p.mulliganDone,
      deckSize: p.deck.length,
      graveyardSize: p.graveyard.length,
      battlefieldCard: p.battlefieldCard,
      battlefields: p.socketId === viewerSocketId ? (p._battlefields || []) : undefined,
      hand: p.socketId === viewerSocketId
        ? p.hand
        : p.hand.map((c) => ({ instanceId: c.instanceId, faceDown: true })),
      legend: p.legend,
      champion: p.champion,
      field: p.field,
      spellZone: p.spellZone,
      graveyard: p.graveyard,
    })),
  };
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
      const room = result.room;
      for (const p of room.players) {
        io.to(p.socketId).emit("game:state", { room: safeRoom(room, p.socketId) });
      }
      socket.emit("game:joined", { code: code.toUpperCase(), room: safeRoom(room, socket.id) });
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

    socket.on("game:mulligan", ({ code, keepInstanceIds }) => {
      const result = doMulligan(code, socket.id, keepInstanceIds);
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
      if (result?.code && result.room) {
        io.to(result.code).emit("game:opponent_left");
      }
    });
  });
};

function broadcast(io, room) {
  for (const p of room.players) {
    if (p.socketId === "bot") continue;
    io.to(p.socketId).emit("game:state", { room: safeRoom(room, p.socketId) });
  }
}
