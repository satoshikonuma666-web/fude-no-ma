// 第3階層の画面群: キャラクター / 人物相関 / あらすじ / 章立て

import { el, clear, toast } from './util.js';
import { openModal, closeModal } from './modal.js';
import { getState, update, uid, getCurrentDraft } from './store.js';

// ---------- キャラクター ----------
export function renderCharacters(root) {
  const screen = el('section', { class: 'screen' });
  const back = el('button', { class: 'back-btn', onclick: () => location.hash = '#screen-editor' }, '◁ 戻る');
  screen.appendChild(el('div', { class: 'app-header' }, [back, el('div', { class: 'title' }, 'キャラクター設定')]));

  const body = el('div', { class: 'screen-body' });
  const draft = getCurrentDraft();
  const list = el('div', { class: 'cards-grid' });
  const characters = (getState().characters || []).filter(c => !c.draftId || c.draftId === draft?.id);

  for (const c of characters) {
    list.appendChild(buildCharacterCard(c));
  }
  body.appendChild(list);

  body.appendChild(el('button', {
    class: 'add-btn-wide',
    onclick: () => openCharacterEditor(null),
  }, '＋ 新しいキャラクター'));

  screen.appendChild(body);
  root.appendChild(screen);
}

function buildCharacterCard(c) {
  return el('div', {
    class: 'card',
    onclick: () => openCharacterEditor(c.id),
  }, [
    el('div', { class: 'avatar' }, (c.name || '？').slice(0, 1)),
    el('div', {}, [
      el('div', { class: 'name' }, c.name || '（無名）'),
      el('div', { class: 'sub' }, [c.role, c.age && (c.age + '歳'), c.gender].filter(Boolean).join(' / ')),
      el('div', { class: 'traits' }, [c.appearance, c.personality].filter(Boolean).join(' ／ ')),
    ]),
  ]);
}

function openCharacterEditor(id) {
  const state = getState();
  const editing = id ? state.characters.find(c => c.id === id) : null;
  const draft = getCurrentDraft();

  const fields = [
    { k: 'name',        l: '名前' },
    { k: 'furigana',    l: 'ふりがな' },
    { k: 'age',         l: '年齢' },
    { k: 'gender',      l: '性別' },
    { k: 'role',        l: '役回り' },
    { k: 'appearance',  l: '外見',     long: true },
    { k: 'personality', l: '性格',     long: true },
    { k: 'tone',        l: '口調' },
    { k: 'background',  l: '背景',     long: true },
    { k: 'memo',        l: 'メモ',     long: true },
  ];

  const inputs = {};
  const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
  for (const f of fields) {
    const wrap = el('div');
    wrap.appendChild(el('label', {}, f.l));
    const input = f.long
      ? el('textarea', { rows: 2 })
      : el('input', { type: 'text' });
    input.value = editing?.[f.k] || '';
    inputs[f.k] = input;
    wrap.appendChild(input);
    body.appendChild(wrap);
  }

  const actions = [
    { label: '保存', variant: 'primary', onclick: () => {
        update(s => {
          if (editing) {
            const c = s.characters.find(x => x.id === editing.id);
            if (c) for (const f of fields) c[f.k] = inputs[f.k].value;
          } else {
            const newC = { id: uid('chr'), draftId: draft?.id };
            for (const f of fields) newC[f.k] = inputs[f.k].value;
            s.characters.push(newC);
          }
        });
        toast('保存しました');
        window.dispatchEvent(new CustomEvent('app:refresh'));
      } },
    editing ? { label: '削除', variant: 'warn', onclick: () => {
        update(s => {
          s.characters = s.characters.filter(c => c.id !== editing.id);
          s.relations = s.relations.filter(r => r.from !== editing.id && r.to !== editing.id);
        });
        toast('削除しました');
        window.dispatchEvent(new CustomEvent('app:refresh'));
      } } : null,
    { label: 'キャンセル', variant: 'ghost' },
  ].filter(Boolean);

  openModal({ title: editing ? 'キャラクター編集' : '新規キャラクター', body, actions });
}

// ---------- 人物相関 ----------
export function renderRelations(root) {
  const screen = el('section', { class: 'screen' });
  const back = el('button', { class: 'back-btn', onclick: () => location.hash = '#screen-editor' }, '◁ 戻る');
  screen.appendChild(el('div', { class: 'app-header' }, [back, el('div', { class: 'title' }, '人物相関')]));

  const body = el('div', { class: 'screen-body' });
  const stage = el('div', { class: 'relations-stage' });
  body.appendChild(stage);
  body.appendChild(el('div', { class: 'relations-hint', style: { position: 'static', margin: '8px 16px' } }, 'ノードをドラッグして配置を変更できます。'));
  screen.appendChild(body);
  root.appendChild(screen);

  drawRelations(stage);
}

function cssColor(varName, fallback) {
  const v = getComputedStyle(document.body).getPropertyValue(varName).trim();
  return v || fallback;
}

function drawRelations(container) {
  clear(container);
  const ns = 'http://www.w3.org/2000/svg';
  const svgEl = document.createElementNS(ns, 'svg');
  svgEl.setAttribute('viewBox', '0 0 343 360');
  container.appendChild(svgEl);

  const colors = {
    edge:   cssColor('--border-strong', '#C9C0AE'),
    bgElev: cssColor('--bg-elev', '#FFFFFF'),
    border: cssColor('--border', '#E2DCCF'),
    ink:    cssColor('--ink', '#1A1A1A'),
    muted:  cssColor('--ink-muted', '#7A756C'),
    accent: cssColor('--accent', '#2C4A6E'),
  };

  const draft = getCurrentDraft();
  const characters = (getState().characters || []).filter(c => !c.draftId || c.draftId === draft?.id);
  const relations = getState().relations || [];

  const cx = 171, cy = 180, rad = 120;
  const positions = new Map();
  characters.forEach((c, i) => {
    const angle = (i / characters.length) * Math.PI * 2 - Math.PI / 2;
    positions.set(c.id, { x: cx + Math.cos(angle) * rad, y: cy + Math.sin(angle) * rad });
  });

  const edgeLayer = document.createElementNS(ns, 'g');
  svgEl.appendChild(edgeLayer);
  drawEdges(edgeLayer, relations, positions, colors);

  for (const c of characters) {
    const p = positions.get(c.id);
    if (!p) continue;
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `translate(${p.x}, ${p.y})`);
    g.style.cursor = 'grab';
    const circ = document.createElementNS(ns, 'circle');
    circ.setAttribute('r', 24);
    circ.setAttribute('fill', colors.bgElev);
    circ.setAttribute('stroke', colors.accent);
    circ.setAttribute('stroke-width', '1.5');
    const txt = document.createElementNS(ns, 'text');
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('dy', '4');
    txt.setAttribute('font-size', '11');
    txt.setAttribute('fill', colors.ink);
    txt.setAttribute('font-family', '"Noto Serif JP", serif');
    txt.textContent = (c.name || '？').slice(0, 3);
    g.appendChild(circ);
    g.appendChild(txt);
    svgEl.appendChild(g);

    let dragging = false;
    let offsetX = 0, offsetY = 0;
    g.addEventListener('pointerdown', (e) => {
      dragging = true;
      g.setPointerCapture(e.pointerId);
      const pt = svgPoint(svgEl, e);
      offsetX = pt.x - p.x;
      offsetY = pt.y - p.y;
      g.style.cursor = 'grabbing';
    });
    g.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const pt = svgPoint(svgEl, e);
      p.x = pt.x - offsetX;
      p.y = pt.y - offsetY;
      g.setAttribute('transform', `translate(${p.x}, ${p.y})`);
      drawEdges(edgeLayer, relations, positions, colors);
    });
    g.addEventListener('pointerup', (e) => {
      dragging = false;
      g.releasePointerCapture(e.pointerId);
      g.style.cursor = 'grab';
    });
  }
}

function drawEdges(layer, relations, positions, colors) {
  clear(layer);
  const ns = 'http://www.w3.org/2000/svg';
  for (const r of relations) {
    const a = positions.get(r.from), b = positions.get(r.to);
    if (!a || !b) continue;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('stroke', colors.edge);
    line.setAttribute('stroke-width', '1.4');
    layer.appendChild(line);

    const tx = (a.x + b.x) / 2, ty = (a.y + b.y) / 2;
    const w = (r.label?.length || 2) * 11 + 8;
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('x', tx - w / 2); bg.setAttribute('y', ty - 8);
    bg.setAttribute('width', w); bg.setAttribute('height', 14);
    bg.setAttribute('rx', 4);
    bg.setAttribute('fill', colors.bgElev);
    bg.setAttribute('stroke', colors.border);
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', tx); lbl.setAttribute('y', ty + 3);
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('font-size', '10');
    lbl.setAttribute('fill', colors.muted);
    lbl.setAttribute('font-family', '"Hiragino Sans", sans-serif');
    lbl.textContent = r.label;
    layer.appendChild(bg);
    layer.appendChild(lbl);
  }
}

function svgPoint(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// ---------- あらすじ ----------
export function renderPlot(root) {
  const screen = el('section', { class: 'screen' });
  const back = el('button', { class: 'back-btn', onclick: () => location.hash = '#screen-editor' }, '◁ 戻る');
  screen.appendChild(el('div', { class: 'app-header' }, [back, el('div', { class: 'title' }, 'あらすじ管理')]));

  const body = el('div', { class: 'screen-body' });

  // 全体あらすじ
  const overall = el('textarea', {
    placeholder: '物語全体のあらすじ',
    oninput: (e) => update(s => { s.plot.overall = e.target.value; }),
  });
  overall.value = getState().plot?.overall || '';

  const tplRow = el('div', { class: 'template-row' }, [
    el('button', { onclick: () => applyTemplate(overall, 'kishotenketsu') }, '起承転結を挿入'),
    el('button', { onclick: () => applyTemplate(overall, 'johakyu') }, '序破急を挿入'),
  ]);

  body.appendChild(el('div', { class: 'plot-block' }, [
    el('h4', {}, '全体あらすじ'),
    overall,
    tplRow,
  ]));

  // 章別
  const draft = getCurrentDraft();
  const chapters = (getState().chapters || []).filter(c => !c.draftId || c.draftId === draft?.id);
  body.appendChild(el('div', { class: 'section-title' }, '章別あらすじ'));
  for (const ch of chapters) {
    const ta = el('textarea', {
      rows: 3,
      oninput: (e) => update(s => {
        if (!s.plot.byChapter) s.plot.byChapter = {};
        s.plot.byChapter[ch.id] = e.target.value;
      }),
    });
    ta.value = getState().plot?.byChapter?.[ch.id] || ch.summary || '';
    body.appendChild(el('div', { class: 'plot-block' }, [
      el('h4', {}, ch.title),
      ta,
    ]));
  }

  screen.appendChild(body);
  root.appendChild(screen);
}

function applyTemplate(node, kind) {
  const txt = kind === 'kishotenketsu'
    ? '【起】\n（導入。世界観と主要人物を提示する）\n\n【承】\n（展開。葛藤や障害を積み重ねる）\n\n【転】\n（転換。物語が大きく動く）\n\n【結】\n（結末。主人公の変化を示す）\n'
    : '【序】\n（静かな日常から物語へ）\n\n【破】\n（破調と転回。一気に進む）\n\n【急】\n（結末へ向けて一直線に駆ける）\n';
  node.value = (node.value ? node.value + '\n\n' : '') + txt;
  node.dispatchEvent(new Event('input'));
  toast('テンプレートを挿入しました');
}

// ---------- 章立て・シーン構成 ----------
export function renderChapters(root) {
  const screen = el('section', { class: 'screen' });
  const back = el('button', { class: 'back-btn', onclick: () => location.hash = '#screen-editor' }, '◁ 戻る');
  screen.appendChild(el('div', { class: 'app-header' }, [back, el('div', { class: 'title' }, '章立て・シーン構成')]));

  const body = el('div', { class: 'screen-body' });
  const draft = getCurrentDraft();
  const chapters = (getState().chapters || []).filter(c => !c.draftId || c.draftId === draft?.id);

  for (const ch of chapters) {
    body.appendChild(buildChapterItem(ch));
  }
  body.appendChild(el('button', {
    class: 'add-btn-wide',
    onclick: () => {
      const id = uid('ch');
      update(s => s.chapters.push({ id, draftId: draft?.id, title: '新しい章', summary: '', scenes: [], collapsed: false }));
      window.dispatchEvent(new CustomEvent('app:refresh'));
    },
  }, '＋ 新しい章'));

  screen.appendChild(body);
  root.appendChild(screen);
}

function buildChapterItem(ch) {
  const item = el('div', { class: 'chapter-item', 'data-collapsed': String(ch.collapsed || false) });
  const head = el('div', { class: 'chapter-head' }, [
    el('div', {}, [
      el('div', { class: 'ch-title' }, ch.title),
      el('div', { class: 'ch-count' }, `${ch.scenes?.length || 0} シーン`),
    ]),
    el('button', {
      class: 'btn-ghost',
      style: { fontSize: '11px', padding: '4px 10px', minHeight: '28px' },
      onclick: (e) => { e.stopPropagation(); editChapter(ch.id); },
    }, '編集'),
  ]);
  head.addEventListener('click', () => {
    update(s => {
      const target = s.chapters.find(c => c.id === ch.id);
      if (target) target.collapsed = !target.collapsed;
    });
    item.dataset.collapsed = String(!ch.collapsed);
    ch.collapsed = !ch.collapsed;
  });
  item.appendChild(head);

  const sceneList = el('div', { class: 'chapter-body' });
  for (const sc of (ch.scenes || [])) {
    sceneList.appendChild(buildSceneRow(ch.id, sc));
  }
  sceneList.appendChild(el('button', {
    class: 'add-btn-wide',
    style: { margin: '4px 0 0', borderColor: 'var(--border)' },
    onclick: () => editScene(ch.id, null),
  }, '＋ シーンを追加'));
  item.appendChild(sceneList);

  // ドラッグ＆ドロップ
  enableSceneDnD(ch.id, sceneList);

  return item;
}

function buildSceneRow(chapterId, sc) {
  const row = el('div', {
    class: 'scene-row',
    draggable: 'true',
    'data-id': sc.id,
    onclick: () => editScene(chapterId, sc.id),
  }, [
    el('div', { class: 'scene-title' }, sc.title || '無題のシーン'),
    el('div', { class: 'scene-meta' }, [
      sc.place && `場所: ${sc.place}`,
      sc.time && `時刻: ${sc.time}`,
      sc.people && `登場: ${sc.people}`,
    ].filter(Boolean).join(' / ')),
    sc.purpose && el('div', { style: { fontSize: '11px', color: 'var(--ink-soft)' } }, `目的: ${sc.purpose}`),
    sc.result && el('div', { style: { fontSize: '11px', color: 'var(--ink-soft)' } }, `結果: ${sc.result}`),
  ]);
  return row;
}

function enableSceneDnD(chapterId, container) {
  let dragId = null;
  container.querySelectorAll('.scene-row').forEach(row => {
    row.addEventListener('dragstart', (e) => {
      dragId = row.dataset.id;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      dragId = null;
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      const target = row.dataset.id;
      if (!dragId || target === dragId) return;
      reorderScene(chapterId, dragId, target);
    });
  });
}

function reorderScene(chapterId, fromId, toId) {
  update(s => {
    const ch = s.chapters.find(c => c.id === chapterId);
    if (!ch) return;
    const fromIdx = ch.scenes.findIndex(sc => sc.id === fromId);
    const toIdx = ch.scenes.findIndex(sc => sc.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = ch.scenes.splice(fromIdx, 1);
    ch.scenes.splice(toIdx, 0, item);
  });
  // 再描画
  window.dispatchEvent(new CustomEvent('app:refresh'));
}

function editChapter(id) {
  const ch = getState().chapters.find(c => c.id === id);
  if (!ch) return;
  const titleIn = el('input', { type: 'text', value: ch.title });
  const sumIn = el('textarea', { rows: 3 });
  sumIn.value = ch.summary || '';
  const body = el('div', {}, [
    el('label', {}, '章タイトル'), titleIn,
    el('label', {}, '章のあらすじ'), sumIn,
  ]);
  openModal({
    title: '章を編集',
    body,
    actions: [
      { label: '保存', variant: 'primary', onclick: () => {
          update(s => {
            const c = s.chapters.find(x => x.id === id);
            if (c) { c.title = titleIn.value; c.summary = sumIn.value; }
          });
          window.dispatchEvent(new CustomEvent('app:refresh'));
        } },
      { label: '章を削除', variant: 'warn', onclick: () => {
          update(s => s.chapters = s.chapters.filter(c => c.id !== id));
          window.dispatchEvent(new CustomEvent('app:refresh'));
        } },
      { label: 'キャンセル', variant: 'ghost' },
    ],
  });
}

function editScene(chapterId, sceneId) {
  const ch = getState().chapters.find(c => c.id === chapterId);
  if (!ch) return;
  const sc = sceneId ? ch.scenes.find(s => s.id === sceneId) : { title: '', place: '', time: '', people: '', purpose: '', result: '' };
  const fields = [
    { k: 'title',   l: 'シーンタイトル' },
    { k: 'place',   l: '場所' },
    { k: 'time',    l: '時刻' },
    { k: 'people',  l: '登場人物' },
    { k: 'purpose', l: '目的', long: true },
    { k: 'result',  l: '結果', long: true },
  ];
  const inputs = {};
  const body = el('div', {});
  for (const f of fields) {
    body.appendChild(el('label', {}, f.l));
    const inp = f.long ? el('textarea', { rows: 2 }) : el('input', { type: 'text' });
    inp.value = sc[f.k] || '';
    inputs[f.k] = inp;
    body.appendChild(inp);
  }
  openModal({
    title: sceneId ? 'シーン編集' : '新規シーン',
    body,
    actions: [
      { label: '保存', variant: 'primary', onclick: () => {
          update(s => {
            const c = s.chapters.find(x => x.id === chapterId);
            if (!c) return;
            if (sceneId) {
              const t = c.scenes.find(x => x.id === sceneId);
              if (t) for (const f of fields) t[f.k] = inputs[f.k].value;
            } else {
              const obj = { id: uid('sc') };
              for (const f of fields) obj[f.k] = inputs[f.k].value;
              c.scenes.push(obj);
            }
          });
          window.dispatchEvent(new CustomEvent('app:refresh'));
        } },
      sceneId ? { label: '削除', variant: 'warn', onclick: () => {
          update(s => {
            const c = s.chapters.find(x => x.id === chapterId);
            if (c) c.scenes = c.scenes.filter(x => x.id !== sceneId);
          });
          window.dispatchEvent(new CustomEvent('app:refresh'));
        } } : null,
      { label: 'キャンセル', variant: 'ghost' },
    ].filter(Boolean),
  });
}
