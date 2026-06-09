import type { CombatStats } from '../../game/types';

export type StatKey = keyof CombatStats;

type Fmt = 'int' | 'dec1' | 'dec2' | 'pct' | 'mult';

interface StatMeta {
  label: string;
  fmt: Fmt;
  desc: string;
}

export const STAT_META: Record<StatKey, StatMeta> = {
  maxHp: { label: 'Health', fmt: 'int', desc: 'Total hit points. Reaching 0 loses the duel.' },
  maxMana: { label: 'Mana', fmt: 'int', desc: 'Resource spent to cast active abilities and ultimates.' },
  attackDamage: { label: 'Attack Damage', fmt: 'int', desc: 'Damage dealt per basic attack (before mitigation).' },
  attackSpeed: { label: 'Attack Speed', fmt: 'dec2', desc: 'Basic attacks per second.' },
  manaRegen: { label: 'Mana Regen', fmt: 'dec1', desc: 'Mana restored per second.' },
  moveSpeed: { label: 'Move Speed', fmt: 'int', desc: 'How fast the gladiator closes distance.' },
  attackRange: { label: 'Attack Range', fmt: 'int', desc: 'Distance from which basic attacks can land.' },
  critChance: { label: 'Crit Chance', fmt: 'pct', desc: 'Chance for an attack to deal critical damage.' },
  critMult: { label: 'Crit Damage', fmt: 'mult', desc: 'Damage multiplier applied on a critical strike.' },
  evadeChance: { label: 'Evasion', fmt: 'pct', desc: 'Chance to completely dodge an incoming attack (capped 75%).' },
  damageReductionFlat: { label: 'Armor', fmt: 'int', desc: 'Flat damage subtracted from each hit taken.' },
  damageReductionPct: { label: 'Damage Reduction', fmt: 'pct', desc: 'Percent of incoming damage ignored (capped 80%).' },
  hpRegen: { label: 'Health Regen', fmt: 'dec1', desc: 'Health restored per second.' },
  lifesteal: { label: 'Lifesteal', fmt: 'pct', desc: 'Portion of attack damage returned as healing.' },
  reflect: { label: 'Reflect', fmt: 'pct', desc: 'Portion of damage taken reflected back to the attacker.' },
  onHitSlowPct: { label: 'Chill', fmt: 'pct', desc: 'Movement/attack slow applied to enemies on hit.' },
  onHitSlowDur: { label: 'Chill Duration', fmt: 'dec1', desc: 'How long the on-hit slow lasts.' },
  abilityPower: { label: 'Ability Power', fmt: 'mult', desc: 'Multiplier on all ability and spell damage.' },
};

/** Absolute value of a stat, e.g. "1.40x", "35%", "420". */
export function fmtStat(key: StatKey, v: number): string {
  switch (STAT_META[key].fmt) {
    case 'pct':
      return `${Math.round(v * 100)}%`;
    case 'mult':
      return `${v.toFixed(2)}x`;
    case 'dec1':
      return v.toFixed(1);
    case 'dec2':
      return v.toFixed(2);
    default:
      return `${Math.round(v)}`;
  }
}

/** Signed contribution of a stat, e.g. "+5%", "+0.15", "+8". */
export function fmtDelta(key: StatKey, v: number): string {
  const sign = v >= 0 ? '+' : '−';
  const a = Math.abs(v);
  switch (STAT_META[key].fmt) {
    case 'pct':
    case 'mult': // tier/per-point ability-power & crit-mult bonuses read best as +X%
      return `${sign}${Math.round(a * 100)}%`;
    case 'dec1':
      return `${sign}${a.toFixed(1)}`;
    case 'dec2':
      return `${sign}${a.toFixed(2)}`;
    default:
      return `${sign}${Math.round(a)}`;
  }
}

/** Compact one-line summary of a partial stat block (used for sect tier bonuses). */
export function fmtStatBlock(block: Partial<CombatStats>): string {
  const parts: string[] = [];
  for (const k of Object.keys(block) as StatKey[]) {
    const v = block[k];
    if (v === undefined || v === 0) continue;
    parts.push(`${fmtDelta(k, v)} ${STAT_META[k].label}`);
  }
  return parts.join(', ');
}
