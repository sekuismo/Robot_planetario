import { PlanetId } from '../../domain';
import { BasePlanetScene } from './BasePlanetScene';

export class MarsScene extends BasePlanetScene {
    protected planetId: PlanetId = 'MARS';

    constructor() {
        super('MarsScene');
    }
}
