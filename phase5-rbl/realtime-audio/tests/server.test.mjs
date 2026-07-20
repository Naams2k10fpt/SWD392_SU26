import assert from "node:assert/strict";
import test from "node:test";

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

test("POST /rooms: validates required fields", { skip: "Requires running MariaDB" }, async () => {
  // Integration test: needs database connection
});

test("GET /rooms: returns room list", { skip: "Requires running MariaDB" }, async () => {
  // Integration test: needs database connection
});

test("GET /rooms/levels: returns grouped rooms", { skip: "Requires running MariaDB" }, async () => {
  // Integration test: needs database connection
});
