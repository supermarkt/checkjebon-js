const assert = require('assert');
const { getPricesForProducts } = require('../checkjebon');

describe('getPricesForProducts', function () {
  this.timeout(10000); // Allow time for network/cache

  const testProducts = [
    '1 liter halfvolle melk',
    '250 gram roomboter',
    '6 eieren'
  ];

  it('should return one row per product for each supermarket', async () => {
    const results = await getPricesForProducts(testProducts);
    assert(Array.isArray(results), 'Results should be an array');
    assert(results.length > 0, 'Should return at least one supermarket');
    for (const supermarket of results) {
      assert(Array.isArray(supermarket.products), 'Supermarket should have products array');
      assert.strictEqual(supermarket.products.length, testProducts.length, 'Each supermarket should return one row per product');
    }
  });

  it('should set originalQuery to the supplied item for each product', async () => {
    const results = await getPricesForProducts(testProducts);
    for (const supermarket of results) {
      for (let i = 0; i < testProducts.length; i++) {
        const product = supermarket.products[i];
        assert.strictEqual(product.originalQuery, testProducts[i], 'originalQuery should match the supplied item');
      }
    }
  });

  it('should have at least one supermarket with a price for each product', async () => {
    const results = await getPricesForProducts(testProducts);
    for (let i = 0; i < testProducts.length; i++) {
      const supermarketsWithPrice = results.filter(sup => {
        const product = sup.products[i];
        return typeof product.price === 'number' && !product.isEstimate;
      });
      assert(
        supermarketsWithPrice.length > 0,
        `At least one supermarket should have a price for product: ${testProducts[i]}`
      );
    }
  });
});
