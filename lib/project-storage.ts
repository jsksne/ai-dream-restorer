// ===== IndexedDB 项目/档案/设置持久化 =====
// 不引入第三方依赖，使用浏览器原生 IndexedDB API
// 数据库名：oneira；起始版本 v2

import type { DreamPerspective, SceneRegion } from "@/types";

export type NodeOrigin = 'remembered' | 'ai-exploration';

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DreamNode {
  id: string;
  parentId: string | null;
  childIds: string[];
  assetId: string;
  prompt: string;
  branchLabel: string;
  origin: NodeOrigin;
  sourceRegion?: NormalizedBox;
  sceneRegions: SceneRegion[];
  createdAt: string;
}

export interface DreamVersion {
  id: string;
  nodeId: string;
  title: string;
  isClosest: boolean;
  createdAt: string;
}

export interface AnalysisArtifact {
  mode: 'multimodal' | 'text-only';
  visualEvidence: Array<{ observation: string; confidence: number }>;
  dreamClues: string;
  emotionalThread: string;
  possibleConnections: string;
  reflectionQuestions: string[];
  explorationTrace: Array<{ nodeId: string; summary: string; confidence: 'low' }>;
  disclaimer: string;
  createdAt: string;
}

export interface DreamProject {
  schemaVersion: 2;
  id: string;
  title: string;
  originalDescription: string;
  refinedPrompt: string;
  perspective: DreamPerspective;
  activeDreamSelfId: string | null;
  rootNodeId: string | null;
  activeNodeId: string | null;
  nodes: Record<string, DreamNode>;
  versions: DreamVersion[];
  selectedVersionId: string | null;
  analysis: AnalysisArtifact | null;
  /** 项目独占的资源 ID 列表（删除项目时清理） */
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DreamSelfProfile {
  id: string;
  name: string;
  description: string;
  referenceAssetId: string | null;
  canonicalAssetId: string | null;
  signatureTraits: string[];
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsRecord {
  reduceMotion: boolean;
  enableVoice: boolean;
  hasSeenOnboarding: boolean;
  onboardingMode: 'auto' | 'manual' | null;
  preferredStyle: string;
  updatedAt: string;
}

export interface DraftRecord {
  inputText: string;
  selectedElement: string | null;
  updatedAt: string;
}

export const DB_NAME = 'oneira';
export const DB_VERSION = 2;

const STORE_PROJECTS = 'projects';
const STORE_PROFILES = 'profiles';
const STORE_SETTINGS = 'settings';
const STORE_DRAFTS = 'drafts';

let _db: IDBDatabase | null = null;

/** 打开/复用数据库 */
export function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PROFILES)) {
        db.createObjectStore(STORE_PROFILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let result: T;
        Promise.resolve(fn(store))
          .then((r) => {
            result = r;
          })
          .catch(reject);
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );
}

/** 保存项目（覆盖） */
export function saveProject(project: DreamProject): Promise<void> {
  return tx(STORE_PROJECTS, 'readwrite', (store) => {
    store.put(project);
  });
}

export function loadProject(id: string): Promise<DreamProject | null> {
  return tx(STORE_PROJECTS, 'readonly', (store) => {
    return new Promise<DreamProject | null>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as DreamProject) ?? null);
      req.onerror = () => reject(req.error);
    });
  });
}

export function listProjects(): Promise<DreamProject[]> {
  return tx(STORE_PROJECTS, 'readonly', (store) => {
    return new Promise<DreamProject[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result as DreamProject[]).slice();
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export function deleteProject(id: string): Promise<void> {
  return tx(STORE_PROJECTS, 'readwrite', (store) => {
    store.delete(id);
  });
}

/** Dream Self */
export function saveProfile(profile: DreamSelfProfile): Promise<void> {
  return tx(STORE_PROFILES, 'readwrite', (store) => {
    store.put(profile);
  });
}

export function listProfiles(): Promise<DreamSelfProfile[]> {
  return tx(STORE_PROFILES, 'readonly', (store) => {
    return new Promise<DreamSelfProfile[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as DreamSelfProfile[]);
      req.onerror = () => reject(req.error);
    });
  });
}

export function deleteProfile(id: string): Promise<void> {
  return tx(STORE_PROFILES, 'readwrite', (store) => {
    store.delete(id);
  });
}

/** 设置 */
export function saveSettings(settings: SettingsRecord): Promise<void> {
  return tx(STORE_SETTINGS, 'readwrite', (store) => {
    store.put({ id: 'main', ...settings });
  });
}

export function loadSettings(): Promise<SettingsRecord | null> {
  return tx(STORE_SETTINGS, 'readonly', (store) => {
    return new Promise<SettingsRecord | null>((resolve, reject) => {
      const req = store.get('main');
      req.onsuccess = () => resolve((req.result as SettingsRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
  });
}

/** 草稿 */
export function saveDraft(draft: DraftRecord): Promise<void> {
  return tx(STORE_DRAFTS, 'readwrite', (store) => {
    store.put({ id: 'current', ...draft });
  });
}

export function loadDraft(): Promise<DraftRecord | null> {
  return tx(STORE_DRAFTS, 'readonly', (store) => {
    return new Promise<DraftRecord | null>((resolve, reject) => {
      const req = store.get('current');
      req.onsuccess = () => resolve((req.result as DraftRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
  });
}

export function clearDraft(): Promise<void> {
  return tx(STORE_DRAFTS, 'readwrite', (store) => {
    store.delete('current');
  });
}

/** 验证项目 schema */
export function validateProject(input: unknown): DreamProject | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Partial<DreamProject>;
  if (p.schemaVersion !== 2) return null;
  if (typeof p.id !== 'string' || p.id.length === 0) return null;
  if (typeof p.title !== 'string') return null;
  if (typeof p.originalDescription !== 'string') return null;
  if (typeof p.refinedPrompt !== 'string') return null;
  if (
    p.perspective !== 'first-person' &&
    p.perspective !== 'third-person' &&
    p.perspective !== 'observer-without-self'
  ) {
    return null;
  }
  if (typeof p.nodes !== 'object' || p.nodes === null) return null;
  if (!Array.isArray(p.versions)) return null;
  return p as DreamProject;
}

/** 生成新 project id（避免与已有冲突） */
export async function generateUniqueProjectId(): Promise<string> {
  const list = await listProjects();
  const ids = new Set(list.map((p) => p.id));
  let id: string;
  do {
    id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  } while (ids.has(id));
  return id;
}

/** 测试/单元测试重置 */
export function __resetDbForTest(): void {
  _db = null;
}