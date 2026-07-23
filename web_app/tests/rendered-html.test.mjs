import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the LUCY application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>LUCY — Học và kết nối<\/title>/i);
  assert.match(html, /Đang mở LUCY/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps web contracts and proxy boundaries explicit", async () => {
  const [page, proxy, packageJson, realtimeServer, walletServer] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/backend/[service]/[...path]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../../phase5-rbl/realtime-audio/src/server.js", import.meta.url), "utf8"),
    readFile(new URL("../../phase5-rbl/dotnet-wallet/Program.cs", import.meta.url), "utf8"),
  ]);
  const giftStart = page.indexOf('"/gifts", { method: "POST"');
  const giftEnd = page.indexOf("});", giftStart);
  assert.ok(giftStart > 0 && giftEnd > giftStart);
  assert.doesNotMatch(page.slice(giftStart, giftEnd), /roomId/);
  assert.match(page, /Chào mừng trở lại/);
  assert.match(page, /Learn · Unite · Connect · Yourself/);
  assert.match(page, /providerReference/);
  assert.match(page, /durationSeconds/);
  assert.match(page, /className="podcast-player"/);
  assert.match(page, /creatorDisplayName \|\| item\.creatorId/);
  assert.match(page, /aria-label="Tìm podcast"/);
  assert.match(page, /method: "PUT"/);
  assert.match(page, /method: "DELETE"/);
  assert.match(page, /Nhập audio mới/);
  assert.match(page, /Thay audio/);
  assert.match(page, /payload\.append\("podcastId", item\.id\)/);
  assert.doesNotMatch(page, /aria-label="Tạo phòng"/);
  assert.match(page, /audio\/webm;codecs=opus/);
  assert.match(page, /duration\(recordingElapsed\)/);
  assert.match(page, /window\.setInterval/);
  assert.match(page, /playableAudioUrl/);
  assert.match(page, /createMediaStreamSource\(remoteStream\)\.connect\(recordingDestinationRef\.current\)/);
  assert.doesNotMatch(page, /s3:\/\/recordings/);
  assert.doesNotMatch(page, /event\.currentTarget\.reset\(\)/);
  assert.equal([...page.matchAll(/formElement\.reset\(\)/g)].length, 4);
  assert.match(proxy, /auth: process\.env\.AUTH_BASE_URL/);
  assert.match(proxy, /wallet: process\.env\.WALLET_BASE_URL/);
  assert.match(proxy, /AbortSignal\.timeout\(30_000\)/);
  assert.match(proxy, /await upstream\.arrayBuffer\(\)/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(page, /compact=\{route !== "\/room"\}/);
  assert.match(page, /className=\{`mini-room/);
  assert.match(page, /Phòng học đang tham gia/);
  assert.match(page, /emit\("room:leave"/);
  assert.match(page, /Thoát phòng/);
  assert.match(page, /ACTIVE_ROOM_KEY = "lucy_active_room"/);
  assert.match(page, /MAX_JOIN_RETRIES = 3/);
  assert.match(page, /JOIN_ACK_TIMEOUT_MS = 5000/);
  assert.match(page, /localStorage\.setItem\(ACTIVE_ROOM_KEY, target\)/);
  assert.match(page, /Đang thử lại \$\{attempt\}\/\$\{MAX_JOIN_RETRIES\}/);
  assert.match(page, /Thử lại ngay/);
  assert.match(page, /window\.confirm\("Bạn có chắc muốn thoát phòng và trở về danh sách phòng\?"\)/);
  assert.equal([...page.matchAll(/onClick=\{confirmLeaveRoom\}/g)].length, 3);
  assert.match(page, /\["PRO", "SUPER"\]\.includes\(session\.user\.role\.toUpperCase\(\)\)/);
  assert.match(page, /headers: \{ Authorization: `Bearer \$\{session\.token\}` \}/);
  assert.match(realtimeServer, /socket\.on\("room:leave"/);
  assert.match(realtimeServer, /Only PRO and SUPER users can record/);
  assert.match(realtimeServer, /UPDATE podcast_recordings SET title = \?, storage_uri = \?, duration_seconds = \?/);
  assert.match(realtimeServer, /fileSize: 50 \* 1024 \* 1024/);
  assert.match(realtimeServer, /startedAt: rows\[0\]\.started_at/);
  assert.match(page, /emit\("gift:announce"/);
  assert.match(page, /msg\.kind === "SUPER_CHAT"/);
  assert.match(page, /msg\.kind === "DOCUMENT"/);
  assert.match(page, /aria-label="Gửi tài liệu"/);
  assert.match(page, /\/api\/rooms\/\$\{encodeURIComponent\(roomId\)\}\/documents/);
  assert.match(page, /setMessages\(current => \[\.\.\.history\.messages/);
  assert.match(page, /maxLength=\{MAX_CHAT_MESSAGE_LENGTH\}/);
  assert.match(page, /className=\{`documents-drawer/);
  assert.match(page, /aria-expanded=\{documentsOpen\}/);
  assert.match(page, /Đóng khu vực tài liệu/);
  assert.match(page, /Chưa có PRO hoặc SUPER trong phòng/);
  assert.match(page, /context\.createAnalyser\(\)/);
  assert.match(page, /speakingUsers\.has\(person\.userId\)/);
  assert.match(page, /gift\.fromDisplayName \|\| gift\.fromUserId/);
  assert.match(realtimeServer, /socket\.on\("gift:announce"/);
  assert.match(realtimeServer, /Only PRO and SUPER users can share documents/);
  assert.match(realtimeServer, /documentUpload\.single\("document"\)/);
  assert.match(realtimeServer, /MAX_CHAT_MESSAGE_LENGTH = 500/);
  assert.match(realtimeServer, /app\.get\("\/rooms\/:roomCode\/documents"/);
  assert.match(realtimeServer, /realtime_event = 'gift:announced'/);
  assert.match(walletServer, /recipient must be a PRO or SUPER user in the same room/i);
  assert.match(walletServer, /COALESCE\(sender_user\.display_name/);
  assert.match(walletServer, /COALESCE\(u\.display_name, p\.creator_external_id\)/);
  assert.match(walletServer, /MapPut\("\/podcasts\/recordings\/\{id\}"/);
  assert.match(walletServer, /MapDelete\("\/podcasts\/recordings\/\{id\}"/);
  assert.match(walletServer, /CanManagePodcasts\(authenticatedUser\)/);
  assert.match(walletServer, /authenticatedUser\.Id, request\.FromUserId/);
  assert.equal([...realtimeServer.matchAll(/await leaveCurrentRoom\(\)/g)].length, 2);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
