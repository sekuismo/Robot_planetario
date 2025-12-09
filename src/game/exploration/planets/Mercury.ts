import { PlanetProfile } from '../types';

export const MercuryProfile: PlanetProfile = {
    patrol: { dxFactor: 0.14, dy: 12, duration: 850 },
    introMessages: ['Superficie rocosa y árida.'],
    explorationMessages: ['Recolectando fragmentos de roca.', 'Midiendo radiación de superficie.'],
    stepGoal: 1100,
    collectionConfig: {
        enabled: true,
        sampleGoal: 10,
        damagePerSecond: 3
    }
};
