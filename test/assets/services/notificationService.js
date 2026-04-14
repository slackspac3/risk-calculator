const NotificationService = (() => {
  function getCurrentUsername() {
    return (typeof AuthService !== 'undefined' && AuthService.getCurrentUser()?.username) || null;
  }

  function getStorageKey(username) {
    return `rq_notifications_${username}`;
  }

  function readNotifications(username) {
    if (!username || typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(getStorageKey(username));
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
    } catch {
      return [];
    }
  }

  function writeNotifications(username, notifications) {
    if (!username || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(getStorageKey(username), JSON.stringify(Array.isArray(notifications) ? notifications : []));
    } catch {}
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('rq:notifications-changed', {
          detail: { username, count: Array.isArray(notifications) ? notifications.length : 0 }
        }));
      }
    } catch {}
  }

  function addNotification(type, title, body, linkHash) {
    const username = getCurrentUsername();
    if (!username) return null;
    const existing = readNotifications(username);
    const notification = {
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: String(type || '').trim() || 'review_requested',
      title: String(title || '').trim() || 'Notification',
      body: String(body || '').trim(),
      linkHash: String(linkHash || '').trim(),
      createdAt: Date.now(),
      read: false
    };
    existing.unshift(notification);
    if (existing.length > 50) existing.length = 50;
    writeNotifications(username, existing);
    return notification;
  }

  function getAll() {
    const username = getCurrentUsername();
    if (!username) return [];
    return readNotifications(username);
  }

  function getUnread() {
    return getAll().filter(item => item.read !== true);
  }

  function markRead(id) {
    const username = getCurrentUsername();
    if (!username) return;
    const safeId = String(id || '').trim();
    if (!safeId) return;
    const updated = readNotifications(username).map(item => (
      item.id === safeId ? { ...item, read: true } : item
    ));
    writeNotifications(username, updated);
  }

  function markAllRead() {
    const username = getCurrentUsername();
    if (!username) return;
    const updated = readNotifications(username).map(item => ({ ...item, read: true }));
    writeNotifications(username, updated);
  }

  function clearAll() {
    const username = getCurrentUsername();
    if (!username) return;
    writeNotifications(username, []);
  }

  return { addNotification, getAll, getUnread, markRead, markAllRead, clearAll };
})();

if (typeof module !== 'undefined') module.exports = NotificationService;
