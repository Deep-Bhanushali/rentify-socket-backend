import { createServer } from 'http';
import { Server } from 'socket.io';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

// Import shared configuration
import { JWT_SECRET, getUserRoom } from '../config.js';

const port = process.env.PORT || 3001;

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// Socket.IO middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    console.log('❌ No token provided for socket auth');
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.user = decoded;
    console.log('✅ Socket authentication successful for user:', decoded.userId);
    next();
  } catch (err) {
    console.log('❌ Socket authentication failed:', err.message);
    next(new Error('Authentication error'));
  }
});

// Handle socket connections
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected via socket`);

  socket.join(getUserRoom(socket.userId));

  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
  });
  socket.on('ping', (callback) => {
    callback('pong');
  });
});

httpServer.listen(port, () => {
  console.log(`Socket.IO server running on port ${port}`);
});
