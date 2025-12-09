import { Scene } from 'phaser';
import { navigationBus, uiBus } from '../EventBus';

export class StartScene extends Scene {
    private loadingImage?: Phaser.GameObjects.Image;
    private loadingText?: Phaser.GameObjects.Text;

    constructor() {
        super('StartScene');
    }

    private loadIfMissing(key: string, path: string) {
        if (!this.textures.exists(key)) {
            this.load.image(key, path);
        }
    }

    preload() {
        this.loadIfMissing('start-bg', 'assets/main_back.png');
        this.loadIfMissing('loading-screen', 'assets/Back_loading.png');
    }

    create() {
        const { width, height } = this.scale;

        this.cameras.main.setBackgroundColor('#000000');

        const bg = this.add.image(width / 2, height / 2, 'start-bg');
        bg.setDisplaySize(width, height);

        const buttonWidth = 260;
        const buttonHeight = 72;
        const buttonY = height * 0.75;

        const buttonBackground = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x0b210b, 0.85);
        buttonBackground.setStrokeStyle(2, 0x123712);

        const buttonLabel = this.add.text(0, 0, 'Iniciar Juego', {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#b6ff9b'
        }).setOrigin(0.5);

        const startButton = this.add.container(width / 2, buttonY, [buttonBackground, buttonLabel]);
        startButton.setSize(buttonWidth, buttonHeight);
        startButton.setInteractive({ useHandCursor: true });

        this.createLoadingOverlay();

        startButton.on('pointerover', () => startButton.setScale(1.03));
        startButton.on('pointerout', () => startButton.setScale(1));
        startButton.on('pointerdown', () => {
            startButton.disableInteractive();
            this.showLoading(() => {
                navigationBus.emit('start-requested', undefined as void);
            });
        });

        this.tweens.add({
            targets: startButton,
            scale: { from: 1, to: 1.04 },
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        uiBus.emit('current-scene-ready', this);
    }

    private createLoadingOverlay() {
        const { width, height } = this.scale;
        this.loadingImage = this.add.image(width / 2, height / 2, 'loading-screen');
        this.loadingImage.setDisplaySize(width, height);
        this.loadingImage.setDepth(30);
        this.loadingImage.setVisible(false);

        this.loadingText = this.add.text(width / 2, height * 0.75, 'Cargando...', {
            fontFamily: 'monospace',
            fontSize: '32px',
            color: '#b6ff9b'
        }).setOrigin(0.5).setDepth(31).setVisible(false);
    }

    private showLoading(onComplete: () => void) {
        if (!this.loadingImage || !this.loadingText) {
            onComplete();
            return;
        }

        this.loadingImage.setAlpha(0).setVisible(true);
        this.loadingText.setAlpha(0).setVisible(true);

        this.tweens.add({
            targets: [this.loadingImage, this.loadingText],
            alpha: 1,
            duration: 220,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.time.delayedCall(420, () => {
                    onComplete();
                });
            }
        });
    }
}
