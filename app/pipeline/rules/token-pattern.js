const TOKEN_FIELD_MAP = {
  pos: 'pos',
  detail: 'posDetail',
  surface: 'surfaceForm',
  base: 'basicForm',
  reading: 'reading',
  pronunciation: 'pronunciation'
};

function createParser(pattern) {
  let cursor = 0;

  function error(message) {
    throw new Error(`${message} at column ${cursor + 1}`);
  }

  function skipWhitespace() {
    while (cursor < pattern.length && /\s/.test(pattern[cursor])) {
      cursor += 1;
    }
  }

  function consume(expected) {
    if (pattern[cursor] !== expected) {
      error(`Expected '${expected}'`);
    }

    cursor += 1;
  }

  function parseValueList(rawValue) {
    return rawValue
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function parseConstraints(raw) {
    const segments = raw
      .trim()
      .split(/\s+/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (!segments.length) {
      throw new Error('Empty constraint set');
    }

    return segments.map((segment) => {
      const separator = segment.indexOf('=');
      if (separator < 1) {
        throw new Error(`Invalid constraint '${segment}'`);
      }

      const key = segment.slice(0, separator).trim();
      const value = segment.slice(separator + 1).trim();
      if (!TOKEN_FIELD_MAP[key]) {
        throw new Error(`Unsupported token attribute '${key}'`);
      }

      const values = parseValueList(value);
      if (!values.length) {
        throw new Error(`Missing value for '${key}'`);
      }

      return { key, values };
    });
  }

  function parseQuantifier() {
    const char = pattern[cursor];
    if (char === '?') {
      cursor += 1;
      return { min: 0, max: 1 };
    }

    if (char === '*') {
      cursor += 1;
      return { min: 0, max: Number.POSITIVE_INFINITY };
    }

    if (char === '+') {
      cursor += 1;
      return { min: 1, max: Number.POSITIVE_INFINITY };
    }

    if (char !== '{') {
      return null;
    }

    cursor += 1;
    const end = pattern.indexOf('}', cursor);
    if (end < 0) {
      error('Unclosed quantifier');
    }

    const raw = pattern.slice(cursor, end).trim();
    cursor = end + 1;

    if (!raw.length) {
      throw new Error('Empty quantifier body');
    }

    const range = raw.split(',').map((part) => part.trim());
    if (range.length === 1) {
      const fixed = Number(range[0]);
      if (!Number.isInteger(fixed) || fixed < 0) {
        throw new Error(`Invalid quantifier '${raw}'`);
      }

      return { min: fixed, max: fixed };
    }

    if (range.length !== 2) {
      throw new Error(`Invalid quantifier '${raw}'`);
    }

    const min = Number(range[0]);
    const max = range[1] === '' ? Number.POSITIVE_INFINITY : Number(range[1]);

    if (!Number.isInteger(min) || min < 0) {
      throw new Error(`Invalid quantifier min '${raw}'`);
    }

    if (!(Number.isInteger(max) || max === Number.POSITIVE_INFINITY) || max < min) {
      throw new Error(`Invalid quantifier max '${raw}'`);
    }

    return { min, max };
  }

  function withQuantifier(node) {
    skipWhitespace();
    const quantifier = parseQuantifier();
    if (!quantifier) {
      return node;
    }

    return {
      type: 'repeat',
      node,
      min: quantifier.min,
      max: quantifier.max
    };
  }

  function parseAtom() {
    skipWhitespace();
    if (cursor >= pattern.length) {
      error('Unexpected end of pattern');
    }

    if (pattern.startsWith('(?<', cursor)) {
      cursor += 3;
      const endOfName = pattern.indexOf('>', cursor);
      if (endOfName < 0) {
        error('Unclosed capture name');
      }

      const name = pattern.slice(cursor, endOfName).trim();
      if (!name) {
        throw new Error('Capture name cannot be empty');
      }

      cursor = endOfName + 1;
      const nodes = parseSequence(')');
      consume(')');

      return withQuantifier({
        type: 'capture',
        name,
        nodes
      });
    }

    if (pattern[cursor] === '<') {
      cursor += 1;
      const end = pattern.indexOf('>', cursor);
      if (end < 0) {
        error('Unclosed token selector');
      }

      const rawConstraints = pattern.slice(cursor, end);
      cursor = end + 1;

      return withQuantifier({
        type: 'atom',
        constraints: parseConstraints(rawConstraints)
      });
    }

    if (pattern[cursor] === '.') {
      cursor += 1;
      return withQuantifier({ type: 'wildcard' });
    }

    error(`Unexpected token '${pattern[cursor]}'`);
    return null;
  }

  function parseSequence(untilChar = null) {
    const nodes = [];

    while (cursor < pattern.length) {
      skipWhitespace();
      if (cursor >= pattern.length) {
        break;
      }

      if (untilChar && pattern[cursor] === untilChar) {
        break;
      }

      nodes.push(parseAtom());
    }

    return nodes;
  }

  return {
    parse() {
      const nodes = parseSequence();
      skipWhitespace();

      if (cursor !== pattern.length) {
        error('Unexpected trailing characters');
      }

      if (!nodes.length) {
        throw new Error('Pattern must not be empty');
      }

      return nodes;
    }
  };
}

function tokenMatchesConstraint(token, constraint) {
  const field = TOKEN_FIELD_MAP[constraint.key];
  const tokenValue = token?.[field] ?? '';
  return constraint.values.includes(String(tokenValue));
}

function cloneCaptures(captures) {
  return { ...captures };
}

function runSequence(nodes, tokens, nodeIndex, startIndex, captures) {
  if (nodeIndex >= nodes.length) {
    return [{ index: startIndex, captures }];
  }

  const currentNode = nodes[nodeIndex];
  const currentStates = runNode(currentNode, tokens, startIndex, captures);
  const nextStates = [];

  currentStates.forEach((state) => {
    const chained = runSequence(nodes, tokens, nodeIndex + 1, state.index, state.captures);
    nextStates.push(...chained);
  });

  return nextStates;
}

function runRepeat(node, tokens, startIndex, captures) {
  const states = [];
  const upperBound = node.max === Number.POSITIVE_INFINITY
    ? tokens.length - startIndex
    : Math.min(node.max, tokens.length - startIndex);

  function walk(count, cursor, localCaptures) {
    if (count >= node.min) {
      states.push({ index: cursor, captures: localCaptures });
    }

    if (count >= upperBound) {
      return;
    }

    const repeatedStates = runNode(node.node, tokens, cursor, localCaptures)
      .filter((state) => state.index > cursor);

    repeatedStates.forEach((state) => {
      walk(count + 1, state.index, state.captures);
    });
  }

  walk(0, startIndex, captures);

  // Greedy preference: consume longer spans first.
  states.sort((left, right) => right.index - left.index);
  return states;
}

function runNode(node, tokens, startIndex, captures) {
  if (node.type === 'wildcard') {
    if (startIndex >= tokens.length) {
      return [];
    }

    return [{ index: startIndex + 1, captures }];
  }

  if (node.type === 'atom') {
    if (startIndex >= tokens.length) {
      return [];
    }

    const token = tokens[startIndex];
    const matched = node.constraints.every((constraint) => tokenMatchesConstraint(token, constraint));
    return matched ? [{ index: startIndex + 1, captures }] : [];
  }

  if (node.type === 'capture') {
    const innerStates = runSequence(node.nodes, tokens, 0, startIndex, captures);
    return innerStates.map((state) => {
      const nextCaptures = cloneCaptures(state.captures);
      nextCaptures[node.name] = {
        start: startIndex,
        end: state.index
      };

      return {
        index: state.index,
        captures: nextCaptures
      };
    });
  }

  if (node.type === 'repeat') {
    return runRepeat(node, tokens, startIndex, captures);
  }

  return [];
}

export function compileTokenPattern(pattern) {
  const parser = createParser(String(pattern ?? '').trim());
  return {
    pattern,
    nodes: parser.parse()
  };
}

export function findPatternMatches(tokens, compiledPattern, options = {}) {
  const allowOverlap = options.allowOverlap === true;
  const matches = [];

  for (let startIndex = 0; startIndex < tokens.length; startIndex += 1) {
    const states = runSequence(compiledPattern.nodes, tokens, 0, startIndex, {})
      .filter((state) => state.index > startIndex);

    if (!states.length) {
      continue;
    }

    states.sort((left, right) => right.index - left.index);
    const selected = states[0];

    matches.push({
      start: startIndex,
      end: selected.index - 1,
      captures: selected.captures
    });

    if (!allowOverlap) {
      startIndex = selected.index - 1;
    }
  }

  return matches;
}

export function tokensToSurface(tokens, start, end) {
  return tokens.slice(start, end).map((token) => token.surfaceForm).join('');
}

export function getCapturedRange(match, name) {
  return match?.captures?.[name] ?? null;
}
