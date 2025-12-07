import { PlanetId } from '../../domain';
import { BasePlanetScene } from './BasePlanetScene';

export class VenusScene extends BasePlanetScene {
    protected planetId: PlanetId = 'VENUS';

    constructor() {
        super('VenusScene');
    }
}
