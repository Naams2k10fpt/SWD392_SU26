# RBL SWD392 - Giai đoạn 2

Nguồn chính: `../RBL_SWD392.docx`, phần ACTION PLAN RBL SWD392.

## Phạm vi lũy kế

Folder này kế thừa toàn bộ Phase 1 và bổ sung Phase 2: Real-time Architecture & MVP.

## Bổ sung Phase 2

- `realtime-audio/`: Node.js Socket.IO MVP cho phòng audio, raise hand, mic toggle, latency ping.
- `realtime-audio/src/server.js`: Agora token endpoint scaffold, room state, Socket.IO events.

## Chạy Phase 2

```bash
cd realtime-audio
npm install
npm run check
npm start
```

## Nội dung kế thừa từ Phase 1

# RBL SWD392 - Giai đoạn 1

Nguồn chính: `../RBL_SWD392.docx`, phần **ACTION PLAN: RESEARCH-BASED LEARNING CHO SWD392 & PROJECT**.

## Phạm vi giai đoạn 1

**Giai đoạn 1 (Tuần 1-2): Khởi tạo & Mô hình hóa Yêu cầu (Requirements Modeling)**

- Tương ứng Session 1-13 của SWD392.
- Quest dự án:
  - Thiết lập hạ tầng ban đầu.
  - Số hóa tài liệu từ các file Word English/Chinese/Japanese vào database bằng Java.
  - Xây dựng hệ thống Login/Register bằng .NET.
- Research topic:
  - Use Case Modeling.
  - Static/Dynamic Modeling.
  - Object and Class Structuring.
- Bài toán role:
  - User ẩn danh.
  - Pro (Mentor).
  - Super (Creator).
- Deliverable mô hình hóa:
  - Use Case Diagram.
  - Class Diagram.

## Cấu trúc folder

```text
phase1-rbl/
├── README.md
├── docs/
├── uml/
├── database/
├── java-importer/
└── dotnet-auth/
```

## Deliverables

- `docs/requirements.md`: yêu cầu chức năng/phi chức năng và acceptance criteria.
- `docs/infrastructure-plan.md`: kế hoạch hạ tầng ban đầu.
- `docs/peer-pitching-guide.md`: checklist pitching và câu hỏi phản biện.
- `docs/ai-usage-log.md`: mẫu log sử dụng AI minh bạch theo RBL.
- `uml/*.puml`: Use Case, Class và Sequence diagram bằng PlantUML.
- `database/schema.sql`: schema MySQL/MariaDB cho auth và learning content.
- `database/seed-sample.sql`: seed roles/languages mẫu.
- `tools/digitize_word_content.py`: script số hóa Word sang JSON/SQL.
- `generated/digitized-content.sql`: dữ liệu học liệu đã số hóa để import MySQL/MariaDB.
- `generated/digitized-content.json`: dữ liệu học liệu đã số hóa để review.
- `generated/digitization-summary.json`: thống kê số hóa.
- `docs/PHASE1_DIGITIZATION_REPORT.md`: báo cáo chi tiết Phase 1.
- `java-importer/`: skeleton Java đọc `.docx` bằng Apache POI.
- `dotnet-auth/`: skeleton ASP.NET Core Minimal API cho register/login/me.

## Cách dùng nhanh

### Xem UML

Render các file PlantUML trong `uml/` bằng PlantUML hoặc extension PlantUML trong VS Code/IntelliJ.

### Tạo database mẫu

```bash
mariadb -u root -p < database/import-all.sql
```

### Chạy lại số hóa Word

```bash
python tools/digitize_word_content.py --root .. --out generated
```

### Chạy Java importer skeleton

```bash
cd java-importer
mvn test
mvn exec:java -Dexec.mainClass=com.lucy.importer.WordContentImporter -Dexec.args="../sample.docx"
```

### Chạy .NET Login/Register skeleton

```bash
cd dotnet-auth
dotnet restore
dotnet run
```

Endpoints chính:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

## Cách test Phase 2

Phase 2 bổ sung service realtime bằng Node.js/Socket.IO. Test chính gồm HTTP health, Agora token scaffold, danh sách room, và Socket.IO events.

### 1. Chạy realtime service

Mở terminal 1:

```bash
cd /home/amtia/Projects/swd/phase2-rbl/realtime-audio
npm install
npm run check
npm start
```

Giữ terminal này chạy. Service mặc định listen tại:

```text
http://localhost:3020
```

### 2. Test HTTP endpoints

Mở terminal 2, kiểm tra service còn sống không:

```bash
curl http://localhost:3020/health
```

Kết quả đúng sẽ giống:

```json
{"service":"RBL Phase 2 Real-time Audio MVP","status":"ready"}
```

Test danh sách room ban đầu:

```bash
curl http://localhost:3020/rooms
```

Ban đầu thường trả về:

```json
{"rooms":[]}
```

Test Agora token scaffold:

```bash
curl -s -X POST http://localhost:3020/agora/token \
  -H 'Content-Type: application/json' \
  -d '{"channelName":"level-1","uid":"anon-1"}'
```

Kết quả đúng sẽ có `channelName`, `uid`, `token`, `expiresInSeconds`. Token này chỉ là scaffold demo, chưa phải token Agora production thật.

### 3. Test Socket.IO events bằng Node

Mở terminal 2, nếu chưa có `socket.io-client` thì cài tạm trong folder service:

```bash
cd /home/amtia/Projects/swd/phase2-rbl/realtime-audio
npm install socket.io-client
```

Chạy script test nhanh bằng `node -e`:

```bash
node -e "import { io } from 'socket.io-client'; const socket = io('http://localhost:3020'); socket.on('connect', () => { console.log('connected', socket.id); socket.emit('room:join', { roomId: 'level-1', userId: 'anon-1', displayName: 'Anonymous 1', role: 'ANONYMOUS' }, console.log); socket.emit('hand:raise', { roomId: 'level-1', raised: true }, console.log); socket.emit('mic:toggle', { roomId: 'level-1', enabled: true }, console.log); socket.emit('latency:ping', { clientSentAt: Date.now() }, console.log); setTimeout(() => socket.close(), 1000); }); socket.on('room:state', state => console.log('room:state', state));"
```

Nếu đúng, terminal sẽ in ra `connected`, các response có `ok: true`, và event `room:state` có user trong room.

Sau đó kiểm tra lại room qua HTTP:

```bash
curl http://localhost:3020/rooms
```

Nếu client đã disconnect, participant sẽ được đánh dấu `left_at`; room vẫn được lưu trong MariaDB và `/rooms` chỉ hiển thị participant đang online.
### Database connection Phase 2

Realtime service hiện lưu room, participant, raise hand, mic state và latency vào MariaDB. Service đọc biến `LUCY_DB_URL`. Nếu không set, mặc định là:

```text
mysql://root@localhost:3306/lucy_phase2
```

Nếu test riêng Phase 2 với database khác, chạy:

```bash
LUCY_DB_URL='mysql://root:your_password@localhost:3306/lucy_phase2' npm start
```

