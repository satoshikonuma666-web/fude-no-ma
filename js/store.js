// 単一の state を管理する store。localStorage へ自動永続化。

import { createSampleData } from './data/samples.js';

const STORAGE_KEY = 'novel-writer-mockup:v1';

const listeners = new Set();
let state = load();
let saveTimer = null;

const DEFAULT_CUSTOM_COLORS = {
  bg: '#FAF7F2', ink: '#1A1A1A', ruled: '#D5CCB8',
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.drafts) {
        // 旧データへの欠損キー補完
        if (!parsed.settings.customColors) {
          parsed.settings.customColors = { ...DEFAULT_CUSTOM_COLORS };
        } else {
          // 旧 6色 → 新 3色 へ縮小
          const c = parsed.settings.customColors;
          parsed.settings.customColors = {
            bg:    c.bg    || DEFAULT_CUSTOM_COLORS.bg,
            ink:   c.ink   || DEFAULT_CUSTOM_COLORS.ink,
            ruled: c.ruled || DEFAULT_CUSTOM_COLORS.ruled,
          };
        }
        if (parsed.settings.showRuledLines === undefined) parsed.settings.showRuledLines = true;
        if (!parsed.todos) parsed.todos = [];
        if (!parsed.ideas) parsed.ideas = [];
        return parsed;
      }
    }
  } catch (_) { /* fallthrough */ }
  const seeded = createSampleData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('保存に失敗しました', e);
    }
  }, 250);
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

// state 全体を更新する。fn は mutate して良い（簡易実装）
export function update(mutator) {
  mutator(state);
  scheduleSave();
  notify();
}

export function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state = load();
  notify();
}

// よく使う selector
export function getCurrentDraft() {
  const id = state.ui.currentDraftId;
  return state.drafts.find(d => d.id === id) || state.drafts[0] || null;
}

export function setCurrentDraft(id) {
  update(s => { s.ui.currentDraftId = id; });
}

export function upsertDraft(draft) {
  update(s => {
    const i = s.drafts.findIndex(d => d.id === draft.id);
    if (i >= 0) s.drafts[i] = draft;
    else s.drafts.push(draft);
  });
}

export function createDraft(title = '無題の原稿') {
  const id = uid('draft');
  const now = Date.now();
  const draft = {
    id,
    title,
    body: '',
    status: 'writing',
    lastEditedAt: now,
    charCountHistory: [],
  };
  update(s => {
    s.drafts.unshift(draft);
    s.ui.currentDraftId = id;
  });
  return draft;
}

export function deleteDraft(id) {
  update(s => {
    s.drafts = s.drafts.filter(d => d.id !== id);
    if (s.ui.currentDraftId === id) {
      s.ui.currentDraftId = s.drafts[0]?.id || null;
    }
  });
}

export function recordTodayChars(draftId, count) {
  update(s => {
    const draft = s.drafts.find(d => d.id === draftId);
    if (!draft) return;
    const today = new Date().toISOString().slice(0, 10);
    if (!draft.charCountHistory) draft.charCountHistory = [];
    const i = draft.charCountHistory.findIndex(h => h.date === today);
    if (i >= 0) draft.charCountHistory[i].count = count;
    else draft.charCountHistory.push({ date: today, count });
  });
}

// settings の更新ヘルパ
export function patchSettings(patch) {
  update(s => { Object.assign(s.settings, patch); });
}
