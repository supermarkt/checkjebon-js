const { getPricesForProducts, getCheckjebonLink } = require('./checkjebon');

const products = [
  "1,5 liter halfvolle melk",
  "Knoflooksaus",
  "400 g shoarma",
  "Pita brood",
  "Kipschnitzel",
  "250 gram kipfilet",
  "1 kilo bananen",
  "1 liter coca cola",
  "kokosbrood",
  "500 ml soep",
  "halvarine"
];

(async () => {
  const results = await getPricesForProducts(products);
  for (const supermarket of results) {
    const total = supermarket.products.reduce((sum, p) => sum + (typeof p.price === 'number' ? p.price : 0), 0);
    console.log(`\n${supermarket.name} (${supermarket.code})${supermarket.icon ? ' [' + supermarket.icon + ']' : ''} - €${total.toFixed(2)}`);
    console.table(
      supermarket.products.map(p => ({
        Product: p.isEstimate ? p.originalQuery : p.name,
        Amount: p.amount || '',
        Price: typeof p.price === 'number' ? `€${p.price.toFixed(2)}` : '',
        Link: p.isEstimate ? '' : p.link || ''
      }))
    );
  }

  // Example: generate a Checkjebon.nl link for the shopping list
  const shoppingList = products.join('\n');
  const url = getCheckjebonLink(shoppingList);
  console.log(`\nOpen on Checkjebon: ${url}`);

})();