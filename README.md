# MotionMirror

MotionMirror is a local real-time motion-mirroring prototype. A Python process captures webcam frames and estimates body landmarks with MediaPipe. It streams pose data over WebSocket to a Vite/Three.js frontend, which retargets the landmarks onto an FBX avatar.

> **Project status:** prototype/demo. Pose estimation and avatar retargeting are approximate; this is not a motion-capture system and cannot guarantee an exact copy of a person's movements. Tracking quality depends on camera placement, lighting, visibility, the pose model, and how well the avatar's skeleton matches the expected rig.

## Features

- Webcam pose tracking with MediaPipe Pose Landmarker.
- Live landmark streaming and a compressed camera preview over WebSocket.
- Three.js browser scene with an FBX avatar and live pose retargeting.
- Skeleton, tracking status, and camera preview for local debugging.
- Separate experimental scripts for movement detection and music beat analysis.

## How it works

1. [`motion_server.py`](./motion_server.py) reads frames from the local webcam and runs the MediaPipe pose model.
2. The server streams 2D/world landmark messages and preview images at `ws://localhost:8765`.
3. The Vite frontend connects to the local WebSocket server and renders the avatar in the browser at `http://localhost:5173`.
4. [`frontend/src/retarget.js`](./frontend/src/retarget.js) maps selected MediaPipe landmarks to Mixamo-style avatar bones.

The server and the browser are intended to run on the same computer. Webcam frames and landmarks are streamed locally; this project does not include a hosted backend.

## Requirements

- Windows 10/11 (the included launcher is a Windows batch file)
- Python 3.10 or newer, with a version supported by the installed MediaPipe release
- Node.js and npm (use a current LTS release)
- A webcam and permission for Python to access it
- A browser with WebGL support

## Setup

Open PowerShell or Command Prompt in the repository root.

### 1. Create a Python environment and install packages

```bat
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

[`requirements.txt`](./requirements.txt) lists the Python packages used by the project. `mediapipe`, `opencv-python`, and `websockets` support the live pose server; `numpy`, `librosa`, and `pygame` support the optional audio/beat scripts.

### 2. Install frontend dependencies

```bat
cd frontend
npm install
cd ..
```

The frontend package manifest and lockfile are in [`frontend/`](./frontend/).
Frontend dependencies are installed separately with npm; they are not listed in the Python `requirements.txt`.

## Run

### Windows launcher

From the repository root:

```bat
start.bat
```

The launcher starts the webcam pose server and Vite development server in separate windows, then opens the frontend in a browser.

### Run services manually

Start the pose server in one terminal from the repository root:

```bat
.\.venv\Scripts\python.exe motion_server.py
```

Start the frontend in a second terminal:

```bat
cd frontend
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Keep both processes running while using the app.

## Camera and tracking tips

- Put the camera far enough away to keep your whole body in frame, including feet.
- Use even, bright lighting and avoid strong backlighting.
- Keep the camera stable and avoid motion blur.
- For turns, keep as much of the body visible as possible. A single front-facing webcam may lose or confuse landmarks when body parts overlap or the person turns fully away.
- Running/jogging capture depends on frame rate, available space, and the model's ability to keep landmarks visible. This prototype estimates pose from individual video frames; it does not reconstruct exact world position, contact, or foot placement.
- The avatar needs a compatible skeleton. The current retargeter expects Mixamo-style bone names; other rigs may need their own mapping.

## Optional scripts

### Movement detector prototype

```bat
.\.venv\Scripts\python.exe movement_detector.py
```

### Simple webcam pose viewer

```bat
.\.venv\Scripts\python.exe main.py
```

### Analyze the demo song's beats

```bat
.\.venv\Scripts\python.exe beat_detector.py
```

The beat detector uses `songs/garba.mp3` and writes beat timings to `beat_times.npy` and `frontend/public/beat_times.json`. These scripts are separate experiments; the current live motion server does not synchronize the avatar to music.

## Repository layout

```text
MirrorMotion/
├── README.md
├── requirements.txt           # Python package dependencies
├── .gitignore
├── main.py                    # Simple webcam pose viewer
├── motion_server.py           # Webcam pose server and WebSocket stream
├── movement_detector.py       # Movement detection experiment
├── beat_detector.py           # Music beat analysis experiment
├── start.bat                  # Windows launcher
├── package.json               # Root JavaScript dependency manifest
├── package-lock.json          # Root JavaScript lockfile
├── models/
│   └── pose_landmarker_lite.task
├── songs/
│   └── garba.mp3
└── frontend/
    ├── package.json
    ├── package-lock.json
    ├── public/
    │   ├── models/avatar.fbx
    │   ├── animations/
    │   ├── songs/
    │   └── beat_times.json
    └── src/
        ├── main.js
        └── retarget.js
```

The model, avatar, audio, and animation files are runtime assets and are intentionally not excluded by `.gitignore`. Before publishing them, verify that you have permission to redistribute each asset.

## Troubleshooting

### Webcam unavailable

- Allow camera access for desktop apps in Windows privacy settings.
- Close other applications that may be using the camera.
- Check the pose-server terminal for webcam errors.

### Frontend cannot connect to the pose server

- Confirm that `motion_server.py` is running.
- Check that port `8765` is not already occupied by another process.
- Keep the browser and server on the same computer; the frontend currently connects to `localhost`.

### Avatar does not move or is missing

- Confirm that `frontend/public/models/avatar.fbx` exists.
- Use a compatible FBX avatar with the expected Mixamo-style bone names.
- Check the browser developer console for model loading or WebGL errors.

### npm or Python command not found

- Install Node.js/npm and Python, then open a new terminal so PATH updates are applied.
- Activate or call the Python virtual environment's executable as shown in the setup instructions.

## GitHub publishing checklist

- Commit source code, manifests/lockfiles, documentation, and runtime assets only when their licenses permit redistribution.
- Do not commit `.venv/`, `node_modules/`, local environment files, caches, or generated build output; the root `.gitignore` excludes these.
- Add a `LICENSE` file before distributing the project. No project license is currently provided.
- Do not upload private webcam recordings or other personal data.

## License

No license is currently included. All rights remain with their respective owners; add an explicit license before permitting reuse or redistribution.
