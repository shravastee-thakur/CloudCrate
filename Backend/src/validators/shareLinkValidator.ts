import { z } from "zod";

export const createShareLinkSchema = z.object({
  mediaId: z.string().min(1),
  expiresAt: z.coerce.date().refine((date) => date > new Date(), {
    message: "Expiration date must be in the future",
  }),
  maxDownloads: z.number().int().min(0).default(0),
  password: z.string().min(4).max(64).optional(),
});

export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;

export const publicDownloadSchema = z.object({
  password: z.string().optional(),
});

export type PublicDownloadInput = z.infer<typeof publicDownloadSchema>;

export const shareLinkIdParamSchema = z.object({
  shareLinkId: z.string().min(1),
});

export const tokenParamSchema = z.object({
  token: z.string().min(1),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
