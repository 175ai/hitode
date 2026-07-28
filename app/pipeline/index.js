import { analyzeText } from './kuromoji/analyzer.js';
import { runPreprocess } from './preprocess/index.js';
import { runPostprocess } from './postprocess/index.js';

export async function analyzePatentText(inputText) {
  const preprocess = await runPreprocess(inputText);
  const originalTokens = await analyzeText(preprocess.originalText);
  const tokens = preprocess.originalText === preprocess.normalizedText
    ? originalTokens
    : await analyzeText(preprocess.normalizedText);
  const postprocess = await runPostprocess(originalTokens);

  return {
    preprocess,
    tokens,
    originalTokens,
    postprocess
  };
}
