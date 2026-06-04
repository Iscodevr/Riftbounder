const express = require("express");
const db = require("../db/index");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const { q, set, type, domain, rarity, page = 1, limit = 40 } = req.query;
    const offset = (page - 1) * limit;
    const where = ["l.user_id = $1"];
    const params = [req.user.id];
    let i = 2;

    if (q)      { where.push(`(c.name ILIKE $${i} OR c.description ILIKE $${i+1})`); params.push(`%${q}%`, `%${q}%`); i += 2; }
    if (set)    { where.push(`c.set_id = $${i++}`);    params.push(set); }
    if (type)   { where.push(`c.card_type = $${i++}`); params.push(type); }
    if (domain) { where.push(`c.domain = $${i++}`);    params.push(domain); }
    if (rarity) { where.push(`c.rarity = $${i++}`);    params.push(rarity); }

    const w = where.join(" AND ");
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) as count FROM library l JOIN cards c ON c.id = l.card_id WHERE ${w}`, params
    );
    const total = parseInt(countRows[0].count);
    const { rows: cards } = await db.query(
      `SELECT c.*, l.quantity FROM library l JOIN cards c ON c.id = l.card_id WHERE ${w} ORDER BY c.set_id, c.number LIMIT $${i} OFFSET $${i+1}`,
      [...params, Number(limit), offset]
    );
    res.json({ cards, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  const { card_id, quantity = 1 } = req.body;
  if (!card_id) return res.status(400).json({ error: "card_id requis" });
  try {
    const { rows } = await db.query("SELECT id FROM cards WHERE id = $1", [card_id]);
    if (!rows[0]) return res.status(404).json({ error: "Carte introuvable" });

    await db.query(
      `INSERT INTO library (user_id, card_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = library.quantity + EXCLUDED.quantity`,
      [req.user.id, card_id, quantity]
    );
    const { rows: entry } = await db.query(
      "SELECT * FROM library WHERE user_id = $1 AND card_id = $2", [req.user.id, card_id]
    );
    res.json(entry[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:card_id", async (req, res) => {
  const { quantity } = req.body;
  if (quantity < 1) return res.status(400).json({ error: "Quantité invalide" });
  try {
    await db.query("UPDATE library SET quantity = $1 WHERE user_id = $2 AND card_id = $3",
      [quantity, req.user.id, req.params.card_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/:card_id", async (req, res) => {
  try {
    await db.query("DELETE FROM library WHERE user_id = $1 AND card_id = $2",
      [req.user.id, req.params.card_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
