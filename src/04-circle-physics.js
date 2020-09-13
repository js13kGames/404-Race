class Circle {
  constructor(x, y, r, mass, isSensor, isColliding) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = r;
    this.angle = 0;
    this.m = mass;
    this.isSensor = isSensor;
    this.isColliding = isColliding;
    this.belongsTo = '';
  }
}

class Collision {
  constructor() {
    this.a = null;
    this.b = null;
    this.dt = 0.0;
    this.isSensor = false;
  }
}

function createPhysics (minImpact, friction) {
  const collisions = [];
  let i = 0, j = 0, k = 0;

  for (i = 0; i < 1000; i++) {
    collisions.push(new Collision());
  }

  let nextCollisionIndex = 0;
  let collisionCount = 0;
  let prevCollisionCount = 0;

  const actors = [];
  const nonCollidingActors = [];
  const sensors = [];

  const move = (t, actor) => {
    actor.x += actor.vx * t;
    actor.y += actor.vy * t;
  };

  const end = actor => {
    actor.vx = actor.vx * friction;
    actor.vy = actor.vy * friction;
  };

  const testActorCollision = (a, b) => {
    const x = b.x - a.x;
    const y = b.y - a.y;
    const d2 = x*x + y*y;
    const r = a.r + b.r;
    const r2 = r * r;

    if (d2 < r2) {
      const d = sqrt(d2) || 1;
      const nx = x / d;
      const ny = y / d;

      if (b.isColliding) {
        const rHalf = ceil((r - d) / 2);

        a.x -= nx * rHalf;
        a.y -= ny * rHalf;
        b.x += nx * rHalf;
        b.y += ny * rHalf;
      } else {
        const rFull = ceil(r - d);
        a.x -= nx * rFull;
        a.y -= ny * rFull;
      }

      const collision = collisions[nextCollisionIndex];

      collision.a = a;
      collision.b = b;
      collision.dt = 0.0;
      collision.isSensor = false;

      nextCollisionIndex++;
      collisionCount++;

      return;
    }

    const dt = getCollisionTime(a, b, false);

    if (dt < 0.0 || dt > 1.0) {
      return;
    }

    const collision = collisions[nextCollisionIndex];

    collision.a = a;
    collision.b = b;
    collision.dt = dt;
    collision.isSensor = false;

    nextCollisionIndex++;
    collisionCount++;
  };

  // Sensors do not collide with sensors. They get tested only against actors;
  const testSensorCollision = (a /* actor */, b /* sensor */) => {
    const x = b.x - a.x || 1;
    const y = b.y - a.y || 1;
    const d2 = x*x + y*y;
    const r2 = b.r * b.r;

    if (d2 < r2) {
      const collision = collisions[nextCollisionIndex];

      collision.a = a;
      collision.b = b;
      collision.dt = 0;
      collision.isSensor = true;

      nextCollisionIndex++;
      collisionCount++;

      return;
    }

    const dt = getCollisionTime(a, b, true);

    if (dt < 0.0 || dt > 1.0) {
      // Collision happens this turn only if 0 <= t <= 1
      return;
    }

    const collision = collisions[nextCollisionIndex];

    collision.a = a;
    collision.b = b;
    collision.dt = dt;
    collision.isSensor = true;

    nextCollisionIndex++;
    collisionCount++;
  };

  const getCollisionTime = (a, b, isSensor) => {
    const x = b.x - a.x;
    const y = b.y - a.y;
    const vx = b.vx - a.vx;
    const vy = b.vy - a.vy;
    const d1 = vx*vx + vy*vy; // in formula "a"

    if (d1 === 0) {
      return 2.0;
    }

    const d2 = vx*x + vy*y; // in formula "b"
    const c = x*x + y*y;
    const r = isSensor ?
      (b.r - 1)*(b.r - 1) :
      (b.r + a.r)*(b.r + a.r);
    const inside = d2*d2 - d1*(c - r); // b^2 - a * (c - r)

    if (inside < 0) {
      return -2.0;
    }

    const d2Sqrt = d2;
    const square = sqrt(inside);
    const fractionA2 = 1 / d1;
    const t1 = -((square + d2Sqrt) * fractionA2);
    const t2 = ((square - d2Sqrt) * fractionA2);

    if (t1 < 0 || t2 < 0) {
      return t1 < t2 ? t2 : t1;
    }

    return t1 < t2 ? t1 : t2;
  };

  const handleCollision = ({ a, b, isSensor }) => {
    if (isSensor) {
      return;
    }

    const x = b.x - a.x;
    const y = b.y - a.y;
    const d = sqrt(x * x + y * y) || 1;
    const nx = x / d;
    const ny = y / d;

    if (!b.isColliding) {
      const r = b.r + a.r;
      a.x -= x - (nx * r) + (nx * 2);
      a.y -= y - (ny * r) + (ny * 2);
      a.vx = -a.vx;
      a.vy = -a.vy;
      return;
    }


    const ma = a.m;
    const mb = b.m;

    const vx = b.vx - a.vx;
    const vy = b.vy - a.vy;

    if (a.vx === 0 && a.vy === 0 &&
      b.vx === 0 && b.vy === 0) {
      return;
    }

    // http://www.euclideanspace.com/physics/dynamics/collision/twod/index.htm#code
    let impact = abs(2.0 * (nx*vx + ny*vy) * (ma * mb) / (ma + mb));
    if (impact < minImpact) {
      impact = minImpact;
    }

    a.vx -= nx * impact / ma;
    a.vy -= ny * impact / ma;
    b.vx += nx * impact / mb;
    b.vy += ny * impact / mb;
  };

  const getActorCollisions = t => {
    const prevCollisionCount = collisionCount;
    const actorCount = actors.length;
    let isFound = false;

    for (i = 0; i < actorCount; i++) {
      const a = actors[i];

      for (j = i + 1; j < actorCount; j++) {
        const b = actors[j];
        isFound = false;

        for (k = 0; k < collisionCount; k++) {
          if (collisions[k].a === a && collisions[k].b === b) {
            isFound = true;
            break;
          }
        }

        if (!isFound) {
          testActorCollision(a, b);
        }
      }

      for (j = 0; j < nonCollidingActors.length; j++) {
        const b = nonCollidingActors[j];
        isFound = false;

        for (k = 0; k < collisionCount; k++) {
          if (collisions[k].a === a && collisions[k].b === b) {
            isFound = true;
            break;
          }
        }

        if (!isFound) {
          testActorCollision(a, b);
        }
      }
    }

    return prevCollisionCount !== collisionCount;
  };

  const getSensorCollisions = t => {
    const prevCollisionCount = collisionCount;
    const actorCount = actors.length;
    const sensorCount = sensors.length;
    let isFound = false;

    for (i = 0; i < actorCount; i++) {
      const a = actors[i];
      for (j = 0; j < sensorCount; j++) {
        const b = sensors[j];
        isFound = false;
        for (k = 0; k < collisionCount; k++) {
          if (collisions[k].a === a && collisions[k].b === b) {
            isFound = true;
            break;
          }
        }
        if (!isFound) {
          testSensorCollision(a, b);
        }
      }
    }

    return prevCollisionCount !== collisionCount;
  };

  const step = onCollision => {
    collisionCount = 0;
    nextCollisionIndex = 0;
    let t = 0.0;

    while (t < 1.0) {
      prevCollisionCount = collisionCount;
      if (getActorCollisions(t) || getSensorCollisions(t)) {
        let earliest = collisions[prevCollisionCount]; // TODO: Should this be from the beginning?
        for (i = prevCollisionCount + 1; i < collisionCount; i++) {
          if (collisions[i].dt < earliest.dt) {
            earliest = collisions[i];
          }
        }

        const dt = earliest.dt;
        t += dt;

        for (i = prevCollisionCount; i < collisionCount; i++) {
          for (j = 0; j < actors.length; j++) {
            move(dt, actors[j]);
          }

          if (collisions[i].dt <= dt) {
            handleCollision(collisions[i]);
            onCollision(collisions[i]);
          }
        }
      } else {
        for (i = 0; i < actors.length; i++) {
          move(1.0 - t, actors[i]);
        }
        t = 1.0;
      }
    }

    for (i = 0; i < actors.length; i++) {
      end(actors[i]);
    }
  };

  return {
    isStarted: false,

    circle(x, y, r, mass, isSensor, isColliding) {
      return new Circle(x, y, r, mass, isSensor, isColliding);
    },

    step,

    add(c) {
      (c.isSensor ? sensors : c.isColliding ? actors : nonCollidingActors).push(c);
    },

    reset() {
      actors.length = 0;
      nonCollidingActors.length = 0;
      sensors.length = 0;
    }
  };
}
