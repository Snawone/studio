export type OnuAction = 'added' | 'removed' | 'restored' | 'created';

export type OnuHistoryEntry = {
  action: OnuAction;
  date: string;
  source?: 'file' | 'manual';
};

export type OnuData = {
  id: string;
  'ONU ID': string;
  'Shelf': string;
  addedDate: string;
  removedDate?: string | null;
  history: OnuHistoryEntry[];
  status: 'active' | 'removed';
};

export type OnuFromSheet = {
  'ONU ID': string;
  'Shelf': string;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  searchList: string[];
  isAdmin?: boolean;
}

export type FileInfo = {
  fileName: string;
  fileUrl: string;
  sheetName: string;
  lastUpdated: string;
}
