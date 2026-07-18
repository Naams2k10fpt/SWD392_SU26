# Phase 3 runbook - flow và cách chạy

Folder này là bản lũy kế: `phase3-rbl/` chứa toàn bộ Phase 1 + Phase 2 và bổ sung module Phase 3.

## Căn cứ RBL

Phase 3 trong `RBL_SWD392.docx`: áp dụng Design Patterns & tích hợp LMS. Quest yêu cầu hoàn thiện công cụ LMS cho Pro bằng Java, gồm ghim tài liệu, chuyển sub-levels mỗi 10 phút và dashboard quản lý học viên. RBL cũng yêu cầu giải thích việc chọn design pattern, ví dụ State Pattern hoặc Observer Pattern, thay vì IF-ELSE truyền thống.

## Flow kế thừa từ Phase 1 và Phase 2

1. Phase 1 cung cấp học liệu đã digitize, database schema, UML và .NET Auth API.
2. Phase 2 cung cấp Node realtime room, Agora token scaffold, giơ tay, bật/tắt mic và latency ping.
3. Phase 3 dùng các nền tảng đó để Mentor/Pro điều phối học viên trong LMS.

## Flow mới của Phase 3

1. Mentor đăng nhập với role Pro qua auth flow.
2. Mentor pin material theo language/stage để learner thấy tài liệu ưu tiên.
3. Dashboard theo dõi learner, level hiện tại, sub-level hiện tại và thời điểm bắt đầu sub-level.
4. `StageTransitionEngine` kiểm tra learner đã ở sub-level đủ 10 phút chưa.
5. Nếu đủ thời gian, engine chuyển learner sang sub-level tiếp theo.
6. Dashboard summary hiển thị pinned materials và learner progress sau khi refresh.

## Cách chạy Phase 3

Chạy Java LMS demo:

```bash
cd phase3-rbl/java-lms
mvn compile
mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication
```

Nếu muốn chạy lại module kế thừa Phase 2:

```bash
cd phase3-rbl/realtime-audio
npm install
npm run check
npm start
```

Nếu muốn chạy lại auth kế thừa Phase 1:

```bash
cd phase3-rbl/dotnet-auth
dotnet build
dotnet run
```

## Design Pattern dùng

- Module dùng State Pattern.
- Các state chính: `WarmUpState`, `GuidedPracticeState`, `PeerExchangeState`, `ReflectionState`.
- Mỗi state giữ rule chuyển tiếp riêng.
- Cách này dễ mở rộng hơn IF-ELSE khi logic stage/sub-level thay đổi theo level, ngôn ngữ hoặc hoạt động.

## File cần đọc khi defense

- `phase3-rbl/java-lms/src/main/java/com/lucy/lms/LmsApplication.java`
- `phase3-rbl/java-lms/README.md`
- `phase3-rbl/docs/ai-usage-log.md`

## Ghi chú .NET

Trong phase này, .NET vẫn đóng vai trò backend Web API cho authentication kế thừa từ Phase 1. Java LMS không thay thế auth; nó là module LMS riêng cho Pro/Mentor.

## Import database Phase 3

Chạy từ chính folder `phase3-rbl` để import toàn bộ phase vào database `lucy_phase3`:

```bash
mariadb -u root -p < database/import-all.sql
```

File `import-all.sql` sẽ chạy lần lượt:

1. `database/schema.sql`
2. `database/seed-sample.sql`
3. `generated/digitized-content.sql`
4. `database/phase2-realtime.sql`
5. `database/phase3-lms.sql`

Kiểm tra nhanh:

```bash
mariadb -u root -p lucy_phase3
```

```sql
SHOW TABLES;
SELECT COUNT(*) FROM content_blocks;
SELECT COUNT(*) FROM realtime_rooms;
SELECT COUNT(*) FROM mentor_material_pins;
SELECT COUNT(*) FROM learner_progress;
SELECT COUNT(*) FROM lms_transition_events;
```

## Import bằng DBeaver

Nếu dùng DBeaver, không chạy file `import-all.sql` vì file đó dùng lệnh `SOURCE` của MySQL CLI. Thay vào đó mở và execute file thuần SQL này:

```text
phase3-rbl/database/dbeaver-import-all.sql
```

File này đã gộp sẵn schema, seed, digitized content, Phase 2 realtime SQL và Phase 3 LMS SQL nên chỉ cần chạy một lần trong SQL Editor của DBeaver.

## Import bằng MySQL CLI

Chạy từ chính folder phase để lệnh `SOURCE database/...` hoạt động đúng.

```bash
mariadb -u root -p < database/import-all.sql
```

File `database/import-all.sql` đã có `CREATE DATABASE IF NOT EXISTS`, `USE database`, rồi import schema/seed/content/module SQL theo đúng thứ tự phase.
