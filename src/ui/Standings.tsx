import { useGame } from '../store/gameStore';
import { getHero } from '../game/data/heroes';
import { Tooltip } from './Tooltip';
import { PlayerTooltip } from './tooltips';

export function Standings() {
  const view = useGame((s) => s.view)!;
  const players = [...view.players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.hp - a.hp);

  return (
    <aside className="standings">
      <h3>Lobby · Round {view.round}</h3>
      <div className="standings-list">
        {players.map((p) => {
          const hero = p.heroId ? getHero(p.heroId) : null;
          const hpRatio = Math.max(0, Math.min(1, p.hp / p.maxHp));
          return (
            <Tooltip
              key={p.id}
              content={
                <PlayerTooltip
                  name={p.name}
                  heroId={p.heroId}
                  hp={p.hp}
                  maxHp={p.maxHp}
                  level={p.level}
                  streak={p.streak}
                  alive={p.alive}
                  isBot={p.isBot}
                />
              }
            >
              <div className={`standing ${p.alive ? '' : 'dead'} ${p.id === view.youId ? 'me' : ''}`}>
                <span className="s-dot" style={{ background: hero?.color ?? '#555' }} />
                <div className="s-main">
                  <div className="s-top">
                    <span className="s-name">{p.name}</span>
                    {p.id === view.youId && <span className="tag you">YOU</span>}
                    {p.isBot && <span className="tag bot">BOT</span>}
                    {p.lastResult === 'win' && <span className="tag win">W</span>}
                    {p.lastResult === 'loss' && <span className="tag loss">L</span>}
                  </div>
                  <div className="s-hpbar">
                    <div className="s-hpfill" style={{ width: `${hpRatio * 100}%` }} />
                  </div>
                </div>
                <div className="s-meta">
                  <span className="s-hp">{Math.ceil(p.hp)}</span>
                  <span className="s-lvl">Lv{p.level}</span>
                </div>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </aside>
  );
}
