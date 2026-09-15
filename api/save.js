const crypto = require("crypto");

function verify(token, secret) {
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

const ALLOWED_KEYS = ["content", "contatti", "catalogo", "testimonianze", "dalcampo", "marchi", "tipi", "immagini"];

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const SESSION_SECRET = process.env.SESSION_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SESSION_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: "server non configurato: mancano le variabili d'ambiente Supabase" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  if (!verify(body.token, SESSION_SECRET)) {
    res.status(401).json({ error: "sessione scaduta o non valida, rifai l'accesso" });
    return;
  }

  const key = body.key;
  const value = body.value;
  if (!key || ALLOWED_KEYS.indexOf(key) === -1 || typeof value === "undefined") {
    res.status(400).json({ error: "richiesta non valida" });
    return;
  }

  const upstream = await fetch(SUPABASE_URL + "/rest/v1/site_data", {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({ key: key, value: value, updated_at: new Date().toISOString() })
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(function () { return ""; });
    res.status(502).json({ error: "errore nel salvataggio su Supabase", detail: detail.slice(0, 300) });
    return;
  }

  res.status(200).json({ ok: true });
};
