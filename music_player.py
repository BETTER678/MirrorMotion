
import time
import librosa
import pygame

SONG_PATH = "songs/garba.mp3"

print("Loading Garba song and analyzing rhythm...")

# Analyze the song.
y, sr = librosa.load(SONG_PATH, sr=22050, mono=True)

tempo, beat_frames = librosa.beat.beat_track(
    y=y,
    sr=sr,
    units="frames"
)

beat_times = librosa.frames_to_time(
    beat_frames,
    sr=sr
)

# Handle different Librosa return formats.
bpm = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)

print(f"Estimated tempo: {bpm:.1f} BPM")
print(f"Detected beats: {len(beat_times)}")

# Start playback.
pygame.mixer.init()
pygame.mixer.music.load(SONG_PATH)
pygame.mixer.music.play()

start_time = time.monotonic()
beat_index = 0

print("\nPlaying song. Press Ctrl+C to stop.\n")

try:
    while pygame.mixer.music.get_busy():
        elapsed = time.monotonic() - start_time

        while (
            beat_index < len(beat_times)
            and beat_times[beat_index] <= elapsed
        ):
            print(
                f"Beat detected at {elapsed:.2f}s"
            )
            beat_index += 1

        time.sleep(0.01)

except KeyboardInterrupt:
    print("\nStopping music...")

finally:
    pygame.mixer.music.stop()
    pygame.mixer.quit()
