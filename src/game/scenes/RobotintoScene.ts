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
    private planetBg?: Phaser.GameObjects.Image;
    private robot?: Phaser.GameObjects.Sprite;
    private planetGridObjects: Phaser.GameObjects.GameObject[] = [];
    private hudLines: string[] = [];
    private hudTexts: Phaser.GameObjects.Text[] = [];
    private planetLabel?: Phaser.GameObjects.Text;
    private generationLabel?: Phaser.GameObjects.Text;
    private statusOverlay?: Phaser.GameObjects.Rectangle;
    private statusText?: Phaser.GameObjects.Text;
    private isTraveling = false;
    private exploringTween?: Phaser.Tweens.Tween;
    private robotBaseY = 0;
    private log(message: string): void {
        console.log(message);
        EventBus.emit('log-line', message);
        this.pushHudLine(message);
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

        this.load.image('bg-MERCURY', 'assets/planets_zenital/mercurio.png');
        this.load.image('bg-VENUS', 'assets/planets_zenital/venus.png');
        this.load.image('bg-EARTH', 'assets/planets_zenital/tierra.png');
        this.load.image('bg-MARS', 'assets/planets_zenital/Marte.png');
        this.load.image('bg-JUPITER', 'assets/planets_zenital/jupiter.png');
        this.load.image('bg-SATURN', 'assets/planets_zenital/saturno.png');
        this.load.image('bg-URANUS', 'assets/planets_zenital/urano.png');
        this.load.image('bg-NEPTUNE', 'assets/planets_zenital/neptuno.png');

        this.load.image('robot-normal', 'assets/robotinto/robotinto_normal.png');
        this.load.image('robot-moving', 'assets/robotinto/robotinto_movimiento.png');
        this.load.image('robot-burn', 'assets/robotinto/robotinto_quemado.png');
        this.load.image('robot-radiation', 'assets/robotinto/robotinto_irradiado.png');
        this.load.image('robot-broken', 'assets/robotinto/robotinto_semidestruido.png');
        this.load.image('robot-shield', 'assets/robotinto/robotinto_escudo_protector.png');
        this.load.image('robot-explore-1', 'assets/robotinto/robotinto_volador/volador_anim1.png');
        this.load.image('robot-explore-2', 'assets/robotinto/robotinto_volador/volador_anim2.png');
        this.load.image('robot-explore-3', 'assets/robotinto/robotinto_volador/volador_anim3.png');
        this.load.image('robot-explore-4', 'assets/robotinto/robotinto_volador/volador_anim4.png');
        this.load.image('robot-explore-5', 'assets/robotinto/robotinto_volador/volador_anim5.png');
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');

        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'main-bg');
        bg.setDisplaySize(this.scale.width, this.scale.height);
        this.planetBg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'bg-EARTH');
        this.planetBg.setDisplaySize(this.scale.width, this.scale.height);
        this.planetBg.setVisible(false);

        this.robotBaseY = this.scale.height * 0.7;
        this.robot = this.add.sprite(this.scale.width / 2, this.robotBaseY, 'robot-normal');
        this.robot.setScale(0.5);
        this.robot.setVisible(false);
        if (!this.anims.exists('robot-exploring')) {
            this.anims.create({
                key: 'robot-exploring',
                frames: ['robot-explore-1', 'robot-explore-2', 'robot-explore-3', 'robot-explore-4', 'robot-explore-5'].map((key) => ({ key })),
                frameRate: 8,
                repeat: -1
            });
        }

        this.createStatusOverlay();
        this.createHUD();
        this.createPlanetGrid();

        EventBus.emit('current-scene-ready', this);

        const startHandler = (planetId: PlanetId) => this.startMission(planetId);
        EventBus.on('start-mission', startHandler);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            EventBus.removeListener('start-mission', startHandler);
        });
    }

    private createStatusOverlay() {
        const { width, height } = this.scale;
        this.statusOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
        this.statusOverlay.setDepth(20);
        this.statusOverlay.setVisible(false);

        this.statusText = this.add.text(width / 2, height / 2, '', {
            fontFamily: 'monospace',
            fontSize: '44px',
            color: '#b6ff9b'
        }).setOrigin(0.5).setDepth(21).setVisible(false);
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

            const label = this.add.text(x, y + 100, planet.name, {
                fontFamily: 'monospace',
                fontSize: '20px',
                color: '#b6ff9b'
            }).setOrigin(0.5, 0);

            this.planetGridObjects.push(icon, label);
        });
    }

    public startMission(planetId: PlanetId): void {
        if (this.isTraveling) {
            return;
        }
        const planet = PLANETS.find((p) => p.id === planetId);
        if (!planet) {
            console.warn(`Planet with id ${planetId} not found.`);
            return;
        }

        this.currentGeneration += 1;
        EventBus.emit('generation-changed', this.currentGeneration);
        this.currentPlanet = planet;
        EventBus.emit('planet-changed', planet.id);

        if (this.planetBg) {
            this.planetBg.setTexture(`bg-${planet.id}`);
            this.planetBg.setVisible(true);
        }

        if (this.generationLabel) {
            this.generationLabel.setText(`Generacion: ${this.currentGeneration}`);
        }
        if (this.planetLabel) {
            this.planetLabel.setText(`Planeta: ${planet.name}`);
        }

        this.setGridVisible(false);
        this.setRobotState('moving');
        this.isTraveling = true;
        this.showTravelTransition(() => {
            this.setRobotState('exploring');
            const exploringDuration = 2000;
            this.showStatusMessage('Explorando', exploringDuration);
            this.time.delayedCall(exploringDuration, () => {
                this.runMissionForPlanet(planet);
                this.setGridVisible(true);
                this.isTraveling = false;
            });
        });
    }

    private runMissionForPlanet(planet: Planet): void {
        const sensors = {
            temperatureC: planet.temperatureC,
            radiation: planet.radiation,
            gravityG: planet.gravityG,
            humidity: planet.humidity
        };

        this.showStatusMessage('Explorando', 420);

        const knowledge = this.knowledge[planet.id];

        this.log(`[Generacion ${this.currentGeneration}] Explorando ${planet.name}`);
        this.log(
            `Sensores => Temp: ${sensors.temperatureC}C, Rad: ${sensors.radiation}, Grav: ${sensors.gravityG}g, Hum: ${sensors.humidity}`
        );

        if (!planet.hasSurface) {
            knowledge.failures += 1;
            knowledge.gravityThreshold = Math.max(knowledge.gravityThreshold, sensors.gravityG + 1);
            knowledge.radiationThreshold = Math.max(knowledge.radiationThreshold, sensors.radiation + 20);
            this.log('Este planeta no tiene superficie solida. Protocolo extremo activado. Mision fallida.');
            this.log('Ajustando umbrales para entornos gaseosos.');
            this.setRobotState('broken');
            return;
        }

        const protectTemp = sensors.temperatureC > knowledge.temperatureThreshold;
        const protectRad = sensors.radiation > knowledge.radiationThreshold;
        const protectGrav = sensors.gravityG > knowledge.gravityThreshold;
        const protectHum = sensors.humidity > knowledge.humidityThreshold;

        const danger = {
            temperatureC: 80,
            radiation: 50,
            gravityG: 1.5,
            humidity: 85
        };

        const logsForProtection = [
            protectTemp
                ? `Temperatura detectada ${sensors.temperatureC}C > umbral ${knowledge.temperatureThreshold}C. Activando proteccion termica.`
                : 'Temperatura dentro de rango seguro. No se activa proteccion termica.',
            protectRad
                ? `Radiacion detectada ${sensors.radiation} > umbral ${knowledge.radiationThreshold}. Activando escudo.`
                : 'Radiacion dentro de rango seguro. No se activa escudo.',
            protectGrav
                ? `Gravedad detectada ${sensors.gravityG}g > umbral ${knowledge.gravityThreshold}g. Ajustando estabilizadores.`
                : 'Gravedad dentro de rango seguro. Sin ajuste de estabilizadores.',
            protectHum
                ? `Humedad detectada ${sensors.humidity} > umbral ${knowledge.humidityThreshold}. Sellando compartimentos.`
                : 'Humedad dentro de rango seguro. Sistemas estandar activos.'
        ];
        logsForProtection.forEach((msg) => this.log(msg));

        let failureReason: string | null = null;

        if (!protectTemp && sensors.temperatureC > danger.temperatureC) {
            failureReason = 'temperatura';
        } else if (!protectRad && sensors.radiation > danger.radiation) {
            failureReason = 'radiacion';
        } else if (!protectGrav && sensors.gravityG > danger.gravityG) {
            failureReason = 'gravedad';
        } else if (!protectHum && sensors.humidity > danger.humidity) {
            failureReason = 'humedad';
        }

        if (failureReason) {
            knowledge.failures += 1;
            if (failureReason === 'temperatura') {
                knowledge.temperatureThreshold = sensors.temperatureC - 10;
                this.setRobotState('burn');
            } else if (failureReason === 'radiacion') {
                knowledge.radiationThreshold = sensors.radiation - 5;
                this.setRobotState('radiation');
            } else if (failureReason === 'gravedad') {
                knowledge.gravityThreshold = sensors.gravityG - 0.1;
                this.setRobotState('broken');
            } else if (failureReason === 'humedad') {
                knowledge.humidityThreshold = sensors.humidity - 5;
                this.setRobotState('shield');
            }
            this.log(`Mision fallida por ${failureReason}. Ajustando umbral de ${failureReason} para la proxima generacion.`);
        } else {
            knowledge.successes += 1;
            this.log('Mision exitosa. Conocimiento reforzado.');
            this.setRobotState('normal');
        }
    }

    private showTravelTransition(onComplete: () => void) {
        this.showStatusMessage('Viajando', 300, onComplete);
    }

    private showStatusMessage(message: string, visibleMs = 300, onComplete?: () => void) {
        if (!this.statusOverlay || !this.statusText) {
            onComplete?.();
            return;
        }

        this.statusText.setText(message);
        this.statusOverlay.setAlpha(0).setVisible(true);
        this.statusText.setAlpha(0).setVisible(true);

        this.tweens.add({
            targets: [this.statusOverlay, this.statusText],
            alpha: 1,
            duration: 220,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.time.delayedCall(visibleMs, () => {
                    this.tweens.add({
                        targets: [this.statusOverlay, this.statusText],
                        alpha: 0,
                        duration: 220,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            this.statusOverlay?.setVisible(false);
                            this.statusText?.setVisible(false);
                            onComplete?.();
                        }
                    });
                });
            }
        });
    }

    private setGridVisible(visible: boolean) {
        this.planetGridObjects.forEach((obj) => {
            obj.setVisible(visible);
            if ('disableInteractive' in obj && 'setInteractive' in obj) {
                visible ? (obj as Phaser.GameObjects.Image).setInteractive({ useHandCursor: true }) : (obj as Phaser.GameObjects.Image).disableInteractive();
            }
        });
    }

    private setRobotState(state: 'moving' | 'burn' | 'radiation' | 'broken' | 'shield' | 'normal' | 'exploring') {
        if (!this.robot) {
            return;
        }
        const textureMap: Record<'moving' | 'burn' | 'radiation' | 'broken' | 'shield' | 'normal' | 'exploring', string> = {
            moving: 'robot-moving',
            burn: 'robot-burn',
            radiation: 'robot-radiation',
            broken: 'robot-broken',
            shield: 'robot-shield',
            normal: 'robot-normal',
            exploring: 'robot-explore-1'
        };
        if (state === 'exploring') {
            this.robot.play('robot-exploring', true);
            this.startExploringEffect();
        } else {
            this.robot.stop();
            this.robot.setTexture(textureMap[state]);
            this.stopExploringEffect();
        }
        this.robot.setVisible(true);
    }

    private startExploringEffect() {
        if (!this.robot || this.exploringTween) {
            return;
        }
        this.robot.setAngle(0);
        this.robot.setY(this.robotBaseY);
        this.exploringTween = this.tweens.add({
            targets: this.robot,
            y: this.robotBaseY - 12,
            angle: 3,
            duration: 650,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    private stopExploringEffect() {
        if (this.exploringTween) {
            this.exploringTween.stop();
            this.exploringTween.remove();
            this.exploringTween = undefined;
        }
        if (this.robot) {
            this.robot.setAngle(0);
            this.robot.setY(this.robotBaseY);
        }
    }

    private createHUD() {
        const panelWidth = 420;
        const panelHeight = 200;
        const margin = 20;
        const originX = margin + panelWidth / 2;
        const originY = margin + panelHeight / 2 + 40;

        const panel = this.add.rectangle(originX, originY, panelWidth, panelHeight, 0x0b210b, 0.8);
        panel.setStrokeStyle(2, 0x123712);
        panel.setDepth(5);

        this.generationLabel = this.add.text(margin + 12, margin + 20, 'Generacion: 0', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#b6ff9b'
        }).setDepth(6);

        this.planetLabel = this.add.text(margin + 12, margin + 44, 'Planeta: -', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#b6ff9b'
        }).setDepth(6);

        const baseY = margin + 76;
        for (let i = 0; i < 4; i++) {
            const line = this.add.text(margin + 12, baseY + i * 24, '', {
                fontFamily: 'monospace',
                fontSize: '16px',
                color: '#9ef78a',
                wordWrap: { width: panelWidth - 32 }
            }).setDepth(6);
            this.hudTexts.push(line);
        }
    }

    private pushHudLine(message: string) {
        this.hudLines.push(message);
        this.hudLines = this.hudLines.slice(-4);

        for (let i = 0; i < this.hudTexts.length; i++) {
            const idx = this.hudLines.length - this.hudTexts.length + i;
            this.hudTexts[i].setText(idx >= 0 ? this.hudLines[idx] : '');
        }
    }
}
