const crypto = require("crypto");

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

// Legge la password attuale: se è stata cambiata dal pannello admin, vive nella
// tabella privata admin_auth su Supabase (mai leggibile dal browser). Se non è
// mai stata cambiata, si usa ancora la variabile d'ambiente ADMIN_PASSWORD.
async function checkPassword(password, SUPABASE_URL, SERVICE_KEY, ADMIN_PASSWORD) {
  if (SUPABASE_URL && SERVICE_KEY) {
    const resp = await fetch(SUPABASE_URL + "/rest/v1/admin_auth?id=eq.main&select=pass_hash,pass_salt", {
      headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY }
    }).catch(function () { return null; });
    if (resp && resp.ok) {
      const rows = await resp.json().catch(function () { return []; });
      if (rows && rows[0]) {
        const expected = hashPassword(password, rows[0].pass_salt);
        const a = Buffer.from(expected, "hex");
        const b = Buffer.from(rows[0].pass_hash, "hex");
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
      }
    }
  }
  return !!ADMIN_PASSWORD && password === ADMIN_PASSWORD;
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
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SESSION_SECRET) {
    res.status(500).json({ error: "server non configurato: manca SESSION_SECRET" });
    return;
  }

  const ok = await checkPassword(password || "", SUPABASE_URL, SERVICE_KEY, ADMIN_PASSWORD);
  if (!ok) {
    res.status(401).json({ error: "credenziali non valide" });
    return;
  }

  const expires = Date.now() + 1000 * 60 * 60 * 12; // 12 ore
  const payload = String(expires);
  const token = payload + "." + sign(payload, SESSION_SECRET);
  res.status(200).json({ token: token });
};

module.exports.checkPassword = checkPassword;
module.exports.hashPassword = hashPassword;
