const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

dotenv.config();

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make io accessible in routes
app.set('io', io);

// DB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mern-lms')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/users', require('./routes/users'));
app.use('/api/discussions', require('./routes/discussions'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/progress', require('./routes/progress'));
// Socket.io for live class and chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-live', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('send-message', ({ roomId, message, senderName }) => {
    io.to(roomId).emit('receive-message', { message, senderName });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
