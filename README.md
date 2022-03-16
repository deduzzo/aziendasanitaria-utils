# Gestione dei Flussi Sanitari Regione Sicilia

 Libreria per la gestione dei flussi sanitari della regione Sicilia.


### Funzionalità
- Caratteristiche comuni
  - [x] Gestione impostazioni Mail e Flussi
  - [x] Gestione distretti e Comuni (da db Flowlook)
- ### Flusso M
  - [x] Verifica formale
  - [x] Acquisizione dati (strutture, branche, prezzi, comuni ecc) dal DB dell'app Flowlook (Regione Sicilia)
  - [x] Unione file TXT
  - [x] Verifica Duplicati (anche su file grossi con milioni di record)
  - [x] Ulteriori verifiche (date prestazioni, nome file, distretto ecc..)
  - [x] Elaborazione informazioni finanziarie sul flusso
  - [x] Verifica delle informazioni delle strutture con verifica su sito Sogei Progetto Tessera Sanitaria (TS) (richiede credenziali e abilitazione)
  - [x] Calcolo differenze e congruità tra i dati del Flusso e quelli del Progetto TS
  - [x] Generazione Report in formato HTML ed Excel
  - [x] Invio Report tramite mail a diversi destinatari (es. suddivisi per distretto o altra suddivisione)
  - [x] Calcolo volumi
  - [ ] Creazione DB SqlLite
### Flusso SIAD
  - [x] Conteggio Prestazioni
### Flusso Hospice
  - [x] Calcolo numero giornate di degenza