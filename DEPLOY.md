# Deploy

## Produzione con Docker Compose

1. Prepara `.env` con valori reali:
   - `DB_URL` puntato al container `postgres`
   - `REDIS_URL` puntato al container `redis`
   - `ADMIN_PASSWORD` robusta
   - `SESSION_SECRET` lunga e casuale
   - `NEXT_PUBLIC_BASE_URL` impostato al dominio pubblico finale
2. Avvia lo stack con:

```bash
docker compose up -d --build
```

3. Esegui inizializzazione database:

```bash
docker compose exec app npm run prisma:push
docker compose exec app npm run prisma:seed
```

## Reverse proxy

Metti l'app dietro Nginx, Traefik o Caddy e inoltra:

- traffico HTTP verso `app:3000`
- upgrade WebSocket su `NEXT_PUBLIC_SOCKET_PATH` (default `/socket.io`)

## Persistenza

I volumi `postgres_data` e `redis_data` sono gia dichiarati in `docker-compose.yml`.

## Hardening minimo consigliato

- Usa HTTPS sul dominio pubblico.
- Imposta `ADMIN_PASSWORD` come hash bcrypt.
- Cambia `SESSION_SECRET` con un valore casuale non versionato.
- Limita l'accesso al pannello `/admin` a reti fidate se possibile.
