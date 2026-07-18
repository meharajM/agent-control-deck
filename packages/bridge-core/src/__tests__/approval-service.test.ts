import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '@agent-deck/bridge-database';
import { ApprovalService } from '../approval-service.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const migrationsDir = join(__dirname, '../../../../db/migrations');

const BASE_APPROVAL = {
  id: 'apr-001',
  sessionId: 'sess-001',
  runtimeApprovalId: 'rt-apr-001',
  category: 'file_write',
  risk: 'medium',
  reversible: 'yes',
  title: 'Write file',
  summary: 'Agent wants to write src/index.ts',
  decisions: ['approve', 'reject'],
} as const;

describe('ApprovalService', () => {
  let db: Database;
  let svc: ApprovalService;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.runMigrations(migrationsDir);
    db.db.pragma('foreign_keys = OFF');
    svc = new ApprovalService(db.db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates an approval in pending state at version 1', () => {
    svc.create(BASE_APPROVAL);
    const a = svc.get(BASE_APPROVAL.id);
    expect(a).toBeDefined();
    expect(a?.state).toBe('pending');
    expect(a?.version).toBe(1);
  });

  it('resolve with correct version returns resolved', () => {
    svc.create(BASE_APPROVAL);
    const result = svc.resolve(BASE_APPROVAL.id, 'approved', 'device-001', 1);
    expect(result).toBe('resolved');
    const a = svc.get(BASE_APPROVAL.id);
    expect(a?.state).toBe('approved');
    expect(a?.version).toBe(2);
    expect(a?.resolvedByDeviceId).toBe('device-001');
  });

  it('resolve with wrong version returns conflict', () => {
    svc.create(BASE_APPROVAL);
    const result = svc.resolve(BASE_APPROVAL.id, 'approved', 'device-001', 99);
    expect(result).toBe('conflict');
  });

  it('returns not_found for unknown id', () => {
    expect(svc.resolve('no-such', 'approved', 'device-001', 1)).toBe('not_found');
  });

  it('concurrent resolve: only one wins (compare-and-set)', () => {
    svc.create(BASE_APPROVAL);
    // Simulate two concurrent resolves at same expected version
    const r1 = svc.resolve(BASE_APPROVAL.id, 'approved', 'device-001', 1);
    const r2 = svc.resolve(BASE_APPROVAL.id, 'rejected', 'device-002', 1);
    expect(r1).toBe('resolved');
    expect(r2).toBe('conflict'); // version already incremented to 2
    const a = svc.get(BASE_APPROVAL.id);
    expect(a?.state).toBe('approved'); // first decision wins
  });

  it('getPending returns only pending approvals for session', () => {
    svc.create(BASE_APPROVAL);
    svc.create({ ...BASE_APPROVAL, id: 'apr-002', runtimeApprovalId: 'rt-002' });
    // Resolve one
    svc.resolve('apr-002', 'approved', 'device-001', 1);
    const pending = svc.getPending(BASE_APPROVAL.sessionId);
    expect(pending.length).toBe(1);
    expect(pending[0]?.id).toBe(BASE_APPROVAL.id);
  });
});
