import { getAppBasePath } from '../../utils/base-path.js';

let tokenizerPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }

      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

function resolveDictionaryPath() {
  const basePath = getAppBasePath();
  return `${basePath}vendor/kuromoji/dic`;
}

function resolveLocalKuromojiPath() {
  const basePath = getAppBasePath();
  return `${basePath}vendor/kuromoji/kuromoji.js`;
}

async function getTokenizer() {
  if (tokenizerPromise) {
    return tokenizerPromise;
  }

  tokenizerPromise = (async () => {
    if (!window.kuromoji) {
      try {
        await loadScript(resolveLocalKuromojiPath());
      } catch (_localError) {
        await loadScript('https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js');
      }
    }

    if (!window.kuromoji) {
      throw new Error('kuromoji.js を読み込めませんでした。');
    }

    return new Promise((resolve, reject) => {
      window.kuromoji.builder({ dicPath: resolveDictionaryPath() }).build((error, tokenizer) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(tokenizer);
      });
    });
  })();

  try {
    return await tokenizerPromise;
  } catch (error) {
    tokenizerPromise = null;
    throw error;
  }
}

export async function analyzeText(text) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new Error('解析対象のテキストを入力してください。');
  }

  const tokenizer = await getTokenizer();
  const tokens = tokenizer.tokenize(normalizedText);

  return tokens.map((token) => ({
    surfaceForm: token.surface_form,
    pos: token.pos,
    posDetail: token.pos_detail_1,
    basicForm: token.basic_form || '-',
    reading: token.reading || '-',
    pronunciation: token.pronunciation || '-'
  }));
}
