# Software Requirements Specification — LUCY SWD392

| **Tên dự án** | LUCY (Language Unity & Collaborative Youth) |
|---|---|
| **Phiên bản** | 1.2.0 |
| **Ngày cập nhật** | 2026-07-23 |
| **Loại tài liệu** | SRS |
| **Công nghệ** | .NET 10, Node.js 22, Java 17, MariaDB 12, Flutter 3.10+ |
| **Chủ biên** | Nhóm SWD392 |

---

## Mục lục

- [1. Giới thiệu](#1-gioi-thieu)
- [2. Actors & Roles](#2-actors--roles)
- [3. Kiến trúc tổng thể](#3-kien-truc-tong-the)
- [4. Tính năng theo Phase](#4-tinh-nang-theo-phase)
- [5. Non-functional Requirements](#5-non-functional-requirements)
- [6. API Overview](#6-api-overview)
- [7. Glossary](#7-glossary)

---

## 1. Giới thiệu

LUCY (Language Unity & Collaborative Youth) là nền tảng mạng xã hội âm thanh kết hợp EdTech, cho phép học ngôn ngữ (Anh - Trung - Nhật) thông qua giao tiếp real-time. Người dùng tương tác trong các phòng audio theo cấp độ, được hướng dẫn bởi Mentor (Pro) và nội dung từ Creator (Super).

Dự án được triển khai theo 5 phase, mỗi phase mở rộng dần kiến trúc từ monolith sang microservices, tích hợp thêm real-time audio, LMS state pattern, monetization wallet, và stress test.

Mục tiêu của tài liệu này là định nghĩa các yêu cầu chức năng, phi chức năng, actor, và API overview cho toàn bộ hệ thống LUCY.

---

## 2. Actors & Roles

Hệ thống định nghĩa 3 actor chính:

| Actor | Mô tả | Quyền hạn |
|---|---|---|
| **Anonymous (Learner)** | Người học | Tạo/tham gia phòng, chat, giơ tay, bật/tắt mic và gửi Super Chat cho PRO/SUPER cùng phòng |
| **Pro (Mentor)** | Giáo viên hoặc người hướng dẫn | Quyền Learner + gửi tài liệu, ghi âm và CRUD podcast |
| **Super (Creator)** | Người sáng tạo nội dung | Quyền Pro + nhận gift và quản lý nội dung |

### Role Hierarchy

```
Super (Creator)
  └── Pro (Mentor)
       └── Anonymous
```

Mỗi role kế thừa quyền của role dưới. `ANONYMOUS` là role learner mặc định;
web app hiện yêu cầu đăng nhập trước khi dùng các màn hình chính.

---

## 3. Kiến trúc tổng thể

Hệ thống gồm 4 backend service, web client và mobile client:

| Service | Công nghệ | Port | Database | Mục đích |
|---|---|---|---|---|
| **Auth Service** | ASP.NET Core Minimal API (.NET 10) | 5000 | MariaDB (lucy_phaseX) | Đăng ký, đăng nhập, JWT |
| **Wallet Service** | ASP.NET Core Minimal API + Swagger (.NET 10) | 5041 | MariaDB (lucy_phaseX) | Ví điện tử, nạp tiền, gift, podcast |
| **Realtime Service** | Express + Socket.IO (Node.js 22) | 3020 | MariaDB (lucy_phaseX) | Phòng audio real-time, Agora token |
| **LMS Service** | Java Console + State Pattern (Java 17) | Console | MariaDB (lucy_phaseX) | Mentor dashboard, sub-level transition |
| **Web App** | React 19 + Vinext | 3000 | Gọi API backend | Giao diện chính hiện tại |
| **Mobile App** | Flutter 3.10+ | — | Gọi API backend | Giao diện người dùng di động |

Tất cả service dùng chung một MariaDB instance (port 3306) nhưng tách biệt database theo phase (lucy_phase1 đến lucy_phase5).

---

## 4. Tính năng theo Phase

### Phase 1: Requirements, Digitization & Auth

| ID | Tính năng | Mô tả |
|---|---|---|
| F1.1 | Digitize content | Đọc file Word English/Chinese/Japanese, xuất JSON + SQL |
| F1.2 | Import content | Script Python + Java Apache POI import học liệu vào DB |
| F1.3 | User Registration | Đăng ký với email, password, displayName, role |
| F1.4 | User Login | Xác thực, trả JWT (HMAC-SHA256) |
| F1.5 | Profile | Xem thông tin user hiện tại qua JWT |
| F1.6 | Database schema | Tạo tables: users, roles, user_roles, languages, stages, levels, lessons, content_blocks |

### Phase 2: Realtime Audio MVP

| ID | Tính năng | Mô tả |
|---|---|---|
| F2.1 | Health check | Kiểm tra trạng thái service |
| F2.2 | Room management | Tạo phòng công khai/có password, liệt kê và rời phòng có xác nhận |
| F2.3 | Agora token scaffold | Sinh token Agora cho WebRTC |
| F2.4 | Socket.IO events | Join/leave, chat, hand, mic, WebRTC, recording và gift announcement |
| F2.5 | Participant tracking | Lưu thông tin người tham gia phòng |
| F2.6 | Latency measurement | Đo độ trễ round-trip giữa client và server |
| F2.7 | Room resilience | Giữ phòng khi chuyển tab; F5/reconnect tự join lại tối đa 3 lần |
| F2.8 | Room chat | Chat realtime 1-500 ký tự, tối đa 200 tin trên client |
| F2.9 | Room documents | PRO/SUPER gửi file vào panel riêng có thể thu gọn |
| F2.10 | Speaking indicator | Avatar hiển thị khi người dùng đang phát âm thanh |

### Phase 3: LMS & State Pattern

| ID | Tính năng | Mô tả |
|---|---|---|
| F3.1 | Mentor dashboard | Hiển thị danh sách learner, trạng thái sub-level |
| F3.2 | Material pinning | Ghim tài liệu học cho level cụ thể |
| F3.3 | Learner progress | Theo dõi level/sub-level hiện tại của learner |
| F3.4 | State Pattern transitions | WarmUp -> GuidedPractice -> PeerExchange -> Reflection |
| F3.5 | Timer-based sub-level | Sub-level tự động chuyển sau 10 phút |
| F3.6 | Transition events | Ghi log mỗi lần chuyển sub-level |

### Phase 4: SOA & Monetization

| ID | Tính năng | Mô tả |
|---|---|---|
| F4.1 | Wallet management | Tạo ví, xem số dư (VND) |
| F4.2 | Top-up | Nạp tiền vào ví (MariaDB transaction) |
| F4.3 | Super Chat | Learner gửi quà cho PRO/SUPER cùng phòng; broadcast sau commit |
| F4.4 | Gift listing | Chỉ xem quà user hiện tại đã gửi hoặc nhận |
| F4.5 | Podcast management | PRO/SUPER lọc, tạo, đổi tên/thay audio và xóa podcast |
| F4.6 | Swagger UI | Tài liệu API cho Wallet Service |
| F4.7 | Cross-service flow | Auth -> Wallet -> Realtime integration |

### Phase 5: Stress Test & Final Evaluation

| ID | Tính năng | Mô tả |
|---|---|---|
| F5.1 | k6 stress test | 500-1000 virtual users, các kịch bản realtime/auth/wallet |
| F5.2 | Cross testing report | Ghi nhận kết quả cross-test giữa các nhóm |
| F5.3 | Performance thresholds | p(95) latency < 800ms, failure rate < 5% |
| F5.4 | Flutter mobile app | Giao diện người dùng trên di động |

---

## 5. Non-functional Requirements

| ID | Yêu cầu | Mô tả | Phase |
|---|---|---|---|
| NFR1 | Authentication | JWT-based, HMAC-SHA256, claims: sub, email, role | 1 |
| NFR2 | Token expiry | JWT hết hạn sau 2 giờ | 1 |
| NFR3 | Database transaction | MariaDB transaction cho top-up và gift | 4 |
| NFR4 | API documentation | Swagger UI tại /swagger (Wallet Service) | 4 |
| NFR5 | CORS | Realtime service cho phép CORS origin tùy chỉnh | 2 |
| NFR6 | Security isolation | Gift/podcast/recording/tài liệu xác thực JWT qua Auth; room join payload cần hardening trước production | 4 |
| NFR7 | Stress test | k6 script với thresholds cụ thể | 5 |
| NFR8 | Password hashing | ASP.NET Core Identity PasswordHasher | 1 |
| NFR9 | Database charset | utf8mb4 + unicode_ci cho toàn bộ schema | 1 |
| NFR10 | Room password | Password tùy chọn 4–100 ký tự, hash bằng scrypt và không trả hash qua API | 2 |
| NFR11 | Upload limits | Tài liệu tối đa 20 MB; audio tối đa 50 MB với MIME allowlist | 2, 4 |

---

## 6. API Overview

### Auth Service (port 5000)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | / | No | Health check |
| POST | /auth/register | No | Đăng ký tài khoản mới |
| POST | /auth/login | No | Đăng nhập, nhận JWT |
| GET | /auth/me | Bearer JWT | Xem thông tin user hiện tại |

### Wallet Service (port 5041)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | /health | No | Health check |
| GET | /wallets/{userId} | No | Xem thông tin ví |
| POST | /wallets/{userId}/top-up | No | Nạp tiền vào ví |
| POST | /gifts | Bearer JWT | Gửi Super Chat |
| GET | /gifts | Bearer JWT | Xem quà user hiện tại đã gửi hoặc nhận |
| POST | /podcasts/recordings | Bearer JWT | PRO/SUPER tạo podcast |
| GET | /podcasts/recordings | No | Xem danh sách recording |
| PUT | /podcasts/recordings/{id} | Bearer JWT | PRO/SUPER đổi tên podcast |
| DELETE | /podcasts/recordings/{id} | Bearer JWT | PRO/SUPER xóa podcast |

### Realtime Service (port 3020)

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | /health | Health check |
| GET | /rooms | Liệt kê phòng đang hoạt động |
| POST | /rooms | Tạo phòng công khai hoặc có password |
| GET | /rooms/:roomCode/messages | Lịch sử chat |
| GET | /rooms/:roomCode/documents | Danh sách tài liệu |
| POST | /api/rooms/:roomCode/documents | PRO/SUPER gửi tài liệu |
| POST | /api/upload-recording | PRO/SUPER upload audio |
| POST | /agora/token | Sinh token Agora (scaffold) |

Socket.IO events: room:join, room:leave, chat:send, hand:raise, mic:toggle,
latency:ping, recording:start/stop, gift:announce, WebRTC signaling và room:state.

### LMS Service (console)

| Command | Mô tả |
|---|---|
| mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication | Chạy dashboard mentor, in báo cáo learner progress |

---

## 7. Glossary

| Thuật ngữ | Ý nghĩa |
|---|---|
| LUCY | Language Unity & Collaborative Youth |
| RBL | Research-Based Learning |
| SWD392 | Mã môn học (Software Architecture and Design) |
| JWT | JSON Web Token |
| Agora | Nền tảng WebRTC cho real-time audio/video |
| Socket.IO | Thư viện WebSocket cho Node.js |
| SOA | Service-Oriented Architecture |
| LMS | Learning Management System |
| State Pattern | Design pattern cho sub-level transitions |
| Sub-Level | Giai đoạn nhỏ trong 1 level: WarmUp, GuidedPractice, PeerExchange, Reflection |
| VND | Đơn vị tiền tệ (Việt Nam Đồng) |
| Scaffold | Code mẫu/minimal implementation |
