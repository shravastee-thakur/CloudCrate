import {
  S3Client,
  ListObjectsV2Command,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.B2_REGION || "us-east-1",
  endpoint: process.env.B2_ENDPOINT || "http://localhost:4566",
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || "test",
  },
  forcePathStyle: true,
});

const BUCKET_NAME = "my-bucket";

async function checkBucketContents() {
  try {
    // 1. First, check if the bucket actually exists
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✅ Bucket "${BUCKET_NAME}" exists! Let's look inside...`);

    // 2. If it exists, list the files inside
    const response = await s3Client.send(
      new ListObjectsV2Command({ Bucket: BUCKET_NAME }),
    );

    if (response.Contents && response.Contents.length > 0) {
      console.log(`\n📂 Files found in ${BUCKET_NAME}:`);
      response.Contents.forEach((file) => {
        console.log(` - ${file.Key} (Size: ${file.Size} bytes)`);
      });
    } else {
      console.log(`\n📭 The bucket "${BUCKET_NAME}" is completely empty.`);
    }
  } catch (error: any) {
    if (error.name === "NotFound") {
      console.error(
        `❌ The bucket "${BUCKET_NAME}" does not exist. (It may have been wiped if the container restarted).`,
      );
    } else {
      console.error("An error occurred:", error);
    }
  }
}

checkBucketContents();
