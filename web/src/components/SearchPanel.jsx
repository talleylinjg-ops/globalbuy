import { useState } from 'react';

// 单输入智能搜索：默认关键词模式，"商品链接"胶囊（搜索栏内第一个元素）切换为链接解析模式
export default function SearchPanel({ query, setQuery, onSearch, onParseLink, loading, parsing, t, categories }) {
  const [linkMode, setLinkMode] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (linkMode) {
      onParseLink(query.trim());
    } else {
      onSearch(query.trim());
    }
  };

  return (
    <div className="search-panel">
      <form className="search-row" onSubmit={submit}>
        <button
          type="button"
          className={`link-toggle ${linkMode ? 'active' : ''}`}
          title={t('search.placeholderLink')}
          onClick={() => setLinkMode((v) => !v)}
        >
          {t('search.tabLink')}
        </button>
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={linkMode ? t('search.placeholderLink') : t('search.placeholder')}
          autoFocus
        />
        <button className="btn btn-primary" type="submit" disabled={loading || parsing || !query.trim()}>
          {loading || parsing ? t('search.buttonSearching') : t('search.button')}
        </button>
      </form>
      {!linkMode && (
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
