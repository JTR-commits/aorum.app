/* Shared, progressively enhanced mobile navigation and screenshot viewer. */
(function () {
  'use strict';
  var root = document.documentElement;
  var menu = document.querySelector('.menu-toggle');
  var navigation = document.getElementById('site-navigation');
  var narrow = window.matchMedia('(max-width: 1040px)');

  function closeMenu(returnFocus) {
    if (!menu) return;
    menu.setAttribute('aria-expanded', 'false');
    if (returnFocus) menu.focus();
  }
  if (menu && navigation) {
    menu.addEventListener('click', function () {
      menu.setAttribute('aria-expanded', String(menu.getAttribute('aria-expanded') !== 'true'));
    });
    navigation.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') closeMenu(true);
    });
    document.addEventListener('click', function (event) {
      if (!event.target.closest('.site-header')) closeMenu(false);
    });
    document.addEventListener('focusin', function (event) {
      if (!event.target.closest('.site-header')) closeMenu(false);
    });
    narrow.addEventListener('change', function () { closeMenu(false); });
    root.setAttribute('data-site-ready', 'true');
  }

  // With no dialog support the links still open the full-size image normally.
  if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
  var links = document.querySelectorAll('[data-zoom-image]');
  if (!links.length) return;
  var dialog = document.createElement('dialog');
  dialog.className = 'image-viewer';
  dialog.setAttribute('aria-labelledby', 'image-viewer-title');
  dialog.innerHTML = '<div class="image-viewer__toolbar"><h2 id="image-viewer-title"></h2><div class="image-viewer__navigation"><button type="button" class="image-viewer__previous"></button><span class="image-viewer__position" aria-live="polite" aria-atomic="true"></span><button type="button" class="image-viewer__next"></button></div><button type="button" class="image-viewer__zoom" aria-pressed="false"></button><form method="dialog"><button type="submit" class="image-viewer__close" autofocus></button></form></div><div class="image-viewer__canvas" tabindex="0"><img alt=""></div>';
  document.body.appendChild(dialog);
  var title = dialog.querySelector('h2');
  var image = dialog.querySelector('img');
  var zoom = dialog.querySelector('.image-viewer__zoom');
  var close = dialog.querySelector('.image-viewer__close');
  var canvas = dialog.querySelector('.image-viewer__canvas');
  var trigger = null;
  var opener = null;
  var currentIndex = 0;
  var previous = dialog.querySelector('.image-viewer__previous');
  var next = dialog.querySelector('.image-viewer__next');
  var position = dialog.querySelector('.image-viewer__position');
  previous.disabled = next.disabled = links.length < 2;
  function setButtonLabel(button, iconId, label) {
    var icon = document.getElementById(iconId).content.firstElementChild.cloneNode(true);
    var text = document.createElement("span");
    text.textContent = label;
    button.replaceChildren(icon, text);
  }
  function updateLabels() {
    var english = root.lang === 'en';
    var expanded = dialog.classList.contains('is-zoomed');
    title.textContent = trigger ? trigger.getAttribute(english ? 'data-caption-en' : 'data-caption-pl') : '';
    image.alt = title.textContent;
    setButtonLabel(previous, 'icon-viewer-next', english ? 'Previous image' : 'Poprzednie zdjęcie');
    setButtonLabel(next, 'icon-viewer-next', english ? 'Next image' : 'Następne zdjęcie');
    previous.setAttribute('aria-label', english ? 'Previous image' : 'Poprzednie zdjęcie');
    next.setAttribute('aria-label', english ? 'Next image' : 'Następne zdjęcie');
    position.textContent = (currentIndex + 1) + ' / ' + links.length;
    setButtonLabel(zoom, expanded ? 'icon-viewer-fit' : 'icon-viewer-zoom', expanded ? (english ? 'Fit to screen' : 'Dopasuj do ekranu') : (english ? 'Enlarge' : 'Powiększ'));
    setButtonLabel(close, 'icon-viewer-close', english ? 'Close' : 'Zamknij');
    canvas.setAttribute('aria-label', english ? 'Screenshot. Scroll to see the enlarged image.' : 'Zrzut ekranu. Przewijaj, aby obejrzeć powiększony obraz.');
  }
  function showImage(index) {
    currentIndex = (index + links.length) % links.length;
    trigger = links[currentIndex];
    image.src = trigger.href;
    dialog.classList.remove('is-zoomed');
    zoom.setAttribute('aria-pressed', 'false');
    updateLabels();
    canvas.scrollTop = 0;
    canvas.scrollLeft = 0;
  }
  links.forEach(function (link, index) {
    link.addEventListener('click', function (event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      showImage(index);
      dialog.showModal();
      document.body.classList.add('has-image-preview');
    });
  });
  previous.addEventListener('click', function () { showImage(currentIndex - 1); });
  next.addEventListener('click', function () { showImage(currentIndex + 1); });
  dialog.addEventListener('keydown', function (event) {
    if (!dialog.open || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showImage(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  zoom.addEventListener('click', function () {
    var expanded = dialog.classList.toggle('is-zoomed');
    zoom.setAttribute('aria-pressed', String(expanded));
    updateLabels();
    canvas.scrollTop = 0;
    canvas.scrollLeft = 0;
  });
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', function () {
    document.body.classList.remove('has-image-preview');
    if (opener) opener.focus();
  });
})();

/* Home page, wide screens: while the hero logo is on screen the right-hand column hides its own
   logo and moves up so the Mail icon lines up with the top of the Duo screenshot; once the hero
   logo scrolls away the column returns to logo + icons. Without JavaScript the hero layout stays. */
(function () {
  'use strict';
  var brand = document.querySelector('.intro__brand');
  if (!brand) return;
  var root = document.documentElement;
  var pending = false;
  function update() {
    pending = false;
    root.classList.toggle('past-hero', brand.getBoundingClientRect().bottom <= 0);
  }
  function schedule() {
    if (!pending) { pending = true; window.requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('load', schedule);
  update();
  // Animate only real scrolling, not the first placement after load.
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () { root.classList.add('nav-anim'); });
  });
}());

/* 2026-10-04: "Notify me at launch" form (Site-tools/build.py, launch_form). Without JavaScript
   the form still posts and the service answers with a plain bilingual page. */
(function () {
  'use strict';
  var forms = document.querySelectorAll('[data-launch-form]');
  if (!forms.length || !window.fetch) return;
  var emailPattern = /^[^\s@<>()[\]\\,;:"]{1,64}@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  Array.prototype.forEach.call(forms, function (form) {
    var email = form.querySelector('input[name="email"]');
    var consent = form.querySelector('input[name="consent"]');
    var trap = form.querySelector('input[name="website"]');
    var status = form.querySelector('.launch-form__status');
    var button = form.querySelector('button[type="submit"]');
    var page = form.querySelector('input[name="page"]');
    if (page && /^\/mail\/?/.test(window.location.pathname)) page.value = '/mail/';
    function show(state, key) {
      status.setAttribute('data-state', state);
      status.textContent = form.getAttribute('data-msg-' + key) || '';
    }
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var value = email.value.trim();
      email.removeAttribute('aria-invalid');
      if (!emailPattern.test(value) || value.length > 254) {
        email.setAttribute('aria-invalid', 'true');
        show('error', 'invalid');
        email.focus();
        return;
      }
      if (!consent.checked) {
        show('error', 'need-consent');
        consent.focus();
        return;
      }
      button.disabled = true;
      show('busy', 'busy');
      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: value,
          consent: true,
          lang: form.querySelector('input[name="lang"]').value,
          page: page ? page.value : '/',
          website: trap ? trap.value : ''
        }),
        credentials: 'omit',
        mode: 'cors'
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (response.ok && body.ok) {
            form.setAttribute('data-done', '');
            show('ok', 'ok');
            return;
          }
          if (body.error === 'invalid_email') { email.setAttribute('aria-invalid', 'true'); show('error', 'invalid'); }
          else if (body.error === 'consent_required') show('error', 'need-consent');
          else if (response.status === 429) show('error', 'limit');
          else show('error', 'error');
        });
      }).catch(function () {
        show('error', 'error');
      }).then(function () {
        button.disabled = false;
      });
    });
  });
}());
