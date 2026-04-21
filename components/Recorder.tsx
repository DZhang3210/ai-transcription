"use client";

import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRef, useState, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

interface Segment {
  text: string;
  startTime: number;
  endTime: number;
}

interface Props {
  folderId?: Id<"folders">;
  onSaved: (id: Id<"recordings">) => void;
  onCancel: () => void;
}

export function Recorder({ folderId, onSaved, onCancel }: Props) {
  const [phase, setPhase] = useState<"idle" | "recording" | "processing" | "saving">("idle");
  const [liveText, setLiveText] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metaError, setMetaError] = useState("");

  const startTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  // capture final segments inside the recognition closure
  const segmentsRef = useRef<Segment[]>([]);

  const createRecording = useMutation(api.recordings.create);
  const generateUploadUrl = useMutation(api.recordings.generateUploadUrl);
  const saveAudio = useMutation(api.recordings.saveAudio);
  const generateMetadata = useAction(api.ai.generateMetadata);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    startTimeRef.current = Date.now();
    audioChunksRef.current = [];
    segmentsRef.current = [];
    setSegments([]);
    setLiveText("");

    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
    mr.start(100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    let segmentStart = 0;

    recognition.onresult = (event: any) => {
      const elapsed = () => (Date.now() - startTimeRef.current) / 1000;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            const end = elapsed();
            const seg = { text, startTime: segmentStart, endTime: end };
            segmentsRef.current = [...segmentsRef.current, seg];
            setSegments([...segmentsRef.current]);
            segmentStart = end;
          }
          setLiveText("");
        } else {
          interim += result[0].transcript;
          setLiveText(interim);
        }
      }
    };

    recognition.start();
    setPhase("recording");
  }, []);

  const stopRecording = useCallback(async () => {
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    setPhase("processing");

    // Give the MediaRecorder a moment to flush, then generate metadata
    await new Promise((r) => setTimeout(r, 300));

    const finalSegments = segmentsRef.current;
    const fullTranscript = finalSegments.map((s) => s.text).join(" ");

    try {
      const meta = await generateMetadata({ transcript: fullTranscript });
      setTitle(meta.title);
      setDescription(meta.description);
      setMetaError("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMetaError(msg);
      setTitle(`Recording — ${new Date().toLocaleString()}`);
      setDescription("");
    }

    setSegments(finalSegments);
    setPhase("saving");
  }, [generateMetadata]);

  const saveRecording = useCallback(async () => {
    const finalTitle = title.trim() || `Recording — ${new Date().toLocaleString()}`;
    const finalSegments = segmentsRef.current;
    const fullTranscript = finalSegments.map((s) => s.text).join(" ");
    const duration = finalSegments.length > 0 ? finalSegments[finalSegments.length - 1].endTime : 0;

    const id = await createRecording({
      title: finalTitle,
      description: description.trim() || undefined,
      folderId,
      segments: finalSegments,
      fullTranscript,
      duration,
    });

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    if (blob.size > 0) {
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "audio/webm" },
        body: blob,
      });
      const { storageId } = await res.json();
      await saveAudio({ id, storageId });
    }

    onSaved(id);
  }, [title, description, folderId, createRecording, generateUploadUrl, saveAudio, onSaved]);

  const fullText = [...segmentsRef.current.map((s) => s.text), liveText].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-5">
      {phase === "idle" && (
        <div className="flex flex-col items-center gap-5 py-6">
          <div className="rounded-full bg-stone-100 p-5">
            <Mic className="h-8 w-8 text-stone-400" />
          </div>
          <button
            onClick={startRecording}
            className="rounded-lg bg-stone-800 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 active:scale-95"
          >
            Start Recording
          </button>
          <button onClick={onCancel} className="text-sm text-stone-400 hover:text-stone-600">
            Cancel
          </button>
        </div>
      )}

      {phase === "recording" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
              <span className="text-sm text-red-500">Recording</span>
            </div>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </button>
          </div>

          <div className="min-h-[140px] rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-700">
            {segments.map((s) => s.text).join(" ")}
            {liveText && <span className="text-stone-400"> {liveText}</span>}
            {!fullText && <span className="text-stone-400">Speak — transcription will appear here…</span>}
          </div>

          <div className="flex items-end justify-center gap-1 h-8">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-stone-300 animate-pulse"
                style={{
                  height: `${30 + Math.random() * 70}%`,
                  animationDelay: `${i * 40}ms`,
                  animationDuration: `${500 + Math.random() * 500}ms`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {phase === "processing" && (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          <p className="text-sm text-stone-400">Generating title and summary…</p>
        </div>
      )}

      {phase === "saving" && (
        <div className="flex flex-col gap-4">
          {metaError && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {metaError}
            </p>
          )}
          <div className="min-h-[80px] rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-600">
            {segments.map((s) => s.text).join(" ") || (
              <span className="text-stone-400">No transcript captured.</span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-500">Title</label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveRecording()}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-500">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveRecording}
              className="flex-1 rounded-lg bg-stone-800 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-500 transition hover:bg-stone-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
