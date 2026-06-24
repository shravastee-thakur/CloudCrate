import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CompletedPart,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiError } from "../utils/apiError.js";
import logger from "../utils/logger.js";

const s3Client = new S3Client({
  region: process.env.B2_REGION || "us-east-1",
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export const initiateMultipartUpload = async (
  bucketName: string,
  storageKey: string,
  mimeType: string,
): Promise<string> => {
  try {
    const command = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: storageKey,
      ContentType: mimeType,
    });
    const response = await s3Client.send(command);
    if (!response.UploadId) {
      throw new ApiError(502, "B2 did not return an UploadId");
    }
    return response.UploadId!;
  } catch (error) {
    logger.error(
      `Failed to initiate multipart upload for ${storageKey}:`,
      error,
    );
    throw new ApiError(500, "Failed to initialize file upload process.");
  }
};

export const generatePresignedChunkUrls = async (
  bucketName: string,
  storageKey: string,
  uploadId: string,
  numberOfChunks: number,
): Promise<{ partNumber: number; url: string }[]> => {
  try {
    const urls: { partNumber: number; url: string }[] = [];

    // S3 part numbers must start at 1, not 0
    for (let i = 1; i <= numberOfChunks; i++) {
      const command = new UploadPartCommand({
        Bucket: bucketName,
        Key: storageKey,
        UploadId: uploadId,
        PartNumber: i,
      });

      // URLs expire in 1 hour. Adjust if your frontend needs more time.
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      urls.push({ partNumber: i, url });
    }

    return urls;
  } catch (error) {
    logger.error(
      `Failed to generate presigned chunk URLs for ${storageKey}:`,
      error,
    );
    throw new ApiError(500, "Failed to generate upload links for file chunks.");
  }
};

export const completeMultipartUpload = async (
  bucketName: string,
  storageKey: string,
  uploadId: string,
  parts: CompletedPart[],
): Promise<void> => {
  try {
    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: storageKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    });
    await s3Client.send(command);
  } catch (error) {
    logger.error(
      `Failed to complete multipart upload for ${storageKey}:`,
      error,
    );
    throw new ApiError(500, "Failed to finalize file upload.");
  }
};

export const abortMultipartUpload = async (
  bucketName: string,
  storageKey: string,
  uploadId: string,
): Promise<void> => {
  try {
    const command = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: storageKey,
      UploadId: uploadId,
    });
    await s3Client.send(command);
  } catch (error) {
    logger.warn(`Abort multipart upload warning for ${storageKey}:`, error);
  }
};

export const generateDownloadPresignedUrl = async (
  bucketName: string,
  storageKey: string,
  expiresIn: number = 900,
): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    logger.error(`Failed to generate download URL for ${storageKey}:`, error);
    throw new ApiError(500, "Failed to generate file download link.");
  }
};

export const deleteFileFromCloud = async (
  bucketName: string,
  storageKey: string,
): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
    });
    await s3Client.send(command);
  } catch (error: any) {
    logger.error(`Failed to delete file from storage ${storageKey}:`, error);
    throw new ApiError(500, "Failed to delete file from cloud storage.");
  }
};
