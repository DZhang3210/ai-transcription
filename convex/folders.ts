import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: { name: v.string(), color: v.string() },
  handler: async (ctx, { name, color }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("folders", {
      userId,
      name,
      color,
      createdAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: { id: v.id("folders"), name: v.string() },
  handler: async (ctx, { id, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const folder = await ctx.db.get(id);
    if (!folder || folder.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { name });
  },
});

export const remove = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const folder = await ctx.db.get(id);
    if (!folder || folder.userId !== userId) throw new Error("Not found");
    // Move recordings out of folder before deleting
    const recordings = await ctx.db
      .query("recordings")
      .withIndex("by_folderId", (q) => q.eq("folderId", id))
      .collect();
    await Promise.all(
      recordings.map((r) => ctx.db.patch(r._id, { folderId: undefined }))
    );
    await ctx.db.delete(id);
  },
});
