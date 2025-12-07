import { Planet, PlanetId } from '../domain';
import { MissionParams } from './missionEngine';

export type PlanetProfile = {
    patrol?: { dxFactor: number; dy: number; duration: number };
    introMessages?: string[];
    dangerOverrides?: Partial<{ temperatureC: number; radiation: number; gravityG: number; humidity: number }>;
    explorationMessages?: string[];
    stepGoal?: number;
    customMission?: (params: MissionParams) => string[];
    buildExplorationPhase?: (planet: Planet) => { messages: string[]; stepGoal?: number };
};

export type PlanetProfilesMap = Record<PlanetId, PlanetProfile>;
