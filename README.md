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
- Optional accounts with match history and win/loss stats in PostgreSQL
- Guests can play instantly without an account, then claim their games later
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

## Run locally with hot reload

Install the dependencies once, then start the complete development stack:

```sh
npm install
npm run dev:all
```

Open [http://localhost:5173](http://localhost:5173). Vite updates the web app,
and Node restarts the game server when a file in `server/` changes. The command
also starts local LiveKit and a development-only PostgreSQL container on port
5433. The small host override exposes the PostgreSQL service from the regular
Compose stack without changing its shared configuration.

## Run the test suite

```sh
npm install
npm run test:server
npm run build
```

Production configuration is defined in `compose.production.yaml`. Copy
`.env.production.example` to `.env.production`, provide private production
values on the server, and never commit that environment file.
