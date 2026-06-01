import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const colNames = await knex('transfer_cartons').columnInfo().then(info => Object.keys(info));
  if (!colNames.includes('last_mile_tracking_no')) {
    await knex.schema.table('transfer_cartons', (table) => {
      table.string('last_mile_tracking_no');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const colNames = await knex('transfer_cartons').columnInfo().then(info => Object.keys(info));
  if (colNames.includes('last_mile_tracking_no')) {
    await knex.schema.table('transfer_cartons', (table) => {
      table.dropColumn('last_mile_tracking_no');
    });
  }
}
