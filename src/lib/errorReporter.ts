/**
 * ブラウザ側で起きたエラーをサーバーに知らせる
 *
 * 「エラーが出ます」という問い合わせだけが届いて、何が起きたのか誰にも分からない、
 * という状態をなくすための仕組み。ユーザーに操作を求めず、起きたことだけを送る。
 *
 * 送るのはエラーメッセージ・スタック・ページURL・UA・ビルド・Service Workerの状態まで。
 * 工程表の中身は一切送らない（データは端末内にとどめる、という方針を崩さない）。
 *
 * 報告そのものが事故になってはいけないので、
 * - 同じエラーは1セッションに1回だけ
 * - 1セッションの送信上限を設ける
 * - 送信失敗は黙って諦める（エラー報告でエラーを出さない）
 */

import { ANON_KEY, REGISTRATION_KEY } from '@/activePing';

/** エラーを拾った経路。サーバー側 CLIENT_ERROR_SOURCES と対応する
 *  （'boot' は index.html の見張り役が直接送るので、ここには現れない） */
export type ReportSource = 'window.onerror' | 'unhandledrejection' | 'react' | 'fetch' | 'manual';

/** 1セッションあたりの送信上限。エラーループに陥った端末が送り続けるのを止める */
export const MAX_REPORTS_PER_SESSION = 20;

/** 実害がなく件数だけ膨らむ既知のノイズ */
const IGNORED_PATTERNS = [/ResizeObserver loop/i];

export interface ReportState {
  sent: Set<string>;
  count: number;
}

export function createReportState(): ReportState {
  return { sent: new Set<string>(), count: 0 };
}

export interface DescribedError {
  message: string;
  stack: string;
}

/** 投げられたものが何であれ message と stack を取り出す */
export function describeError(input: unknown): DescribedError {
  let message = '';
  let stack = '';

  if (input instanceof Error) {
    message = input.message;
    stack = input.stack ?? '';
  } else if (typeof input === 'string') {
    message = input;
  } else if (input && typeof input === 'object') {
    const obj = input as { message?: unknown; stack?: unknown };
    if (typeof obj.message === 'string') message = obj.message;
    if (typeof obj.stack === 'string') stack = obj.stack;
  }

  message = message.trim();
  // 空のままだとサーバーが missing_message で捨ててしまい、件数すら残らない
  return { message: message || 'Unknown error', stack };
}

export function isIgnorable(message: string): boolean {
  return IGNORED_PATTERNS.some((re) => re.test(message));
}

/** 同じエラーの連投と、1セッションの総量を抑える */
export function shouldReport(key: string, state: ReportState): boolean {
  if (state.sent.has(key)) return false;
  if (state.count >= MAX_REPORTS_PER_SESSION) return false;
  state.sent.add(key);
  state.count += 1;
  return true;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Service Workerの状態。旧SW × 新デプロイの食い違いを切り分けるために送る */
function swState(): string {
  try {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const c = navigator.serviceWorker.controller;
    if (!c) return 'none';
    return c.state || 'unknown';
  } catch {
    return 'unknown';
  }
}

function identityHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const raw = readStorage(REGISTRATION_KEY);
    const state = raw ? (JSON.parse(raw) as { customerId?: string }) : null;
    if (state?.customerId) headers['X-Consche-Id'] = state.customerId;
  } catch {
    // 身元が分からなくても件数は残したいので、そのまま送る
  }
  const anonId = readStorage(ANON_KEY);
  if (anonId) headers['X-Consche-Anon'] = anonId;
  return headers;
}

const state = createReportState();

/**
 * エラーを1件送る。例外は投げない。
 * apiBase は installErrorReporter で受け取ったものを使う。
 */
export function reportError(input: unknown, source: ReportSource, apiBase: string): void {
  try {
    const { message, stack } = describeError(input);
    if (isIgnorable(message)) return;
    if (!shouldReport(`${source}|${message}`, state)) return;

    const body = JSON.stringify({
      message,
      stack,
      source,
      pageUrl: location.href,
      userAgent: navigator.userAgent,
      appVersion: __APP_BUILD__,
      swState: swState(),
    });

    // keepalive: ページ遷移やタブを閉じる途中でも送り切る
    void fetch(`${apiBase}/api/client-error`, {
      method: 'POST',
      headers: identityHeaders(),
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // エラー報告でエラーを出さない
  }
}

let installed = false;

/** window のエラーと未処理のPromise拒否を購読する。多重登録はしない */
export function installErrorReporter(apiBase: string): void {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    reportError(event.error ?? event.message, 'window.onerror', apiBase);
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportError(event.reason, 'unhandledrejection', apiBase);
  });
}
