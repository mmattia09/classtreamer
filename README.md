# Classtreamer

Classtreamer e' una piattaforma full-stack per gestire stream scolastiche con domande live, risposte da classe o da smartphone, visualizzazione risultati e pannello tecnico.

## Stack

- Next.js App Router con TypeScript
- Prisma + PostgreSQL
- Redis per rate limiting e supporto realtime
- Socket.io per aggiornamenti live
- Tailwind CSS per l'interfaccia


## Avvio con Docker Compose

Servizi inclusi:

- `app`: applicazione Next.js sulla porta `3000`
- `postgres`: database PostgreSQL 15
- `redis`: cache e rate limiting

Per avviare tutto con Compose:

```bash
cp .env.example .env
docker compose up --build
```

## Variabili ambiente

Le variabili richieste sono documentate in `.env.example`.

- `PORT`: porta esposta da Docker sul host
- `PUBLIC_URL`: URL pubblico dell'app
- `ADMIN_PASSWORD`: password admin in chiaro oppure hash bcrypt
- `SESSION_SECRET`: segreto usato per firmare le sessioni
- `SESSION_COOKIE_SECURE`: abilita cookie `Secure`
- `DB_NAME`: nome database PostgreSQL
- `DB_USER`: utente PostgreSQL
- `DB_PASSWORD`: password PostgreSQL

`DB_URL` e l'URL Redis vengono calcolati internamente in base ai valori correnti e all'ambiente di esecuzione.

## Route principali

- `/` selezione classe
- `/class/[number]/[section]`: visione stream per aula
- `/admin`: login tecnico
- `/admin/dashboard`: dashboard tecnica
- `/admin/streams`: gestione stream
- `/admin/classes`: impostazioni classi
- `/answer`: pagina mobile per risposte individuali
- `/embed/results`: overlay risultati per OBS

## Sviluppo

### AI
Il codice è stato creato interamente con Codex di OpenAI (GPT-5.4 e GPT-5.2 Codex).

### Requisiti

- Bun 1.3+
- Docker con `docker compose`

### Setup completo

```bash
bun install
bun run dev:start
```

`bun run dev:start` esegue in sequenza queste operazioni:

1. ricrea `.env` partendo da `.env.example`
2. avvia `postgres` e `redis`
3. genera il client Prisma
4. applica lo schema al database
5. carica i dati iniziali
6. avvia l'app in sviluppo

L'app e' disponibile su `http://localhost:3000`.

### Avvio manuale

Se preferisci eseguire i passaggi separatamente:

```bash
cp .env.example .env
docker compose up -d postgres redis
bun run prisma:generate
bun run prisma:push
bun run prisma:seed
bun run dev
```

## Note operative

- Se cambi `ADMIN_PASSWORD`, le sessioni admin esistenti vengono invalidate automaticamente.
- Una sola stream e una sola domanda possono essere live contemporaneamente.
- Se una stream non ha classi target associate, viene considerata visibile a tutte le classi.
