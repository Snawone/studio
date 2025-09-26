export type OnuAction = 'added' | 'removed' | 'restored' | 'created';

export type OnuHistoryEntry = {
  action: OnuAction;
  date: string;
  source?: 'file' | 'manual';
  userId?: string;
  userName?: string;
};

export type OnuData = {
  id: string;
  'ONU ID': string;
  shelfId: string;
  shelfName: string; // Denormalized for easier display
  shelfType: 'onu' | 'stb'; // Denormalized for easier display
  addedDate: string;
  removedDate?: string | null;
  history: OnuHistoryEntry[];
  status: 'active' | 'removed';
};

export type Shelf = {
  id: string;
  name: string;
  capacity: number;
  type: 'onu' | 'stb';
  createdAt: string;
  itemCount: number; // Maintained through transactions or cloud functions
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
