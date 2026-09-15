const crypto = require("crypto");

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const password = body && body.password;

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const SESSION_SECRET = process.env.SESSION_SECRET;
  if (!ADMIN_PASSWORD || !SESSION_SECRET) {
    res.status(500).json({ error: "server non configurato: mancano ADMIN_PASSWORD o SESSION_SECRET" });
    return;
  }

  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "credenziali non valide" });
    return;
  }

  const expires = Date.now() + 1000 * 60 * 60 * 12; // 12 ore
  const payload = String(expires);
  const token = payload + "." + sign(payload, SESSION_SECRET);
  res.status(200).json({ token: token });
};
