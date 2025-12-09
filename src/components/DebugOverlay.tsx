import { useEffect, useState } from 'react';
import { uiBus } from '@/game/EventBus';
import { PlanetId, PlanetKnowledge } from '@/game/domain';

type ProtectionDebugState = {
    temperature: boolean;
    radiation: boolean;
    gravity: boolean;
    humidity: boolean;
    lifeProtocol: boolean;
};

type DebugState = {
    generation: number;
    planetId?: PlanetId;
    planetName?: string;
    thresholds?: PlanetKnowledge;
    protections?: ProtectionDebugState;
    missions?: {
        failures: number;
        successes: number;
    };
};

export function DebugOverlay() {
    const [isOpen, setIsOpen] = useState(false);
    const [state, setState] = useState<DebugState | null>(null);

    useEffect(() => {
        const handleDebugState = (payload: DebugState) => {
            setState(payload);
        };

        uiBus.on('debug-state', handleDebugState);

        const handleKey = (ev: KeyboardEvent) => {
            if (ev.key === 'F2') {
                ev.preventDefault();
                setIsOpen((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKey);

        return () => {
            uiBus.removeListener('debug-state', handleDebugState);
            window.removeEventListener('keydown', handleKey);
        };
    }, []);

    if (!isOpen || !state) {
        return null;
    }

    const thresholds = state.thresholds;
    const protections = state.protections;
    const missions = state.missions;
    const totalMissions =
        missions !== undefined ? (missions.failures ?? 0) + (missions.successes ?? 0) : undefined;

    const flag = (on: boolean | undefined) => (on ? 'ON' : 'OFF');

    return (
        <div className="debug-overlay">
            <div className="debug-overlay__panel">
                <div>DEBUG – Cerebro en tiempo real</div>
                <div>GEN: {state.generation ?? '-'}</div>
                <div>
                    Planeta:{' '}
                    {state.planetName
                        ? `${state.planetName} (${state.planetId ?? '-'})`
                        : 'N/A'}
                </div>
                <div>
                    Umbrales:{' '}
                    {thresholds ? (
                        <>
                            Temp {thresholds.temperatureThreshold}C · Rad{' '}
                            {thresholds.radiationThreshold} · Grav{' '}
                            {thresholds.gravityThreshold}g · Hum{' '}
                            {thresholds.humidityThreshold}%
                        </>
                    ) : (
                        'sin datos'
                    )}
                </div>
                <div>
                    Protecciones:{' '}
                    {protections ? (
                        <>
                            T:{flag(protections.temperature)} · R:{flag(protections.radiation)} ·
                            G:{flag(protections.gravity)} · H:{flag(protections.humidity)} ·
                            Vida:{flag(protections.lifeProtocol)}
                        </>
                    ) : (
                        'sin datos'
                    )}
                </div>
                <div>
                    Experiencia:{' '}
                    {missions && totalMissions !== undefined
                        ? `${totalMissions} misiones (Éxitos: ${missions.successes ?? 0}, Fallos: ${
                              missions.failures ?? 0
                          })`
                        : 'sin datos'}
                </div>
            </div>
        </div>
    );
}

