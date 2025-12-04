import { EventBus } from '@/game/EventBus';
import { PLANETS, PlanetId } from '@/game/domain';

const planetAsset: Record<PlanetId, string> = {
    MERCURY: '/assets/main screen/planets/mercurio.png',
    VENUS: '/assets/main screen/planets/venus.png',
    EARTH: '/assets/main screen/planets/tierra.png',
    MARS: '/assets/main screen/planets/marte.png',
    JUPITER: '/assets/main screen/planets/jupiter.png',
    SATURN: '/assets/main screen/planets/saturno.png',
    URANUS: '/assets/main screen/planets/urano.png',
    NEPTUNE: '/assets/main screen/planets/neptuno.png'
};

export function PlanetSelector() {
    return (
        <div className="planet-selector">
            <h3>Selecciona un planeta</h3>
            <div className="planet-grid">
                {PLANETS.map((planet) => (
                    <button
                        key={planet.id}
                        className="planet-card"
                        onClick={() => EventBus.emit('start-mission', planet.id)}
                    >
                        <img
                            src={planetAsset[planet.id]}
                            alt={planet.name}
                            width={120}
                            height={120}
                        />
                        <span>{planet.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
