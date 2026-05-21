import { useState, useRef, useEffect } from 'react';
import { BOOKS, BOOK_MAP } from '../data/books';

function makeFlexRegex(keyword) {
  return new RegExp(keyword.split('').join('[\\s]*'), 'g');
}

// '의' 붙여쓰기/띄어쓰기 변형 생성
function eiVariants(keyword) {
  const set = new Set([keyword]);
  set.add(keyword.replace(/의([^\s])/g, '의 $1')); // 하나님의전 → 하나님의 전
  set.add(keyword.replace(/의 /g, '의'));           // 하나님의 전 → 하나님의전
  return [...set];
}

function matchKeyword(text, keyword) {
  return eiVariants(keyword).some(variant =>
    text.includes(variant) || makeFlexRegex(variant).test(text)
  );
}

export default function SearchPanel({ bibles, onGoTo }) {
  const [query, setQuery]         = useState('');
  const [isAnd, setIsAnd]         = useState(true);
  const [startBook, setStartBook] = useState(1);
  const [endBook, setEndBook]     = useState(66);
  const [version, setVersion]     = useState('HRV');
  const [results, setResults]     = useState(null);
  const [searching, setSearching] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const [openNiv, setOpenNiv]     = useState(null);
  const [copied, setCopied]       = useState(null);
  const [copiedNiv, setCopiedNiv] = useState(null);
  const sentinelRef = useRef(null);


  useEffect(() => {
    if (!sentinelRef.current || !results) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisibleCount(c => Math.min(c + 100, results.length));
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [results, visibleCount]);

  function copyVerse(text, ref, idx) {
    navigator.clipboard.writeText(`${ref} ${text}`).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function copyNiv(text, ref) {
    navigator.clipboard.writeText(`${ref} ${text}`).then(() => {
      setCopiedNiv(true);
      setTimeout(() => setCopiedNiv(false), 1500);
    });
  }

  function getNivText(b, c, v) {
    try { return bibles.NIV?.[String(b)]?.[String(c)]?.[String(v)] ?? null; }
    catch { return null; }
  }

  function search() {
    const keywords = query.trim().split(/\s+/).filter(Boolean);
    if (!keywords.length) return;
    setSearching(true);
    setResults(null);
    setTimeout(() => {
      const bible = bibles[version];
      if (!bible) { setSearching(false); return; }
      const found = [];
      for (let b = startBook; b <= endBook; b++) {
        const bookData = bible[String(b)];
        if (!bookData) continue;
        for (const [c, chData] of Object.entries(bookData)) {
          for (const [v, text] of Object.entries(chData)) {
            const match = isAnd
              ? keywords.every(k => matchKeyword(text, k))
              : keywords.some(k => matchKeyword(text, k));
            if (match) found.push({ b, c: +c, v: +v, text });
          }
        }
      }
      // 원본 쿼리가 구절 안에 연속으로 등장하면 상위 노출
      const phrase = query.trim();
      const phraseVariants = eiVariants(phrase);
      found.sort((a, b) => {
        const aExact = phraseVariants.some(p => a.text.includes(p)) ? 0 : 1;
        const bExact = phraseVariants.some(p => b.text.includes(p)) ? 0 : 1;
        return aExact - bExact;
      });

      setResults(found);
      setVisibleCount(100);
      setOpenNiv(null);
      setSearching(false);
    }, 0);
  }

  function highlight(text) {
    const keywords = query.trim().split(/\s+/).filter(Boolean);
    if (!keywords.length) return text;
    // 각 키워드의 모든 변형에 대해 하이라이트
    const allVariants = keywords.flatMap(k => eiVariants(k));
    let parts = [{ t: text, marked: false }];
    for (const k of allVariants) {
      const regex = makeFlexRegex(k);
      parts = parts.flatMap(part => {
        if (part.marked) return [part];
        const result = [];
        let last = 0, m;
        regex.lastIndex = 0;
        while ((m = regex.exec(part.t)) !== null) {
          if (m[0].length === 0) { regex.lastIndex++; continue; }
          if (m.index > last) result.push({ t: part.t.slice(last, m.index), marked: false });
          result.push({ t: m[0], marked: true });
          last = m.index + m[0].length;
        }
        if (last < part.t.length) result.push({ t: part.t.slice(last), marked: false });
        return result.length ? result : [part];
      });
    }
    return parts.map((p, i) => p.marked ? <mark key={i}>{p.t}</mark> : p.t);
  }

  return (
    <div className="search-panel">
      <div className="search-controls">
        <input type="text" className="search-input"
          placeholder="검색어 입력 (띄어쓰기로 구분)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <div className="search-options">
          <label className="toggle-label">
            <input type="checkbox" checked={isAnd} onChange={e => setIsAnd(e.target.checked)} />
            AND 검색
            <span className="info-tip" data-tip="띄어쓰기로 구분한 단어가 모두 포함된 구절만 검색합니다.&#10;체크 해제 시 하나라도 포함되면 결과에 표시됩니다. (OR 검색)">!</span>
          </label>
          <select value={version} onChange={e => setVersion(e.target.value)}>
            <option value="HRV">개역한글 (HRV)</option>
            <option value="NIV">NIV (영어)</option>
          </select>
          <select value={startBook} onChange={e => setStartBook(+e.target.value)}>
            {BOOKS.map(b => <option key={b.id} value={b.id}>{b.ko}</option>)}
          </select>
          <span>~</span>
          <select value={endBook} onChange={e => setEndBook(+e.target.value)}>
            {BOOKS.map(b => <option key={b.id} value={b.id}>{b.ko}</option>)}
          </select>
          <button className="search-btn" onClick={search} disabled={searching}>
            {searching ? '검색 중...' : '검색'}
          </button>
        </div>
      </div>
      {results !== null && (
        <div className="search-results">
          <div className="result-count">{results.length}개 결과</div>
          <div className="result-list">
            {results.slice(0, visibleCount).map(({ b, c, v, text }, i) => {
              const ref = `${BOOK_MAP[b]?.ko} ${c}:${v}`;
              const nivText = getNivText(b, c, v);
              const isOpen = openNiv === i;
              return (
                <div key={i} className="result-item-wrap">
                  <div className="result-item" onClick={() => onGoTo(b, c, v)}>
                    <span className="result-ref">{ref}</span>
                    <span className="result-text">{highlight(text)}</span>
                    <span className="result-actions">
                      {nivText && (
                        <button
                          className={`niv-btn${isOpen ? ' active' : ''}`}
                          onClick={e => { e.stopPropagation(); setOpenNiv(isOpen ? null : i); setCopiedNiv(false); }}
                        >NIV</button>
                      )}
                      <button
                        className={`copy-btn-inline${copied === i ? ' copied' : ''}`}
                        onClick={e => { e.stopPropagation(); copyVerse(text, ref, i); }}
                      >{copied === i ? '✓' : '복사'}</button>
                    </span>
                  </div>
                  {isOpen && nivText && (
                    <div className="niv-popup">
                      <span className="niv-popup-ref">{BOOK_MAP[b]?.en ?? ''} {c}:{v}</span>
                      <span className="niv-popup-text">{nivText}</span>
                      <button
                        className={`copy-btn-inline${copiedNiv ? ' copied' : ''}`}
                        onClick={e => { e.stopPropagation(); copyNiv(nivText, `${BOOK_MAP[b]?.en ?? ''} ${c}:${v}`); }}
                      >{copiedNiv ? '✓' : 'Copy'}</button>
                      <button className="niv-close-btn" onClick={e => { e.stopPropagation(); setOpenNiv(null); }}>×</button>
                    </div>
                  )}
                </div>
              );
            })}
            {results.length === 0 && <div className="no-results">검색 결과가 없습니다.</div>}
            {visibleCount < results.length && (
              <div ref={sentinelRef} className="load-more-sentinel">
                {visibleCount} / {results.length}개 표시 중...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
