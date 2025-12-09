import Phaser, { Scene } from 'phaser';
import { navigationBus } from '../EventBus';
import { Planet, PlanetId } from '../domain';
import { PLANET_REGISTRY, REGISTERED_PLANETS } from '../planetRegistry';

export class TravelScene extends Scene {
    private planetGridObjects: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Text> = [];
    private explorationStartButton?: Phaser.GameObjects.Container;
    private travelLoadingScreen?: Phaser.GameObjects.Image;
    private travelLoadingText?: Phaser.GameObjects.Text;
    private travelBg?: Phaser.GameObjects.Image;
    private mothership?: Phaser.GameObjects.Image;
    private mothershipThrust?: Phaser.GameObjects.Image;
    private travelStars?: Phaser.GameObjects.Particles.ParticleEmitter;
    private starEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
    private travelTween?: Phaser.Tweens.Tween;
    private awaitingExplorationStart = false;
    private isTraveling = false;
    private nextPlanet: Planet | null = null;

    constructor() {
        super('TravelScene');
    }

    private loadIfMissing(key: string, path: string) {
        if (!this.textures.exists(key)) {
            this.load.image(key, path);
        }
    }

    preload() {
        this.loadIfMissing('main-bg', 'assets/main screen/no planets.png');
        this.loadIfMissing('travel-bg', 'assets/viaje/fondo_nave_nodriza.png');
        this.loadIfMissing('mothership', 'assets/viaje/nave_nodriza.png');
        this.loadIfMissing('mothership-thrust', 'assets/viaje/nave_nodriza_propulsion.png');
        this.loadIfMissing('travel-star', 'assets/star.png');
        this.loadIfMissing('loading-screen', 'assets/Back_loading.png');

        REGISTERED_PLANETS.forEach(({ textureKeys, assets }) => this.loadIfMissing(textureKeys.icon, assets.icon));
    }

    create() {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor('#000000');

        const bg = this.add.image(width / 2, height / 2, 'main-bg');
        bg.setDisplaySize(width, height);

        this.createTravelLayer();
        this.createTravelLoadingOverlay();
        this.createExplorationStartButton();
        this.createPlanetGrid();

        navigationBus.emit('map-ready', { sceneKey: this.scene.key });
        navigationBus.on('return-to-map', this.handleReturnToMap, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            navigationBus.off('return-to-map', this.handleReturnToMap, this);
            this.stopTravelAnimation();
        });
    }

    private createPlanetGrid() {
        const columns = 4;
        const rows = 2;
        const marginX = 80;
        const marginY = 140;
        const cellWidth = (this.scale.width - marginX * 2) / columns;
        const cellHeight = (this.scale.height - marginY * 2) / rows;

        REGISTERED_PLANETS.forEach((planetDef, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const x = marginX + cellWidth * (col + 0.5);
            const y = marginY + cellHeight * (row + 0.5);
            const textureKey = planetDef.textureKeys.icon;

            const texture = this.textures.get(textureKey);
            const frame = texture.getSourceImage();
            if (!frame) {
                console.warn(`Texture for ${textureKey} missing, skipping`);
                return;
            }
            const fitScale = Math.min(cellWidth / frame.width, cellHeight / frame.height);
            const baseScale = fitScale * 1.2;
            const hoverScale = baseScale * 1.05;

            const icon = this.add.image(x, y, textureKey);
            icon.setScale(baseScale);
            icon.setInteractive({ useHandCursor: true });
            icon.on('pointerover', () => icon.setScale(hoverScale));
            icon.on('pointerout', () => icon.setScale(baseScale));
            icon.on('pointerdown', () => this.startMission(planetDef.planet.id));

            const label = this.add.text(x, y + 100, planetDef.planet.name, {
                fontFamily: 'monospace',
                fontSize: '20px',
                color: '#b6ff9b'
            }).setOrigin(0.5, 0);

            this.planetGridObjects.push(icon, label);
        });
    }

    private startMission(planetId: PlanetId): void {
        if (this.isTraveling || this.awaitingExplorationStart) {
            return;
        }
        const planet = PLANET_REGISTRY[planetId]?.planet;
        if (!planet) {
            console.warn(`Planet with id ${planetId} not found.`);
            return;
        }

        this.isTraveling = true;
        this.awaitingExplorationStart = false;
        this.nextPlanet = planet;
        this.hideExplorationStartPrompt();

        this.setGridVisible(false);
        if (this.travelLoadingText) {
            this.showTravelLoading(`Viajando a ${planet.name}...`);
        }

        this.showTravelTransition(() => {
            this.awaitingExplorationStart = true;
            this.showExplorationStartPrompt();
        }, true);
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
        if (!this.awaitingExplorationStart || !this.nextPlanet) {
            return;
        }

        const planet = this.nextPlanet;
        this.awaitingExplorationStart = false;
        this.nextPlanet = null;
        this.hideExplorationStartPrompt();

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
                this.cameras.main.setAlpha(0);
                this.cameras.main.setBackgroundColor('#000000');
                navigationBus.emit('launch-exploration', { planetId: planet.id });
                this.isTraveling = false;
            });
        });
    }

    private handleReturnToMap() {
        this.stopTravelAnimation();
        this.hideTravelLoading();
        this.hideExplorationStartPrompt();
        this.awaitingExplorationStart = false;
        this.isTraveling = false;
        this.nextPlanet = null;
        this.cameras.main.setAlpha(1);
        this.cameras.main.setBackgroundColor('#000000');

        this.setGridVisible(true);
        this.scene.bringToTop();
    }

    private setGridVisible(visible: boolean) {
        this.planetGridObjects.forEach((obj) => {
            obj.setVisible(visible);
            if ('disableInteractive' in obj && 'setInteractive' in obj) {
                visible ? (obj as Phaser.GameObjects.Image).setInteractive({ useHandCursor: true }) : (obj as Phaser.GameObjects.Image).disableInteractive();
            }
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

    private showTravelTransition(onComplete: () => void, holdAtEnd = false) {
        this.startTravelAnimation(3200, onComplete, holdAtEnd);
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
        ship.setTexture('mothership');
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
            // Cambiamos la textura de la misma nave para no duplicar sprites ni crear parpadeo
            ship.setTexture('mothership-thrust').setVisible(true).setAlpha(1);
            thrust.setVisible(false);

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

                    const fadeOutTargets = stars ? [bg, stars, ship] : [bg, ship];
                    this.tweens.add({
                        targets: fadeOutTargets,
                        alpha: { from: 1, to: 0 },
                        duration: 200,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            this.travelTween = undefined;
                            this.starEmitter?.stop();
                            fadeOutTargets.forEach((obj) => obj.setVisible(false));
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
        this.mothership?.setVisible(false).setAlpha(0).setTexture('mothership');
        this.mothershipThrust?.setVisible(false).setAlpha(0);
        this.travelLoadingScreen?.setVisible(false).setAlpha(0);
        this.travelLoadingText?.setVisible(false).setAlpha(0);
        // Reinicia visibilidad por si se vuelve a disparar la animación
        this.mothership?.setAlpha(0).setVisible(true).setTexture('mothership');
        this.mothershipThrust?.setAlpha(0).setVisible(false);
    }
}
