import { useEffect, useState } from 'react';
import { Plus, LogIn, Copy, Check, Users, Play } from 'lucide-react';
import socket from './socket';
import GameScreen from './screens/GameScreen';
import { playClickSound, playDealSound } from './sounds.js';

export default function App() {
  const [screen,    setScreen]    = useState('home');
  const [nickname,  setNick]      = useState('');
  const [roomCode,  setCode]      = useState('');
  const [room,      setRoom]      = useState(null);
  const [error,     setError]     = useState('');
  const [rejoining, setRejoining] = useState(false);
  const [copied,    setCopied]    = useState(false);

  useEffect(() => {
    const saved = {
      code:     localStorage.getItem('bluff_code'),
      nickname: localStorage.getItem('bluff_nickname'),
    };

    const onRoomCreated = ({ code, room }) => {
      const me = room.players.find(p => p.id === socket.id);
      ls('set', code, me?.nickname || '');
      setCode(code); setRoom(room); setScreen('lobby');
    };
    const onRoomJoined = ({ code, room }) => {
      const me = room.players.find(p => p.id === socket.id);
      ls('set', code, me?.nickname || '');
      setCode(code); setRoom(room); setScreen('lobby');
    };
    const onRoomUpdated    = ({ room }) => setRoom(room);
    const onJoinError      = ({ message }) => { setError(message); setRejoining(false); ls('clear'); };
    const onGameStarted    = ({ room }) => {
      setRoom(room); setScreen('game');
      // Deal sound after short delay so screen transition finishes
      setTimeout(() => playDealSound(6), 300);
    };
    const onPlayerRejoined = ({ room }) => setRoom(room);
    const onRejoined       = ({ code, room }) => {
      const me = room.players.find(p => p.id === socket.id);
      setRejoining(false); setCode(code); setRoom(room);
      if (me) setNick(me.nickname);
      setScreen(room.phase === 'playing' ? 'game' : 'lobby');
    };

    socket.on('room-created',    onRoomCreated);
    socket.on('room-joined',     onRoomJoined);
    socket.on('room-updated',    onRoomUpdated);
    socket.on('join-error',      onJoinError);
    socket.on('game-started',    onGameStarted);
    socket.on('player-rejoined', onPlayerRejoined);
    socket.on('rejoined',        onRejoined);

    if (saved.code && saved.nickname) {
      setRejoining(true); setNick(saved.nickname); setCode(saved.code);
      const emit = () => socket.emit('rejoin-room', { code: saved.code, nickname: saved.nickname });
      socket.connected ? emit() : socket.once('connect', emit);
    }

    return () => {
      socket.off('room-created',    onRoomCreated);
      socket.off('room-joined',     onRoomJoined);
      socket.off('room-updated',    onRoomUpdated);
      socket.off('join-error',      onJoinError);
      socket.off('game-started',    onGameStarted);
      socket.off('player-rejoined', onPlayerRejoined);
      socket.off('rejoined',        onRejoined);
    };
  }, []);

  function ls(op, code, nick) {
    if (op === 'set') {
      localStorage.setItem('bluff_code', code);
      localStorage.setItem('bluff_nickname', nick);
    } else {
      localStorage.removeItem('bluff_code');
      localStorage.removeItem('bluff_nickname');
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    playClickSound();
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  function createRoom() {
    if (!nickname.trim()) return setError('Enter a nickname');
    playClickSound();
    setError('');
    socket.emit('create-room', { nickname: nickname.trim() });
  }

  function joinRoom() {
    if (!nickname.trim()) return setError('Enter a nickname');
    if (!roomCode.trim()) return setError('Enter a room code');
    playClickSound();
    setError('');
    socket.emit('join-room', { code: roomCode.trim().toUpperCase(), nickname: nickname.trim() });
  }

  const isHost = room?.hostId === room?.players?.find(p => p.nickname === nickname)?.id;

  // ── RECONNECTING ──────────────────────────────────
  if (rejoining) return (
    <div className="reco">
      <div className="spinner" />
      <p style={{ color:'var(--t3)', fontSize:'.87rem' }}>Rejoining your game...</p>
      <button onClick={() => { ls('clear'); setRejoining(false); }}
        style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:'.76rem', marginTop:'.2rem' }}>
        Cancel
      </button>
    </div>
  );

  // ── HOME ──────────────────────────────────────────
  if (screen === 'home') return (
    <div className="screen">
      <div className="home-panel">
        <div className="brand">
          <div className="brand-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#100800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3"/>
              <path d="M12 4v16M2 10h20M2 14h20"/>
            </svg>
          </div>
          <div className="brand-name">BLUFF</div>
          <div className="brand-tag">The Art of Deception</div>
        </div>

        <div className="field">
          <label className="flabel">Your Name</label>
          <input
            className="finput" placeholder="Enter nickname"
            value={nickname} maxLength={16} autoComplete="off"
            onChange={e => { setNick(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && createRoom()}
          />
        </div>

        <button className="btn btn-gold" onClick={createRoom}>
          <Plus size={15} /> Create Room
        </button>

        <div className="divider">or join existing</div>

        <div className="field">
          <label className="flabel">Room Code</label>
          <input
            className="finput finput--code" placeholder="ABC123"
            value={roomCode} maxLength={6} autoComplete="off"
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && joinRoom()}
          />
        </div>

        <button className="btn btn-outline" onClick={joinRoom}>
          <LogIn size={15} /> Join Room
        </button>

        {error && <div className="err-msg">{error}</div>}
      </div>
    </div>
  );

  // ── LOBBY ─────────────────────────────────────────
  if (screen === 'lobby') return (
    <div className="screen">
      <div className="lobby-wrap">
        <div className="lobby-heading">
          <div className="lobby-title">Waiting Room</div>
          <div className="lobby-sub">Share the code with your friends</div>
        </div>

        <div className="codebox">
          <div className="cblabel">Room Code</div>
          <div className="cbval">{roomCode}</div>
          <button className="cbcopy" onClick={copyCode}>
            {copied ? <><Check size={11}/> Copied</> : <><Copy size={11}/> Copy Code</>}
          </button>
        </div>

        <div className="plist">
          <div className="plist-head">
            <span>Players</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>
              <Users size={11}/> {room?.players.length}/10
            </span>
          </div>
          {room?.players.map(p => (
            <div key={p.id} className="prow">
              <span className="av av-md" style={{ background: p.color }}>
                {p.nickname.slice(0,2).toUpperCase()}
              </span>
              <span className="prow-name">{p.nickname}</span>
              {p.id === room.hostId && <span className="badge badge-gold">Host</span>}
              {!p.connected       && <span className="badge badge-red">Away</span>}
            </div>
          ))}
        </div>

        {isHost && (
          <button className="btn btn-gold"
            disabled={room?.players.length < 2}
            onClick={() => { playClickSound(); socket.emit('start-game', { code: roomCode }); }}>
            <Play size={15} />
            {room?.players.length < 2 ? 'Waiting for players...' : 'Start Game'}
          </button>
        )}

        <button className="btn btn-ghost"
          onClick={() => { playClickSound(); ls('clear'); setScreen('home'); setRoom(null); setCode(''); }}>
          Leave Room
        </button>
      </div>
    </div>
  );

  // ── GAME ──────────────────────────────────────────
  if (screen === 'game') return (
    <GameScreen
      room={room} setRoom={setRoom}
      nickname={nickname} roomCode={roomCode}
      onLeave={() => { ls('clear'); setScreen('home'); setRoom(null); }}
    />
  );
}
