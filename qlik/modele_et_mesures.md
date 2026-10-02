# Projet dataviz Qlik - modèle, mesures et pages

**Problématique : « Où et pourquoi le Canada fait-il appel à des travailleurs étrangers temporaires ? »**

Règle de traitement : seuls les **formats** sont corrigés (espaces, accents perdus,
lignes de notes, code collé au libellé). Aucune valeur n'est inventée, estimée
ni dérivée ; les valeurs supprimées (`x`) ou indisponibles (`..`) restent vides.

> Le script `chargement_projet.qvs` n'a pas pu être exécuté dans Qlik depuis cet
> environnement : sa syntaxe est à tester dans l'éditeur. La logique de
> transformation a été vérifiée sur les fichiers fournis (770 lignes EPA attendues
> = 770 obtenues ; provinces, volets et groupes CNP des EIMT tous reconnus).
>
> Règle : uniquement des techniques vues en cours (sections, `LOAD ... FROM`, `as`,
> `RESIDENT`, `DROP TABLE`, `INLINE`, `MAPPING`, `Hash128`, `SET`/`LET`) ou très
> proches (`Trim`, `Left`, `Mid`, `Index`, `Len`, `If`).

## 1. Mise en place dans Qlik

1. Se connecter au cloud de l'IUT, créer l'application dans l'espace personnel.
2. Dans l'éditeur de chargement, **regarder d'abord la connexion BUT3** : le sujet
   parle d'un répertoire « Projet ». Les fichiers y sont peut-être déjà. Sinon,
   les envoyer via « Fichiers et autres sources ».
3. Utiliser l'assistant de sélection de fichier une fois pour lire le chemin exact
   (`lib://...`) et le mettre dans `vLib`.
4. Créer une section par partie du script (Référentiels, EPA, EIMT, Modèle).
   Garder les `SET` par défaut de la section Main.
5. **EPA** : générer le `LOAD` avec l'assistant (comme dans le TP2) et adapter le
   bloc du script. Vérifier dans l'aperçu que les valeurs sont bien des nombres ;
   sinon le séparateur décimal de la section Main ne correspond pas au fichier.
6. **EIMT** : un bloc `LOAD` par fichier trimestriel. Copier le bloc et changer
   le nom du fichier, l'année et le trimestre (à lire dans le titre de chaque
   fichier). Sur le fichier fourni, le nom dit 2026 T1 mais le titre dit
   janvier à mars 2025 : à trancher.
7. Créer la variable `vAnneeMaxEPA` dans l'éditeur de variables, avec le signe `=`
   (comme `=Today()` dans le cours) : `=Max({1<Indicateur={'Emploi'}>} Annee)`.

Si Qlik nomme les champs des EIMT autrement que `A` à `H`, adapter le bloc.

## 2. Modèle de données

```
Provinces ── Lien ── Groupes
              │
      ┌───────┴───────┐
 Faits_EPA        Faits_EIMT
```

| Table | Rôle | Champs principaux |
|---|---|---|
| Lien | une ligne par Année × Province × GroupeCNP | `%Cle` (Hash128), `Annee`, `Province`, `GroupeCNP` |
| Faits_EPA | emploi, chômage, temps plein/partiel... | `%Cle`, `Indicateur`, `Unite`, `Valeur`, `Statut`, `Disponible` |
| Faits_EIMT | un enregistrement par employeur × profession × trimestre | `%Cle`, `Trimestre`, `AnneeTrimestre`, `Volet`, `Employeur`, `Adresse`, `CNP5`, `Profession`, `EIMTApprouvees`, `PostesApprouves` |
| Provinces | référentiel | `Province`, `CodeProvince`, `TypeProvince`, `Capitale`, `Pays` |
| Groupes | les 10 grands groupes + le total | `GroupeCNP` |

Choix : un seul niveau de profession (10 grands groupes) pour éviter les doubles
comptages ; genre « Total » seulement ; la ligne « Canada » n'est pas chargée ;
le statut juridique des employeurs n'est pas chargé (inconnu dans 81 % des cas).

## 3. Contrôles après le premier chargement

- Aucune clé synthétique (`$Syn`) dans l'aperçu du modèle.
- Un tableau `Province` : aucune province inattendue (une valeur mal corrigée se voit tout de suite).
- Un tableau `AnneeTrimestre` : une période par fichier EIMT chargé, sans doublon.
- Un tableau `GroupeCNP` : 10 groupes + le total, aucun « Autre ».

## 4. Variables (cours « variables et set analysis »)

| Variable | Où | Contenu |
|---|---|---|
| `vLib` | script, `SET` | chemin de la connexion et du dossier |
| `vIgnEIMT` | script, `SET` | liste de champs EIMT dont on ignore la sélection |
| `vDerniereMaj` | script, `LET` | date du dernier chargement, pour le titre de la page 1 |
| `vAnneeMaxEPA` | éditeur de variables, avec `=` | dernière année avec EPA |

## 5. Hiérarchies à créer (Éléments principaux > Dimensions > Hiérarchique)

| Nom | Niveaux | Usage |
|---|---|---|
| Géographie | Pays > Province | carte (couche de zones) |
| Période | Annee > AnneeTrimestre | courbes avec forage |
| Profession | GroupeCNP > Profession | forage du groupe vers la profession EIMT |

Carte : couche de **zones** sur `Province`, avec `Pays` en dimension de contexte
(comme dans le cours, pour lever les ambiguïtés) ; couche de **points** sur
`Capitale`. Attention à « Saint-Jean » (Terre-Neuve), qui peut être placée au
mauvais endroit : à vérifier. Plan B si les zones ne s'affichent pas : un fichier
KML des provinces (cours KML).

## 6. Mesures (Éléments principaux > Mesures)

| Nom | Expression |
|---|---|
| Postes EIMT | `Sum(PostesApprouves)` |
| EIMT approuvées | `Sum(EIMTApprouvees)` |
| Employeurs | `Count(DISTINCT Employeur)` |
| Emploi (milliers) | `Sum({<Indicateur={'Emploi'}, GroupeCNP-={'Total (toutes professions)'}, $(vIgnEIMT)>} Valeur)` |
| Emploi total province (milliers) | `Sum({<Indicateur={'Emploi'}, GroupeCNP={'Total (toutes professions)'}, $(vIgnEIMT)>} Valeur)` |
| Taux de chômage (%) | `Avg({<Indicateur={'Taux de chômage'}, GroupeCNP={'Total (toutes professions)'}, $(vIgnEIMT)>} Valeur)` |
| **Postes pour 1 000 emplois** | `Sum({<Annee*={"<=$(vAnneeMaxEPA)"}, Province-={'Hors Canada (siège social)'}>} PostesApprouves) / Sum({<Indicateur={'Emploi'}, GroupeCNP-={'Total (toutes professions)'}, $(vIgnEIMT)>} Valeur)` |
| Complétude (%) | `Sum(Disponible) / Count(Disponible)` |
| Évolution des postes vs année précédente | `Sum(PostesApprouves) / Sum({<Annee={$(=Only(Annee)-1)}>} PostesApprouves) - 1` (une seule année sélectionnée) |

Notes :
- `$(vIgnEIMT)` évite que le choix d'un volet ou d'un trimestre fasse disparaître
  les données EPA.
- `Annee*={"<=$(vAnneeMaxEPA)"}` exclut 2026 du numérateur : il n'y a pas d'EPA en face.
- Le taux de chômage est une moyenne simple quand plusieurs provinces ou années
  sont sélectionnées : le dire dans l'infobulle.
- Unité : l'emploi est en milliers, donc le ratio est bien « postes pour 1 000 emplois ».

## 7. Pages

**1. Contexte** (titre : « Mise à jour du `=vDerniereMaj` »)
Texte et Image qui pose la problématique. KPI emploi total et taux de chômage de
l'année la plus récente. Courbe du taux de chômage par province, 2019-2025.

**2. Où ?**
Carte des provinces colorée par `Postes EIMT` (+ points sur les capitales).
Barres horizontales des postes par volet. Courbe par `AnneeTrimestre` (la
saisonnalité de l'agriculture primaire doit apparaître). Top 10 employeurs en tableau.
Panneau de filtres : Période, Volet, Province.

**3. Pourquoi ?**
Nuage de points : x = taux de chômage de la province, y = postes pour 1 000 emplois,
une bulle par province. Barres : postes pour 1 000 emplois par grand groupe de
professions. Treemap : postes par groupe puis profession (hiérarchie Profession).
Texte et Image : lecture des résultats et prudence sur la causalité.

**4. Qualité des données**
Carte de chaleur Province × Indicateur de la complétude (EPA). Texte et Image : ce qui est corrigé (formats) et ce qui ne l'est
pas (valeurs absentes, volontairement non remplacées).

**5. Conclusion**
Texte et Image : réponse nuancée à « où et pourquoi ».

Rappel : les EIMT mesurent des postes **approuvés**, pas des travailleurs arrivés ;
l'EPA exclut les territoires.
