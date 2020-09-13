const APP_NAME = '404Race',

    DRONE_RADIUS = 40,
    CP_RADIUS = 125,
    CAMERA_Z = -20,

    MAX_LAPS = 2,

    INIT_VIEW = 1,
    MAIN_VIEW = 2,
    RACE_VIEW = 3,
    CREDITS_VIEW = 4,

    isTouch = isTouchDevice(),
    clickEvent = isTouch ? 'touchstart' : 'click',

    brightRed = setColor(1.0, 0.2, 0.0, 1.0),
    dark = setColor(0.1, 0.1, 0.1, 1.0),
    darkGreen = setColor(0.0, 0.6, 0.0, 1.0),
    darkGrey = setColor(0.3, 0.3, 0.3, 1.0),
    lightGrey = setColor(0.8, 0.8, 0.8, 1.0),
    electricBlueTransparent = setColor(0.31, 0.573, 0.816, 0.3),
    green = setColor(0.0, 1.0, 0.0, 1.0),
    grey = setColor(0.6, 0.6, 0.6, 1.0),
    lila = setColor(0.5, 0.0, 1.0, 1.0),
    darkLila = setColor(0.25, 0.0, 0.7, 1.0),
    red = setColor(1.0, 0.0, 0.0, 1.0),
    blue = setColor(0.0, 0.0, 1.0, 1.0),
    yellow = setColor(1.0, 1.0, 0.0, 1.0),

    { PI, cos, sin, sqrt, floor, tan, ceil, abs } = Math,
    PI2 = PI * 2;
