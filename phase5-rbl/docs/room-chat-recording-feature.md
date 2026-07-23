# Phòng học: chat, tài liệu, ghi âm và Super Chat

Tài liệu này mô tả implementation hiện tại trong `phase5-rbl/realtime-audio` và
`web_app`.

## 1. Vòng đời phòng

- Người tạo có thể chọn phòng công khai hoặc đặt mật khẩu 4-100 ký tự.
- Server lưu password dạng hash `scrypt`; API chỉ trả `hasPassword`.
- Join phòng khóa phải gửi password qua `room:join`. Thiếu hoặc sai password đều
  bị từ chối trước khi tạo participant.
- Client lưu mã phòng đang tham gia trong `localStorage`; F5 và Socket.IO reconnect
  sẽ tự join lại, tối đa 3 lần với delay 1/2/4 giây.
- Phòng có password sẽ mở modal nhập lại sau F5. Modal giữ nguyên khi password sai
  và hiển thị lỗi tại chỗ.
- Chỉ nút “Thoát phòng” hoặc “Danh sách phòng” đã xác nhận mới xóa phòng đang lưu.

## 2. Chat

```text
Client chat:send { roomId, message }
  -> server xác định user từ socket đã join
  -> INSERT room_messages
  -> broadcast chat:message
```

- Tin nhắn dài 1-500 ký tự.
- Client chỉ giữ 200 tin gần nhất và khung chat cuộn nội bộ, không kéo dài trang.
- Lịch sử: `GET /rooms/:roomCode/messages?limit=50&before=ISO`.
- Tài liệu không xuất hiện trong luồng chat.

## 3. Tài liệu phòng

- PRO và SUPER có thể gửi PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX hoặc TXT, tối đa 20 MB.
- Upload: `POST /api/rooms/:roomCode/documents` với Bearer token và multipart field
  `document`.
- Danh sách: `GET /rooms/:roomCode/documents`, tối đa 100 file mới nhất.
- Khu vực tài liệu nằm bên phải chat, mặc định thu nhỏ và có nút đóng/mở.
- File lưu local trong `realtime-audio/documents/`; production nên chuyển sang
  object storage.

## 4. Ghi âm và podcast

- Chỉ PRO/SUPER thấy và sử dụng nút ghi.
- UI hiển thị thời gian ghi âm đang chạy.
- `recording:start`/`recording:stop` xác thực role qua Auth API.
- Audio hoàn tất được upload bằng `POST /api/upload-recording` và tạo podcast.
- PRO/SUPER có thể tạo, xem, sửa tên/thay audio và xóa podcast.
- Audio hỗ trợ WebM, M4A, WAV, MP3, OGG; tối đa 50 MB.

## 5. Voice và Super Chat

- Web Audio `AnalyserNode` phát hiện người đang nói và làm nổi avatar tương tự
  Google Meet.
- Learner có thể gửi Super Chat cho PRO/SUPER đang ở cùng phòng.
- Wallet API commit giao dịch trước; client sau đó emit `gift:announce` để realtime
  broadcast `gift:announced`.
- Khi chưa có người nhận phù hợp, nút Super Chat vẫn hiển thị nhưng danh sách nhận
  quà rỗng.

## 6. Database và file liên quan

| Thành phần | Nơi triển khai |
|---|---|
| Room, participant, password | `database/phase2-realtime.sql` |
| Chat và recording log | `database/phase5-realtime-chat-record.sql` |
| Realtime API/Socket.IO | `realtime-audio/src/server.js` |
| Room UI | `web_app/app/page.tsx` |
| Room styles | `web_app/app/globals.css` |

Kiểm tra:

```powershell
cd phase5-rbl/realtime-audio
npm test
cd ../../web_app
npm test
```
