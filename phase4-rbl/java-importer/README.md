# Java Word Content Importer

Skeleton cho quest **số hóa tài liệu Word English/Chinese/Japanese vào MySQL/MariaDB**.

## Trách nhiệm giai đoạn 1

- Đọc file `.docx` bằng Apache POI.
- Trích xuất paragraph không rỗng.
- Chuẩn bị mapping sang schema `languages -> stages -> levels -> lessons -> content_blocks`.
- Chưa tự động đoán toàn bộ heading phức tạp; phần này cần review bằng sample Word thật của từng ngôn ngữ.

## Chạy thử

```bash
mvn test
mvn exec:java -Dexec.mainClass=com.lucy.importer.WordContentImporter -Dexec.args="../../Eng - STAGE 1 (LEVELS 1-30).docx"
```

## Bước mở rộng tiếp theo

1. Thêm cấu hình MySQL/MariaDB connection.
2. Nhận diện language từ tên file hoặc tham số CLI.
3. Nhận diện stage/level/lesson bằng rule theo từng bộ Word.
4. Insert batch vào `source_documents`, `word_import_jobs`, `levels`, `lessons`, `content_blocks`.
