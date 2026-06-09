import { useGame } from '../store/gameStore';
import { getHero } from '../game/data/heroes';

export function Winner() {
  const view = useGame((s) => s.view)!;
  const rematch = useGame((s) => s.rematch);
  const leave = useGame((s) => s.leave);

  const champ = view.players.find((p) => p.id === view.winnerId);
  const isHost = view.youId === view.hostId;
  const youWon = view.winnerId === view.youId;
  const ranking = [...view.players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.hp - a.hp);

  return (
    <div className="winner">
      <div className="winner-card">
        <div className="crown">♛</div>
        <h2>{youWon ? 'Victory!' : `${champ?.name ?? 'Nobody'} wins`}</h2>
        {champ && (
          <div className="champ-row">
            <span className="s-dot big" style={{ background: champ.heroId ? getHero(champ.heroId)?.color : '#555' }} />
            <span>{champ.name}</span>
          </div>
        )}
        <ol className="ranking">
          {ranking.map((p, i) => (
            <li key={p.id} className={p.id === view.youId ? 'me' : ''}>
              <span className="rank">#{i + 1}</span>
              <span className="s-dot" style={{ background: p.heroId ? getHero(p.heroId)?.color : '#555' }} />
              <span className="r-name">{p.name}</span>
              <span className="r-hp">{Math.ceil(p.hp)} hp</span>
            </li>
          ))}
        </ol>
        {isHost ? (
          <button className="btn primary big" onClick={rematch}>Back to lobby</button>
        ) : (
          <p className="waiting">Waiting for host…</p>
        )}
        <button className="btn ghost" onClick={leave}>Leave</button>
      </div>
    </div>
  );
}
