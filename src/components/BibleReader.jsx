import { useState, useEffect, useRef } from 'react';
import { BOOKS, BOOK_MAP } from '../data/books';

export default function BibleReader({ bible, version, onCopy, onProject, onToast, gotoRef, bookmarks, onBookmark, notes, onNote, hlDuration, hlColor, bmColor }) {
  const [bookId, setBookId]           = useState(1);
  const [chapter, setChapter]         = useState(1);
  const [selected, setSelected]       = useState(new Set());
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText]       = useState('');
  // { v, n }: n은 같은 절로 다시 이동해도 효과가 재실행되도록 하는 카운터
  const [hl, setHl]                   = useState({ v: null, n: 0 });
  const verseListRef   = useRef(null);
  const verseEls       = useRef({});
  const hlTimer        = useRef(null);

  const bookInfo    = BOOK_MAP[bookId];
  const maxChapter  = bookInfo?.chapters ?? 1;
  const bookData    = bible?.[String(bookId)];
  const chapterData = bookData?.[String(chapter)];
  const verses      = chapterData
    ? Object.entries(chapterData).sort((a, b) => +a[0] - +b[0])
    : [];

  // 책/장 이동은 항상 goTo 를 통해서만 하고 선택 초기화도 여기서 처리한다
  // (bookId 변경 effect로 장을 1로 되돌리던 방식은 외부 이동(gotoRef)과 충돌해
  //  엉뚱한 장이 열리거나 빈 화면이 나오는 문제가 있었음)
  function goTo(b, c) {
    setBookId(b);
    setChapter(c);
    setSelected(new Set());
  }
  const selectBook    = (b) => goTo(b, 1);
  const selectChapter = (c) => goTo(bookId, c);

  // 외부 이동 요청(gotoRef)은 렌더 중에 상태를 맞추는 방식으로 처리 (React 권장 패턴)
  const [lastGoto, setLastGoto] = useState(null);
  if (gotoRef && gotoRef !== lastGoto) {
    setLastGoto(gotoRef);
    goTo(gotoRef.b, gotoRef.c);
    setHl(gotoRef.v ? { v: String(gotoRef.v), n: hl.n + 1 } : { v: null, n: 0 });
  }

  // 장이 바뀌면 맨 위로
  useEffect(() => { verseListRef.current?.scrollTo({ top: 0 }); }, [bookId, chapter]);

  useEffect(() => {
    if (!hl.v) return;
    const el = verseEls.current[hl.v];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    clearTimeout(hlTimer.current);
    hlTimer.current = setTimeout(() => setHl({ v: null, n: 0 }), (hlDuration ?? 2) * 1000);
    return () => clearTimeout(hlTimer.current);
  }, [hl]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleVerse(v) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }

  function prevChapter() {
    if (chapter > 1) selectChapter(chapter - 1);
    else if (bookId > 1) goTo(bookId - 1, BOOK_MAP[bookId - 1].chapters);
  }
  function nextChapter() {
    if (chapter < maxChapter) selectChapter(chapter + 1);
    else if (bookId < 66) goTo(bookId + 1, 1);
  }

  function isBookmarked(v) {
    return bookmarks.some(bm => bm.b === bookId && bm.c === chapter && bm.v === +v);
  }

  function toggleBookmark(v) {
    const key = { b: bookId, c: chapter, v: +v };
    if (isBookmarked(v)) {
      onBookmark(bookmarks.filter(bm => !(bm.b === key.b && bm.c === key.c && bm.v === key.v)));
    } else {
      const text = chapterData?.[v] ?? '';
      onBookmark([...bookmarks, { ...key, text: text.slice(0, 60) }]);
    }
  }

  function getNote(v) { return notes[`${bookId}-${chapter}-${v}`] ?? ''; }

  function openNoteEditor(v) { setEditingNote(v); setNoteText(getNote(v)); }

  function saveNote() {
    const key = `${bookId}-${chapter}-${editingNote}`;
    if (noteText.trim()) onNote({ ...notes, [key]: noteText.trim() });
    else { const n = { ...notes }; delete n[key]; onNote(n); }
    setEditingNote(null);
  }

  function copyVerse(v, text) {
    const name = version === 'NIV'
      ? (bookInfo?.en ?? bookInfo?.ko)
      : (bookInfo?.abbr ?? bookInfo?.ko);
    navigator.clipboard.writeText(`${text} (${name} ${chapter}:${v})`);
    onToast();
  }

  function copyChapter() {
    const NL = String.fromCharCode(10);
    const lines = verses.map(([v, t]) => v + ' ' + t).join(NL);
    navigator.clipboard.writeText(bookInfo?.ko + ' ' + chapter + '장' + NL + lines);
    onToast();
  }

  return (
    <div className="bible-reader">
      <div className="reader-nav">
        <select value={bookId} onChange={e => selectBook(+e.target.value)}>
          {BOOKS.map(b => <option key={b.id} value={b.id}>{b.ko}</option>)}
        </select>
        <select value={chapter} onChange={e => selectChapter(+e.target.value)}>
          {Array.from({ length: maxChapter }, (_, i) => i + 1).map(c => (
            <option key={c} value={c}>{c}장</option>
          ))}
        </select>
        <div className="nav-btns">
          <button onClick={prevChapter} disabled={bookId === 1 && chapter === 1} title="이전 장">◀</button>
          <button onClick={nextChapter} disabled={bookId === 66 && chapter === maxChapter} title="다음 장">▶</button>
        </div>
        <div className="reader-nav-right">
          <button className="icon-btn" onClick={copyChapter} title="장 전체 복사">📋</button>
          {selected.size > 0 && (
            <>
              <button className="project-btn" onClick={() =>
                onProject(bookId, chapter, [...selected].sort((a, b) => +a - +b))
              } title="선택한 절을 화면 가득 보기">크게 보기</button>
              <button className="copy-btn" onClick={() =>
                onCopy(bookId, chapter, [...selected].sort((a, b) => +a - +b), chapterData)
              }>
                {selected.size}절 복사
              </button>
            </>
          )}
        </div>
      </div>

      <div className="chapter-title">
        {bookInfo?.ko} {chapter}장
        <span className="version-badge">{version}</span>
      </div>

      <div className="verses" ref={verseListRef}>
        {verses.map(([v, text]) => {
          const bmd  = isBookmarked(v);
          const note = getNote(v);
          const isHl = hl.v === v;
          const bmStyle = bmd ? { backgroundColor: bmColor ?? '#a8d8f0' } : {};
          const hlStyle = isHl ? { '--hl-color': hlColor ?? '#ffe08a', '--hl-dur': (hlDuration ?? 2) + 's' } : {};
          return (
            <div
              key={isHl ? `${v}-hl${hl.n}` : v} /* 같은 절 재이동 시 애니메이션 재시작 */
              ref={el => { verseEls.current[v] = el; }}
              className={`verse-block${selected.has(v) ? ' selected' : ''}${isHl ? ' highlighted' : ''}`}
              style={{ ...bmStyle, ...hlStyle }}
            >
              <div className="verse" onClick={() => toggleVerse(v)}>
                <span className="verse-num">{v}</span>
                <span className="verse-text">{text}</span>
                <div className="verse-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className={`action-btn${bmd ? ' bookmarked' : ''}`}
                    onClick={() => toggleBookmark(v)}
                    title={bmd ? '북마크 해제' : '북마크'}
                  >★</button>
                  <button
                    className={`action-btn${note ? ' has-note' : ''}`}
                    onClick={() => openNoteEditor(v)}
                    title="메모"
                  >✎</button>
                  <button
                    className="action-btn"
                    onClick={() => copyVerse(v, text)}
                    title="구절 복사"
                  >⎘</button>
                </div>
              </div>
              {note && editingNote !== v && (
                <div className="verse-note" onClick={() => openNoteEditor(v)}>
                  📝 {note}
                </div>
              )}
              {editingNote === v && (
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
                    {getNote(v) && (
                      <button className="delete-note" onClick={() => {
                        const n = { ...notes };
                        delete n[`${bookId}-${chapter}-${v}`];
                        onNote(n);
                        setEditingNote(null);
                      }}>삭제</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {verses.length === 0 && <div className="empty">본문이 없습니다.</div>}
      </div>
    </div>
  );
}
