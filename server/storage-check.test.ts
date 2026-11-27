import { describe, expect, it } from 'vitest';
import { storageWarnings } from './storage-check';

describe('storageWarnings', () => {
  it('is quiet outside Railway with a file database', () => {
    expect(storageWarnings({ SALUT_DATA_DIR: '/data' })).toEqual([]);
  });

  it('flags a Railway service without a volume', () => {
    expect(storageWarnings({ RAILWAY_ENVIRONMENT_NAME: 'production', SALUT_DATA_DIR: '/data' })).toEqual(['railway_volume_missing']);
  });

  it('accepts the database inside the mounted volume', () => {
    expect(storageWarnings({ RAILWAY_PROJECT_ID: 'p', RAILWAY_VOLUME_MOUNT_PATH: '/data', SALUT_DATA_DIR: '/data' })).toEqual([]);
    expect(storageWarnings({ RAILWAY_PROJECT_ID: 'p', RAILWAY_VOLUME_MOUNT_PATH: '/data/', SALUT_DB: '/data/sub/salut.db' })).toEqual([]);
  });

  it('flags a database outside the volume, including a sibling path with the same prefix', () => {
    expect(storageWarnings({ RAILWAY_PROJECT_ID: 'p', RAILWAY_VOLUME_MOUNT_PATH: '/data', SALUT_DATA_DIR: '/app/data' })).toEqual(['db_outside_railway_volume']);
    expect(storageWarnings({ RAILWAY_PROJECT_ID: 'p', RAILWAY_VOLUME_MOUNT_PATH: '/data', SALUT_DB: '/data2/salut.db' })).toEqual(['db_outside_railway_volume']);
  });

  it('flags an in-memory database only in production', () => {
    expect(storageWarnings({ SALUT_DB: ':memory:' })).toEqual([]);
    expect(storageWarnings({ SALUT_DB: ':memory:', NODE_ENV: 'production' })).toEqual(['db_in_memory']);
  });
});
