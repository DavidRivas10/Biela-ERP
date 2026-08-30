import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  BadRequestException,
  Injectable,
  Logger,
  type OnModuleInit,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface IncomingFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface StoredFile {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SaveOptions {
  allowedMimeTypes: readonly string[];
  maxBytes: number;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Stores uploaded product photos and purchase attachments on the local disk of
 * this service. The directory is configured with UPLOADS_DIR, is never tracked
 * in git, and is served to browsers only through the Gateway. Metadata lives in
 * PostgreSQL; this class owns just the bytes.
 */
@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly baseDir: string;

  constructor(config: ConfigService) {
    const configured = config.get<string>("UPLOADS_DIR") ?? "uploads";
    this.baseDir = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    this.logger.log(`File storage ready at ${this.baseDir}`);
  }

  async save(
    subdir: string,
    file: IncomingFile,
    options: SaveOptions,
  ): Promise<StoredFile> {
    if (!options.allowedMimeTypes.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported file type: ${file.mimetype}`,
      );
    }
    if (file.size > options.maxBytes) {
      throw new PayloadTooLargeException(
        `File exceeds ${Math.round(options.maxBytes / (1024 * 1024))} MB`,
      );
    }
    const extension = EXTENSION_BY_MIME[file.mimetype] ?? "bin";
    const storageKey = `${randomUUID()}.${extension}`;
    const directory = this.resolveDir(subdir);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, storageKey), file.buffer);
    return {
      storageKey,
      originalName: file.originalname.slice(0, 255),
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  createReadStream(subdir: string, storageKey: string): ReadStream {
    return createReadStream(this.resolveFile(subdir, storageKey));
  }

  async remove(subdir: string, storageKey: string): Promise<void> {
    try {
      await unlink(this.resolveFile(subdir, storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private resolveDir(subdir: string): string {
    if (!/^[a-z0-9-]+$/.test(subdir)) {
      throw new BadRequestException("Invalid storage directory");
    }
    return path.join(this.baseDir, subdir);
  }

  private resolveFile(subdir: string, storageKey: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(storageKey)) {
      throw new BadRequestException("Invalid storage key");
    }
    const full = path.join(this.resolveDir(subdir), storageKey);
    if (!full.startsWith(this.baseDir + path.sep)) {
      throw new BadRequestException("Invalid storage path");
    }
    return full;
  }
}
