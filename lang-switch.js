/* Aorum — przełącznik wersji językowej PL/EN, wspólny dla wszystkich stron.
   Bez zależności zewnętrznych. Domyślny język: polski.
   Kolejność wyboru: parametr ?lang=pl|en w adresie → zapamiętany wybór
   (localStorage „aorum-lang”, best effort) → polski.
   Skrypt ładowany w <head>: klasa „lang-en” trafia na <html> przed
   narysowaniem strony (bez mignięcia polskiej wersji). Po wczytaniu DOM
   ustawia aria-pressed przycisków #lang-pl-btn / #lang-en-btn oraz podmienia
   tytuł i opisy z atrybutem data-en (oryginał PL zapamiętuje w data-pl). */
(function () {
  "use strict";

  var KEY = "aorum-lang";

  function readStoredLang() {
    try {
      return window.localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function storeLang(lang) {
    try {
      window.localStorage.setItem(KEY, lang);
    } catch (e) {
      /* ignorowane — brak trwałości nie blokuje przełącznika */
    }
  }

  function langFromQuery() {
    try {
      var match = /[?&]lang=(pl|en)(?:&|$)/i.exec(window.location.search || "");
      return match ? match[1].toLowerCase() : null;
    } catch (e) {
      return null;
    }
  }

  function initialLang() {
    var fromQuery = langFromQuery();
    if (fromQuery) {
      storeLang(fromQuery);
      return fromQuery;
    }
    var stored = readStoredLang();
    if (stored === "pl" || stored === "en") return stored;
    /* Domyślnie polski niezależnie od języka przeglądarki — decyzja
       właściciela; EN jest wersją pomocniczą. */
    return "pl";
  }

  function setRootLang(lang) {
    var isEn = lang === "en";
    var root = document.documentElement;
    if (root.classList) root.classList.toggle("lang-en", isEn);
    root.setAttribute("lang", isEn ? "en" : "pl");
  }

  function applyTexts(lang) {
    var nodes = document.querySelectorAll("[data-en]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var isTitle = el.tagName === "TITLE";
      var current = isTitle ? el.textContent : el.getAttribute("content");
      if (!el.hasAttribute("data-pl")) el.setAttribute("data-pl", current || "");
      var next = lang === "en" ? el.getAttribute("data-en") : el.getAttribute("data-pl");
      if (isTitle) {
        document.title = next;
      } else {
        el.setAttribute("content", next);
      }
    }
  }

  function applyButtons(lang) {
    var isEn = lang === "en";
    var plBtn = document.getElementById("lang-pl-btn");
    var enBtn = document.getElementById("lang-en-btn");
    if (plBtn) plBtn.setAttribute("aria-pressed", String(!isEn));
    if (enBtn) enBtn.setAttribute("aria-pressed", String(isEn));
  }

  function applyLang(lang) {
    setRootLang(lang);
    applyTexts(lang);
    applyButtons(lang);
  }

  var startLang = initialLang();
  setRootLang(startLang);

  function init() {
    applyLang(startLang);

    var plBtn = document.getElementById("lang-pl-btn");
    var enBtn = document.getElementById("lang-en-btn");
    if (plBtn) {
      plBtn.addEventListener("click", function () {
        applyLang("pl");
        storeLang("pl");
      });
    }
    if (enBtn) {
      enBtn.addEventListener("click", function () {
        applyLang("en");
        storeLang("en");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
