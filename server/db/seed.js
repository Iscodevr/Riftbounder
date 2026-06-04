require("dotenv").config();
const fetch = require("node-fetch");
const db = require("./index");

const SETS = [
  "https://raw.githubusercontent.com/apitcg/riftbound-tcg-data/main/cards/en/origins.json",
  "https://raw.githubusercontent.com/apitcg/riftbound-tcg-data/main/cards/en/spiritforged.json",
  "https://raw.githubusercontent.com/apitcg/riftbound-tcg-data/main/cards/en/origins-proving-grounds.json",
];

async function seed() {
  let total = 0;

  for (const url of SETS) {
    console.log(`Fetching ${url}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = await res.json();

    const cards = data
      .filter((c) => c.cardType !== null)
      .map((c) => ({
        id: c.id,
        number: c.number ?? null,
        name: c.name,
        clean_name: c.cleanName ?? null,
        rarity: c.rarity ?? null,
        card_type: c.cardType ?? null,
        domain: c.domain ?? null,
        energy_cost: c.energyCost ?? null,
        power_cost: c.powerCost ?? null,
        might: c.might ?? null,
        description: c.description ?? null,
        flavor_text: c.flavorText ?? null,
        image_small: c.images?.small ?? null,
        image_large: c.images?.large ?? null,
        set_id: c.set?.id ?? null,
        set_name: c.set?.name ?? null,
        set_release_date: c.set?.releaseDate ?? null,
        tcgplayer_id: c.tcgplayer?.id ?? null,
        tcgplayer_url: c.tcgplayer?.url ?? null,
      }));

    for (const card of cards) {
      await db.query(
        `INSERT INTO cards (
          id, number, name, clean_name, rarity, card_type, domain,
          energy_cost, power_cost, might, description, flavor_text,
          image_small, image_large, set_id, set_name, set_release_date,
          tcgplayer_id, tcgplayer_url
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
        ) ON CONFLICT (id) DO UPDATE SET
          number=EXCLUDED.number, name=EXCLUDED.name, clean_name=EXCLUDED.clean_name,
          rarity=EXCLUDED.rarity, card_type=EXCLUDED.card_type, domain=EXCLUDED.domain,
          energy_cost=EXCLUDED.energy_cost, power_cost=EXCLUDED.power_cost, might=EXCLUDED.might,
          description=EXCLUDED.description, flavor_text=EXCLUDED.flavor_text,
          image_small=EXCLUDED.image_small, image_large=EXCLUDED.image_large,
          set_id=EXCLUDED.set_id, set_name=EXCLUDED.set_name, set_release_date=EXCLUDED.set_release_date,
          tcgplayer_id=EXCLUDED.tcgplayer_id, tcgplayer_url=EXCLUDED.tcgplayer_url`,
        [
          card.id, card.number, card.name, card.clean_name, card.rarity, card.card_type, card.domain,
          card.energy_cost, card.power_cost, card.might, card.description, card.flavor_text,
          card.image_small, card.image_large, card.set_id, card.set_name, card.set_release_date,
          card.tcgplayer_id, card.tcgplayer_url,
        ]
      );
    }

    console.log(`  → ${cards.length} cards inserted`);
    total += cards.length;
  }

  console.log(`\nDone. ${total} cards total in database.`);
}

seed().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
