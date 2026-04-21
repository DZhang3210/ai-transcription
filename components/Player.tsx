"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Play, Pause, SkipForward, Volume2, VolumeX } from "lucide-react";
import { formatDuration, cn } from "@/lib/utils";

interface Segment {
  text: string;
  startTime: number;
  endTime: number;
}

interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

interface SilentRegion {
  start: number;
  end: number;
}

interface Props {
  recordingId: Id<"recordings">;
  segments: Segment[];
}

const SPEEDS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];
const SILENCE_THRESHOLD = 0.018;
const MIN_SILENCE_DURATION = 0.6; // seconds of silence before it's worth skipping

// Split segments into per-word timings using linear interpolation
function buildWordTimings(segments: Segment[]): WordTiming[] {
  return segments.flatMap((seg) => {
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const duration = Math.max(seg.endTime - seg.startTime, 0.01);
    return words.map((word, i) => ({
      word,
      startTime: seg.startTime + (duration * i) / words.length,
      endTime: seg.startTime + (duration * (i + 1)) / words.length,
    }));
  });
}

// Decode audio buffer and return a list of silent time regions to skip
async function detectSilentRegions(audioUrl: string): Promise<SilentRegion[]> {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const ctx = new AudioContext();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  } finally {
    ctx.close();
  }

  const data = audioBuffer.getChannelData(0);
  const sr = audioBuffer.sampleRate;
  const windowSamples = Math.floor(sr * 0.08); // 80ms analysis window
  const regions: SilentRegion[] = [];

  let inSilence = false;
  let silenceStart = 0;

  for (let i = 0; i < data.length; i += windowSamples) {
    const end = Math.min(i + windowSamples, data.length);
    let sum = 0;
    for (let j = i; j < end; j++) sum += data[j] * data[j];
    const rms = Math.sqrt(sum / (end - i));
    const time = i / sr;

    if (rms < SILENCE_THRESHOLD) {
      if (!inSilence) { inSilence = true; silenceStart = time; }
    } else {
      if (inSilence) {
        const dur = time - silenceStart;
        if (dur >= MIN_SILENCE_DURATION) {
          // Leave 100ms buffer on each edge so we don't clip speech
          regions.push({ start: silenceStart + 0.1, end: time - 0.1 });
        }
        inSilence = false;
      }
    }
  }
  return regions;
}

export function Player({ recordingId, segments }: Props) {
  const audioUrl = useQuery(api.recordings.getAudioUrl, { id: recordingId });
  const audioRef = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [skipSilence, setSkipSilence] = useState(false);
  const [silentRegions, setSilentRegions] = useState<SilentRegion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  // volume: 0–3 (0%–300%). Above 1.0 requires a GainNode.
  const [volume, setVolume] = useState(1);
  const preMuteVolume = useRef(1);
  const gainRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const activeWordRef = useRef<HTMLSpanElement>(null);
  const skipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-compute per-word timings once
  const wordTimings = useMemo(() => buildWordTimings(segments), [segments]);

  // Active word = last word whose startTime <= currentTime
  const activeWordIndex = wordTimings.findLastIndex((w) => currentTime >= w.startTime);

  useEffect(() => {
    activeWordRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeWordIndex]);

  // Wire audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.src = audioUrl;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onEnded = () => { setPlaying(false); };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  // Apply speed
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // Lazily create AudioContext + GainNode the first time we exceed 100%
  const ensureGain = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || gainRef.current) return;
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);
    gainRef.current = gain;
    audioCtxRef.current = ctx;
  }, []);

  // Apply volume: use GainNode when one exists, audio.volume otherwise
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    } else if (audioRef.current) {
      audioRef.current.volume = Math.min(volume, 1);
    }
  }, [volume]);

  const handleVolumeChange = useCallback(async (raw: number) => {
    setVolume(raw);
    if (raw > 1 && !gainRef.current) {
      await ensureGain();
      const gain = gainRef.current as GainNode | null;
      if (gain) gain.gain.value = raw;
    }
  }, [ensureGain]);

  const toggleMute = () => {
    if (volume === 0) {
      setVolume(preMuteVolume.current);
    } else {
      preMuteVolume.current = volume;
      setVolume(0);
    }
  };

  // Skip-silence: poll every 150ms and jump over detected silent regions
  useEffect(() => {
    if (skipIntervalRef.current) clearInterval(skipIntervalRef.current);
    if (!skipSilence || !playing || silentRegions.length === 0) return;

    skipIntervalRef.current = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const t = audio.currentTime;
      const region = silentRegions.find((r) => t >= r.start && t < r.end);
      if (region) audio.currentTime = region.end;
    }, 150);

    return () => {
      if (skipIntervalRef.current) clearInterval(skipIntervalRef.current);
    };
  }, [skipSilence, playing, silentRegions]);

  // Analyze audio when skip-silence is first enabled
  const handleSkipSilence = useCallback(async () => {
    const next = !skipSilence;
    setSkipSilence(next);
    if (next && audioUrl && silentRegions.length === 0 && !analyzing) {
      setAnalyzing(true);
      try {
        const regions = await detectSilentRegions(audioUrl);
        setSilentRegions(regions);
      } catch (e) {
        console.warn("Silence analysis failed:", e);
      } finally {
        setAnalyzing(false);
      }
    }
  }, [skipSilence, audioUrl, silentRegions.length, analyzing]);

  const resumeAndPlay = useCallback(async () => {
    if (audioCtxRef.current?.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    await audioRef.current!.play();
    setPlaying(true);
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      await resumeAndPlay();
    }
  }, [playing, resumeAndPlay]);

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const clickWord = useCallback(async (startTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = startTime;
    setCurrentTime(startTime);
    await resumeAndPlay();
  }, [resumeAndPlay]);

  if (!audioUrl) {
    return (
      <div className="rounded-lg border border-stone-200 p-4 text-sm text-stone-400">
        No audio available.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <audio ref={audioRef} preload="metadata" />

      <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3">
        {/* Play + scrubber */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-800 text-white transition hover:bg-stone-700"
          >
            {playing
              ? <Pause className="h-3.5 w-3.5" />
              : <Play className="h-3.5 w-3.5 pl-0.5" />
            }
          </button>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={seek}
            className="flex-1 accent-stone-600"
          />
          <span className="shrink-0 text-xs tabular-nums text-stone-400">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 border-t border-stone-100 pt-2.5">
          <button
            onClick={toggleMute}
            className="shrink-0 text-stone-400 transition hover:text-stone-700"
          >
            {volume === 0
              ? <VolumeX className="h-4 w-4" />
              : <Volume2 className="h-4 w-4" />
            }
          </button>
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="flex-1 accent-stone-600"
          />
          <span className="shrink-0 w-9 text-right text-xs tabular-nums text-stone-400">
            {Math.round(volume * 100)}%
          </span>
        </div>

        {/* Speed + skip silence */}
        <div className="flex items-center gap-2 border-t border-stone-100 pt-2.5">
          <div className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "shrink-0 rounded px-2 py-0.5 text-xs font-medium transition",
                  speed === s
                    ? "bg-stone-800 text-white"
                    : "text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                )}
              >
                {s === 1 ? "1×" : `${s}×`}
              </button>
            ))}
          </div>
          <button
            onClick={handleSkipSilence}
            disabled={analyzing}
            className={cn(
              "shrink-0 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
              skipSilence
                ? "bg-stone-800 text-white"
                : "text-stone-400 hover:bg-stone-100 hover:text-stone-700",
              analyzing && "opacity-50"
            )}
          >
            <SkipForward className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{analyzing ? "Analyzing…" : "Skip silence"}</span>
            <span className="sm:hidden">{analyzing ? "…" : "Skip"}</span>
          </button>
        </div>
      </div>

      {/* Synced word-level transcript */}
      <div className="max-h-96 overflow-y-auto rounded-lg border border-stone-200 bg-white p-5 text-sm leading-9 text-stone-600">
        {wordTimings.length === 0 ? (
          <p className="text-stone-400">No transcript available.</p>
        ) : (
          wordTimings.map((w, i) => (
            <span
              key={i}
              ref={i === activeWordIndex ? activeWordRef : undefined}
              onClick={() => clickWord(w.startTime)}
              className={cn(
                "cursor-pointer rounded px-0.5 transition-colors",
                i === activeWordIndex
                  ? "bg-amber-100 text-amber-800"
                  : i < activeWordIndex
                  ? "text-stone-400"
                  : "hover:bg-stone-100"
              )}
            >
              {w.word}{" "}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
