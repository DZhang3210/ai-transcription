"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { Clock, Trash2 } from "lucide-react";
import { formatDuration, formatDate } from "@/lib/utils";

interface Recording {
  _id: Id<"recordings">;
  title: string;
  description?: string;
  fullTranscript: string;
  duration?: number;
  createdAt: number;
  folderId?: Id<"folders">;
}

export function RecordingCard({ recording }: { recording: Recording }) {
  const remove = useMutation(api.recordings.remove);

  return (
    <div className="group relative rounded-lg border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-sm">
      <Link href={`/recording/${recording._id}`} className="flex flex-col gap-2.5 p-4">
        <h3 className="font-medium text-stone-800 line-clamp-1">{recording.title}</h3>
        <p className="text-sm leading-relaxed text-stone-400 line-clamp-3">
          {recording.description || recording.fullTranscript || "No transcript."}
        </p>
        <div className="flex items-center gap-3 text-xs text-stone-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {recording.duration ? formatDuration(recording.duration) : "—"}
          </span>
          <span>{formatDate(recording.createdAt)}</span>
        </div>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          remove({ id: recording._id });
        }}
        className="absolute right-3 top-3 hidden rounded p-1 text-stone-300 transition hover:text-red-400 group-hover:block"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
