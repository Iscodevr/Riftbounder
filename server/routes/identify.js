const express = require("express");
const db = require("../db/index");

const router = express.Router();

const FR_DOMAIN = {
  furie: "Fury", fury: "Fury",
  calme: "Calm", calm: "Calm",
  esprit: "Mind", mind: "Mind",
  corps: "Body", body: "Body",
  ordre: "Order", order: "Order",
  chaos: "Chaos",
};
const FR_TYPE = {
  "unité": "Unit", "unite": "Unit", unit: "Unit",
  sort: "Spell", spell: "Spell",
  "équipement": "Gear", equipement: "Gear", gear: "Gear",
  rune: "Rune",
  "légende": "Legend", legende: "Legend", legend: "Legend",
};

const STOP_WORDS = new Set([
  "the", "and", "you", "may", "can", "this", "that", "with", "have",
  "me", "my", "your", "its", "our", "not", "mais", "les", "des", "une",
  "que", "qui", "pas", "par", "sur", "dans", "est", "sont", "avec",
  "pour", "tout", "plus", "fois", "lorsque", "when", "while", "play",
  "card", "carte", "turn", "tour", "draw", "pioche", "cost", "cout",
]);

function norm(s = "") {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function strScore(a, b) {
  if (!a || !b) return 0;
  const na = norm(a), nb = norm(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.75;
  const wa = new Set(na.split(" ").filter((w) => w.length > 2 && !STOP_WORDS.has(w)));
  const wb = new Set(nb.split(" ").filter((w) => w.length > 2 && !STOP_WORDS.has(w)));
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  wa.forEach((w) => { if (wb.has(w)) common++; });
  return common / Math.max(wa.size, wb.size);
}

function extractNumber(text) {
  const m = text.match(/(?:^|[\s•·\-])(\d{1,3})\s*[\/\\|l]\s*(\d{2,3})(?:[\s•·\-]|$)/m)
    || text.match(/(\d{1,3})\s*\/\s*(\d{2,3})/);
  if (!m) return null;
  const total = parseInt(m[2]);
  if (total < 50) return null;
  return `${String(parseInt(m[1])).padStart(3, "0")}/${m[2]}`;
}

function extractNumbers(text) {
  return [...text.matchAll(/\b(\d{1,2})\b/g)].map((m) => m[1]);
}

function countStrongSignals({ cardNumber, detectedDomain, detectedType, bestNameScore }) {
  let signals = 0;
  if (cardNumber) signals += 3;
  if (detectedDomain) signals += 1;
  if (detectedType) signals += 1;
  if (bestNameScore >= 0.6) signals += 2;
  else if (bestNameScore >= 0.3) signals += 1;
  return signals;
}

const MIN_OCR_CONFIDENCE = 45;
const MIN_SCORE = 40;
const MIN_SIGNALS = 2;
const AUTO_ADD_SCORE = 70;

router.post("/", async (req, res) => {
  try {
    const { text = "", confidence } = req.body;

    if (confidence != null && confidence < MIN_OCR_CONFIDENCE) {
      return res.json({ candidates: [], reason: "low_confidence", confidence });
    }
    if (!text.trim()) return res.json({ candidates: [] });

    const lines = text.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
    const fullNorm = norm(text);

    // 1. Card number → immediate match
    const cardNumber = extractNumber(text);
    if (cardNumber) {
      const { rows: byNumber } = await db.query(
        "SELECT * FROM cards WHERE number LIKE $1 AND card_type IS NOT NULL",
        [`%${cardNumber}%`]
      );
      if (byNumber.length >= 1) {
        return res.json({
          candidates: byNumber.map((c) => ({ ...c, score: 100, matchType: "number" })),
        });
      }
    }

    // 2. Detect domain and type
    let detectedDomain = null;
    let detectedType = null;
    for (const [fr, en] of Object.entries(FR_DOMAIN)) {
      if (fullNorm.includes(fr)) { detectedDomain = en; break; }
    }
    for (const [fr, en] of Object.entries(FR_TYPE)) {
      if (fullNorm.includes(fr)) { detectedType = en; break; }
    }

    // 3. Numbers for cost/might
    const nums = extractNumbers(text);

    // 4. Pre-filter candidates
    let candidates;
    if (detectedDomain && detectedType) {
      const { rows } = await db.query(
        "SELECT * FROM cards WHERE domain LIKE $1 AND card_type = $2 AND card_type IS NOT NULL",
        [`%${detectedDomain}%`, detectedType]
      );
      candidates = rows;
    } else if (detectedDomain) {
      const { rows } = await db.query(
        "SELECT * FROM cards WHERE domain LIKE $1 AND card_type IS NOT NULL",
        [`%${detectedDomain}%`]
      );
      candidates = rows;
    } else if (detectedType) {
      const { rows } = await db.query(
        "SELECT * FROM cards WHERE card_type = $1 AND card_type IS NOT NULL",
        [detectedType]
      );
      candidates = rows;
    } else {
      const firstLine = lines[0] || "XXXXXX";
      const { rows } = await db.query(
        "SELECT * FROM cards WHERE (name ILIKE $1 OR name_fr ILIKE $2) AND card_type IS NOT NULL",
        [`%${firstLine}%`, `%${firstLine}%`]
      );
      if (rows.length === 0) {
        return res.json({ candidates: [], reason: "no_signals" });
      }
      candidates = rows;
    }

    // 5. Score each candidate
    let globalBestName = 0;
    const scored = candidates.map((card) => {
      let score = 0;

      if (detectedDomain && card.domain && card.domain.includes(detectedDomain)) score += 15;
      if (detectedType && card.card_type === detectedType) score += 15;
      if (card.energy_cost && nums.includes(String(card.energy_cost))) score += 10;
      if (card.might && nums.includes(String(card.might))) score += 10;

      const bestName = Math.max(...lines.map((l) => strScore(card.name, l)), 0);
      score += Math.round(bestName * 50);
      if (bestName > globalBestName) globalBestName = bestName;

      if (card.name_fr) {
        const bestFr = Math.max(...lines.map((l) => strScore(card.name_fr, l)), 0);
        score += Math.round(bestFr * 50);
        if (bestFr > globalBestName) globalBestName = bestFr;
      }

      const nameWords = norm(card.name).split(" ").filter((w) => w.length > 3 && !STOP_WORDS.has(w));
      if (nameWords.length > 0) {
        const matched = nameWords.filter((w) => fullNorm.includes(w)).length;
        score += Math.round((matched / nameWords.length) * 20);
      }

      return { ...card, score, matchType: "scored" };
    });

    // 6. Check signal strength
    const signals = countStrongSignals({ cardNumber, detectedDomain, detectedType, bestNameScore: globalBestName });
    if (signals < MIN_SIGNALS) {
      return res.json({ candidates: [], reason: "insufficient_signals", signals });
    }

    // 7. Filter by minimum score, return top 5
    const top = scored
      .filter((c) => c.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.json({ candidates: top, autoAdd: top.length === 1 && top[0].score >= AUTO_ADD_SCORE });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch("/name-fr", async (req, res) => {
  const { card_id, name_fr } = req.body;
  if (!card_id || !name_fr) return res.status(400).json({ error: "card_id et name_fr requis" });
  try {
    await db.query("UPDATE cards SET name_fr = $1 WHERE id = $2", [name_fr.trim(), card_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
