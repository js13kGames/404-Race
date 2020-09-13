class Controls {
  constructor(target, isTouch) {
    this.target = target;
    this.isStarted = false;

    this.keys = [];
    this.isTouch = isTouch;
    this.center = new Float32Array(2);
    this.pointer = new Float32Array(2);
    this.prevPointer = new Float32Array(2);
    this.dir = new Float32Array(2);

    this.keydown = this.keydown.bind(this);
    this.keyup = this.keyup.bind(this);
    this.touch = this.touch.bind(this);
    this.touchEnd = this.touchEnd.bind(this);
  }

  keydown(e) {
    this.keys[e.keyCode] = true;
  }

  keyup(e) {
    this.keys[e.keyCode] = false;
  }

  touch(e) {
    this.isTouch = true;
    this.pointer[0] = e.changedTouches[0].clientX;
    this.pointer[1] = e.changedTouches[0].clientY;
  }

  touchEnd() {
    this.pointer[0] = this.center[0];
    this.pointer[1] = this.center[1];
  }

  start() {
    if (this.isStarted) {
      return;
    }

    this.pointer[0] = this.center[0];
    this.pointer[1] = this.center[1];

    this.isStarted = true;
    this.target.addEventListener('keydown', this.keydown);
    this.target.addEventListener("keyup", this.keyup);
    this.target.addEventListener("touchstart", this.touch, false);
    this.target.addEventListener("touchmove", this.touch, false);
    this.target.addEventListener("touchend", this.touchEnd, false);
  }

  stop() {
    if (!this.isStarted) {
      return;
    }

    this.pointer[0] = this.center[0];
    this.pointer[1] = this.center[1];

    this.isStarted = false;
    this.target.removeEventListener("keydown", this.keydown);
    this.target.removeEventListener("keyup", this.keyup);
    this.target.removeEventListener("touchstart", this.touch);
    this.target.removeEventListener("touchmove", this.touch);
    this.target.removeEventListener("touchend", this.touchEnd, false);
  }

  isChanged() {
    return this.pointer[0] !== this.prevPointer[0] || this.pointer[1] !== this.prevPointer[1];
  }

  getDir() {
    if (!this.pointer[0] && !this.pointer[1]) {
      this.prevPointer[0] = this.pointer[0];
      this.prevPointer[1] = this.pointer[1];
      this.dir[0] = 0;
      this.dir[1] = 0;
    } else if (this.isChanged()) {
      this.prevPointer[0] = this.pointer[0];
      this.prevPointer[1] = this.pointer[1];
      const x = this.pointer[0] - this.center[0];
      const y = this.pointer[1] - this.center[1];
      const d = sqrt(x*x + y*y);
      this.dir[0] = x / d;
      this.dir[1] = y / d;
    }

    return this.dir;
  }

  left() { return this.keys[37] || this.keys[65]; } // left or 'a'
  up() { return this.keys[38] || this.keys[87]; } // or 'w'
  right() { return this.keys[39] || this.keys[68]; } // or 'd'
  down() { return this.keys[40] || this.keys[83]; } // or 's'

  draw(context) {
    context.save();
    context.translate(this.center[0], this.center[1]);
    context.strokeStyle = '#fff';
    context.fillStyle = '#f00';

    this.isTouch ? this.drawTouch(context) : this.drawKeyboard(context);

    context.restore();
  }

  drawKeyboard(context) {
    context.fillRect(0, -40, 30, 30);
    context.fillRect(40, 0, 30, 30);
    context.fillRect(0, 0, 30, 30);
    context.fillRect(-40, 0, 30, 30);
  }

  drawTouch(context) {
    context.beginPath();
    context.arc(0, 0, 50, 0, PI2);
    context.closePath();
    context.fill();
    context.stroke();

    const x = this.pointer[0] - this.center[0];
    const y = this.pointer[1] - this.center[1];
    const n = Math.sqrt(x*x + y* y) || 1;

    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(x / n * 50, y / n * 50, 10, 0, PI2);
    context.closePath();
    context.fill();
  }
}

const turnDir = (angle, nx, ny) => {
  const a = (ny < 0 ? -1 : 1) * Math.acos(nx);

  const right = angle <= a ? a - angle : PI2 - angle + a;
  const left = angle >= a ? angle - a : angle + PI2 - a;

  return right < left ? right : -left;
};

const keyboardAi = controls => player => {
  const { specs } = player;
  let angle = 0, thrust = 0;

  if (controls.right()) {
    angle = specs.rotPower;
  } else if (controls.left()) {
    angle = -specs.rotPower;
  }

  if (controls.up()) {
    thrust = specs.power;
  } else if (controls.down()) {
    thrust = -specs.power;
  }

  if (angle || thrust) {
    player.commands.add(angle, thrust);
    return true;
  }

  return false;
};

const touchAi = controls => player => {
  const dir = controls.getDir(), { specs } = player,
    thrust = specs.power;
  let angle = 0;

  if (!dir[0] && !dir[1]) {
    return false;
  }

  angle = 1.2 * (turnDir(player.drone.body.angle, dir[0], dir[1]) < 0 ? -specs.rotPower : specs.rotPower);

  if (angle) {
    player.commands.add(angle, thrust);
    return true;
  }

  return false;
};

const autoAi = () => player => {
  const cpBody = levelService.level.cps[player.nextCp].body;
  const { body } = player.drone;

  const x = cpBody.x - body.x;
  const y = cpBody.y - body.y;
  const d = sqrt(x*x + y*y);

  const nx = x / d;

  let angle = turnDir(body.angle, nx, -y) < 0 ? -0.05 : 0.05,
    thrust = player.specs.power / 2;

  if (d < 100 && abs(angle > PI2 / 8)){
    thrust = 0.1;
    thrust = 0.1;
  }

  player.commands.add(angle, thrust);
};

const keepGoingAi = () => player => {
  player.drone.body.vx /= 0.95;
  player.drone.body.vy /= 0.95;
}
