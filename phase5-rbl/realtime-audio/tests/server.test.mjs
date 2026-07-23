import assert from "node:assert/strict";
import test from "node:test";

process.env.LUCY_TEST = "1";

// ── parseRoomCode unit tests ──────────────────────────────────

test("parseRoomCode: en-s1-l5-xxx", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.deepEqual(parseRoomCode("en-s1-l5-xxx"), { languageCode: "en", levelNumber: 5 });
});

test("parseRoomCode: zh-s2-l10", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.deepEqual(parseRoomCode("zh-s2-l10"), { languageCode: "zh", levelNumber: 10 });
});

test("parseRoomCode: ja-l3-practice", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.deepEqual(parseRoomCode("ja-l3-practice"), { languageCode: "ja", levelNumber: 3 });
});

test("parseRoomCode: english-level-5", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.deepEqual(parseRoomCode("english-level-5"), { languageCode: "en", levelNumber: 5 });
});

test("parseRoomCode: chinese-level-42", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.deepEqual(parseRoomCode("chinese-level-42"), { languageCode: "zh", levelNumber: 42 });
});

test("parseRoomCode: japanese-level-7", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.deepEqual(parseRoomCode("japanese-level-7"), { languageCode: "ja", levelNumber: 7 });
});

test("parseRoomCode: en level 8", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.deepEqual(parseRoomCode("en level 8"), { languageCode: "en", levelNumber: 8 });
});

test("parseRoomCode: zh level 15", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.deepEqual(parseRoomCode("zh level 15"), { languageCode: "zh", levelNumber: 15 });
});

test("parseRoomCode: en-l1", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.deepEqual(parseRoomCode("en-l1"), { languageCode: "en", levelNumber: 1 });
});

test("parseRoomCode: unknown returns null", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.equal(parseRoomCode("unknown-room-code"), null);
});

test("parseRoomCode: empty string returns null", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.equal(parseRoomCode(""), null);
});

test("parseRoomCode: non-language prefix returns null", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.equal(parseRoomCode("agora-channel-123"), null);
});

test("parseRoomCode: case insensitive EN-L5", async () => {
  const { parseRoomCode } = await import("../src/server.js");
  assert.deepEqual(parseRoomCode("EN-L5"), { languageCode: "en", levelNumber: 5 });
});

// ── HTTP API endpoint tests ───────────────────────────────────

test("Express app is exportable", async () => {
  const { app } = await import("../src/server.js");
  assert.ok(app, "Express app is exported");
  assert.equal(typeof app.listen, "function", "app has listen method");
});

test("audioExtension: keeps audio-only file extensions", async () => {
  const { audioExtension } = await import("../src/server.js");
  assert.equal(audioExtension("audio/webm;codecs=opus"), ".webm");
  assert.equal(audioExtension("audio/mp4"), ".m4a");
  assert.equal(audioExtension("audio/x-m4a"), ".m4a");
  assert.equal(audioExtension("audio/vnd.wave"), ".wav");
  assert.equal(audioExtension("video/webm"), null);
});

test("document messages keep safe file types and survive chat history", async () => {
  const { documentExtension, serializeChatMessage } = await import("../src/server.js");
  assert.equal(documentExtension("application/pdf"), ".pdf");
  assert.equal(documentExtension("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), ".docx");
  assert.equal(documentExtension("text/html"), null);
  const message = serializeChatMessage({
    id: "message-1",
    user_id: "mentor-1",
    display_name: "Mentor",
    message: '__LUCY_DOCUMENT__:{"name":"lesson.pdf","url":"/documents/lesson.pdf","size":2048}',
    created_at: "2026-07-23T00:00:00Z",
  });
  assert.equal(message.kind, "DOCUMENT");
  assert.equal(message.documentName, "lesson.pdf");
  assert.equal(message.documentSize, 2048);
});

test("room passwords are hashed and verified", async () => {
  const { hashRoomPassword, verifyRoomPassword } = await import("../src/server.js");
  const hash = hashRoomPassword("room-secret");
  assert.notEqual(hash, "room-secret");
  assert.equal(verifyRoomPassword("room-secret", hash), true);
  assert.equal(verifyRoomPassword("wrong", hash), false);
  assert.equal(verifyRoomPassword("", null), true);
});

test("recorderIdFromToken: accepts authenticated PRO and SUPER users", async () => {
  const { recorderIdFromToken } = await import("../src/server.js");
  const originalFetch = globalThis.fetch;
  let role = "PRO";
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-token");
    return Response.json({ id: "mentor-1", role });
  };
  try {
    assert.equal(await recorderIdFromToken("Bearer test-token"), "mentor-1");
    role = "SUPER";
    assert.equal(await recorderIdFromToken("test-token"), "mentor-1");
    role = "ANONYMOUS";
    assert.equal(await recorderIdFromToken("test-token"), null);
    assert.equal(await recorderIdFromToken(""), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("POST /rooms: validates required fields", { skip: "Requires running MariaDB" }, async () => {
  // Integration test: needs database connection
});

test("GET /rooms: returns room list", { skip: "Requires running MariaDB" }, async () => {
  // Integration test: needs database connection
});

test("GET /rooms/levels: returns grouped rooms", { skip: "Requires running MariaDB" }, async () => {
  // Integration test: needs database connection
});
