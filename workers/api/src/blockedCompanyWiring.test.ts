/**
 * ブロックの網が、ドメインを見る経路すべてに掛かっているかを見る。
 *
 * 会社名ブロックを入れたとき、登録の経路にだけ足して、お問い合わせの経路を
 * 忘れていた。登録は塞がれているのに問い合わせは素通りする状態で、
 * 読んで気付くまで分からなかった。空行の通り列を保存し忘れたのも同じ形で、
 * 「同じ規則を2箇所に書いて片方だけ直す」のがこのコードで繰り返している失敗。
 *
 * どちらか一方にしか無い状態を、人が読んで気付くのに任せない。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./index.ts', import.meta.url)), 'utf8');
const lines = source.split('\n');

/** 字下げ無しで始まる関数・オブジェクトの定義行を、経路の切れ目として扱う */
function routeBoundaries(): { name: string; start: number; end: number }[] {
  const starts: { name: string; start: number }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(?:export default|(?:async )?function (\w+)|const (\w+) = async)/);
    if (m) starts.push({ name: m[1] ?? m[2] ?? 'default export', start: i });
  });
  return starts.map((s, i) => ({
    name: s.name,
    start: s.start,
    end: i + 1 < starts.length ? starts[i + 1].start : lines.length,
  }));
}

/** blocked_domains を参照している経路の名前 */
function routesCheckingDomains(): string[] {
  return routeBoundaries()
    .filter((r) => lines.slice(r.start, r.end).some((l) => l.includes('blocked_domains')))
    .map((r) => r.name);
}

/** blocked_companies を参照している経路の名前 */
function routesCheckingCompanies(): string[] {
  return routeBoundaries()
    .filter((r) => lines.slice(r.start, r.end).some((l) => l.includes('matchBlockedCompany(')))
    .map((r) => r.name);
}

describe('登録不可リストの網', () => {
  it('ドメインを照合している経路が見つかる', () => {
    // 検出が壊れて0件になると、次の検査が無条件に通ってしまう
    expect(routesCheckingDomains().length).toBeGreaterThan(0);
  });

  it('ドメインを照合している経路は、会社名も照合している', () => {
    const withCompany = routesCheckingCompanies();
    const missing = routesCheckingDomains().filter((name) => !withCompany.includes(name));
    expect(missing).toEqual([]);
  });
});
