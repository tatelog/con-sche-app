# Con-Sche（コンスケ）

建設業向けネットワーク工程表（ADM: Arrow Diagram Method）Webアプリケーション。

「絵に描いた餅」で終わる工程表から卒業するために——現場経験者が企画・開発した、
クリティカルパスが見えるネットワーク工程表エディタです。

## 特徴

- **ネットワーク工程表（ADM）**: 矢線で作業をつなぎ、依存関係とクリティカルパスを自動計算
- **歩掛×数量で工期算出**: 歩掛マスタ内蔵。数量を入れるだけで所要日数を自動計算（手入力モードとの切替可）
- **ローカル保存**: データはブラウザ内（IndexedDB）と独自ファイル（.csa/.csl）に保存。サーバーには送信されません
- **印刷 / PDF / CSV出力**
- **PWA対応**: タブレット・スマホのホーム画面に追加してアプリ感覚で利用可能

> BIM/IFC連携（IFCファイルからの数量取り込み）は現在準備中です。

## 技術スタック

React 19 / TypeScript / Vite / Konva.js（キャンバス描画）/ Zustand / Dexie.js（IndexedDB）/ Tailwind CSS

## 開発

```bash
npm install
npm run dev      # 開発サーバー (http://localhost:5173)
npm test         # テスト (vitest)
npm run build    # 本番ビルド（dist/）
```

初回起動時に利用者登録ゲートが表示されます。登録API（Workers）を立てていないローカル環境では、
`.env.local` に `VITE_SKIP_REGISTRATION=true` を書くとゲートをスキップできます。

## セルフホスト

1. **フロントエンド**: `npm run build` の `dist/` を任意の静的ホスティングへ（Cloudflare Pages / Netlify 等）。
   SPAのため全パスを `index.html` にフォールバックさせてください（`public/_redirects` 同梱済み）。
   > **注意**: `index.html` に当社の Google Analytics タグ（`G-7ZNYLDKQC1`）が入っています。
   > セルフホストする場合は、このタグを削除するかご自身の測定IDに差し替えてください。
   > そのままデプロイすると、貴社サイトのアクセスが当社のアナリティクスに送信されます。
2. **登録・連携API**（任意）: [workers/api/README.md](workers/api/README.md) の手順で
   Cloudflare Workers + D1 をデプロイし、`.env.production` に `VITE_API_BASE=<WorkerのURL>` を
   設定してからビルドします。
3. **マニュアルサイト**（任意): `cd docs-site && npm install && npm run build` の `build/` を静的ホスティングへ。

## 連携API

利用登録時に発行されるAPIコードで、CPM計算・工程ファイル変換の REST API を利用できます
（無料枠: 月90pt = 読み取り45回相当。読み取り系2pt/更新系3pt）。

```
POST /api/v1/cpm      # 工程データからCPM計算（クリティカルパス・フロート・日付換算）
POST /api/v1/convert  # 工程JSON ⇔ .csaファイル変換
GET  /api/v1/usage    # 当月利用量の照会
```

エンドポイント仕様・デプロイ手順は [workers/api/README.md](workers/api/README.md) を参照してください。

## ディレクトリ構成

```
src/
  components/    # UIコンポーネント（canvas: Konva描画 / dialogs / menus / lp: LP）
  stores/        # Zustandストア（admStore: 工程表本体 / uiStore / printStore 等）
  utils/         # CPM計算・ファイル入出力・PDF/CSV出力
  db/            # Dexie（IndexedDB）
  pages/         # ルーティング対象ページ
workers/
  api/           # 利用者登録+連携API（Cloudflare Workers + D1）
docs-site/       # マニュアルサイト（Docusaurus）
```

## ライセンス

[Con-Sche License 1.0](LICENSE)（ソースアベイラブル）

- 利用・改変・社内利用・業務利用: **無償**
- 組み込み・再配布（OEM）: **無償**（クレジット表記が条件）
- 第三者向けマネージドサービスの提供、本ソフトウェアを使った独自API基盤の提供: **要商用契約**
- ※ 建ログが公式に提供する連携API（上記）の無料枠内での利用は、この制限に該当しません

商用ライセンス・API連携のご相談: con-sche@tatelog.biz

---

Powered by Con-Sche (建ログ株式会社)
