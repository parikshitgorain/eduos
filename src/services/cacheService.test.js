/**
 * Cache Service Tests
 * 
 * Task: 4.4.4 - Setup performance optimization and caching
 * 
 * Tests caching functionality for:
 * - Schema snapshots
 * - Hierarchy lookups
 * - Domain mappings
 * - Cache invalidation
 * - Cache statistics
 */

const cacheService = require('./cacheService');
const { redis } = require('../config/redis');
const { query } = require('../config/database');

// Mock dependencies
jest.mock('../config/redis');
jest.mock('../config/database');

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheService.resetCacheStats();
  });

  describe('getOrSet', () => {
    test('should return cached value on cache hit', async () => {
      const key = 'test:key';
      const cachedData = { id: '123', name: 'Test' };
      
      redis.get.mockResolvedValue(JSON.stringify(cachedData));
      
      const fallback = jest.fn();
      const result = await cacheService.getOrSet(key, fallback, 300);
      
      expect(result).toEqual(cachedData);
      expect(fallback).not.toHaveBeenCalled();
      expect(redis.get).toHaveBeenCalledWith(key);
      
      const stats = cacheService.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    test('should fetch from fallback on cache miss', async () => {
      const key = 'test:key';
      const freshData = { id: '456', name: 'Fresh' };
      
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');
      
      const fallback = jest.fn().mockResolvedValue(freshData);
      const result = await cacheService.getOrSet(key, fallback, 300);
      
      expect(result).toEqual(freshData);
      expect(fallback).toHaveBeenCalled();
      expect(redis.setex).toHaveBeenCalledWith(key, 300, JSON.stringify(freshData));
      
      const stats = cacheService.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
    });

    test('should handle cache errors gracefully', async () => {
      const key = 'test:key';
      const freshData = { id: '789', name: 'Error Recovery' };
      
      redis.get.mockRejectedValue(new Error('Redis connection failed'));
      
      const fallback = jest.fn().mockResolvedValue(freshData);
      const result = await cacheService.getOrSet(key, fallback, 300);
      
      expect(result).toEqual(freshData);
      expect(fallback).toHaveBeenCalled();
      
      const stats = cacheService.getCacheStats();
      expect(stats.errors).toBe(1);
    });

    test('should not cache null or undefined values', async () => {
      const key = 'test:key';
      
      redis.get.mockResolvedValue(null);
      
      const fallback = jest.fn().mockResolvedValue(null);
      const result = await cacheService.getOrSet(key, fallback, 300);
      
      expect(result).toBeNull();
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });

  describe('Schema Caching', () => {
    test('should cache schema snapshot', async () => {
      const snapshotId = 'snapshot-123';
      const snapshot = {
        id: snapshotId,
        version: '1.0.0',
        schema: { fields: [] },
      };
      
      redis.setex.mockResolvedValue('OK');
      
      await cacheService.cacheSchemaSnapshot(snapshotId, snapshot);
      
      expect(redis.setex).toHaveBeenCalledWith(
        `schema:snapshot:${snapshotId}`,
        3600,
        JSON.stringify(snapshot)
      );
    });

    test('should get schema snapshot from cache', async () => {
      const snapshotId = 'snapshot-456';
      const snapshot = {
        id: snapshotId,
        version: '2.0.0',
        schema: { fields: [] },
      };
      
      redis.get.mockResolvedValue(JSON.stringify(snapshot));
      
      const result = await cacheService.getSchemaSnapshot(snapshotId);
      
      expect(result).toEqual(snapshot);
      expect(query).not.toHaveBeenCalled();
    });

    test('should fetch schema snapshot from database on cache miss', async () => {
      const snapshotId = 'snapshot-789';
      const snapshot = {
        id: snapshotId,
        version: '3.0.0',
        schema: { fields: [] },
      };
      
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');
      query.mockResolvedValue({ rows: [snapshot] });
      
      const result = await cacheService.getSchemaSnapshot(snapshotId);
      
      expect(result).toEqual(snapshot);
      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM schema_snapshots WHERE id = $1',
        [snapshotId]
      );
      expect(redis.setex).toHaveBeenCalled();
    });

    test('should get active schema for tenant', async () => {
      const tenantId = 'tenant-123';
      const entityType = 'student';
      const schema = {
        id: 'schema-123',
        tenant_id: tenantId,
        entity_type: entityType,
        is_active: true,
      };
      
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');
      query.mockResolvedValue({ rows: [schema] });
      
      const result = await cacheService.getActiveSchema(tenantId, entityType);
      
      expect(result).toEqual(schema);
      expect(query).toHaveBeenCalled();
    });

    test('should invalidate schema cache for tenant', async () => {
      const tenantId = 'tenant-456';
      const entityType = 'teacher';
      
      redis.del.mockResolvedValue(1);
      
      await cacheService.invalidateSchemaCache(tenantId, entityType);
      
      expect(redis.del).toHaveBeenCalledWith(`schema:active:${tenantId}:${entityType}`);
    });

    test('should invalidate all schemas for tenant', async () => {
      const tenantId = 'tenant-789';
      
      redis.keys.mockResolvedValue([
        `schema:active:${tenantId}:student`,
        `schema:active:${tenantId}:teacher`,
      ]);
      redis.del.mockResolvedValue(2);
      
      await cacheService.invalidateSchemaCache(tenantId);
      
      expect(redis.keys).toHaveBeenCalledWith(`schema:active:${tenantId}:*`);
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('Hierarchy Caching', () => {
    test('should get hierarchy node from cache', async () => {
      const nodeId = 'node-123';
      const node = {
        id: nodeId,
        name: 'Test Node',
        parent_id: null,
        level: 0,
      };
      
      redis.get.mockResolvedValue(JSON.stringify(node));
      
      const result = await cacheService.getHierarchyNode(nodeId);
      
      expect(result).toEqual(node);
      expect(query).not.toHaveBeenCalled();
    });

    test('should get hierarchy children from database on cache miss', async () => {
      const parentId = 'parent-123';
      const tenantId = 'tenant-123';
      const children = [
        { id: 'child-1', name: 'Child 1', parent_id: parentId },
        { id: 'child-2', name: 'Child 2', parent_id: parentId },
      ];
      
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');
      query.mockResolvedValue({ rows: children });
      
      const result = await cacheService.getHierarchyChildren(parentId, tenantId);
      
      expect(result).toEqual(children);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE parent_id = $1 AND tenant_id = $2'),
        [parentId, tenantId]
      );
    });

    test('should get hierarchy ancestors', async () => {
      const nodeId = 'node-123';
      const ancestors = [
        { id: 'root', name: 'Root', level: 0 },
        { id: 'parent', name: 'Parent', level: 1 },
        { id: nodeId, name: 'Current', level: 2 },
      ];
      
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');
      query.mockResolvedValue({ rows: ancestors });
      
      const result = await cacheService.getHierarchyAncestors(nodeId);
      
      expect(result).toEqual(ancestors);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE ancestors'),
        [nodeId]
      );
    });

    test('should invalidate hierarchy cache', async () => {
      const nodeId = 'node-123';
      const tenantId = 'tenant-123';
      
      redis.del.mockResolvedValue(1);
      query.mockResolvedValue({ rows: [{ parent_id: 'parent-123' }] });
      
      await cacheService.invalidateHierarchyCache(nodeId, tenantId);
      
      expect(redis.del).toHaveBeenCalledWith(`hierarchy:node:${nodeId}`);
      expect(redis.del).toHaveBeenCalledWith(`hierarchy:children:${tenantId}:${nodeId}`);
      expect(redis.del).toHaveBeenCalledWith(`hierarchy:ancestors:${nodeId}`);
    });
  });

  describe('Domain Caching', () => {
    test('should get domain mapping from cache', async () => {
      const domain = 'school.example.com';
      const mapping = {
        tenant_id: 'tenant-123',
        domain,
        is_verified: true,
        is_primary: true,
      };
      
      redis.get.mockResolvedValue(JSON.stringify(mapping));
      
      const result = await cacheService.getDomainMapping(domain);
      
      expect(result).toEqual(mapping);
      expect(query).not.toHaveBeenCalled();
    });

    test('should fetch domain mapping from database on cache miss', async () => {
      const domain = 'school2.example.com';
      const mapping = {
        tenant_id: 'tenant-456',
        domain,
        is_verified: true,
        is_primary: false,
      };
      
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');
      query.mockResolvedValue({ rows: [mapping] });
      
      const result = await cacheService.getDomainMapping(domain);
      
      expect(result).toEqual(mapping);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE domain = $1 AND is_verified = true'),
        [domain]
      );
    });

    test('should invalidate domain cache', async () => {
      const domain = 'school3.example.com';
      
      redis.del.mockResolvedValue(1);
      
      await cacheService.invalidateDomainCache(domain);
      
      expect(redis.del).toHaveBeenCalledWith(`domain:mapping:${domain}`);
    });
  });

  describe('Cache Management', () => {
    test('should warm cache for tenant', async () => {
      const tenantId = 'tenant-123';
      
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');
      query.mockResolvedValue({ rows: [] });
      
      await cacheService.warmCache(tenantId);
      
      // Should attempt to cache active schemas
      expect(query).toHaveBeenCalled();
    });

    test('should clear all cache for tenant', async () => {
      const tenantId = 'tenant-123';
      
      redis.keys.mockResolvedValue([
        `schema:active:${tenantId}:student`,
        `hierarchy:children:${tenantId}:node1`,
      ]);
      redis.del.mockResolvedValue(2);
      
      await cacheService.clearTenantCache(tenantId);
      
      expect(redis.keys).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('Cache Statistics', () => {
    test('should track cache hits and misses', async () => {
      redis.get.mockResolvedValueOnce(JSON.stringify({ data: 'cached' }));
      redis.get.mockResolvedValueOnce(null);
      redis.setex.mockResolvedValue('OK');
      
      const fallback = jest.fn().mockResolvedValue({ data: 'fresh' });
      
      await cacheService.getOrSet('key1', fallback, 300);
      await cacheService.getOrSet('key2', fallback, 300);
      
      const stats = cacheService.getCacheStats();
      
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.total).toBe(2);
      expect(stats.hitRate).toBe('50.00%');
    });

    test('should calculate hit rate correctly', () => {
      const stats = cacheService.getCacheStats();
      
      expect(stats.hitRate).toBe('0.00%');
      expect(stats.total).toBe(0);
    });

    test('should reset cache statistics', () => {
      cacheService.resetCacheStats();
      
      const stats = cacheService.getCacheStats();
      
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate cache key with prefix', () => {
      const key = cacheService.getCacheKey('test:', 'identifier');
      
      expect(key).toBe('test:identifier');
    });
  });
});
