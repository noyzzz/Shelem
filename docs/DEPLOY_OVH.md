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

## 2. Allow production traffic through the VPS firewall

Keep SSH open, then allow HTTPS, LiveKit TCP fallback, TURN, and the UDP media
ranges:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 3478/udp
sudo ufw allow 30000:40000/udp
sudo ufw allow 50000:60000/udp
sudo ufw enable
```

## 3. Clone the application on the VPS

Connect to the VPS, then clone the public repository:

```bash
ssh -i ~/.ssh/rookserver_ed25519 ubuntu@vps-8ef2b9d9.vps.ovh.net
git clone --branch main https://github.com/noyzzz/Shelem.git ~/shelem
cd ~/shelem
```

HTTPS is sufficient because the server only needs read access to this public
repository. Keep development and pushes on a trusted workstation.

## 4. Create the private production environment

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

## 5. Start the production stack

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

Pull the latest committed version, then rebuild the changed services:

```bash
cd ~/shelem
git pull --ff-only
docker compose \
  --env-file .env.production \
  -f compose.production.yaml \
  up -d --build
```
