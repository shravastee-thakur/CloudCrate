import { S3Client, PutObjectCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.B2_REGION || "us-east-1",
  endpoint: process.env.B2_ENDPOINT, 
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || "test",
  },
  forcePathStyle: true,
});

async function runSanityCheck() {
  console.log("Connecting to local storage engine at:", process.env.B2_ENDPOINT);
  const targetBucket = "my-bucket"; 
  
  try {
    // 1. Create the bucket (Since the CLI couldn't do it)
    console.log(`Creating bucket: ${targetBucket}...`);
    await s3Client.send(new CreateBucketCommand({ Bucket: targetBucket }));
    console.log(`✔ Bucket created!`);

    // 2. Upload the file
    const command = new PutObjectCommand({
      Bucket: targetBucket,
      Key: "node-test-file.txt",
      Body: "Hello to Floci from my Node backend execution script!",
      ContentType: "text/plain",
    });
    
    await s3Client.send(command);
    console.log(`✔ Success! Object successfully uploaded to local S3.`);
    
  } catch (error) {
    console.error("✖ Failed!");
    console.error(error);
  }
}

runSanityCheck();