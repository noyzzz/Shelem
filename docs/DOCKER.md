# Docker workflow

Docker is the default way to run Shelem. Local Node.js installation is not
required once Docker is installed.

## Development

Start the development container:

```powershell
docker compose up --build
```

Open `http://localhost:5173`.

Source files are mounted into the container, so changes refresh in the browser
without rebuilding the image.

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

Future gameplay infrastructure will include:

- `postgres`: accounts, matches, and game history
- `redis`: room presence and short-lived reconnect state
- `livekit`: WebRTC video and voice

All services will communicate through the private `shelem` Docker network.
