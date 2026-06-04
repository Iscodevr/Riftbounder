const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/index");
const { SECRET } = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email, hash]
    );
    const user = rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    if (e.message?.includes("UNIQUE") || e.code === "23505")
      return res.status(409).json({ error: "Email déjà utilisé" });
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Identifiants incorrects" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Identifiants incorrects" });
    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
