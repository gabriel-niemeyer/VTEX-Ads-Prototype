import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text?: string;
  content?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  position?: 'top' | 'bottom';
}

const TOOLTIP_Z_INDEX = 9999;

export const Tooltip: React.FC<TooltipProps> = ({ text, content, children, className = "", position = 'top' }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const isTop = position === 'top';

  // Regex to capture text and the shortcut content inside parentheses at the end
  const shortcutMatch = text ? text.match(/(.+)\s\((.+)\)$/) : null;
  const mainText = shortcutMatch ? shortcutMatch[1] : (text || '');
  const shortcutKey = shortcutMatch ? shortcutMatch[2] : null;

  // Measure trigger when tooltip becomes visible
  useLayoutEffect(() => {
    if (!visible) {
      setCoords(null);
      return;
    }
    const updateCoords = () => {
      if (triggerRef.current) {
        setCoords(triggerRef.current.getBoundingClientRect());
      }
    };
    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [visible]);

  const tooltipContent = coords && (
    <div
      className={`fixed pointer-events-none select-none transition-opacity duration-200 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={{
        zIndex: TOOLTIP_Z_INDEX,
        left: coords.left + coords.width / 2,
        top: isTop ? coords.top : coords.bottom,
        transform: `translate(-50%, ${isTop ? '-100%' : '0'}) translateY(${isTop ? '-8px' : '8px'}) scale(${visible ? 1 : 0.95})`,
      }}
    >
      <div
        className={`${
          text ? 'h-[32px] flex items-center px-3 whitespace-nowrap leading-none' : 'p-3 min-w-max leading-tight'
        } bg-gray-900 text-white text-[12px] tracking-normal font-medium rounded-lg shadow-xl`}
      >
        {content ?? (
          <>
            <span className="mr-0.5">{mainText}</span>
            {shortcutKey && (
              <span className="ml-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold font-sans text-gray-300 bg-white/10 border border-white/10 rounded-[4px]">
                {shortcutKey}
              </span>
            )}
          </>
        )}
        {/* Arrow */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
            isTop ? 'top-full border-t-gray-900' : 'bottom-full border-b-gray-900'
          }`}
        />
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className={`relative flex items-center justify-center w-fit ${className}`}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </div>
      {typeof document !== 'undefined' && createPortal(tooltipContent, document.body)}
    </>
  );
};
