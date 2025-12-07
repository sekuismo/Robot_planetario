import { PlanetId } from '../../domain';
import { BasePlanetScene } from './BasePlanetScene';

export class NeptuneScene extends BasePlanetScene {
    protected planetId: PlanetId = 'NEPTUNE';

    constructor() {
        super('NeptuneScene');
    }
}
