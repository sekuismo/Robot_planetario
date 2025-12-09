import Phaser, { Scene } from 'phaser';
import { explorationBus, navigationBus, uiBus } from '../EventBus';
import { KnowledgeState, Planet } from '../domain';
import { PLANET_CONFIG, PlanetConfig } from '../planetConfig';
import { MissionCallbacks, runMissionForPlanet as runBaseMissionForPlanet } from '../exploration/missionEngine';
import { AnimationProfile, getAnimationProfile } from '../exploration/animationProfiles';
import { MovementControls, createMovementControls } from '../input/movementControls';
import { loadRobotMemory } from '../persistence/robotintoMemory';

type ProtectionState = {
    temperature: boolean;
    radiation: boolean;
    gravity: boolean;
    humidity: boolean;
};

type RobotState = 'moving' | 'burn' | 'radiation' | 'broken' | 'shield' | 'normal' | 'exploring';

export class ExplorationScene extends Scene {
    private currentPlanet: Planet | null = null;
    private currentGeneration = 0;
    private knowledge: KnowledgeState;
    private robotState: RobotState = 'normal';
    private lastProtections: ProtectionState | null = null;
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
    private statusTimer?: Phaser.Time.TimerEvent;
    private statusShowing = false;
    private hazardSafeUntil = 0;
    private isAerialExploration = false;
    private moveSpeed = 260;
    private moveBaseSpeed = 260;
    private currentAnimation: AnimationProfile = { landingDurationMs: 950, hoverOffset: 12, moveSpeed: 240 };
    private movementControls?: MovementControls;
    private lifeProtocolActive = false;
    private hud?: {
        container: Phaser.GameObjects.Container;
        healthFill: Phaser.GameObjects.Rectangle;
        healthText: Phaser.GameObjects.Text;
        samplesText: Phaser.GameObjects.Text;
        paramsText: Phaser.GameObjects.Text;
        healthMaxWidth: number;
    };
    private health = 100;
    private sampleGoal = 10;
    private samplesCollected = 0;
    private hazardDamagePerSecond = 0;
    private hazardMovementDamagePerSecond = 0;
    private explorationHasMoved = false;
    private usingSampleCollection = false;
    private collectibleItems: Phaser.GameObjects.Image[] = [];
    private missionEvaluated = false;
    private currentPlanetConfig?: PlanetConfig;
    private missionCompleteBanner?: Phaser.GameObjects.Image;
    private protectionIconTemp?: Phaser.GameObjects.Image;
    private protectionIconRad?: Phaser.GameObjects.Image;
    private flyingInitialized = false;

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
        this.load.image('robot-protect-thermal', 'assets/robotinto/robotinto proteccion termal.png');
        this.load.image('robot-protect-radiation', 'assets/robotinto/Robotinto_proteccion_radiacion.png');
        this.load.image('collectible-1', 'assets/colectionables/colec_1.png');
        this.load.image('collectible-2', 'assets/colectionables/colec_2.png');
        this.load.image('collectible-3', 'assets/colectionables/colec_3.png');
        this.load.image('collectible-4', 'assets/colectionables/colec_4.png');
        this.load.image('mission-complete', 'assets/mision_completada.png');
    }

    create() {
        const memory = loadRobotMemory();
        this.knowledge = memory.knowledgeByPlanet;

        this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
        this.robotBaseY = this.scale.height * 0.55;

        this.robot = this.add.sprite(this.scale.width / 2, this.robotBaseY, 'robot-normal');
        this.robot.setScale(0.5);
        this.robot.setVisible(false);
        this.robot.setDepth(9);
        if (!this.anims.exists('robot-fly-transition')) {
            this.anims.create({
                key: 'robot-fly-transition',
                frames: ['robot-explore-1', 'robot-explore-2', 'robot-explore-3', 'robot-explore-4'].map((key) => ({ key })),
                frameRate: 8,
                repeat: 0
            });
        }
        if (!this.anims.exists('robot-fly-sustain')) {
            this.anims.create({
                key: 'robot-fly-sustain',
                frames: ['robot-explore-4', 'robot-explore-5'].map((key) => ({ key })),
                frameRate: 6,
                repeat: -1
            });
        }

        this.createStatusOverlay();
        this.createExplorationCue();
        this.createReturnButton();
        this.createRpgMessageBox();
        this.createMissionCompleteBanner();
        this.createProtectionIcons();
        this.createHud();
        this.movementControls = createMovementControls(this);

        explorationBus.on('begin-exploration', this.handleBeginExploration, this);
        explorationBus.on('exploration-reset', this.resetExploration, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            explorationBus.off('begin-exploration', this.handleBeginExploration, this);
            explorationBus.off('exploration-reset', this.resetExploration, this);
            this.movementControls?.destroy();
            this.stopExploringEffect();
            this.rpgMessageTimer?.remove();
            this.statusTimer?.remove();
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
            this.registerExplorationMovement(moved);
            this.advanceExplorationProgress(moved);
        }
        if (this.usingSampleCollection) {
            if (moved > 0) {
                this.updateHud();
                this.applyMovementHazard(moved);
            }
            this.handleCollectiblePickup();
            this.tickHazards(delta);
            this.updateProtectionIconsPosition();
            return;
        }
        if (!this.missionTriggered && this.explorationProgress >= this.explorationStepGoal) {
            this.triggerMission();
        }
        this.updateProtectionIconsPosition();
    }

    private handleBeginExploration(payload: { planet: Planet }) {
        const planet = payload?.planet;
        if (!planet) {
            return;
        }
        this.currentPlanet = planet;
        this.currentPlanetConfig = PLANET_CONFIG[planet.id];
        this.currentAnimation = getAnimationProfile(planet);
        const canFlyExplore = this.shouldUseAerialExploration(planet);
        this.isExploring = true;
        this.explorationActive = false;
        this.missionTriggered = false;
        this.missionEvaluated = false;
        this.explorationMilestones = [];
        this.explorationProgress = 0;
        this.statusQueue = [];
        this.statusTimer?.remove();
        this.statusTimer = undefined;
        this.statusShowing = false;
        this.currentGeneration += 1;
        this.lastProtections = null;
        this.isAerialExploration = false;
        this.lifeProtocolActive = !!planet.hasLife;
        this.hazardSafeUntil = 0;
        this.explorationHasMoved = false;
        this.flyingInitialized = false;
        this.usingSampleCollection = false;
        this.samplesCollected = 0;
        const defaultSampleGoal = this.currentPlanetConfig?.collectionConfig?.sampleGoal ?? 10;
        this.sampleGoal = planet.hasSurface || canFlyExplore ? defaultSampleGoal : 0;
        this.health = 100;
        this.hazardDamagePerSecond = 0;
        this.hazardMovementDamagePerSecond = 0;
        this.moveBaseSpeed = this.currentAnimation.moveSpeed;
        this.moveSpeed = this.moveBaseSpeed;
        this.hideHud();
        this.clearCollectibles();
        this.showHud(planet);
        uiBus.emit('generation-changed', this.currentGeneration);
        uiBus.emit('planet-changed', planet.id);
        this.log(`Robotinto generacion ${this.currentGeneration} explorando ${planet.name}`);
        this.showStatusMessage('Midiendo parametros', 620);
        if (this.lifeProtocolActive) {
            this.showStatusMessage('Vida detectada. Protocolo de exploracion pasiva.', 640);
            this.log('Vida detectada: activando protocolo pasivo (menos velocidad, movimientos cautos).');
        }

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

        this.emitDebugState(planet);
    }

    private resetExploration() {
        this.isExploring = false;
        this.currentPlanet = null;
        this.currentPlanetConfig = undefined;
        this.explorationActive = false;
        this.missionTriggered = false;
        this.missionEvaluated = false;
        this.explorationMilestones = [];
        this.explorationProgress = 0;
        this.statusQueue = [];
        this.statusTimer?.remove();
        this.statusTimer = undefined;
        this.statusShowing = false;
        this.hazardSafeUntil = 0;
        this.explorationHasMoved = false;
        this.moveSpeed = this.moveBaseSpeed;
        this.samplesCollected = 0;
        this.sampleGoal = 10;
        this.health = 100;
        this.hazardDamagePerSecond = 0;
        this.hazardMovementDamagePerSecond = 0;
        this.usingSampleCollection = false;
        this.lifeProtocolActive = false;
        this.isAerialExploration = false;
        this.lastProtections = null;
        this.robotState = 'normal';
        this.clearCollectibles();
        this.hideHud();
        this.clearRpgMessages();
        this.hideReturnButton();
        this.stopExploringEffect();
        this.hideProtectionIcons();
        if (this.robot) {
            this.robot.setVisible(false);
            this.robot.stop();
        }
    }

    private runExplorationSequence(planet: Planet) {
        const config = PLANET_CONFIG[planet.id];
        const introMsgs = config?.introMessages ?? [];
        if (introMsgs.length) {
            this.showStatusSequence(introMsgs, 520);
        }
        const runMission = () => {
            this.evaluateMissionOutcome(true);
        };

        const protections = this.computeProtectionState(planet);
        const canFlyExplore = this.shouldUseAerialExploration(planet);

        if (!planet.hasSurface) {
            this.updateProtectionVisuals(planet, protections);
            this.isAerialExploration = canFlyExplore;
            if (!canFlyExplore) {
                runMission();
                return;
            }
            this.beginSampleCollection(planet, config, runMission, true);
            return;
        }

        this.isAerialExploration = false;
        this.startFreeExploration(planet, config, runMission);
    }

    private startFreeExploration(planet: Planet, config: PlanetConfig | undefined, onComplete: () => void) {
        if (!this.robot || !planet.hasSurface) {
            onComplete();
            return;
        }
        const useCollection = planet.hasSurface && (config?.collectionConfig?.enabled ?? true);
        if (useCollection) {
            this.beginSampleCollection(planet, config, onComplete);
            return;
        }

        const protections = this.computeProtectionState(planet);
        this.usingSampleCollection = false;
        // Fallback: mantener flujo anterior en caso de desactivar la recoleccion
        this.missionTriggered = false;
        this.explorationActive = true;
        this.explorationProgress = 0;
        this.explorationHasMoved = false;

        const phase = this.resolveExplorationPhase(planet, config, protections);
        this.configureExplorationMessages(phase.messages, phase.stepGoal);

        const hazard = this.computeHazardRate(planet, config, protections);
        this.applyProtectionEffectsToMovement(planet, protections, hazard.hazardSources);
        this.updateProtectionVisuals(planet, protections);

        this.setRobotState('moving');
        this.showStatusMessage('Explora con W A S D', 420);
        if (this.lifeProtocolActive) {
            this.showStatusMessage('Protocolo pasivo: velocidad reducida por vida detectada.', 520);
        }

        this.completeExploration = () => {
            this.explorationActive = false;
            this.setRobotState('normal');
            onComplete();
        };
    }

    private beginSampleCollection(planet: Planet, config: PlanetConfig | undefined, onComplete: () => void, aerial = false) {
        this.isAerialExploration = aerial;
        this.usingSampleCollection = true;
        this.missionTriggered = false;
        this.explorationActive = true;
        this.explorationProgress = 0;
        this.explorationMilestones = [];
        this.explorationHasMoved = false;
        this.samplesCollected = 0;
        this.sampleGoal = config?.collectionConfig?.sampleGoal ?? 10;
        this.health = 100;
        const protections = this.computeProtectionState(planet);
        const hazard = this.computeHazardRate(planet, config, protections);
        const totalHazardRate = hazard.rate;
        if (totalHazardRate > 0) {
            const movementShare = 0.55; // give slightly more weight to moving so idle robots survive longer
            this.hazardDamagePerSecond = totalHazardRate * (1 - movementShare);
            this.hazardMovementDamagePerSecond = totalHazardRate * movementShare;
        } else {
            this.hazardDamagePerSecond = 0;
            this.hazardMovementDamagePerSecond = 0;
        }
        const extraSafetyMs = hazard.mitigated.length > 0 ? 1200 : 0;
        this.hazardSafeUntil = this.time.now + 2600 + extraSafetyMs;
        if (hazard.mitigated.length) {
            this.log(`Protecciones activadas para ${hazard.mitigated.join(', ')}.`);
        }
        if (hazard.active.length === 0) {
            this.log('Condiciones hostiles mitigadas. La barra de vida deberia permanecer estable.');
        } else {
            this.log(`Riesgos sin cubrir: ${hazard.active.join(', ')}. Daño ambiental aplicado.`);
        }

        if (hazard.mitigated.includes('temperatura')) {
            this.log('Proteccion termica evitó daño critico a las ruedas durante la exploracion.');
            this.showStatusMessage('Proteccion termica activa: ruedas protegidas del calor extremo.', 520);
        }
        if (hazard.mitigated.includes('radiacion')) {
            this.log('Escudo anti-radiacion activo: se bloquea el daño mas peligroso de la radiacion.');
            this.showStatusMessage('Escudo anti-radiacion: radiacion peligrosa mitigada.', 520);
        }
        if (hazard.mitigated.includes('humedad')) {
            this.log('Sellado antihumedad activo: se evitan cortocircuitos por condensacion.');
            this.showStatusMessage('Sellado antihumedad: componentes protegidos de la humedad critica.', 520);
        }

        const phase = this.resolveExplorationPhase(planet, config, protections);
        this.configureExplorationMessages(phase.messages, phase.stepGoal);

        this.applyProtectionEffectsToMovement(planet, protections, hazard.hazardSources);
        this.updateProtectionVisuals(planet, protections);

        this.clearCollectibles();
        this.spawnCollectibles(this.sampleGoal);
        this.showHud(planet);

        const alertMsgs = this.buildExplorationAlerts(planet, config?.dangerOverrides, protections);
        const status = [`Recolecta ${this.sampleGoal} muestras`];
        if (hazard.hazardSources === 0) {
            status.push('Protecciones activadas: sin perdida de vida.');
        } else if (alertMsgs.length) {
            status.push('Atencion a condiciones hostiles');
        }
        if (this.lifeProtocolActive) {
            status.push('Protocolo pasivo: evita contacto con vida.');
        }
        status.forEach((msg) => this.showStatusMessage(msg, 520));

        this.setRobotState(this.isAerialExploration ? 'exploring' : 'moving');
        if (this.isAerialExploration) {
            this.showStatusMessage('Entorno gaseoso: modo vuelo activado. Explora con W A S D', 520);
        }

        this.completeExploration = () => {
            this.explorationActive = false;
            this.usingSampleCollection = false;
            this.setRobotState('normal');
            this.hideHud();
            this.clearCollectibles();
            onComplete();
        };
    }

    private completeExploration: () => void = () => {};

    private shouldUseAerialExploration(planet: Planet): boolean {
        if (planet.hasSurface) {
            return false;
        }
        const knowledge = this.knowledge[planet.id];
        if (!knowledge) {
            return false;
        }
        // Tras la primera generación fallida ya "aprende" que no hay superficie y se adapta al modo vuelo.
        return knowledge.failures > 0 || knowledge.successes > 0;
    }

    private computeProtectionState(planet: Planet): ProtectionState {
        const knowledge = this.knowledge[planet.id];
        if (!knowledge) {
            return {
                temperature: false,
                radiation: false,
                gravity: false,
                humidity: false
            };
        }
        return {
            temperature: planet.temperatureC > knowledge.temperatureThreshold,
            radiation: planet.radiation > knowledge.radiationThreshold,
            gravity: planet.gravityG > knowledge.gravityThreshold,
            humidity: planet.humidity > knowledge.humidityThreshold
        };
    }

    private computeHazardRate(
        planet: Planet,
        config: PlanetConfig | undefined,
        protections: ProtectionState
    ): { rate: number; hazardSources: number; mitigated: string[]; active: string[] } {
        const danger = {
            temperatureC: 80,
            radiation: 50,
            gravityG: 1.5,
            humidity: 85,
            ...(config?.dangerOverrides ?? {})
        };
        const labels: Record<keyof ProtectionState, string> = {
            temperature: 'temperatura',
            radiation: 'radiacion',
            gravity: 'gravedad',
            humidity: 'humedad'
        };
        const hazardChecks: Array<{ key: keyof ProtectionState; exceeds: boolean; protected: boolean }> = [
            { key: 'temperature', exceeds: planet.temperatureC >= danger.temperatureC, protected: protections.temperature },
            { key: 'radiation', exceeds: planet.radiation >= danger.radiation, protected: protections.radiation },
            { key: 'gravity', exceeds: planet.gravityG >= danger.gravityG, protected: protections.gravity },
            { key: 'humidity', exceeds: planet.humidity >= danger.humidity, protected: protections.humidity }
        ];
        const active = hazardChecks.filter((h) => h.exceeds && !h.protected).map((h) => labels[h.key]);
        const mitigated = hazardChecks.filter((h) => h.exceeds && h.protected).map((h) => labels[h.key]);
        const hazardSources = active.length;

        const baseDamage = config?.collectionConfig?.damagePerSecond ?? 6;
        return { rate: hazardSources * baseDamage, hazardSources, mitigated, active };
    }

    private applyProtectionEffectsToMovement(planet: Planet, protections: ProtectionState, hazardSources: number) {
        const gravityHigh = planet.gravityG >= 1.5;
        const gravityLow = planet.gravityG < 0.5;

        let speedFactor = 1;

        if (gravityHigh) {
            speedFactor *= protections.gravity ? 0.9 : 0.6;
        } else if (gravityLow) {
            speedFactor *= protections.gravity ? 1.0 : 0.8;
        }

        if (this.lifeProtocolActive) {
            speedFactor *= 0.7;
        }

        if (hazardSources > 0 && !protections.gravity) {
            speedFactor *= 0.9;
        }

        this.moveBaseSpeed = this.currentAnimation.moveSpeed * speedFactor;
        this.moveSpeed = this.moveBaseSpeed;

        if (gravityHigh || gravityLow) {
            if (protections.gravity) {
                this.showStatusMessage('Adaptacion gravitacional activa: movilidad estabilizada.', 520);
                this.log('Adaptacion gravitacional activa: el movimiento se mantiene estable pese a la gravedad extrema.');
            } else {
                this.showStatusMessage('Gravedad extrema sin adaptacion: movimiento penalizado.', 520);
                this.log('Gravedad extrema sin adaptacion: Robotinto se mueve con dificultad en este entorno.');
            }
        }
    }

    private spawnCollectibles(count: number) {
        const margin = 80;
        const keys = ['collectible-1', 'collectible-2', 'collectible-3', 'collectible-4'];
        const yMin = margin + 140;
        const minDistance = 120;
        const positions: { x: number; y: number }[] = [];

        for (let i = 0; i < count; i++) {
            const key = keys[Phaser.Math.Between(0, keys.length - 1)];
            let placed = false;
            let attempts = 0;
            let x = 0;
            let y = 0;

            while (!placed && attempts < 20) {
                x = Phaser.Math.Between(margin, this.scale.width - margin);
                y = Phaser.Math.Between(yMin, this.scale.height - margin);
                const tooClose = positions.some((p) => Phaser.Math.Distance.Between(p.x, p.y, x, y) < minDistance);
                if (!tooClose) {
                    placed = true;
                    positions.push({ x, y });
                }
                attempts++;
            }

            const item = this.add.image(x, y, key);
            item.setDepth(6);
            item.setScale(0.1);
            this.collectibleItems.push(item);
        }
    }

    private clearCollectibles() {
        this.collectibleItems.forEach((item) => item.destroy());
        this.collectibleItems = [];
    }

    private showPriorityStatusMessage(message: string, visibleMs = 1000, onComplete?: () => void) {
        // Interrumpe cualquier cola pendiente para mostrar de inmediato mensajes clave (como misión completada).
        this.statusTimer?.remove();
        this.statusTimer = undefined;
        this.statusQueue = [];
        this.statusShowing = false;
        this.showStatusMessage(message, visibleMs, onComplete);
    }

    private handleCollectiblePickup() {
        if (!this.robot || !this.usingSampleCollection || !this.explorationActive) {
            return;
        }
        const pickupRadius = 50;
        this.collectibleItems.forEach((item) => {
            if (!item.active || !item.visible) {
                return;
            }
            const dist = Phaser.Math.Distance.Between(this.robot!.x, this.robot!.y, item.x, item.y);
            if (dist <= pickupRadius) {
                item.setVisible(false).setActive(false);
                this.samplesCollected += 1;
                this.updateHud();
                this.showStatusMessage('Muestra recolectada', 260);
                if (this.samplesCollected >= this.sampleGoal) {
                    this.handleSamplesCompleted();
                }
            }
        });
    }

    private handleSamplesCompleted() {
        if (!this.explorationActive) {
            return;
        }
        this.explorationActive = false;
        this.showMissionCompleteBanner();
        this.showPriorityStatusMessage('Muestras completas. Procesando datos...', 900, () => this.completeExploration());
    }

    private applyMovementHazard(moved: number) {
        if (
            !this.usingSampleCollection ||
            this.hazardMovementDamagePerSecond <= 0 ||
            moved <= 0 ||
            !this.explorationHasMoved ||
            this.time.now < this.hazardSafeUntil
        ) {
            return;
        }
        const speed = Math.max(this.moveSpeed, 1);
        const secondsMoving = moved / speed;
        const damage = this.hazardMovementDamagePerSecond * secondsMoving;
        this.health = Math.max(0, this.health - damage);
        this.updateHud();
        if (this.health <= 0) {
            this.handleRobotDestroyed();
        }
    }

    private tickHazards(delta: number) {
        if (
            !this.usingSampleCollection ||
            this.hazardDamagePerSecond <= 0 ||
            !this.explorationActive ||
            !this.explorationHasMoved ||
            this.time.now < this.hazardSafeUntil
        ) {
            return;
        }
        const damage = (this.hazardDamagePerSecond * delta) / 1000;
        this.health = Math.max(0, this.health - damage);
        this.updateHud();
        if (this.health <= 0) {
            this.handleRobotDestroyed();
        }
    }

    private handleRobotDestroyed() {
        if (!this.isExploring) {
            return;
        }
        this.explorationActive = false;
        this.usingSampleCollection = false;
        this.clearCollectibles();
        this.clearRpgMessages();
        this.hideReturnButton();
        this.setRobotState('broken');
        this.evaluateMissionOutcome(false);
        this.enqueueRpgMessages(['Robotinto ha sido destruido. Enviando datos de entrenamiento...']);
        this.showStatusMessage('Robotinto ha sido destruido, enviando datos de entrenamiento', 1300, () => {
            this.hideHud();
            this.returnToMap();
        });
    }

    private log(message: string): void {
        console.log(message);
        uiBus.emit('log-line', message);
    }

    private createHud() {
        const { width } = this.scale;
        const panelWidth = width;
        const panelHeight = 118;
        const margin = 18;

        const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x0b210b, 0.85).setOrigin(0, 0);
        bg.setStrokeStyle(2, 0xb6ff9b, 0.9);

        const paramsText = this.add.text(margin, margin, '', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#b6ff9b'
        });

        const samplesText = this.add.text(margin, margin + 28, '', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#b6ff9b'
        });

        const healthLabel = this.add.text(margin, margin + 56, 'Vida', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#b6ff9b'
        });

        const barWidth = panelWidth - margin * 2;
        const barY = margin + 84;
        const barBg = this.add.rectangle(margin, barY, barWidth, 18, 0x335533, 0.8).setOrigin(0, 0.5);
        const barFill = this.add.rectangle(margin, barY, barWidth, 18, 0x9ef78a, 0.95).setOrigin(0, 0.5);
        const healthText = this.add.text(panelWidth - margin, margin + 56, '', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#b6ff9b'
        }).setOrigin(1, 0);

        const container = this.add.container(0, 0, [bg, paramsText, samplesText, healthLabel, barBg, barFill, healthText]);
        container.setScrollFactor(0);
        container.setDepth(50);
        container.setVisible(false);

        this.hud = {
            container,
            healthFill: barFill,
            healthText,
            samplesText,
            paramsText,
            healthMaxWidth: barWidth
        };
    }

    private showHud(planet: Planet) {
        this.hud?.container.setVisible(false);
        uiBus.emit('hud-visible', true);
        this.updateHud(planet);
    }

    private hideHud() {
        this.hud?.container.setVisible(false);
        uiBus.emit('hud-visible', false);
    }

    private updateHud(planet?: Planet) {
        const current = planet ?? this.currentPlanet ?? undefined;
        uiBus.emit('hud-update', {
            planet: current ?? undefined,
            health: this.health,
            samplesCollected: this.samplesCollected,
            sampleGoal: this.sampleGoal
        });
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

    private advanceExplorationProgress(moved: number) {
        if (!this.explorationActive || moved <= 0) {
            return;
        }
        this.explorationProgress += moved;
        this.checkExplorationMilestones();
    }

    private checkExplorationMilestones() {
        if (!this.explorationMilestones.length) {
            return;
        }
        const next = this.explorationMilestones[0];
        if (this.explorationProgress >= next.threshold) {
            this.explorationMilestones.shift();
            this.showStatusMessage(next.message, 520);
        }
    }

    private resolveExplorationPhase(
        planet: Planet,
        config: PlanetConfig | undefined,
        protections: ProtectionState
    ): { messages: string[]; stepGoal: number } {
        const fallbackStep = config?.stepGoal ?? 950;
        if (config?.buildExplorationPhase) {
            const custom = config.buildExplorationPhase(planet) ?? { messages: [] };
            return {
                messages: custom.messages ?? [],
                stepGoal: custom.stepGoal ?? fallbackStep
            };
        }
        const explorationMsgs = config?.explorationMessages ?? [
            'Escaneando terreno cercano...',
            'Registrando muestras...',
            'Analizando estructuras...'
        ];
        const alertMsgs = this.buildExplorationAlerts(planet, config?.dangerOverrides, protections);
        return { messages: [...explorationMsgs, ...alertMsgs], stepGoal: fallbackStep };
    }

    private configureExplorationMessages(messages: string[] | undefined, stepGoal: number) {
        this.explorationStepGoal = stepGoal;
        if (!messages || messages.length === 0) {
            this.explorationMilestones = [];
            return;
        }
        const segmentCount = messages.length + 1;
        this.explorationMilestones = messages.map((msg, idx) => {
            const normalized = (idx + 0.5) / segmentCount;
            return { threshold: stepGoal * normalized, message: msg };
        });
    }

    private buildExplorationAlerts(
        planet: Planet,
        dangerOverrides?: Partial<{ temperatureC: number; radiation: number; gravityG: number; humidity: number }>,
        protections?: ProtectionState
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
            alerts.push(protections?.temperature ? 'Temperatura alta, proteccion termica activa.' : 'Alerta: temperatura alta, riesgo de sobrecalentamiento.');
        }
        if (planet.radiation >= danger.radiation) {
            alerts.push(protections?.radiation ? 'Radiacion elevada, escudo activo.' : 'Alerta: radiacion elevada, activando escudos.');
        }
        if (planet.gravityG >= danger.gravityG) {
            alerts.push(protections?.gravity ? 'Gravedad intensa, estabilizadores activos.' : 'Alerta: gravedad intensa, estabilizando.');
        }
        if (planet.humidity >= danger.humidity) {
            alerts.push(protections?.humidity ? 'Humedad critica, sellado preventivo activo.' : 'Alerta: humedad critica, sellando compartimentos.');
        }
        return alerts;
    }

    private evaluateMissionOutcome(showNarrative: boolean, suppressRobotState = false) {
        if (this.missionEvaluated || !this.currentPlanet) {
            return;
        }
        const narrative = this.runMissionForPlanet(this.currentPlanet, this.currentPlanetConfig, suppressRobotState);
        this.missionEvaluated = true;
        this.emitDebugState(this.currentPlanet);
        // Muestra siempre el botón para volver al mapa,
        // independientemente de la cola de mensajes de narrativa.
        this.showReturnButton();
        // Ademas, mostramos la narrativa principal como overlay
        // cuando corresponde (por ejemplo, en planetas gaseosos).
        if (showNarrative && narrative.length) {
            this.showStatusSequence(narrative, 520);
        }
    }

    private handleMovement(delta: number): number {
        if (!this.robot || !this.movementControls) {
            return 0;
        }

        const speed = this.moveSpeed;
        let dx = 0;
        let dy = 0;
        if (this.movementControls.keys.up.isDown) {
            dy -= 1;
        }
        if (this.movementControls.keys.down.isDown) {
            dy += 1;
        }
        if (this.movementControls.keys.left.isDown) {
            dx -= 1;
        }
        if (this.movementControls.keys.right.isDown) {
            dx += 1;
        }

        if (dx === 0 && dy === 0) {
            this.robot.setAngle(0);
            if (this.isAerialExploration && this.robotState === 'exploring') {
                this.updateFlyingTexture(false);
            }
            return 0;
        }

        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;

        const distance = speed * (delta / 1000);
        const margin = 32;
        const nextX = Phaser.Math.Clamp(this.robot.x + dx * distance, margin, this.scale.width - margin);
        const nextY = Phaser.Math.Clamp(this.robot.y + dy * distance, margin, this.scale.height - margin);

        const moved = Math.hypot(nextX - this.robot.x, nextY - this.robot.y);
        this.robot.setPosition(nextX, nextY);
        this.robot.setAngle(dx > 0 ? 3 : dx < 0 ? -3 : 0);
        if (this.isAerialExploration && this.robotState === 'exploring') {
            this.updateFlyingTexture(moved > 0);
        }

        return moved;
    }

    private registerExplorationMovement(moved: number) {
        if (moved <= 0) {
            return;
        }
        if (!this.explorationHasMoved) {
            this.explorationHasMoved = true;
            const movementGraceMs = 1600;
            this.hazardSafeUntil = Math.max(this.hazardSafeUntil, this.time.now + movementGraceMs);
        }
    }

    private showStatusMessage(message: string, visibleMs = 300, onComplete?: () => void) {
        this.statusQueue.push({ message, visibleMs, onComplete });
        if (!this.statusShowing) {
            this.playNextStatusMessage();
        }
    }

    private showStatusSequence(messages: string[], visibleMs = 420, onComplete?: () => void) {
        if (!messages.length) {
            onComplete?.();
            return;
        }
        messages.forEach((msg, idx) => {
            const isLast = idx === messages.length - 1;
            this.showStatusMessage(msg, visibleMs, isLast ? onComplete : undefined);
        });
    }

    private playNextStatusMessage() {
        if (this.statusShowing) {
            return;
        }
        const next = this.statusQueue.shift();
        if (!next) {
            this.statusShowing = false;
            return;
        }
        this.statusShowing = true;
        const { visibleMs, onComplete, message } = next;
        const displayMs = this.computeStatusDuration(message, visibleMs);

        uiBus.emit('hud-message', message);

        this.statusTimer?.remove();
        this.statusTimer = this.time.delayedCall(displayMs, () => {
            onComplete?.();
            this.statusShowing = false;
            this.statusTimer = undefined;
            this.playNextStatusMessage();
        });
    }

    private computeStatusDuration(message: string, minVisible: number): number {
        const min = Math.max(minVisible, 1200);
        const target = 1400 + message.length * 24;
        const max = Math.max(min + 1600, 6200);
        return Phaser.Math.Clamp(target, min, max);
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
        if (!this.missionEvaluated && this.currentPlanet) {
            this.evaluateMissionOutcome(false, true);
        }
        this.hideReturnButton();
        this.statusQueue = [];
        this.statusTimer?.remove();
        this.statusTimer = undefined;
        this.statusShowing = false;
        this.clearRpgMessages();
        this.isExploring = false;
        this.currentPlanet = null;
        this.currentPlanetConfig = undefined;
        this.explorationActive = false;
        this.usingSampleCollection = false;
        this.clearCollectibles();
        this.hideHud();
        this.stopExploringEffect();
        this.isAerialExploration = false;
        this.lastProtections = null;
        this.hideProtectionIcons();
        this.hazardSafeUntil = 0;
        if (this.robot) {
            this.robot.stop();
            this.robot.setVisible(false);
        }
        navigationBus.emit('return-to-map', undefined as void);
    }

    private setRobotState(state: RobotState) {
        if (!this.robot) {
            return;
        }
        this.robotState = state;
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
            if (this.isAerialExploration) {
                this.flyingInitialized = true;
                this.robot.stop();
                this.robot.setTexture('robot-explore-1');
                this.robot.play('robot-fly-transition');
                this.robot.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
                    if (!this.robot || anim.key !== 'robot-fly-transition' || !this.isAerialExploration || this.robotState !== 'exploring') {
                        return;
                    }
                    this.robot.stop();
                    this.robot.setTexture('robot-explore-4');
                });
                this.startExploringEffect();
            } else {
                if (!this.flyingInitialized) {
                    this.flyingInitialized = true;
                    this.robot.setTexture('robot-explore-1');
                    this.robot.play('robot-fly-transition');
                    this.robot.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
                        if (!this.robot || anim.key !== 'robot-fly-transition') {
                            return;
                        }
                        this.robot.play('robot-fly-sustain', true);
                    });
                } else {
                    this.robot.play('robot-fly-sustain', true);
                }
                this.startExploringEffect();
            }
        } else {
            this.robot.stop();
            this.robot.setTexture(textureMap[state]);
            const resetPosition = state === 'normal' || state === 'moving';
            this.stopExploringEffect(resetPosition);
            this.applyProtectionTexture();
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

    private stopExploringEffect(resetPosition = true) {
        if (this.exploringTween) {
            this.exploringTween.stop();
            this.exploringTween.remove();
            this.exploringTween = undefined;
        }
        if (this.robot && resetPosition) {
            this.robot.setAngle(0);
            this.robot.setY(this.robotBaseY);
        }
    }

    private createExplorationCue() {
        this.explorationPulse = this.add.circle(0, 0, 90, 0x9ef78a, 0.18);
        this.explorationPulse.setStrokeStyle(3, 0xb6ff9b, 0.9);
        this.explorationPulse.setVisible(false).setDepth(8);
    }

    private createMissionCompleteBanner() {
        const { width, height } = this.scale;
        this.missionCompleteBanner = this.add.image(width / 2, height * 0.24, 'mission-complete');
        this.missionCompleteBanner.setOrigin(0.5);
        this.missionCompleteBanner.setScale(0.38);
        this.missionCompleteBanner.setDepth(70);
        this.missionCompleteBanner.setAlpha(0);
        this.missionCompleteBanner.setVisible(false);
    }

    private showMissionCompleteBanner() {
        if (!this.missionCompleteBanner) {
            return;
        }
        this.missionCompleteBanner.setVisible(true);
        this.missionCompleteBanner.setAlpha(0);
        this.tweens.add({
            targets: this.missionCompleteBanner,
            alpha: { from: 0, to: 1 },
            duration: 260,
            ease: 'Sine.easeOut',
            yoyo: true,
            hold: 920,
            onComplete: () => {
                this.missionCompleteBanner?.setVisible(false);
            }
        });
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
        config?: PlanetConfig,
        suppressRobotState = false
    ): string[] {
        const callbacks: MissionCallbacks = {
            log: (msg) => this.log(msg),
            setRobotState: suppressRobotState ? () => {} : (state) => this.setRobotState(state)
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

    private emitDebugState(planetOverride?: Planet, protectionsOverride?: ProtectionState) {
        const planet = planetOverride ?? this.currentPlanet;
        if (!planet) {
            return;
        }
        const knowledge = this.knowledge[planet.id];
        const protections = protectionsOverride ?? this.computeProtectionState(planet);
        const missions =
            knowledge !== undefined
                ? {
                      failures: knowledge.failures,
                      successes: knowledge.successes
                  }
                : undefined;

        uiBus.emit('debug-state', {
            generation: this.currentGeneration,
            planetId: planet.id,
            planetName: planet.name,
            thresholds: knowledge,
            protections: {
                temperature: protections.temperature,
                radiation: protections.radiation,
                gravity: protections.gravity,
                humidity: protections.humidity,
                lifeProtocol: this.lifeProtocolActive
            },
            missions
        });
    }

    private createProtectionIcons() {
        if (!this.robot) {
            return;
        }
        this.protectionIconTemp = this.add.image(this.robot.x, this.robot.y, 'robot-protect-thermal');
        this.protectionIconTemp.setScale(0.35);
        this.protectionIconTemp.setDepth(10);
        this.protectionIconTemp.setVisible(false);

        this.protectionIconRad = this.add.image(this.robot.x, this.robot.y, 'robot-protect-radiation');
        this.protectionIconRad.setScale(0.35);
        this.protectionIconRad.setDepth(10);
        this.protectionIconRad.setVisible(false);
    }

    private updateProtectionIconsPosition() {
        if (!this.robot) {
            return;
        }
        const baseX = this.robot.x;
        const baseY = this.robot.y;
        if (this.protectionIconTemp) {
            this.protectionIconTemp.setPosition(baseX - 42, baseY - 70);
        }
        if (this.protectionIconRad) {
            this.protectionIconRad.setPosition(baseX + 42, baseY - 70);
        }
    }

    private hideProtectionIcons() {
        this.protectionIconTemp?.setVisible(false);
        this.protectionIconRad?.setVisible(false);
    }

    private updateProtectionVisuals(_planet: Planet, protections: ProtectionState) {
        this.lastProtections = protections;
        this.protectionIconTemp?.setVisible(false);
        this.protectionIconRad?.setVisible(false);
        this.applyProtectionTexture();
    }

    private applyProtectionTexture() {
        if (!this.robot || !this.currentPlanet) {
            return;
        }
        // No alteramos el sprite de vuelo para planetas gaseosos ni estados especiales.
        if (!this.currentPlanet.hasSurface) {
            return;
        }
        if (this.robotState !== 'moving' && this.robotState !== 'normal') {
            return;
        }
        const texture = this.resolveProtectionTexture(this.lastProtections);
        if (texture) {
            this.robot.setTexture(texture);
        } else {
            this.robot.setTexture(this.robotState === 'moving' ? 'robot-moving' : 'robot-normal');
        }
    }

    private resolveProtectionTexture(protections: ProtectionState | null): string | null {
        if (!protections) {
            return null;
        }
        if (protections.radiation) {
            return 'robot-protect-radiation';
        }
        if (protections.temperature) {
            return 'robot-protect-thermal';
        }
        return null;
    }

    private updateFlyingTexture(isMoving: boolean) {
        if (!this.robot || !this.isAerialExploration || !this.flyingInitialized || this.robotState !== 'exploring') {
            return;
        }
        if (this.robot.anims.isPlaying && this.robot.anims.getName() === 'robot-fly-transition') {
            return;
        }
        const target = isMoving ? 'robot-explore-5' : 'robot-explore-4';
        if (this.robot.texture.key !== target) {
            this.robot.setTexture(target);
        }
    }
}
