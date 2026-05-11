const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db');

jest.mock('../src/db', () => ({
  query: jest.fn()
}));

describe('GET /products', () => {
  it('should return products list', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          name: 'Guide Docker',
          description: 'Support pédagogique',
          price_cents: 1900,
          stock: 20
        }
      ]
    });

    const response = await request(app).get('/products');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Guide Docker');
  });
});

describe('POST /products', () => {
  it('should create a valid product', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 5,
          name: 'Nouveau produit',
          description: 'Description test',
          price_cents: 1000,
          stock: 0
        }
      ]
    });

    const response = await request(app)
      .post('/products')
      .send({ name: 'Nouveau produit', description: 'Description test', price_cents: 1000 });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Nouveau produit');
  });

  it('should reject a product with missing fields', async () => {
    const response = await request(app)
      .post('/products')
      .send({ name: 'Produit sans prix' });

    expect(response.status).toBe(400);
  });
});
