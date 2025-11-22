// Environment detection
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

const SUPERMARKETS_URL = 'https://www.checkjebon.nl/data/supermarkets.json';



/**
 * Get a list of all available supermarkets with their code, name, and icon.
 * @returns {Promise<Array<{code: string, name: string, icon: string|null}>>} Array of supermarkets with code, name, and icon
 */
async function getSupermarkets() {
  const supermarkets = await getSupermarketsJson();
  return supermarkets.map(s => ({
    code: s.n,
    name: s.c,
    icon: s.i || null
  }));
}

/**
 * Get verbose price info for a list of product names.
 * Falls back to average price with isEstimate: true if not found at a supermarket.
 * Rounds all prices to two decimals.
 * Downloads supermarkets.json from checkjebon.nl and caches for 1 hour.
 * @param {string[]} productNames
 * @returns {Promise<Array>} Array of supermarkets with found products and their verbose info
 */
async function getPricesForProducts(productNames) {
  const supermarkets = await getSupermarketsJson();

  // For each product, precompute prices across all supermarkets for fallback
  const allProductMatches = productNames.map(name =>
    supermarkets.map(s => findProduct(s.d, name))
  );

  return supermarkets.map((supermarket, supermarketIndex) => {
    const baseUrl = supermarket.u || '';
    const foundProducts = productNames.map((name, prodIdx) => {
      const match = findProduct(supermarket.d, name);
      if (match) {
        return {
          name: match.n,
          link: match.l ? baseUrl + match.l : null,
          price: roundPrice(match.p),
          amount: match.s,
          isEstimate: false,
          originalQuery: name
        };
      } else {
        // Fallback: average price across other supermarkets
        let priceSum = 0;
        let priceCount = 0;
        allProductMatches[prodIdx].forEach((other, i) => {
          if (i !== supermarketIndex && other) {
            priceSum += other.p;
            priceCount++;
          }
        });
        return {
          name: null,
          link: null,
          price: priceCount > 0 ? roundPrice(priceSum / priceCount) : null,
          amount: null,
          isEstimate: priceCount > 0,
          originalQuery: name
        };
      }
    });
    return {
      code: supermarket.n,
      icon: supermarket.i || null,
      name: supermarket.c,
      totalProducts: supermarket.d?.length || 0,
      products: foundProducts
    };
  });
}

/**
 * Returns a Checkjebon.nl link for a given shopping list string.
 * @param {string} shoppingList - The shopping list (one item per line)
 * @returns {string} The URL to open on Checkjebon.nl with the list as hash
 */
function getCheckjebonLink(shoppingList) {
  if (Array.isArray(shoppingList)) {
    shoppingList = shoppingList.join('\n');
  }
  // Encode spaces as %20, slashes as %2F, and line breaks as %0A; leave commas and other characters as-is to ensure browsers handles them correctly
  return 'https://www.checkjebon.nl/#' + shoppingList
    .replace(/ /g, '%20')
    .replace(/\//g, '%2F')
    .replace(/\r\n|\n|\r/g, '%0A');
}

/**
 * 
 * @returns {Date|null} The last modified date of the prices cache, or null if not available
 */
function pricesLastUpdated() {
  let lastModified = null;
  if (isNode) {
    try {
      const fs = require('fs');
      if (fs.existsSync(CACHE_KEY)) {
        const raw = fs.readFileSync(CACHE_KEY, 'utf-8');
        const parsed = JSON.parse(raw);
        lastModified = parsed.lastModified || null;
      }
    } catch (e) {}
  } else if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        lastModified = parsed.lastModified || null;
      }
    } catch (e) {}
  }
  return lastModified;
}

/**
 * Get an optimal shopping plan by finding the best combination of supermarkets to minimize total cost.
 * Uses an exhaustive search to evaluate all possible combinations within the maximum store limit.
 * @param {string[]} productNames - List of products to buy
 * @param {number} maxSupermarketVisitCount - Maximum number of supermarkets to visit
 * @param {string[]} selectedSupermarketCodes - Array of supermarket codes to choose from
 * @returns {Promise<{totalCost: number, supermarkets: Array<{code: string, name: string, icon: string|null, products: Array}>}>} Object with totalCost and array of selected supermarkets with their assigned products
 */
async function getOptimalShoppingPlan(productNames, maxSupermarketVisitCount, selectedSupermarketCodes) {
  // Get prices for all products at all supermarkets
  const allPrices = await getPricesForProducts(productNames);
  
  // Filter to only selected supermarkets
  const selectedSupermarkets = allPrices.filter(s => 
    selectedSupermarketCodes.includes(s.code)
  );
  
  if (selectedSupermarkets.length === 0) {
    throw new Error('No matching supermarkets found from selectedSupermarketCodes');
  }
  
  // Build a matrix of prices: products x supermarkets
  // For each product, track which supermarket has the best price
  const productCount = productNames.length;
  const supermarketCount = selectedSupermarkets.length;
  
  // Helper function to check if a product has a valid, non-estimated price
  const isValidPrice = (product) => {
    return product && !product.isEstimate && typeof product.price === 'number';
  };
  
  // Create price matrix: priceMatrix[productIndex][supermarketIndex] = price (or null)
  const priceMatrix = [];
  for (let p = 0; p < productCount; p++) {
    priceMatrix[p] = [];
    for (let s = 0; s < supermarketCount; s++) {
      const product = selectedSupermarkets[s].products[p];
      priceMatrix[p][s] = product.price;
    }
  }
  
  // Find optimal assignment using a greedy approach:
  // Iteratively select supermarkets that provide the most products at their cheapest price,
  // minimizing total cost while respecting the maximum number of stores constraint.
  
  const bestCombination = findBestSupermarketCombination(
    priceMatrix, 
    selectedSupermarkets, 
    productNames,
    maxSupermarketVisitCount
  );
  
  return bestCombination;
}

/**
 * Find the best combination of supermarkets using an exhaustive search
 * @param {Array<Array<number|null>>} priceMatrix - Matrix of prices [product][supermarket]
 * @param {Array} supermarkets - Array of supermarket objects
 * @param {string[]} productNames - Product names
 * @param {number} maxStores - Maximum number of stores to visit
 * @returns {Object} Best combination with totalCost and supermarkets
 */
function findBestSupermarketCombination(priceMatrix, supermarkets, productNames, maxStores) {
  const productCount = productNames.length;
  const supermarketCount = supermarkets.length;
  const supermarketIndices = Array.from({ length: supermarketCount }, (_, i) => i);

  let bestSolution = {
    totalCost: Infinity,
    coveredCount: -1,
    supermarkets: [],
    assignments: []
  };

  // Helper to generate combinations
  function getCombinations(arr, k) {
    const results = [];
    function helper(start, combo) {
      if (combo.length === k) {
        results.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        helper(i + 1, combo);
        combo.pop();
      }
    }
    helper(0, []);
    return results;
  }

  // Iterate over combination sizes from 1 to maxStores
  for (let k = 1; k <= maxStores; k++) {
    const combinations = getCombinations(supermarketIndices, k);
    for (const combination of combinations) {
      let currentCost = 0;
      let currentCoveredCount = 0;
      const currentAssignments = new Array(productCount).fill(-1);

      for (let p = 0; p < productCount; p++) {
        let minPrice = Infinity;
        let bestStore = -1;

        for (const s of combination) {
          const price = priceMatrix[p][s];
          if (price !== null && price < minPrice) {
            minPrice = price;
            bestStore = s;
          }
        }

        if (bestStore !== -1) {
          currentCost += minPrice;
          currentAssignments[p] = bestStore;
          currentCoveredCount++;
        } else {
          // Not found in this combination.
          // Assign to first store in combination just to have it somewhere
          currentAssignments[p] = combination[0];
        }
      }

      // Check if this is better
      if (currentCoveredCount > bestSolution.coveredCount) {
        bestSolution = {
          totalCost: currentCost,
          coveredCount: currentCoveredCount,
          supermarkets: combination,
          assignments: currentAssignments
        };
      } else if (currentCoveredCount === bestSolution.coveredCount) {
        if (currentCost < bestSolution.totalCost) {
          bestSolution = {
            totalCost: currentCost,
            coveredCount: currentCoveredCount,
            supermarkets: combination,
            assignments: currentAssignments
          };
        }
      }
    }
  }

  // Construct result
  const result = {
    totalCost: bestSolution.totalCost === Infinity ? 0 : roundPrice(bestSolution.totalCost),
    supermarkets: []
  };

  if (bestSolution.supermarkets.length > 0) {
    for (const storeIndex of bestSolution.supermarkets) {
      const store = supermarkets[storeIndex];
      const storeProducts = [];
      
      for (let p = 0; p < productCount; p++) {
        if (bestSolution.assignments[p] === storeIndex) {
          storeProducts.push(store.products[p]);
        }
      }
      
      if (storeProducts.length > 0) {
        result.supermarkets.push({
          code: store.code,
          name: store.name,
          icon: store.icon,
          products: storeProducts
        });
      }
    }
  }

  return result;
}



// --- UNIT CONVERSION HELPERS ---
const unitofmeasures = [
  { unit: "gram", name: "gram", conversion: 1 },
  { unit: "gram", name: "gr", conversion: 1 },
  { unit: "gram", name: "g", conversion: 1 },
  { unit: "gram", name: "kilogram", conversion: 1000 },
  { unit: "gram", name: "kilo", conversion: 1000 },
  { unit: "gram", name: "kg", conversion: 1000 },
  { unit: "gram", name: "k", conversion: 1000 },
  { unit: "gram", name: "pond", conversion: 500 },
  { unit: "milliliter", name: "milliliter", conversion: 1 },
  { unit: "milliliter", name: "mililiter", conversion: 1 },
  { unit: "milliliter", name: "ml", conversion: 1 },
  { unit: "milliliter", name: "liter", conversion: 1000 },
  { unit: "milliliter", name: "l", conversion: 1000 },
  { unit: "milliliter", name: "deciliter", conversion: 100 },
  { unit: "milliliter", name: "dl", conversion: 100 },
  { unit: "milliliter", name: "centiliter", conversion: 10 },
  { unit: "milliliter", name: "cl", conversion: 10 },
];

const unitofmeasurePattern = new RegExp(
  "([\\d\\.,]+)\\s?(" + unitofmeasures.map(unit => unit.name).join("|") + ")", "i"
);

function getAmount(value) {
  const amount = value.match(unitofmeasurePattern);
  return amount ? amount[0] : null;
}

function convertAmountToBase(value) {
  if (value && unitofmeasurePattern.test(value)) {
    const amount = value.match(unitofmeasurePattern);
    const unit = unitofmeasures.find(unit => unit.name === amount[2].toLowerCase());
    return (parseFloat(amount[1].replace(",", ".")) * unit.conversion) + " " + unit.unit;
  }
  return value;
}

function compareMinimumAmounts(productAmount, searchAmount) {
  const productAmountValue = parseInt(productAmount.match(/([0-9]+)/));
  const searchAmountValue = parseInt(searchAmount.match(/([0-9]+)/));
  let productAmountUnit = productAmount.match(/([a-z]+)/i);
  let searchAmountUnit = searchAmount.match(/([a-z]+)/i);

  if (productAmountUnit && searchAmountUnit) {
    productAmountUnit = productAmountUnit[0];
    searchAmountUnit = searchAmountUnit[0];
  }
  return (productAmountUnit === searchAmountUnit && productAmountValue >= searchAmountValue);
}

// --- PRODUCT SEARCH LOGIC ---
function findProducts(products, value) {
  // Ignore leading 'x ' (already bought) for search, but keep original for originalQuery
  let searchValue = value.trim().replace(/^x\s+/i, '');
  const amount = getAmount(searchValue);
  if (amount) searchValue = searchValue.replace(amount, "");
  const patterns = searchValue.trim().split(/\s/g).filter(p => p).map(p => new RegExp(p.replace(/\s/g, ""), "i"));
  let productMatches = products.filter(product =>
    patterns.every(pattern => pattern.test(product.n))
  );
  if (productMatches.length === 0) {
    // Fallback: fuzzy match
    const fallbackPattern = [new RegExp(searchValue.replace(/\s/g, "").split("").join(".*"), "i")];
    productMatches = products.filter(product =>
      fallbackPattern.every(pattern => pattern.test(product.n))
    );
  }
  if (amount) {
    const baseAmount = convertAmountToBase(amount);
    productMatches = productMatches.filter(product =>
      compareMinimumAmounts(convertAmountToBase(product.s), baseAmount)
    );
  }
  productMatches.sort((a, b) => {
    const aLength = patterns.reduce((acc, pattern) => acc + (a.n.match(pattern)?.[0]?.length || 0), 0);
    const bLength = patterns.reduce((acc, pattern) => acc + (b.n.match(pattern)?.[0]?.length || 0), 0);
    if (Math.abs(aLength - bLength) < 3) return a.p - b.p;
    return aLength - bLength;
  });
  return productMatches;
}

function findProduct(products, name) {
  return findProducts(products, name)[0];
}

function roundPrice(price) {
  if (typeof price === 'number' && !isNaN(price)) {
    return Math.round(price * 100) / 100;
  }
  return price;
}




// --- NODE.JS AND BROWSER-COMPATIBLE FETCH/CACHE HELPERS ---
const CACHE_KEY = 'supermarkets.cache.json';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCache() {
  if (isNode) {
    try {
      const fs = require('fs');
      if (fs.existsSync(CACHE_KEY)) {
        const raw = fs.readFileSync(CACHE_KEY, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && Array.isArray(parsed.data) && parsed.fetchedAt) {
          if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
            return parsed.data;
          }
        }
      }
    } catch (e) {}
  } else if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && Array.isArray(parsed.data) && parsed.fetchedAt) {
          if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
            return parsed.data;
          }
        }
      }
    } catch (e) {}
  }
  return null;
}

function setCache(data, lastModified) {
  const cacheObj = { fetchedAt: Date.now(), data, lastModified: lastModified || null };
  if (isNode) {
    try {
      const fs = require('fs');
      fs.writeFileSync(CACHE_KEY, JSON.stringify(cacheObj), 'utf-8');
    } catch (e) {}
  } else if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
    } catch (e) {}
  }
}

function fetchSupermarketsJson() {
  if (isNode) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      https.get(SUPERMARKETS_URL, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch supermarkets.json. Status code: ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = '';
        let lastModified = res.headers['last-modified'] || null;
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            setCache(parsedData, lastModified);
            resolve(parsedData);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  } else if (typeof fetch !== 'undefined') {
    return fetch(SUPERMARKETS_URL)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch supermarkets.json');
        const lastModified = res.headers.get('Last-Modified') || null;
        return res.json().then(data => {
          setCache(data, lastModified);
          return data;
        });
      });
  } else {
    return Promise.reject(new Error('No fetch method available'));
  }
}

async function getSupermarketsJson() {
  const cached = getCache();
  if (cached) return cached;
  return await fetchSupermarketsJson();
}


const exported = {
  getPricesForProducts,
  getOptimalShoppingPlan,
  getSupermarkets,
  getCheckjebonLink,
  pricesLastUpdated
};

if (isNode) {
  module.exports = exported;
} else if (typeof window !== 'undefined') {
  window.checkjebon = exported;
}