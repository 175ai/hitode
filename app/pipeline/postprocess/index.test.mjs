import test from 'node:test';
import assert from 'node:assert/strict';

const compoundCsv = `id,enabled,pattern,type,priority,note
compound_prefix_noun,true,<pos=接頭詞><pos=名詞>+,compound_noun,10,接頭詞+名詞連続を抽出
compound_noun_suru,true,<pos=名詞>+<pos=動詞 base=する>,compound_verb,20,名詞+するを抽出
compound_noun_chain,true,"<pos=名詞>{2,}",compound_noun,30,名詞連続を抽出
`;

const dependencyCsv = `id,enabled,kind,pattern,type,priority,note
verb_dep_wo,true,verb,(?<source><pos=接頭詞|名詞>+)(?<particle><pos=助詞 surface=を>)(?<predicate><pos=名詞>*<pos=動詞 base=する>),wo_case,10,を格の係り受け
verb_dep_ni,true,verb,(?<source><pos=接頭詞|名詞>+)(?<particle><pos=助詞 surface=に>)(?<predicate><pos=名詞>*<pos=動詞 base=する>),ni_case,20,に格の係り受け
noun_dep_no,true,noun,(?<source><pos=名詞>+)(?<connector><pos=助詞 surface=の>)(?<target><pos=名詞>+),no_case,30,の連体係り受け
`;

const labelCsv = `id,enabled,target,pattern,label,priority,note
label_parse,true,verb_dependency,解析する$,解析アクション,10,語尾が解析するの結果にラベル付与
label_extract,true,verb_dependency,抽出する$,抽出アクション,20,語尾が抽出するの結果にラベル付与
`;

const displayCsv = `id,enabled,target,pattern,template,priority,note
display_compound,true,compound,.*,"{type} | {expression}",10,複合語表示
display_verb_dep,true,verb_dependency,.*,"{source} | {particle} | {predicate}",10,動詞係り受け表示
display_noun_dep,true,noun_dependency,.*,"{source} | {connector} | {target}",10,名詞係り受け表示
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

    if (path === 'config/postprocess/label-rules.csv') {
      return {
        ok: true,
        async text() {
          return labelCsv;
        }
      };
    }

    if (path === 'config/postprocess/display-rules.csv') {
      return {
        ok: true,
        async text() {
          return displayCsv;
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

test('extracts data-driven compounds and dependencies for sample sentence', async () => {
  installFetchStub();

  const { runPostprocess } = await import('./index.js');
  const tokens = [
    { surfaceForm: '入力', pos: '動詞', basicForm: '入力' },
    { surfaceForm: 'さ', pos: '動詞', basicForm: 'する' },
    { surfaceForm: 'れ', pos: '動詞', basicForm: 'れる' },
    { surfaceForm: 'た', pos: '助動詞', basicForm: 'た' },
    { surfaceForm: 'テキスト', pos: '名詞', basicForm: 'テキスト' },
    { surfaceForm: 'を', pos: '助詞', basicForm: 'を' },
    { surfaceForm: '形態素', pos: '名詞', basicForm: '形態素' },
    { surfaceForm: '解析', pos: '名詞', basicForm: '解析' },
    { surfaceForm: 'し', pos: '動詞', basicForm: 'する' },
    { surfaceForm: '、', pos: '記号', basicForm: '、' },
    { surfaceForm: '複合語', pos: '名詞', basicForm: '複合語' },
    { surfaceForm: 'を', pos: '助詞', basicForm: 'を' },
    { surfaceForm: '抽出', pos: '名詞', basicForm: '抽出' },
    { surfaceForm: 'し', pos: '動詞', basicForm: 'する' },
    { surfaceForm: '、', pos: '記号', basicForm: '、' },
    { surfaceForm: '助詞', pos: '名詞', basicForm: '助詞' },
    { surfaceForm: 'に', pos: '助詞', basicForm: 'に' },
    { surfaceForm: '着目', pos: '名詞', basicForm: '着目' },
    { surfaceForm: 'し', pos: '動詞', basicForm: 'する' },
    { surfaceForm: 'て', pos: '助詞', basicForm: 'て' },
    { surfaceForm: '係り受け構造', pos: '名詞', basicForm: '係り受け構造' },
    { surfaceForm: 'を', pos: '助詞', basicForm: 'を' },
    { surfaceForm: '解析', pos: '名詞', basicForm: '解析' },
    { surfaceForm: 'し', pos: '動詞', basicForm: 'する' },
    { surfaceForm: 'ます', pos: '助動詞', basicForm: 'ます' },
    { surfaceForm: '。', pos: '記号', basicForm: '。' }
  ];

  const result = await runPostprocess(tokens);

  const actualDependencies = result.verbDependencies
    .map((dependency) => `${dependency.particle}|${dependency.expression}`);

  assert.deepEqual(actualDependencies, [
    'を|テキストを形態素解析する',
    'を|複合語を抽出する',
    'に|助詞に着目する',
    'を|係り受け構造を解析する'
  ]);

  assert.ok(result.compounds.length > 0);
  assert.equal(result.ruleErrors.length, 0);

  assert.equal(result.verbDependencies[0].display, 'テキスト | を | 形態素解析する');
  assert.equal(result.verbDependencies[0].label, '解析アクション');

  globalThis.fetch = originalFetch;
});
