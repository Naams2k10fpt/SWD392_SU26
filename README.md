# LUCY RBL — SWD392 SU26

Repository chứa tiến trình Phase 1–5 và hai client Flutter/Web. `phase5-rbl` là phiên bản đầy đủ mới nhất để chạy và demo.

## Yêu cầu

- MariaDB 12 hoặc MySQL tương thích
- .NET SDK 10
- Node.js 22+
- Java 17 và Maven
- Flutter 3.10+ nếu chạy ứng dụng mobile

## 1. Cấu hình local

Không commit mật khẩu hoặc JWT secret. Mỗi thành viên tạo file cấu hình riêng:

```powershell
Copy-Item local-env.example.ps1 local-env.ps1
notepad local-env.ps1
```

Điền mật khẩu MariaDB và JWT secret tối thiểu 32 ký tự. Trước khi chạy service trong mỗi terminal mới:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\local-env.ps1
```

Thiết lập `Bypass` chỉ tồn tại trong terminal hiện tại và tự mất khi đóng terminal.

`local-env.ps1` và `web_app/.env.local` được Git bỏ qua nên vẫn nằm trên máy sau khi pull/push.

## 2. Import database Phase 5

Mở DBeaver hoặc MariaDB client và chạy:

```text
phase5-rbl/database/dbeaver-import-all.sql
```

Database được tạo với tên `lucy_phase5`.

## 3. Chạy các service

Mở terminal riêng cho từng service, nạp `local-env.ps1`, rồi chạy:

```powershell
dotnet run --project phase5-rbl\dotnet-auth
dotnet run --project phase5-rbl\dotnet-wallet

cd phase5-rbl\realtime-audio
npm install
npm start
```

Các địa chỉ mặc định:

- Auth API: `http://localhost:5000`
- Realtime Socket.IO: `http://localhost:3020`
- Wallet API: `http://localhost:5040`

Java LMS chạy bằng:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\local-env.ps1
mvn -f phase5-rbl\java-lms\pom.xml compile exec:java "-Dexec.mainClass=com.lucy.lms.LmsApplication"
```

## 4. Chạy Web

```powershell
cd web_app
Copy-Item .env.example .env.local -ErrorAction SilentlyContinue
npm install
npm run dev
```

Mở `http://localhost:3000`.

## 5. Chạy Flutter

Android Emulator dùng `10.0.2.2` để gọi các service trên máy host.

```powershell
cd flutter_app
flutter pub get
flutter run
```

## Kiểm tra trước khi push

```powershell
cd web_app
npm test
npm run lint
```

Không dùng `git clean -fdx` nếu muốn giữ các file cấu hình local đã bị ignore.
