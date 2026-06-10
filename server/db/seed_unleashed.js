require("dotenv").config();
const db = require("./index");

const SET_ID = "unleashed";
const SET_NAME = "Unleashed";
const SET_RELEASE_DATE = "2026-05-08";
const API_BASE = "https://content.publishing.riotgames.com/publishing-content/v2.0/public/channel/riftbound_website/list/riftbound_gallery_cards";

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

async function fetchAll(locale) {
  const res = await fetch(`${API_BASE}?locale=${locale}&from=0&limit=1000`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${locale}`);
  const data = await res.json();
  return data.data.filter((c) => c.set?.value?.id === "UNL");
}

function buildCard(c, frByCode) {
  const types = c.cardType?.type || [];
  if (types.length === 0) return null; // tokens / cards without a card type

  // publicCode looks like "UNL-147/219", "UNL-147a/219", "UNL-230*/219" or "UNL-T01" (tokens)
  const m = c.publicCode.match(/^UNL-(\S+)\/(\d+)$/);
  if (!m) return null; // skip tokens (no "/denom")

  const code = m[1]; // e.g. "147", "147a", "230*"
  const denom = m[2];
  const slug = code.replace(/\*/g, "alt").toLowerCase();

  const cardType = types.map((t) => t.id.charAt(0).toUpperCase() + t.id.slice(1)).join(";");
  const domains = (c.domain?.values || []).map((v) => v.label).filter((d) => d !== "Colorless");
  const domain = domains.length ? domains.join(";") : null;
  const number = `${code}/${denom}`;

  const fr = frByCode[c.publicCode];

  const baseImg = c.cardImage?.url || null;

  return {
    id: `${SET_ID}-${slug}-${denom}`,
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
    set_id: SET_ID,
    set_name: SET_NAME,
    set_release_date: SET_RELEASE_DATE,
    tcgplayer_id: null,
    tcgplayer_url: null,
  };
}

async function seed() {
  console.log("Fetching Unleashed (en-us)...");
  const en = await fetchAll("en_US");
  console.log(`  → ${en.length} cards (en)`);

  console.log("Fetching Unleashed (fr-fr)...");
  const fr = await fetchAll("fr_FR");
  console.log(`  → ${fr.length} cards (fr)`);

  const frByCode = {};
  fr.forEach((c) => { frByCode[c.publicCode] = c; });

  const cards = en.map((c) => buildCard(c, frByCode)).filter(Boolean);
  console.log(`  → ${cards.length} cards with a card type`);

  for (const card of cards) {
    await db.query(
      `INSERT INTO cards (
        id, number, name, name_fr, clean_name, rarity, card_type, domain,
        energy_cost, power_cost, might, description, flavor_text,
        image_small, image_large, set_id, set_name, set_release_date,
        tcgplayer_id, tcgplayer_url
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      ) ON CONFLICT (id) DO UPDATE SET
        number=EXCLUDED.number, name=EXCLUDED.name,
        name_fr=COALESCE(cards.name_fr, EXCLUDED.name_fr),
        clean_name=EXCLUDED.clean_name,
        rarity=EXCLUDED.rarity, card_type=EXCLUDED.card_type, domain=EXCLUDED.domain,
        energy_cost=EXCLUDED.energy_cost, power_cost=EXCLUDED.power_cost, might=EXCLUDED.might,
        description=EXCLUDED.description, flavor_text=EXCLUDED.flavor_text,
        image_small=EXCLUDED.image_small, image_large=EXCLUDED.image_large,
        set_id=EXCLUDED.set_id, set_name=EXCLUDED.set_name, set_release_date=EXCLUDED.set_release_date,
        tcgplayer_id=EXCLUDED.tcgplayer_id, tcgplayer_url=EXCLUDED.tcgplayer_url`,
      [
        card.id, card.number, card.name, card.name_fr, card.clean_name, card.rarity, card.card_type, card.domain,
        card.energy_cost, card.power_cost, card.might, card.description, card.flavor_text,
        card.image_small, card.image_large, card.set_id, card.set_name, card.set_release_date,
        card.tcgplayer_id, card.tcgplayer_url,
      ]
    );
  }

  console.log(`\nDone. ${cards.length} Unleashed cards inserted/updated.`);
}

seed().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
