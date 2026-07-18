# Phase 2 runbook - flow và cách chạy

Folder này là bản lũy kế: `phase2-rbl/` chứa toàn bộ nội dung Phase 1 và bổ sung module Phase 2.

## Căn cứ RBL

Phase 2 trong `RBL_SWD392.docx`: Real-time Architecture & MVP, xây dựng core Real-time Audio tích hợp Agora SDK bằng Node.js, mobile kết nối phòng cơ bản, giơ tay, bật/tắt mic và đo latency/ping.

## Flow kế thừa từ Phase 1

1. Tài liệu học liệu English/Chinese/Japanese được digitize thành JSON/SQL.
2. Database schema lưu languages, stages, levels, lessons, content blocks.
3. .NET Auth API xử lý register/login/JWT.
4. UML/docs mô tả role Anonymous, Pro/Mentor, Super/Creator.

## Flow mới của Phase 2

1. User có identity từ `.NET Auth API` hoặc anonymous trial identity.
2. Client gọi `POST /agora/token` để nhận Agora token scaffold.
3. Client kết nối Socket.IO vào Node realtime service.
4. Client emit `room:join` để vào phòng học.
5. Server lưu room/participant vào MariaDB và broadcast `room:state`.
6. Client emit `hand:raise` để bật/tắt trạng thái giơ tay.
7. Client emit `mic:toggle` để bật/tắt trạng thái mic.
8. Client emit `latency:ping` để đo round-trip latency.

## Cách chạy Phase 2

Chạy auth kế thừa từ Phase 1 nếu cần demo identity:

```bash
cd phase2-rbl/dotnet-auth
dotnet build
dotnet run
```

Chạy realtime service:

```bash
cd phase2-rbl/realtime-audio
npm install
npm run check
npm start
```

## Endpoint/event chính

- `GET /health`
- `POST /agora/token`
- `GET /rooms`
- Socket event `room:join`
- Socket event `hand:raise`
- Socket event `mic:toggle`
- Socket event `latency:ping`

## Ghi chú .NET

Trong phase này, .NET được dùng làm backend Web API cho authentication, không phải web giao diện. Web/mobile client sẽ gọi API này để register/login và nhận JWT.

## Giới hạn MVP

Agora token hiện là scaffold để chứng minh kiến trúc. Production cần Agora AccessToken2/RtcTokenBuilder, credential server-side, JWT middleware và authorization theo channel.

## Import database Phase 2

Chạy từ chính folder `phase2-rbl` để import toàn bộ phase vào database `lucy_phase2`:

```bash
mariadb -u root -p < database/import-all.sql
```

File `import-all.sql` sẽ chạy lần lượt:

1. `database/schema.sql`
2. `database/seed-sample.sql`
3. `generated/digitized-content.sql`
4. `database/phase2-realtime.sql`

Kiểm tra nhanh:

```bash
mariadb -u root -p lucy_phase2
```

```sql
SHOW TABLES;
SELECT COUNT(*) FROM content_blocks;
SELECT COUNT(*) FROM realtime_rooms;
SELECT COUNT(*) FROM realtime_room_participants;
SELECT COUNT(*) FROM realtime_latency_samples;
```

## Import bằng DBeaver

Nếu dùng DBeaver, không chạy file `import-all.sql` vì file đó dùng lệnh `SOURCE` của MySQL CLI. Thay vào đó mở và execute file thuần SQL này:

```text
phase2-rbl/database/dbeaver-import-all.sql
```

File này đã gộp sẵn schema, seed, digitized content và Phase 2 realtime SQL nên chỉ cần chạy một lần trong SQL Editor của DBeaver.

## Import bằng MySQL CLI

Chạy từ chính folder phase để lệnh `SOURCE database/...` hoạt động đúng.

```bash
mariadb -u root -p < database/import-all.sql
```

File `database/import-all.sql` đã có `CREATE DATABASE IF NOT EXISTS`, `USE database`, rồi import schema/seed/content/module SQL theo đúng thứ tự phase.
