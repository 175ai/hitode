import { loadCsvConfig } from '../../utils/csv-loader.js';

function asBoolean(value) {
  return String(value).toLowerCase() === 'true' || value === '1';
}

function joinSurface(tokens) {
  return tokens.map((token) => token.surfaceForm).join('');
}

function isNoun(token) {
  if (!token) {
    return false;
  }

  return token.pos === '名詞';
}

function isPrefix(token) {
  if (!token) {
    return false;
  }

  return token.pos === '接頭詞';
}

function isParticle(token, particle) {
  if (!token) {
    return false;
  }

  return token.pos === '助詞' && token.surfaceForm === particle;
}

function isSuruVerb(token) {
  if (!token) {
    return false;
  }

  if (token.pos !== '動詞') {
    return false;
  }

  return token.basicForm === 'する' || token.surfaceForm.startsWith('し');
}

function isPhraseToken(token) {
  if (!token) {
    return false;
  }

  return token.pos === '名詞' || token.pos === '接頭詞' || token.pos === '形容詞';
}

function isParticleConnectorToken(token) {
  if (!token) {
    return false;
  }

  return token.pos === '助詞' && (token.surfaceForm === 'の' || token.surfaceForm === 'な');
}

function isPhraseBoundary(token) {
  if (!token) {
    return true;
  }

  if (token.pos === '記号' || token.pos === '接続詞' || token.pos === '助動詞') {
    return true;
  }

  if (token.pos === '助詞' && !isParticleConnectorToken(token)) {
    return true;
  }

  return false;
}

function collectArgumentPhrase(tokens, particleIndex) {
  let startIndex = particleIndex - 1;

  while (startIndex >= 0 && !isPhraseBoundary(tokens[startIndex]) && (isPhraseToken(tokens[startIndex]) || isParticleConnectorToken(tokens[startIndex]))) {
    startIndex -= 1;
  }

  const tokenIndices = [];
  const phraseTokens = [];

  for (let index = startIndex + 1; index < particleIndex; index += 1) {
    if (!tokens[index]) {
      continue;
    }

    phraseTokens.push(tokens[index]);
    tokenIndices.push(index);
  }

  return {
    startIndex: startIndex + 1,
    tokenIndices,
    tokens: phraseTokens,
    surface: joinSurface(phraseTokens)
  };
}

function findNextVerbIndex(tokens, startIndex) {
  return findClausePredicateIndex(tokens, startIndex);
}

function isAuxiliaryLikeVerb(token) {
  if (!token) {
    return false;
  }

  const basicForm = token.basicForm === '-' ? token.surfaceForm : token.basicForm;
  return ['いる', 'れる', 'せる', 'ある', 'くる', 'ない'].includes(basicForm);
}

function findClauseEndIndex(tokens, startIndex) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    if (tokens[index].pos === '記号' && (tokens[index].surfaceForm === '、' || tokens[index].surfaceForm === '。')) {
      return index;
    }
  }

  return tokens.length;
}

function findClausePredicateIndex(tokens, startIndex) {
  const clauseEndIndex = findClauseEndIndex(tokens, startIndex);

  for (let index = clauseEndIndex - 1; index >= startIndex; index -= 1) {
    const token = tokens[index];
    if (token.pos === '動詞' && !isAuxiliaryLikeVerb(token)) {
      return index;
    }
  }

  for (let index = clauseEndIndex - 1; index >= startIndex; index -= 1) {
    if (tokens[index].pos === '動詞') {
      return index;
    }
  }

  return -1;
}

function findFirstClausePredicateIndex(tokens, startIndex) {
  const clauseEndIndex = findClauseEndIndex(tokens, startIndex);

  for (let index = startIndex; index < clauseEndIndex; index += 1) {
    const token = tokens[index];
    if (token.pos === '動詞' && !isAuxiliaryLikeVerb(token)) {
      return index;
    }
  }

  for (let index = startIndex; index < clauseEndIndex; index += 1) {
    if (tokens[index].pos === '動詞') {
      return index;
    }
  }

  return -1;
}

function buildPredicateExpression(tokens, predicateIndex) {
  const predicate = tokens[predicateIndex];
  if (!predicate) {
    return '';
  }

  const previousToken = tokens[predicateIndex - 1];
  if (predicate.basicForm === 'する' && previousToken && previousToken.pos === '名詞') {
    return `${previousToken.surfaceForm}する`;
  }

  return predicate.basicForm && predicate.basicForm !== '-' ? predicate.basicForm : predicate.surfaceForm;
}

function collectPredicateTokenIndices(tokens, predicateIndex) {
  const indices = [];

  if (!Number.isInteger(predicateIndex) || predicateIndex < 0 || predicateIndex >= tokens.length) {
    return indices;
  }

  indices.push(predicateIndex);

  const predicate = tokens[predicateIndex];
  const previousToken = tokens[predicateIndex - 1];
  if (predicate?.basicForm === 'する' && previousToken?.pos === '名詞') {
    indices.unshift(predicateIndex - 1);
  }

  return indices;
}

function createGraphNodeId(kind, index, text) {
  return `${kind}:${index}:${text}`;
}

function collectNounSequence(tokens, startIndex) {
  const collected = [];
  let index = startIndex;

  while (index < tokens.length && isNoun(tokens[index])) {
    collected.push(tokens[index]);
    index += 1;
  }

  return {
    endIndex: index,
    tokens: collected
  };
}

function extractPrefixNounCompounds(tokens) {
  const compounds = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];
    if (!isPrefix(current)) {
      continue;
    }

    const nounSequence = collectNounSequence(tokens, index + 1);
    if (!nounSequence.tokens.length) {
      continue;
    }

    compounds.push({
      type: 'prefix_noun',
      start: index,
      end: nounSequence.endIndex - 1,
      expression: joinSurface([current, ...nounSequence.tokens])
    });
  }

  return compounds;
}

function extractNounSuruCompounds(tokens) {
  const compounds = [];

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const noun = tokens[index];
    const verb = tokens[index + 1];

    if (!isNoun(noun) || !isSuruVerb(verb)) {
      continue;
    }

    compounds.push({
      type: 'noun_suru',
      start: index,
      end: index + 1,
      expression: `${noun.surfaceForm}${verb.basicForm === 'する' ? 'する' : verb.surfaceForm}`
    });
  }

  return compounds;
}

function extractVerbDependencies(tokens, patterns) {
  const dependencies = [];

  patterns.forEach((pattern) => {
    if (!asBoolean(pattern.enabled) || pattern.scope !== 'verb_dependency') {
      return;
    }

    const particle = pattern.pattern;
    if (!particle) {
      return;
    }

    for (let index = 0; index < tokens.length - 2; index += 1) {
      const sourceSequence = collectArgumentPhrase(tokens, index);
      if (!sourceSequence.tokens.length) {
        continue;
      }

      const verbIndex = particle === 'が'
        ? findFirstClausePredicateIndex(tokens, index + 1)
        : findNextVerbIndex(tokens, index + 1);
      if (verbIndex < 0) {
        continue;
      }

      const particleIndex = index;

      if (!isParticle(tokens[particleIndex], particle)) {
        continue;
      }

      const verb = tokens[verbIndex];
      const predicateExpression = buildPredicateExpression(tokens, verbIndex);
      const predicateTokenIndices = collectPredicateTokenIndices(tokens, verbIndex);

      dependencies.push({
        type: pattern.id || 'verb_dependency',
        particle,
        source: sourceSequence.surface,
        sourceIndex: sourceSequence.startIndex,
        sourceTokenIndices: sourceSequence.tokenIndices,
        particleIndex,
        predicateIndex: verbIndex,
        predicateTokenIndices,
        predicate: predicateExpression,
        expression: `${sourceSequence.surface}${particle}${predicateExpression}`,
        tokens: {
          source: sourceSequence.tokens,
          predicate: predicateTokenIndices.map((tokenIndex) => tokens[tokenIndex]).filter(Boolean)
        }
      });
    }
  });

  return dependencies;
}

function extractNounDependencies(tokens, patterns) {
  const dependencies = [];

  patterns.forEach((pattern) => {
    if (!asBoolean(pattern.enabled) || pattern.scope !== 'noun_dependency') {
      return;
    }

    const connector = pattern.pattern;
    if (!connector) {
      return;
    }

    for (let index = 0; index < tokens.length - 2; index += 1) {
      const leftSequence = collectNounSequence(tokens, index);
      if (!leftSequence.tokens.length) {
        continue;
      }

      const connectorIndex = leftSequence.endIndex;
      if (!tokens[connectorIndex] || tokens[connectorIndex].surfaceForm !== connector) {
        continue;
      }

      const rightSequence = collectNounSequence(tokens, connectorIndex + 1);
      if (!rightSequence.tokens.length) {
        continue;
      }

      dependencies.push({
        type: pattern.id || 'noun_dependency',
        connector,
        source: joinSurface(leftSequence.tokens),
        target: joinSurface(rightSequence.tokens),
        expression: `${joinSurface(leftSequence.tokens)}${connector}${joinSurface(rightSequence.tokens)}`
      });
    }
  });

  return dependencies;
}

function buildVerbDependencyGraph(verbDependencies) {
  const nodes = [];
  const edges = [];
  const nodeById = new Map();

  const ensureNode = (node) => {
    if (nodeById.has(node.id)) {
      return nodeById.get(node.id);
    }

    nodeById.set(node.id, node);
    nodes.push(node);
    return node;
  };

  verbDependencies.forEach((dependency) => {
    const predicateId = createGraphNodeId('predicate', dependency.predicateIndex, dependency.predicate);
    const argumentId = createGraphNodeId('argument', dependency.sourceIndex, dependency.source);

    ensureNode({
      id: predicateId,
      kind: 'predicate',
      label: dependency.predicate,
      surface: dependency.predicate
    });

    ensureNode({
      id: argumentId,
      kind: 'argument',
      label: dependency.source,
      surface: dependency.source
    });

    edges.push({
      id: `${argumentId}->${predicateId}:${dependency.particle}`,
      from: argumentId,
      to: predicateId,
      label: dependency.particle,
      expression: `${dependency.source}[${dependency.particle}]${dependency.predicate}`
    });
  });

  return {
    kind: 'verb_dependency_graph',
    nodes,
    edges
  };
}

function buildGraphCoverage(tokens, verbDependencies) {
  const adoptedIndexSet = new Set();
  const roleMap = new Map();

  const addRole = (tokenIndex, role) => {
    if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex >= tokens.length) {
      return;
    }

    adoptedIndexSet.add(tokenIndex);
    if (!roleMap.has(tokenIndex)) {
      roleMap.set(tokenIndex, new Set());
    }
    roleMap.get(tokenIndex).add(role);
  };

  verbDependencies.forEach((dependency) => {
    dependency.sourceTokenIndices.forEach((tokenIndex) => addRole(tokenIndex, 'argument'));
    addRole(dependency.particleIndex, 'particle');
    dependency.predicateTokenIndices.forEach((tokenIndex) => addRole(tokenIndex, 'predicate'));
  });

  const tokenCoverage = tokens.map((token, index) => {
    const roles = roleMap.has(index) ? Array.from(roleMap.get(index)) : [];

    return {
      index,
      surfaceForm: token.surfaceForm,
      adopted: adoptedIndexSet.has(index),
      roles
    };
  });

  return {
    segmentedText: tokens.map((token) => token.surfaceForm).join(' '),
    adoptedCount: adoptedIndexSet.size,
    totalCount: tokens.length,
    tokenCoverage
  };
}

export async function runPostprocess(tokens) {
  const compoundRules = await loadCsvConfig('config/postprocess/compound-rules.csv');
  const dependencyRules = await loadCsvConfig('config/postprocess/dependency-rules.csv');

  const prefixNounCompounds = compoundRules.some((rule) => asBoolean(rule.enabled) && rule.id === 'prefix_noun')
    ? extractPrefixNounCompounds(tokens)
    : [];

  const nounSuruCompounds = compoundRules.some((rule) => asBoolean(rule.enabled) && rule.id === 'noun_suru')
    ? extractNounSuruCompounds(tokens)
    : [];

  const verbDependencies = extractVerbDependencies(tokens, dependencyRules);
  const nounDependencies = extractNounDependencies(tokens, dependencyRules);
  const verbGraph = buildVerbDependencyGraph(verbDependencies);
  const graphCoverage = buildGraphCoverage(tokens, verbDependencies);

  return {
    compounds: [...prefixNounCompounds, ...nounSuruCompounds],
    verbDependencies,
    nounDependencies,
    verbGraph,
    graphCoverage
  };
}
