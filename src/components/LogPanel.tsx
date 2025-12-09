import { useEffect, useRef, useState } from 'react';
import { uiBus } from '@/game/EventBus';
import { MissionReport } from '@/game/exploration/missionModel';

export function LogPanel() {
    const [lines, setLines] = useState<string[]>([]);
    const queueRef = useRef<string[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isProcessingRef = useRef(false);

    useEffect(() => {
        const playNext = () => {
            const next = queueRef.current.shift();
            if (!next) {
                isProcessingRef.current = false;
                return;
            }
            isProcessingRef.current = true;
            setLines((prev) => [...prev, next]);
            const delay = computeDisplayDelay(next);
            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                playNext();
            }, delay);
        };

        const enqueueLines = (newLines: string[]) => {
            queueRef.current.push(...newLines);
            if (!isProcessingRef.current) {
                playNext();
            }
        };

        const handleLogLine = (msg: string) => {
            queueRef.current.push(msg);
            if (!isProcessingRef.current) {
                playNext();
            }
        };

        const handleMissionReport = (report: MissionReport) => {
            const blockLines = missionReportToLogLines(report);
            enqueueLines(blockLines);
        };

        uiBus.on('log-line', handleLogLine);
        uiBus.on('mission-report', handleMissionReport);

        return () => {
            uiBus.removeListener('log-line', handleLogLine);
            uiBus.removeListener('mission-report', handleMissionReport);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            queueRef.current = [];
            isProcessingRef.current = false;
        };
    }, []);

    return (
        <div className="retro-log">
            {lines.map((line, idx) => (
                <div key={`${idx}-${line.slice(0, 10)}`}>{line}</div>
            ))}
        </div>
    );
}

function computeDisplayDelay(message: string): number {
    const base = 1500 + message.length * 28;
    const min = 1800;
    const max = 6200;
    return Math.max(min, Math.min(max, base));
}

function missionReportToLogLines(report: MissionReport): string[] {
    const lines: string[] = [];

    lines.push('----------------------------------------');

    const outcomeLabel =
        report.outcome === 'SUCCESS' ? 'ÉXITO' : report.outcome === 'FAILURE' ? 'FALLO' : 'PARCIAL';

    lines.push(
        `[GEN ${report.generation} | PLANETA: ${report.planetName} | RESULTADO: ${outcomeLabel}]`
    );

    const sensors = report.sensors;
    lines.push(
        `Sensores -> Temp: ${sensors.temperatureC}C | Gravedad: ${sensors.gravityG}g | Humedad: ${sensors.humidity}% | Radiación: ${sensors.radiation}`
    );
    lines.push(
        sensors.hasLife
            ? 'Vida extraterrestre: DETECTADA – recomendación: proceder con cautela.'
            : 'Vida extraterrestre: NO detectada.'
    );

    const protections = report.protectionsDecisions;
    const protLabel = (label: string, active: boolean) =>
        `${label}: ${active ? 'ACTIVADA' : 'DESACTIVADA'}`;

    lines.push(
        `Protecciones -> ${protLabel('Térmica', protections.temperature)} | ${protLabel(
            'Anti-radiación',
            protections.radiation
        )} | ${protLabel('Gravedad', protections.gravity)} | ${protLabel(
            'Humedad',
            protections.humidity
        )}`
    );

    if (protections.lifeProtocol) {
        lines.push('Protocolo ante vida extraterrestre: ACTIVO (exploración pasiva).');
    }

    if (report.outcome === 'FAILURE') {
        if (report.failureReason) {
            lines.push(`Resultado: ${report.failureReason}`);
        } else {
            lines.push('Resultado: MISIÓN FALLIDA.');
        }
        lines.push(
            'Aprendizaje: umbrales recalibrados para reaccionar antes ante este tipo de peligro en generaciones futuras.'
        );
    } else if (report.outcome === 'SUCCESS') {
        lines.push('Resultado: MISIÓN EXITOSA. Robotinto completa la exploración sin daños críticos.');
        lines.push(
            'Aprendizaje: condiciones registradas como seguras con los umbrales actuales (conocimiento reforzado).'
        );
    } else {
        lines.push('Resultado: MISIÓN PARCIAL. Datos incompletos, se registran observaciones parciales.');
        lines.push(
            'Aprendizaje: información parcial almacenada; se recomiendan misiones adicionales para afinar umbrales.'
        );
    }

    return lines;
}
