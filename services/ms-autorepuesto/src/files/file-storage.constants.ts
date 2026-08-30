export const STORAGE_DIRS = {
  productPhotos: "product-photos",
  purchaseAttachments: "purchase-attachments",
} as const;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ATTACHMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, "application/pdf"];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const MAX_PRODUCT_PHOTOS = 5;
export const MAX_PURCHASE_ATTACHMENTS = 5;
