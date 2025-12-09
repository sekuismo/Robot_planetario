import Phaser from 'phaser';
import { explorationBus, navigationBus } from './EventBus';
import { Planet, PlanetId } from './domain';
import { PLANET_REGISTRY } from './planetRegistry';
import { ExplorationScene } from './scenes/ExplorationScene';
import { StartScene } from './scenes/StartScene';
import { TravelScene } from './scenes/TravelScene';
import { EarthScene } from './scenes/planets/EarthScene';
import { JupiterScene } from './scenes/planets/JupiterScene';
import { MarsScene } from './scenes/planets/MarsScene';
import { MercuryScene } from './scenes/planets/MercuryScene';
import { NeptuneScene } from './scenes/planets/NeptuneScene';
import { SaturnScene } from './scenes/planets/SaturnScene';
import { UranusScene } from './scenes/planets/UranusScene';
import { VenusScene } from './scenes/planets/VenusScene';

type SceneCtor = new () => Phaser.Scene;

const PLANET_SCENES: Record<PlanetId, { key: string; ctor: SceneCtor }> = {
    MERCURY: { key: 'MercuryScene', ctor: MercuryScene },
    VENUS: { key: 'VenusScene', ctor: VenusScene },
    EARTH: { key: 'EarthScene', ctor: EarthScene },
    MARS: { key: 'MarsScene', ctor: MarsScene },
    JUPITER: { key: 'JupiterScene', ctor: JupiterScene },
    SATURN: { key: 'SaturnScene', ctor: SaturnScene },
    URANUS: { key: 'UranusScene', ctor: UranusScene },
    NEPTUNE: { key: 'NeptuneScene', ctor: NeptuneScene }
};

export class SceneCoordinator {
    private currentPlanetSceneKey?: string;

    constructor(private readonly sceneManager: Phaser.Scenes.ScenePlugin) {
        navigationBus.on('start-requested', this.handleStartRequested, this);
        navigationBus.on('map-ready', this.handleMapReady, this);
        navigationBus.on('launch-exploration', this.handleLaunchExploration, this);
        navigationBus.on('return-to-map', this.handleReturnToMap, this);
    }

    registerBaseScenes() {
        this.addScene('StartScene', StartScene);
        this.addScene('TravelScene', TravelScene);
        this.addScene('ExplorationScene', ExplorationScene);
    }

    registerPlanetScenes() {
        Object.values(PLANET_SCENES).forEach(({ key, ctor }) => this.addScene(key, ctor));
    }

    private addScene(key: string, ctor: SceneCtor) {
        if (this.sceneManager.manager.keys[key]) {
            return;
        }
        this.sceneManager.add(key, ctor, false);
    }

    private ensureRunning(key: string) {
        if (!this.sceneManager.isActive(key)) {
            this.sceneManager.launch(key);
        }
    }

    private handleStartRequested = () => {
        this.ensureRunning('TravelScene');
        this.sceneManager.bringToTop('TravelScene');
    };

    private handleMapReady = (_payload: { sceneKey: string }) => {
        if (this.sceneManager.isActive('StartScene')) {
            this.sceneManager.stop('StartScene');
        }
        this.sceneManager.bringToTop('TravelScene');
    };

    private handleLaunchExploration = ({ planetId }: { planetId: PlanetId }) => {
        const planetMeta = PLANET_REGISTRY[planetId];
        const planetScene = PLANET_SCENES[planetId];
        if (!planetMeta || !planetScene) {
            console.warn(`[SceneCoordinator] Planet "${planetId}" not registered`);
            return;
        }

        if (this.currentPlanetSceneKey && this.currentPlanetSceneKey !== planetScene.key && this.sceneManager.isActive(this.currentPlanetSceneKey)) {
            this.sceneManager.stop(this.currentPlanetSceneKey);
        }
        this.currentPlanetSceneKey = planetScene.key;

        if (this.sceneManager.isActive(planetScene.key)) {
            this.sceneManager.stop(planetScene.key);
        }
        this.sceneManager.launch(planetScene.key, { planetId });

        this.ensureRunning('ExplorationScene');

        this.sceneManager.bringToTop(planetScene.key);
        this.sceneManager.bringToTop('ExplorationScene');

        this.emitBeginExplorationWhenReady(planetMeta.planet);
    };

    private handleReturnToMap = () => {
        if (this.currentPlanetSceneKey && this.sceneManager.isActive(this.currentPlanetSceneKey)) {
            this.sceneManager.stop(this.currentPlanetSceneKey);
        }
        this.sceneManager.bringToTop('TravelScene');
    };

    destroy() {
        navigationBus.off('start-requested', this.handleStartRequested, this);
        navigationBus.off('map-ready', this.handleMapReady, this);
        navigationBus.off('launch-exploration', this.handleLaunchExploration, this);
        navigationBus.off('return-to-map', this.handleReturnToMap, this);
    }

    private emitBeginExplorationWhenReady(planet: Planet) {
        const emit = () => explorationBus.emit('begin-exploration', { planet });
        const explorationScene = this.sceneManager.get('ExplorationScene') as Phaser.Scene | undefined;
        if (!explorationScene) {
            emit();
            return;
        }

        const sys = explorationScene.sys;
        if (sys && sys.isActive()) {
            emit();
            return;
        }

        let emitted = false;
        const onceReady = () => {
            if (emitted) {
                return;
            }
            emitted = true;
            emit();
        };
        explorationScene.events.once(Phaser.Scenes.Events.CREATE, onceReady);
        explorationScene.events.once(Phaser.Scenes.Events.WAKE, onceReady);
    }
}

let coordinatorInstance: SceneCoordinator | null = null;

export function createSceneCoordinator(scenePlugin: Phaser.Scenes.ScenePlugin): SceneCoordinator {
    if (!coordinatorInstance) {
        coordinatorInstance = new SceneCoordinator(scenePlugin);
    }
    return coordinatorInstance;
}

export function getSceneCoordinator(): SceneCoordinator {
    if (!coordinatorInstance) {
        throw new Error('SceneCoordinator not initialized. Call createSceneCoordinator first.');
    }
    return coordinatorInstance;
}
