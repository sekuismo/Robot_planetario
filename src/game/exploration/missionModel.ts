import { PlanetId } from '../domain';

export type MissionOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL';

export type MissionSensorsSnapshot = {
    temperatureC: number;
    gravityG: number;
    humidity: number;
    radiation: number;
    hasLife: boolean;
};

export type MissionProtectionDecisions = {
    temperature: boolean;
    radiation: boolean;
    gravity: boolean;
    humidity: boolean;
    lifeProtocol: boolean;
};

export type MissionThresholdsSnapshot = {
    temperatureThreshold: number;
    radiationThreshold: number;
    gravityThreshold: number;
    humidityThreshold: number;
};

export interface MissionReport {
    planetId: PlanetId;
    planetName: string;
    generation: number;
    sensors: MissionSensorsSnapshot;
    protectionsDecisions: MissionProtectionDecisions;
    outcome: MissionOutcome;
    failureReason?: string;
    thresholdsSnapshot: MissionThresholdsSnapshot;
}

const missionHistory: MissionReport[] = [];

export function addMissionReport(report: MissionReport): void {
    missionHistory.push(report);
}

export function getMissionHistory(): MissionReport[] {
    return missionHistory;
}

export function seedMissionHistory(initial: MissionReport[]): void {
    missionHistory.length = 0;
    if (!initial || initial.length === 0) {
        return;
    }
    missionHistory.push(...initial);
}
