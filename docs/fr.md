# IQVIA Allergy

Cette intégration apporte dans Gladys les prévisions santé d'**IQVIA** :
allergie (pollen), asthme et rhume/grippe, pour un ou plusieurs lieux aux
États-Unis. IQVIA les publie chaque jour sur
[pollen.com](https://www.pollen.com),
[asthmaforecast.com](https://www.asthmaforecast.com) et
[flustar.com](https://www.flustar.com), par code postal (ZIP code).

> IQVIA ne vend aucun appareil connecté : l'intégration crée un appareil
> « prévision » en lecture seule par prévision et par lieu, que vous utilisez
> comme n'importe quel capteur (tableaux de bord, graphiques, scènes).

## Ce que vous obtenez

Pour chaque code postal, trois appareils apparaissent dans l'onglet
**Découverte** :

| Appareil               | Fonctionnalités                                                                   |
| ---------------------- | --------------------------------------------------------------------------------- |
| IQVIA pollen `ZIP`     | indice du jour, indice de demain, allergènes du jour, saison pollinique, tendance |
| IQVIA asthma `ZIP`     | indice du jour, indice de demain, facteurs du jour (ozone, particules fines…)     |
| IQVIA cold & flu `ZIP` | indice du jour, indice de demain                                                  |

Chaque indice va de **0 à 12**, en cinq niveaux :

| Indice    | Niveau         |
| --------- | -------------- |
| 0 – 2,4   | Faible         |
| 2,5 – 4,8 | Faible à moyen |
| 4,9 – 7,2 | Moyen          |
| 7,3 – 9,6 | Moyen à élevé  |
| 9,7 – 12  | Élevé          |

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Saisissez un ou plusieurs **codes postaux** américains à 5 chiffres,
   séparés par des virgules (5 au plus), par exemple `10001, 80238`.
3. Modifiez si besoin l'**intervalle de rafraîchissement** (une heure par
   défaut, 15 minutes au minimum) : IQVIA publie une nouvelle prévision une
   fois par jour.
4. Enregistrez, puis ajoutez les appareils depuis l'onglet **Découverte**.

Le statut de connexion de l'écran de configuration indique si IQVIA a
répondu. Chaque appareil affiche un badge **cloud**, ou **injoignable** quand
sa dernière lecture a échoué (les valeurs précédentes sont conservées).

Retirer un code postal arrête le rafraîchissement de ses appareils :
supprimez-les de Gladys si vous n'en avez plus besoin.

## Actions

- **Tester la connexion** — lit en direct la prévision pollen du jour de
  chaque code postal, et affiche le lieu et le niveau sous le bouton.
- **Actualiser les prévisions** — lit toutes les prévisions maintenant.

## Scènes

L'intégration ajoute ses propres cartes à l'éditeur de scènes (Gladys 5.1
ou plus récent) :

**Déclencheurs**

- **Niveau d'allergie modifié** — le niveau du jour d'une prévision a changé
  de palier. Choisissez éventuellement l'appareil de prévision et les
  nouveaux niveaux qui vous intéressent. Variables : `level`,
  `previous_level`, `index`, `forecast`, `zip_code`.
- **Nouvelle prévision du jour** — IQVIA a publié la prévision d'un nouveau
  jour : le moment d'envoyer une notification matinale. Variables :
  `location`, `index_today`, `level_today`, `index_tomorrow`,
  `level_tomorrow`, `triggers`, `forecast`, `zip_code`.

Aucun ne se déclenche à la première lecture après le démarrage de
l'intégration : il n'y a encore rien à comparer.

**Actions**

- **Obtenir une prévision d'allergie** — lit une prévision (aujourd'hui ou
  demain) et transmet `index`, `level`, `level_label` (dans la langue
  choisie), `triggers` et `location` aux actions suivantes, par exemple un
  message « Pollen aujourd'hui : {{level_label}} ({{index}}/12) —
  {{triggers}} ».
- **Actualiser les prévisions d'allergie** — lit toutes les prévisions
  maintenant ; renvoie le nombre de prévisions actualisées (`refreshed`) et
  en échec (`failed`).

## Tableau de bord

Ajoutez le widget **Prévisions d'allergie** à un tableau de bord : les
indices pollen, asthme et rhume/grippe du jour (en direct), un graphique des
prochains jours, les niveaux, les principaux allergènes et la saison
pollinique, et un bouton **Actualiser**. Son réglage **Lieu** choisit le code
postal (sélectionnez n'importe quel appareil de prévision du lieu) ; laissé
vide, il affiche le premier code postal de la configuration.

## Dépannage

- **« Saisissez au moins un code postal américain valide à 5 chiffres »** —
  le champ des codes postaux est vide ou ne contient aucun code américain
  valide. IQVIA ne couvre que les États-Unis.
- **« aucune prévision pour ce code postal »** — IQVIA a répondu sans
  données pour ce code : vérifiez-le sur [pollen.com](https://www.pollen.com).
- **Badge injoignable** — IQVIA n'a pas répondu ; l'intégration réessaie au
  rafraîchissement suivant. Consultez les logs de l'intégration
  (`LOG_LEVEL=debug` pour le détail de chaque requête).

Les prévisions sont celles des sites publics d'IQVIA ; cette intégration
n'est pas affiliée à IQVIA.
