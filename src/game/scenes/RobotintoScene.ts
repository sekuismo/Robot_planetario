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
    private planetGridObjects: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Text> = [];
    private statusOverlay?: Phaser.GameObjects.Rectangle;
    private statusText?: Phaser.GameObjects.Text;
    private travelLoadingScreen?: Phaser.GameObjects.Image;
    private travelLoadingText?: Phaser.GameObjects.Text;
    private explorationStartButton?: Phaser.GameObjects.Container;
    private awaitingExplorationStart = false;
    private nextExplorationPlanet: Planet | null = null;
    private nextPlanetRequiresFlight = false;
    private returnButton?: Phaser.GameObjects.Container;
    private rpgBox?: Phaser.GameObjects.Container;
    private rpgBoxText?: Phaser.GameObjects.Text;
    private rpgBoxPrompt?: Phaser.GameObjects.Text;
    private messageQueue: string[] = [];
    private messageCompleteCallback?: () => void;
    private advanceKey?: Phaser.Input.Keyboard.Key;
    private isTraveling = false;
    private exploringTween?: Phaser.Tweens.Tween;
    private travelTween?: Phaser.Tweens.Tween;
    private robotBaseY = 0;
    private pendingBgLoads: Partial<Record<PlanetId, Array<() => void>>> = {};
    private travelBg?: Phaser.GameObjects.Image;
    private mothership?: Phaser.GameObjects.Image;
    private mothershipThrust?: Phaser.GameObjects.Image;
    private travelStars?: Phaser.GameObjects.Particles.ParticleEmitter;
    private starEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
    private explorationPulse?: Phaser.GameObjects.Arc;
    private explorationPulseTween?: Phaser.Tweens.Tween;
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

        this.load.image('travel-bg', 'assets/viaje/fondo_nave_nodriza.png');
        this.load.image('mothership', 'assets/viaje/nave_nodriza.png');
        this.load.image('mothership-thrust', 'assets/viaje/nave_nodriza_propulsion.png');
        this.load.image('travel-star', 'assets/star.png');

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
        this.load.image('loading-screen', 'assets/Back_loading.png');
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');

        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'main-bg');
        bg.setDisplaySize(this.scale.width, this.scale.height);
        this.planetBg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'main-bg');
        this.planetBg.setDisplaySize(this.scale.width, this.scale.height);
        this.planetBg.setVisible(false);
        this.createTravelLayer();
        this.createTravelLoadingOverlay();

        this.robotBaseY = this.scale.height * 0.7;
        this.robot = this.add.sprite(this.scale.width / 2, this.robotBaseY, 'robot-normal');
        this.robot.setScale(0.5);
        this.robot.setVisible(false);
        this.robot.setDepth(9);
        if (!this.anims.exists('robot-exploring')) {
            this.anims.create({
                key: 'robot-exploring',
                frames: ['robot-explore-1', 'robot-explore-2', 'robot-explore-3', 'robot-explore-4', 'robot-explore-5'].map((key) => ({ key })),
                frameRate: 8,
                repeat: -1
            });
        }

        this.createStatusOverlay();
        this.createPlanetGrid();
        this.createExplorationCue();
        this.createExplorationStartButton();
        this.createReturnButton();
        this.createRpgMessageBox();
        this.registerAdvanceKey();

        EventBus.emit('current-scene-ready', this);
        EventBus.emit('robotinto-ready');

        const startHandler = (planetId: PlanetId) => this.startMission(planetId);
        EventBus.on('start-mission', startHandler);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            EventBus.removeListener('start-mission', startHandler);
            this.stopTravelAnimation();
            this.advanceKey?.destroy();
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

    private createExplorationStartButton() {
        const { width, height } = this.scale;
        const buttonWidth = 430;
        const buttonHeight = 110;

        const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x0b210b, 0.9);
        bg.setStrokeStyle(3, 0xb6ff9b, 0.9);

        const label = this.add.text(0, 0, 'Comenzar exploración', {
            fontFamily: 'monospace',
            fontSize: '32px',
            color: '#b6ff9b'
        }).setOrigin(0.5);

        this.explorationStartButton = this.add.container(width / 2, height * 0.7, [bg, label]);
        this.explorationStartButton.setSize(buttonWidth, buttonHeight);
        this.explorationStartButton.setDepth(42);
        this.explorationStartButton.setVisible(false).setAlpha(0);
        this.explorationStartButton.setInteractive({ useHandCursor: true });
        this.explorationStartButton.on('pointerover', () => this.explorationStartButton?.setScale(1.03));
        this.explorationStartButton.on('pointerout', () => this.explorationStartButton?.setScale(1));
        this.explorationStartButton.on('pointerdown', () => this.handleExplorationStart());
    }

    private showExplorationStartPrompt() {
        if (!this.explorationStartButton) {
            return;
        }
        this.hideTravelLoading();
        // Mantiene la imagen de viaje/carga y superpone el CTA
        this.explorationStartButton.setVisible(true).setAlpha(0).setScale(1);
        this.explorationStartButton.disableInteractive();
        this.tweens.add({
            targets: this.explorationStartButton,
            alpha: 1,
            duration: 200,
            ease: 'Sine.easeInOut',
            onComplete: () => this.explorationStartButton?.setInteractive({ useHandCursor: true })
        });
    }

    private hideExplorationStartPrompt() {
        if (!this.explorationStartButton) {
            return;
        }
        this.explorationStartButton.disableInteractive();
        this.explorationStartButton.setVisible(false);
        this.explorationStartButton.setAlpha(0);
    }

    private handleExplorationStart() {
        if (!this.awaitingExplorationStart || !this.nextExplorationPlanet) {
            return;
        }
        this.awaitingExplorationStart = false;
        const planet = this.nextExplorationPlanet;
        const shouldFly = this.nextPlanetRequiresFlight;
        this.nextExplorationPlanet = null;
        this.nextPlanetRequiresFlight = false;

        if (this.explorationStartButton) {
            this.explorationStartButton.disableInteractive();
            this.tweens.add({
                targets: this.explorationStartButton,
                alpha: 0,
                duration: 160,
                ease: 'Sine.easeInOut',
                onComplete: () => this.explorationStartButton?.setVisible(false)
            });
        }

        this.hideTravelLoading(() => {
            this.hideTravelScene(() => {
                if (this.planetBg) {
                    this.planetBg.setTexture(`bg-${planet.id}`);
                    this.planetBg.setDisplaySize(this.scale.width, this.scale.height);
                    this.planetBg.setVisible(true);
                }
                this.playLandingAnimation(shouldFly, () => {
                    this.playExplorationIntro(planet);
                    const narrative = this.runMissionForPlanet(planet);
                    this.showRpgMessages(narrative, () => {
                        this.showReturnButton();
                    });
                });
            });
        });
    }

    private createReturnButton() {
        const { width, height } = this.scale;
        const buttonWidth = 260;
        const buttonHeight = 72;

        const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x0b210b, 0.85);
        bg.setStrokeStyle(2, 0x123712);

        const label = this.add.text(0, 0, 'Volver al mapa', {
            fontFamily: 'monospace',
            fontSize: '26px',
            color: '#b6ff9b'
        }).setOrigin(0.5);

        this.returnButton = this.add.container(width / 2, height * 0.86, [bg, label]);
        this.returnButton.setSize(buttonWidth, buttonHeight);
        this.returnButton.setDepth(42);
        this.returnButton.setVisible(false).setAlpha(0);
        this.returnButton.setInteractive({ useHandCursor: true });
        this.returnButton.on('pointerover', () => this.returnButton?.setScale(1.03));
        this.returnButton.on('pointerout', () => this.returnButton?.setScale(1));
        this.returnButton.on('pointerdown', () => this.returnToPlanetSelection());
    }

    private showReturnButton() {
        if (!this.returnButton) {
            return;
        }
        this.returnButton.setVisible(true).setAlpha(0).disableInteractive();
        this.tweens.add({
            targets: this.returnButton,
            alpha: 1,
            duration: 200,
            ease: 'Sine.easeInOut',
            onComplete: () => this.returnButton?.setInteractive({ useHandCursor: true })
        });
    }

    private hideReturnButton() {
        if (!this.returnButton) {
            return;
        }
        this.returnButton.disableInteractive();
        this.returnButton.setVisible(false);
        this.returnButton.setAlpha(0);
    }

    private returnToPlanetSelection() {
        this.hideReturnButton();
        this.clearRpgMessages();
        this.setGridVisible(true);
        this.isTraveling = false;
        this.awaitingExplorationStart = false;
        this.currentPlanet = null;
    }

    public startMission(planetId: PlanetId): void {
        if (this.isTraveling || this.awaitingExplorationStart) {
            return;
        }
        const planet = PLANETS.find((p) => p.id === planetId);
        if (!planet) {
            console.warn(`Planet with id ${planetId} not found.`);
            return;
        }

        this.isTraveling = true;
        this.awaitingExplorationStart = false;
        this.hideReturnButton();
        this.clearRpgMessages();
        this.currentGeneration += 1;
        EventBus.emit('generation-changed', this.currentGeneration);
        this.currentPlanet = planet;
        EventBus.emit('planet-changed', planet.id);

        const beginTravel = () => {
            const shouldFly = !planet.hasSurface; // Volando solo en planetas sin superficie/atmósfera
            this.nextExplorationPlanet = planet;
            this.nextPlanetRequiresFlight = shouldFly;
            if (this.robot) {
                this.robot.setVisible(false);
            }
            this.showTravelLoading(`Viajando a ${planet.name}...`);
            this.showTravelTransition(() => {
                this.awaitingExplorationStart = true;
                this.showExplorationStartPrompt();
            }, true);
        };

        this.setGridVisible(false);
        this.ensurePlanetBackground(planet.id, beginTravel);
    }

    private runMissionForPlanet(planet: Planet): string[] {
        const sensors = {
            temperatureC: planet.temperatureC,
            radiation: planet.radiation,
            gravityG: planet.gravityG,
            humidity: planet.humidity
        };
        const narrative: string[] = [];

        const knowledge = this.knowledge[planet.id];

        this.log(`[Generacion ${this.currentGeneration}] Explorando ${planet.name}`);
        this.log(
            `Sensores => Temp: ${sensors.temperatureC}C, Rad: ${sensors.radiation}, Grav: ${sensors.gravityG}g, Hum: ${sensors.humidity}`
        );
        narrative.push(`Gen ${this.currentGeneration} | ${planet.name}`);
        narrative.push(
            `Lecturas -> Temp: ${sensors.temperatureC}C | Rad: ${sensors.radiation} | Grav: ${sensors.gravityG}g | Hum: ${sensors.humidity}%`
        );

        if (!planet.hasSurface) {
            knowledge.failures += 1;
            knowledge.gravityThreshold = Math.max(knowledge.gravityThreshold, sensors.gravityG + 1);
            knowledge.radiationThreshold = Math.max(knowledge.radiationThreshold, sensors.radiation + 20);
            this.log('Este planeta no tiene superficie solida. Protocolo extremo activado. Mision fallida.');
            this.log('Ajustando umbrales para entornos gaseosos.');
            narrative.push('No hay superficie solida. El dron aborta la maniobra y registra la falla.');
            narrative.push('Ajustando umbrales para futuras incursiones gaseosas.');
            this.setRobotState('broken');
            return narrative;
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
        logsForProtection.forEach((msg) => {
            this.log(msg);
            narrative.push(msg);
        });

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
                narrative.push('La temperatura excede el limite y las ruedas se dañan.');
            } else if (failureReason === 'radiacion') {
                knowledge.radiationThreshold = sensors.radiation - 5;
                this.setRobotState('radiation');
                narrative.push('La radiacion atraviesa los sistemas. Circuitos dañados.');
            } else if (failureReason === 'gravedad') {
                knowledge.gravityThreshold = sensors.gravityG - 0.1;
                this.setRobotState('broken');
                narrative.push('La gravedad colapsa la estructura. Perdida de estabilidad.');
            } else if (failureReason === 'humedad') {
                knowledge.humidityThreshold = sensors.humidity - 5;
                this.setRobotState('shield');
                narrative.push('La humedad ahoga los sensores. Sistemas en modo de emergencia.');
            }
            this.log(`Mision fallida por ${failureReason}. Ajustando umbral de ${failureReason} para la proxima generacion.`);
            narrative.push(`Mision fallida por ${failureReason}. Umbral actualizado para la siguiente generacion.`);
        } else {
            knowledge.successes += 1;
            this.log('Mision exitosa. Conocimiento reforzado.');
            narrative.push('Exploracion completada sin daños. Conocimiento reforzado.');
            this.setRobotState('normal');
        }

        return narrative;
    }

    private createRpgMessageBox() {
        const { width, height } = this.scale;
        const boxWidth = Math.min(900, width - 120);
        const boxHeight = 170;
        const boxY = height * 0.16;

        const bg = this.add.rectangle(0, 0, boxWidth, boxHeight, 0x0b210b, 0.92);
        bg.setStrokeStyle(3, 0xb6ff9b, 0.9);

        const text = this.add.text(-boxWidth / 2 + 22, -boxHeight / 2 + 16, '', {
            fontFamily: 'monospace',
            fontSize: '26px',
            color: '#b6ff9b',
            wordWrap: { width: boxWidth - 44 }
        });

        const prompt = this.add.text(boxWidth / 2 - 18, boxHeight / 2 - 22, 'R - avanzar', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#9ef78a'
        }).setOrigin(1, 0.5);

        this.rpgBox = this.add.container(width / 2, boxY, [bg, text, prompt]);
        this.rpgBox.setDepth(41);
        this.rpgBox.setVisible(false);
        this.rpgBox.setAlpha(0);
        this.rpgBoxText = text;
        this.rpgBoxPrompt = prompt;
    }

    private registerAdvanceKey() {
        this.advanceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.advanceKey?.on('down', () => this.advanceRpgMessage());
    }

    private showRpgMessages(messages: string[], onComplete?: () => void) {
        if (!this.rpgBox || !this.rpgBoxText) {
            onComplete?.();
            return;
        }

        this.messageQueue = messages.filter((msg) => msg.trim().length > 0);
        this.messageCompleteCallback = onComplete;

        if (this.messageQueue.length === 0) {
            onComplete?.();
            return;
        }

        this.rpgBox.setVisible(true);
        this.rpgBox.setAlpha(0);
        this.rpgBoxText.setText(this.messageQueue[0]);

        this.tweens.add({
            targets: this.rpgBox,
            alpha: 1,
            duration: 180,
            ease: 'Sine.easeInOut'
        });
    }

    private advanceRpgMessage() {
        if (this.messageQueue.length === 0) {
            return;
        }
        this.messageQueue.shift();

        if (this.messageQueue.length === 0) {
            this.tweens.add({
                targets: this.rpgBox,
                alpha: 0,
                duration: 150,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    this.rpgBox?.setVisible(false);
                    this.rpgBoxText?.setText('');
                    const done = this.messageCompleteCallback;
                    this.messageCompleteCallback = undefined;
                    done?.();
                }
            });
            return;
        }

        this.rpgBoxText?.setText(this.messageQueue[0]);
    }

    private clearRpgMessages() {
        this.messageQueue = [];
        this.messageCompleteCallback = undefined;
        this.rpgBox?.setVisible(false);
        this.rpgBox?.setAlpha(0);
        this.rpgBoxText?.setText('');
    }

    private showTravelTransition(onComplete: () => void, holdAtEnd = false) {
        this.startTravelAnimation(3200, onComplete, holdAtEnd);
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

        if (visible) {
            this.resetToPlanetSelection();
        }
    }

    private resetToPlanetSelection() {
        this.stopExploringEffect();
        this.hideExplorationStartPrompt();
        this.hideReturnButton();
        this.clearRpgMessages();
        this.awaitingExplorationStart = false;
        this.nextExplorationPlanet = null;
        this.nextPlanetRequiresFlight = false;
        if (this.robot) {
            this.robot.stop();
            this.robot.setVisible(false);
        }
        this.planetBg?.setVisible(false);
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

    private createExplorationCue() {
        this.explorationPulse = this.add.circle(0, 0, 90, 0x9ef78a, 0.18);
        this.explorationPulse.setStrokeStyle(3, 0xb6ff9b, 0.9);
        this.explorationPulse.setVisible(false).setDepth(8);
    }

    private playLandingAnimation(shouldFly: boolean, onComplete?: () => void) {
        if (!this.robot) {
            onComplete?.();
            return;
        }
        this.stopExploringEffect();
        this.robot.stop();
        this.robot.setTexture('robot-moving');
        this.robot.setVisible(true);
        this.robot.setAngle(-6);

        const startY = -this.scale.height * 0.25;
        this.robot.setY(startY);

        this.tweens.add({
            targets: this.robot,
            y: this.robotBaseY,
            angle: { from: -6, to: 0 },
            duration: 950,
            ease: 'Bounce.Out',
            onComplete: () => {
                this.setRobotState(shouldFly ? 'exploring' : 'normal');
                onComplete?.();
            }
        });
    }

    private playExplorationIntro(planet: Planet) {
        this.log(`Exploracion iniciada en ${planet.name}`);
        if (!this.robot) {
            return;
        }

        if (this.explorationPulse) {
            this.explorationPulseTween?.stop();
            this.explorationPulse.setPosition(this.robot.x, this.robot.y);
            this.explorationPulse.setScale(0.55);
            this.explorationPulse.setAlpha(0.95);
            this.explorationPulse.setVisible(true);

            this.explorationPulseTween = this.tweens.add({
                targets: this.explorationPulse,
                scale: { from: 0.55, to: 1.4 },
                alpha: { from: 0.95, to: 0 },
                duration: 620,
                ease: 'Cubic.Out',
                onComplete: () => this.explorationPulse?.setVisible(false)
            });
        }

        const baseScale = this.robot.scaleX;
        this.tweens.add({
            targets: this.robot,
            scaleX: { from: baseScale, to: baseScale + 0.04 },
            scaleY: { from: baseScale, to: baseScale + 0.04 },
            duration: 240,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });
    }

    private createTravelLayer() {
        const { width, height } = this.scale;
        this.travelBg = this.add.image(width / 2, height / 2, 'travel-bg');
        this.travelBg.setDisplaySize(width, height);
        this.travelBg.setDepth(15);
        this.travelBg.setVisible(false);
        this.travelBg.setAlpha(0);

        this.mothership = this.add.image(0, 0, 'mothership');
        this.mothership.setDepth(17);
        this.mothership.setVisible(false);
        this.mothership.setAlpha(0);
        this.mothership.setScale(0.25);

        this.mothershipThrust = this.add.image(0, 0, 'mothership-thrust');
        this.mothershipThrust.setDepth(16.5);
        this.mothershipThrust.setVisible(false);
        this.mothershipThrust.setAlpha(0);
        this.mothershipThrust.setScale(0.25);

        const starConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
            x: { min: 0, max: width },
            y: { min: 0, max: height },
            speedX: { min: -420, max: -180 },
            speedY: { min: -60, max: 60 },
            lifespan: 1200,
            quantity: 2,
            frequency: 35,
            scale: { start: 0.45, end: 0 },
            alpha: { start: 0.9, end: 0 },
            blendMode: 'ADD'
        };

        this.travelStars = this.add.particles(0, 0, 'travel-star', starConfig);
        this.travelStars.setDepth(16);
        this.travelStars.setVisible(false);
        this.travelStars.setAlpha(0);
        this.starEmitter = this.travelStars;
        this.starEmitter?.stop();
    }

    private createTravelLoadingOverlay() {
        const { width, height } = this.scale;
        this.travelLoadingScreen = this.add.image(width / 2, height / 2, 'loading-screen');
        this.travelLoadingScreen.setDisplaySize(width, height);
        this.travelLoadingScreen.setDepth(40);
        this.travelLoadingScreen.setVisible(false);
        this.travelLoadingScreen.setAlpha(0);

        this.travelLoadingText = this.add.text(width / 2, height * 0.82, 'Viajando...', {
            fontFamily: 'monospace',
            fontSize: '38px',
            color: '#b6ff9b',
            backgroundColor: 'rgba(0, 0, 0, 0.35)'
        }).setOrigin(0.5).setDepth(41).setVisible(false).setAlpha(0);
    }

    private showTravelLoading(message: string) {
        if (!this.travelLoadingScreen || !this.travelLoadingText) {
            return;
        }

        this.travelLoadingText.setText(message);
        this.travelLoadingScreen.setVisible(true);
        this.travelLoadingText.setVisible(true);

        this.tweens.add({
            targets: [this.travelLoadingScreen, this.travelLoadingText],
            alpha: 1,
            duration: 200,
            ease: 'Sine.easeInOut'
        });
    }

    private hideTravelLoading(onComplete?: () => void) {
        if (!this.travelLoadingScreen || !this.travelLoadingText) {
            onComplete?.();
            return;
        }

        this.tweens.add({
            targets: [this.travelLoadingScreen, this.travelLoadingText],
            alpha: 0,
            duration: 180,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.travelLoadingScreen?.setVisible(false);
                this.travelLoadingText?.setVisible(false);
                onComplete?.();
            }
        });
    }

    private hideTravelScene(onComplete?: () => void) {
        const targets = [this.travelBg, this.travelStars, this.mothership, this.mothershipThrust].filter(Boolean) as Phaser.GameObjects.GameObject[];
        this.tweens.killTweensOf(targets);
        const fadeTargets = targets.length ? targets : undefined;

        if (fadeTargets) {
            this.tweens.add({
                targets: fadeTargets,
                alpha: { from: 1, to: 0 },
                duration: 180,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    this.travelTween?.stop();
                    this.travelTween?.remove();
                    this.travelTween = undefined;
                    this.starEmitter?.stop();
                    fadeTargets.forEach((obj) => {
                        if ('setVisible' in obj) {
                            (obj as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(false);
                        }
                    });
                    onComplete?.();
                }
            });
        } else {
            this.travelTween?.stop();
            this.travelTween?.remove();
            this.travelTween = undefined;
            this.starEmitter?.stop();
            onComplete?.();
        }
    }

    private startTravelAnimation(durationMs: number, onComplete: () => void, holdAtEnd = false) {
        const bg = this.travelBg;
        const ship = this.mothership;
        const thrust = this.mothershipThrust;
        const stars = this.travelStars;
        if (!bg || !ship || !thrust) {
            onComplete();
            return;
        }

        this.stopTravelAnimation();
        const { width, height } = this.scale;

        bg.setDisplaySize(width, height);
        bg.setAlpha(0).setVisible(true).setAngle(0);
        stars?.setAlpha(0).setVisible(true);
        this.starEmitter?.start();
        ship.setAlpha(0).setVisible(true);
        ship.setAngle(-5);
        const shipY = height * 0.55;
        ship.setPosition(-width * 0.35, shipY);
        ship.setScale(0.25);
        thrust.setAlpha(0).setVisible(false);
        thrust.setScale(0.25);

        const syncThrust = () => {
            thrust.setPosition(ship.x, ship.y);
            thrust.setAngle(ship.angle);
        };
        syncThrust();

        const fadeTargets = stars ? [bg, stars, ship] : [bg, ship];
        this.tweens.add({
            targets: fadeTargets,
            alpha: { from: 0, to: 1 },
            duration: 200,
            ease: 'Sine.easeInOut'
        });

        const beginBoost = () => {
            ship.setVisible(false); // Evita ver dos naves: solo la versión con propulsión
            thrust.setVisible(true);
            this.tweens.add({
                targets: thrust,
                alpha: { from: 0, to: 1 },
                duration: 180,
                ease: 'Sine.easeInOut'
            });

            this.travelTween = this.tweens.add({
                targets: ship,
                x: width * 1.2,
                y: shipY,
                angle: -5,
                duration: durationMs * 0.55,
                ease: 'Cubic.In',
                onUpdate: syncThrust,
                onComplete: () => {
                    if (holdAtEnd) {
                        ship.setVisible(false);
                        thrust.setVisible(true).setAlpha(1);
                        thrust.setPosition(-width * 0.35, shipY);
                        this.starEmitter?.start();
                        this.travelTween = this.tweens.add({
                            targets: thrust,
                            x: width * 1.2,
                            y: shipY,
                            angle: -5,
                            duration: durationMs * 0.55,
                            ease: 'Linear',
                            repeat: -1,
                            onRepeat: () => thrust.setPosition(-width * 0.35, shipY)
                        });
                        onComplete();
                        return;
                    }

                    const fadeOutTargets = stars ? [bg, stars, thrust, ship] : [bg, thrust, ship];
                    this.tweens.add({
                        targets: fadeOutTargets,
                        alpha: { from: 1, to: 0 },
                        duration: 200,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            this.travelTween = undefined;
                            this.starEmitter?.stop();
                            fadeOutTargets.forEach((obj) => obj.setVisible(false));
                            this.statusText?.setVisible(false);
                            onComplete();
                        }
                    });
                }
            });
        };

        this.travelTween = this.tweens.add({
            targets: ship,
            x: width * 0.2,
            y: shipY,
            angle: -5,
            duration: durationMs * 0.45,
            ease: 'Linear',
            onUpdate: syncThrust,
            onComplete: beginBoost
        });
    }

    private stopTravelAnimation() {
        if (this.travelTween) {
            this.travelTween.stop();
            this.travelTween.remove();
            this.travelTween = undefined;
        }
        this.tweens.killTweensOf([this.mothership, this.mothershipThrust]);
        this.travelBg?.setVisible(false).setAlpha(0);
        this.starEmitter?.stop();
        this.travelStars?.setVisible(false).setAlpha(0);
        this.mothership?.setVisible(false).setAlpha(0);
        this.mothershipThrust?.setVisible(false).setAlpha(0);
        this.statusText?.setVisible(false);
        this.travelLoadingScreen?.setVisible(false).setAlpha(0);
        this.travelLoadingText?.setVisible(false).setAlpha(0);
    }

    private ensurePlanetBackground(planetId: PlanetId, onComplete: () => void) {
        const key = `bg-${planetId}`;
        if (this.textures.exists(key)) {
            onComplete();
            return;
        }

        if (this.pendingBgLoads[planetId]) {
            this.pendingBgLoads[planetId]?.push(onComplete);
            return;
        }

        this.pendingBgLoads[planetId] = [onComplete];

        const statusTargets = [this.statusOverlay, this.statusText].filter(Boolean);
        if (statusTargets.length) {
            this.tweens.killTweensOf(statusTargets);
        }
        this.statusOverlay?.setVisible(true).setAlpha(0.75);
        this.statusText?.setText('Cargando planeta...').setVisible(true).setAlpha(1);

        const path = this.getPlanetBgPath(planetId);
        this.load.image(key, path);

        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
            this.statusOverlay?.setVisible(false);
            this.statusText?.setVisible(false);

            const callbacks = this.pendingBgLoads[planetId] ?? [];
            delete this.pendingBgLoads[planetId];

            if (!this.textures.exists(key)) {
                console.warn(`No se pudo cargar fondo para ${planetId}`);
                this.isTraveling = false;
                this.setGridVisible(true);
                return;
            }

            callbacks.forEach((cb) => cb());
        });

        this.load.start();
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
