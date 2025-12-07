import { PlanetId } from '../../domain';
import { BasePlanetScene } from './BasePlanetScene';

export class JupiterScene extends BasePlanetScene {
    protected planetId: PlanetId = 'JUPITER';

    constructor() {
        super('JupiterScene');
    }
}
