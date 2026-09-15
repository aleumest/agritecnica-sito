-- Tabella unica per tutti i contenuti modificabili dal pannello admin del sito Agritecnica.
-- Ogni "key" corrisponde a una sezione (testi, contatti, catalogo, ecc.), il valore è un JSON.
create table if not exists site_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Attiva la sicurezza a livello di riga: di base nessuno può fare nulla finché non lo permettiamo esplicitamente.
alter table site_data enable row level security;

-- Chiunque (chiave pubblica "anon"/"publishable") può leggere: serve perché ogni visitatore del sito
-- deve poter caricare i contenuti aggiornati.
drop policy if exists "Public read access" on site_data;
create policy "Public read access"
  on site_data
  for select
  using (true);

-- Nota: non creiamo nessuna policy di scrittura per la chiave pubblica.
-- Le uniche scritture arrivano dalle funzioni server (/api/save), che usano la
-- "service_role key" (segreta, mai esposta al browser) e quindi bypassano le
-- regole RLS di riga — così solo chi conosce la password admin può salvare.
