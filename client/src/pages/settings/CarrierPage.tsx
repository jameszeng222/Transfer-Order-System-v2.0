import ConfigPage from '../../components/ConfigPage';

const columns = [
  { key: 'carrier_code', title: '物流商编码', required: true },
  { key: 'carrier_name', title: '物流商名称', required: true },
  { key: 'carrier_type', title: '物流商类型', type: 'multiSelect' as const, required: true, options: [
    { label: '国际快递', value: 'INTERNATIONAL_EXPRESS' }, { label: '国际空运', value: 'INTERNATIONAL_AIR' },
    { label: '国际海运', value: 'INTERNATIONAL_SEA' }, { label: '铁路', value: 'RAIL' },
    { label: '卡车', value: 'TRUCK' }
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
