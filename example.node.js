const { getPricesForProducts, getPricesForProductsAtMultipleSupermarkets, getSupermarkets, getCheckjebonLink, pricesLastUpdated } = require('./checkjebon');

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

  // Show last updated info
  const lastUpdated = pricesLastUpdated && pricesLastUpdated();
  if (lastUpdated) {
    console.log(`\nLast update: ${new Date(lastUpdated).toLocaleString()}`);
  } else {
    console.log('\nLast update: unknown');
  }

  // Example: Multi-supermarket shopping optimizer
  console.log('\n\n========================================');
  console.log('MULTI-SUPERMARKET SHOPPING OPTIMIZER');
  console.log('========================================\n');
  
  const maxVisits = 3;
  const selectedStores = ["ah", "aldi", "dirk", "jumbo", "lidl", "vomar"];
  
  console.log(`Finding optimal combination of up to ${maxVisits} stores from: ${selectedStores.join(', ')}\n`);
  
  const optimal = await getPricesForProductsAtMultipleSupermarkets(products, maxVisits, selectedStores);
  
  console.log(`Total Cost: €${optimal.totalCost.toFixed(2)}`);
  console.log(`Stores to Visit: ${optimal.supermarkets.length}\n`);
  
  for (const store of optimal.supermarkets) {
    const storeTotal = store.products.reduce((sum, p) => sum + (typeof p.price === 'number' ? p.price : 0), 0);
    console.log(`\n${store.name} (${store.code})${store.icon ? ' [' + store.icon + ']' : ''} - €${storeTotal.toFixed(2)}`);
    console.table(
      store.products.map(p => ({
        Product: !p.isEstimate ? p.name : p.originalQuery + ' (geschat)',
        Amount: p.amount || '',
        Price: typeof p.price === 'number' ? `€${p.price.toFixed(2)}` : ''
      }))
    );
  }

})();