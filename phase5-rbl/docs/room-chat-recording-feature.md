# Room Chat & Recording — Tính năng mới Phase 5

> Tài liệu mô tả các tính năng bổ sung cho room: Chat hội thoại, Ghi âm, và Hiển thị Level rõ ràng.

---

## 1. Chat / Hội thoại (Conversation)

### Mục đích
Cho phép người tham gia trong phòng gửi tin nhắn văn bản real-time, lưu lại lịch sử hội thoại.

### Luồng hoạt động

```
User gõ tin nhắn → Nhấn Gửi
  → Client emit "chat:send" { roomId, userId, displayName, message }
  → Server INSERT vào room_messages
  → Server broadcast "chat:message" đến tất cả user trong phòng
  → UI hiện tin nhắn trong khung Chat
```

### Database

```sql
CREATE TABLE room_messages (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id CHAR(36) NOT NULL,
    participant_id CHAR(36) NULL,
    user_id VARCHAR(120) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES realtime_rooms(id) ON DELETE CASCADE
);
```

### API

| Method | Endpoint | Mô tả |
|---|---|---|
| Socket.IO `chat:send` | — | Gửi tin nhắn (request + ack) |
| Socket.IO `chat:message` | — | Broadcast tin nhắn đến room |
| `GET` | `/rooms/:roomCode/messages?limit=50&before=ISO` | Lấy lịch sử chat |

### UI

- Khung chat bên cạnh danh sách participant
- Tin nhắn của mình: căn phải, màu accent
- Tin nhắn người khác: căn trái, kèm tên hiển thị
- Scroll tự động xuống tin nhắn mới nhất
- Input + nút Gửi

---

## 2. Ghi âm (Recording)

### Mục đích
Cho phép ghi âm cuộc hội thoại trong phòng học và phát lại.

### Luồng hoạt động

```
User nhấn ⏺ Ghi âm
  → getUserMedia({ audio: true }) — xin quyền micro
  → MediaRecorder bắt đầu ghi (audio/webm hoặc audio/mp4)
  → Client emit "recording:start" server log

User nhấn ⏹ Dừng
  → MediaRecorder stop
  → Tạo Blob từ các audio chunks
  → Tạo ObjectURL để phát lại
  → Audio player xuất hiện trên UI
  → Client emit "recording:stop" server log
```

### Database

```sql
CREATE TABLE recording_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id CHAR(36) NOT NULL,
    started_by VARCHAR(120) NOT NULL,
    started_by_display_name VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'RECORDING',
    storage_uri VARCHAR(500) NULL,
    duration_seconds INT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stopped_at TIMESTAMP NULL,
    FOREIGN KEY (room_id) REFERENCES realtime_rooms(id) ON DELETE CASCADE
);
```

### API

| Method | Endpoint / Event | Mô tả |
|---|---|---|
| Socket.IO `recording:start` | — | Bắt đầu ghi (log server) |
| Socket.IO `recording:stop` | — | Kết thúc ghi (log server) |
| Socket.IO `recording:update` | — | Broadcast trạng thái ghi âm |
| `GET` | `/rooms/:roomCode/recordings` | Lấy danh sách bản ghi |

### Công nghệ

- **MediaRecorder API** — ghi âm trực tiếp từ trình duyệt
- **getUserMedia** — xin quyền truy cập microphone
- **Blob + ObjectURL** — lưu và phát lại âm thanh mà không cần server upload

### UI

- Nút "Ghi âm" (⏺) / "Dừng" (⏹) chuyển đổi
- Khi đang ghi: nút màu đỏ + icon 🔴
- Khi ghi xong: audio player hiện ra để nghe lại 🎵
- Xử lý lỗi nếu không có quyền micro

---

## 3. Hiển thị Level rõ ràng

### Trước đây
```
EN · Level 5    ← khó hiểu, viết tắt
```

### Sau cải tiến
```
English · Stage 1 · Level 5    ← rõ ràng, đầy đủ
```

### Cách tính Stage
- Stage 1: Level 1–30
- Stage 2: Level 31–60
- Stage 3: Level 61–100

`Stage = Math.ceil(levelNumber / 30)`

### UI
- Hiển thị trong RoomView (panel participants)
- Hiển thị trong RoomBrowser (danh sách phòng)
- Hiển thị trong CreateRoomDialog (tạo phòng mới)

---

## 4. Các file đã thay đổi

| File | Thay đổi |
|---|---|
| `phase5-rbl/database/phase5-realtime-chat-record.sql` | **Mới** — bảng room_messages + recording_logs |
| `phase5-rbl/database/dbeaver-import-all.sql` | Thêm 2 bảng vào script import tổng |
| `phase5-rbl/realtime-audio/src/server.js` | HTTP endpoints + Socket.IO events cho chat & recording |
| `web_app/app/page.tsx` | ChatBox, Record (MediaRecorder), level display |
| `web_app/app/globals.css` | CSS cho chat-panel, record-btn |
