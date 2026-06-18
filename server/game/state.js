const { randomUUID } = require("crypto");

const rooms = new Map();

function addLog(room, playerIndex, text) {
  room.log.push({ turn: room.turn || 0, playerIndex, text, id: Date.now() + Math.random() });
  if (room.log.length > 60) room.log.shift();
}

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
    runeHand: [],
    field: [],        // Base : unités et gear en jeu
    spellZone: [],
    graveyard: [],
    banishment: [],
    legendCard: null, // Légende : ne rentre JAMAIS en jeu, définit l'identité du deck
    champion: [],     // Champion Zone : part d'ici, entre en jeu en payant un coût
    battlefieldCard: null,
    _battlefields: [],
    mulliganDone: false,
    _bfDone: false,
    ready: false,
    playerIndex: 0,
    score: 0,
    energy: 0,        // Pool d'énergie (vidé en fin de tour)
  };
}

function inst(card) {
  return { ...card, instanceId: randomUUID(), exhausted: false, counters: 0, hidden: false };
}

function findInZones(player, instanceId) {
  const zones = ["hand", "runeHand", "field", "champion", "spellZone", "graveyard", "banishment"];
  for (const z of zones) {
    const idx = player[z].findIndex((c) => c.instanceId === instanceId);
    if (idx !== -1) return { zone: z, idx };
  }
  return null;
}

function removeFromZone(player, zone, idx) {
  return player[zone].splice(idx, 1)[0];
}

function getMight(card) { return Number(card.might) || 1; }
function getHP(card) { return Number(card.health) || Number(card.hp) || getMight(card); }

function checkWin(room) {
  for (const p of room.players) {
    if (p.score >= 8) {
      room.phase = "ended";
      room.winner = p.playerIndex;
      return true;
    }
  }
  return false;
}

// ── Room management ──────────────────────────────────────────────────────────

function createRoom(hostSocketId, hostUserId, solo = false) {
  const code = makeCode();
  const host = makePlayerState(hostUserId, hostSocketId);
  host.playerIndex = 0;
  const players = [host];
  if (solo) {
    const bot = makePlayerState("bot", "bot");
    bot.playerIndex = 1;
    bot.ready = true;
    bot._bfDone = true;
    bot.mulliganDone = true;
    players.push(bot);
  }
  const room = { code, phase: "deck_select", solo, players, turn: 0, battlefields: [], activePlayer: null, log: [] };
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
  const p = room.players.find((pl) => pl.socketId === socketId);
  if (!p) return { error: "Joueur non trouvé" };

  const cards = deckCards.map(inst);

  p._battlefields = cards.filter((c) => c.card_type === "Battlefield");
  // La Légende reste hors jeu — elle définit l'identité du deck
  p.legendCard = cards.find((c) => c.card_type === "Legend") || null;
  // Le Champion part de la Champion Zone
  p.champion = cards.filter((c) => /Champion/.test(c.card_type || ""));
  // Rune deck (12 runes)
  p.runeDeck = shuffle(cards.filter((c) => c.card_type === "Rune" || c.card_type === "Token Rune"));
  // Deck principal (40 cartes)
  p.deck = shuffle(cards.filter((c) =>
    c.card_type !== "Battlefield" &&
    c.card_type !== "Legend" &&
    !/Champion/.test(c.card_type || "") &&
    c.card_type !== "Rune" &&
    c.card_type !== "Token Rune"
  ));

  p.hand = []; p.runeHand = [];
  p.field = []; p.spellZone = []; p.graveyard = []; p.banishment = [];
  p.battlefieldCard = null; p._bfDone = false; p.mulliganDone = false;
  p.score = 0; p.energy = 0;
  p.ready = true;

  if (room.players.every((pl) => pl.ready)) room.phase = "battlefield_select";
  return { room };
}

function selectBattlefield(code, socketId, instanceId) {
  const room = rooms.get(code);
  if (!room) return { error: "Salle introuvable" };
  const p = room.players.find((pl) => pl.socketId === socketId);
  if (!p) return { error: "Joueur non trouvé" };

  p.battlefieldCard = instanceId
    ? (p._battlefields || []).find((c) => c.instanceId === instanceId) || null
    : null;
  p._bfDone = true;

  // Enregistrer le BF dans la zone partagée de la room
  if (p.battlefieldCard) {
    room.battlefields.push({
      id: room.battlefields.length,
      playerIndex: p.playerIndex,
      card: p.battlefieldCard,
      controller: null,
      conquered: false,
      units: { 0: [], 1: [] },
    });
  }

  const allDone = room.players.every((pl) => pl._bfDone || pl.userId === "bot");
  if (allDone) {
    room.phase = "mulligan";
    for (const pl of room.players) {
      if (pl.userId === "bot") continue;
      pl.hand = pl.deck.splice(0, 4);
      // P1 commence avec 2 runes, P2 avec 3
      pl.runeHand = pl.runeDeck.splice(0, pl.playerIndex === 0 ? 2 : 3);
    }
  }
  return { room };
}

function doMulligan(code, socketId, returnInstanceIds) {
  const room = rooms.get(code);
  if (!room) return { error: "Salle introuvable" };
  const p = room.players.find((pl) => pl.socketId === socketId);
  if (!p) return { error: "Joueur non trouvé" };

  const ids = (returnInstanceIds || []).slice(0, 2);
  const toReturn = p.hand.filter((c) => ids.includes(c.instanceId));
  p.hand = p.hand.filter((c) => !ids.includes(c.instanceId));
  // Règle officielle : les cartes retournées vont EN BAS du deck, pas reshufflé
  p.deck = [...p.deck, ...toReturn];
  p.hand.push(...p.deck.splice(0, toReturn.length));
  p.mulliganDone = true;

  if (room.players.every((pl) => pl.mulliganDone)) {
    room.phase = "playing";
    room.turn = 1;
    room.activePlayer = 0; // P1 starts
  }
  return { room };
}

// ── In-game actions ──────────────────────────────────────────────────────────

function applyAction(code, socketId, action) {
  const room = rooms.get(code);
  if (!room || room.phase !== "playing") return { error: "Partie non active" };
  const p = room.players.find((pl) => pl.socketId === socketId);
  if (!p) return { error: "Joueur non trouvé" };
  const opp = room.players.find((pl) => pl.playerIndex !== p.playerIndex);

  switch (action.type) {

    // ── ABCD : Début de tour ──────────────────────────────────────────────────
    case "START_TURN": {
      // Only callable if activePlayer === null OR it's opponent's turn (your turn starts)
      if (room.activePlayer !== null && room.activePlayer !== (opp?.playerIndex ?? 1 - p.playerIndex)) {
        return { error: "Ce n'est pas ton tour de commencer" };
      }
      // A — Awaken : désépuiser toutes ses cartes
      for (const zone of ["champion", "field", "spellZone", "runeHand"]) {
        p[zone].forEach((c) => { c.exhausted = false; });
      }
      for (const bf of room.battlefields) {
        (bf.units[p.playerIndex] || []).forEach((c) => { c.exhausted = false; });
      }
      // B — Beginning : Hold scoring (1 pt par BF conquis et contrôlé)
      for (const bf of room.battlefields) {
        if (bf.conquered && bf.controller === p.playerIndex) {
          p.score++;
          if (checkWin(room)) break;
        }
      }
      // C — Channel : piocher 2 runes
      p.runeHand.push(...p.runeDeck.splice(0, 2));
      // D — Draw : piocher 1 carte
      if (p.deck.length > 0) {
        p.hand.push(p.deck.shift());
      } else if (opp) {
        // Burn Out : l'adversaire marque 1 point
        opp.score++;
        checkWin(room);
      }
      // Vider le pool d'énergie de l'ancien tour
      p.energy = 0;
      room.turn = (room.turn || 0) + 1;
      room.activePlayer = p.playerIndex; // Action phase begins for this player
      addLog(room, p.playerIndex, "commence son tour");
      // Hold scoring logs
      for (const bf of room.battlefields) {
        if (bf.conquered && bf.controller === p.playerIndex) {
          addLog(room, p.playerIndex, `marque 1 pt (Hold BF ${bf.id + 1})`);
        }
      }
      // Burn Out log (deck was empty — opp scored)
      if (p.deck.length === 0 && opp) {
        addLog(room, opp.playerIndex, "marque 1 pt (Burn Out !)");
      }
      break;
    }

    // ── Fin de tour : vider le pool d'énergie ────────────────────────────────
    case "FIN_TOUR": {
      if (room.activePlayer !== null && p.playerIndex !== room.activePlayer) {
        return { error: "Ce n'est pas ton tour" };
      }
      p.energy = 0;
      room.activePlayer = opp ? opp.playerIndex : null; // Pass to opponent
      addLog(room, p.playerIndex, "passe la main");
      break;
    }

    // ── Pioches manuelles ────────────────────────────────────────────────────
    case "DRAW": {
      if (room.activePlayer !== null && p.playerIndex !== room.activePlayer) {
        return { error: "Ce n'est pas ton tour" };
      }
      if (p.deck.length === 0) {
        if (opp) { opp.score++; checkWin(room); }
        return { error: "Deck vide — Burn Out !" };
      }
      p.hand.push(p.deck.shift());
      break;
    }

    case "DRAW_RUNE": {
      if (p.runeDeck.length === 0) return { error: "Plus de runes dans le rune deck" };
      p.runeHand.push(p.runeDeck.shift());
      break;
    }

    // ── Runes ────────────────────────────────────────────────────────────────
    case "EXHAUST_RUNE": {
      // Épuiser une rune = +1 énergie générique
      const idx = p.runeHand.findIndex((c) => c.instanceId === action.instanceId);
      if (idx === -1) return { error: "Rune introuvable" };
      if (p.runeHand[idx].exhausted) return { error: "Rune déjà épuisée" };
      p.runeHand[idx].exhausted = true;
      p.energy = (p.energy || 0) + 1;
      addLog(room, p.playerIndex, "épuise une rune → +1 énergie");
      break;
    }

    case "RECYCLE_RUNE": {
      // Recycler une rune = +1 énergie de domaine (retrait permanent ce tour)
      const idx = p.runeHand.findIndex((c) => c.instanceId === action.instanceId);
      if (idx === -1) return { error: "Rune introuvable" };
      const rune = p.runeHand.splice(idx, 1)[0];
      p.graveyard.push(rune);
      p.energy = (p.energy || 0) + 1;
      break;
    }

    // ── Jouer une carte ───────────────────────────────────────────────────────
    case "PLAY_TO_ZONE": {
      if (room.activePlayer !== null && p.playerIndex !== room.activePlayer) {
        return { error: "Ce n'est pas ton tour" };
      }
      let card;
      const hIdx = p.hand.findIndex((c) => c.instanceId === action.instanceId);
      const cIdx = p.champion.findIndex((c) => c.instanceId === action.instanceId);
      if (hIdx !== -1) card = p.hand[hIdx];
      else if (cIdx !== -1) card = p.champion[cIdx];
      else return { error: "Carte non trouvée" };
      const cost = Number(card.energy_cost) || 0;
      if (p.energy < cost) return { error: `Pas assez d'énergie (${cost} requis, tu as ${p.energy})` };
      p.energy -= cost;
      if (hIdx !== -1) p.hand.splice(hIdx, 1)[0];
      else p.champion.splice(cIdx, 1)[0];
      card.exhausted = false;
      const validZones = ["field", "spellZone"];
      p[validZones.includes(action.zone) ? action.zone : "field"].push(card);
      addLog(room, p.playerIndex, `joue ${card.name}`);
      break;
    }

    // ── Mouvement vers un Battlefield ────────────────────────────────────────
    case "MOVE_TO_BF": {
      if (room.activePlayer !== null && p.playerIndex !== room.activePlayer) {
        return { error: "Ce n'est pas ton tour" };
      }
      const found = findInZones(p, action.instanceId);
      if (!found) return { error: "Carte introuvable" };
      const card = removeFromZone(p, found.zone, found.idx);
      const bf = room.battlefields[action.bfIndex ?? 0];
      if (!bf) return { error: "Battlefield introuvable" };
      if (!bf.units[p.playerIndex]) bf.units[p.playerIndex] = [];
      bf.units[p.playerIndex].push(card);
      addLog(room, p.playerIndex, `envoie ${card.name} au Battlefield ${(action.bfIndex ?? 0) + 1}`);
      break;
    }

    // ── Retour du BF vers la Base ────────────────────────────────────────────
    case "MOVE_FROM_BF": {
      const bf = room.battlefields[action.bfIndex ?? 0];
      if (!bf) return { error: "Battlefield introuvable" };
      const arr = bf.units[p.playerIndex] || [];
      const idx = arr.findIndex((c) => c.instanceId === action.instanceId);
      if (idx === -1) return { error: "Unité non trouvée sur ce Battlefield" };
      p.field.push(arr.splice(idx, 1)[0]);
      break;
    }

    // ── Résoudre le combat ────────────────────────────────────────────────────
    case "RESOLVE_COMBAT": {
      if (room.activePlayer !== null && p.playerIndex !== room.activePlayer) {
        return { error: "Ce n'est pas ton tour" };
      }
      const bf = room.battlefields[action.bfIndex ?? 0];
      if (!bf) return { error: "Battlefield introuvable" };
      if (!opp) return { error: "Adversaire introuvable" };

      const myUnits = bf.units[p.playerIndex] || [];
      const oppUnits = bf.units[opp.playerIndex] || [];
      if (myUnits.length === 0 && oppUnits.length === 0) return { error: "Aucune unité sur ce Battlefield" };

      // Dégâts simultanés : total might de chaque camp
      const myMight = myUnits.reduce((s, c) => s + getMight(c), 0);
      const oppMight = oppUnits.reduce((s, c) => s + getMight(c), 0);
      const myTotalHP = myUnits.reduce((s, c) => s + getHP(c), 0);
      const oppTotalHP = oppUnits.reduce((s, c) => s + getHP(c), 0);

      if (myTotalHP <= oppMight) { p.graveyard.push(...myUnits); bf.units[p.playerIndex] = []; }
      if (oppTotalHP <= myMight) { opp.graveyard.push(...oppUnits); bf.units[opp.playerIndex] = []; }

      // Conquête
      const mySurvives = (bf.units[p.playerIndex] || []).length > 0;
      const oppSurvives = (bf.units[opp.playerIndex] || []).length > 0;

      addLog(room, p.playerIndex, `résout le combat au Battlefield ${(action.bfIndex ?? 0) + 1}`);
      const bfIdx = action.bfIndex ?? 0;
      if (mySurvives && !oppSurvives && bf.controller !== p.playerIndex) {
        bf.controller = p.playerIndex; bf.conquered = true; p.score++; checkWin(room);
        addLog(room, p.playerIndex, `conquiert le Battlefield ${bfIdx + 1} ! (+1 pt)`);
      } else if (oppSurvives && !mySurvives && bf.controller !== opp.playerIndex) {
        bf.controller = opp.playerIndex; bf.conquered = true; opp.score++; checkWin(room);
        addLog(room, opp.playerIndex, `conquiert le Battlefield ${bfIdx + 1} ! (+1 pt)`);
      }
      break;
    }

    // ── Mouvements / manipulations génériques ────────────────────────────────
    case "MOVE_TO_ZONE": {
      // Chercher aussi dans les BFs
      let card;
      const found = findInZones(p, action.instanceId);
      if (found) {
        card = removeFromZone(p, found.zone, found.idx);
      } else {
        for (const bf of room.battlefields) {
          const arr = bf.units[p.playerIndex] || [];
          const idx = arr.findIndex((c) => c.instanceId === action.instanceId);
          if (idx !== -1) { card = arr.splice(idx, 1)[0]; break; }
        }
      }
      if (!card) return { error: "Carte introuvable" };
      const validDest = ["hand", "runeHand", "field", "champion", "spellZone", "graveyard", "banishment"];
      p[validDest.includes(action.toZone) ? action.toZone : "field"].push(card);
      break;
    }

    case "EXHAUST": {
      const found = findInZones(p, action.instanceId);
      if (!found) return { error: "Carte introuvable" };
      p[found.zone][found.idx].exhausted = !p[found.zone][found.idx].exhausted;
      break;
    }

    case "COUNTER": {
      const found = findInZones(p, action.instanceId);
      if (!found) return { error: "Carte introuvable" };
      p[found.zone][found.idx].counters = Math.max(0, (p[found.zone][found.idx].counters || 0) + action.delta);
      break;
    }

    case "HIDE": {
      const found = findInZones(p, action.instanceId);
      if (!found) return { error: "Carte introuvable" };
      p[found.zone][found.idx].hidden = !p[found.zone][found.idx].hidden;
      break;
    }

    case "UNEXHAUST_ALL": {
      for (const zone of ["champion", "field", "spellZone", "runeHand"]) {
        p[zone].forEach((c) => { c.exhausted = false; });
      }
      for (const bf of room.battlefields) {
        (bf.units[p.playerIndex] || []).forEach((c) => { c.exhausted = false; });
      }
      break;
    }

    case "BANISH": {
      const found = findInZones(p, action.instanceId);
      if (!found) return { error: "Carte introuvable" };
      p.banishment.push(removeFromZone(p, found.zone, found.idx));
      break;
    }

    case "CREATE_TOKEN": {
      const token = { ...action.card, instanceId: randomUUID(), exhausted: false, counters: 0, hidden: false };
      p.field.push(token);
      addLog(room, p.playerIndex, `crée un token ${token.name}`);
      break;
    }

    default:
      return { error: `Action inconnue : ${action.type}` };
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
