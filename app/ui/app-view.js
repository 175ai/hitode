const sampleText = '特許文書解析器で入力したテキストを形態素解析します。';

export function createAppView() {
  const root = document.createElement('div');
  root.className = 'app-shell';
  root.innerHTML = `
    <header class="hero">
      <p class="eyebrow">Static SPA / kuromoji.js</p>
      <h1>hitode 解析ビュー</h1>
      <p class="hero-copy">入力したテキストを解析して、形態素ごとの情報を確認できます。</p>
    </header>

    <section class="panel">
      <label class="field-label" for="input-text">解析対象テキスト</label>
      <textarea id="input-text" rows="8">${sampleText}</textarea>
      <div class="actions">
        <button id="analyze-button" type="button">解析実行</button>
        <button id="sample-button" type="button" class="secondary">サンプル読み込み</button>
      </div>
      <p id="status" class="status">入力してください。</p>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <h2>解析結果</h2>
        <span id="result-count" class="result-count">0 件</span>
      </div>
      <div id="result-output" class="result-output">まだ解析は実行されていません。</div>
    </section>
  `;

  return {
    root,
    input: root.querySelector('#input-text'),
    analyzeButton: root.querySelector('#analyze-button'),
    sampleButton: root.querySelector('#sample-button'),
    status: root.querySelector('#status'),
    resultOutput: root.querySelector('#result-output'),
    resultCount: root.querySelector('#result-count')
  };
}

export function renderResults(output, countLabel, tokens) {
  const tokenList = Array.isArray(tokens) ? tokens : tokens?.tokens ?? [];
  const reviewTokenList = !Array.isArray(tokens) && Array.isArray(tokens?.originalTokens)
    ? tokens.originalTokens
    : tokenList;

  if (!tokenList.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = '解析結果はありません。';
    output.replaceChildren(emptyState);
    countLabel.textContent = '0 件';
    return;
  }

  const container = document.createElement('div');
  container.className = 'result-layout';

  const nav = document.createElement('nav');
  nav.className = 'result-nav';
  nav.setAttribute('aria-label', '解析結果ナビゲーション');

  const panelArea = document.createElement('div');
  panelArea.className = 'result-content';

  const sections = [];

  function registerSection(id, label, panelBuilder) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result-nav-button';
    button.textContent = label;
    button.dataset.sectionId = id;
    nav.appendChild(button);

    const panel = document.createElement('section');
    panel.className = 'result-panel';
    panel.id = `${id}-panel`;
    panel.hidden = true;
    panelBuilder(panel);
    panelArea.appendChild(panel);

    sections.push({ id, button, panel });
  }

  function setActiveSection(sectionId) {
    sections.forEach((section) => {
      const active = section.id === sectionId;
      section.button.classList.toggle('active', active);
      section.button.setAttribute('aria-selected', String(active));
      section.panel.hidden = !active;
    });
  }

  nav.addEventListener('click', (event) => {
    const button = event.target.closest('.result-nav-button');
    if (!button) {
      return;
    }

    setActiveSection(button.dataset.sectionId);
  });

  registerSection('preprocess-normalize', '前処理: 正規化', (panel) => {
    const title = document.createElement('h3');
    title.textContent = '前処理: 正規化';
    panel.appendChild(title);

    if (!Array.isArray(tokens) && tokens?.preprocess) {
      const normalizedText = document.createElement('p');
      normalizedText.textContent = `正規化テキスト: ${tokens.preprocess.normalizedText}`;
      panel.appendChild(normalizedText);

      const ruleInfo = document.createElement('p');
      ruleInfo.textContent = `適用ルール: ${tokens.preprocess.appliedRules.length} 件`;
      panel.appendChild(ruleInfo);
    } else {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = '前処理結果はありません。';
      panel.appendChild(empty);
    }
  });

  registerSection('preprocess-claims', '前処理: 請求項構造', (panel) => {
    const title = document.createElement('h3');
    title.textContent = '前処理: 請求項構造検出';
    panel.appendChild(title);

    const detections = !Array.isArray(tokens) ? (tokens?.preprocess?.claimFrameDetections ?? []) : [];
    const summary = document.createElement('p');
    summary.textContent = `検出件数: ${detections.length} 件`;
    panel.appendChild(summary);

    if (detections.length) {
      const list = document.createElement('ul');
      detections.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = `${item.label} | ${item.matchedText}`;
        list.appendChild(li);
      });
      panel.appendChild(list);
    } else {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = '請求項構造の検出結果はありません。';
      panel.appendChild(empty);
    }
  });

  registerSection('morphology', `形態素解析 (${tokenList.length})`, (panel) => {
    const title = document.createElement('h3');
    title.textContent = '形態素解析';
    panel.appendChild(title);

    const table = document.createElement('table');
    table.className = 'token-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['表層', '品詞', '詳細', '基本形', '読み', '発音'].forEach((label) => {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    tokenList.forEach((token) => {
      const row = document.createElement('tr');
      [
        token.surfaceForm,
        token.pos,
        token.posDetail,
        token.basicForm,
        token.reading,
        token.pronunciation
      ].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value ?? '-';
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    panel.appendChild(table);
  });

  registerSection('postprocess-compound', '後処理: 複合語抽出', (panel) => {
    const title = document.createElement('h3');
    title.textContent = '後処理: 複合語抽出';
    panel.appendChild(title);

    const compounds = !Array.isArray(tokens) ? (tokens?.postprocess?.compounds ?? []) : [];
    const summary = document.createElement('p');
    summary.textContent = `抽出件数: ${compounds.length} 件`;
    panel.appendChild(summary);

    if (compounds.length) {
      const list = document.createElement('ul');
      compounds.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = `${item.type} | ${item.expression}`;
        list.appendChild(li);
      });
      panel.appendChild(list);
    } else {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = '複合語の抽出結果はありません。';
      panel.appendChild(empty);
    }
  });

  registerSection('postprocess-dependency', '後処理: 係り受け抽出', (panel) => {
    const title = document.createElement('h3');
    title.textContent = '後処理: 係り受け抽出';
    panel.appendChild(title);

    const verbDependencies = !Array.isArray(tokens) ? (tokens?.postprocess?.verbDependencies ?? []) : [];
    const nounDependencies = !Array.isArray(tokens) ? (tokens?.postprocess?.nounDependencies ?? []) : [];

    const verbSummary = document.createElement('p');
    verbSummary.textContent = `動詞係り受け: ${verbDependencies.length} 件`;
    panel.appendChild(verbSummary);

    if (verbDependencies.length) {
      const verbList = document.createElement('ul');
      verbDependencies.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = `${item.particle} | ${item.expression}`;
        verbList.appendChild(li);
      });
      panel.appendChild(verbList);
    }

    const nounSummary = document.createElement('p');
    nounSummary.textContent = `名詞係り受け: ${nounDependencies.length} 件`;
    panel.appendChild(nounSummary);

    if (nounDependencies.length) {
      const nounList = document.createElement('ul');
      nounDependencies.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = `${item.connector} | ${item.expression}`;
        nounList.appendChild(li);
      });
      panel.appendChild(nounList);
    }

    if (!verbDependencies.length && !nounDependencies.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = '係り受け抽出結果はありません。';
      panel.appendChild(empty);
    }
  });

  registerSection('postprocess-graph', '後処理: 有向グラフ', (panel) => {
    const title = document.createElement('h3');
    title.textContent = '後処理: 有向グラフ';
    panel.appendChild(title);

    const graph = !Array.isArray(tokens) ? tokens?.postprocess?.verbGraph : null;
    if (graph) {
      const summary = document.createElement('p');
      summary.className = 'graph-summary';
      summary.textContent = `ノード: ${graph.nodes.length} / エッジ: ${graph.edges.length}`;
      panel.appendChild(summary);

      if (graph.edges.length) {
        const nodeLabelById = new Map(graph.nodes.map((node) => [node.id, node.label]));
        const list = document.createElement('ul');
        list.className = 'graph-list';
        graph.edges.forEach((edge) => {
          const li = document.createElement('li');
          const fromLabel = nodeLabelById.get(edge.from) || edge.from;
          const toLabel = nodeLabelById.get(edge.to) || edge.to;
          li.textContent = `${fromLabel} → ${toLabel} [${edge.label}]`;
          list.appendChild(li);
        });
        panel.appendChild(list);
      }
    } else {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = '有向グラフはありません。';
      panel.appendChild(empty);
    }
  });

  registerSection('postprocess-review', '後処理: 分かち書きレビュー', (panel) => {
    const title = document.createElement('h3');
    title.textContent = '後処理: 分かち書きレビュー';
    panel.appendChild(title);

    const segmentedText = document.createElement('p');
    segmentedText.className = 'segmented-text';
    segmentedText.textContent = `分かち書き: ${reviewTokenList.map((token) => token.surfaceForm).join(' ')}`;
    panel.appendChild(segmentedText);

    const coverage = !Array.isArray(tokens) ? tokens?.postprocess?.graphCoverage : null;
    if (coverage?.tokenCoverage?.length) {
      const coverageSummary = document.createElement('p');
      coverageSummary.className = 'coverage-summary';
      coverageSummary.textContent = `有向グラフ採用: ${coverage.adoptedCount} / ${coverage.totalCount} 形態素`;
      panel.appendChild(coverageSummary);

      const coverageLegend = document.createElement('p');
      coverageLegend.className = 'coverage-legend';
      coverageLegend.textContent = '青: 有向グラフに採用 / グレー: 未採用';
      panel.appendChild(coverageLegend);

      const coverageLine = document.createElement('div');
      coverageLine.className = 'coverage-line';
      coverage.tokenCoverage.forEach((item) => {
        const tokenChip = document.createElement('span');
        tokenChip.className = item.adopted ? 'coverage-token adopted' : 'coverage-token ignored';
        tokenChip.textContent = item.surfaceForm;
        coverageLine.appendChild(tokenChip);
      });
      panel.appendChild(coverageLine);
    }
  });

  container.appendChild(nav);
  container.appendChild(panelArea);
  if (sections.length) {
    setActiveSection(sections[0].id);
  }

  output.replaceChildren(container);
  countLabel.textContent = `${tokenList.length} 件`;
}

export function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}
