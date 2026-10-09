import { Injectable, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseService } from './database.service';

export function splitSql(sql: string) {
  const statements: string[] = [];
  let current = '';
  let dollar = false;
  for (let i = 0; i < sql.length; i++) {
    if (sql.startsWith('$$', i)) {
      dollar = !dollar;
      current += '$$';
      i += 1;
      continue;
    }
    if (sql[i] === ';' && !dollar) {
      const statement = current.trim();
      if (statement.replace(/--[^\n]*/g, '').trim()) statements.push(statement);
      current = '';
      continue;
    }
    current += sql[i];
  }
  const tail = current.trim();
  if (tail.replace(/--[^\n]*/g, '').trim()) statements.push(tail);
  return statements;
}

function schemaSql() {
  const candidates = [
    join(__dirname, 'schema.sql'),
    join(process.cwd(), 'src', 'database', 'schema.sql'),
    join(process.cwd(), 'dist', 'database', 'schema.sql'),
  ];
  for (const file of candidates) {
    try { return readFileSync(file, 'utf8'); } catch { /* try the next location */ }
  }
  throw new Error('schema.sql was not found next to the API.');
}

@Injectable()
export class SchemaService implements OnModuleInit {
  private pending: Promise<void> | null = null;

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    return this.apply();
  }

  apply() {
    this.pending ??= this.run();
    return this.pending;
  }

  private async run() {
    const statements = splitSql(schemaSql());
    for (const statement of statements) await this.db.query(statement);
    console.log('Database schema is ready.');
  }
}
