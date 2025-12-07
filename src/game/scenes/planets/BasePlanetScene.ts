import { Scene } from 'phaser';
import { PLANETS, Planet, PlanetId } from '../../domain';

export abstract class BasePlanetScene extends Scene {
    protected abstract planetId: PlanetId;
    protected planet?: Planet;
    private planetBg?: Phaser.GameObjects.Image;

    constructor(key: string) {
        super(key);
    }

    preload() {
        const bgPath = this.getPlanetBgPath(this.planetId);
        this.load.image(`bg-${this.planetId}`, bgPath);
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');
        const { width, height } = this.scale;
        this.planet = PLANETS.find((p) => p.id === this.planetId);

        this.planetBg = this.add.image(width / 2, height / 2, `bg-${this.planetId}`);
        this.planetBg.setDisplaySize(width, height);
        this.planetBg.setDepth(1);
    }

    private getPlanetBgPath(planetId: PlanetId): string {
        const paths: Record<PlanetId, string> = {
            MERCURY: 'assets/planets_zenital/mercurio.png',
            VENUS: 'assets/planets_zenital/venus.png',
            EARTH: 'assets/planets_zenital/tierra.png',
            MARS: 'assets/planets_zenital/Marte.png',
            JUPITER: 'assets/planets_zenital/jupiter.png',
            SATURN: 'assets/planets_zenital/saturno.png',
            URANUS: 'assets/planets_zenital/urano.png',
            NEPTUNE: 'assets/planets_zenital/neptuno.png'
        };
        return paths[planetId];
    }
}
