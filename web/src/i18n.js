import { useCallback, useEffect, useState } from 'react';
import { LANGUAGES, isRtl } from './i18n/languages.js';
import en from './locales/en.json';

const LS_KEY = 'cb_lang';

// 动态加载翻译文件
const loaders = {};
for (const lang of LANGUAGES) {
  loaders[lang.code] = () => import(`./locales/${lang.code}.json`);
}

const cache = { en };

export function getInitialLang() {
  const saved = localStorage.getItem(LS_KEY);
  if (saved && loaders[saved]) return saved;
  const nav = (navigator.language || 'en').toLowerCase().slice(0, 2);
  return loaders[nav] ? nav : 'en';
}

export function useI18n() {
  const [lang, setLang] = useState(getInitialLang());
  const [messages, setMessages] = useState(cache);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
    localStorage.setItem(LS_KEY, lang);
  }, [lang]);

  useEffect(() => {
    if (cache[lang]) {
      setMessages({ ...cache });
      return;
    }
    loaders[lang]()
      .then((mod) => {
        cache[lang] = mod.default;
        setMessages({ ...cache });
      })
      .catch(() => {
        cache[lang] = en;
        setMessages({ ...cache });
      });
  }, [lang]);

  const t = useCallback(
    (key, vars) => {
      const dict = messages[lang] || en;
      let str = key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);
      if (str === undefined) {
        str = key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), en);
      }
      if (typeof str !== 'string') return key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [lang, messages]
  );

  return { lang, setLang, t, languages: LANGUAGES };
}
