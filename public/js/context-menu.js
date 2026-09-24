// public/js/context-menu.js
window.ContextMenu = {
  activeMenu: null,

  open(x, y, items) {
    this.close();
    if (!items || items.length === 0) return;

    const menu = document.createElement('div');
    menu.id = 'app-context-menu';
    menu.className = 'bg-canvas border border-hairline rounded-lg shadow-lg py-1.5 min-w-[200px] fixed z-50 select-none';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    items.forEach((item) => {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'border-t border-hairline-soft my-1';
        menu.appendChild(div);
        return;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `w-full text-left font-sans text-sm px-3 py-2 flex items-center space-x-2 transition ${
        item.danger
          ? 'text-error hover:bg-error/10'
          : item.disabled
            ? 'text-muted-soft cursor-not-allowed opacity-50'
            : 'text-ink hover:bg-surface-card'
      }`;

      if (item.disabled) {
        btn.disabled = true;
      }

      const iconSpan = document.createElement('span');
      iconSpan.className = 'w-4 text-center flex-shrink-0 text-sm';
      iconSpan.textContent = item.icon || '';
      btn.appendChild(iconSpan);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'truncate flex-1';
      labelSpan.textContent = item.label || '';
      btn.appendChild(labelSpan);

      if (!item.disabled) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          ContextMenu.close();
          if (typeof item.action === 'function') {
            item.action();
          }
        });
      }

      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    this.activeMenu = menu;

    // Adjust position if near right or bottom edge
    const rect = menu.getBoundingClientRect();
    const margin = 10;
    if (rect.right > window.innerWidth - margin) {
      menu.style.left = `${Math.max(margin, window.innerWidth - rect.width - margin)}px`;
    }
    if (rect.bottom > window.innerHeight - margin) {
      menu.style.top = `${Math.max(margin, window.innerHeight - rect.height - margin)}px`;
    }
  },

  close() {
    if (this.activeMenu) {
      this.activeMenu.remove();
      this.activeMenu = null;
    }
  }
};

// Global click & key listeners to close context menu
window.addEventListener('click', () => ContextMenu.close());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') ContextMenu.close();
});
window.addEventListener('scroll', () => ContextMenu.close(), true);
window.addEventListener('resize', () => ContextMenu.close());
