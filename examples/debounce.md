# Debounce

**Task:** "Add debounce to a search input in vanilla JavaScript. It currently fires an API call on every keystroke."

Verbatim model output from a benchmark run, Claude Haiku 4.5, no-skill arm vs ponytail arm, temperature 1, source `benchmarks/output.json`. Reproduce: `npx promptfoo@latest eval -c benchmarks/promptfooconfig.yaml`.

## Without Ponytail, 116 lines of code

# Debounce Search Input

Here's a practical implementation to prevent excessive API calls:

## Basic Debounce Function

```javascript
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Usage
const searchInput = document.getElementById('search');
const resultsContainer = document.getElementById('results');

const handleSearch = async (query) => {
  if (!query.trim()) {
    resultsContainer.innerHTML = '';
    return;
  }
  
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    displayResults(data);
  } catch (error) {
    console.error('Search failed:', error);
  }
};

// Debounce the search function (300ms delay)
const debouncedSearch = debounce(handleSearch, 300);

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});
```

## Enhanced Version with Loading State

```javascript
const searchInput = document.getElementById('search');
const resultsContainer = document.getElementById('results');
const loadingIndicator = document.getElementById('loading');

const handleSearch = async (query) => {
  if (!query.trim()) {
    resultsContainer.innerHTML = '';
    loadingIndicator.style.display = 'none';
    return;
  }
  
  loadingIndicator.style.display = 'block';
  
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed');
    
    const data = await response.json();
    displayResults(data);
  } catch (error) {
    resultsContainer.innerHTML = '<p class="error">Search failed. Try again.</p>';
    console.error('Search error:', error);
  } finally {
    loadingIndicator.style.display = 'none';
  }
};

const debouncedSearch = debounce(handleSearch, 300);

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});

function displayResults(data) {
  resultsContainer.innerHTML = data
    .map(item => `<div class="result">${item.title}</div>`)
    .join('');
}
```

## Advanced: Debounce with Cancel & Immediate Options

```javascript
function debounce(func, delay, options = {}) {
  let timeoutId;
  let lastArgs;
  
  const debounced = function (...args) {
    lastArgs = args;
    clearTimeout(timeoutId);
    
    if (options.immediate && !timeoutId) {
      func(...args);
    }
    
    timeoutId = setTimeout(() => {
      if (!options.immediate) {
        func(...lastArgs);
      }
      timeoutId = null;
    }, delay);
  };
  
  // Allow manual cancellation
  debounced.cancel = () => clearTimeout(timeoutId);
  
  return debounced;
}

// Usage with options
const debouncedSearch = debounce(handleSearch, 300, { immediate: false });

// Cancel pending search if needed
searchInput.addEventListener('blur', () => {
  debouncedSearch.cancel();
});
```

## HTML Example

```html
<div class="search-container">
  <input 
    type="text" 
    id="search" 
    placeholder="Search..."
    autocomplete="off"
  >
  <div id="loading" style="display: none;">Loading...</div>
  <div id="results"></div>
</div>

<style>
  .search-container {
    max-width: 500px;
    margin: 20px auto;
  }
  
  #search {
    width: 100%;
    padding: 10px;
    font-size: 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  #results {
    margin-top: 10px;
  }
  
  .result {
    padding: 10px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
  }
  
  .result:hover {
    background-color: #f5f5f5;
  }
  
  .error {
    color: red;
    padding: 10px;
  }
</style>
```

## Key Benefits

| Feature | Benefit |
|---------|---------|
| **Debounce** | Reduces API calls from 100+ to 1-2 per search |
| **300ms delay** | Balances responsiveness with performance |
| **Loading state** | Provides user feedback |
| **Error handling** | Graceful failure management |
| **Cancel method** | Cleanup when needed |

**Typical keystroke reduction:** 10 characters = 10 API calls → 1-2 API calls with debounce ✅

## With Ponytail, 10 lines of code

```javascript
const searchInput = document.querySelector('input[type="search"]');
let debounceTimer;

searchInput.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetch(`/api/search?q=${encodeURIComponent(e.target.value)}`)
      .then(r => r.json())
      .then(data => console.log(data)); // replace with your render
  }, 300);
});
```

Skipped: debounce utility function, class wrapper, config object, `setTimeout` + `clearTimeout` is the debounce. Add a utility when you need it on 3+ inputs.

**116 → 10 lines of code**, same model, same prompt.
