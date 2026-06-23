import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  AbortMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const IS_LOCAL = process.env.NODE_ENV === "development";
const S3_ENDPOINT = process.env.S3_ENDPOINT || "http://localhost:9000";
const S3_REGION = process.env.S3_REGION || "us-east-005";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "floci_access";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "floci_secret";

const getS3Client = (): S3Client => {
  return new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
    forcePathStyle: IS_LOCAL,
  });
};

const s3Client = getS3Client();

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
    ChecksumSHA1: sha1Checksum,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
};

export const initiateMultipartUpload = async (
  bucketName: string,
  storageKey: string,
  mimeType: string,
): Promise<string> => {
  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: storageKey,
    ContentType: mimeType,
  });
  const response = await s3Client.send(command);
  return response.UploadId!;
};

export const generatePresignedUrlsForChunks = async (
  bucketName: string,
  storageKey: string,
  uploadId: string,
  partCount: number,
  expiresIn: number = 86400,
): Promise<string[]> => {
  const partUrls = await Promise.all(
    Array.from({ length: partCount }, async (_, i) => {
      const partNumber = i + 1;
      const command = new UploadPartCommand({
        Bucket: bucketName,
        Key: storageKey,
        UploadId: uploadId,
        PartNumber: partNumber,
        // Enforces chunk integrity. The frontend must calculate and send the SHA256 for each chunk.
        ChecksumAlgorithm: "SHA256",
      });
      return getSignedUrl(s3Client, command, { expiresIn });
    }),
  );
  return partUrls;
};

export const verifyFileIntegrity = async (
  bucketName: string,
  storageKey: string,
  expectedSha1: string,
): Promise<boolean> => {
  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
  });

  const response = await s3Client.send(command);

  // B2 S3 API exposes the hash in ChecksumSHA1 or strips quotes from the ETag
  const cloudSha1 = response.ChecksumSHA1 || response.ETag?.replace(/"/g, "");

  return cloudSha1 === expectedSha1;
};

export const completeMultipartUpload = async (
  bucketName: string,
  storageKey: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[],
): Promise<void> => {
  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: storageKey,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });
  await s3Client.send(command);
};

export const generateDownloadPresignedUrl = async (
  bucketName: string,
  storageKey: string,
  expiresIn: number = 900,
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    ResponseCacheControl: "public, max-age=86400",
  });
  return getSignedUrl(s3Client, command, { expiresIn });
};

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
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404)
      return true;
    throw error;
  }
};

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
    )
      return true;
    throw error;
  }
};
