/**
 * Mock Redis Client for Testing
 * 
 * Provides an in-memory implementation of Redis for testing without a real Redis server
 */

class MockRedis {
  constructor() {
    this.data = new Map();
    this.expirations = new Map();
    this.lists = new Map();
    this.sortedSets = new Map();
  }

  // String operations
  async get(key) {
    this._checkExpiration(key);
    return this.data.get(key) || null;
  }

  async set(key, value) {
    this.data.set(key, value);
    return 'OK';
  }

  async setex(key, seconds, value) {
    this.data.set(key, value);
    this.expirations.set(key, Date.now() + seconds * 1000);
    return 'OK';
  }

  async del(...keys) {
    let count = 0;
    for (const key of keys) {
      if (this.data.delete(key) || this.lists.delete(key) || this.sortedSets.delete(key)) {
        count++;
        this.expirations.delete(key);
      }
    }
    return count;
  }

  async expire(key, seconds) {
    if (this.data.has(key) || this.lists.has(key) || this.sortedSets.has(key)) {
      this.expirations.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key) {
    const expiration = this.expirations.get(key);
    if (!expiration) return -1;
    const remaining = Math.floor((expiration - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  // List operations
  async lpush(key, ...values) {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key);
    list.unshift(...values);
    return list.length;
  }

  async rpush(key, ...values) {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key);
    list.push(...values);
    return list.length;
  }

  async lrange(key, start, stop) {
    this._checkExpiration(key);
    const list = this.lists.get(key) || [];
    if (stop === -1) {
      return list.slice(start);
    }
    return list.slice(start, stop + 1);
  }

  async ltrim(key, start, stop) {
    const list = this.lists.get(key);
    if (!list) return 'OK';
    
    const trimmed = list.slice(start, stop + 1);
    this.lists.set(key, trimmed);
    return 'OK';
  }

  async llen(key) {
    this._checkExpiration(key);
    const list = this.lists.get(key);
    return list ? list.length : 0;
  }

  // Sorted set operations
  async zadd(key, ...args) {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, []);
    }
    const sortedSet = this.sortedSets.get(key);
    
    // Parse score-member pairs
    for (let i = 0; i < args.length; i += 2) {
      const score = args[i];
      const member = args[i + 1];
      
      // Remove existing member if present
      const existingIndex = sortedSet.findIndex(item => item.member === member);
      if (existingIndex !== -1) {
        sortedSet.splice(existingIndex, 1);
      }
      
      // Add new member
      sortedSet.push({ score, member });
    }
    
    // Sort by score
    sortedSet.sort((a, b) => a.score - b.score);
    
    return sortedSet.length;
  }

  async zrange(key, start, stop) {
    this._checkExpiration(key);
    const sortedSet = this.sortedSets.get(key) || [];
    const members = sortedSet.map(item => item.member);
    
    if (stop === -1) {
      return members.slice(start);
    }
    return members.slice(start, stop + 1);
  }

  async zrem(key, ...members) {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return 0;
    
    let removed = 0;
    for (const member of members) {
      const index = sortedSet.findIndex(item => item.member === member);
      if (index !== -1) {
        sortedSet.splice(index, 1);
        removed++;
      }
    }
    
    return removed;
  }

  async zcard(key) {
    this._checkExpiration(key);
    const sortedSet = this.sortedSets.get(key);
    return sortedSet ? sortedSet.length : 0;
  }

  // Utility operations
  async keys(pattern) {
    const allKeys = [
      ...this.data.keys(),
      ...this.lists.keys(),
      ...this.sortedSets.keys(),
    ];
    
    // Simple pattern matching (only supports * wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(key => regex.test(key));
  }

  async flushdb() {
    this.data.clear();
    this.expirations.clear();
    this.lists.clear();
    this.sortedSets.clear();
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }

  async quit() {
    return 'OK';
  }

  // Event emitter methods (no-op for mock)
  on() {}
  once() {}
  off() {}
  emit() {}

  // Helper method to check and remove expired keys
  _checkExpiration(key) {
    const expiration = this.expirations.get(key);
    if (expiration && Date.now() > expiration) {
      this.data.delete(key);
      this.lists.delete(key);
      this.sortedSets.delete(key);
      this.expirations.delete(key);
    }
  }
}

module.exports = MockRedis;
