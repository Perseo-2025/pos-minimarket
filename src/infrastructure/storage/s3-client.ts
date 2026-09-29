import { S3Client } from "@aws-sdk/client-s3";

// Neon Object Storage speaks the S3 protocol, so the AWS SDK is used only as
// an S3 client. The AWS_* names are the S3 convention Neon's console hands
// out — every request goes to AWS_ENDPOINT_URL_S3 (a neon.tech host), not AWS.
const REQUIRED_ENV = [
  "AWS_ENDPOINT_URL_S3",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
] as const;

let client: S3Client | null = null;

// Created lazily so `next build` and pages that never touch images don't
// require storage credentials; the first upload/read fails loudly instead.
export function getS3Client() {
  if (client) return client;

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Neon Object Storage no está configurado. Faltan: ${missing.join(", ")}`,
    );
  }

  // Endpoint, region and credentials are read from the AWS_* variables by the
  // SDK's default provider chain. Neon only supports path-style addressing.
  client = new S3Client({ forcePathStyle: true });
  return client;
}

export const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? "assets";
