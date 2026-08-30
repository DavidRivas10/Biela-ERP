import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { BUSINESS_PERMISSIONS } from "../auth/constants/business-permissions";
import { RequireBusinessPermissions } from "../auth/decorators/permissions.decorator";
import { AutorepuestoAuthGuard } from "../auth/guards/autorepuesto-auth.guard";
import { BusinessPermissionsGuard } from "../auth/guards/business-permissions.guard";
import { MAX_ATTACHMENT_BYTES } from "../files/file-storage.constants";
import { PurchaseAttachmentsService } from "./purchase-attachments.service";

@ApiTags("purchases")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("purchases/:id/attachments")
export class PurchaseAttachmentsController {
  constructor(private readonly attachments: PurchaseAttachmentsService) {}

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_READ)
  @ApiOperation({ summary: "List a purchase's attachments (metadata only)" })
  list(@Param("id", ParseUUIDPipe) id: string) {
    return this.attachments.list(id);
  }

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_UPDATE)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Attach a supplier invoice or document (max 5, images or PDF)",
  })
  add(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("A file field is required");
    return this.attachments.add(id, file);
  }

  @Get(":attachmentId")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_READ)
  @ApiOperation({ summary: "Download a purchase attachment's bytes" })
  async content(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
  ): Promise<StreamableFile> {
    const { attachment, stream } = await this.attachments.open(
      id,
      attachmentId,
    );
    return new StreamableFile(stream, {
      type: attachment.mimeType,
      disposition: `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
    });
  }

  @Delete(":attachmentId")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PURCHASES_UPDATE)
  @ApiOperation({ summary: "Remove a purchase attachment" })
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
  ) {
    return this.attachments.remove(id, attachmentId);
  }
}
