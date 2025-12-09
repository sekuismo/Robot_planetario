import type Phaser from 'phaser';
import { useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { LogPanel } from './components/LogPanel';
import { HudOverlay } from './components/HudOverlay';

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [logOpen, setLogOpen] = useState(false);

    const handleSceneReady = (scene: Phaser.Scene) => {
        if (phaserRef.current) {
            phaserRef.current.scene = scene;
        }
    };

    return (
        <div id="app">
            <HudOverlay />
            <div className="layout">
                <div className="game-shell">
                    <PhaserGame ref={phaserRef} currentActiveScene={handleSceneReady} />
                </div>
            </div>
            <button className="log-toggle" onClick={() => setLogOpen(true)}>
                Ver registro
            </button>

            <div className={`log-modal ${logOpen ? 'open' : ''}`} aria-hidden={!logOpen}>
                <div className="log-modal__backdrop" onClick={() => setLogOpen(false)} />
                <div className="log-modal__panel">
                    <div className="log-modal__header">
                        <h3>Registro de misión</h3>
                        <button className="log-modal__close" onClick={() => setLogOpen(false)}>
                            ×
                        </button>
                    </div>
                    <LogPanel />
                </div>
            </div>
        </div>
    );
}

export default App;
