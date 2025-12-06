import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { floors, obstacles, goal, pillarPositions, pillars, ice, steps, bigwalls } from './map.js';


const scene = new THREE.Scene();

const aspect = window.innerWidth / window.innerHeight;

const perspCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
const frusSize = 5.8;
const orthoCamera = new THREE.OrthographicCamera(
    -frusSize * aspect / 2,
    frusSize * aspect / 2,
    frusSize / 2,
    -frusSize / 2,
    0.1, 1000
);


///// 추가 - 이동 속도 조절 /////
const NORMAL_SPEED = 0.1;
const ICE_SPEED = 0.03;

const ICE_Z_Offset = 3;

let currentSpeed = NORMAL_SPEED;

const iceFloors = floors.filter(f => f.userData.isIce);
iceFloors.forEach(ice => {
    ice.userData.tpsZ = ice.userData.originalZ + ICE_Z_Offset;
});
///////////


// 상수 정의
const ORTHO_Z = 5.5;
const ORTHO_Y = 0;    // Orthographic 높이

let camera = orthoCamera;
camera.position.set(4, ORTHO_Y, ORTHO_Z);
camera.lookAt(4, 0, 0);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(new THREE.Color(0xb8f8fd));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
directionalLight.position.set(-20, 40, 60);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

let isOrtho = true;
let isGameOver = false;
let gameOverReason = "";
let isTransitioning = false;
let transitionAlpha = 0;

const status = {
    gauge: 100
}
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
}
// 카메라 뷰 설정값
const VIEW_CONFIG = {
    // orthographic - Side View
    SIDE: {
        offsetX: 0,
        offsetY: 0,
        offsetZ: 100,
        fov: 3.3 
    },
    // perspective - Back View
    TPS: {
        offsetX: -6,
        offsetY: 3,
        offsetZ: 0,
        fov: 60
    }
};

function lerp(a, b, t) {
    return a + (b - a) * t;
}

let velocity = new THREE.Vector3(0, 0, 0);
const GRAVITY = -0.01;
const JUMP_POWER = 0.2;
const ICE_JUMP_POWER = 0.08;
let isGrounded = true;

let isOnIce = false;

const gui = new GUI({ title: 'Game HUD' });
gui.add(status, 'gauge', 0, 100).name('투영 게이지').listen().disable();

// 맵 엔티티 생성
floors.forEach(floor => { scene.add(floor); });
obstacles.forEach(obstacle => { scene.add(obstacle); });
scene.add(goal);

const sphereGeometry = new THREE.SphereGeometry(0.25, 32, 32);
const sphereMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(4, 1.5, 0);
scene.add(sphere);


///// 아파트 추가 /////
const loader = new GLTFLoader();

loader.load(
    './apartment.glb',
    (gltf) => {
        const template = gltf.scene;
        template.scale.set(1, 1, 1);

        template.traverse((obj) => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });

        pillarPositions.forEach((pos) => {
            const apartment = template.clone(true);

            apartment.position.set(pos.x, pos.y, pos.z);
            apartment.userData.originalZ = apartment.position.z;
            apartment.bbox = new THREE.Box3().setFromObject(apartment);

            scene.add(apartment);
            pillars.push(apartment);
            obstacles.push(apartment);
        });
    },
    undefined,
    (err) => {
        console.error('apartment.glb 로드 실패: ', err);
    }
);




function switchCamera() {
    if (isTransitioning) return;
    
    isOrtho = !isOrtho;
    isTransitioning = true;
    transitionAlpha = 0;

    // 전환 효과를 위해 무조건 PerspectiveCamera 사용
    camera = perspCamera;
    
    // 시작 시점의 Projection 매트릭스 업데이트
    camera.updateProjectionMatrix();
}

window.addEventListener('keydown', function (event) {
    if (isGameOver && event.key === 'Enter') {
        resetGame();
        return;
    }
    if (isTransitioning) return;
    
    if (event.key === 'ArrowUp') keys.up = true;
    if (event.key === 'ArrowDown') keys.down = true;
    if (event.key === 'ArrowLeft') keys.left = true;
    if (event.key === 'ArrowRight') keys.right = true;
    
    if (event.key === 'Tab') {
        event.preventDefault();
        switchCamera();
    }
    if (event.code === 'Space') {
        if (isGrounded) {
            velocity.y = isOnIce ? ICE_JUMP_POWER : JUMP_POWER;
            isGrounded = false;
        }
    }
});

window.addEventListener('keyup', function (event) {
    if (event.key === 'ArrowUp') keys.up = false;
    if (event.key === 'ArrowDown') keys.down = false;
    if (event.key === 'ArrowLeft') keys.left = false;
    if (event.key === 'ArrowRight') keys.right = false;
});

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    perspCamera.aspect = aspect;
    perspCamera.updateProjectionMatrix();
    orthoCamera.left = -frusSize * aspect / 2;
    orthoCamera.right = frusSize * aspect / 2;
    orthoCamera.top = frusSize / 2;
    orthoCamera.bottom = -frusSize / 2;
    orthoCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});


////////////////// updatPhysics //////////////////
function updatePhysics() {
    if (isTransitioning) return;

    let onIce = false;

    // 1. 플레이어 이동 처리 (속도 적용)
    if (isOrtho) {
        if (keys.left) sphere.position.x -= currentSpeed;
        if (keys.right) sphere.position.x += currentSpeed;
        // 2D 모드에서 Z축 정렬 (보정)
        if (sphere.position.z !== 0) sphere.position.z = 0; 
    } else {
        if (keys.up) sphere.position.x += currentSpeed;
        if (keys.down) sphere.position.x -= currentSpeed;  
        if (keys.left) sphere.position.z -= currentSpeed;
        if (keys.right) sphere.position.z += currentSpeed;  
    }
    
    velocity.y += GRAVITY;
    sphere.position.y += velocity.y;

    // 플레이어 정보 업데이트
    const playerRadius = 0.25;
    // 플레이어의 AABB(충돌 박스) 계산을 위한 min/max
    const pMinX = sphere.position.x - playerRadius;
    const pMaxX = sphere.position.x + playerRadius;
    const pMinY = sphere.position.y - playerRadius;
    const pMaxY = sphere.position.y + playerRadius;
    const pMinZ = sphere.position.z - playerRadius;
    const pMaxZ = sphere.position.z + playerRadius;

    isGrounded = false;

    for (const obstacle of obstacles) {
        const box = obstacle.bbox;
        const oMin = box.min;
        const oMax = box.max;

        // 1. AABB 겹침 판정
        const overlapX = pMaxX > oMin.x && pMinX < oMax.x;
        const overlapY = pMaxY > oMin.y && pMinY < oMax.y;
        
        // 2D 모드면 Z축은 항상 겹친다고 가정(메인 라인), 3D면 실제 깊이 체크
        let overlapZ = true;
        if (!isOrtho) {
            overlapZ = pMaxZ > oMin.z && pMinZ < oMax.z;
        }

        // 세 축이 모두 겹치면 충돌 발생
        if (overlapX && overlapY && overlapZ) {
            // 2. 침투 깊이(Penetration Depth) 계산
            // 플레이어가 어느 쪽에서 들어왔는지 판단하여 가장 조금 겹친 쪽으로 밀어냄
            
            // 각 방향별 침투 깊이 (양수)
            const depthX_Left = pMaxX - oMin.x;  // 왼쪽에서 들어옴
            const depthX_Right = oMax.x - pMinX; // 오른쪽에서 들어옴
            const depthY_Bottom = pMaxY - oMin.y; // 아래에서 위로 (머리 찧음)
            const depthY_Top = oMax.y - pMinY;    // 위에서 아래로 (착지)
            const depthZ_Back = pMaxZ - oMin.z;   // 뒤에서 앞으로
            const depthZ_Front = oMax.z - pMinZ;  // 앞에서 뒤로

            // 최소 침투 깊이 찾기
            // 2D 모드일 때는 Z축 보정 제외 (무한대로 설정하여 선택 안 되게 함)
            const minX = Math.min(depthX_Left, depthX_Right);
            const minY = Math.min(depthY_Bottom, depthY_Top);
            const minZ = isOrtho ? Infinity : Math.min(depthZ_Back, depthZ_Front);

            const minOverlap = Math.min(minX, minY, minZ);

            // 3. 충돌 해결 (밀어내기)
            if (minOverlap === minY) {
                // Y축 충돌 (바닥 착지 or 머리 찧음)
                velocity.y = 0;
                if (depthY_Top < depthY_Bottom) {
                    // 위에서 떨어짐 -> 착지
                    sphere.position.y = oMax.y + playerRadius;
                    isGrounded = true;
                } else {
                    // 밑에서 올라감 -> 머리 찧음
                    sphere.position.y = oMin.y - playerRadius;
                }
            } else if (minOverlap === minX) {
                // X축 충돌 (벽)
                if (depthX_Left < depthX_Right) {
                    // 왼쪽 벽에 부딪힘 -> 왼쪽으로 밀어냄
                    sphere.position.x = oMin.x - playerRadius;
                } else {
                    // 오른쪽 벽에 부딪힘 -> 오른쪽으로 밀어냄
                    sphere.position.x = oMax.x + playerRadius;
                }
            } else if (minOverlap === minZ) {
                // Z축 충돌 (벽 - 3D 모드 전용)
                if (depthZ_Back < depthZ_Front) {
                    sphere.position.z = oMin.z - playerRadius;
                } else {
                    sphere.position.z = oMax.z + playerRadius;
                }
            }
        }
    }

    if (!isGrounded) { 
        const playerBottomY = sphere.position.y - 0.25;
        const playerX = sphere.position.x;
        const playerZ = sphere.position.z;

        ///// 빙판 밟기 판정 위해 가장 위에 있는 바닥 선택 /////
        let upperFloor = null;
        let upperMaxY = -Infinity;
        let upperisIce = false;

        for (const floor of floors) {
            const box = floor.bbox;
            const min = box.min;
            const max = box.max;
            const inX = playerX >= min.x - 0.2 && playerX <= max.x + 0.2;
            let inZ = true;
            if (!isOrtho) {
                inZ = playerZ >= min.z - 0.1 && playerZ <= max.z + 0.1;
            }

            // 바닥은 '위에서 아래로 떨어질 때'만 체크
            if (inX && inZ && velocity.y <= 0) {
                if (playerBottomY <= max.y && playerBottomY >= min.y - 0.5) {
                    if (max.y > upperMaxY) {
                        upperMaxY = max.y;
                        upperFloor = floor;
                        upperisIce = !!floor.userData.isIce;
                    }
                }
            }
        }

        if (upperFloor) {
            isGrounded = true;
            velocity.y = 0;
            sphere.position.y = upperMaxY + 0.25;

            if (isOrtho) {
                sphere.position.z = upperFloor.position.z;
            }
            if (upperisIce) {
                onIce = true;
            }
        }
    }

    // 바닥 확인 후, 속도 갱신
    if (onIce) {
        currentSpeed = ICE_SPEED;

        if (!ice.userData.hasShownMessage) {
            console.log("배달이 지연되고 있어요!");
            ice.userData.hasShownMessage = true;
        }
    }
    else {
        currentSpeed = NORMAL_SPEED;
        ice.userData.hasShownMessage = false;
    }

    isOnIce = onIce;

    const playerBottomY = sphere.position.y - playerRadius;

    ///// 발판 색 바꾸기 /////
    ///// + bigWall 위로 이동 /////
    let allPressed = (steps.length > 0);
    steps.forEach(step => {
        const box = step.bbox;
        const min = box.min;
        const max = box.max;

        // 발판(y) 위?
        const onY = Math.abs(playerBottomY - max.y) < 0.06;

        // x 범위 안?
        const onX =
        sphere.position.x >= min.x - playerRadius &&
        sphere.position.x <= max.x + playerRadius;

        // z 범위 안?
        let onZ = isOrtho ? true : (sphere.position.z >= min.z && sphere.position.z <= max.z);

        const onStep = onX && onY && onZ;

        if (onStep) {
            step.material.color.set(0x7CFC00);
        }
        else {
            step.material.color.copy(step.userData.originalColor);
        }

        if (!onStep) {
            allPressed = false;
        }
    });


    if (allPressed && bigwalls.length > 0 && !bigwalls[0].userData.raised) {
        bigwalls.forEach(wall => {
            wall.position.y += 1.8;
            wall.userData.raised = true;

            wall.updateMatrixWorld();
            wall.geometry.computeBoundingBox();
            wall.bbox = new THREE.Box3().setFromObject(wall);
        });
    }

    // 낙사 체크
    if (sphere.position.y < -10) {
        isGameOver = true;
        gameOverReason = "발을 헛디뎠습니다!";
    }
}

///////////////////////////////////////////////////////////////////////////////
function updateCamera() {
    // 1. 전환 진행도 계산 (Ease-in-out)
    if (isTransitioning) {
        transitionAlpha += 0.03; // 전환 속도
        if (transitionAlpha >= 1) {
            transitionAlpha = 1;
            isTransitioning = false;
            
            // 2D로 완전히 돌아왔으면 Ortho카메라로 교체하여 완벽한 평면 구현
            if (isOrtho) {
                camera = orthoCamera;
                camera.position.set(sphere.position.x, ORTHO_Y, ORTHO_Z);
                camera.lookAt(sphere.position.x, 0, 0);
                return; // Ortho 모드는 여기서 끝
            }
        }
    }

    // Perspective 카메라(전환 중이거나 3D 모드일 때) 처리 로직
    if (camera === perspCamera) {
        // 부드러운 움직임을 위한 Easing 적용
        const t = transitionAlpha < 0.5 
            ? 2 * transitionAlpha * transitionAlpha 
            : 1 - Math.pow(-2 * transitionAlpha + 2, 2) / 2;

        // isOrtho가 true(2D로 가는 중): TPS -> Side
        // isOrtho가 false(3D로 가는 중): Side -> TPS
        // 따라서 비율(ratio)은 3D 상태일 때 1, 2D 상태일 때 0이 되도록 설정
        let ratio = isOrtho ? (1 - t) : t;

        // --- 위치 계산 ---
        // 1. Side View 위치 (공 기준)
        const sideX = sphere.position.x + VIEW_CONFIG.SIDE.offsetX;
        const sideY = VIEW_CONFIG.SIDE.offsetY;
        const sideZ = VIEW_CONFIG.SIDE.offsetZ; // Z축 고정 (화면 밖으로 나오는 깊이 아님)

        // 2. TPS View 위치 (공 기준)
        const tpsX = sphere.position.x + VIEW_CONFIG.TPS.offsetX;
        const tpsY = sphere.position.y + VIEW_CONFIG.TPS.offsetY; // 공 높이 따라감
        const tpsZ = sphere.position.z + VIEW_CONFIG.TPS.offsetZ; // 공 깊이(Z) 따라감

        // 3. 현재 위치 보간
        camera.position.x = lerp(sideX, tpsX, ratio);
        camera.position.y = lerp(sideY, tpsY, ratio);
        camera.position.z = lerp(sideZ, tpsZ, ratio);

        // --- FOV(화각) 계산 ---
        // 망원(평면 느낌) <-> 광각(원근감)
        camera.fov = lerp(VIEW_CONFIG.SIDE.fov, VIEW_CONFIG.TPS.fov, ratio);
        camera.updateProjectionMatrix();

        // --- 시선(LookAt) 계산 ---
        // Side View일 때는 (공X, 0, 0)을 바라봄
        const lookSideX = sphere.position.x;
        const lookSideY = 0;
        const lookSideZ = 0;

        // TPS View일 때는 공 자체를 바라봄 (약간 앞쪽을 보게 하려면 X에 값 추가)
        const lookTpsX = sphere.position.x + 2; // 시선을 진행방향 앞쪽으로
        const lookTpsY = sphere.position.y;
        const lookTpsZ = sphere.position.z;

        const currentLookX = lerp(lookSideX, lookTpsX, ratio);
        const currentLookY = lerp(lookSideY, lookTpsY, ratio);
        const currentLookZ = lerp(lookSideZ, lookTpsZ, ratio);

        camera.lookAt(currentLookX, currentLookY, currentLookZ);
    } else {
        camera.position.x = sphere.position.x;
    }
}
///////////////////////////////////////////////////////////////////////////////

render();

function render() {
    if (isGameOver) {
        alert("Game Over: " + gameOverReason + "\n\n재시작하려면 Enter 키를 누르세요.");
        resetGame();
        requestAnimationFrame(render);
        return;
    }

    // 게이지 로직
    if (!isTransitioning) {
        if (isOrtho) {
            status.gauge -= 0; // 테스트를 위해 감소량 0으로 둠 (필요시 수정)
            if (status.gauge <= 0) {
                isGameOver = true;
                gameOverReason = "투영 게이지가 0이 되었습니다.";
            }
        } else {
            if (status.gauge < 100) status.gauge += 1;
        }
    }

    // 도착 판정
    if (Math.abs(sphere.position.x - goal.position.x) < 0.5 &&
        Math.abs(sphere.position.y - goal.position.y) < 1 &&
        Math.abs(sphere.position.z - goal.position.z) < 1) {
        alert("도착했습니다!");
        return;
    }

    updatePhysics();
    updateCamera();

    requestAnimationFrame(render);
    renderer.render(scene, camera);
}

function resetGame() {
    isGameOver = false;
    gameOverReason = "";
    isTransitioning = false;
    
    // 초기 상태는 2D(Ortho)
    isOrtho = true; // true로 시작해야 함 (코드 맥락상)
    camera = orthoCamera;
    
    camera.position.set(4, ORTHO_Y, ORTHO_Z);
    camera.lookAt(4, 0, 0);

    status.gauge = 100;
    sphere.position.set(4, 1.5, 0);
    velocity.set(0, 0, 0);
}