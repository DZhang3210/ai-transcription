"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { FolderOpen, Inbox, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NewFolderModal } from "@/components/NewFolderModal";

interface Props {
  selectedFolderId: Id<"folders"> | null;
  onSelect: (id: Id<"folders"> | null) => void;
}

export function FolderBar({ selectedFolderId, onSelect }: Props) {
  const folders = useQuery(api.folders.list) ?? [];
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="border-b border-stone-200 bg-white">
        <div className="flex gap-2 overflow-x-auto px-4 py-2.5 scrollbar-none">
          <button
            onClick={() => onSelect(null)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              selectedFolderId === null
                ? "bg-stone-800 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            )}
          >
            <Inbox className="h-3.5 w-3.5" />
            All
          </button>

          {folders.map((folder) => (
            <button
              key={folder._id}
              onClick={() => onSelect(folder._id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                selectedFolderId === folder._id
                  ? "bg-stone-800 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              <FolderOpen
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: selectedFolderId === folder._id ? "white" : folder.color }}
              />
              {folder.name}
            </button>
          ))}

          <button
            onClick={() => setShowModal(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-xs text-stone-500 transition hover:bg-stone-200"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showModal && <NewFolderModal onClose={() => setShowModal(false)} />}
    </>
  );
}
