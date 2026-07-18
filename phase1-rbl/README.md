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
mariadb -u root -p lucy_phase1 < database/schema.sql
mariadb -u root -p lucy_phase1 < database/seed-sample.sql
mariadb -u root -p lucy_phase1 < generated/digitized-content.sql
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



test CLI 

curl -s -X POST http://localhost:5000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"creator@lucy.local","password":"Password123!","displayName":"Creator","role":"SUPER"}'

## Cách test Phase 1

Phase 1 có 2 phần nên test theo thứ tự: database trước, sau đó test .NET Auth API.

### 1. Test database đã import

Đứng trong folder Phase 1:

```bash
cd /home/amtia/Projects/swd/phase1-rbl
```

Nếu chưa import database, chạy:

```bash
mariadb -u root -p lucy_phase1 < database/schema.sql
mariadb -u root -p lucy_phase1 < database/seed-sample.sql
mariadb -u root -p lucy_phase1 < generated/digitized-content.sql
```

Kiểm tra database:

```bash
mariadb -u root -p lucy_phase1
```

Trong MariaDB shell, chạy:

```sql
SHOW TABLES;
SELECT COUNT(*) FROM roles;
SELECT COUNT(*) FROM languages;
```

Nếu có danh sách bảng và các câu `SELECT COUNT(*)` không báo lỗi thì database Phase 1 đã OK. Thoát MariaDB bằng:

```sql
exit;
```

### 2. Test .NET Login/Register API

Mở terminal 1 và chạy API:

```bash
cd /home/amtia/Projects/swd/phase1-rbl/dotnet-auth
dotnet restore
dotnet run
```

Giữ terminal này chạy. API sẽ listen tại:

```text
http://localhost:5000
```

Mở terminal 2, test API còn sống không:

```bash
curl http://localhost:5000/
```

Kết quả đúng sẽ giống:

```json
{"service":"LUCY Phase 1 Auth API","status":"ready"}
```

Đăng ký user:

```bash
curl -s -X POST http://localhost:5000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"creator@lucy.local","password":"Password123!","displayName":"Creator","role":"SUPER"}'
```

Nếu thành công, response sẽ có `accessToken`, `expiresAt`, và `user`. Nếu chạy lại cùng email và thấy `Email already registered` thì nghĩa là user đã được lưu trong MariaDB; đổi email khác hoặc xóa user trong database nếu muốn test lại cùng email.

Đăng nhập:

```bash
curl -s -X POST http://localhost:5000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"creator@lucy.local","password":"Password123!"}'
```

Copy giá trị `accessToken` nhận được, lưu vào biến:

```bash
TOKEN='paste_accessToken_vao_day'
```

Test endpoint `/auth/me`:

```bash
curl -s http://localhost:5000/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

Kết quả đúng sẽ có `email` là `creator@lucy.local` và `role` là `SUPER`.

Ghi chú: Phase 1 chưa có Swagger/web UI, nên test bằng `curl`, Postman, Insomnia hoặc Thunder Client.
### Database connection Phase 1

.NET Auth API hiện connect MariaDB qua biến môi trường `LUCY_DB`. Nếu không set, app dùng mặc định:

```text
Server=localhost;Database=lucy_phase1;User=root;Password=;AllowUserVariables=True;
```

Nếu MariaDB root có password, chạy API như sau:

```bash
LUCY_DB='Server=localhost;Database=lucy_phase1;User=root;Password=your_password;AllowUserVariables=True;' dotnet run
```

