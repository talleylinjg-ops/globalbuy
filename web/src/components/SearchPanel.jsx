import { useState } from 'react';

export default function SearchPanel({ query, setQuery, onSearch, onParseLink, loading, parsing, t, categories }) {
  const [mode, setMode] = useState('keyword');

  const submit = (e) => {
    e.preventDefault();
    if (mode === 'keyword') {
      onSearch(query.trim());
    } else {
      onParseLink(query.trim());
    }
  };

  return (
    <div className="search-panel">
      <div className="mode-tabs">
        <button
          type="button"
          className={`mode-tab ${mode === 'keyword' ? 'active' : ''}`}
          onClick={() => setMode('keyword')}
        >
          {t('search.tabKeyword')}
        </button>
        <button
          type="button"
          className={`mode-tab ${mode === 'link' ? 'active' : ''}`}
          onClick={() => setMode('link')}
        >
          {t('search.tabLink')}
        </button>
      </div>
      <form className="search-row" onSubmit={submit}>
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === 'keyword' ? t('search.placeholder') : t('search.placeholderLink')}
          autoFocus
        />
        <button className="btn btn-primary" type="submit" disabled={loading || parsing || !query.trim()}>
          {loading || parsing ? t('search.buttonSearching') : t('search.button')}
        </button>
      </form>
      {mode === 'keyword' && (
        <div className="suggestions">
          <span>{t('search.suggestions')}</span>
          {categories.map((c) => (
            <button key={c} type="button" className="btn-chip" onClick={() => onSearch(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
