import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const roles = await knex('roles').select('id', 'role_code');
  const inserts: { role_id: number; permission_code: string }[] = [];

  for (const role of roles) {
    if (['ADMIN', 'OPERATOR', 'WAREHOUSE'].includes(role.role_code)) {
      const existing = await knex('role_permissions')
        .where({ role_id: role.id, permission_code: 'order.delete' })
        .first();
      if (!existing) {
        inserts.push({ role_id: role.id, permission_code: 'order.delete' });
      }
    }
  }

  if (inserts.length > 0) {
    await knex('role_permissions').insert(inserts);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex('role_permissions').where('permission_code', 'order.delete').del();
}
