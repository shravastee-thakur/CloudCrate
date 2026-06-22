import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  AbortMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Environment configuration
const IS_LOCAL = process.env.NODE_ENV === "development";
const S3_ENDPOINT = process.env.S3_ENDPOINT || "http://localhost:9000"; // Floci default
const S3_REGION = process.env.S3_REGION || "us-east-005"; // Backblaze default region format
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "floci_access";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "floci_secret";

// Singleton S3 Client Factory
const getS3Client = (): S3Client => {
  return new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
    // Floci and many local S3 emulators require path-style URLs.
    // Backblaze B2 also supports this. It prevents bucket subdomain resolution errors locally.
    forcePathStyle: IS_LOCAL,
  });
};

const s3Client = getS3Client();

/**
 * Generates a presigned URL for direct single-part uploads from the browser.
 * Includes the SHA1 checksum to ensure Backblaze B2 rejects corrupted files.
 */
export const generateUploadPresignedUrl = async (
  bucketName: string,
  storageKey: string,
  mimeType: string,
  sha1Checksum: string,
  expiresIn: number = 3600,
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    ContentType: mimeType,
    ChecksumSHA1: sha1Checksum, // B2 validates this on receipt
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Initiates a multipart upload in B2 and returns presigned URLs for every chunk.
 * The frontend will use these URLs to upload file parts in parallel.
 */
export const generateMultipartUploadUrls = async (
  bucketName: string,
  storageKey: string,
  mimeType: string,
  partCount: number,
  expiresIn: number = 86400, // 24 hours to allow large uploads
): Promise<{ uploadId: string; partUrls: string[] }> => {
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: storageKey,
    ContentType: mimeType,
  });

  const multipartInitResponse = await s3Client.send(createCommand);
  const uploadId = multipartInitResponse.UploadId!;

  const partUrls = await Promise.all(
    Array.from({ length: partCount }, async (_, i) => {
      const partNumber = i + 1;

      const uploadPartCommand = new UploadPartCommand({
        Bucket: bucketName,
        Key: storageKey,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      return getSignedUrl(s3Client, uploadPartCommand, { expiresIn });
    }),
  );

  return { uploadId, partUrls };
};

/**
 * Generates a secure, expiring download URL.
 * Adds CacheControl headers so CDNs like Cloudflare can cache the file at the edge.
 */
export const generateDownloadPresignedUrl = async (
  bucketName: string,
  storageKey: string,
  expiresIn: number = 900, // 15 minutes
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    ResponseCacheControl: "public, max-age=86400",
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Deletes the actual binary file from Backblaze B2.
 * Called exclusively by your background cleanup worker.
 */
export const deleteFileFromCloud = async (
  bucketName: string,
  storageKey: string,
): Promise<boolean> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
    });
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    // If the file is already gone, B2 returns a 404 NoSuchKey.
    // Treat this as a successful deletion to unblock the worker queue.
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      return true;
    }
    throw error;
  }
};

/**
 * Aborts an incomplete multipart upload to prevent paying for orphaned chunks.
 * Called by the background worker when an upload expires.
 */
export const abortMultipartUpload = async (
  bucketName: string,
  storageKey: string,
  uploadId: string,
): Promise<boolean> => {
  try {
    const command = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: storageKey,
      UploadId: uploadId,
    });
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (
      error.name === "NoSuchUpload" ||
      error.$metadata?.httpStatusCode === 404
    ) {
      return true;
    }
    throw error;
  }
};
