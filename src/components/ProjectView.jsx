import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { BOOK_MAP } from '../data/books';

function verseNums(bible, b, c) {
  const data = bible?.[String(b)]?.[String(c)];
  return data ? Object.keys(data).map(Number).sort((x, y) => x - y) : [];
}

// 다음(dir=1)/이전(dir=-1) 절 참조. 장·권 경계를 넘어가며, 성경 끝이면 null
function stepRef(bible, { b, c, v }, dir) {
  const nums = verseNums(bible, b, c);
  const i = nums.indexOf(v);
  if (i !== -1 && nums[i + dir] !== undefined) return { b, c, v: nums[i + dir] };

  // 장 경계 — 다음/이전 장(없으면 다음/이전 권)으로
  let nb = b, nc = c + dir;
  if (nc < 1) {
    nb = b - 1;
    if (nb < 1) return null;
    nc = BOOK_MAP[nb].chapters;
  } else if (nc > (BOOK_MAP[b]?.chapters ?? 1)) {
    nb = b + 1;
    if (nb > 66) return null;
    nc = 1;
  }
  const next = verseNums(bible, nb, nc);
  if (!next.length) return null;
  return { b: nb, c: nc, v: dir > 0 ? next[0] : next[next.length - 1] };
}

function refLabel({ b, c, v }, version) {
  const info = BOOK_MAP[b];
  const name = version === 'NIV' ? (info?.en ?? info?.ko) : (info?.ko ?? '');
  return `${name} ${c}:${v}`;
}

export default function ProjectView({ bible, bibles, version, bookId, chapter, verses, onClose, bgLight, onBgLight, defaultBilingual = false }) {
  // 선택한 절들을 순서대로 보여주고, 양 끝에서는 앞뒤 절로 계속 이어간다
  const [list, setList] = useState(() => verses.map(v => ({ b: bookId, c: chapter, v: +v })));
  const [idx, setIdx]   = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showUI, setShowUI] = useState(true);   // 잠시 움직임이 없으면 컨트롤을 숨긴다
  const [bilingual, setBilingual] = useState(defaultBilingual);

  const rootRef  = useRef(null);
  const boxRef   = useRef(null);
  const textRef  = useRef(null);
  const uiTimer  = useRef(null);
  const touchX   = useRef(null);

  const cur = list[idx];
  const text = bible?.[String(cur.b)]?.[String(cur.c)]?.[String(cur.v)] ?? '';
  const otherVersion = version === 'NIV' ? 'HRV' : 'NIV';
  const otherText = bibles?.[otherVersion]?.[String(cur.b)]?.[String(cur.c)]?.[String(cur.v)] ?? '';

  const go = useCallback((dir) => {
    // 목록 안에서는 그대로 이동, 양 끝에서는 앞뒤 절을 이어붙인다
    if (dir > 0 && idx < list.length - 1) { setIdx(idx + 1); return; }
    if (dir < 0 && idx > 0) { setIdx(idx - 1); return; }
    const next = stepRef(bible, dir > 0 ? list[list.length - 1] : list[0], dir);
    if (!next) return;                              // 성경의 처음/끝
    if (dir > 0) { setList([...list, next]); setIdx(list.length); }
    else { setList([next, ...list]); setIdx(0); }
  }, [bible, idx, list]);

  // 컨트롤 자동 숨김
  const wakeUI = useCallback(() => {
    setShowUI(true);
    clearTimeout(uiTimer.current);
    uiTimer.current = setTimeout(() => setShowUI(false), 2500);
  }, []);
  useEffect(() => {
    uiTimer.current = setTimeout(() => setShowUI(false), 2500);
    return () => clearTimeout(uiTimer.current);
  }, []);

  // 키보드: ←/→ 이동, Esc 닫기, +/- 글자 크기
  useEffect(() => {
    function onKey(e) {
      const k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown') { e.preventDefault(); go(1); wakeUI(); }
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); go(-1); wakeUI(); }
      else if (k === 'Escape') onClose();
      else if (k === '+' || k === '=') { setZoom(z => Math.min(1.6, z + 0.1)); wakeUI(); }
      else if (k === '-') { setZoom(z => Math.max(0.5, z - 0.1)); wakeUI(); }
      else if (k.toLowerCase?.() === 'b') { onBgLight(!bgLight); wakeUI(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, wakeUI, bgLight, onBgLight]);

  // 전체화면 + 화면 꺼짐 방지 (지원하지 않는 브라우저에서는 조용히 무시)
  useEffect(() => {
    rootRef.current?.requestFullscreen?.().catch(() => {});
    let lock = null;
    navigator.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => {
      lock?.release?.().catch(() => {});
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // 사용자가 브라우저 UI로 전체화면을 빠져나가면 함께 닫는다
  useEffect(() => {
    function onFsChange() { if (!document.fullscreenElement) onClose(); }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [onClose]);

  // 화면에 꽉 차도록 글자 크기 자동 계산
  useLayoutEffect(() => {
    const box = boxRef.current, el = textRef.current;
    if (!box || !el) return;
    // 한 글자가 너무 커지지 않도록 상한을 두고, 그 안에서 화면에 꽉 차게 맞춘다
    const limit = Math.min(box.clientWidth * 0.18, box.clientHeight * 0.20) * zoom;
    let lo = 14, hi = Math.max(20, limit);
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}px`;
      if (el.scrollHeight <= box.clientHeight && el.scrollWidth <= box.clientWidth) lo = mid;
      else hi = mid;
    }
    el.style.fontSize = `${lo}px`;
  }, [text, otherText, bilingual, zoom, bgLight]);

  function onTouchStart(e) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    const start = touchX.current;
    touchX.current = null;
    if (start === null) return;
    const dx = e.changedTouches[0].clientX - start;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    wakeUI();
  }

  const label = refLabel(cur, version);
  const otherLabel = refLabel(cur, otherVersion);

  return (
    <div
      ref={rootRef}
      className={`project-view${bgLight ? ' light' : ''}${showUI ? '' : ' hide-ui'}`}
      onMouseMove={wakeUI}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={wakeUI}
    >
      <div className="project-stage">
        <div className="project-fit" ref={boxRef}>
          <div className="project-text" ref={textRef}>
            <p className="project-verse">{text}</p>
            {bilingual && otherText && <p className="project-verse other">{otherText}</p>}
          </div>
        </div>
      </div>

      <div className="project-ref">
        {label}
        {bilingual && otherText && <span className="project-ref-other"> · {otherLabel}</span>}
      </div>

      <button className="project-nav prev" onClick={e => { e.stopPropagation(); go(-1); }} aria-label="이전 절">‹</button>
      <button className="project-nav next" onClick={e => { e.stopPropagation(); go(1); }} aria-label="다음 절">›</button>

      <div className="project-controls" onClick={e => e.stopPropagation()}>
        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} title="글자 작게">A-</button>
        <button onClick={() => setZoom(z => Math.min(1.6, z + 0.1))} title="글자 크게">A+</button>
        <button onClick={() => onBgLight(!bgLight)} title="배경 밝기">{bgLight ? '🌙' : '☀'}</button>
        <button className={bilingual ? 'on' : ''} onClick={() => setBilingual(v => !v)} title="한·영 함께 보기">한/EN</button>
        <button className="project-close" onClick={onClose} title="닫기 (Esc)">✕</button>
      </div>

      <div className="project-hint">← → 로 이동 · Esc 로 닫기</div>
    </div>
  );
}
