# Peer Pitching Guide

## Mục tiêu buổi pitching

Mỗi nhóm trình bày mô hình yêu cầu và nhận phản biện từ nhóm khác theo tinh thần RBL/42.

## Checklist trình bày

- Giải thích được 3 actor: Anonymous User, Pro/Mentor, Super/Creator.
- Chỉ ra use case nào thuộc giai đoạn 1, use case nào để dành giai đoạn sau.
- Giải thích quan hệ giữa Auth API .NET và content database/importer Java.
- Giải thích cách dữ liệu Word được chuẩn hóa thành language/stage/level/lesson/content block.

## Câu hỏi phản biện gợi ý

1. Vì sao `Pro` không được import/xóa học liệu như `Super`?
2. JWT cần chứa những claim nào để Node.js realtime hoặc mobile app dùng lại về sau?
3. Nếu heading trong file Word không thống nhất thì importer xử lý thế nào?
4. Database có đủ để truy vấn theo ngôn ngữ, stage, level và lesson không?
5. Class diagram có đang trộn trách nhiệm auth và learning content quá nhiều không?
