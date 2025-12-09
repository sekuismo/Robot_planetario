import { Scene } from 'phaser';
import { REGISTERED_PLANETS } from '../planetRegistry';
import { createSceneCoordinator } from '../sceneCoordinator';
import { loadRobotMemory } from '../persistence/robotintoMemory';
import { seedMissionHistory } from '../exploration/missionModel';

export class BootScene extends Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        this.load.image('start-bg', 'assets/main_back.png');
        this.load.image('loading-screen', 'assets/Back_loading.png');
        this.load.image('main-bg', 'assets/main screen/no planets.png');
        this.load.image('travel-bg', 'assets/viaje/fondo_nave_nodriza.png');
        this.load.image('mothership', 'assets/viaje/nave_nodriza.png');
        this.load.image('mothership-thrust', 'assets/viaje/nave_nodriza_propulsion.png');
        this.load.image('travel-star', 'assets/star.png');

        REGISTERED_PLANETS.forEach(({ textureKeys, assets }) => {
            if (!this.textures.exists(textureKeys.icon)) {
                this.load.image(textureKeys.icon, assets.icon);
            }
        });
    }

    create() {
        const memory = loadRobotMemory();
        seedMissionHistory(memory.missionHistory ?? []);

        const coordinator = createSceneCoordinator(this.scene);
        coordinator.registerBaseScenes();
        coordinator.registerPlanetScenes();

        this.scene.start('StartScene');
    }
}
