// public/js/context-menu.js
window.ContextMenu = (function () {
  let el = null;
  let bound = false;

  function handleOutsideClick(e) {
    if (!el) return;
    if (el.contains(e.target)) return; // click inside menu — ignore
    close();
  }

  function handleKey(e) {
    if (e.key === 'Escape') close();
  }

  function handleScroll() {
    close();
  }

  function close() {
    if (el) {
      el.remove();
      el = null;
    }
    if (bound) {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('scroll', handleScroll, true);
      bound = false;
    }
  }

  function open(x, y, items) {
    close();
    if (!items || items.length === 0) return;

    el = document.createElement('div');
    el.id = 'app-context-menu';
    el.className = 'bg-surface-card border border-hairline-strong rounded-lg shadow-2xl py-1 min-w-[200px] fixed z-[500] select-none font-sans text-[14px]';
    el.style.backgroundColor = '#1e2329';
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    items.forEach(item => {
      if (item.divider) {
        const d = document.createElement('div');
        d.className = 'border-t border-hairline my-1';
        el.appendChild(d);
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `w-full text-left font-sans text-[14px] px-4 py-2.5 flex items-center gap-2 transition-colors cursor-pointer ${
        item.danger
          ? 'text-danger hover:bg-danger/10'
          : item.disabled
            ? 'text-muted cursor-not-allowed opacity-50'
            : 'text-body hover:bg-surface-elevated'
      }`;
      btn.innerHTML = `<span>${item.label}</span>`;
      if (item.disabled) {
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          close();
          item.action?.();
        });
      }
      el.appendChild(btn);
    });

    document.body.appendChild(el);

    // Auto-flip near edges
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) el.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) el.style.top = (y - rect.height) + 'px';

    // Attach listeners AFTER the current event loop so the right-click
    // that opened the menu doesn't immediately trigger close.
    // Using `mousedown` (not `click`) — fires earlier and catches all cases.
    setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick, true);
      document.addEventListener('keydown', handleKey, true);
      window.addEventListener('scroll', handleScroll, true);
      bound = true;
    }, 0);
  }

  return { open, close };
})();
