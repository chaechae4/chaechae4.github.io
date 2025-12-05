import * as THREE from 'https://unpkg.com/three/build/three.module.js';

const canvas = document.getElementById('glCanvas');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setSize(700, 700);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(new THREE.Color(0.1, 0.2, 0.3));

const scene = new THREE.Scene();

const aspect = canvas.width / canvas.height;
const baseY = 2;
const baseZ = 5;
const size = 3.0;

let isGameOver = false;

let perspElapsed = 0;          // PERS 모드에서 경과 시간(초)
let columnSpawnTimer = 0;      // 마지막 기둥 생성 후 경과 시간(초)

const COLUMN_START_DELAY = 3.0;     // PERS 모드 연속 3초 후부터 생성
const COLUMN_SPAWN_INTERVAL = 2.0;  // 기둥 생성 간격(초)
const COLUMN_FALL_SPEED = 0.12;     // 기둥 떨어지는 속도

// 떨어지는 기둥들을 담는 배열
const fallingColumns = [];

// deltaTime 계산용
let lastTime = performance.now();


const perspCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100.0);
const orthoCamera = new THREE.OrthographicCamera(
  -size * aspect,
  size * aspect,
  size,
  -size,
  0.1,
  100.0
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

// 발판 배치
const positions = [
  {x: 4,  y: 0,  z: 0 },
  {x: 5,  y: 0,  z: 0 },
  {x: 6,  y: 0,  z: 0 },
  {x: 7,  y: -4, z: -10 },
  {x: 9,  y: -4, z: -10 },
  {x: 10,  y: -4, z: -10 }, 
  {x: 11, y: -2, z: -5 },
  {x: 12, y: -1, z: -5 },
  // {x: 13, y: -2, z: -5 },
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
const cubeSize = 1.0;
const cubeHalfSize = cubeSize / 2;   // = 0.5

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const ambient = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambient);


// 플레이어(큐브)
const playerSize = 0.6;
const playerHalfSize = playerSize / 2;

const playerGeo = new THREE.BoxGeometry(playerSize, playerSize, playerSize);
const playerMat = new THREE.MeshPhongMaterial({ color: 0xffee88 });
const player = new THREE.Mesh(playerGeo, playerMat);
scene.add(player);

const playerRadiusX = playerHalfSize;
const playerRadiusY = playerHalfSize;
const playerRadiusZ = playerHalfSize;

const moveSpeed = 0.20;
let scrollX = 0;

let playerZ = firstCube.position.z;
let lastTouchedCubeZ = playerZ;
let lastTouchedCubeX = firstCube.position.x;

const playerOffsetX = 0;
scrollX = firstCube.position.x - playerOffsetX;

function updateCameraPositions() {
  currentCamera.position.set(scrollX, baseY, baseZ);
  currentCamera.lookAt(scrollX, 0, 0);
}
updateCameraPositions();

// 플레이어를 첫 큐브 위에 올려놓기
function placePlayerOnFirstCube() {
  const firstTop = firstCube.position.y + cubeHalfSize;
  playerZ = firstCube.position.z;
  lastTouchedCubeZ = playerZ;
  lastTouchedCubeX = firstCube.position.x;
  player.position.set(
    scrollX + playerOffsetX,
    firstTop + playerRadiusY,
    playerZ
  );
}
placePlayerOnFirstCube();

let playerVelY = 0;
const gravity = -0.015;
const jumpPower = 0.23;
let isOnGround = true;

const worldFloorY = -10;

function getGroundInfoAt(x, z) {
  let bestGroundY = -Infinity;
  let hitCubeZ = null;
  let hitCubeX = null;

  const GROUND_X = cubeHalfSize;
  const GROUND_Z = cubeHalfSize;  

  for (const cube of cubes) {
    const dx = Math.abs(x - cube.position.x);
    const dz = Math.abs(z - cube.position.z);

    const withinX = dx < GROUND_X;
    let withinZ = true;

    // Perspective일 때는 z까지 맞아야 발판 취급
    if (projectionMode === 'PERSPECTIVE') {
      withinZ = dz < GROUND_Z;
    }

    if (!withinX || !withinZ) continue;

    const cubeTop = cube.position.y + cubeHalfSize;
    const candidateGroundY = cubeTop + playerRadiusY;

    if (candidateGroundY > bestGroundY) {
      bestGroundY = candidateGroundY;
      hitCubeZ = cube.position.z;
      hitCubeX = cube.position.x;
    }
  }

  return { groundY: bestGroundY, hitCubeZ, hitCubeX };
}

function checkCubeCollision(x, y, z) {
  const halfX = playerRadiusX;
  const halfY = playerRadiusY;
  const halfZ = playerRadiusZ;

  const playerBox = new THREE.Box3(
    new THREE.Vector3(x - halfX, y - halfY, z - halfZ),
    new THREE.Vector3(x + halfX, y + halfY, z + halfZ)
  );

  // 각 발판 큐브와 박스 교차 검사
  for (const cube of cubes) {
    const cubeBox = new THREE.Box3().setFromCenterAndSize(
      cube.position,
      new THREE.Vector3(cubeHalfSize * 2, cubeHalfSize * 2, cubeHalfSize * 2)
    );

    if (!playerBox.intersectsBox(cubeBox)) continue;

    const cubeTop = cube.position.y + cubeHalfSize;
    const playerBottom = y - halfY;
    const landingTolerance = 0.05;

    if (
      playerBottom >= cubeTop - landingTolerance &&
      playerBottom <= cubeTop + landingTolerance &&
      playerVelY <= 0
    ) {
      continue;
    }

    return true;
  }

  return false;
}

function checkColumnCollision(px, py, pz, column) {
  const hitPadding = 0.1;

  const colPos = column.mesh.position;

  // ORTHO 모드: z는 완전히 무시하고 x,y만 본다
  if (projectionMode === 'ORTHOGRAPHIC') {
    const dx = Math.abs(px - colPos.x);
    const dy = Math.abs(py - colPos.y);

    const hitX = dx < (playerRadiusX + column.halfX + hitPadding);
    const hitY = dy < (playerRadiusY + column.halfY + hitPadding);

    return hitX && hitY;
  }

  const playerBox = new THREE.Box3(
    new THREE.Vector3(
      px - (playerRadiusX + hitPadding),
      py - (playerRadiusY + hitPadding),
      pz - (playerRadiusZ + hitPadding)
    ),
    new THREE.Vector3(
      px + (playerRadiusX + hitPadding),
      py + (playerRadiusY + hitPadding),
      pz + (playerRadiusZ + hitPadding)
    )
  );

  const colBox = new THREE.Box3(
    new THREE.Vector3(
      colPos.x - (column.halfX + hitPadding),
      colPos.y - (column.halfY + hitPadding),
      colPos.z - (column.halfZ + hitPadding)
    ),
    new THREE.Vector3(
      colPos.x + (column.halfX + hitPadding),
      colPos.y + (column.halfY + hitPadding),
      colPos.z + (column.halfZ + hitPadding)
    )
  );

  return playerBox.intersectsBox(colBox);
}



function spawnFallingColumn() {
  if (cubes.length === 0) return;

  const randIndex = Math.floor(Math.random() * cubes.length);
  const baseCube = cubes[randIndex];
  const targetZ = baseCube.position.z;

  let leftX, rightX;

  if (projectionMode === 'ORTHOGRAPHIC') {
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    const aspectNow = w / h;
    const halfWidth = size * aspectNow;

    leftX  = scrollX - halfWidth;
    rightX = scrollX + halfWidth;
  } else {
    leftX  = scrollX - 3.0;
    rightX = scrollX + 3.0;
  }

  const randomX = leftX + Math.random() * (rightX - leftX);

  const columnHeight = 2.0;
  const columnHalfX  = 0.25;
  const columnHalfZ  = 0.25;
  const columnHalfY  = columnHeight / 2;

  const columnGeo = new THREE.BoxGeometry(
    columnHalfX * 2,
    columnHalfY * 2,
    columnHalfZ * 2
  );
  const columnMat = new THREE.MeshPhongMaterial({ color: 0xaa2222 });
  const column = new THREE.Mesh(columnGeo, columnMat);

  const startY = baseCube.position.y + cubeHalfSize + columnHeight + 8;

  column.position.set(
    randomX,
    startY,
    targetZ
  );

  scene.add(column);

  fallingColumns.push({
    mesh: column,
    halfX: columnHalfX,
    halfY: columnHalfY,
    halfZ: columnHalfZ
  });
}





function setGameOver() {
  if (isGameOver) return;
  isGameOver = true;
  console.log('Game Over - o: restart');
}

function switchToPerspective() {
  projectionMode = 'PERSPECTIVE';
  currentCamera = perspCamera;
  updateProjectionText();

  perspElapsed = 0;
  columnSpawnTimer = 0;
}

function switchToOrthographic() {
  projectionMode = 'ORTHOGRAPHIC';
  currentCamera = orthoCamera;
  updateProjectionText();

  perspElapsed = 0;
  columnSpawnTimer = 0;
  lastTime = performance.now();
}

function toggleProjection() {
  if (projectionMode === 'PERSPECTIVE') {
    if (lastTouchedCubeZ != null) {
      playerZ = lastTouchedCubeZ;
      player.position.z = playerZ;
    }
    switchToOrthographic();
  } else {
    switchToPerspective();
  }
}

function resetScene() {
  isGameOver = false;
  keys.left = false;
  keys.right = false;

  scrollX = firstCube.position.x - playerOffsetX;

  for (let i = 0; i < cubes.length; i++) {
    cubes[i].position.set(
      initialPositions[i].x,
      initialPositions[i].y,
      initialPositions[i].z
    );
  }

  playerVelY = 0;
  isOnGround = true;

  // 게임 오버 -> 기둥 전체 삭제
  for (let i = fallingColumns.length - 1; i >= 0; i--) {
    scene.remove(fallingColumns[i].mesh);
  }
  fallingColumns.length = 0;

  perspElapsed = 0;
  columnSpawnTimer = 0;
  lastTime = performance.now();

  switchToPerspective();
  updateCameraPositions();
  placePlayerOnFirstCube();
}

function tryJump() {
  if (isGameOver) return;
  if (isOnGround) {
    playerVelY = jumpPower;
    isOnGround = false;
  }
}

const keys = {
  left: false,
  right: false
};

document.addEventListener('keydown', (event) => {
  if (isGameOver) {
    if (event.key === 'o' || event.key === 'O') {
      resetScene();
    }
    return;
  }
  if (event.key === 'ArrowLeft') {
    keys.left = true;
  } else if (event.key === 'ArrowRight') {
    keys.right = true;
  } else if (event.key === 'q') {
    toggleProjection();
  } else if (event.code === 'Space') {
    event.preventDefault();
    tryJump();
  } else if (event.key === 'o' || event.key === 'O'){
    resetScene();
  }
});

document.addEventListener('keyup', (event) => {
  if (isGameOver) return;
  if (event.key === 'ArrowLeft') {
    keys.left = false;
  } else if (event.key === 'ArrowRight') {
    keys.right = false;
  }
});

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (projectionMode === 'ORTHOGRAPHIC') {
    perspElapsed += dt;

    if (perspElapsed >= COLUMN_START_DELAY) {
      columnSpawnTimer += dt;
      if (columnSpawnTimer >= COLUMN_SPAWN_INTERVAL) {
        spawnFallingColumn();
        columnSpawnTimer = 0;
      }
    }
  } else {
    perspElapsed = 0;
    columnSpawnTimer = 0;
  }

  if (isGameOver) {
    renderer.render(scene, currentCamera);
    return;
  }

  let nextScrollX = scrollX;
  if (keys.left) {
    nextScrollX -= moveSpeed;
  }
  if (keys.right) {
    nextScrollX += moveSpeed;
  }
  const maxOffset = cubeSize * 1.8;
  const minX = lastTouchedCubeX - maxOffset;
  const maxX = lastTouchedCubeX + maxOffset;

  if (keys.left && nextScrollX < minX) {
    if (scrollX !== minX) {
      console.log('화면이 넘어갈 수 없습니다.');
    }
    nextScrollX = minX;
  }
  if (keys.right && nextScrollX > maxX) {
    if (scrollX !== maxX) {
      console.log('화면이 넘어갈 수 없습니다.');
    }
    nextScrollX = maxX;
  }

  const nextPlayerX = nextScrollX + playerOffsetX;

  playerVelY += gravity;
  let nextPlayerY = player.position.y + playerVelY;

  let nextPlayerZ = playerZ;

  const { groundY, hitCubeZ, hitCubeX } = getGroundInfoAt(nextPlayerX, nextPlayerZ);

  if (groundY !== -Infinity && nextPlayerY <= groundY) {
    nextPlayerY = groundY;
    playerVelY = 0;
    isOnGround = true;

    if (hitCubeZ != null) {
      lastTouchedCubeZ = hitCubeZ;
      if (hitCubeX != null) {
        lastTouchedCubeX = hitCubeX;
      }
      if (projectionMode === 'ORTHOGRAPHIC') {
        playerZ = hitCubeZ;
        nextPlayerZ = playerZ;
      }
    }
  } else {
    isOnGround = false;
  }

  if (checkCubeCollision(nextPlayerX, nextPlayerY, nextPlayerZ)) {
    setGameOver();
  }

  scrollX = nextScrollX;
  player.position.x = scrollX + playerOffsetX;
  player.position.y = nextPlayerY;
  player.position.z = nextPlayerZ;

  if (nextPlayerY < worldFloorY) {
    setGameOver();
  }

  for (let i = fallingColumns.length - 1; i >= 0; i--) {
    const col = fallingColumns[i];

    col.mesh.position.y -= COLUMN_FALL_SPEED;

    // 플레이어와 충돌 체크
    if (checkColumnCollision(
      player.position.x,
      player.position.y,
      player.position.z,
      col
    )) {
      setGameOver();
    }

    // 너무 아래로 떨어지면 삭제
    if (col.mesh.position.y < worldFloorY - 5) {
      scene.remove(col.mesh);
      fallingColumns.splice(i, 1);
    }
  }

  updateCameraPositions();

  renderer.render(scene, currentCamera);
}
animate();

window.addEventListener('resize', () => {
  const width = canvas.clientWidth || 700;
  const height = canvas.clientHeight || 700;
  const aspect = width / height;

  renderer.setSize(width, height);

  perspCamera.aspect = aspect;
  perspCamera.updateProjectionMatrix();

  orthoCamera.left = -size * aspect;
  orthoCamera.right = size * aspect;
  orthoCamera.updateProjectionMatrix();
});
