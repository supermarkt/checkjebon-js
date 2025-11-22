const assert = require('assert');
const { getPricesForProductsAtMultipleSupermarkets, getSupermarkets } = require('../checkjebon');

describe('getPricesForProductsAtMultipleSupermarkets', function () {
  this.timeout(10000); // Allow time for network/cache

  const testProducts = [
    '1 liter halfvolle melk',
    '250 gram roomboter',
    '6 eieren',
    '1 kilo bananen',
    '400 gram shoarma',
    'pita brood',
    '500 ml soep'
  ];

  it('should return an object with totalCost and supermarkets array', async () => {
    const selectedStores = ["ah", "dirk", "jumbo"];
    const result = await getPricesForProductsAtMultipleSupermarkets(testProducts, 2, selectedStores);
    
    assert(typeof result === 'object', 'Result should be an object');
    assert(typeof result.totalCost === 'number', 'totalCost should be a number');
    assert(Array.isArray(result.supermarkets), 'supermarkets should be an array');
  });

  it('should respect the maxSupermarketVisitCount limit', async () => {
    const selectedStores = ["ah", "dirk", "jumbo", "vomar", "lidl"];
    const maxVisits = 2;
    const result = await getPricesForProductsAtMultipleSupermarkets(testProducts, maxVisits, selectedStores);
    
    assert(result.supermarkets.length <= maxVisits, `Should visit at most ${maxVisits} supermarkets`);
  });

  it('should only return selected supermarkets', async () => {
    const selectedStores = ["ah", "jumbo"];
    const result = await getPricesForProductsAtMultipleSupermarkets(testProducts, 3, selectedStores);
    
    for (const store of result.supermarkets) {
      assert(selectedStores.includes(store.code), `Store ${store.code} should be in selected stores`);
    }
  });

  it('should assign each product to at most one supermarket', async () => {
    const selectedStores = ["ah", "dirk", "jumbo"];
    const result = await getPricesForProductsAtMultipleSupermarkets(testProducts, 2, selectedStores);
    
    const assignedProducts = new Set();
    for (const store of result.supermarkets) {
      for (const product of store.products) {
        const key = product.originalQuery || product.name;
        assert(!assignedProducts.has(key), `Product ${key} should only be assigned once`);
        assignedProducts.add(key);
      }
    }
  });

  it('should throw error if no matching supermarkets found', async () => {
    const selectedStores = ["nonexistent"];
    try {
      await getPricesForProductsAtMultipleSupermarkets(testProducts, 2, selectedStores);
      assert.fail('Should have thrown an error');
    } catch (e) {
      assert(e.message.includes('No matching supermarkets'), 'Error message should mention no matching supermarkets');
    }
  });

  it('should return all products across selected supermarkets', async () => {
    const selectedStores = ["ah", "dirk", "jumbo"];
    const result = await getPricesForProductsAtMultipleSupermarkets(testProducts, 3, selectedStores);
    
    const totalProducts = result.supermarkets.reduce((sum, store) => sum + store.products.length, 0);
    assert(totalProducts > 0, 'Should assign at least one product to a supermarket');
  });

  it('should include product details in the result', async () => {
    const selectedStores = ["ah", "jumbo"];
    const result = await getPricesForProductsAtMultipleSupermarkets(testProducts, 2, selectedStores);
    
    for (const store of result.supermarkets) {
      assert(typeof store.code === 'string', 'Store should have code');
      assert(typeof store.name === 'string', 'Store should have name');
      assert(Array.isArray(store.products), 'Store should have products array');
      
      for (const product of store.products) {
        assert(product.name !== undefined, 'Product should have name');
        assert(typeof product.price === 'number', 'Product should have numeric price');
        assert(product.originalQuery !== undefined, 'Product should have originalQuery');
      }
    }
  });

  it('should work with maxSupermarketVisitCount of 1', async () => {
    const selectedStores = ["ah", "dirk", "jumbo"];
    const result = await getPricesForProductsAtMultipleSupermarkets(testProducts, 1, selectedStores);
    
    assert.strictEqual(result.supermarkets.length, 1, 'Should visit exactly 1 supermarket');
    assert(result.totalCost > 0, 'Should have a positive total cost');
  });
});

describe('getSupermarkets', function () {
  this.timeout(10000);

  it('should return an array of supermarkets', async () => {
    const supermarkets = await getSupermarkets();
    assert(Array.isArray(supermarkets), 'Should return an array');
    assert(supermarkets.length > 0, 'Should return at least one supermarket');
  });

  it('should return supermarkets with code, name, and icon properties', async () => {
    const supermarkets = await getSupermarkets();
    for (const supermarket of supermarkets) {
      assert(typeof supermarket.code === 'string', 'code should be a string');
      assert(typeof supermarket.name === 'string', 'name should be a string');
      assert(supermarket.icon === null || typeof supermarket.icon === 'string', 'icon should be null or string');
    }
  });

  it('should return unique supermarket codes', async () => {
    const supermarkets = await getSupermarkets();
    const codes = supermarkets.map(s => s.code);
    const uniqueCodes = new Set(codes);
    assert.strictEqual(codes.length, uniqueCodes.size, 'All supermarket codes should be unique');
  });

  it('should return non-empty supermarket names', async () => {
    const supermarkets = await getSupermarkets();
    for (const supermarket of supermarkets) {
      assert(supermarket.name.length > 0, 'Supermarket name should not be empty');
      assert(supermarket.code.length > 0, 'Supermarket code should not be empty');
    }
  });
});
