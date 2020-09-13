class Shield {
    constructor(drone) {
        this.drone = drone;
        this.ticks = 0;
    }

    activate() {
        this.ticks = 20;
        last(this.drone.object3d.children).hidden = false;
    }

    step() {
        if (this.ticks-- < 0) {
            last(this.drone.object3d.children).hidden = true;
        }
    }
}

class Commands {
    constructor() {
        this.all = new Float32Array(4 * 60 * 2);
        this.latest = 0;
        this.prevNext = 0;
        this.next = 0;
        this.length = 0;
    }

    add(angle, thrust) {
        this.all[this.next] = angle;
        this.all[this.next + 1] = thrust;
        this.all[this.next + 2] = 1; // is not yet applied
        this.all[this.next + 3] = Date.now();

        this.prevNext = this.next;
        this.next += 4;
        this.length++;

        if (this.next >= this.all.length) {
            this.next = 0;
            this.length = 60 * 2;
        }
    }

    hasNonApplied() {
        return this.all[this.latest + 2];
    }

    apply(drone, specs) {
        if (!this.length) {
            return;
        }

        const index = this.latest;
        const { body } = drone;

        if (!!this.all[index + 2]) {
            this.all[index + 2] = 0;

            this.latest = this.latest + 4 >= this.all.length ?
                0 :
                this.latest + 4;

            if (this.next === this.all.length - 4 && this.latest === 0 || this.latest > this.next) {
                this.latest = this.next;
            }

            body.angle += this.all[index];

            if (body.angle > PI2) {
                body.angle -= PI2;
            } else if (body.angle < 0) {
                body.angle += PI2;
            }

            if (body.vx ** 2 + body.vy ** 2 < specs.maxA ** 2) {
                const thrust = this.all[index + 1];
                body.vx += cos(body.angle) * thrust;
                body.vy += -sin(body.angle) * thrust;
            }
        }
    }

    traceBack(timestamp) {
        let i = this.latest,
            j = i;

        while (this.all[i + 3] > timestamp) {
            this.all[i + 2] = 1;
            j = i;
            i = (i - 4 < 0 ? this.all.length : i) - 4;
        }

        this.latest = j;
    }
}

class Player {
    constructor(id, drone, ai, name = '') {
        this.id = id;
        this.name = name;
        this.color = red;
        this.shield = new Shield(drone);
        this.drone = drone;
        this.drone.body.belongsTo = id;
        this.ai = ai;

        this.nextCp = 0;
        this.cpTicks = 0;
        this.lap = 0;
        this.endTime = 0;

        this.syncTics = 0;

        this.specs = {
            mInc: 0.1,
            maxA: 10,
            maxAInc: 0.1,
            power: 1,
            powerInc: 0.1,
            maxRot: 2,
            rotPower: 0.05,
            rotPowerInc: 0.001,
        };

        this.commands = new Commands();
        this.step = this.step.bind(this);
    }

    setId(id) {
        this.id = id;
        this.drone.body.belongsTo = id;
    }

    step(t) {
        this.shield.step();

        this.ai(this);

        if (this.commands.hasNonApplied()) {
            this.commands.apply(this.drone, this.specs);
        }
    }
}

class LevelService {
    constructor() {
        this.startTime = 0;
        this.index = 3;
        this.prevIndex = -1;
        this.levels = ['desert', 'maze', 'forest', 'arena'];
        this.level = null;
        this.wins = 0;
    }

    initLevel(gameFactory, name) {
        const { webgl, physics } = gameFactory;
        this.level = gameFactory.level(
            levels[name || this.levels[this.index]]
        );

        if (this.index !== this.prevIndex) {
            this.prevIndex = this.index;
            playerService.playerArray
                .sort((a, b) => a === playerService.me ? 1 : b === playerService.me ? -1 : 0)
        }

        if (this.index === this.levels.length - 1) {
            playerService.playerArray.forEach(p => {
                if (p !== playerService.me) {
                    p.drone = gameFactory.drone(0, 0, DRONE_RADIUS + 10 * (this.wins + 1));
                    p.drone.body.belongsTo = p.id;
                    p.shield.drone = p.drone;
                }
            });
        }

        webgl.reset();
        physics.reset();

        playerService.playerArray.forEach(p => {
            physics.add(p.drone.body);
            webgl.add(p.drone.object3d);
            p.color(p.drone.object3d.children[1]);
            p.nextCp = 0;
            p.cpTicks = 0;
            p.lap = 0;
            p.endTime = 0;
            gameFactory.update(p.drone);
        });

        green(this.level.cps[0].object3d);
        this.level.cps.map(getBody).forEach(physics.add);
        this.level.map.map(getBody).forEach(physics.add);

        webgl.add(this.level.container);
        webgl.light.position[2] = -10;
        webgl.camera.position.fill(0);
        webgl.camera.position[2] = CAMERA_Z;
        webgl.camera.rotation.fill(0);

        return this.level;
    }

    incLevel() {
        this.index++;
    }

    isWon() {
        return this.index >= this.levels.length;
    }

    reset(gameFactory) {
        this.index = 0;

        if (this.index === 0) {
            playerService.playerArray.forEach((p, i) => {
                if (p !== playerService.me) {
                    p.drone = gameFactory.drone(0, 0, DRONE_RADIUS + 4 * i);
                    p.drone.body.belongsTo = p.id;
                    p.shield.drone = p.drone;
                    p.specs.maxA += 1;
                }
            });
        }
    }
}

class PlayerService {
    constructor() {
        this.me = null;
        this.players = {};
        this.playerArray = [];
        this.colors = [red, blue, lila, yellow, green, dark, brightRed];
        this.t = 0;

        this.data = [8, []]; // sync
        this.commandData = [7, new Array(4)];
    }

    prepareSinglePlayer(gameFactory, view) {
        if (this.playerArray.length < 2) {
            this.players = {};
            this.players[this.me.id] = this.me;

            for (let i = 0; i < 6; i++) {
                const p = new Player(getId(), gameFactory.drone(0, 0, DRONE_RADIUS + 2 * i), autoAi(), 'Ai ' + (i + 1));
                p.color = this.colors[i];
                p.specs.maxA += 0.1 * i;
                this.add(p);
            }
        }
    }

    add(player) {
        this.players[player.id] = player;
        this.playerArray = Object.values(this.players);
        this.data[1].push(new Array(11));
    }

    remove(id) {
        if (this.players[id]) {
            delete this.players[id];
            this.playerArray = Object.values(this.players);
            this.data[1].pop();
        }
    }
}

const levelService = new LevelService();
const playerService = new PlayerService();
