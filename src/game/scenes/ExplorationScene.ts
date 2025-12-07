import Phaser, { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { KnowledgeState, Planet, createInitialKnowledgeState } from '../domain';
import { PLANET_CONFIG, PlanetConfig } from '../planetConfig';
import { MissionCallbacks, runMissionForPlanet as runBaseMissionForPlanet } from '../exploration/missionEngine';
import { AnimationProfile, getAnimationProfile } from '../exploration/animationProfiles';

export class ExplorationScene extends Scene {
    private currentPlanet: Planet | null = null;
    private currentGeneration = 0;
    private knowledge: KnowledgeState = createInitialKnowledgeState();
    private robot?: Phaser.GameObjects.Sprite;
    private rpgBox?: Phaser.GameObjects.Container;
    private rpgBoxText?: Phaser.GameObjects.Text;
    private rpgBoxPrompt?: Phaser.GameObjects.Text;
    private returnButton?: Phaser.GameObjects.Container;
    private statusOverlay?: Phaser.GameObjects.Rectangle;
    private statusText?: Phaser.GameObjects.Text;
    private explorationPulse?: Phaser.GameObjects.Arc;
    private explorationPulseTween?: Phaser.Tweens.Tween;
    private messageQueue: string[] = [];
    private messageCompleteCallback?: () => void;
    private rpgMessageTimer?: Phaser.Time.TimerEvent;
    private exploringTween?: Phaser.Tweens.Tween;
    private robotBaseY = 0;
    private isExploring = false;
    private explorationActive = false;
    private explorationProgress = 0;
    private explorationStepGoal = 900;
    private explorationMilestones: Array<{ threshold: number; message: string }> = [];
    private missionTriggered = false;
    private statusQueue: Array<{ message: string; visibleMs: number; onComplete?: () => void }> = [];
    private statusShowing = false;
    private moveSpeed = 260;
    private moveBaseSpeed = 260;
    private currentAnimation: AnimationProfile = { landingDurationMs: 950, hoverOffset: 12, moveSpeed: 240 };
    private movementKeys?: {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
    };

    constructor() {
        super('ExplorationScene');
    }

    private triggerMission() {
        if (this.missionTriggered) {
            return;
        }
        this.missionTriggered = true;
        this.showStatusMessage('Analizando muestras...', 400);
        this.time.delayedCall(420, () => {
            if (!this.explorationActive) {
                return;
            }
            this.explorationActive = false;
            this.setRobotState('normal');
            this.completeExploration();
        });
    }

    preload() {
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
        this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
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
        this.createExplorationCue();
        this.createReturnButton();
        this.createRpgMessageBox();
        this.registerMovementKeys();

        EventBus.on('begin-exploration', this.handleBeginExploration, this);
        EventBus.on('exploration-reset', this.resetExploration, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            EventBus.removeListener('begin-exploration', this.handleBeginExploration, this);
            EventBus.removeListener('exploration-reset', this.resetExploration, this);
            this.stopExploringEffect();
            this.rpgMessageTimer?.remove();
        });
    }

    update(_: number, delta: number) {
        if (this.messageQueue.length > 0 && !this.rpgMessageTimer) {
            this.scheduleRpgAutoAdvance();
        }
        if (!this.explorationActive || !this.robot) {
            return;
        }
        const moved = this.handleMovement(delta);
        if (moved > 0) {
            this.explorationProgress += moved;
            this.checkExplorationMilestones();
            if (!this.missionTriggered && this.explorationProgress >= this.explorationStepGoal) {
                this.triggerMission();
            }
        }
    }

    private handleBeginExploration(payload: { planet: Planet }) {
        const planet = payload?.planet;
        if (!planet) {
            return;
        }
        this.currentPlanet = planet;
        this.currentAnimation = getAnimationProfile(planet);
        this.isExploring = true;
        this.explorationActive = false;
        this.missionTriggered = false;
        this.explorationMilestones = [];
        this.explorationProgress = 0;
        this.statusQueue = [];
        this.statusShowing = false;
        this.currentGeneration += 1;
        EventBus.emit('generation-changed', this.currentGeneration);
        EventBus.emit('planet-changed', planet.id);

        this.hideReturnButton();
        this.clearRpgMessages();
        if (this.robot) {
            this.robot.stop();
            this.robot.setVisible(false);
        }

        const shouldFly = !planet.hasSurface;
        this.playLandingAnimation(shouldFly, () => {
            this.playExplorationIntro(planet);
            this.runExplorationSequence(planet);
        });
    }

    private resetExploration() {
        this.isExploring = false;
        this.currentPlanet = null;
        this.explorationActive = false;
        this.missionTriggered = false;
        this.explorationMilestones = [];
        this.explorationProgress = 0;
        this.moveSpeed = this.moveBaseSpeed;
        this.clearRpgMessages();
        this.hideReturnButton();
        this.stopExploringEffect();
        if (this.robot) {
            this.robot.setVisible(false);
            this.robot.stop();
        }
    }

    private runExplorationSequence(planet: Planet) {
        const config = PLANET_CONFIG[planet.id];

        const introMsgs = config?.introMessages ?? [];
        if (introMsgs.length) {
            this.enqueueRpgMessages(introMsgs, undefined, false);
        }
        const runMission = () => {
            const narrative = this.runMissionForPlanet(planet, config);
            this.enqueueRpgMessages(narrative, () => {
                this.showReturnButton();
            });
        };

        if (!planet.hasSurface) {
            runMission();
            return;
        }

        this.startFreeExploration(planet, config, runMission);
    }

    private startFreeExploration(planet: Planet, config: PlanetConfig | undefined, onComplete: () => void) {
        if (!this.robot || !planet.hasSurface) {
            onComplete();
            return;
        }
        this.missionTriggered = false;
        this.explorationActive = true;
        this.explorationProgress = 0;

        const defaultPhase = () => {
            const explorationMsgs = config?.explorationMessages ?? [
                'Escaneando terreno cercano...',
                'Registrando muestras...',
                'Analizando estructuras...'
            ];
            const alertMsgs = this.buildExplorationAlerts(planet, config?.dangerOverrides);
            const merged = [...explorationMsgs, ...alertMsgs];
            return { messages: merged, stepGoal: config?.stepGoal ?? 950 };
        };

        const phase = config?.buildExplorationPhase ? config.buildExplorationPhase(planet) : defaultPhase();
        this.explorationStepGoal = phase.stepGoal ?? config?.stepGoal ?? 950;

        this.explorationMilestones = (phase.messages ?? []).map((msg, idx) => ({
            threshold: this.explorationStepGoal * ((idx + 1) / ((phase.messages?.length ?? 0) + 1)),
            message: msg
        }));

        this.moveBaseSpeed = this.currentAnimation.moveSpeed;
        this.moveSpeed = this.moveBaseSpeed;

        this.setRobotState('moving');
        this.showStatusMessage('Explora con W A S D', 420);

        this.completeExploration = () => {
            this.explorationActive = false;
            this.setRobotState('normal');
            onComplete();
        };
    }

    private completeExploration: () => void = () => {};

    private log(message: string): void {
        console.log(message);
        EventBus.emit('log-line', message);
    }

    private createStatusOverlay() {
        const { width } = this.scale;
        const toastWidth = Math.min(620, width - 80);
        const toastHeight = 64;
        this.statusOverlay = this.add.rectangle(width / 2, 70, toastWidth, toastHeight, 0x0b210b, 0.75);
        this.statusOverlay.setStrokeStyle(2, 0xb6ff9b, 0.85);
        this.statusOverlay.setDepth(45);
        this.statusOverlay.setVisible(false);

        this.statusText = this.add.text(width / 2, 70, '', {
            fontFamily: 'monospace',
            fontSize: '26px',
            color: '#b6ff9b'
        }).setOrigin(0.5).setDepth(46).setVisible(false);
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

        const prompt = this.add.text(boxWidth / 2 - 18, boxHeight / 2 - 22, '', {
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
        this.rpgBoxPrompt.setText('');
        this.rpgBoxPrompt.setVisible(false);
    }

    private registerMovementKeys() {
        this.movementKeys = {
            up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };
    }

    private enqueueRpgMessages(messages: string[], onComplete?: () => void, replace = false) {
        if (!this.rpgBox || !this.rpgBoxText) {
            onComplete?.();
            return;
        }

        const clean = messages.filter((msg) => msg.trim().length > 0);
        if (replace) {
            this.messageQueue = [];
            this.rpgMessageTimer?.remove();
            this.rpgMessageTimer = undefined;
        }

        if (clean.length === 0 && !this.messageQueue.length) {
            onComplete?.();
            return;
        }

        const hadMessages = this.messageQueue.length > 0;
        this.messageQueue.push(...clean);

        if (onComplete) {
            const prev = this.messageCompleteCallback;
            this.messageCompleteCallback = prev
                ? () => {
                      prev();
                      onComplete();
                  }
                : onComplete;
        }

        if (!this.rpgBox.visible) {
            this.rpgBox.setVisible(true);
            this.rpgBox.setAlpha(0);
            this.rpgBoxText.setText(this.messageQueue[0] ?? '');

            this.tweens.add({
                targets: this.rpgBox,
                alpha: 1,
                duration: 180,
                ease: 'Sine.easeInOut'
            });
        } else if (!hadMessages && this.messageQueue.length) {
            this.rpgBoxText.setText(this.messageQueue[0]);
        }

        if (!this.rpgMessageTimer) {
            this.scheduleRpgAutoAdvance();
        }
    }

    private advanceRpgMessage() {
        this.rpgMessageTimer?.remove();
        this.rpgMessageTimer = undefined;
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
                    this.rpgMessageTimer = undefined;
                    done?.();
                }
            });
            return;
        }

        this.rpgBoxText?.setText(this.messageQueue[0]);
        this.scheduleRpgAutoAdvance();
    }

    private scheduleRpgAutoAdvance() {
        if (!this.rpgBoxText || this.messageQueue.length === 0 || this.rpgMessageTimer) {
            return;
        }
        const text = this.messageQueue[0];
        const delay = Phaser.Math.Clamp(1100 + text.length * 25, 1400, 5200);
        this.rpgMessageTimer = this.time.delayedCall(delay, () => this.advanceRpgMessage());
    }

    private clearRpgMessages() {
        this.messageQueue = [];
        this.messageCompleteCallback = undefined;
        this.rpgMessageTimer?.remove();
        this.rpgMessageTimer = undefined;
        this.rpgBox?.setVisible(false);
        this.rpgBox?.setAlpha(0);
        this.rpgBoxText?.setText('');
    }

    private checkExplorationMilestones() {
        if (!this.explorationMilestones.length) {
            return;
        }
        const next = this.explorationMilestones[0];
        if (this.explorationProgress >= next.threshold) {
            this.explorationMilestones.shift();
            this.enqueueRpgMessages([next.message]);
        }
    }

    private buildExplorationAlerts(
        planet: Planet,
        dangerOverrides?: Partial<{ temperatureC: number; radiation: number; gravityG: number; humidity: number }>
    ): string[] {
        const danger = {
            temperatureC: 80,
            radiation: 50,
            gravityG: 1.5,
            humidity: 85,
            ...(dangerOverrides ?? {})
        };
        const alerts: string[] = [];
        if (planet.temperatureC >= danger.temperatureC) {
            alerts.push('Alerta: temperatura alta, riesgo de sobrecalentamiento.');
        }
        if (planet.radiation >= danger.radiation) {
            alerts.push('Alerta: radiación elevada, activando escudos.');
        }
        if (planet.gravityG >= danger.gravityG) {
            alerts.push('Alerta: gravedad intensa, estabilizando.');
        }
        if (planet.humidity >= danger.humidity) {
            alerts.push('Alerta: humedad crítica, sellando compartimentos.');
        }
        return alerts;
    }

    private handleMovement(delta: number): number {
        if (!this.robot || !this.movementKeys) {
            return 0;
        }

        const speed = this.moveSpeed;
        let dx = 0;
        let dy = 0;
        if (this.movementKeys.up.isDown) {
            dy -= 1;
        }
        if (this.movementKeys.down.isDown) {
            dy += 1;
        }
        if (this.movementKeys.left.isDown) {
            dx -= 1;
        }
        if (this.movementKeys.right.isDown) {
            dx += 1;
        }

        if (dx === 0 && dy === 0) {
            this.robot.setAngle(0);
            return 0;
        }

        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;

        const distance = speed * (delta / 1000);
        const marginX = 60;
        const nextX = Phaser.Math.Clamp(this.robot.x + dx * distance, marginX, this.scale.width - marginX);
        const minY = this.robotBaseY - 120;
        const maxY = this.robotBaseY + 80;
        const nextY = Phaser.Math.Clamp(this.robot.y + dy * distance, minY, maxY);

        const moved = Math.hypot(nextX - this.robot.x, nextY - this.robot.y);
        this.robot.setPosition(nextX, nextY);
        this.robot.setAngle(dx > 0 ? 3 : dx < 0 ? -3 : 0);

        return moved;
    }

    private showStatusMessage(message: string, visibleMs = 300, onComplete?: () => void) {
        this.statusQueue.push({ message, visibleMs, onComplete });
        if (!this.statusShowing) {
            this.playNextStatusMessage();
        }
    }

    private playNextStatusMessage() {
        if (!this.statusOverlay || !this.statusText) {
            this.statusQueue = [];
            this.statusShowing = false;
            return;
        }
        const next = this.statusQueue.shift();
        if (!next) {
            this.statusShowing = false;
            return;
        }
        this.statusShowing = true;
        const { message, visibleMs, onComplete } = next;

        this.tweens.killTweensOf([this.statusOverlay, this.statusText]);
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
                            this.playNextStatusMessage();
                        }
                    });
                });
            }
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
        this.returnButton.on('pointerdown', () => this.returnToMap());
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

    private returnToMap() {
        this.hideReturnButton();
        this.clearRpgMessages();
        this.isExploring = false;
        this.currentPlanet = null;
        this.stopExploringEffect();
        if (this.robot) {
            this.robot.stop();
            this.robot.setVisible(false);
        }
        EventBus.emit('return-to-map');
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
            y: this.robotBaseY - this.currentAnimation.hoverOffset,
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
            duration: this.currentAnimation.landingDurationMs,
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

    private runMissionForPlanet(
        planet: Planet,
        config?: PlanetConfig
    ): string[] {
        const callbacks: MissionCallbacks = {
            log: (msg) => this.log(msg),
            setRobotState: (state) => this.setRobotState(state)
        };
        const missionFn = config?.customMission ?? runBaseMissionForPlanet;
        return missionFn({
            planet,
            knowledge: this.knowledge,
            generation: this.currentGeneration,
            dangerOverrides: config?.dangerOverrides,
            callbacks
        });
    }
}
