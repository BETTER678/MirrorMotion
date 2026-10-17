/**
 * MotionMirror — Real-Time Avatar Pose Retargeting
 * ================================================
 * Fixes:
 *  1. avatar.fbx == idle.fbx (no separate mesh) → override ALL materials
 *     with bright MeshToonMaterial so even a rig-only FBX is visible
 *  2. Added SkeletonHelper (glowing skeleton) as guaranteed visible fallback
 *  3. Correct scale auto-detect: measure bounding box after load
 *  4. Uses world landmarks (metres) for retargeting
 *  5. Full body: arms, forearms, legs, shins, feet, spine, shoulders, neck
 *  6. Live webcam preview streamed from the pose server
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { buildRig, applyPose as retargetPose } from './retarget.js';

// ─────────────────────────────────────────────────────────────────────────────
// SCENE
// ─────────────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0d1a);
scene.fog = new THREE.Fog(0x0d0d1a, 20, 60);

function sceneWidth() {
    return window.innerWidth > 760 ? Math.floor(window.innerWidth * 0.72) : window.innerWidth;
}

const camera = new THREE.PerspectiveCamera(50, sceneWidth() / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.5, 4);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sceneWidth(), window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.left = '0';
renderer.domElement.style.top = '0';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = sceneWidth() / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(sceneWidth(), window.innerHeight);
});

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTS
// ─────────────────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 2.5));

const sun = new THREE.DirectionalLight(0xfff0e0, 4);
sun.position.set(4, 8, 6);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(2048);
sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
sun.shadow.camera.top  =  4; sun.shadow.camera.bottom= -4;
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 30;
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0x8888ff, 1.5);
fillLight.position.set(-4, 3, -2);
scene.add(fillLight);

const accentLight = new THREE.PointLight(0xff80ff, 2, 10);
accentLight.position.set(0, 3, 2);
scene.add(accentLight);

// ─────────────────────────────────────────────────────────────────────────────
// FLOOR
// ─────────────────────────────────────────────────────────────────────────────
const floor = new THREE.Mesh(
    new THREE.CircleGeometry(12, 64),
    new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.85 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Glow ring on floor
const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.0, 64),
    new THREE.MeshBasicMaterial({ color: 0xe879f9, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.001;
scene.add(ring);

// ─────────────────────────────────────────────────────────────────────────────
// TEST CUBE  — temporary pink cube so we can confirm camera is aimed correctly
// We'll hide it once the avatar loads
// ─────────────────────────────────────────────────────────────────────────────
const testCube = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 1.7, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xe879f9, roughness: 0.4 })
);
testCube.position.set(0, 0.85, 0);
testCube.castShadow = true;
scene.add(testCube);

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR LOADER
// ─────────────────────────────────────────────────────────────────────────────
const fbxLoader = new FBXLoader();

let avatar = null;
let rig = null;          // built by buildRig() after the FBX loads

fbxLoader.load(
    '/models/avatar.fbx',
    (model) => {
        // ── 1. Measure the raw bounding box ──────────────────────────────────
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        console.log('[Avatar] Raw bounding box size:', size, '  center:', center);

        // ── 2. Auto-scale so avatar is ~1.7 units tall ───────────────────────
        const tallestDim = Math.max(size.x, size.y, size.z);
        const desiredHeight = 1.7;
        const scale = desiredHeight / (tallestDim || 1);
        model.scale.setScalar(scale);

        // ── 3. Place feet on the floor (y = 0) ───────────────────────────────
        // After scaling, recalculate bottom of model
        const boxScaled = new THREE.Box3().setFromObject(model);
        const bottomY = boxScaled.min.y;
        model.position.set(0, -bottomY, 0);

        // ── 4. Override ALL materials so the model is definitely visible ─────
        let meshCount = 0;
        model.traverse((obj) => {
            console.log('[Avatar] Object:', obj.type, obj.name);

            // Handle both Mesh and SkinnedMesh
            if (obj.isMesh) {
                meshCount++;
                obj.castShadow = true;
                obj.receiveShadow = true;
                obj.visible = true;
                obj.frustumCulled = false;  // CRITICAL: prevent invisible culling

                // Replace with a plain bright Phong material — no texture needed
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                obj.material = mats.map((_, i) =>
                    new THREE.MeshPhongMaterial({
                        color: i % 2 === 0 ? 0xff88cc : 0xffccee,
                        emissive: 0x330022,
                        shininess: 60,
                        side: THREE.FrontSide,
                        transparent: false,
                        opacity: 1.0,
                        depthTest: true,
                        depthWrite: true,
                    })
                );
                if (obj.material.length === 1) obj.material = obj.material[0];

                console.log(`[Avatar] Mesh #${meshCount}:`, obj.name,
                    '| verts:', obj.geometry?.attributes?.position?.count ?? '?');
            }

        });

        
        // ── 5. Add SkeletonHelper (always visible, even for rig-only FBX) ───
        const helper = new THREE.SkeletonHelper(model);
        helper.material.linewidth = 3;
        // Bright cyan skeleton lines
        helper.material = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
        scene.add(helper);

        // ── 6. Build the retargeting rig (skips FBX dummy duplicate bones,
        //       captures world-space rest directions) ───────────────────────
        model.updateMatrixWorld(true);
        rig = buildRig(model);
        console.log('[Rig] chains:', rig.chains.map(c => c.name));
        if (rig.missing.length) console.warn('[Rig] MISSING bones:', rig.missing);

        avatar = model;
        scene.add(avatar);

        // Debug: yellow bounding box — shows exactly where the model sits in world space
        const boxHelper = new THREE.BoxHelper(avatar, 0xffff00);
        scene.add(boxHelper);

        // Log final world position for debugging
        const finalBox = new THREE.Box3().setFromObject(avatar);
        console.log('[Avatar] FINAL world bbox:', finalBox.min, '→', finalBox.max);
        console.log('[Avatar] Camera pos:', camera.position);
        console.log('[Avatar] Mesh count:', meshCount);

        // Hide the test cube once the real avatar is in
        testCube.visible = meshCount === 0;
        // If no mesh found, keep test cube + skeleton helper visible
        if (meshCount === 0) {
            setStatus(`⚠ No mesh in FBX — skeleton only (${Object.keys(rig.bones).length} bones)`, '#ffcc00');
        } else {
            setStatus(`✅ Avatar loaded — ${meshCount} meshes`, '#7dffb3');
        }

    },
    (xhr) => {
        const pct = ((xhr.loaded / xhr.total) * 100).toFixed(0);
        setStatus(`Loading avatar… ${pct}%`, '#aaa');
    },
    (err) => {
        setStatus('❌ Avatar failed to load', '#ff6b6b');
        console.error('[Avatar] Load error:', err);
        // Keep the test cube as visible placeholder
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// MUSIC
// ─────────────────────────────────────────────────────────────────────────────
const audio = new Audio('/songs/garba.mp3');
audio.loop = true;
audio.preload = 'auto';

const musicBtn = makeButton('▶ Play Music', '24px', async () => {
    if (audio.paused) {
        try { await audio.play(); musicBtn.textContent = '❚❚ Pause Music'; }
        catch { alert('Click OK then try the button again.'); }
    } else {
        audio.pause();
        musicBtn.textContent = '▶ Play Music';
    }
});

function makeButton(label, bottom, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
        position: 'fixed', left: '50%', bottom,
        transform: 'translateX(-50%)',
        padding: '12px 28px', border: 'none', borderRadius: '12px',
        background: 'linear-gradient(135deg,#e879f9,#a855f7)',
        color: '#fff', fontSize: '15px', fontWeight: '700',
        cursor: 'pointer', zIndex: '20',
        boxShadow: '0 4px 20px rgba(168,85,247,0.5)',
    });
    btn.addEventListener('click', onClick);
    document.body.appendChild(btn);
    return btn;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS HUD
// ─────────────────────────────────────────────────────────────────────────────
const hudEl = document.createElement('div');
Object.assign(hudEl.style, {
    position: 'fixed', top: '14px', left: '14px',
    color: '#e0e0ff', background: 'rgba(10,10,30,0.82)',
    padding: '10px 16px', borderRadius: '10px',
    font: '13px/1.7 "Segoe UI",monospace',
    zIndex: '20', border: '1px solid rgba(168,85,247,0.3)',
    minWidth: '220px',
});
document.body.appendChild(hudEl);

function setStatus(msg, color = '#fff') {
    hudEl.innerHTML = `<b style="color:#e879f9">MotionMirror</b><br><span style="color:${color}">${msg}</span>`;
}
setStatus('Loading avatar…', '#aaa');

// ─────────────────────────────────────────────────────────────────────────────
// SERVER-STREAMED CAMERA PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
const previewPanel = document.createElement('section');
Object.assign(previewPanel.style, {
    position: 'fixed', right: '2vw', top: '50%',
    transform: 'translateY(-50%)', width: 'clamp(180px, 23vw, 340px)',
    padding: '10px', borderRadius: '14px',
    background: 'rgba(10,10,30,0.88)',
    border: '1px solid rgba(168,85,247,0.45)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: '20',
});
const previewTitle = document.createElement('div');
previewTitle.textContent = 'LIVE CAMERA';
Object.assign(previewTitle.style, {
    marginBottom: '8px', color: '#e879f9',
    font: '700 12px/1.4 "Segoe UI",sans-serif', letterSpacing: '1px',
});
const previewImage = document.createElement('img');
previewImage.alt = 'Live webcam view used for pose tracking';
Object.assign(previewImage.style, {
    display: 'none', width: '100%', aspectRatio: '4 / 3',
    objectFit: 'cover', borderRadius: '8px', transform: 'scaleX(-1)',
});
const previewPlaceholder = document.createElement('div');
previewPlaceholder.textContent = 'Waiting for webcam…';
Object.assign(previewPlaceholder.style, {
    display: 'grid', placeItems: 'center', width: '100%',
    aspectRatio: '4 / 3', borderRadius: '8px',
    color: '#a0a0c0', background: 'rgba(255,255,255,0.05)',
    font: '13px "Segoe UI",sans-serif',
});
previewPanel.append(previewTitle, previewImage, previewPlaceholder);
document.body.appendChild(previewPanel);

const previewUrls = new Set();
previewImage.addEventListener('load', () => {
    for (const url of previewUrls) {
        if (url !== previewImage.src) {
            URL.revokeObjectURL(url);
            previewUrls.delete(url);
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET
// ─────────────────────────────────────────────────────────────────────────────
let latestWLM = null;
let hasPose = false;
let wsConnected = false;
let cameraUnavailable = false;

function connectWS() {
    const ws = new WebSocket('ws://localhost:8765');
    ws.addEventListener('open', () => { wsConnected = true; });
    ws.addEventListener('message', ({ data }) => {
        if (data instanceof Blob) {
            const url = URL.createObjectURL(data);
            previewUrls.add(url);
            previewImage.src = url;
            previewImage.style.display = 'block';
            previewPlaceholder.style.display = 'none';
            return;
        }
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'pose' && msg.wlm?.length >= 33) {
                latestWLM = msg.wlm;
                hasPose = true;
                cameraUnavailable = false;
            } else if (msg.type === 'camera_error') {
                hasPose = false;
                cameraUnavailable = true;
            } else {
                hasPose = false;
                cameraUnavailable = false;
            }
        } catch {}
    });
    ws.addEventListener('close', () => {
        wsConnected = false; hasPose = false; cameraUnavailable = false;
        setTimeout(connectWS, 2000);
    });
}
connectWS();

// ─────────────────────────────────────────────────────────────────────────────
// RENDER LOOP
// ─────────────────────────────────────────────────────────────────────────────
let fps = 0, frames = 0, fpsTimer = performance.now();

function animate() {
    requestAnimationFrame(animate);

    frames++;
    const now = performance.now();
    if (now - fpsTimer >= 1000) {
        fps = frames;
        frames = 0;
        fpsTimer = now;
    }

    if (wsConnected && hasPose && avatar && rig) {
        const moved = retargetPose(rig, latestWLM);
        if (moved < 7) {
            setStatus(`🟡 Partial tracking | ${moved}/${rig.chains.length} bones | show full body`, '#ffe07d');
        } else {
            setStatus(`🟢 Tracking | ${fps} fps | ${moved}/${rig.chains.length} bones`, '#7dffb3');
        }
    } else if (wsConnected && cameraUnavailable) {
        setStatus('🔴 Webcam unavailable — close other camera apps', '#ff6b6b');
    } else if (wsConnected) {
        setStatus('🟡 Show full body to camera', '#ffe07d');
    } else if (avatar) {
        setStatus('🔴 Start the motion_server.py pose server', '#ff6b6b');
    } else {
        setStatus('Loading avatar…', '#aaa');
    }

    renderer.render(scene, camera);
}

animate();