# RBL SWD392 - Giai đoạn 5

Nguồn chính: `../RBL_SWD392.docx`, phần ACTION PLAN RBL SWD392.

## Phạm vi lũy kế

Folder này kế thừa Phase 1 + Phase 2 + Phase 3 + Phase 4 và bổ sung Phase 5: Stress Test, Optimization & Final Evaluation.

## Bổ sung Phase 5

- `stress-tests/realtime-auth-wallet-stress.js`: k6 stress script cho auth/realtime/wallet endpoints.
- `final-evaluation/beta-release-checklist.md`: checklist beta release.
- `final-evaluation/cross-testing-checklist.md`: checklist cross-testing giữa nhóm.
- `final-evaluation/final-defense-guide.md`: hướng dẫn bảo vệ cuối kỳ.
- `docs/FULL_RBL_FUNCTIONAL_FLOW.md`: tài liệu tiếng Việt mô tả full functional flow và cách kiểm chứng module.

## Chạy Phase 5

### 1. Import Database
Mở DBeaver / MariaDB client, chạy file:
```
database/dbeaver-import-all.sql
```
Database mặc định: `lucy_phase5` (port 3306)

### 2. Cấu hình môi trường
```bash
# Copy từ file mẫu (Linux/Mac)
cp ../local-env.example.ps1 ../local-env.ps1
# Sửa password trong file cho đúng
```

### 3. Chạy Backend Services (mỗi service 1 terminal riêng)

**Terminal 1 — Auth API (.NET)**
```bash
source ../local-env.sh 2>/dev/null || export LUCY_DB_URL="mysql://root@localhost:3306/lucy_phase5"
dotnet run --project ../dotnet-auth
# → http://localhost:5000
```

**Terminal 2 — Wallet API (.NET)**
```bash
source ../local-env.sh 2>/dev/null
dotnet run --project ../dotnet-wallet
# → http://localhost:5040
```

**Terminal 3 — Realtime Audio (Node.js)**
```bash
cd realtime-audio
npm install
npm start
# → http://localhost:3020
```

### 4. Chạy Web App
```bash
cd ../web_app
npm install
npm run dev
# → http://localhost:3000
```

### 5. Test Audio Flow

| Bước | Thao tác | Kết quả |
|---|---|---|
| 1 | Mở http://localhost:3000 → Register → Login | Vào trang Home |
| 2 | Click **Phòng học** → nhập `english-level-1` → **Join Room** | Kết nối Socket.IO + xin quyền mic |
| 3 | Click **🔇 Bật mic / 🎤 Tắt mic** | Bật/tắt mic thật qua WebRTC |
| 4 | Click **⏺ Ghi âm** → nói → **⏹ Dừng** | Recording upload lên server, hiện audio player |
| 5 | Mở tab 2 cùng phòng `english-level-1` với user khác | WebRTC tự kết nối, nghe được nhau |
| 6 | Vào **Podcast** | Xem bản ghi đã auto tạo podcast |

### 6. Chạy stress test (k6)
```bash
k6 run stress-tests/realtime-auth-wallet-stress.js
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

## Cách test Phase 5

Phase 5 dùng để stress test và checklist final evaluation. Script k6 sẽ gọi cả Auth API, Realtime API và Wallet API, nên cần chạy các service liên quan trước.

### 1. Chạy các service cần test

Terminal 1: chạy Auth API từ Phase 1.

```bash
cd /home/amtia/Projects/swd/phase1-rbl/dotnet-auth
dotnet run
```

Auth API mặc định chạy tại:

```text
http://localhost:5000
```

Terminal 2: chạy Realtime API từ Phase 2.

```bash
cd /home/amtia/Projects/swd/phase2-rbl/realtime-audio
npm install
npm start
```

Realtime API mặc định chạy tại:

```text
http://localhost:3020
```

Terminal 3: chạy Wallet API từ Phase 5.

```bash
cd /home/amtia/Projects/swd/phase5-rbl/dotnet-wallet
dotnet restore
dotnet build
dotnet run --urls http://localhost:5040
```

Wallet API sẽ chạy tại:

```text
http://localhost:5040
```

Có thể mở Swagger để test tay trước:

```text
http://localhost:5040/swagger
```

### 2. Kiểm tra từng service trước khi stress test

Terminal 4:

```bash
curl http://localhost:5000/
curl http://localhost:3020/health
curl http://localhost:5040/health
```

Nếu cả 3 lệnh đều trả JSON và không lỗi connection refused thì có thể chạy stress test.

### 3. Chạy k6 stress test

Từ folder Phase 5:

```bash
cd /home/amtia/Projects/swd/phase5-rbl
k6 run stress-tests/realtime-auth-wallet-stress.js
```

Script mặc định dùng:

```text
AUTH_BASE_URL=http://localhost:5000
REALTIME_BASE_URL=http://localhost:3020
WALLET_BASE_URL=http://localhost:5040
```

Nếu service của bạn chạy port khác, truyền env vào lệnh k6:

```bash
AUTH_BASE_URL=http://localhost:5000 \
REALTIME_BASE_URL=http://localhost:3020 \
WALLET_BASE_URL=http://localhost:5040 \
k6 run stress-tests/realtime-auth-wallet-stress.js
```

Kết quả đạt yêu cầu khi các check chính pass:

```text
auth register accepted
agora scaffold token ok
wallet lookup ok
wallet top-up ok
```

Và threshold không fail:

```text
http_req_failed rate<0.05
http_req_duration p(95)<800
```

Nếu chưa cài k6, vẫn có thể dùng file `stress-tests/realtime-auth-wallet-stress.js` làm kịch bản review: nó mô tả luồng cần kiểm tra gồm register auth, lấy Agora token scaffold, lookup wallet và top-up wallet.
### Database connection Phase 5

Phase 5 stress test cần các service đang connect MariaDB:

```text
Auth API:   LUCY_DB -> lucy_phase1
Realtime:  LUCY_DB_URL -> lucy_phase5
Wallet API: LUCY_DB -> lucy_phase5
```

Nếu MariaDB root có password, set connection string tương ứng trước khi chạy từng service.

