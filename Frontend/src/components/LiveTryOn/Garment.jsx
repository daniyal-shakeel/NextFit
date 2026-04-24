import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useStore } from './store';
import * as THREE from 'three';

const LERP_FACTOR_ROOT = 0.35;
const LERP_FACTOR_UPPER = 0.25;
const LERP_FACTOR_LOWER = 0.15;

const Garment = () => {
  const selectedGarment = useStore((state) => state.selectedGarment);
  const { scene } = useGLTF(selectedGarment);
  const groupRef = useRef();
  const { viewport } = useThree();

  const targetPos = useRef(new THREE.Vector3());
  const targetRot = useRef(new THREE.Euler());
  const targetScale = useRef(new THREE.Vector3(1, 1, 1));

  const bones = useRef({
    leftUpperArm: null,
    leftLowerArm: null,
    rightUpperArm: null,
    rightLowerArm: null,
  });

  const restingAngles = useRef(new Map());

  useEffect(() => {
    if (scene) {
      scene.scale.setScalar(1);
      scene.position.set(0, 0, 0);

      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const normalizedScale = 1 / size.x;
      scene.scale.setScalar(normalizedScale);

      const scaledBox = new THREE.Box3().setFromObject(scene);
      scene.position.set(
        -center.x * normalizedScale,
        -scaledBox.max.y,
        -center.z * normalizedScale
      );

      scene.traverse((child) => {
        if (child.isBone) {
          const name = child.name.toLowerCase();
          if (name.includes('left') || name.startsWith('l_')) {
            if (name.includes('lower') || name.includes('forearm') || name.includes('elbow')) {
              bones.current.leftLowerArm = child;
              restingAngles.current.set(child.uuid, child.rotation.z);
            } else if (name.includes('upper') || name.includes('shoulder') || name.includes('arm')) {
              bones.current.leftUpperArm = child;
              restingAngles.current.set(child.uuid, child.rotation.z);
            }
          } else if (name.includes('right') || name.startsWith('r_')) {
            if (name.includes('lower') || name.includes('forearm') || name.includes('elbow')) {
              bones.current.rightLowerArm = child;
              restingAngles.current.set(child.uuid, child.rotation.z);
            } else if (name.includes('upper') || name.includes('shoulder') || name.includes('arm')) {
              bones.current.rightUpperArm = child;
              restingAngles.current.set(child.uuid, child.rotation.z);
            }
          }
        }
      });

      useStore.getState().setModelLoading(false);
    }
  }, [scene]);

  useFrame(() => {
    const landmarks = useStore.getState().landmarks;
    if (!landmarks || !groupRef.current) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;

    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    const neckX = (leftShoulder.x + rightShoulder.x) / 2;
    const neckY = (leftShoulder.y + rightShoulder.y) / 2;
    const x = -(neckX - 0.5) * viewport.width;
    const chinY = nose.y + (neckY - nose.y) * 0.2;
    const y = -(chinY - 0.5) * viewport.height;

    const shoulderSpan = Math.abs(leftShoulder.x - rightShoulder.x) * viewport.width;
    const shoulderHipY = (leftHip.y + rightHip.y) / 2;
    const torsoHeightRaw = Math.abs(shoulderHipY - neckY) * viewport.height;

    const paddingX = 1.7;
    const scaleX = shoulderSpan * paddingX;
    const scaleY = torsoHeightRaw * 1.55;
    const depthScale = Math.max(0.5, 1 - nose.z * 0.4);

    targetPos.current.set(x, y, 0);
    targetScale.current.set(scaleX * depthScale, scaleY * depthScale, scaleX * depthScale);

    const roll = Math.atan2(rightShoulder.y - leftShoulder.y, -(rightShoulder.x - leftShoulder.x));
    const pitch = (nose.z - (leftShoulder.z + rightShoulder.z) / 2) * 0.2;
    targetRot.current.set(pitch, 0, roll);

    if (bones.current.leftUpperArm && leftElbow && leftShoulder) {
      const angle = Math.atan2(leftElbow.y - leftShoulder.y, -(leftElbow.x - leftShoulder.x));
      const diff = angle - Math.PI;
      const restZ = restingAngles.current.get(bones.current.leftUpperArm.uuid) || 0;
      bones.current.leftUpperArm.rotation.z = THREE.MathUtils.lerp(bones.current.leftUpperArm.rotation.z, restZ + diff, LERP_FACTOR_UPPER);
    }
    if (bones.current.leftLowerArm && leftWrist && leftElbow) {
      const angle = Math.atan2(leftWrist.y - leftElbow.y, -(leftWrist.x - leftElbow.x));
      const diff = angle - Math.PI;
      const restZ = restingAngles.current.get(bones.current.leftLowerArm.uuid) || 0;
      bones.current.leftLowerArm.rotation.z = THREE.MathUtils.lerp(bones.current.leftLowerArm.rotation.z, restZ + diff, LERP_FACTOR_LOWER);
    }
    if (bones.current.rightUpperArm && rightElbow && rightShoulder) {
      const angle = Math.atan2(rightElbow.y - rightShoulder.y, -(rightElbow.x - rightShoulder.x));
      const diff = angle - 0;
      const restZ = restingAngles.current.get(bones.current.rightUpperArm.uuid) || 0;
      bones.current.rightUpperArm.rotation.z = THREE.MathUtils.lerp(bones.current.rightUpperArm.rotation.z, restZ + diff, LERP_FACTOR_UPPER);
    }
    if (bones.current.rightLowerArm && rightWrist && rightElbow) {
      const angle = Math.atan2(rightWrist.y - rightElbow.y, -(rightWrist.x - rightElbow.x));
      const diff = angle - 0;
      const restZ = restingAngles.current.get(bones.current.rightLowerArm.uuid) || 0;
      bones.current.rightLowerArm.rotation.z = THREE.MathUtils.lerp(bones.current.rightLowerArm.rotation.z, restZ + diff, LERP_FACTOR_LOWER);
    }

    groupRef.current.position.lerp(targetPos.current, LERP_FACTOR_ROOT);
    groupRef.current.scale.lerp(targetScale.current, LERP_FACTOR_ROOT);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRot.current.x, LERP_FACTOR_ROOT);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRot.current.y, LERP_FACTOR_ROOT);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRot.current.z, LERP_FACTOR_ROOT);
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={scene} />
    </group>
  );
};

export default Garment;
