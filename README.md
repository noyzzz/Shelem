# Shelem Online

A private four-player Shelem table with real-time gameplay, bots for testing,
team scoring, and built-in voice and video.

## Live deployment

Play the current production version at
**[playrook.online](https://playrook.online)**.

## Features

- Private rooms with shareable six-character codes
- Four-player Shelem with opposite-seat partnerships
- Three bots for completing and testing a game solo
- Bidding, zamin, trump, trick play, and team scoring
- Live voice and video powered by LiveKit
- Responsive layouts for desktop and mobile
- Dockerized local and production environments

The enforced rules are documented in
[docs/SHELEM_RULES.md](docs/SHELEM_RULES.md).

## Run locally with Docker

```sh
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173). The local Compose stack
starts the web app, game server, and a development LiveKit server.

## Run the test suite

```sh
npm install
npm run test:server
npm run build
```

Production configuration is defined in `compose.production.yaml`. Copy
`.env.production.example` to `.env.production`, provide private production
values on the server, and never commit that environment file.
