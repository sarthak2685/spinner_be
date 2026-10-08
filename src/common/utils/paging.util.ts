export type PageQuery = {
  page?: string;
  pageSize?: string;
  from?: string;
  to?: string;
};

export function pageParams(query: PageQuery = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
  const today = new Date().toISOString().slice(0, 10);
  const from = (query.from || today).slice(0, 10);
  const to = (query.to || from).slice(0, 10);
  return { page, pageSize, from, to, offset: (page - 1) * pageSize };
}

export function pageResult<T>(rows: T[], total: number, page: number, pageSize: number) {
  return { rows, total, page, pageSize };
}
