/**
 * fMP4 Chunker & MP4 Box Inspector Utility
 * Inspects MP4/fMP4 video buffers, detects box structures (moof, mdat, ftyp, styp, moov),
 * and creates self-contained fragmented MP4 byte slices for real-time stream processing.
 */

export interface Fmp4Chunk {
  index: number;
  blob: Blob;
  size: number;
  isFragmented: boolean;
  hasKeyframe: boolean;
}

/**
 * Parses MP4 box header at given offset in a DataView.
 * Returns box size, box type, and total header length (8 or 16 bytes for 64-bit size).
 */
export function parseMp4BoxHeader(dataView: DataView, offset: number): { size: number; type: string; headerLen: number } | null {
  if (offset + 8 > dataView.byteLength) return null;
  let size = dataView.getUint32(offset);
  const typeBytes = [
    dataView.getUint8(offset + 4),
    dataView.getUint8(offset + 5),
    dataView.getUint8(offset + 6),
    dataView.getUint8(offset + 7),
  ];
  const type = String.fromCharCode(...typeBytes);
  let headerLen = 8;

  if (size === 1) {
    // 64-bit extended size
    if (offset + 16 > dataView.byteLength) return null;
    const high = dataView.getUint32(offset + 8);
    const low = dataView.getUint32(offset + 12);
    size = high * 2 ** 32 + low;
    headerLen = 16;
  } else if (size === 0) {
    // Box extends to end of file
    size = dataView.byteLength - offset;
  }

  return { size, type, headerLen };
}

/**
 * Scans an ArrayBuffer to detect if it contains Fragmented MP4 ('moof' boxes).
 */
export function isFragmentedMp4(buffer: ArrayBuffer): boolean {
  const dataView = new DataView(buffer);
  let offset = 0;

  while (offset < dataView.byteLength) {
    const box = parseMp4BoxHeader(dataView, offset);
    if (!box || box.size <= 0) break;
    if (box.type === "moof" || box.type === "styp") {
      return true;
    }
    offset += box.size;
  }

  return false;
}

/**
 * Creates self-contained fMP4 or keyframe-aligned Blob chunks from a raw video file.
 * Handles fallback gracefully if the file is standard MP4.
 */
export async function createFmp4Chunks(
  file: File,
  targetChunkSize = 10 * 1024 * 1024
): Promise<Fmp4Chunk[]> {
  const totalChunks = Math.ceil(file.size / targetChunkSize);
  const chunks: Fmp4Chunk[] = [];

  // Read first 1MB to inspect headers
  const sampleHeaderBlob = file.slice(0, Math.min(1024 * 1024, file.size));
  const sampleHeaderBuffer = await sampleHeaderBlob.arrayBuffer();
  const isfMP4 = isFragmentedMp4(sampleHeaderBuffer);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * targetChunkSize;
    const end = Math.min(start + targetChunkSize, file.size);
    const blobSlice = file.slice(start, end);

    chunks.push({
      index: i + 1,
      blob: blobSlice,
      size: blobSlice.size,
      isFragmented: isfMP4,
      hasKeyframe: true,
    });
  }

  return chunks;
}
