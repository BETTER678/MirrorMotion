import json
from pathlib import Path

import librosa
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
SONG_PATH = BASE_DIR / "songs" / "garba.mp3"
OUTPUT_JSON_PATH = BASE_DIR / "frontend" / "public" / "beat_times.json"
OUTPUT_NPY_PATH = BASE_DIR / "beat_times.npy"

if not SONG_PATH.exists():
    raise FileNotFoundError(f"Audio file not found: {SONG_PATH}")

OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)

print("Analyzing Garba music...")

y, sr = librosa.load(SONG_PATH, sr=22050, mono=True)

tempo, beat_frames = librosa.beat.beat_track(
    y=y,
    sr=sr,
    units="frames",
)

beat_times = librosa.frames_to_time(beat_frames, sr=sr)
tempo_value = float(np.asarray(tempo).reshape(-1)[0])

print(f"\nEstimated tempo: {tempo_value:.1f} BPM")
print(f"Total detected beats: {len(beat_times)}")

print("\nFirst 15 detected beat times:")
for beat_time in beat_times[:15]:
    print(f"{beat_time:.3f} seconds")

np.save(OUTPUT_NPY_PATH, beat_times)

with OUTPUT_JSON_PATH.open("w", encoding="utf-8") as file:
    json.dump(beat_times.tolist(), file)

print("Beat timings saved for the frontend!")
print(f"\nSaved beat timings to {OUTPUT_NPY_PATH}")
