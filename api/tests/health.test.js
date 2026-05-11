const request = require('supertest');
const app = require('../src/app');

jest.mock('../src/db', () => ({
  query: jest.fn()
}));

describe('GET /health', () => {
  it('should return 200 with status ok', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('should include service, version, environment, timestamp and uptime', async () => {
    const response = await request(app).get('/health');

    expect(response.body.service).toBe('trainshop-api');
    expect(response.body.version).toBeDefined();
    expect(response.body.environment).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
    expect(typeof response.body.uptime).toBe('number');
  });
});
