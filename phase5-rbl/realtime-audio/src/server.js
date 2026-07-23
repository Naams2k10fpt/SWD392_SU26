import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import cors from "cors";
import express from "express";
import multer from "multer";
import mysql from "mysql2/promise";
import { Server } from "socket.io";

const port = Number(process.env.PORT || 3020);
const databaseUrl = process.env.LUCY_DB_URL || "mysql://@localhost:3306/test_lucy_phase5";
const authBaseUrl = process.env.AUTH_BASE_URL || "http://localhost:5000";
const pool = mysql.createPool(databaseUrl);

const app = express();
const server = http.createServer(app);

const RECORDINGS_DIR = path.resolve("recordings");
const DOCUMENTS_DIR = path.resolve("documents");
if (!existsSync(RECORDINGS_DIR)) mkdirSync(RECORDINGS_DIR, { recursive: true });
if (!existsSync(DOCUMENTS_DIR)) mkdirSync(DOCUMENTS_DIR, { recursive: true });
const AUDIO_EXTENSIONS = new Map([
  ["audio/webm", ".webm"],
  ["audio/mp4", ".m4a"],
  ["audio/m4a", ".m4a"],
  ["audio/x-m4a", ".m4a"],
  ["audio/wav", ".wav"],
  ["audio/x-wav", ".wav"],
  ["audio/wave", ".wav"],
  ["audio/vnd.wave", ".wav"],
  ["audio/mpeg", ".mp3"],
  ["audio/mp3", ".mp3"],
  ["audio/ogg", ".ogg"],
]);
const audioExtension = mimeType => AUDIO_EXTENSIONS.get(mimeType.split(";", 1)[0].toLowerCase()) || null;
const DOCUMENT_EXTENSIONS = new Map([
  ["application/pdf", ".pdf"],
  ["application/msword", ".doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.ms-excel", ".xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
  ["application/vnd.ms-powerpoint", ".ppt"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"],
  ["text/plain", ".txt"],
]);
const documentExtension = mimeType => DOCUMENT_EXTENSIONS.get(String(mimeType).split(";", 1)[0].toLowerCase()) || null;
const upload = multer({
  storage: multer.diskStorage({
    destination: RECORDINGS_DIR,
    filename: (_request, file, callback) => {
      const extension = audioExtension(file.mimetype);
      callback(extension ? null : Object.assign(new Error("Unsupported audio type"), { status: 400 }), extension ? `${randomUUID()}${extension}` : undefined);
    },
  }),
  fileFilter: (_request, file, callback) => callback(audioExtension(file.mimetype) ? null : Object.assign(new Error("Only WebM, M4A, WAV, MP3 or OGG audio is supported"), { status: 400 }), Boolean(audioExtension(file.mimetype))),
  limits: { fileSize: 50 * 1024 * 1024 },
});
const documentUpload = multer({
  storage: multer.diskStorage({
    destination: DOCUMENTS_DIR,
    filename: (_request, file, callback) => {
      const extension = documentExtension(file.mimetype);
      callback(extension ? null : Object.assign(new Error("Unsupported document type"), { status: 400 }), extension ? `${randomUUID()}${extension}` : undefined);
    },
  }),
  fileFilter: (_request, file, callback) => callback(documentExtension(file.mimetype) ? null : Object.assign(new Error("Only PDF, Word, Excel, PowerPoint or TXT documents are supported"), { status: 400 }), Boolean(documentExtension(file.mimetype))),
  limits: { fileSize: 20 * 1024 * 1024 },
});
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const socketParticipants = new Map();
const DOCUMENT_MESSAGE_PREFIX = "__LUCY_DOCUMENT__:";
const MAX_CHAT_MESSAGE_LENGTH = 500;

function serializeChatMessage(row) {
  const message = String(row.message || "");
  const base = { id: row.id, userId: row.user_id, displayName: row.display_name, message, createdAt: row.created_at };
  if (!message.startsWith(DOCUMENT_MESSAGE_PREFIX)) return base;
  try {
    const document = JSON.parse(message.slice(DOCUMENT_MESSAGE_PREFIX.length));
    return { ...base, kind: "DOCUMENT", message: "", documentName: String(document.name), documentUrl: String(document.url), documentSize: Number(document.size) || 0 };
  } catch {
    return base;
  }
}

async function recorderIdFromToken(authorization) {
  const token = String(authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const response = await fetch(`${authBaseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const user = await response.json();
    return ["PRO", "SUPER"].includes(user.role?.toUpperCase()) ? user.id : null;
  } catch {
    return null;
  }
}

function parseRoomCode(roomCode) {
  // Try to extract language and level from room code patterns like:
  // "en-s1-l5-xxx", "zh-s2-l10", "ja-l3-practice", "english-level-5"
  const match = roomCode.match(/^(en|zh|ja)[-\s]?(?:s\d+[-\s])?l(?:evel)?[-\s]?(\d+)/i);
  if (match) {
    return { languageCode: match[1].toLowerCase(), levelNumber: parseInt(match[2], 10) };
  }
  // Try English names: "english-level-5"
  const langMap = { english: "en", chinese: "zh", japanese: "ja" };
  const nameMatch = roomCode.match(/^(english|chinese|japanese)[-\s]l(?:evel)?[-\s]?(\d+)/i);
  if (nameMatch && langMap[nameMatch[1].toLowerCase()]) {
    return { languageCode: langMap[nameMatch[1].toLowerCase()], levelNumber: parseInt(nameMatch[2], 10) };
  }
  return null;
}

async function ensureRoom(roomCode) {
  const [existing] = await pool.execute(
    "SELECT id, room_code, title, language_code, level_number, agora_channel_name, status, created_at FROM realtime_rooms WHERE room_code = ?",
    [roomCode]
  );
  if (existing.length > 0) {
    if (existing[0].status !== 'OPEN') {
      await pool.execute("UPDATE realtime_rooms SET status = 'OPEN' WHERE room_code = ?", [roomCode]);
      existing[0].status = 'OPEN';
    }
    return existing[0];
  }

  const parsed = parseRoomCode(roomCode);
  const languageCode = parsed?.languageCode || "en";
  const levelNumber = parsed?.levelNumber || 1;

  await pool.execute(
    "INSERT INTO realtime_rooms (room_code, title, language_code, level_number, agora_channel_name, status) VALUES (?, ?, ?, ?, ?, 'OPEN')",
    [roomCode, `Room ${roomCode}`, languageCode, levelNumber, roomCode]
  );

  const [created] = await pool.execute(
    "SELECT id, room_code, title, language_code, level_number, agora_channel_name, status, created_at FROM realtime_rooms WHERE room_code = ?",
    [roomCode]
  );
  return created[0];
}

async function serializeRoom(roomCode) {
  const room = await ensureRoom(roomCode);
  const [participants] = await pool.execute(
    `
    SELECT id, anonymous_uid, display_name, role_name, mic_enabled, hand_raised, joined_at
    FROM realtime_room_participants
    WHERE room_id = ? AND left_at IS NULL
    ORDER BY joined_at
    `,
    [room.id]
  );

  return {
    roomId: room.room_code,
    title: room.title,
    languageCode: room.language_code,
    levelNumber: room.level_number,
    participantCount: participants.length,
    createdAt: room.created_at,
    users: participants.map(participant => ({
      participantId: participant.id,
      userId: participant.anonymous_uid,
      displayName: participant.display_name,
      role: participant.role_name,
      micEnabled: Boolean(participant.mic_enabled),
      joinedAt: participant.joined_at
    })),
    raisedHands: participants.filter(participant => participant.hand_raised).map(participant => participant.anonymous_uid)
  };
}

app.get("/health", (_request, response) => {
  response.json({ service: "RBL Phase 5 Real-time Audio", status: "ready", storage: "MariaDB" });
});

app.post("/agora/token", async (request, response, next) => {
  try {
    const { channelName, uid, role = "audience" } = request.body;
    if (!channelName || !uid) {
      response.status(400).json({ message: "channelName and uid are required" });
      return;
    }

    await ensureRoom(channelName);
    response.json({
      channelName,
      uid,
      role,
      token: "agora-token-scaffold-replace-with-RtcTokenBuilder",
      expiresInSeconds: 3600,
      note: "MVP scaffold only. Replace with Agora AccessToken2/RtcTokenBuilder and server-side credentials before production."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/rooms", async (request, response, next) => {
  try {
    let sql = `SELECT r.room_code FROM realtime_rooms r WHERE r.status = 'OPEN' AND EXISTS (SELECT 1 FROM realtime_room_participants rp WHERE rp.room_id = r.id AND rp.left_at IS NULL)`;
    const params = [];
    if (request.query.language) {
      sql += " AND r.language_code = ?";
      params.push(request.query.language);
    }
    if (request.query.level) {
      sql += " AND r.level_number = ?";
      params.push(Number(request.query.level));
    }
    sql += " ORDER BY r.created_at";
    const [rooms] = await pool.execute(sql, params);
    response.json({ rooms: await Promise.all(rooms.map(room => serializeRoom(room.room_code))) });
  } catch (error) {
    next(error);
  }
});

app.post("/rooms", async (request, response, next) => {
  try {
    const { roomCode, title, languageCode, levelNumber } = request.body;
    if (!roomCode || !languageCode || levelNumber === undefined) {
      response.status(400).json({ message: "roomCode, languageCode and levelNumber are required" });
      return;
    }
    if (!["en", "zh", "ja"].includes(languageCode)) {
      response.status(400).json({ message: "languageCode must be 'en', 'zh', or 'ja'" });
      return;
    }
    if (typeof levelNumber !== "number" || levelNumber < 1) {
      response.status(400).json({ message: "levelNumber must be a positive number" });
      return;
    }

    const [existing] = await pool.execute(
      "SELECT id FROM realtime_rooms WHERE room_code = ?", [roomCode]
    );
    if (existing.length > 0) {
      response.status(409).json({ message: "Room code already exists" });
      return;
    }

    const displayTitle = title || `${languageCode.toUpperCase()} Level ${levelNumber}`;
    await pool.execute(
      "INSERT INTO realtime_rooms (room_code, title, language_code, level_number, agora_channel_name, status) VALUES (?, ?, ?, ?, ?, 'OPEN')",
      [roomCode, displayTitle, languageCode, levelNumber, roomCode]
    );

    const [created] = await pool.execute(
      "SELECT id, room_code, title, language_code, level_number, agora_channel_name, status, created_at FROM realtime_rooms WHERE room_code = ?",
      [roomCode]
    );
    response.status(201).json(created[0]);
  } catch (error) {
    next(error);
  }
});

app.get("/rooms/levels", async (_request, response, next) => {
  try {
    const [groups] = await pool.execute(
      `SELECT language_code, level_number, COUNT(*) as room_count
       FROM realtime_rooms WHERE status = 'OPEN'
       GROUP BY language_code, level_number
       ORDER BY language_code, level_number`
    );
    response.json({ groups });
  } catch (error) {
    next(error);
  }
});

app.get("/rooms/:roomCode/messages", async (request, response, next) => {
  try {
    const limit = Math.min(Number(request.query.limit) || 50, 200);
    const room = await ensureRoom(request.params.roomCode);
    let sql = "SELECT id, user_id, display_name, message, created_at FROM room_messages WHERE room_id = ? AND LEFT(message, ?) <> ?";
    const params = [room.id, DOCUMENT_MESSAGE_PREFIX.length, DOCUMENT_MESSAGE_PREFIX];
    if (request.query.before) {
      sql += " AND created_at < ?";
      params.push(request.query.before);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);
    const [rows] = await pool.execute(sql, params);
    response.json({ messages: rows.reverse().map(serializeChatMessage) });
  } catch (error) {
    next(error);
  }
});

app.get("/rooms/:roomCode/recordings", async (request, response, next) => {
  try {
    const room = await ensureRoom(request.params.roomCode);
    const [rows] = await pool.execute(
      "SELECT id, started_by, started_by_display_name, status, storage_uri, duration_seconds, started_at, stopped_at FROM recording_logs WHERE room_id = ? ORDER BY started_at DESC",
      [room.id]
    );
    response.json({ recordings: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rooms/:roomCode/documents", documentUpload.single("document"), async (request, response, next) => {
  let saved = false;
  try {
    const file = request.file;
    const mentorId = await recorderIdFromToken(request.headers.authorization);
    if (!file || !mentorId || mentorId !== request.body.userId) {
      if (file) await unlink(file.path).catch(() => {});
      response.status(403).json({ message: "Only PRO and SUPER users can share documents" });
      return;
    }
    const room = await ensureRoom(request.params.roomCode);
    const [participants] = await pool.execute(
      "SELECT id, display_name FROM realtime_room_participants WHERE room_id = ? AND anonymous_uid = ? AND left_at IS NULL ORDER BY joined_at DESC LIMIT 1",
      [room.id, mentorId]
    );
    if (!participants.length) {
      await unlink(file.path).catch(() => {});
      response.status(403).json({ message: "Join the room before sharing documents" });
      return;
    }
    const id = randomUUID();
    const documentName = file.originalname.replace(/^.*[\\/]/, "").slice(0, 180) || `document${path.extname(file.filename)}`;
    const documentUrl = `/documents/${file.filename}`;
    // ponytail: reuse the message column for one attachment type; add typed columns when chat gains more attachment kinds.
    const message = DOCUMENT_MESSAGE_PREFIX + JSON.stringify({ name: documentName, url: documentUrl, size: file.size });
    await pool.execute(
      "INSERT INTO room_messages (id, room_id, participant_id, user_id, display_name, message) VALUES (?, ?, ?, ?, ?, ?)",
      [id, room.id, participants[0].id, mentorId, participants[0].display_name, message]
    );
    saved = true;
    const chatMessage = serializeChatMessage({ id, user_id: mentorId, display_name: participants[0].display_name, message, created_at: new Date() });
    io.to(request.params.roomCode).emit("chat:message", chatMessage);
    response.status(201).json(chatMessage);
  } catch (error) {
    if (!saved && request.file) await unlink(request.file.path).catch(() => {});
    next(error);
  }
});

app.get("/rooms/:roomCode/documents", async (request, response, next) => {
  try {
    const room = await ensureRoom(request.params.roomCode);
    const [rows] = await pool.execute(
      "SELECT id, user_id, display_name, message, created_at FROM room_messages WHERE room_id = ? AND LEFT(message, ?) = ? ORDER BY created_at DESC LIMIT 100",
      [room.id, DOCUMENT_MESSAGE_PREFIX.length, DOCUMENT_MESSAGE_PREFIX]
    );
    response.json({ documents: rows.map(serializeChatMessage) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/upload-recording", upload.single("audio"), async (request, response, next) => {
  let podcastSaved = false;
  try {
    const { roomCode, userId } = request.body;
    const podcastId = String(request.body.podcastId || "").trim();
    const requestedTitle = String(request.body.title || "").trim();
    const file = request.file;
    const durationSeconds = Math.round(Number(request.body.durationSeconds));
    if (!roomCode || !file || !Number.isFinite(durationSeconds) || durationSeconds < 1 || requestedTitle.length > 255 || (podcastId && !requestedTitle)) {
      if (file) await unlink(file.path).catch(() => {});
      response.status(400).json({ message: "Valid room, title, audio file and duration are required" });
      return;
    }
    const recorderId = await recorderIdFromToken(request.headers.authorization);
    if (!recorderId || recorderId !== userId) {
      await unlink(file.path).catch(() => {});
      response.status(403).json({ message: "Only PRO and SUPER users can upload recordings" });
      return;
    }
    const storageUri = `/recordings/${file.filename}`;
    const room = await ensureRoom(roomCode);
    if (podcastId) {
      const [existing] = await pool.execute("SELECT storage_uri FROM podcast_recordings WHERE id = ?", [podcastId]);
      if (!existing.length) {
        await unlink(file.path).catch(() => {});
        response.status(404).json({ message: "Podcast not found" });
        return;
      }
      await pool.execute(
        "UPDATE podcast_recordings SET title = ?, storage_uri = ?, duration_seconds = ? WHERE id = ?",
        [requestedTitle, storageUri, durationSeconds, podcastId]
      );
      const oldStorageUri = existing[0].storage_uri;
      if (oldStorageUri?.startsWith("/recordings/")) await unlink(path.join(RECORDINGS_DIR, path.basename(oldStorageUri))).catch(() => {});
    } else {
      await pool.execute(
        "INSERT INTO podcast_recordings (creator_external_id, room_code, title, storage_uri, duration_seconds) VALUES (?, ?, ?, ?, ?)",
        [recorderId, roomCode, requestedTitle || `Recording - ${room.title || roomCode}`, storageUri, durationSeconds]
      );
    }
    podcastSaved = true;
    if (!requestedTitle) {
      await pool.execute(
        "UPDATE recording_logs SET status = 'SAVED', storage_uri = ?, duration_seconds = ?, stopped_at = COALESCE(stopped_at, CURRENT_TIMESTAMP) WHERE room_id = ? AND started_by = ? AND status IN ('RECORDING', 'STOPPED') ORDER BY started_at DESC LIMIT 1",
        [storageUri, durationSeconds, room.id, recorderId]
      ).catch(error => console.error("Recording log update failed:", error));
    }
    const audioUrl = `${request.protocol}://${request.get("host")}${storageUri}`;
    if (!requestedTitle) io.to(roomCode).emit("recording:update", { status: "SAVED", audioUrl, durationSeconds });
    response.json({ ok: true, storageUri, audioUrl, durationSeconds });
  } catch (error) {
    if (!podcastSaved && request.file) await unlink(request.file.path).catch(() => {});
    next(error);
  }
});

app.use("/recordings", express.static(RECORDINGS_DIR));
app.use("/documents", express.static(DOCUMENTS_DIR));

app.use((error, _request, response, _next) => {
  console.error("API Error:", error);
  response.status(error.status || (error instanceof multer.MulterError ? 400 : 500)).json({ message: error.message || "Internal server error" });
});

io.on("connection", (socket) => {
  socket.data.joinedRooms = new Set();

  async function leaveCurrentRoom() {
    const participant = socketParticipants.get(socket.id);
    if (!participant) return;
    socketParticipants.delete(socket.id);
    socket.data.joinedRooms.delete(participant.roomCode);
    socket.leave(participant.roomCode);
    io.to(participant.roomCode).emit("webrtc:user-left", { userId: participant.userId });
    await pool.execute(
      "UPDATE realtime_room_participants SET left_at = CURRENT_TIMESTAMP WHERE id = ? AND left_at IS NULL",
      [participant.participantId]
    );
    const [active] = await pool.execute(
      "SELECT COUNT(*) as cnt FROM realtime_room_participants rp JOIN realtime_rooms rr ON rr.id = rp.room_id WHERE rr.room_code = ? AND rp.left_at IS NULL",
      [participant.roomCode]
    );
    if (active[0].cnt === 0) {
      await pool.execute("UPDATE realtime_rooms SET status = 'EMPTY' WHERE room_code = ?", [participant.roomCode]);
    } else {
      io.to(participant.roomCode).emit("room:state", await serializeRoom(participant.roomCode));
    }
  }

  socket.on("room:join", async ({ roomId, userId, displayName, role = "anonymous" }, acknowledge) => {
    try {
      if (!roomId || !userId || !displayName) {
        acknowledge?.({ ok: false, message: "roomId, userId and displayName are required" });
        return;
      }

      const room = await ensureRoom(roomId);
      await pool.execute(
        "INSERT INTO realtime_room_participants (room_id, anonymous_uid, display_name, role_name) VALUES (?, ?, ?, ?)",
        [room.id, userId, displayName, role.toUpperCase()]
      );
      const [participants] = await pool.execute(
        "SELECT id FROM realtime_room_participants WHERE room_id = ? AND anonymous_uid = ? AND left_at IS NULL ORDER BY joined_at DESC LIMIT 1",
        [room.id, userId]
      );
      socketParticipants.set(socket.id, { roomCode: roomId, participantId: participants[0].id, userId, displayName });
      socket.data.joinedRooms.add(roomId);
      socket.join(roomId);

      socket.to(roomId).emit("webrtc:user-joined", { userId, displayName });

      const state = await serializeRoom(roomId);
      io.to(roomId).emit("room:state", state);
      acknowledge?.({ ok: true, room: state });
    } catch (error) {
      acknowledge?.({ ok: false, message: error.message });
    }
  });

  socket.on("room:leave", async ({ roomId }, acknowledge) => {
    try {
      const participant = socketParticipants.get(socket.id);
      if (!participant || participant.roomCode !== roomId) {
        acknowledge?.({ ok: false, message: "Join the room before leaving" });
        return;
      }
      await leaveCurrentRoom();
      acknowledge?.({ ok: true });
    } catch (error) {
      acknowledge?.({ ok: false, message: error.message });
    }
  });

  socket.on("hand:raise", async ({ roomId, raised = true }, acknowledge) => {
    try {
      const participant = socketParticipants.get(socket.id);
      if (!participant || participant.roomCode !== roomId) {
        acknowledge?.({ ok: false, message: "Join the room before raising hand" });
        return;
      }

      await pool.execute("UPDATE realtime_room_participants SET hand_raised = ? WHERE id = ?", [Boolean(raised), participant.participantId]);
      const state = await serializeRoom(roomId);
      io.to(roomId).emit("room:state", state);
      acknowledge?.({ ok: true, raised });
    } catch (error) {
      acknowledge?.({ ok: false, message: error.message });
    }
  });

  socket.on("mic:toggle", async ({ roomId, enabled }, acknowledge) => {
    try {
      const participant = socketParticipants.get(socket.id);
      if (!participant || participant.roomCode !== roomId || typeof enabled !== "boolean") {
        acknowledge?.({ ok: false, message: "Valid room and enabled boolean are required" });
        return;
      }

      await pool.execute("UPDATE realtime_room_participants SET mic_enabled = ? WHERE id = ?", [enabled, participant.participantId]);
      const state = await serializeRoom(roomId);
      io.to(roomId).emit("room:state", state);
      acknowledge?.({ ok: true, micEnabled: enabled });
    } catch (error) {
      acknowledge?.({ ok: false, message: error.message });
    }
  });

  socket.on("latency:ping", async ({ clientSentAt }, acknowledge) => {
    try {
      const participant = socketParticipants.get(socket.id);
      if (participant) {
        const room = await ensureRoom(participant.roomCode);
        const roundTripMs = Math.max(0, Date.now() - Number(clientSentAt || Date.now()));
        await pool.execute(
          "INSERT INTO realtime_latency_samples (room_id, participant_id, round_trip_ms) VALUES (?, ?, ?)",
          [room.id, participant.participantId, roundTripMs]
        );
      }
      acknowledge?.({ ok: true, clientSentAt, serverReceivedAt: Date.now() });
    } catch (error) {
      acknowledge?.({ ok: false, message: error.message });
    }
  });

  socket.on("chat:send", async ({ roomId, message }, acknowledge) => {
    try {
      const participant = socketParticipants.get(socket.id);
      const text = String(message || "").trim();
      if (!participant || participant.roomCode !== roomId || !text || text.length > MAX_CHAT_MESSAGE_LENGTH || text.startsWith(DOCUMENT_MESSAGE_PREFIX)) {
        acknowledge?.({ ok: false, message: `Tin nhắn phải có từ 1 đến ${MAX_CHAT_MESSAGE_LENGTH} ký tự` });
        return;
      }
      const room = await ensureRoom(roomId);
      await pool.execute(
        "INSERT INTO room_messages (room_id, participant_id, user_id, display_name, message) VALUES (?, ?, ?, ?, ?)",
        [room.id, participant.participantId, participant.userId, participant.displayName, text]
      );
      const [rows] = await pool.execute(
        "SELECT id, user_id, display_name, message, created_at FROM room_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 1",
        [room.id]
      );
      const msg = rows[0];
      io.to(roomId).emit("chat:message", {
        id: msg.id,
        userId: msg.user_id,
        displayName: msg.display_name,
        message: msg.message,
        createdAt: msg.created_at,
      });
      acknowledge?.({ ok: true });
    } catch (error) {
      acknowledge?.({ ok: false, message: error.message });
    }
  });

  socket.on("gift:announce", async ({ roomId, giftId }, acknowledge) => {
    try {
      const participant = socketParticipants.get(socket.id);
      if (!participant || participant.roomCode !== roomId || !giftId) {
        acknowledge?.({ ok: false, message: "Join the room and provide a gift" });
        return;
      }
      const [rows] = await pool.execute(
        `SELECT g.id, g.amount, g.message, g.created_at,
                sender.external_owner_id AS from_user_id, sender_user.display_name AS from_display_name,
                receiver.external_owner_id AS to_user_id, receiver_user.display_name AS to_display_name
         FROM gift_transactions g
         JOIN wallet_accounts sender ON sender.id = g.from_wallet_id
         JOIN users sender_user ON sender_user.id = sender.external_owner_id
         JOIN user_roles sender_ur ON sender_ur.user_id = sender_user.id
         JOIN roles sender_role ON sender_role.id = sender_ur.role_id AND sender_role.name = 'ANONYMOUS'
         JOIN wallet_accounts receiver ON receiver.id = g.to_wallet_id
         JOIN users receiver_user ON receiver_user.id = receiver.external_owner_id
         JOIN user_roles receiver_ur ON receiver_ur.user_id = receiver_user.id
         JOIN roles receiver_role ON receiver_role.id = receiver_ur.role_id AND receiver_role.name IN ('PRO', 'SUPER')
         JOIN realtime_room_participants receiver_participant
           ON receiver_participant.anonymous_uid = receiver.external_owner_id
          AND receiver_participant.left_at IS NULL
         JOIN realtime_rooms receiver_room
           ON receiver_room.id = receiver_participant.room_id
          AND receiver_room.room_code = g.room_code
         WHERE g.id = ? AND g.room_code = ? AND sender.external_owner_id = ?
         LIMIT 1`,
        [giftId, roomId, participant.userId]
      );
      if (rows.length === 0) {
        acknowledge?.({ ok: false, message: "Gift is not valid for this room" });
        return;
      }
      const [updated] = await pool.execute(
        "UPDATE gift_transactions SET realtime_event = 'gift:announced' WHERE id = ? AND realtime_event = 'gift:sent'",
        [giftId]
      );
      if (updated.affectedRows === 0) {
        acknowledge?.({ ok: true, duplicate: true });
        return;
      }
      const gift = rows[0];
      io.to(roomId).emit("chat:message", {
        kind: "SUPER_CHAT",
        id: `gift-${gift.id}`,
        userId: gift.from_user_id,
        displayName: gift.from_display_name,
        toUserId: gift.to_user_id,
        toDisplayName: gift.to_display_name,
        amount: Number(gift.amount),
        message: gift.message || "Cảm ơn buổi học!",
        createdAt: gift.created_at,
      });
      acknowledge?.({ ok: true });
    } catch (error) {
      acknowledge?.({ ok: false, message: error.message });
    }
  });

  socket.on("recording:start", async ({ roomId, token }, acknowledge) => {
    try {
      const participant = socketParticipants.get(socket.id);
      if (!participant || participant.roomCode !== roomId) {
        acknowledge?.({ ok: false, message: "Join the room before recording" });
        return;
      }
      const recorderId = await recorderIdFromToken(token);
      if (!recorderId || recorderId !== participant.userId) {
        acknowledge?.({ ok: false, message: "Only PRO and SUPER users can record" });
        return;
      }
      const room = await ensureRoom(roomId);
      const [active] = await pool.execute(
        "SELECT id FROM recording_logs WHERE room_id = ? AND status = 'RECORDING' LIMIT 1",
        [room.id]
      );
      if (active.length > 0) {
        acknowledge?.({ ok: false, message: "A recording is already in progress" });
        return;
      }
      await pool.execute(
        "INSERT INTO recording_logs (room_id, started_by, started_by_display_name, status) VALUES (?, ?, ?, 'RECORDING')",
        [room.id, recorderId, participant.displayName]
      );
      const [rows] = await pool.execute(
        "SELECT id, started_at FROM recording_logs WHERE room_id = ? AND status = 'RECORDING' ORDER BY started_at DESC LIMIT 1",
        [room.id]
      );
      io.to(roomId).emit("recording:update", { status: "RECORDING", startedBy: participant.displayName, startedAt: rows[0].started_at, recordingId: rows[0].id });
      acknowledge?.({ ok: true, recordingId: rows[0].id });
    } catch (error) {
      acknowledge?.({ ok: false, message: error.message });
    }
  });

  socket.on("recording:stop", async ({ roomId, token }, acknowledge) => {
    try {
      const participant = socketParticipants.get(socket.id);
      if (!participant || participant.roomCode !== roomId) {
        acknowledge?.({ ok: false, message: "Join the room first" });
        return;
      }
      const recorderId = await recorderIdFromToken(token);
      if (!recorderId || recorderId !== participant.userId) {
        acknowledge?.({ ok: false, message: "Only PRO and SUPER users can stop recordings" });
        return;
      }
      await pool.execute(
        `UPDATE recording_logs rl
         JOIN realtime_rooms rr ON rr.id = rl.room_id
         SET rl.status = 'STOPPED', rl.stopped_at = CURRENT_TIMESTAMP
         WHERE rr.room_code = ? AND rl.started_by = ? AND rl.status = 'RECORDING'`,
        [roomId, recorderId]
      );
      acknowledge?.({ ok: true });
    } catch (error) {
      acknowledge?.({ ok: false, message: error.message });
    }
  });

  socket.on("webrtc:offer", ({ targetUserId, sdp }) => {
    const sender = socketParticipants.get(socket.id);
    if (!sender) return;
    for (const [sid, p] of socketParticipants) {
      if (p.userId === targetUserId && p.roomCode === sender.roomCode) {
        io.to(sid).emit("webrtc:offer", { userId: sender.userId, sdp });
        break;
      }
    }
  });

  socket.on("webrtc:answer", ({ targetUserId, sdp }) => {
    const sender = socketParticipants.get(socket.id);
    if (!sender) return;
    for (const [sid, p] of socketParticipants) {
      if (p.userId === targetUserId && p.roomCode === sender.roomCode) {
        io.to(sid).emit("webrtc:answer", { userId: sender.userId, sdp });
        break;
      }
    }
  });

  socket.on("webrtc:ice-candidate", ({ targetUserId, candidate }) => {
    const sender = socketParticipants.get(socket.id);
    if (!sender) return;
    for (const [sid, p] of socketParticipants) {
      if (p.userId === targetUserId && p.roomCode === sender.roomCode) {
        io.to(sid).emit("webrtc:ice-candidate", { userId: sender.userId, candidate });
        break;
      }
    }
  });

  socket.on("disconnect", async () => {
    try {
      await leaveCurrentRoom();
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  });
});

if (!process.env.LUCY_TEST) {
  server.listen(port, async () => {
    try {
      await pool.execute("UPDATE realtime_room_participants SET left_at = NOW() WHERE left_at IS NULL");
      await pool.execute("UPDATE realtime_rooms SET status = 'EMPTY' WHERE status = 'OPEN'");
      console.log(`RBL Phase 2 real-time audio MVP listening on ${port}`);
    } catch (err) {
      console.error("Startup cleanup failed:", err);
      process.exit(1);
    }
  });
}

export { app, audioExtension, documentExtension, parseRoomCode, recorderIdFromToken, serializeChatMessage, server };
