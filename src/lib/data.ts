export type OnuData = {
  'ONU ID': string;
  'Shelf': string;
  addedDate: string;
  removedDate?: string;
};

export const DUMMY_DATA: OnuData[] = [
  { 'ONU ID': 'FHR2100GZB', 'Shelf': 'A-01', addedDate: new Date().toISOString() },
  { 'ONU ID': 'AN5506-01-A', 'Shelf': 'B-12', addedDate: new Date().toISOString() },
  { 'ONU ID': 'HG8546M', 'Shelf': 'A-02', addedDate: new Date().toISOString() },
  { 'ONU ID': 'ZXHN F601', 'Shelf': 'C-05', addedDate: new Date().toISOString() },
];
