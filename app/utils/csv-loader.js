import { getAppBasePath } from './base-path.js';

const DEFAULT_CSV_CONFIGS = {
  'config/preprocess/normalize-rules.csv': `id,enabled,pattern,replacement,priority,note
normalize_whitespace,true,\\s+, ,90,余分な空白を単一スペースに正規化`,
  'config/preprocess/sentence-rules.csv': `id,enabled,pattern,replacement,priority,note
claim_frame_deatte,true,([^。]*?であって、[^。]*。),claim_frame,10,請求項の構文「〇〇であって、〜〇〇。」を検出`,
  'config/postprocess/compound-rules.csv': `id,enabled,scope,pattern,replacement,priority,note
prefix_noun,true,compound,接頭詞+名詞,compound_noun,10,接頭詞と連続名詞を複合名詞として抽出
noun_suru,true,compound,名詞+する,compound_verb,20,名詞+する系の複合動詞を抽出
consecutive_nouns,true,compound,名詞連続,compound_noun,30,名詞が連続する場合に複合名詞として抽出`,
  'config/postprocess/dependency-rules.csv': `id,enabled,scope,pattern,replacement,priority,note
verb_dep_ni,true,verb_dependency,に,ni_case,10,〇〇に〇〇する の係り受け
verb_dep_wo,true,verb_dependency,を,wo_case,20,〇〇を〇〇する の係り受け
verb_dep_ga,true,verb_dependency,が,ga_case,30,〇〇が〇〇される の係り受け
verb_dep_kara,true,verb_dependency,から,kara_case,35,〇〇から〇〇する の係り受け
noun_dep_no,true,noun_dependency,の,no_case,40,〇〇の〇〇 の係り受け
noun_dep_na,true,noun_dependency,な,na_case,50,〇〇な〇〇 の係り受け`
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
