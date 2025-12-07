import { PlanetProfile } from '../types';

export const EarthProfile: PlanetProfile = {
    patrol: { dxFactor: 0.16, dy: 0, duration: 950 },
    introMessages: ['Parámetros dentro de rango, procediendo a explorar.'],
    explorationMessages: ['Recolectando muestras del suelo.', 'Midiendo humedad ambiental.'],
    stepGoal: 1000
};
