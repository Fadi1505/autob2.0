import { useState } from 'react';
import { useGame } from '../store/gameStore';

export function Home() {
  const connect = useGame((s) => s.connect);
  const joining = useGame((s) => s.joining);
  const error = useGame((s) => s.error);

  const params = new URLSearchParams(location.search);
  const [name, setName] = useState(() => localStorage.getItem('ag_name') ?? '');
  const [room, setRoom] = useState(() => (params.get('room') ?? '').toUpperCase());

  function go(joinRoom?: string) {
    const n = name.trim() || 'Player';
    localStorage.setItem('ag_name', n);
    connect(n, joinRoom);
  }

  return (
    <div className="home">
      <div className="home-card">
        <h1 className="title">Auto Gladiators</h1>
        <p className="subtitle">8-player auto-battler · draft a gladiator, build your sects, outlast the lobby.</p>

        <label className="field">
          <span>Your name</span>
          <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Gladiator" />
        </label>

        <button className="btn primary big" disabled={joining} onClick={() => go(room || undefined)}>
          {room ? `Join room ${room}` : 'Create game'}
        </button>

        <div className="divider"><span>or join with a code</span></div>

        <div className="join-row">
          <input
            value={room}
            maxLength={4}
            onChange={(e) => setRoom(e.target.value.toUpperCase())}
            placeholder="CODE"
            className="code-input"
          />
          <button className="btn" disabled={joining || room.length < 3} onClick={() => go(room)}>
            Join
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}
      </div>
    </div>
  );
}
