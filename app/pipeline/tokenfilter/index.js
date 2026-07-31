import { loadCsvConfig } from '../../utils/csv-loader.js';
import { compileTokenPattern, findPatternMatches, tokensToSurface } from '../rules/token-pattern.js';

function asBoolean(value) {
  return String(value).toLowerCase() === 'true' || value === '1';
}

function toPriority(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function sortRules(rules) {
  return rules
    .filter((rule) => asBoolean(rule.enabled))
    .sort((left, right) => toPriority(left.priority) - toPriority(right.priority));
}

function toSetFromPipeList(value) {
  return new Set(
    String(value ?? '')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function applyPartOfSpeechFilters(tokens, filterRules) {
  return filterRules.reduce((currentTokens, rule) => {
    const posSet = toSetFromPipeList(rule.part_of_speech);
    if (!posSet.size) {
      return currentTokens;
    }

    if (rule.action === 'keep') {
      return currentTokens.filter((token) => posSet.has(token.pos));
    }

    if (rule.action === 'drop') {
      return currentTokens.filter((token) => !posSet.has(token.pos));
    }

    return currentTokens;
  }, tokens);
}

function applyStopwords(tokens, stopwords) {
  const words = new Set(
    stopwords
      .filter((rule) => asBoolean(rule.enabled))
      .map((rule) => String(rule.word ?? '').trim())
      .filter(Boolean)
  );

  if (!words.size) {
    return tokens;
  }

  return tokens.filter((token) => !words.has(token.surfaceForm) && !words.has(token.basicForm));
}

function mergeTokens(tokens, match, rule) {
  const spanTokens = tokens.slice(match.start, match.end + 1);
  const mergedSurface = String(rule.surface ?? '').trim() || tokensToSurface(tokens, match.start, match.end + 1);
  const mergedBase = String(rule.base ?? '').trim() || mergedSurface;
  const mergedPos = String(rule.pos ?? '').trim() || '名詞';

  return {
    surfaceForm: mergedSurface,
    pos: mergedPos,
    posDetail: '複合語',
    basicForm: mergedBase,
    reading: '-',
    pronunciation: '-',
    mergedFrom: spanTokens
  };
}

function applyCompoundMerges(tokens, rules, ruleErrors) {
  let currentTokens = [...tokens];

  sortRules(rules).forEach((rule) => {
    if (!rule.pattern) {
      return;
    }

    let compiled;
    try {
      compiled = compileTokenPattern(rule.pattern);
    } catch (error) {
      ruleErrors.push({
        stage: 'tokenfilter',
        file: 'config/kuromoji/compound-rules.csv',
        ruleId: rule.id || '(no-id)',
        message: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    const matches = findPatternMatches(currentTokens, compiled, { allowOverlap: false });
    if (!matches.length) {
      return;
    }

    const merged = [];
    const matchByStart = new Map(matches.map((match) => [match.start, match]));

    for (let index = 0; index < currentTokens.length; index += 1) {
      const match = matchByStart.get(index);
      if (!match) {
        merged.push(currentTokens[index]);
        continue;
      }

      merged.push(mergeTokens(currentTokens, match, rule));
      index = match.end;
    }

    currentTokens = merged;
  });

  return currentTokens;
}

export async function runTokenFilter(tokens) {
  const filterRules = await loadCsvConfig('config/kuromoji/token-filters.csv');
  const stopwordRules = await loadCsvConfig('config/preprocess/stopwords.csv');
  const compoundRules = await loadCsvConfig('config/kuromoji/compound-rules.csv');

  const ruleErrors = [];
  const posFilteredTokens = applyPartOfSpeechFilters([...tokens], sortRules(filterRules));
  const stopwordFilteredTokens = applyStopwords(posFilteredTokens, stopwordRules);
  const mergedTokens = applyCompoundMerges(stopwordFilteredTokens, compoundRules, ruleErrors);

  return {
    tokens: mergedTokens,
    ruleErrors,
    applied: {
      posFilters: sortRules(filterRules).map((rule) => rule.id || '(no-id)'),
      stopwords: stopwordRules.filter((rule) => asBoolean(rule.enabled)).map((rule) => rule.word).filter(Boolean),
      compounds: sortRules(compoundRules).map((rule) => rule.id || '(no-id)')
    }
  };
}
