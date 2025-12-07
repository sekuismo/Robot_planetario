import { PlanetId } from './domain';

export type PlanetConfig = {
    patrol?: { dxFactor: number; dy: number; duration: number };
    introMessages?: string[];
    dangerOverrides?: Partial<{ temperatureC: number; radiation: number; gravityG: number; humidity: number }>;
    explorationMessages?: string[];
    stepGoal?: number;
};

export const PLANET_CONFIG: Record<PlanetId, PlanetConfig> = {
    MERCURY: {
        patrol: { dxFactor: 0.14, dy: 12, duration: 850 },
        introMessages: ['Superficie rocosa y árida.'],
        explorationMessages: ['Recolectando fragmentos de roca.', 'Midiendo radiación de superficie.'],
        stepGoal: 1100
    },
    VENUS: {
        patrol: { dxFactor: 0.11, dy: 6, duration: 900 },
        introMessages: ['Atmósfera densa, visibilidad reducida.'],
        explorationMessages: ['Sensores térmicos saturados, ajustando.', 'Buscando terreno estable.'],
        stepGoal: 1050
    },
    EARTH: {
        patrol: { dxFactor: 0.16, dy: 0, duration: 950 },
        introMessages: ['Parámetros dentro de rango, procediendo a explorar.'],
        explorationMessages: ['Recolectando muestras del suelo.', 'Midiendo humedad ambiental.'],
        stepGoal: 1000
    },
    MARS: {
        patrol: { dxFactor: 0.13, dy: -10, duration: 880 },
        introMessages: ['Tormenta de polvo ligera detectada.'],
        explorationMessages: ['Polvo rojo afecta la visibilidad.', 'Buscando compuestos orgánicos.'],
        stepGoal: 1150
    },
    JUPITER: {
        dangerOverrides: { gravityG: 1.2, radiation: 60 },
        introMessages: ['Entorno gaseoso extremo, orbita controlada.']
    },
    SATURN: {
        dangerOverrides: { gravityG: 1.1, radiation: 55 },
        introMessages: ['Anillos activos, trayectoria ajustada.']
    },
    URANUS: {
        dangerOverrides: { radiation: 55 },
        introMessages: ['Atmósfera fría, sistemas en modo seguro.']
    },
    NEPTUNE: {
        dangerOverrides: { radiation: 60 },
        introMessages: ['Vientos supersónicos detectados.']
    }
};
