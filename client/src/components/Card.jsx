export default function Card({ card, selected, onClick, faceDown = false, style = {} }) {
  if (faceDown) return <div className="pcb" style={style} />;
  const red = card.suit === '♥' || card.suit === '♦';
  return (
    <div
      className={`pc ${red ? 'pc-red' : 'pc-black'} ${selected ? 'on' : ''}`}
      onClick={onClick}
      style={style}
    >
      <div className="pc-r">{card.rank}</div>
      <div className="pc-s">{card.suit}</div>
      <div className="pc-c">{card.suit}</div>
      <div className="pc-b">{card.rank}</div>
    </div>
  );
}
