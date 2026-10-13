import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DatabaseService } from '../../database/database.module';
import { saveUpload } from '../../common/utils/files.util';
import { validateVideo } from '../../common/utils/validation.util';

const LIMIT = 12;

type MediaRow = {
  mediakey: string;
  title: string | null;
  filepath: string | null;
  originalname: string | null;
  published: boolean;
  sortorder: number;
  updateddate: string | null;
};

export type HowClip = {
  id: string;
  title: string;
  name: string | null;
  published: boolean;
  updated: string | null;
  hasFile: boolean;
};

@Injectable()
export class LandingMediaService {
  private ready: Promise<void> | null = null;
  constructor(private readonly db: DatabaseService) {}

  private ensure() {
    this.ready ??= this.db.query(`CREATE TABLE IF NOT EXISTS public."LandingMedia" (
      mediakey VARCHAR(40) PRIMARY KEY,
      title VARCHAR(120),
      filepath TEXT,
      originalname VARCHAR(200),
      published BOOLEAN NOT NULL DEFAULT true,
      sortorder INTEGER NOT NULL DEFAULT 0,
      updateddate TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`).then(() => this.db.query(`ALTER TABLE public."LandingMedia" ADD COLUMN IF NOT EXISTS title VARCHAR(120)`))
      .then(() => this.db.query(`ALTER TABLE public."LandingMedia" ADD COLUMN IF NOT EXISTS sortorder INTEGER NOT NULL DEFAULT 0`))
      .then(() => undefined);
    return this.ready;
  }

  private absolute(filepath: string) {
    if (!filepath.startsWith('/uploads/how/')) return '';
    const root = path.resolve(process.cwd(), 'uploads', 'how');
    const target = path.resolve(process.cwd(), filepath.replace(/^\/+/, ''));
    const rel = path.relative(root, target);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return '';
    return target;
  }

  private async drop(filepath?: string | null) {
    if (!filepath) return;
    const target = this.absolute(filepath);
    if (!target) return;
    await fs.unlink(target).catch(() => undefined);
  }

  private async present(filepath: string | null) {
    const target = filepath ? this.absolute(filepath) : '';
    if (!target) return false;
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  private key(id: string) {
    const value = String(id || '').trim();
    if (!/^[a-z0-9-]{1,40}$/i.test(value)) throw new NotFoundException('Video is not available.');
    return value;
  }

  private label(row: MediaRow) {
    const title = (row.title || '').trim();
    if (title) return title;
    const file = (row.originalname || '').replace(/\.[^.]+$/, '').trim();
    return file || 'How it works';
  }

  private async rows() {
    await this.ensure();
    const rows = await this.db.many<MediaRow>(
      `SELECT mediakey, title, filepath, originalname, published, sortorder, updateddate
       FROM public."LandingMedia"
       ORDER BY sortorder ASC, updateddate ASC, mediakey ASC`,
    );
    const tied = rows.some((row, index) => index > 0 && Number(row.sortorder) === Number(rows[index - 1].sortorder));
    if (!tied) return rows;
    for (let index = 0; index < rows.length; index += 1) {
      rows[index].sortorder = index;
      await this.db.query(`UPDATE public."LandingMedia" SET sortorder=$2 WHERE mediakey=$1`, [rows[index].mediakey, index]);
    }
    return rows;
  }

  private async one(id: string) {
    const key = this.key(id);
    await this.ensure();
    const row = await this.db.one<MediaRow>(
      `SELECT mediakey, title, filepath, originalname, published, sortorder, updateddate FROM public."LandingMedia" WHERE mediakey=$1`,
      [key],
    );
    if (!row) throw new NotFoundException('Video is not available.');
    return row;
  }

  private async pack(rows: MediaRow[]): Promise<HowClip[]> {
    const videos: HowClip[] = [];
    for (const row of rows) {
      const hasFile = await this.present(row.filepath);
      videos.push({
        id: row.mediakey,
        title: this.label(row),
        name: hasFile ? row.originalname || null : null,
        published: Boolean(row.published),
        updated: hasFile ? row.updateddate || null : null,
        hasFile,
      });
    }
    return videos;
  }

  async list() {
    return { videos: await this.pack(await this.rows()) };
  }

  async publicStatus() {
    const videos = (await this.pack(await this.rows()))
      .filter((video) => video.published && video.hasFile)
      .map((video) => ({ id: video.id, title: video.title }));
    return { available: videos.length > 0, videos };
  }

  async open(publishedOnly: boolean, id = '') {
    const rows = await this.rows();
    const wanted = id ? this.key(id) : '';
    let row = wanted ? rows.find((item) => item.mediakey === wanted) : undefined;
    if (wanted && !row) throw new NotFoundException('Video is not available.');
    if (!row) {
      for (const item of rows) {
        if (publishedOnly && !item.published) continue;
        if (await this.present(item.filepath)) {
          row = item;
          break;
        }
      }
    }
    if (!row?.filepath) throw new NotFoundException('Video is not available.');
    if (publishedOnly && !row.published) throw new NotFoundException('Video is not available.');
    const target = this.absolute(row.filepath);
    if (!target) throw new NotFoundException('Video is not available.');
    try {
      await fs.access(target);
    } catch {
      throw new NotFoundException('Video is not available.');
    }
    const mime = path.extname(target).toLowerCase() === '.webm' ? 'video/webm' : 'video/mp4';
    return { absolute: target, mime };
  }

  private cleanTitle(value: string | undefined, fallback: string) {
    const title = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    return title || fallback.slice(0, 80);
  }

  async add(file?: Express.Multer.File, title?: string) {
    const message = validateVideo(file);
    if (message || !file) throw new BadRequestException(message || 'Choose a video file.');
    const current = await this.rows();
    if (current.length >= LIMIT) throw new BadRequestException(`You can add up to ${LIMIT} videos.`);
    const filepath = await saveUpload(file, 'how');
    const name = (file.originalname || 'video').slice(0, 200);
    const key = `how-${randomBytes(8).toString('hex')}`;
    const sort = current.reduce((max, row) => Math.max(max, Number(row.sortorder) || 0), -1) + 1;
    await this.db.query(
      `INSERT INTO public."LandingMedia" (mediakey, title, filepath, originalname, published, sortorder, updateddate)
       VALUES ($1, $2, $3, $4, true, $5, CURRENT_TIMESTAMP)`,
      [key, this.cleanTitle(title, name.replace(/\.[^.]+$/, '')), filepath, name, sort],
    );
    return this.list();
  }

  async replace(id: string, file?: Express.Multer.File) {
    const message = validateVideo(file);
    if (message || !file) throw new BadRequestException(message || 'Choose a video file.');
    const row = await this.one(id);
    const filepath = await saveUpload(file, 'how');
    const name = (file.originalname || 'video').slice(0, 200);
    await this.db.query(
      `UPDATE public."LandingMedia" SET filepath=$2, originalname=$3, updateddate=CURRENT_TIMESTAMP WHERE mediakey=$1`,
      [row.mediakey, filepath, name],
    );
    if (row.filepath && row.filepath !== filepath) await this.drop(row.filepath);
    return this.list();
  }

  async rename(id: string, title: string) {
    const row = await this.one(id);
    const next = this.cleanTitle(title, this.label(row));
    await this.db.query(`UPDATE public."LandingMedia" SET title=$2 WHERE mediakey=$1`, [row.mediakey, next]);
    return this.list();
  }

  async publish(id: string, published: boolean) {
    const row = await this.one(id);
    if (!row.filepath || !(await this.present(row.filepath))) throw new BadRequestException('Upload a video first.');
    await this.db.query(`UPDATE public."LandingMedia" SET published=$2, updateddate=CURRENT_TIMESTAMP WHERE mediakey=$1`, [row.mediakey, published]);
    return this.list();
  }

  async move(id: string, direction: 'up' | 'down') {
    const rows = await this.rows();
    const index = rows.findIndex((row) => row.mediakey === this.key(id));
    const next = direction === 'down' ? index + 1 : index - 1;
    if (index < 0 || next < 0 || next >= rows.length) return this.list();
    await this.db.query(`UPDATE public."LandingMedia" SET sortorder=$2 WHERE mediakey=$1`, [rows[index].mediakey, rows[next].sortorder]);
    await this.db.query(`UPDATE public."LandingMedia" SET sortorder=$2 WHERE mediakey=$1`, [rows[next].mediakey, rows[index].sortorder]);
    return this.list();
  }

  async remove(id: string) {
    const row = await this.one(id);
    await this.drop(row.filepath);
    await this.db.query(`DELETE FROM public."LandingMedia" WHERE mediakey=$1`, [row.mediakey]);
    return this.list();
  }
}
