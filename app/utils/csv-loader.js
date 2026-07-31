import { getAppBasePath } from './base-path.js';

const DEFAULT_CSV_CONFIGS = {
  'config/preprocess/normalize-rules.csv': `id,enabled,pattern,replacement,priority,note
normalize_whitespace,true,\\s+, ,90,余分な空白を単一スペースに正規化`,
  'config/preprocess/sentence-rules.csv': `id,enabled,pattern,replacement,priority,note
claim_frame_deatte,true,([^。]*?であって、[^。]*。),claim_frame,10,請求項の構文「〇〇であって、〜〇〇。」を検出`,
  'config/preprocess/stopwords.csv': `word,enabled,note
`,
  'config/kuromoji/token-filters.csv': `id,enabled,part_of_speech,action,priority,note
drop_symbols,false,記号,drop,10,必要に応じて記号を除去`,
  'config/kuromoji/compound-rules.csv': `id,enabled,pattern,surface,pos,base,priority,note
`,
  'config/postprocess/compound-rules.csv': `id,enabled,scope,pattern,replacement,priority,note
compound_prefix_noun,true,<pos=接頭詞><pos=名詞>+,compound_noun,10,接頭詞+名詞連続を抽出
compound_noun_suru,true,<pos=名詞>+<pos=動詞 base=する>,compound_verb,20,名詞+するを抽出
compound_noun_chain,true,"<pos=名詞>{2,}",compound_noun,30,名詞連続を抽出`,
  'config/postprocess/dependency-rules.csv': `id,enabled,kind,pattern,type,priority,note
verb_dep_wo,true,verb,(?<source><pos=接頭詞|名詞>+)(?<particle><pos=助詞 surface=を>)(?<predicate><pos=名詞>*<pos=動詞 base=する>),wo_case,10,を格の係り受け
verb_dep_ni,true,verb,(?<source><pos=接頭詞|名詞>+)(?<particle><pos=助詞 surface=に>)(?<predicate><pos=名詞>*<pos=動詞 base=する>),ni_case,20,に格の係り受け
verb_dep_ga,true,verb,(?<source><pos=接頭詞|名詞>+)(?<particle><pos=助詞 surface=が>)(?<predicate><pos=名詞>*<pos=動詞>),ga_case,30,が格の係り受け
noun_dep_no,true,noun,(?<source><pos=名詞>+)(?<connector><pos=助詞 surface=の>)(?<target><pos=名詞>+),no_case,40,の連体係り受け
noun_dep_na,true,noun,(?<source><pos=名詞|形容詞>+)(?<connector><pos=助詞 surface=な>)(?<target><pos=名詞>+),na_case,50,な連体係り受け`,
  'config/postprocess/label-rules.csv': `id,enabled,target,pattern,label,priority,note
label_parse,true,verb_dependency,解析する$,解析アクション,10,語尾が解析するの結果にラベル付与
label_extract,true,verb_dependency,抽出する$,抽出アクション,20,語尾が抽出するの結果にラベル付与`,
  'config/postprocess/display-rules.csv': `id,enabled,target,pattern,template,priority,note
display_compound,true,compound,.*, {type} | {expression},10,複合語表示
display_verb_dep,true,verb_dependency,.*, {source} | {particle} | {predicate},10,動詞係り受け表示
display_noun_dep,true,noun_dependency,.*, {source} | {connector} | {target},10,名詞係り受け表示`
};

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (!lines.length) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return row;
  });
}

export async function loadCsvConfig(relativePath) {
  const basePath = getAppBasePath();

  try {
    const response = await fetch(`${basePath}${relativePath}`);

    if (!response.ok) {
      throw new Error(`設定ファイルを取得できませんでした: ${relativePath}`);
    }

    const text = await response.text();
    return parseCsv(text);
  } catch (error) {
    const fallbackText = DEFAULT_CSV_CONFIGS[relativePath];
    if (fallbackText) {
      return parseCsv(fallbackText);
    }

    throw new Error(`設定ファイルの読み込みに失敗しました: ${relativePath}`);
  }
}
