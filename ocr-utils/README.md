# @ibetoni/ocr-utils

Reusable OCR utilities for betoni.online - classification and confidence display.

## Overview

This shared package provides common OCR-related utilities used across:
- **Frontend** (puminet4) - UI confidence indicators
- **Backend** (puminet5api) - Document classification, field extraction

## Installation

This package is part of the betoni.online workspace and is installed automatically via workspace dependencies.

```json
{
  "dependencies": {
    "@ibetoni/ocr-utils": "file:../ibetoni_packages/ocr-utils"
  }
}
```

## Usage

### Standalone Extractors

Three independent extractors — each can be used alone or together:

```javascript
import {
  extractDocumentType,
  extractSourceAsiakasId,
  extractKuormakirjanumero
} from '@ibetoni/ocr-utils';

// Kalle Urho internal document — Tilausnumero is NOT extracted as KK number
const ocrText = "Kuormakirja\nKalle Urho Oy\nTilausnumero\n10163";

// Document type detection
const { attachmentTypeId, attachmentGroupId, confidence, reason } = extractDocumentType(ocrText);
// { attachmentTypeId: 15, attachmentGroupId: 1, confidence: 0.95,
//   reason: 'Contains "kuormakirja" and "kalle urho"' }

// Source company detection
const sourceAsiakasId = extractSourceAsiakasId(ocrText);
// 8  (Kalle Urho)

// Delivery note number extraction
// Returns null for Kalle Urho internal docs — Tilausnumero is NOT used as KK number
const kuormakirjanumero = extractKuormakirjanumero(ocrText);
// null
```

## Modules

### `constants.js`
- `DOCUMENT_TYPES` - Document type IDs (15-18, 99)
- `ATTACHMENT_GROUPS` - Attachment group IDs (1-8)
- `PROCESSING_STATUSES` - Processing status IDs (1-7)
- `SOURCE_ASIAKAS_IDS` - Source company IDs (Kalle Urho: 8, Rudus: 30, PEAB: 28)
- `CONFIDENCE_THRESHOLDS` - Confidence level thresholds
- `getDocumentTypeName(attachmentTypeId)` - Returns human-readable document type name, e.g. `"Kuormakirja (Pumppu)"`
- `getSourceAsiakasName(sourceAsiakasId)` - Returns source company name, e.g. `"Kalle Urho"`, `"Rudus"`, `"PEAB"`; returns `null` for unrecognized IDs

```javascript
import { getDocumentTypeName, getSourceAsiakasName, SOURCE_ASIAKAS_IDS } from '@ibetoni/ocr-utils';

getDocumentTypeName(15);                        // "Kuormakirja (Pumppu)"
getDocumentTypeName(99);                        // "Tuntematon"
getSourceAsiakasName(SOURCE_ASIAKAS_IDS.RUDUS); // "Rudus"
getSourceAsiakasName(null);                     // 'Unknown'
```

### `classification.js`
- `extractDocumentType(ocrText)` - Detect document type → `{ attachmentTypeId, attachmentGroupId, confidence, reason }`. Returns safe default if `ocrText` is falsy.
- `extractSourceAsiakasId(ocrText)` - Detect source company → `number | null`
- `extractKuormakirjanumero(ocrText)` - Extract delivery note number → `string | null`. Returns `null` if `ocrText` is falsy. Does NOT extract Tilausnumero values from Kalle Urho internal documents as KK numbers.
- `needsClassificationReview(classification)` - `true` when confidence < 0.75 or type is UNKNOWN

**Classification rules (priority order):**

| Condition | Type ID | Confidence | Notes |
|---|---|---|---|
| `kuormakirja` + `www.rudus.fi` + `pumpun siirto` | 15 (PUMP) | 0.92 | Rudus with pump transfer |
| `kuormakirja` + `www.rudus.fi` (no pump transfer) | 16 (TRUCK) | 0.92 | Rudus truck delivery |
| `kuormakirja` + `peab` | 15 (PUMP) | 0.90 | PEAB always pump |
| Kalle Urho internal formats (sarkatie/pumppaus/tilausnumero/betoni.online) | 15 (PUMP) | 0.95 | Checked after external suppliers |
| `kuormakirja` + `kalle urho` | 15 (PUMP) | 0.95 | |
| `kuormakirja` + `pumppu`/`pumppaus` | 15 (PUMP) | 0.85 | Generic pump keyword |
| `kuormakirja` + `betoniauto`/`kuljetus` | 16 (TRUCK) | 0.85 | Generic truck keyword |
| `pystytyspöytäkirja` | 17 | 0.90 | |
| Waste disposal keywords | 18 | 0.85 | |
| `kuormakirja` (fallback) | 15 (PUMP) | 0.70 | No specific type identified |
| No match | 99 (UNKNOWN) | 0.50 | |

**KK number extraction rules:**
- Rudus slash format: `\d{7,9}\s*/\s*\d{4,6}` (e.g. `"28386640 / 20152"`)
- Rudus bracket format: `(\d+, \d{7,9})` (e.g. `"( 1137 , 28386640 )"`)
- Generic label match: `kuormakirja`/`kk` + label words + `\d{6,10}` — rejects values starting with `0` (prevents matching Finnish phone numbers)

### `confidence.js`
- `formatConfidencePercent(confidence)` - Format as percentage string

> Earlier phase-0 modules (`validation.js`, `statusTransitions.js`, most confidence helpers,
> `classifyDocumentType`/`classifyPages`) were removed 2026-08-26 as never-consumed scaffolding;
> recover from git history if the OCR project's later phases need them.

## Examples

### Backend: Per-Page Extraction

```javascript
import {
  extractDocumentType,
  extractSourceAsiakasId,
  extractKuormakirjanumero,
  PROCESSING_STATUSES
} from '@ibetoni/ocr-utils';

// Called once per page in ocrController.js
for (const page of ocrResult.pages) {
  const { attachmentTypeId, attachmentGroupId, confidence } = extractDocumentType(page.content);
  const sourceAsiakasId = extractSourceAsiakasId(page.content);
  const kuormakirjanumero = extractKuormakirjanumero(page.content);

  await ocrSql.saveExtractedData({
    attachmentId,
    pageNumber: page.pageNumber,
    attachmentTypeId,
    attachmentGroupId,
    sourceAsiakasId,
    kuormakirjanumero,
    classificationConfidence: confidence,
    processingStatusId: PROCESSING_STATUSES.COMPLETED,
  });
}
```

## Development

### Running Tests

```bash
cd ibetoni_packages/ocr-utils
npm test
```

### Linting

```bash
npm run lint
```

## License

UNLICENSED - Internal use only

## Author

Kalle Urho Oy
