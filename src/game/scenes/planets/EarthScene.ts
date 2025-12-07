import { PlanetId } from '../../domain';
import { BasePlanetScene } from './BasePlanetScene';

export class EarthScene extends BasePlanetScene {
    protected planetId: PlanetId = 'EARTH';

    constructor() {
        super('EarthScene');
    }
}
