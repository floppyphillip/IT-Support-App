/**
 * Shared SNMP OID catalog.
 * Single source of truth used by DeviceDetail (sensor picker),
 * AlertRules (parameter builder), and the alert engine (evaluation).
 *
 * Add a new entry here and it automatically appears in both places.
 *
 * Optional per-entry fields:
 *   defaultCondition  — overrides the '>' default in alert-rule params
 *   defaultThreshold  — overrides the unit-based default (0 or 80 for %)
 *   description       — shown as a hint in the alert-rule form row
 */
export const SNMP_VALUE_CATALOG = [
  // ── CPU ─────────────────────────────────────────────────────────────────────
  { key: 'hrProcessorLoad',          label: 'CPU Load',             unit: '%',  cat: 'CPU',        vendors: null },
  { key: 'hrProcessorLoad_alt',      label: 'CPU Load (alt)',       unit: '%',  cat: 'CPU',        vendors: ['cisco'] },
  { key: 'jnxOperatingCPU',          label: 'CPU Utilization',      unit: '%',  cat: 'CPU',        vendors: ['juniper'] },
  { key: 'hwEntityCpuUsage',         label: 'CPU Usage',            unit: '%',  cat: 'CPU',        vendors: ['huawei'] },
  { key: 'fgSysCpuUsage',            label: 'CPU Usage',            unit: '%',  cat: 'CPU',        vendors: ['fortinet'] },
  { key: 'panSysCPULoadAverage',     label: 'CPU Load Avg',         unit: '%',  cat: 'CPU',        vendors: ['paloalto'] },

  // ── Memory ──────────────────────────────────────────────────────────────────
  { key: 'hrMemorySize',             label: 'Memory Size',          unit: 'KB', cat: 'Memory',     vendors: null },
  { key: 'jnxOperatingBuffer',       label: 'Buffer Utilization',   unit: '%',  cat: 'Memory',     vendors: ['juniper'] },
  { key: 'hwEntityMemUsage',         label: 'Memory Usage',         unit: '%',  cat: 'Memory',     vendors: ['huawei'] },
  { key: 'fgSysMemUsage',            label: 'Memory Usage',         unit: '%',  cat: 'Memory',     vendors: ['fortinet'] },
  { key: 'ciscoMemPoolUsed',         label: 'Mem Pool Used',        unit: 'B',  cat: 'Memory',     vendors: ['cisco'] },
  { key: 'ciscoMemPoolFree',         label: 'Mem Pool Free',        unit: 'B',  cat: 'Memory',     vendors: ['cisco'] },

  // ── Sessions ─────────────────────────────────────────────────────────────────
  { key: 'panSysSessionUtilization', label: 'Session Utilization',  unit: '%',  cat: 'Sessions',   vendors: ['paloalto'] },

  // ── Storage ──────────────────────────────────────────────────────────────────
  { key: 'hrStorageUsed_1',          label: 'Storage Used (idx 1)', unit: '',   cat: 'Storage',    vendors: null },
  { key: 'hrStorageUsed_2',          label: 'Storage Used (idx 2)', unit: '',   cat: 'Storage',    vendors: null },
  { key: 'hrStorageUsed_31',         label: 'Storage Used (31)',    unit: '',   cat: 'Storage',    vendors: null },
  { key: 'hrStorageUsed_32',         label: 'Storage Used (32)',    unit: '',   cat: 'Storage',    vendors: null },

  // ── System ───────────────────────────────────────────────────────────────────
  { key: 'sysUpTime',                label: 'System Uptime',        unit: 's',  cat: 'System',     vendors: null },
  { key: 'ifNumber',                 label: 'Interface Count',      unit: '',   cat: 'System',     vendors: null },

  // ── Interfaces — IF-MIB (RFC 2863) — all device types, all vendors ──────────
  // ifOperStatus: 1=up  2=down  3=testing  4=unknown  5=dormant  6=notPresent  7=lowerLayerDown
  // Alert condition "= 2" fires when the interface goes down.
  { key: 'ifOperStatus_1',  label: 'Interface 1 – Oper Status',  unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifOperStatus_2',  label: 'Interface 2 – Oper Status',  unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifOperStatus_3',  label: 'Interface 3 – Oper Status',  unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifOperStatus_4',  label: 'Interface 4 – Oper Status',  unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifOperStatus_5',  label: 'Interface 5 – Oper Status',  unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifOperStatus_6',  label: 'Interface 6 – Oper Status',  unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifOperStatus_7',  label: 'Interface 7 – Oper Status',  unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifOperStatus_8',  label: 'Interface 8 – Oper Status',  unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifOperStatus_9',  label: 'Interface 9 – Oper Status',  unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifOperStatus_10', label: 'Interface 10 – Oper Status', unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifOperStatus_11', label: 'Interface 11 – Oper Status', unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifOperStatus_12', label: 'Interface 12 – Oper Status', unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },

  // ifAdminStatus: 1=up  2=down  3=testing  (administratively configured state)
  { key: 'ifAdminStatus_1', label: 'Interface 1 – Admin Status', unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifAdminStatus_2', label: 'Interface 2 – Admin Status', unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifAdminStatus_3', label: 'Interface 3 – Admin Status', unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifAdminStatus_4', label: 'Interface 4 – Admin Status', unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifAdminStatus_5', label: 'Interface 5 – Admin Status', unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifAdminStatus_6', label: 'Interface 6 – Admin Status', unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifAdminStatus_7', label: 'Interface 7 – Admin Status', unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
  { key: 'ifAdminStatus_8', label: 'Interface 8 – Admin Status', unit: '', cat: 'Interfaces', vendors: null, defaultCondition: '=', defaultThreshold: 2, description: '1=up  2=down  3=testing' },
]

export const SNMP_CATS = [...new Set(SNMP_VALUE_CATALOG.map(o => o.cat))]
