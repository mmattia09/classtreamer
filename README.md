# Classtreamer

Classtreamer e una piattaforma full-stack per gestire stream scolastiche con domande live, risposte da classe o da smartphone, visualizzazione risultati e pannello tecnico.

## Stack

- Next.js App Router con TypeScript
- Prisma + PostgreSQL
- Redis per rate limiting e supporto realtime
- Socket.io per aggiornamenti live
- Tailwind CSS per l'interfaccia

## Avvio locale

1. Copia `.env.example` in `.env`.
2. Installa le dipendenze con `npm install`.
3. Avvia i servizi con `docker compose up -d postgres redis`.
4. Genera Prisma con `npm run prisma:generate`.
5. Applica lo schema con `npm run prisma:push`.
6. Carica dati iniziali con `npm run prisma:seed`.
7. Avvia l'app con `npm run dev`.

L'app sara disponibile su `http://localhost:3000`.

## Servizi Docker

- `app`: applicazione Next.js su porta `3000`
- `postgres`: database PostgreSQL 15
- `redis`: cache e rate limiting

Per avviare tutto via Compose:

```bash
docker compose up --build
```

## Variabili ambiente

Le variabili richieste sono documentate in `.env.example`.

- `DB_URL`
- `REDIS_URL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_SOCKET_PATH`
- `PORT`

## Route principali

- `/` selezione classe
- `/class/[numero]/[sezione]` visione stream per aula
- `/admin` login tecnico
- `/admin/dashboard` dashboard tecnica
- `/admin/streams` gestione stream
- `/admin/classes` impostazioni
- `/answer` pagina mobile per risposte individuali
- `/embed/results` overlay risultati per OBS

## Note operative

- La password admin puo essere in chiaro oppure hash bcrypt.
- Una sola stream e una sola domanda possono essere live contemporaneamente: il controllo viene applicato lato applicazione.
- Se una stream non ha classi target associate, viene considerata visibile a tutte le classi.
