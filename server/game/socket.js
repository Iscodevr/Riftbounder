const { createRoom, joinRoom, setDeck, startGame, applyAction, removePlayer } = require("./state");
const db = require("../db/index");

function safeRoom(room, viewerSocketId) {
  if (!room) return null;
  return {
    ...room,
    players: room.players.map((p) => ({
      userId: p.userId,
      socketId: p.socketId,
      ready: p.ready,
      deckSize: p.deck.length,
      handSize: p.hand.length,
      graveyardSize: p.graveyard.length,
      // Own hand visible, opponent hand face-down
      hand: p.socketId === viewerSocketId
        ? p.hand
        : p.hand.map((c) => ({ instanceId: c.instanceId, hidden: true, faceDown: true })),
      battlefield: p.battlefield,
    })),
  };
}

module.exports = function registerGame(io) {
  io.on("connection", (socket) => {
    socket.on("game:create", async ({ userId }) => {
      const room = createRoom(socket.id, userId);
      socket.join(room.code);
      socket.emit("game:joined", { code: room.code, room: safeRoom(room, socket.id) });
    });

    socket.on("game:join", async ({ code, userId }) => {
      const result = joinRoom(code.toUpperCase(), socket.id, userId);
      if (result.error) return socket.emit("game:error", result.error);
      socket.join(code.toUpperCase());
      io.to(code.toUpperCase()).emit("game:state", { room: safeRoom(result.room, socket.id) });
      socket.emit("game:joined", { code: code.toUpperCase(), room: safeRoom(result.room, socket.id) });
    });

    socket.on("game:set_deck", async ({ code, deckId }) => {
      try {
        const { rows } = await db.query(
          `SELECT c.* FROM deck_cards dc
           JOIN cards c ON c.id = dc.card_id
           WHERE dc.deck_id = $1`,
          [deckId]
        );
        const result = setDeck(code, socket.id, rows);
        if (result.error) return socket.emit("game:error", result.error);

        // Broadcast updated state to both players with their respective views
        const room = result.room;
        for (const p of room.players) {
          io.to(p.socketId).emit("game:state", { room: safeRoom(room, p.socketId) });
        }

        const started = startGame(code);
        if (started) {
          for (const p of started.players) {
            io.to(p.socketId).emit("game:started", { room: safeRoom(started, p.socketId) });
          }
        }
      } catch (e) {
        socket.emit("game:error", e.message);
      }
    });

    socket.on("game:action", ({ code, action }) => {
      const result = applyAction(code, socket.id, action);
      if (result.error) return socket.emit("game:error", result.error);
      for (const p of result.room.players) {
        io.to(p.socketId).emit("game:state", { room: safeRoom(result.room, p.socketId) });
      }
    });

    socket.on("disconnect", () => {
      const result = removePlayer(socket.id);
      if (result?.code && result.room) {
        io.to(result.code).emit("game:opponent_left");
      }
    });
  });
};
