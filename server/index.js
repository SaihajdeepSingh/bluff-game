const express = require('express');
const http    = require('http');
const cors    = require('cors');
const path    = require('path');
const { Server } = require('socket.io');
const { createRoom, joinRoom, rejoinRoom, getRoom, getByPlayer, removePlayer } = require('./roomManager');
const { startGame, validatePlay, playCards, resolveBluff } = require('./gameEngine');

const app    = express();
const server = http.createServer(app);
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Only send the requesting player their own hand
function clean(room, pid) {
  if (!room) return null;
  return {
    ...room,
    players: room.players.map(p => ({
      id: p.id, nickname: p.nickname, color: p.color,
      cardCount: p.hand.length, connected: p.connected,
      hand: p.id === pid ? p.hand : [],
    })),
  };
}

io.on('connection', socket => {
  console.log(`+ ${socket.id}`);

  // CREATE ROOM
  socket.on('create-room', ({ nickname }) => {
    try {
      const room = createRoom(socket.id, nickname);
      socket.join(room.code);
      socket.emit('room-created', { code: room.code, room: clean(room, socket.id) });
    } catch(e) { console.error('create-room', e.message); }
  });

  // JOIN ROOM (also handles mid-game rejoin)
  socket.on('join-room', ({ code, nickname }) => {
    try {
      const upper = code.toUpperCase();
      const room  = getRoom(upper);
      if (room && room.phase !== 'waiting') {
        const ex = room.players.find(p => p.nickname === nickname);
        if (ex && !ex.connected) {
          const r = rejoinRoom(upper, nickname, socket.id);
          if (r.error) { socket.emit('join-error', { message: r.error }); return; }
          socket.join(upper);
          socket.emit('rejoined', { code: upper, room: clean(r, socket.id) });
          io.to(upper).emit('player-rejoined', { nickname, room: clean(r, socket.id) });
          return;
        }
        socket.emit('join-error', { message: 'Game already in progress' });
        return;
      }
      const result = joinRoom(upper, socket.id, nickname);
      if (result.error) { socket.emit('join-error', { message: result.error }); return; }
      socket.join(upper);
      socket.emit('room-joined',  { code: upper, room: clean(result, socket.id) });
      io.to(upper).emit('room-updated', { room: clean(result, socket.id) });
    } catch(e) { console.error('join-room', e.message); }
  });

  // EXPLICIT REJOIN (from localStorage on page load)
  socket.on('rejoin-room', ({ code, nickname }) => {
    try {
      const upper = code.toUpperCase();
      const r = rejoinRoom(upper, nickname, socket.id);
      if (r.error) { socket.emit('join-error', { message: r.error }); return; }
      socket.join(upper);
      socket.emit('rejoined', { code: upper, room: clean(r, socket.id) });
      io.to(upper).emit('player-rejoined', { nickname, room: clean(r, socket.id) });
    } catch(e) { console.error('rejoin-room', e.message); }
  });

  // START GAME
  socket.on('start-game', ({ code }) => {
    try {
      const room = getRoom(code);
      if (!room || room.hostId !== socket.id) return;
      if (room.players.length < 2) { socket.emit('game-error', { message: 'Need at least 2 players' }); return; }
      const updated = startGame(room);
      if (updated.error) { socket.emit('game-error', { message: updated.error }); return; }
      room.players.forEach(p => io.to(p.id).emit('game-started', { room: clean(room, p.id) }));
    } catch(e) { console.error('start-game', e.message); }
  });

  // PLAY CARDS
  socket.on('play-cards', ({ code, cards, declaredRank, declaredCount }) => {
    try {
      const room = getRoom(code);
      if (!room) return;

      const err = validatePlay(room, socket.id, cards, declaredRank, declaredCount);
      if (err) { socket.emit('play-error', err); return; }

      const result = playCards(room, socket.id, cards, declaredRank, declaredCount);

      if (result.confirmedWin) {
        // pendingWinner's last play was unchallenged — declare game over
        room.players.forEach(p => io.to(p.id).emit('game-updated', { room: clean(room, p.id) }));
        io.to(code).emit('game-over', { winner: room.winner });
        return;
      }

      room.players.forEach(p => io.to(p.id).emit('game-updated', { room: clean(room, p.id) }));

      // Notify all that a player may have won (pending challenge window)
      if (room.pendingWinner) {
        io.to(code).emit('pending-win', { nickname: room.pendingWinner });
      }
    } catch(e) { console.error('play-cards', e.message); }
  });

  // CALL BLUFF
  socket.on('call-bluff', ({ code }) => {
    try {
      const room = getRoom(code);
      if (!room || !room.lastPlay) return;
      if (socket.id === room.lastPlay.pid) { socket.emit('play-error', { error: 'Cannot challenge yourself' }); return; }

      const result = resolveBluff(room, socket.id);
      if (result.error) { socket.emit('play-error', result); return; }

      room.players.forEach(p => io.to(p.id).emit('bluff-result', {
        isBluff:            result.isBluff,
        actualCards:        result.actualCards,
        loserNickname:      result.loserNickname,
        claimerNickname:    result.claimerNickname,
        challengerNickname: result.challengerNickname,
        room:               clean(result.room, p.id),
      }));

      if (result.room.phase === 'finished') {
        io.to(code).emit('game-over', { winner: result.room.winner });
      }
    } catch(e) { console.error('call-bluff', e.message); }
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    console.log(`- ${socket.id}`);
    const room = getByPlayer(socket.id);
    if (!room) return;

    if (room.phase === 'waiting') {
      removePlayer(room.code, socket.id);
      const r = getRoom(room.code);
      if (r) io.to(room.code).emit('room-updated', { room: clean(r, null) });
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    player.connected = false; player.disconnectedAt = Date.now();
    io.to(room.code).emit('player-disconnected', { nickname: player.nickname });

    // Skip turn if it was theirs
    if (room.currentTurn === socket.id) {
      const next = room.players.slice(room.players.findIndex(p => p.id === socket.id) + 1).find(p => p.connected)
                || room.players.find(p => p.connected);
      if (next) {
        room.currentTurn = next.id;
        room.players.filter(p => p.connected).forEach(p =>
          io.to(p.id).emit('game-updated', { room: clean(room, p.id) })
        );
      }
    }

    setTimeout(() => {
      if (!player.connected) {
        removePlayer(room.code, socket.id);
        const r = getRoom(room.code);
        if (r) io.to(room.code).emit('room-updated', { room: clean(r, null) });
      }
    }, 60000);
  });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
