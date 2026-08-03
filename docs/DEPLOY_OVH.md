# Deploying Shelem on one OVH VPS

The production stack runs the website, game server, LiveKit, Redis, and Caddy
on one VPS. Caddy obtains and renews HTTPS certificates automatically.

## 1. Point two DNS names at the server

Create these DNS `A` records with your domain provider:

- `play.example.com` -> `57.129.103.170`
- `livekit.example.com` -> `57.129.103.170`

Replace the example names with your real names. If the domain has an `AAAA`
record, point it to the VPS IPv6 address or remove it until IPv6 is configured
and verified.

## 2. Copy the application to the VPS

From WSL, run these commands from the repository directory:

```bash
tar \
  --exclude=.git \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.env \
  --exclude=.env.local \
  --exclude=.env.production \
  -czf /tmp/shelem.tar.gz .

scp -i ~/.ssh/rookserver_ed25519 \
  /tmp/shelem.tar.gz \
  ubuntu@vps-8ef2b9d9.vps.ovh.net:/tmp/shelem.tar.gz

ssh -i ~/.ssh/rookserver_ed25519 ubuntu@vps-8ef2b9d9.vps.ovh.net
mkdir -p ~/shelem
tar -xzf /tmp/shelem.tar.gz -C ~/shelem
cd ~/shelem
```

## 3. Create the private production environment

Copy the template and edit the public names:

```bash
cp .env.production.example .env.production
nano .env.production
```

Generate credentials on the VPS:

```bash
printf 'LIVEKIT_API_KEY=LK_%s\n' "$(openssl rand -hex 8)"
printf 'LIVEKIT_API_SECRET=%s\n' "$(openssl rand -base64 36 | tr -d '\n')"
```

Put the generated values into `.env.production`. Do not publish or commit this
file.

## 4. Start the production stack

```bash
docker compose \
  --env-file .env.production \
  -f compose.production.yaml \
  up -d --build
```

Inspect status and logs:

```bash
docker compose \
  --env-file .env.production \
  -f compose.production.yaml \
  ps

docker compose \
  --env-file .env.production \
  -f compose.production.yaml \
  logs --tail=100
```

Once DNS has propagated, Caddy obtains the certificates and the game is
available at the value of `APP_DOMAIN`.

## Updating later

Copy the newer source over the existing `~/shelem` directory, then rerun:

```bash
docker compose \
  --env-file .env.production \
  -f compose.production.yaml \
  up -d --build
```
