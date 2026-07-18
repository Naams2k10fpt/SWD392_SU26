# Infrastructure Plan - Giai đoạn 1

## Mục tiêu

Thiết lập nền tảng tối thiểu để các nhóm có thể bắt đầu research, modeling, import dữ liệu học liệu và phát triển auth API.

## Thành phần

| Thành phần | Công nghệ đề xuất | Trách nhiệm |
|---|---|---|
| Auth API | ASP.NET Core Minimal API | Register, login, JWT, role claims |
| Content Importer | Java 17 + Apache POI | Đọc file Word, chuẩn hóa text, chuẩn bị lưu DB |
| Database | MySQL hoặc MariaDB | Lưu user, role, language, stage, level, lesson, content block |
| Modeling | PlantUML | Use Case, Class, Sequence diagram |

## Suggested workflow

1. Super/Creator chuẩn bị danh sách file Word nguồn.
2. Java importer đọc từng file, xác định language/stage/level.
3. Importer lưu hoặc xuất dữ liệu thành batch để insert vào database.
4. .NET Auth API quản lý login/register và cấp JWT.
5. Các nhóm dùng UML để pitching, peer review kiến trúc và role model.

## Rủi ro cần review chéo

- Cách nhận diện level/session từ file Word có thể khác nhau giữa English/Chinese/Japanese.
- Auth API và hệ thống real-time ở giai đoạn sau cần thống nhất user id/role claim.
- Role `Pro` và `Super` cần phân tách rõ quyền mentor vs creator để tránh over-permission.
