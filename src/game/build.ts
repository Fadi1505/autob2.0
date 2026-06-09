import type { CombatBuild, CombatStats, SectId } from './types';
import { getHero } from './data/heroes';
import { getCard } from './data/cards';
import { SECT_ORDER, sectContribution, sectTier } from './data/sects';

export type SectPoints = Record<SectId, number>;

export function emptySectPoints(): SectPoints {
  const o = {} as SectPoints;
  for (const s of SECT_ORDER) o[s] = 0;
  return o;
}

export function computeSectPoints(ownedCardIds: string[]): SectPoints {
  const points = emptySectPoints();
  for (const id of ownedCardIds) {
    const c = getCard(id);
    if (c) points[c.sect] += c.points;
  }
  return points;
}

export function computeSectTiers(ownedCardIds: string[]): Record<SectId, number> {
  const points = computeSectPoints(ownedCardIds);
  const tiers = {} as Record<SectId, number>;
  for (const s of SECT_ORDER) tiers[s] = sectTier(points[s]);
  return tiers;
}

const STAT_KEYS: (keyof CombatStats)[] = [
  'maxHp', 'maxMana', 'attackDamage', 'attackSpeed', 'manaRegen', 'moveSpeed', 'attackRange',
  'critChance', 'critMult', 'evadeChance', 'damageReductionFlat', 'damageReductionPct',
  'hpRegen', 'lifesteal', 'reflect', 'onHitSlowPct', 'onHitSlowDur', 'abilityPower',
];

export function buildGladiator(heroId: string, ownedCardIds: string[]): CombatBuild | null {
  const hero = getHero(heroId);
  if (!hero) return null;
  const b = hero.baseStats;

  const stats: CombatStats = {
    maxHp: b.maxHp,
    maxMana: b.maxMana > 0 ? b.maxMana : 100,
    attackDamage: b.attackDamage,
    attackSpeed: b.attackSpeed,
    manaRegen: b.manaRegen,
    moveSpeed: b.moveSpeed,
    attackRange: b.attackRange,
    critChance: 0.02,
    critMult: 1.6,
    evadeChance: 0.02,
    damageReductionFlat: 0,
    damageReductionPct: 0,
    hpRegen: 0,
    lifesteal: 0,
    reflect: 0,
    onHitSlowPct: 0,
    onHitSlowDur: 0,
    abilityPower: 1,
  };

  const points = computeSectPoints(ownedCardIds);
  for (const sectId of SECT_ORDER) {
    const contrib = sectContribution(sectId, points[sectId]);
    for (const k of STAT_KEYS) {
      const v = contrib[k];
      if (v !== undefined) stats[k] += v;
    }
  }

  // sane clamps so duels don't become un-winnable
  stats.evadeChance = Math.min(0.75, stats.evadeChance);
  stats.damageReductionPct = Math.min(0.8, stats.damageReductionPct);
  if (stats.onHitSlowPct > 0 && stats.onHitSlowDur === 0) stats.onHitSlowDur = 1.5;

  const granted = new Set<string>();
  for (const id of ownedCardIds) {
    const c = getCard(id);
    if (c?.grantedAbility) granted.add(c.grantedAbility);
  }
  const abilityIds = Array.from(new Set([...hero.abilityIds, ...granted]));

  return { heroId: hero.id, name: hero.name, color: hero.color, stats, abilityIds };
}

export function playerLevel(cardCount: number): number {
  return 1 + Math.floor(cardCount / 3);
}
