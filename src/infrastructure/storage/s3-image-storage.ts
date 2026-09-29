import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type {
  ImageStorage,
  StoredImage,
} from "@/domain/repositories/image-storage";
import { getS3Client, STORAGE_BUCKET } from "./s3-client";

export class S3ImageStorage implements ImageStorage {
  async put(key: string, body: Uint8Array, contentType: string) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async get(key: string): Promise<StoredImage | null> {
    try {
      const object = await getS3Client().send(
        new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }),
      );
      if (!object.Body) return null;

      return {
        body: object.Body.transformToWebStream(),
        contentType: object.ContentType ?? "application/octet-stream",
        contentLength: object.ContentLength,
      };
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }

  async delete(key: string) {
    // S3 DeleteObject already succeeds for missing keys.
    await getS3Client().send(
      new DeleteObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }),
    );
  }
}
