import test from 'node:test';
import assert from 'node:assert/strict';

const tokenFilterCsv = `id,enabled,part_of_speech,action,priority,note
drop_particles,true,助詞,drop,10,助詞を除去
`;

const stopwordsCsv = `word,enabled,note
サンプル,true,不要語
`;

const compoundCsv = `id,enabled,pattern,surface,pos,base,priority,note
merge_kaiseki_kouzou,true,<surface=解析><surface=構造>,解析構造,名詞,解析構造,10,連続語結合
`;

const originalFetch = globalThis.fetch;

function installFetchStub() {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    const path = new URL(url, 'http://localhost').pathname.replace(/^\/+/, '');

    if (path === 'config/kuromoji/token-filters.csv') {
      return {
        ok: true,
        async text() {
          return tokenFilterCsv;
        }
      };
    }

    if (path === 'config/preprocess/stopwords.csv') {
      return {
        ok: true,
        async text() {
          return stopwordsCsv;
        }
      };
    }

    if (path === 'config/kuromoji/compound-rules.csv') {
      return {
        ok: true,
        async text() {
          return compoundCsv;
        }
      };
    }

    return {
      ok: false,
      async text() {
        return '';
      }
    };
  };
}

test('applies POS filter, stopwords, and token merges from CSV rules', async () => {
  installFetchStub();

  const { runTokenFilter } = await import('./index.js');
  const result = await runTokenFilter([
    { surfaceForm: 'サンプル', pos: '名詞', basicForm: 'サンプル', posDetail: '*', reading: '-', pronunciation: '-' },
    { surfaceForm: '解析', pos: '名詞', basicForm: '解析', posDetail: '*', reading: '-', pronunciation: '-' },
    { surfaceForm: '構造', pos: '名詞', basicForm: '構造', posDetail: '*', reading: '-', pronunciation: '-' },
    { surfaceForm: 'を', pos: '助詞', basicForm: 'を', posDetail: '*', reading: '-', pronunciation: '-' }
  ]);

  assert.deepEqual(result.tokens.map((token) => token.surfaceForm), ['解析構造']);
  assert.equal(result.ruleErrors.length, 0);

  globalThis.fetch = originalFetch;
});
