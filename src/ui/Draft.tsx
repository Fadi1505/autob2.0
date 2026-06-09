import { useGame } from '../store/gameStore';
import { getHero } from '../game/data/heroes';
import { getAbility } from '../game/data/abilities';
import { useCountdown } from './hooks';
import { Tooltip } from './Tooltip';
import { AbilityTooltip } from './tooltips';

export function Draft() {
  const view = useGame((s) => s.view)!;
  const pickHero = useGame((s) => s.pickHero);
  const rerollDraft = useGame((s) => s.rerollDraft);
  const seconds = useCountdown(view.phaseEndsAt);

  const you = view.players.find((p) => p.id === view.youId)!;
  const options = you.draftOptions ?? [];
  const picked = you.heroId;

  return (
    <div className="draft">
      <div className="draft-head">
        <h2>Draft your gladiator</h2>
        <div className="timer">{seconds}s</div>
      </div>

      <div className="hero-grid">
        {options.map((id) => {
          const hero = getHero(id);
          if (!hero) return null;
          const selected = picked === id;
          return (
            <button
              key={id}
              className={`hero-card ${selected ? 'selected' : ''}`}
              style={{ borderColor: hero.color }}
              onClick={() => pickHero(id)}
            >
              <div className="hero-portrait" style={{ background: hero.color }} />
              <div className="hero-name">{hero.name}</div>
              <div className="hero-cat">{hero.category}</div>
              <p className="hero-desc">{hero.description}</p>
              <div className="hero-abilities">
                {hero.abilityIds.map((aid) => {
                  const a = getAbility(aid);
                  if (!a) return null;
                  return (
                    <Tooltip key={aid} content={<AbilityTooltip abilityId={aid} />}>
                      <div className="ability-line">
                        <span className={`kind ${a.kind}`}>{a.kind}</span> {a.name}
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      <div className="draft-actions">
        <button className="btn" onClick={rerollDraft}>
          Reroll (1 free)
        </button>
        <div className="picked-row">
          {view.players.map((p) => (
            <span key={p.id} className={`pick-chip ${p.heroId ? 'done' : ''}`} title={p.name}>
              {p.heroId ? '✓' : '…'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
