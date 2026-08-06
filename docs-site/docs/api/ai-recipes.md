---
sidebar_position: 2
---

# AI連携レシピ集

ChatGPT・Claude・Gemini などの AI エージェントに Con-Sche の工程データを操作させるための実践レシピです。
どのレシピも [OpenAPI 仕様書](/openapi.yaml) を AI に渡すところから始めると、呼び出し方を間違えにくくなります。

## レシピ1: 工程の遅延・短縮を全体に反映する（一括シフト）

**「躯体工事が3日遅れた。工程表全体を直したい」** — 現場で最もよくあるケースです。

Con-Sche は CPM（クリティカルパス法）で日付を計算しているため、遅延した作業の日数を変えて再計算するだけで、後続工程の日付がすべて自動でシフトされます。

### 手順

1. `.csa` ファイルを工程JSONに変換する

```bash
curl -X POST https://con-sche-api.ishikawa-yutaka.workers.dev/api/v1/convert \
  -H "Authorization: Bearer cs_live_..." \
  -H "Content-Type: application/zip" \
  --data-binary @工程表.csa
```

2. 遅延した作業の `duration` を増やす（3日遅延なら 5 → 8）

3. CPM を再計算する

```bash
curl -X POST https://con-sche-api.ishikawa-yutaka.workers.dev/api/v1/cpm \
  -H "Authorization: Bearer cs_live_..." \
  -H "Content-Type: application/json" \
  -d '{ "nodes": [...], "activities": [（durationを更新した工程データ）], "calendar": {...} }'
```

4. 必要なら `POST /api/v1/convert`（Content-Type: application/json）で `.csa` に戻してエディタで開く

### 実行例

躯体工事を5日→8日にして再計算した場合:

| 作業 | 変更前 | 変更後 |
|---|---|---|
| 基礎工事 | 8/17〜8/20 | 8/17〜8/20（変更なし） |
| 躯体工事 | 8/21〜8/26 | 8/21〜8/29 |
| 内装工事 | 8/27〜9/2 | **8/31〜9/5 に自動シフト** |
| 仕上げ工事 | 9/3〜9/5 | **9/7〜9/9 に自動シフト** |
| 外構工事（並行） | 8/21〜8/26 | 変更なし（フロート内のため） |

単純に全作業を一律で後ろにずらすのではなく、**動かす必要のある作業だけ**が動きます。
余裕（フロート)のある並行作業は影響を受けず、クリティカルパスの変化も同時に返ります。

### AIへの指示例

> この工程表（.csaファイル添付）で躯体工事が3日遅延した。
> Con-Sche API（仕様書: openapi.yaml）を使って、
> 1. ファイルを工程JSONに変換
> 2. 躯体工事のdurationを+3
> 3. CPM再計算して全作業の新しい日付とクリティカルパスを表にして
> 4. シフト済みの.csaファイルを出力して

## レシピ2: 工期短縮の検討（どこを縮めれば効くか）

クリティカルパス上にない作業を短縮しても工期は縮まりません。
CPM 結果の `isCritical` と `totalFloat` を見れば、**どの作業の短縮が全体工期に効くか**を AI に分析させることができます。

### AIへの指示例

> この工程データをCPM計算して、
> 1. クリティカルパス上の作業を列挙
> 2. それぞれ1日短縮した場合の全体工期を再計算で比較
> 3. 最も費用対効果が高そうな短縮ポイントを提案して

## レシピ3: テキストから工程表を起こす

工程がまだ Excel やメモ書きの段階でも、AI に ADM 構造への変換を任せて `.csa` ファイルを生成できます。

### AIへの指示例

> 次の工程メモをCon-ScheのADM形式（nodes + activities）に変換して、
> convert APIで.csaファイルにして。起点日は2026-09-01、稼働日は月〜土。
>
> ・準備工 3日 → 掘削 5日 → 基礎 10日 → 埋戻し 2日
> ・基礎のあと並行で: 外部足場 2日、設備スリーブ 3日

## レシピ4: 定期的な工程チェックの自動化

`convert`（.csa→JSON）と `cpm` を組み合わせると、「毎朝、最新の工程表の完了予定日とクリティカルパスをチャットに通知する」といった自動化も作れます。
無料枠は月90pt（cpm+convert のセットで1日1回 = 月約120pt）なので、毎日実行する場合は上限引き上げをご相談ください。

## ChatGPT / Claude への組み込み方

- **ChatGPT（GPTs / Actions）** — GPTエディタの「Actions」に [openapi.yaml](/openapi.yaml) の内容を貼り付け、認証方式に「API Key（Bearer）」を選んで APIコードを設定
- **Claude（Claude Code / Desktop）** — openapi.yaml をプロジェクトに置いて「この仕様書に従ってCon-Sche APIを呼んで」と指示。curl でもフェッチでも呼び出せます
- **自作スクリプト** — 仕様書を OpenAPI Generator にかければ各言語のクライアントコードを生成できます

:::tip APIコードの扱い
APIコード（`cs_live_...`）はパスワードと同じ扱いで。AI チャットの公開共有リンクやリポジトリに残さないようご注意ください。
:::
