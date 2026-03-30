export default function OpponentRow({ players, currentTurn, myId }) {
  const opp = players.filter(p => p.id !== myId);
  if (!opp.length) return null;
  return (
    <div className="opp-row">
      {opp.map(p => (
        <div key={p.id} className={`opp-chip${p.id === currentTurn ? ' is-turn' : ''}${!p.connected ? ' dc' : ''}`}>
          {p.id === currentTurn && <span className="turn-dot" />}
          <span className="av av-sm" style={{ background: p.color }}>
            {p.nickname.slice(0,2).toUpperCase()}
          </span>
          <span className="opp-name">{p.nickname}</span>
          <span className="opp-cnt">{p.cardCount}</span>
        </div>
      ))}
    </div>
  );
}
