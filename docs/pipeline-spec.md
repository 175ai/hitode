# Pipeline Spec

## Goal

本アプリは、特許請求項テキストを対象に、構成要素ごとの係り受け構造を抽出可能な中間表現を生成する。

## Pipeline

1. Preprocess
2. Tokenize (kuromoji)
3. Postprocess
4. Render / Export

## Preprocess

### Built-in

- 全角数字を半角数字に正規化する。

### Rule-driven (CSV)

- config/preprocess/normalize-rules.csv
	- 正規表現置換ルールを priority 順で適用する。
- config/preprocess/sentence-rules.csv
	- 請求項固有構造を検出する。
	- 例: 〇〇であって、〜〇〇。

### Output

- originalText
- normalizedText
- claimFrameDetections[]
	- ruleId
	- label
	- matchedText
	- start
	- end

## Postprocess

### Rule-driven (CSV)

- config/postprocess/compound-rules.csv
	- prefix_noun: 接頭詞 + 名詞連接
	- noun_suru: 名詞 + する
- config/postprocess/dependency-rules.csv
	- verb_dependency: に / を / が
	- noun_dependency: の / な

### Output

- compounds[]
	- type
	- expression
	- start
	- end
- verbDependencies[]
	- particle
	- source
	- predicate
	- expression
- nounDependencies[]
	- connector
	- source
	- target
	- expression

## Extensibility Design

- ルール追加時は CSV に行を追加するだけで有効化できる。
- 無効化は enabled=false で可能。
- 解析ロジック側は scope / id ベースでディスパッチし、将来ルールの追加削除に追従しやすくする。
- 不正な regex ルールはスキップし、解析を継続する。

## Next Evolution

- dependency-rules.csv に window size / 品詞制約列を追加し、誤抽出を段階的に抑制する。
- 係り受け結果を JSON 出力形式として固定し、下流処理との I/F を安定化する。
