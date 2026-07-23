# Phase 5 .NET Wallet and Monetization API

ASP.NET Core Minimal API cho ví, Super Chat và podcast. Mặc định chạy tại
`http://localhost:5041`; Swagger ở `/swagger`.

## Scope

- Wallet balance lookup.
- Top-up ledger concept.
- Super Chat của ANONYMOUS tới PRO/SUPER, xác thực JWT và broadcast sau commit.
- Lịch sử quà chỉ trả giao dịch user hiện tại gửi hoặc nhận.
- CRUD podcast cho PRO/SUPER.
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
- `PUT /podcasts/recordings/{id}`
- `DELETE /podcasts/recordings/{id}`

## Scaffold boundaries

Top-up và gift đã dùng MariaDB transaction. Production vẫn cần xác minh callback
payment provider, idempotency key, fraud controls và event outbox.
