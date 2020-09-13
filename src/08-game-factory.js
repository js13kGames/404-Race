class BodyObject3D {
    constructor(body, object3d) {
        this.id = getId();
        this.body = body;
        this.object3d = object3d;
    }

    update(scale) {
        const { x, y, angle } = this.body;
        this.object3d.position[0] = x / scale;
        this.object3d.position[1] = y / scale;
        this.object3d.rotation[2] = -angle;
    }
}

class GameFactory {
    constructor(physics, webgl, scale) {
        this.physics = physics;
        this.webgl = webgl;
        this.scale = scale;
        this.dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];

        this.update = this.update.bind(this);
    }

    update(bodyObject3d) {
        bodyObject3d.update(this.scale);
    }

    hill(x, y, r) {
        const d = r / this.scale * 1.01;
        return new BodyObject3D(
            this.physics.circle(x, y, r, 100, false, false),
            this.webgl.sphere(vec3(0, 0, 0), vec3(d, d, d / 2))
        );
    }

    checkpoint(x, y, i) {
        const d = CP_RADIUS / this.scale;
        const bo = new BodyObject3D(
            this.physics.circle(x, y, CP_RADIUS, 1, true, false),
            this.webgl.sphere(vec3(0, 0, 0), vec3(d, d, d / 10))
        );
        bo.body.belongsTo = i;
        return bo;
    }

    drone(x, y, r) {
        const d = r / this.scale;
        const angle = PI / 3;
        const c = cos(angle);
        const w = d * c;
        const h = d * (1.0 - c);

        const container = this.webgl.container();
        const eye = grey(this.webgl.sphere(vec3(w, 0, d / 3 * 2), vec3(d / 5, d / 15 * 2, d / 10)));
        const head = this.webgl.sphere(vec3(0, 0, h / 2), vec3(w + w, h, d / 4));
        const wing1 = this.webgl.cube(vec3(0, h, h), vec3(h, h / 4, d / 8), vec3(0, PI / 4, -PI / 4));
        const wing2 = this.webgl.cube(vec3(0, -h, h), vec3(h, h / 4, d / 8), vec3(0, PI / 4, PI / 4));
        const shield = electricBlueTransparent(this.webgl.sphere(vec3(), vec3(d, d, d), vec3(), true));

        head.setParent(container);
        eye.setParent(container);
        wing1.setParent(container);
        wing2.setParent(container);
        shield.setParent(container);

        container.children.forEach(grey);

        brightRed(eye);
        electricBlueTransparent(shield);

        shield.hidden = true;

        return new BodyObject3D(
            this.physics.circle(x, y, r, 1, false, true),
            container
        );
    }

    rainbow(h, w, d) {
        const container = this.webgl.container();
        const r = red(this.webgl.cube(vec3(0, 0, 0), vec3(w, h, d)));
        const g = green(this.webgl.cube(vec3(h / 3, 0, 0), vec3(w, h, d)));
        const y = yellow(this.webgl.cube(vec3(h / 3 * 2, 0, 0), vec3(w, h, d)));

        r.setParent(container);
        g.setParent(container);
        y.setParent(container);

        return container;
    }

    vader404(x, y, r) {
        const d = r / this.scale;
        const angle = PI / 3;
        const c = cos(angle);
        const w = d * c;
        const h = d * (1.0 - c);

        const container = this.webgl.container();

        const pit = darkGrey(this.webgl.sphere(vec3(0, 0, d / 3 * 2), vec3(h, h, h)));
        const eye = red(this.webgl.sphere(vec3(h / 2, 0, d / 3 * 2 + h), vec3(d / 5, d / 15 * 2, d / 10)));
        const wing1 = dark(this.webgl.cube(vec3(0, -h, d), vec3(w / 3 * 4, h / 3, w / 3 * 4)));
        const wing2 = dark(this.webgl.cube(vec3(0, h, d), vec3(w / 3 * 4, h / 3, w / 3 * 4)));
        const shield = electricBlueTransparent(this.webgl.sphere(vec3(), vec3(d, d, d), vec3(), true));

        pit.setParent(container);
        eye.setParent(container);
        wing1.setParent(container);
        wing2.setParent(container);
        shield.setParent(container);

        shield.hidden = true;

        return new BodyObject3D(
            this.physics.circle(x, y, r, 1, false, true),
            container
        );
    }

    level({ hills, checkpoints, others = [], colors }) {
        const { ground, hill, other } = colors;
        const { webgl } = this;

        const container = webgl.container();
        const setContainer = o => o.setParent(container);

        const map = hills
            .map(([x, y, r]) => this.hill(x, y, r));

        map
            .map(o => hill(o.object3d))
            .map(setContainer);

        map.map(this.update);

        const cps = checkpoints
            .map(([hillIndex, dirIndex], i) =>
                this.checkpoint(
                    hills[hillIndex][0] + this.dirs[dirIndex][0] * (hills[hillIndex][2] + 200),
                    hills[hillIndex][1] + this.dirs[dirIndex][1] * (hills[hillIndex][2] + 200),
                    i
                )
            );

        cps
            .map(o => darkLila(o.object3d))
            .map(setContainer)

        cps.forEach(this.update);

        const os = others
            .map(([x, y, z, w, h, d]) => webgl.cube(vec3(x, y, z), vec3(w, h, d)))
            .map(other);
        os.forEach(setContainer);

        const g = ground(webgl.cube(vec3(0, 0, -2), vec3(5000, 5000, 1)));
        g.setParent(container);

        const finishLineContainer = webgl.container(vec3(
            cps[0].object3d.position[0],
            cps[0].object3d.position[1],
            -0.05
        ));
        const finishLine = dark(webgl.cube(
            vec3(0, 0, 0),
            vec3(1, 10, 0.1)
        ));
        finishLine.setParent(finishLineContainer);
        finishLineContainer.setParent(container);

        const lights = [
            webgl.sphere(vec3(-8, 12, 3), vec3(3, 3, 1)),
            webgl.sphere(vec3(0, 12, 3), vec3(3, 3, 1)),
            webgl.sphere(vec3(8, 12, 3), vec3(3, 3, 1))
        ];

        lights.forEach(o => o.setParent(finishLineContainer));

        return {
            container,
            cps,
            finishLine,
            ground: g,
            lights,
            map
        };
    }

    digit(enabled, sx = 1, sy = 1, sz = 1, color = red) {
        const container = this.webgl.container();

        [
            [0.0, 3.0, 0, 3, 1, 1],
            [-1.5, 1.5, 0, 1, 3, 1],
            [1.5, 1.5, 0, 1, 3, 1],
            [0.0, 0.0, 0, 3, 1, 1],
            [-1.5, -1.5, 0, 1, 3, 1],
            [1.5, -1.5, 0, 1, 3, 1],
            [0.0, -3.0, 0, 3, 1, 1],
        ]
            .map(d => [
                vec3(
                    d[0] * sx,
                    d[1] * sy,
                    d[2] * sz
                ),
                vec3(
                    d[3] * sx,
                    d[4] * sy,
                    d[5] * sz
                )
            ])
            .filter((d, i) => enabled[i])
            .map(d => color(this.webgl.cube(d[0], d[1])))
            .forEach(o => o.setParent(container));

        return container;
    };

    zero(w, h, d, color) { return this.digit([1, 1, 1, 0, 1, 1, 1], w, h, d, color); }
    // createOne = (w, h, d, color) { return this.digit([0,0,1,0,0,1,0], w, h, d, color); }
    // createTwo = (w, h, d, color) { return this.digit([1,0,1,1,1,1,0], w, h, d, color); }
    // createThree = (w, h, d, color) { return this.digit([1,0,1,1,0,1,1], w, h, d, color); }
    four(w, h, d, color) { return this.digit([0, 1, 1, 1, 0, 1, 0], w, h, d, color); }
}
