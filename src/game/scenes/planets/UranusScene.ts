import { PlanetId } from '../../domain';
import { BasePlanetScene } from './BasePlanetScene';

export class UranusScene extends BasePlanetScene {
    protected planetId: PlanetId = 'URANUS';

    constructor() {
        super('UranusScene');
    }
}
