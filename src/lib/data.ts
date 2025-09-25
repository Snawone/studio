export type OnuData = {
  'ONU ID': string;
  'Model': string;
  'Shelf': string;
  'Rack': string;
  'Status': 'Active' | 'Inactive' | 'Maintenance';
};

export const DUMMY_DATA: OnuData[] = [
  { 'ONU ID': 'FHR2100GZB', 'Model': 'FiberHome', 'Shelf': 'A-01', 'Rack': '3', 'Status': 'Active' },
  { 'ONU ID': 'AN5506-01-A', 'Model': 'FiberHome', 'Shelf': 'B-12', 'Rack': '1', 'Status': 'Inactive' },
  { 'ONU ID': 'HG8546M', 'Model': 'Huawei', 'Shelf': 'A-02', 'Rack': '5', 'Status': 'Active' },
  { 'ONU ID': 'ZXHN F601', 'Model': 'ZTE', 'Shelf': 'C-05', 'Rack': '2', 'Status': 'Active' },
  { 'ONU ID': 'G-140W-C', 'Model': 'Nokia', 'Shelf': 'B-08', 'Rack': '4', 'Status': 'Maintenance' },
  { 'ONU ID': 'F670L', 'Model': 'ZTE', 'Shelf': 'C-09', 'Rack': '1', 'Status': 'Active' },
  { 'ONU ID': 'HG8245H', 'Model': 'Huawei', 'Shelf': 'A-03', 'Rack': '6', 'Status': 'Inactive' },
  { 'ONU ID': 'ZXA10 C320', 'Model': 'ZTE', 'Shelf': 'D-01', 'Rack': '1', 'Status': 'Active' },
  { 'ONU ID': 'MA5608T', 'Model': 'Huawei', 'Shelf': 'D-02', 'Rack': '2', 'Status': 'Active' },
  { 'ONU ID': 'ONU-1001i', 'Model': 'Ubiquiti', 'Shelf': 'E-04', 'Rack': '3', 'Status': 'Active' },
  { 'ONU ID': 'EA5801-GP08', 'Model': 'Huawei', 'Shelf': 'F-10', 'Rack': '5', 'Status': 'Active' },
  { 'ONU ID': 'GP3600-08', 'Model': 'BDCOM', 'Shelf': 'F-11', 'Rack': '6', 'Status': 'Maintenance' },
  { 'ONU ID': 'FD1608S-B0', 'Model': 'C-DATA', 'Shelf': 'G-07', 'Rack': '4', 'Status': 'Active' },
];
