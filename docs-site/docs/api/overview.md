---
sidebar_position: 1
---

# 連携APIの概要

:::tip プログラミングに詳しくない方へ
チャット画面だけで使える最短手順を [はじめてのAI連携（かんたん版）](./easy-start) にまとめています。まずはそちらからどうぞ。
:::

Con-Sche の工程データは、API を通じてプログラムや AI エージェントから操作できます。
「工程表を人が描くためのアプリ」であると同時に、「工程データを AI に渡して活用するためのプラットフォーム」であることが Con-Sche の設計思想です。

## できること

| エンドポイント | 消費pt | 内容 |
|---|---|---|
| `POST /api/v1/cpm` | 2pt | 工程データから CPM 計算（最早/最遅・フロート・クリティカルパス・日付） |
| `POST /api/v1/convert` | 2pt | 工程JSON ⇔ .csa ファイルの相互変換 |
| `GET /api/v1/usage` | 0pt | 当月の利用量照会 |

ベースURL: `https://con-sche-api.ishikawa-yutaka.workers.dev`

## OpenAPI 仕様書

機械可読な API 仕様書（OpenAPI 3.1）を公開しています。
ChatGPT の GPTs / Actions、Claude、各種 AI エージェントやコード生成ツールにこのファイルを渡すと、API の呼び出し方を自動で理解します。

**[openapi.yaml をダウンロード](/openapi.yaml)**

## APIコードの取得

エディタの利用者登録時に発行される APIコード（`cs_live_...`）をそのまま使います。
リクエストの `Authorization` ヘッダに Bearer トークンとして指定してください。

```bash
curl https://con-sche-api.ishikawa-yutaka.workers.dev/api/v1/usage \
  -H "Authorization: Bearer cs_live_あなたのAPIコード"
```

APIコードは登録時に **1回だけ** 表示されます。紛失した場合はお問い合わせください。

## 料金（従量ポイント）

- 読み取り系 = **2pt** / 更新系 = **3pt**
- 無料枠 = **月90pt**（読み取り45回相当）
- 課金されるのは成功レスポンス（2xx）のみ。エラーは消費しません
- 現在の消費量はレスポンスヘッダ `X-ConSche-Usage` と `GET /api/v1/usage` で確認できます
- 上限の引き上げはアプリ内のお問い合わせからご相談ください

## データモデル（ADM形式）

Con-Sche はアローダイアグラム（ADM）方式のネットワーク工程表です。API でもこの構造をそのまま扱います。

- **node（結合点）** — 作業の始点・終点となるイベント。`id` のみ必須
- **activity（作業）** — 2つの結合点を結ぶ矢線。`fromNodeId` から `toNodeId` へ `duration`（稼働日数）かけて進みます
- **依存関係** — 結合点の共有で表現します。作業Aの `toNodeId` と作業Bの `fromNodeId` が同じなら、BはAの後続です
- **ダミー作業** — `duration: 0` の作業。日数を持たない依存関係を表します

```json
{
  "nodes": [{ "id": "n1" }, { "id": "n2" }, { "id": "n3" }],
  "activities": [
    { "id": "A", "name": "基礎工事", "fromNodeId": "n1", "toNodeId": "n2", "duration": 4 },
    { "id": "B", "name": "躯体工事", "fromNodeId": "n2", "toNodeId": "n3", "duration": 5 }
  ],
  "calendar": { "startDate": "2026-08-17", "workDays": [1, 2, 3, 4, 5, 6] }
}
```

`calendar` を渡すと、稼働日ベースの計算結果がカレンダー日付（YYYY-MM-DD）に変換されて返ります。
休日は `holidays` で個別指定でき、`status: "workday"` で休日出勤日も表現できます。

具体的な活用例は [AI連携レシピ集](./ai-recipes) をご覧ください。
