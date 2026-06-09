import type { ReactNode } from 'react';
import type { AbilityDef, SectId, Trigger } from '../../game/types';
import { getHero } from '../../game/data/heroes';
import { getAbility } from '../../game/data/abilities';
import { getCard } from '../../game/data/cards';
import { SECTS, SECT_THRESHOLDS, SECT_ORDER, sectTier, sectContribution } from '../../game/data/sects';
import { buildGladiator } from '../../game/build';
import { STAT_META, fmtStat, fmtDelta, fmtStatBlock, type StatKey } from './statMeta';

function Row({ k, v, cls }: { k: string; v: ReactNode; cls?: string }) {
  return (
    <div className="tip-row">
      <span className="k">{k}</span>
      <span className={`v ${cls ?? ''}`}>{v}</span>
    </div>
  );
}

const TRIGGER_LABEL: Record<Trigger, string> = {
  none: 'Always',
  onAttack: 'On attack',
  onHit: 'On hit',
  onTakeDamage: 'When struck',
  onKill: 'On kill',
  periodic: 'Periodic',
};

function isStub(a: AbilityDef): boolean {
  return a.effectId === '' || a.description.startsWith('TODO');
}

export function AbilityTooltip({ abilityId }: { abilityId: string }) {
  const a = getAbility(abilityId);
  if (!a) return <div>Unknown ability</div>;
  const stub = isStub(a);
  return (
    <div>
      <div className="tip-title">
        {a.name}
        <span className={`tip-kind ${a.kind}`}>{a.kind}</span>
      </div>
      <div className="tip-desc">{stub ? 'Not yet implemented — declared for an upcoming patch.' : a.description}</div>
      <div className="tip-rows">
        {a.manaCost > 0 && <Row k="Mana cost" v={a.manaCost} />}
        {a.cooldown > 0 && <Row k="Cooldown" v={`${a.cooldown}s`} />}
        {a.kind === 'passive' && (
          <>
            <Row k="Trigger" v={a.trigger === 'periodic' ? `Every ${a.period}s` : TRIGGER_LABEL[a.trigger]} />
            {a.procChance < 1 && <Row k="Proc chance" v={`${Math.round(a.procChance * 100)}%`} />}
            {a.internalCooldown > 0 && <Row k="Internal CD" v={`${a.internalCooldown}s`} />}
          </>
        )}
        {a.params.damageMult !== undefined && (
          <Row k="Damage" v={`${a.params.damageMult.toFixed(1)}x AD`} cls="good" />
        )}
        {a.params.reflect !== undefined && <Row k="Reflect" v={`${Math.round(a.params.reflect * 100)}%`} />}
        {a.params.lifesteal !== undefined && <Row k="Lifesteal" v={`${Math.round(a.params.lifesteal * 100)}%`} />}
        {a.params.heal !== undefined && <Row k="Heal" v={`${a.params.heal}/tick`} cls="good" />}
        {a.params.radius !== undefined && <Row k="Radius" v={Math.round(a.params.radius)} />}
        {a.params.slow !== undefined && <Row k="Slow" v={`${Math.round(a.params.slow * 100)}%`} />}
      </div>
      {!stub && (a.kind === 'active' || a.kind === 'ultimate') && a.params.damageMult !== undefined && (
        <div className="tip-note">Spell damage scales with Ability Power.</div>
      )}
    </div>
  );
}

export function SectTooltip({ sectId, points }: { sectId: SectId; points: number }) {
  const sect = SECTS[sectId];
  const tier = sectTier(points);
  const next = SECT_THRESHOLDS.find((t) => points < t);
  return (
    <div>
      <div className="tip-title">
        <span style={{ color: sect.color }}>{sect.name}</span>
        {tier > 0 && <span className="tip-kind">Tier {tier}</span>}
      </div>
      <div className="tip-desc">{sect.description}</div>
      <div className="tip-rows">
        <Row k="Per point" v={fmtStatBlock(sect.perPoint) || '—'} />
        <Row k="Points" v={`${points}${next ? ` / ${next} to next` : ' · MAX'}`} cls="gold" />
      </div>
      <div className="tip-sep" />
      <ul className="tip-thresholds">
        {SECT_THRESHOLDS.map((th, i) => (
          <li key={th} className={points >= th ? 'reached' : ''}>
            <span className="th-at">{th} pts</span>
            <span>{fmtStatBlock(sect.tiers[i]) || '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatTooltip({
  statKey,
  heroId,
  ownedCardIds,
  sectPoints,
}: {
  statKey: StatKey;
  heroId: string;
  ownedCardIds: string[];
  sectPoints: Record<string, number>;
}) {
  const meta = STAT_META[statKey];
  const base = buildGladiator(heroId, []);
  const total = buildGladiator(heroId, ownedCardIds);
  const baseVal = base?.stats[statKey] ?? 0;
  const totalVal = total?.stats[statKey] ?? 0;

  const sources: { name: string; color: string; delta: number }[] = [];
  for (const sid of SECT_ORDER) {
    const pts = sectPoints[sid] ?? 0;
    if (pts <= 0) continue;
    const contrib = sectContribution(sid, pts)[statKey];
    if (contrib) sources.push({ name: SECTS[sid].name, color: SECTS[sid].color, delta: contrib });
  }

  return (
    <div>
      <div className="tip-title">{meta.label}</div>
      <div className="tip-desc">{meta.desc}</div>
      <div className="tip-rows">
        <Row k="Hero base" v={fmtStat(statKey, baseVal)} />
        {sources.map((s) => (
          <div className="tip-row" key={s.name}>
            <span className="k" style={{ color: s.color }}>{s.name}</span>
            <span className="v good">{fmtDelta(statKey, s.delta)}</span>
          </div>
        ))}
      </div>
      <div className="tip-sep" />
      <Row k="Total" v={fmtStat(statKey, totalVal)} cls="gold" />
    </div>
  );
}

export function CardTooltip({ cardId }: { cardId: string }) {
  const c = getCard(cardId);
  if (!c) return <div>Unknown card</div>;
  const sect = SECTS[c.sect];
  return (
    <div>
      <div className="tip-title">
        {c.name}
        <span className={`tip-kind ${c.rarity}`}>{c.rarity}</span>
      </div>
      <div className="tip-rows">
        <Row k="Sect" v={<span style={{ color: sect.color }}>{sect.name}</span>} />
        <Row k="Sect points" v={`+${c.points}`} cls="good" />
        <Row k="Cost" v={`${c.cost} gold`} cls="gold" />
      </div>
      {c.grantedAbility && (
        <>
          <div className="tip-sep" />
          <div className="tip-note" style={{ marginTop: 0, marginBottom: 6 }}>Grants ability:</div>
          <AbilityTooltip abilityId={c.grantedAbility} />
        </>
      )}
    </div>
  );
}

export function PlayerTooltip({
  name,
  heroId,
  hp,
  maxHp,
  level,
  streak,
  alive,
  isBot,
}: {
  name: string;
  heroId: string | null;
  hp: number;
  maxHp: number;
  level: number;
  streak: number;
  alive: boolean;
  isBot: boolean;
}) {
  const hero = heroId ? getHero(heroId) : null;
  const streakText = streak > 1 ? `${streak} wins` : streak < -1 ? `${-streak} losses` : '—';
  return (
    <div>
      <div className="tip-title">
        {name}
        {isBot && <span className="tip-kind">Bot</span>}
      </div>
      <div className="tip-desc">
        {hero ? `${hero.name} · ${hero.category}` : 'Choosing a gladiator…'}
      </div>
      <div className="tip-rows">
        <Row k="Status" v={alive ? 'Alive' : 'Eliminated'} cls={alive ? 'good' : ''} />
        <Row k="Health" v={`${Math.ceil(hp)} / ${Math.round(maxHp)}`} />
        <Row k="Level" v={level} />
        <Row k="Streak" v={streakText} />
      </div>
    </div>
  );
}

// Mirrors server income()/lossDamage() in server/game.ts.
function income(gold: number, streak: number): { base: number; interest: number; streakBonus: number; total: number } {
  const base = 5;
  const interest = Math.min(5, Math.floor(gold / 10));
  let streakBonus = 0;
  if (streak > 1) streakBonus = Math.min(3, streak - 1);
  else if (streak < -1) streakBonus = Math.min(3, -streak - 1);
  return { base, interest, streakBonus, total: base + interest + streakBonus };
}

export function EconomyTooltip({
  gold,
  streak,
  round,
}: {
  gold: number;
  streak: number;
  round: number;
}) {
  const inc = income(gold, streak);
  const loss = 4 + round * 2;
  return (
    <div>
      <div className="tip-title">Gold &amp; Economy</div>
      <div className="tip-desc">Income is paid at the start of each shop phase.</div>
      <div className="tip-rows">
        <Row k="Base income" v={`+${inc.base}`} />
        <Row k="Interest (10% of gold, max 5)" v={`+${inc.interest}`} />
        <Row k="Win/Loss streak" v={`+${inc.streakBonus}`} />
      </div>
      <div className="tip-sep" />
      <Row k="Next income" v={`+${inc.total} gold`} cls="gold" />
      <Row k="Damage if you lose" v={`${loss} HP`} cls="" />
      <div className="tip-note">Save 10/20/30/40/50 gold for max interest. A win or loss streak (2+) adds bonus gold.</div>
    </div>
  );
}
