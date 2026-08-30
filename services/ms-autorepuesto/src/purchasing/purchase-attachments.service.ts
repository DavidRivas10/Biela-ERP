import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import {
  ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_PURCHASE_ATTACHMENTS,
  STORAGE_DIRS,
} from "../files/file-storage.constants";
import {
  FileStorageService,
  type IncomingFile,
} from "../files/file-storage.service";

@Injectable()
export class PurchaseAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
  ) {}

  private async requirePurchase(purchaseId: string): Promise<void> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      select: { id: true },
    });
    if (!purchase) throw new NotFoundException("Purchase not found");
  }

  async list(purchaseId: string) {
    await this.requirePurchase(purchaseId);
    return this.prisma.purchaseAttachment.findMany({
      where: { purchaseId },
      orderBy: { createdAt: "asc" },
    });
  }

  async add(purchaseId: string, file: IncomingFile) {
    await this.requirePurchase(purchaseId);
    const count = await this.prisma.purchaseAttachment.count({
      where: { purchaseId },
    });
    if (count >= MAX_PURCHASE_ATTACHMENTS) {
      throw new BadRequestException(
        `A purchase can have at most ${MAX_PURCHASE_ATTACHMENTS} attachments`,
      );
    }
    const stored = await this.storage.save(
      STORAGE_DIRS.purchaseAttachments,
      file,
      { allowedMimeTypes: ATTACHMENT_MIME_TYPES, maxBytes: MAX_ATTACHMENT_BYTES },
    );
    try {
      await this.prisma.purchaseAttachment.create({
        data: {
          purchaseId,
          storageKey: stored.storageKey,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
        },
      });
    } catch (error) {
      await this.storage.remove(
        STORAGE_DIRS.purchaseAttachments,
        stored.storageKey,
      );
      throw error;
    }
    return this.list(purchaseId);
  }

  async open(purchaseId: string, attachmentId: string) {
    const attachment = await this.prisma.purchaseAttachment.findFirst({
      where: { id: attachmentId, purchaseId },
    });
    if (!attachment) throw new NotFoundException("Attachment not found");
    return {
      attachment,
      stream: this.storage.createReadStream(
        STORAGE_DIRS.purchaseAttachments,
        attachment.storageKey,
      ),
    };
  }

  async remove(purchaseId: string, attachmentId: string) {
    const attachment = await this.prisma.purchaseAttachment.findFirst({
      where: { id: attachmentId, purchaseId },
    });
    if (!attachment) throw new NotFoundException("Attachment not found");
    await this.prisma.purchaseAttachment.delete({ where: { id: attachmentId } });
    await this.storage.remove(
      STORAGE_DIRS.purchaseAttachments,
      attachment.storageKey,
    );
    return this.list(purchaseId);
  }
}
