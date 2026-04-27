/**
 * Test interattivo del flusso di Cambio Medico (NAR2) — DRY-RUN per default.
 *
 * Esecuzione:
 *   node ./test-cambio-medico.js
 *
 * Lo script percorre tutti gli step della procedura usando le funzioni della
 * classe Nar2 e mostra a video i dati intermedi. Non invia nulla a NAR2 a meno
 * che l'utente non confermi esplicitamente lo step finale.
 */

import readline from "readline";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Nar2 } from "./src/narTsServices/Nar2.js";
import { ImpostazioniServiziTerzi } from "./src/config/ImpostazioniServiziTerzi.js";
import moment from "moment";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configData = JSON.parse(fs.readFileSync(path.join(__dirname, "config/config.json"), "utf8"));

// ---------- helpers UI ----------
const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m"
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));

const banner = (txt) => console.log(`\n${C.bold}${C.cyan}━━━ ${txt} ━━━${C.reset}`);
const sub = (txt) => console.log(`${C.bold}${C.blue}▸ ${txt}${C.reset}`);
const ok = (txt) => console.log(`${C.green}✓${C.reset} ${txt}`);
const warn = (txt) => console.log(`${C.yellow}⚠${C.reset} ${txt}`);
const err = (txt) => console.log(`${C.red}✗${C.reset} ${txt}`);
const kv = (k, v) => console.log(`  ${C.gray}${k}:${C.reset} ${v ?? ""}`);

const printJson = (obj, label = "") => {
    if (label) console.log(`${C.dim}${label}:${C.reset}`);
    console.log(JSON.stringify(obj, null, 2));
};

// ---------- main ----------
(async () => {
    console.log(`${C.bold}${C.magenta}┌────────────────────────────────────────────────┐${C.reset}`);
    console.log(`${C.bold}${C.magenta}│   TEST INTERATTIVO CAMBIO MEDICO NAR2 (DRY)    │${C.reset}`);
    console.log(`${C.bold}${C.magenta}└────────────────────────────────────────────────┘${C.reset}`);

    if (!configData.nar2_username || !configData.nar2_password) {
        err("Credenziali NAR2 mancanti in config/config.json");
        process.exit(1);
    }
    const settings = new ImpostazioniServiziTerzi(configData);
    const nar = new Nar2(settings);
    ok(`Login user: ${C.bold}${settings.nar2_username}${C.reset}`);

    // Token preflight
    try {
        await nar.getToken();
        ok("Token NAR2 ottenuto");
    } catch (e) {
        err(`Login fallito: ${e.message}`);
        process.exit(1);
    }

    // STEP 1 — codice fiscale
    banner("STEP 1 / Ricerca assistito");
    const cf = (await ask(`Codice fiscale assistito: `)).toUpperCase();
    if (!cf || cf.length < 11) { err("CF non valido"); process.exit(1); }

    sub("Recupero dati assistito (getDatiAssistitoNar2FromCf)…");
    const datiRes = await nar.getDatiAssistitoNar2FromCf(cf);
    if (!datiRes.ok) { err("Assistito non trovato su NAR2"); process.exit(1); }
    const full = datiRes.fullData.data;
    ok("Assistito trovato");
    kv("pz_id", full.pz_id);
    kv("Nome", `${full.pz_nome} ${full.pz_cogn}`);
    kv("CF", full.pz_cfis);
    kv("Sesso", full.pz_sesso);
    kv("Data nascita", moment(full.pz_dt_nas, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY"));
    const eta = moment().diff(moment(full.pz_dt_nas, "YYYY-MM-DD HH:mm:ss"), "years");
    kv("Età", eta);
    kv("Comune residenza", `${full.comune_residenza?.cm_desc ?? "-"} (cod ${full.pz_com_res})`);
    kv("Indirizzo", full.pz_ind_res);
    kv("Azienda", full.comune_domicilio?._azienda?.[0]?.az_azie ?? "?");

    const medicoCorrente = full.medico ?? {};
    if (medicoCorrente?.pf_id) {
        kv("Medico attuale", `${medicoCorrente.pf_cognome ?? ""} ${medicoCorrente.pf_nome ?? ""} (pf_id=${medicoCorrente.pf_id})`);
    }

    // STEP 2 — scelta corrente (per revoca)
    banner("STEP 2 / Scelta medico attiva (storico_medici)");
    const storico = Array.isArray(full.storico_medici) ? full.storico_medici : [];
    const sceltaAttiva = storico.find(s => s?.pm_fstato === "A" && !s?.pm_dt_disable);
    let pmIdCorrente = null;
    if (sceltaAttiva) {
        pmIdCorrente = sceltaAttiva.pm_id;
        ok(`Scelta attiva trovata (verrà usata in revoca_scelta_precedente)`);
        kv("pm_id corrente", pmIdCorrente);
        kv("pm_medico", sceltaAttiva.pm_medico);
        kv("pm_dt_enable", sceltaAttiva.pm_dt_enable);
        kv("pm_mot_scelta", sceltaAttiva.pm_mot_scelta ?? "(null)");
        kv("pm_r_medico", sceltaAttiva.pm_r_medico);
    } else {
        warn("Nessuna scelta attiva (nuova iscrizione)");
    }

    // STEP 3 — situazioni ammesse
    banner("STEP 3 / Situazioni assistenziali AMMESSE per il cambio");
    sub("getSituazioniAssistenzialiAmmesse() (endpoint getOnlySitAss)…");
    const tipoMedRaw = (await ask(`Tipo medico [M=MMG (default), P=Pediatra]: `)).toUpperCase() || "M";
    const tipoMedico = tipoMedRaw === "P" ? Nar2.PEDIATRA : Nar2.MEDICO_DI_BASE;
    const sitAmmesseRes = await nar.getSituazioniAssistenzialiAmmesse(cf, { tipoMedico });
    if (!sitAmmesseRes.ok || !Array.isArray(sitAmmesseRes.data)) {
        err("Impossibile recuperare situazioni ammesse"); process.exit(1);
    }
    sitAmmesseRes.data.forEach((s, i) => {
        const motivo = s.motivo_op?.[0];
        console.log(`  ${C.bold}[${i}]${C.reset} sa_cod=${C.yellow}${s.sa_cod}${C.reset} sa_id=${s.sa_id} — ${s.sa_desc}`);
        if (motivo) console.log(`       motivo: ${motivo.eg_cod} ${motivo.eg_desc1} (eg_id=${motivo.eg_id})`);
    });
    const defIdx = sitAmmesseRes.data.findIndex(s => s.sa_cod?.toString() === Nar2.SIT_ASS_CAMBIO_NELL_ASL);
    const sitInput = await ask(`Indice situazione [default ${defIdx >= 0 ? defIdx : 0} = sa_cod ${sitAmmesseRes.data[defIdx >= 0 ? defIdx : 0]?.sa_cod}]: `);
    const sitIdx = sitInput === "" ? (defIdx >= 0 ? defIdx : 0) : parseInt(sitInput, 10);
    const situazione = sitAmmesseRes.data[sitIdx];
    if (!situazione) { err("Indice non valido"); process.exit(1); }
    ok(`Selezionata: sa_cod=${situazione.sa_cod} (sa_id=${situazione.sa_id}) — ${situazione.sa_desc}`);

    // STEP 4 — categorie cittadino ammesse (info)
    sub("getCategorieCittadinoBySituazione() (endpoint getSCIDBySAID)…");
    const scid = await nar.getCategorieCittadinoBySituazione(situazione.sa_id);
    kv("sc_id ammessi", JSON.stringify(scid.data ?? []));

    // STEP 5 — ambiti di domicilio
    banner("STEP 4 / Ambiti di domicilio");
    sub("getAmbitiDomicilioAssistito()…");
    const ambitiRes = await nar.getAmbitiDomicilioAssistito(cf, { dividiAmbitiMMGPediatri: true });
    if (!ambitiRes.ok) { err("Errore recupero ambiti"); process.exit(1); }
    const lista = tipoMedico === Nar2.PEDIATRA ? ambitiRes.data.ambiti.pediatri : ambitiRes.data.ambiti.mmg;
    if (!lista || lista.length === 0) { err("Nessun ambito disponibile"); process.exit(1); }
    lista.forEach((a, i) => console.log(`  ${C.bold}[${i}]${C.reset} sr_id=${a.sr_id} ${a.sr_codice} — ${a.sr_desc}`));
    const ambIdx = parseInt((await ask(`Indice ambito di scelta [default 0]: `)) || "0", 10);
    const ambito = lista[ambIdx];
    if (!ambito) { err("Indice non valido"); process.exit(1); }
    ok(`Ambito selezionato: sr_id=${ambito.sr_id} ${ambito.sr_codice} ${ambito.sr_desc}`);

    // STEP 6 — medici disponibili nell'ambito
    banner("STEP 5 / Medici disponibili nell'ambito");
    sub("getMediciByAmbito()…");
    const mediciRes = await nar.getMediciByAmbito(ambito.sr_id, cf, tipoMedico, {
        sitAssistenziale: parseInt(situazione.sa_id, 10)
    });
    if (!mediciRes.ok) { err("Errore recupero medici"); process.exit(1); }
    const mediciLiberi = mediciRes.data.liberi || [];
    const massimalisti = mediciRes.data.massimalisti || [];
    console.log(`  ${C.green}${mediciLiberi.length} liberi${C.reset}, ${C.yellow}${massimalisti.length} massimalisti${C.reset}`);
    const showMedici = (arr, prefix) => arr.forEach((m, i) => {
        const massimale = m.massimale ?? "?";
        const scelte = m.scelte ?? "?";
        const carico = m.carico ?? "?";
        const tempStr = m.temporanei ? ` +${m.temporanei}temp` : "";
        console.log(`  ${C.bold}[${prefix}${i}]${C.reset} pf_id=${m.pf_id} cod_reg=${C.cyan}${m.codice_reg ?? "?"}${C.reset} ${C.bold}${m.pf_cognome} ${m.pf_nome}${C.reset} ${C.gray}[scelte ${scelte}/${massimale}, carico ${carico}${tempStr}]${C.reset}`);
    });
    showMedici(mediciLiberi, "L");
    if (massimalisti.length) showMedici(massimalisti, "M");
    const sceltaMed = (await ask(`Scegli medico (es. L0, M2) o pf_id diretto: `)).trim();
    let pfIdMedico = null;
    if (/^[LM]\d+$/i.test(sceltaMed)) {
        const arr = sceltaMed[0].toUpperCase() === "L" ? mediciLiberi : massimalisti;
        pfIdMedico = arr[parseInt(sceltaMed.slice(1), 10)]?.pf_id ?? null;
    } else if (/^\d+$/.test(sceltaMed)) {
        pfIdMedico = parseInt(sceltaMed, 10);
    }
    if (!pfIdMedico) { err("Selezione medico non valida"); process.exit(1); }
    ok(`pf_id medico scelto: ${pfIdMedico}`);

    // Dettagli completi del medico scelto
    sub("getMedicoFromId() — dettagli completi del medico…");
    const detMed = await nar.getMedicoFromId(pfIdMedico);
    if (detMed.ok) {
        const m = detMed.data;
        const ri = m.rapporto_individuale?.[0] ?? {};
        const dm = ri.dett_medico ?? {};
        kv("CF medico", m.pf_cfis);
        kv("Cod. regionale", dm.dm_creg);
        kv("Cod. ENPAM", dm.dm_codenpam);
        kv("Email", ri.ri_email);
        kv("Telefono", ri.ri_telefono1);
        kv("Categoria", dm.dm_categ);
        kv("Ambito", `${dm.ambito?.sr_codice ?? "?"} ${dm.ambito?.sr_desc ?? ""}`);
    } else {
        warn("Impossibile recuperare dettagli medico");
    }
    sub("getNumAssistitiMedico() — carico assistiti corrente…");
    const numAss = await nar.getNumAssistitiMedico(pfIdMedico);
    if (numAss.ok) kv("Numero assistiti", JSON.stringify(numAss.data));

    // STEP 7 — costruzione payload (DRY-RUN)
    banner("STEP 6 / Costruzione payload (DRY-RUN)");
    sub("aggiornaCambioMedico({ dryRun: true })…");
    const dry = await nar.aggiornaCambioMedico(cf, pfIdMedico, {
        dryRun: true,
        tipoMedico,
        idSituazioneAssistenziale: situazione.sa_id,
        idAmbitoScelta: ambito.sr_id
    });
    if (!dry.ok) { err(`Dry-run fallito: ${dry.error}`); process.exit(1); }
    ok("Payload generato");
    printJson(dry.payload, "PAYLOAD che verrebbe inviato a POST /pazienti/sceltaMedico");

    // STEP 8 — conferma submit
    banner("STEP 7 / Submit reale (opzionale)");
    warn("ATTENZIONE: confermando, la chiamata invia DAVVERO il cambio medico al NAR2.");
    const conferma = (await ask(`Inviare al server? Digita ${C.red}INVIA${C.reset} per confermare, qualsiasi altra cosa per uscire: `)).trim();
    if (conferma !== "INVIA") {
        ok("Operazione interrotta in dry-run. Nulla inviato al server.");
        rl.close();
        return;
    }
    sub("Invio in corso (POST /pazienti/sceltaMedico)…");
    const real = await nar.aggiornaCambioMedico(cf, pfIdMedico, {
        dryRun: false,
        tipoMedico,
        idSituazioneAssistenziale: situazione.sa_id,
        idAmbitoScelta: ambito.sr_id
    });
    if (real.ok) {
        ok("Cambio medico INVIATO con successo");
        printJson(real.response, "Risposta server");
    } else {
        err(`Errore submit: ${real.error}`);
        printJson(real.response, "Risposta server (raw)");
    }
    rl.close();
})().catch((e) => {
    console.error(`${C.red}Errore fatale:${C.reset}`, e);
    process.exit(1);
});
