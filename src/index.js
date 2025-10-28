import { createServer } from 'http';
import { Server } from 'socket.io';
import pkg from 'jsonwebtoken';
const { verify } = pkg;

// Import shared configuration
import { JWT_SECRET, getUserRoom } from '../config.js';

const port = process.env.PORT || 3001;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});
  
// Handle HTTP requests
httpServer.on('request', (req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/emit-notification') {
    console.log('🔄 Received emit-notification request');
    parseBody(req)
      .then(data => {
        const { userId, notification } = data;
        console.log(`📢 Emitting notification to user ${userId}:`, notification.title);

        if (!userId || !notification) {
          throw new Error('Missing userId or notification');
        }

        // Emit to user room
        const room = getUserRoom(userId);
        io.to(room).emit('notification', notification);

        console.log(`✓ Notification emitted to room: ${room}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      })
      .catch(error => {
        console.error('❌ Error emitting notification:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
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
