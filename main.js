'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let point;
let texturePoint;
let rotateValue;

let backgroundSurface;
let texture;
let video;
let track;
let videoTexture;
let virtualCamera;

function StereoCamera(
  Convergence,
  EyeSeparation,
  AspectRatio,
  FOV,
  NearClippingDistance,
  FarClippingDistance
) {
  this.mConvergence = Convergence;
  this.mEyeSeparation = EyeSeparation;
  this.mAspectRatio = AspectRatio;
  this.mFOV = FOV;
  this.mNearClippingDistance = NearClippingDistance;
  this.mFarClippingDistance = FarClippingDistance;

  this.mProjectionMatrix = null;
  this.mModelViewMatrix = null;

  this.ApplyLeftFrustum = function() {
    let top, bottom, left, right;
    top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
    bottom = -top;

    let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
    let b = a - this.mEyeSeparation / 2;
    let c = a + this.mEyeSeparation / 2;

    left = (-b * this.mNearClippingDistance) / this.mConvergence;
    right = (c * this.mNearClippingDistance) / this.mConvergence;

    // Set the Projection Matrix
    this.mProjectionMatrix = m4.frustum(
      left,
      right,
      bottom,
      top,
      this.mNearClippingDistance,
      this.mFarClippingDistance
    );

    // Displace the world to right
    this.mModelViewMatrix = m4.translation(
      this.mEyeSeparation / 2,
      0.0,
      0.0
    );
  };

  this.ApplyRightFrustum = function() {
    let top, bottom, left, right;
    top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
    bottom = -top;

    let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
    let b = a - this.mEyeSeparation / 2;
    let c = a + this.mEyeSeparation / 2;

    left = (-c * this.mNearClippingDistance) / this.mConvergence;
    right = (b * this.mNearClippingDistance) / this.mConvergence;

    // Set the Projection Matrix
    this.mProjectionMatrix = m4.frustum(
      left,
      right,
      bottom,
      top,
      this.mNearClippingDistance,
      this.mFarClippingDistance
    );

    // Displace the world to left
    this.mModelViewMatrix = m4.translation(
      -this.mEyeSeparation / 2,
      0.0,
      0.0
    );
  };

  this.updateValues = function() {
    let inputs = document.getElementsByClassName("setValue");
    let spans = document.getElementsByClassName("currentValue");
    let eyeSep = 70.0;
    eyeSep = inputs[0].value;
    spans[0].innerHTML = eyeSep;
    this.mEyeSeparation = eyeSep;
    let ratio = 1.0;
    let fov = 0.8;
    fov = inputs[1].value;
    spans[1].innerHTML = fov;
    this.mFOV = fov;
    let nearClip = 5.0;
    nearClip = inputs[2].value - 0.0;
    spans[2].innerHTML = nearClip;
    this.mNearClippingDistance = nearClip
    let convergence = 2000.0;
    convergence = inputs[3].value;
    spans[3].innerHTML = convergence;
    this.mConvergence = convergence
  }
}

function getWebcam() {
  navigator.getUserMedia({ video: true, audio: false }, function(stream) {
    video.srcObject = stream;
    track = stream.getTracks()[0];
  }, function(e) {
    console.error('Rejected!', e);
  });
}

function CreateWebCamTexture() {
  videoTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function deg2rad(angle) {
  return angle * Math.PI / 180;
}


// Constructor
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iTextureBuffer = gl.createBuffer();
  this.count = 0;
  this.countText = 0;

  this.BufferData = function(vertices) {

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

    this.count = vertices.length / 3;
  }

  this.TextureBufferData = function(normals) {

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STREAM_DRAW);

    this.countText = normals.length / 2;
  }

  this.Draw = function() {

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
    gl.vertexAttribPointer(shProgram.iAttribTexture, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribTexture);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
  }

  this.DisplayPoint = function() {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);
    gl.drawArrays(gl.LINE_STRIP, 0, this.count);
  }
}

function CreateSphereSurface(r = 0.1) {
  let vertexList = [];
  let lon = -Math.PI;
  let lat = -Math.PI * 0.5;
  while (lon < Math.PI) {
    while (lat < Math.PI * 0.5) {
      let v1 = sphereSurfaceDate(r, lon, lat);
      vertexList.push(v1.x, v1.y, v1.z);
      lat += 0.05;
    }
    lat = -Math.PI * 0.5
    lon += 0.05;
  }
  return vertexList;
}

function sphereSurfaceDate(r, u, v) {
  let x = r * Math.sin(u) * Math.cos(v);
  let y = r * Math.sin(u) * Math.sin(v);
  let z = r * Math.cos(u);
  return { x: x, y: y, z: z };
}


// Constructor
function ShaderProgram(name, program) {

  this.name = name;
  this.prog = program;

  // Location of the attribute variable in the shader program.
  this.iAttribVertex = -1;
  this.iAttribTexture = -1;
  // Location of the uniform matrix representing the combined transformation.
  this.iModelViewProjectionMatrix = -1;

  this.iTranslatePoint = -1;
  this.iTexturePoint = -1;
  this.iRotateValue = -1;
  this.iTMU = -1;

  this.Use = function() {
    gl.useProgram(this.prog);
  }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  virtualCamera.updateValues();

  /* Set the values of the projection transformation */
  let projection = m4.perspective(Math.PI / 8, 1, 8, 12);

  /* Get the view matrix from the SimpleRotator object.*/
  let modelView = spaceball.getViewMatrix();
  let modelView0 = m4.identity();
  let rotationMat = getRotationMatrix();

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let rotateToPointZero0 = m4.axisRotation([0.707, 0.707, 0], 0.0);
  let translateToPointZero = m4.translation(0, 0, -10);
  let translateToPointZero0 = m4.translation(-0.5, -0.5, -10);

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum00 = m4.multiply(rotateToPointZero0, modelView0);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);
  let matAccum10 = m4.multiply(translateToPointZero0, matAccum00);

  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, m4.multiply(m4.scaling(4, 4, 1), matAccum10));
  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);

  gl.uniform1i(shProgram.iTMU, 0);
  gl.enable(gl.TEXTURE_2D);
  // gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, m4.multiply(matAccum1, rotationMat));
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform2fv(shProgram.iTexturePoint, [texturePoint.x, texturePoint.y]);
  gl.uniform1f(shProgram.iRotateValue, rotateValue);
  virtualCamera.ApplyLeftFrustum()
  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, virtualCamera.mProjectionMatrix);
  gl.colorMask(false, true, true, false);
  surface.Draw();

  gl.clear(gl.DEPTH_BUFFER_BIT);

  virtualCamera.ApplyRightFrustum()
  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, virtualCamera.mProjectionMatrix);
  gl.colorMask(true, false, false, false);
  surface.Draw();
  gl.colorMask(true, true, true, true);
  // let tr = Cornucopia(map(texturePoint.x, 0, 1, 0, Math.PI * 2), map(texturePoint.y, 0, 1, 0, Math.PI * 2))
  let tr = rotateVector();
  gl.uniform3fv(shProgram.iTranslatePoint, [tr[0], tr[1], tr[2]]);
  gl.uniform1f(shProgram.iRotateValue, 1100);
  if (panner) {
    panner.setPosition(tr[0], tr[1], tr[2])
  }
  point.DisplayPoint();

}

function drawDraw() {
  draw()
  window.requestAnimationFrame(drawDraw)
}

function CreateSurfaceData() {
  let vertexList = [];

  let u = 0;
  let v = 0;
  let uMax = Math.PI * 2
  let vMax = Math.PI * 2
  let uStep = uMax / 50;
  let vStep = vMax / 50;

  for (let u = 0; u <= uMax; u += uStep) {
    for (let v = 0; v <= vMax; v += vStep) {
      let vert = Cornucopia(u, v)
      let avert = Cornucopia(u + uStep, v)
      let bvert = Cornucopia(u, v + vStep)
      let cvert = Cornucopia(u + uStep, v + vStep)

      vertexList.push(vert.x, vert.y, vert.z)
      vertexList.push(avert.x, avert.y, avert.z)
      vertexList.push(bvert.x, bvert.y, bvert.z)

      vertexList.push(avert.x, avert.y, avert.z)
      vertexList.push(cvert.x, cvert.y, cvert.z)
      vertexList.push(bvert.x, bvert.y, bvert.z)
    }
  }

  return vertexList;
}

function CreateTexture() {
  let texture = [];

  let u = 0;
  let v = 0;
  let uMax = Math.PI * 2
  let vMax = Math.PI * 2
  let uStep = uMax / 50;
  let vStep = vMax / 50;

  for (let u = 0; u <= uMax; u += uStep) {
    for (let v = 0; v <= vMax; v += vStep) {
      let u1 = map(u, 0, uMax, 0, 1)
      let v1 = map(v, 0, vMax, 0, 1)
      texture.push(u1, v1)
      u1 = map(u + uStep, 0, uMax, 0, 1)
      texture.push(u1, v1)
      u1 = map(u, 0, uMax, 0, 1)
      v1 = map(v + vStep, 0, vMax, 0, 1)
      texture.push(u1, v1)
      u1 = map(u + uStep, 0, uMax, 0, 1)
      v1 = map(v, 0, vMax, 0, 1)
      texture.push(u1, v1)
      v1 = map(v + vStep, 0, vMax, 0, 1)
      texture.push(u1, v1)
      u1 = map(u, 0, uMax, 0, 1)
      v1 = map(v + vStep, 0, vMax, 0, 1)
      texture.push(u1, v1)
    }
  }

  return texture;
}

function map(val, f1, t1, f2, t2) {
  let m;
  m = (val - f1) * (t2 - f2) / (t1 - f1) + f2
  return Math.min(Math.max(m, f2), t2);
}

function Cornucopia(u, v) {
  const k = 0.25
  const p = 0.15
  const m = 0.1
  let x = (Math.E ** (m * u) + Math.E ** (p * u) * Math.cos(v)) * Math.cos(u)
  let y = (Math.E ** (m * u) + Math.E ** (p * u) * Math.cos(v)) * Math.sin(u)
  let z = Math.E ** (p * u) * Math.sin(v)
  return { x: x * k, y: y * k, z: z * k }
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram('Basic', prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iAttribTexture = gl.getAttribLocation(prog, "texture");
  shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
  shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
  shProgram.iTranslatePoint = gl.getUniformLocation(prog, 'translatePoint');
  shProgram.iTexturePoint = gl.getUniformLocation(prog, 'texturePoint');
  shProgram.iRotateValue = gl.getUniformLocation(prog, 'rotateValue');
  shProgram.iTMU = gl.getUniformLocation(prog, 'tmu');

  virtualCamera = new StereoCamera(
    2000,
    70.0,
    1,
    0.8,
    5,
    100
  )

  surface = new Model('Surface');
  surface.BufferData(CreateSurfaceData());
  LoadTexture()
  surface.TextureBufferData(CreateTexture());
  point = new Model('Point');
  point.BufferData(CreateSphereSurface())

  gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
  }
  return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
  texturePoint = { x: 0.5, y: 0.5 }
  rotateValue = 0.0;
  let canvas;
  try {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
      throw "Browser does not support WebGL";
    }
  }
  catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not get a WebGL graphics context.</p>";
    return;
  }
  try {
    initGL();  // initialize the WebGL graphics context
  }
  catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);
  startAudio()
  drawDraw()
}

function LoadTexture() {
  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const image = new Image();
  image.crossOrigin = 'anonymus';


  image.src = "https://raw.githubusercontent.com/dmtiriyy/WEBGLLABWORKS/CGW/image_texture.jpg";
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );
    console.log("imageLoaded")
    draw()
  }
}

function mat4Transpose(a, transposed) {
  var t = 0;
  for (var i = 0; i < 4; ++i) {
    for (var j = 0; j < 4; ++j) {
      transposed[t++] = a[j * 4 + i];
    }
  }
}

function mat4Invert(m, inverse) {
  var inv = new Float32Array(16);
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] +
    m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] -
    m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] +
    m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] -
    m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] -
    m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] +
    m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] -
    m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] +
    m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] +
    m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] -
    m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] +
    m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] -
    m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] -
    m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] +
    m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] -
    m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] +
    m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];

  var det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  if (det == 0) return false;
  det = 1.0 / det;
  for (var i = 0; i < 16; i++) inverse[i] = inv[i] * det;
  return true;
}
let alpha = 0, beta = 0, gamma = 0
function requestDeviceOrientation() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(response => {
        console.log(response);
        if (response === 'granted') {
          console.log('Permission granted');
          window.addEventListener('deviceorientation', e => {
            alpha = deg2rad(e.alpha)
            beta = deg2rad(e.beta)
            gamma = deg2rad(e.gamma)
          }, true);
        }
      }).catch((err => {
        console.log('Err', err);
      }));
  } else
    console.log('not iOS');
}

function getRotationMatrix() {

  var _x = beta; // beta value
  var _y = gamma; // gamma value
  var _z = alpha; // alpha value

  var cX = Math.cos(_x);
  var cY = Math.cos(_y);
  var cZ = Math.cos(_z);
  var sX = Math.sin(_x);
  var sY = Math.sin(_y);
  var sZ = Math.sin(_z);

  //
  // ZXY rotation matrix construction.
  //

  var m11 = cZ * cY - sZ * sX * sY;
  var m12 = - cX * sZ;
  var m13 = cY * sZ * sX + cZ * sY;

  var m21 = cY * sZ + cZ * sX * sY;
  var m22 = cZ * cX;
  var m23 = sZ * sY - cZ * cY * sX;

  var m31 = - cX * sY;
  var m32 = sX;
  var m33 = cX * cY;

  return [
    m11, m12, m13, 0,
    m21, m22, m23, 0,
    m31, m32, m33, 0,
    0, 0, 0, 1
  ];

};

var audio = null;
var audioContext;
var source;
var panner;
var filter;

function AudioSetup() {
  audio = document.getElementById('audio');

  audio.addEventListener('play', () => {
    console.log('play');
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      source = audioContext.createMediaElementSource(audio);
      panner = audioContext.createPanner();
      filter = audioContext.createBiquadFilter();

      // Connect audio nodes
      source.connect(panner);
      panner.connect(filter);
      filter.connect(audioContext.destination);

      // highshelf filter parameters
      filter.type = 'lowpass';
      filter.Q.value = 1;
      filter.frequency.value = 1000;
      filter.gain.value = 15;
      audioContext.resume();
    }
  })


  audio.addEventListener('pause', () => {
    console.log('pause');
    audioContext.resume();
  })
}

function startAudio() {
  AudioSetup();

  let filterCheckbox = document.getElementById('filterCheckbox');
  filterCheckbox.addEventListener('change', function() {
    if (filterCheckbox.checked) {
      // Connect filter when checkbox is checked
      panner.disconnect();
      panner.connect(filter);
      filter.connect(audioContext.destination);
    } else {
      // Disconnect filter when checkbox is unchecked
      panner.disconnect();
      panner.connect(audioContext.destination);
    }
  });

  audio.play();
}

function rotateVector() {
  const alphaRad = beta;
  const betaRad = gamma;
  const gammaRad = alpha;

  // Define the initial vector along the x-axis
  let vector = [0, 0, 1];

  // Rotation around the z-axis (gamma)
  const rotZ = [
    [Math.cos(gammaRad), -Math.sin(gammaRad), 0],
    [Math.sin(gammaRad), Math.cos(gammaRad), 0],
    [0, 0, 1]
  ];
  vector = multiplyMatrixVector(rotZ, vector);

  // Rotation around the y-axis (beta)
  const rotY = [
    [Math.cos(betaRad), 0, Math.sin(betaRad)],
    [0, 1, 0],
    [-Math.sin(betaRad), 0, Math.cos(betaRad)]
  ];
  vector = multiplyMatrixVector(rotY, vector);

  // Rotation around the x-axis (alpha)
  const rotX = [
    [1, 0, 0],
    [0, Math.cos(alphaRad), -Math.sin(alphaRad)],
    [0, Math.sin(alphaRad), Math.cos(alphaRad)]
  ];
  vector = multiplyMatrixVector(rotX, vector);

  return vector;
}

function multiplyMatrixVector(matrix, vector) {
  const result = [];
  for (let i = 0; i < matrix.length; i++) {
    let sum = 0;
    for (let j = 0; j < vector.length; j++) {
      sum += matrix[i][j] * vector[j];
    }
    result.push(sum);
  }
  return result;
}