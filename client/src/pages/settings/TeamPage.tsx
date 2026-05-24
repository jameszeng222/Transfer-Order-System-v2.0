import ConfigPage from '../../components/ConfigPage';

const columns = [
  { key: 'team_code', title: '团队编码', required: true },
  { key: 'team_name', title: '团队名称', required: true },
  { key: 'leader', title: '负责人' },
  { key: 'is_active', title: '状态', type: 'badge' as const, badgeColors: { '1': 'success', '0': 'danger' },
    options: [{ label: '启用', value: '1' }, { label: '停用', value: '0' }] },
];

export default function TeamPage() {
  return <ConfigPage title="团队管理" apiPath="/teams" columns={columns} searchFields={['team_code', 'team_name']} />;
}
