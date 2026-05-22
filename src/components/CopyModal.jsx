import { useState } from 'react';
import { BOOK_MAP } from '../data/books';

export default function CopyModal({ bookId, chapter, verses, chapterData, version, onClose, onCopied }) {
  const isNiv = version === 'NIV';

  const [useAbbr,      setUseAbbr]      = useState(!isNiv);   // NIV는 항상 전체 영어명
  const [showParen,    setShowParen]    = useState(true);
  const [showVerseNum, setShowVerseNum] = useState(true);
  const [eachLine,     setEachLine]     = useState(false);
  const [showVersion,  setShowVersion]  = useState(isNiv);    // NIV일 때 기본 on

  const bookInfo = BOOK_MAP[bookId];

  const bookName = (() => {
    if (isNiv) return bookInfo?.en ?? bookInfo?.ko;
    return useAbbr ? bookInfo?.abbr : bookInfo?.ko;
  })();

  const refLabel = (() => {
    if (!verses?.length) return '';
    const first = verses[0];
    const last  = verses[verses.length - 1];
    const loc   = first === last ? `${first}` : `${first}-${last}`;
    const versionTag = showVersion ? ` ${version}` : '';
    return `${bookName} ${chapter}:${loc}${versionTag}`;
  })();

  const bodyLines = verses?.map(v => {
    const text = chapterData?.[v] ?? '';
    return showVerseNum ? `${v} ${text}` : text;
  }) ?? [];

  const body = eachLine ? bodyLines.join('\n') : bodyLines.join(' ');

  const preview = showParen
    ? `${body} (${refLabel})`
    : `${refLabel}\n${body}`;

  async function copy() {
    await navigator.clipboard.writeText(preview);
    onCopied();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>복사 옵션</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-options">
          {!isNiv && (
            <label><input type="checkbox" checked={useAbbr} onChange={e => setUseAbbr(e.target.checked)} /> 약어 사용 ({bookInfo?.abbr})</label>
          )}
          <label><input type="checkbox" checked={showParen} onChange={e => setShowParen(e.target.checked)} /> 출처를 괄호 뒤에</label>
          <label><input type="checkbox" checked={showVerseNum} onChange={e => setShowVerseNum(e.target.checked)} /> 절 번호 포함</label>
          <label><input type="checkbox" checked={eachLine} onChange={e => setEachLine(e.target.checked)} /> 절마다 줄바꿈</label>
          <label><input type="checkbox" checked={showVersion} onChange={e => setShowVersion(e.target.checked)} /> 버전 표시 ({version})</label>
        </div>

        <div className="modal-preview">
          <div className="preview-label">미리보기</div>
          <pre className="preview-text">{preview}</pre>
        </div>

        <div className="modal-footer">
          <button className="copy-confirm-btn" onClick={copy}>클립보드에 복사</button>
        </div>
      </div>
    </div>
  );
}
