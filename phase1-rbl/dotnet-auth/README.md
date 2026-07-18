# .NET Login/Register API

Skeleton ASP.NET Core Minimal API cho quest **Login/Register (.NET)** trong giai đoạn 1.

## Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

## Chạy thử

```bash
dotnet restore
dotnet run
```

## Test nhanh bằng curl

```bash
curl -s -X POST http://localhost:5000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"creator@lucy.local","password":"Password123!","displayName":"Creator","role":"SUPER"}'

curl -s -X POST http://localhost:5000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"creator@lucy.local","password":"Password123!"}'
```

## Ghi chú

API hiện ghi/đọc user trực tiếp từ MariaDB qua các bảng `users`, `roles`, `user_roles`. Mặc định dùng connection string `Server=localhost;Database=lucy_phase1;User=root;Password=;`; nếu máy có password hoặc database khác, set biến môi trường `LUCY_DB` trước khi chạy `dotnet run`.
