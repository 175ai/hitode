import { analyzePatentText } from './pipeline/index.js';
import { preloadAnalyzerResources } from './pipeline/kuromoji/analyzer.js';
import { createAppView, renderResults, setStatus } from './ui/app-view.js';

const app = document.querySelector('#app');

if (app) {
  const view = createAppView();
  app.appendChild(view.root);

  let warmupPromise = null;

  const warmUpAnalyzer = () => {
    if (warmupPromise) {
      return warmupPromise;
    }

    warmupPromise = preloadAnalyzerResources()
      .then(() => {
        setStatus(view.status, '辞書の準備が完了しました。');
      })
      .catch(() => {
        setStatus(view.status, '辞書の先読みに失敗しました。解析実行時に再試行します。', true);
      });

    return warmupPromise;
  };

  const runAnalysis = async () => {
    const text = view.input.value;
    setStatus(view.status, '解析中…');

    try {
      const result = await analyzePatentText(text);
      renderResults(view.resultOutput, view.resultCount, result);
      setStatus(view.status, '解析が完了しました。');
    } catch (error) {
      view.resultOutput.innerHTML = '<p class="empty-state">解析に失敗しました。</p>';
      const message = error instanceof Error ? error.message : String(error);
      setStatus(view.status, message, true);
    }
  };

  view.analyzeButton.addEventListener('click', async () => {
    await warmUpAnalyzer();
    await runAnalysis();
  });

  view.sampleButton.addEventListener('click', () => {
    view.input.value = '特許文書解析器で入力したテキストを形態素解析します。';
    setStatus(view.status, 'サンプルを読み込みました。');
  });

  view.input.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void warmUpAnalyzer();
      void runAnalysis();
    }
  });

  void warmUpAnalyzer();
}
