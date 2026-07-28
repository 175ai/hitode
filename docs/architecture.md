# Architecture

## Runtime

- Static SPA (browser only)
- kuromoji.js を動的ロード
- CSV 設定を fetch で読み込み

## Modules

- app/pipeline/preprocess/index.js
	- 数字正規化
	- normalize-rules.csv の regex 置換
	- sentence-rules.csv の請求項構造検出
- app/pipeline/kuromoji/analyzer.js
	- 形態素解析
- app/pipeline/postprocess/index.js
	- 複合名詞/複合動詞抽出
	- 助詞連結の係り受け抽出
- app/utils/csv-loader.js
	- CSV 行パーサ + 設定ロード

## Data Flow

input text
-> preprocess
-> normalized text
-> kuromoji tokenization
-> postprocess extraction
-> UI rendering
