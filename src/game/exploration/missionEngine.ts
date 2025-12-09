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

type Classification = { label: string; note?: string };

function classifyTemperature(tempC: number): Classification {
    if (tempC >= 150) return { label: 'peligro extremo', note: 'riesgo para las ruedas' };
    if (tempC >= 60) return { label: 'alta', note: 'recomendado activar proteccion termica' };
    if (tempC >= 0) return { label: 'moderada', note: 'operable' };
    return { label: 'baja', note: 'riesgo de congelamiento' };
}

function classifyRadiation(rad: number): Classification {
    if (rad >= 90) return { label: 'letal', note: 'riesgo de destruccion de circuitos' };
    if (rad >= 70) return { label: 'muy alta', note: 'activar escudo' };
    if (rad >= 40) return { label: 'media', note: 'precaucion' };
    return { label: 'baja' };
}

function classifyGravity(g: number): Classification {
    if (g >= 2) return { label: 'muy alta', note: 'riesgo de aplastamiento' };
    if (g >= 1.2) return { label: 'alta', note: 'ajuste de estabilizadores necesario' };
    if (g >= 0.5) return { label: 'normal' };
    return { label: 'muy baja', note: 'riesgo de perdida de traccion' };
}

function classifyHumidity(h: number): Classification {
    if (h >= 90) return { label: 'critica', note: 'cortocircuitos inminentes' };
    if (h >= 70) return { label: 'alta', note: 'sellado recomendado' };
    if (h >= 30) return { label: 'moderada' };
    return { label: 'baja', note: 'sin riesgos de corrosion' };
}

function clampThreshold(value: number, min = -200, max = 999): number {
    return Math.max(min, Math.min(max, value));
}

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

    callbacks.log(`GEN ${generation} | PLANETA: ${planet.name}`);
    narrative.push(`GEN ${generation} | PLANETA: ${planet.name}`);

    const tempClass = classifyTemperature(sensors.temperatureC);
    const radClass = classifyRadiation(sensors.radiation);
    const gravClass = classifyGravity(sensors.gravityG);
    const humClass = classifyHumidity(sensors.humidity);

    callbacks.log(
        `Sensores -> Temp: ${sensors.temperatureC}C (${tempClass.label}) | Rad: ${sensors.radiation} (${radClass.label}) | Grav: ${sensors.gravityG}g (${gravClass.label}) | Hum: ${sensors.humidity}% (${humClass.label})`
    );
    narrative.push(
        `Sensores -> Temp: ${sensors.temperatureC}C (${tempClass.label}) | Rad: ${sensors.radiation} (${radClass.label}) | Grav: ${sensors.gravityG}g (${gravClass.label}) | Hum: ${sensors.humidity}% (${humClass.label})`
    );

    if (tempClass.note) {
        callbacks.log(`Temperatura detectada: ${tempClass.note}`);
        narrative.push(`Temperatura detectada: ${tempClass.note}`);
    }
    if (radClass.note) {
        callbacks.log(`Radiacion: ${radClass.note}`);
        narrative.push(`Radiacion: ${radClass.note}`);
    }
    if (gravClass.note) {
        callbacks.log(`Gravedad: ${gravClass.note}`);
        narrative.push(`Gravedad: ${gravClass.note}`);
    }
    if (humClass.note) {
        callbacks.log(`Humedad: ${humClass.note}`);
        narrative.push(`Humedad: ${humClass.note}`);
    }

    if (!planet.hasSurface) {
        callbacks.log('No hay superficie solida. Protocolo de exploracion en vuelo/sondas activado.');
        narrative.push('No hay superficie solida. Exploracion en vuelo/sondas, sin aterrizar.');
    }

    if (planet.hasLife) {
        callbacks.log('Vida extraterrestre: DETECTADA - recomendacion: proceder con cautela.');
        callbacks.log('Vida detectada. Cambiando a protocolo de exploracion pasiva.');
        narrative.push('Vida extraterrestre detectada. Protocolo pasivo activado.');
    } else {
        callbacks.log('Vida extraterrestre: NO detectada.');
        narrative.push('Vida extraterrestre: no detectada.');
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
            : 'Temperatura dentro de rango seguro. Ruedas sin proteccion especial.',
        protectRad
            ? `Radiacion detectada ${sensors.radiation} > umbral ${planetKnowledge.radiationThreshold}. Activando escudo anti-radiacion.`
            : 'Radiacion dentro de rango seguro. No se activa escudo.',
        protectGrav
            ? `Gravedad detectada ${sensors.gravityG}g > umbral ${planetKnowledge.gravityThreshold}g. Activando adaptacion gravitacional.`
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
            planetKnowledge.temperatureThreshold = clampThreshold(sensors.temperatureC - 10);
            callbacks.setRobotState('burn');
            callbacks.log('Temperatura extrema detectada. Ruedas sin proteccion. Las ruedas se derriten. MISION FALLIDA.');
            narrative.push('Temperatura extrema detectada. Las ruedas se derriten. MISION FALLIDA.');
        } else if (failureReason === 'radiacion') {
            planetKnowledge.radiationThreshold = clampThreshold(sensors.radiation - 5);
            callbacks.setRobotState('radiation');
            callbacks.log('Radiacion letal detectada. Sin proteccion activa. Circuitos destruidos. MISION FALLIDA.');
            narrative.push('Radiacion letal sin escudo. Circuitos destruidos. MISION FALLIDA.');
        } else if (failureReason === 'gravedad') {
            planetKnowledge.gravityThreshold = clampThreshold(sensors.gravityG - 0.1);
            callbacks.setRobotState('broken');
            callbacks.log('Gravedad extrema sin adaptacion. Robotinto pierde estabilidad. MISION FALLIDA.');
            narrative.push('Gravedad extrema sin adaptacion. Robotinto colapsa. MISION FALLIDA.');
        } else if (failureReason === 'humedad') {
            planetKnowledge.humidityThreshold = clampThreshold(sensors.humidity - 5);
            callbacks.setRobotState('shield');
            callbacks.log('Humedad critica sin sellado. Se produce cortocircuito. MISION FALLIDA.');
            narrative.push('Humedad critica sin sellado. Cortocircuito. MISION FALLIDA.');
        } else if (failureReason === 'inexperiencia') {
            planetKnowledge.temperatureThreshold = Math.min(planetKnowledge.temperatureThreshold, clampThreshold(sensors.temperatureC - 10));
            planetKnowledge.radiationThreshold = Math.min(planetKnowledge.radiationThreshold, clampThreshold(sensors.radiation - 5));
            planetKnowledge.gravityThreshold = Math.min(planetKnowledge.gravityThreshold, clampThreshold(sensors.gravityG - 0.1));
            planetKnowledge.humidityThreshold = Math.min(planetKnowledge.humidityThreshold, clampThreshold(sensors.humidity - 5));
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
        callbacks.log(`Guardando experiencia de la Gen ${generation}...`);
        narrative.push(
            `Umbrales ahora -> Temp: ${planetKnowledge.temperatureThreshold}C | Rad: ${planetKnowledge.radiationThreshold} | Grav: ${planetKnowledge.gravityThreshold}g | Hum: ${planetKnowledge.humidityThreshold}%`
        );
    } else {
        planetKnowledge.successes += 1;
        callbacks.log('Mision exitosa. Conocimiento reforzado.');
        narrative.push('Exploracion completada sin danos. Conocimiento reforzado.');
        callbacks.setRobotState('normal');
        callbacks.log(`Guardando experiencia de la Gen ${generation}: umbrales se mantienen.`);
        narrative.push(
            `Aprendizaje almacenado: Temp>${planetKnowledge.temperatureThreshold}C | Rad>${planetKnowledge.radiationThreshold} | Grav>${planetKnowledge.gravityThreshold}g | Hum>${planetKnowledge.humidityThreshold}%`
        );
    }

    return narrative;
}
