# @ibetoni/ocr-utils

Reusable OCR utilities for betoni.online - classification, confidence scoring, and validation.

## Overview

This shared package provides common OCR-related utilities used across:
- **Frontend** (puminet4) - UI confidence indicators, field validation
- **Backend** (puminet5api) - Document classification, field extraction, status transitions

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

### Document Classification (Convenience Wrapper)

`classifyDocumentType` calls all three extractors and combines the results:

```javascript
import { classifyDocumentType } from '@ibetoni/ocr-utils';

// Rudus kuormakirja WITH "pumpun siirto" → pump type (15)
const rudusWithPump = "Kuormakirja\nwww.rudus.fi\npumpun siirto\n28386640 / 20152";
classifyDocumentType(rudusWithPump);
// {
//   attachmentTypeId: 15,      // KUORMAKIRJA_PUMP
//   attachmentGroupId: 1,
//   sourceAsiakasId: 30,       // Rudus
//   kuormakirjanumero: "28386640 / 20152",
//   confidence: 0.92,
//   reason: 'Rudus kuormakirja with "pumpun siirto"'
// }

// Rudus kuormakirja WITHOUT "pumpun siirto" → truck type (16)
const rudusNoTransfer = "Kuormakirja\nwww.rudus.fi\n27962502 / 20073";
classifyDocumentType(rudusNoTransfer);
// {
//   attachmentTypeId: 16,      // KUORMAKIRJA_TRUCK
//   attachmentGroupId: 1,
//   sourceAsiakasId: 30,
//   kuormakirjanumero: "27962502 / 20073",
//   confidence: 0.92,
//   reason: 'Rudus kuormakirja without pump transfer keyword'
// }

// PEAB kuormakirja → always pump type (15)
const peab = "Kuormakirja\nPEAB Betoni\nbetoni 32-2";
classifyDocumentType(peab);
// {
//   attachmentTypeId: 15,      // KUORMAKIRJA_PUMP
//   attachmentGroupId: 1,
//   sourceAsiakasId: 28,       // PEAB
//   kuormakirjanumero: null,
//   confidence: 0.90,
//   reason: 'Contains "kuormakirja" and "peab"'
// }
```

### Confidence Scoring

```javascript
import {
  calculateFieldConfidence,
  getConfidenceColor,
  getConfidenceIcon
} from '@ibetoni/ocr-utils';

const ocrConfidence = 0.92;
const validationResult = { isValid: true, errors: [] };
const fieldConfidence = calculateFieldConfidence(ocrConfidence, validationResult);

// UI helpers
const color = getConfidenceColor(fieldConfidence); // 'success.main'
const icon = getConfidenceIcon(fieldConfidence);   // 'CheckCircle'
```

### Field Validation

```javascript
import { validateNumeric, validateTime, validateText } from '@ibetoni/ocr-utils';

// Validate m³ value
const volumeResult = validateNumeric('3.5', { min: 0, max: 20, decimals: 2 });
// { isValid: true, errors: [], normalizedValue: 3.5 }

// Validate time
const timeResult = validateTime('14:30');
// { isValid: true, errors: [], normalizedValue: '14:30' }

// Validate text
const commentResult = validateText('Toimitus sujui hyvin', { maxLength: 500 });
// { isValid: true, errors: [], normalizedValue: 'Toimitus sujui hyvin' }
```

### Status Transitions

```javascript
import { canTransitionStatus, PROCESSING_STATUSES } from '@ibetoni/ocr-utils';

const currentStatus = PROCESSING_STATUSES.PENDING;
const nextStatus = PROCESSING_STATUSES.PROCESSING;

if (canTransitionStatus(currentStatus, nextStatus)) {
  // Transition is allowed
  updateStatus(nextStatus);
}
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
- `classifyDocumentType(ocrText)` - Convenience wrapper: calls all three, returns combined result

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
- `calculateFieldConfidence(ocrConfidence, validationResult)` - Calculate adjusted confidence
- `calculateAverageConfidence(fields)` - Average confidence across fields
- `getConfidenceColor(confidence)` - MUI theme color for confidence level
- `getConfidenceIcon(confidence)` - MUI icon name for confidence level
- `getConfidenceLabelFi(confidence)` - Finnish confidence label
- `needsReview(confidence)` - Check if field needs human review
- `canAutoApprove(confidence)` - Check if field can be auto-approved
- `formatConfidencePercent(confidence)` - Format as percentage string
- `getConfidenceStatistics(extractedFields)` - Get statistics for all fields

### `validation.js`
- `validateNumeric(value, options)` - Validate numeric fields
- `validateTime(value, options)` - Validate time fields (HH:mm)
- `validateDate(value, options)` - Validate date fields
- `validateText(value, options)` - Validate text fields
- `validateVehicleRegistration(value, options)` - Validate Finnish registration numbers
- `validateKuormakirjaNumber(value, options)` - Validate kuormakirja numbers
- `normalizeFieldValue(value)` - Clean and normalize values
- `validateExtractedFields(fields, definitions)` - Batch validate all fields
- `allRequiredFieldsValid(validationResults)` - Check if all required fields valid

### `statusTransitions.js`
- `canTransitionStatus(currentStatus, nextStatus)` - Check if transition allowed
- `getAllowedNextStatuses(currentStatus)` - Get valid next statuses
- `validateStatusTransition(currentStatus, nextStatus)` - Validate with error message
- `isTerminalStatus(status)` - Check if processing complete
- `isErrorStatus(status)` - Check if error state
- `isInProgressStatus(status)` - Check if in-progress state
- `requiresHumanAction(status)` - Check if human action needed
- `getTransitionDescription(fromStatus, toStatus, reason)` - Audit log description

## Examples

### Frontend: Confidence-Based Field Styling

```jsx
import { getConfidenceColor, formatConfidencePercent } from '@ibetoni/ocr-utils';
import { Box } from '@mui/material';

function OCRField({ field, value, confidence }) {
  return (
    <Box
      sx={{
        borderLeft: '3px solid',
        borderColor: getConfidenceColor(confidence),
        padding: 1
      }}
    >
      <strong>{field}:</strong> {value}
      <span style={{ marginLeft: 8, color: 'gray' }}>
        ({formatConfidencePercent(confidence)})
      </span>
    </Box>
  );
}
```

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
