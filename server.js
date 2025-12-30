// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Serve static files from /public
app.use(express.static('public'));

// ---------------- Game State ----------------
let players = []; // { username, socketId }
let adminId = null;
let currentDrawer = null;
let drawerWord = '';

const wordsPool = [
  'Apple', 'Dog', 'Car', 'House', 'Tree',
  'Cat', 'Sun', 'Moon', 'Ball', 'Star'
];

// ---------------- Socket.IO ----------------
io.on('connection', (socket) => {
  console.log(`🟢 New connection: ${socket.id}`);

  // --------- Player Joins ---------
  socket.on('join', (username) => {
    if (!username) username = 'Player';

    // Add player if not already in list
    players.push({ username, socketId: socket.id });
    console.log(`👤 ${username} joined`);

    // Assign admin if first player
    if (!adminId) adminId = socket.id;
    if (socket.id === adminId) socket.emit('youAreAdmin');

    // Notify everyone
    io.emit('playerJoined', username);
    io.emit('playersUpdate', players.map(p => ({ username: p.username })));
  });

  // --------- Chat Message ---------
  socket.on('chatMessage', (msg) => {
    const player = players.find(p => p.socketId === socket.id);
    const username = player ? player.username : 'Player';
    io.emit('chatMessage', { username, message: msg });
  });

  // --------- Start Game (Admin Only) ---------
  socket.on('startGame', () => {
    if (socket.id !== adminId) return; // Only admin can start

    console.log('🎮 Game started by admin');

    // Pick random drawer
    const drawer = players[Math.floor(Math.random() * players.length)];
    currentDrawer = drawer.username;

    // Generate random 3 words
    const shuffled = wordsPool.sort(() => 0.5 - Math.random());
    const wordOptions = shuffled.slice(0, 3);

    // Notify drawer only
    io.to(drawer.socketId).emit('wordOptions', wordOptions);

    // Announce to all
    io.emit('setDrawer', currentDrawer);
    io.emit('drawerChoosing', currentDrawer);
  });

  // --------- Drawer Chooses Word ---------
  socket.on('wordChosen', (word) => {
    const drawer = players.find(p => p.socketId === socket.id);
    if (!drawer) return;

    drawerWord = word;
    console.log(`✏️ ${drawer.username} chose the word: ${word}`);

    // Notify drawer
    io.to(drawer.socketId).emit('wordChosenConfirm', word);

    // Masked version for others
    const masked = '_'.repeat(word.length);
    socket.broadcast.emit('wordMask', masked);
  });

  // --------- Drawing Sync ---------
  socket.on('drawBuffer', (data) => {
    socket.broadcast.emit('drawBuffer', data);
  });

  // --------- Disconnect ---------
  socket.on('disconnect', () => {
    const player = players.find(p => p.socketId === socket.id);
    if (!player) return;

    console.log(`🔴 ${player.username} disconnected`);

    // Remove player
    players = players.filter(p => p.socketId !== socket.id);

    // Notify everyone
    io.emit('playersUpdate', players.map(p => ({ username: p.username })));

    // Reassign admin if needed
    if (socket.id === adminId && players.length > 0) {
      adminId = players[0].socketId;
      io.to(adminId).emit('youAreAdmin');
    }

    // If drawer left
    if (player.username === currentDrawer) {
      currentDrawer = null;
      io.emit('drawerChoosing', 'Waiting for next drawer...');
    }
  });
});

// ---------------- Server Start ----------------
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
