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
import { ProductPhotosService } from "./product-photos.service";

@ApiTags("products")
@ApiBearerAuth()
@UseGuards(AutorepuestoAuthGuard, BusinessPermissionsGuard)
@Controller("products/:id/photos")
export class ProductPhotosController {
  constructor(private readonly photos: ProductPhotosService) {}

  @Get()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_READ)
  @ApiOperation({ summary: "List a product's photos (metadata only)" })
  list(@Param("id", ParseUUIDPipe) id: string) {
    return this.photos.list(id);
  }

  @Post()
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_UPDATE)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Add a photo to a product (max 5, images only)" })
  add(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("A file field is required");
    return this.photos.add(id, file);
  }

  @Get(":photoId")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_READ)
  @ApiOperation({ summary: "Download a product photo's bytes" })
  async content(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("photoId", ParseUUIDPipe) photoId: string,
  ): Promise<StreamableFile> {
    const { photo, stream } = await this.photos.open(id, photoId);
    return new StreamableFile(stream, {
      type: photo.mimeType,
      disposition: `inline; filename="${encodeURIComponent(photo.originalName)}"`,
    });
  }

  @Delete(":photoId")
  @RequireBusinessPermissions(BUSINESS_PERMISSIONS.PRODUCTS_UPDATE)
  @ApiOperation({ summary: "Remove a product photo" })
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("photoId", ParseUUIDPipe) photoId: string,
  ) {
    return this.photos.remove(id, photoId);
  }
}
