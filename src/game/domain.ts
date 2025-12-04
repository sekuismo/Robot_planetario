export type PlanetId =
    | 'MERCURY'
    | 'VENUS'
    | 'EARTH'
    | 'MARS'
    | 'JUPITER'
    | 'SATURN'
    | 'URANUS'
    | 'NEPTUNE';

export interface Planet {
    id: PlanetId;
    name: string;
    temperatureC: number;
    gravityG: number;
    humidity: number; // 0-100
    radiation: number; // 0-100
    hasLife: boolean;
    hasSurface: boolean; // true si tiene superficie solida, false si es gaseoso
}

export const PLANETS: Planet[] = [
    {
        id: 'MERCURY',
        name: 'Mercurio',
        temperatureC: 430,
        gravityG: 0.38,
        humidity: 0,
        radiation: 85,
        hasLife: false,
        hasSurface: true
    },
    {
        id: 'VENUS',
        name: 'Venus',
        temperatureC: 470,
        gravityG: 0.9,
        humidity: 5,
        radiation: 90,
        hasLife: false,
        hasSurface: true
    },
    {
        id: 'EARTH',
        name: 'Tierra',
        temperatureC: 15,
        gravityG: 1,
        humidity: 72,
        radiation: 5,
        hasLife: true,
        hasSurface: true
    },
    {
        id: 'MARS',
        name: 'Marte',
        temperatureC: -60,
        gravityG: 0.38,
        humidity: 10,
        radiation: 40,
        hasLife: false,
        hasSurface: true
    },
    {
        id: 'JUPITER',
        name: 'Jupiter',
        temperatureC: -110,
        gravityG: 2.5,
        humidity: 80,
        radiation: 70,
        hasLife: false,
        hasSurface: false
    },
    {
        id: 'SATURN',
        name: 'Saturno',
        temperatureC: -140,
        gravityG: 1.07,
        humidity: 75,
        radiation: 60,
        hasLife: false,
        hasSurface: false
    },
    {
        id: 'URANUS',
        name: 'Urano',
        temperatureC: -195,
        gravityG: 0.89,
        humidity: 60,
        radiation: 50,
        hasLife: false,
        hasSurface: false
    },
    {
        id: 'NEPTUNE',
        name: 'Neptuno',
        temperatureC: -200,
        gravityG: 1.14,
        humidity: 70,
        radiation: 55,
        hasLife: false,
        hasSurface: false
    }
];

export interface PlanetKnowledge {
    temperatureThreshold: number;
    radiationThreshold: number;
    gravityThreshold: number;
    humidityThreshold: number;
    failures: number;
    successes: number;
}

export type KnowledgeState = Record<PlanetId, PlanetKnowledge>;

export function createInitialKnowledgeState(): KnowledgeState {
    const laxThresholds = {
        temperatureThreshold: 999,
        radiationThreshold: 150,
        gravityThreshold: 10,
        humidityThreshold: 120
    };

    return PLANETS.reduce((state, planet) => {
        state[planet.id] = {
            ...laxThresholds,
            failures: 0,
            successes: 0
        };
        return state;
    }, {} as KnowledgeState);
}
