# Phase 4 runbook - flow và cách chạy

Folder này là bản lũy kế: `phase4-rbl/` chứa toàn bộ Phase 1 + Phase 2 + Phase 3 và bổ sung module Phase 4.

## Căn cứ RBL

Phase 4 trong `RBL_SWD392.docx`: SOA/Microservices & Monetization. Quest yêu cầu tích hợp ví điện tử bằng .NET, quà tặng real-time và tính năng record podcast cho Super. RBL cũng yêu cầu giải thích cách Java, .NET và Node.js giao tiếp qua Swagger/API, đồng thời cách ly identity trong .NET và trả token cho Node.

## Flow kế thừa từ các phase trước

1. Phase 1 cung cấp học liệu, database schema, UML và .NET Auth API.
2. Phase 2 cung cấp Node realtime room, Agora token scaffold, giơ tay, bật/tắt mic và latency ping.
3. Phase 3 cung cấp Java LMS cho Pro/Mentor, pin material, dashboard learner và sub-level timer bằng State Pattern.
4. Phase 4 thêm monetization và API giao tiếp microservices.

## Flow wallet/top-up

1. Client gọi `GET /wallets/{userId}` để lấy balance.
2. Client gọi `POST /wallets/{userId}/top-up` với amount và provider reference.
3. .NET Wallet API cộng balance trong MariaDB và ghi ledger vào `wallet_transactions`.
4. Production cần thêm payment provider callback, idempotency key, audit log và outbox/event bus.

## Flow real-time gift

1. User gửi gift qua `POST /gifts`.
2. Wallet API kiểm tra balance người gửi.
3. API trừ balance sender và cộng balance creator.
4. API tạo gift transaction.
5. API trả `realtimeEvent = gift:sent` để Node realtime service broadcast sau commit.
6. Khi defense cần giải thích rủi ro sync: không được broadcast gift trước khi wallet commit thành công.

## Flow podcast recording

1. Super/Creator host room/podcast.
2. Sau khi record xong, client/service gọi `POST /podcasts/recordings`.
3. API lưu metadata gồm creator, room, title, storageUri và duration.
4. UI hoặc moderation service gọi `GET /podcasts/recordings` để xem danh sách recording.

## Cách chạy Phase 4

Chạy wallet API:

```bash
cd phase4-rbl/dotnet-wallet
dotnet restore
dotnet build
dotnet run
```

Swagger có tại:

```text
/swagger
```

Chạy lại realtime nếu cần demo gift broadcast concept:

```bash
cd phase4-rbl/realtime-audio
npm install
npm run check
npm start
```

Chạy Java LMS nếu cần demo module Pro/Mentor:

```bash
cd phase4-rbl/java-lms
mvn compile
mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication
```

## Endpoint chính

- `GET /health`
- `GET /wallets/{userId}`
- `POST /wallets/{userId}/top-up`
- `POST /gifts`
- `GET /gifts`
- `POST /podcasts/recordings`
- `GET /podcasts/recordings`
- `/swagger`

## Ghi chú .NET

Trong phase này, .NET được dùng cho hai backend Web API:

1. `dotnet-auth/`: authentication/register/login/JWT.
2. `dotnet-wallet/`: wallet, top-up, gift transaction và podcast metadata.

Nó không phải web giao diện. Web/mobile frontend sẽ gọi các API này.

## Giới hạn MVP

Wallet hiện đã persistence vào MariaDB (`wallet_accounts`, `wallet_transactions`, `gift_transactions`, `podcast_recordings`). Production vẫn cần payment gateway thật, idempotency, audit log và outbox/event bus để đồng bộ gift với Node realtime.

## Import database Phase 4

Chạy từ chính folder `phase4-rbl` để import toàn bộ phase vào database `lucy_phase4`:

```bash
mariadb -u root -p < database/import-all.sql
```

File `import-all.sql` sẽ chạy lần lượt:

1. `database/schema.sql`
2. `database/seed-sample.sql`
3. `generated/digitized-content.sql`
4. `database/phase2-realtime.sql`
5. `database/phase3-lms.sql`
6. `database/phase4-monetization.sql`

Kiểm tra nhanh:

```bash
mariadb -u root -p lucy_phase4
```

```sql
SHOW TABLES;
SELECT COUNT(*) FROM content_blocks;
SELECT COUNT(*) FROM realtime_rooms;
SELECT COUNT(*) FROM learner_progress;
SELECT COUNT(*) FROM wallet_accounts;
SELECT COUNT(*) FROM wallet_transactions;
SELECT COUNT(*) FROM gift_transactions;
SELECT COUNT(*) FROM podcast_recordings;
```

## Import bằng DBeaver

Nếu dùng DBeaver, không chạy file `import-all.sql` vì file đó dùng lệnh `SOURCE` của MySQL CLI. Thay vào đó mở và execute file thuần SQL này:

```text
phase4-rbl/database/dbeaver-import-all.sql
```

File này đã gộp sẵn schema, seed, digitized content, Phase 2 realtime SQL, Phase 3 LMS SQL và Phase 4 monetization SQL nên chỉ cần chạy một lần trong SQL Editor của DBeaver.

## Import bằng MySQL CLI

Chạy từ chính folder phase để lệnh `SOURCE database/...` hoạt động đúng.

```bash
mariadb -u root -p < database/import-all.sql
```

File `database/import-all.sql` đã có `CREATE DATABASE IF NOT EXISTS`, `USE database`, rồi import schema/seed/content/module SQL theo đúng thứ tự phase.
