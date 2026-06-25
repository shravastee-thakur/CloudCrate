import { z } from "zod";

export const initializeUploadSchema = z.object({
  bucketName: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  sha1Checksum: z
    .string()
    .regex(/^[a-fA-F0-9]{40}$/, "Invalid SHA1 hash format"),
});

export type initializeUploadInput = z.infer<typeof initializeUploadSchema>;

export const finalizeUploadSchema = z.object({
  mediaId: z.string().min(1),
  bucketName: z.string().min(1),
  storageKey: z.string().min(1),
  uploadId: z.string().min(1),
  parts: z
    .array(
      z.object({
        ETag: z.string().min(1),
        PartNumber: z.number().int().min(1).max(10000),
      }),
    )
    .min(1),
});

export type finalizeUploadInput = z.infer<typeof finalizeUploadSchema>;


export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const mediaIdParamSchema = z.object({
  mediaId: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid MongoDB ObjectId"),
});