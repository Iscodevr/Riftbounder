const express = require("express");
const db = require("../db/index");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { q, set, type, domain, rarity, page = 1, limit = 40 } = req.query;
    const offset = (page - 1) * limit;
    const where = ["card_type IS NOT NULL"];
    const params = [];
    let i = 1;

    if (q) {
      where.push(`(name ILIKE $${i} OR description ILIKE $${i+1} OR number ILIKE $${i+2})`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`); i += 3;
    }
    if (set)    { where.push(`set_id = $${i++}`);    params.push(set); }
    if (type)   { where.push(`card_type = $${i++}`); params.push(type); }
    if (domain) { where.push(`domain ILIKE $${i++}`); params.push(`%${domain}%`); }
    if (rarity) { where.push(`rarity = $${i++}`);    params.push(rarity); }

    const w = where.join(" AND ");
    const { rows: countRows } = await db.query(`SELECT COUNT(*) as count FROM cards WHERE ${w}`, params);
    const total = parseInt(countRows[0].count);
    const { rows: cards } = await db.query(
      `SELECT * FROM cards WHERE ${w} ORDER BY set_id, number LIMIT $${i} OFFSET $${i+1}`,
      [...params, Number(limit), offset]
    );
    res.json({ cards, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/sets", async (_req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT DISTINCT set_id, set_name, set_release_date FROM cards WHERE set_id IS NOT NULL ORDER BY set_release_date"
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/filters", async (_req, res) => {
  try {
    const [t, d, r] = await Promise.all([
      db.query("SELECT DISTINCT card_type FROM cards WHERE card_type IS NOT NULL ORDER BY card_type"),
      db.query("SELECT DISTINCT domain FROM cards WHERE domain IS NOT NULL ORDER BY domain"),
      db.query("SELECT DISTINCT rarity FROM cards WHERE rarity IS NOT NULL ORDER BY rarity"),
    ]);
    const domains = [...new Set(d.rows.flatMap((r) => r.domain.split(";")))].sort();
    res.json({
      types: t.rows.map((r) => r.card_type),
      domains,
      rarities: r.rows.map((r) => r.rarity),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cards/import  { names: ["En Garde", "Calm Rune", ...] }
// Returns best-match card per name (case-insensitive, prefers exact then partial)
router.post("/import", async (req, res) => {
  const { names } = req.body;
  if (!Array.isArray(names) || names.length === 0)
    return res.status(400).json({ error: "names[] requis" });

  try {
    const results = await Promise.all(names.map(async (name) => {
      // Normalize: strip punctuation for clean_name matching
      const cleanQuery = name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      // Also try replacing ", " ↔ " - " for Riftbound card name conventions
      const altName = name.includes(", ")
        ? name.replace(/, /g, " - ")
        : name.replace(/ - /g, ", ");

      const { rows } = await db.query(
        `SELECT * FROM cards
         WHERE card_type IS NOT NULL
           AND (name ILIKE $1 OR name ILIKE $2
             OR REGEXP_REPLACE(LOWER(name), $6, ' ', 'g') ILIKE $3)
         ORDER BY
           CASE WHEN LOWER(name) = LOWER($4) THEN 0
                WHEN LOWER(name) = LOWER($5) THEN 0
                ELSE 1 END,
           set_release_date DESC
         LIMIT 5`,
        [`%${name}%`, `%${altName}%`, `%${cleanQuery}%`, name, altName, '[^a-z0-9 ]']
      );
      return { name, cards: rows };
    }));
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM cards WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Carte introuvable" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
