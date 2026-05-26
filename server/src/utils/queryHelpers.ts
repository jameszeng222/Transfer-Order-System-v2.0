import { Knex } from 'knex';

const TIME_RANGE_FIELDS = [
  { param: 'create_time_start', paramEnd: 'create_time_end', column: 'create_time' },
  { param: 'depart_time_start', paramEnd: 'depart_time_end', column: 'depart_time' },
  { param: 'pickup_time_start', paramEnd: 'pickup_time_end', column: 'pickup_time' },
  { param: 'delivery_time_start', paramEnd: 'delivery_time_end', column: 'delivery_time' },
  { param: 'shelve_time_start', paramEnd: 'shelve_time_end', column: 'shelve_time' },
] as const;

export function applyTimeRangeFilters(query: Knex.QueryBuilder, c: any, tablePrefix?: string): Knex.QueryBuilder {
  for (const { param, paramEnd, column } of TIME_RANGE_FIELDS) {
    const start = c.req.query(param);
    const end = c.req.query(paramEnd);
    const col = tablePrefix ? `${tablePrefix}.${column}` : column;
    if (start) query = query.where(col, '>=', start);
    if (end) query = query.where(col, '<=', end + 'T23:59:59.999Z');
  }
  return query;
}
