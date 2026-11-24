# IQVIA Allergy

Diese Integration bringt die Gesundheitsvorhersagen von **IQVIA** in
Gladys: Allergie (Pollen), Asthma sowie Erkältung und Grippe, für einen oder
mehrere Orte in den Vereinigten Staaten. IQVIA veröffentlicht sie täglich
auf [pollen.com](https://www.pollen.com),
[asthmaforecast.com](https://www.asthmaforecast.com) und
[flustar.com](https://www.flustar.com), je Postleitzahl (ZIP code).

> IQVIA verkauft keine vernetzten Geräte: Die Integration legt pro Vorhersage
> und Ort ein schreibgeschütztes „Vorhersage“-Gerät an, das Sie wie jeden
> Sensor verwenden (Dashboards, Diagramme, Szenen).

## Was Sie erhalten

Für jede Postleitzahl erscheinen drei Geräte im Tab **Erkennung**:

| Gerät                  | Funktionen                                                            |
| ---------------------- | --------------------------------------------------------------------- |
| IQVIA pollen `ZIP`     | Index heute, Index morgen, Allergene heute, Pollensaison, Pollentrend |
| IQVIA asthma `ZIP`     | Index heute, Index morgen, Auslöser heute (Ozon, Feinstaub…)          |
| IQVIA cold & flu `ZIP` | Index heute, Index morgen                                             |

Jeder Index reicht von **0 bis 12**, in fünf Stufen:

| Index     | Stufe              |
| --------- | ------------------ |
| 0 – 2,4   | Niedrig            |
| 2,5 – 4,8 | Niedrig bis mittel |
| 4,9 – 7,2 | Mittel             |
| 7,3 – 9,6 | Mittel bis hoch    |
| 9,7 – 12  | Hoch               |

## Konfiguration

1. Öffnen Sie den Tab **Konfiguration** der Integration.
2. Geben Sie eine oder mehrere 5-stellige US-**Postleitzahlen** ein, durch
   Kommas getrennt (höchstens 5), z. B. `10001, 80238`.
3. Ändern Sie bei Bedarf das **Aktualisierungsintervall** (standardmäßig eine
   Stunde, mindestens 15 Minuten): IQVIA veröffentlicht einmal täglich eine
   neue Vorhersage.
4. Speichern Sie und fügen Sie die Geräte im Tab **Erkennung** hinzu.

Der Verbindungsstatus im Konfigurationsbildschirm zeigt, ob IQVIA
geantwortet hat. Jedes Gerät zeigt ein **Cloud**-Abzeichen, oder **nicht
erreichbar**, wenn das letzte Lesen fehlgeschlagen ist (die vorherigen Werte
bleiben erhalten).

Wird eine Postleitzahl entfernt, werden ihre Geräte nicht mehr aktualisiert:
Löschen Sie sie in Gladys, wenn Sie sie nicht mehr benötigen.

## Aktionen

- **Verbindung testen** — liest die heutige Pollenvorhersage jeder
  Postleitzahl live und zeigt Ort und Stufe unter der Schaltfläche an.
- **Vorhersagen aktualisieren** — liest sofort alle Vorhersagen.

## Szenen

Die Integration fügt dem Szeneneditor eigene Karten hinzu (Gladys 5.1 oder
neuer):

**Auslöser**

- **Allergiestufe geändert** — die heutige Stufe einer Vorhersage hat
  gewechselt. Wählen Sie optional das Vorhersagegerät und die neuen Stufen,
  auf die reagiert werden soll. Variablen: `level`, `previous_level`,
  `index`, `forecast`, `zip_code`.
- **Neue Tagesvorhersage** — IQVIA hat die Vorhersage eines neuen Tages
  veröffentlicht: der Moment für eine Morgenmeldung. Variablen: `location`,
  `index_today`, `level_today`, `index_tomorrow`, `level_tomorrow`,
  `triggers`, `forecast`, `zip_code`.

Keiner von beiden löst beim ersten Lesen nach dem Start der Integration aus:
Es gibt noch nichts zu vergleichen.

**Aktionen**

- **Allergievorhersage abrufen** — liest eine Vorhersage (heute oder
  morgen) und übergibt `index`, `level`, `level_label` (in der gewählten
  Sprache), `triggers` und `location` an die folgenden Aktionen, z. B. eine
  Nachricht „Pollen heute: {{level_label}} ({{index}}/12) — {{triggers}}“.
- **Allergievorhersagen aktualisieren** — liest sofort alle Vorhersagen;
  gibt die Anzahl der aktualisierten (`refreshed`) und fehlgeschlagenen
  (`failed`) Vorhersagen zurück.

## Dashboard

Fügen Sie einem Dashboard das Widget **Allergievorhersage** hinzu: die
heutigen Pollen-, Asthma- und Erkältungsindizes (live), ein Diagramm der
nächsten Tage, die Stufen, die Hauptallergene und die Pollensaison sowie
eine Schaltfläche **Aktualisieren**. Die Einstellung **Ort** wählt die
Postleitzahl (wählen Sie ein beliebiges Vorhersagegerät des Ortes); leer
gelassen, zeigt es die erste Postleitzahl der Konfiguration.

## Fehlerbehebung

- **„Geben Sie mindestens eine gültige 5-stellige US-Postleitzahl ein“** —
  das Feld ist leer oder enthält keine gültige US-Postleitzahl. IQVIA deckt
  nur die Vereinigten Staaten ab.
- **„keine Vorhersage für diese Postleitzahl“** — IQVIA hat ohne Daten
  geantwortet: Prüfen Sie die Postleitzahl auf
  [pollen.com](https://www.pollen.com).
- **Abzeichen „nicht erreichbar“** — IQVIA hat nicht geantwortet; die
  Integration versucht es bei der nächsten Aktualisierung erneut. Prüfen Sie
  die Protokolle der Integration (`LOG_LEVEL=debug` für jede Anfrage).

Die Vorhersagen stammen von den öffentlichen Websites von IQVIA; diese
Integration steht in keiner Verbindung zu IQVIA.
