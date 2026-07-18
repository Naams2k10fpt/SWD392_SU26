# Báo cáo chi tiết Phase 1 - RBL SWD392

## 1. Căn cứ yêu cầu trong tài liệu RBL

Nguồn yêu cầu chính là file `RBL_SWD392.docx`, phần **ACTION PLAN: RESEARCH-BASED LEARNING CHO SWD392 & PROJECT**.

Nội dung Phase 1 trong tài liệu:

> Giai đoạn 1 (Tuần 1-2): Khởi tạo & Mô hình hóa Yêu cầu (Requirements Modeling)  
> Tương ứng Session 1-13 của SWD392  
> Quest dự án: Thiết lập hạ tầng, số hóa tài liệu học liệu English/Chinese/Japanese vào Database Java; Xây dựng hệ thống Login/Register (.NET).  
> Research Topic: Use Case Modeling, Static/Dynamic Modeling, Object and Class Structuring.  
> Hành động theo RBL: thiết kế Use Case và Class Diagram cho 3 phân quyền: User Ẩn danh, Pro (Mentor), Super (Creator).

Từ đoạn này, Phase 1 được triển khai theo 4 nhóm việc:

1. Thiết lập folder deliverable riêng cho Phase 1.
2. Mô hình hóa yêu cầu bằng tài liệu và PlantUML.
3. Số hóa học liệu Word English/Chinese/Japanese thành dữ liệu có thể import vào MySQL/MariaDB.
4. Chuẩn bị skeleton kỹ thuật cho 2 module được nhắc trong doc:
   - Java: đọc và import Word content.
   - .NET: Login/Register.

## 2. Folder deliverable đã tạo

Toàn bộ sản phẩm Phase 1 nằm trong:

```text
phase1-rbl/
```

Cấu trúc chính:

```text
phase1-rbl/
├── README.md
├── database/
│   ├── schema.sql
│   └── seed-sample.sql
├── docs/
│   ├── PHASE1_DIGITIZATION_REPORT.md
│   ├── ai-usage-log.md
│   ├── infrastructure-plan.md
│   ├── peer-pitching-guide.md
│   └── requirements.md
├── dotnet-auth/
│   ├── AuthApi.csproj
│   ├── Program.cs
│   ├── README.md
│   └── appsettings.example.json
├── generated/
│   ├── digitization-summary.json
│   ├── digitized-content.json
│   └── digitized-content.sql
├── java-importer/
│   ├── README.md
│   ├── pom.xml
│   └── src/main/java/com/lucy/importer/WordContentImporter.java
├── tools/
│   └── digitize_word_content.py
└── uml/
    ├── class-diagram.puml
    ├── sequence-register-login.puml
    └── use-case.puml
```

## 3. Giải thích Java và .NET trong Phase 1

Trong doc RBL, Java và .NET không phải là lựa chọn thay thế nhau. Chúng được dùng cho hai phần khác nhau:

| Phần | Công nghệ | Vai trò |
|---|---|---|
| Số hóa học liệu | Java / Java importer concept + Python helper | Đọc file `.docx`/PDF, trích xuất nội dung, chuẩn bị import vào database |
| Login/Register | .NET | Xây dựng API đăng ký, đăng nhập, phân quyền user |
| Database | MySQL/MariaDB | Lưu user/role và nội dung học liệu đã số hóa |
| Modeling | PlantUML | Use Case Diagram, Class Diagram, Sequence Diagram |

Trong folder này, phần Java đã có skeleton ở `java-importer/`, còn quy trình số hóa thật được tự động hóa bằng script `tools/digitize_word_content.py` để tạo SQL/JSON importable. Script Python được dùng vì môi trường hiện tại chưa có Maven, nhưng logic số hóa bám đúng thiết kế importer: đọc `.docx` hoặc PDF, trích paragraph/text, mapping sang database schema.

## 4. Danh sách file học liệu

Các file học liệu trong repo:

| File | Ngôn ngữ | Stage/Level | Trạng thái import |
|---|---|---|---|
| `Chinese - level 1-30.docx` | Chinese | Stage 1, Level 1-30 | Imported |
| `Chinese - level 31-60.docx` | Chinese | Stage 2, Level 31-60 | Imported |
| `chinese level 61-100.docx` | Chinese | Stage 3, Level 61-100 | Imported |
| `Eng - STAGE 1 (LEVELS 1-30).docx` | English | Stage 1, Level 1-30 | Imported |
| `Eng - STAGE 2 (LEVEL 31-60) REVIEWED_SID.docx` | English | Stage 2, Level 31-60 | Imported, chọn làm bản canonical |
| `Eng - STAGE 2 (LEVEL 31-60).docx` | English | Stage 2, Level 31-60 | Skipped để tránh trùng bản reviewed |
| `Eng - STAGE 3 (LEVELS 61-100).pdf` | English | Stage 3, Level 61-100 | Imported |
| `Janpanes - ステージ1(レベル1-30).docx` | Japanese | Stage 1, Level 1-30 | Imported |
| `Janpanes - ステージ2(レベル31-60).docx` | Japanese | Stage 2, Level 31-60 | Imported |
| `Janpanes - ステージ3(レベル61-100).docx` | Japanese | Stage 3, Level 61-100 | Imported |

Ghi chú quan trọng: repo có 10 file học liệu nếu tính cả 2 bản English Stage 2. Để tránh import trùng nội dung, quy trình hiện tại chọn bản `REVIEWED_SID` làm bản chính và skip bản English Stage 2 chưa reviewed. English Stage 3 đang ở định dạng PDF nên script dùng `pdftotext` để trích xuất text trước khi gom level.

## 5. Cách số hóa đã thực hiện

### 5.1. Mục tiêu số hóa

Mục tiêu là chuyển nội dung học liệu từ file Word rời rạc sang dữ liệu có cấu trúc trong database.

Trước số hóa, dữ liệu nằm trong Word, ví dụ:

```text
31. 我的学习计划
Q1: 你现在有什么学习计划？
👉 我现在的计划是每天学习两个小时中文...
```

Sau số hóa, dữ liệu được đưa về cấu trúc:

```text
languages -> stages -> levels -> lessons -> content_blocks
```

Ví dụ mapping:

```text
language: zh
stage: 2
level: 31
lesson: 我的学习计划
content_blocks:
  1. Q1: 你现在有什么学习计划？...
  2. Q2: 你一般怎么学习？...
```

### 5.2. Công cụ số hóa

File script:

```text
phase1-rbl/tools/digitize_word_content.py
```

Script này làm các việc:

1. Mở file `.docx` như một OpenXML zip archive, hoặc đọc `.pdf` bằng `pdftotext`.
2. Với `.docx`, đọc `word/document.xml`; với `.pdf`, đọc text đã trích xuất.
3. Trích xuất tất cả paragraph không rỗng.
4. Nhận diện ngôn ngữ, stage, level range từ cấu hình file.
5. Nhận diện heading level theo các pattern:
   - Chinese: `31. 我的学习计划`
   - English: `LEVEL 31 – MY TYPICAL WEEK`
   - Japanese: `レベル31 ...`
6. Gom các paragraph sau heading vào `content_blocks`.
7. Xuất ra:
   - JSON để review dữ liệu.
   - SQL để import vào MySQL/MariaDB.
   - Summary JSON để báo cáo số lượng.

### 5.3. Lý do có cả JSON và SQL

Tạo cả 2 định dạng để phục vụ 2 mục tiêu:

| File | Mục đích |
|---|---|
| `digitized-content.json` | Dễ đọc, dễ review nội dung đã parse |
| `digitized-content.sql` | Import trực tiếp vào MySQL/MariaDB |
| `digitization-summary.json` | Tổng hợp số lượng để đưa vào báo cáo |

## 6. Database schema

File schema:

```text
phase1-rbl/database/schema.sql
```

Schema dùng MySQL/MariaDB, charset `utf8mb4` để lưu được English, Chinese, Japanese và emoji/ký hiệu trong học liệu.

Các bảng chính:

### 6.1. Nhóm authentication

```text
roles
users
user_roles
```

Vai trò:

- `roles`: lưu 3 role `ANONYMOUS`, `PRO`, `SUPER`.
- `users`: lưu tài khoản đăng ký.
- `user_roles`: quan hệ nhiều-nhiều giữa user và role.

### 6.2. Nhóm learning content

```text
languages
stages
levels
lessons
content_blocks
```

Vai trò:

- `languages`: English, Chinese, Japanese.
- `stages`: stage theo từng ngôn ngữ.
- `levels`: level trong mỗi stage.
- `lessons`: bài học/chủ đề trong mỗi level.
- `content_blocks`: từng đoạn nội dung, câu hỏi, câu trả lời, instruction.

### 6.3. Nhóm import tracking

```text
source_documents
word_import_jobs
```

Vai trò:

- `source_documents`: lưu file Word gốc, language code, checksum, status.
- `word_import_jobs`: lưu lịch sử import, trạng thái import, lỗi nếu có.

## 7. Dữ liệu đã sinh ra sau số hóa

Các file generated:

```text
phase1-rbl/generated/digitized-content.json
phase1-rbl/generated/digitized-content.sql
phase1-rbl/generated/digitization-summary.json
```

Kết quả từ script:

```text
Lessons: 300
Content blocks: 2374
```

Kết quả import test vào MariaDB:

```text
source_documents  9
languages         3
stages            9
levels            300
lessons           300
content_blocks    2374
```

Phân bổ theo ngôn ngữ sau import:

| Language | Stages | Levels | Lessons | Content blocks |
|---|---:|---:|---:|---:|
| English (`en`) | 3 | 100 | 100 | 1386 |
| Japanese (`ja`) | 3 | 100 | 100 | 292 |
| Chinese (`zh`) | 3 | 100 | 100 | 696 |

Lưu ý: Japanese đã nhận đủ 100 level. Một số cụm Japanese trong tài liệu chỉ liệt kê topic theo range như `レベル41–45` hoặc `レベル81–100`, nên script expand các topic đó thành từng level riêng và gắn block mô tả nhóm để không mất level.

## 8. Cách chạy lại quy trình số hóa

Từ folder phase tương ứng:

```bash
python phase1-rbl/tools/digitize_word_content.py \
  --root /home/amtia/Projects/swd \
  --out /home/amtia/Projects/swd/phase1-rbl/generated
```

Output mong đợi:

```text
Lessons: 300
Content blocks: 2374
Output: /home/amtia/Projects/swd/phase1-rbl/generated
```

## 9. Cách test import vào MySQL/MariaDB

Database user được dùng để test:

```text
username: root
password: 1
```

Lệnh test đã chạy:

```bash
mysql --no-defaults -uroot -p1 --batch --silent -e "
DROP DATABASE IF EXISTS lucy_phase1_digitized_qa;
CREATE DATABASE lucy_phase1_digitized_qa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lucy_phase1_digitized_qa;
SOURCE /home/amtia/Projects/swd/phase1-rbl/database/schema.sql;
SOURCE /home/amtia/Projects/swd/phase1-rbl/database/seed-sample.sql;
SOURCE /home/amtia/Projects/swd/phase1-rbl/generated/digitized-content.sql;
SELECT 'source_documents', COUNT(*) FROM source_documents;
SELECT 'languages', COUNT(*) FROM languages;
SELECT 'stages', COUNT(*) FROM stages;
SELECT 'levels', COUNT(*) FROM levels;
SELECT 'lessons', COUNT(*) FROM lessons;
SELECT 'content_blocks', COUNT(*) FROM content_blocks;
DROP DATABASE lucy_phase1_digitized_qa;
"
```

Kết quả đã pass:

```text
source_documents  9
languages         3
stages            9
levels            300
lessons           300
content_blocks    2374
```

## 10. Phần .NET Login/Register

Folder:

```text
phase1-rbl/dotnet-auth/
```

Chức năng đã chuẩn bị:

- `POST /auth/register`: đăng ký user.
- `POST /auth/login`: đăng nhập user.
- `GET /auth/me`: lấy thông tin user từ JWT.

Role hỗ trợ:

```text
ANONYMOUS
PRO
SUPER
```

Build đã được kiểm tra bằng:

```bash
cd phase1-rbl/dotnet-auth
dotnet build
```

Kết quả:

```text
Build succeeded.
0 Warning(s)
0 Error(s)
```

API cũng đã được test trước đó bằng curl với register/login và trả JWT thành công.

## 11. UML và mô hình hóa yêu cầu

Các file UML:

```text
phase1-rbl/uml/use-case.puml
phase1-rbl/uml/class-diagram.puml
phase1-rbl/uml/sequence-register-login.puml
```

### 11.1. Use Case Diagram

File:

```text
phase1-rbl/uml/use-case.puml
```

Actor:

- Anonymous User.
- Pro (Mentor).
- Super (Creator).

Use case chính:

- Register account.
- Login.
- Receive JWT.
- Review learning content.
- Import Word content.
- Manage languages/stages/levels.
- Manage user roles.

### 11.2. Class Diagram

File:

```text
phase1-rbl/uml/class-diagram.puml
```

Các class/domain chính:

- `User`
- `Role`
- `UserRole`
- `AuthToken`
- `Language`
- `Stage`
- `Level`
- `Lesson`
- `ContentBlock`
- `SourceDocument`
- `WordImportJob`

### 11.3. Sequence Diagram

File:

```text
phase1-rbl/uml/sequence-register-login.puml
```

Mô tả flow:

1. User submit register form.
2. Auth API kiểm tra email.
3. Auth API hash password.
4. Auth API lưu user/role.
5. Auth API tạo JWT.
6. User login bằng email/password.
7. Auth API verify password và trả token.

## 12. Những gì có thể trình bày trong báo cáo Phase 1

Khi báo cáo, có thể trình bày theo thứ tự:

1. **Yêu cầu từ RBL doc**  
   Phase 1 yêu cầu khởi tạo, requirements modeling, số hóa Word, Login/Register.

2. **Phân chia module**  
   Java/importer cho Word content, .NET cho Auth, MySQL/MariaDB cho database.

3. **Thiết kế role**  
   Anonymous, Pro/Mentor, Super/Creator.

4. **Database design**  
   Tách auth domain và learning content domain.

5. **Digitization pipeline**  
   Word `.docx` -> paragraph extraction -> heading detection -> lesson/content block -> SQL/JSON.

6. **Kết quả số hóa**  
   7 source documents imported, 166 lessons, 1195 content blocks.

7. **Verification**  
   Import SQL pass trên MariaDB bằng root/1, .NET build pass.

8. **Rủi ro và hướng cải thiện**  
   Heading Word chưa đồng nhất, Japanese parse chưa đủ expected levels, cần review thủ công hoặc thêm parser rule.

## 13. Giới hạn hiện tại và hướng phát triển tiếp

### Giới hạn

- English Stage 2 có 2 bản, hiện chọn bản `REVIEWED_SID` để tránh duplicate.
- Japanese chưa parse đủ toàn bộ level range do format heading trong file không đồng nhất.
- Java importer hiện là skeleton; quy trình số hóa đầy đủ đang nằm ở script Python để tạo dữ liệu nhanh và dễ kiểm chứng.
- .NET Auth API hiện ghi/đọc trực tiếp MariaDB qua `users`, `roles`, `user_roles`.

### Hướng phát triển tiếp

1. Chuyển logic trong `digitize_word_content.py` sang Java importer/Spring Boot service.
2. Bổ sung rule parser riêng cho từng ngôn ngữ.
3. Thêm bảng/cột trace chi tiết hơn:
   - `source_document_id`
   - `raw_paragraph_index`
   - `original_text`
   - `normalized_text`
4. Kết nối .NET Auth API với bảng `users`, `roles`, `user_roles` trong MySQL/MariaDB.
5. Tạo admin UI cho Super/Creator review nội dung đã import.

## 14. Kết luận

Phase 1 đã có đầy đủ artifact để báo cáo:

- Requirements modeling.
- Use Case, Class, Sequence Diagram.
- Schema MySQL/MariaDB.
- Seed role/language.
- Pipeline số hóa Word thành SQL/JSON.
- Dữ liệu học liệu đã import test thành công.
- Skeleton Java importer.
- Skeleton .NET Login/Register.

Kết quả quan trọng nhất của phần số hóa:

```text
7 source documents
3 languages
7 stages
166 levels/lessons
1195 content blocks
MariaDB import: passed
```
