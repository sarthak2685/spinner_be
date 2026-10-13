import { createReadStream } from 'fs';
import { Request, Response } from 'express';
import { stat } from 'fs/promises';

export async function pipeMedia(req: Request, res: Response, absolute: string, mime: string) {
  const info = await stat(absolute);
  const size = info.size;
  res.setHeader('Content-Type', mime);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  const header = req.headers.range;
  if (!header) {
    res.setHeader('Content-Length', size);
    createReadStream(absolute).pipe(res);
    return;
  }
  const parts = /^bytes=(\d*)-(\d*)$/.exec(header);
  const start = parts && parts[1] ? Number(parts[1]) : 0;
  const end = parts && parts[2] ? Number(parts[2]) : size - 1;
  if (!parts || start < 0 || end >= size || start > end) {
    res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
    return;
  }
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
  res.setHeader('Content-Length', end - start + 1);
  createReadStream(absolute, { start, end }).pipe(res);
}
