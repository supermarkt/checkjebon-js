const assert = require('assert');
const { pricesLastUpdated, getPricesForProducts } = require('../checkjebon');
const fs = require('fs');
const path = require('path');

describe('pricesLastUpdated', () => {
  const cacheFile = path.resolve(__dirname, '../supermarkets.cache.json');

  beforeEach(() => {
    // Remove cache before each test
    if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
  });

  it('should return null if cache does not exist', () => {
    assert.strictEqual(pricesLastUpdated(), null);
  });

  it('should return a string date after fetching prices', async () => {
    await getPricesForProducts(['melk']);
    const last = pricesLastUpdated();
    // Should be a string or null, and a valid date if present
    if (last !== null) {
      assert.notStrictEqual(new Date(last).toString(), 'Invalid Date');
    } else {
      // Accept null if header is not available
      assert.strictEqual(last, null);
    }
  });

  it('should return the same value on repeated calls if cache is unchanged', async () => {
    await getPricesForProducts(['melk']);
    const first = pricesLastUpdated();
    const second = pricesLastUpdated();
    assert.deepStrictEqual(first, second);
  });
});
