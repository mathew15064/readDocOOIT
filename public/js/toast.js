function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-4 right-4 flex flex-col space-y-2 z-[600]';
    document.body.appendChild(container);
  }
  const borderClass = {
    success: 'border-success',
    error: 'border-danger',
    danger: 'border-danger',
    warning: 'border-warning',
    info: 'border-info',
  }[type] || 'border-info';

  const toast = document.createElement('div');
  toast.className = `bg-surface-card text-body border-l-4 ${borderClass} min-w-[280px] px-4 py-3 font-sans text-[14px] rounded-lg shadow-lg border-t border-r border-b border-hairline`;
  toast.style.backgroundColor = '#1e2329';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

