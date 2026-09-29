import { S3Client } from "@aws-sdk/client-s3";

// S3-compatible object storage (Neon Storage). Reads AWS_ENDPOINT_URL_S3,
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION from the
// environment automatically via the SDK's default provider chains.
//
// Not wired into any use case or UI yet — this is only the configured
// client, ready for a future ProductImageRepository (or similar) to use.
export const s3 = new S3Client({ forcePathStyle: true });

export const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? "assets";
