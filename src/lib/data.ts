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

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  searchList: string[];
  isAdmin?: boolean;
}
