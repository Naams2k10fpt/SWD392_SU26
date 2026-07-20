import http from "node:http";
import cors from "cors";
import express from "express";
import mysql from "mysql2/promise";
import { Server } from "socket.io";

const port = Number(process.env.PORT || 3020);
const databaseUrl = process.env.LUCY_DB_URL || "mysql://@localhost:3306/test_lucy_phase5";
const pool = mysql.createPool(databaseUrl);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const socketParticipants = new Map();

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
  if (existing.length > 0) return existing[0];

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
    let sql = "SELECT room_code FROM realtime_rooms WHERE status = 'OPEN'";
    const params = [];
    if (request.query.language) {
      sql += " AND language_code = ?";
      params.push(request.query.language);
    }
    if (request.query.level) {
      sql += " AND level_number = ?";
      params.push(Number(request.query.level));
    }
    sql += " ORDER BY created_at";
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
    let sql = "SELECT id, user_id, display_name, message, created_at FROM room_messages WHERE room_id = ?";
    const params = [room.id];
    if (request.query.before) {
      sql += " AND created_at < ?";
      params.push(request.query.before);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);
    const [rows] = await pool.execute(sql, params);
    response.json({ messages: rows.reverse() });
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

io.on("connection", (socket) => {
  socket.data.joinedRooms = new Set();

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
      socketParticipants.set(socket.id, { roomCode: roomId, participantId: participants[0].id });
      socket.data.joinedRooms.add(roomId);
      socket.join(roomId);

      const state = await serializeRoom(roomId);
      io.to(roomId).emit("room:state", state);
      acknowledge?.({ ok: true, room: state });
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

  socket.on("chat:send", async ({ roomId, userId, displayName, message }, acknowledge) => {
    try {
      const participant = socketParticipants.get(socket.id);
      if (!participant || participant.roomCode !== roomId || !message?.trim()) {
        acknowledge?.({ ok: false, message: "Join the room and provide a message" });
        return;
      }
      const room = await ensureRoom(roomId);
      await pool.execute(
        "INSERT INTO room_messages (room_id, participant_id, user_id, display_name, message) VALUES (?, ?, ?, ?, ?)",
        [room.id, participant.participantId, userId, displayName, message.trim()]
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

  socket.on("recording:start", async ({ roomId, userId, displayName }, acknowledge) => {
    try {
      const participant = socketParticipants.get(socket.id);
      if (!participant || participant.roomCode !== roomId) {
        acknowledge?.({ ok: false, message: "Join the room before recording" });
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
        [room.id, userId, displayName]
      );
      const [rows] = await pool.execute(
        "SELECT id FROM recording_logs WHERE room_id = ? AND status = 'RECORDING' ORDER BY started_at DESC LIMIT 1",
        [room.id]
      );
      io.to(roomId).emit("recording:update", { status: "RECORDING", startedBy: displayName, recordingId: rows[0].id });
      acknowledge?.({ ok: true, recordingId: rows[0].id });
    } catch (error) {
      acknowledge?.({ ok: false, message: error.message });
    }
  });

  socket.on("recording:stop", async ({ roomId }, acknowledge) => {
    try {
      const participant = socketParticipants.get(socket.id);
      if (!participant || participant.roomCode !== roomId) {
        acknowledge?.({ ok: false, message: "Join the room first" });
        return;
      }
      const room = await ensureRoom(roomId);
      await pool.execute(
        "UPDATE recording_logs SET status = 'SAVED', stopped_at = CURRENT_TIMESTAMP WHERE room_id = ? AND status = 'RECORDING'",
        [room.id]
      );
      io.to(roomId).emit("recording:update", { status: "SAVED" });
      acknowledge?.({ ok: true });
    } catch (error) {
      acknowledge?.({ ok: false, message: error.message });
    }
  });

  socket.on("disconnect", async () => {
    const participant = socketParticipants.get(socket.id);
    if (!participant) return;
    socketParticipants.delete(socket.id);
    await pool.execute("UPDATE realtime_room_participants SET left_at = CURRENT_TIMESTAMP WHERE id = ?", [participant.participantId]);
    const state = await serializeRoom(participant.roomCode);
    io.to(participant.roomCode).emit("room:state", state);
  });
});

if (!process.env.LUCY_TEST) {
  server.listen(port, () => {
    console.log(`RBL Phase 2 real-time audio MVP listening on ${port}`);
  });
}

export { app, parseRoomCode, server };
