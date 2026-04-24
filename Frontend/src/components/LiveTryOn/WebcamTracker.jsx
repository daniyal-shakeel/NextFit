import React, { useEffect, useRef } from 'react';
import { useStore } from './store';

const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
  [25, 27], [26, 28], [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  // Hand/Fingertip connections
  [15, 17], [15, 19], [15, 21], [17, 19], // Left hand
  [16, 18], [16, 20], [16, 22], [18, 20]  // Right hand
];

const KEY_POINTS = [0, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

const WebcamTracker = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const setLandmarks = useStore((state) => state.setLandmarks);
  const setCameraDenied = useStore((state) => state.setCameraDenied);
  const setPoseReady = useStore((state) => state.setPoseReady);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    let stream = null;
    let animationFrameId = null;
    let poseInstance = null;
    let processing = false;

    const drawLandmarks = (landmarks) => {
      const ctx = canvas.getContext('2d');
      // Set canvas internal resolution to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(0, 255, 170, 0.6)';
      ctx.lineWidth = 3;

      // Because the canvas is scaledX(-1) by CSS, we draw points in raw space (0 to 1) 
      // without flipping the X coordinate mathematically.
      for (const [i, j] of POSE_CONNECTIONS) {
        if (landmarks[i] && landmarks[j]) {
          const x1 = landmarks[i].x * canvas.width;
          const y1 = landmarks[i].y * canvas.height;
          const x2 = landmarks[j].x * canvas.width;
          const y2 = landmarks[j].y * canvas.height;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      for (const idx of KEY_POINTS) {
        if (!landmarks[idx]) continue;
        const x = landmarks[idx].x * canvas.width;
        const y = landmarks[idx].y * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? '#ff3366' : '#00ffaa';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    const waitForPose = () => {
      return new Promise((resolve) => {
        const check = () => {
          if (window.Pose) {
            resolve(window.Pose);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    };

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 1280, height: 720 }
        });
        video.srcObject = stream;
        await new Promise(resolve => { video.onloadedmetadata = resolve; });
        video.play();
        setCameraDenied(false);

        const PoseClass = await waitForPose();

        poseInstance = new PoseClass({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        poseInstance.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        poseInstance.onResults((results) => {
          if (results.poseLandmarks) {
            setLandmarks(results.poseLandmarks);
            drawLandmarks(results.poseLandmarks);
          }
        });

        await poseInstance.initialize();
        setPoseReady(true);

        const processFrame = async () => {
          if (video.readyState === 4 && !processing) {
            processing = true;
            try {
              await poseInstance.send({ image: video });
            } catch (e) {}
            processing = false;
          }
          animationFrameId = requestAnimationFrame(processFrame);
        };

        processFrame();

      } catch (err) {
        setCameraDenied(true);
      }
    };

    startCamera();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (poseInstance) poseInstance.close();
    };
  }, [setLandmarks, setCameraDenied, setPoseReady]);

  return (
    <div className="webcam-container absolute inset-0 z-0 overflow-hidden">
      <video ref={videoRef} playsInline className="webcam-video w-full h-full object-cover -scale-x-100" />
      <canvas ref={canvasRef} className="tracking-canvas absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none" />
    </div>
  );
};

export default WebcamTracker;
