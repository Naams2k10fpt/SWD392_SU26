# Realtime Audio Service

Node.js 22, Express, Socket.IO và MariaDB cho phòng học audio của LUCY.

## Chạy local

```powershell
npm install
npm test
npm start
```

Service mặc định chạy tại `http://localhost:3020`. Cấu hình database bằng
`LUCY_DB_URL`, ví dụ `mysql://root:password@localhost:3306/lucy_phase5`.

Khi thay đổi code server, cần restart service. Web dev server tự cập nhật qua HMR.

## REST API

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/health` | Trạng thái service |
| `GET` | `/rooms?language=en&level=1` | Danh sách phòng đang có người; trả `hasPassword`, không trả hash |
| `POST` | `/rooms` | Tạo phòng, nhận `roomCode`, `title`, `languageCode`, `levelNumber`, `password?` |
| `GET` | `/rooms/levels` | Nhóm phòng đang mở theo ngôn ngữ và level |
| `GET` | `/rooms/:roomCode/messages?limit=50&before=ISO` | Lịch sử chat, tối đa 200 tin |
| `GET` | `/rooms/:roomCode/documents` | Tối đa 100 tài liệu mới nhất |
| `POST` | `/api/rooms/:roomCode/documents` | PRO/SUPER gửi PDF, Word, Excel, PowerPoint hoặc TXT, tối đa 20 MB |
| `GET` | `/rooms/:roomCode/recordings` | Danh sách bản ghi của phòng |
| `POST` | `/api/upload-recording` | PRO/SUPER tải audio lên và tạo podcast, tối đa 50 MB |
| `POST` | `/agora/token` | Agora token scaffold |

Mật khẩu phòng là tùy chọn, dài 4-100 ký tự và được hash bằng `scrypt`. Service tự
thêm cột `realtime_rooms.password_hash` cho database cũ.

## Socket.IO

Client gửi:

| Event | Payload chính | Ghi chú |
|---|---|---|
| `room:join` | `{roomId, userId, displayName, role, password?}` | Sai/thiếu password trả `ROOM_PASSWORD_REQUIRED` |
| `room:leave` | `{roomId}` | Chỉ thao tác thoát thật mới xóa trạng thái phòng ở client |
| `chat:send` | `{roomId, message}` | Server lấy identity từ socket; 1-500 ký tự |
| `hand:raise` | `{roomId, raised}` | Giơ/hạ tay |
| `mic:toggle` | `{roomId, enabled}` | Đồng bộ trạng thái mic |
| `latency:ping` | `{clientSentAt}` | Đo round-trip latency |
| `recording:start` | `{roomId, token}` | Chỉ PRO/SUPER |
| `recording:stop` | `{roomId, token}` | Chỉ PRO/SUPER |
| `gift:announce` | `{roomId, giftId}` | Broadcast Super Chat đã commit |
| `webrtc:offer/answer/ice-candidate` | WebRTC payload | Kết nối audio peer-to-peer |

Server phát các event `room:state`, `chat:message`, `recording:update`,
`gift:announced` và các event WebRTC tương ứng.

## Giới hạn production

Agora hiện vẫn là scaffold. Production cần Agora token thật, JWT cho toàn bộ
Socket.IO handshake, rate limit, object storage và Socket.IO adapter dùng chung
cho nhiều instance.
