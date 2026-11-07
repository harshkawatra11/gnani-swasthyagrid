"""WAV parsing shared by the REST and streaming TTS adapters.

Two things that break silently if skipped:

- Never hardcode a sample rate: a TTS response's actual sample rate is read from the
  WAV header via `parse_wav_header`, not assumed from the requested `audio_config`.
- The RIFF/WAVE chunk walk does not assume "fmt " and "data" sit at fixed offsets,
  since some encoders insert extra chunks (e.g. LIST) between them.
"""

from dataclasses import dataclass


@dataclass
class WavAudio:
    """Raw PCM samples (no header) plus the format actually present in the
    response, rather than an assumed one."""

    pcm: bytes
    sample_rate_hz: int
    channels: int


def parse_wav_header(buf: bytes) -> WavAudio:
    if len(buf) < 44 or buf[0:4] != b"RIFF" or buf[8:12] != b"WAVE":
        raise ValueError("TTS did not return a recognizable WAV file.")

    offset = 12
    sample_rate_hz = 0
    channels = 0
    data_start = -1
    data_length = 0

    while offset + 8 <= len(buf):
        chunk_id = buf[offset : offset + 4]
        chunk_size = int.from_bytes(buf[offset + 4 : offset + 8], "little")
        body_start = offset + 8
        if chunk_id == b"fmt ":
            channels = int.from_bytes(buf[body_start + 2 : body_start + 4], "little")
            sample_rate_hz = int.from_bytes(buf[body_start + 4 : body_start + 8], "little")
        elif chunk_id == b"data":
            data_start = body_start
            data_length = chunk_size
        offset = body_start + chunk_size + (chunk_size % 2)

    if data_start < 0 or sample_rate_hz == 0:
        raise ValueError("TTS WAV was missing a fmt or data chunk.")

    return WavAudio(
        pcm=buf[data_start : data_start + data_length],
        sample_rate_hz=sample_rate_hz,
        channels=channels or 1,
    )
