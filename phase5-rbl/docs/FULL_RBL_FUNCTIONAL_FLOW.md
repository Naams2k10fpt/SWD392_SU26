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
4. Mentor/Creator có thể tạo phòng công khai hoặc đặt password. Password dài 4-100
   ký tự, được hash bằng `scrypt`; API danh sách chỉ trả `hasPassword`.
5. Client gửi `room:join` với `roomId`, `userId`, `displayName`, `role` và
   `password?`. Phòng khóa từ chối join trước khi tạo participant nếu password sai.
6. Server lưu room/participant vào MariaDB và broadcast `room:state` cho mọi client trong phòng.
7. Client gửi `hand:raise` và `mic:toggle`; Web Audio analyser đánh dấu avatar
   người đang nói.
8. Client gửi `latency:ping` để nhận `serverReceivedAt`; client tự tính round-trip latency.
9. Client lưu mã phòng đang tham gia để F5/reconnect tự join lại tối đa 3 lần.
   Chuyển tab không rời phòng; chỉ thao tác thoát đã xác nhận mới xóa trạng thái.
10. Chat giới hạn 500 ký tự và 200 tin gần nhất trên client. Tài liệu được tách
    sang panel riêng, mặc định thu nhỏ; PRO/SUPER được upload file tối đa 20 MB.

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
3. Wallet API cộng balance trong MariaDB và ghi ledger vào `wallet_transactions`.
4. Production phải thay bằng payment provider callback đã verify chữ ký, idempotency key, database transaction.

Luồng Super Chat trong phòng:

1. Learner chọn PRO/SUPER đang ở cùng phòng và gửi gift bằng `POST /gifts`.
2. Wallet API xác thực Bearer token, kiểm tra người nhận cùng phòng và balance sender.
3. API trừ balance sender, cộng balance người nhận và commit transaction.
4. Client emit `gift:announce`; Node kiểm tra giao dịch rồi broadcast
   `gift:announced` sau commit.
5. `GET /gifts` yêu cầu Bearer token và chỉ trả giao dịch user hiện tại đã gửi
   hoặc nhận; lịch sử hiển thị display name thay cho UUID khi có thông tin user.

Luồng podcast:

1. PRO/SUPER ghi âm trong phòng; UI hiển thị thời gian đang ghi.
2. Audio được upload vào Realtime service, sau đó metadata podcast được lưu.
3. PRO/SUPER có thể lọc, tạo, đổi tên, thay audio và xóa podcast.
4. Audio hỗ trợ WebM, M4A, WAV, MP3, OGG, tối đa 50 MB.
5. Production cần object storage thật, lifecycle policy và audit log.

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

## 10. Bảng mapping yêu cầu RBL sang deliverable

Bảng này dùng để chứng minh từng yêu cầu trong `RBL_SWD392.docx` đã được chuyển thành flow, folder/code và cách kiểm tra cụ thể.

| Phase | Yêu cầu trong RBL | Flow đã mô tả | Folder/code chứng minh | Cách kiểm tra |
|---|---|---|---|---|
| Phase 1 | Thiết lập hạ tầng ban đầu | Tạo cấu trúc phase, database schema, docs, UML, importer, auth API | `phase1-rbl/README.md`, `phase1-rbl/database/schema.sql`, `phase1-rbl/docs/`, `phase1-rbl/uml/` | Đọc README/docs, render PlantUML, import schema vào MySQL/MariaDB nếu có DB local |
| Phase 1 | Số hóa tài liệu English/Chinese/Japanese vào database bằng Java | Word/PDF source đặt ở root, script sinh JSON/SQL, Java importer là skeleton mở rộng | `phase1-rbl/tools/digitize_word_content.py`, `phase1-rbl/generated/digitized-content.json`, `phase1-rbl/generated/digitized-content.sql`, `phase1-rbl/java-importer/` | `cd phase1-rbl/java-importer && mvn test`; kiểm tra `generated/digitization-summary.json` |
| Phase 1 | Xây dựng Login/Register bằng .NET | Register hash password, login trả JWT, `/auth/me` đọc identity từ JWT | `phase1-rbl/dotnet-auth/Program.cs` | `cd phase1-rbl/dotnet-auth && dotnet build && dotnet run` |
| Phase 1 | Thiết kế Use Case và Class Diagram cho Anonymous/Pro/Super | Role Anonymous, Pro/Mentor, Super/Creator được mô tả trong docs và UML | `phase1-rbl/uml/use-case.puml`, `phase1-rbl/uml/class-diagram.puml`, `phase1-rbl/docs/requirements.md` | Mở hoặc render PlantUML, đối chiếu actor/use case với RBL |
| Phase 2 | Xây dựng core Real-time Audio tích hợp Agora SDK bằng Node.js | Client lấy token scaffold, join Socket.IO room, server broadcast room state | `phase2-rbl/realtime-audio/src/server.js`, `phase2-rbl/realtime-audio/README.md` | `cd phase2-rbl/realtime-audio && npm install && npm run check && npm start` |
| Phase 2 | Mobile kết nối phòng cơ bản | Flow `room:join` nhận `roomId`, `userId`, `displayName`, `role` | `phase2-rbl/realtime-audio/src/server.js` | Dùng Socket.IO client/manual test để emit `room:join` |
| Phase 2 | Giơ tay, bật/tắt mic | Flow `hand:raise` và `mic:toggle` cập nhật room state và broadcast | `phase2-rbl/realtime-audio/src/server.js` | Emit `hand:raise`, `mic:toggle`, kiểm tra event `room:state` |
| Phase 2 | Đo latency/ping, gamification real-time | Flow `latency:ping` trả timestamp server để client tính round-trip latency | `phase2-rbl/realtime-audio/src/server.js` | Emit `latency:ping`, ghi nhận round-trip time phía client |
| Phase 3 | Hoàn thiện LMS cho Pro bằng Java | Mentor pin material, dashboard learner, refresh summary | `phase3-rbl/java-lms/src/main/java/com/lucy/lms/LmsApplication.java` | `cd phase3-rbl/java-lms && mvn compile && mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication` |
| Phase 3 | Chuyển sub-level mỗi 10 phút | `StageTransitionEngine` kiểm tra thời gian và chuyển state kế tiếp | `phase3-rbl/java-lms/src/main/java/com/lucy/lms/LmsApplication.java` | Chạy demo Java, thấy learner quá 10 phút chuyển từ `WARM_UP` sang `GUIDED_PRACTICE` |
| Phase 3 | Bắt buộc dùng AI để gợi ý Design Pattern | Tài liệu giải thích chọn State Pattern thay IF-ELSE cho stage/sub-level transition | `phase5-rbl/docs/FULL_RBL_FUNCTIONAL_FLOW.md`, `phase2-rbl/docs/ai-usage-log.md` được kế thừa qua các phase sau | Đọc mục Phase 3 và AI usage log, trình bày rationale khi defense |
| Phase 4 | Tích hợp ví điện tử bằng .NET | Wallet lookup, top-up, ledger scaffold | `phase4-rbl/dotnet-wallet/Program.cs`, `phase4-rbl/dotnet-wallet/README.md` | `cd phase4-rbl/dotnet-wallet && dotnet build && dotnet run`, mở `/swagger` |
| Phase 4 | Quà tặng real-time | Gift API trừ balance sender, cộng balance creator, trả event `gift:sent` cho Node broadcast | `phase4-rbl/dotnet-wallet/Program.cs` | Gọi `POST /gifts` qua Swagger hoặc curl, kiểm tra response transaction |
| Phase 4 | Record Podcast cho Super | API nhận metadata recording gồm creator, room, title, storageUri, duration | `phase4-rbl/dotnet-wallet/Program.cs` | Gọi `POST /podcasts/recordings`, kiểm tra `GET /podcasts/recordings` |
| Phase 4 | SOA/Microservices Java/.NET/Node giao tiếp Swagger/API | Tách module auth .NET, realtime Node, LMS Java, wallet .NET; wallet có Swagger | `phase4-rbl/dotnet-auth/`, `phase4-rbl/realtime-audio/`, `phase4-rbl/java-lms/`, `phase4-rbl/dotnet-wallet/` | Chạy từng service/module theo runbook, giải thích ranh giới service khi defense |
| Phase 5 | Stress test 500-1000 users | k6 script ramp 100 -> 500 -> 1000 virtual users | `phase5-rbl/stress-tests/realtime-auth-wallet-stress.js` | `cd phase5-rbl && k6 run stress-tests/realtime-auth-wallet-stress.js` |
| Phase 5 | Fix bug UI/UX, Release Beta | Checklist beta release ghi các bước kiểm tra trước khi release | `phase5-rbl/final-evaluation/beta-release-checklist.md` | Tick checklist sau khi chạy module và stress test |
| Phase 5 | Cross-testing giữa các nhóm | Checklist test chéo app/flow của nhóm khác | `phase5-rbl/final-evaluation/cross-testing-checklist.md` | Dùng checklist khi nhóm khác test sản phẩm |
| Phase 5 | Final Defense và assessment alignment | Guide câu hỏi kiến trúc, rủi ro, AI usage, performance, microservices | `phase5-rbl/final-evaluation/final-defense-guide.md` | Dùng làm script chuẩn bị trả lời giảng viên và nhóm phản biện |

## 11. Kết luận coverage theo RBL

Các yêu cầu chính trong action plan RBL đều đã có folder/code hoặc tài liệu chứng minh theo từng phase. Các phần được đánh dấu scaffold là những tích hợp production cần credential hoặc hạ tầng thật, gồm Agora token thật, payment gateway thật, persistent database, Socket.IO production cluster và object storage cho podcast. Điều này phù hợp mục tiêu RBL/MVP: chứng minh kiến trúc, flow chức năng, khả năng defense và hướng mở rộng production.

## 12. Ghi chú về vai trò của .NET trong project

Trong repository này, .NET được dùng để xây dựng backend Web API, không phải web giao diện.

- `dotnet-auth/`: Web API cho register, login, JWT và endpoint `/auth/me`.
- `dotnet-wallet/`: Web API cho wallet, top-up, gift transaction và podcast recording metadata.
- Web/mobile frontend, nếu có, sẽ gọi các API .NET này qua HTTP.
- Node.js phụ trách realtime room/Socket.IO/Agora scaffold.
- Java phụ trách importer/LMS theo yêu cầu RBL.

Vì vậy khi defense có thể nói: ".NET là service backend trong kiến trúc microservices, dùng cho identity và monetization, không phải phần giao diện web."

## 13. Import database bằng file SQL theo từng phase

Mỗi phase có file `database/import-all.sql` để import đúng thứ tự schema, seed data, digitized content và migration riêng của phase đó. Chạy lệnh import từ chính folder của phase tương ứng vì `import-all.sql` dùng `SOURCE database/...`.

| Phase | Database mặc định | File import | Nội dung được import |
|---|---|---|---|
| Phase 1 | `lucy_phase1` | `phase1-rbl/database/import-all.sql` | Base schema, roles/languages seed, digitized learning content |
| Phase 2 | `lucy_phase2` | `phase2-rbl/database/import-all.sql` | Phase 1 + realtime rooms, participants, latency samples |
| Phase 3 | `lucy_phase3` | `phase3-rbl/database/import-all.sql` | Phase 2 + LMS material pins, learner progress, transition events |
| Phase 4 | `lucy_phase4` | `phase4-rbl/database/import-all.sql` | Phase 3 + wallet accounts, wallet transactions, gifts, podcast recordings |
| Phase 5 | `lucy_phase5` | `phase5-rbl/database/import-all.sql` | Phase 4 + stress test runs, cross-testing reports |

Ví dụ import Phase 5 đầy đủ:

```bash
cd phase5-rbl
mariadb -u root -p < database/import-all.sql
```

Kiểm tra sau import:

```bash
mariadb -u root -p lucy_phase5
```

```sql
SHOW TABLES;
SELECT COUNT(*) FROM content_blocks;
SELECT COUNT(*) FROM realtime_rooms;
SELECT COUNT(*) FROM learner_progress;
SELECT COUNT(*) FROM wallet_accounts;
SELECT COUNT(*) FROM stress_test_runs;
```

Nếu muốn import từng phần thủ công, thứ tự bắt buộc là:

1. `database/schema.sql`
2. `database/seed-sample.sql`
3. `generated/digitized-content.sql`
4. `database/phase2-realtime.sql` nếu phase >= 2
5. `database/phase3-lms.sql` nếu phase >= 3
6. `database/phase4-monetization.sql` nếu phase >= 4
7. `database/phase5-stress-evaluation.sql` nếu phase = 5

## 14. Import bằng DBeaver không cần MySQL CLI

File `database/import-all.sql` dùng lệnh `SOURCE`, phù hợp với MySQL CLI. Nếu dùng DBeaver, hãy dùng file `database/dbeaver-import-all.sql` vì đây là file SQL đã gộp toàn bộ nội dung, không dùng `SOURCE`.

| Phase | File chạy trong DBeaver |
|---|---|
| Phase 1 | `phase1-rbl/database/dbeaver-import-all.sql` |
| Phase 2 | `phase2-rbl/database/dbeaver-import-all.sql` |
| Phase 3 | `phase3-rbl/database/dbeaver-import-all.sql` |
| Phase 4 | `phase4-rbl/database/dbeaver-import-all.sql` |
| Phase 5 | `phase5-rbl/database/dbeaver-import-all.sql` |

Cách chạy trong DBeaver:

1. Mở connection MySQL/MariaDB.
2. Mở file `dbeaver-import-all.sql` của phase cần import.
3. Chạy toàn bộ script bằng SQL Editor.
4. Refresh database navigator.
5. Kiểm tra bằng `SHOW TABLES;` và các câu `SELECT COUNT(*)` trong runbook.

Ví dụ với Phase 5, chỉ cần mở file này trong DBeaver và execute:

```text
phase5-rbl/database/dbeaver-import-all.sql
```

## 15. Import bằng MySQL CLI

Nếu chạy bằng MySQL CLI, dùng các file trong `database/` của từng phase. Chạy command từ chính folder phase để lệnh `SOURCE database/...` resolve đúng path.

Có 2 kiểu import:

1. Giữ database nếu đã tồn tại, chỉ tạo bảng/dữ liệu nếu chưa có:

```bash
cd phase5-rbl
mysql -u root -p < database/import-all.sql
```

File này bắt đầu bằng:

```sql
CREATE DATABASE IF NOT EXISTS lucy_phase5 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lucy_phase5;
```

2. Reset sạch database rồi import lại từ đầu:

```bash
cd phase5-rbl
mysql -u root -p < database/reset-import-all.sql
```

File này bắt đầu bằng:

```sql
DROP DATABASE IF EXISTS lucy_phase5;
CREATE DATABASE lucy_phase5 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lucy_phase5;
```

Dùng `reset-import-all.sql` khi muốn demo/import sạch và không cần giữ dữ liệu cũ. Dùng `import-all.sql` khi muốn chạy lại nhẹ, tránh xóa database.

Danh sách file reset theo phase:

| Phase | Import giữ DB | Reset rồi import lại |
|---|---|---|
| Phase 1 | `phase1-rbl/database/import-all.sql` | `phase1-rbl/database/reset-import-all.sql` |
| Phase 2 | `phase2-rbl/database/import-all.sql` | `phase2-rbl/database/reset-import-all.sql` |
| Phase 3 | `phase3-rbl/database/import-all.sql` | `phase3-rbl/database/reset-import-all.sql` |
| Phase 4 | `phase4-rbl/database/import-all.sql` | `phase4-rbl/database/reset-import-all.sql` |
| Phase 5 | `phase5-rbl/database/import-all.sql` | `phase5-rbl/database/reset-import-all.sql` |

## 15. Import bằng MySQL CLI

Nếu chạy bằng MySQL CLI, dùng file `database/import-all.sql` trong từng phase. File này đã có `CREATE DATABASE IF NOT EXISTS`, `USE database`, rồi import schema/seed/content/module SQL theo đúng thứ tự.

Chạy command từ chính folder phase để lệnh `SOURCE database/...` resolve đúng path.

Ví dụ import Phase 5:

```bash
cd phase5-rbl
mysql -u root -p < database/import-all.sql
```

File `phase5-rbl/database/import-all.sql` bắt đầu bằng:

```sql
CREATE DATABASE IF NOT EXISTS lucy_phase5 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lucy_phase5;
```

Danh sách file CLI theo phase:

| Phase | File CLI import |
|---|---|
| Phase 1 | `phase1-rbl/database/import-all.sql` |
| Phase 2 | `phase2-rbl/database/import-all.sql` |
| Phase 3 | `phase3-rbl/database/import-all.sql` |
| Phase 4 | `phase4-rbl/database/import-all.sql` |
| Phase 5 | `phase5-rbl/database/import-all.sql` |
