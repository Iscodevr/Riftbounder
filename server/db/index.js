require("dotenv").config();

// En prod (DATABASE_URL définie) → PostgreSQL via Neon
// En dev (pas de DATABASE_URL) → SQLite local
const isPg = !!process.env.DATABASE_URL;

let db;

if (isPg) {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Wrapper qui imite l'API qu'on utilise : db.query(sql, params)
  db = {
    isPg: true,
    query: (sql, params = []) => pool.query(sql, params),
    pool,
  };
} else {
  const sqlite = require("./schema");

  // Wrapper SQLite avec la même signature async
  db = {
    isPg: false,
    query: async (sql, params = []) => {
      // Convertir $1,$2... → ? pour SQLite
      let i = 0;
      const sqliteSQL = sql.replace(/\$\d+/g, () => "?");
      // Détecter le type de requête
      const verb = sqliteSQL.trim().toUpperCase().slice(0, 6);
      if (verb === "SELECT") {
        const rows = sqlite.prepare(sqliteSQL).all(...params);
        return { rows };
      } else if (verb === "INSERT" && sqliteSQL.includes("RETURNING")) {
        // SQLite ne supporte pas RETURNING → simuler avec lastInsertRowid
        const sqlNoReturning = sqliteSQL.replace(/RETURNING.*/is, "");
        const result = sqlite.prepare(sqlNoReturning).run(...params);
        // Relire la ligne insérée
        const table = sqliteSQL.match(/INSERT INTO (\w+)/i)?.[1];
        const row = table
          ? sqlite.prepare(`SELECT * FROM ${table} WHERE rowid = ?`).get(result.lastInsertRowid)
          : null;
        return { rows: row ? [row] : [], rowCount: result.changes };
      } else {
        const result = sqlite.prepare(sqliteSQL).run(...params);
        return { rows: [], rowCount: result.changes };
      }
    },
  };
}

module.exports = db;
