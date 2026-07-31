import { analyzeText } from './kuromoji/analyzer.js';
import { runPreprocess } from './preprocess/index.js';
import { runPostprocess } from './postprocess/index.js';
import { runTokenFilter } from './tokenfilter/index.js';

export async function analyzePatentText(inputText) {
  const preprocess = await runPreprocess(inputText);
  const originalTokens = preprocess.originalText === preprocess.normalizedText
    ? await analyzeText(preprocess.originalText)
    : await analyzeText(preprocess.normalizedText);
  const tokenFilter = await runTokenFilter(originalTokens);
  const tokens = tokenFilter.tokens;
  const postprocess = await runPostprocess(tokens);
  const ruleErrors = [...tokenFilter.ruleErrors, ...postprocess.ruleErrors];

  return {
    preprocess,
    tokens,
    originalTokens,
    tokenFilter,
    postprocess,
    ruleErrors
  };
}
