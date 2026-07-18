# RBL SWD392 - Giai đoạn 3

Nguồn chính: `../RBL_SWD392.docx`, phần ACTION PLAN RBL SWD392.

## Phạm vi lũy kế

Folder này kế thừa Phase 1 + Phase 2 và bổ sung Phase 3: Design Patterns & LMS.

## Bổ sung Phase 3

- `java-lms/`: Maven module cho Pro/Mentor LMS.
- Pin material, learner dashboard summary, automatic sub-level transition sau 10 phút.
- State pattern được dùng cho Stage/Sub-level logic thay vì IF-ELSE dài.

## Chạy Phase 3

```bash
cd java-lms
mvn compile
mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication
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

## Cách test Phase 3

Phase 3 bổ sung module Java LMS để demo Mentor dashboard, pin material, learner progress và State pattern cho chuyển sub-level.

### 1. Compile module Java LMS

```bash
cd /home/amtia/Projects/swd/phase3-rbl/java-lms
mvn compile
```

Nếu build thành công và không có `BUILD FAILURE` thì phần compile OK.

### 2. Chạy demo LMS

```bash
mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication
```

Kết quả đúng sẽ in ra report dạng:

```text
Mentor dashboard: mentor-pro-1
Pinned materials: 2
- English Stage 1 Speaking Drill [EN]
- Japanese Stage 1 Listening [JA]
Learners: 2
- Anonymous Level 1 level 1 -> GUIDED_PRACTICE
- Pro Trial Level 4 level 4 -> GUIDED_PRACTICE
```

Ý nghĩa kết quả:

- `Pinned materials: 2` chứng minh Mentor đã pin được tài liệu học.
- `Anonymous Level 1 ... -> GUIDED_PRACTICE` chứng minh learner ở `WARM_UP` quá 10 phút đã được chuyển sub-level bằng State pattern.
- `Pro Trial Level 4 ... -> GUIDED_PRACTICE` vẫn giữ nguyên vì mới ở sub-level hiện tại khoảng 3 phút.

### 3. Test database lũy kế nếu cần

Phase 3 kế thừa Phase 1 và Phase 2. Nếu muốn kiểm tra database lũy kế, import các file SQL tương ứng của phase rồi kiểm tra bảng liên quan đến LMS/progress theo tài liệu trong `database/`.

Module Java LMS hiện đọc/ghi MariaDB. Test chính là `mvn compile`, output của `LmsApplication`, và kiểm tra bảng `learner_progress`, `lms_transition_events`.
### Database connection Phase 3

Java LMS hiện đọc/ghi MariaDB qua JDBC. Mặc định:

```text
LUCY_JDBC_URL=jdbc:mysql://localhost:3306/lucy_phase3
LUCY_DB_USER=root
LUCY_DB_PASSWORD=
```

Nếu root có password, chạy:

```bash
LUCY_JDBC_URL='jdbc:mysql://localhost:3306/lucy_phase3' \
LUCY_DB_USER='root' \
LUCY_DB_PASSWORD='your_password' \
mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication
```

