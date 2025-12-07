import { Planet } from '../domain';

export type AnimationProfile = {
    landingDurationMs: number;
    hoverOffset: number;
    moveSpeed: number;
};

export function getAnimationProfile(planet: Planet): AnimationProfile {
    const g = planet.gravityG;
    const moveSpeed = Math.max(170, Math.min(270, 270 - g * 35)); // más gravedad => más lento
    const hoverOffset = Math.max(6, Math.min(18, 16 - g * 4)); // más gravedad => menos oscilación
    const landingDurationMs = Math.max(750, Math.min(1350, 950 + (g - 1) * 240)); // más gravedad => aterrizaje más lento
    return { landingDurationMs, hoverOffset, moveSpeed };
}
