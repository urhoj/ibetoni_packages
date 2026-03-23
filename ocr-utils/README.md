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

const ocrText = "Kuormakirja\nKalle Urho Oy\nTilausnumero\n10163";

// Document type detection
const { attachmentTypeId, attachmentGroupId, confidence, reason } = extractDocumentType(ocrText);
// { attachmentTypeId: 15, attachmentGroupId: 1, confidence: 0.95, reason: '...' }

// Source company detection
const sourceAsiakasId = extractSourceAsiakasId(ocrText);
// 8  (Kalle Urho)

// Delivery note number extraction
const kuormakirjanumero = extractKuormakirjanumero(ocrText);
// "10163"
```

### Document Classification (Convenience Wrapper)

`classifyDocumentType` calls all three extractors and combines the results:

```javascript
import { classifyDocumentType } from '@ibetoni/ocr-utils';

const ocrText = "Kuormakirja\nKalle Urho Oy\nTilausnumero\n10163";
const result = classifyDocumentType(ocrText);

console.log(result);
// {
//   attachmentTypeId: 15,
//   attachmentGroupId: 1,
//   sourceAsiakasId: 8,
//   kuormakirjanumero: "10163",
//   confidence: 0.95,
//   reason: 'Contains "kuormakirja" - pumppuauto format'
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
- `extractDocumentType(ocrText)` - Detect document type → `{ attachmentTypeId, attachmentGroupId, confidence, reason }`
- `extractSourceAsiakasId(ocrText)` - Detect source company → `number | null`
- `extractKuormakirjanumero(ocrText)` - Extract delivery note number → `string | null`
- `classifyDocumentType(ocrText)` - Convenience wrapper: calls all three, returns combined result

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
