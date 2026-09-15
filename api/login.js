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
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function fetchAdminAuthRow(SUPABASE_URL, SERVICE_KEY) {
  var url = SUPABASE_URL + "/rest/v1/admin_auth?id=eq.main&select=pass_hash,pass_salt";
  var opts = { headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY } };
  // Un tentativo solo non basta: appena la tabella admin_auth viene creata, la cache
  // dello schema di Supabase puo' impiegare qualche istante ad aggiornarsi, e in quella
  // finestra le richieste falliscono anche se tutto e' configurato correttamente. Un
  // singolo ritentativo dopo una breve pausa copre questo caso senza indebolire la
  // sicurezza (un vero guasto persistente continua comunque a bloccare il login).
  var resp = await fetch(url, opts).catch(function () { return null; });
  if (!resp || !resp.ok) {
    await wait(600);
    resp = await fetch(url, opts).catch(function () { return null; });
  }
  return resp;
}

// Restituisce { ok, dbError, detail } invece di un semplice booleano, cosi chi chiama
// puo' distinguere "password sbagliata" da "non sono riuscito a controllarla" (es.
// Supabase irraggiungibile o mal configurato) e dare un messaggio utile invece di
// un generico "credenziali non valide" che nasconderebbe un problema di configurazione.
async function checkPassword(password, SUPABASE_URL, SERVICE_KEY, ADMIN_PASSWORD) {
  if (SUPABASE_URL && SERVICE_KEY) {
    const resp = await fetchAdminAuthRow(SUPABASE_URL, SERVICE_KEY);
    // Se Supabase non risponde o risponde con errore, non torniamo mai al fallback:
    // altrimenti un guasto temporaneo del database riaprirebbe di nascosto il vecchio
    // ADMIN_PASSWORD anche dopo che il proprietario l'ha cambiata dal pannello.
    if (!resp) return { ok: false, dbError: true, detail: "impossibile contattare Supabase" };
    if (!resp.ok) {
      const detail = await resp.text().catch(function () { return ""; });
      return { ok: false, dbError: true, detail: "Supabase ha risposto " + resp.status + ": " + detail.slice(0, 200) };
    }
    const rows = await resp.json().catch(function () { return null; });
    if (rows === null) return { ok: false, dbError: true, detail: "risposta di Supabase non leggibile" };
    if (rows[0]) {
      const expected = hashPassword(password, rows[0].pass_salt);
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(rows[0].pass_hash, "hex");
      if (a.length !== b.length) return { ok: false, dbError: false };
      return { ok: crypto.timingSafeEqual(a, b), dbError: false };
    }
    // Nessuna riga: la password non è mai stata cambiata dal pannello, si usa
    // ancora ADMIN_PASSWORD come credenziale iniziale (stato "bootstrap").
    return { ok: !!ADMIN_PASSWORD && password === ADMIN_PASSWORD, dbError: false };
  }
  return { ok: !!ADMIN_PASSWORD && password === ADMIN_PASSWORD, dbError: false };
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

  const result = await checkPassword(password || "", SUPABASE_URL, SERVICE_KEY, ADMIN_PASSWORD);
  if (!result.ok) {
    if (result.dbError) {
      res.status(503).json({ error: "Non riesco a controllare le credenziali in questo momento (problema nel contattare il database). Riprova tra poco.", detail: result.detail });
      return;
    }
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
