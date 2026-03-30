const rooms = {};

const COLORS = [
  '#4f46e5','#0891b2','#059669','#d97706',
  '#dc2626','#7c3aed','#db2777','#0284c7',
  '#65a30d','#ea580c',
];

function code6() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function mkPlayer(id, nickname, idx) {
  return { id, nickname, color: COLORS[idx % COLORS.length], hand: [], connected: true, disconnectedAt: null };
}

function createRoom(hostId, nickname) {
  let code;
  do { code = code6(); } while (rooms[code]);
  rooms[code] = {
    code, hostId,
    phase: 'waiting',
    players: [mkPlayer(hostId, nickname, 0)],
    pile: [], lastPlay: null, currentTurn: null,
    pendingWinner: null, pendingWinnerId: null,
  };
  return rooms[code];
}

function joinRoom(code, pid, nickname) {
  const r = rooms[code];
  if (!r) return { error: 'Room not found' };
  if (r.phase !== 'waiting') return { error: 'Game already started' };
  if (r.players.length >= 10) return { error: 'Room is full' };
  if (r.players.find(p => p.nickname === nickname)) return { error: 'Nickname taken' };
  r.players.push(mkPlayer(pid, nickname, r.players.length));
  return r;
}

function rejoinRoom(code, nickname, newId) {
  const r = rooms[code];
  if (!r) return { error: 'Room not found' };
  const p = r.players.find(p => p.nickname === nickname);
  if (!p) return { error: 'Player not found' };
  if (p.connected) return { error: 'Nickname already active' };
  p.id = newId; p.connected = true; p.disconnectedAt = null;
  return r;
}

function getRoom(code)       { return rooms[code] || null; }
function getByPlayer(id)     { return Object.values(rooms).find(r => r.players.find(p => p.id === id)) || null; }
function removePlayer(c, id) {
  const r = rooms[c]; if (!r) return;
  r.players = r.players.filter(p => p.id !== id);
  if (!r.players.length) { delete rooms[c]; return; }
  if (r.hostId === id && r.phase === 'waiting') r.hostId = r.players[0].id;
}

module.exports = { createRoom, joinRoom, rejoinRoom, getRoom, getByPlayer, removePlayer };
