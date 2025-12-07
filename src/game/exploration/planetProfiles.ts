import { PlanetProfilesMap } from './types';
import { MercuryProfile } from './planets/Mercury';
import { VenusProfile } from './planets/Venus';
import { EarthProfile } from './planets/Earth';
import { MarsProfile } from './planets/Mars';
import { JupiterProfile } from './planets/Jupiter';
import { SaturnProfile } from './planets/Saturn';
import { UranusProfile } from './planets/Uranus';
import { NeptuneProfile } from './planets/Neptune';

export const PLANET_PROFILES: PlanetProfilesMap = {
    MERCURY: MercuryProfile,
    VENUS: VenusProfile,
    EARTH: EarthProfile,
    MARS: MarsProfile,
    JUPITER: JupiterProfile,
    SATURN: SaturnProfile,
    URANUS: UranusProfile,
    NEPTUNE: NeptuneProfile
};
