# Requirements Modeling - Giai đoạn 1

## 1. Actor và role

| Actor | Mô tả | Quyền chính |
|---|---|---|
| Anonymous User | Người dùng chưa đăng nhập | Xem giới thiệu, đăng ký, đăng nhập, xem một phần nội dung public |
| Pro (Mentor) | Người hướng dẫn/lớp học | Quản lý learner, theo dõi tiến độ, review nội dung học, tham gia phòng học |
| Super (Creator) | Người tạo và quản trị nội dung | Quản trị tài khoản, nhập dữ liệu Word, quản lý levels/sessions/content |

## 2. Functional requirements

### Authentication (.NET)

- Người dùng có thể đăng ký tài khoản bằng email, password, display name.
- Người dùng có thể đăng nhập bằng email/password.
- Hệ thống phân quyền theo role: `Anonymous`, `Pro`, `Super`.
- API trả JWT để client sử dụng cho các request cần xác thực.
- Password phải được hash, không lưu plain text.

### Digitize learning content (Java/Python helper + Database)

- Hệ thống nhận các file học liệu English/Chinese/Japanese, gồm `.docx` và PDF khi source thực tế là PDF.
- Importer trích xuất nội dung theo stage/level/session nếu có thể nhận diện từ heading.
- Dữ liệu được lưu vào database theo cấu trúc language, stage, level, lesson/session, content block.
- Creator có thể dùng dữ liệu đã import để phục vụ LMS ở các giai đoạn sau.

### Requirements modeling

- Use Case Diagram thể hiện 3 actor chính và các use case giai đoạn 1.
- Class Diagram thể hiện user/role/auth/content import/domain model.
- Sequence Diagram mô tả luồng register/login cơ bản.

## 3. Non-functional requirements

- API auth có cấu trúc rõ để tích hợp với mobile/web/client về sau.
- Database schema MySQL/MariaDB tách authentication domain và learning content domain.
- Importer có thể mở rộng cho nhiều ngôn ngữ và nhiều định dạng heading khác nhau.
- Thiết kế ưu tiên dễ review trong hoạt động peer-learning RBL.

## 4. Acceptance criteria

- Có folder giai đoạn 1 riêng, chứa tài liệu, UML, database schema, Java importer skeleton và .NET auth skeleton.
- PlantUML mô tả đủ Anonymous, Pro/Mentor, Super/Creator.
- Database schema có bảng cho users/roles và learning content import.
- .NET auth skeleton có endpoint register/login/me.
- Java importer skeleton đọc được `.docx` bằng Apache POI; helper số hóa Phase 1 đã xuất JSON/SQL từ các source `.docx`/PDF để import DB.
