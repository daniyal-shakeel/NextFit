export function getMediapipeVisionWasmRoot(): string {
  const raw = import.meta.env.BASE_URL;
  const base = raw.endsWith('/') ? raw : `${raw}/`;
  return new URL(`${base}mediapipe-tasks-vision/wasm/`, window.location.origin).href;
}
