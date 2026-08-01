---
sidebar: false
editLink: false
prev: false
next: false
footer: false
description: "Fehlerbehebung bei fehlgeschlagener Cap-Verifizierung: Lösungen für das quelloffene, selbst gehostete CAPTCHA, wenn Proof-of-Work- oder Instrumentation-Prüfungen im Browser scheitern."
---

# Fehlerbehebung

Diese Verifizierung kann aus verschiedenen Gründen fehlschlagen, nicht nur wegen Bot-Aktivität. Wenn du Probleme hast, die Verifizierung abzuschließen, arbeite die folgenden Schritte ab.

## 1. Inkognito- oder privaten Modus probieren

Öffne den Inkognito- bzw. privaten Modus deines Browsers, um Probleme durch Erweiterungen oder zwischengespeicherte Daten auszuschließen.

- **Chrome / Edge:** `Strg+Umschalt+N` (Windows) oder `Cmd+Umschalt+N` (Mac)
- **Firefox:** `Strg+Umschalt+P` (Windows) oder `Cmd+Umschalt+P` (Mac)
- **Safari:** **Ablage → Neues privates Fenster**

## 2. Browser-Erweiterungen deaktivieren

Manche Erweiterungen stören den Verifizierungsvorgang. Deaktiviere sie testweise:

1. Öffne die Einstellungen für Erweiterungen oder Add-ons deines Browsers
2. Deaktiviere vorübergehend **alle** Erweiterungen
3. Lade die Seite neu und versuche es erneut

Wenn das hilft, aktiviere die Erweiterungen eine nach der anderen wieder, um die Ursache zu finden.

## 3. Anderen Browser oder ein anderes Gerät probieren

Das Problem kann auf deinen aktuellen Browser beschränkt sein. Wechsle zum Testen den Browser oder das Gerät.

- Probiere **Chrome**, **Firefox**, **Edge** oder **Safari**
- Hinweis: **Internet Explorer wird nicht unterstützt.** Nutze stattdessen einen modernen Browser
- Wenn möglich, versuche es auf einem ganz anderen Gerät (z. B. deinem Smartphone)

## 4. Browser aktualisieren

Ein veralteter Browser kann dazu führen, dass die Verifizierung fehlschlägt.

1. Öffne das Menü deines Browsers
2. Gehe zu **Hilfe → Über** (oder ähnlich)
3. Installiere verfügbare Updates und starte den Browser neu

## 5. In ein anderes Netzwerk wechseln

Dein aktuelles Netzwerk kann Einschränkungen haben, die die Verifizierung stören.

- Verbinde dich mit einem **anderen WLAN**
- Probiere einen **mobilen Hotspot** über dein Smartphone
- In Firmen- oder Schulnetzen gibt es oft strenge Filter, die die Verifizierung blockieren können

## 6. Automatisierte Browser-Sitzungen schließen

Wenn du einen Browser nutzt, der von Automatisierungssoftware gesteuert wird (etwa Selenium, Puppeteer oder Playwright), wird die Verifizierung blockiert.

1. **Beende** die automatisierte Browser-Sitzung vollständig
2. Öffne die Seite in einem **normalen, manuell bedienten Browser**
3. Schließe die Verifizierung dort ab

Auch Browser von KI-Agenten werden blockiert, stelle also sicher, dass du einen gewöhnlichen Browser verwendest.

---

Wenn du all das versucht hast und trotzdem nicht durchkommst, wende dich am besten an den Betreiber der Website. Alternativ kannst du auch [ein Issue melden](https://github.com/tiagozip/cap/issues).
