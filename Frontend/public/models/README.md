# MediaPipe Models

The live camera virtual try-on uses two MediaPipe models, loaded from CDN by default:

## Pose Landmarker
```
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
```

## Image Segmenter (Selfie Multiclass)
```
https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite
```

Used for layered shirt compositing so arms/hands appear over the shirt.

To use local copies for offline use, download the models and update the respective hooks to use `/models/<filename>`.
