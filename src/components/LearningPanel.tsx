import { useEffect, useState } from 'react';
import { PLANETS, PlanetId } from '@/game/domain';
import { loadRobotMemory, RobotMemory } from '@/game/persistence/robotintoMemory';
import { uiBus } from '@/game/EventBus';

export function LearningPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [memory, setMemory] = useState<RobotMemory | null>(null);

    useEffect(() => {
        const refresh = () => {
            setMemory(loadRobotMemory());
        };

        // Carga inicial desde localStorage
        refresh();

        // Refresca cada vez que llega un nuevo reporte de misión
        const handleMissionReport = () => {
            refresh();
        };

        uiBus.on('mission-report', handleMissionReport);

        const handleKey = (ev: KeyboardEvent) => {
            if (ev.key === 'l' || ev.key === 'L') {
                setIsOpen((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKey);

        return () => {
            uiBus.removeListener('mission-report', handleMissionReport);
            window.removeEventListener('keydown', handleKey);
        };
    }, []);

    const knowledgeByPlanet = memory?.knowledgeByPlanet ?? null;

    const getPlanetKnowledge = (planetId: PlanetId) => {
        return knowledgeByPlanet ? knowledgeByPlanet[planetId] : undefined;
    };

    const renderExperience = (planetId: PlanetId): string => {
        const k = getPlanetKnowledge(planetId);
        if (!k) {
            return 'Sin datos';
        }
        const missions = (k.failures ?? 0) + (k.successes ?? 0);
        if (missions === 0) {
            return '0 misiones (no explorado)';
        }
        return `${missions} misión${missions === 1 ? '' : 'es'}`;
    };

    return (
        <>
            <button className="learning-toggle" onClick={() => setIsOpen(true)}>
                Aprendizaje (L)
            </button>
            <div className={`learning-modal ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
                <div className="learning-modal__backdrop" onClick={() => setIsOpen(false)} />
                <div className="learning-modal__panel">
                    <div className="learning-modal__header">
                        <h3>Cerebro de Robotinto – Aprendizaje</h3>
                        <button className="learning-modal__close" onClick={() => setIsOpen(false)}>
                            ×
                        </button>
                    </div>

                    <div className="learning-table">
                        <div className="learning-table__header">
                            <span>Planeta</span>
                            <span>Umbral Temp peligrosa</span>
                            <span>Umbral Radiación peligrosa</span>
                            <span>Umbral Humedad peligrosa</span>
                            <span>Umbral Gravedad peligrosa</span>
                            <span>Experiencia</span>
                        </div>
                        <div className="learning-table__body">
                            {PLANETS.map((planet) => {
                                const k = getPlanetKnowledge(planet.id);
                                return (
                                    <div key={planet.id} className="learning-row">
                                        <span>{planet.name}</span>
                                        <span>
                                            {k ? `${k.temperatureThreshold}°C` : 'sin datos'}
                                        </span>
                                        <span>
                                            {k ? `${k.radiationThreshold}` : 'sin datos'}
                                        </span>
                                        <span>
                                            {k ? `${k.humidityThreshold}%` : 'sin datos'}
                                        </span>
                                        <span>
                                            {k ? `${k.gravityThreshold}g` : 'sin datos'}
                                        </span>
                                        <span>{renderExperience(planet.id)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
