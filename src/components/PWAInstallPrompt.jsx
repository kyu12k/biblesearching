import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'pwa-dismissed';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    if (window.__pwaPrompt) setDeferredPrompt(window.__pwaPrompt);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      window.__pwaPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handler);

    setVisible(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() { setVisible(false); }
  function dismissForever() { localStorage.setItem(DISMISSED_KEY, '1'); setVisible(false); }

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
    window.__pwaPrompt = null;
  }

  if (!visible) return null;

  return (
    <div className="pwa-overlay" onClick={dismiss}>
      <div className="pwa-popup" onClick={e => e.stopPropagation()}>
        <img src="/icon.png" alt="앱 아이콘" className="pwa-icon" />
        <div className="pwa-body">
          <strong>앱으로 설치하기</strong>
          <p>홈 화면에 추가하면 오프라인에서도 성경을 볼 수 있어요.</p>
          {isIOS ? (
            <p className="pwa-ios-tip">
              Safari 하단의 <b>공유 버튼(⎙)</b>을 누른 후<br />
              <b>"홈 화면에 추가"</b>를 선택하세요.
            </p>
          ) : deferredPrompt ? (
            <div className="pwa-actions">
              <button className="pwa-btn-install" onClick={handleInstall}>설치하기</button>
              <button className="pwa-btn-cancel" onClick={dismiss}>나중에</button>
            </div>
          ) : (
            <p className="pwa-ios-tip">
              브라우저 주소창 오른쪽의 <b>설치(⊕)</b> 아이콘을 누르거나,<br />
              메뉴 → <b>"앱 설치"</b>를 선택하세요.
            </p>
          )}
          <button className="pwa-btn-dismiss-forever" onClick={dismissForever}>다시 보지 않기</button>
        </div>
      </div>
    </div>
  );
}
