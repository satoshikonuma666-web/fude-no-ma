// ルータと共通画面（ホーム、設定、To Do、ネタ帳）

import { el, clear, fmtRelative, fmtDate, countChars, statusLabel, svg, toast } from './util.js';
import {
  getState, subscribe, update, uid, getCurrentDraft, setCurrentDraft,
  createDraft, deleteDraft, patchSettings, resetAll,
} from './store.js';
import { renderEditor, applyFontFamily } from './editor.js';
import { renderProgress } from './chart.js';
import { openModal } from './modal.js';

const APP_VERSION = '1.0.7';

const ROUTES = {
  '#screen-home':       renderHome,
  '#screen-editor':     renderEditor,
  '#screen-todo':       renderTodo,
  '#screen-ideas':      renderIdeas,
  '#screen-progress':   renderProgress,
  '#screen-settings':   renderSettings,
};

const BOTTOM_NAV_SCREENS = new Set([
  '#screen-home', '#screen-todo', '#screen-ideas', '#screen-progress', '#screen-settings',
]);

function currentRoute() {
  const hash = location.hash || '#screen-home';
  return ROUTES[hash] ? hash : '#screen-home';
}

function navigate() {
  const root = document.getElementById('screen-root');
  clear(root);
  const route = currentRoute();
  ROUTES[route](root);
  updateBottomNav(route);
  applyTheme();
}

function updateBottomNav(route) {
  const nav = document.getElementById('bottom-nav');
  const visible = BOTTOM_NAV_SCREENS.has(route);
  nav.hidden = !visible;
  nav.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.route === route);
    b.onclick = () => { location.hash = b.dataset.route; };
  });
}

function applyTheme() {
  const s = getState().settings;
  const theme = s.theme || 'light';
  document.body.dataset.theme = theme;
  // カスタムテーマ: bg / ink / ruled の3色のみ。他は自動派生
  const removeAll = () => {
    for (const k of ['--bg', '--bg-elev', '--bg-subtle', '--ink', '--ink-soft', '--ink-muted', '--border', '--border-strong', '--nav-bg']) {
      document.body.style.removeProperty(k);
    }
    document.body.style.removeProperty('--ruled-line');
  };
  if (theme === 'custom' && s.customColors) {
    const c = s.customColors;
    document.body.style.setProperty('--bg',           c.bg);
    document.body.style.setProperty('--bg-elev',      mix(c.bg, '#FFFFFF', 0.18));
    document.body.style.setProperty('--bg-subtle',    mix(c.bg, c.ink, 0.08));
    document.body.style.setProperty('--ink',          c.ink);
    document.body.style.setProperty('--ink-soft',     mix(c.ink, c.bg, 0.25));
    document.body.style.setProperty('--ink-muted',    mix(c.ink, c.bg, 0.50));
    document.body.style.setProperty('--border',       mix(c.bg, c.ink, 0.14));
    document.body.style.setProperty('--border-strong',mix(c.bg, c.ink, 0.30));
    document.body.style.setProperty('--nav-bg',       mix(c.bg, '#FFFFFF', 0.10));
  } else {
    removeAll();
  }
  // 罫線色は常時設定（カスタムでない場合も罫線色は使われる）
  if (s.customColors?.ruled) {
    document.body.style.setProperty('--ruled-line', s.customColors.ruled);
  } else {
    document.body.style.removeProperty('--ruled-line');
  }
}

function mix(a, b, t) {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  if (!pa || !pb) return a;
  const r = Math.round(pa.r * (1 - t) + pb.r * t);
  const g = Math.round(pa.g * (1 - t) + pb.g * t);
  const bl = Math.round(pa.b * (1 - t) + pb.b * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function hexToRgb(h) {
  if (!h) return null;
  if (h.startsWith('rgb')) {
    const m = h.match(/(\d+)\D+(\d+)\D+(\d+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  }
  const m = /^#?([0-9a-f]{6})$/i.exec(h.replace(/^#/, ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

// ---------- ホーム ----------
function renderHome(root) {
  const screen = el('section', { class: 'screen' });

  // タイトルバー
  screen.appendChild(el('div', { class: 'app-header app-title-bar' }, [
    el('div', { class: 'title app-name' }, '筆の間'),
  ]));

  const body = el('div', { class: 'screen-body' });

  // 締切カウントダウン
  body.appendChild(buildDeadlineCard());

  // 原稿リスト
  body.appendChild(el('div', { class: 'section-title' }, '作成中の原稿'));
  body.appendChild(buildDraftList());

  screen.appendChild(body);

  // FAB
  screen.appendChild(el('button', {
    class: 'fab',
    title: '新規原稿',
    onclick: () => {
      const d = createDraft('無題の原稿');
      setCurrentDraft(d.id);
      location.hash = '#screen-editor';
    },
  }, svg('M12 5v14M5 12h14', { stroke: '#fff', strokeWidth: 2 })));

  root.appendChild(screen);
}

function buildDeadlineCard() {
  const settings = getState().settings;
  const card = el('div', { class: 'deadline-card' });

  if (!settings.deadline) {
    card.dataset.tone = 'none';
    card.appendChild(el('div', {}, [
      el('div', { class: 'deadline-label' }, '入稿締切'),
      el('div', { class: 'deadline-value', style: { fontSize: '15px' } }, '未設定'),
    ]));
    card.appendChild(el('button', {
      class: 'link-btn',
      onclick: () => { location.hash = '#screen-settings'; },
    }, '締切日を設定 →'));
    return card;
  }

  const deadline = new Date(settings.deadline);
  deadline.setHours(23, 59, 59, 999);
  const now = new Date();
  const diffMs = deadline - now;
  const diffDays = Math.floor(diffMs / 86400000);

  let tone = 'safe';
  if (diffDays <= 3) tone = 'warn';
  else if (diffDays <= 7) tone = 'caution';
  card.dataset.tone = tone;

  const left = el('div', {}, [
    el('div', { class: 'deadline-label' }, `入稿締切: ${fmtDate(deadline)}`),
    diffMs <= 0
      ? el('div', { class: 'deadline-value' }, '締切を過ぎています')
      : el('div', { class: 'deadline-content' }, [
          el('div', { class: 'deadline-prompt' }, '入稿まで残り'),
          el('div', { class: 'deadline-days' }, [
            el('span', { class: 'num' }, String(diffDays)),
            el('span', { class: 'unit' }, '日'),
          ]),
        ]),
  ]);
  const right = el('button', {
    class: 'icon-btn',
    title: '締切を変更',
    onclick: () => location.hash = '#screen-settings',
  }, svg('M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z', { size: 18 }));
  card.append(left, right);
  return card;
}

function buildDraftList() {
  const list = el('div', { class: 'draft-list' });
  const drafts = [...getState().drafts].sort((a, b) => b.lastEditedAt - a.lastEditedAt);
  if (drafts.length > 5) list.dataset.scrollable = 'true';
  if (drafts.length === 0) {
    list.appendChild(el('div', { class: 'empty-state' }, '原稿はまだありません。右下の＋から始めましょう。'));
    return list;
  }
  for (const d of drafts) {
    const row = el('div', {
      class: 'draft-row',
      onclick: () => { setCurrentDraft(d.id); location.hash = '#screen-editor'; },
    });
    const incl = getState().settings.includePunctuationInCount;
    const chars = countChars(d.body || '', { includePunctuation: incl });
    const badge = el('span', {
      class: 'badge tappable',
      'data-status': d.status,
      title: 'タップでステータスを変更',
      onclick: (e) => { e.stopPropagation(); openStatusPicker(d.id); },
    }, statusLabel(d.status));
    const deleteBtn = el('button', {
      class: 'draft-delete-btn',
      title: 'この原稿を削除',
      onclick: (e) => { e.stopPropagation(); promptDelete(d.id, d.title); },
    }, svg('M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6', { size: 16, strokeWidth: 1.8 }));
    row.append(
      el('div', { class: 'draft-title' }, d.title || '無題の原稿'),
      el('div', { class: 'draft-meta' }, `${fmtRelative(d.lastEditedAt)}に編集`),
      el('div', { class: 'draft-side' }, [
        badge,
        el('span', { class: 'char-count' }, `${chars.toLocaleString()} 字`),
      ]),
      deleteBtn,
    );
    list.appendChild(row);
  }
  return list;
}

export function openStatusPicker(draftId) {
  const cur = getState().drafts.find(d => d.id === draftId);
  if (!cur) return;
  const options = [
    { v: 'writing',  l: '執筆中', desc: '本文を書いている段階' },
    { v: 'revising', l: '推敲中', desc: '読み直して手直し中' },
    { v: 'done',     l: '完了',   desc: '入稿可・脱稿' },
  ];
  const body = el('div', { class: 'status-picker' });
  for (const o of options) {
    body.appendChild(el('button', {
      class: 'status-option' + (cur.status === o.v ? ' selected' : ''),
      onclick: () => {
        update(s => {
          const d = s.drafts.find(x => x.id === draftId);
          if (d) { d.status = o.v; d.lastEditedAt = Date.now(); }
        });
        toast(`ステータス: ${o.l}`);
        navigate();
      },
    }, [
      el('span', { class: 'badge', 'data-status': o.v }, o.l),
      el('span', { class: 'status-desc' }, o.desc),
      cur.status === o.v ? el('span', { class: 'status-check' }, '✓') : null,
    ]));
  }
  openModal({
    title: `「${cur.title}」のステータス`,
    body,
    actions: [{ label: '閉じる', variant: 'ghost' }],
  });
}

function bindLongPress(node, fn) {
  let timer = null;
  const start = () => { timer = setTimeout(fn, 700); };
  const cancel = () => { clearTimeout(timer); };
  node.addEventListener('pointerdown', start);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('pointermove', cancel);
}

function promptDelete(id, title) {
  openModal({
    title: '原稿を削除',
    body: `「${title}」を削除しますか？元に戻せません。`,
    actions: [
      { label: '削除', variant: 'warn', onclick: () => { deleteDraft(id); toast('削除しました'); navigate(); } },
      { label: 'キャンセル', variant: 'ghost' },
    ],
  });
}

// ---------- To Do リスト ----------
function renderTodo(root) {
  const screen = el('section', { class: 'screen' });
  const back = el('button', { class: 'back-btn', onclick: () => location.hash = '#screen-home' }, [
    svg('M15 18l-6-6 6-6', { size: 18 }), '戻る',
  ]);
  screen.appendChild(el('div', { class: 'app-header' }, [back, el('div', { class: 'title' }, 'To Do リスト')]));

  const body = el('div', { class: 'screen-body' });

  // 追加フォーム
  const addInput = el('input', { type: 'text', placeholder: '新しいタスク…' });
  const addDate = el('input', { type: 'date', title: '期限（任意）' });
  const addBtn = el('button', {
    class: 'btn-primary',
    onclick: () => {
      const v = addInput.value.trim();
      if (!v) return;
      const dueDate = addDate.value || null;
      update(s => {
        if (!s.todos) s.todos = [];
        s.todos.unshift({ id: uid('todo'), text: v, done: false, dueDate, createdAt: Date.now() });
      });
      addInput.value = '';
      addDate.value = '';
      navigate();
    },
  }, '追加');
  addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click(); });
  body.appendChild(el('div', { class: 'todo-add' }, [
    el('div', { class: 'todo-add-row1' }, [addInput, addBtn]),
    el('div', { class: 'todo-add-row2' }, [
      el('label', {}, '期限'),
      addDate,
    ]),
  ]));

  const todos = getState().todos || [];
  // 期限の近い順で並べる
  const sortByDue = (a, b) => {
    if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  };
  const pending = todos.filter(t => !t.done).sort(sortByDue);
  const done = todos.filter(t => t.done).sort((a, b) => b.createdAt - a.createdAt);

  function makeRow(t) {
    const row = el('div', {
      class: 'todo-row' + (t.done ? ' done' : ''),
      onclick: () => {
        update(s => {
          const target = s.todos.find(x => x.id === t.id);
          if (target) target.done = !target.done;
        });
        navigate();
      },
    });
    const text = el('div', { class: 'todo-text-wrap' }, [
      el('div', { class: 'todo-text' }, t.text),
    ]);
    if (t.dueDate) {
      const d = new Date(t.dueDate + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const diffDays = Math.round((d - today) / 86400000);
      const dateStr = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
      let suffix = '';
      let cls = 'todo-due';
      if (diffDays === 0)      { suffix = '今日';        cls += ' today'; }
      else if (diffDays === 1) { suffix = 'あと1日';     cls += ' soon'; }
      else if (diffDays > 0)   { suffix = `あと${diffDays}日`; if (diffDays <= 3) cls += ' soon'; }
      else if (diffDays === -1){ suffix = '1日超過';     cls += ' overdue'; }
      else                     { suffix = `${-diffDays}日超過`; cls += ' overdue'; }
      const dueLabel = `${dateStr}まで（${suffix}）`;
      text.appendChild(el('div', { class: cls }, [
        svg('M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', { size: 11 }),
        el('span', {}, dueLabel),
      ]));
    }
    row.append(
      el('div', { class: 'check' }),
      text,
      el('button', {
        class: 'todo-del',
        onclick: (e) => {
          e.stopPropagation();
          update(s => s.todos = s.todos.filter(x => x.id !== t.id));
          navigate();
        },
      }, '✕'),
    );
    return row;
  }

  if (pending.length) {
    body.appendChild(el('div', { class: 'todo-section-title' }, `未完了 ${pending.length} 件`));
    const list = el('div', { class: 'todo-list' });
    pending.forEach(t => list.appendChild(makeRow(t)));
    body.appendChild(list);
  }
  if (done.length) {
    body.appendChild(el('div', { class: 'todo-section-title' }, `完了 ${done.length} 件`));
    const list = el('div', { class: 'todo-list' });
    done.forEach(t => list.appendChild(makeRow(t)));
    body.appendChild(list);
  }
  if (todos.length === 0) {
    body.appendChild(el('div', { class: 'empty-state' }, 'タスクはまだありません。\n上のフォームから追加してください。'));
  }

  screen.appendChild(body);
  root.appendChild(screen);
}

// ---------- ネタ帳 ----------
function renderIdeas(root) {
  const screen = el('section', { class: 'screen' });
  const back = el('button', { class: 'back-btn', onclick: () => location.hash = '#screen-home' }, [
    svg('M15 18l-6-6 6-6', { size: 18 }), '戻る',
  ]);
  screen.appendChild(el('div', { class: 'app-header' }, [back, el('div', { class: 'title' }, 'ネタ帳')]));

  const body = el('div', { class: 'screen-body' });

  const ideas = getState().ideas || [];

  body.appendChild(el('button', {
    class: 'add-btn-wide',
    onclick: () => openIdeaEditor(null),
  }, '＋ 新しいネタ'));

  if (ideas.length === 0) {
    body.appendChild(el('div', { class: 'empty-state' }, '思いついたことを気軽にメモしましょう。\n登場人物、世界観、台詞、何でも。'));
  } else {
    const list = el('div', { class: 'idea-list' });
    for (const i of ideas) {
      const card = el('div', {
        class: 'idea-card',
        onclick: () => openIdeaEditor(i.id),
      }, [
        el('div', { class: 'idea-title' }, i.title || '（無題）'),
        el('div', { class: 'idea-body' }, i.body || ''),
        el('div', { class: 'idea-meta' }, fmtRelative(i.createdAt)),
      ]);
      list.appendChild(card);
    }
    body.appendChild(list);
  }

  screen.appendChild(body);
  root.appendChild(screen);
}

function openIdeaEditor(id) {
  const state = getState();
  const editing = id ? (state.ideas || []).find(x => x.id === id) : null;
  const titleIn = el('input', { type: 'text', placeholder: 'タイトル' });
  const bodyIn = el('textarea', { rows: 8, placeholder: '内容（自由記述）' });
  if (editing) { titleIn.value = editing.title || ''; bodyIn.value = editing.body || ''; }

  const body = el('div', {}, [
    el('label', {}, 'タイトル'), titleIn,
    el('label', { style: { marginTop: '8px' } }, '内容'), bodyIn,
  ]);

  const actions = [
    { label: '保存', variant: 'primary', onclick: () => {
        update(s => {
          if (!s.ideas) s.ideas = [];
          if (editing) {
            const t = s.ideas.find(x => x.id === editing.id);
            if (t) { t.title = titleIn.value; t.body = bodyIn.value; }
          } else {
            s.ideas.unshift({ id: uid('idea'), title: titleIn.value, body: bodyIn.value, createdAt: Date.now() });
          }
        });
        toast('保存しました');
        navigate();
      } },
    editing ? { label: '削除', variant: 'warn', onclick: () => {
        update(s => s.ideas = s.ideas.filter(x => x.id !== editing.id));
        toast('削除しました');
        navigate();
      } } : null,
    { label: 'キャンセル', variant: 'ghost' },
  ].filter(Boolean);

  openModal({ title: editing ? 'ネタを編集' : '新しいネタ', body, actions });
}

// ---------- 設定 ----------
function renderSettings(root) {
  const screen = el('section', { class: 'screen' });
  const back = el('button', { class: 'back-btn', onclick: () => location.hash = '#screen-home' }, '◁ 戻る');
  screen.appendChild(el('div', { class: 'app-header' }, [back, el('div', { class: 'title' }, '設定')]));

  const body = el('div', { class: 'screen-body' });
  const s = getState().settings;

  // 執筆セクション
  body.appendChild(group('執筆', [
    settingRow('入稿締切', [
      el('input', {
        type: 'date',
        value: s.deadline || '',
        onchange: (e) => { patchSettings({ deadline: e.target.value }); toast('締切を更新'); },
      }),
    ]),
    settingRow('全角スペース自動挿入', [
      switchEl(s.autoIndent, (v) => patchSettings({ autoIndent: v })),
    ], '改行時に自動で1字下げ'),
    settingRow('句読点も文字数に含める', [
      switchEl(s.includePunctuationInCount, (v) => patchSettings({ includePunctuationInCount: v })),
    ]),
    settingRow('簡易入力ボタン', [
      el('button', {
        class: 'btn-ghost', style: { fontSize: '12px' },
        onclick: openQuickButtonsEditor,
      }, 'カスタマイズ'),
    ], (s.customQuickButtons || []).map(x => x === '\n' ? '⏎' : x === '　' ? '␣' : x).join(' ')),
  ]));

  // 表示セクション
  body.appendChild(group('表示', [
    settingRow('フォント', [
      selectEl(s.font, [
        ['noto-serif', 'Noto Serif JP'],
        ['yu-mincho', '游明朝'],
        ['mincho',     '明朝'],
        ['gothic',     'ゴシック'],
      ], (v) => patchSettings({ font: v })),
    ]),
    settingRow('文字サイズ', [
      el('input', {
        type: 'range', min: '12', max: '24', step: '1', value: s.fontSize,
        oninput: (e) => patchSettings({ fontSize: Number(e.target.value) }),
      }),
      el('span', { style: { fontSize: '12px', minWidth: '34px', textAlign: 'right' } }, `${s.fontSize}pt`),
    ]),
    settingRow('行間', [
      el('input', {
        type: 'range', min: '14', max: '24', step: '1', value: Math.round(s.lineHeight * 10),
        oninput: (e) => patchSettings({ lineHeight: Number(e.target.value) / 10 }),
      }),
      el('span', { style: { fontSize: '12px', minWidth: '34px', textAlign: 'right' } }, s.lineHeight.toFixed(1)),
    ]),
    settingRow('1行文字数', [
      el('input', {
        type: 'range', min: '20', max: '45', step: '1', value: s.lineCharCount,
        oninput: (e) => patchSettings({ lineCharCount: Number(e.target.value) }),
      }),
      el('span', { style: { fontSize: '12px', minWidth: '34px', textAlign: 'right' } }, `${s.lineCharCount}字`),
    ], '横書き時のみ'),
    settingRow('書字方向', [
      selectEl(s.writingMode || 'vertical', [
        ['vertical', '縦書き'],
        ['horizontal', '横書き'],
      ], (v) => patchSettings({ writingMode: v })),
    ]),
    settingRow('罫線を表示', [
      switchEl(s.showRuledLines !== false, (v) => { patchSettings({ showRuledLines: v }); toast(v ? '罫線 ON' : '罫線 OFF'); }),
    ], '作成ページの原稿に薄い罫線を引く'),
  ]));

  // テーマ
  const themeBox = el('div', { class: 'settings-group' }, [
    el('h3', {}, 'テーマ'),
    el('div', { class: 'theme-options' }, [
      themeSwatch('light',  'ライト'),
      themeSwatch('dark',   'ダーク'),
      themeSwatch('sepia',  'セピア'),
      themeSwatch('night',  '夜空'),
      themeSwatch('custom', 'カスタム'),
    ]),
  ]);
  // カスタム色パネル（テーマがカスタム時のみ表示）
  if (s.theme === 'custom') {
    themeBox.appendChild(buildCustomColorsPanel(s));
  }
  body.appendChild(themeBox);

  // 同期・バックアップ
  body.appendChild(group('同期・バックアップ', [
    settingRow('iCloud 同期', [
      switchEl(s.syncEnabled, (v) => { patchSettings({ syncEnabled: v }); toast(v ? '同期 ON（モック）' : '同期 OFF'); }),
    ], '※ モックの表示のみ'),
    settingRow('自動バックアップ', [
      selectEl(s.backupFrequency || 'daily', [
        ['always', '常に'],
        ['hourly', '1時間ごと'],
        ['daily',  '1日ごと'],
        ['weekly', '1週ごと'],
        ['off',    'OFF'],
      ], (v) => patchSettings({ backupFrequency: v })),
    ]),
  ]));

  // バックアップ・復元（全データ）
  body.appendChild(group('バックアップ・復元（全データ）', [
    settingRow('JSON で書き出し', [
      el('button', { class: 'btn-primary', style: { fontSize: '12px' }, onclick: exportAllAsJson }, '.json を保存'),
    ], '原稿・キャラ・To Do・ネタ帳・設定を一括バックアップ'),
    settingRow('JSON から復元', [
      el('label', { class: 'btn-ghost', style: { fontSize: '12px', cursor: 'pointer' } }, [
        'ファイル選択',
        el('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: importAllFromJson }),
      ]),
    ], '保存した .json を読み込んで上書き'),
    settingRow('現在の原稿: テキスト出力', [
      el('button', { class: 'btn-ghost', style: { fontSize: '12px' }, onclick: exportCurrentDraft }, '.txt として保存'),
    ]),
    settingRow('テキストを取り込み', [
      el('label', { class: 'btn-ghost', style: { fontSize: '12px', cursor: 'pointer' } }, [
        '取り込み',
        el('input', { type: 'file', accept: '.txt,text/plain', style: { display: 'none' }, onchange: importDraft }),
      ]),
    ]),
    settingRow('PDF 出力（簡易）', [
      el('button', { class: 'btn-ghost', style: { fontSize: '12px' }, onclick: () => doPrintPreview() }, '印刷プレビュー'),
    ], '縦組プレビューを開き、ブラウザの印刷機能で PDF 保存'),
  ]));

  // 危険な操作
  body.appendChild(group('リセット', [
    settingRow('全データ初期化', [
      el('button', { class: 'btn-warn', style: { fontSize: '12px' }, onclick: confirmReset }, '初期化'),
    ], 'サンプルデータの状態に戻します（戻せません）'),
  ]));

  // アプリ情報
  body.appendChild(group('アプリ情報', [
    settingRow('アプリ名', [el('span', { style: { fontSize: '13px' } }, '筆の間')]),
    settingRow('バージョン', [el('span', { style: { fontSize: '13px', fontVariantNumeric: 'tabular-nums' } }, APP_VERSION)]),
  ]));

  screen.appendChild(body);
  root.appendChild(screen);
}

function group(name, children) {
  const g = el('div', { class: 'settings-group' });
  g.appendChild(el('h3', {}, name));
  for (const c of children) g.appendChild(c);
  return g;
}

function settingRow(label, controls, sub) {
  return el('div', { class: 'setting-row' }, [
    el('div', {}, [
      el('div', { class: 'setting-label' }, label),
      sub && el('div', { class: 'setting-sub' }, sub),
    ]),
    el('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } }, controls),
  ]);
}

function switchEl(checked, onchange) {
  const lbl = el('label', { class: 'switch' });
  const inp = el('input', { type: 'checkbox' });
  inp.checked = !!checked;
  inp.addEventListener('change', (e) => onchange(e.target.checked));
  lbl.appendChild(inp);
  lbl.appendChild(el('span', { class: 'slider' }));
  return lbl;
}

function selectEl(value, options, onchange) {
  const sel = el('select', { onchange: (e) => onchange(e.target.value) });
  for (const [v, l] of options) {
    const opt = el('option', { value: v }, l);
    if (v === value) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

function themeSwatch(theme, label) {
  const sw = el('div', {
    class: 'theme-swatch' + (getState().settings.theme === theme ? ' selected' : ''),
    'data-tone': theme,
    onclick: () => {
      patchSettings({ theme });
      toast(`テーマ: ${label}`);
      navigate();
    },
  }, label);
  return sw;
}

function buildCustomColorsPanel(s) {
  const colors = s.customColors || {};
  const panel = el('div', { class: 'custom-color-panel' });
  panel.appendChild(el('div', { class: 'panel-title' }, 'カスタムカラー（3項目）'));
  const items = [
    { k: 'bg',    l: '背景色' },
    { k: 'ink',   l: '文字色' },
    { k: 'ruled', l: '罫線色' },
  ];
  for (const it of items) {
    const input = el('input', {
      type: 'color',
      value: colors[it.k] || '#000000',
      oninput: (e) => {
        update(st => {
          if (!st.settings.customColors) st.settings.customColors = {};
          st.settings.customColors[it.k] = e.target.value;
          // 背景・文字を変えたらカスタムテーマへ自動切替（罫線は単独でも反映）
          if (it.k !== 'ruled') st.settings.theme = 'custom';
        });
        applyTheme();
      },
    });
    panel.appendChild(el('div', { class: 'color-picker-row' }, [
      el('label', {}, it.l),
      input,
    ]));
  }
  panel.appendChild(el('div', { class: 'color-picker-row' }, [
    el('label', { style: { color: 'var(--ink-muted)', fontSize: '11px' } }, 'プリセットからコピー'),
    el('div', { style: { display: 'flex', gap: '4px' } }, [
      presetBtn('ライト', 'light'),
      presetBtn('ダーク', 'dark'),
      presetBtn('セピア', 'sepia'),
      presetBtn('夜空',   'night'),
    ]),
  ]));
  return panel;
}

function presetBtn(label, preset) {
  const PRESETS = {
    light:  { bg: '#FAF7F2', ink: '#1A1A1A', ruled: '#D5CCB8' },
    dark:   { bg: '#1A1A1A', ink: '#FAF7F2', ruled: '#3E3A33' },
    sepia:  { bg: '#F1E5CE', ink: '#3D2C16', ruled: '#C7B68C' },
    night:  { bg: '#0F1A2E', ink: '#F5F1E6', ruled: '#2E4068' },
  };
  return el('button', {
    class: 'btn-ghost',
    style: { fontSize: '10px', padding: '3px 6px', minHeight: '24px' },
    onclick: () => {
      patchSettings({ customColors: { ...PRESETS[preset] }, theme: 'custom' });
      toast(`${label} を取り込みました`);
      navigate();
    },
  }, label);
}

function openQuickButtonsEditor() {
  const ta = el('textarea', { rows: 6, placeholder: '1行に1つの記号を入力' });
  const initial = (getState().settings.customQuickButtons || []).map(x => x === '\n' ? '\\n' : x).join('\n');
  ta.value = initial;
  openModal({
    title: '簡易入力ボタンのカスタマイズ',
    body: el('div', {}, [
      el('label', {}, '1行に1ボタン分。改行は \\n と入力'),
      ta,
    ]),
    actions: [
      { label: '保存', variant: 'primary', onclick: () => {
          const arr = ta.value.split('\n').map(s => s.trim()).filter(Boolean).map(s => s === '\\n' ? '\n' : s);
          patchSettings({ customQuickButtons: arr });
          toast('更新しました');
          navigate();
        } },
      { label: 'キャンセル', variant: 'ghost' },
    ],
  });
}

function doPrintPreview() {
  const draft = getCurrentDraft();
  if (!draft) { toast('原稿がありません'); return; }
  const w = window.open('', '_blank');
  if (!w) { toast('ポップアップがブロックされました'); return; }
  const safeTitle = escapeHtml(draft.title || '原稿');
  const safeBody = escapeHtml(draft.body || '')
    .replace(/｜([^｜《》]+?)《([^《》]+?)》/g, (_, b, r) => `<ruby>${b}<rt>${r}</rt></ruby>`);
  const html = `<!doctype html><html lang="ja" dir="ltr"><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
    <title>${safeTitle}</title>
    <style>
      html, body { margin: 0; padding: 0; background: #FAF7F2; color: #1A1A1A; }
      body {
        font-family: "Noto Serif JP", "Yu Mincho", "YuMincho", serif;
        height: 100vh;
        height: 100dvh;
        display: flex;
        flex-direction: column;
        -webkit-font-smoothing: antialiased;
      }
      .preview-toolbar {
        flex: 0 0 auto;
        padding: max(10px, env(safe-area-inset-top)) 14px 10px;
        background: #FFFFFF;
        border-bottom: 1px solid #E2DCCF;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: "Hiragino Sans", system-ui, sans-serif;
      }
      .preview-toolbar .back {
        background: transparent;
        border: 1px solid #C9C0AE;
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 14px;
        cursor: pointer;
        font-family: inherit;
        color: #2C4A6E;
      }
      .preview-toolbar .print {
        background: #2C4A6E;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 6px 14px;
        font-size: 14px;
        cursor: pointer;
        font-family: inherit;
      }
      .preview-toolbar .doc-title {
        flex: 1;
        text-align: center;
        font-family: "Noto Serif JP", serif;
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .preview-page {
        flex: 1 1 auto;
        overflow-y: hidden;
        overflow-x: auto;
        background: #FFFFFF;
        padding-bottom: env(safe-area-inset-bottom);
      }
      .preview-body {
        height: 100%;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        direction: ltr;
        white-space: pre-wrap;
        font-size: 17px;
        line-height: 2;
        padding: 28px 24px;
        box-sizing: border-box;
      }
      .preview-body ruby rt { font-size: 0.55em; color: #555; }
      @media print {
        .preview-toolbar { display: none; }
        .preview-page { overflow: visible; }
        .preview-body { height: auto; min-height: 80vh; }
      }
    </style></head><body>
    <div class="preview-toolbar">
      <button class="back" onclick="window.close()">← 戻る</button>
      <div class="doc-title">${safeTitle}</div>
      <button class="print" onclick="window.print()">印刷 / PDF</button>
    </div>
    <div class="preview-page">
      <div class="preview-body">${safeBody}</div>
    </div>
    </body></html>`;
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function exportCurrentDraft() {
  const d = getCurrentDraft();
  if (!d) { toast('原稿がありません'); return; }
  const blob = new Blob([d.body || ''], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (d.title || 'draft') + '.txt';
  document.body.appendChild(a); a.click(); a.remove();
  toast('テキストを保存しました');
}

function importDraft(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    const d = createDraft(file.name.replace(/\.txt$/, ''));
    update(s => {
      const target = s.drafts.find(x => x.id === d.id);
      if (target) target.body = text;
    });
    toast('読み込みました');
    location.hash = '#screen-editor';
  };
  reader.readAsText(file);
}

// 全データ JSON でエクスポート
function exportAllAsJson() {
  const state = getState();
  const payload = {
    appName: '筆の間',
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `fude-no-ma-backup-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  toast('バックアップを保存しました');
}

function importAllFromJson(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(String(reader.result || ''));
      const data = obj.data || obj; // 旧形式互換
      if (!data || !data.drafts) {
        openModal({ title: 'インポート失敗', body: '有効なバックアップファイルではありません。', actions: [{ label: 'OK', variant: 'primary' }] });
        return;
      }
      openModal({
        title: 'データを上書き復元',
        body: `現在のデータを上書きします。原稿 ${data.drafts.length} 件 / To Do ${(data.todos||[]).length} 件 / ネタ ${(data.ideas||[]).length} 件。よろしいですか？`,
        actions: [
          { label: '復元する', variant: 'warn', onclick: () => {
              update(s => {
                // 安全のため既知キーだけ上書き
                for (const k of ['drafts', 'characters', 'relations', 'plot', 'chapters', 'todos', 'ideas', 'settings', 'ui']) {
                  if (data[k] !== undefined) s[k] = data[k];
                }
              });
              toast('復元しました');
              navigate();
            } },
          { label: 'キャンセル', variant: 'ghost' },
        ],
      });
    } catch (err) {
      openModal({ title: 'JSON の解析に失敗', body: String(err.message || err), actions: [{ label: 'OK', variant: 'primary' }] });
    }
  };
  reader.readAsText(file);
}

function confirmReset() {
  openModal({
    title: 'データを初期化',
    body: '全ての原稿・設定が消去され、サンプルデータが再投入されます。よろしいですか？',
    actions: [
      { label: '初期化する', variant: 'warn', onclick: () => { resetAll(); navigate(); toast('初期化しました'); } },
      { label: 'キャンセル', variant: 'ghost' },
    ],
  });
}

// ---------- 起動 ----------
window.addEventListener('hashchange', navigate);
window.addEventListener('app:refresh', navigate);
subscribe(() => {
  // テーマ反映のみ即時。画面再描画はリスナー側で navigate() を呼ぶ
  applyTheme();
});

document.addEventListener('DOMContentLoaded', () => {
  if (!location.hash) location.hash = '#screen-home';
  navigate();
  registerServiceWorker();
});

// ---------- Service Worker 登録 ----------
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // file:// では動かないため明示的にチェック
  if (location.protocol === 'file:') return;

  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // 既存タブでアプリ更新が利用可能
          toast('新しいバージョンが利用できます。タップして再読み込み', 6000);
          const root = document.getElementById('toast-root');
          const lastToast = root.lastChild;
          if (lastToast) {
            lastToast.style.pointerEvents = 'auto';
            lastToast.style.cursor = 'pointer';
            lastToast.addEventListener('click', () => {
              newWorker.postMessage('SKIP_WAITING');
              location.reload();
            });
          }
        }
      });
    });
  }).catch(err => {
    console.warn('Service Worker 登録に失敗:', err);
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}
