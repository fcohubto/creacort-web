(function () {
  'use strict';

  var nav    = document.getElementById('nav');
  var toggle = document.getElementById('nav-toggle');
  var menu   = document.getElementById('nav-menu');
  var form   = document.getElementById('form-cotizacion');
  var success = document.getElementById('form-success');

  // NAV: scroll detection
  if (nav) {
    var sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;pointer-events:none;';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('is-scrolled', !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  // NAV: scrollspy — marca el link de la sección en pantalla
  var navLinks = document.querySelectorAll('.nav__link[href^="#"]');
  if (navLinks.length) {
    var spySections = Array.prototype.map.call(navLinks, function (link) {
      return document.querySelector(link.getAttribute('href'));
    }).filter(Boolean);
    var visibleIds = [];
    var navOffset = (nav ? nav.offsetHeight : 64) + 8;
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var i = visibleIds.indexOf(entry.target.id);
        if (entry.isIntersecting && i === -1) visibleIds.push(entry.target.id);
        else if (!entry.isIntersecting && i !== -1) visibleIds.splice(i, 1);
      });
      var current = null;
      for (var s = 0; s < spySections.length; s++) {
        if (visibleIds.indexOf(spySections[s].id) !== -1) { current = spySections[s].id; break; }
      }
      navLinks.forEach(function (link) {
        link.classList.toggle('is-active', !!current && link.getAttribute('href') === '#' + current);
      });
    }, { rootMargin: '-' + navOffset + 'px 0px -55% 0px' });
    spySections.forEach(function (section) { spy.observe(section); });
  }

  // NAV: mobile toggle
  if (toggle && menu) {
    function closeMenu() {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('is-open');
    }
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.classList.toggle('is-open', !open);
    });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('click', function (e) {
      if (nav && !nav.contains(e.target)) closeMenu();
    });
    // Escape cierra el menú y devuelve el foco al botón que lo abrió
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        toggle.focus();
      }
    });
  }

  // SMOOTH SCROLL con offset del nav
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var id = anchor.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      var offset = nav ? nav.offsetHeight + 16 : 0;
      var top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });

  // FORM: validación inline con mensajes propios (sin globos nativos)
  if (form && success) {
    var fields = form.querySelectorAll('.form__input, .form__select, .form__textarea');

    // Devuelve el mensaje de error del campo, o '' si está bien.
    function messageFor(el) {
      var v = el.value.trim();
      if (el.hasAttribute('required') && !v) {
        switch (el.id) {
          case 'f-nombre':   return 'Escribe tu nombre para saber con quién hablamos.';
          case 'f-email':    return 'Necesitamos tu correo para poder responderte.';
          case 'f-servicio': return 'Elige qué necesitas para dirigir tu solicitud.';
          case 'f-mensaje':  return 'Cuéntanos qué necesitas: tipo de herramienta, medidas, material.';
          default:           return 'Este campo es obligatorio.';
        }
      }
      if (el.type === 'email' && v && el.validity.typeMismatch) {
        return 'Ese correo no se ve válido — revisa que tenga @ y un dominio (ej: nombre@empresa.cl).';
      }
      if (el.id === 'f-telefono' && v && v.replace(/\D/g, '').length < 8) {
        return 'El teléfono se ve incompleto — incluye el código y los 8 dígitos.';
      }
      return '';
    }

    function errorNodeFor(field, el) {
      var node = field.querySelector('.form__error');
      if (!node) {
        node = document.createElement('p');
        node.className = 'form__error';
        node.id = (el.id || 'campo') + '-error';
        field.appendChild(node);
      }
      return node;
    }

    // show: si es true, pinta el error; si es false, solo limpia si ya estaba OK.
    function validateField(el, show) {
      var field = el.closest('.form__field');
      var msg = messageFor(el);
      if (msg && show) {
        var node = errorNodeFor(field, el);
        node.textContent = msg;
        field.classList.add('form__field--error');
        el.setAttribute('aria-invalid', 'true');
        el.setAttribute('aria-describedby', node.id);
      } else {
        field.classList.remove('form__field--error');
        el.removeAttribute('aria-invalid');
        el.removeAttribute('aria-describedby');
        var existing = field.querySelector('.form__error');
        if (existing) existing.textContent = '';
      }
      return !msg;
    }

    fields.forEach(function (el) {
      el.addEventListener('blur', function () { validateField(el, true); });
      // una vez que el campo está en error, revalida en vivo para que se limpie al corregir
      var liveEvent = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(liveEvent, function () {
        if (el.closest('.form__field').classList.contains('form__field--error') || el.tagName === 'SELECT') {
          validateField(el, true);
        }
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstInvalid = null;
      fields.forEach(function (el) {
        if (!validateField(el, true) && !firstInvalid) firstInvalid = el;
      });
      if (firstInvalid) { firstInvalid.focus(); return; }
      // TODO Fase 03: integrar con Formspree o API backend
      form.hidden = true;
      success.hidden = false;
    });
  }

  // COTIZACIÓN: preselección desde Servicios y Catálogo.
  // El botón (o su card) lleva data-servicio = value del <select>. Desde una card del
  // catálogo además se precarga el nombre de la pieza en el mensaje, si está vacío.
  var selectServicio = document.getElementById('f-servicio');
  var mensaje        = document.getElementById('f-mensaje');
  function flash(el) {
    var field = el.closest('.form__field');
    field.classList.add('form__field--auto');
    setTimeout(function () { field.classList.remove('form__field--auto'); }, 2200);
  }
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href="#cotizacion"]');
    if (!link || !selectServicio || (form && form.hidden)) return;
    var source = link.hasAttribute('data-servicio') ? link : link.closest('[data-servicio]');
    if (!source) return;

    selectServicio.value = source.getAttribute('data-servicio');
    selectServicio.dispatchEvent(new Event('change'));   // limpia un error previo
    flash(selectServicio);

    var card = link.closest('.producto-card');
    var name = card && card.querySelector('.producto-card__name');
    if (name && mensaje && (!mensaje.value.trim() || mensaje.dataset.auto === 'true')) {
      mensaje.value = 'Me interesa: ' + name.textContent.trim() + '. ';
      mensaje.dataset.auto = 'true';
      mensaje.dispatchEvent(new Event('input'));
      flash(mensaje);
    }
  });
  if (mensaje) {
    mensaje.addEventListener('input', function (e) {
      if (e.isTrusted) mensaje.dataset.auto = 'false';   // lo escribió la persona: no se pisa
    });
  }

  // CATÁLOGO: filtro por familia + búsqueda (sin tildes, todas las palabras deben calzar).
  // La card "¿No encuentras lo que buscas?" queda siempre visible al final.
  var tools = document.querySelector('[data-catalogo-tools]');
  if (tools) {
    var grid     = document.querySelector('.catalogo__grid');
    var cards    = Array.prototype.slice.call(grid.querySelectorAll('.producto-card[data-cat]'));
    var chips    = Array.prototype.slice.call(tools.querySelectorAll('[data-filtro]'));
    var search   = document.getElementById('catalogo-buscar');
    var estado   = document.getElementById('catalogo-estado');
    var filtro   = 'todo';
    var norm = function (t) {
      return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    };
    var texts = cards.map(function (c) { return norm(c.textContent.replace(/\s+/g, ' ')); });

    function aplicar() {
      // raíz simple: "esferica" encuentra "esférico", "brocas" encuentra "broca"
      var words = norm(search.value.trim()).split(/\s+/).filter(Boolean).map(function (w) {
        return w.length > 4 ? w.replace(/(as|os|es|a|o|s)$/, '') : w;
      });
      var visibles = 0;
      cards.forEach(function (card, i) {
        var ok = (filtro === 'todo' || card.getAttribute('data-cat') === filtro) &&
                 words.every(function (w) { return texts[i].indexOf(w) !== -1; });
        card.hidden = !ok;
        if (ok) visibles++;
      });
      var activo = filtro !== 'todo' || words.length;
      estado.hidden = !activo;
      if (!activo) estado.textContent = '';
      else if (visibles) estado.textContent = 'Mostrando ' + visibles + ' de ' + cards.length + ' piezas.';
      else estado.textContent = 'Sin coincidencias. Fabricamos a medida: cuéntanos qué necesitas.';
      grid.scrollLeft = 0;   // en mobile el catálogo es un carrusel horizontal
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        filtro = chip.getAttribute('data-filtro');
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        aplicar();
      });
    });
    search.addEventListener('input', aplicar);
    tools.hidden = false;
  }

  // CLIENTES: cinta de logos. Duplica la lista (copia oculta a lectores de pantalla)
  // para que translateX(-50%) cierre el loop sin salto. Con movimiento reducido no se anima.
  var marquee = document.querySelector('[data-marquee]');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (marquee && !reduceMotion) {
    var track = marquee.querySelector('.clientes__track');
    Array.prototype.slice.call(track.children).forEach(function (li) {
      var copy = li.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('img').forEach(function (img) { img.alt = ''; });
      track.appendChild(copy);
    });
    marquee.classList.add('is-marquee');
  }

  // CARRUSEL de testimonios: clásico, prev/next + dots. Sin autoplay.
  var carousel = document.querySelector('[data-carousel]');
  if (carousel) {
    var slides = Array.prototype.slice.call(carousel.querySelectorAll('.testimonio'));
    var dots   = Array.prototype.slice.call(carousel.querySelectorAll('.testimonios__dot'));
    var prev   = carousel.querySelector('[data-carousel-prev]');
    var next   = carousel.querySelector('[data-carousel-next]');
    var index  = 0;

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (slide, n) {
        var on = n === index;
        slide.classList.toggle('is-active', on);
        slide.setAttribute('aria-hidden', String(!on));
      });
      dots.forEach(function (dot, n) {
        var on = n === index;
        dot.classList.toggle('is-active', on);
        if (on) dot.setAttribute('aria-current', 'true');
        else    dot.removeAttribute('aria-current');
      });
    }

    if (prev) prev.addEventListener('click', function () { show(index - 1); });
    if (next) next.addEventListener('click', function () { show(index + 1); });
    dots.forEach(function (dot, n) {
      dot.addEventListener('click', function () { show(n); });
    });

    show(0);
  }

})();
