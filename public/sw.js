/* Service worker: resta in ascolto anche a pagina chiusa.
   Non ha logica propria — mostra quello che il server gli manda. */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Calisthenics Academy", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Calisthenics Academy";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icon.png",
      badge: "/icon.png",
      // Lo stesso tag sostituisce l'avviso precedente invece di
      // accumularne dieci uguali.
      tag: payload.tag || "academy",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  // Se una scheda del sito è già aperta la si porta in primo piano,
  // invece di aprirne una nuova ogni volta.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
