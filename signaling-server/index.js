const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Map<classId, Map<userId, socketId>>
const rooms = new Map();

io.on('connection', (socket) => {
  socket.on('join', ({ classId, userId, role, name }) => {
    if (!classId || !userId) return;
    socket.join(classId);
    socket.data = { classId, userId, role, name };

    let map = rooms.get(classId);
    if (!map) {
      map = new Map();
      rooms.set(classId, map);
    }
    map.set(userId, socket.id);
  });

  socket.on('signal', (msg) => {
    try {
      const { classId, to, from } = msg || {};
      if (!classId) return;
      if (to) {
        const map = rooms.get(classId);
        const sid = map?.get(to);
        if (sid) {
          io.to(sid).emit('signal', msg);
        }
      } else {
        // broadcast to room except sender
        socket.to(classId).emit('signal', msg);
      }
    } catch (e) {
      // ignore
    }
  });

  socket.on('end', ({ classId, from }) => {
    if (classId) socket.to(classId).emit('signal', { type: 'end', classId, from });
  });

  socket.on('disconnect', () => {
    const { classId, userId } = socket.data || {};
    if (classId && userId) {
      const map = rooms.get(classId);
      if (map) {
        map.delete(userId);
        if (map.size === 0) rooms.delete(classId);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Signaling server listening on port ${PORT}`));
