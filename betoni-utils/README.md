# @ibetoni/betoni-utils

Shared betoni (concrete) utilities for betoni.online - provides string formatting, validation, and utility functions for betoni specifications.

## Installation

```bash
# In your project's package.json, add:
{
  "dependencies": {
    "@ibetoni/betoni-utils": "file:../ibetoni_packages/betoni-utils"
  }
```

Then run `npm install`

## Features

- ✅ **Multiple String Formats** - Standard, comprehensive, with/without attributes
- ✅ **Cross-Platform** - Works in frontend (React/ESM), backend (Node.js/CJS), and Azure Functions
- ✅ **Flexible Input** - Handles various betoni object formats (database, class instances, API responses)
- ✅ **Validation** - Check if betoni specifications are complete
- ✅ **Constants** - Exposure classes (Rasitusluokat) and other betoni-related constants
- ✅ **Clean Output** - Automatically removes "Ei tietoa" and handles whitespace
- ✅ **Person Utilities** - Format person names with null-safe handling
- ✅ **Email Utilities** - Validate and parse semicolon-separated email lists
- ✅ **Ecofleet Utilities** - XML text extraction and Haversine SQL distance formula

## Usage

> **Note:** The package uses CommonJS (`require`/`module.exports`). Frontend projects using a bundler (Vite/Webpack) can use ESM `import` syntax — the bundler handles the conversion.

### String Formatting

```javascript
const {
  betoni_getString,
  betoni_getString_noAttr,
  betoni_getComprehensiveString,
} = require("@ibetoni/betoni-utils");

// Standard format without attributes
const standard = betoni_getString_noAttr(betoni);
// Result: "Lattiabetoni hieno 16mm C25/30 S2"

// Standard format with attributes
const withAttrs = betoni_getString(betoni);
// Result: "Lattiabetoni hieno 16mm C25/30 S2 Lisä1, Lisä2"

// Comprehensive format (includes volume, weather resistance, etc.)
const comprehensive = betoni_getComprehensiveString(betoni);
// Result: "Säänkestävä 2m³ Lattiabetoni hieno 16mm C25/30 S2 XF1,XC3 50 vuotta Lisä1,Lisä2"

// Format multiple betonit
const multiple = betoni_getString([betoni1, betoni2]);
// Result: "Lattiabetoni C25/30 S2 + Paalubetoni C30/37 S3"
```

### Validation

```javascript
const { betoni_isComplete } = require("@ibetoni/betoni-utils");

const result = betoni_isComplete(betoni);
if (!result.isComplete) {
  console.log("Validation failed:", result.reason);
  // e.g., "Lujuutta ei ole valittu"
}
```

### Person Name Formatting

```javascript
const { formatPersonName } = require("@ibetoni/betoni-utils");

formatPersonName("Matti", "Virtanen"); // "Matti Virtanen"
formatPersonName(null, "Virtanen");    // "Virtanen"
formatPersonName(null, null);          // "Nimetön" (default fallback)
formatPersonName(null, null, "–");     // "–" (custom fallback)
```

### Email Utilities

```javascript
const { isEmail, parseMultipleEmails, validateMultipleEmails } = require("@ibetoni/betoni-utils");

isEmail("user@example.com"); // true
isEmail("not-an-email");     // false

// Parse semicolon-separated emails (returns only valid ones)
parseMultipleEmails("a@b.com; bad; c@d.com"); // ["a@b.com", "c@d.com"]

// Validate and separate valid/invalid
validateMultipleEmails("a@b.com; bad; c@d.com");
// { valid: ["a@b.com", "c@d.com"], invalid: ["bad"] }
```

### Constants

```javascript
const { RasitusLuokatArr, WEATHER_RESISTANT_CLASSES } = require("@ibetoni/betoni-utils");

console.log(RasitusLuokatArr);
// ["X0", "XC1", "XC2", "XC3", "XC4", "XD1", "XD2", "XD3", "XF1", "XF2", "XF3", "XF4", "XS1", "XS2", "XS3", "XA1", "XA2", "XA3"]

console.log(WEATHER_RESISTANT_CLASSES);
// ["XF1", "XF3"]
```

### Ecofleet Utilities

```javascript
const { getText, HAVERSINE_DISTANCE_M } = require("@ibetoni/betoni-utils");

// Extract _text from xml-js compact-mode node
const value = getText(xmlNode?.SomeField); // returns _text or null

// SQL fragment for great-circle distance in metres (requires @lat/@lng params + lat/lng columns)
const query = `SELECT *, ${HAVERSINE_DISTANCE_M} AS distanceM FROM vehicle_location_snapshots WHERE ...`;
```

## API Reference

### String Formatting Functions

#### `betoni_getString(betoni, noAttr, comprehensive)`

Main betoni string formatting function with multiple options.

**Parameters:**

- `betoni` (Object|Array): Betoni object or array of betoni objects
- `noAttr` (Boolean): If true, excludes attributes (default: false)
- `comprehensive` (Boolean): If true, uses comprehensive format (default: false)

**Returns:** String - Formatted betoni description

---

#### `betoni_getString_noAttr(betoni)`

Get standard betoni string without attributes.

**Format:** "Laatutyyppi isNopea raeKoko lujuus notkeus rasitusluokat käyttöikä"

**Example:** "Lattiabetoni hieno 16mm C25/30 S2"

---

#### `betoni_getComprehensiveString(betoni)`

Get comprehensive betoni string with volume, weather resistance, and attributes.

**Format:** "Säänkestävä Xm³ Nopea Laatutyyppi raeKoko lujuus notkeus rasitusluokat käyttöikä Lisät Comment"

**Example:** "Säänkestävä 2m³ Nopea Lattiabetoni hieno 16mm C25/30 S2 XF1,XC3 50 vuotta Lisä1,Lisä2"

---

#### `betoni_getComprehensiveString_noAttr(betoni, excludeVolume)`

Comprehensive format without attributes.

**Parameters:**

- `betoni` (Object): Betoni object
- `excludeVolume` (Boolean): If true, excludes volume (m³) (default: false)

---

#### `betoni_getStrings(betoni, options)`

Get an array of all betoni string components including attributes.

**Parameters:**

- `betoni` (Object): Betoni object
- `options` (Object): Optional settings
  - `includeWeatherResistant` (Boolean): If true, prepends "Säänkestävä" when betoni has XF1/XF3 exposure class (default: false)

**Returns:** Array of strings - [baseString, comment, attr1, attr2, ...]

**Example:**

```javascript
// Without weather resistance indicator
const strings = betoni_getStrings(betoni);
// ["Lattiabetoni C25/30 S2 XF1", "Comment", "Lisä1"]

// With weather resistance indicator
const strings = betoni_getStrings(betoni, { includeWeatherResistant: true });
// ["Säänkestävä Lattiabetoni C25/30 S2 XF1", "Comment", "Lisä1"]
```

---

#### `removeEiTietoaFromBetoniString(betoniString)`

Helper function to clean up "Ei tietoa" (No information) text from strings.

### Validation Functions

#### `betoni_isComplete(betoni)`

Check if betoni specification has all required fields selected.

**Returns:** Object with `{isComplete: boolean, reason: string}`

**Example:**

```javascript
const result = betoni_isComplete(betoni);
// { isComplete: false, reason: "Lujuutta ei ole valittu" }
```

### Person Utilities

#### `formatPersonName(firstName, lastName, fallback?)`

Format a person's full name from first and last name parts. Handles null/undefined gracefully.

**Parameters:**
- `firstName` (string|null|undefined)
- `lastName` (string|null|undefined)
- `fallback` (string): Returned when both names are empty (default: `"Nimetön"`)

**Returns:** string

### Email Utilities

#### `isEmail(value)`

Check if a string is a valid email address.

**Returns:** boolean

#### `parseMultipleEmails(emailString)`

Parse semicolon-separated email string, returning only valid emails.

**Returns:** string[] - Array of valid email addresses

#### `validateMultipleEmails(emailString)`

Parse and categorize semicolon-separated emails into valid and invalid.

**Returns:** `{ valid: string[], invalid: string[] }`

### Ecofleet Utilities

#### `getText(obj)`

Extract `_text` value from an xml-js compact-mode node property. Returns `null` when the node is absent or has no text content.

#### `HAVERSINE_DISTANCE_M`

SQL fragment computing great-circle distance in metres using the Haversine formula.

**Requires:** Query parameters `@lat` (Decimal 10,8) and `@lng` (Decimal 11,8), plus `lat`/`lng` columns on the queried table.

### Constants

#### `RasitusLuokatArr`

Array of exposure class codes according to EN 206 standard.

#### `WEATHER_RESISTANT_CLASSES`

Array of exposure classes that indicate weather-resistant concrete: `["XF1", "XF3"]`

## Supported Betoni Object Formats

The package handles multiple betoni object formats:

### Database Format

```javascript
{
  laatuNimike: "Lattiabetoni",
  raeKokoSelite: "hieno 16mm",
  lujuusSelite: "C25/30",
  notkeusSelite: "S2",
  rasitusluokat: "XF1,XC3",
  kayttoIkaSelite: "50 vuotta",
  isNopea: false,
  m3: 2
}
```

### Nested Object Format

```javascript
{
  laatu: { laatuNimike: "Lattiabetoni", laatuId: 4 },
  raeKoko: { raeKokoSelite: "hieno 16mm", raeKokoId: 2 },
  lujuus: { lujuusSelite: "C25/30", lujuusId: 2 },
  notkeus: { notkeusSelite: "S2", notkeusId: 2 },
  rasitus: { rasitusluokat: ["XF1", "XC3"] },
  kayttoIka: { kayttoIkaSelite: "50 vuotta", kayttoIkaId: 3 },
  isNopea: false,
  m3: 2,
  attr: {
    attr: [
      { attrNimike: "Lisä 1", keikkaBetoniAttrComment: "Kommentti" }
    ]
  }
}
```

## Migration from Frontend BetoniFunctions

If you're migrating from the old `BetoniFunctions.jsx`, the API is identical:

```javascript
// Before (frontend)
import { betoni_getString_noAttr } from "src/data/betoni/BetoniFunctions";

// After (shared package)
import { betoni_getString_noAttr } from "@ibetoni/betoni-utils";
```

## Backend Usage

### In keikkaBetoniSql.js

```javascript
const { betoni_getString_noAttr } = require("@ibetoni/betoni-utils");

async getKeikkaBetonit(keikkaId) {
  const conn = await mssqlcon.getConnection();
  const result = await conn.request().query(query);

  result.recordset.forEach(betoni => {
    betoni.betoniString = betoni_getString_noAttr(betoni);
  });

  return result.recordset;
}
```

### In pdfUtils.js

```javascript
const { betoni_getComprehensiveString_noAttr } = require("@ibetoni/betoni-utils");

function generatePdf(betoni) {
  const betoniDescription = betoni_getComprehensiveString_noAttr(betoni);
  // Use in PDF generation...
}
```

## Testing

Run tests with:

```bash
npm test
```

## License

UNLICENSED - Internal use only for betoni.online

## Maintainers

- betoni.online team

## Changelog

### 1.1.0 (2026-03)

- **CJS conversion**: All source files converted to CommonJS (`module.exports`) for compatibility with Azure Functions and Node.js backend
- Added `personUtils.js` — `formatPersonName` for null-safe full name formatting
- Added `emailUtils.js` — `isEmail`, `parseMultipleEmails`, `validateMultipleEmails`
- Added `ecofleetUtils.js` — `getText` (xml-js helper) and `HAVERSINE_DISTANCE_M` (SQL fragment)

### 1.0.0 (2025-11-03)

- Initial release
- Extracted from frontend BetoniFunctions.jsx
- String formatting functions (standard, comprehensive, with/without attributes)
- Validation functions (isComplete)
- Constants (RasitusLuokatArr, WEATHER_RESISTANT_CLASSES)
- Support for multiple betoni object formats
- Cross-platform compatibility (frontend/backend/functions)
