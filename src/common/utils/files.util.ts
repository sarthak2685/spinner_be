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

export async function writeQr(token: string) {
  const dir = path.join(process.cwd(), 'uploads', 'qr');
  await fs.mkdir(dir, { recursive: true });
  const file = `${token}.png`;
  await QRCode.toFile(path.join(dir, file), `${loadConfig().publicWebUrl}/play/${token}`, { width: 480, margin: 1 });
  return `/uploads/qr/${file}`;
}

export function numOrNull(value?: string | number | null) {
  const n = Number(value);
  return n > 0 ? n : null;
}
