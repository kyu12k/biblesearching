import { useState, useRef, useEffect } from 'react';
import { BOOKS, BOOK_MAP } from '../data/books';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 글자 사이 공백을 허용하는 정규식 ("하나님" → "하 나 님" 도 매칭). 영문은 대소문자 무시
function makeFlexRegex(keyword) {
  return new RegExp(keyword.split('').map(escapeRegex).join('\\s*'), 'gi');
}

// '의' 붙여쓰기/띄어쓰기 변형 생성
function eiVariants(keyword) {
  const set = new Set([keyword]);
  set.add(keyword.replace(/의([^\s])/g, '의 $1')); // 하나님의전 → 하나님의 전
  set.add(keyword.replace(/의 /g, '의'));           // 하나님의 전 → 하나님의전
  return [...set];
}

// 키워드 하나에 대한 매처 (변형별 정규식을 미리 컴파일해 재사용)
function makeMatcher(keyword) {
  const regexes = eiVariants(keyword).map(makeFlexRegex);
  return text => regexes.some(re => { re.lastIndex = 0; return re.test(text); });
}

export default function SearchPanel({ bibles, onGoTo }) {
  const [query, setQuery]         = useState('');
  const [isAnd, setIsAnd]         = useState(true);
  const [startBook, setStartBook] = useState(1);
  const [endBook, setEndBook]     = useState(66);
  const [version, setVersion]     = useState('HRV');
  const [results, setResults]       = useState(null);
  const [resultVersion, setResultVersion] = useState('HRV'); // 결과를 만든 시점의 버전
  const [searching, setSearching]   = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const [optionsOpen, setOptionsOpen] = useState(true);
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

  // 검색한 버전의 반대편 버전 (HRV로 검색 → NIV 팝업, NIV로 검색 → 개역한글 팝업)
  const otherVersion = resultVersion === 'NIV' ? 'HRV' : 'NIV';
  function getOtherText(b, c, v) {
    return bibles[otherVersion]?.[String(b)]?.[String(c)]?.[String(v)] ?? null;
  }
  function otherRef(b, c, v) {
    const name = otherVersion === 'NIV' ? BOOK_MAP[b]?.en : BOOK_MAP[b]?.ko;
    return `${name ?? ''} ${c}:${v}`;
  }

  function search() {
    const keywords = query.trim().split(/\s+/).filter(Boolean);
    if (!keywords.length) return;
    setSearching(true);
    setResults(null);
    setTimeout(() => {
      try {
        const bible = bibles[version];
        if (!bible) return;
        const found = [];
        const matchers = keywords.map(makeMatcher);
        const [from, to] = startBook <= endBook ? [startBook, endBook] : [endBook, startBook];
        for (let b = from; b <= to; b++) {
          const bookData = bible[String(b)];
          if (!bookData) continue;
          for (const [c, chData] of Object.entries(bookData)) {
            for (const [v, text] of Object.entries(chData)) {
              const match = isAnd
                ? matchers.every(m => m(text))
                : matchers.some(m => m(text));
              if (match) found.push({ b, c: +c, v: +v, text });
            }
          }
        }
        // 원본 쿼리가 구절 안에 연속으로 등장하면 상위 노출
        const phrase = query.trim().toLowerCase();
        const phraseVariants = eiVariants(phrase);
        const isExact = r => phraseVariants.some(p => r.text.toLowerCase().includes(p));
        found.sort((a, b) => (isExact(a) ? 0 : 1) - (isExact(b) ? 0 : 1));

        setResults(found);
        setResultVersion(version);
        setVisibleCount(100);
        setOpenNiv(null);
        setOptionsOpen(false);
      } finally {
        setSearching(false);
      }
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
      <form className="search-controls" onSubmit={e => { e.preventDefault(); search(); }}>
        <div className="search-input-row">
          <input type="text" className="search-input"
            placeholder="검색어 입력 (띄어쓰기로 구분)"
            value={query}
            onChange={e => { setQuery(e.target.value); if (results !== null) setOptionsOpen(true); }}
            inputMode="search"
            enterKeyHint="search"
          />
          <button type="submit" className="search-btn" disabled={searching}>
            {searching ? '…' : '검색'}
          </button>
        </div>
        <button
          type="button"
          className="options-toggle"
          onClick={() => setOptionsOpen(o => !o)}
        >
          옵션 {optionsOpen ? '▲' : '▼'}
        </button>
        {optionsOpen && (
          <div className="search-options">
            <label className="toggle-label">
              <input type="checkbox" checked={isAnd} onChange={e => setIsAnd(e.target.checked)} />
              AND 검색
              <span className="info-tip" data-tip="띄어쓰기로 구분한 단어가 모두 포함된 구절만 검색합니다.&#10;체크 해제 시 하나라도 포함되면 결과에 표시됩니다. (OR 검색)">!</span>
            </label>
            <div className="search-options-row">
              <select value={version} onChange={e => setVersion(e.target.value)}>
                <option value="HRV">개역한글 (HRV)</option>
                <option value="NIV">NIV (영어)</option>
              </select>
            </div>
            <div className="search-range-row">
              <select value={startBook} onChange={e => setStartBook(+e.target.value)}>
                {BOOKS.map(b => <option key={b.id} value={b.id}>{b.ko}</option>)}
              </select>
              <span className="range-tilde">~</span>
              <select value={endBook} onChange={e => setEndBook(+e.target.value)}>
                {BOOKS.map(b => <option key={b.id} value={b.id}>{b.ko}</option>)}
              </select>
            </div>
          </div>
        )}
      </form>
      {results !== null && (
        <div className="search-results">
          <div className="result-count">{results.length}개 결과</div>
          <div className="result-list">
            {results.slice(0, visibleCount).map(({ b, c, v, text }, i) => {
              const ref = resultVersion === 'NIV'
                ? `${BOOK_MAP[b]?.en} ${c}:${v}`
                : `${BOOK_MAP[b]?.ko} ${c}:${v}`;
              const nivText = getOtherText(b, c, v);
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
                        >{otherVersion === 'NIV' ? 'NIV' : '한글'}</button>
                      )}
                      <button
                        className={`copy-btn-inline${copied === i ? ' copied' : ''}`}
                        onClick={e => { e.stopPropagation(); copyVerse(text, ref, i); }}
                      >{copied === i ? '✓' : '복사'}</button>
                    </span>
                  </div>
                  {isOpen && nivText && (
                    <div className="niv-popup">
                      <span className="niv-popup-ref">{otherRef(b, c, v)}</span>
                      <span className={`niv-popup-text${otherVersion === 'NIV' ? '' : ' ko'}`}>{nivText}</span>
                      <button
                        className={`copy-btn-inline${copiedNiv ? ' copied' : ''}`}
                        onClick={e => { e.stopPropagation(); copyNiv(nivText, otherRef(b, c, v)); }}
                      >{copiedNiv ? '✓' : '복사'}</button>
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
