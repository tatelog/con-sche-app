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
  ip TEXT
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
