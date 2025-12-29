
export type AssetType = 'GPTs' | 'GEM' | 'External';
export type SecurityLevel = 'Public' | 'Internal' | 'Restricted';
export type Team = '교육' | '컨설팅' | '연구';
export type UserRole = 'admin' | 'trainee';

export interface Asset {
  id: string;
  name: string;
  url: string;
  type: AssetType;
  team: Team;
  security: SecurityLevel;
  tags: string[];
  createdAt: string;
}

export interface User {
  name: string;
  role: UserRole;
  allowedViews: string[];
  canCRUD: boolean;
  canOpenRestricted: boolean;
}

export type ViewType = 'dashboard' | 'assets' | 'teamview' | 'qrshare' | 'sync' | 'settings';

export const USERS: Record<string, User> = {
  "신윤복": { 
    name: "신윤복", 
    role: "admin", 
    allowedViews: ["dashboard", "assets", "teamview", "qrshare", "sync", "settings"], 
    canCRUD: true, 
    canOpenRestricted: true 
  },
  "교육생": { 
    name: "교육생", 
    role: "trainee", 
    allowedViews: ["teamview", "settings"], 
    canCRUD: false, 
    canOpenRestricted: false 
  }
};
