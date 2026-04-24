import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, useGLTF } from '@react-three/drei';
import Garment from './Garment';
import OcclusionCylinder from './OcclusionCylinder';
import { models } from './store';

// Preload all models so both ModelPreview and Garment share the same cached GLB
models.forEach((m) => useGLTF.preload(m.path));

const Scene = () => {
  return (
    <div className="canvas-container w-full h-full absolute inset-0 z-10 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.0} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        <Environment preset="city" />
        <Suspense fallback={null}>
          <OcclusionCylinder />
          <Garment />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default Scene;

