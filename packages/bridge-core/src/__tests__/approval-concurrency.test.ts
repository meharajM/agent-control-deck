import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Database } from '@agent-deck/bridge-database';
import { ApprovalService } from '../approval-service.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const migrationsDir = join(__dirname, '../../../../db/migrations');

let db: Database;
let approvals: ApprovalService;

beforeEach(async () => {
  db = new Database(':memory:');
  await db.runMigrations(migrationsDir);
  db.db.pragma('foreign_keys = OFF');
  approvals = new ApprovalService(db.db);
});

afterEach(() => {
  db.close();
});

describe('ApprovalService: CAS concurrency', () => {
  it('two concurrent CAS attempts: only first wins', () => {
    approvals.create({
      id: 'apr-concurrent-1',
      sessionId: 'ses-1',
      runtimeApprovalId: 'apr-concurrent-1',
      category: 'file_write',
      risk: 'low',
      reversible: 'yes',
      title: 'Write file',
      summary: 'Test',
      decisions: ['approve', 'reject'],
    });

    const result1 = approvals.resolve('apr-concurrent-1', 'approved', 'device-a', 1);
    const result2 = approvals.resolve('apr-concurrent-1', 'approved', 'device-b', 1);

    expect(result1).toBe('resolved');
    expect(result2).toBe('conflict');
  });

  it('second CAS with correct version after first succeeds', () => {
    approvals.create({
      id: 'apr-concurrent-2',
      sessionId: 'ses-1',
      runtimeApprovalId: 'apr-concurrent-2',
      category: 'file_write',
      risk: 'low',
      reversible: 'yes',
      title: 'Write file',
      summary: 'Test',
      decisions: ['approve', 'reject'],
    });

    const result1 = approvals.resolve('apr-concurrent-2', 'approved', 'device-a', 1);
    expect(result1).toBe('resolved');

    const result2 = approvals.resolve('apr-concurrent-2', 'rejected', 'device-b', 2);
    expect(result2).toBe('resolved');
  });

  it('resolve on non-existent approval returns not_found', () => {
    const result = approvals.resolve('non-existent', 'approved', 'device-a', 1);
    expect(result).toBe('not_found');
  });

  it('version mismatch returns conflict', () => {
    approvals.create({
      id: 'apr-version-1',
      sessionId: 'ses-1',
      runtimeApprovalId: 'apr-version-1',
      category: 'file_write',
      risk: 'low',
      reversible: 'yes',
      title: 'Write file',
      summary: 'Test',
      decisions: ['approve', 'reject'],
    });

    const result = approvals.resolve('apr-version-1', 'approved', 'device-a', 999);
    expect(result).toBe('conflict');
  });

  it('approval tracks resolved device ID', () => {
    approvals.create({
      id: 'apr-device-1',
      sessionId: 'ses-1',
      runtimeApprovalId: 'apr-device-1',
      category: 'file_write',
      risk: 'low',
      reversible: 'yes',
      title: 'Write file',
      summary: 'Test',
      decisions: ['approve', 'reject'],
    });

    approvals.resolve('apr-device-1', 'approved', 'device-x', 1);
    const approval = approvals.get('apr-device-1');

    expect(approval).toBeDefined();
    expect(approval!.resolvedByDeviceId).toBe('device-x');
    expect(approval!.state).toBe('approved');
    expect(approval!.version).toBe(2);
  });

  it('getPending returns only pending approvals', () => {
    approvals.create({
      id: 'apr-pending-1',
      sessionId: 'ses-1',
      runtimeApprovalId: 'apr-pending-1',
      category: 'file_write',
      risk: 'low',
      reversible: 'yes',
      title: 'Write file',
      summary: 'Test',
      decisions: ['approve', 'reject'],
    });
    approvals.create({
      id: 'apr-resolved-1',
      sessionId: 'ses-1',
      runtimeApprovalId: 'apr-resolved-1',
      category: 'file_write',
      risk: 'low',
      reversible: 'yes',
      title: 'Write file 2',
      summary: 'Test 2',
      decisions: ['approve', 'reject'],
    });

    approvals.resolve('apr-resolved-1', 'approved', 'device-a', 1);

    const pending = approvals.getPending('ses-1');
    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe('apr-pending-1');
  });
});
