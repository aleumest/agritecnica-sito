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
- Tutte le foto del sito sono illustrazioni SVG disegnate a mano (nessuna foto reale di trattori, officina, mezzi). Cercare `<svg` nel file per trovarle.
- Il catalogo (14 trattori/rimorchi/attrezzature) ha modelli e specifiche **inventati ma plausibili**, non il parco macchine reale del cliente.
- Le 2 recensioni di base sono testo segnaposto.
- Le credenziali del pannello admin sono provvisorie: utente `admin`, password `agritecnica2026` (cambiabili dalla tab "Account" dentro `#admin`).

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

**Attenzione:** è tutto salvato nel `localStorage` del browser di chi lo usa. Non c'è un backend, non c'è un database, non è condiviso tra dispositivi o visitatori. Se il cliente modifica qualcosa da un browser, un visitatore che apre il sito da un altro dispositivo NON vede quella modifica. È un prototipo funzionante dell'esperienza d'uso, non ancora la cosa vera. Prima di lanciare il sito con questa funzionalità va costruito un backend reale (vedi sezione "Prossimi passi" più sotto).

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
- **Pannello admin reale**: oggi scrive solo nel `localStorage` del browser (vedi sopra). Per renderlo vero servono: un database (Postgres/Vercel KV/Supabase), delle API serverless per leggere/scrivere catalogo, testi e recensioni, e un login vero (non username/password in chiaro nel JS). L'architettura di AVMECH (`api/admin`) è un buon punto di partenza da guardare.
- **Foto vere**: chiedere al cliente foto reali di officina, mezzi in vendita, magazzino ricambi.
- **Recensioni vere**: sostituire quelle segnaposto con recensioni reali (magari prese da Google/Facebook, con permesso del cliente).

## File rilevanti

- `index.html` — tutto il sito (markup + CSS + JS in un file)
- `README.md` — questo file

## Contesto agenzia (per capire chi è chi)

Questo progetto è realizzato per conto di **GAMA**, l'agenzia digitale dell'utente (fondata da Alessandro Milone e Giovanni Albanese). **AVMECH** è il cliente principale di GAMA (automazione industriale, non collegato ad Agritecnica): il suo sito reale (`Desktop\AVMECH SITO FULL\AVMECH SITO`) è il riferimento di design che è stato usato come ispirazione per Agritecnica, e anche il riferimento architetturale per quando Agritecnica avrà bisogno di un vero backend.
