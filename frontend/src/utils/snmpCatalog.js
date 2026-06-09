/**
 * Shared SNMP OID catalog.
 * Single source of truth used by DeviceDetail (sensor picker),
 * AlertRules (parameter builder), and the alert engine (evaluation).
 *
 * Add a new entry here and it automatically appears in both the sensor
 * picker and the alert-rule form.
 */
export const SNMP_VALUE_CATALOG = [
  // CPU
  { key: 'hrProcessorLoad',          label: 'CPU Load',             unit: '%',  cat: 'CPU',      vendors: null },
  { key: 'hrProcessorLoad_alt',      label: 'CPU Load (alt)',       unit: '%',  cat: 'CPU',      vendors: ['cisco'] },
  { key: 'jnxOperatingCPU',          label: 'CPU Utilization',      unit: '%',  cat: 'CPU',      vendors: ['juniper'] },
  { key: 'hwEntityCpuUsage',         label: 'CPU Usage',            unit: '%',  cat: 'CPU',      vendors: ['huawei'] },
  { key: 'fgSysCpuUsage',            label: 'CPU Usage',            unit: '%',  cat: 'CPU',      vendors: ['fortinet'] },
  { key: 'panSysCPULoadAverage',     label: 'CPU Load Avg',         unit: '%',  cat: 'CPU',      vendors: ['paloalto'] },
  // Memory
  { key: 'hrMemorySize',             label: 'Memory Size',          unit: 'KB', cat: 'Memory',   vendors: null },
  { key: 'jnxOperatingBuffer',       label: 'Buffer Utilization',   unit: '%',  cat: 'Memory',   vendors: ['juniper'] },
  { key: 'hwEntityMemUsage',         label: 'Memory Usage',         unit: '%',  cat: 'Memory',   vendors: ['huawei'] },
  { key: 'fgSysMemUsage',            label: 'Memory Usage',         unit: '%',  cat: 'Memory',   vendors: ['fortinet'] },
  { key: 'ciscoMemPoolUsed',         label: 'Mem Pool Used',        unit: 'B',  cat: 'Memory',   vendors: ['cisco'] },
  { key: 'ciscoMemPoolFree',         label: 'Mem Pool Free',        unit: 'B',  cat: 'Memory',   vendors: ['cisco'] },
  // Sessions
  { key: 'panSysSessionUtilization', label: 'Session Utilization',  unit: '%',  cat: 'Sessions', vendors: ['paloalto'] },
  // Storage
  { key: 'hrStorageUsed_1',          label: 'Storage Used (idx 1)', unit: '',   cat: 'Storage',  vendors: null },
  { key: 'hrStorageUsed_2',          label: 'Storage Used (idx 2)', unit: '',   cat: 'Storage',  vendors: null },
  { key: 'hrStorageUsed_31',         label: 'Storage Used (31)',    unit: '',   cat: 'Storage',  vendors: null },
  { key: 'hrStorageUsed_32',         label: 'Storage Used (32)',    unit: '',   cat: 'Storage',  vendors: null },
  // System
  { key: 'sysUpTime',                label: 'System Uptime',        unit: 's',  cat: 'System',   vendors: null },
  { key: 'ifNumber',                 label: 'Interface Count',      unit: '',   cat: 'System',   vendors: null },
]

export const SNMP_CATS = [...new Set(SNMP_VALUE_CATALOG.map(o => o.cat))]
