const assert = require('assert');
const { getCheckjebonLink } = require('../checkjebon');

describe('getCheckjebonLink', () => {
  it('should generate the correct link for a single item', () => {
    const shoppingList = '1 liter halfvolle melk';
    const expected = 'https://www.checkjebon.nl/#1%20liter%20halfvolle%20melk';
    const url = getCheckjebonLink(shoppingList);
    assert.strictEqual(url, expected);
  });

  it('should generate the correct link for three items', () => {
    const shoppingList = '1 liter halfvolle melk\ntarwebrood\n6 eieren';
    const expected = 'https://www.checkjebon.nl/#1%20liter%20halfvolle%20melk%0Atarwebrood%0A6%20eieren';
    const url = getCheckjebonLink(shoppingList);
    assert.strictEqual(url, expected);
  });

  it('should generate the correct link for four items', () => {
    const shoppingList = '1 liter halfvolle melk\n1 tarwebrood\n6 eieren\n250 gram roomboter';
    const expected = 'https://www.checkjebon.nl/#1%20liter%20halfvolle%20melk%0A1%20tarwebrood%0A6%20eieren%0A250%20gram%20roomboter';
    const url = getCheckjebonLink(shoppingList);
    assert.strictEqual(url, expected);
  });
});

// Run with: npm test
