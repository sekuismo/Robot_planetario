import { Planet, PlanetId, PLANETS } from './domain';

type PlanetAssetPair = { icon: string; background: string };

const PLANET_ASSETS: Record<PlanetId, PlanetAssetPair> = {
    MERCURY: { icon: 'assets/main screen/planets/mercurio.png', background: 'assets/planets_zenital/mercurio.png' },
    VENUS: { icon: 'assets/main screen/planets/venus.png', background: 'assets/planets_zenital/venus.png' },
    EARTH: { icon: 'assets/main screen/planets/tierra.png', background: 'assets/planets_zenital/tierra.png' },
    MARS: { icon: 'assets/main screen/planets/marte.png', background: 'assets/planets_zenital/Marte.png' },
    JUPITER: { icon: 'assets/main screen/planets/jupiter.png', background: 'assets/planets_zenital/jupiter.png' },
    SATURN: { icon: 'assets/main screen/planets/saturno.png', background: 'assets/planets_zenital/saturno.png' },
    URANUS: { icon: 'assets/main screen/planets/urano.png', background: 'assets/planets_zenital/urano.png' },
    NEPTUNE: { icon: 'assets/main screen/planets/neptuno.png', background: 'assets/planets_zenital/neptuno.png' }
};

const planetsById = PLANETS.reduce((acc, planet) => {
    acc[planet.id] = planet;
    return acc;
}, {} as Record<PlanetId, Planet>);

export interface PlanetDefinition {
    planet: Planet;
    assets: PlanetAssetPair;
    textureKeys: {
        icon: string;
        background: string;
    };
}

export const PLANET_REGISTRY: Record<PlanetId, PlanetDefinition> = {
    MERCURY: {
        planet: planetsById.MERCURY,
        assets: PLANET_ASSETS.MERCURY,
        textureKeys: { icon: 'planet-MERCURY', background: 'bg-MERCURY' }
    },
    VENUS: {
        planet: planetsById.VENUS,
        assets: PLANET_ASSETS.VENUS,
        textureKeys: { icon: 'planet-VENUS', background: 'bg-VENUS' }
    },
    EARTH: {
        planet: planetsById.EARTH,
        assets: PLANET_ASSETS.EARTH,
        textureKeys: { icon: 'planet-EARTH', background: 'bg-EARTH' }
    },
    MARS: {
        planet: planetsById.MARS,
        assets: PLANET_ASSETS.MARS,
        textureKeys: { icon: 'planet-MARS', background: 'bg-MARS' }
    },
    JUPITER: {
        planet: planetsById.JUPITER,
        assets: PLANET_ASSETS.JUPITER,
        textureKeys: { icon: 'planet-JUPITER', background: 'bg-JUPITER' }
    },
    SATURN: {
        planet: planetsById.SATURN,
        assets: PLANET_ASSETS.SATURN,
        textureKeys: { icon: 'planet-SATURN', background: 'bg-SATURN' }
    },
    URANUS: {
        planet: planetsById.URANUS,
        assets: PLANET_ASSETS.URANUS,
        textureKeys: { icon: 'planet-URANUS', background: 'bg-URANUS' }
    },
    NEPTUNE: {
        planet: planetsById.NEPTUNE,
        assets: PLANET_ASSETS.NEPTUNE,
        textureKeys: { icon: 'planet-NEPTUNE', background: 'bg-NEPTUNE' }
    }
};

export const REGISTERED_PLANETS = Object.values(PLANET_REGISTRY);

export function getPlanetDefinition(planetId: PlanetId): PlanetDefinition | undefined {
    return PLANET_REGISTRY[planetId];
}
