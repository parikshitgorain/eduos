/**
 * Tests for Tenant Search Endpoint
 * 
 * Tests the new tenant search functionality
 */

const request = require('supertest');
const express = require('express');
const tenantRoutes = require('./tenants');
const { getClient } = require('../config/database');

// Mock dependencies
jest.mock('../config/database');
jest.mock('../services/tenantService');

const app = express();
app.use(express.json());
app.use('/api/v1/tenants', tenantRoutes);

describe('GET /api/v1/tenants/search', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    getClient.mockResolvedValue(mockClient);
  });

  it('should return empty array for query less than 2 characters', async () => {
    const response = await request(app)
      .get('/api/v1/tenants/search')
      .query({ q: 'a' });

    expect(response.status).toBe(200);
    expect(response.body.tenants).toEqual([]);
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it('should return empty array for empty query', async () => {
    const response = await request(app)
      .get('/api/v1/tenants/search')
      .query({ q: '' });

    expect(response.status).toBe(200);
    expect(response.body.tenants).toEqual([]);
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it('should return empty array for whitespace-only query', async () => {
    const response = await request(app)
      .get('/api/v1/tenants/search')
      .query({ q: '   ' });

    expect(response.status).toBe(200);
    expect(response.body.tenants).toEqual([]);
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it('should search tenants by name', async () => {
    const mockTenants = [
      {
        id: 'tenant-1',
        name: 'Harvard University',
        location: 'Cambridge, MA',
        logoUrl: 'https://example.com/harvard.png',
        contactInfo: { email: 'info@harvard.edu', phone: '123-456-7890' }
      },
      {
        id: 'tenant-2',
        name: 'Stanford University',
        location: 'Stanford, CA',
        logoUrl: 'https://example.com/stanford.png',
        contactInfo: { email: 'info@stanford.edu' }
      }
    ];

    mockClient.query.mockResolvedValue({ rows: mockTenants });

    const response = await request(app)
      .get('/api/v1/tenants/search')
      .query({ q: 'University' });

    expect(response.status).toBe(200);
    expect(response.body.tenants).toEqual(mockTenants);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      ['%University%']
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should search tenants by location', async () => {
    const mockTenants = [
      {
        id: 'tenant-3',
        name: 'MIT',
        location: 'Cambridge, MA',
        logoUrl: null,
        contactInfo: null
      }
    ];

    mockClient.query.mockResolvedValue({ rows: mockTenants });

    const response = await request(app)
      .get('/api/v1/tenants/search')
      .query({ q: 'Cambridge' });

    expect(response.status).toBe(200);
    expect(response.body.tenants).toEqual(mockTenants);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      ['%Cambridge%']
    );
  });

  it('should trim whitespace from query', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    await request(app)
      .get('/api/v1/tenants/search')
      .query({ q: '  University  ' });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.any(String),
      ['%University%']
    );
  });

  it('should only return active tenants', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    await request(app)
      .get('/api/v1/tenants/search')
      .query({ q: 'School' });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'active'"),
      expect.any(Array)
    );
  });

  it('should limit results to 20 tenants', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    await request(app)
      .get('/api/v1/tenants/search')
      .query({ q: 'School' });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 20'),
      expect.any(Array)
    );
  });

  it('should order results by name', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    await request(app)
      .get('/api/v1/tenants/search')
      .query({ q: 'School' });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY name'),
      expect.any(Array)
    );
  });

  it('should handle database errors gracefully', async () => {
    mockClient.query.mockRejectedValue(new Error('Database connection failed'));

    const response = await request(app)
      .get('/api/v1/tenants/search')
      .query({ q: 'University' });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Failed to search tenants');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should handle special characters in search query', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });

    await request(app)
      .get('/api/v1/tenants/search')
      .query({ q: "St. Mary's" });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.any(String),
      ["%St. Mary's%"]
    );
  });
});
