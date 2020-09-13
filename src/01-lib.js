const getId = (() => {
    let id = 0;
    return () => ++id;
})();
const last = a => a[a.length - 1];
const resetArray = a => a.length = 0;

const on = (element, eventName, handler, options = false) => element.addEventListener(eventName, handler, options);
const off = (element, eventName, handler) => element.removeEventListener(eventName, handler);
const once = (element, eventName, handler) =>
    on(element, eventName, handler, { once: true });
const onceFn = fn => {
    let is = true;
    return () => {
        if (is) {
            is = false;
            fn();
        }
    };
};
const stopDead = e => {
    e.preventDefault();
    e.stopPropagation();
};
const vec3 = (x = 0.0, y = 0.0, z = 0.0) => new Float32Array([x, y, z]);
const vec4 = (x = 0.0, y = 0.0, z = 0.0, a = 0.0) => new Float32Array([x, y, z, a]);

const noop = () => {};
const getBody = o => o.body;

function isTouchDevice() {
    try {
        document.createEvent("TouchEvent");
        return true;
    } catch (e) {
        return false;
    }
}

const setColor = (r, g, b, a) => object3d => {
    object3d.color[0] = r;
    object3d.color[1] = g;
    object3d.color[2] = b;
    object3d.color[3] = a;
    return object3d;
};

const pointBody = (fromBody, toBody) => (player, i) => {
    const body = player.drone.body;
    const x = toBody.x - fromBody.x;
    const y = toBody.y - fromBody.y;
    const d = Math.sqrt(x * x + y * y) || 1;

    body.x = fromBody.x;
    body.y = fromBody.y;

    const nx = x / d;
    const ny = y / d;
    const angle = (y < 0 ? -1 : 1) * Math.acos(nx);

    body.x -= nx * i * 70 + ny * (Math.cos(i % 2)) * 100;
    body.y -= ny * i * 70 + nx * (Math.sin(i % 2)) * 100;

    body.angle = -angle;
};

const show = o => o.hidden = false;
const hide = o => o.hidden = true;
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const getHash = () => location.hash.split('#')[1];
