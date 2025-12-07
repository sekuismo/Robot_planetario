import Phaser, { Game } from 'phaser';
import { StartScene } from './scenes/StartScene';
import { TravelScene } from './scenes/TravelScene';
import { ExplorationScene } from './scenes/ExplorationScene';
import { MercuryScene } from './scenes/planets/MercuryScene';
import { VenusScene } from './scenes/planets/VenusScene';
import { EarthScene } from './scenes/planets/EarthScene';
import { MarsScene } from './scenes/planets/MarsScene';
import { JupiterScene } from './scenes/planets/JupiterScene';
import { SaturnScene } from './scenes/planets/SaturnScene';
import { UranusScene } from './scenes/planets/UranusScene';
import { NeptuneScene } from './scenes/planets/NeptuneScene';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720
    },
    parent: 'game-container',
    backgroundColor: '#000000',
    scene: [
        StartScene,
        TravelScene,
        ExplorationScene,
        MercuryScene,
        VenusScene,
        EarthScene,
        MarsScene,
        JupiterScene,
        SaturnScene,
        UranusScene,
        NeptuneScene
    ]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
