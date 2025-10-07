/*-------------------------------------------------------------------------
08_Transformation.js

canvas의 중심에 한 edge의 길이가 0.3인 정사각형을 그리고, 
이를 크기 변환 (scaling), 회전 (rotation), 이동 (translation) 하는 예제임.
    T는 x, y 방향 모두 +0.5 만큼 translation
    R은 원점을 중심으로 2초당 1회전의 속도로 rotate
    S는 x, y 방향 모두 0.3배로 scale
이라 할 때, 
---------------------------------------------------------------------------*/
import { resizeAspectRatio, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';


let isInitialized = false;
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

let shader;
let axes;
let vaoPillar;  // 풍차 기둥
let vaoBladeW;  // 흰색 중간 날개
let vaoBladeG;  // 양 옆 회색 작은 날개
let rotationAngle = 0;
let lastTime = 0;
let Two_PI = Math.PI * 2;
let startTime = 0;

const Hub_X = 0.0;
const Hub_Y = 0.5;

const widthW = 0.60;
const heightW = 0.08;
const widthG = 0.25;
const heightG = 0.06;

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
        requestAnimationFrame(animate);
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }
    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.2, 0.3, 0.4, 1.0);
    
    return true;
}

function setupBuffers() {
    shader.use()
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    const pillarVertices = new Float32Array([
        -0.10,  0.50,  // 좌상단
        -0.10, -0.50,  // 좌하단
         0.10, -0.50,  // 우하단
         0.10,  0.50   // 우상단
    ]);

    const brown = new Float32Array([
        0.6, 0.3, 0.0, 1.0,  // 갈색
        0.6, 0.3, 0.0, 1.0,
        0.6, 0.3, 0.0, 1.0,
        0.6, 0.3, 0.0, 1.0
    ]);

    let positionBuffer, colorBuffer, indexBuffer;

    vaoPillar = gl.createVertexArray();
    gl.bindVertexArray(vaoPillar);

    // VBO for position
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, pillarVertices, gl.STATIC_DRAW);
    shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);

    // VBO for color
    colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, brown, gl.STATIC_DRAW);
    shader.setAttribPointer("a_color", 4, gl.FLOAT, false, 0, 0);

    // EBO
    indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    const unitSq = new Float32Array([
        -0.5, 0.5,
        -0.5, -0.5,
        0.5, -0.5,
        0.5, 0.5
    ]);

    const white = new Float32Array([
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0
    ]);

    vaoBladeW = gl.createVertexArray();
    gl.bindVertexArray(vaoBladeW);

    // VBO for position
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, unitSq, gl.STATIC_DRAW);
    shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);

    // VBO for color
    colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, white, gl.STATIC_DRAW);
    shader.setAttribPointer("a_color", 4, gl.FLOAT, false, 0, 0);

    // EBO
    indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    const gray = new Float32Array([
        0.7, 0.7, 0.7, 1.0,
        0.7, 0.7, 0.7, 1.0,
        0.7, 0.7, 0.7, 1.0,
        0.7, 0.7, 0.7, 1.0
    ]);

    vaoBladeG = gl.createVertexArray();
    gl.bindVertexArray(vaoBladeG);

    // VBO for position
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, unitSq, gl.STATIC_DRAW);
    shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);

    // VBO for color
    colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, gray, gl.STATIC_DRAW);
    shader.setAttribPointer("a_color", 4, gl.FLOAT, false, 0, 0);

    // EBO
    indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
}

function render(thetaW, thetaG) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    // // draw axes
    // axes.draw(mat4.create(), mat4.create()); 

    // draw cube
    shader.use();
    shader.setMat4("u_transform", mat4.create());
    gl.bindVertexArray(vaoPillar);
    // gl.drawElements(mode, index_count, type, byte_offset);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    const HubR = mat4.create();
    mat4.translate(HubR, HubR, [Hub_X, Hub_Y, 0]);

    const Mwhite = mat4.clone(HubR);
    mat4.rotate(Mwhite, Mwhite, thetaW, [0, 0, 1]);
    mat4.scale(Mwhite, Mwhite, [widthW, heightW, 1]);
    shader.setMat4("u_transform", Mwhite);
    gl.bindVertexArray(vaoBladeW);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    const Mleft = mat4.clone(HubR);
    mat4.rotate(Mleft, Mleft, thetaW, [0, 0, 1]);
    mat4.translate(Mleft, Mleft, [-widthW/2, 0, 0]);
    mat4.rotate(Mleft, Mleft, thetaG, [0, 0, 1]);
    mat4.scale(Mleft, Mleft, [widthG, heightG, 1]);
    shader.setMat4("u_transform", Mleft);
    gl.bindVertexArray(vaoBladeG);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    const Mright = mat4.clone(HubR);
    mat4.rotate(Mright, Mright, thetaW, [0, 0, 1]);
    mat4.translate(Mright, Mright, [widthW/2, 0, 0]);
    mat4.rotate(Mright, Mright, thetaG, [0, 0, 1]);
    mat4.scale(Mright, Mright, [widthG, heightG, 1]);
    shader.setMat4("u_transform", Mright);
    gl.bindVertexArray(vaoBladeG);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);
}

// function getTransformMatrices() {
//     const T = mat4.create();
//     const R = mat4.create();
//     const S = mat4.create();
    
//     mat4.translate(T, T, [0.5, 0.5, 0]);  // translation by (0.5, 0.5)
//     mat4.rotate(R, R, rotationAngle, [0, 0, 1]); // rotation about z-axis
//     mat4.scale(S, S, [0.3, 0.3, 1]); // scale by (0.3, 0.3)
    
//     return { T, R, S };
// }

// function applyTransform(type) {
//     finalTransform = mat4.create();
//     const { T, R, S } = getTransformMatrices();
    

//     /*
//       type은 'TRS', 'TSR', 'RTS', 'RST', 'STR', 'SRT' 중 하나
//       array.forEach(...) : 각 type의 element T or R or S 에 대해 반복
//     */
//     if (transformOrder[type]) {
//         transformOrder[type].forEach(matrix => {
//             mat4.multiply(finalTransform, matrix, finalTransform);
//         });
//     }
// }

function animate(currentTime) {
  if (!startTime) startTime = currentTime;
  const elapsed = (currentTime - startTime) / 1000;

  const thetaW = Math.sin(elapsed) * Math.PI * 2.0;   
  const thetaG = Math.sin(elapsed) * Math.PI * -10.0; 

  render(thetaW, thetaG);
  requestAnimationFrame(animate);
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
        }
        
        await initShader();
        setupBuffers();
        axes = new Axes(gl, 0.8); 

        // textOverlay = setupText(canvas, 'NO TRANSFORMATION', 1);
        // setupText(canvas, 'press 1~7 to apply different order of transformations', 2);

        // setupKeyboardEvents();

        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
