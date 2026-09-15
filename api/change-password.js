const crypto = require("crypto");
const login = require("./login.js");

function verifyToken(token, secret) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const payload = parts[0];
  const sig = parts[1];
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig.length !== expected.length) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return false;
  const expires = Number(payload);
  if (!expires || Date.now() > expires) return false;
  return true;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const SESSION_SECRET = process.env.SESSION_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!SESSION_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: "server non configurato: mancano le variabili d'ambiente" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  if (!verifyToken(body.token, SESSION_SECRET)) {
    res.status(401).json({ error: "sessione scaduta o non valida, rifai l'accesso" });
    return;
  }

  const oldPassword = body.oldPassword;
  const newPassword = body.newPassword;
  if (!newPassword || String(newPassword).length < 6) {
    res.status(400).json({ error: "la nuova password deve avere almeno 6 caratteri" });
    return;
  }

  const oldResult = await login.checkPassword(oldPassword || "", SUPABASE_URL, SERVICE_KEY, ADMIN_PASSWORD);
  if (!oldResult.ok) {
    if (oldResult.dbError) {
      res.status(503).json({ error: "Non riesco a controllare la password attuale in questo momento (problema nel contattare il database). Riprova tra poco.", detail: oldResult.detail });
      return;
    }
    res.status(401).json({ error: "la password attuale non è corretta" });
    return;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = login.hashPassword(newPassword, salt);

  const upstream = await fetch(SUPABASE_URL + "/rest/v1/admin_auth", {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({ id: "main", pass_hash: hash, pass_salt: salt, updated_at: new Date().toISOString() })
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(function () { return ""; });
    res.status(502).json({ error: "errore nel salvataggio su Supabase", detail: detail.slice(0, 300) });
    return;
  }

  res.status(200).json({ ok: true });
};
