import type { Team, CombatStats } from '../types';
import type { BattleSim } from './BattleSim';
import { AbilityController } from './AbilityController';

// A timed status: a damage-over-time (poison) or a temporary buff (fortify).
// Re-applying the same id refreshes rather than stacks (see applyStatus).
export interface StatusEffect {
  id: 'poison' | 'fortify';
  remaining: number;
  tickTimer: number;
  interval: number;
  power: number; // damage per tick (poison) OR extra flat DR (fortify)
  caster: Combatant | null;
}

// One fighter in a duel. Movement, basic attacks, mana and the full combat stat
// block (crit/evade/mitigation/regen/slow/reflect). Fully deterministic: all
// randomness goes through sim.rng.
export class Combatant {
  readonly id: number;
  readonly sim: BattleSim;
  team: Team;
  name: string;
  color: string;
  heroId = '';

  x: number;
  y: number;
  radius: number;

  maxHp: number;
  hp: number;
  maxMana: number;
  mana: number;
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

  alive = true;
  deadFor = 0;

  attackCd = 0;
  attackFlash = 0;
  hurtFlash = 0;
  castFlash = 0;
  evadeFlash = 0;
  private slowMult = 1;
  private slowTimer = 0;
  statusEffects: StatusEffect[] = [];

  target: Combatant | null = null;
  readonly controller: AbilityController;

  constructor(id: number, sim: BattleSim, team: Team, stats: CombatStats, name: string, color: string, x: number, y: number) {
    this.id = id;
    this.sim = sim;
    this.team = team;
    this.name = name;
    this.color = color;
    this.x = x;
    this.y = y;
    this.radius = 20;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.maxMana = stats.maxMana;
    this.mana = 0;
    this.attackDamage = stats.attackDamage;
    this.attackSpeed = stats.attackSpeed;
    this.manaRegen = stats.manaRegen;
    this.moveSpeed = stats.moveSpeed;
    this.attackRange = stats.attackRange;
    this.critChance = stats.critChance;
    this.critMult = stats.critMult;
    this.evadeChance = stats.evadeChance;
    this.damageReductionFlat = stats.damageReductionFlat;
    this.damageReductionPct = stats.damageReductionPct;
    this.hpRegen = stats.hpRegen;
    this.lifesteal = stats.lifesteal;
    this.reflect = stats.reflect;
    this.onHitSlowPct = stats.onHitSlowPct;
    this.onHitSlowDur = stats.onHitSlowDur;
    this.abilityPower = stats.abilityPower;
    this.controller = new AbilityController(this);
  }

  update(dt: number): void {
    if (!this.alive) {
      this.deadFor += dt;
      return;
    }
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.attackFlash = Math.max(0, this.attackFlash - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.castFlash = Math.max(0, this.castFlash - dt);
    this.evadeFlash = Math.max(0, this.evadeFlash - dt);
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowMult = 1;
    }
    if (this.maxMana > 0 && this.manaRegen > 0) {
      this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);
    }
    if (this.hpRegen > 0) this.heal(this.hpRegen * dt);
    if (this.statusEffects.length > 0) this.updateStatuses(dt);

    if (!this.hasValidTarget()) this.acquireTarget();
    this.controller.update(dt);
    this.move(dt);
  }

  private move(dt: number): void {
    let dirX = 0;
    let dirY = 0;
    if (this.hasValidTarget()) {
      const t = this.target as Combatant;
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > this.attackRange) {
        dirX = dx / dist;
        dirY = dy / dist;
      } else {
        this.tryAttack();
      }
    }

    let sepX = 0;
    let sepY = 0;
    for (const other of this.sim.combatants) {
      if (other === this || !other.alive) continue;
      const ox = this.x - other.x;
      const oy = this.y - other.y;
      const d = Math.hypot(ox, oy);
      const minDist = this.radius + other.radius;
      if (d > 0 && d < minDist) {
        const push = (minDist - d) / minDist;
        sepX += (ox / d) * push;
        sepY += (oy / d) * push;
      }
    }

    let vx = dirX + sepX * 1.2;
    let vy = dirY + sepY * 1.2;
    const vlen = Math.hypot(vx, vy);
    if (vlen > 0.001) {
      vx /= vlen;
      vy /= vlen;
      const step = this.moveSpeed * this.slowMult * dt;
      this.x += vx * step;
      this.y += vy * step;
      this.clampToArena();
    }
  }

  private clampToArena(): void {
    this.x = Math.max(this.radius, Math.min(this.sim.width - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(this.sim.height - this.radius, this.y));
  }

  private tryAttack(): void {
    if (this.attackCd > 0 || !this.hasValidTarget()) return;
    const t = this.target as Combatant;
    this.attackCd = 1 / Math.max(0.1, this.attackSpeed * this.slowMult);
    this.attackFlash = 0.14;
    this.controller.onAttack(t);

    if (this.sim.rng() < t.evadeChance) {
      t.evadeFlash = 0.25;
      this.sim.pushFx({ kind: 'evade', x: t.x, y: t.y });
      return;
    }
    let dmg = this.attackDamage;
    let isCrit = false;
    if (this.critChance > 0 && this.sim.rng() < this.critChance) {
      dmg *= this.critMult;
      isCrit = true;
    }
    t.takeDamage(dmg, this, false, isCrit);
    this.controller.onHit(t, dmg);
    if (this.onHitSlowPct > 0 && t.alive) t.applySlow(this.onHitSlowPct, this.onHitSlowDur);
    if (this.lifesteal > 0) this.heal(dmg * this.lifesteal, true);
  }

  takeDamage(amount: number, source: Combatant | null, reflected = false, isCrit = false): void {
    if (!this.alive) return;
    // Ramp scaling applies to primary damage only; reflected damage is already derived.
    const scale = reflected ? 1 : this.sim.damageScale();
    const flatDR = this.damageReductionFlat + this.fortifyDR();
    let dmg = Math.max(0, amount * scale - flatDR);
    dmg *= 1 - this.damageReductionPct;
    this.mana = Math.min(this.maxMana, this.mana + dmg * 0.35); // mana from taking hits
    this.hp = Math.max(0, this.hp - dmg);
    this.hurtFlash = 0.12;
    if (dmg > 0) this.sim.pushFx({ kind: isCrit ? 'crit' : 'damage', x: this.x, y: this.y, amount: dmg });
    // Cap secondary damage chains (thorns/reflect on both sides could loop forever).
    if (this.sim.dmgDepth < 8) {
      this.sim.dmgDepth++;
      this.controller.onTakeDamage(dmg, source);
      if (!reflected && this.reflect > 0 && source && source.alive && dmg > 0) {
        source.takeDamage(dmg * this.reflect, this, true);
      }
      this.sim.dmgDepth--;
    }
    if (this.hp <= 0) this.die(source);
  }

  heal(amount: number, showText = false): void {
    if (!this.alive) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const gained = this.hp - before;
    if (showText && gained > 0) this.sim.pushFx({ kind: 'heal', x: this.x, y: this.y, amount: gained });
  }

  spendMana(amount: number): boolean {
    if (this.mana < amount) return false;
    this.mana -= amount;
    return true;
  }

  gainMana(amount: number): void {
    this.mana = Math.min(this.maxMana, this.mana + amount);
  }

  applySlow(slowPct: number, duration: number): void {
    this.slowMult = Math.min(this.slowMult, Math.max(0.05, 1 - slowPct));
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  // Add a timed status, refreshing (not stacking) an existing one with the same id.
  applyStatus(effect: StatusEffect): void {
    const existing = this.statusEffects.find((s) => s.id === effect.id);
    if (existing) {
      existing.remaining = Math.max(existing.remaining, effect.remaining);
      existing.power = Math.max(existing.power, effect.power);
      existing.interval = effect.interval;
      existing.tickTimer = Math.min(existing.tickTimer, effect.tickTimer);
      existing.caster = effect.caster;
    } else {
      this.statusEffects.push(effect);
    }
  }

  private updateStatuses(dt: number): void {
    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      const s = this.statusEffects[i];
      s.remaining -= dt;
      if (s.id === 'poison') {
        s.tickTimer -= dt;
        if (s.tickTimer <= 0 && this.alive) {
          s.tickTimer += s.interval;
          // reflected=true: DOT skips the time-ramp and never reflects back.
          this.takeDamage(s.power, s.caster, true);
        }
      }
      if (s.remaining <= 0) this.statusEffects.splice(i, 1);
    }
  }

  private fortifyDR(): number {
    let dr = 0;
    for (const s of this.statusEffects) if (s.id === 'fortify') dr += s.power;
    return dr;
  }

  hasValidTarget(): boolean {
    return this.target !== null && this.target.alive;
  }

  getEnemiesInRadius(radius: number): Combatant[] {
    const out: Combatant[] = [];
    for (const c of this.sim.combatants) {
      if (c.team !== this.team && c.alive && this.distanceTo(c) <= radius) out.push(c);
    }
    return out;
  }

  distanceTo(other: Combatant): number {
    return Math.hypot(other.x - this.x, other.y - this.y);
  }

  private acquireTarget(): void {
    let best: Combatant | null = null;
    let bestDist = Infinity;
    for (const c of this.sim.combatants) {
      if (c.team === this.team || !c.alive) continue;
      const d = this.distanceTo(c);
      if (d < bestDist) {
        best = c;
        bestDist = d;
      }
    }
    this.target = best;
  }

  private die(source: Combatant | null): void {
    this.alive = false;
    this.deadFor = 0;
    this.target = null;
    if (source && source.alive) source.controller.onKill(this);
  }
}
