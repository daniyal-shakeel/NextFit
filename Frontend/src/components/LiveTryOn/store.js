import { create } from 'zustand';

// Dynamically discover all GLB models in the public/glb directory
// Note: We use eager: true to get the values immediately
const glbModels = import.meta.glob('/public/glb/*.glb', { eager: true, as: 'url' });

export const models = Object.entries(glbModels).map(([path, url]) => {
  const fileName = path.split('/').pop() || '';
  const name = fileName.replace('.glb', '').replace(/-/g, ' ').replace(/_/g, ' ');
  // In Vite, public assets globbed with /public/ prefix should have the prefix removed for the final URL
  const finalUrl = url.replace('/public', '');
  return {
    id: fileName,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    path: finalUrl
  };
});

export const useStore = create((set) => ({
  landmarks: null,
  cameraDenied: false,
  poseReady: false,
  modelLoading: true,
  cameraSessionActive: false,
  appMode: 'home',
  availableModels: models,
  selectedGarment: models.length > 0 ? models[0].path : '',
  setLandmarks: (landmarks) => set({ landmarks }),
  setCameraDenied: (denied) => set({ cameraDenied: denied }),
  setPoseReady: (ready) => set({ poseReady: ready }),
  setModelLoading: (loading) => set({ modelLoading: loading }),
  setCameraSessionActive: (active) => set({ cameraSessionActive: active }),
  setSelectedGarment: (path) => set({ selectedGarment: path, modelLoading: true }),
  setAppMode: (mode) => set({ appMode: mode, landmarks: null, cameraDenied: false, poseReady: false, modelLoading: true })
}));
