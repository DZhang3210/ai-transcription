"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import { Player } from "@/components/Player";
import { formatDuration, formatDate } from "@/lib/utils";

export default function RecordingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const recording = useQuery(api.recordings.get, { id: id as Id<"recordings"> });

  if (recording === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    );
  }

  if (recording === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-stone-400">Recording not found.</p>
        <Link href="/dashboard" className="text-sm text-stone-600 underline underline-offset-2">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex min-w-0 items-center gap-2 border-b border-stone-200 bg-white px-4 py-3 md:gap-3 md:px-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-stone-300">/</span>
        <span className="text-sm font-medium text-stone-700 truncate">{recording.title}</span>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 md:space-y-8 md:px-6 md:py-8">
          {/* Meta */}
          <div>
            <h1 className="text-xl font-semibold text-stone-800 mb-1">{recording.title}</h1>
            {recording.description && (
              <p className="mb-2 text-sm text-stone-500">{recording.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-stone-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {recording.duration ? formatDuration(recording.duration) : "—"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(recording.createdAt)}
              </span>
            </div>
          </div>

          {/* Player with sync */}
          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-400">
              Playback
            </p>
            <Player recordingId={recording._id} segments={recording.segments} />
          </section>

          {/* Full transcript */}
          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-stone-400">
              Full Transcript
            </p>
            <div className="rounded-lg border border-stone-200 bg-white p-5 text-sm leading-8 text-stone-600">
              {recording.fullTranscript || (
                <span className="text-stone-400">No transcript available.</span>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
