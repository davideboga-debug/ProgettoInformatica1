import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const BUCKET = process.env.S3_BUCKET ?? "item-photos";

const endpoint = process.env.AWS_ENDPOINT_URL_S3;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION;

if (!endpoint || !accessKeyId || !secretAccessKey || !region) {
  throw new Error("Credenziali Object Storage mancanti. Esegui `neon deploy`.");
}

export const s3 = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey },
  // Neon usa path-style: endpoint/bucket/key, non bucket.endpoint/key.
  forcePathStyle: true,
});

/**
 * Il bucket è public_read: l'oggetto è leggibile senza firma.
 * Le chiavi sono immutabili (uuid nel nome), così la CDN può fare cache.
 */
export function publicUrl(key: string): string {
  if (/^https?:\/\//i.test(key)) return key;
  const path = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${endpoint}/${BUCKET}/${path}`;
}

export async function presignUpload(
  key: string,
  contentType: string,
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 600 },
  );
}
