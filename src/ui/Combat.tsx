import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { BattleSim, FIXED_DT } from '../game/sim/BattleSim';
import { makeRng } from '../game/sim/rng';
import { ArenaRenderer3D } from '../render/ArenaRenderer3D';
import { preloadModels } from '../render/modelLoader';
import { getHeroModel } from '../render/modelManifest';
import { ARENA_W, ARENA_H } from '../shared/protocol';
import { getHero } from '../game/data/heroes';
import { useCountdown } from './hooks';
import { Tooltip } from './Tooltip';
import { AbilityTooltip } from './tooltips';
import { audio } from '../audio/AudioManager';

export function Combat() {
  const view = useGame((s) => s.view)!;
  const combat = useGame((s) => s.combat);
  const nonce = useGame((s) => s.combatNonce);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<BattleSim | null>(null);
  const [, force] = useState(0);
  const [loading, setLoading] = useState(true);
  const seconds = useCountdown(view.phaseEndsAt);

  useEffect(() => {
    if (!combat || !containerRef.current) return;
    let raf = 0;
    let disposed = false;
    let last = 0;
    let acc = 0;
    setLoading(true);
    const sim = new BattleSim(ARENA_W, ARENA_H, makeRng(combat.seed));
    sim.emitFx = true;
    sim.setupDuel(combat.a, combat.b);
    sim.youId = combat.youCombatantId === 2 ? 2 : 1;
    simRef.current = sim;

    const files = [getHeroModel(combat.a.heroId).file, getHeroModel(combat.b.heroId).file];
    const renderer = new ArenaRenderer3D();
    Promise.all([
      renderer.init(containerRef.current, ARENA_W, ARENA_H),
      preloadModels(files),
    ]).then(() => {
      if (disposed) {
        renderer.destroy();
        return;
      }
      setLoading(false);
      last = performance.now();
      const loop = (t: number) => {
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        acc += dt;
        while (acc >= FIXED_DT) {
          sim.tick(FIXED_DT);
          acc -= FIXED_DT;
        }
        renderer.sync(sim);
        force((n) => (n + 1) & 0xffff);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.destroy();
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const sim = simRef.current;
  const banner = combat ? bannerFor(sim, combat.youCombatantId, combat.spectating) : null;
  const bannerCls = banner?.cls ?? null;
  useEffect(() => {
    if (bannerCls === 'win') audio.play('victory');
    else if (bannerCls === 'lose') audio.play('defeat');
    else if (bannerCls === 'neutral') audio.play('click');
  }, [bannerCls]);

  if (!combat) return <div className="combat"><div className="empty">Preparing battle…</div></div>;

  const ca = sim?.combatants[0];
  const cb = sim?.combatants[1];
  const heroA = getHero(combat.a.heroId);
  const heroB = getHero(combat.b.heroId);

  return (
    <div className="combat">
      <div className="combat-top">
        <FighterTag
          name={combat.a.name}
          color={heroA?.color ?? '#ccc'}
          hp={ca?.hp ?? combat.a.stats.maxHp}
          maxHp={combat.a.stats.maxHp}
          mana={ca?.mana ?? 0}
          maxMana={combat.a.stats.maxMana}
          abilityIds={combat.a.abilityIds}
          you={combat.youCombatantId === 1}
        />
        <div className="vs">
          VS
          <div className="combat-timer">{seconds}s</div>
        </div>
        <FighterTag
          name={combat.b.name}
          color={heroB?.color ?? '#ccc'}
          hp={cb?.hp ?? combat.b.stats.maxHp}
          maxHp={combat.b.stats.maxHp}
          mana={cb?.mana ?? 0}
          maxMana={combat.b.stats.maxMana}
          abilityIds={combat.b.abilityIds}
          you={combat.youCombatantId === 2}
          right
        />
      </div>
      <div className="arena-stage">
        <div className="arena-host" ref={containerRef} />
        {loading && (
          <div className="arena-loading">
            <div className="arena-spinner" />
            <span>Entering the arena…</span>
          </div>
        )}
        {banner && (
          <div className={`duel-banner ${banner.cls}`}>
            <span className="duel-banner-text">{banner.text}</span>
          </div>
        )}
      </div>
      {combat.spectating && <div className="spectate-note">You were eliminated — spectating a live duel.</div>}
    </div>
  );
}

function bannerFor(
  sim: BattleSim | null,
  youCombatantId: number,
  spectating: boolean,
): { text: string; cls: string } | null {
  if (!sim || !sim.ended) return null;
  if (spectating) return { text: 'DUEL OVER', cls: 'neutral' };
  const yourTeam = youCombatantId === 2 ? 'enemy' : 'player';
  if (sim.winner === null) return { text: 'DRAW', cls: 'neutral' };
  return sim.winner === yourTeam ? { text: 'VICTORY', cls: 'win' } : { text: 'DEFEAT', cls: 'lose' };
}

function FighterTag(props: {
  name: string;
  color: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  abilityIds: string[];
  you: boolean;
  right?: boolean;
}) {
  const hpR = Math.max(0, Math.min(1, props.hp / props.maxHp));
  const mR = props.maxMana > 0 ? Math.max(0, Math.min(1, props.mana / props.maxMana)) : 0;
  const tip = (
    <div>
      <div className="tip-title">{props.name}</div>
      <div className="tip-rows">
        <div className="tip-row"><span className="k">Health</span><span className="v">{Math.ceil(props.hp)} / {Math.round(props.maxHp)}</span></div>
        {props.maxMana > 0 && (
          <div className="tip-row"><span className="k">Mana</span><span className="v">{Math.round(props.mana)} / {Math.round(props.maxMana)}</span></div>
        )}
      </div>
      {props.abilityIds.length > 0 && <div className="tip-sep" />}
      {props.abilityIds.map((aid, i) => (
        <div key={aid} style={{ marginTop: i ? 8 : 0 }}>
          <AbilityTooltip abilityId={aid} />
        </div>
      ))}
    </div>
  );
  return (
    <div className={`fighter ${props.right ? 'right' : ''}`}>
      <Tooltip content={tip}>
        <div className="fighter-name">
          <span className="f-dot" style={{ background: props.color }} />
          {props.name}
          {props.you && <span className="tag you">YOU</span>}
        </div>
      </Tooltip>
      <div className="f-bar hp"><div style={{ width: `${hpR * 100}%` }} /></div>
      {props.maxMana > 0 && <div className="f-bar mana"><div style={{ width: `${mR * 100}%` }} /></div>}
      <div className="f-hpnum">{Math.ceil(props.hp)} / {Math.round(props.maxHp)}</div>
    </div>
  );
}
