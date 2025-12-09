import { useEffect, useRef, useState } from 'react';
import { uiBus } from '@/game/EventBus';
import { Planet } from '@/game/domain';

type HudNotice = { text: string; kind: 'status' | 'log' };

type HudState = {
    visible: boolean;
    health: number;
    samplesCollected: number;
    sampleGoal: number;
    planet?: Planet;
};

export function HudOverlay() {
    const [state, setState] = useState<HudState>({
        visible: false,
        health: 100,
        samplesCollected: 0,
        sampleGoal: 0
    });
    const [currentNotice, setCurrentNotice] = useState<HudNotice | undefined>(undefined);
    const noticeQueueRef = useRef<HudNotice[]>([]);
    const noticeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isProcessingRef = useRef(false);

    useEffect(() => {
        function playNextNotice() {
            const next = noticeQueueRef.current.shift();
            if (!next) {
                isProcessingRef.current = false;
                setCurrentNotice(undefined);
                return;
            }
            isProcessingRef.current = true;
            setCurrentNotice(next);
            const delay = clamp(1800 + next.text.length * 28, 2400, 6200);
            noticeTimerRef.current = setTimeout(() => {
                noticeTimerRef.current = null;
                playNextNotice();
            }, delay);
        }

        const enqueueNotice = (notice: HudNotice) => {
            noticeQueueRef.current = [...noticeQueueRef.current, notice];
            if (!isProcessingRef.current) {
                playNextNotice();
            }
        };

        const handleUpdate = (payload: { planet?: Planet; health: number; samplesCollected: number; sampleGoal: number }) => {
            setState((prev) => ({
                ...prev,
                ...payload
            }));
        };
        const handleVisible = (visible: boolean) => {
            setState((prev) => ({ ...prev, visible }));
        };

        const handleMessage = (msg: string) => {
            enqueueNotice({ text: msg, kind: 'status' });
        };

        const handleLogLine = (line: string) => {
            enqueueNotice({ text: line, kind: 'log' });
        };

        uiBus.on('hud-update', handleUpdate);
        uiBus.on('hud-visible', handleVisible);
        uiBus.on('hud-message', handleMessage);
        uiBus.on('log-line', handleLogLine);

        return () => {
            uiBus.removeListener('hud-update', handleUpdate);
            uiBus.removeListener('hud-visible', handleVisible);
            uiBus.removeListener('hud-message', handleMessage);
            uiBus.removeListener('log-line', handleLogLine);
            if (noticeTimerRef.current) {
                clearTimeout(noticeTimerRef.current);
                noticeTimerRef.current = null;
            }
        };
    }, []);

    if (!state.visible) {
        return null;
    }

    const { health, samplesCollected, sampleGoal, planet } = state;
    const healthClamped = Math.max(0, Math.min(100, Math.round(health)));
    const barPct = `${healthClamped}%`;

    return (
        <div className="hud-overlay">
            <div className="hud-row">
                <div className="hud-metric">
                    <span className="hud-label">Vida</span>
                    <div className="hud-bar">
                        <div className="hud-bar__fill" style={{ width: barPct }} />
                    </div>
                    <span className="hud-value">{healthClamped}%</span>
                </div>
                <div className="hud-metric">
                    <span className="hud-label">Muestras</span>
                    <span className="hud-value">
                        {samplesCollected}/{sampleGoal || '?'}
                    </span>
                </div>
                {planet && (
                    <div className="hud-params">
                        <span className="hud-label">Parámetros</span>
                        <span className="hud-value">
                            Temp {planet.temperatureC}C · Rad {planet.radiation} · Grav {planet.gravityG}g · Hum {planet.humidity}%
                        </span>
                    </div>
                )}
            </div>
            {currentNotice && (
                <div className={`hud-message ${currentNotice.kind === 'log' ? 'hud-logline' : ''}`}>{currentNotice.text}</div>
            )}
        </div>
    );

    function enqueueNotice(notice: HudNotice) {
        noticeQueueRef.current = [...noticeQueueRef.current, notice];
        if (!currentNotice) {
            playNextNotice();
        }
    }

    function playNextNotice() {
        const next = noticeQueueRef.current.shift();
        if (!next) {
            setCurrentNotice(undefined);
            return;
        }
        setCurrentNotice(next);
        const delay = clamp(1800 + next.text.length * 28, 2400, 6200);
        noticeTimerRef.current = setTimeout(() => {
            noticeTimerRef.current = null;
            playNextNotice();
        }, delay);
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
