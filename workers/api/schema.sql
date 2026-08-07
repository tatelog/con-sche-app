-- Con-Sche 利用者登録・APIキー台帳
-- 平文のAPIキーは保存しない（SHA-256ハッシュのみ）。
-- stripe_customer_id は有償化時に紐づける（それまでは NULL）。

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL,
  ip TEXT,
  deleted_at TEXT,  -- 論理削除（NULL=有効）。削除時はapi_keysもstatus='suspended'にすること
  opt_out_at TEXT  -- 案内メール配信停止の申し出日時（NULL=配信可。宛先抽出時にWHERE除外）
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  key_hash TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

-- APIキーごとの月間利用量（ポイント集計。上限判定に使う）
-- count の単位: 読み取り系=2pt / 更新系=3pt、無料枠=月90pt（更新30回相当）
CREATE TABLE IF NOT EXISTS usage (
  key_id TEXT NOT NULL REFERENCES api_keys(id),
  month TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key_id, month)
);

-- 連携APIの全リクエストログ（誰が・いつ・何を・何pt消費したか）
CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES api_keys(id),
  endpoint TEXT NOT NULL,
  status INTEGER NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  created_at TEXT NOT NULL
);

-- 登録を受け付けないメールドメイン（運営が管理。サブドメインも一致する）
-- 追加: INSERT INTO blocked_domains (domain, note, created_at) VALUES ('example.com', '理由メモ', datetime('now'));
-- 削除: DELETE FROM blocked_domains WHERE domain = 'example.com';
CREATE TABLE IF NOT EXISTS blocked_domains (
  domain TEXT PRIMARY KEY,
  note TEXT,
  created_at TEXT NOT NULL
);

-- メール確認待ちの登録（RESEND_API_KEY設定時のみ使用。確認完了で customers へ移行）
CREATE TABLE IF NOT EXISTS pending_registrations (
  token TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_pending_email ON pending_registrations(email);

-- LPのお問い合わせフォームの受け皿
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  position TEXT,
  department TEXT,
  role TEXT,
  topics TEXT,
  contact_method TEXT,
  message TEXT,
  created_at TEXT NOT NULL,
  ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_api_keys_customer ON api_keys(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_key ON usage_logs(key_id, created_at);

-- 接続コード再発行のワンタイムトークン（24時間有効・1回きり）
-- 発行: POST /api/admin/reissue（管理者） / 引き換え: POST /api/reissue/redeem（公開）
CREATE TABLE IF NOT EXISTS reissue_tokens (
  token TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_reissue_customer ON reissue_tokens(customer_id);

-- アプリ内「お知らせ」の配信元（投稿はwrangler d1 executeのINSERTで行う）
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at);

-- WebMCPツール利用ログ（誰が・どのツールを・いつ。工程表データは持たない）
-- 記録: POST /api/webmcp-event（フロント src/webmcp/ のツール実行時）
-- 将来の有料課金時は customer_id × 月 で集計して課金判定に使う
CREATE TABLE IF NOT EXISTS webmcp_logs (
  id TEXT PRIMARY KEY,
  customer_id TEXT,  -- customers.id（未登録・匿名は NULL）
  tool TEXT NOT NULL,
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webmcp_logs_customer ON webmcp_logs(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_webmcp_logs_created ON webmcp_logs(created_at);
