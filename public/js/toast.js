function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-4 right-4 flex flex-col space-y-2 z-50';
    document.body.appendChild(container);
  }
  const borderClass = {
    success: 'border-success',
    error: 'border-error',
    warning: 'border-warning',
    info: 'border-primary',
  }[type] || 'border-primary';

  const toast = document.createElement('div');
  toast.className = `bg-surface-dark text-on-dark rounded-lg shadow-lg border-l-4 ${borderClass} min-w-[280px] px-4 py-3 font-sans text-sm`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}
