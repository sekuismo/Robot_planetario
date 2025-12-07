import { PlanetId } from '../../domain';
import { BasePlanetScene } from './BasePlanetScene';

export class MercuryScene extends BasePlanetScene {
    protected planetId: PlanetId = 'MERCURY';

    constructor() {
        super('MercuryScene');
    }
}
