const audio = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac']

const video = ['video/mp4', 'video/mov', 'video/3gpp', 'video/quicktime']

const image = [
  'image/jpg',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/svg',
  'binary/octet-stream',
  'image/bmp',
  'image/tiff',
  'image/x-icon',
  'image/avif',
  'image/heic',
  'image/heif',
]

export const MEDIA_TYPES = {
  image,
  audio,
  video,
  all: [...image, ...video, ...audio],
}
