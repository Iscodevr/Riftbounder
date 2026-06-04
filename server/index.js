require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : true;
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/cards", require("./routes/cards"));
app.use("/api/library", require("./routes/library"));
app.use("/api/decks", require("./routes/decks"));
app.use("/api/identify", require("./routes/identify"));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
