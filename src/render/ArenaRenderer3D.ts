import * as THREE from 'three';
import type { BattleSim, FxEvent } from '../game/sim/BattleSim';
import type { Combatant } from '../game/sim/Combatant';
import { instantiate, type CharInstance } from './modelLoader';
import { getHeroModel, type LogicalAnim } from './modelManifest';
import { audio } from '../audio/AudioManager';

// Sim coords (x in [0,W], y in [0,H]) map onto the ground plane (XZ); Y is up.
const SCALE = 0.06;

// KayKit characters face +Z by default; our yaw orients +Z toward the target.
const MODEL_FACING_OFFSET = 0;

interface CharView {
  group: THREE.Group;
  yaw: THREE.Group;
  bar: THREE.Group;
  hpFill: THREE.Mesh;
  manaFill: THREE.Mesh | null;
  accentMat: THREE.MeshBasicMaterial;
  facing: number;
  // glTF model (null until async load resolves)
  model: CharInstance | null;
  actions: Partial<Record<LogicalAnim, THREE.AnimationAction>>;
  activeAction: THREE.AnimationAction | null;
  current: LogicalAnim | null;
  transient: number; // seconds left on a one-shot clip before returning to locomotion
  prevAttack: number;
  prevCast: number;
  prevHurt: number;
  playedDeath: boolean;
  lastX: number;
  lastZ: number;
  knockX: number; // decaying cosmetic knockback offset
  knockZ: number;
}

interface FloatingText {
  el: HTMLDivElement;
  wx: number;
  wz: number;
  age: number;
  ttl: number;
}

interface ProjView {
  mesh: THREE.Mesh;
}

interface Spark {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  ttl: number;
  baseScale: number;
}

interface VfxView {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

const BAR_W = 1.7;

export class ArenaRenderer3D {
  private width = 0;
  private height = 0;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private wrapper: HTMLDivElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private clock = new THREE.Clock();

  private chars = new Map<number, CharView>();
  private projs = new Map<number, ProjView>();
  private vfxViews = new Map<number, VfxView>();
  private texts: FloatingText[] = [];
  private sparks: Spark[] = [];

  // Dynamic combat camera. camTarget is the smoothed look-at point; the camera
  // sits at camTarget + camBaseOffset * camZoom (zoom grows with fighter spread).
  private camTarget = new THREE.Vector3(0, 3, 0);
  private readonly camBaseOffset = new THREE.Vector3(0, 7.5, 13);
  private camZoom = 1.35;
  private shake = 0; // decaying impact shake amplitude (driven in Part B)

  async init(container: HTMLElement, width: number, height: number): Promise<void> {
    this.width = width;
    this.height = height;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    wrapper.appendChild(renderer.domElement);

    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.overflow = 'hidden';
    overlay.style.pointerEvents = 'none';
    wrapper.appendChild(overlay);

    container.appendChild(wrapper);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1018);
    scene.fog = new THREE.Fog(0x0e1018, 60, 130);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 500);
    // Tight hero shot; per-frame framing in updateCamera() refines this.
    this.camTarget.set(0, 3, 0);
    this.camZoom = 1.35;
    camera.position.copy(this.camTarget).add(this.camBaseOffset.clone().multiplyScalar(this.camZoom));
    camera.lookAt(this.camTarget);

    this.buildEnvironment(scene);

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.wrapper = wrapper;
    this.overlay = overlay;
    this.clock.start();
  }

  private buildEnvironment(scene: THREE.Scene): void {
    const halfW = (this.width * SCALE) / 2;
    const halfH = (this.height * SCALE) / 2;

    const ambient = new THREE.AmbientLight(0x8a93b5, 0.7);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff0d8, 1.4);
    key.position.set(18, 40, 22);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -halfW - 6;
    key.shadow.camera.right = halfW + 6;
    key.shadow.camera.top = halfH + 6;
    key.shadow.camera.bottom = -halfH - 6;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 120;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x4f7bff, 0.5);
    rim.position.set(-20, 16, -24);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(halfW * 2 + 6, halfH * 2 + 6),
      new THREE.MeshStandardMaterial({ color: 0x1a1f2e, roughness: 0.95, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // arena floor pad
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(halfW * 2, halfH * 2),
      new THREE.MeshStandardMaterial({ color: 0x232a3d, roughness: 0.85 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.01;
    pad.receiveShadow = true;
    scene.add(pad);

    const grid = new THREE.GridHelper(Math.max(halfW, halfH) * 2, 22, 0x2f3850, 0x222a3c);
    grid.position.y = 0.02;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);

    // center divider line
    const div = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, halfH * 2),
      new THREE.MeshBasicMaterial({ color: 0x3a4260, transparent: true, opacity: 0.4 }),
    );
    div.rotation.x = -Math.PI / 2;
    div.position.y = 0.03;
    scene.add(div);
  }

  private worldX(simX: number): number {
    return (simX - this.width / 2) * SCALE;
  }

  private worldZ(simY: number): number {
    return (simY - this.height / 2) * SCALE;
  }

  private createChar(c: Combatant): CharView {
    const color = new THREE.Color(c.color);
    const group = new THREE.Group();
    const yaw = new THREE.Group();
    group.add(yaw);

    const isYou = c.id === c.sim.youId;

    // team disc under feet (you = gold, enemy = red)
    const discMat = new THREE.MeshBasicMaterial({ color: isYou ? 0xffcf5c : 0xe05a5a, transparent: true, opacity: 0.6 });
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.12, 32), discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.04;
    group.add(disc);

    // hero-color accent ring (emissive trim around the team disc)
    const accentMat = new THREE.MeshBasicMaterial({
      color: color.clone(),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const accent = new THREE.Mesh(new THREE.RingGeometry(1.16, 1.34, 32), accentMat);
    accent.rotation.x = -Math.PI / 2;
    accent.position.y = 0.05;
    group.add(accent);

    // billboard bar group (HP + mana)
    const bar = new THREE.Group();
    bar.position.y = 3.7;
    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(BAR_W + 0.12, c.maxMana > 0 ? 0.5 : 0.32),
      new THREE.MeshBasicMaterial({ color: 0x05070d, transparent: true, opacity: 0.7 }),
    );
    bar.add(barBg);
    const hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(BAR_W, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x46d35a }),
    );
    hpFill.position.set(0, c.maxMana > 0 ? 0.11 : 0, 0.01);
    bar.add(hpFill);
    let manaFill: THREE.Mesh | null = null;
    if (c.maxMana > 0) {
      manaFill = new THREE.Mesh(
        new THREE.PlaneGeometry(BAR_W, 0.14),
        new THREE.MeshBasicMaterial({ color: 0x4f8af2 }),
      );
      manaFill.position.set(0, -0.13, 0.01);
      bar.add(manaFill);
    }
    group.add(bar);

    const view: CharView = {
      group, yaw, bar, hpFill, manaFill, accentMat,
      facing: isYou ? 0 : Math.PI,
      model: null, actions: {}, activeAction: null, current: null,
      transient: 0, prevAttack: 0, prevCast: 0, prevHurt: 0, playedDeath: false,
      lastX: this.worldX(c.x), lastZ: this.worldZ(c.y),
      knockX: 0, knockZ: 0,
    };
    this.scene!.add(group);

    // Load the glTF body asynchronously (cached/preloaded), then attach + rig actions.
    const def = getHeroModel(c.heroId);
    void instantiate(def.file, def.show).then((inst) => {
      if (!inst) return;
      inst.root.rotation.y = MODEL_FACING_OFFSET;
      yaw.add(inst.root);
      view.model = inst;
      // Resolve logical anims to actual clips and build the action map.
      const byName = new Map(inst.clips.map((cl) => [cl.name, cl] as const));
      (Object.keys(def.anims) as LogicalAnim[]).forEach((key) => {
        const clip = byName.get(def.anims[key]);
        if (clip) view.actions[key] = inst.mixer.clipAction(clip);
      });
      this.setAction(view, 'idle', true, 0);
    });

    return view;
  }

  private setAction(v: CharView, name: LogicalAnim, loop: boolean, fade = 0.15, timeScale = 1): void {
    const next = v.actions[name] ?? v.actions.idle;
    if (!next) return;
    if (v.activeAction === next) {
      if (!loop) {
        // restart a one-shot (e.g. attacking again mid-swing)
        next.reset();
        next.setEffectiveTimeScale(timeScale);
        next.setEffectiveWeight(1);
        next.play();
      }
      v.current = name;
      return;
    }
    next.reset();
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    next.enabled = true;
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    if (v.activeAction) next.crossFadeFrom(v.activeAction, fade, false);
    next.play();
    v.activeAction = next;
    v.current = name;
  }

  private playOnce(v: CharView, name: LogicalAnim, timeScale: number): void {
    const action = v.actions[name];
    if (!action) return;
    this.setAction(v, name, false, 0.1, timeScale);
    v.transient = action.getClip().duration / timeScale;
  }

  sync(sim: BattleSim): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    const dt = Math.min(0.05, this.clock.getDelta());

    for (const c of sim.combatants) {
      let view = this.chars.get(c.id);
      if (!view) {
        view = this.createChar(c);
        this.chars.set(c.id, view);
      }
      this.updateChar(view, c, dt);
    }

    this.updateProjectiles(sim);
    this.updateVfx(sim);
    this.drainFx(sim);
    this.updateSparks(dt);
    this.updateCamera(sim, dt);
    this.updateTexts(dt);

    this.renderer.render(this.scene, this.camera);
  }

  /** Frame the two fighters: pan to their midpoint and dolly out as they spread. */
  private updateCamera(sim: BattleSim, dt: number): void {
    const cam = this.camera!;
    const cs = sim.combatants;

    // Midpoint + separation of the (living) fighters.
    let mx = 0;
    let mz = 0;
    let n = 0;
    for (const c of cs) {
      mx += this.worldX(c.x);
      mz += this.worldZ(c.y);
      n++;
    }
    if (n > 0) {
      mx /= n;
      mz /= n;
    }
    let sep = 0;
    if (cs.length >= 2) {
      const ax = this.worldX(cs[0].x);
      const az = this.worldZ(cs[0].y);
      const bx = this.worldX(cs[1].x);
      const bz = this.worldZ(cs[1].y);
      sep = Math.hypot(bx - ax, bz - az);
    }

    // Smoothly chase the midpoint (dampened so the camera doesn't jitter).
    const k = Math.min(1, dt * 3);
    this.camTarget.x += (mx * 0.6 - this.camTarget.x) * k;
    this.camTarget.y += (3 - this.camTarget.y) * k;
    this.camTarget.z += (mz * 0.6 - this.camTarget.z) * k;

    // Zoom: tight when clashing, pulled back when far apart.
    const t = Math.max(0, Math.min(1, (sep - 6) / (24 - 6)));
    const targetZoom = 0.85 + t * 0.65;
    this.camZoom += (targetZoom - this.camZoom) * k;

    cam.position.copy(this.camTarget).add(this.camBaseOffset.clone().multiplyScalar(this.camZoom));

    // Impact shake (amplitude set in Part B; decays here).
    if (this.shake > 0.0001) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      cam.position.z += (Math.random() - 0.5) * this.shake * 0.5;
      this.shake *= Math.pow(0.0001, dt); // fast exponential decay
    } else {
      this.shake = 0;
    }

    cam.lookAt(this.camTarget);
  }

  private updateChar(v: CharView, c: Combatant, dt: number): void {
    const wx = this.worldX(c.x);
    const wz = this.worldZ(c.y);

    // Knockback impulse on the rising edge of hurtFlash, pushed away from facing
    // (i.e. away from the attacker the fighter is turned toward).
    if (c.alive && c.hurtFlash > v.prevHurt + 1e-3) {
      const mag = 0.4;
      v.knockX = -Math.sin(v.facing) * mag;
      v.knockZ = -Math.cos(v.facing) * mag;
    }
    // decay knockback quickly back to zero
    const kd = Math.pow(0.0005, dt);
    v.knockX *= kd;
    v.knockZ *= kd;

    v.group.position.set(wx + v.knockX, 0, wz + v.knockZ);

    // face the target (or keep last facing)
    if (c.target && c.target.alive) {
      const dx = this.worldX(c.target.x) - wx;
      const dz = this.worldZ(c.target.y) - wz;
      if (Math.abs(dx) + Math.abs(dz) > 0.0001) v.facing = Math.atan2(dx, dz);
    }
    let diff = v.facing - v.yaw.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.yaw.rotation.y += diff * Math.min(1, dt * 14);

    // hero accent ring pulse
    v.accentMat.opacity = 0.4 + 0.2 * Math.sin(this.clock.elapsedTime * 3 + c.id);

    if (v.model) v.model.mixer.update(dt);

    // bars: billboard + fill, hidden when dead
    if (c.alive) {
      v.bar.visible = true;
      v.bar.quaternion.copy(this.camera!.quaternion);
      const hpR = Math.max(0, Math.min(1, c.hp / c.maxHp));
      v.hpFill.scale.x = Math.max(0.0001, hpR);
      v.hpFill.position.x = -(BAR_W / 2) * (1 - hpR);
      (v.hpFill.material as THREE.MeshBasicMaterial).color.setHex(hpR > 0.3 ? 0x46d35a : 0xe0573a);
      if (v.manaFill && c.maxMana > 0) {
        const mR = Math.max(0, Math.min(1, c.mana / c.maxMana));
        v.manaFill.scale.x = Math.max(0.0001, mR);
        v.manaFill.position.x = -(BAR_W / 2) * (1 - mR);
      }
    } else {
      v.bar.visible = false;
    }

    // hit flash tint on the model
    const hurt = Math.max(0, Math.min(1, c.hurtFlash / 0.12));

    if (v.model) {
      if (!c.alive) {
        if (!v.playedDeath) {
          this.playOnce(v, 'death', 1);
          v.playedDeath = true;
          v.transient = 999;
          this.shake = Math.max(this.shake, 0.5);
          audio.play('death');
        }
        // sink + fade out after the death clip has mostly played
        const fade = Math.max(0, Math.min(1, (c.deadFor - 0.9) / 0.7));
        v.group.position.y = -fade * 0.4;
        this.setOpacity(v, 1 - fade);
      } else {
        // one-shot edge triggers (rising edge = the flash jumped up this frame)
        if (c.attackFlash > v.prevAttack + 1e-3) {
          this.playOnce(v, 'attack', 1.5);
          audio.play('swing');
        } else if (c.castFlash > v.prevCast + 1e-3) {
          this.playOnce(v, 'cast', 1.3);
          audio.play('cast');
        } else if (c.hurtFlash > v.prevHurt + 1e-3 && v.transient <= 0) {
          this.playOnce(v, 'hit', 1.4);
        }

        if (v.transient > 0) {
          v.transient -= dt;
        } else {
          const speed = Math.hypot(wx - v.lastX, wz - v.lastZ) / Math.max(1e-4, dt);
          this.setAction(v, speed > 0.6 ? 'run' : 'idle', true, 0.2);
        }

        this.setTint(v, hurt);
      }
    }

    v.prevAttack = c.attackFlash;
    v.prevCast = c.castFlash;
    v.prevHurt = c.hurtFlash;
    v.lastX = wx;
    v.lastZ = wz;
  }

  private setTint(v: CharView, hurt: number): void {
    if (!v.model) return;
    for (const m of v.model.meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (sm.emissive) {
          // snappier red->white pop for readability
          const h = hurt * hurt;
          sm.emissive.setRGB(h, h * 0.12, h * 0.12);
          sm.emissiveIntensity = h * 1.4;
        }
      }
    }
  }

  private setOpacity(v: CharView, op: number): void {
    if (!v.model) return;
    for (const m of v.model.meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        mat.transparent = op < 1;
        mat.opacity = op;
      }
    }
  }

  private updateProjectiles(sim: BattleSim): void {
    const seen = new Set<number>();
    for (const p of sim.projectiles) {
      seen.add(p.id);
      let pv = this.projs.get(p.id);
      if (!pv) {
        const mat = new THREE.MeshBasicMaterial({ color: p.color });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), mat);
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(0.75, 12, 10),
          new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.3 }),
        );
        mesh.add(glow);
        this.scene!.add(mesh);
        pv = { mesh };
        this.projs.set(p.id, pv);
      }
      pv.mesh.position.set(this.worldX(p.x), 1.6, this.worldZ(p.y));
    }
    for (const [id, pv] of this.projs) {
      if (!seen.has(id)) {
        this.disposeMesh(pv.mesh);
        this.projs.delete(id);
      }
    }
  }

  private updateVfx(sim: BattleSim): void {
    const seen = new Set<number>();
    for (const v of sim.vfx) {
      seen.add(v.id);
      let vv = this.vfxViews.get(v.id);
      if (!vv) {
        const mat = new THREE.MeshBasicMaterial({ color: v.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 40), mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.06;
        this.scene!.add(mesh);
        vv = { mesh, mat };
        this.vfxViews.set(v.id, vv);
      }
      const ratio = Math.min(1, v.t / v.ttl);
      const r = v.maxRadius * SCALE * (0.3 + 0.7 * ratio);
      vv.mesh.scale.set(r, r, r);
      vv.mesh.position.set(this.worldX(v.x), 0.06, this.worldZ(v.y));
      vv.mat.opacity = 0.8 * (1 - ratio);
    }
    for (const [id, vv] of this.vfxViews) {
      if (!seen.has(id)) {
        this.disposeMesh(vv.mesh);
        this.vfxViews.delete(id);
      }
    }
  }

  private drainFx(sim: BattleSim): void {
    if (sim.fxEvents.length === 0) return;
    for (const e of sim.fxEvents) {
      this.spawnText(e);
      if (e.kind === 'damage' || e.kind === 'crit') {
        this.spawnSpark(e.x, e.y, e.kind === 'crit');
        this.shake = Math.max(this.shake, e.kind === 'crit' ? 0.3 : 0.07);
        audio.play(e.kind === 'crit' ? 'crit' : 'hit');
      } else if (e.kind === 'evade') {
        audio.play('evade');
      }
    }
    sim.fxEvents.length = 0;
  }

  private spawnSpark(simX: number, simY: number, crit: boolean): void {
    if (!this.scene) return;
    const color = crit ? 0xffd23a : 0xffce9e;
    const base = crit ? 1.4 : 0.85;
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // a star-ish burst quad (cheap, camera-facing handled by billboarding each frame)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.set(this.worldX(simX), 1.7, this.worldZ(simY));
    this.scene.add(mesh);
    this.sparks.push({ mesh, mat, age: 0, ttl: crit ? 0.32 : 0.22, baseScale: base });
  }

  private updateSparks(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      if (s.age >= s.ttl) {
        this.disposeMesh(s.mesh);
        this.sparks.splice(i, 1);
        continue;
      }
      const k = s.age / s.ttl;
      const scale = s.baseScale * (0.5 + k * 1.8);
      s.mesh.scale.set(scale, scale, scale);
      if (this.camera) s.mesh.quaternion.copy(this.camera.quaternion);
      s.mesh.rotateZ(s.age * 7); // spin within the camera-facing plane
      s.mat.opacity = 0.95 * (1 - k * k);
    }
  }

  private spawnText(e: FxEvent): void {
    if (!this.overlay) return;
    const el = document.createElement('div');
    el.className = `fx-text fx-${e.kind}`;
    if (e.kind === 'evade') el.textContent = 'EVADE';
    else if (e.kind === 'heal') el.textContent = `+${Math.round(e.amount ?? 0)}`;
    else el.textContent = `${Math.round(e.amount ?? 0)}`;
    this.overlay.appendChild(el);
    const jitter = (Math.random() - 0.5) * 0.8;
    this.texts.push({ el, wx: this.worldX(e.x) + jitter, wz: this.worldZ(e.y), age: 0, ttl: 0.95 });
  }

  private updateTexts(dt: number): void {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.age += dt;
      if (t.age >= t.ttl) {
        t.el.remove();
        this.texts.splice(i, 1);
        continue;
      }
      const k = t.age / t.ttl;
      const screen = this.projectWorld(t.wx, 3.2 + k * 1.6, t.wz);
      if (!screen.visible) {
        t.el.style.display = 'none';
        continue;
      }
      t.el.style.display = '';
      t.el.style.left = `${screen.x}px`;
      t.el.style.top = `${screen.y}px`;
      t.el.style.opacity = `${1 - k * k}`;
    }
  }

  /** Project sim coords (with a world-up offset) to overlay pixel coords. */
  project(simX: number, simY: number, worldY = 3): { x: number; y: number; visible: boolean } {
    return this.projectWorld(this.worldX(simX), worldY, this.worldZ(simY));
  }

  private projectWorld(wx: number, wy: number, wz: number): { x: number; y: number; visible: boolean } {
    if (!this.camera) return { x: 0, y: 0, visible: false };
    const v = new THREE.Vector3(wx, wy, wz).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-v.y * 0.5 + 0.5) * this.height,
      visible: v.z < 1,
    };
  }

  private disposeMesh(mesh: THREE.Mesh): void {
    this.scene?.remove(mesh);
    mesh.geometry.dispose();
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
    else m.dispose();
  }

  destroy(): void {
    for (const t of this.texts) t.el.remove();
    this.texts = [];
    for (const s of this.sparks) this.disposeMesh(s.mesh);
    this.sparks = [];
    this.chars.clear();
    this.projs.clear();
    this.vfxViews.clear();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    if (this.wrapper && this.wrapper.parentElement) {
      this.wrapper.parentElement.removeChild(this.wrapper);
    }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.wrapper = null;
    this.overlay = null;
  }
}
