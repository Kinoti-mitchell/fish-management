export const LAKE_VICTORIA_SPECIES = [
  'Nile Tilapia',
  'Nile Perch',
  'African Catfish',
  'Silver Cyprinid',
  'African Lungfish',
  'Blue-spotted Tilapia',
  'Marbled Lungfish',
  'Electric Catfish'
] as const;

export const ZONES = [
  'Zone A-1', 'Zone A-2', 'Zone A-3',
  'Zone B-1', 'Zone B-2', 'Zone B-3',
  'Zone C-1', 'Zone C-2', 'Zone C-3',
  'Zone D-1', 'Zone D-2', 'Zone D-3'
] as const;

export const COLLECTION_LOCATIONS = [
  'Jinja Fishing Port',
  'Kisumu Fish Market',
  'Mwanza Harbor',
  'Bukoba Bay',
  'Musoma Port',
  'Kampalala Landing',
  'Ggaba Landing Site',
  'Katosi Fish Market'
] as const;

export const HEALTH_STATUS_COLORS = {
  healthy: '#10b981',
  monitoring: '#f59e0b',
  critical: '#ef4444'
} as const;

export const TRUCK_STATUS_COLORS = {
  available: '#10b981',
  collecting: '#3b82f6',
  delivering: '#f59e0b',
  maintenance: '#ef4444'
} as const;

export const ORDER_STATUS_COLORS = {
  pending: '#6b7280',
  confirmed: '#3b82f6',
  preparing: '#f59e0b',
  ready: '#10b981',
  delivered: '#059669',
  cancelled: '#ef4444'
} as const;

export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Home' },
  { id: 'inventory', label: 'Fish Stock', icon: 'Fish' },
  { id: 'trucks', label: 'Trucks', icon: 'Truck' },
  { id: 'collections', label: 'Collections', icon: 'Package' },
  { id: 'sales', label: 'Sales', icon: 'DollarSign' },
  { id: 'orders', label: 'Orders', icon: 'ShoppingCart' },
  { id: 'deliveries', label: 'Deliveries', icon: 'MapPin' },
  { id: 'clients', label: 'Clients', icon: 'Users' },
  { id: 'reports', label: 'Reports', icon: 'BarChart3' },
] as const;

export const LAKE_VICTORIA_INFO = {
  surfaceArea: '68,800 km²',
  fishSpecies: '500+',
  dependentPopulation: '30+ million people',
  temperature: '24.5°C',
  phLevel: '7.2',
  oxygenLevel: '8.5 mg/L',
  activeZones: '12/15'
} as const;

export const PAYMENT_METHODS = ['cash', 'transfer', 'check', 'credit'] as const;

export const FISH_PRICES = {
  'Nile Tilapia': 15,
  'Nile Perch': 25,
  'African Catfish': 18,
  'Silver Cyprinid': 12,
  'African Lungfish': 22,
  'Blue-spotted Tilapia': 16,
  'Marbled Lungfish': 20,
  'Electric Catfish': 30
} as const;