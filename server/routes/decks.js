const express = require("express");
const db = require("../db/index");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.*, COUNT(dc.id) as card_count
       FROM decks d LEFT JOIN deck_cards dc ON dc.deck_id = d.id
       WHERE d.user_id = $1
       GROUP BY d.id ORDER BY d.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "Nom requis" });
  try {
    const { rows } = await db.query(
      "INSERT INTO decks (user_id, name, description) VALUES ($1, $2, $3) RETURNING *",
      [req.user.id, name, description ?? null]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const { rows: deckRows } = await db.query(
      "SELECT * FROM decks WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!deckRows[0]) return res.status(404).json({ error: "Deck introuvable" });
    const deck = deckRows[0];

    const { rows: cards } = await db.query(
      `SELECT c.*, dc.quantity FROM deck_cards dc
       JOIN cards c ON c.id = dc.card_id
       WHERE dc.deck_id = $1
       ORDER BY c.card_type, c.name`,
      [deck.id]
    );
    res.json({ ...deck, cards });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  const { name, description } = req.body;
  try {
    await db.query(
      "UPDATE decks SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4",
      [name, description ?? null, req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM decks WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/:id/cards", async (req, res) => {
  const { card_id, quantity = 1 } = req.body;
  try {
    const { rows: deckRows } = await db.query(
      "SELECT id FROM decks WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!deckRows[0]) return res.status(404).json({ error: "Deck introuvable" });
    const deckId = deckRows[0].id;

    await db.query(
      `INSERT INTO deck_cards (deck_id, card_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (deck_id, card_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [deckId, card_id, quantity]
    );
    await db.query("UPDATE decks SET updated_at = NOW() WHERE id = $1", [deckId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id/cards/:card_id", async (req, res) => {
  try {
    const { rows: deckRows } = await db.query(
      "SELECT id FROM decks WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!deckRows[0]) return res.status(404).json({ error: "Deck introuvable" });
    const deckId = deckRows[0].id;

    await db.query("DELETE FROM deck_cards WHERE deck_id = $1 AND card_id = $2", [deckId, req.params.card_id]);
    await db.query("UPDATE decks SET updated_at = NOW() WHERE id = $1", [deckId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
