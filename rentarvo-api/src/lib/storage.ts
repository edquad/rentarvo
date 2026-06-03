import fs from 'node:fs';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { config } from '../config/index.js';

export interface StorageProvider {
  save(filename: string, buffer: Buffer, mimeType?: string): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  getPath(storageKey: string): string;
}

class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(config.storage.localDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async save(filename: string, buffer: Buffer): Promise<string> {
    const ext = path.extname(filename);
    const storageKey = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(this.baseDir, storageKey);
    await fs.promises.writeFile(filePath, buffer);
    return storageKey;
  }

  async read(storageKey: string): Promise<Buffer> {
    const filePath = path.join(this.baseDir, path.basename(storageKey));
    return fs.promises.readFile(filePath);
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = path.join(this.baseDir, path.basename(storageKey));
    await fs.promises.unlink(filePath);
  }

  getPath(storageKey: string): string {
    return path.join(this.baseDir, path.basename(storageKey));
  }
}

class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor() {
    const { bucket, region, accessKeyId, secretAccessKey, prefix } = config.storage.s3;
    if (!bucket) {
      throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
    }
    this.bucket = bucket;
    this.prefix = prefix.replace(/\/$/, '');
    this.client = new S3Client({
      region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  private objectKey(storageKey: string): string {
    return storageKey.startsWith(this.prefix + '/')
      ? storageKey
      : `${this.prefix}/${storageKey}`;
  }

  async save(filename: string, buffer: Buffer, mimeType?: string): Promise<string> {
    const ext = path.extname(filename) || '';
    const storageKey = `documents/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(storageKey),
        Body: buffer,
        ContentType: mimeType || 'application/octet-stream',
        ServerSideEncryption: 'AES256',
      }),
    );
    return storageKey;
  }

  async read(storageKey: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(storageKey),
      }),
    );
    const body = res.Body;
    if (!body) throw new Error('Empty S3 object body');
    return Buffer.from(await body.transformToByteArray());
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(storageKey),
      }),
    );
  }

  getPath(storageKey: string): string {
    return `s3://${this.bucket}/${this.objectKey(storageKey)}`;
  }
}

/** Keys from local disk (no documents/ prefix) vs S3 */
function isS3StorageKey(storageKey: string): boolean {
  return storageKey.startsWith('documents/');
}

class HybridStorageProvider implements StorageProvider {
  private s3: S3StorageProvider;
  private local: LocalStorageProvider;

  constructor() {
    this.s3 = new S3StorageProvider();
    this.local = new LocalStorageProvider();
  }

  async save(filename: string, buffer: Buffer, mimeType?: string): Promise<string> {
    return this.s3.save(filename, buffer, mimeType);
  }

  async read(storageKey: string): Promise<Buffer> {
    if (isS3StorageKey(storageKey)) return this.s3.read(storageKey);
    return this.local.read(storageKey);
  }

  async delete(storageKey: string): Promise<void> {
    if (isS3StorageKey(storageKey)) return this.s3.delete(storageKey);
    return this.local.delete(storageKey);
  }

  getPath(storageKey: string): string {
    if (isS3StorageKey(storageKey)) return this.s3.getPath(storageKey);
    return this.local.getPath(storageKey);
  }
}

function createStorageProvider(): StorageProvider {
  if (config.storage.driver === 's3') {
    return new HybridStorageProvider();
  }
  return new LocalStorageProvider();
}

export const storage: StorageProvider = createStorageProvider();
