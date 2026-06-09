import type { CombatBuild, Team } from '../types';
import { getAbility } from '../data/abilities';
import type { Rng } from './rng';
import { Combatant } from './Combatant';

export interface Projectile {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  target: Combatant | null;
  source: Combatant;
  damage: number;
  speed: number;
  color: number;
  radius: number;
  dead: boolean;
}

export interface Vfx {
  id: number;
  x: number;
  y: number;
  maxRadius: number;
  color: number;
  t: number;
  ttl: number;
}

export interface ProjectileInit {
  x: number;
  y: number;
  target: Combatant;
  source: Combatant;
  damage: number;
  speed: number;
  color: number;
  radius: number;
}

export interface VfxInit {
  x: number;
  y: number;
  maxRadius: number;
  color: number;
  ttl: number;
}

export interface DuelResult {
  winner: Team | null;
  ticks: number;
  hp: Record<number, number>;
}

// Cosmetic-only combat events (floating text). Consumed by the client renderer;
// never read on the server. Gated by BattleSim.emitFx so they don't accumulate
// during headless authoritative runs.
export type FxKind = 'damage' | 'crit' | 'evade' | 'heal';

export interface FxEvent {
  kind: FxKind;
  x: number;
  y: number;
  amount?: number;
}

export const FIXED_DT = 1 / 30;

// Deterministic 1v1 duel. Construct with the same (builds, seed) on server and
// client and it produces identical results.
export class BattleSim {
  readonly width: number;
  readonly height: number;
  readonly rng: Rng;

  combatants: Combatant[] = [];
  projectiles: Projectile[] = [];
  vfx: Vfx[] = [];

  /** Client sets this true to collect cosmetic Fx; server leaves it false. */
  emitFx = false;
  fxEvents: FxEvent[] = [];

  /** Which combatant id the local viewer "owns" (for renderer highlight). */
  youId = 1;

  /** Re-entrancy depth for damage events (prevents thorns/reflect cycles). */
  dmgDepth = 0;

  ended = false;
  winner: Team | null = null;
  elapsed = 0;

  private nextId = 1;

  constructor(width: number, height: number, rng: Rng) {
    this.width = width;
    this.height = height;
    this.rng = rng;
  }

  setupDuel(a: CombatBuild, b: CombatBuild): void {
    const ca = this.makeFighter('player', a, this.width * 0.28, this.height / 2);
    const cb = this.makeFighter('enemy', b, this.width * 0.72, this.height / 2);
    this.combatants.push(ca, cb);
  }

  private makeFighter(team: Team, build: CombatBuild, x: number, y: number): Combatant {
    const c = new Combatant(this.nextId++, this, team, build.stats, build.name, build.color, x, y);
    c.heroId = build.heroId;
    const defs = build.abilityIds.map(getAbility).filter((d): d is NonNullable<typeof d> => !!d);
    c.controller.setup(defs);
    return c;
  }

  /** Escalating damage so duels always conclude well before the cap. */
  damageScale(): number {
    return 1 + Math.max(0, this.elapsed - 4) * 1.2;
  }

  spawnProjectile(init: ProjectileInit): void {
    this.projectiles.push({
      id: this.nextId++,
      x: init.x,
      y: init.y,
      tx: init.target.x,
      ty: init.target.y,
      target: init.target,
      source: init.source,
      damage: init.damage,
      speed: init.speed,
      color: init.color,
      radius: init.radius,
      dead: false,
    });
  }

  addVfx(init: VfxInit): void {
    this.vfx.push({ id: this.nextId++, x: init.x, y: init.y, maxRadius: init.maxRadius, color: init.color, t: 0, ttl: init.ttl });
  }

  /** Records a cosmetic floating-text event. No-op unless emitFx is enabled. */
  pushFx(e: FxEvent): void {
    if (!this.emitFx) return;
    this.fxEvents.push(e);
  }

  tick(dt: number): void {
    if (this.ended) {
      // keep VFX/projectiles draining for a beat after the end
      this.updateProjectiles(dt);
      this.ageVfx(dt);
      return;
    }
    this.elapsed += dt;
    for (const c of this.combatants) c.update(dt);
    this.updateProjectiles(dt);
    this.ageVfx(dt);
    this.checkEnd();
  }

  private updateProjectiles(dt: number): void {
    for (const proj of this.projectiles) {
      if (proj.dead) continue;
      if (proj.target && proj.target.alive) {
        proj.tx = proj.target.x;
        proj.ty = proj.target.y;
      }
      const dx = proj.tx - proj.x;
      const dy = proj.ty - proj.y;
      const dist = Math.hypot(dx, dy);
      const step = proj.speed * dt;
      if (dist <= step + 8) {
        proj.x = proj.tx;
        proj.y = proj.ty;
        proj.dead = true;
        if (proj.target && proj.target.alive) proj.target.takeDamage(proj.damage, proj.source);
      } else {
        proj.x += (dx / dist) * step;
        proj.y += (dy / dist) * step;
      }
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
  }

  private ageVfx(dt: number): void {
    for (const v of this.vfx) v.t += dt;
    this.vfx = this.vfx.filter((v) => v.t < v.ttl);
  }

  private checkEnd(): void {
    const alive = this.combatants.filter((c) => c.alive);
    if (alive.length <= 1) {
      this.ended = true;
      this.winner = alive.length === 1 ? alive[0].team : null;
    }
  }

  /** Headless fast-forward for the authoritative server result. */
  runToEnd(maxTime: number): DuelResult {
    let ticks = 0;
    const maxTicks = Math.ceil(maxTime / FIXED_DT);
    while (!this.ended && ticks < maxTicks) {
      this.tick(FIXED_DT);
      ticks++;
    }
    if (!this.ended) {
      // timeout: highest HP fraction wins
      this.ended = true;
      const [a, b] = this.combatants;
      const fa = a.hp / a.maxHp;
      const fb = b.hp / b.maxHp;
      this.winner = fa === fb ? null : fa > fb ? a.team : b.team;
    }
    const hp: Record<number, number> = {};
    for (const c of this.combatants) hp[c.id] = Math.max(0, c.hp);
    return { winner: this.winner, ticks, hp };
  }
}
