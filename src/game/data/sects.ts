import type { SectId, CombatStats } from '../types';

export const SECT_THRESHOLDS = [5, 10, 20, 40];

export function sectTier(points: number): number {
  let tier = 0;
  for (const t of SECT_THRESHOLDS) if (points >= t) tier++;
  return tier; // 0..4
}

export interface SectDef {
  id: SectId;
  name: string;
  color: string;
  description: string;
  /** added to stats per point invested */
  perPoint: Partial<CombatStats>;
  /** cumulative bonus granted at tiers 1..4 (index 0 == tier 1 == 5 points) */
  tiers: Partial<CombatStats>[];
}

const SECT_LIST: SectDef[] = [
  {
    id: 'attack',
    name: 'Attack',
    color: '#e0533a',
    description: 'Raw attack damage; thresholds add crit chance.',
    perPoint: { attackDamage: 1.4 },
    tiers: [{ critChance: 0.05 }, { critChance: 0.05 }, { critChance: 0.07, attackDamage: 8 }, { critChance: 0.08, attackDamage: 16 }],
  },
  {
    id: 'fury',
    name: 'Fury',
    color: '#f2a23a',
    description: 'Attack speed. Counters Frost.',
    perPoint: { attackSpeed: 0.03 },
    tiers: [{ attackSpeed: 0.1 }, { attackSpeed: 0.12 }, { attackSpeed: 0.18 }, { attackSpeed: 0.3 }],
  },
  {
    id: 'critical',
    name: 'Critical',
    color: '#ff5c8a',
    description: 'Critical strike chance and damage.',
    perPoint: { critChance: 0.012 },
    tiers: [
      { critChance: 0.04, critMult: 0.15 },
      { critChance: 0.05, critMult: 0.15 },
      { critChance: 0.06, critMult: 0.25 },
      { critChance: 0.08, critMult: 0.4 },
    ],
  },
  {
    id: 'magic',
    name: 'Magic',
    color: '#7a5cff',
    description: 'Amplifies all ability/spell damage.',
    perPoint: { abilityPower: 0.03 },
    tiers: [{ abilityPower: 0.2 }, { abilityPower: 0.2 }, { abilityPower: 0.3 }, { abilityPower: 0.5 }],
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    color: '#9b8cff',
    description: 'Mana regen and ultimate/ability power.',
    perPoint: { manaRegen: 0.6 },
    tiers: [
      { manaRegen: 3, abilityPower: 0.1 },
      { manaRegen: 3, abilityPower: 0.1 },
      { manaRegen: 5, abilityPower: 0.2 },
      { manaRegen: 8, abilityPower: 0.3 },
    ],
  },
  {
    id: 'health',
    name: 'Health',
    color: '#4fb35a',
    description: 'Maximum health.',
    perPoint: { maxHp: 20 },
    tiers: [{ maxHp: 120 }, { maxHp: 150 }, { maxHp: 300 }, { maxHp: 700 }],
  },
  {
    id: 'shield',
    name: 'Shield',
    color: '#4f8af2',
    description: 'Percentage damage reduction. Counters Attack.',
    perPoint: { damageReductionPct: 0.006 },
    tiers: [
      { damageReductionPct: 0.05 },
      { damageReductionPct: 0.05 },
      { damageReductionPct: 0.08, damageReductionFlat: 4 },
      { damageReductionPct: 0.1, damageReductionFlat: 10 },
    ],
  },
  {
    id: 'regen',
    name: 'Regen',
    color: '#3ad6a8',
    description: 'Health regeneration per second.',
    perPoint: { hpRegen: 0.5 },
    tiers: [{ hpRegen: 4 }, { hpRegen: 5 }, { hpRegen: 10 }, { hpRegen: 22 }],
  },
  {
    id: 'healing',
    name: 'Healing',
    color: '#5ce0b0',
    description: 'Lifesteal on attack.',
    perPoint: { lifesteal: 0.012 },
    tiers: [{ lifesteal: 0.06 }, { lifesteal: 0.06 }, { lifesteal: 0.1 }, { lifesteal: 0.18 }],
  },
  {
    id: 'evasion',
    name: 'Evasion',
    color: '#9fe06a',
    description: 'Chance to dodge attacks. Counters Attack.',
    perPoint: { evadeChance: 0.009 },
    tiers: [{ evadeChance: 0.05 }, { evadeChance: 0.05 }, { evadeChance: 0.08 }, { evadeChance: 0.12 }],
  },
  {
    id: 'ward',
    name: 'Ward',
    color: '#e0c24f',
    description: 'Reflects a portion of damage taken.',
    perPoint: { reflect: 0.012 },
    tiers: [{ reflect: 0.08 }, { reflect: 0.08 }, { reflect: 0.14 }, { reflect: 0.25 }],
  },
  {
    id: 'frost',
    name: 'Frost',
    color: '#6fd0ff',
    description: 'Attacks slow the enemy. Counters Fury.',
    perPoint: { onHitSlowPct: 0.008 },
    tiers: [{ onHitSlowPct: 0.06 }, { onHitSlowPct: 0.06 }, { onHitSlowPct: 0.1 }, { onHitSlowPct: 0.16 }],
  },
];

export const SECTS: Record<SectId, SectDef> = Object.fromEntries(
  SECT_LIST.map((s) => [s.id, s] as const),
) as Record<SectId, SectDef>;

export const SECT_ORDER: SectId[] = SECT_LIST.map((s) => s.id);

const STAT_KEYS: (keyof CombatStats)[] = [
  'maxHp', 'maxMana', 'attackDamage', 'attackSpeed', 'manaRegen', 'moveSpeed', 'attackRange',
  'critChance', 'critMult', 'evadeChance', 'damageReductionFlat', 'damageReductionPct',
  'hpRegen', 'lifesteal', 'reflect', 'onHitSlowPct', 'onHitSlowDur', 'abilityPower',
];

/** Total stat contribution of `points` invested in `sectId`. */
export function sectContribution(sectId: SectId, points: number): Partial<CombatStats> {
  const sect = SECTS[sectId];
  const out: Partial<CombatStats> = {};
  const add = (src: Partial<CombatStats>, scale = 1) => {
    for (const k of STAT_KEYS) {
      const v = src[k];
      if (v !== undefined) out[k] = (out[k] ?? 0) + v * scale;
    }
  };
  add(sect.perPoint, points);
  const tier = sectTier(points);
  for (let i = 0; i < tier; i++) add(sect.tiers[i]);
  return out;
}
