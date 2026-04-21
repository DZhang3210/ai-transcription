"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { FolderOpen, Folder, Plus, Trash2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { NewFolderModal } from "@/components/NewFolderModal";

interface Props {
  selectedFolderId: Id<"folders"> | null;
  onSelect: (id: Id<"folders"> | null) => void;
}

export function FolderSidebar({ selectedFolderId, onSelect }: Props) {
  const folders = useQuery(api.folders.list) ?? [];
  const removeFolder = useMutation(api.folders.remove);
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <aside className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-stone-200 bg-white p-3">
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
            selectedFolderId === null
              ? "bg-stone-100 font-medium text-stone-800"
              : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
          )}
        >
          <Inbox className="h-4 w-4 shrink-0" />
          All Recordings
        </button>

        {folders.length > 0 && <div className="my-1 border-t border-stone-100" />}

        {folders.map((folder) => (
          <div key={folder._id} className="group flex items-center gap-1">
            <button
              onClick={() => onSelect(folder._id)}
              className={cn(
                "flex flex-1 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                selectedFolderId === folder._id
                  ? "bg-stone-100 font-medium text-stone-800"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
              )}
            >
              {selectedFolderId === folder._id
                ? <FolderOpen className="h-4 w-4 shrink-0" style={{ color: folder.color }} />
                : <Folder className="h-4 w-4 shrink-0" style={{ color: folder.color }} />
              }
              <span className="truncate">{folder.name}</span>
            </button>
            <button
              onClick={async () => {
                if (selectedFolderId === folder._id) onSelect(null);
                await removeFolder({ id: folder._id });
              }}
              className="hidden rounded p-1 text-stone-300 hover:text-red-400 group-hover:block"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <div className="mt-auto pt-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-stone-400 transition hover:bg-stone-50 hover:text-stone-600"
          >
            <Plus className="h-4 w-4" />
            New folder
          </button>
        </div>
      </aside>

      {showModal && <NewFolderModal onClose={() => setShowModal(false)} />}
    </>
  );
}
