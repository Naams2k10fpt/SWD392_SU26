# RBL SWD392 - Giai đoạn 4

Nguồn chính: `../RBL_SWD392.docx`, phần ACTION PLAN RBL SWD392.

## Phạm vi lũy kế

Folder này kế thừa Phase 1 + Phase 2 + Phase 3 và bổ sung Phase 4: SOA/Microservices & Monetization.

## Bổ sung Phase 4

- `dotnet-wallet/`: ASP.NET Core Swagger-ready wallet API.
- Wallet balance, top-up scaffold, real-time gift transaction concept.
- Podcast recording metadata endpoint cho Super/Creator.

## Chạy Phase 4

```bash
cd dotnet-wallet
dotnet restore
dotnet build
dotnet run
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

## Cách test Phase 4

Phase 4 bổ sung .NET Wallet API có Swagger. Có thể test bằng web Swagger hoặc bằng `curl`.

### 1. Chạy Wallet API

Mở terminal 1:

```bash
cd /home/amtia/Projects/swd/phase4-rbl/dotnet-wallet
dotnet restore
dotnet build
dotnet run
```

Xem terminal để biết port thật, ví dụ `http://localhost:5040` hoặc `http://localhost:5000`.

### 2. Test bằng Swagger trên web

Mở trình duyệt:

```text
http://localhost:5040/swagger
```

Nếu terminal hiển thị port khác, thay `5040` bằng port đó. Trong Swagger, test lần lượt:

1. `GET /health`
2. `GET /wallets/{userId}` với `userId = pro-mentor-1`
3. `POST /wallets/{userId}/top-up`
4. `POST /gifts`
5. `GET /gifts`
6. `POST /podcasts/recordings`
7. `GET /podcasts/recordings`

### 3. Test nhanh bằng curl

Nếu API đang chạy ở `http://localhost:5040`, test health:

```bash
curl http://localhost:5040/health
```

Xem ví tiền:

```bash
curl http://localhost:5040/wallets/pro-mentor-1
```

Top-up ví:

```bash
curl -s -X POST http://localhost:5040/wallets/pro-mentor-1/top-up \
  -H 'Content-Type: application/json' \
  -d '{"amount":50000,"providerReference":"demo-topup-001"}'
```

Gửi gift từ Pro/Mentor sang Super/Creator:

```bash
curl -s -X POST http://localhost:5040/gifts \
  -H 'Content-Type: application/json' \
  -d '{"fromUserId":"pro-mentor-1","toCreatorId":"super-creator-1","roomId":"level-1","amount":10000,"message":"Great session"}'
```

Xem danh sách gifts:

```bash
curl http://localhost:5040/gifts
```

Tạo metadata podcast recording:

```bash
curl -s -X POST http://localhost:5040/podcasts/recordings \
  -H 'Content-Type: application/json' \
  -d '{"creatorId":"super-creator-1","roomId":"level-1","title":"Demo Podcast","storageUri":"s3://demo/podcast.mp3","durationSeconds":600}'
```

Xem danh sách podcast recordings:

```bash
curl http://localhost:5040/podcasts/recordings
```

Nếu các response trả JSON và không báo lỗi 4xx/5xx thì Phase 4 API đã chạy đúng. Dữ liệu wallet/gift/podcast hiện được lưu trong MariaDB, nên restart API vẫn còn dữ liệu.
### Database connection Phase 4

Wallet API hiện lưu dữ liệu vào MariaDB qua biến `LUCY_DB`. Nếu không set, app dùng mặc định:

```text
Server=localhost;Database=lucy_phase4;User=root;Password=;AllowUserVariables=True;
```

Nếu root có password, chạy:

```bash
LUCY_DB='Server=localhost;Database=lucy_phase4;User=root;Password=your_password;AllowUserVariables=True;' dotnet run
```

