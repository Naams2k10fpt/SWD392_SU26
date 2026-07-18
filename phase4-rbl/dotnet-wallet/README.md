# Phase 4 .NET Wallet and Monetization API

ASP.NET Core Minimal API scaffold for RBL SWD392 Phase 4 SOA/microservices and monetization.

## Scope

- Wallet balance lookup.
- Top-up ledger concept.
- Real-time gift transaction concept for Node Socket.IO broadcast after commit.
- Podcast recording metadata endpoint for Super/Creator.
- Swagger-ready API through Swashbuckle.

## Run

```bash
dotnet restore
dotnet build
dotnet run
```

Open Swagger at `/swagger` after the API starts.

## Main endpoints

- `GET /wallets/{userId}`
- `POST /wallets/{userId}/top-up`
- `POST /gifts`
- `GET /gifts`
- `POST /podcasts/recordings`
- `GET /podcasts/recordings`

## Scaffold boundaries

This is not a production payment integration. Payment provider verification, idempotency keys, fraud controls, database transactions, and event outbox are intentionally listed as next hardening steps for the Phase 4 defense.
