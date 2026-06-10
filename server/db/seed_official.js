require("dotenv").config();
const db = require("./index");

const API_BASE = "https://content.publishing.riotgames.com/publishing-content/v2.0/public/channel/riftbound_website/list/riftbound_gallery_cards";

const SETS = {
  OGN: { id: "origins", name: "Origins", date: "2025-10-31" },
  OGS: { id: "origins-proving-grounds", name: "Origins: Proving Grounds", date: "2025-10-31" },
  SFD: { id: "spiritforged", name: "Spiritforged", date: "2026-02-13" },
  UNL: { id: "unleashed", name: "Unleashed", date: "2026-05-08" },
};

// Only fetch/insert missing cards for these set codes (existing data for OGN/OGS/SFD
// already comes from apitcg and shouldn't be overwritten — we only fill the gaps).
const TARGET_CODES = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SETS);

function cleanName(name) {
  return name.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

const ICON_REPLACEMENTS = {
  exhaust: "Exhaust",
  might: "Might",
  rune_rainbow: "Rune",
  rune_body: "Body Rune",
  rune_calm: "Calm Rune",
  rune_chaos: "Chaos Rune",
  rune_fury: "Fury Rune",
  rune_mind: "Mind Rune",
  rune_order: "Order Rune",
};

function cleanText(html) {
  return html
    .replace(/<\/?p>/g, "")
    .replace(/:rb_energy_(\d+):/g, "{$1}")
    .replace(/:rb_(\w+):/g, (_, k) => `[${ICON_REPLACEMENTS[k] || k}]`)
    .trim();
}

async function fetchAll(locale, setCode) {
  const res = await fetch(`${API_BASE}?locale=${locale}&from=0&limit=1000`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${locale}`);
  const data = await res.json();
  return data.data.filter((c) => c.set?.value?.id === setCode);
}

function buildCard(c, setCode, setInfo, frByCode) {
  const types = c.cardType?.type || [];
  if (types.length === 0) return null; // tokens / cards without a card type

  // publicCode looks like "OGN-007a/298", "SFD-224*/221" or "UNL-T01" (token battlefields, no "/denom")
  const m = c.publicCode.match(new RegExp(`^${setCode}-(\\S+)\\/(\\d+)$`));
  const tokenMatch = !m && c.publicCode.match(new RegExp(`^${setCode}-(T\\d+)$`));
  if (!m && !(tokenMatch && types.some((t) => t.id === "battlefield"))) return null;

  const code = m ? m[1] : tokenMatch[1];
  const denom = m ? m[2] : null;
  const slug = code.replace(/\*/g, "alt").toLowerCase();

  const cardType = types.map((t) => t.id.charAt(0).toUpperCase() + t.id.slice(1)).join(";");
  const domains = (c.domain?.values || []).map((v) => v.label).filter((d) => d !== "Colorless");
  const domain = domains.length ? domains.join(";") : null;
  const number = denom ? `${code}/${denom}` : code;

  const fr = frByCode[c.publicCode];
  const baseImg = c.cardImage?.url || null;

  return {
    id: denom ? `${setInfo.id}-${slug}-${denom}` : `${setInfo.id}-${slug}`,
    number,
    name: c.name,
    name_fr: fr ? fr.name : null,
    clean_name: cleanName(c.name),
    rarity: c.rarity?.value?.label || null,
    card_type: cardType,
    domain,
    energy_cost: c.energy?.value?.id != null ? String(c.energy.value.id) : null,
    power_cost: c.power?.value?.id != null ? String(c.power.value.id) : null,
    might: c.might?.value?.id != null ? String(c.might.value.id) : null,
    description: c.text?.richText?.body ? cleanText(c.text.richText.body) : null,
    flavor_text: null,
    image_small: baseImg ? `${baseImg}&w=400` : null,
    image_large: baseImg,
    set_id: setInfo.id,
    set_name: setInfo.name,
    set_release_date: setInfo.date,
    tcgplayer_id: null,
    tcgplayer_url: null,
  };
}

async function seedSet(setCode) {
  const setInfo = SETS[setCode];
  console.log(`\n=== ${setCode} (${setInfo.name}) ===`);

  const en = await fetchAll("en_US", setCode);
  const fr = await fetchAll("fr_FR", setCode);
  console.log(`  fetched ${en.length} (en) / ${fr.length} (fr)`);

  const frByCode = {};
  fr.forEach((c) => { frByCode[c.publicCode] = c; });

  const cards = en.map((c) => buildCard(c, setCode, setInfo, frByCode)).filter(Boolean);
  console.log(`  ${cards.length} cards with a card type + denom`);

  let inserted = 0;
  for (const card of cards) {
    const { rowCount } = await db.query(
      `INSERT INTO cards (
        id, number, name, name_fr, clean_name, rarity, card_type, domain,
        energy_cost, power_cost, might, description, flavor_text,
        image_small, image_large, set_id, set_name, set_release_date,
        tcgplayer_id, tcgplayer_url
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      ) ON CONFLICT (id) DO NOTHING`,
      [
        card.id, card.number, card.name, card.name_fr, card.clean_name, card.rarity, card.card_type, card.domain,
        card.energy_cost, card.power_cost, card.might, card.description, card.flavor_text,
        card.image_small, card.image_large, card.set_id, card.set_name, card.set_release_date,
        card.tcgplayer_id, card.tcgplayer_url,
      ]
    );
    inserted += rowCount;
  }

  console.log(`  → ${inserted} new cards inserted (gaps filled)`);
}

async function seed() {
  for (const code of TARGET_CODES) {
    await seedSet(code);
  }
}

seed().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
