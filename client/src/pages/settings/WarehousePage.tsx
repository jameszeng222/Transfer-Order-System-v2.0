import ConfigPage from '../../components/ConfigPage';

const columns = [
  { key: 'warehouse_code', title: '仓库编码', required: true },
  { key: 'warehouse_name', title: '仓库名称', required: true },
  { key: 'region', title: '区域' },
  { key: 'country', title: '国家' },
  { key: 'address', title: '仓库地址' },
  { key: 'postal_code', title: '邮编' },
  { key: 'warehouse_type', title: '仓库类型', type: 'select' as const, required: true, options: [
    { label: '国内自营', value: 'DOMESTIC_SELF' }, { label: '国内三方', value: 'DOMESTIC_3RD' },
    { label: '海外自营', value: 'OVERSEAS_SELF' }, { label: '海外三方', value: 'OVERSEAS_3RD' }
  ]},
  { key: 'warehouse_category', title: '仓库分类', type: 'select' as const, options: [
    { label: '自营', value: 'SELF' }, { label: '万邑通', value: 'WANYITONG' },
    { label: '亚马逊FBA', value: 'AMAZON_FBA' }, { label: 'FBT', value: 'FBT' },
    { label: '其他', value: 'OTHER' }
  ]},
  { key: 'api_enabled', title: 'API启用', type: 'switch' as const },
  { key: 'contact_name', title: '联系人' },
  { key: 'contact_phone', title: '联系电话' },
  { key: 'is_active', title: '状态', type: 'badge' as const, badgeColors: { '1': 'success', '0': 'danger' },
    options: [{ label: '启用', value: '1' }, { label: '停用', value: '0' }] },
];

export default function WarehousePage() {
  return <ConfigPage title="仓库管理" apiPath="/warehouses" columns={columns} searchFields={['warehouse_code', 'warehouse_name']} />;
}
