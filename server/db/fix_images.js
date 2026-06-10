// Re-points image_small/image_large to the official Riot CMS (cmsassets.rgpub.io) for
// every card, so all sets use the same image source/format instead of a mix of
// tcgplayer (Origins/Spiritforged from apitcg) and sanity (Unleashed).
require("dotenv").config();
const db = require("./index");

const API_BASE = "https://content.publishing.riotgames.com/publishing-content/v2.0/public/channel/riftbound_website/list/riftbound_gallery_cards";

const SETS = {
  OGN: { id: "origins" },
  OGS: { id: "origins-proving-grounds" },
  SFD: { id: "spiritforged" },
  UNL: { id: "unleashed" },
};

const TARGET_CODES = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SETS);

async function fetchAll(setCode) {
  const res = await fetch(`${API_BASE}?locale=en_US&from=0&limit=1000`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.data.filter((c) => c.set?.value?.id === setCode);
}

function idFor(c, setCode, setId) {
  const m = c.publicCode.match(new RegExp(`^${setCode}-(\\S+)\\/(\\d+)$`));
  const tokenMatch = !m && c.publicCode.match(new RegExp(`^${setCode}-(T\\d+)$`));
  if (!m && !tokenMatch) return null;

  const code = m ? m[1] : tokenMatch[1];
  const denom = m ? m[2] : null;
  const slug = code.replace(/\*/g, "alt").toLowerCase();
  return denom ? `${setId}-${slug}-${denom}` : `${setId}-${slug}`;
}

async function fixSet(setCode) {
  const setId = SETS[setCode].id;
  console.log(`\n=== ${setCode} (${setId}) ===`);

  const cards = await fetchAll(setCode);
  console.log(`  fetched ${cards.length} cards`);

  let updated = 0;
  for (const c of cards) {
    const id = idFor(c, setCode, setId);
    const baseImg = c.cardImage?.url;
    if (!id || !baseImg) continue;

    const { rowCount } = await db.query(
      `UPDATE cards SET image_small = $1, image_large = $2 WHERE id = $3`,
      [`${baseImg}&w=400`, baseImg, id]
    );
    updated += rowCount;
  }

  console.log(`  → ${updated} cards updated with official images`);
}

async function run() {
  for (const code of TARGET_CODES) {
    await fixSet(code);
  }
}

run().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
