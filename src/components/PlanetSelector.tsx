import { uiBus } from '@/game/EventBus';
import { REGISTERED_PLANETS } from '@/game/planetRegistry';

export function PlanetSelector() {
    return (
        <div className="planet-selector">
            <h3>Selecciona un planeta</h3>
            <div className="planet-grid">
                {REGISTERED_PLANETS.map(({ planet, assets }) => (
                    <button
                        key={planet.id}
                        className="planet-card"
                        onClick={() => uiBus.emit('start-mission', planet.id)}
                    >
                        <img
                            src={`/${assets.icon}`}
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
