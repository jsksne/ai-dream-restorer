"use client";

// ===== Oneira 会话状态管理 Hook（v2 重构版）=====
// 基于 DreamProject 节点字典模型，支持无限分支与版本管理
// 持久化通过 IndexedDB（lib/project-storage.ts）；首次访问加载最后一个活跃项目

import { useReducer, useEffect, useState, useCallback } from 'react';
import type {
  DreamProject,
  DreamNode,
  DreamVersion,
  NormalizedBox,
} from '@/lib/project-storage';
import type {
  DreamPerspective,
  SceneRegion,
  SemanticTags,
} from '@/types';
import { generateId } from '@/lib/utils';
import {
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
  generateUniqueProjectId,
} from '@/lib/project-storage';

const SESSION_KEY = 'oneira-active-project-id';

const initialProject = (): DreamProject => ({
  schemaVersion: 2,
  id: '',
  title: '未命名梦境',
  originalDescription: '',
  refinedPrompt: '',
  perspective: 'first-person',
  activeDreamSelfId: null,
  rootNodeId: null,
  activeNodeId: null,
  nodes: {},
  versions: [],
  selectedVersionId: null,
  analysis: null,
  assetIds: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ===== Reducer Actions =====

type SessionAction =
  | { type: 'LOAD'; payload: DreamProject }
  | { type: 'INIT_NEW'; payload: { id: string; description: string; perspective: DreamPerspective } }
  | { type: 'ADD_NODE'; payload: DreamNode }
  | { type: 'SET_ACTIVE'; payload: { nodeId: string } }
  | { type: 'ADD_VERSION'; payload: DreamVersion }
  | { type: 'MARK_CLOSEST'; payload: { versionId: string } }
  | { type: 'SET_ANALYSIS'; payload: { analysis: DreamProject['analysis'] } }
  | { type: 'SET_REFINED_PROMPT'; payload: { prompt: string } }
  | { type: 'SET_DREAM_SELF'; payload: { id: string | null } }
  | { type: 'SET_TITLE'; payload: { title: string } }
  | { type: 'DELETE_NODE'; payload: { nodeId: string } };

function reducer(state: DreamProject, action: SessionAction): DreamProject {
  const now = new Date().toISOString();
  switch (action.type) {
    case 'LOAD':
      return action.payload;
    case 'INIT_NEW': {
      const { id, description, perspective } = action.payload;
      return {
        ...initialProject(),
        id,
        originalDescription: description,
        perspective,
        activeDreamSelfId: state.activeDreamSelfId,
        createdAt: now,
        updatedAt: now,
      };
    }
    case 'ADD_NODE': {
      const node = action.payload;
      const nodes = { ...state.nodes, [node.id]: node };
      if (node.parentId) {
        const parent = nodes[node.parentId];
        if (parent && !parent.childIds.includes(node.id)) {
          nodes[parent.id] = { ...parent, childIds: [...parent.childIds, node.id] };
        }
      }
      return {
        ...state,
        nodes,
        rootNodeId: state.rootNodeId ?? node.id,
        activeNodeId: node.id,
        assetIds: state.assetIds.includes(node.assetId)
          ? state.assetIds
          : [...state.assetIds, node.assetId],
        updatedAt: now,
      };
    }
    case 'SET_ACTIVE': {
      const { nodeId } = action.payload;
      if (!state.nodes[nodeId]) return state;
      return { ...state, activeNodeId: nodeId, updatedAt: now };
    }
    case 'ADD_VERSION': {
      return {
        ...state,
        versions: [...state.versions, action.payload],
        updatedAt: now,
      };
    }
    case 'MARK_CLOSEST': {
      const { versionId } = action.payload;
      return {
        ...state,
        versions: state.versions.map((v) => ({
          ...v,
          isClosest: v.id === versionId,
        })),
        selectedVersionId: versionId,
        updatedAt: now,
      };
    }
    case 'SET_ANALYSIS':
      return { ...state, analysis: action.payload.analysis, updatedAt: now };
    case 'SET_REFINED_PROMPT':
      return { ...state, refinedPrompt: action.payload.prompt, updatedAt: now };
    case 'SET_DREAM_SELF':
      return { ...state, activeDreamSelfId: action.payload.id, updatedAt: now };
    case 'SET_TITLE':
      return { ...state, title: action.payload.title, updatedAt: now };
    case 'DELETE_NODE': {
      const { nodeId } = action.payload;
      if (!state.nodes[nodeId]) return state;
      // 拒绝删除有子节点的节点（除非 force 标志）
      const target = state.nodes[nodeId];
      if (!target || target.childIds.length > 0) return state;
      const nodes = { ...state.nodes };
      delete nodes[nodeId];
      // 从父节点的 childIds 中移除
      if (target.parentId && nodes[target.parentId]) {
        nodes[target.parentId] = {
          ...nodes[target.parentId]!,
          childIds: nodes[target.parentId]!.childIds.filter((c) => c !== nodeId),
        };
      }
      return {
        ...state,
        nodes,
        activeNodeId: state.activeNodeId === nodeId ? target.parentId : state.activeNodeId,
        updatedAt: now,
      };
    }
    default:
      return state;
  }
}

export function useSession() {
  const [state, dispatch] = useReducer(reducer, initialProject());
  const [initialized, setInitialized] = useState(false);

  // 启动时加载最近项目
  useEffect(() => {
    let active = false;
    (async () => {
      try {
        const savedId = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;
        let project: DreamProject | null = null;
        if (savedId) {
          project = await loadProject(savedId);
        }
        if (!project) {
          const list = await listProjects();
          project = list[0] ?? null;
        }
        if (!active && project) {
          dispatch({ type: 'LOAD', payload: project });
        }
      } catch (e) {
        console.warn('加载项目失败:', e);
      } finally {
        if (!active) setInitialized(true);
      }
    })();
    return () => {
      active = true;
    };
  }, []);

  // 初始化完成后开始持久化
  useEffect(() => {
    if (!initialized) return;
    if (!state.id) return;
    void saveProject(state).catch((e) => console.warn('保存项目失败:', e));
    try {
      localStorage.setItem(SESSION_KEY, state.id);
    } catch {
      // ignore
    }
  }, [state, initialized]);

  const initNew = useCallback(
    async (description: string, perspective: DreamPerspective) => {
      const id = await generateUniqueProjectId();
      dispatch({ type: 'INIT_NEW', payload: { id, description, perspective } });
      return id;
    },
    []
  );

  const addNode = useCallback(
    (input: {
      assetId: string;
      prompt: string;
      branchLabel: string;
      origin: DreamNode['origin'];
      parentId?: string | null;
      sourceRegion?: NormalizedBox;
      sceneRegions?: SceneRegion[];
    }): DreamNode => {
      const node: DreamNode = {
        id: generateId(),
        parentId: input.parentId ?? state.activeNodeId ?? null,
        childIds: [],
        assetId: input.assetId,
        prompt: input.prompt,
        branchLabel: input.branchLabel,
        origin: input.origin,
        sourceRegion: input.sourceRegion,
        sceneRegions: input.sceneRegions ?? [],
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_NODE', payload: node });
      return node;
    },
    [state.activeNodeId]
  );

  const setActive = useCallback((nodeId: string) => {
    dispatch({ type: 'SET_ACTIVE', payload: { nodeId } });
  }, []);

  const getActive = useCallback((): DreamNode | null => {
    return state.activeNodeId ? state.nodes[state.activeNodeId] ?? null : null;
  }, [state.activeNodeId, state.nodes]);

  const getRoot = useCallback((): DreamNode | null => {
    return state.rootNodeId ? state.nodes[state.rootNodeId] ?? null : null;
  }, [state.rootNodeId, state.nodes]);

  const getPathFromRoot = useCallback((): DreamNode[] => {
    if (!state.activeNodeId) return [];
    const path: DreamNode[] = [];
    let current: DreamNode | null = state.nodes[state.activeNodeId] ?? null;
    while (current) {
      path.unshift(current);
      const next: DreamNode | null = current.parentId
        ? state.nodes[current.parentId] ?? null
        : null;
      current = next;
    }
    return path;
  }, [state.activeNodeId, state.nodes]);

  const getChildCount = useCallback(
    (nodeId: string): number => {
      return state.nodes[nodeId]?.childIds.length ?? 0;
    },
    [state.nodes]
  );

  const addVersion = useCallback(
    (input: { nodeId: string; title: string }): DreamVersion => {
      const v: DreamVersion = {
        id: generateId(),
        nodeId: input.nodeId,
        title: input.title,
        isClosest: false,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_VERSION', payload: v });
      return v;
    },
    []
  );

  const markClosest = useCallback((versionId: string) => {
    dispatch({ type: 'MARK_CLOSEST', payload: { versionId } });
  }, []);

  const getVersions = useCallback((): DreamVersion[] => state.versions, [state.versions]);

  const getSelectedVersion = useCallback((): DreamVersion | null => {
    return state.versions.find((v) => v.id === state.selectedVersionId) ?? null;
  }, [state.versions, state.selectedVersionId]);

  const setAnalysis = useCallback((analysis: DreamProject['analysis']) => {
    dispatch({ type: 'SET_ANALYSIS', payload: { analysis } });
  }, []);

  const setRefinedPrompt = useCallback((prompt: string) => {
    dispatch({ type: 'SET_REFINED_PROMPT', payload: { prompt } });
  }, []);

  const setDreamSelf = useCallback((id: string | null) => {
    dispatch({ type: 'SET_DREAM_SELF', payload: { id } });
  }, []);

  const setTitle = useCallback((title: string) => {
    dispatch({ type: 'SET_TITLE', payload: { title } });
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    dispatch({ type: 'DELETE_NODE', payload: { nodeId } });
  }, []);

  const removeProject = useCallback(async () => {
    if (!state.id) return;
    await deleteProject(state.id);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, [state.id]);

  const loadById = useCallback(async (id: string): Promise<boolean> => {
    const p = await loadProject(id);
    if (!p) return false;
    dispatch({ type: 'LOAD', payload: p });
    return true;
  }, []);

  /** 兼容旧代码：把新版本节点折叠为 SemanticTags */
  const getActiveTags = useCallback((): SemanticTags | null => {
    const node = getActive();
    return node ? tagsFromNode(node) : null;
  }, [getActive]);

  return {
    project: state,
    initialized,
    // 节点操作
    initNew,
    addNode,
    setActive,
    getActive,
    getRoot,
    getPathFromRoot,
    getChildCount,
    deleteNode,
    // 版本操作
    addVersion,
    markClosest,
    getVersions,
    getSelectedVersion,
    // 元数据
    setAnalysis,
    setRefinedPrompt,
    setDreamSelf,
    setTitle,
    setActiveTagsFallback: setRefinedPrompt,
    getActiveTags,
    // 项目级
    removeProject,
    loadById,
  };
}

function tagsFromNode(node: DreamNode): SemanticTags {
  return {
    scene: node.branchLabel,
    emotion: '未知',
    elements: node.sceneRegions.map((r) => r.label),
    elementPositions: node.sceneRegions.map((r) => ({
      name: r.label,
      region: 'center' as const,
    })),
  };
}