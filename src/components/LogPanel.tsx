import { useEffect, useState } from 'react';
import { EventBus } from '@/game/EventBus';

export function LogPanel() {
    const [lines, setLines] = useState<string[]>([]);

    useEffect(() => {
        const handler = (msg: string) => {
            setLines((prev) => [...prev, msg]);
        };

        EventBus.on('log-line', handler);

        return () => {
            EventBus.removeListener('log-line', handler);
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
