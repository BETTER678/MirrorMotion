# MotionMirror 🎭

### Real-Time Webcam Motion Mirroring with Python, MediaPipe, Three.js & WebSockets

MotionMirror is a local real-time motion-mirroring prototype that tracks a person's body movements through a webcam and retargets estimated pose landmarks onto a 3D avatar in the browser.

Built using **Python, MediaPipe, WebSockets, Vite, and Three.js**, the project connects real-time pose estimation with 3D avatar animation.

> **Project Status:** Prototype / Demo
> Motion tracking and avatar retargeting are approximate. This project is not a professional motion-capture system and does not guarantee an exact reproduction of human movement.

---

## ✨ Features

- 🎥 **Real-Time Pose Tracking** — Estimates body landmarks using MediaPipe Pose Landmarker.
- 🦴 **3D Avatar Retargeting** — Maps selected body landmarks to Mixamo-style avatar bones.
- 🔄 **Live WebSocket Communication** — Streams pose data between the Python server and browser.
- 📷 **Camera Preview** — Displays a compressed webcam preview for debugging.
- 🧍 **Skeleton Visualization** — Helps inspect body landmarks and tracking behavior.
- 🌐 **Browser-Based 3D Scene** — Renders the avatar using Three.js.
- 🎵 **Experimental Beat Detection** — Includes a separate script for analyzing music beats.
- 💻 **Local Execution** — Designed to run on your own computer without a hosted backend.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Python | Webcam processing and pose estimation |
| MediaPipe | Human body landmark detection |
| OpenCV | Webcam frame capture and image processing |
| WebSockets | Real-time communication |
| NumPy | Numerical operations |
| JavaScript | Frontend logic and pose retargeting |
| Three.js | 3D rendering and avatar visualization |
| Vite | Frontend development server |
| FBX | 3D avatar and animation assets |
| Librosa | Experimental audio and beat analysis |
| Pygame | Optional audio-related experiments |

---

## 🏗️ System Architecture

```text
          ┌──────────────────────┐
          │       Webcam         │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ Python + OpenCV      │
          │ Frame Capture        │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ MediaPipe Pose       │
          │ Landmark Estimation  │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ WebSocket Server     │
          │ localhost:8765       │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ Vite + Three.js      │
          │ Browser Frontend     │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ 3D Avatar Retargeting│
          │ Live Pose Updates    │
          └──────────────────────┘
```

### How It Works

1. **Capture:** Python captures video frames from the webcam using OpenCV.
2. **Detect:** MediaPipe estimates body landmarks from the captured frames.
3. **Stream:** The Python server sends pose information and camera preview data over WebSockets.
4. **Connect:** The Vite frontend connects to the local server.
5. **Retarget:** The frontend maps selected landmarks to the avatar's compatible skeleton.
6. **Render:** Three.js updates and displays the avatar in the browser.

The Python server and frontend are intended to run on the same computer. Webcam frames and pose data are streamed locally.

---

## 📁 Project Structure

```text
MotionMirror/
├── models/
│   └── pose_landmarker_lite.task
├── songs/
│   └── garba.mp3
├── frontend/
│   ├── public/
│   │   ├── models/
│   │   │   └── avatar.fbx
│   │   ├── animations/
│   │   ├── songs/
│   │   └── beat_times.json
│   ├── src/
│   │   ├── main.js
│   │   └── retarget.js
│   ├── package.json
│   └── package-lock.json
├── motion_server.py
├── movement_detector.py
├── beat_detector.py
├── main.py
├── requirements.txt
├── start.bat
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

### Important Files

- `motion_server.py` — Runs webcam capture, pose estimation, and the WebSocket server.
- `frontend/src/main.js` — Initializes the browser scene, loads the avatar, and manages frontend behavior.
- `frontend/src/retarget.js` — Maps estimated body landmarks to avatar bones.
- `main.py` — Runs a simple webcam pose viewer.
- `movement_detector.py` — Contains experimental movement-detection logic.
- `beat_detector.py` — Analyzes music to estimate beat timings.
- `start.bat` — Launches the local server and frontend on Windows.
- `models/pose_landmarker_lite.task` — MediaPipe pose model asset.

---

## ⚙️ Requirements

Before running MotionMirror, install or prepare the following:

- Windows 10 or Windows 11
- Python 3.10 or newer, compatible with the selected MediaPipe version
- Node.js and npm
- A working webcam
- A modern browser with WebGL support
- A compatible FBX avatar with Mixamo-style bone names

**Note:** Python and MediaPipe compatibility depends on the installed package versions. Use a supported Python version if installation fails.

---

## 🚀 Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/BETTER678/MirrorMotion.git
cd MirrorMotion
```

### 2. Create a Python Virtual Environment

```bash
python -m venv .venv
```

Upgrade pip:

```bat
.\.venv\Scripts\python.exe -m pip install --upgrade pip
```

### 3. Install Python Dependencies

```bat
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

The Python dependencies include packages used for pose tracking, webcam processing, WebSocket communication, and optional audio experiments.

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

The frontend uses its own `package.json` and lockfile.

---

## ▶️ Run the Application

### Option 1: Use the Windows Launcher

From the repository root, run:

```bat
start.bat
```

The launcher is intended to start the Python pose server and Vite development server in separate windows and open the frontend in a browser.

### Option 2: Start the Services Manually

**Terminal 1 — Python pose server**

Run this command from the repository root:

```bat
.\.venv\Scripts\python.exe motion_server.py
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

Open the local URL printed by Vite, normally:

[http://localhost:5173](http://localhost:5173/)

Keep both processes running while using the application.

The WebSocket server normally listens at:

`ws://localhost:8765`

---

## 📸 Camera Setup and Tracking Tips

For better tracking results:

- Position the camera far enough away to capture your full body, including your feet.
- Use bright, even lighting.
- Keep the camera stable and minimize motion blur.
- Avoid backgrounds and lighting conditions that make your body difficult to distinguish.
- Keep your arms and legs visible whenever possible.
- Avoid turning completely away from a single front-facing camera.

### Avatar Compatibility

The retargeting logic expects Mixamo-style bone names. If your avatar uses a different skeleton, the bone mapping may need to be adjusted.

### Current Limitations

- Pose estimation may become unreliable when body parts overlap.
- Rapid movements can reduce tracking accuracy.
- A single webcam cannot reliably reconstruct every 3D movement or exact foot placement.
- Avatar proportions and skeleton structure affect retargeting quality.
- The current prototype does not provide guaranteed motion-capture accuracy.
- Music beat detection is a separate experiment and is not currently synchronized with the live avatar motion server.

---

## 🧪 Optional Experiments

### Simple Webcam Pose Viewer

```bat
.\.venv\Scripts\python.exe main.py
```

### Movement Detection Prototype

```bat
.\.venv\Scripts\python.exe movement_detector.py
```

### Music Beat Analysis

Place the demo song at `songs/garba.mp3`, then run:

```bat
.\.venv\Scripts\python.exe beat_detector.py
```

The beat detector is designed to generate:

- `beat_times.npy`
- `frontend/public/beat_times.json`

These outputs are used for experimentation with music timing. Their availability depends on the script completing successfully.

---

## 🔧 Troubleshooting

### Webcam Not Detected

- Check Windows camera privacy permissions.
- Close other applications that may be using the webcam.
- Run the Python server separately and inspect its terminal output.

### WebSocket Connection Failed

- Confirm that `motion_server.py` is running.
- Check whether port `8765` is already in use.
- Verify that the frontend connects to `ws://localhost:8765`.
- Keep the browser and Python server on the same computer.

### Avatar Does Not Move

- Confirm that `frontend/public/models/avatar.fbx` exists.
- Check that the avatar contains the expected skeleton and bone names.
- Inspect the browser developer console for errors.
- Verify that live pose messages are arriving from the WebSocket server.
- Check whether the retargeting code updates the relevant bones on each frame.

### Python or npm Command Not Found

- Install Python and Node.js.
- Reopen the terminal after installation.
- Use the virtual environment's Python executable as shown above.
- Run `npm install` from the frontend directory.

---

## 🔒 Privacy and Asset Licensing

MotionMirror is designed for local execution. The current architecture does not include a hosted backend.

- Do not commit private webcam recordings or sensitive personal data.
- Check the licenses of the avatar, animation, audio, and model assets before redistribution.
- Keep virtual environments, dependency folders, local configuration files, and generated build output out of Git.
- Add an explicit project license before permitting others to reuse or redistribute the project.

The absence of a project license does not automatically grant permission to reuse its source code or bundled assets.

---

## 🗺️ Future Improvements

Potential directions for future development include:

- Improving pose smoothing and reducing avatar jitter.
- Refining 3D joint rotation and skeleton retargeting.
- Improving tracking during turns and fast movements.
- Adding configurable avatar skeleton mappings.
- Experimenting with music-driven movement and beat synchronization.
- Improving tracking confidence indicators and debugging tools.
- Evaluating performance across different webcams and hardware configurations.

These are potential enhancements, not claims about currently implemented functionality.

---

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test the Python server and frontend locally.
5. Submit a pull request describing your changes.

For bug reports, include relevant terminal output, browser console errors, and steps to reproduce the issue. Avoid sharing private webcam recordings.

---

## 📄 License

No project license is currently included.

Add a `LICENSE` file after choosing an appropriate license and confirming that you have the rights to distribute the project code and bundled assets.

---

**MotionMirror** — Bridging real-world movement and browser-based 3D avatars, one frame at a time. 🕺
