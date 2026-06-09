import { useGame } from '../store/gameStore';
import { getHero } from '../game/data/heroes';
import { getAbility } from '../game/data/abilities';
import { getCard } from '../game/data/cards';
import { SECTS, SECT_ORDER, SECT_THRESHOLDS, sectTier } from '../game/data/sects';
import { buildGladiator } from '../game/build';
import { useCountdown } from './hooks';
import type { SectId } from '../game/types';
import { Tooltip } from './Tooltip';
import { StatTooltip, SectTooltip, AbilityTooltip, CardTooltip, EconomyTooltip } from './tooltips';
import { STAT_META, fmtStat, type StatKey } from './tooltips/statMeta';
import { audio } from '../audio/AudioManager';

const SHOWN_STATS: StatKey[] = [
  'maxHp', 'attackDamage', 'attackSpeed', 'critChance', 'evadeChance',
  'damageReductionPct', 'hpRegen', 'lifesteal', 'abilityPower', 'reflect',
];

export function Shop() {
  const view = useGame((s) => s.view)!;
  const buyCard = useGame((s) => s.buyCard);
  const rerollShop = useGame((s) => s.rerollShop);
  const ready = useGame((s) => s.ready);
  const seconds = useCountdown(view.phaseEndsAt);

  const you = view.players.find((p) => p.id === view.youId)!;
  const hero = you.heroId ? getHero(you.heroId) : null;
  const build = you.heroId ? buildGladiator(you.heroId, you.ownedCardIds ?? []) : null;
  const offers = you.shopOffers ?? [];

  return (
    <div className="shop">
      <div className="shop-left">
        <div className="glad-panel">
          <div className="glad-head">
            <span className="glad-dot" style={{ background: hero?.color }} />
            <div>
              <div className="glad-name">{hero?.name ?? 'No hero'}</div>
              <div className="glad-sub">Level {you.level} · {you.cardCount} cards</div>
            </div>
          </div>
          {build && you.heroId && (
            <div className="stat-grid">
              {SHOWN_STATS.map((key) => (
                <Tooltip
                  key={key}
                  content={
                    <StatTooltip
                      statKey={key}
                      heroId={you.heroId!}
                      ownedCardIds={you.ownedCardIds ?? []}
                      sectPoints={you.sectPoints}
                    />
                  }
                >
                  <div className="stat">
                    <span className="stat-label">{STAT_META[key].label}</span>
                    <span className="stat-value">{fmtStat(key, build.stats[key])}</span>
                  </div>
                </Tooltip>
              ))}
            </div>
          )}
          <div className="glad-abilities">
            {(build?.abilityIds ?? []).map((aid) => {
              const a = getAbility(aid);
              if (!a) return null;
              return (
                <Tooltip key={aid} content={<AbilityTooltip abilityId={aid} />}>
                  <span className={`abchip ${a.kind}`}>{a.name}</span>
                </Tooltip>
              );
            })}
          </div>
        </div>

        <div className="sect-panel">
          <h4>Sects</h4>
          {SECT_ORDER.map((sid) => (
            <Tooltip key={sid} content={<SectTooltip sectId={sid} points={you.sectPoints[sid] ?? 0} />}>
              <SectBar sid={sid} points={you.sectPoints[sid] ?? 0} />
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="shop-main">
        <div className="shop-bar">
          <Tooltip content={<EconomyTooltip gold={you.gold} streak={you.streak} round={view.round} />}>
            <div className="gold">⦿ {you.gold} gold</div>
          </Tooltip>
          <div className="timer">{seconds}s</div>
          <button className="btn" onClick={() => { audio.play('click'); rerollShop(); }} disabled={you.gold < 2}>Reroll (2)</button>
          <button
            className={`btn ${you.ready ? 'ok' : 'primary'}`}
            onClick={() => { audio.play('click'); ready(); }}
            disabled={you.ready}
          >
            {you.ready ? 'Ready ✓' : 'Ready'}
          </button>
        </div>

        <div className="card-row">
          {offers.length === 0 && <div className="empty">Shop empty — reroll for more.</div>}
          {offers.map((cid) => {
            const c = getCard(cid);
            if (!c) return null;
            const sect = SECTS[c.sect];
            const canBuy = you.gold >= c.cost;
            return (
              <div key={cid} className={`shop-card ${c.rarity}`} style={{ borderTopColor: sect.color }}>
                <div className="sc-head">
                  <span className="sc-sect" style={{ color: sect.color }}>{sect.name}</span>
                  <span className={`sc-rarity ${c.rarity}`}>{c.rarity}</span>
                </div>
                <Tooltip content={<CardTooltip cardId={cid} />}>
                  <div className="sc-name">{c.name}</div>
                </Tooltip>
                <div className="sc-desc">{c.description}</div>
                <button className="btn small primary" disabled={!canBuy} onClick={() => { audio.play('buy'); buyCard(cid); }}>
                  Buy · {c.cost}
                </button>
              </div>
            );
          })}
        </div>
        <p className="shop-hint">Buy cards to add sect points. Hit 5/10/20/40 in a sect for big passive bonuses. Combat is automatic.</p>
      </div>
    </div>
  );
}

function SectBar({ sid, points }: { sid: SectId; points: number }) {
  const sect = SECTS[sid];
  const tier = sectTier(points);
  const next = SECT_THRESHOLDS.find((t) => points < t);
  const prev = tier > 0 ? SECT_THRESHOLDS[tier - 1] : 0;
  const span = (next ?? 40) - prev || 1;
  const fill = next ? Math.min(1, (points - prev) / span) : 1;
  return (
    <div className="sectbar">
      <div className="sectbar-top">
        <span className="sectbar-name" style={{ color: sect.color }}>{sect.name}</span>
        <span className="sectbar-pts">{points}{next ? ` / ${next}` : ' · MAX'} {tier > 0 && <b>L{tier}</b>}</span>
      </div>
      <div className="sectbar-track">
        <div className="sectbar-fill" style={{ width: `${fill * 100}%`, background: sect.color }} />
      </div>
    </div>
  );
}
