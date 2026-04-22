import React from 'react';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.heic', '.webp']);

function resolveText(lang, value, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.text !== 'undefined') return resolveText(lang, value.text, fallback);
    return resolveText(lang, value[lang] || value.en || value.fr || Object.values(value).find(v => typeof v === 'string'), fallback);
  }
  return fallback;
}

function normaliseAccept(acceptValue) {
  const accept = String(acceptValue || '.pdf,.jpg,.jpeg,.png,.gif,.heic');
  const tokens = accept.split(',').map(token => token.trim().toLowerCase()).filter(Boolean);
  return {
    accept,
    imageOnly: tokens.length > 0 && tokens.every(token => token.startsWith('image/') || IMAGE_EXTENSIONS.has(token)),
  };
}

export default function FileUploadPreview({ comp, lang = 'en' }) {
  const key = comp.storageKey || comp.name || comp.id || 'file-upload-preview';
  const labelText = resolveText(lang, comp.props?.label || comp.label, key);
  const hintText = resolveText(lang, comp.props?.hint || comp.hint, '');
  const labelClassValue = comp.props?.label?.classes || comp.labelClass || '';
  const maxSizeMb = comp.maxSizeMb ?? comp.props?.maxSizeMb ?? null;
  const showMaxSize = comp.showMaxSize ?? comp.props?.showMaxSize;
  const showMimeList = comp.showMimeList ?? comp.props?.showMimeList;
  const { accept, imageOnly } = normaliseAccept(comp.accept ?? comp.props?.accept);
  const primaryLabel = lang === 'fr' ? 'Téléverser' : 'Upload';
  const mobileHint = imageOnly
    ? (lang === 'fr'
      ? 'Sur un téléphone compatible, les demandeurs verront les options Prendre une photo et Choisir un fichier.'
      : 'On a supported phone, applicants will see Take photo and Choose file.')
    : (lang === 'fr'
      ? 'Sur un téléphone compatible, les demandeurs pourront prendre une photo ou choisir un fichier.'
      : 'On a supported phone, applicants can take a photo or choose a file.');
  const takePhotoLabel = lang === 'fr' ? 'Prendre une photo' : 'Take photo';
  const chooseFileLabel = lang === 'fr' ? 'Choisir un fichier' : 'Choose file';

  return (
    <div className="govuk-form-group" style={{ marginBottom: 20 }}>
      <label className={`govuk-label${labelClassValue ? ` ${labelClassValue}` : ''}`} htmlFor={key}>{labelText}</label>
      {hintText && <div id={`${key}-hint`} className="govuk-hint">{hintText}</div>}
      <div className="govuk-button-group" style={{ marginBottom: 0 }}>
        <button type="button" className="govuk-button" data-module="govuk-button" style={{ marginBottom: 0 }}>
          {primaryLabel}
        </button>
      </div>
      <div
        style={{
          maxWidth: 420,
          marginTop: 10,
          padding: '12px 14px',
          border: '1px solid #b1b4b6',
          borderRadius: 6,
          background: '#f3f2f1'
        }}
      >
        <div style={{ color: '#505a5f', fontSize: 14, lineHeight: 1.4, marginBottom: 10 }}>
          {mobileHint}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ border: '1px solid #b1b4b6', borderRadius: 999, padding: '4px 10px', background: '#ffffff', fontSize: 14 }}>{takePhotoLabel}</span>
          <span style={{ border: '1px solid #b1b4b6', borderRadius: 999, padding: '4px 10px', background: '#ffffff', fontSize: 14 }}>{chooseFileLabel}</span>
        </div>
      </div>
      {showMimeList && accept && (
        <div className="govuk-hint govuk-!-margin-top-1">
          {lang === 'fr' ? 'Types acceptés:' : 'Accepted types:'} {accept}
        </div>
      )}
      {showMaxSize && maxSizeMb && (
        <div className="govuk-hint govuk-!-margin-top-1">
          {lang === 'fr' ? 'Taille maximale:' : 'Maximum size:'} {maxSizeMb} MB
        </div>
      )}
    </div>
  );
}
