import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'node:crypto';
import { verifyUploadSignAuth } from './upload-sign-auth.js';

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  const base = name.replace(/^.*[/\\]/, '').slice(0, 180);
  return base.replace(/[^a-zA-Z0-9._\-()+ ]/g, '_') || 'file';
}

export async function handleUploadSignPost(
  rawBody: unknown,
  opts?: { authHeader?: string | undefined },
): Promise<
  | { ok: true; uploadUrl: string; key: string; publicUrl?: string }
  | { ok: false; status: number; error: string }
> {
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) {
    return { ok: false, status: 503, error: 'Object storage is not configured (S3_* env vars).' };
  }

  const auth = await verifyUploadSignAuth(opts?.authHeader);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }

  if (!rawBody || typeof rawBody !== 'object') {
    return { ok: false, status: 400, error: 'Invalid JSON body' };
  }

  const b = rawBody as Record<string, unknown>;
  const filename = typeof b.filename === 'string' ? b.filename : '';
  const contentType =
    typeof b.contentType === 'string' && b.contentType.trim() ? b.contentType.trim().slice(0, 200) : 'application/octet-stream';
  const size = typeof b.size === 'number' ? b.size : Number(b.size);

  if (!filename || !Number.isFinite(size) || size <= 0) {
    return { ok: false, status: 400, error: 'filename and positive size required' };
  }

  const maxBytes = Number(process.env.UPLOAD_MAX_BYTES || DEFAULT_MAX_BYTES);
  const cap = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_MAX_BYTES;
  if (size > cap) {
    return { ok: false, status: 400, error: `File too large (max ${cap} bytes)` };
  }

  const region = process.env.S3_REGION?.trim() || 'auto';
  const endpoint = process.env.S3_ENDPOINT?.trim();

  const safeName = sanitizeFilename(filename);
  const key = `uploads/${Date.now()}-${randomBytes(6).toString('hex')}-${safeName}`;

  const client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: Boolean(endpoint),
  });

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  let uploadUrl: string;
  try {
    const ttl = Number(process.env.UPLOAD_SIGN_TTL_SEC || 3600);
    uploadUrl = await getSignedUrl(client, command, {
      expiresIn: Number.isFinite(ttl) ? ttl : 3600,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not sign upload URL';
    return { ok: false, status: 500, error: msg };
  }

  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '');
  const publicUrl = base ? `${base}/${key.split('/').map(encodeURIComponent).join('/')}` : undefined;

  return { ok: true, uploadUrl, key, publicUrl };
}
