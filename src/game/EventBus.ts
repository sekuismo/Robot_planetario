import Phaser, { Events } from 'phaser';
import { Planet, PlanetId, PlanetKnowledge } from './domain';
import { MissionReport } from './exploration/missionModel';

type Listener<Payload> = (payload: Payload) => void;

class TypedEventBus<EventsMap extends Record<string, any>> {
    private emitter = new Events.EventEmitter();

    on<K extends keyof EventsMap>(event: K, handler: Listener<EventsMap[K]>, context?: any) {
        this.emitter.on(event as string, handler as any, context);
        return this;
    }

    once<K extends keyof EventsMap>(event: K, handler: Listener<EventsMap[K]>, context?: any) {
        this.emitter.once(event as string, handler as any, context);
        return this;
    }

    off<K extends keyof EventsMap>(event: K, handler?: Listener<EventsMap[K]>, context?: any) {
        if (handler) {
            this.emitter.off(event as string, handler as any, context);
        } else {
            this.emitter.removeAllListeners(event as string);
        }
        return this;
    }

    removeListener<K extends keyof EventsMap>(event: K, handler?: Listener<EventsMap[K]>, context?: any) {
        return this.off(event, handler, context);
    }

    emit<K extends keyof EventsMap>(event: K, payload: EventsMap[K]) {
        this.emitter.emit(event as string, payload);
        return this;
    }

    removeAllListeners(event?: keyof EventsMap) {
        this.emitter.removeAllListeners(event as string | undefined);
    }
}

export type NavigationEvents = {
    'start-requested': void;
    'map-ready': { sceneKey: string };
    'launch-exploration': { planetId: PlanetId };
    'return-to-map': void;
};

export type ExplorationEvents = {
    'begin-exploration': { planet: Planet };
    'exploration-reset': void;
};

export type UiEvents = {
    'current-scene-ready': Phaser.Scene;
    'generation-changed': number;
    'planet-changed': PlanetId;
    'log-line': string;
    'mission-report': MissionReport;
    'start-mission': PlanetId;
    'robotinto-ready': void;
    'hud-update': {
        planet?: Planet;
        health: number;
        samplesCollected: number;
        sampleGoal: number;
    };
    'hud-visible': boolean;
    'hud-message': string;
    'debug-state': {
        generation: number;
        planetId?: PlanetId;
        planetName?: string;
        thresholds?: PlanetKnowledge;
        protections?: {
            temperature: boolean;
            radiation: boolean;
            gravity: boolean;
            humidity: boolean;
            lifeProtocol: boolean;
        };
        missions?: {
            failures: number;
            successes: number;
        };
    };
};

export const navigationBus = new TypedEventBus<NavigationEvents>();
export const explorationBus = new TypedEventBus<ExplorationEvents>();
export const uiBus = new TypedEventBus<UiEvents>();

// Legacy alias maintained for UI components that still rely on the original name
export const EventBus = uiBus;
