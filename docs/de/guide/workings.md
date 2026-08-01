---
description: "Wie Cap unter der Haube funktioniert: Das selbst gehostete CAPTCHA erzeugt Seeded-Proof-of-Work-Challenges, löst sie in WASM und löst dann ein signiertes Token auf dem Server ein."
---

# Wie funktioniert Cap?

Das hier ist übrigens eine eher technische Erklärung, wie Caps SHA-256- und Instrumentation-Challenges funktionieren. [RSW-Time-Locks](./rsw.md) sind nicht enthalten. Wenn du einen allgemeineren Überblick suchst, schau dir die Seite [Wirksamkeit](./effectiveness.md) an.

---

1. Wird Cap initialisiert, registriert es automatisch ein Custom Element für das Widget im Browser.
2. Das Widget erzeugt ein Shadow DOM und hängt alle nötigen Elemente daran an.

#### Die Challenge anfordern

3. Wird eine Lösung angefordert, schickt das Widget eine Anfrage an den Server. Der Server liefert ein Token zurück, die Konfiguration der zu lösenden Challenges und optional komprimierte Instrumentation-Daten.

4. Das Widget erzeugt daraufhin mehrere Challenges anhand eines festen Seeds (des Challenge-Tokens) und der vom Server gelieferten Konfiguration. Sind Instrumentation-Daten vorhanden, werden sie dekomprimiert und in einem gesandboxten Iframe gelöst.

#### Die Lösung berechnen

5. Das Widget nutzt Rust-basiertes WASM und Web Worker, um die Challenges parallel zu lösen:
   - Jeder Worker versucht, eine gültige Nonce zu finden, indem er wiederholt:
     - das Salt mit verschiedenen Nonce-Werten kombiniert,
     - den SHA-256-Hash dieser Kombination berechnet,
     - prüft, ob der entstandene Hash mit dem Zielpräfix beginnt.
   - Das WASM erhöht die Nonce so lange, bis ein passender Hash gefunden ist.

6. Instrumentation-Challenges werden, falls vorhanden, dekomprimiert und ausgeführt.

#### Die Lösung gegen ein Token einlösen

7. Sobald eine gültige Lösung gefunden ist, schickt das Widget das Ergebnis zur Prüfung zurück an den Server.
8. Der Server erzeugt anschließend selbst dieselben Challenges aus dem übergebenen Token und der Konfiguration und verifiziert die vom Widget eingereichten Lösungen.
9. Nach erfolgreicher Prüfung löst der Server die Lösung ein und stellt ein Token aus, mit dem sich die Anfrage authentifizieren lässt.
