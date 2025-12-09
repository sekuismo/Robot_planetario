import { PlanetProfile } from '../types';

export const VenusProfile: PlanetProfile = {
    patrol: { dxFactor: 0.11, dy: 6, duration: 900 },
    introMessages: ['Atmósfera densa, visibilidad reducida.'],
    explorationMessages: ['Sensores térmicos saturados, ajustando.', 'Buscando terreno estable.'],
    stepGoal: 1050,
    collectionConfig: {
        enabled: true,
        sampleGoal: 10,
        damagePerSecond: 4
    }
};
