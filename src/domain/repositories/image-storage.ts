export interface StoredImage {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength?: number;
}

// Port for binary image storage. The domain only knows object keys; how and
// where bytes live (Neon Object Storage, S3, disk) is an infrastructure detail.
export interface ImageStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredImage | null>;
  // Idempotent: deleting a key that doesn't exist is not an error.
  delete(key: string): Promise<void>;
}
