import { loadCsvConfig } from '../../utils/csv-loader.js';
import {
  compileTokenPattern,
  findPatternMatches,
  getCapturedRange,
  tokensToSurface
} from '../rules/token-pattern.js';

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

function sliceTokens(tokens, range) {
  if (!range || !Number.isInteger(range.start) || !Number.isInteger(range.end)) {
    return [];
  }

  if (range.end <= range.start) {
    return [];
  }

  return tokens.slice(range.start, range.end);
}

function joinSurface(tokens) {
  return tokens.map((token) => token.surfaceForm).join('');
}

function normalizePredicate(tokens) {
  if (!tokens.length) {
    return '';
  }

  const lastToken = tokens[tokens.length - 1];
  if (lastToken.basicForm === 'する') {
    let stemStart = tokens.length - 2;
    while (stemStart >= 0 && tokens[stemStart].pos === '名詞') {
      stemStart -= 1;
    }

    const stemTokens = tokens.slice(stemStart + 1, tokens.length - 1);
    if (stemTokens.length) {
      return `${joinSurface(stemTokens)}する`;
    }

    return 'する';
  }

  if (lastToken.basicForm && lastToken.basicForm !== '-') {
    return lastToken.basicForm;
  }

  return joinSurface(tokens);
}

function compileRulePattern(rule, filePath, stage, ruleErrors) {
  try {
    return compileTokenPattern(rule.pattern);
  } catch (error) {
    ruleErrors.push({
      stage,
      file: filePath,
      ruleId: rule.id || '(no-id)',
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

function extractCompounds(tokens, rules, ruleErrors) {
  const compounds = [];

  sortRules(rules).forEach((rule) => {
    if (!rule.pattern) {
      return;
    }

    const compiled = compileRulePattern(rule, 'config/postprocess/compound-rules.csv', 'postprocess', ruleErrors);
    if (!compiled) {
      return;
    }

    const matches = findPatternMatches(tokens, compiled, { allowOverlap: false });
    matches.forEach((match) => {
      compounds.push({
        id: rule.id || '(no-id)',
        type: rule.type || rule.id || 'compound',
        start: match.start,
        end: match.end,
        expression: tokensToSurface(tokens, match.start, match.end + 1)
      });
    });
  });

  return compounds;
}

function extractDependencies(tokens, rules, ruleErrors) {
  const verbDependencies = [];
  const nounDependencies = [];

  sortRules(rules).forEach((rule) => {
    if (!rule.pattern) {
      return;
    }

    const compiled = compileRulePattern(rule, 'config/postprocess/dependency-rules.csv', 'postprocess', ruleErrors);
    if (!compiled) {
      return;
    }

    const matches = findPatternMatches(tokens, compiled, { allowOverlap: false });

    matches.forEach((match) => {
      const kind = String(rule.kind || '').trim();
      const sourceRange = getCapturedRange(match, 'source');
      const particleRange = getCapturedRange(match, 'particle');
      const predicateRange = getCapturedRange(match, 'predicate');
      const connectorRange = getCapturedRange(match, 'connector');
      const targetRange = getCapturedRange(match, 'target');

      const sourceTokens = sliceTokens(tokens, sourceRange);
      const particleTokens = sliceTokens(tokens, particleRange);
      const predicateTokens = sliceTokens(tokens, predicateRange);
      const connectorTokens = sliceTokens(tokens, connectorRange);
      const targetTokens = sliceTokens(tokens, targetRange);

      if (kind === 'verb') {
        if (!sourceTokens.length || !particleTokens.length || !predicateTokens.length) {
          return;
        }

        const source = joinSurface(sourceTokens);
        const particle = joinSurface(particleTokens);
        const predicate = normalizePredicate(predicateTokens);

        verbDependencies.push({
          id: rule.id || '(no-id)',
          type: rule.type || rule.id || 'verb_dependency',
          source,
          particle,
          predicate,
          expression: `${source}${particle}${predicate}`,
          start: match.start,
          end: match.end
        });
        return;
      }

      if (kind === 'noun') {
        if (!sourceTokens.length || !connectorTokens.length || !targetTokens.length) {
          return;
        }

        const source = joinSurface(sourceTokens);
        const connector = joinSurface(connectorTokens);
        const target = joinSurface(targetTokens);

        nounDependencies.push({
          id: rule.id || '(no-id)',
          type: rule.type || rule.id || 'noun_dependency',
          source,
          connector,
          target,
          expression: `${source}${connector}${target}`,
          start: match.start,
          end: match.end
        });
      }
    });
  });

  return {
    verbDependencies: verbDependencies.sort((left, right) => left.start - right.start),
    nounDependencies: nounDependencies.sort((left, right) => left.start - right.start)
  };
}

function renderTemplate(template, record) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_all, key) => {
    const value = record[key];
    return value == null ? '' : String(value);
  });
}

function applyRegexRules(records, rules, filePath, stage, ruleErrors, callback) {
  sortRules(rules).forEach((rule) => {
    if (!rule.pattern) {
      return;
    }

    let regex;
    try {
      regex = new RegExp(rule.pattern);
    } catch (error) {
      ruleErrors.push({
        stage,
        file: filePath,
        ruleId: rule.id || '(no-id)',
        message: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    records.forEach((record) => {
      if (!regex.test(record.expression)) {
        return;
      }

      callback(record, rule);
    });
  });
}

function targetMatches(target, expected) {
  if (!target || target === '*' || target === 'all') {
    return true;
  }

  return target === expected;
}

function applyLabelRules(compounds, verbDependencies, nounDependencies, labelRules, ruleErrors) {
  const apply = (records, expectedTarget) => {
    const scopedRules = labelRules.filter((rule) => targetMatches(rule.target, expectedTarget));
    applyRegexRules(records, scopedRules, 'config/postprocess/label-rules.csv', 'postprocess', ruleErrors, (record, rule) => {
      record.label = rule.label || record.label;
    });
  };

  apply(compounds, 'compound');
  apply(verbDependencies, 'verb_dependency');
  apply(nounDependencies, 'noun_dependency');
}

function applyDisplayRules(compounds, verbDependencies, nounDependencies, displayRules, ruleErrors) {
  const apply = (records, expectedTarget) => {
    const scopedRules = displayRules.filter((rule) => targetMatches(rule.target, expectedTarget));
    applyRegexRules(records, scopedRules, 'config/postprocess/display-rules.csv', 'postprocess', ruleErrors, (record, rule) => {
      record.display = renderTemplate(rule.template || '{expression}', record);
    });
  };

  apply(compounds, 'compound');
  apply(verbDependencies, 'verb_dependency');
  apply(nounDependencies, 'noun_dependency');
}

export async function runPostprocess(tokens) {
  const [compoundRules, dependencyRules, labelRules, displayRules] = await Promise.all([
    loadCsvConfig('config/postprocess/compound-rules.csv'),
    loadCsvConfig('config/postprocess/dependency-rules.csv'),
    loadCsvConfig('config/postprocess/label-rules.csv'),
    loadCsvConfig('config/postprocess/display-rules.csv')
  ]);

  const ruleErrors = [];
  const compounds = extractCompounds(tokens, compoundRules, ruleErrors);
  const { verbDependencies, nounDependencies } = extractDependencies(tokens, dependencyRules, ruleErrors);

  applyLabelRules(compounds, verbDependencies, nounDependencies, labelRules, ruleErrors);
  applyDisplayRules(compounds, verbDependencies, nounDependencies, displayRules, ruleErrors);

  return {
    compounds,
    verbDependencies,
    nounDependencies,
    ruleErrors
  };
}
