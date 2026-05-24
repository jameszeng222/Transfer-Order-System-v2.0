import knex from 'knex';
import config from '../../knexfile.js';

export const db = knex(config);

export async function closeDb(): Promise<void> {
  await db.destroy();
}
