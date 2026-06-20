import { describe, expect, it } from 'vitest';
import { isCompressedSwf } from '../src/download-swf.js';
import { getSwfHeaderSize, parseSwfTags, readRectSize } from '../src/extract-img.js';

describe('isCompressedSwf', () => {
  it('should detect CWS header as compressed', () => {
    const buf = Buffer.from('CWS\x09\x00\x00\x00\x00\x00\x00\x00');
    expect(isCompressedSwf(buf)).toBe(true);
  });

  it('should detect FWS header as uncompressed', () => {
    const buf = Buffer.from('FWS\x09\x00\x00\x00\x00\x00\x00\x00');
    expect(isCompressedSwf(buf)).toBe(false);
  });
});

describe('readRectSize', () => {
  it('should compute rect size correctly', () => {
    // First byte 0x78 = 0111 1000, nbits = 15, totalBits = 5 + 15*4 = 65, bytes = 9
    const buf = Buffer.from([0x78, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(readRectSize(buf, 0)).toBe(9);
  });
});

describe('getSwfHeaderSize', () => {
  it('should return header size for a minimal FWS buffer', () => {
    // Create a minimal valid FWS header:
    // signature "FWS", version 9, file length (little endian), then a minimal rect
    const buf = Buffer.alloc(21);
    buf.write('FWS', 0);
    buf[3] = 9; // version
    buf.writeUInt32LE(21, 4); // file length
    // rect at offset 8: first byte 0x78 => nbits=15, 9 bytes rect
    buf[8] = 0x78;
    // header = 8 + 9 + 4 = 21
    expect(getSwfHeaderSize(buf)).toBe(21);
  });
});

describe('parseSwfTags', () => {
  it('should parse short tags', () => {
    // Tag: type=1, length=10 (short form)
    // tagCodeAndLength = (1 << 6) | 10 = 74
    const buf = Buffer.alloc(12);
    buf.writeUInt16LE(74, 0); // tag header
    // 10 bytes of tag data after the 2-byte header
    const tags = parseSwfTags(buf);
    expect(tags).toHaveLength(1);
    expect(tags[0].type).toBe(1);
    expect(tags[0].data.length).toBe(10);
  });

  it('should parse long tags', () => {
    // Tag: type=2, length >= 63 -> uses extended length
    const buf = Buffer.alloc(2 + 4 + 100);
    buf.writeUInt16LE((2 << 6) | 0x3f, 0); // short header, length=63 signals long
    buf.writeUInt32LE(100, 2); // extended length = 100
    const tags = parseSwfTags(buf);
    expect(tags).toHaveLength(1);
    expect(tags[0].type).toBe(2);
    expect(tags[0].data.length).toBe(100);
  });

  it('should handle end tag (type 0)', () => {
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(0, 0); // type=0, length=0 -> end tag
    const tags = parseSwfTags(buf);
    expect(tags).toHaveLength(1);
    expect(tags[0].type).toBe(0);
    expect(tags[0].data.length).toBe(0);
  });

  it('should return empty array for empty buffer', () => {
    expect(parseSwfTags(Buffer.alloc(0))).toEqual([]);
  });
});
