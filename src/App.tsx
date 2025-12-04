import type Phaser from 'phaser';
import { useRef } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { LogPanel } from './components/LogPanel';

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);

    const handleSceneReady = (scene: Phaser.Scene) => {
        if (phaserRef.current) {
            phaserRef.current.scene = scene;
        }
    };

    return (
        <div id="app">
            <div className="ui">
                <h1>Robotinto explorador</h1>
                <p>Escena base lista para Phaser + React.</p>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%', maxWidth: '1200px' }}>
                <div style={{ flex: '1 1 60%' }}>
                    <PhaserGame ref={phaserRef} currentActiveScene={handleSceneReady} />
                </div>
                <div style={{ flex: '1 1 40%' }}>
                    <LogPanel />
                </div>
            </div>
        </div>
    );
}

export default App;
