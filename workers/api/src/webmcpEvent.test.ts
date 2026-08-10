/**
 * WebMCPツール利用イベント記録の仕様テスト
 *
 * 仕様:
 * - POST /api/webmcp-event で「誰が・どのツールを・いつ」だけを記録する（工程表データは受け取らない）
 * - tool はコンスケが公開するWebMCPツール名のホワイトリストのみ受け付ける:
 *   - ホワイトリスト外 → 'invalid_tool'（記録しない）
 * - customerId は X-Consche-Id ヘッダー（UUID形式）。無い場合は匿名（null）として記録する:
 *   - UUID形式 → その customerId で記録 'ok'
 *   - 空・未指定 → 匿名で記録 'ok'（登録前ユーザーも観測する）
 *   - UUID形式でない非空文字列 → 'invalid_customer'（なりすまし/ゴミデータを弾く）
 * - 記録行は buildWebmcpLogRow で組み立てる（id自動生成、created_at付与、ip記録）
 */
import { describe, it, expect } from 'vitest';
import {
  WEBMCP_TOOL_NAMES,
  validateWebmcpEvent,
  buildWebmcpLogRow,
} from './webmcpEvent';

const CUSTOMER_ID = '12345678-1234-1234-1234-123456789abc';
const NOW = '2026-08-07T02:00:00.000Z';

describe('WEBMCP_TOOL_NAMES', () => {
  it('コンスケが公開する7ツールを網羅している', () => {
    expect([...WEBMCP_TOOL_NAMES].sort()).toEqual(
      [
        'get_schedule',
        'get_activity',
        'shift_activity',
        'update_activity_duration',
        'validate_schedule',
        'get_activities_on_date',
        'find_activities',
      ].sort()
    );
  });
});

describe('validateWebmcpEvent', () => {
  it('ホワイトリストのツール + UUID customerId は ok', () => {
    expect(validateWebmcpEvent('get_schedule', CUSTOMER_ID)).toBe('ok');
  });

  it('customerId が空（匿名）でも ok', () => {
    expect(validateWebmcpEvent('shift_activity', '')).toBe('ok');
  });

  it('ホワイトリスト外のツール名は invalid_tool', () => {
    expect(validateWebmcpEvent('drop_tables', CUSTOMER_ID)).toBe('invalid_tool');
  });

  it('ツール名が空は invalid_tool', () => {
    expect(validateWebmcpEvent('', CUSTOMER_ID)).toBe('invalid_tool');
  });

  it('UUID形式でない非空 customerId は invalid_customer', () => {
    expect(validateWebmcpEvent('get_schedule', 'not-a-uuid')).toBe('invalid_customer');
  });
});

describe('buildWebmcpLogRow', () => {
  it('customerId あり: そのIDで行を組み立てる', () => {
    const row = buildWebmcpLogRow('get_schedule', CUSTOMER_ID, '203.0.113.1', NOW);
    expect(row.customer_id).toBe(CUSTOMER_ID);
    expect(row.tool).toBe('get_schedule');
    expect(row.ip).toBe('203.0.113.1');
    expect(row.created_at).toBe(NOW);
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('customerId 空（匿名）は customer_id が null になる', () => {
    const row = buildWebmcpLogRow('find_activities', '', 'unknown', NOW);
    expect(row.customer_id).toBeNull();
  });

  it('呼ぶたびに一意の id が振られる', () => {
    const a = buildWebmcpLogRow('get_schedule', '', 'unknown', NOW);
    const b = buildWebmcpLogRow('get_schedule', '', 'unknown', NOW);
    expect(a.id).not.toBe(b.id);
  });
});
