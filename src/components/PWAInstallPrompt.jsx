import { useState, useEffect } from 'react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 이미 설치된 PWA로 실행 중이면 표시 안 함
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    if (ios) {
      setVisible(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  }

  if (installed || !visible) return null;

  return (
    <div className="pwa-overlay" onClick={() => setVisible(false)}>
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
          ) : (
            <div className="pwa-actions">
              <button className="pwa-btn-install" onClick={handleInstall}>설치하기</button>
              <button className="pwa-btn-cancel" onClick={() => setVisible(false)}>나중에</button>
            </div>
          )}
          {isIOS && (
            <button className="pwa-btn-cancel" onClick={() => setVisible(false)}>닫기</button>
          )}
        </div>
      </div>
    </div>
  );
}
