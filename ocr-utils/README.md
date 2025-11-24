# @ibetoni/ocr-utils

Reusable OCR utilities for betoni.online - classification, confidence scoring, and validation.

## Overview

This shared package provides common OCR-related utilities used across:
- **Frontend** (puminet4) - UI confidence indicators, field validation
- **Backend** (puminet5api) - API validation, status transitions
- **Azure Functions** (puminet7-functions-app) - Document classification, field extraction

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

### Document Classification

```javascript
import { classifyDocumentType, DOCUMENT_TYPES } from '@ibetoni/ocr-utils';

const ocrText = "Kuormakirja\nKalle Urho Oy\nTilaus: 12345";
const classification = classifyDocumentType(ocrText);

console.log(classification);
// {
//   attachmentTypeId: 15,
//   attachmentGroupId: 1,
//   sourceAsiakasId: 1,
//   confidence: 0.95,
//   reason: 'Contains "kuormakirja" and "kalle urho" - internal format'
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
- `SOURCE_ASIAKAS_IDS` - Source company IDs (Kalle Urho, Rudus, PEAB)
- `CONFIDENCE_THRESHOLDS` - Confidence level thresholds
- Helper functions: `getDocumentTypeName()`, `getSourceAsiakasName()`, etc.

### `classification.js`
- `classifyDocumentType(ocrText, page)` - Detect document type from OCR text
- `extractKeikkaNumber(ocrText)` - Extract keikka/tilaus number
- `isHighConfidenceClassification(confidence)` - Check if classification is confident
- `needsClassificationReview(classification)` - Determine if human review needed
- `classifyPages(pages)` - Batch classify multiple pages

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

### Backend: Document Classification

```javascript
import { classifyDocumentType, PROCESSING_STATUSES } from '@ibetoni/ocr-utils';

async function processOCR(attachmentId, ocrResult) {
  const fullText = ocrResult.pages.map(p => p.content).join('\n');
  const classification = classifyDocumentType(fullText);

  await saveExtractedData({
    attachmentId,
    attachmentTypeId: classification.attachmentTypeId,
    attachmentGroupId: classification.attachmentGroupId,
    sourceAsiakasId: classification.sourceAsiakasId,
    classificationConfidence: classification.confidence,
    processingStatusId: classification.confidence >= 0.85
      ? PROCESSING_STATUSES.COMPLETED
      : PROCESSING_STATUSES.NEEDS_REVIEW
  });
}
```

### Azure Function: Field Validation

```javascript
import { validateExtractedFields, calculateAverageConfidence } from '@ibetoni/ocr-utils';

function processExtractedFields(ocrFields) {
  const fieldDefinitions = {
    volume: { type: 'numeric', options: { min: 0, max: 20, decimals: 2 } },
    startTime: { type: 'time', options: { required: true } },
    endTime: { type: 'time', options: { required: true } },
    vehicleReg: { type: 'vehicleRegistration', options: { required: false } }
  };

  const validationResults = validateExtractedFields(ocrFields, fieldDefinitions);
  const avgConfidence = calculateAverageConfidence(Object.values(ocrFields));

  return { validationResults, avgConfidence };
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
