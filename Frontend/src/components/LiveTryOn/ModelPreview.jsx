import React, { useEffect, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Center, useGLTF } from '@react-three/drei';
import { useStore } from './store';
import * as THREE from 'three';

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <mesh>
          <boxGeometry args={[1, 1.5, 0.2]} />
          <meshStandardMaterial color="#ef4444" wireframe />
        </mesh>
      );
    }
    return this.props.children;
  }
}

const ShirtModel = ({ url, onLoaded }) => {
  const { scene } = useGLTF(url);
  const setModelLoading = useStore((state) => state.setModelLoading);
  const selectedGarment = useStore((state) => state.selectedGarment);

  useEffect(() => {
    if (scene) {
      scene.position.set(0, 0, 0);
      scene.rotation.set(0, 0, 0);
      scene.scale.setScalar(1);

      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scale = 3.5 / maxDim;
        scene.scale.setScalar(scale);
      }
      
      if (url === selectedGarment) {
        setModelLoading(false);
      }
      if (onLoaded) onLoaded();
    }
  }, [scene, url, selectedGarment, setModelLoading, onLoaded]);

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
};

const LoadingMesh = () => (
  <mesh rotation={[0, 0, 0]}>
    <torusGeometry args={[0.5, 0.08, 16, 60]} />
    <meshStandardMaterial color="#6366f1" />
  </mesh>
);

// Full-size preview used in the sidebar
const ModelPreview = ({ visible = true }) => {
  const selectedGarment = useStore((state) => state.selectedGarment);
  const setModelLoading = useStore((state) => state.setModelLoading);

  if (!visible || !selectedGarment) return null;

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '1 / 1',
        borderRadius: '0.5rem',
        border: '1px solid hsl(var(--border))',
        overflow: 'hidden',
        background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
      }}
    >
      <Canvas camera={{ position: [0, 0, 5], fov: 40 }}>
        <ambientLight intensity={1.0} />
        <pointLight position={[3, 5, 3]} intensity={2} />
        <pointLight position={[-3, -2, 3]} intensity={0.8} />
        <Environment preset="city" />
        <React.Suspense fallback={<LoadingMesh />}>
          <ModelErrorBoundary key={selectedGarment}>
            <ShirtModel url={selectedGarment} onLoaded={() => setModelLoading(false)} />
          </ModelErrorBoundary>
        </React.Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={2}
          maxDistance={6}
          makeDefault
        />
      </Canvas>
    </div>
  );
};

// Small thumbnail canvas used inside product cards
export const ModelThumbnail = ({ url }) => {
  if (!url) return null;
  return (
    <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 40 }} gl={{ preserveDrawingBuffer: true }}>
        <ambientLight intensity={1.0} />
        <pointLight position={[3, 5, 3]} intensity={2} />
        <Environment preset="city" />
        <React.Suspense fallback={<LoadingMesh />}>
          <ModelErrorBoundary key={url}>
            <ShirtModel url={url} />
          </ModelErrorBoundary>
        </React.Suspense>
        <OrbitControls enablePan={false} minDistance={2} maxDistance={6} makeDefault />
      </Canvas>
    </div>
  );
};

export default ModelPreview;
