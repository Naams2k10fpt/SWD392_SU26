# Luồng chức năng đầy đủ RBL SWD392

## 1. Nguồn tài liệu đã kiểm tra

Tài liệu điều phối chính đã được kiểm tra bằng trích xuất text từ file Word: `RBL_SWD392.docx`. Nội dung trích xuất xác nhận action plan 5 giai đoạn: Phase 1 requirements/modeling/import/auth, Phase 2 real-time audio MVP, Phase 3 design patterns/LMS, Phase 4 SOA/monetization, Phase 5 stress test/final evaluation.

Các tài liệu hỗ trợ ở thư mục gốc đã được liệt kê để đối chiếu phạm vi học liệu:

- `LUCY_Project_Detailed_Specification.docx`
- `Eng - STAGE 1 (LEVELS 1-30).docx`
- `Eng - STAGE 2 (LEVEL 31-60).docx`
- `Eng - STAGE 2 (LEVEL 31-60) REVIEWED_SID.docx`
- `Eng - STAGE 3 (LEVELS 61-100).pdf`
- `Chinese - level 1-30.docx`
- `Chinese - level 31-60.docx`
- `chinese level 61-100.docx`
- `Janpanes - ステージ1(レベル1-30).docx`
- `Janpanes - ステージ2(レベル31-60).docx`
- `Janpanes - ステージ3(レベル61-100).docx`
- `SA_NCKH_Slides.pptx`

Lưu ý về English Stage 3 PDF: file `Eng - STAGE 3 (LEVELS 61-100).pdf` đã được thấy trong danh sách tài liệu nguồn, nhưng trong lần triển khai này chưa xác minh được nội dung text PDF bằng code trích xuất PDF chuyên dụng. Vì vậy Phase 1/Phase 5 phải ghi rõ rủi ro review thủ công cho PDF này trước khi khẳng định đã import đủ 100% nội dung English Stage 3.

## 2. Vai trò người dùng

- Anonymous: vào học thử Level 1-5, tham gia phòng real-time cơ bản, giơ tay, bật/tắt mic, được đo latency/ping cho thử nghiệm Phase 2.
- Pro: vai trò Mentor, có dashboard learner, pin tài liệu học, theo dõi level/sub-level, hỗ trợ learner chuyển hoạt động theo timer.
- Super: vai trò Creator, nhận gift, quản lý podcast/recording metadata, tham gia monetization flow ở Phase 4.

## 3. Phase 1 - Requirements, digitization, database, auth

Phase 1 nằm trong `phase1-rbl` và được kế thừa nguyên vẹn vào các phase sau. Mục tiêu là đặt nền cho hệ thống LUCY/RBL.

Luồng content digitization:

1. Nhóm đặt các tài liệu Word/PDF ở thư mục gốc.
2. Script `tools/digitize_word_content.py` đọc tài liệu Word English/Chinese/Japanese.
3. Output được tạo trong `generated/digitized-content.json`, `generated/digitized-content.sql`, và `generated/digitization-summary.json`.
4. SQL được import vào schema trong `database/schema.sql` để tạo dữ liệu `languages`, `stages`, `levels`, `lessons`, `content_blocks`.
5. `java-importer/` là skeleton Java Apache POI để tiếp tục chuẩn hóa import `.docx` vào database thật.

Luồng auth:

1. Client gọi `.NET auth` endpoint `/auth/register` với email, password, displayName, role.
2. API hash password bằng ASP.NET Identity hasher.
3. Login qua `/auth/login` trả JWT.
4. `/auth/me` dùng JWT để trả identity hiện tại.
5. Phase 4/Phase 5 defense cần giải thích rằng identity .NET sẽ là nguồn phát token cho Node real-time và các module khác.

Cách kiểm tra Phase 1:

```bash
cd phase1-rbl/java-importer
mvn test
cd ../dotnet-auth
dotnet build
```

## 4. Phase 2 - Real-time Architecture & MVP

Phase 2 nằm trong `phase2-rbl` và kế thừa toàn bộ Phase 1. Module mới là `realtime-audio/`.

Luồng real-time room:

1. Mobile/web client lấy identity từ .NET auth hoặc anonymous token scaffold.
2. Client gọi `POST /agora/token` với `channelName` và `uid` để nhận token scaffold.
3. Client kết nối Socket.IO tới Node service.
4. Client gửi `room:join` với `roomId`, `userId`, `displayName`, `role`.
5. Server lưu room/participant vào MariaDB (`realtime_rooms`, `realtime_room_participants`) và broadcast `room:state` cho mọi client trong phòng.
6. Client gửi `hand:raise` để bật/tắt trạng thái giơ tay.
7. Client gửi `mic:toggle` để bật/tắt trạng thái mic ở room state.
8. Client gửi `latency:ping`; server trả `serverReceivedAt` và lưu latency sample vào `realtime_latency_samples`.

Ranh giới MVP: endpoint Agora hiện chỉ trả placeholder token để mô tả kiến trúc. Production phải dùng Agora AccessToken2/RtcTokenBuilder, credential server-side, JWT middleware, và kiểm tra quyền vào channel.

Cách kiểm tra Phase 2:

```bash
cd phase2-rbl/realtime-audio
npm install
npm run check
npm start
```

## 5. Phase 3 - Java LMS, design patterns, sub-level timer

Phase 3 nằm trong `phase3-rbl`, kế thừa Phase 1 + Phase 2 và bổ sung `java-lms/`.

Luồng Pro/Mentor LMS:

1. Mentor đăng nhập với role Pro.
2. Mentor pin material theo ngôn ngữ/stage để learner thấy tài liệu ưu tiên.
3. Dashboard nhận danh sách learner, level hiện tại, sub-level hiện tại và thời điểm bắt đầu sub-level.
4. `StageTransitionEngine` chạy kiểm tra timer.
5. Nếu learner ở một sub-level đủ 10 phút, engine chuyển sang sub-level kế tiếp.
6. Dashboard summary hiển thị material đã pin và learner sau khi refresh.

Lựa chọn design pattern: module dùng State pattern. Mỗi state (`WarmUpState`, `GuidedPracticeState`, `PeerExchangeState`, `ReflectionState`) sở hữu rule chuyển tiếp của nó. Cách này phù hợp hơn IF-ELSE vì Stage/Sub-level có thể tăng rule riêng theo từng ngôn ngữ, từng level hoặc từng hoạt động mà không làm phình một hàm điều kiện trung tâm.

Cách kiểm tra Phase 3:

```bash
cd phase3-rbl/java-lms
mvn compile
mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication
```

## 6. Phase 4 - SOA/Microservices, wallet, gifts, podcast

Phase 4 nằm trong `phase4-rbl`, kế thừa Phase 1 + Phase 2 + Phase 3 và bổ sung `dotnet-wallet/`.

Luồng wallet/top-up:

1. Client gọi `GET /wallets/{userId}` để xem balance.
2. Client gọi `POST /wallets/{userId}/top-up` với amount và provider reference.
3. Wallet API cộng balance trong MariaDB, ghi ledger vào `wallet_transactions`.
4. Production cần thêm payment provider callback đã verify chữ ký, idempotency key, audit log và outbox/event bus.

Luồng real-time gift:

1. Learner/Pro gửi gift bằng `POST /gifts` gồm sender, creator, room, amount, message.
2. Wallet API kiểm tra balance sender.
3. API trừ balance sender và cộng balance creator.
4. API ghi `gift_transactions` rồi trả `realtimeEvent = gift:sent` để Node Socket.IO broadcast sau commit.
5. Defense cần nêu rủi ro sync: nếu broadcast trước commit hoặc retry không idempotent, UI có thể hiển thị gift sai.

Luồng podcast recording:

1. Super/Creator host room/podcast.
2. Sau khi recording hoàn tất, client/service gọi `POST /podcasts/recordings` với creator, room, title, storageUri, duration.
3. API lưu metadata vào `podcast_recordings` để UI listing hoặc moderation dùng sau.
4. Production cần object storage thật, permission check, lifecycle policy và audit log.

Cách kiểm tra Phase 4:

```bash
cd phase4-rbl/dotnet-wallet
dotnet restore
dotnet build
dotnet run
```

Swagger có tại `/swagger` khi service chạy.

## 7. Phase 5 - Stress test, beta, cross-testing, final defense

Phase 5 nằm trong `phase5-rbl`, kế thừa tất cả phase trước và bổ sung stress/final evaluation assets.

Luồng stress test:

1. Chạy auth service, realtime service và wallet service ở local hoặc môi trường test.
2. Set biến môi trường `AUTH_BASE_URL`, `REALTIME_BASE_URL`, `WALLET_BASE_URL` nếu port khác mặc định.
3. Chạy k6 script `stress-tests/realtime-auth-wallet-stress.js`.
4. Script tăng tải lên 100, 500, rồi 1000 virtual users.
5. Script kiểm tra auth register, Agora token scaffold, wallet lookup và top-up.
6. Nhóm ghi lại p95 latency, failure rate, CPU/RAM và các lỗi endpoint.

Cách kiểm tra Phase 5:

```bash
cd phase5-rbl
k6 run stress-tests/realtime-auth-wallet-stress.js
```

Nếu chưa cài k6, vẫn có thể dùng script như tài liệu kiểm thử tải và chạy sau khi cài k6 trong môi trường CI hoặc máy demo.

## 8. Cách chạy module theo thứ tự demo cuối kỳ

1. Phase 1 Java importer: `cd phase5-rbl/java-importer && mvn test`.
2. Phase 1 auth: `cd phase5-rbl/dotnet-auth && dotnet build && dotnet run`.
3. Phase 2 realtime: `cd phase5-rbl/realtime-audio && npm install && npm run check && npm start`.
4. Phase 3 LMS: `cd phase5-rbl/java-lms && mvn compile && mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication`.
5. Phase 4 wallet: `cd phase5-rbl/dotnet-wallet && dotnet build && dotnet run`.
6. Phase 5 stress: `cd phase5-rbl && k6 run stress-tests/realtime-auth-wallet-stress.js`.

## 9. Trạng thái production readiness

Các module được triển khai đúng tinh thần RBL MVP/scaffold để học kiến trúc và defense. Chưa được mô tả là production-ready. Những phần cần hardening gồm Agora token thật, payment gateway thật, database persistence, distributed transaction/outbox, JWT middleware cho Node, authorization theo role, logging/monitoring, CI stress environment, và kiểm chứng text của file PDF English Stage 3.
