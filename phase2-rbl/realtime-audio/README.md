# Phase 2 Real-time Audio MVP

Node.js Socket.IO scaffold for RBL SWD392 Phase 2 real-time architecture work.

## Scope

- Basic room join and room state broadcast.
- Raise hand event for anonymous Level 1-5 testing.
- Mic toggle event for mobile/client integration.
- Latency ping acknowledgement for gamification measurement.
- Agora token endpoint scaffold only. It does not generate production Agora tokens yet.

## Run

```bash
npm install
npm run check
npm start
```

## HTTP endpoints

- `GET /health`
- `GET /rooms`
- `POST /agora/token` with `{ "channelName": "level-1", "uid": "anon-1" }`

## Socket.IO events

- `room:join`: `{ roomId, userId, displayName, role }`
- `hand:raise`: `{ roomId, raised }`
- `mic:toggle`: `{ roomId, enabled }`
- `latency:ping`: `{ clientSentAt }`

## Production notes

Replace the token placeholder with Agora AccessToken2/RtcTokenBuilder and protect it behind the .NET identity service before production.

## Database

The service persists rooms, participants, mic/hand state, and latency samples to MariaDB. Configure with `LUCY_DB_URL`; default is:

```text
mysql://root@localhost:3306/lucy_phase2
```

Import the phase database before running the service.
