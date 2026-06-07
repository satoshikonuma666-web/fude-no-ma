# 筆の間 — iPhone 向け小説執筆 PWA

縦書き対応・自動保存・進捗グラフ・ToDo／ネタ帳を備えた、iPhone のホーム画面に追加して使う Progressive Web App です。HTML / CSS / Vanilla JavaScript のみで構成され、データは端末の localStorage に保存されます（JSON バックアップ／復元あり）。

App Store には登録せず、限られたユーザーで共有する用途を想定しています。

---

## 1. 初回セットアップ（管理者が一度だけ）

### 手順 A. PNG アイコンを生成する

PWA としてホーム画面に追加した時のアイコン（PNG）が必要です。

1. プロジェクトフォルダ内で `make-icons.html` をブラウザで開く（ローカルサーバ経由でも `file://` でも可）
2. ページを開くと自動で 4 枚の PNG（180/192/512/maskable-512）が生成され、ダウンロードリンクが表示される
3. 「**すべて一括ダウンロード**」を押し、ダウンロードした PNG 4 枚を `assets/` フォルダに置く
   - `assets/icon-180.png`
   - `assets/icon-192.png`
   - `assets/icon-512.png`
   - `assets/icon-maskable-512.png`

> **アイコンを差し替えたい場合**：`assets/icon.svg` と `assets/icon-maskable.svg` を編集し、もう一度 `make-icons.html` を開いて PNG を再生成してください。

### 手順 B. ホスティング先を選んで公開

ES Modules と Service Worker の都合上、`file://` の直接オープンでは動きません。**HTTPS のホスティング先**が必要です。以下のいずれかが簡単です（すべて無料・クレジットカード不要）。

#### 方式①：Cloudflare Pages（最も簡単・推奨）

1. <https://pages.cloudflare.com> にアクセス（Cloudflare アカウントを無料作成）
2. 「Create a project」→「Direct Upload」を選択
3. プロジェクト名（例：`fude-no-ma`）を入力
4. **このフォルダ全体をドラッグ＆ドロップ** してアップロード
5. デプロイ完了後、`https://fude-no-ma.pages.dev` のような URL が払い出される

更新時：同じプロジェクトの「Upload assets」から再アップロードするだけ。

#### 方式②：GitHub Pages

1. GitHub アカウントを作成し、新しいリポジトリ（例：`fude-no-ma`）を **Public** で作る
2. このフォルダをそのリポジトリに push
   ```sh
   cd "C:\Users\Satoshi Konuma\Documents\Claude\小説制作アプリ"
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<あなたのID>/fude-no-ma.git
   git push -u origin main
   ```
3. リポジトリの **Settings → Pages** で「Source: Deploy from a branch / Branch: main / Folder: root」に設定
4. 数十秒後、`https://<あなたのID>.github.io/fude-no-ma/` で公開される

#### 方式③：Netlify

1. <https://app.netlify.com/drop> にフォルダごとドラッグ＆ドロップするだけ
2. すぐに `https://xxx-xxx.netlify.app` が払い出される

---

## 2. ユーザーへの配布（iPhone へインストール）

公開後の URL を共有するだけです。

### iPhone でホーム画面に追加

1. **Safari** で配布された URL を開く（Chrome ではホーム追加できないので注意）
2. 画面下部の **共有ボタン**（□↑）をタップ
3. メニューから「**ホーム画面に追加**」を選ぶ
4. アプリ名「筆の間」を確認し「追加」

ホーム画面に **アイコン**（青地に筆と落款）が並びます。タップするとフルスクリーンで起動し、Safari の URL バーは表示されません（ネイティブアプリのような体験）。

### Android／PC

- Chrome／Edge ならアドレスバー右側に「インストール」アイコンが出ます。クリックでインストール。
- アンインストールは通常のアプリと同じ手順で可能。

---

## 3. 機能一覧

### 第1階層（ホーム）
- 入稿締切までのカウントダウン（残日数で色変化）
- 作成原稿リスト（タイトル／最終編集日時／ステータス／文字数）
- 新規原稿 FAB

### 第2階層
| 画面 | 内容 |
|---|---|
| 原稿エディタ | 縦書き／横書き、罫線、ルビ記法、自動保存、置換、表記揺れチェック、iPhone 風フリックキーボード、カーソル移動 |
| To Do | 期限付きタスク管理 |
| ネタ帳 | 自由記述のメモ／アイデア管理 |
| 進捗管理 | 期間別の執筆量グラフ（Chart.js）、累計／平均／連続日 |
| 設定 | フォント、文字サイズ、行間、テーマ、罫線、簡易入力ボタン、データ入出力 |

### データ永続化
- すべて端末の **localStorage** に自動保存
- 「設定 → バックアップ・復元 → JSON で書き出し」で全データ JSON を保存
- 「JSON から復元」で復元（端末交換・データ移行時）

### オフライン動作
- 初回読込後は **Service Worker** がアセットをキャッシュ
- 通信なしでもアプリ起動・編集可能
- ネット復帰時に新バージョンがあれば「新しいバージョンが利用できます」というトーストが出ます。タップで再読み込み。

### 入力ツールバーの仕様と Web の制約

原稿エディタの入力欄をタップすると **iPhone 標準の日本語キーボード**（フリック入力・予測変換）が出ます。キーボードの **直上に簡易入力ツールバー** が表示されます：

- 簡易入力：「」 ／ 『』 ／ ーー ／ …… ／ 空白 ／ 改行

カーソル移動・取り消し・やり直し・全角スペース等は iOS 標準の操作（テキスト長押し／予測変換バー／キーボードの ⌫ ／ 空白キー）にお任せする方針です。

このツールバーは `window.visualViewport` の高さ変化を監視し、キーボードの上端に追従して `position: fixed` で固定されます。キーボードを閉じればツールバーも画面下端に戻ります。

#### Web 実装としての制約

| 項目 | 状態 | 補足 |
|---|---|---|
| OS 予測変換バー（候補表示帯） | ❌ 制御不能 | iOS が描画する領域。ツールバーは予測変換バーの「上」に乗ります |
| iOS の `inputAccessoryView` 領域 | ❌ 注入不能 | Safari/PWA からは触れない。ネイティブ実装でのみ可能 |
| `visualViewport` 非対応の環境 | フォールバック動作 | ツールバーは画面下端固定で表示 |
| 予測変換バー直上への食い込み | Phase 2 で対応 | SwiftUI の `.toolbar(.keyboard)` または UIKit の `inputAccessoryView` で実現予定 |

---

## 4. データ管理の注意

| 項目 | 状態 |
|---|---|
| 端末ローカル保存（localStorage） | ✅ 自動 |
| デバイス間自動同期 | ❌ 未対応（手動 JSON 経由で移行） |
| 端末を初期化／Safari の履歴を消去 | ⚠ データ消失（事前に JSON バックアップを） |

> **大切な原稿は定期的に「JSON で書き出し」してください。** iCloud Drive 等にファイルを置けば実質的なバックアップになります。

### ブラウザの localStorage 容量

通常 5MB 程度。日本語で約 500〜1000 万字を保存できる計算ですが、長編原稿が増えてきたら早めに JSON エクスポートを取ってください。

---

## 5. ローカル開発（編集する場合）

```sh
cd "C:\Users\Satoshi Konuma\Documents\Claude\小説制作アプリ"
python -m http.server 5500
```

ブラウザで `http://localhost:5500/` を開く。`python` がなければ `npx.cmd serve .` でも可。

> 開発中は Service Worker のキャッシュが邪魔になることがあります。Chrome の DevTools → Application → Service Workers から「Unregister」、または `sw.js` の `CACHE` 変数を `'fude-no-ma-v1.0.1'` のように上げて再読込してください。

---

## 6. ディレクトリ構成

```
筆の間/
├── index.html              # エントリ
├── manifest.json           # PWA マニフェスト
├── sw.js                   # Service Worker
├── make-icons.html         # PNG アイコン生成ツール
├── README.md
├── css/
│   ├── style.css           # 共通レイアウト・テーマ適用
│   ├── editor.css          # エディタ／iOS 風キーボード
│   └── themes.css          # ライト／ダーク／セピア／夜空
├── js/
│   ├── app.js              # ルータ・ホーム・設定・SW登録
│   ├── store.js            # 状態管理＋localStorage
│   ├── editor.js           # 原稿エディタ
│   ├── search.js           # 置換・表記揺れ・辞書
│   ├── chart.js            # 進捗グラフ
│   ├── modal.js            # 汎用モーダル
│   ├── util.js             # 共通ユーティリティ
│   ├── screens.js          # （未使用：旧キャラ／相関等）
│   └── data/
│       └── samples.js      # 初回サンプル
└── assets/
    ├── icon.svg            # アイコン原本
    ├── icon-maskable.svg   # マスカブル版
    ├── icon-180.png        # iOS 用（make-icons.html で生成）
    ├── icon-192.png        # PWA 用
    ├── icon-512.png        # PWA 用
    └── icon-maskable-512.png
```

---

## 7. アップデート手順（管理者向け）

コードを修正した後：

1. `sw.js` の冒頭にある `const CACHE = 'fude-no-ma-v1.0.0';` のバージョン番号を上げる（例：`v1.0.1`）
2. 同様に `js/app.js` 上部の `APP_VERSION` 定数も上げる
3. ホスティング先（Cloudflare Pages / GitHub Pages 等）に再デプロイ
4. ユーザー側では次回アクセス時に「新しいバージョンが利用できます」と通知され、タップで更新

---

## 8. プライバシー・配布範囲の制御

- 配布した URL を知っている人のみアクセス可能（URL 自体に認証は無い）
- より厳格に制限したい場合は **Cloudflare Access** などで Google アカウント認証を被せる（無料枠あり）
- データはすべて端末内に保存され、サーバには送信されません

---

## 9. ライセンス

私的利用・少人数共有を前提とした内部利用版です。再配布・販売は想定していません。
