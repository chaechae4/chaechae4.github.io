import * as THREE from 'https://unpkg.com/three/build/three.module.js';

const canvas = document.getElementById('glCanvas');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setSize(700, 700);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(new THREE.Color(0.1, 0.2, 0.3)); // 배경색

const scene = new THREE.Scene();

const aspect = canvas.width / canvas.height;
const baseY = 2;   // 카메라 높이
const baseZ = 5;   // 카메라 z
const size = 3.0;  // Ortho 크기

let scrollX = 0;
const scrollSpeed = 0.03;

const perspCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100.0);
const orthoCamera = new THREE.OrthographicCamera(
  -size * aspect,  // left
  size * aspect,   // right
  size,            // top
  -size,           // bottom
  0.1,             // near
  100.0            // far
);

let projectionMode = 'PERSPECTIVE';
let currentCamera = perspCamera;

const projectionText = document.getElementById('projectionText');
function updateProjectionText() {
  projectionText.textContent = `projection: ${projectionMode}`;
}
updateProjectionText();

const axesHelper = new THREE.AxesHelper(2.2);
scene.add(axesHelper);

const positions = [
  {x: 4,  y: 0,  z: 0 },
  {x: 5,  y: 0,  z: 0 },
  {x: 6,  y: 0,  z: 0 },

  {x: 7,  y: -4, z: -10 },
  {x: 8,  y: -4, z: -10 },
  {x: 9,  y: -4, z: -10 }, 

  {x: 10, y: -2, z: -5 },
  {x: 11, y: -1, z: -5 },
  {x: 12, y: -2, z: -5 },
  {x: 13, y: -2, z: -5 },
  {x: 15, y: -4, z: -10 },
  {x: 16, y: -4, z: -10 },
  {x: 17, y: -4, z: -10 },
  {x: 18, y: -6, z: -15 },
  {x: 18, y: -5, z: -15 },
  {x: 18, y: -4, z: -15 },
  {x: 19, y: -4, z: -10 },
  {x: 20, y: -4, z: -10 },
  {x: 21, y: -4, z: -10 },

  {x: 22, y: -3, z: -5 },
  {x: 23, y: -3, z: -5 },

  {x: 24, y: -2, z: 0 },
  {x: 25, y: -1, z: 0 },
  {x: 26, y:  0, z: 0 },

  {x: 27, y: 0, z: 0 },
  {x: 28, y: 0, z: 0 },

  {x: 29, y: -1, z: -5 },
  {x: 30, y: -2, z: -5 },

  {x: 31, y: -3, z: -10 },
  {x: 32, y: -3, z: -10 },

  {x: 33, y: -1, z: 0 },
  {x: 34, y:  0, z: 0 },
  {x: 35, y:  1, z: 0 },
  {x: 36, y:  1, z: 0 },
];

const initialPositions = positions.map(p => ({ ...p }));

const cubes = [];
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
for (let pos of positions) {
  const color = new THREE.Color(Math.random(), Math.random(), Math.random());
  const mat = new THREE.MeshPhongMaterial({ color });
  const cube = new THREE.Mesh(boxGeo, mat);
  cube.position.set(pos.x, pos.y, pos.z);
  cubes.push(cube);
  scene.add(cube);
}
const firstCube = cubes[0];

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const ambient = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambient);

const playerGeo = new THREE.SphereGeometry(0.3, 32, 16);
const playerMat = new THREE.MeshPhongMaterial({ color: 0xffee88 });
const player = new THREE.Mesh(playerGeo, playerMat);
scene.add(player);

const cubeHalfSize = 0.5;
const groundBaseY = -1.5;

const playerRadiusX = 0.3;
const playerRadiusZ = 0.3;
const playerScaleY = 1.5;
const playerRadiusY = 0.3 * playerScaleY;

player.scale.set(1.0, playerScaleY, 1.0);

const playerOffsetX = -1.5;
let playerZ = firstCube.position.z;
let lastTouchedCubeZ = playerZ;

scrollX = firstCube.position.x - playerOffsetX;

function updateCameraPositions() {
  perspCamera.position.set(scrollX, baseY, baseZ);
  perspCamera.lookAt(scrollX, 0, 0);
  orthoCamera.position.set(scrollX, baseY, baseZ);
  orthoCamera.lookAt(scrollX, 0, 0);
}
updateCameraPositions();

function placePlayerOnFirstCube() {
  const firstTop = firstCube.position.y + cubeHalfSize;
  playerZ = firstCube.position.z;
  lastTouchedCubeZ = playerZ;
  player.position.set(
    scrollX + playerOffsetX,
    firstTop + playerRadiusY,
    playerZ
  );
}
placePlayerOnFirstCube();

let playerVelY = 0;
let playerVelX = 0;

const jumpForwardSpeed = 0.35; 
const gravity = -0.015;
const jumpPower = 0.23;
let isOnGround = true;

function getGroundInfoAt(x, z) {
  let bestY = -Infinity;
  let hitCubeZ = null;

  for (const cube of cubes) {
    const dx = Math.abs(x - cube.position.x);
    const dz = Math.abs(z - cube.position.z);

    const withinX = dx < (cubeHalfSize + playerRadiusX);
    let withinZ = true;
    if (projectionMode === 'PERSPECTIVE') {
      withinZ = dz < (cubeHalfSize + playerRadiusZ);
    }

    if (withinX && withinZ) {
      const cubeTop = cube.position.y + cubeHalfSize;
      const surfaceY = cubeTop + playerRadiusY;
      if (surfaceY > bestY) {
        bestY = surfaceY;
        hitCubeZ = cube.position.z;
      }
    }
  }

  if (bestY === -Infinity) bestY = groundBaseY;
  return { groundY: bestY, cubeZ: hitCubeZ };
}

function switchToPerspective() {
  projectionMode = 'PERSPECTIVE';
  currentCamera = perspCamera;
  updateProjectionText();
}

function switchToOrthographic() {
  projectionMode = 'ORTHOGRAPHIC';
  currentCamera = orthoCamera;
  updateProjectionText();
}

function toggleProjection() {
  if (lastTouchedCubeZ != null) {
    playerZ = lastTouchedCubeZ;
    player.position.z = playerZ;
  }

  if (projectionMode === 'PERSPECTIVE') {
    switchToOrthographic();
  } else {
    switchToPerspective();
  }
}

function resetScene() {
  scrollX = firstCube.position.x - playerOffsetX;

  for (let i = 0; i < cubes.length; i++) {
    cubes[i].position.set(
      initialPositions[i].x,
      initialPositions[i].y,
      initialPositions[i].z
    );
  }

  updateCameraPositions();
  placePlayerOnFirstCube();

  playerVelY = 0;
  playerVelX = 0;
  isOnGround = true;
  switchToPerspective();
}

function tryJump() {
  if (isOnGround) {
    playerVelY = jumpPower;
    playerVelX = jumpForwardSpeed;
    isOnGround = false;
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'q') {
    toggleProjection();
  } else if (event.key === 'r') {
    resetScene();
  } else if (event.code === 'Space') {
    event.preventDefault();
    tryJump();
  }
});

function animate() {
  requestAnimationFrame(animate);

  scrollX += scrollSpeed;
  updateCameraPositions();

  player.position.x = scrollX + playerOffsetX + playerVelX;
  player.position.z = playerZ;

  playerVelY += gravity;
  player.position.y += playerVelY;

  if (!isOnGround) {
    playerVelX *= 0.95;
  } else {
    playerVelX = 0;
  }

  const { groundY, cubeZ } = getGroundInfoAt(player.position.x, player.position.z);

  if (player.position.y <= groundY) {
    player.position.y = groundY;
    playerVelY = 0;
    isOnGround = true;

    if (cubeZ != null) {
      lastTouchedCubeZ = cubeZ;
      if (projectionMode === 'PERSPECTIVE') {
        playerZ = cubeZ;
        player.position.z = playerZ;
      }
    }
  } else {
    isOnGround = false;
  }

  renderer.render(scene, currentCamera);
}
animate();

window.addEventListener('resize', () => {
  const width = canvas.clientWidth || 700;
  const height = canvas.clientHeight || 700;
  const aspect = width / height;q

  renderer.setSize(width, height);

  perspCamera.aspect = aspect;
  perspCamera.updateProjectionMatrix();

  orthoCamera.left = -size * aspect;
  orthoCamera.right = size * aspect;
  orthoCamera.updateProjectionMatrix();
});
