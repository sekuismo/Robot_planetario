import { PlanetProfile } from '../types';

export const MarsProfile: PlanetProfile = {
    patrol: { dxFactor: 0.13, dy: -10, duration: 880 },
    introMessages: ['Tormenta de polvo ligera detectada.'],
    explorationMessages: ['Polvo rojo afecta la visibilidad.', 'Buscando compuestos orgánicos.'],
    stepGoal: 1150
};
