export type MemberColumnKey = 'department' | 'position' | 'employeeNumber' | 'userName' | 'userEmail' | 'sites' | 'role';

export interface MemberColumnDef {
  key: MemberColumnKey;
  label: string;
  sortKey: MemberColumnKey;
}

export const MEMBER_COLUMNS: MemberColumnDef[] = [
  { key: 'department', label: '部門', sortKey: 'department' },
  { key: 'position', label: '役職', sortKey: 'position' },
  { key: 'employeeNumber', label: '社員番号', sortKey: 'employeeNumber' },
  { key: 'userName', label: '名前', sortKey: 'userName' },
  { key: 'userEmail', label: 'メールアドレス', sortKey: 'userEmail' },
  { key: 'sites', label: '担当作業所', sortKey: 'sites' },
  { key: 'role', label: '権限', sortKey: 'role' },
];

const STORAGE_KEY = 'con-sche-member-columns';
const DEFAULT_COLUMNS: MemberColumnKey[] = ['department', 'position', 'employeeNumber', 'userName', 'userEmail', 'sites', 'role'];

export function getMemberColumnConfig(): MemberColumnKey[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as MemberColumnKey[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_COLUMNS;
}

export function saveMemberColumnConfig(columns: MemberColumnKey[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
}
