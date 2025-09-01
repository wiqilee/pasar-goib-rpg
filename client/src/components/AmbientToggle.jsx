// client/src/components/AmbientToggle.jsx
import React, { useEffect, useRef, useState } from 'react';

/**
 * AmbientToggle
 * Minimal ambience audio controller.
 * - Put your audio at: /public/sfx/ambience.mp3  (or pass a different `src`)
 * - Browsers block autoplay; playback starts only after user clicks the button.
 */
export default function AmbientToggle({
  src = '/sfx/ambience.mp3',
  labelOn = 'Ambience: ON',
  labelOff = 'Ambience: OFF',
  volume = 0.35,
}) {
  const audioRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio(src);
      a.loop = true;
      a.volume = Math.max(0, Math.min(1, volume));
      audioRef.current = a;
    }
  }, [src, volume]);

  const toggle = async () => {
    if (!audioRef.current) return;
    setErr('');
    try {
      if (!enabled) {
        await audioRef.current.play();
        setEnabled(true);
      } else {
        audioRef.current.pause();
        setEnabled(false);
      }
    } catch (e) {
      setErr('Cannot play audio. Ensure /public/sfx/ambience.mp3 exists.');
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        className={`rounded-lg px-3 py-2 border text-sm ${
          enabled
            ? 'bg-emerald-600 text-white border-emerald-500'
            : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
        }`}
      >
        {enabled ? labelOn : labelOff}
      </button>
      {err ? <span className="text-rose-400 text-xs">{err}</span> : null}
    </div>
  );
}
