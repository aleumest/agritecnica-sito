# Agritecnica Sacchetti — sito web (bozza)

Nota per il prossimo Claude Code che riprende questo progetto: leggi tutto questo file prima di modificare qualcosa. Spiega cosa è già vero, cosa è ancora finto, e i passi per mettere il sito online su un dominio che il cliente possiede già.

## Cos'è questo progetto

Redesign del sito di **Agritecnica Sacchetti**, concessionaria di trattori compatti (Antonio Carraro, Kubota, Carraro Tractors) a Velletri (RM). Il sito attuale online è `agritecnica.net`, molto datato; questo è il nuovo design, fatto per l'agenzia GAMA (la stessa che ha realizzato il sito reale di AVMECH, vedi `Desktop\AVMECH SITO FULL\AVMECH SITO` come riferimento di com'è fatto un sito "vero" della stessa agenzia, con backend incluso).

**Un solo file:** tutto il sito è `index.html`. Nessun framework, nessun build step, nessuna dipendenza da installare. Si apre e basta, anche solo con doppio click / drag nel browser.

## Stato attuale — cosa è vero e cosa no

**Vero (confermato dalla pagina Facebook del cliente, facebook.com/agritecnicasacchetti):**
- Nome: Agritecnica di Sacchetti Carlo e Fabio
- Attiva dal 1950
- Indirizzo: Via Ariana 21, Velletri (RM)
- Telefono: 06 963 0092
- Email: agritecnica@libero.it
- Instagram: instagram.com/agritecnica_sacchetti
- Marchi trattati: Antonio Carraro, Kubota, Carraro Tractors

**Ancora finto/segnaposto (da sostituire prima di andare online):**
- La maggior parte delle foto sono reali (prese dalla pagina Facebook del cliente), ma alcune sezioni usano ancora illustrazioni SVG disegnate a mano come riempimento. Cercare `<svg` nel file per trovarle.
- Il catalogo ha alcuni modelli reali (confermati da post Facebook, es. Antonio Carraro Tigre 3800, AF 2.85 B, Major TC 5800 F) ma anche modelli **inventati ma plausibili** per completare la gamma — non è ancora il parco macchine reale e completo del cliente.
- Alcune recensioni sono ancora testo segnaposto.

## Backend: Supabase + Vercel (login e salvataggio condiviso)

Il pannello admin **non usa più solo `localStorage`**: ora legge e scrive su un database Supabase condiviso, tramite due funzioni serverless in `api/`. Questo significa che una modifica fatta da un browser è visibile a chiunque visiti il sito da qualsiasi altro dispositivo.

**Come funziona:**
- `index.html` contiene già, in chiaro nel codice, l'URL del progetto Supabase e la chiave **pubblica** (`sb_publishable_...`) — è normale e sicuro: quella chiave è pensata per stare nel browser, permette solo la *lettura* dei dati (vedi le policy RLS in `supabase-setup.sql`).
- Le *scritture* passano sempre da `api/save.js`, che usa la **service_role key** (segreta) e verifica un token firmato prima di accettare qualsiasi modifica.
- Il login (`api/login.js`) confronta la password inserita con quella salvata e restituisce un token firmato con `SESSION_SECRET`, valido 12 ore.

**Password admin cambiabile dal pannello, senza toccare Vercel:** la password non vive più (solo) nella variabile d'ambiente `ADMIN_PASSWORD`. C'è una tabella privata `admin_auth` su Supabase (creata da `supabase-setup.sql`, **senza nessuna policy pubblica** — quindi invisibile a chiunque non abbia la service_role key) che può contenere una password sostitutiva, salvata come hash+salt (`crypto.scryptSync`, mai in chiaro). Dal tab "Account" del pannello admin, chi è già loggato può cambiarla inserendo quella attuale + la nuova: da quel momento il login controlla prima questa tabella, e solo se non è mai stata impostata usa ancora `ADMIN_PASSWORD` come prima. Così il proprietario del sito può cambiare la password quando vuole senza sapere/toccare le variabili d'ambiente su Vercel (che restano dell'agenzia).

**Variabili d'ambiente da impostare su Vercel** (Project → Settings → Environment Variables), **non vanno mai scritte nel codice**:
| Nome | Cosa mettere |
|---|---|
| `ADMIN_PASSWORD` | La password di accesso al pannello admin (sceglierla il cliente/agenzia) |
| `SESSION_SECRET` | Una stringa lunga e casuale qualsiasi (es. generata con `openssl rand -hex 32`), usata solo per firmare i token di sessione |
| `SUPABASE_URL` | `https://vcvuudzuftsslhdzdymh.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | La chiave "service_role" da Supabase → Project Settings → API (quella segreta, **mai** quella pubblica) |

Dopo averle aggiunte serve un **nuovo deploy** su Vercel perché le funzioni le leggano (un redeploy manuale, o un nuovo `git push`).

**Prima ancora di tutto questo**, va eseguito **una sola volta** lo script `supabase-setup.sql` nell'SQL Editor di Supabase (crea le tabelle `site_data` e `admin_auth` e le policy di sicurezza — se il progetto Supabase è stato creato prima di questa funzione, va rieseguito per aggiungere `admin_auth`). Se manca, il sito continua a funzionare mostrando solo i contenuti di base scritti nel file (fallback automatico), ma il pannello admin non riuscirà a salvare nulla.

**Testare in locale:** `npx serve .` fa funzionare la lettura da Supabase (chiamata diretta dal browser), ma **non** le funzioni in `api/` (login e salvataggio), perché quelle girano solo su Vercel (o con `vercel dev`, se installato). È normale vedere "Password non corretta" tentando il login in locale: va testato dopo il deploy su Vercel.

## Come lavorarci

Basta aprire `index.html` in un browser. Per un giro più realistico (alcune feature tipo i form si comportano meglio su http:// che su file://) si può usare un server locale semplice, es.:

```bash
npx serve .
```

oppure l'estensione "Live Server" di VS Code.

Tutto lo stile è in un unico blocco `<style>` in cima al file (design tokens in `:root`, tema chiaro/scuro via `[data-theme]` e `prefers-color-scheme`). Tutto il comportamento è in un unico `<script>` in fondo, dentro una IIFE.

## Il pannello admin (`#admin`) — limite importante da capire

C'è un pannello di amministrazione raggiungibile da `#admin` (link "Area riservata" in fondo al footer) che permette di:
- aggiungere/modificare/eliminare macchinari nel catalogo, con foto multiple
- aggiungere/modificare/eliminare recensioni
- modificare quasi tutti i testi del sito (titoli, descrizioni, FAQ, ecc.)

Le modifiche sono salvate su Supabase (vedi sezione "Backend" più sopra) e visibili a tutti i visitatori — non serve più localStorage per questo. Il carrello richieste dei visitatori resta invece locale al browser (giusto così: non è contenuto del sito, è una scelta personale di chi naviga).

## Mettere online il sito (dominio già esistente)

Il cliente ha già un dominio (`agritecnica.net` o quello che deciderà). Il piano più semplice, senza riscrivere nulla:

### 1. Immagini reali → Cloudinary

Prima di andare online servono foto vere (officina, trattori, mezzi in vendita). Usa Cloudinary invece di mettere le immagini dentro il repo:

1. Crea un account gratuito su [cloudinary.com](https://cloudinary.com) (o usa quello del cliente/agenzia se esiste già).
2. Carica le foto reali nella media library.
3. Cloudinary dà un URL diretto per ogni immagine (tipo `https://res.cloudinary.com/<cloud-name>/image/upload/v.../nome.jpg`). Puoi anche far ridimensionare/comprimere automaticamente le immagini da Cloudinary aggiungendo parametri nell'URL (es. `w_900,q_auto,f_auto`), invece di farlo a mano.
4. Nel file, cerca la funzione `thumbSVG(item)` e `cardMediaHTML(item)` (dentro `<script>`): oggi generano SVG di riempimento o leggono `item.photos` (array di data-URL salvate da localStorage). Il passo naturale è: sostituire gli URL Cloudinary reali nei campi `photos` di ogni voce dell'array `CATALOGO`, invece di caricarle a mano dal pannello admin ogni volta. Stessa cosa per l'hero, l'officina, ecc. — oggi sono tutte `<svg>` scritte a mano nell'HTML, da sostituire con `<img src="https://res.cloudinary.com/...">`.

Non serve npm/SDK per questo primo livello: bastano gli URL diretti dentro il file HTML.

### 2. Deploy statico → Vercel

Il sito è statico (un file HTML), quindi il deploy è banale:

**Opzione A — CLI (più veloce per un solo file):**
```bash
npm i -g vercel
cd "C:\Users\Porzia\OneDrive\Desktop\agritecnica-sito"
vercel
```
Segui il prompt (crea/associa un progetto). `vercel --prod` per il deploy in produzione.

**Opzione B — dashboard Vercel (drag & drop):**
Vai su [vercel.com/new](https://vercel.com/new), trascina la cartella del progetto (o collegala a un repository Git se il progetto è stato messo su GitHub — consigliato, vedi nota sotto).

**Consiglio:** prima di fare il deploy, mettere questa cartella in un repository Git (anche privato su GitHub) invece di caricarla via drag&drop ogni volta. Così Vercel può ridistribuire automaticamente ogni volta che c'è un push, e si ha uno storico delle modifiche. Il sito AVMECH gemello (`Desktop\AVMECH SITO FULL\AVMECH SITO`) è impostato così.

Non serve nessun `vercel.json` per un sito a pagina singola come questo (il `vercel.json` di AVMECH serve per i redirect delle vecchie pagine e per una SPA React con più route — qui non serve, essendo una sola pagina).

### 3. Collegare il dominio esistente

1. Nel progetto Vercel, vai su **Settings → Domains** e aggiungi il dominio del cliente (es. `agritecnica.net`).
2. Vercel mostra i record DNS da impostare — in genere:
   - Un record **A** sul dominio nudo (`agritecnica.net`) che punta a `76.76.21.21` (IP di Vercel, controllare comunque quello mostrato in dashboard perché può cambiare).
   - Un record **CNAME** su `www` che punta a `cname.vercel-dns.com`.
3. Vai dal pannello del provider dove è registrato il dominio (es. Aruba, Register.it, GoDaddy — chiedere al cliente dove l'ha comprato) e imposta questi record nella sezione DNS.
4. La propagazione DNS può richiedere da pochi minuti a qualche ora. Vercel emette automaticamente il certificato HTTPS una volta che il DNS punta correttamente a lui.

## Prossimi passi (dopo il primo deploy statico)

Questi non sono ancora stati fatti, da valutare quando il cliente è pronto a investire in un vero backend (stesso livello del sito AVMECH):

- **Form di contatto reale**: oggi il form apre semplicemente il client email (`mailto:`) via JavaScript, perché non c'è backend. Per un invio vero servirebbe una funzione serverless (es. `api/contatti.ts` su Vercel, come fa `AVMECH SITO FULL/AVMECH SITO/api/chat.ts`) collegata a un servizio email (Resend, SendGrid, ecc.).
- **Pannello admin**: fatto (Supabase + `api/login.js` + `api/save.js`, vedi sezione "Backend" sopra). Eventuale prossimo miglioramento: spostare le foto caricate dal pannello (oggi base64 dentro il JSON) su Supabase Storage, per righe più leggere.
- **Foto vere**: chiedere al cliente foto reali di officina, mezzi in vendita, magazzino ricambi.
- **Recensioni vere**: sostituire quelle segnaposto con recensioni reali (magari prese da Google/Facebook, con permesso del cliente).

## File rilevanti

- `index.html` — tutto il sito (markup + CSS + JS in un file)
- `README.md` — questo file

## Contesto agenzia (per capire chi è chi)

Questo progetto è realizzato per conto di **GAMA**, l'agenzia digitale dell'utente (fondata da Alessandro Milone e Giovanni Albanese). **AVMECH** è il cliente principale di GAMA (automazione industriale, non collegato ad Agritecnica): il suo sito reale (`Desktop\AVMECH SITO FULL\AVMECH SITO`) è il riferimento di design che è stato usato come ispirazione per Agritecnica, e anche il riferimento architetturale per quando Agritecnica avrà bisogno di un vero backend.
