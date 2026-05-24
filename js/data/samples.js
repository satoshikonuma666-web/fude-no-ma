// 初回起動時に投入するダミーデータ

function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

// 過去 30 日分の執筆実績を生成
function buildHistory(seed, baseAvg = 1200) {
  const out = [];
  const today = new Date();
  let s = seed;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime());
    d.setDate(today.getDate() - i);
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const noise = (r - 0.5) * baseAvg * 0.9;
    const count = Math.max(0, Math.round(baseAvg + noise + (weekend ? 400 : 0)));
    out.push({ date: d.toISOString().slice(0, 10), count });
  }
  return out;
}

const draftBody1 =
  '　ある晴れた春の朝、｜遠野《とおの》は古い書庫の前に立っていた。\n' +
  '　扉の取手は冷たく、握ると指先にわずかな埃の感触が残った。\n' +
  '「久しぶりだな……」\n' +
  '　彼女は呟いて、ゆっくりと扉を押し開けた。光が斜めに差し込んで、空気中の塵を黄金色に染めた。\n' +
  '　書架の一番奥、誰も触れない棚に、それはあった。革で装丁された一冊の本。表紙には何も書かれていない。\n' +
  '──運命というものは、こうして静かに始まるのだろうか。\n';

const draftBody2 =
  '　雨の音は嫌いではなかった。むしろ、誰の声も届かないあの瞬間、\n' +
  '世界がほんの少しだけ自分のものになる気がして、僕は窓辺に座って雨を聴くのが好きだった。\n' +
  '「ねえ、いつまでそうしているつもり？」\n' +
  '　声が降ってきたのは、ちょうど三杯目の珈琲を淹れ終えた時だった。\n' +
  '振り向くと、見知らぬ女性が立っていた。傘も持たず、髪はびっしょりと濡れている。\n';

const draftBody3 =
  '　最終章。\n' +
  '　全ては円環のように、始まりへと戻っていく。\n' +
  '　｜彼《かれ》は最後の頁を閉じた。窓の外、夜明けの色が空に滲んでいた。\n' +
  '「これで、終わりだ」\n' +
  '──そして、また新しい物語が始まる。\n';

export function createSampleData() {
  const draftId1 = uid('draft');
  const draftId2 = uid('draft');
  const draftId3 = uid('draft');

  const now = Date.now();
  const dayMs = 86400000;

  const drafts = [
    {
      id: draftId1,
      title: '遠野の書庫',
      body: draftBody1,
      status: 'writing',
      lastEditedAt: now - 2 * 3600 * 1000,
      charCountHistory: buildHistory(101, 1400),
    },
    {
      id: draftId2,
      title: '雨と珈琲',
      body: draftBody2,
      status: 'revising',
      lastEditedAt: now - 1 * dayMs,
      charCountHistory: buildHistory(202, 900),
    },
    {
      id: draftId3,
      title: '円環の終章',
      body: draftBody3,
      status: 'done',
      lastEditedAt: now - 5 * dayMs,
      charCountHistory: buildHistory(303, 600),
    },
  ];

  const characters = [
    {
      id: uid('chr'),
      draftId: draftId1,
      name: '遠野 詩織',
      furigana: 'とおの しおり',
      age: '24',
      gender: '女性',
      role: '主人公',
      appearance: '長い黒髪。眼鏡。藍色のコート。',
      personality: '内向的だが芯が強い。古いものを愛する。',
      tone: '丁寧語が基本。独り言が多い。',
      background: '幼少期に祖父の書庫で過ごした記憶を持つ。',
      memo: '書庫の本に導かれる役。',
    },
    {
      id: uid('chr'),
      draftId: draftId1,
      name: '黒澤 玲',
      furigana: 'くろさわ れい',
      age: '32',
      gender: '男性',
      role: '対立者',
      appearance: '長身。黒のロングコート。',
      personality: '冷静沈着。目的のためなら手段を選ばない。',
      tone: '簡潔。命令調が混じる。',
      background: '謎の組織の幹部。書庫の本を狙う。',
      memo: '物語中盤で正体が判明。',
    },
    {
      id: uid('chr'),
      draftId: draftId1,
      name: '春日 和音',
      furigana: 'かすが かずね',
      age: '26',
      gender: '女性',
      role: '協力者',
      appearance: '明るい栗色のショートヘア。',
      personality: '陽気でお節介。',
      tone: 'タメ口。語尾に「だよ」。',
      background: '詩織の幼馴染。司書として働く。',
      memo: '物語のムードメーカー。',
    },
    {
      id: uid('chr'),
      draftId: draftId1,
      name: '燈 真琴',
      furigana: 'ともしび まこと',
      age: '23',
      gender: '女性',
      role: 'ヒロイン',
      appearance: '銀髪。少し透けるほど色白。',
      personality: '神秘的。多くを語らない。',
      tone: '古風で詩的。',
      background: '書庫の本そのものに宿る存在。',
      memo: '物語の鍵を握る。',
    },
    {
      id: uid('chr'),
      draftId: draftId1,
      name: '館長 老人',
      furigana: 'かんちょう ろうじん',
      age: '78',
      gender: '男性',
      role: '脇役',
      appearance: '白髪。丸眼鏡。',
      personality: '寡黙で皮肉屋。',
      tone: '老成した語り口。',
      background: '書庫を半世紀守ってきた。',
      memo: '冒頭で詩織を案内する。',
    },
  ];

  // 関係性エッジ 6 本
  const relations = [
    { id: uid('rel'), from: characters[0].id, to: characters[3].id, label: '導かれる' },
    { id: uid('rel'), from: characters[0].id, to: characters[1].id, label: '対立' },
    { id: uid('rel'), from: characters[0].id, to: characters[2].id, label: '幼馴染' },
    { id: uid('rel'), from: characters[1].id, to: characters[3].id, label: '狙う' },
    { id: uid('rel'), from: characters[4].id, to: characters[0].id, label: '案内' },
    { id: uid('rel'), from: characters[2].id, to: characters[4].id, label: '師事' },
  ];

  const chapters = [
    {
      id: uid('ch'),
      draftId: draftId1,
      title: '第一章 古き扉',
      summary: '詩織が祖父の書庫を再訪し、革装の本を発見する。',
      collapsed: false,
      scenes: [
        { id: uid('sc'), title: '書庫の前で', place: '旧家の書庫前', time: '春の朝', people: '詩織、館長', purpose: '扉を開けるか逡巡する', result: '意を決して扉を開ける' },
        { id: uid('sc'), title: '革装の本',     place: '書庫内',         time: '同日',     people: '詩織',         purpose: '棚を確認する',        result: '革装の本を見つける' },
        { id: uid('sc'), title: '館長の助言',   place: '書庫内',         time: '同日昼',   people: '詩織、館長',   purpose: '本の正体を尋ねる',    result: '館長は答えをはぐらかす' },
      ],
    },
    {
      id: uid('ch'),
      draftId: draftId1,
      title: '第二章 銀の少女',
      summary: '本の中から銀髪の少女が現れる。彼女の正体を巡る謎が深まる。',
      collapsed: true,
      scenes: [
        { id: uid('sc'), title: '頁の中の声', place: '書庫の奥',   time: '夜', people: '詩織、真琴',         purpose: '本を開く',        result: '銀髪の少女が現れる' },
        { id: uid('sc'), title: '名乗り',     place: '書庫の奥',   time: '同夜',people: '詩織、真琴',         purpose: '互いを知る',      result: '少女は「真琴」と名乗る' },
        { id: uid('sc'), title: '影の気配',   place: '書庫外路地', time: '深夜',people: '詩織、真琴、黒澤',   purpose: '帰路に着く',      result: '黒澤の影に追われる' },
      ],
    },
    {
      id: uid('ch'),
      draftId: draftId1,
      title: '第三章 円環の始まり',
      summary: '物語の真相が明かされ、詩織は選択を迫られる。',
      collapsed: true,
      scenes: [
        { id: uid('sc'), title: '真相',     place: '黒澤の隠れ家', time: '翌日', people: '詩織、黒澤',         purpose: '黒澤と対峙する',     result: '本の真の意味を知る' },
        { id: uid('sc'), title: '選択',     place: '書庫の祭壇',   time: '同日夕', people: '詩織、真琴、和音',  purpose: '本を閉じるかを選ぶ', result: '詩織は閉じることを選ぶ' },
        { id: uid('sc'), title: '新しい朝', place: '書庫外',       time: '夜明け', people: '詩織',             purpose: '日常へ戻る',         result: '物語は次の章へ' },
      ],
    },
  ];

  const plot = {
    overall: '若い古書研究家・遠野詩織が、祖父の遺した書庫で「世界の記憶」を宿す一冊の本に出会い、それを狙う者たちとの対峙を経て、本に宿る存在「真琴」と共に世界の在り方を選び直す物語。',
    byChapter: {
      [chapters[0].id]: '日常からの逸脱。象徴としての扉。',
      [chapters[1].id]: '異界との接触。秘密と追跡。',
      [chapters[2].id]: '選択。円環の閉じと開き。',
    },
  };

  return {
    drafts,
    characters,
    relations,
    plot,
    chapters,
    settings: {
      deadline: new Date(now + 18 * dayMs).toISOString().slice(0, 10),
      font: 'noto-serif',
      fontSize: 16,
      lineHeight: 1.9,
      lineCharCount: 30,
      theme: 'light',
      showRuledLines: true,
      customColors: {
        bg:     '#FAF7F2',
        ink:    '#1A1A1A',
        ruled:  '#D5CCB8',
      },
      autoIndent: true,
      includePunctuationInCount: true,
      writingMode: 'vertical',
      customQuickButtons: ['「」', '『』', 'ーー', '……', '　', '\n'],
      syncEnabled: false,
      backupFrequency: 'daily',
    },
    todos: [
      { id: uid('todo'), text: '第二章の冒頭を書き直す',         done: false, createdAt: now - 2 * dayMs, dueDate: new Date(now + 3 * dayMs).toISOString().slice(0,10) },
      { id: uid('todo'), text: '黒澤の口調メモを反映',           done: false, createdAt: now - 1 * dayMs, dueDate: new Date(now + 7 * dayMs).toISOString().slice(0,10) },
      { id: uid('todo'), text: '冒頭シーンの場所描写を入れる',   done: true,  createdAt: now - 3 * dayMs, dueDate: new Date(now - 1 * dayMs).toISOString().slice(0,10) },
      { id: uid('todo'), text: '入稿前にルビ抜けチェック',       done: false, createdAt: now - 4 * 3600 * 1000, dueDate: new Date(now + 14 * dayMs).toISOString().slice(0,10) },
    ],
    ideas: [
      { id: uid('idea'), title: '雨と書庫の対比',        body: '物語の始まりは晴れだが、転回点で必ず雨を降らせる。「光と湿度」のコントラスト。', createdAt: now - 5 * dayMs },
      { id: uid('idea'), title: '銀髪の少女の正体',      body: '本そのものが意志を持っている、というメタファー。最終章で読者に気付かせたい。', createdAt: now - 3 * dayMs },
      { id: uid('idea'), title: '黒澤の動機（裏設定）', body: '実は失った妹を本の中に探している。中盤で匂わせ、終盤で明かす。',           createdAt: now - 1 * dayMs },
    ],
    ui: {
      currentDraftId: draftId1,
      lastRoute: '#screen-home',
    },
    meta: {
      seededAt: now,
      version: 1,
    },
  };
}
