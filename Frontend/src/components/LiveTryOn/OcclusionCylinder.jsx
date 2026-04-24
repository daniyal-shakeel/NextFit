import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from './store';
import * as THREE from 'three';

const LERP_FACTOR = 0.25;

const OcclusionCylinder = () => {
  const meshRef = useRef();
  const { viewport } = useThree();

  const targetPos = useRef(new THREE.Vector3());
  const targetScale = useRef(new THREE.Vector3(1, 1, 1));
  const targetRot = useRef(new THREE.Euler());

  useFrame(() => {
    const landmarks = useStore.getState().landmarks;
    if (!landmarks || !meshRef.current) {
      if (meshRef.current) meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;

    const left = landmarks[11];
    const right = landmarks[12];
    const nose = landmarks[0];

    const neckX = (left.x + right.x) / 2;
    const neckY = (left.y + right.y) / 2;

    const x = -(neckX - 1) * viewport.width;
    const y = -(neckY - 1) * viewport.height;

    const shoulderDist = Math.sqrt(
      ((left.x - right.x) * viewport.width) ** 2 +
      ((left.y - right.y) * viewport.height) ** 2
    );

    const noseY = -(nose.y - 0.5) * viewport.height;
    const cylinderY = (y + noseY) / 2;

    const angle = Math.atan2(right.y - left.y, -(right.x - left.x));
    const yaw = Math.atan2((right.z - left.z) * 2, -(right.x - left.x));

    targetPos.current.set(x, cylinderY, 0.1);
    const widthRaw = shoulderDist * 0.4;
    targetScale.current.set(widthRaw, shoulderDist * 0.8, widthRaw);
    targetRot.current.set(0, yaw, angle);

    // Smoothing
    meshRef.current.position.lerp(targetPos.current, LERP_FACTOR);
    meshRef.current.scale.lerp(targetScale.current, LERP_FACTOR);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRot.current.y, LERP_FACTOR);
    meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRot.current.z, LERP_FACTOR);
  });

  return (
    <mesh ref={meshRef} visible={false} renderOrder={-1}>
      <cylinderGeometry args={[1, 1, 1, 32]} />
      <meshBasicMaterial colorWrite={false} depthWrite={true} />
    </mesh>
  );
};

export default OcclusionCylinder;
