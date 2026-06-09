import type { AbilityDef, Trigger } from '../types';
import type { Combatant } from './Combatant';
import { executeEffect } from './effects';

export interface AbilityState {
  name: string;
  kind: string;
  passive: boolean;
  readyRatio: number;
  manaCost: number;
}

interface RuntimeAbility {
  def: AbilityDef;
  cd: number;
  periodAccum: number;
}

// Drives a Combatant's abilities: auto-casts ready mana actives/ultimates,
// ticks periodic passives, and rolls procs in response to combat events.
export class AbilityController {
  private readonly combatant: Combatant;
  private actives: RuntimeAbility[] = [];
  private passives: RuntimeAbility[] = [];

  constructor(combatant: Combatant) {
    this.combatant = combatant;
  }

  setup(defs: AbilityDef[]): void {
    this.actives = [];
    this.passives = [];
    for (const def of defs) {
      const ra: RuntimeAbility = { def, cd: 0, periodAccum: 0 };
      if (def.kind === 'active' || def.kind === 'ultimate') this.actives.push(ra);
      else this.passives.push(ra);
    }
  }

  update(dt: number): void {
    for (const ra of this.actives) if (ra.cd > 0) ra.cd = Math.max(0, ra.cd - dt);
    for (const ra of this.passives) if (ra.cd > 0) ra.cd = Math.max(0, ra.cd - dt);
    this.tickPeriodics(dt);
    this.tryAutoCast();
  }

  private tryAutoCast(): void {
    if (!this.combatant.hasValidTarget()) return;
    let best: RuntimeAbility | null = null;
    for (const ra of this.actives) {
      if (ra.cd > 0 || this.combatant.mana < ra.def.manaCost) continue;
      if (best === null || ra.def.manaCost > best.def.manaCost) best = ra;
    }
    if (best === null) return;
    if (!this.combatant.spendMana(best.def.manaCost)) return;
    best.cd = best.def.cooldown;
    this.combatant.castFlash = 0.2;
    executeEffect(this.combatant, best.def, { target: this.combatant.target });
  }

  private tickPeriodics(dt: number): void {
    for (const ra of this.passives) {
      if (ra.def.trigger !== 'periodic') continue;
      ra.periodAccum += dt;
      if (ra.periodAccum >= ra.def.period) {
        ra.periodAccum -= ra.def.period;
        this.fire(ra, {});
      }
    }
  }

  private trigger(trigger: Trigger, ctx: EffectCtx): void {
    for (const ra of this.passives) {
      if (ra.def.trigger !== trigger || ra.cd > 0) continue;
      if (this.combatant.sim.rng() > ra.def.procChance) continue;
      this.fire(ra, ctx);
    }
  }

  private fire(ra: RuntimeAbility, ctx: EffectCtx): void {
    ra.cd = ra.def.internalCooldown;
    executeEffect(this.combatant, ra.def, ctx);
  }

  onAttack(target: Combatant): void {
    this.trigger('onAttack', { target });
  }

  onHit(target: Combatant, amount: number): void {
    this.trigger('onHit', { target, amount });
  }

  onTakeDamage(amount: number, source: Combatant | null): void {
    this.trigger('onTakeDamage', { source, amount });
  }

  onKill(victim: Combatant): void {
    this.trigger('onKill', { target: victim });
  }

  getAbilityStates(): AbilityState[] {
    const out: AbilityState[] = [];
    for (const ra of this.actives) {
      const cd = Math.max(0.0001, ra.def.cooldown);
      out.push({
        name: ra.def.name,
        kind: ra.def.kind === 'ultimate' ? 'Ultimate' : 'Active',
        passive: false,
        readyRatio: 1 - Math.min(1, ra.cd / cd),
        manaCost: ra.def.manaCost,
      });
    }
    for (const ra of this.passives) {
      out.push({ name: ra.def.name, kind: 'Passive', passive: true, readyRatio: 1, manaCost: 0 });
    }
    return out;
  }
}

export interface EffectCtx {
  target?: Combatant | null;
  source?: Combatant | null;
  amount?: number;
}
