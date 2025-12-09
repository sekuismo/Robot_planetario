import { Scene } from 'phaser';
import { Planet, PlanetId } from '../../domain';
import { PLANET_REGISTRY } from '../../planetRegistry';

export abstract class BasePlanetScene extends Scene {
    protected abstract planetId: PlanetId;
    protected planet?: Planet;
    private planetBg?: Phaser.GameObjects.Image;

    constructor(key: string) {
        super(key);
    }

    preload() {
        const definition = PLANET_REGISTRY[this.planetId];
        const textureKey = definition?.textureKeys.background ?? `bg-${this.planetId}`;
        const bgPath = definition?.assets.background;
        if (bgPath && !this.textures.exists(textureKey)) {
            this.load.image(textureKey, bgPath);
        }
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');
        const { width, height } = this.scale;
        const definition = PLANET_REGISTRY[this.planetId];
        this.planet = definition?.planet;
        const textureKey = definition?.textureKeys.background ?? `bg-${this.planetId}`;

        this.planetBg = this.add.image(width / 2, height / 2, textureKey);
        this.planetBg.setDisplaySize(width, height);
        this.planetBg.setDepth(1);
    }
}
