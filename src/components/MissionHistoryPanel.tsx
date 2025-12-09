import { useEffect, useState } from 'react';
import { uiBus } from '@/game/EventBus';
import { MissionReport } from '@/game/exploration/missionModel';
import { PLANETS, PlanetId } from '@/game/domain';

type FilterState = {
    planetId: PlanetId | 'ALL';
};

const ALL_PLANETS_OPTION: FilterState['planetId'] = 'ALL';

export function MissionHistoryPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState<FilterState>({ planetId: ALL_PLANETS_OPTION });
    const [missions, setMissions] = useState<MissionReport[]>([]);

    useEffect(() => {
        // Carga inicial de memoria ya hidratada en el runtime (si existe)
        // El historial se va actualizando por eventos de mission-report.
        const handleMissionReport = (report: MissionReport) => {
            setMissions((prev) => [...prev, report]);
        };

        uiBus.on('mission-report', handleMissionReport);

        const handleKey = (ev: KeyboardEvent) => {
            if (ev.key === 'h' || ev.key === 'H') {
                setIsOpen((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handleKey);

        return () => {
            uiBus.removeListener('mission-report', handleMissionReport);
            window.removeEventListener('keydown', handleKey);
        };
    }, []);

    const filtered = missions
        .filter((m) => filter.planetId === ALL_PLANETS_OPTION || m.planetId === filter.planetId)
        .slice()
        .reverse();

    const handlePlanetFilterChange = (value: string) => {
        if (value === ALL_PLANETS_OPTION) {
            setFilter({ planetId: ALL_PLANETS_OPTION });
            return;
        }
        const id = value as PlanetId;
        setFilter({ planetId: id });
    };

    const renderProtectionSummary = (report: MissionReport): string => {
        const p = report.protectionsDecisions;
        const flag = (on: boolean) => (on ? 'ON' : 'OFF');
        const life = p.lifeProtocol ? 'PROTO' : 'OFF';
        return `T:${flag(p.temperature)} R:${flag(p.radiation)} H:${flag(p.humidity)} G:${flag(
            p.gravity
        )} Life:${life}`;
    };

    return (
        <>
            <button className="history-toggle" onClick={() => setIsOpen(true)}>
                Historial (H)
            </button>
            <div className={`history-modal ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
                <div className="history-modal__backdrop" onClick={() => setIsOpen(false)} />
                <div className="history-modal__panel">
                    <div className="history-modal__header">
                        <h3>Historial de misiones</h3>
                        <button className="history-modal__close" onClick={() => setIsOpen(false)}>
                            ×
                        </button>
                    </div>

                    <div className="history-filters">
                        <label>
                            Planeta:{' '}
                            <select
                                value={filter.planetId}
                                onChange={(e) => handlePlanetFilterChange(e.target.value)}
                            >
                                <option value={ALL_PLANETS_OPTION}>Todos</option>
                                {PLANETS.map((planet) => (
                                    <option key={planet.id} value={planet.id}>
                                        {planet.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="history-table">
                        <div className="history-table__header">
                            <span>GEN</span>
                            <span>Planeta</span>
                            <span>Resultado</span>
                            <span>Causa de fallo</span>
                            <span>Protecciones</span>
                        </div>
                        <div className="history-table__body">
                            {filtered.length === 0 && (
                                <div className="history-table__empty">
                                    No hay misiones registradas para este filtro.
                                </div>
                            )}
                            {filtered.map((mission, idx) => (
                                <div
                                    key={`${mission.planetId}-${mission.generation}-${idx}`}
                                    className="history-row"
                                >
                                    <span>{mission.generation}</span>
                                    <span>{mission.planetName}</span>
                                    <span>
                                        {mission.outcome === 'SUCCESS'
                                            ? 'Éxito'
                                            : mission.outcome === 'FAILURE'
                                            ? 'Fallo'
                                            : 'Parcial'}
                                    </span>
                                    <span>{mission.failureReason ?? '-'}</span>
                                    <span>{renderProtectionSummary(mission)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

