import ConfigPage from '../../components/ConfigPage';

const columns = [
  { key: 'carrier_code', title: '物流商编码', required: true },
  { key: 'carrier_name', title: '物流商名称', required: true },
  { key: 'carrier_type', title: '物流商类型', type: 'select' as const, required: true, options: [
    { label: '快递', value: 'EXPRESS' }, { label: '空运', value: 'AIR' },
    { label: '海运', value: 'SEA' }, { label: '铁路', value: 'RAIL' },
    { label: '卡车', value: 'TRUCK' }, { label: '其他', value: 'OTHER' }
  ]},
  { key: 'default_currency', title: '默认币种', type: 'select' as const, options: [
    { label: 'CNY', value: 'CNY' }, { label: 'USD', value: 'USD' },
    { label: 'EUR', value: 'EUR' }, { label: 'GBP', value: 'GBP' }
  ]},
  { key: 'contact_name', title: '联系人' },
  { key: 'contact_phone', title: '联系电话' },
  { key: 'is_active', title: '状态', type: 'badge' as const, badgeColors: { '1': 'success', '0': 'danger' },
    options: [{ label: '启用', value: '1' }, { label: '停用', value: '0' }] },
];

export default function CarrierPage() {
  return <ConfigPage title="物流商管理" apiPath="/carriers" columns={columns} searchFields={['carrier_code', 'carrier_name']} />;
}
