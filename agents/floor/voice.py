"""Floor voice — Cartesia ears and mouth over stdlib wave (no soundfile).

Needs CARTESIA_API_KEY plus sounddevice/numpy/requests (all present on
this box except soundfile, which wave replaces). Everything lazy: import
errors and a missing key degrade to honest status text, never a crash.
"""
import io
import os
import wave

API = "https://api.cartesia.ai"
VERSION = os.environ.get("CARTESIA_VERSION", "2025-04-16")
TTS_MODEL = os.environ.get("CARTESIA_TTS_MODEL", "sonic-3")
STT_MODEL = os.environ.get("CARTESIA_STT_MODEL", "ink-whisper")
SAMPLE_RATE = 16000


def status():
    missing = []
    if not os.environ.get("CARTESIA_API_KEY", "").strip():
        missing.append("CARTESIA_API_KEY is not set")
    for mod in ("sounddevice", "numpy", "requests"):
        try:
            __import__(mod)
        except ImportError:
            missing.append("python module %r is missing" % mod)
    return (True, "voice ready (Cartesia %s/%s)" % (STT_MODEL, TTS_MODEL)) if not missing \
        else (False, "voice unavailable: " + "; ".join(missing))


def headers():
    import requests  # lazy: only after status() passes
    return {"headers": {"X-API-Key": os.environ["CARTESIA_API_KEY"].strip(),
                        "Cartesia-Version": VERSION},
            "requests": requests}


def voice_id(home):
    pinned = os.environ.get("CARTESIA_VOICE_ID", "").strip()
    if pinned:
        return pinned
    cache = os.path.join(home, ".voice_id")
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            cached = f.read().strip()
        if cached:
            return cached
    ctx = headers()
    r = ctx["requests"].get(API + "/voices", headers=ctx["headers"],
                            params={"limit": 50}, timeout=30)
    r.raise_for_status()
    voices = r.json()
    if isinstance(voices, dict):
        voices = voices.get("data") or voices.get("voices") or []
    choice = next((v["id"] for v in voices if (v.get("language") or "en") == "en"),
                  voices[0]["id"] if voices else "")
    if not choice:
        raise RuntimeError("no Cartesia voices on this account")
    with open(cache, "w", encoding="utf-8") as f:
        f.write(choice)
    return choice


def wav_bytes_pcm16(mono_float, rate):
    import numpy as np
    pcm = (mono_float * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


def listen(max_seconds=60, silence_seconds=1.2, rate=SAMPLE_RATE, block=0.2):
    """Hands-free capture: records until silence (no keyboard needed).

    Returns float32 mono audio. silence = RMS below 0.02 for
    silence_seconds straight. Always stops by max_seconds.
    """
    import numpy as np
    import sounddevice as sd
    frames = []
    silent = 0.0
    print("Listening... (speak, pause to send)")
    with sd.InputStream(samplerate=rate, channels=1, dtype="float32") as stream:
        elapsed = 0.0
        while elapsed < max_seconds:
            chunk, _ = stream.read(int(rate * block))
            frames.append(chunk.copy())
            rms = float(np.sqrt(np.mean(chunk.astype("float64") ** 2)))
            silent = silent + block if rms < 0.02 else 0.0
            elapsed += block
            if frames and silent >= silence_seconds and elapsed > 1.0:
                break
    return np.concatenate(frames, axis=0) if frames else np.zeros(0, dtype="float32")


def record_until_enter(rate=SAMPLE_RATE):
    import sounddevice as sd
    print("Listening... press Enter to stop.")
    frames = []
    stream = sd.InputStream(samplerate=rate, channels=1, dtype="float32",
                            callback=lambda indata, *_: frames.append(indata.copy()))
    stream.start()
    try:
        input()
    finally:
        stream.stop()
        stream.close()
    import numpy as np
    return np.concatenate(frames, axis=0) if frames else np.zeros(0, dtype="float32")


def transcribe(audio, rate=SAMPLE_RATE, timeout=60):
    import numpy as np
    if audio.size == 0:
        return False, "(heard nothing)"
    ctx = headers()
    r = ctx["requests"].post(
        API + "/stt", headers=ctx["headers"],
        files={"file": ("utterance.wav", wav_bytes_pcm16(audio, rate), "audio/wav")},
        data={"model": STT_MODEL, "language": "en"}, timeout=timeout)
    if r.status_code != 200:
        return False, "STT failed (%s): %s" % (r.status_code, r.text[:200])
    out = r.json()
    return True, (out.get("text") or out.get("transcript") or "").strip()


def speak(text, home):
    import re
    import sounddevice as sd
    clean = re.sub(r"```.*?```", " ", text, flags=re.S)
    clean = re.sub(r"[*_`#>]", "", clean)
    clean = re.sub(r"\s+", " ", clean).strip()[:900]
    if not clean:
        return False, "(nothing to say)"
    ctx = headers()
    r = ctx["requests"].post(
        API + "/tts/bytes", headers=ctx["headers"], timeout=60, json={
            "model_id": TTS_MODEL, "transcript": clean,
            "voice": {"mode": "id", "id": voice_id(home)},
            "output_format": {"container": "wav", "encoding": "pcm_s16le",
                              "sample_rate": 44100},
            "language": "en"})
    if r.status_code != 200:
        return False, "TTS failed (%s): %s" % (r.status_code, r.text[:200])
    with wave.open(io.BytesIO(r.content), "rb") as w:
        import numpy as np
        raw = w.readframes(w.getnframes())
        data = np.frombuffer(raw, dtype="<i2").astype("float32") / 32768.0
        sr = w.getframerate()
    sd.play(data, sr)
    sd.wait()
    return True, "said %d chars" % len(clean)
