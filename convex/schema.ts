import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  folders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    color: v.string(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),
  recordings: defineTable({
    userId: v.id("users"),
    folderId: v.optional(v.id("folders")),
    title: v.string(),
    audioStorageId: v.optional(v.id("_storage")),
    segments: v.array(
      v.object({
        text: v.string(),
        startTime: v.number(),
        endTime: v.number(),
      })
    ),
    fullTranscript: v.string(),
    description: v.optional(v.string()),
    duration: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_folderId", ["folderId"]),
});
