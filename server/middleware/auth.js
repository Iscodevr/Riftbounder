const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "riftbound-dev-secret";

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant" });
  }
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}

module.exports = { authMiddleware, SECRET };
