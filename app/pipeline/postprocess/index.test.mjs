import test from 'node:test';
import assert from 'node:assert/strict';

const compoundCsv = `id,enabled,scope,pattern,replacement,priority,note
prefix_noun,true,compound,接頭詞+名詞,compound_noun,10,接頭詞と連続名詞を複合名詞として抽出
noun_suru,true,compound,名詞+する,compound_verb,20,名詞+する系の複合動詞を抽出
consecutive_nouns,true,compound,名詞連続,compound_noun,30,名詞が連続する場合に複合名詞として抽出
`;

const dependencyCsv = `id,enabled,scope,pattern,replacement,priority,note
`;

const originalFetch = globalThis.fetch;

function installFetchStub() {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    const path = new URL(url, 'http://localhost').pathname.replace(/^\/+/, '');

    if (path === 'config/postprocess/compound-rules.csv') {
      return {
        ok: true,
        async text() {
          return compoundCsv;
        }
      };
    }

    if (path === 'config/postprocess/dependency-rules.csv') {
      return {
        ok: true,
        async text() {
          return dependencyCsv;
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

test('extracts consecutive noun runs as compound nouns', async () => {
  installFetchStub();

  const { runPostprocess } = await import('./index.js');
  const result = await runPostprocess([
    { surfaceForm: '特許', pos: '名詞', basicForm: '特許' },
    { surfaceForm: '請求', pos: '名詞', basicForm: '請求' },
    { surfaceForm: '項', pos: '名詞', basicForm: '項' },
    { surfaceForm: '方法', pos: '名詞', basicForm: '方法' }
  ]);

  const consecutiveNounCompounds = result.compounds.filter((compound) => compound.type === 'consecutive_nouns');

  assert.equal(consecutiveNounCompounds.length, 1);
  assert.equal(consecutiveNounCompounds[0].expression, '特許請求項方法');
  assert.deepEqual([consecutiveNounCompounds[0].start, consecutiveNounCompounds[0].end], [0, 3]);

  globalThis.fetch = originalFetch;
});
