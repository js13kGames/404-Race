const CUBE = 0,
  SPHERE = 1,
  CONTAINER = 2;

const vshader = `
attribute vec4 position;
attribute vec4 color;
attribute vec4 normal;
uniform mat4 mvp;
uniform mat4 m;
uniform mat4 it;
varying vec4 v_c;
varying vec3 v_n;
varying vec3 v_p;
void main() {
gl_Position = mvp * position;
v_p = vec3(m * position);
v_n = normalize(vec3(it * normal));
v_c = color;
}`;

const fshader = `
precision mediump float;
uniform vec3 a;
uniform vec3 b;
uniform vec3 c;
varying vec3 v_n;
varying vec3 v_p;
varying vec4 v_c;
void main() {
vec3 lightDirection = normalize(b - v_p);
float nDotL = max(dot(lightDirection, v_n), 0.0);
vec3 diffuse = a * v_c.rgb * nDotL;
vec3 ambient = c * v_c.rgb;
gl_FragColor = vec4(diffuse + ambient, v_c.a);
}`;

class Object3D {
  constructor(position, scale, rotation, transparent, type) {
    this.position = position;
    this.scale = scale;
    this.rotation = rotation;
    this.hidden = false;
    this.transparent = transparent;
    this.type = type;

    this.parent = null;
    this.children = [];

    this.color = vec4(1.0, 0.0, 0.0, 1.0);

    this.mMatrix = identity();
    this.inverseMatrix = identity();
    this.mvpMatrix = identity();
    this.transposeMatrix = identity();
    this.worldMatrix = identity();
  }

  setParent(parent) {
    if (this.parent) {
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
    }

    this.parent = parent;
    this.parent.children.push(this);
  }

  removeParent() {
    if (this.parent) {
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
    }

    this.parent = null;
  }

  updateTransforms() {
    transformMut(identityfy(this.mMatrix), this.position, this.scale, this.rotation);

    this.parent ?
      multMat4Mat4(this.parent.worldMatrix, this.mMatrix, this.worldMatrix) :
      this.worldMatrix.set(this.mMatrix);

    for (let i = 0; i < this.children.length; i++) {
      this.children[i].updateTransforms();
    }
  }
}

// Camera is the lens to the world and the world container.
// When camera moves it actually moves all the objects in the world
// and camera itself stays still;
class Camera extends Object3D {
  constructor(position, scale, rotation) {
    super(position, scale, rotation, false, CONTAINER);

    this.perspectiveMatrix = null;
    this.resize();
  }

  resize() {
    this.perspectiveMatrix = perspective({
      fov: 50 / 180 * PI,
      aspect: window.innerWidth / window.innerHeight,
      near: 1,
      far: 100,
    });
  }
}

const create = type => (
  position = vec3(),
  scale = vec3(1, 1, 1),
  rotation = vec3(),
  transparent = false
) => new Object3D(position, scale, rotation, transparent, type);

class WebGL {
  constructor(canvas, light, ambientColor) {
    this.canvas = canvas;
    this.shapes = [cube(), sphere(16)];
    this.object3ds = [[], []]; // cubes, spheres
    this.transparents = [[], []]; // cubes, spheres
    this.indicesCount = 0;

    this.camera = new Camera(
      vec3(0, 0, 0),
      vec3(1.0, 1.0, 1.0),
      vec3()
    );
    this.camera.updateTransforms();

    this.light = light;
    this.ambientColor = ambientColor;

    this.gl = this.canvas.getContext("webgl");
    this.program = null;
    this.attribs = null;
    this.uniforms = null;
    this.buffers = null;

    this.aLocation = null;
    this.bLocation = null;
    this.cLocation = null;

    // Object3D creation functions
    this.cube = create(CUBE);
    this.sphere = create(SPHERE);
    this.container = create(CONTAINER);

    this.add = this.add.bind(this);
    this.drawOne = this.drawOne.bind(this);
    this.drawShapes = this.drawShapes.bind(this);
  }

  init() {
    const { gl } = this;
    const program = this.program = compile(gl, vshader, fshader);

    this.attribs = {
      position: gl.getAttribLocation(program, "position"),
      normal: gl.getAttribLocation(program, "normal"),
      color: gl.getAttribLocation(program, "color")
    };
    this.uniforms = {
      m: gl.getUniformLocation(program, "m"),
      mvp: gl.getUniformLocation(program, "mvp"),
      it: gl.getUniformLocation(program, "it")
    };
    this.buffers = {
        positions: buffer(gl, this.shapes[0][0], this.attribs.position, 3, gl.FLOAT),
        normals: buffer(gl, this.shapes[0][1], this.attribs.normal, 3, gl.FLOAT),
        indices: gl.createBuffer(),
    };

    gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.aLocation = gl.getUniformLocation(program, "a");
    this.bLocation = gl.getUniformLocation(program, "b");
    this.cLocation = gl.getUniformLocation(program, "c");

    this.gl.uniform3fv(this.cLocation, this.ambientColor);
  }

  add(object3d) {
    const { transparent, type } = object3d;

    if (type !== CONTAINER) {
      (transparent ? this.transparents[type] : this.object3ds[type]).push(object3d);
    }

    if (!object3d.parent) {
      object3d.setParent(this.camera);
    }

    object3d.children.forEach(this.add);
    return object3d;
  }

  bindBuffer([vertices, normals, indices]) {
    const { gl } = this;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.positions);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(this.attribs.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normals);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    gl.vertexAttribPointer(this.attribs.normal, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this.indicesCount = indices.length;
  }

  drawOne({
    worldMatrix,
    mvpMatrix,
    inverseMatrix,
    transposeMatrix,
    color,
    hidden,
    type
  } /* Object3D */ ) {
    if (hidden) {
      return;
    }

    const { gl } = this;
    gl.uniformMatrix4fv(this.uniforms.m, false, worldMatrix);
    gl.vertexAttrib4fv(this.attribs.color, color);
    gl.uniformMatrix4fv(this.uniforms.mvp, false, multMat4Mat4(this.camera.perspectiveMatrix, worldMatrix, mvpMatrix));
    gl.uniformMatrix4fv(this.uniforms.it, false, transpose(inverse(worldMatrix, inverseMatrix), transposeMatrix));
    gl.drawElements(gl.TRIANGLES, this.indicesCount, gl.UNSIGNED_SHORT, 0);
  }

  drawShapes(object3ds, index) {
    if (!object3ds || !object3ds.length) {
      return;
    }

    this.bindBuffer(this.shapes[index]);
    object3ds.forEach(this.drawOne);
  }

  draw() {
    this.gl.uniform3fv(this.aLocation, this.light.color);
    this.gl.uniform3fv(this.bLocation, this.light.position);

    this.gl.enable(this.gl.BLEND); // Enable alpha blending
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.object3ds.forEach(this.drawShapes);

    this.gl.disable(this.gl.DEPTH_TEST);
    this.transparents.forEach(this.drawShapes);
    this.gl.enable(this.gl.DEPTH_TEST);
  }

  reset() {
    this.object3ds.forEach(resetArray);
    this.transparents.forEach(resetArray);
  }

  resize() {
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.camera.resize();
    this.camera.updateTransforms();
  }
}

////////////////
// js
///////////////

function compile (gl, vshader, fshader) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vshader);
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fshader);
    gl.compileShader(fs);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);
    // console.log('vertex shader:', gl.getShaderInfoLog(vs) || 'OK');
    // console.log('fragment shader:', gl.getShaderInfoLog(fs) || 'OK');
    // console.log('program:', gl.getProgramInfoLog(program) || 'OK');
    return program;
}

function buffer (gl, data, attribute, size, type) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.vertexAttribPointer(attribute, size, type, false, 0, 0);
    gl.enableVertexAttribArray(attribute);
    return buf
}

//////////////
// matrix.js
//////////////

function identity () {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
};

function identityfy (mat) {
  mat.fill(0.0);
  mat[0] = mat[5] = mat[10] = mat[15] = 1.0;
  return mat;
}

function multMat4Mat4 (a, b, out /* out new Float32Array(16) */) {
    let i, ai0, ai1, ai2, ai3;

    for (i = 0; i < 4; i++) {
        ai0 = a[i];
        ai1 = a[i + 4];
        ai2 = a[i + 8];
        ai3 = a[i + 12];
        out[i] = ai0 * b[0] + ai1 * b[1] + ai2 * b[2] + ai3 * b[3];
        out[i + 4] = ai0 * b[4] + ai1 * b[5] + ai2 * b[6] + ai3 * b[7];
        out[i + 8] = ai0 * b[8] + ai1 * b[9] + ai2 * b[10] + ai3 * b[11];
        out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
    }

    return out;
};

function perspective (options) {
    const {near, far, fov, aspect} = options;
    const f = 1.0 / tan(fov);
    const nf = 1.0 / (near - far);
    return new Float32Array([
        f / aspect, 0.0, 0.0, 0.0,
        0.0, f, 0.0, 0.0,
        0.0, 0.0, (far + near) * nf, -1.0,
        0.0, 0.0, (2.0 * near * far) * nf, 0.0
    ]);
}

const tmp = new Float32Array(16);
function transformMut(out /* Mat4 */, [x, y, z], [sx, sy, sz], [rx, ry, rz]) {
    // translate
    if (x || y || z) {
        out[12] += out[0] * x + out[4] * y + out[8] * z;
        out[13] += out[1] * x + out[5] * y + out[9] * z;
        out[14] += out[2] * x + out[6] * y + out[10] * z;
        out[15] += out[3] * x + out[7] * y + out[11] * z;
    }


    // Rotate
    if (rx) {
      tmp.fill(0.0);
      tmp[0] = 1;
      tmp[10] = tmp[5] = cos(rx);
      tmp[6] = sin(rx);
      tmp[9] = -tmp[6];
      tmp[15] = 1;
      multMat4Mat4(out, tmp, out);
    }

    if (ry) {
      tmp.fill(0.0);
      tmp[0] = cos(ry);
      tmp[8] = sin(ry)
      tmp[5] = 1;
      tmp[2] = -tmp[8];
      tmp[10] = tmp[0];
      tmp[15] = 1;
      multMat4Mat4(out, tmp, out);
    }

    if (rz) {
      tmp.fill(0.0);
      tmp[0] = cos(rz);
      tmp[1] = sin(rz);
      tmp[4] = -tmp[1];
      tmp[5] = tmp[0];
      tmp[10] = 1;
      tmp[15] = 1;
      multMat4Mat4(out, tmp, out);
    }

    // Scale
    if (sx !== 1) {
        out[0] *= sx;
        out[1] *= sx;
        out[2] *= sx;
        out[3] *= sx;
    }

    if (sy !== 1) {
        out[4] *= sy;
        out[5] *= sy;
        out[6] *= sy;
        out[7] *= sy;
    }

    if (sz !== 1) {
        out[8] *= sz;
        out[9] *= sz;
        out[10] *= sz;
        out[11] *= sz;
    }

    return out;
};

function transpose (m /* Mat4 */, out, /* Mat4 */) {
    for (let i = 0, j = 0; i < m.length; i += 4) {
      out[i] = m[j]
      out[i + 1] = m[j + 4]
      out[i + 2] = m[j + 8]
      out[i + 3] = m[j + 12]
      j++;
    }

    return out;
};

function inverse (m /* Mat4 */, out /* Mat4 */) {
    out[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    out[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    out[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    out[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    out[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    out[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    out[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    out[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    out[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    out[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    out[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    out[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    out[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    out[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    out[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    out[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];

    let det = m[0] * out[0] + m[1] * out[4] + m[2] * out[8] + m[3] * out[12];

    if (!det) return m;

    det = 1 / det;
    for (let i = 0; i < 16; i++) out[i] *= det;

    return out;
}

// Declare a cube (2x2x2)
// Returns [vertices (Float32Array), normals (Float32Array), indices (Uint16Array)]
//
//    v6----- v5
//   /|      /|
//  v1------v0|
//  | |     | |
//  | |v7---|-|v4
//  |/      |/
//  v2------v3
// source: https://xem.github.io/articles/webgl-guide.html
function cube () {
    const vertices = new Float32Array([
        1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, // front
        1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, // right
        1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1, // up
        -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, // left
        -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, // down
        1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1  // back
    ]);

    const normals = new Float32Array([
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,  // front
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,  // right
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,  // up
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,  // left
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,  // down
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1   // back
    ]);

    const indices = new Uint16Array([
        0, 1, 2, 0, 2, 3,  // front
        4, 5, 6, 4, 6, 7,  // right
        8, 9, 10, 8, 10, 11, // up
        12, 13, 14, 12, 14, 15, // left
        16, 17, 18, 16, 18, 19, // down
        20, 21, 22, 20, 22, 23  // back
    ]);

    return [vertices, normals, indices];
};

// source: https://xem.github.io/articles/webgl-guide.html
function sphere(precision = 25) {
  let i, ai, si, ci, j, aj, sj, cj, p1, p2, positions = [], indices = [];

  for (j = 0; j <= precision; j++) {
    aj = j * PI / precision;
    sj = sin(aj);
    cj = cos(aj);

    for (i = 0; i <= precision; i++) {
      ai = i * 2 * PI / precision;
      si = sin(ai);
      ci = cos(ai);

      positions.push(si * sj, cj, ci * sj);  // x, y, z
    }
  }

  for (j = 0; j < precision; j++) {
    for (i = 0; i < precision; i++) {
      p1 = j * (precision + 1) + i;
      p2 = p1 + (precision + 1);

      indices.push(
        p1, p2, p1 + 1, // x, y, z
        p1 + 1, p2, p2 + 1 // x, y, z
      );
    }
  }

  return [new Float32Array(positions), new Float32Array(positions), new Uint16Array(indices)];
}
