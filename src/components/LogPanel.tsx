import { useEffect, useRef, useState } from 'react';
import { uiBus } from '@/game/EventBus';

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

        const handler = (msg: string) => {
            queueRef.current.push(msg);
            if (!isProcessingRef.current) {
                playNext();
            }
        };

        uiBus.on('log-line', handler);

        return () => {
            uiBus.removeListener('log-line', handler);
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
