import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_PRODUCT_PHOTOS,
  STORAGE_DIRS,
} from "../files/file-storage.constants";
import {
  FileStorageService,
  type IncomingFile,
} from "../files/file-storage.service";

@Injectable()
export class ProductPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
  ) {}

  private async requireProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product not found");
  }

  async list(productId: string) {
    await this.requireProduct(productId);
    return this.prisma.productPhoto.findMany({
      where: { productId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  async add(productId: string, file: IncomingFile) {
    await this.requireProduct(productId);
    const count = await this.prisma.productPhoto.count({ where: { productId } });
    if (count >= MAX_PRODUCT_PHOTOS) {
      throw new BadRequestException(
        `A product can have at most ${MAX_PRODUCT_PHOTOS} photos`,
      );
    }
    const stored = await this.storage.save(STORAGE_DIRS.productPhotos, file, {
      allowedMimeTypes: IMAGE_MIME_TYPES,
      maxBytes: MAX_IMAGE_BYTES,
    });
    const highest = await this.prisma.productPhoto.aggregate({
      where: { productId },
      _max: { position: true },
    });
    try {
      await this.prisma.productPhoto.create({
        data: {
          productId,
          storageKey: stored.storageKey,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          position: (highest._max.position ?? -1) + 1,
        },
      });
    } catch (error) {
      await this.storage.remove(STORAGE_DIRS.productPhotos, stored.storageKey);
      throw error;
    }
    return this.list(productId);
  }

  async open(productId: string, photoId: string) {
    const photo = await this.prisma.productPhoto.findFirst({
      where: { id: photoId, productId },
    });
    if (!photo) throw new NotFoundException("Photo not found");
    return {
      photo,
      stream: this.storage.createReadStream(
        STORAGE_DIRS.productPhotos,
        photo.storageKey,
      ),
    };
  }

  async remove(productId: string, photoId: string) {
    const photo = await this.prisma.productPhoto.findFirst({
      where: { id: photoId, productId },
    });
    if (!photo) throw new NotFoundException("Photo not found");
    await this.prisma.productPhoto.delete({ where: { id: photoId } });
    await this.storage.remove(STORAGE_DIRS.productPhotos, photo.storageKey);
    return this.list(productId);
  }
}
