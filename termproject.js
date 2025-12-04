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

// =====================
// 카메라 / 투영 설정
// =====================
const aspect = canvas.width / canvas.height;
const baseY = 2;
const baseZ = 5;
const size = 3.0;

let isGameOver = false;

// =====================
// PERS 모드 타이머 & 기둥 관련
// =====================
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

// =====================
// 좌표축 Helper
// =====================
const axesHelper = new THREE.AxesHelper(2.2);
scene.add(axesHelper);

// =====================
// 발판(큐브) 배치
// =====================
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
// 발판(큐브) 크기 관련 상수
const cubeSize = 1.0;
const cubeHalfSize = cubeSize / 2;   // = 0.5


// =====================
// 조명
// =====================
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const ambient = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambient);

// =====================
// 플레이어(큐브)
// =====================

// 발판(플랫폼) 큐브는 이미 위에서 사용 중
// const cubeHalfSize = 0.5;  // 이건 그대로 유지하면 됨

// 플레이어 큐브 한 변 길이
const playerSize = 0.6;
const playerHalfSize = playerSize / 2;

// 플레이어 메쉬를 큐브로 생성
const playerGeo = new THREE.BoxGeometry(playerSize, playerSize, playerSize);
const playerMat = new THREE.MeshPhongMaterial({ color: 0xffee88 });
const player = new THREE.Mesh(playerGeo, playerMat);
scene.add(player);

// 플레이어 / 발판 크기 관련 상수
// (아래 radius 값은 충돌 계산에서 사용됨)
const playerRadiusX = playerHalfSize;
const playerRadiusY = playerHalfSize;
const playerRadiusZ = playerHalfSize;


// =====================
// 카메라/플레이어 위치 상태
// =====================
const moveSpeed = 0.20;   // ← → 이동 속도(첫 코드의 velocity.x 느낌)
let scrollX = 0;          // 카메라/플레이어의 x 기준(방향키로 움직임)

// 플레이어의 z (깊이)
// - PERSPECTIVE에서는 z를 거의 고정(발판에 따라 조금 바뀔 수 있음)
// - ORTHOGRAPHIC에서는 발판에 착지하면 해당 발판 z로 스냅
let playerZ = firstCube.position.z;
let lastTouchedCubeZ = playerZ;
let lastTouchedCubeX = firstCube.position.x;

// 첫 시작 시 scrollX 초기화
const playerOffsetX = 0;
scrollX = firstCube.position.x - playerOffsetX;

// 카메라 위치를 scrollX 기준으로 설정
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

// =====================
// 물리(점프, 중력)
// =====================
let playerVelY = 0;
const gravity = -0.015;
const jumpPower = 0.23;
let isOnGround = true;

// 전역 바닥 높이 (발판 없는 곳으로 떨어질 때 기준)
const worldFloorY = -10;

// x, z 위치에서 "아래에 있는 발판 중에서 가장 높은 곳"을 찾아주는 함수
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
  // 플레이어의 AABB (축 정렬 바운딩 박스)
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

    // 아예 겹치지 않으면 패스
    if (!playerBox.intersectsBox(cubeBox)) continue;

    // 여기까지 왔으면 실제로 두 박스가 겹친 상태

    const cubeTop = cube.position.y + cubeHalfSize;
    const playerBottom = y - halfY;
    const landingTolerance = 0.05;   // 착지 허용 오차

    // 1) "위에서 살짝 닿은 착지"는 살려주기
    //    - 플레이어 바닥이 큐브 윗면 근처이고
    //    - 아래로 떨어지는 중(velocity <= 0)일 때
    if (
      playerBottom >= cubeTop - landingTolerance &&
      playerBottom <= cubeTop + landingTolerance &&
      playerVelY <= 0
    ) {
      // 이건 정상 착지 상황 → Game Over 아님
      continue;
    }

    // 2) 그 외의 모든 교차는
    //    → 옆면/밑에서 박은 것 → Game Over
    return true;
  }

  return false;
}

// =====================
// 기둥과 플레이어 충돌 체크
// =====================
// =====================
// 기둥과 플레이어 충돌 체크 (PERS: 3D, ORTHO: 2D처럼 z무시)
// =====================
function checkColumnCollision(px, py, pz, column) {
  const hitPadding = 0.1;  // 살짝 여유

  const colPos = column.mesh.position;

  // ORTHO 모드: 2D처럼 z는 완전히 무시하고 x,y만 본다
  if (projectionMode === 'ORTHOGRAPHIC') {
    const dx = Math.abs(px - colPos.x);
    const dy = Math.abs(py - colPos.y);

    const hitX = dx < (playerRadiusX + column.halfX + hitPadding);
    const hitY = dy < (playerRadiusY + column.halfY + hitPadding);

    return hitX && hitY;
  }

  // PERSPECTIVE 모드: 기존처럼 3D 박스 충돌 (x,y,z 모두 사용)
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

  // 1) 랜덤 큐브 하나 골라서 z좌표만 가져오기
  const randIndex = Math.floor(Math.random() * cubes.length);
  const baseCube = cubes[randIndex];
  const targetZ = baseCube.position.z;

  // 2) 현재 화면에 보이는 범위 안에서 X 좌표 랜덤
  let leftX, rightX;

  if (projectionMode === 'ORTHOGRAPHIC') {
    // Ortho에서 실제 화면 폭 계산 (size, aspect 기반)
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    const aspectNow = w / h;
    const halfWidth = size * aspectNow;   // orthoCamera.left/right에서 쓰던 값과 동일

    leftX  = scrollX - halfWidth;
    rightX = scrollX + halfWidth;
  } else {
    // Pers에서는 대략 카메라 중심 기준 ±3 정도만 보인다고 보고 사용
    leftX  = scrollX - 3.0;
    rightX = scrollX + 3.0;
  }

  const randomX = leftX + Math.random() * (rightX - leftX);

  // 3) 기둥 크기 (얇고 짧게)
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

  // 4) y는 충분히 높은 곳에서 시작 (선택한 큐브 위 + 여유)
  const startY = baseCube.position.y + cubeHalfSize + columnHeight + 8;

  column.position.set(
    randomX,   // 화면 안에서 랜덤 X
    startY,    // 위에서 떨어지게
    targetZ    // 선택한 큐브의 z 레일
  );

  scene.add(column);

  // 5) 나중에 떨어뜨리고 충돌 체크하기 위해 배열에 저장
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

// =====================
// 투영 전환
// =====================
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

// =====================
// 리셋
// =====================
function resetScene() {
  isGameOver = false;
  keys.left = false;
  keys.right = false;

  scrollX = firstCube.position.x - playerOffsetX;

  // 발판 위치 초기화
  for (let i = 0; i < cubes.length; i++) {
    cubes[i].position.set(
      initialPositions[i].x,
      initialPositions[i].y,
      initialPositions[i].z
    );
  }

  playerVelY = 0;
  isOnGround = true;

  // ======================
  // ★ 기둥 전체 삭제
  // ======================
  for (let i = fallingColumns.length - 1; i >= 0; i--) {
    scene.remove(fallingColumns[i].mesh); // 씬에서 제거
  }
  fallingColumns.length = 0;  // 배열 비우기

  // 타이머 리셋
  perspElapsed = 0;
  columnSpawnTimer = 0;
  lastTime = performance.now();

  switchToPerspective();
  updateCameraPositions();
  placePlayerOnFirstCube();
}


// =====================
// 점프
// =====================
function tryJump() {
  if (isGameOver) return;
  if (isOnGround) {
    playerVelY = jumpPower;
    isOnGround = false;
  }
}

// =====================
// 키 입력 처리
// =====================
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

// =====================
// 메인 루프
// =====================
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
    // ORTHO로 바꾸면 연속 시간 끊김
    perspElapsed = 0;
    columnSpawnTimer = 0;
  }

  if (isGameOver) {
    renderer.render(scene, currentCamera);
    return;
  }

  // 1. X 방향 이동 (카메라 + 플레이어 같이 이동)
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

  // 2. Y 방향(중력, 점프)
  playerVelY += gravity;
  let nextPlayerY = player.position.y + playerVelY;

  // 현재 z 는 playerZ로 관리
  let nextPlayerZ = playerZ;

  // 3. 발판 충돌(착지) 처리
  const { groundY, hitCubeZ, hitCubeX } = getGroundInfoAt(nextPlayerX, nextPlayerZ);

  if (groundY !== -Infinity && nextPlayerY <= groundY) {
    // 발판 또는 바닥에 착지
    nextPlayerY = groundY;
    playerVelY = 0;
    isOnGround = true;

    if (hitCubeZ != null) {
      lastTouchedCubeZ = hitCubeZ;
      if (hitCubeX != null) {
        lastTouchedCubeX = hitCubeX;
      }

      // ORTHOGRAPHIC 모드에서는 발판의 깊이로 z 고정
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

  // 4. 위치 확정
  scrollX = nextScrollX;
  player.position.x = scrollX + playerOffsetX;
  player.position.y = nextPlayerY;
  player.position.z = nextPlayerZ;

  // 5. 낙사 처리(바닥 아래로 너무 떨어지면 리셋)
  if (nextPlayerY < worldFloorY) {
    setGameOver();
  }

    // 3) 기둥 떨어뜨리기 + 기둥과 플레이어 충돌
  for (let i = fallingColumns.length - 1; i >= 0; i--) {
    const col = fallingColumns[i];

    // 기둥 y축으로 떨어뜨리기
    col.mesh.position.y -= COLUMN_FALL_SPEED;   // dt 곱해도 됨

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


  // 6. 카메라 위치 갱신
  updateCameraPositions();

  // 7. 렌더링
  renderer.render(scene, currentCamera);
}
animate();

// =====================
// 리사이즈 대응
// =====================
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
