import * as THREE from 'three';

const floorPositions = [
    { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 },
    { x: 16, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 24, y: 0, z: -20 },
    { x: 28, y: 0, z: 0 }, { x: 33.5, y: 0, z: 0 }, { x: 37.5, y: 0, z: 0 },
    { x: 41.5, y: 0, z: 0 }
];

const floorGeometry = new THREE.BoxGeometry(4, 0.5, 10);
const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x964b00 });
const floors = [];

floorPositions.forEach(pos => {
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set(pos.x, pos.y, pos.z);
    floor.userData.originalZ = floor.position.z;
    floor.geometry.computeBoundingBox();
    floor.bbox = new THREE.Box3().setFromObject(floor);
    //scene.add(floor);
    floors.push(floor);
});


///// 빙판길 추가 /////
const iceGeometry = new THREE.BoxGeometry(5, 0.2, 1.5);
const iceMeterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
const ice = new THREE.Mesh(iceGeometry, iceMeterial);

ice.position.set(28, 0.2, 0);
ice.userData.originalZ = ice.position.z;
ice.userData.isIce = true;
ice.geometry.computeBoundingBox();
ice.bbox = new THREE.Box3().setFromObject(ice);

floors.push(ice);
///////////////////


const obstacles = [];

const pillarPositions = [
    { x: 6, y: 4, z: -3 }, { x: 10, y: 4, z: 2 }
];

// const pillarGeometry = new THREE.BoxGeometry(1, 5, 1);
// const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0xf5f5dc });
const pillars = [];

// pillarPositions.forEach(pos => {
//     const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
//     pillar.position.set(pos.x, pos.y, pos.z);
//     pillar.userData.originalZ = pillar.position.z;
//     pillar.geometry.computeBoundingBox();
//     pillar.bbox = new THREE.Box3().setFromObject(pillar);
//     //scene.add(pillar);
//     pillars.push(pillar);
//     obstacles.push(pillar);
// });



const wallPositions = [
    { x: 14, y: 1, z: 0 }
];

const wallGeometry = new THREE.BoxGeometry(1, 1.5, 10); 
const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xa8b2d2 });
const walls = [];

wallPositions.forEach(pos => {
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(pos.x, pos.y, pos.z);
    wall.userData.originalZ = wall.position.z;
    wall.geometry.computeBoundingBox();
    wall.bbox = new THREE.Box3().setFromObject(wall);
    //scene.add(wall);
    walls.push(wall);
    obstacles.push(wall);
});

const bigWallPositions = [
    { x: 37, y: 2.5, z: 0}
];

const bigWallGeometry = new THREE.BoxGeometry(1, 5, 10); 
const bigWallMaterial = new THREE.MeshLambertMaterial({ color: 0xa8b2d2 });
const bigwalls = [];

bigWallPositions.forEach(pos => {
    const bigwall = new THREE.Mesh(bigWallGeometry, bigWallMaterial);
    bigwall.position.set(pos.x, pos.y, pos.z);
    bigwall.userData.originalZ = bigwall.position.z;
    bigwall.userData.raised = false; // 발판 밟았을 때 벽 이동 한 번만 하도록
    bigwall.geometry.computeBoundingBox();
    bigwall.bbox = new THREE.Box3().setFromObject(bigwall);
    bigwalls.push(bigwall);
    obstacles.push(bigwall);
});


///// 밟는 발판 추가 /////
const stepPositions = [
    { x: 33, y: 0.2, z: -2 }, { x: 34, y: 0.2, z: 3}
]

const stepGeometry = new THREE.BoxGeometry(1, 0.2, 1);
const stepMaterial = new THREE.MeshLambertMaterial({ color: 0xffa500 });
const steps = [];

stepPositions.forEach(pos => {
    const material = stepMaterial.clone();
    const step = new THREE.Mesh(stepGeometry, material);
    step.position.set(pos.x, pos.y, pos.z);
    step.userData.originalZ = step.position.z;

    step.userData.originalColor = material.color.clone();
    step.geometry.computeBoundingBox();
    step.bbox = new THREE.Box3().setFromObject(step);
    steps.push(step);
    obstacles.push(step);
})
//////////////////////////////


const goalGeometry = new THREE.IcosahedronGeometry(0.5, 0);
const goalMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
const goal = new THREE.Mesh(goalGeometry, goalMaterial);
goal.position.set(40, 0.7, 0);
//scene.add(goal);

export { floors, pillars, walls, obstacles, goal, ice, pillarPositions, steps, bigwalls };