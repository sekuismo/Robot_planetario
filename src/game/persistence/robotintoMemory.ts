import { PlanetId, KnowledgeState, createInitialKnowledgeState } from '../domain';
import { MissionReport } from '../exploration/missionModel';

const STORAGE_KEY = 'robotinto_memory_v1';

export type RobotMemory = {
    knowledgeByPlanet: KnowledgeState;
    missionHistory: MissionReport[];
};

function createDefaultMemory(): RobotMemory {
    return {
        knowledgeByPlanet: createInitialKnowledgeState(),
        missionHistory: []
    };
}

function isLocalStorageAvailable(): boolean {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        const testKey = '__robotinto_test__';
        window.localStorage.setItem(testKey, '1');
        window.localStorage.removeItem(testKey);
        return true;
    } catch {
        return false;
    }
}

let inMemoryFallback: RobotMemory | null = null;

export function loadRobotMemory(): RobotMemory {
    if (inMemoryFallback) {
        return inMemoryFallback;
    }

    const base = createDefaultMemory();

    if (!isLocalStorageAvailable()) {
        inMemoryFallback = base;
        return base;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        inMemoryFallback = base;
        return base;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<RobotMemory> | null;
        if (parsed?.knowledgeByPlanet) {
            (Object.keys(base.knowledgeByPlanet) as PlanetId[]).forEach((planetId) => {
                const storedKnowledge = parsed.knowledgeByPlanet?.[planetId];
                if (storedKnowledge) {
                    base.knowledgeByPlanet[planetId] = {
                        ...base.knowledgeByPlanet[planetId],
                        ...storedKnowledge
                    };
                }
            });
        }
        if (parsed?.missionHistory && Array.isArray(parsed.missionHistory)) {
            base.missionHistory = parsed.missionHistory as MissionReport[];
        }
    } catch {
        // Ignore malformed data and keep defaults
    }

    inMemoryFallback = base;
    return base;
}

export function saveRobotMemory(memory: RobotMemory): void {
    inMemoryFallback = memory;

    if (!isLocalStorageAvailable()) {
        return;
    }

    try {
        const serialized = JSON.stringify(memory);
        window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
        // Ignore serialization/storage errors to avoid breaking the game
    }
}

