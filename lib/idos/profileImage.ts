import {PROFILE_AVATAR_MAX_BYTES, validateProfileAvatar, type ProfileAvatar} from './profile';

/** Decode a raster upload, crop it locally, and persist only a small re-encoded JPEG (no EXIF). */
export async function prepareProfileImage(file: File): Promise<ProfileAvatar> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size < 1) throw new Error('PROFILE_IMAGE_FILE_INVALID');
  let image: ImageBitmap;
  try {image = await createImageBitmap(file);} catch {throw new Error('PROFILE_IMAGE_FILE_INVALID');}
  try {
    if (!image.width || !image.height || image.width > 8192 || image.height > 8192 || image.width * image.height > 40_000_000) throw new Error('PROFILE_IMAGE_FILE_INVALID');
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PROFILE_IMAGE_FILE_INVALID');
    context.fillStyle = '#241a15'; context.fillRect(0, 0, 128, 128);
    const side = Math.min(image.width, image.height);
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 128, 128);
    for (const quality of [.85, .7, .5]) {
      const dataURL = canvas.toDataURL('image/jpeg', quality);
      if (dataURL.length <= PROFILE_AVATAR_MAX_BYTES - 100) return validateProfileAvatar({version: 1, kind: 'image', dataURL});
    }
    throw new Error('PROFILE_IMAGE_FILE_INVALID');
  } finally {image.close();}
}
