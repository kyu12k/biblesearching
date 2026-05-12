import { useState } from 'react';
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
      setResults(found);
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
            {results.map(({ b, c, v, text }, i) => (
              <div key={i} className="result-item" onClick={() => onGoTo(b, c, v)}>
                <span className="result-ref">{BOOK_MAP[b]?.ko} {c}:{v}</span>
                <span className="result-text">{highlight(text)}</span>
              </div>
            ))}
            {results.length === 0 && <div className="no-results">검색 결과가 없습니다.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
