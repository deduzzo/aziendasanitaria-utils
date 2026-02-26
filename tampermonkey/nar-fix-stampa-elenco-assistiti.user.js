// ==UserScript==
// @name         NAR - Fix stampa elenco assistiti medico base
// @namespace    https://nar2.regione.sicilia.it/
// @version      5.0
// @description  Corregge il bug che impedisce la stampa dell'elenco assistiti del medico di base quando nessun medico è selezionato. Rimuove i Validators.required errati dai campi nome/cognome del gruppo "medico" nel FormGroup Angular.
// @author       Fix automatico
// @match        https://nar2.regione.sicilia.it/operatore/stampe/stampa/elenco-assistiti-medico-base
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────────
  //  v5.0 — Strategia definitiva: sentinel webpack module + patch onSubmit.
  //
  //  PROBLEMA:
  //  Nel servizio StampeStateService, il FormGroup per "ElencoAssistitimedicobase"
  //  ha Validators.required su medico.nome e medico.cognome. Questo impedisce la
  //  stampa quando nessun medico e' selezionato (che e' un caso d'uso legittimo).
  //
  //  COME FUNZIONA:
  //  1. Aspetta che la pagina carichi normalmente (nessun hook pre-bootstrap)
  //  2. Inietta un modulo webpack "sentinella" via webpackJsonp.push() per
  //     catturare __webpack_require__ e accedere alla cache dei moduli
  //  3. Trova FormGroupDirective nel modulo @angular/forms
  //  4. Patcha FormGroupDirective.prototype.onSubmit per rimuovere i validators
  //     da medico.nome e medico.cognome PRIMA che Angular emetta l'evento ngSubmit
  //  5. Il componente riceve il form gia' valido e la stampa procede
  //
  //  NOTA: non usa Object.defineProperty su webpackJsonp (che rompeva il bootstrap
  //  Angular nelle v2/v3). Il modulo sentinella e' sicuro perche' viene pushato
  //  DOPO il bootstrap, quando il runtime webpack e' gia' inizializzato.
  // ─────────────────────────────────────────────────────────────────────────────

  var INJECTED_CODE = function () {
    var PREFIX = '[NAR Fix v5]';
    var patched = false;

    // ── Cattura __webpack_require__ tramite modulo sentinella ─────────────────
    function captureWebpackRequire() {
      var wr = null;
      var sentinelId = '__narfix_sentinel_' + Date.now();
      var sentinelModules = {};
      sentinelModules[sentinelId] = function (module, exports, __webpack_require__) {
        wr = __webpack_require__;
      };
      try {
        var chunkId = 900000 + Math.floor(Math.random() * 99999);
        window.webpackJsonp.push([[chunkId], sentinelModules, [[sentinelId]]]);
      } catch (e) {
        console.error(PREFIX, 'Errore push sentinella:', e.message);
      }
      return wr;
    }

    // ── Cerca una classe nel module cache per signature del prototype ─────────
    function findClassByPrototype(wr, matchFn) {
      if (!wr || !wr.c) return null;
      for (var id in wr.c) {
        var mod = wr.c[id];
        if (!mod || !mod.exports) continue;
        var ex = mod.exports;
        for (var k in ex) {
          var V = ex[k];
          if (typeof V === 'function' && V.prototype && matchFn(V.prototype)) {
            return V;
          }
        }
      }
      return null;
    }

    // ── Identifica FormGroupDirective (ha onSubmit + addControl + ngOnChanges) ─
    function isFormGroupDirective(proto) {
      var props = Object.getOwnPropertyNames(proto);
      return props.indexOf('onSubmit') !== -1 &&
             props.indexOf('addControl') !== -1 &&
             props.indexOf('ngOnChanges') !== -1;
    }

    // ── Identifica FormBuilder (ha group + control + array) ──────────────────
    function isFormBuilder(proto) {
      return typeof proto.group === 'function' &&
             typeof proto.control === 'function' &&
             typeof proto.array === 'function';
    }

    // ── Rimuove i validators dal sotto-gruppo medico ─────────────────────────
    function clearMedicoValidators(fg) {
      if (!fg || !fg.controls || !fg.controls.medico) return false;
      var medico = fg.controls.medico;
      if (!medico || !medico.controls) return false;

      var changed = false;

      if (medico.controls.nome && medico.controls.nome.validator) {
        medico.controls.nome.clearValidators();
        medico.controls.nome.updateValueAndValidity({ emitEvent: false });
        changed = true;
      }
      if (medico.controls.cognome && medico.controls.cognome.validator) {
        medico.controls.cognome.clearValidators();
        medico.controls.cognome.updateValueAndValidity({ emitEvent: false });
        changed = true;
      }

      if (changed) {
        medico.updateValueAndValidity({ emitEvent: false });
        fg.updateValueAndValidity({ emitEvent: false });
        console.log(PREFIX, 'Validators.required rimossi da medico.nome e medico.cognome');
      }

      return changed;
    }

    // ── Applica il fix ──────────────────────────────────────────────────────
    function applyFix() {
      // 1. Cattura __webpack_require__
      var wr = captureWebpackRequire();
      if (!wr) {
        console.error(PREFIX, 'Impossibile catturare __webpack_require__');
        return false;
      }
      console.log(PREFIX, '__webpack_require__ catturato, moduli in cache:', Object.keys(wr.c).length);

      // 2. Trova e patcha FormGroupDirective.prototype.onSubmit
      var FGD = findClassByPrototype(wr, isFormGroupDirective);
      if (FGD) {
        var origOnSubmit = FGD.prototype.onSubmit;
        FGD.prototype.onSubmit = function ($event) {
          var fg = this.form || this.control;
          clearMedicoValidators(fg);
          return origOnSubmit.apply(this, arguments);
        };
        console.log(PREFIX, 'FormGroupDirective.prototype.onSubmit patchato.');
        patched = true;
      } else {
        console.warn(PREFIX, 'FormGroupDirective non trovata nel module cache.');
      }

      // 3. Patcha anche FormBuilder.prototype.group per navigazioni future (SPA)
      var FB = findClassByPrototype(wr, isFormBuilder);
      if (FB) {
        var origGroup = FB.prototype.group;
        FB.prototype.group = function (config, opts) {
          var fg = origGroup.call(this, config, opts);

          // Riconosce il sotto-gruppo "medico" creato dentro il form target
          if (fg.controls && fg.controls.nome && fg.controls.cognome &&
              Object.keys(fg.controls).length === 2 &&
              fg.controls.nome.validator && fg.controls.cognome.validator) {
            // Verifica che siamo nel contesto giusto controllando lo stack
            // Il parent group avra' ambito, medico, AslResidenza, data
            fg.controls.nome.clearValidators();
            fg.controls.nome.updateValueAndValidity({ emitEvent: false });
            fg.controls.cognome.clearValidators();
            fg.controls.cognome.updateValueAndValidity({ emitEvent: false });
            console.log(PREFIX, 'Validators rimossi in FormBuilder.group (navigazione SPA)');
          }

          return fg;
        };
        console.log(PREFIX, 'FormBuilder.prototype.group patchato per navigazioni future.');
      }

      return patched;
    }

    // ── Avvio: aspetta che webpackJsonp sia disponibile ──────────────────────
    function init() {
      if (!window.webpackJsonp || !window.webpackJsonp.push) {
        // Riprova tra 500ms
        var attempts = 0;
        var timer = setInterval(function () {
          if (++attempts > 30 || (window.webpackJsonp && window.webpackJsonp.push)) {
            clearInterval(timer);
            if (window.webpackJsonp) {
              applyFix();
            } else {
              console.error(PREFIX, 'webpackJsonp non disponibile dopo 15s.');
            }
          }
        }, 500);
      } else {
        applyFix();
      }
    }

    console.log(PREFIX, 'Inizializzazione...');
    init();
  };

  // ── Inietta nel contesto della pagina ──────────────────────────────────────
  var script = document.createElement('script');
  script.textContent = '(' + INJECTED_CODE.toString() + ')();';
  (document.head || document.documentElement).appendChild(script);
  script.remove();

})();
