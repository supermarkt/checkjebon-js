# Checkjebon.nl javascript library

Checkjebon.nl makes comparing food prices across multiple supermarkets easy. With this library, you can programmatically query supermarket prices, compare shopping lists, and analyze product data using the same algorithms as the Checkjebon.nl website.

## Features
- Compare prices for products across multiple supermarkets
- Fuzzy product search and best-match selection
- Support for generic and brand-specific queries
- Price estimation when no direct match is found

## How It Works
For each product in your shopping list, the library:
1. Attempts an exact match by name.
2. If no exact match, performs a fuzzy search (matches all letters in order, not necessarily adjacent).
3. Filters by amount (liter/kilogram) if specified.
4. Orders results by string match quality, then by price.
5. Returns the best match for each supermarket.
6. If no price is found, estimates based on averages from other supermarkets.

## Example Usage

```
const cjb = require('./checkjebon');

const shoppingList = [
  "1,5 liter halfvolle melk",
  "250 gram roomboter",
  "1 liter cola"
];

cjb.getPricesForProducts(shoppingList).then(result => {
  
  console.log(JSON.stringify(result, null, 2));

  const link = cjb.getCheckjebonLink(shoppingList);
  console.log(link);

});
```

## Running the Examples

There are two example files provided:

- `example.node.js`: Run this example in Node.js to see how to use the library programmatically.
- `example.browser.html`: Open this file in your web browser to see a browser-based example.

### Run the Node.js Example

```powershell
node example.node.js
```

### Open the Browser Example

Simply open `example.browser.html` in your web browser (double-click or right-click and choose "Open with" > your browser).

## Running Tests

This project uses [Mocha](https://mochajs.org/) for testing. To run the tests, use:

```powershell
node test
```

## Product Selection Algorithm
- Exact match by name
- Fuzzy search if no exact match
- Filter by amount if specified
- Order by string match quality, then price
- Return best match per supermarket

## Open Data
Product price data is updated frequently and can be reused in other projects (e.g., price alerts, trend analysis, data journalism).

## License
MIT

## More Information
Visit [Checkjebon.nl](https://www.checkjebon.nl/) for more details and to use the web interface.
