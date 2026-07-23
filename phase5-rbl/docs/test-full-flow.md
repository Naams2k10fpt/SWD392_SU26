# Test plan hiện hành — LUCY Phase 5

Tài liệu này kiểm tra bản chạy mới nhất trong `phase5-rbl` và `web_app`. Các
tài liệu Phase 1–4 giữ nguyên để mô tả trạng thái của từng giai đoạn.

## 1. Chuẩn bị

Yêu cầu: MariaDB/MySQL, .NET 10, Node.js 22+, Java 17+ và Maven.

```powershell
Copy-Item local-env.example.ps1 local-env.ps1
notepad local-env.ps1
. .\local-env.ps1
```

Import `phase5-rbl/database/dbeaver-import-all.sql`. Kỳ vọng database
`lucy_phase5` có 24 bảng.

Chạy mỗi service trong một terminal:

```powershell
dotnet run --project phase5-rbl\dotnet-auth
dotnet run --project phase5-rbl\dotnet-wallet
Set-Location phase5-rbl\realtime-audio; npm install; npm start
Set-Location web_app; npm install; npm run dev
```

| Service | URL |
|---|---|
| Auth | `http://localhost:5000` |
| Wallet | `http://localhost:5041` |
| Realtime | `http://localhost:3020` |
| Web | `http://localhost:3000` |

## 2. Kiểm tra tự động

```powershell
dotnet build phase5-rbl\dotnet-auth
dotnet build phase5-rbl\dotnet-wallet
npm --prefix phase5-rbl\realtime-audio test
npm --prefix web_app test
```

Kiểm tra health:

```powershell
curl.exe http://localhost:5000/
curl.exe http://localhost:5041/health
curl.exe http://localhost:3020/health
```

## 3. Auth

1. Đăng ký lần lượt tài khoản `ANONYMOUS`, `PRO` và `SUPER`.
2. Đăng nhập đúng trả JWT và user; sai password trả `401`.
3. `GET /auth/me` không có Bearer token trả `401`; token đúng trả user hiện tại.
4. Đăng ký email trùng trả `409`.

## 4. Phòng học

1. Tạo phòng công khai và phòng có password 4–100 ký tự.
2. Danh sách phòng chỉ trả `hasPassword`, không lộ hash.
3. Phòng khóa phải hiện modal; password sai không được tạo participant.
4. Join hai tab và kiểm tra `room:state`, giơ tay, mic, speaking indicator và ping.
5. Chuyển tab không rời phòng. F5 tự join lại tối đa 3 lần; có nút thử lại ngay.
6. Chỉ thao tác thoát đã xác nhận mới xóa trạng thái phòng đã lưu.

## 5. Chat và tài liệu

1. Tin nhắn rỗng hoặc quá 500 ký tự bị từ chối.
2. Khung chat tự cuộn và không làm dài toàn trang; client giữ tối đa 200 tin.
3. PRO/SUPER upload PDF, Word, Excel, PowerPoint hoặc TXT tối đa 20 MB.
4. ANONYMOUS bị từ chối upload.
5. Tài liệu xuất hiện trong panel riêng bên phải, không nằm trong chat; panel mặc
   định thu nhỏ và có thể đóng/mở.

## 6. Ghi âm và podcast

1. Nút ghi âm chỉ hiện cho PRO/SUPER.
2. Khi ghi, UI hiển thị thời gian; dừng ghi tạo audio và podcast.
3. Upload WebM, M4A, WAV, MP3 hoặc OGG tối đa 50 MB.
4. PRO/SUPER lọc, tạo, đổi tên, thay audio và xóa podcast.
5. ANONYMOUS gọi endpoint quản lý phải nhận `403`.

## 7. Ví và Super Chat

1. Nạp số tiền dương cập nhật balance; số âm trả `400`.
2. ANONYMOUS chỉ chọn PRO/SUPER đang ở cùng phòng để gửi Super Chat.
3. Gift hợp lệ trả `201`; thiếu token trả `401`; sai vai trò hoặc sender trả `403`.
4. Sau commit, client emit `gift:announce`; room nhận `gift:announced`.
5. `GET /gifts` thiếu token trả `401`.
6. Đăng nhập hai user khác nhau: mỗi user chỉ thấy giao dịch mình gửi hoặc nhận,
   và UI hiển thị display name thay cho UUID khi có thông tin.

## 8. Database

```sql
USE lucy_phase5;
SHOW TABLES;
SELECT COUNT(*) FROM room_messages;
SELECT COUNT(*) FROM recording_logs;
SELECT COUNT(*) FROM gift_transactions;
SELECT COUNT(*) FROM podcast_recordings;
```

Kỳ vọng có 24 bảng; số bản ghi tăng tương ứng sau các bước chat, ghi âm, gift và
podcast.

## 9. Stress test

```powershell
Set-Location phase5-rbl
k6 run stress-tests/realtime-auth-wallet-stress.js
```

Mặc định script dùng Auth `5000`, Realtime `3020` và Wallet `5041`. Có thể đổi
bằng `AUTH_BASE_URL`, `REALTIME_BASE_URL`, `WALLET_BASE_URL`.
