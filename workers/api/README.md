# Con-Sche API（Cloudflare Workers + D1）

利用者登録・APIコード発行・連携API（CPM計算/ファイル変換）を提供するWorker。

## エンドポイント一覧

| エンドポイント | 認証 | 消費pt | 内容 |
|---|---|---|---|
| `POST /api/register` | 不要 | - | 利用者登録+APIコード発行（エディタの初回登録） |
| `POST /api/contact` | 不要 | - | LPお問い合わせフォームの受け皿 |
| `POST /api/v1/cpm` | 必要 | 2 | 工程データからCPM計算 |
| `POST /api/v1/convert` | 必要 | 2 | 工程JSON ⇔ .csaファイル変換 |
| `GET /api/v1/usage` | 必要 | 0 | 自キーの当月利用量照会 |

## 従量カウント

- **読み取り系 = 2pt / 更新系 = 3pt**（読み:更新 = 2/3 : 1）
- **無料枠 = 月90pt**（更新30回、または読み取り45回相当）
- 課金は成功レスポンス（2xx）のみ。失敗・429は0pt
- 全リクエストを `usage_logs` に記録（キー・エンドポイント・status・消費pt・IP・日時）
- 上限値・重みは `src/v1.ts` 冒頭の定数（`WEIGHT_READ` / `WEIGHT_UPDATE` / `MONTHLY_LIMIT_POINTS`）

## 連携API v1 の使い方

認証はAPIコード（エディタ初回登録時に発行される `cs_live_...`）をBearerトークンで送る。

### CPM計算

```bash
curl -X POST https://<worker>/api/v1/cpm \
  -H "Authorization: Bearer cs_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": [{"id":"n1"},{"id":"n2"},{"id":"n3"}],
    "activities": [
      {"id":"A","name":"躯体工事","fromNodeId":"n1","toNodeId":"n2","duration":5},
      {"id":"B","name":"内装工事","fromNodeId":"n2","toNodeId":"n3","duration":3},
      {"id":"C","name":"外構工事","fromNodeId":"n1","toNodeId":"n3","duration":6}
    ],
    "calendar": {"startDate":"2026-08-03","workDays":[1,2,3,4,5],
                 "holidays":[{"date":"2026-08-11","name":"山の日"}]}
  }'
```

レスポンス: 各作業のES/EF/LS/LF・フロート・クリティカルパス・全体工期。
`calendar` を渡すと稼働日番号をカレンダー日付に変換して返す
（作業の `startDate`/`endDate`、結合点の最早/最遅開始日、全体の `projectEndDate`）。
duration の単位は稼働日。循環依存は422。

### ファイル変換

```bash
# 工程JSON → .csa（エディタで開けるファイル。ノード位置はCPM結果から自動配置）
curl -X POST https://<worker>/api/v1/convert \
  -H "Authorization: Bearer cs_live_..." \
  -H "Content-Type: application/json" \
  -d @schedule.json -o schedule.csa

# .csa → 工程JSON
curl -X POST https://<worker>/api/v1/convert \
  -H "Authorization: Bearer cs_live_..." \
  -H "Content-Type: application/zip" \
  --data-binary @schedule.csa
```

CPM計算・ファイル形式はエディタ本体（`src/utils/admCpm.ts` / `src/utils/conScheFile.ts`）と同一コード。

## 利用状況の確認（管理用クエリ）

読み出しAPIは公開しない方針のため、管理者は wrangler 経由で参照する。

```bash
# 誰がどれだけ叩いているか（当月・ポイント順）
npx wrangler d1 execute con-sche-api --remote --command "
  SELECT c.company, c.email, u.count AS points
  FROM usage u JOIN api_keys k ON u.key_id=k.id JOIN customers c ON k.customer_id=c.id
  WHERE u.month = strftime('%Y-%m','now') ORDER BY u.count DESC"

# 直近のリクエスト明細
npx wrangler d1 execute con-sche-api --remote --command "
  SELECT c.email, l.endpoint, l.status, l.units, l.created_at
  FROM usage_logs l JOIN api_keys k ON l.key_id=k.id JOIN customers c ON k.customer_id=c.id
  ORDER BY l.created_at DESC LIMIT 50"

# 登録者一覧（論理削除済みを除く）
npx wrangler d1 execute con-sche-api --remote --command "
  SELECT company, name, email, created_at FROM customers WHERE deleted_at IS NULL ORDER BY created_at DESC"

# 登録者の論理削除（APIキーも同時に停止する。2文セットで実行すること）
npx wrangler d1 execute con-sche-api --remote --command "
  UPDATE api_keys SET status='suspended' WHERE customer_id = (SELECT id FROM customers WHERE email='対象メール');
  UPDATE customers SET deleted_at = datetime('now') WHERE email='対象メール'"
# 注意: 論理削除してもemailのUNIQUE制約は残るため、同じメールでの再登録は409になる（意図的。復活はdeleted_atをNULLに戻す+キーをactiveに）

# 未対応のお問い合わせ
npx wrangler d1 execute con-sche-api --remote --command "
  SELECT company, name, email, topics, created_at FROM contacts ORDER BY created_at DESC"
```

## デプロイ手順

```bash
cd workers/api
npm install

# D1データベース作成（初回のみ）
npx wrangler d1 create con-sche-api
# → 出力された database_id を wrangler.toml に転記

# スキーマ適用
npx wrangler d1 execute con-sche-api --file=schema.sql --remote

# 本番のCORSオリジンを設定（wrangler.toml の ALLOWED_ORIGIN を本番ドメインに変更）

# デプロイ
npx wrangler deploy
```

## ローカル開発

```bash
npx wrangler d1 execute con-sche-api --file=schema.sql --local
npx wrangler dev   # http://localhost:8787
```

フロント側（vite dev server）は `/api` を `http://localhost:8787` にプロキシする設定になっているため、
`npm run dev`（リポジトリルート）と `wrangler dev` を並行起動すれば動作確認できる。

## データ方針

- APIコードは**SHA-256ハッシュのみ**保存（平文は発行レスポンス1回だけ）
- Stripe秘密鍵等のシークレットはD1に置かない（有償化時は Workers Secrets を使用）
- 個人情報の読み出し用エンドポイントは作らない（`/api/v1/usage` は自キーの集計値のみ）
- 有償化時は `customers.stripe_customer_id` に Stripe顧客IDを紐づけ、`api_keys.plan` をWebhookで更新する
