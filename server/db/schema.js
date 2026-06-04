const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "riftbound.sqlite"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    number TEXT,
    name TEXT NOT NULL,
    name_fr TEXT,
    clean_name TEXT,
    rarity TEXT,
    card_type TEXT,
    domain TEXT,
    energy_cost TEXT,
    power_cost TEXT,
    might TEXT,
    description TEXT,
    flavor_text TEXT,
    image_small TEXT,
    image_large TEXT,
    set_id TEXT,
    set_name TEXT,
    set_release_date TEXT,
    tcgplayer_id INTEGER,
    tcgplayer_url TEXT
  );

  CREATE TABLE IF NOT EXISTS library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, card_id)
  );

  CREATE TABLE IF NOT EXISTS decks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS deck_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    UNIQUE(deck_id, card_id)
  );

  CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
  CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_id);
  CREATE INDEX IF NOT EXISTS idx_library_user ON library(user_id);
  CREATE INDEX IF NOT EXISTS idx_deck_cards_deck ON deck_cards(deck_id);
`);

module.exports = db;
