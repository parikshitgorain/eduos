/**
 * Input Validation Middleware Tests
 */

const express = require('express');
const request = require('supertest');
const {
  validate,
  uuidValidation,
  emailValidation,
  domainValidation,
  subdomainValidation,
  sanitizeString,
  integerValidation,
  booleanValidation,
  dateValidation,
  arrayValidation,
  jsonValidation,
  phoneValidation,
  urlValidation,
  searchQueryValidation
} = require('./inputValidation');

describe('Input Validation Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('validate middleware', () => {
    it('should pass validation when no errors', async () => {
      app.post('/test', 
        emailValidation('email'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 with validation errors', async () => {
      app.post('/test',
        emailValidation('email'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
    });
  });

  describe('uuidValidation', () => {
    it('should validate valid UUID in param', async () => {
      app.get('/test/:id',
        uuidValidation('id', 'param'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const validUuid = '123e4567-e89b-42d3-a456-426614174000';
      const response = await request(app).get(`/test/${validUuid}`);

      expect(response.status).toBe(200);
    });

    it('should reject invalid UUID', async () => {
      app.get('/test/:id',
        uuidValidation('id', 'param'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app).get('/test/invalid-uuid');

      expect(response.status).toBe(400);
    });

    it('should validate UUID in body', async () => {
      app.post('/test',
        uuidValidation('id', 'body'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ id: '123e4567-e89b-42d3-a456-426614174000' });

      expect(response.status).toBe(200);
    });

    it('should validate UUID in query', async () => {
      app.get('/test',
        uuidValidation('id', 'query'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .get('/test?id=123e4567-e89b-42d3-a456-426614174000');

      expect(response.status).toBe(200);
    });
  });

  describe('emailValidation', () => {
    it('should validate valid email', async () => {
      app.post('/test',
        emailValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ email: 'user@example.com' });

      expect(response.status).toBe(200);
    });

    it('should normalize email', async () => {
      app.post('/test',
        emailValidation(),
        validate,
        (req, res) => res.json({ email: req.body.email })
      );

      const response = await request(app)
        .post('/test')
        .send({ email: 'User@Example.COM' });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('user@example.com');
    });

    it('should reject invalid email', async () => {
      app.post('/test',
        emailValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('domainValidation', () => {
    it('should validate valid domain', async () => {
      app.post('/test',
        domainValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ domain: 'example.com' });

      expect(response.status).toBe(200);
    });

    it('should validate subdomain', async () => {
      app.post('/test',
        domainValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ domain: 'sub.example.com' });

      expect(response.status).toBe(200);
    });

    it('should reject invalid domain', async () => {
      app.post('/test',
        domainValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ domain: 'invalid_domain' });

      expect(response.status).toBe(400);
    });

    it('should reject domain that is too long', async () => {
      app.post('/test',
        domainValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const longDomain = 'a'.repeat(250) + '.com';
      const response = await request(app)
        .post('/test')
        .send({ domain: longDomain });

      expect(response.status).toBe(400);
    });
  });

  describe('subdomainValidation', () => {
    it('should validate valid subdomain', async () => {
      app.post('/test',
        subdomainValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ subdomain: 'my-school' });

      expect(response.status).toBe(200);
    });

    it('should reject subdomain with invalid characters', async () => {
      app.post('/test',
        subdomainValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ subdomain: 'my_school' });

      expect(response.status).toBe(400);
    });

    it('should reject subdomain that is too short', async () => {
      app.post('/test',
        subdomainValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ subdomain: 'ab' });

      expect(response.status).toBe(400);
    });

    it('should reject subdomain that is too long', async () => {
      app.post('/test',
        subdomainValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ subdomain: 'a'.repeat(64) });

      expect(response.status).toBe(400);
    });
  });

  describe('sanitizeString', () => {
    it('should sanitize and validate string', async () => {
      app.post('/test',
        sanitizeString('name'),
        validate,
        (req, res) => res.json({ name: req.body.name })
      );

      const response = await request(app)
        .post('/test')
        .send({ name: '  John Doe  ' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('John Doe');
    });

    it('should reject empty string when not allowed', async () => {
      app.post('/test',
        sanitizeString('name', { allowEmpty: false }),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ name: '' });

      expect(response.status).toBe(400);
    });

    it('should enforce min/max length', async () => {
      app.post('/test',
        sanitizeString('name', { minLength: 5, maxLength: 10 }),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ name: 'abc' });

      expect(response.status).toBe(400);
    });
  });

  describe('integerValidation', () => {
    it('should validate integer', async () => {
      app.post('/test',
        integerValidation('age'),
        validate,
        (req, res) => res.json({ age: req.body.age })
      );

      const response = await request(app)
        .post('/test')
        .send({ age: '25' });

      expect(response.status).toBe(200);
      expect(response.body.age).toBe(25);
    });

    it('should enforce min/max', async () => {
      app.post('/test',
        integerValidation('age', { min: 18, max: 100 }),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ age: 15 });

      expect(response.status).toBe(400);
    });

    it('should reject non-integer', async () => {
      app.post('/test',
        integerValidation('age'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ age: 'not-a-number' });

      expect(response.status).toBe(400);
    });
  });

  describe('booleanValidation', () => {
    it('should validate boolean', async () => {
      app.post('/test',
        booleanValidation('active'),
        validate,
        (req, res) => res.json({ active: req.body.active })
      );

      const response = await request(app)
        .post('/test')
        .send({ active: 'true' });

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(true);
    });

    it('should reject non-boolean', async () => {
      app.post('/test',
        booleanValidation('active'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ active: 'maybe' });

      expect(response.status).toBe(400);
    });
  });

  describe('dateValidation', () => {
    it('should validate ISO 8601 date', async () => {
      app.post('/test',
        dateValidation('birthdate'),
        validate,
        (req, res) => res.json({ birthdate: req.body.birthdate })
      );

      const response = await request(app)
        .post('/test')
        .send({ birthdate: '2000-01-01T00:00:00.000Z' });

      expect(response.status).toBe(200);
    });

    it('should reject invalid date', async () => {
      app.post('/test',
        dateValidation('birthdate'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ birthdate: 'not-a-date' });

      expect(response.status).toBe(400);
    });
  });

  describe('arrayValidation', () => {
    it('should validate array', async () => {
      app.post('/test',
        arrayValidation('items'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ items: [1, 2, 3] });

      expect(response.status).toBe(200);
    });

    it('should enforce min/max length', async () => {
      app.post('/test',
        arrayValidation('items', { minLength: 2, maxLength: 5 }),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ items: [1] });

      expect(response.status).toBe(400);
    });

    it('should reject non-array', async () => {
      app.post('/test',
        arrayValidation('items'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ items: 'not-an-array' });

      expect(response.status).toBe(400);
    });
  });

  describe('jsonValidation', () => {
    it('should validate JSON object', async () => {
      app.post('/test',
        jsonValidation('data'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ data: { key: 'value' } });

      expect(response.status).toBe(200);
    });

    it('should validate JSON string', async () => {
      app.post('/test',
        jsonValidation('data'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ data: '{"key":"value"}' });

      expect(response.status).toBe(200);
    });

    it('should reject invalid JSON', async () => {
      app.post('/test',
        jsonValidation('data'),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ data: 'not-json' });

      expect(response.status).toBe(400);
    });
  });

  describe('phoneValidation', () => {
    it('should validate E.164 phone number', async () => {
      app.post('/test',
        phoneValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ phone: '+12025551234' });

      expect(response.status).toBe(200);
    });

    it('should reject invalid phone number', async () => {
      app.post('/test',
        phoneValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ phone: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('urlValidation', () => {
    it('should validate valid URL', async () => {
      app.post('/test',
        urlValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ url: 'https://example.com' });

      expect(response.status).toBe(200);
    });

    it('should reject URL without protocol', async () => {
      app.post('/test',
        urlValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ url: 'example.com' });

      expect(response.status).toBe(400);
    });

    it('should reject invalid URL', async () => {
      app.post('/test',
        urlValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .post('/test')
        .send({ url: 'not-a-url' });

      expect(response.status).toBe(400);
    });
  });

  describe('searchQueryValidation', () => {
    it('should validate search query', async () => {
      app.get('/test',
        searchQueryValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .get('/test?q=search term');

      expect(response.status).toBe(200);
    });

    it('should reject query that is too long', async () => {
      app.get('/test',
        searchQueryValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .get('/test?q=' + 'a'.repeat(101));

      expect(response.status).toBe(400);
    });

    it('should reject query with invalid characters', async () => {
      app.get('/test',
        searchQueryValidation(),
        validate,
        (req, res) => res.json({ success: true })
      );

      const response = await request(app)
        .get('/test?q=search<script>');

      expect(response.status).toBe(400);
    });
  });
});
