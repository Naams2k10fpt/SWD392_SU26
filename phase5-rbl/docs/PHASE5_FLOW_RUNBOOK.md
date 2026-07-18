# Runbook flow và cách chạy từng phase RBL SWD392

File này là bản hướng dẫn nhanh để biết mỗi phase có flow gì, nằm ở đâu và chạy như thế nào. Các folder phase được tổ chức lũy kế: Phase 2 chứa toàn bộ Phase 1, Phase 3 chứa Phase 1 + Phase 2, Phase 4 chứa Phase 1 + Phase 2 + Phase 3, Phase 5 chứa toàn bộ các phase trước.

## Phase 1 - Requirements, digitization, database, auth

Folder chính: `phase1-rbl/`

Flow chức năng:

1. Chuẩn bị tài liệu học liệu ở root project: English, Chinese, Japanese Word/PDF.
2. Chạy digitization để sinh JSON/SQL học liệu.
3. Import SQL vào database MySQL/MariaDB theo schema.
4. Dùng Java importer skeleton để mở rộng việc đọc `.docx` bằng Apache POI.
5. Dùng .NET auth API để register/login và phát JWT.
6. Dùng UML/docs để giải thích role Anonymous, Pro/Mentor, Super/Creator.

Cách chạy/check:

```bash
cd phase1-rbl/java-importer
mvn test
```

```bash
cd phase1-rbl/dotnet-auth
dotnet build
dotnet run
```

Endpoint auth chính:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

File cần đọc khi defense:

- `phase1-rbl/docs/requirements.md`
- `phase1-rbl/docs/PHASE1_DIGITIZATION_REPORT.md`
- `phase1-rbl/database/schema.sql`
- `phase1-rbl/uml/use-case.puml`
- `phase1-rbl/uml/class-diagram.puml`

## Phase 2 - Real-time Architecture & MVP

Folder chính: `phase2-rbl/`

Module mới: `phase2-rbl/realtime-audio/`

Flow chức năng:

1. User có identity từ auth hoặc dùng anonymous trial identity.
2. Client gọi `POST /agora/token` để nhận Agora token scaffold.
3. Client kết nối Socket.IO vào Node realtime service.
4. Client emit `room:join` để vào phòng học.
5. Server lưu room/participant vào MariaDB và broadcast `room:state`.
6. Client emit `hand:raise` để bật/tắt giơ tay.
7. Client emit `mic:toggle` để bật/tắt mic.
8. Client emit `latency:ping` để đo round-trip latency.

Cách chạy/check:

```bash
cd phase2-rbl/realtime-audio
npm install
npm run check
npm start
```

Endpoint/event chính:

- `GET /health`
- `POST /agora/token`
- `GET /rooms`
- Socket event `room:join`
- Socket event `hand:raise`
- Socket event `mic:toggle`
- Socket event `latency:ping`

Lưu ý defense:

- Agora token hiện là scaffold, chưa phải token production.
- Production cần Agora AccessToken2/RtcTokenBuilder, server credential, JWT middleware và authorization theo room/channel.

## Phase 3 - Java LMS, Design Pattern, sub-level timer

Folder chính: `phase3-rbl/`

Module mới: `phase3-rbl/java-lms/`

Flow chức năng:

1. Mentor đăng nhập với role Pro.
2. Mentor pin material theo language/stage.
3. Dashboard theo dõi learner, level, sub-level và thời điểm bắt đầu sub-level.
4. `StageTransitionEngine` kiểm tra learner đã ở sub-level đủ 10 phút chưa.
5. Nếu đủ thời gian, engine chuyển learner sang sub-level tiếp theo.
6. Dashboard in ra summary gồm pinned materials và learner progress mới.

Cách chạy/check:

```bash
cd phase3-rbl/java-lms
mvn compile
mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication
```

Design Pattern dùng:

- State Pattern.
- Mỗi state như `WarmUpState`, `GuidedPracticeState`, `PeerExchangeState`, `ReflectionState` tự giữ rule chuyển tiếp.
- Cách này dễ mở rộng hơn IF-ELSE khi mỗi stage/sub-level có rule khác nhau.

File cần đọc khi defense:

- `phase3-rbl/java-lms/src/main/java/com/lucy/lms/LmsApplication.java`
- `phase3-rbl/java-lms/README.md`

## Phase 4 - SOA/Microservices, wallet, gifts, podcast

Folder chính: `phase4-rbl/`

Module mới: `phase4-rbl/dotnet-wallet/`

Flow wallet/top-up:

1. Client gọi `GET /wallets/{userId}` để lấy balance.
2. Client gọi `POST /wallets/{userId}/top-up` với amount.
3. API cộng balance trong MariaDB và ghi ledger vào `wallet_transactions`.
4. Production cần thêm payment provider callback, idempotency, audit log và outbox/event bus.

Flow real-time gift:

1. User gửi gift qua `POST /gifts`.
2. Wallet API kiểm tra balance người gửi.
3. API trừ balance sender và cộng balance creator.
4. API tạo gift transaction.
5. API trả `realtimeEvent = gift:sent` để Node realtime service broadcast sau commit.

Flow podcast recording:

1. Super/Creator host room/podcast.
2. Sau khi record xong, client/service gọi `POST /podcasts/recordings`.
3. API lưu metadata gồm creator, room, title, storageUri, duration.
4. UI hoặc moderation service có thể gọi `GET /podcasts/recordings` để list recording.

Cách chạy/check:

```bash
cd phase4-rbl/dotnet-wallet
dotnet restore
dotnet build
dotnet run
```

Endpoint chính:

- `GET /health`
- `GET /wallets/{userId}`
- `POST /wallets/{userId}/top-up`
- `POST /gifts`
- `GET /gifts`
- `POST /podcasts/recordings`
- `GET /podcasts/recordings`
- `/swagger`

Lưu ý defense:

- Phase 4 chứng minh ranh giới microservices: auth .NET, realtime Node, LMS Java, wallet .NET.
- Gift cần xử lý sync cẩn thận: commit wallet trước, broadcast sau, production nên dùng outbox/idempotency.

## Phase 5 - Stress Test, Beta, Cross-testing, Final Defense

Folder chính: `phase5-rbl/`

Module/tài liệu mới:

- `phase5-rbl/stress-tests/realtime-auth-wallet-stress.js`
- `phase5-rbl/final-evaluation/beta-release-checklist.md`
- `phase5-rbl/final-evaluation/cross-testing-checklist.md`
- `phase5-rbl/final-evaluation/final-defense-guide.md`
- `phase5-rbl/docs/FULL_RBL_FUNCTIONAL_FLOW.md`

Flow stress test:

1. Chạy auth service.
2. Chạy realtime service.
3. Chạy wallet service.
4. Set base URL nếu port khác mặc định.
5. Chạy k6 script.
6. Script ramp tải lên 100, 500, 1000 virtual users.
7. Script test register auth, Agora token scaffold, wallet lookup, wallet top-up.
8. Nhóm ghi lại p95 latency, failure rate, CPU/RAM và lỗi endpoint.

Cách chạy/check:

```bash
cd phase5-rbl
k6 run stress-tests/realtime-auth-wallet-stress.js
```

Nếu service chạy port khác:

```bash
AUTH_BASE_URL=http://localhost:5000 REALTIME_BASE_URL=http://localhost:3020 WALLET_BASE_URL=http://localhost:5040 k6 run stress-tests/realtime-auth-wallet-stress.js
```

Nếu chưa cài k6:

- Vẫn dùng script này làm test plan.
- Cài k6 trước khi chạy benchmark thật.
- Có thể kiểm tra syntax bằng `node --check stress-tests/realtime-auth-wallet-stress.js`.

## Demo cuối kỳ theo thứ tự đề xuất

1. Mở `phase5-rbl/docs/FULL_RBL_FUNCTIONAL_FLOW.md` để trình bày mapping RBL.
2. Trình bày Phase 1: UML, DB schema, digitized content, auth.
3. Chạy Phase 2 realtime service và giải thích Socket.IO/Agora scaffold.
4. Chạy Phase 3 Java LMS demo để thấy sub-level tự chuyển.
5. Chạy Phase 4 wallet API và mở Swagger.
6. Trình bày Phase 5 stress script và checklist final defense.

Commands demo nhanh:

```bash
cd phase5-rbl/realtime-audio
npm install
npm run check
```

```bash
cd phase5-rbl/java-lms
mvn compile
mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication
```

```bash
cd phase5-rbl/dotnet-wallet
dotnet build
```

```bash
cd phase5-rbl
node --check stress-tests/realtime-auth-wallet-stress.js
```

## Ghi chú production readiness

Các module hiện là MVP/scaffold để đáp ứng RBL và defense kiến trúc. Trước khi production cần bổ sung Agora token thật, payment gateway thật, persistent database, JWT middleware, authorization theo role, logging/monitoring, CI/CD, object storage cho podcast và kiểm chứng thủ công/nâng cấp parser cho file PDF English Stage 3.
