"use client";

import { useEffect, useState } from "react";

type Notification = {
  id: string;
  type: string;
  channel: string;
  status: string;
  createdAt: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/notifications", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) =>
        setNotifications(
          Array.isArray(payload?.notifications) ? payload.notifications : [],
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1>Notifications</h1>
        </div>
      </div>
      {loading ? <p>Loading notifications...</p> : null}
      {!loading && notifications.length === 0 ? <p>No notifications yet.</p> : null}
      <ul>
        {notifications.map((notification) => (
          <li key={notification.id}>
            <strong>{notification.type}</strong> · {notification.channel} ·{" "}
            {notification.status}
          </li>
        ))}
      </ul>
    </section>
  );
}
