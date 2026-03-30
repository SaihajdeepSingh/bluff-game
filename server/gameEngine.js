const { createDeck, shuffleDeck } = require('./utils/deck');

const MAX_PLAY = 4;
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function startGame(room) {
  if (room.players.length < 2) return { error: 'Need at least 2 players' };
  const deck = shuffleDeck(createDeck());
  deck.forEach((card, i) => room.players[i % room.players.length].hand.push(card));
  room.phase = 'playing';
  room.pile = []; room.lastPlay = null;
  room.pendingWinner = null; room.pendingWinnerId = null;
  room.passCount = 0;
  room.currentTurn = room.players[0].id;
  return room;
}

function validatePlay(room, pid, cards, declaredRank, count) {
  if (room.phase !== 'playing')      return { error: 'Game not in progress' };
  if (room.currentTurn !== pid)      return { error: 'Not your turn' };
  if (!cards || cards.length === 0)  return { error: 'Select at least one card' };
  if (cards.length > MAX_PLAY)       return { error: 'Max ' + MAX_PLAY + ' cards per play' };
  if (cards.length !== count)        return { error: 'Card count mismatch' };
  if (!RANKS.includes(declaredRank)) return { error: 'Invalid rank' };
  const player = room.players.find(p => p.id === pid);
  if (!player) return { error: 'Player not found' };
  for (const c of cards) {
    if (!player.hand.find(h => h.rank === c.rank && h.suit === c.suit))
      return { error: 'You do not own that card' };
  }
  return null;
}

function playCards(room, pid, cards, declaredRank, count) {
  if (room.pendingWinner) {
    room.phase = 'finished';
    room.winner = room.pendingWinner;
    return { room, confirmedWin: true };
  }
  const player = room.players.find(p => p.id === pid);
  for (const c of cards) {
    const idx = player.hand.findIndex(h => h.rank === c.rank && h.suit === c.suit);
    player.hand.splice(idx, 1);
  }
  room.passCount = 0;
  room.pile.push(...cards);
  room.lastPlay = { pid, nickname: player.nickname, declaredRank, count, cardCount: cards.length };
  if (player.hand.length === 0) {
    room.pendingWinner = player.nickname;
    room.pendingWinnerId = pid;
  }
  room.currentTurn = nextTurn(room, pid);
  return { room, confirmedWin: false };
}

function resolveBluff(room, challengerId) {
  if (!room.lastPlay)           return { error: 'Nothing to challenge' };
  if (room.phase !== 'playing') return { error: 'Game not in progress' };

  const last       = room.lastPlay;
  const pile       = [...room.pile];
  const actual     = pile.slice(pile.length - last.cardCount);
  const isBluff    = actual.some(c => c.rank !== last.declaredRank);
  const claimerId  = last.pid;
  const claimer    = room.players.find(p => p.id === claimerId);
  const challenger = room.players.find(p => p.id === challengerId);

  room.pile = [];
  room.lastPlay = null;
  room.passCount = 0;

  if (isBluff) {
    // Claimer lied → claimer takes pile, challenger plays next
    claimer.hand.push(...pile);
    room.pendingWinner = null;
    room.pendingWinnerId = null;
    room.currentTurn = challengerId;
  } else {
    // Claimer was honest → challenger takes pile, CLAIMER plays next
    challenger.hand.push(...pile);
    room.currentTurn = claimerId; // ← honest player goes next

    if (room.pendingWinnerId === claimerId) {
      room.phase = 'finished';
      room.winner = room.pendingWinner;
    }
    room.pendingWinner = null;
    room.pendingWinnerId = null;
  }

  return {
    room, isBluff, actualCards: actual,
    loserNickname:      isBluff ? claimer.nickname : challenger.nickname,
    claimerNickname:    claimer.nickname,
    challengerNickname: challenger.nickname,
    nextPlayerNickname: isBluff ? challenger.nickname : claimer.nickname,
  };
}

function passTurn(room, pid) {
  if (room.phase !== 'playing') return { error: 'Game not in progress' };
  if (room.currentTurn !== pid)  return { error: 'Not your turn' };

  room.passCount = (room.passCount || 0) + 1;
  const connectedCount = room.players.filter(p => p.connected).length;

  // If every connected player has passed consecutively, auto-flush the pile
  const flushed = room.passCount >= connectedCount && room.pile.length > 0;
  if (flushed) {
    room.pile        = [];
    room.lastPlay    = null;
    room.passCount   = 0;
    room.pendingWinner   = null;
    room.pendingWinnerId = null;
  }

  room.currentTurn = nextTurn(room, pid);
  return { room, flushed };
}

function nextTurn(room, currentId) {
  const alive = room.players.filter(p => p.connected);
  const idx = alive.findIndex(p => p.id === currentId);
  return alive[(idx + 1) % alive.length].id;
}

module.exports = { startGame, validatePlay, playCards, resolveBluff, passTurn, MAX_PLAY };
