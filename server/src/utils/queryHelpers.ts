import { Knex } from 'knex';

const TIME_RANGE_FIELDS = [
  { param: 'create_time_start', paramEnd: 'create_time_end', column: 'create_time' },
  { param: 'departure_time_start', paramEnd: 'departure_time_end', column: 'departure_time' },
  { param: 'pickup_time_start', paramEnd: 'pickup_time_end', column: 'pickup_time' },
  { param: 'logistics_sign_time_start', paramEnd: 'logistics_sign_time_end', column: 'logistics_sign_time' },
  { param: 'shelf_time_start', paramEnd: 'shelf_time_end', column: 'shelf_time' },
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
