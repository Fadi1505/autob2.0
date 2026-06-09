import type { AbilityDef } from '../types';
import type { Combatant } from './Combatant';
import type { EffectCtx } from './AbilityController';

function p(def: AbilityDef, key: string, fallback = 0): number {
  return def.params[key] ?? fallback;
}

// Ability/spell damage scales with the caster's abilityPower (Magic/Ultimate sects).
function spellDamage(caster: Combatant, mult: number): number {
  return caster.attackDamage * mult * caster.abilityPower;
}

// Enemies within `radius` of an arbitrary point (target-centered AoE).
function enemiesNear(caster: Combatant, x: number, y: number, radius: number): Combatant[] {
  const out: Combatant[] = [];
  for (const c of caster.sim.combatants) {
    if (c.team !== caster.team && c.alive && Math.hypot(c.x - x, c.y - y) <= radius) out.push(c);
  }
  return out;
}

// Central effect dispatch. All hero behaviour keyed by effectId; empty/unknown
// ids are intentional no-ops (the stub abilities), keeping the game runnable.
export function executeEffect(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  switch (def.effectId) {
    // --- original six ----------------------------------------------------
    case 'fireball':
      fireball(caster, def, ctx);
      break;
    case 'frost_nova':
      frostNova(caster, def);
      break;
    case 'whirlwind':
      whirlwind(caster, def);
      break;
    case 'bloodlust':
      bloodlust(caster, def, ctx);
      break;
    case 'thorns':
      thorns(caster, def, ctx);
      break;
    case 'regeneration':
      // scales a touch with the Regen sect (hpRegen)
      caster.heal(p(def, 'heal', 5) + caster.hpRegen * 0.3, true);
      break;

    // --- AoE centered on target -----------------------------------------
    case 'chain_lightning':
      chainLightning(caster, def, ctx);
      break;
    case 'ice_lance':
      iceLance(caster, def, ctx);
      break;
    case 'divine_nova':
      novaHeal(caster, def, ctx, 0xffe9a3);
      break;
    case 'spirit_storm':
      novaHeal(caster, def, ctx, 0x8affc0);
      break;

    // --- periodic damage / drain ----------------------------------------
    case 'static_field':
      staticField(caster, def);
      break;
    case 'mana_leech':
      manaLeech(caster, def);
      break;

    // --- on-attack procs -------------------------------------------------
    case 'lifedrain':
      lifedrain(caster, def, ctx);
      break;
    case 'sacred_strike':
      caster.heal(caster.attackDamage * p(def, 'healRatio', 0.5), true);
      break;
    case 'flurry':
      flurry(caster, def, ctx);
      break;
    case 'piercing_shot':
      piercingShot(caster, def, ctx);
      break;

    // --- on-take-damage procs -------------------------------------------
    case 'divine_shield':
      caster.heal(p(def, 'heal', 20) + caster.hpRegen * 2, true);
      break;
    case 'ice_armor':
      iceArmor(caster, def, ctx);
      break;
    case 'retaliate':
      retaliate(caster, def, ctx);
      break;

    // --- ultimates -------------------------------------------------------
    case 'shadow_bolt':
      shadowBolt(caster, def, ctx);
      break;
    case 'blade_dance':
      bladeDance(caster, def, ctx);
      break;
    case 'soul_rend':
      soulRend(caster, def, ctx);
      break;
    case 'volley':
      volley(caster, def, ctx);
      break;

    // --- status-effect procs --------------------------------------------
    case 'venom_strike':
      if (ctx.target && ctx.target.alive) applyPoison(caster, ctx.target, def);
      break;
    case 'plague_cloud':
      plagueCloud(caster, def, ctx);
      break;
    case 'fortify':
      fortify(caster, def);
      break;

    default:
      break; // stub / not implemented
  }
}

function fireball(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  if (!target || !target.alive) return;
  caster.sim.spawnProjectile({
    x: caster.x,
    y: caster.y,
    target,
    source: caster,
    damage: spellDamage(caster, p(def, 'damageMult', 1)),
    speed: p(def, 'speed', 320),
    color: 0xff7a26,
    radius: 7,
  });
}

function frostNova(caster: Combatant, def: AbilityDef): void {
  const radius = p(def, 'radius', 120);
  const dmg = spellDamage(caster, p(def, 'damageMult', 1));
  const slow = p(def, 'slow', 0.5);
  const dur = p(def, 'slowDuration', 3);
  for (const enemy of caster.getEnemiesInRadius(radius)) {
    enemy.takeDamage(dmg, caster);
    if (enemy.alive) enemy.applySlow(slow, dur);
  }
  caster.sim.addVfx({ x: caster.x, y: caster.y, maxRadius: radius, color: 0x73c0ff, ttl: 0.4 });
}

function whirlwind(caster: Combatant, def: AbilityDef): void {
  const radius = p(def, 'radius', 100);
  const dmg = spellDamage(caster, p(def, 'damageMult', 1));
  for (const enemy of caster.getEnemiesInRadius(radius)) {
    enemy.takeDamage(dmg, caster);
  }
  caster.sim.addVfx({ x: caster.x, y: caster.y, maxRadius: radius, color: 0xff4d40, ttl: 0.4 });
}

function bloodlust(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  if (!target || !target.alive) return;
  const bonus = caster.attackDamage * (p(def, 'bonusMult', 1.5) - 1);
  target.takeDamage(bonus, caster);
  caster.heal(bonus * p(def, 'lifesteal', 0.5), true);
}

function thorns(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const source = ctx.source;
  const amount = ctx.amount ?? 0;
  if (!source || !source.alive || amount <= 0) return;
  source.takeDamage(amount * p(def, 'reflect', 0.4), caster);
}

function chainLightning(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  if (!target || !target.alive) return;
  const radius = p(def, 'radius', 130);
  const dmg = spellDamage(caster, p(def, 'damageMult', 1.8));
  for (const enemy of enemiesNear(caster, target.x, target.y, radius)) {
    enemy.takeDamage(dmg, caster);
  }
  caster.sim.addVfx({ x: target.x, y: target.y, maxRadius: radius, color: 0x9bd1ff, ttl: 0.35 });
}

function iceLance(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  if (!target || !target.alive) return;
  target.takeDamage(spellDamage(caster, p(def, 'damageMult', 2.2)), caster);
  if (target.alive) target.applySlow(p(def, 'slow', 0.6), p(def, 'dur', 4));
  caster.sim.addVfx({ x: target.x, y: target.y, maxRadius: 60, color: 0x9be7ff, ttl: 0.3 });
}

// Damage all enemies near the target, then heal the caster for a share of it.
function novaHeal(caster: Combatant, def: AbilityDef, ctx: EffectCtx, color: number): void {
  const target = ctx.target;
  const cx = target ? target.x : caster.x;
  const cy = target ? target.y : caster.y;
  const radius = p(def, 'radius', 110);
  const dmg = spellDamage(caster, p(def, 'damageMult', 1.4));
  let total = 0;
  for (const enemy of enemiesNear(caster, cx, cy, radius)) {
    enemy.takeDamage(dmg, caster);
    total += dmg;
  }
  if (total > 0) caster.heal(total * p(def, 'healRatio', 0.5), true);
  caster.sim.addVfx({ x: cx, y: cy, maxRadius: radius, color, ttl: 0.4 });
}

function staticField(caster: Combatant, def: AbilityDef): void {
  const target = caster.target;
  if (!target || !target.alive) return;
  target.takeDamage(spellDamage(caster, p(def, 'damageMult', 0.5)), caster);
  caster.sim.addVfx({ x: caster.x, y: caster.y, maxRadius: p(def, 'radius', 70), color: 0xc9a3ff, ttl: 0.25 });
}

function manaLeech(caster: Combatant, def: AbilityDef): void {
  const target = caster.target;
  if (!target || !target.alive) return;
  const stolen = Math.min(p(def, 'drain', 15), target.mana);
  if (stolen <= 0) return;
  target.mana -= stolen;
  caster.gainMana(stolen);
}

function lifedrain(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  if (!target || !target.alive) return;
  const bonus = caster.attackDamage * (p(def, 'bonusMult', 1.3) - 1);
  const before = target.hp;
  target.takeDamage(bonus, caster);
  caster.heal(before - target.hp, true);
}

function flurry(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  if (!target || !target.alive) return;
  target.takeDamage(caster.attackDamage * p(def, 'mult', 0.6), caster);
}

// Bonus damage that counters armour: adds back the target's flat reduction so it
// is effectively bypassed for this strike, plus a multiplier on attack damage.
function piercingShot(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  if (!target || !target.alive) return;
  const bonus = caster.attackDamage * p(def, 'mult', 0.5) + target.damageReductionFlat;
  target.takeDamage(bonus, caster);
}

function iceArmor(_caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const source = ctx.source;
  if (!source || !source.alive) return;
  source.applySlow(p(def, 'slow', 0.5), p(def, 'dur', 2.5));
}

function retaliate(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const source = ctx.source;
  const amount = ctx.amount ?? 0;
  if (!source || !source.alive || amount <= 0) return;
  source.takeDamage(amount * p(def, 'reflect', 0.6), caster, true);
  caster.heal(amount * 0.1);
}

function shadowBolt(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  if (!target || !target.alive) return;
  caster.sim.spawnProjectile({
    x: caster.x,
    y: caster.y,
    target,
    source: caster,
    damage: spellDamage(caster, p(def, 'damageMult', 2.8)),
    speed: p(def, 'speed', 300),
    color: 0x9b3bff,
    radius: 8,
  });
}

function bladeDance(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  if (!target || !target.alive) return;
  const hits = Math.round(p(def, 'hits', 3));
  for (let i = 0; i < hits; i++) {
    if (!target.alive) break;
    target.takeDamage(caster.attackDamage, caster);
  }
  caster.sim.addVfx({ x: target.x, y: target.y, maxRadius: 50, color: 0xffd24d, ttl: 0.3 });
}

function soulRend(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  if (!target || !target.alive) return;
  const before = target.hp;
  target.takeDamage(spellDamage(caster, p(def, 'damageMult', 2.0)), caster);
  caster.heal(before - target.hp, true);
}

function volley(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  if (!target || !target.alive) return;
  const shots = Math.round(p(def, 'shots', 3));
  const dmg = spellDamage(caster, p(def, 'damageMult', 1));
  for (let i = 0; i < shots; i++) {
    const off = (i - (shots - 1) / 2) * 14;
    caster.sim.spawnProjectile({
      x: caster.x + off,
      y: caster.y + off,
      target,
      source: caster,
      damage: dmg,
      speed: p(def, 'speed', 340),
      color: 0xf2e85a,
      radius: 6,
    });
  }
}

function applyPoison(caster: Combatant, target: Combatant, def: AbilityDef): void {
  const interval = p(def, 'interval', 1);
  const dps = caster.attackDamage * p(def, 'poisonMult', 0.25);
  target.applyStatus({
    id: 'poison',
    remaining: p(def, 'duration', 3),
    tickTimer: interval,
    interval,
    power: dps * interval,
    caster,
  });
}

function plagueCloud(caster: Combatant, def: AbilityDef, ctx: EffectCtx): void {
  const target = ctx.target;
  const cx = target ? target.x : caster.x;
  const cy = target ? target.y : caster.y;
  const radius = p(def, 'radius', 140);
  for (const enemy of enemiesNear(caster, cx, cy, radius)) applyPoison(caster, enemy, def);
  caster.sim.addVfx({ x: cx, y: cy, maxRadius: radius, color: 0x7fd14a, ttl: 0.4 });
}

function fortify(caster: Combatant, def: AbilityDef): void {
  caster.applyStatus({
    id: 'fortify',
    remaining: p(def, 'dur', 2),
    tickTimer: 999,
    interval: 999,
    power: p(def, 'dr', 12),
    caster,
  });
}
