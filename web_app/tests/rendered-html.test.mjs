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
  const [page, proxy, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/backend/[service]/[...path]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const giftStart = page.indexOf('"/gifts", { method: "POST"');
  const giftEnd = page.indexOf("});", giftStart);
  assert.ok(giftStart > 0 && giftEnd > giftStart);
  assert.doesNotMatch(page.slice(giftStart, giftEnd), /roomId/);
  assert.match(page, /Chào mừng trở lại/);
  assert.match(page, /Learn · Unite · Connect · Yourself/);
  assert.match(page, /providerReference/);
  assert.match(page, /durationSeconds/);
  assert.match(page, /audio\/webm;codecs=opus/);
  assert.match(page, /playableAudioUrl/);
  assert.match(page, /createMediaStreamSource\(remoteStream\)\.connect\(recordingDestinationRef\.current\)/);
  assert.doesNotMatch(page, /s3:\/\/recordings/);
  assert.doesNotMatch(page, /event\.currentTarget\.reset\(\)/);
  assert.equal([...page.matchAll(/formElement\.reset\(\)/g)].length, 2);
  assert.match(proxy, /auth: process\.env\.AUTH_BASE_URL/);
  assert.match(proxy, /wallet: process\.env\.WALLET_BASE_URL/);
  assert.match(proxy, /AbortSignal\.timeout\(30_000\)/);
  assert.match(proxy, /await upstream\.arrayBuffer\(\)/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
