"use client";

export const dynamic = "force-dynamic";

import { useQuery, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { Mic, LogOut, Plus, X } from "lucide-react";
import { FolderSidebar } from "@/components/FolderSidebar";
import { FolderBar } from "@/components/FolderBar";
import { RecordingCard } from "@/components/RecordingCard";
import { Recorder } from "@/components/Recorder";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"folders"> | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);

  const recordings = useQuery(api.recordings.list, {
    folderId: selectedFolderId ?? undefined,
  }) ?? [];

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    );
  }

  const handleSaved = (id: Id<"recordings">) => {
    setShowRecorder(false);
    router.push(`/recording/${id}`);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 md:px-5">
        <span className="text-sm font-semibold text-stone-700">VoiceJournal</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRecorder(true)}
            className="flex items-center gap-1.5 rounded-lg bg-stone-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-700 active:scale-95 md:hidden"
          >
            <Plus className="h-4 w-4" />
            Record
          </button>
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Mobile folder chips */}
      <div className="md:hidden">
        <FolderBar selectedFolderId={selectedFolderId} onSelect={setSelectedFolderId} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <FolderSidebar selectedFolderId={selectedFolderId} onSelect={setSelectedFolderId} />
        </div>

        {/* Main */}
        <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
          <div className="mb-4 hidden items-center justify-between md:flex">
            <h2 className="text-base font-semibold text-stone-700">
              {selectedFolderId === null ? "All Recordings" : "Folder"}
            </h2>
            <button
              onClick={() => setShowRecorder(true)}
              className="flex items-center gap-1.5 rounded-lg bg-stone-800 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-stone-700 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              New Recording
            </button>
          </div>

          {recordings.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-full bg-stone-100 p-4">
                <Mic className="h-6 w-6 text-stone-400" />
              </div>
              <p className="text-sm text-stone-400">No recordings yet.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {recordings.map((r) => (
                <RecordingCard key={r._id} recording={r} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Recorder modal — bottom sheet on mobile, centered on desktop */}
      {showRecorder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setShowRecorder(false)}
        >
          <div className="w-full rounded-t-2xl border border-stone-200 bg-white p-5 shadow-lg sm:max-w-md sm:rounded-xl">
            {/* Drag handle on mobile */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200 sm:hidden" />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700">New Recording</h3>
              <button
                onClick={() => setShowRecorder(false)}
                className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Recorder
              folderId={selectedFolderId ?? undefined}
              onSaved={handleSaved}
              onCancel={() => setShowRecorder(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
