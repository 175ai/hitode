import { loadCsvConfig } from '../../utils/csv-loader.js';

const DIGIT_TRANSLATION = {
  '０': '0',
  '１': '1',
  '２': '2',
  '３': '3',
  '４': '4',
  '５': '5',
  '６': '6',
  '７': '7',
  '８': '8',
  '９': '9'
};

function toHalfWidthDigits(text) {
  return text.replace(/[０-９]/g, (digit) => DIGIT_TRANSLATION[digit] ?? digit);
}

function asBoolean(value) {
  return String(value).toLowerCase() === 'true' || value === '1';
}

function toPriority(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function applyRegexReplacement(text, rule) {
  try {
    const regex = new RegExp(rule.pattern, 'g');
    return text.replace(regex, rule.replacement ?? '');
  } catch (_error) {
    return text;
  }
}

function detectClaimFrames(text, sentenceRules) {
  const detections = [];

  sentenceRules.forEach((rule) => {
    if (!asBoolean(rule.enabled)) {
      return;
    }

    const label = rule.replacement || 'claim_frame';

    try {
      const regex = new RegExp(rule.pattern, 'g');
      let match = regex.exec(text);

      while (match) {
        detections.push({
          ruleId: rule.id || '-',
          label,
          matchedText: match[0],
          start: match.index,
          end: match.index + match[0].length
        });

        if (match.index === regex.lastIndex) {
          regex.lastIndex += 1;
        }

        match = regex.exec(text);
      }
    } catch (_error) {
      // Invalid rules are ignored so analysts can keep iterating on config files.
    }
  });

  return detections.sort((left, right) => left.start - right.start);
}

export async function runPreprocess(inputText) {
  const normalizeRules = await loadCsvConfig('config/preprocess/normalize-rules.csv');
  const sentenceRules = await loadCsvConfig('config/preprocess/sentence-rules.csv');

  const normalizeRegexRules = normalizeRules
    .filter((rule) => asBoolean(rule.enabled) && rule.pattern)
    .sort((left, right) => toPriority(left.priority) - toPriority(right.priority));

  const originalText = inputText.trim();
  const digitNormalizedText = toHalfWidthDigits(originalText);

  const normalizedText = normalizeRegexRules.reduce((current, rule) => {
    return applyRegexReplacement(current, rule);
  }, digitNormalizedText);

  const claimFrameDetections = detectClaimFrames(normalizedText, sentenceRules);

  return {
    originalText,
    normalizedText,
    claimFrameDetections,
    appliedRules: normalizeRegexRules.map((rule) => rule.id || '(no-id)')
  };
}
