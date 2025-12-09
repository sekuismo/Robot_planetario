import Phaser from 'phaser';

export interface MovementControls {
    keys: {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
    };
    destroy(): void;
}

export function createMovementControls(scene: Phaser.Scene): MovementControls {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('Keyboard plugin is not available in this scene');
    }

    const keys = {
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };

    const destroy = () => {
        if (!keyboard) {
            return;
        }
        keyboard.removeKey(keys.up.keyCode);
        keyboard.removeKey(keys.down.keyCode);
        keyboard.removeKey(keys.left.keyCode);
        keyboard.removeKey(keys.right.keyCode);
    };

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);

    return { keys, destroy };
}
