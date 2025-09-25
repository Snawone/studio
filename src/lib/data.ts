export type OnuAction = 'added' | 'removed' | 'restored' | 'created';

export type OnuHistoryEntry = {
  action: OnuAction;
  date: string;
  source?: 'file' | 'manual';
};

export type OnuData = {
  'ONU ID': string;
  'Shelf': string;
  addedDate: string;
  removedDate?: string;
  history: OnuHistoryEntry[];
};

export const DUMMY_DATA: OnuData[] = [
  { 'ONU ID': 'FHR2100GZB', 'Shelf': 'A-01', addedDate: new Date().toISOString(), history: [] },
  { 'ONU ID': 'AN5506-01-A', 'Shelf': 'B-12', addedDate: new Date().toISOString(), history: [] },
  { 'ONU ID': 'HG8546M', 'Shelf': 'A-02', addedDate: new Date().toISOString(), history: [] },
  { 'ONU ID': 'ZXHN F601', 'Shelf': 'C-05', addedDate: new Date().toISOString(), history: [] },
];
