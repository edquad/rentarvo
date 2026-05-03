import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

export interface StorageProvider {
  save(filename: string, buffer: Buffer): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  getPath(storageKey: string): string;
}

class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(config.upload.dir);
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

export const storage: StorageProvider = new LocalStorageProvider();
