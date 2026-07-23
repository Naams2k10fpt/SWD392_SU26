# So sánh Kiến trúc — LUCY SWD392

> Tài liệu giải thích các lựa chọn kiến trúc cho đồ án SWD392: **tại sao chọn kiến trúc này mà không chọn kiến trúc khác**

---

## 1. SOA/Microservices vs Monolithic

### Giải pháp được chọn: **SOA (Service-Oriented Architecture)**

```
┌─────────────────────────────────────────────────────────┐
│                   SOA (đã chọn)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Auth    │ │  Wallet  │ │ Realtime │ │   LMS    │  │
│  │  .NET    │ │  .NET    │ │  Node.js │ │   Java   │  │
│  │  :5000   │ │  :5041   │ │  :3020   │ │  Console │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                       MariaDB                           │
└─────────────────────────────────────────────────────────┘
```

### Phương án bị loại: **Monolithic**

| Tiêu chí | SOA ✅ | Monolithic ❌ |
|---|---|---|
| **Tách biệt concern** | Mỗi service một nhiệm vụ riêng | Tất cả trong một codebase |
| **Scale độc lập** | Scale realtime riêng, auth riêng | Scale toàn bộ hoặc không |
| **Công nghệ** | .NET + Node.js + Java (đa dạng) | Một ngôn ngữ duy nhất |
| **Phát triển đội nhóm** | 4 nhóm làm 4 service song song | Conflict liên tục trên 1 codebase |
| **RBL lũy kế (yêu cầu môn học)** | Phase sau thêm service mới không ảnh hưởng phase trước | Thay đổi 1 module có thể break toàn bộ |
| **Triển khai** | Deploy từng service riêng | Deploy 1 khối lớn |

**Lý do chọn SOA:**
1. **Yêu cầu RBL:** 5 phase lũy kế — mỗi phase thêm service mới. Với monolithic, phase 4 và 5 sẽ phải sửa code cũ liên tục, gây risk.
2. **Đa dạng công nghệ:** Team được đánh giá trên nhiều công nghệ (.NET, Node.js, Java). SOA cho phép dùng công nghệ phù hợp nhất cho từng module.
3. **Phân công công việc:** Mỗi service là 1 module riêng — dễ chia cho 4-5 thành viên trong nhóm.
4. **Separation of Concerns:** Auth, Realtime, Wallet, LMS là các domain riêng biệt — gộp chung không có ý nghĩa business.

---

## 2. State Pattern vs IF-ELSE truyền thống

### Giải pháp được chọn: **State Pattern (GoF Behavioral)**

| Tiêu chí | State Pattern ✅ | IF-ELSE ❌ |
|---|---|---|
| **Thêm sub-level mới** | Thêm 1 class mới, không sửa code cũ | Thêm 1 nhánh if, dễ gây bug |
| **Logic chuyển tiếp** | Mỗi state tự biết state tiếp theo | Hàm trung tâm quản lý mọi chuyển tiếp |
| **Dễ test** | Test từng state riêng biệt | Phải mock nhiều điều kiện |
| **OCP (Open/Closed)** | ✅ Open for extension, closed for modification | ❌ Phải sửa code gốc |

**Lý do chọn State Pattern:**
1. Hệ thống sub-level (Warm Up → Guided Practice → Peer Exchange → Reflection) là state machine rõ ràng.
2. State Pattern implement đúng OCP — thêm sub-level mới không cần sửa code cũ.
3. Phù hợp yêu cầu môn học về design patterns.

---

## 3. JWT vs Session-based Authentication

### Giải pháp được chọn: **JWT (JSON Web Token)**

| Tiêu chí | JWT ✅ | Session ❌ |
|---|---|---|
| **State** | Stateless — không cần lưu server | Stateful — cần lưu session DB/memory |
| **Scale ngang** | Dễ — bất kỳ server nào verify được token | Khó — cần shared session store (Redis) |
| **Cross-service** | JWT truyền identity giữa các service | Phức tạp — cần shared session store |
| **Real-time (Socket.IO)** | Dùng được trong handshake/event auth | Khó tích hợp với WebSocket |

**Lý do chọn JWT:**
1. SOA cần cross-service authentication. Bản hiện tại để Wallet/Realtime gọi
   `/auth/me` khi xử lý gift, podcast, recording và tài liệu.
2. Role (Anonymous, Pro, Super) embedded trong token claims.
3. Room join hiện vẫn tin identity trong payload; production phải xác thực JWT ở
   Socket.IO middleware trước khi join.

---

## 4. MariaDB vs NoSQL (MongoDB)

### Giải pháp được chọn: **MariaDB (SQL)**

| Tiêu chí | MariaDB ✅ | MongoDB ❌ |
|---|---|---|
| **Dữ liệu học liệu** | Cấu trúc cây: language→stage→level→lesson. Quan hệ cha-con, JOIN dễ | Document lồng nhau phức tạp |
| **Transaction (Wallet)** | ACID — commit/rollback cho top-up, gift | Chỉ hỗ trợ transaction gần đây |
| **Foreign keys** | Đảm bảo referential integrity | Không có foreign key |
| **Yêu cầu môn học** | MariaDB/MySQL là học phần | Chưa được học |

**Lý do chọn MariaDB:**
1. Dữ liệu học liệu có cấu trúc cây chặt chẽ.
2. Wallet cần ACID transaction — không thể thiếu tiền do lỗi atomicity.
3. Yêu cầu của môn SWD392.

---

## 5. .NET (Auth/Wallet) vs Node.js vs Java Spring

### Giải pháp được chọn: **ASP.NET Core cho Auth + Wallet**

| Tiêu chí | .NET ✅ | Node.js Express | Java Spring |
|---|---|---|---|
| **Identity/PasswordHasher** | Built-in, bảo mật cao | Phải tự xây | Có Spring Security |
| **JWT middleware** | JwtBearerAuthentication sẵn | Thư viện bên ngoài | Có trong Spring |
| **Performance** | Rất tốt (compiled) | Tốt (V8) | Tốt (JVM) |
| **Quen thuộc với team** | Đã học | Cũng biết | Chưa rõ |

**Lý do chọn .NET:**
1. ASP.NET Core Identity có PasswordHasher + JwtBearerAuthentication built-in — an toàn hơn tự viết trên Node.js.
2. Team đã học .NET trong môn học trước.

---

## 6. Node.js (Socket.IO) vs .NET SignalR cho Realtime

### Giải pháp được chọn: **Node.js + Socket.IO**

| Tiêu chí | Node.js + Socket.IO ✅ | .NET SignalR |
|---|---|---|
| **Ecosystem** | Socket.IO client cho Web & Flutter | Client chủ yếu .NET |
| **Non-blocking I/O** | Event loop xử lý ngàn kết nối | Async/await cũng tốt |
| **Đa dạng công nghệ** | Node.js cho realtime + .NET cho REST | Tất cả đều .NET |

**Lý do chọn Node.js:**
1. Socket.IO là thư viện WebSocket mạnh nhất, có sẵn cho cả Web và Flutter.
2. Non-blocking I/O phù hợp pattern "join room → broadcast state".
3. Node.js + .NET + Java = đa dạng công nghệ (yêu cầu RBL).

---

## 7. Shared Database vs Database-per-Service

### Giải pháp được chọn: **Shared Database**

| Tiêu chí | Shared DB ✅ | DB-per-Service ❌ |
|---|---|---|
| **Triển khai** | 1 database duy nhất, dễ setup | 4 database riêng, phức tạp |
| **Query xuyên service** | JOIN trực tiếp | Phải gọi API inter-service |
| **Phù hợp quy mô** | Đồ án sinh viên, 24 bảng | Hệ thống lớn, trăm service |

**Lý do chọn Shared Database:**
1. Quy mô đồ án nhỏ — database-per-service là over-engineering.
2. Dễ demo, dễ import, dễ kiểm tra.
3. Yêu cầu RBL: Phase sau thêm bảng vào cùng database.

---

## 8. Kết luận

| Quyết định | Lựa chọn | Lý do chính |
|---|---|---|
| Kiến trúc | SOA | RBL lũy kế, phân công nhóm, đa dạng công nghệ |
| Design Pattern | State Pattern | OCP, dễ mở rộng sub-level |
| Authentication | JWT | Cross-service, stateless, role claims |
| Database | MariaDB | Quan hệ, transaction, yêu cầu môn học |
| Auth/Wallet | .NET | Identity built-in, bảo mật |
| Realtime | Node.js + Socket.IO | Non-blocking I/O, đa dạng công nghệ |
| Database topology | Shared | Quy mô nhỏ, dễ triển khai |
