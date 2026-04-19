# MediaPipe models (live camera try-on)

The live camera virtual try-on runs entirely in the browser and does not call `/api/tryon`.

## Pose Landmarker

`LiveTryOnCanvas` loads the pose model from a local file:

`/models/pose_landmarker_lite.task`

This file is checked into `public/models/`. It is used for **2D** body landmarks only (normalized coordinates mapped to the overlay canvas).
