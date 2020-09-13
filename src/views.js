class ViewManager {
    constructor() {
        this.views = [];
        this.a = [];
    }

    step(dt, t) {
        const a = this.views[last(this.a)];
        a.step(dt, t);
        if (a.isDone) {
            this.a.pop();
            a.remove();
            this.views[last(this.a)].init(dt, t);
        }
    }

    add(view) {
        this.views[view.name] = view;
    }

    push(viewName) {
        return this.a.push(viewName);
    }
}

const viewManager = new ViewManager();

class View {
    constructor(name) {
        this.name = name;
        this.isDone = false;
    }

    init(dt, t) {}
    step(dt, t) {}
    remove() {}
}

class InitView extends View {
    constructor() {
        super(INIT_VIEW);
        this.isDone = true;
    }
}

class MainView extends View {
    constructor(gameFactory, synth, viewManager, overlay) {
        super(MAIN_VIEW);

        this.overlay = overlay;
        this.gameFactory = gameFactory;
        this.synth = synth;
        this.viewManager = viewManager;

        this.interval = -1;
        this.angle = 0;
        this.t = 0;

        this.singlePlayer = this.singlePlayer.bind(this);
    }

    singlePlayer() {
        playerService.prepareSinglePlayer(this.gameFactory, this.viewManager.views[RACE_VIEW]);
        this.isDone = true
    }

    init(dt, t) {
        this.t = t;
        this.isDone = false;

        this.overlay.innerHTML = `<h1 id="b">Race</h1><h2 id="a">${isTouch ? 'TAP' : 'CLICK'} TO PLAY<h2>`;

        once(document.body, clickEvent, this.singlePlayer);

        const level = levelService.initLevel(this.gameFactory, 'desert');

        [
            this.gameFactory.four(0.7,0.7,0.7),
            this.gameFactory.zero(0.7, 0.7, 0.7),
            this.gameFactory.four(0.7,0.7,0.7)
        ]
            .map(o => this.gameFactory.webgl.add(o))
            .forEach((o, i) => {
                o.position[0] = level.finishLine.position[0] - 5 + (5 * i);
                o.position[1] = level.finishLine.position[1];
                o.position[2] = 8;
                o.setParent(level.container);
            });
    }

    step(dt, t) {
        const a = sin(this.angle += 0.001);
        this.t = t;
        this.gameFactory.webgl.camera.position[2] = CAMERA_Z + a;
        this.gameFactory.webgl.camera.rotation[1] = a * 0.3;
        this.gameFactory.webgl.camera.updateTransforms();
    }

    remove() {
        // User has interacted at this point.
        // -> we can get synth context without error
        this.gameFactory.webgl.camera.position[2] = CAMERA_Z;
        this.gameFactory.webgl.camera.rotation[1] = 0;
        this.synth.init();
        this.gameFactory.webgl.reset();
        this.overlay.innerHTML = ``;
        this.viewManager.push(RACE_VIEW);
        levelService.prevIndex = -1;
    }
}

class RaceView extends View {
    constructor(gameFactory, synth, viewManager, restartButton, controls, context2d, overlay) {
        super(RACE_VIEW);

        this.gameFactory = gameFactory;
        this.synth = synth;
        this.viewManager = viewManager;
        this.restartButton = restartButton;
        this.controls = controls;
        this.context2d = context2d;
        this.overlay = overlay;

        this.biip = null;
        this.boop = null;
        this.buup = null;

        this.isRaceDone = false;
        this.isStarted = false;
        this.isReady = false;
        this.t = 0;

        this.update = this.update.bind(this);
        this.reset = this.reset.bind(this);
        this.onCollision = this.onCollision.bind(this);
        this.leaderboard = new Leaderboard(this);
    }

    init(dt, t) {
        const { gameFactory, synth } = this;
        const { physics } = gameFactory;

        this.isRaceDone = false;
        this.isStarted = false;
        this.isReady = false;
        this.isDone = false;
        physics.isStarted = false;

        this.leaderboard.init();
        this.restartButton.style.visibility = 'visible';

        this.biip = onceFn(synth.play.bind(synth, 50, 500, 0.5));
        this.boop = onceFn(synth.play.bind(synth, 45, 500, 0.5));
        this.buup = onceFn(synth.play.bind(synth, 40, 500, 0.5));

        this.controls.start();

        const level = levelService.initLevel(gameFactory);

        playerService.playerArray
            .forEach(pointBody(level.cps[0].body, level.cps[1].body));

        playerService.playerArray
            .forEach(this.update);

        level.lights.forEach(grey);
        levelService.startTime = t + 1000;

        this.overlay.innerHTML = `<h1 class="b">1 / ${MAX_LAPS}</h1>`;
    }

    update(player) {
        player.step(this.t);
        this.gameFactory.update(player.drone);
    }

    step(dt, t) {
        this.t = t;
        const d = t - levelService.startTime;

        this.controls.draw(this.context2d);

        if (d < 0) {

        } else if (this.isReady) {
            playerService.playerArray.forEach(this.update);
            this.gameFactory.physics.step(this.onCollision);

            if (this.isRaceDone) {
                this.leaderboard.render();
            }

            this.isDone = this.leaderboard.isDone;
        } else if (d < 1000) {
            this.buup();
            levelService.level.lights.forEach(red);
        } else if (d < 2000) {
            this.boop();
            levelService.level.lights.forEach(yellow);
        } else {
            this.biip();

            if (!this.isStarted) {
                this.isStarted = true;
                this.gameFactory.physics.isStarted = true;
                levelService.level.lights.forEach(green);
            }

            playerService.playerArray.forEach(this.update);
            this.gameFactory.physics.step(this.onCollision);

            if (d > 4000) {
                levelService.level.lights.forEach(hide);
                this.isReady = true;
            }
        }

        const x = this.gameFactory.webgl.camera.position[0] = -playerService.me.drone.object3d.position[0];
        const y = this.gameFactory.webgl.camera.position[1] = -playerService.me.drone.object3d.position[1];

        this.gameFactory.webgl.light.position[0] = x + levelService.level.cps[playerService.me.nextCp].object3d.position[0];
        this.gameFactory.webgl.light.position[1] = y + levelService.level.cps[playerService.me.nextCp].object3d.position[1];
        this.gameFactory.webgl.camera.updateTransforms();
    }

    onCollision({ a, b }) {
        if (b.isSensor) {
            const cpIndex = b.belongsTo; // if cp then belongsTo is set to index, I am not very proud of this
            const player = playerService.players[a.belongsTo];

            if (player.nextCp === cpIndex) {
                player.cpTicks++;
                const prevCp = player.nextCp;
                player.nextCp++;

                if (player.nextCp >= levelService.level.cps.length) {
                    player.nextCp = 0;
                }

                if (player === playerService.me) {
                    lila(levelService.level.cps[prevCp].object3d);
                    green(levelService.level.cps[player.nextCp].object3d);
                    this.synth.play(50, 0.1, 0.1);
                }

                if (player.cpTicks > 1 && prevCp === 0) {
                    player.lap++;

                    if (player.lap >= MAX_LAPS && !player.endTime) {
                        this.isRaceDone = true;
                        player.endTime = this.t;
                    }

                    if (player === playerService.me) {
                        const n = player.lap + 1;
                        if (n <= MAX_LAPS) {
                            this.overlay.innerHTML = `<h1 class="b">${n > MAX_LAPS ? MAX_LAPS : n} / ${MAX_LAPS}</h1>`;
                        }
                    }
                }
            }
        } else {
            const pA = playerService.players[a.belongsTo];
            const pB = playerService.players[b.belongsTo];
            const pMe = playerService.me;
            let volume = pMe === pA || pMe === pB ? 0.5 : 0.0;

            if (pA) {
                pA.shield.activate();

                if (!volume) {
                    const diff = 160000 - dist2(pMe.drone.body, pA.drone.body);
                    volume = 1.0 - (diff <= 0 ? 1.0 : diff / 160000);
                }
            }

            if (pB) {
                pB.shield.activate();

                if (!volume) {
                    const diff = 160000 - dist2(pMe.drone.body, pA.drone.body);
                    volume = 1.0 - (diff <= 0 ? 1.0 : diff / 160000);
                }
            }

            if (volume) {
                this.synth.play(pA && pB ? 45 : 25, 0.05, volume);
            }
        }
    }

    reset(e) {
        stopDead(e);
        this.gameFactory.webgl.reset();
        this.gameFactory.physics.reset();
        this.init(0, this.t);
    }

    remove() {
        this.leaderboard.remove();

        if (levelService.isWon()) {
            levelService.reset(this.gameFactory);
            this.viewManager.push(CREDITS_VIEW);
        } else {
            this.viewManager.push(RACE_VIEW);
        }

        this.restartButton.style.visibility = 'hidden';

        this.gameFactory.webgl.reset();
        this.gameFactory.physics.reset();
    }
}

class Leaderboard {
    constructor(view) {
        this.view = view;
        this.isDone = false;
        this.finishedCount = 0;
        this.doneButton = null;
        this.setDone = this.setDone.bind(this);
    }

    init() {
        this.doneButton = null;
        this.isDone = false;
        this.finishedCount = 0;
    }

    isFinished(a) {
        return a.endTime;
    }

    countFinished(a, b) {
        return b.endTime ? a + 1 : a;
    }

    byRaceTime(a, b) {
        if (!a.endTime && !b.endTime) return b.cpTicks - a.cpTicks;
        if (!a.endTime) return 1;
        if (!b.endTime) return -1;
        return a.endTime - b.endTime;
    }

    setDone(e) {
        stopDead(e);

        const players = playerService.playerArray.sort(this.byRaceTime);

        if (players[0] === playerService.me) {
            levelService.incLevel();
        }

        this.isDone = true;
    }

    toPlacement(a, i) {
        if (a.endTime) {
            return i < 5 ? `<p>${i + 1}. ${a.name}</p>` : i === 5 ? '<p>...</p>' : '';
        }

        return '';
    }

    render() {
        const count = playerService.playerArray.reduce(this.countFinished, 0);

        if (this.finishedCount === count) {
            return;
        }

        if (this.doneButton) {
            off(this.doneButton, clickEvent, this.setDone);
        }

        this.finishedCount = count;
        this.view.overlay.innerHTML = `<div><div class="a"><h1>FINISH</h1>${playerService.playerArray.sort(this.byRaceTime).map(this.toPlacement).join('')}<button>Play ${playerService.playerArray[0] === playerService.me ? 'Next' : 'Again'}</button></div></div>`;

        this.doneButton = this.view.overlay.getElementsByTagName('button')[0];
        once(this.doneButton, clickEvent, this.setDone);
    }

    remove() {
        // playerService.playerArray
        //     .sort(this.byRaceTime)
        //     .forEach((a, i, all) => a.points += all.length - i - 1);
        this.view.overlay.innerHTML = ``;
    }
}

class CreditsView extends View {
    constructor(gameFactory, viewManager, overlay) {
        super(CREDITS_VIEW);

        this.overlay = overlay;
        this.gameFactory = gameFactory;
        this.viewManager = viewManager;

        this.angle = 0;
        this.setDone = this.setDone.bind(this);
    }

    setDone() {
        this.isDone = true;
    }

    init() {
        this.isDone = false;

        this.overlay.innerHTML = `<div><div class="a">
    <h1>You won!</h1>
    <p>Price 404</p>
    <p>${!levelService.wins ?
            'The bots will be harder from now on.' :
            levelService.wins === 1 ?
                'The bots will be even harder. Not sure if the game is winnable.' :
                'The bots are insane. Can not win.'}</p>
    <p>By: <a href="http://viljamipeltola.com/">VP</a></p>
    <p>Thanks: KK, SN</p>
    </div></div>
    <h1 id="a"><br><br><br>To lobby</h1>`;

        levelService.initLevel(this.gameFactory, 'arena')
        this.gameFactory.webgl.camera.position[2] *= 1.5;
        once(document.body, clickEvent, this.setDone);
        levelService.wins++;
    }

    step(dt, t) {
        this.gameFactory.webgl.camera.rotation[1] = sin(this.angle += 0.001) * 0.3;
        this.gameFactory.webgl.camera.updateTransforms();
    }

    remove() {
        this.gameFactory.webgl.camera.rotation[1] = 0;
        this.gameFactory.webgl.reset();
        this.viewManager.push(MAIN_VIEW);
        this.overlay.innerHTML = ``;
    }
}
