import { useState, useEffect, useRef } from 'react';
import { BOOKS, BOOK_MAP } from '../data/books';

function buildPreview({ bookId, chapter, verses, allVerses, versions, showVerseNum, showVersion, showParen, eachLine, layout }) {
  const bookInfo = BOOK_MAP[bookId];
  const hrvName  = bookInfo?.abbr ?? bookInfo?.ko;
  const nivName  = bookInfo?.en   ?? bookInfo?.ko;
  const vTag     = (v) => showVersion ? ` ${v}` : '';

  const verseRows = verses.map(verse => {
    const row = allVerses.find(r => r.verse === verse);
    return { verse, texts: row?.texts ?? versions.map(() => '') };
  });

  if (layout === 'grouped') {
    const loc = verses.length === 1 ? verses[0] : `${verses[0]}-${verses[verses.length - 1]}`;
    return versions.map((v, vi) => {
      const name  = v === 'NIV' ? nivName : hrvName;
      const ref   = `${name} ${chapter}:${loc}${vTag(v)}`;
      const lines = verseRows.map(({ verse, texts }) =>
        (showVerseNum ? `${verse} ` : '') + texts[vi]
      );
      const body = eachLine ? lines.join('\n') : lines.join(' ');
      return showParen ? `${body} (${ref})` : `${ref}\n${body}`;
    }).join('\n\n');
  } else {
    return verseRows.map(({ verse, texts }) =>
      versions.map((v, vi) => {
        const name = v === 'NIV' ? nivName : hrvName;
        const ref  = `${name} ${chapter}:${verse}${vTag(v)}`;
        const pfx  = showVerseNum ? `${verse} ` : '';
        return showParen ? `${pfx}${texts[vi]} (${ref})` : `${ref}\n${pfx}${texts[vi]}`;
      }).join(' / ')
    ).join('\n');
  }
}

function CompareCopyModal({ bookId, chapter, verses, allVerses, versions, onClose, onCopied }) {
  const [showVerseNum, setShowVerseNum] = useState(false);
  const [showVersion,  setShowVersion]  = useState(true);
  const [showParen,    setShowParen]    = useState(true);
  const [eachLine,     setEachLine]     = useState(false);
  const [layout,       setLayout]       = useState('grouped');

  const isMulti = verses.length > 1;
  const preview = buildPreview({ bookId, chapter, verses, allVerses, versions, showVerseNum, showVersion, showParen, eachLine, layout });

  async function copy() {
    await navigator.clipboard.writeText(preview);
    onCopied();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>한+영 복사 옵션</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-options">
          <label><input type="checkbox" checked={showParen}    onChange={e => setShowParen(e.target.checked)}    /> 출처를 괄호 뒤에</label>
          <label><input type="checkbox" checked={showVerseNum} onChange={e => setShowVerseNum(e.target.checked)} /> 절 번호 포함</label>
          <label><input type="checkbox" checked={eachLine}     onChange={e => setEachLine(e.target.checked)}     /> 절마다 줄바꿈</label>
          <label><input type="checkbox" checked={showVersion}  onChange={e => setShowVersion(e.target.checked)}  /> 버전 표시</label>
          {isMulti && (
            <div className="modal-option-group">
              <span>배열 방식</span>
              <label><input type="radio" name="layout" value="grouped"     checked={layout === 'grouped'}     onChange={() => setLayout('grouped')}     /> A — 버전별 묶음</label>
              <label><input type="radio" name="layout" value="interleaved" checked={layout === 'interleaved'} onChange={() => setLayout('interleaved')} /> B — 절 단위 교차</label>
            </div>
          )}
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

export default function CompareView({ bibles, gotoRef, bookmarks, onBookmark, notes, onNote, bmColor, onToast }) {
  const [bookId,      setBookId]      = useState(1);
  const [chapter,     setChapter]     = useState(1);
  const [selected,    setSelected]    = useState(new Set());
  const [copyCtx,     setCopyCtx]     = useState(null);
  const [copied,      setCopied]      = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText,    setNoteText]    = useState('');
  const listRef      = useRef(null);
  const verseEls     = useRef({});
  const scrolledGoto = useRef(null); // 절 스크롤을 이미 처리한 gotoRef

  const bookInfo   = BOOK_MAP[bookId];
  const maxChapter = bookInfo?.chapters ?? 1;

  // BibleReader와 동일하게, 책/장 이동은 goTo를 통해서만 하고 선택 초기화도 여기서 처리
  function goTo(b, c) {
    setBookId(b);
    setChapter(c);
    setSelected(new Set());
  }

  // 외부 이동 요청(gotoRef)은 렌더 중에 상태를 맞추는 방식으로 처리 (React 권장 패턴)
  const [lastGoto, setLastGoto] = useState(null);
  if (gotoRef && gotoRef !== lastGoto) {
    setLastGoto(gotoRef);
    goTo(gotoRef.b, gotoRef.c);
  }

  // 장이 바뀌면 맨 위로, 이동 요청에 절이 있으면 그 절로 스크롤
  useEffect(() => {
    const isNewGoto = lastGoto && lastGoto !== scrolledGoto.current;
    scrolledGoto.current = lastGoto;
    const el = isNewGoto && lastGoto.v ? verseEls.current[String(lastGoto.v)] : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else listRef.current?.scrollTo({ top: 0 });
  }, [bookId, chapter, lastGoto]);

  const versions = Object.keys(bibles).filter(v => bibles[v]);
  // 절 번호 기준으로 정렬 (NIV는 일부 절이 본문에서 생략되어 번호가 비므로
  // 순서(index)가 아니라 절 번호로 맞춰야 한다)
  const allVerses = (() => {
    const chapters = versions.map(v => bibles[v]?.[String(bookId)]?.[String(chapter)] ?? {});
    const nums = [...new Set(chapters.flatMap(ch => Object.keys(ch)))].sort((a, b) => +a - +b);
    return nums.map(verse => ({
      verse,
      texts: chapters.map(ch => ch[verse] ?? ''),
    }));
  })();

  function toggleVerse(verse) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(verse) ? next.delete(verse) : next.add(verse);
      return next;
    });
  }

  function isBookmarked(v) {
    return (bookmarks ?? []).some(bm => bm.b === bookId && bm.c === chapter && bm.v === +v);
  }

  function toggleBookmark(v, texts) {
    const key = { b: bookId, c: chapter, v: +v };
    if (isBookmarked(v)) {
      onBookmark((bookmarks ?? []).filter(bm => !(bm.b === key.b && bm.c === key.c && bm.v === key.v)));
    } else {
      const text = (texts[0] ?? '').slice(0, 60);
      onBookmark([...(bookmarks ?? []), { ...key, text }]);
    }
  }

  function getNote(v) { return (notes ?? {})[`${bookId}-${chapter}-${v}`] ?? ''; }

  function openNoteEditor(v) { setEditingNote(v); setNoteText(getNote(v)); }

  function saveNote() {
    const key = `${bookId}-${chapter}-${editingNote}`;
    const next = { ...(notes ?? {}) };
    if (noteText.trim()) next[key] = noteText.trim();
    else delete next[key];
    onNote(next);
    setEditingNote(null);
  }

  // BibleReader와 동일하게 책 경계를 넘어 이동
  function prevChapter() {
    if (chapter > 1) goTo(bookId, chapter - 1);
    else if (bookId > 1) goTo(bookId - 1, BOOK_MAP[bookId - 1].chapters);
  }
  function nextChapter() {
    if (chapter < maxChapter) goTo(bookId, chapter + 1);
    else if (bookId < 66) goTo(bookId + 1, 1);
  }

  function copyChapter() {
    const allV = allVerses.map(r => r.verse);
    setCopyCtx({ verses: allV, isChapter: true });
  }

  function openCopyModal(verses) {
    setCopyCtx({ verses });
  }

  return (
    <div className="compare-view">
      <div className="compare-nav">
        <select value={bookId} onChange={e => goTo(+e.target.value, 1)}>
          {BOOKS.map(b => <option key={b.id} value={b.id}>{b.ko}</option>)}
        </select>
        <select value={chapter} onChange={e => goTo(bookId, +e.target.value)}>
          {Array.from({ length: maxChapter }, (_, i) => i + 1).map(c => (
            <option key={c} value={c}>{c}장</option>
          ))}
        </select>
        <button className="nav-btn" onClick={prevChapter} disabled={bookId === 1 && chapter === 1} title="이전 장">◀</button>
        <button className="nav-btn" onClick={nextChapter} disabled={bookId === 66 && chapter === maxChapter} title="다음 장">▶</button>
        <div className="reader-nav-right">
          <button className="icon-btn" onClick={copyChapter} title="장 전체 복사">📋</button>
          {selected.size > 0 && (
            <button className="copy-btn" onClick={() =>
              openCopyModal([...selected].sort((a, b) => +a - +b))
            }>{selected.size}절 복사</button>
          )}
        </div>
      </div>

      <div className="compare-title">
        {bookInfo?.ko} {chapter}장 — 버전 비교
      </div>

      <div className="compare-verses" ref={listRef}>
        {allVerses.map(({ verse, texts }) => {
          const bmd     = isBookmarked(verse);
          const note    = getNote(verse);
          const bmStyle = bmd ? { backgroundColor: bmColor ?? '#a8d8f0' } : {};
          return (
            <div
              key={verse}
              ref={el => { verseEls.current[verse] = el; }}
              className={`compare-verse-block${selected.has(verse) ? ' compare-selected' : ''}`}
              style={bmStyle}
              onClick={() => toggleVerse(verse)}
            >
              <div className="compare-verse-header">
                <span className="compare-verse-num">{verse}</span>
                <div className="compare-verse-texts">
                  {versions.map((v, i) => (
                    <div key={v} className="compare-verse-row">
                      <span className="compare-verse-label">{v === 'HRV' ? '한' : 'EN'}</span>
                      <span className={`compare-verse-text${v === 'NIV' ? ' niv' : ''}`}>{texts[i]}</span>
                    </div>
                  ))}
                </div>
                <div className="compare-verse-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className={`action-btn${bmd ? ' bookmarked' : ''}`}
                    onClick={() => toggleBookmark(verse, texts)}
                    title={bmd ? '북마크 해제' : '북마크'}
                  >★</button>
                  <button
                    className={`action-btn${note ? ' has-note' : ''}`}
                    onClick={() => openNoteEditor(verse)}
                    title="메모"
                  >✎</button>
                  <button
                    className={`action-btn${copied === verse ? ' copied' : ''}`}
                    onClick={() => openCopyModal([verse])}
                    title="구절 복사"
                  >⎘</button>
                </div>
              </div>
              {note && editingNote !== verse && (
                <div className="verse-note" onClick={e => { e.stopPropagation(); openNoteEditor(verse); }}>
                  📝 {note}
                </div>
              )}
              {editingNote === verse && (
                <div className="note-editor" onClick={e => e.stopPropagation()}>
                  <textarea
                    autoFocus
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="메모를 입력하세요..."
                    rows={3}
                  />
                  <div className="note-editor-btns">
                    <button onClick={saveNote}>저장</button>
                    <button onClick={() => setEditingNote(null)}>취소</button>
                    {getNote(verse) && (
                      <button className="delete-note" onClick={() => {
                        const next = { ...(notes ?? {}) };
                        delete next[`${bookId}-${chapter}-${verse}`];
                        onNote(next);
                        setEditingNote(null);
                      }}>삭제</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {allVerses.length === 0 && (
          <div className="empty" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>데이터 없음</div>
        )}
      </div>

      {copyCtx && (
        <CompareCopyModal
          bookId={bookId}
          chapter={chapter}
          verses={copyCtx.verses}
          allVerses={allVerses}
          versions={versions}
          onClose={() => setCopyCtx(null)}
          onCopied={() => {
            if (copyCtx.verses.length === 1) {
              setCopied(copyCtx.verses[0]);
              setTimeout(() => setCopied(null), 1500);
            }
            setSelected(new Set());
            setCopyCtx(null);
            onToast?.();
          }}
        />
      )}
    </div>
  );
}
