/**
 * MotionMirror — pose retargeting (MediaPipe world landmarks -> Mixamo skeleton)
 *
 * Fixes vs. the old version:
 *  1. The Mixamo X-Bot FBX contains DUPLICATE dummy bones (same name as the real
 *     bone, nested under it, zero position, no children). The old boneMap kept the
 *     LAST bone with a given name = the dummy, so rotating it moved nothing.
 *     We now skip any bone whose parent has the same name.
 *  2. Rest directions are captured in WORLD space at load time (old code used the
 *     child's local position, which is in the wrong coordinate frame and was
 *     (0,0,0) for the dummy bones).
 *  3. Rotation is computed in world space relative to the rest pose, then converted
 *     to the bone's local space using the parent's CURRENT world rotation.
 *  4. No more shared scratch vectors (the old wlm() returned the same object for
 *     every landmark, which made the spine direction zero).
 */
import * as THREE from 'three';

// MediaPipe pose landmark indices
export const MP = {
    NOSE: 0,
    L_EYE_IN: 1, L_EYE: 2, L_EYE_OUT: 3,
    R_EYE_IN: 4, R_EYE: 5, R_EYE_OUT: 6,
    L_EAR: 7, R_EAR: 8,
    MOUTH_L: 9, MOUTH_R: 10,
    L_SHOULDER: 11, R_SHOULDER: 12,
    L_ELBOW: 13,    R_ELBOW: 14,
    L_WRIST: 15,    R_WRIST: 16,
    L_PINKY: 17,   R_PINKY: 18,
    L_INDEX: 19,   R_INDEX: 20,
    L_THUMB: 21,   R_THUMB: 22,
    L_HIP: 23,      R_HIP: 24,
    L_KNEE: 25,     R_KNEE: 26,
    L_ANKLE: 27,    R_ANKLE: 28,
    L_HEEL: 29,     R_HEEL: 30,
    L_FOOT: 31,     R_FOOT: 32,
};

// [bone, childBone, fromLandmark, toLandmark, smoothing]
// Order matters: parents first.
// A landmark entry can also be an array of indices -> their average (e.g. hip centre).
const HIPS_C = [MP.L_HIP, MP.R_HIP];
const SHOULDERS_C = [MP.L_SHOULDER, MP.R_SHOULDER];
const HEAD_C = [MP.NOSE, MP.L_EAR, MP.R_EAR];

const CHAINS = [
    // torso: hips -> shoulders -> neck -> head
    ['mixamorigHips',      'mixamorigSpine',    HIPS_C, SHOULDERS_C, 0.35],
    ['mixamorigSpine',     'mixamorigSpine1',   HIPS_C, SHOULDERS_C, 0.35],
    ['mixamorigSpine1',    'mixamorigSpine2',   HIPS_C, SHOULDERS_C, 0.35],
    ['mixamorigSpine2',    'mixamorigNeck',     HIPS_C, SHOULDERS_C, 0.35],
    ['mixamorigNeck',      'mixamorigHead',     SHOULDERS_C, HEAD_C, 0.6],

    // arms
    ['mixamorigLeftArm',      'mixamorigLeftForeArm',  MP.L_SHOULDER, MP.L_ELBOW, 0.6],
    ['mixamorigLeftForeArm',  'mixamorigLeftHand',     MP.L_ELBOW,    MP.L_WRIST, 0.6],
    ['mixamorigRightArm',     'mixamorigRightForeArm', MP.R_SHOULDER, MP.R_ELBOW, 0.6],
    ['mixamorigRightForeArm', 'mixamorigRightHand',    MP.R_ELBOW,    MP.R_WRIST, 0.6],

    // legs
    ['mixamorigLeftUpLeg',  'mixamorigLeftLeg',   MP.L_HIP,  MP.L_KNEE,  0.55],
    ['mixamorigLeftLeg',    'mixamorigLeftFoot',  MP.L_KNEE, MP.L_ANKLE, 0.55],
    ['mixamorigRightUpLeg', 'mixamorigRightLeg',  MP.R_HIP,  MP.R_KNEE,  0.55],
    ['mixamorigRightLeg',   'mixamorigRightFoot', MP.R_KNEE, MP.R_ANKLE, 0.55],
];

const MIN_VIS = 0.35;

const _tmpV = new THREE.Vector3();
const _qDelta = new THREE.Quaternion();
const _qWorld = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();

/** Build the rig description from a freshly loaded + positioned + scaled FBX model. */
export function buildRig(model) {
    const bones = {};

    model.traverse((o) => {
        if (!o.isBone) return;
        // Skip FBX dummy duplicates (same name as their parent bone)
        if (o.parent && o.parent.isBone && o.parent.name === o.name) return;
        const key = o.name.replace('mixamorig:', 'mixamorig');
        bones[key] = o;
    });

    // World matrices must be current before we measure rest directions
    model.updateMatrixWorld(true);

    const chains = [];
    const missing = [];
    const pa = new THREE.Vector3();
    const pb = new THREE.Vector3();

    for (const [boneName, childName, from, to, alpha] of CHAINS) {
        const bone = bones[boneName];
        const child = bones[childName];
        if (!bone || !child) { missing.push(!bone ? boneName : childName); continue; }

        bone.getWorldPosition(pa);
        child.getWorldPosition(pb);
        const restDir = pb.sub(pa).normalize().clone();
        if (restDir.lengthSq() < 0.5) { missing.push(boneName + '(zero-length)'); continue; }

        chains.push({
            name: boneName,
            bone,
            from, to, alpha,
            restDir,
            restWorldQ: bone.getWorldQuaternion(new THREE.Quaternion()),
        });
    }

    const rootBone = bones.mixamorigHips || bones.mixamorigSpine || null;
    const rootRestForward = rootBone
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 0, 1);

    return { bones, chains, missing, rootBone, rootRestForward };
}

/** world landmark (or average of several) -> three.js vector, y-up, z toward viewer */
function lm(wlm, idx, out) {
    if (Array.isArray(idx)) {
        out.set(0, 0, 0);
        for (const i of idx) {
            const p = wlm[i];
            if (!p || p.v < MIN_VIS) return null;
            out.x += p.x; out.y += -p.y; out.z += -p.z;
        }
        return out.multiplyScalar(1 / idx.length);
    }
    const p = wlm[idx];
    if (!p || p.v < MIN_VIS) return null;
    return out.set(p.x, -p.y, -p.z);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _curr = new THREE.Vector3();
const _rootWorldQ = new THREE.Quaternion();
const _rootLocalQ = new THREE.Quaternion();

function avgLandmark(wlm, indices, out) {
    out.set(0, 0, 0);
    let count = 0;
    for (const i of indices) {
        const p = wlm[i];
        if (!p || p.v < MIN_VIS) continue;
        out.x += p.x;
        out.y += -p.y;
        out.z += -p.z;
        count++;
    }
    if (!count) return null;
    return out.multiplyScalar(1 / count);
}

function footprintSpeed(wlm, prevWlm) {
    if (!wlm || !prevWlm) return 0;

    const samplePairs = [
        [MP.L_ANKLE, MP.R_ANKLE],
        [MP.L_KNEE, MP.R_KNEE],
        [MP.L_WRIST, MP.R_WRIST],
    ];

    let total = 0;
    for (const [leftIndex, rightIndex] of samplePairs) {
        const leftCurr = lm(wlm, leftIndex, _curr);
        const rightCurr = lm(wlm, rightIndex, _prev);
        const leftPrev = lm(prevWlm, leftIndex, _a);
        const rightPrev = lm(prevWlm, rightIndex, _b);

        if (leftCurr && leftPrev) total += leftCurr.distanceTo(leftPrev);
        if (rightCurr && rightPrev) total += rightCurr.distanceTo(rightPrev);
    }

    return total;
}

/**
 * Drive the rig from a 33-entry array of {x,y,z,v} world landmarks.
 * Returns the number of bones that were updated (useful for HUD / debugging).
 */
export function applyPose(rig, wlm) {
    if (!rig || !wlm) return 0;

    const previous = rig.prevWlm || null;
    const gaitBoost = previous ? Math.min(0.30, footprintSpeed(wlm, previous) * 4.0) : 0;
    rig.prevWlm = wlm.map((p) => (p ? { ...p } : null));

    const hipCenter = avgLandmark(wlm, HIPS_C, _a);
    const shoulderCenter = avgLandmark(wlm, SHOULDERS_C, _b);
    if (rig.rootBone && hipCenter && shoulderCenter) {
        const torsoForward = _tmpV.copy(shoulderCenter).sub(hipCenter);
        torsoForward.y = 0;
        if (torsoForward.lengthSq() > 1e-6) {
            torsoForward.normalize();
            const rootRef = new THREE.Vector3(0, 0, 1);
            _qDelta.setFromUnitVectors(rootRef, torsoForward);
            rig.rootBone.getWorldQuaternion(_rootWorldQ);
            _rootLocalQ.copy(_qDelta).multiply(_rootWorldQ);

            if (rig.rootBone.parent) {
                rig.rootBone.parent.getWorldQuaternion(_qParent);
                _qParent.invert();
                _rootLocalQ.premultiply(_qParent);
            }

            rig.rootBone.quaternion.slerp(_rootLocalQ, 0.28);
            rig.rootBone.updateMatrixWorld(true);
        }
    }

    let updated = 0;

    for (const c of rig.chains) {
        const a = lm(wlm, c.from, _a);
        const b = lm(wlm, c.to, _b);
        if (!a || !b) continue;

        const target = _tmpV.copy(b).sub(a);
        if (target.lengthSq() < 1e-8) continue;
        target.normalize();

        // Desired world rotation = (rest dir -> target dir) applied on top of rest world rotation
        _qDelta.setFromUnitVectors(c.restDir, target);
        _qWorld.copy(_qDelta).multiply(c.restWorldQ);

        // Convert to local space using the parent's CURRENT world rotation
        if (c.bone.parent) {
            c.bone.parent.getWorldQuaternion(_qParent);
            _qParent.invert();
            _qWorld.premultiply(_qParent);
        }

        const isLegBone = /Leg|UpLeg|Foot/.test(c.name);
        const isArmBone = /Arm|ForeArm|Hand/.test(c.name);
        const isHeadBone = /Head|Neck/.test(c.name);
        const extra = (isLegBone ? 0.55 : 0) + (isArmBone ? 0.2 : 0) + (isHeadBone ? 0.18 : 0);
        const alpha = Math.min(0.9, c.alpha + gaitBoost + extra * 0.18);

        c.bone.quaternion.slerp(_qWorld, alpha);
        c.bone.updateMatrixWorld(true); // so children see this bone's new rotation
        updated++;
    }
    return updated;
}