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
  if (!tokens.length) {
    output.innerHTML = '<p class="empty-state">解析結果はありません。</p>';
    countLabel.textContent = '0 件';
    return;
  }

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
  tokens.forEach((token) => {
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
  output.replaceChildren(table);
  countLabel.textContent = `${tokens.length} 件`;
}

export function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}
