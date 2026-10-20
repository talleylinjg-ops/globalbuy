import { useState, useEffect } from 'react';
import { apiUrl } from '../api.js';
import { productNameDisplay } from '../utils/carrier.js';

// 商品详情弹窗：大图 + 图集 + 描述 + 规格选择（SKU）或规格备注（自由填写）
// 「立即下单」把选中的规格带回 OrderModal
export default function ProductModal({ itemId, onClose, onOrder, t, lang }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [selectedSku, setSelectedSku] = useState(null);
  const [skuNote, setSkuNote] = useState('');
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState('');

  useEffect(() => {
    if (!itemId) return;
    setDetail(null);
    setError('');
    fetch(apiUrl(`/api/product/${encodeURIComponent(itemId)}`))
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'load failed');
        return d;
      })
      .then((d) => {
        setDetail(d);
        setActiveImg(d.imageUrl || (d.gallery || [])[0] || '');
        setSelectedSku((d.skus || [])[0] || null);
      })
      .catch((e) => setError(e.message));
  }, [itemId]);

  const hasSkus = (detail?.skus || []).length > 0;
  const price = hasSkus && selectedSku ? selectedSku.price : detail?.price;

  const submit = () => {
    onOrder({
      ...detail,
      // SKU 模式带 skuId（服务端查价），备注模式带 skuName 文本
      skuId: hasSkus ? selectedSku?.skuId || '' : '',
      skuName: hasSkus ? selectedSku?.spec || '' : skuNote.trim(),
      orderPrice: price,
    });
  };

  return (
    <div className="order-modal-mask" onClick={onClose}>
      <div className="product-modal" onClick={(e) => e.stopPropagation()}>
        <button className="order-modal-close" onClick={onClose}>×</button>

        {!detail && !error && <div className="loading">...</div>}
        {error && <div className="track-error">{error}</div>}

        {detail && (
          <>
            <div className="product-detail-grid">
              <div className="product-detail-media">
                <img className="product-detail-img" src={activeImg || detail.imageUrl} alt="" />
                {(detail.gallery || []).length > 1 && (
                  <div className="product-gallery">
                    {detail.gallery.map((g, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`product-gallery-thumb ${activeImg === g ? 'active' : ''}`}
                        onClick={() => setActiveImg(g)}
                      >
                        <img src={g} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="product-detail-info">
                <h3 className="product-detail-title">
                  {lang !== 'zh' && detail.titleEn ? detail.titleEn : detail.title}
                </h3>
                <div className="product-detail-price-row">
                  <span className="product-detail-price">¥{price != null ? price.toLocaleString() : '—'}</span>
                  {detail.originalPrice > detail.price && (
                    <span className="product-detail-orig">¥{detail.originalPrice.toLocaleString()}</span>
                  )}
                  {detail.sales > 0 && <span className="product-detail-sales">{detail.sales.toLocaleString()}+</span>}
                </div>
                {detail.shopName && <div className="muted product-detail-shop">{detail.shopName}</div>}

                {hasSkus ? (
                  <div className="product-sku-block">
                    <div className="settings-label">{t('product.selectSpec')}</div>
                    <div className="product-sku-list">
                      {detail.skus.map((s) => (
                        <button
                          key={s.skuId}
                          type="button"
                          className={`btn-chip ${selectedSku?.skuId === s.skuId ? 'active' : ''}`}
                          onClick={() => setSelectedSku(s)}
                        >
                          {s.spec || s.skuId}
                          {s.price !== detail.price && <em> ¥{s.price.toLocaleString()}</em>}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="product-sku-block">
                    <div className="settings-label" title={t('product.specNoteHelp')}>{t('product.specNote')}</div>
                    <textarea
                      className="settings-control product-spec-note"
                      rows={3}
                      maxLength={200}
                      placeholder={t('product.specNotePlaceholder')}
                      value={skuNote}
                      onChange={(e) => setSkuNote(e.target.value)}
                    />
                  </div>
                )}

                <div className="product-qty-block">
                  <div className="settings-label">{t('order.quantity')}</div>
                  <div className="product-qty-row">
                    <button type="button" className="product-qty-btn" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                    <input
                      className="settings-control product-qty-input"
                      type="number" min="1" max="99"
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                    />
                    <button type="button" className="product-qty-btn" onClick={() => setQty((q) => Math.min(99, q + 1))}>+</button>
                  </div>
                </div>

                <button className="btn btn-primary product-order-btn" onClick={submit}>
                  {t('product.orderNow')}
                </button>
              </div>
            </div>

            {detail.description && (
              <div className="product-detail-desc">
                <div className="track-section-title">{t('product.description')}</div>
                <p>{lang !== 'zh' && detail.descriptionEn ? detail.descriptionEn : detail.description}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
