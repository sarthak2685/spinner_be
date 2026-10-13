import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { loadConfig } from '../../config/env';

export async function saveUpload(file: Express.Multer.File, folder: string) {
  const dir = path.join(process.cwd(), 'uploads', folder);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(file.originalname || '').toLowerCase();
  const name = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
  await fs.writeFile(path.join(dir, name), file.buffer);
  return `/uploads/${folder}/${name}`;
}

export async function writeQr(token: string, options?: { color?: string | null; logoPath?: string | null }) {
  const dir = path.join(process.cwd(), 'uploads', 'qr');
  await fs.mkdir(dir, { recursive: true });
  const file = `${token}.svg`;
  const svg = await styledQr(`${loadConfig().publicWebUrl}/play/${token}`, options?.color, options?.logoPath);
  await fs.writeFile(path.join(dir, file), svg);
  return `/uploads/qr/${file}`;
}

function tint(hex: string, towardWhite: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * towardWhite);
  return `#${[mix((value >> 16) & 255), mix((value >> 8) & 255), mix(value & 255)].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

async function styledQr(text: string, theme?: string | null, logoPath?: string | null) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const cell = 12;
  const quiet = 4;
  const pad = 56;
  const art = (size + quiet * 2) * cell;
  const dim = art + pad * 2;
  const origin = pad + quiet * cell;
  const chosen = (theme || '').trim();
  const color = /^#[0-9a-fA-F]{6}$/.test(chosen) && chosen.toLowerCase() !== '#0e6b63' ? chosen : '#111111';
  const ink = '#111111';
  const accent = tint(color, 0.55);
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  let logo = '';
  let logoSpan = 0;
  if (logoPath) {
    const relative = logoPath.replace(/^\//, '');
    try {
      const buf = await fs.readFile(path.join(process.cwd(), relative));
      const ext = path.extname(relative).slice(1).toLowerCase();
      const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      logoSpan = Math.max(7, Math.round(size * 0.2));
      const plate = logoSpan * cell;
      const px = origin + (size * cell - plate) / 2;
      logo = `<rect x="${px}" y="${px}" width="${plate}" height="${plate}" rx="${cell * 1.3}" fill="#fff"/>
        <rect x="${px + 5}" y="${px + 5}" width="${plate - 10}" height="${plate - 10}" rx="${cell}" fill="none" stroke="${accent}" stroke-width="2"/>
        <image href="data:${mime};base64,${buf.toString('base64')}" x="${px + 12}" y="${px + 12}" width="${plate - 24}" height="${plate - 24}" preserveAspectRatio="xMidYMid slice"/>`;
    } catch {
      logo = '';
      logoSpan = 0;
    }
  }
  const cx = (size - 1) / 2;
  const hidden = (x: number, y: number) => logoSpan > 0 && Math.abs(x - cx) <= logoSpan / 2 && Math.abs(y - cx) <= logoSpan / 2;
  const dark = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && Boolean(qr.modules.get(y, x)) && !finder(x, y) && !hidden(x, y);
  const marks: string[] = [];
  const radius = cell * 0.34;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!dark(x, y)) continue;
      const px = origin + x * cell + cell / 2;
      const py = origin + y * cell + cell / 2;
      marks.push(`<circle cx="${px}" cy="${py}" r="${radius.toFixed(2)}" fill="${ink}"/>`);
      if (dark(x + 1, y)) marks.push(`<rect x="${px}" y="${(py - radius).toFixed(2)}" width="${cell}" height="${(radius * 2).toFixed(2)}" fill="${ink}"/>`);
      if (dark(x, y + 1)) marks.push(`<rect x="${(px - radius).toFixed(2)}" y="${py}" width="${(radius * 2).toFixed(2)}" height="${cell}" fill="${ink}"/>`);
    }
  }
  const eye = (moduleX: number, moduleY: number) => {
    const x = origin + moduleX * cell;
    const y = origin + moduleY * cell;
    const outer = 7 * cell;
    return `<rect x="${x}" y="${y}" width="${outer}" height="${outer}" rx="${cell * 1.7}" fill="${ink}"/>
      <rect x="${x + cell}" y="${y + cell}" width="${5 * cell}" height="${5 * cell}" rx="${cell * 1.15}" fill="#fff"/>
      <rect x="${x + 2 * cell}" y="${y + 2 * cell}" width="${3 * cell}" height="${3 * cell}" rx="${cell * 0.85}" fill="${ink}"/>`;
  };
  const mid = dim / 2;
  const frame = `
    <rect x="8" y="8" width="${dim - 16}" height="${dim - 16}" rx="34" fill="none" stroke="${color}" stroke-width="3"/>
    <rect x="16" y="16" width="${dim - 32}" height="${dim - 32}" rx="28" fill="none" stroke="${accent}" stroke-width="1.4"/>
    <path d="M 22 46 L 22 22 L 46 22" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M ${dim - 22} 46 L ${dim - 22} 22 L ${dim - 46} 22" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 22 ${dim - 46} L 22 ${dim - 22} L 46 ${dim - 22}" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M ${dim - 22} ${dim - 46} L ${dim - 22} ${dim - 22} L ${dim - 46} ${dim - 22}" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="22" cy="22" r="4" fill="${color}"/>
    <circle cx="${dim - 22}" cy="22" r="4" fill="${color}"/>
    <circle cx="22" cy="${dim - 22}" r="4" fill="${color}"/>
    <circle cx="${dim - 22}" cy="${dim - 22}" r="4" fill="${color}"/>
    <line x1="${mid - 22}" y1="22" x2="${mid + 22}" y2="22" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
    <line x1="${mid - 22}" y1="${dim - 22}" x2="${mid + 22}" y2="${dim - 22}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
    <line x1="22" y1="${mid - 22}" x2="22" y2="${mid + 22}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
    <line x1="${dim - 22}" y1="${mid - 22}" x2="${dim - 22}" y2="${mid + 22}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M ${mid} 14 L ${mid + 6} 22 L ${mid} 30 L ${mid - 6} 22 Z" fill="${color}"/>
    <path d="M ${mid} ${dim - 30} L ${mid + 6} ${dim - 22} L ${mid} ${dim - 14} L ${mid - 6} ${dim - 22} Z" fill="${color}"/>
    <path d="M 14 ${mid} L 22 ${mid + 6} L 30 ${mid} L 22 ${mid - 6} Z" fill="${color}"/>
    <path d="M ${dim - 30} ${mid} L ${dim - 22} ${mid + 6} L ${dim - 14} ${mid} L ${dim - 22} ${mid - 6} Z" fill="${color}"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">
  <!-- rs-qr-v5 -->
  <rect width="${dim}" height="${dim}" rx="36" fill="#ffffff"/>
  <rect x="${pad - 10}" y="${pad - 10}" width="${art + 20}" height="${art + 20}" rx="22" fill="#fff"/>
  ${frame}
  ${marks.join('')}
  ${eye(0, 0)}${eye(size - 7, 0)}${eye(0, size - 7)}
  ${logo}
</svg>`;
}

export function numOrNull(value?: string | number | null) {
  const n = Number(value);
  return n > 0 ? n : null;
}
