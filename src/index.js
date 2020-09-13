once(window, 'load', function init() {
    const scale = 40,

        [glCanvas, debugCanvas] = document.getElementsByTagName('canvas'),
        [overlay] = document.getElementsByTagName('div'),
        [mute, restart] = document.getElementsByTagName('button'),
        [nameInput] = document.getElementsByTagName('input'),
        context2d = debugCanvas.getContext('2d'),

        // INIT

        persistent = createPersistent(APP_NAME),
        webgl = new WebGL(
            glCanvas,
            {
                position: vec3(-0, -14, -9),
                color: vec3(0.9, 0.9, 0.9)
            },
            vec3(0.2, 0.2, 0.2)
        ),
        physics = createPhysics(7.0, 0.95),
        synth = new Synth(
            persistent.get('muted') === 'true',
            isMuted => persistent.set('muted', isMuted)
        ),
        controls = new Controls(document.body, isTouch),
        gameFactory = new GameFactory(physics, webgl, scale);

    let prevTime = 0.0,
        dt = 0.0;

    // ENSURE CRITICAL FEATURES

    webgl.init();

    if (!webgl.gl) {
        overlay.innerHTML = '<section><h1>Could not launch.</h1><p>WebGL is missing.</p></section>';
        return;
    }

    webgl.camera.position[2] = CAMERA_Z;

    // UI HANDLING

    function resize() {
        const { devicePixelRatio, innerWidth, innerHeight } = window;
        controls.center[0] = innerWidth - 150;
        controls.center[1] = innerHeight - 150;

        // High pixel ratio freezes big screens.
        // And for the game jam no time to create a fallback.
        glCanvas.width = innerWidth; // * devicePixelRatio;
        glCanvas.height = innerHeight; // * devicePixelRatio;
        debugCanvas.width = innerWidth;
        debugCanvas.height = innerHeight;
        webgl.resize();
    }
    on(window, 'resize', resize);
    resize();

    restart.style.visibility = 'hidden';

    mute.innerText = synth.isMuted ? 'Unmute' : 'Mute';
    on(mute, clickEvent, e => {
        stopDead(e);
        synth.toggle();
        mute.innerText = synth.isMuted ? 'Unmute' : 'Mute';
    });

    const player = new Player(
        getId(),
        gameFactory.drone(0, 0, DRONE_RADIUS),
        isTouch ? touchAi(controls) : keyboardAi(controls),
        persistent.get('name') || 'Player'
    );
    player.color = lightGrey;
    green(player.drone.object3d.children[0]);

    monetize(() => {
        const { id, drone, shield } = player;
        drone.object3d.hidden = true;

        player.drone = gameFactory.vader404(drone.body.x, drone.body.y, DRONE_RADIUS + 10);
        player.drone.body.angle = drone.body.angle;
        player.drone.body.m = 2;
        player.drone.body.belongsTo = id;
        shield.drone = player.drone;

        webgl.add(player.drone.object3d);
        physics.add(player.drone.body);
    });

    nameInput.value = player.name;
    on(nameInput, 'change', () => {
        if (player.name === nameInput.value) {
            return;
        }
        persistent.set('name', player.name = nameInput.value);
    });
    on(nameInput, 'click', stopDead);

    playerService.add(player);
    playerService.me = player;

    const raceView = new RaceView(gameFactory, synth, viewManager, restart, controls, context2d, overlay);
    on(restart, clickEvent, raceView.reset);

    viewManager.add(new InitView());
    viewManager.add(new MainView(gameFactory, synth, viewManager, overlay));
    viewManager.add(raceView);
    viewManager.add(new CreditsView(gameFactory, viewManager, overlay));

    viewManager.push(MAIN_VIEW);
    viewManager.push(INIT_VIEW);

    function loop(t) {
        requestAnimationFrame(loop);
        dt = t - prevTime;
        prevTime = t;
        context2d.clearRect(0, 0, window.innerWidth, window.innerHeight);
        viewManager.step(dt, Date.now());
        webgl.draw();
    }

    loop(Date.now());
});
