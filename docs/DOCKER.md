# Docker workflow

Docker is the default way to run Shelem. Local Node.js installation is not
required once Docker is installed.

## Development

For local development on Windows, start PostgreSQL, the web app, game server,
and LiveKit together:

```powershell
npm run dev:all
```

The first run downloads the official LiveKit Windows release and verifies its
SHA-256 checksum. The launcher automatically advertises the active LAN address
for WebRTC media. It also exposes the Compose PostgreSQL service on host port
5433. Keep this terminal open while testing. Vite refreshes the web app, and
Node restarts the game server when its source changes.

Alternatively, start the development containers:

```powershell
docker compose up --build
```

Open `http://localhost:5173`.

Source files are mounted into the container, so changes refresh in the browser
without rebuilding the image.

When using Docker Desktop, set `LIVEKIT_NODE_IP` in `.env` to the computer's
LAN address (for example, the Wi-Fi IPv4 address) so browsers can reach the
mapped WebRTC ports.

To test a complete game by yourself, create a room, choose **Fill empty seats
with bots**, and mark yourself ready. The three server-controlled players will
automatically bid, prepare the ground, play legal cards, and ready themselves
for the next hand.

Voice and video are served by the local LiveKit container at
`ws://localhost:7880`. Inside a game room, choose **Join conversation**, then
turn on the microphone or camera you want to share. Both devices are off until
you explicitly enable them. Bots do not join media.

Stop the containers:

```powershell
docker compose down
```

## Production image

Build and run the production container:

```powershell
docker compose --profile production up --build web-production
```

Open `http://localhost:8080`.

The production image builds the React application and serves only the compiled
files through Nginx. It also exposes `/health` for container health checks.

## Services

The Compose project currently runs:

- `web`: React browser client
- `game-server`: authoritative WebSocket room and presence state
- `livekit`: self-hosted WebRTC voice and video
- `postgres`: accounts, matches, and game history

Future gameplay infrastructure may include:

- `redis`: room presence and short-lived reconnect state

All services will communicate through the private `shelem` Docker network.

## Production voice and video

The development key (`devkey` / `secret`) is only for a local machine. For a
public server, copy `.env.example` to `.env` and replace the LiveKit key,
secret, and public URL. `LIVEKIT_URL` must be a trusted TLS endpoint such as
`wss://livekit.example.com`; do not expose the API secret to the browser.

LiveKit's production deployment also needs a domain and valid TLS certificate.
Open TCP 7881 and the UDP media ports configured on the server. The local
Compose setup uses UDP 7882; production can instead use LiveKit's recommended
UDP range and embedded TURN configuration. For best media performance on a
Linux server, deploy LiveKit with host networking using its production
configuration generator rather than the local `--dev` command.
