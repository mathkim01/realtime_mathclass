import React from 'react';
    export default function MathText({ text, as = 'span', className = '' }) {
      const elementRef = React.useRef(null);

      React.useEffect(() => {
        let cancelled = false;

        const renderMath = () => {
          const element = elementRef.current;
          if (!element || cancelled) return;

          try {
            if (window.MathJax && window.MathJax.typesetClear) {
              window.MathJax.typesetClear([element]);
            }
            element.textContent = text || '';
            if (window.MathJax && window.MathJax.typesetPromise) {
              window.MathJax.typesetPromise([element])
                .catch((err) => console.warn('MathJax render error:', err));
            }
          } catch (err) {
            console.warn('MathJax render error:', err);
          }
        };

        renderMath();
        window.addEventListener('mathjax-ready', renderMath);
        return () => {
          cancelled = true;
          window.removeEventListener('mathjax-ready', renderMath);
          if (elementRef.current && window.MathJax && window.MathJax.typesetClear) {
            window.MathJax.typesetClear([elementRef.current]);
          }
        };
      }, [text]);

      return React.createElement(as, { ref: elementRef, className });
    }
