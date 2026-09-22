/**
 * index.html に直書きしている起動監視の判定テスト。
 *
 * この見張り役はバンドルの外（HTMLの中）にいるので、本体が死んでいても動く代わりに
 * 通常のimportでは触れない。そこで index.html を読み、マーカーで囲った判定関数だけを
 * 取り出して評価する。コピーではなく実際に配信されるコードを検証するための作り。
 *
 * 仕様（2026-09-20 ゆたか指示で修正）:
 * - 自サイトから配られているJS/CSSが落ちたときだけ「起動に必要なファイルが読めなかった」とみなす
 * - 計測ビーコンなど外部配信のファイルは落ちてもアプリは動くので無視する
 *   （2026-09-19、Cloudflare Insightsのビーコンが広告ブロッカー等で落ちただけの利用者に
 *     キャッシュ全削除とリロードを走らせ、復旧案内まで見せてしまった）
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(resolve(HERE, '../../index.html'), 'utf8');

/** index.html のマーカー間を取り出して関数にする */
function loadIsAppAsset(): (url: string, origin: string) => boolean {
  const m = HTML.match(/\/\* isAppAsset:start \*\/([\s\S]*?)\/\* isAppAsset:end \*\//);
  if (!m) throw new Error('index.html に isAppAsset のマーカーが見つからない');
  // eslint-disable-next-line no-new-func
  return new Function(`${m[1]}; return isAppAsset;`)() as (url: string, origin: string) => boolean;
}

const ORIGIN = 'https://con-sche.tatelog.biz';

describe('起動監視が「起動に必要なファイル」とみなす範囲', () => {
  const isAppAsset = loadIsAppAsset();

  it('自サイトのJSは起動に必要なファイルとして扱う', () => {
    expect(isAppAsset(`${ORIGIN}/assets/index-Cr4uWhnx.js`, ORIGIN)).toBe(true);
  });

  it('自サイトのCSSも起動に必要なファイルとして扱う', () => {
    expect(isAppAsset(`${ORIGIN}/assets/index-abc123.css`, ORIGIN)).toBe(true);
  });

  it('Cloudflareのアクセス解析ビーコンは無視する', () => {
    const url = 'https://static.cloudflareinsights.com/beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495';
    expect(isAppAsset(url, ORIGIN)).toBe(false);
  });

  it('Google Tag Manager も無視する', () => {
    expect(isAppAsset('https://www.googletagmanager.com/gtag/js?id=G-XXXX', ORIGIN)).toBe(false);
  });

  it('自サイトのドメインを先頭に含むだけの別ドメインは自サイト扱いしない', () => {
    expect(isAppAsset('https://con-sche.tatelog.biz.example.com/assets/x.js', ORIGIN)).toBe(false);
  });

  it('URLが取れなかった場合は対象外', () => {
    expect(isAppAsset('', ORIGIN)).toBe(false);
  });

  it('オリジンそのもの（配下のファイルではない）は対象外', () => {
    expect(isAppAsset(ORIGIN, ORIGIN)).toBe(false);
  });
});

describe('index.html の見張り役の組み立て', () => {
  it('名指しの除外リストではなく isAppAsset で判定している', () => {
    // 除外リスト方式だと新しい配信元が増えるたびに漏れる（2026-09-19の誤検知の原因）
    expect(HTML).toContain('isAppAsset(url, location.origin)');
    expect(HTML).not.toContain("url.indexOf('googletagmanager')");
  });
});

/** index.html のマーカー間を取り出して関数にする（isAppAsset と同じやり方） */
function loadBootDecision() {
  const m = HTML.match(/\/\* bootDecision:start \*\/([\s\S]*?)\/\* bootDecision:end \*\//);
  if (!m) throw new Error('index.html に bootDecision のマーカーが見つからない');
  // eslint-disable-next-line no-new-func
  return new Function(`${m[1]}; return bootDecision;`)() as (
    elapsedMs: number, hasContent: boolean, slowMs: number, giveUpMs: number,
  ) => string;
}

/**
 * 起動が遅いときの振る舞い（2026-09-22 ゆたか指示）
 *
 * コンスケは作業所・現場監督が使う。電波の薄い場所で開くことがあるので、
 * 「時間内に出ない＝壊れている」とみなしてはいけない。秒数をいくつにしても
 * 真面目に読み込んでいる人を切ることになる。
 * だから遅いときはキャッシュを消さず、待ってもらう。消すかどうかは利用者が決める。
 */
describe('起動が遅いときにどうするか', () => {
  const decide = loadBootDecision();
  const SLOW = 8000;
  const GIVEUP = 30000;

  it('画面が出ていれば、時間に関係なく起動できたと見る', () => {
    expect(decide(0, true, SLOW, GIVEUP)).toBe('ok');
    expect(decide(999999, true, SLOW, GIVEUP)).toBe('ok');
  });

  it('最初のうちは黙って待つ', () => {
    expect(decide(0, false, SLOW, GIVEUP)).toBe('wait');
    expect(decide(SLOW - 1, false, SLOW, GIVEUP)).toBe('wait');
  });

  it('しばらく出なければ読み込み中を知らせる', () => {
    expect(decide(SLOW, false, SLOW, GIVEUP)).toBe('loading');
    expect(decide(GIVEUP - 1, false, SLOW, GIVEUP)).toBe('loading');
  });

  it('それでも出なければ案内に切り替える', () => {
    expect(decide(GIVEUP, false, SLOW, GIVEUP)).toBe('giveup');
    expect(decide(GIVEUP * 10, false, SLOW, GIVEUP)).toBe('giveup');
  });
});

describe('遅いだけの利用者からキャッシュを奪わない', () => {
  it('遅いときの見張りは、キャッシュに手を出さない', () => {
    // 電波が細い現場でキャッシュを捨てると、また6.9MBの読み直しになる。
    // PWAとして「2回目以降はキャッシュから動く」利点も自分で壊してしまう。
    const watch = HTML.slice(HTML.indexOf('var watch = setInterval'));
    const body = watch.slice(0, watch.indexOf('}, 500);'));
    expect(body).not.toContain('cleanup(');
    expect(body).not.toContain('location.reload');
  });

  it('キャッシュを消すのは、ファイルが取れなかったときと、利用者がボタンを押したときだけ', () => {
    const autoReload = HTML.match(/cleanup\(function \(\) \{ location\.reload\(\); \}\)/g) || [];
    expect(autoReload).toHaveLength(2); // recover（404を拾ったとき）と、案内画面のボタン
  });

  it('時間切れの経路は、案内を出すだけで復旧を始めない', () => {
    const giveup = HTML.slice(HTML.indexOf("=== 'giveup'"));
    expect(giveup).toContain('showFailureNotice()');
    expect(giveup.slice(0, giveup.indexOf('}'))).not.toContain('cleanup(');
  });

  it('読み込み中の表示は root の外に出す', () => {
    // root に描くと「画面が出た」と誤認して、起動判定が狂う
    expect(HTML).toContain("document.body.appendChild");
    expect(HTML).toContain("consche-loading");
  });
});
