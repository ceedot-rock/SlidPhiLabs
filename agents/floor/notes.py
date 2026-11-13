"""Floor notes — session transcripts plus flagged notes (stdlib only)."""
import os
import time

SESSION = time.strftime("%Y-%m-%d-%H%M%S", time.gmtime())


def _p(home, *parts):
    return os.path.join(home, *parts)


def transcript_path(home, session=SESSION):
    os.makedirs(_p(home, "transcripts"), exist_ok=True)
    return _p(home, "transcripts", session + ".md")


def log(home, speaker, text, session=SESSION):
    with open(transcript_path(home, session), "a", encoding="utf-8") as f:
        f.write("**%s** [%s]: %s\n" % (
            speaker, time.strftime("%H:%M:%S", time.gmtime()), text.strip()[:2000]))


def note(home, text, session=SESSION):
    os.makedirs(_p(home, "notes"), exist_ok=True)
    path = _p(home, "notes", session + ".md")
    with open(path, "a", encoding="utf-8") as f:
        f.write("- [%s] %s\n" % (time.strftime("%H:%M:%S", time.gmtime()), text.strip()[:1000]))
    return path


def list_notes(home):
    d = _p(home, "notes")
    try:
        return sorted(f for f in os.listdir(d) if f.endswith(".md"))
    except OSError:
        return []
