// Core data types. No TS enums (tsconfig uses erasableSyntaxOnly); string unions instead.

export type AbilityKind = 'active' | 'ultimate' | 'passive';

export type Trigger =
  | 'none'
  | 'onAttack'
  | 'onHit'
  | 'onTakeDamage'
  | 'onKill'
  | 'periodic';

export type HeroCategory = 'caster' | 'standard' | 'passive';

export type Team = 'player' | 'enemy';

export type Rarity = 'common' | 'rare' | 'epic';

export interface AbilityDef {
  id: string;
  name: string;
  kind: AbilityKind;
  manaCost: number;
  cooldown: number;
  trigger: Trigger;
  procChance: number;
  internalCooldown: number;
  period: number;
  /** Empty string = not-yet-implemented stub (effect is a no-op). */
  effectId: string;
  params: Record<string, number>;
  description: string;
}

export interface Stats {
  maxHp: number;
  maxMana: number;
  attackDamage: number;
  attackSpeed: number;
  manaRegen: number;
  moveSpeed: number;
  attackRange: number;
}

export interface HeroDef {
  id: string;
  name: string;
  category: HeroCategory;
  /** hex string, e.g. "#f2723b" */
  color: string;
  baseStats: Stats;
  abilityIds: string[];
  playable: boolean;
  description: string;
}

export type SectId =
  | 'attack'
  | 'fury'
  | 'critical'
  | 'magic'
  | 'ultimate'
  | 'health'
  | 'shield'
  | 'regen'
  | 'healing'
  | 'evasion'
  | 'ward'
  | 'frost';

/** An ability card: gives points in one sect (+stats), maybe grants an ability. */
export interface CardDef {
  id: string;
  name: string;
  sect: SectId;
  rarity: Rarity;
  cost: number;
  points: number;
  grantedAbility?: string;
  description: string;
}

/** Full combat stat block used to build a Combatant for a duel. */
export interface CombatStats {
  maxHp: number;
  maxMana: number;
  attackDamage: number;
  attackSpeed: number;
  manaRegen: number;
  moveSpeed: number;
  attackRange: number;
  critChance: number;
  critMult: number;
  evadeChance: number;
  damageReductionFlat: number;
  damageReductionPct: number;
  hpRegen: number;
  lifesteal: number;
  reflect: number;
  onHitSlowPct: number;
  onHitSlowDur: number;
  abilityPower: number;
}

/** A fully-resolved gladiator ready to fight (sent over the wire to clients). */
export interface CombatBuild {
  heroId: string;
  name: string;
  color: string;
  stats: CombatStats;
  abilityIds: string[];
}
