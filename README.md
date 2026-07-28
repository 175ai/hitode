# hitode-特許文書解析器

Single-page static web app for patent text structural analysis using kuromoji.js and editable CSV rules.

## kuromoji.js 利用時の注意点

- `file://` 直開きでは動作しません。辞書ファイル (`*.dat.gz`) の取得が必要なため、必ずローカルサーバまたは GitHub Pages 上で実行してください。
- `vendor/kuromoji/kuromoji.js` と `vendor/kuromoji/dic/*.dat.gz` はセットで管理してください。片方だけ更新すると辞書ロードに失敗する場合があります。
- GitHub Pages へ公開する場合は、`vendor/kuromoji/dic/*.dat.gz` が配信対象に含まれていることを確認してください。
- 解析初回実行時は辞書読み込みのため時間がかかります。ネットワークエラーが出た場合は再実行してください（初期化失敗時は再試行可能な実装です）。

## ライセンス

- 本プロジェクトは kuromoji.js を利用しています。
- 同梱ファイル:
	- `vendor/kuromoji/kuromoji.js` (kuromoji.js 本体)
	- `vendor/kuromoji/dic/*.dat.gz` (kuromoji.js 辞書データ)
- kuromoji.js のライセンスは Apache-2.0 です。
- 参照元: `node_modules/kuromoji/LICENSE-2.0.txt`, `node_modules/kuromoji/NOTICE.md`

再配布時は Apache-2.0 の条件に従い、必要なライセンス表記および NOTICE を同梱してください。

## 配布向け文書

- 配布チェックリスト: `docs/distribution-guide.md`
- ライセンスノート: `docs/license-notes.md`
- 第三者通知一式: `vendor/third-party-notices/`
