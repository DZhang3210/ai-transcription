import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const segmentValidator = v.object({
  text: v.string(),
  startTime: v.number(),
  endTime: v.number(),
});

export const list = query({
  args: { folderId: v.optional(v.id("folders")) },
  handler: async (ctx, { folderId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    if (folderId) {
      return ctx.db
        .query("recordings")
        .withIndex("by_folderId", (q) => q.eq("folderId", folderId))
        .order("desc")
        .collect();
    }
    return ctx.db
      .query("recordings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("recordings") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const recording = await ctx.db.get(id);
    if (!recording || recording.userId !== userId) return null;
    return recording;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
    segments: v.array(segmentValidator),
    fullTranscript: v.string(),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("recordings", {
      userId,
      folderId: args.folderId,
      title: args.title,
      description: args.description,
      segments: args.segments,
      fullTranscript: args.fullTranscript,
      duration: args.duration,
      createdAt: Date.now(),
    });
  },
});

export const saveAudio = mutation({
  args: { id: v.id("recordings"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const recording = await ctx.db.get(id);
    if (!recording || recording.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { audioStorageId: storageId });
  },
});

export const getAudioUrl = query({
  args: { id: v.id("recordings") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const recording = await ctx.db.get(id);
    if (!recording || recording.userId !== userId) return null;
    if (!recording.audioStorageId) return null;
    return ctx.storage.getUrl(recording.audioStorageId);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.storage.generateUploadUrl();
  },
});

export const update = mutation({
  args: {
    id: v.id("recordings"),
    title: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, { id, title, folderId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const recording = await ctx.db.get(id);
    if (!recording || recording.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title;
    if (folderId !== undefined) patch.folderId = folderId;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("recordings") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const recording = await ctx.db.get(id);
    if (!recording || recording.userId !== userId) throw new Error("Not found");
    if (recording.audioStorageId) {
      await ctx.storage.delete(recording.audioStorageId);
    }
    await ctx.db.delete(id);
  },
});
