import { KnowledgeState, Planet } from '../domain';

export type RobotState = 'moving' | 'burn' | 'radiation' | 'broken' | 'shield' | 'normal' | 'exploring';

export type MissionCallbacks = {
    log: (msg: string) => void;
    setRobotState: (state: RobotState) => void;
};

export type MissionParams = {
    planet: Planet;
    knowledge: KnowledgeState;
    generation: number;
    dangerOverrides?: Partial<{ temperatureC: number; radiation: number; gravityG: number; humidity: number }>;
    callbacks: MissionCallbacks;
};

export function runMissionForPlanet(params: MissionParams): string[] {
    const { planet, knowledge, generation, dangerOverrides, callbacks } = params;
    const sensors = {
        temperatureC: planet.temperatureC,
        radiation: planet.radiation,
        gravityG: planet.gravityG,
        humidity: planet.humidity
    };
    const narrative: string[] = [];
    const planetKnowledge = knowledge[planet.id];
    const isFirstAttempt = planetKnowledge.failures + planetKnowledge.successes === 0;

    callbacks.log(`[Generacion ${generation}] Explorando ${planet.name}`);
    callbacks.log(
        `Sensores => Temp: ${sensors.temperatureC}C, Rad: ${sensors.radiation}, Grav: ${sensors.gravityG}g, Hum: ${sensors.humidity}`
    );
    narrative.push(`Gen ${generation} | ${planet.name}`);
    narrative.push(
        `Lecturas -> Temp: ${sensors.temperatureC}C | Rad: ${sensors.radiation} | Grav: ${sensors.gravityG}g | Hum: ${sensors.humidity}%`
    );

    if (!planet.hasSurface) {
        callbacks.log('No hay superficie solida. Cambiando a exploracion en vuelo y sondas.');
        narrative.push('No hay superficie solida. Exploracion en vuelo/sondas, sin aterrizar.');
    }

    const protectTemp = sensors.temperatureC > planetKnowledge.temperatureThreshold;
    const protectRad = sensors.radiation > planetKnowledge.radiationThreshold;
    const protectGrav = sensors.gravityG > planetKnowledge.gravityThreshold;
    const protectHum = sensors.humidity > planetKnowledge.humidityThreshold;

    const danger = {
        temperatureC: 80,
        radiation: 50,
        gravityG: 1.5,
        humidity: 85,
        ...(dangerOverrides ?? {})
    };

    const logsForProtection = [
        protectTemp
            ? `Temperatura detectada ${sensors.temperatureC}C > umbral ${planetKnowledge.temperatureThreshold}C. Activando proteccion termica.`
            : 'Temperatura dentro de rango seguro. No se activa proteccion termica.',
        protectRad
            ? `Radiacion detectada ${sensors.radiation} > umbral ${planetKnowledge.radiationThreshold}. Activando escudo.`
            : 'Radiacion dentro de rango seguro. No se activa escudo.',
        protectGrav
            ? `Gravedad detectada ${sensors.gravityG}g > umbral ${planetKnowledge.gravityThreshold}g. Ajustando estabilizadores.`
            : 'Gravedad dentro de rango seguro. Sin ajuste de estabilizadores.',
        protectHum
            ? `Humedad detectada ${sensors.humidity} > umbral ${planetKnowledge.humidityThreshold}. Sellando compartimentos.`
            : 'Humedad dentro de rango seguro. Sistemas estandar activos.'
    ];
    logsForProtection.forEach((msg) => {
        callbacks.log(msg);
        narrative.push(msg);
    });

    let failureReason: 'temperatura' | 'radiacion' | 'gravedad' | 'humedad' | 'inexperiencia' | null = null;

    if (!protectTemp && sensors.temperatureC > danger.temperatureC) {
        failureReason = 'temperatura';
    } else if (!protectRad && sensors.radiation > danger.radiation) {
        failureReason = 'radiacion';
    } else if (!protectGrav && sensors.gravityG > danger.gravityG) {
        failureReason = 'gravedad';
    } else if (!protectHum && sensors.humidity > danger.humidity) {
        failureReason = 'humedad';
    } else if (isFirstAttempt) {
        failureReason = 'inexperiencia';
    }

    if (failureReason) {
        planetKnowledge.failures += 1;
        if (failureReason === 'temperatura') {
            planetKnowledge.temperatureThreshold = sensors.temperatureC - 10;
            callbacks.setRobotState('burn');
            narrative.push('La temperatura excede el limite y las ruedas se dañan.');
        } else if (failureReason === 'radiacion') {
            planetKnowledge.radiationThreshold = sensors.radiation - 5;
            callbacks.setRobotState('radiation');
            narrative.push('La radiacion atraviesa los sistemas. Circuitos dañados.');
        } else if (failureReason === 'gravedad') {
            planetKnowledge.gravityThreshold = sensors.gravityG - 0.1;
            callbacks.setRobotState('broken');
            narrative.push('La gravedad colapsa la estructura. Perdida de estabilidad.');
        } else if (failureReason === 'humedad') {
            planetKnowledge.humidityThreshold = sensors.humidity - 5;
            callbacks.setRobotState('shield');
            narrative.push('La humedad ahoga los sensores. Sistemas en modo de emergencia.');
        } else if (failureReason === 'inexperiencia') {
            planetKnowledge.temperatureThreshold = Math.min(planetKnowledge.temperatureThreshold, sensors.temperatureC - 10);
            planetKnowledge.radiationThreshold = Math.min(planetKnowledge.radiationThreshold, sensors.radiation - 5);
            planetKnowledge.gravityThreshold = Math.min(planetKnowledge.gravityThreshold, sensors.gravityG - 0.1);
            planetKnowledge.humidityThreshold = Math.min(planetKnowledge.humidityThreshold, sensors.humidity - 5);
            callbacks.setRobotState('broken');
            callbacks.log('Primera incursion sin experiencia. Los sistemas fallan y se recalibran.');
            narrative.push('Falta de experiencia: los sistemas no reaccionan a tiempo. Falla registrada.');
            narrative.push('Recalibrando umbrales para la siguiente generacion.');
        }
        if (failureReason === 'inexperiencia') {
            callbacks.log('Mision fallida por falta de experiencia. Umbrales recalibrados para la proxima generacion.');
            narrative.push('Mision fallida por falta de experiencia. Umbrales recalibrados para la siguiente generacion.');
        } else {
            callbacks.log(`Mision fallida por ${failureReason}. Ajustando umbral de ${failureReason} para la proxima generacion.`);
            narrative.push(`Mision fallida por ${failureReason}. Umbral actualizado para la siguiente generacion.`);
        }
    } else {
        planetKnowledge.successes += 1;
        callbacks.log('Mision exitosa. Conocimiento reforzado.');
        narrative.push('Exploracion completada sin daños. Conocimiento reforzado.');
        callbacks.setRobotState('normal');
    }

    return narrative;
}
