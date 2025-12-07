import { PlanetId } from '../../domain';
import { BasePlanetScene } from './BasePlanetScene';

export class SaturnScene extends BasePlanetScene {
    protected planetId: PlanetId = 'SATURN';

    constructor() {
        super('SaturnScene');
    }
}
