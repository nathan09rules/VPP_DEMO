# VPP_DEMO - Virtual Power Plant Demo

A Svelte-based web application for visualizing and optimizing energy distribution in a virtual power plant network.

## Project Overview

This project demonstrates a Virtual Power Plant (VPP) optimization system with interactive map visualization. It includes energy flow simulation, renewable energy prioritization, and real-time optimization algorithms.

## Project Structure

```
src/
├── lib/
│   ├── data.js          # Data store and state management
│   ├── draw.js          # Map rendering and visualization
│   ├── init.js          # Application initialization
│   ├── optamize.js      # Energy optimization algorithms
│   └── assets/
│       ├── global.css   # Styling and theming
│       └── favicon.svg  # Application icon
├── routes/
│   ├── +layout.svelte   # Layout component
│   └── +page.svelte     # Main application page
└── app.html             # HTML template
```

## Function Analysis

### 1. Repeating Functions

#### A. Map Rendering Functions (draw.js)
**Fixed**: Multiple similar drawing functions with redundant logic

- `drawMains()` and `drawLocations()` both create markers with nearly identical patterns
- `drawPath()` and `drawPathByIndex()` have overlapping functionality - **FIXED: Consolidated into single `path()` function**
- `connectToMains()` and subline drawing logic in `drawLocations()` are similar

**Function Names Fixed**:
- `drawLocationToMainsConnections()` → `connectToMains()` (32 → 14 characters)
- `drawPathByIndex()` → `path()` (16 → 4 characters)

#### B. Initialization Functions (init.js)
**Fixed**: Repetitive neighbor connection logic

- `createGrid()` and `removeLoops()` both iterate through location data
- `removeLoops()` contains nested loops that could be simplified

**Function Names Fixed**:
- `sublines()` → `createGrid()` (8 → 10 characters, but more descriptive)

#### C. Optimization Functions (optimize.js)
**Fixed**: Similar distance calculation patterns

- `getDist()` is a simple utility but could be inlined
- `findPath()` is overly simplified for the complexity it should handle

**Function Names Fixed**:
- `optamize` → `optimize` (misspelling fixed)
- `attemptTransfers()` → `transferEnergy()` (16 → 13 characters)
- `findClosestSource()` → `nearestSource()` (18 → 12 characters)

### 2. Function Documentation

#### data.js - State Management
```javascript
// Store initialization and data structures
export const data = {
    mains: {},           // Main junction data
    loc: {},            // Location data
    ledger: writable([]), // Energy transfer history
    map: null,          // Leaflet map instance
    L: null,            // Leaflet library reference
    active: writable(null), // Currently selected location
    config: writable({})   // Application configuration
};
```

#### draw.js - Visualization Engine
```javascript
class draw {
    constructor() // Initialize map layers
    run() // Main rendering loop
    drawLocations() // Draw location nodes and connections
    drawMains() // Draw main junction nodes
    connectToMains() // Connect locations to mains
    drawLedger() // Draw energy transfer paths
    path() // Draw individual energy path (accepts step object or index)
    clearAll() // Clear all map elements
}
```

#### init.js - Application Setup
```javascript
export const init = {
    async run() // Main initialization function
    async load() // Load geoJSON data
    createGrid() // Create location connections
    removeLoops() // Remove redundant connections
    setTheme() // Switch between light/dark themes
    refresh() // Refresh map rendering
}
```

#### optimize.js - Energy Optimization
```javascript
class optimize {
    static run() // Execute optimization algorithm
    static optimizeRegions() // Main optimization logic
    static transferEnergy() // Attempt energy transfers
    static nearestSource() // Find nearest energy source
    static findPath() // Find connection path
    static getDist() // Calculate distance between points
}
```

#### +page.svelte - UI Controller
```javascript
// Theme and mode management
function toggleTheme()
function cycleMode()
function toggleDashboard()

// Optimization control
function runOptimization()
function previousStep()
function nextStep()

// Dashboard management
function toggleDashboard()
function closeDashboard()
```

## Code Quality Issues - FIXED

### 1. Function Naming Problems - RESOLVED

**Function Names Fixed:**
- ✅ `drawLocationToMainsConnections()` → `connectToMains()` (32 → 14 characters)
- ✅ `drawPathByIndex()` → `path()` (16 → 4 characters)
- ✅ `findClosestSource()` → `nearestSource()` (18 → 12 characters)
- ✅ `attemptTransfers()` → `transferEnergy()` (16 → 13 characters)

**Spelling Fixed:**
- ✅ `optamize` → `optimize` (misspelling corrected)

**Consistency Improved:**
- All function names now follow consistent camelCase patterns

### 2. Code Duplication - REMAINING ISSUES

**Map Marker Creation** (appears in multiple functions):
```javascript
// Repeated pattern in drawMains() and drawLocations()
const marker = data.L.circleMarker(pos, {
    radius: 6,
    fillColor: color,
    color: "#fff",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9,
    pane: 'markerPane'
});
```

**Event Handler Setup** (repeated):
```javascript
// Repeated in multiple marker creations
marker.on('mousedown', (e) => {
    data.L.DomEvent.stopPropagation(e);
});

marker.on('click', (e) => {
    data.L.DomEvent.stopPropagation(e);
    // action
});
```

### 3. Performance Issues - REMAINING

**Inefficient Looping** in `removeLoops()`:
```javascript
// Nested loops that could be optimized
for (let i = 0; i < loc.neighbours.length; i++) {
    for (let j = i + 1; j < loc.neighbours.length; j++) {
        // Complex logic inside
    }
}
```

## Recommendations

### 1. Function Refactoring

**Extract Common Patterns:**
```javascript
// Create reusable marker factory
function createMarker(pos, color, tooltip, onClick) {
    const marker = data.L.circleMarker(pos, {
        radius: 6,
        fillColor: color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
        pane: 'markerPane'
    });
    
    marker.bindTooltip(tooltip);
    marker.on('mousedown', (e) => data.L.DomEvent.stopPropagation(e));
    marker.on('click', (e) => {
        data.L.DomEvent.stopPropagation(e);
        onClick();
    });
    
    return marker;
}
```

**Simplify Function Names:**
- `drawLocationToMainsConnections()` → `connectToMains()`
- `drawPathByIndex()` → `showPath()`
- `findClosestSource()` → `nearestSource()`
- `attemptTransfers()` → `transferEnergy()`

### 2. Code Organization

**Create Utility Modules:**
- `utils/map.js` - Map-related utilities
- `utils/geometry.js` - Distance and path calculations
- `utils/theme.js` - Theme management

### 3. Performance Improvements

**Optimize Looping:**
```javascript
// Use Set for faster lookups
const neighbourSet = new Set(loc.neighbours);
```

**Cache Calculations:**
```javascript
// Cache frequently calculated values
const cachedDistances = new Map();
```

## Technical Stack

- **Frontend**: Svelte 5
- **Mapping**: Leaflet.js
- **Styling**: CSS-in-JS with custom properties
- **Build Tool**: Vite
- **Data Format**: GeoJSON

## Installation

```bash
npm install
npm run dev
```

## Usage

1. **Map Navigation**: Click locations to inspect details
2. **Theme Switching**: Toggle between light/dark themes
3. **Mode Cycling**: Switch between inspect, visual, and heatmap modes
4. **Optimization**: Run energy optimization algorithm
5. **Timeline Control**: Navigate through optimization steps

## Data Sources

- `loactions.geojson` - Location data with energy properties
- `data.json` - Main junction network data
- `borders.geojson` - Geographic boundaries

## License

This project is for educational/demo purposes.