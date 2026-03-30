import { useState, useEffect, useRef } from 'react';
import { LogOut, AlertTriangle, Play, Volume2, VolumeX, SkipForward } from 'lucide-react';
import socket from '../socket';
import Card from '../components/Card';
import OpponentRow from '../components/OpponentRow';
import {
  setMuted, isMuted,
  playDealSound, playPileSound, playCardSound,
  playBluffCaughtSound, playSafeSound, playWinSound, playClickSound,
} from '../sounds.js';

const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const MAX   = 4;

export default function GameScreen({ room, setRoom, nickname, roomCode, onLeave }) {
  const [selected, setSelected] = useState([]);
  const [modal,    setModal]    = useState(false);
  const [rank,     setRank]     = useState('');
  const [toast,    setToast]    = useState(null);
  const [over,     setOver]     = useState(null);
  const [reveal,   setReveal]   = useState(null);
  const [pending,  setPending]  = useState(null);
  const [muted,    setMutedUI]  = useState(isMuted());
  const toastRef   = useRef(null);
  const prevCards  = useRef(null);

  const me       = room?.players.find(p => p.nickname === nickname);
  const isMe     = room?.currentTurn === me?.id;
  const current  = room?.players.find(p => p.id === room?.currentTurn);
  const canBluff = room?.lastPlay && room.lastPlay.pid !== me?.id;

  // Play deal sound when hand changes size significantly (game start)
  useEffect(() => {
    const handLen = me?.hand?.length ?? 0;
    if (prevCards.current === null && handLen > 0) {
      playDealSound(Math.min(handLen, 8));
    }
    prevCards.current = handLen;
  }, [me?.hand?.length]);

  useEffect(() => {
    const onUpdate = ({ room: r }) => {
      setRoom(r);
      setSelected([]);
      // Play pile sound if pile grew
      playPileSound();
    };

    const onPending = ({ nickname: n }) => setPending(n);

    const onBluff = ({ isBluff, actualCards, loserNickname, claimerNickname, challengerNickname, nextPlayerNickname, room: r }) => {
      setRoom(r); setSelected([]);
      setPending(null);
      setReveal(actualCards);

      const nextLabel = nextPlayerNickname ? ` ${nextPlayerNickname} plays next.` : '';
      if (isBluff) {
        playBluffCaughtSound();
        flash(
          `Bluff! ${claimerNickname} lied — ${loserNickname} takes the pile.${nextLabel}`,
          'bluff'
        );
      } else {
        playSafeSound();
        flash(
          `Safe! ${claimerNickname} was honest — ${loserNickname} takes the pile.${nextLabel}`,
          'safe'
        );
      }
      setTimeout(() => setReveal(null), 3500);
    };

    const onOver  = ({ winner }) => { setPending(null); setOver(winner); playWinSound(); };
    const onErr   = ({ error })  => flash(error, 'info');
    const onDc    = ({ nickname: n }) => flash(`${n} disconnected — 60s to rejoin`, 'info');
    const onPassed = ({ nickname: n, passCount, totalPlayers }) =>
      flash(`${n} passed (${passCount}/${totalPlayers})`, 'info');
    const onFlushed = ({ message }) => {
      playPileSound();
      flash(message, 'info');
    };

    socket.on('game-updated',        onUpdate);
    socket.on('pending-win',         onPending);
    socket.on('bluff-result',        onBluff);
    socket.on('game-over',           onOver);
    socket.on('play-error',          onErr);
    socket.on('player-disconnected', onDc);
    socket.on('player-passed',       onPassed);
    socket.on('pile-flushed',        onFlushed);

    return () => {
      socket.off('game-updated',        onUpdate);
      socket.off('pending-win',         onPending);
      socket.off('bluff-result',        onBluff);
      socket.off('game-over',           onOver);
      socket.off('play-error',          onErr);
      socket.off('player-disconnected', onDc);
      socket.off('player-passed',       onPassed);
      socket.off('pile-flushed',        onFlushed);
    };
  }, []);

  function flash(msg, type) {
    clearTimeout(toastRef.current);
    setToast({ msg, type });
    toastRef.current = setTimeout(() => setToast(null), 4200);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedUI(next);
    playClickSound();
  }

  function toggle(card) {
    if (!isMe) return;
    const key = card.rank + card.suit;
    setSelected(prev => {
      const has = prev.find(c => c.rank + c.suit === key);
      if (has) { playClickSound(); return prev.filter(c => c.rank + c.suit !== key); }
      if (prev.length >= MAX) { flash(`Max ${MAX} cards per play`, 'info'); return prev; }
      playCardSound();
      return [...prev, card];
    });
  }

  function submit() {
    if (!rank) return;
    playPileSound();
    socket.emit('play-cards', { code: roomCode, cards: selected, declaredRank: rank, declaredCount: selected.length });
    setModal(false); setRank('');
  }

  function callBluff() {
    playClickSound();
    socket.emit('call-bluff', { code: roomCode });
  }

  function passTurn() {
    playClickSound();
    socket.emit('pass-turn', { code: roomCode });
  }

  // ── GAME OVER ─────────────────────────────────────
  if (over) return (
    <div className="over-screen">
      <div className="over-card">
        <div className="over-trophy">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#100800" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/>
            <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/>
            <path d="M8 21h8"/><path d="M12 17v4"/>
            <path d="M6 3v6a6 6 0 0 0 12 0V3"/>
          </svg>
        </div>
        <div className="over-title">{over} Wins</div>
        <div className="over-sub">
          {over === nickname ? 'Masterful bluffing. Well played.' : 'Better luck next time.'}
        </div>
        <div className="over-actions">
          <button className="btn btn-ghost" onClick={onLeave}>Back to Home</button>
        </div>
      </div>
    </div>
  );

  // ── MAIN GAME ──────────────────────────────────────
  return (
    <div className="game-root">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* Topbar */}
      <div className="topbar">
        <span className="tb-logo">Bluff</span>
        <span className="tb-code">{roomCode}</span>
        <div className="tb-right">
          <button
            className={`mute-btn ${muted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button className="tb-btn" onClick={onLeave} title="Leave">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Center */}
      <div style={{ display:'flex', flexDirection:'column', gap:'.5rem', overflow:'auto' }}>
        <OpponentRow players={room?.players || []} currentTurn={room?.currentTurn} myId={me?.id} />

        <div className="felt-zone">
          <div className="felt-table">
            <div className="felt-inner">
              <div className={`turn-pill ${isMe ? 'mine' : 'other'}`}>
                {isMe ? 'Your Turn' : `${current?.nickname}'s Turn`}
              </div>

              <div className="pile-area">
                {room?.pile?.length > 0 ? (
                  [...Array(Math.min(5, room.pile.length))].map((_, i) => (
                    <div key={i} className="pile-card" style={{
                      transform: `rotate(${(i-2)*7}deg) translateX(${(i-2)*5}px)`,
                      zIndex: i,
                    }}>
                      <div className="pcb" />
                    </div>
                  ))
                ) : (
                  <span className="pile-empty">Empty Pile</span>
                )}
              </div>

              {room?.pile?.length > 0 && (
                <span className="pile-lbl">
                  {room.pile.length} {room.pile.length === 1 ? 'card' : 'cards'}
                </span>
              )}
            </div>

            {pending && (
              <div className="pending-banner">
                {pending} played last card — call bluff or play
              </div>
            )}
          </div>

          {/* Reveal */}
          {reveal && (
            <div className="last-play" style={{ flexDirection:'column', gap:'.38rem' }}>
              <span style={{ fontSize:'.62rem', color:'var(--t3)', letterSpacing:'1.5px', textTransform:'uppercase' }}>
                Cards played
              </span>
              <div className="reveal-row">
                {reveal.map((c, i) => {
                  const r = c.suit === '♥' || c.suit === '♦';
                  return (
                    <div key={i} className={`pc ${r ? 'pc-red':'pc-black'}`} style={{ cursor:'default', animation:'none', animationDelay:`${i*0.07}s` }}>
                      <div className="pc-r">{c.rank}</div>
                      <div className="pc-s">{c.suit}</div>
                      <div className="pc-c">{c.suit}</div>
                      <div className="pc-b">{c.rank}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Last play */}
          {!reveal && room?.lastPlay && (
            <div className="last-play">
              <span><strong>{room.lastPlay.nickname}</strong> declared</span>
              <span className="lp-rank">{room.lastPlay.count} × {room.lastPlay.declaredRank}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="actions">
        <button
          className="btn btn-gold btn-pill"
          disabled={!isMe || selected.length === 0}
          onClick={() => { playClickSound(); setModal(true); }}
        >
          <Play size={13} />
          {selected.length > 0 ? `Play ${selected.length} Card${selected.length === 1 ? '' : 's'}` : 'Play Cards'}
        </button>

        {canBluff && (
          <button className="btn btn-red btn-pill" onClick={callBluff}>
            <AlertTriangle size={13} /> Call Bluff
          </button>
        )}

        <button
          className="btn btn-pass btn-pill"
          disabled={!isMe}
          onClick={passTurn}
          title="Pass your turn. If all players pass, the pile is discarded."
        >
          <SkipForward size={13} /> Pass
        </button>
      </div>

      {/* Hand */}
      <div className="hand-zone">
        <div className="hand-hdr">
          Your Hand — {me?.hand?.length ?? 0} {me?.hand?.length === 1 ? 'card' : 'cards'}
          {selected.length > 0 && <span style={{ color:'var(--g1)', marginLeft:8 }}>· {selected.length}/{MAX} selected</span>}
        </div>
        <div className="hand-cards">
          {!me?.hand?.length && <span style={{ color:'var(--t4)', fontSize:'.76rem', padding:'.5rem' }}>No cards</span>}
          {me?.hand?.map((card, i) => (
            <Card
              key={card.rank + card.suit + i}
              card={card}
              selected={!!selected.find(c => c.rank + c.suit === card.rank + card.suit)}
              onClick={() => toggle(card)}
            />
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="overlay" onClick={() => { setModal(false); setRank(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Declare Rank</div>
            <div className="modal-sub">
              Playing {selected.length} {selected.length === 1 ? 'card' : 'cards'} — what rank will you claim?
            </div>
            <div className="rank-grid">
              {RANKS.map(r => (
                <button
                  key={r}
                  className={`rank-btn${rank === r ? ' chosen' : ''}`}
                  onClick={() => { playClickSound(); setRank(r); }}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="modal-btns">
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => { setModal(false); setRank(''); }}>Cancel</button>
              <button className="btn btn-gold" style={{ flex:1 }} disabled={!rank} onClick={submit}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
