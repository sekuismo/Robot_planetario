import Phaser, { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import {
    PLANETS,
    Planet,
    PlanetId,
    KnowledgeState,
    createInitialKnowledgeState
} from '../domain';

export class RobotintoScene extends Scene {
    private currentPlanet: Planet | null = null;
    private currentGeneration = 0;
    private knowledge: KnowledgeState = createInitialKnowledgeState();
    private log(message: string): void {
        console.log(message);
        EventBus.emit('log-line', message);
    }

    constructor() {
        super('RobotintoScene');
    }

    preload() {
        this.load.image('main-bg', 'assets/main%20screen/no%20planets.png');

        this.load.image('planet-MERCURY', 'assets/main%20screen/planets/mercurio.png');
        this.load.image('planet-VENUS', 'assets/main%20screen/planets/venus.png');
        this.load.image('planet-EARTH', 'assets/main%20screen/planets/tierra.png');
        this.load.image('planet-MARS', 'assets/main%20screen/planets/marte.png');
        this.load.image('planet-JUPITER', 'assets/main%20screen/planets/jupiter.png');
        this.load.image('planet-SATURN', 'assets/main%20screen/planets/saturno.png');
        this.load.image('planet-URANUS', 'assets/main%20screen/planets/urano.png');
        this.load.image('planet-NEPTUNE', 'assets/main%20screen/planets/neptuno.png');
    }

    create() {
        this.cameras.main.setBackgroundColor('#0f2d0f');

        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'main-bg');
        bg.setDisplaySize(this.scale.width, this.scale.height);

        this.add
            .text(this.scale.width / 2, 60, 'Robotinto explorador', {
                fontFamily: 'monospace',
                fontSize: '42px',
                color: '#b6ff9b',
            })
            .setOrigin(0.5);

        this.createPlanetGrid();

        EventBus.emit('current-scene-ready', this);

        const startHandler = (planetId: PlanetId) => this.startMission(planetId);
        EventBus.on('start-mission', startHandler);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            EventBus.removeListener('start-mission', startHandler);
        });
    }

    private createPlanetGrid() {
        const columns = 4;
        const rows = 2;
        const marginX = 80;
        const marginY = 140;
        const cellWidth = (this.scale.width - marginX * 2) / columns;
        const cellHeight = (this.scale.height - marginY * 2) / rows;

        PLANETS.forEach((planet, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const x = marginX + cellWidth * (col + 0.5);
            const y = marginY + cellHeight * (row + 0.5);
            const textureKey = `planet-${planet.id}`;

            const frame = this.textures.get(textureKey).getSourceImage();
            const fitScale = Math.min(cellWidth / frame.width, cellHeight / frame.height);
            const baseScale = fitScale * 1.2;
            const hoverScale = baseScale * 1.05;

            const icon = this.add.image(x, y, textureKey);
            icon.setScale(baseScale);
            icon.setInteractive({ useHandCursor: true });
            icon.on('pointerover', () => icon.setScale(hoverScale));
            icon.on('pointerout', () => icon.setScale(baseScale));
            icon.on('pointerdown', () => this.startMission(planet.id));

            this.add
                .text(x, y + 100, planet.name, {
                    fontFamily: 'monospace',
                    fontSize: '20px',
                    color: '#b6ff9b'
                })
                .setOrigin(0.5, 0);
        });
    }

    public startMission(planetId: PlanetId): void {
        const planet = PLANETS.find((p) => p.id === planetId);
        if (!planet) {
            console.warn(`Planet with id ${planetId} not found.`);
            return;
        }

        this.currentGeneration += 1;
        EventBus.emit('generation-changed', this.currentGeneration);
        this.currentPlanet = planet;
        EventBus.emit('planet-changed', planet.id);
        this.runMissionForPlanet(planet);
    }

    private runMissionForPlanet(planet: Planet): void {
        const sensors = {
            temperatureC: planet.temperatureC,
            radiation: planet.radiation,
            gravityG: planet.gravityG,
            humidity: planet.humidity
        };

        const knowledge = this.knowledge[planet.id];

        this.log(`[Generacion ${this.currentGeneration}] Explorando ${planet.name}`);
        this.log(
            `Sensores => Temp: ${sensors.temperatureC}C, Rad: ${sensors.radiation}, Grav: ${sensors.gravityG}g, Hum: ${sensors.humidity}`
        );

        let failureReason: string | null = null;

        if (sensors.temperatureC > knowledge.temperatureThreshold) {
            failureReason = 'temperatura';
        } else if (sensors.radiation > knowledge.radiationThreshold) {
            failureReason = 'radiacion';
        } else if (sensors.gravityG > knowledge.gravityThreshold) {
            failureReason = 'gravedad';
        } else if (sensors.humidity > knowledge.humidityThreshold) {
            failureReason = 'humedad';
        }

        if (failureReason) {
            knowledge.failures += 1;
            this.log(`Mision fallida por ${failureReason}.`);
        } else {
            knowledge.successes += 1;
            this.log('Mision exitosa.');
        }
    }
}
