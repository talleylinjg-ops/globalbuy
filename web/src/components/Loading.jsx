import { useState } from 'react';

export default function Loading({ t }) {
  return (
    <div className="loading">
      <div className="spinner" />
      <div>{t?.('search.buttonSearching') || 'Searching…'}</div>
    </div>
  );
}
