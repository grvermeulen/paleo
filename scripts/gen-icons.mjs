// Generates cave-painting mammoth PWA icons as PNGs with zero dependencies.
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function px(buf, w, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= w || y >= w) return;
  const i = (y * w + x) * 4;
  const sa = a / 255;
  buf[i] = Math.round(r * sa + buf[i] * (1 - sa));
  buf[i + 1] = Math.round(g * sa + buf[i + 1] * (1 - sa));
  buf[i + 2] = Math.round(b * sa + buf[i + 2] * (1 - sa));
  buf[i + 3] = 255;
}

function disc(buf, w, cx, cy, rad, color) {
  for (let y = Math.floor(cy - rad); y <= cy + rad; y++)
    for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= rad) {
        const edge = rad - d;
        const a = edge < 1.5 ? Math.max(0, edge / 1.5) : 1;
        px(buf, w, x, y, [color[0], color[1], color[2], Math.round(255 * a)]);
      }
    }
}

function capsule(buf, w, x0, y0, x1, y1, rad, color) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let s = 0; s <= steps; s++) {
    const p = steps === 0 ? 0 : s / steps;
    disc(buf, w, x0 + (x1 - x0) * p, y0 + (y1 - y0) * p, rad, color);
  }
}

function makeIcon(size) {
  const S = size;
  const buf = Buffer.alloc(S * S * 4);
  // clay/ochre cave-wall background (maskable-safe: fills everything)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const t = y / S;
      const r = Math.round(0xf3 + (0xd9 - 0xf3) * t);
      const g = Math.round(0xe1 + (0xad - 0xe1) * t);
      const b = Math.round(0xc6 + (0x6f - 0xc6) * t);
      const i = (y * S + x) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }

  // Mammoth, drawn in charcoal/ochre, kept in the safe zone (center ~70%).
  const dark = [0x6b, 0x3f, 0x1f];   // charcoal-brown outline
  const body = [0x9e, 0x56, 0x0f];   // ochre body
  const tusk = [0xf4, 0xec, 0xd8];   // bone

  // big rounded body + domed head hump
  disc(buf, S, S * 0.5, S * 0.5, S * 0.245, dark);
  disc(buf, S, S * 0.5, S * 0.5, S * 0.225, body);
  disc(buf, S, S * 0.66, S * 0.40, S * 0.135, dark);
  disc(buf, S, S * 0.66, S * 0.40, S * 0.118, body);

  // legs
  for (const lx of [0.40, 0.58]) {
    capsule(buf, S, S * lx, S * 0.62, S * lx, S * 0.74, S * 0.055, dark);
    capsule(buf, S, S * lx, S * 0.62, S * lx, S * 0.73, S * 0.04, body);
  }

  // trunk: a downward curl of discs
  const trunk = [
    [0.74, 0.46], [0.78, 0.54], [0.78, 0.62], [0.74, 0.68], [0.70, 0.70],
  ];
  for (const [tx, ty] of trunk) disc(buf, S, S * tx, S * ty, S * 0.05, dark);
  for (const [tx, ty] of trunk) disc(buf, S, S * tx, S * ty, S * 0.036, body);

  // tusk
  capsule(buf, S, S * 0.72, S * 0.52, S * 0.82, S * 0.62, S * 0.022, tusk);

  // eye
  disc(buf, S, S * 0.70, S * 0.39, S * 0.022, [0x2c, 0x21, 0x17, 255]);

  return encodePNG(S, S, buf);
}

mkdirSync(new URL("../public/icons/", import.meta.url), { recursive: true });
for (const size of [192, 512]) {
  const out = new URL(`../public/icons/icon-${size}.png`, import.meta.url);
  writeFileSync(out, makeIcon(size));
  console.log("wrote", out.pathname);
}
