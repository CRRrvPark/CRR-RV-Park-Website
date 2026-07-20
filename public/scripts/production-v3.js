(() => {
  'use strict';

  const header = document.querySelector('[data-site-header]');
  const menuButton = document.querySelector('[data-site-menu]');
  const navigation = document.querySelector('[data-site-navigation]');
  const groups = Array.from(document.querySelectorAll('[data-nav-group]'));

  const closeGroups = (except) => {
    groups.forEach((group) => {
      if (group === except) return;
      group.classList.remove('is-open');
      group.querySelector('[data-nav-trigger]')?.setAttribute('aria-expanded', 'false');
    });
  };

  const closeMenu = () => {
    if (!header || !menuButton || !navigation) return;
    header.classList.remove('is-open');
    navigation.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    closeGroups();
  };

  if (header && menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      header.classList.toggle('is-open', open);
      navigation.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
  }

  groups.forEach((group) => {
    const trigger = group.querySelector('[data-nav-trigger]');
    if (!trigger) return;
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      closeGroups(group);
      group.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
    });
  });

  document.addEventListener('click', (event) => {
    if (header && !header.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeMenu();
    menuButton?.focus();
  });

  const mobileBook = document.querySelector('.crr-mobile-book');
  if (mobileBook) {
    const update = () => {
      const visible = window.scrollY > 520;
      mobileBook.classList.toggle('is-visible', visible);
      mobileBook.setAttribute('aria-hidden', String(!visible));
      mobileBook.tabIndex = visible ? 0 : -1;
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  const localIso = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const addDays = (value, days) => {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return localIso(date);
  };
  const params = new URLSearchParams(window.location.search);
  const today = localIso(new Date());
  const siteTypes = new Set(['any', 'full-hookup', 'water_electric', 'tent_or_dry', 'dry', 'tent']);

  document.querySelectorAll('[data-site-search]').forEach((form) => {
    const arrival = form.querySelector('[data-site-arrival]');
    const departure = form.querySelector('[data-site-departure]');
    if (!arrival || !departure) return;

    arrival.min = today;
    arrival.value = params.get('from') || today;
    departure.min = addDays(arrival.value, 1);
    departure.value = params.get('to') || addDays(arrival.value, 2);

    ['type', 'rigLengthFt', 'slides'].forEach((name) => {
      const field = form.elements.namedItem(name);
      const value = params.get(name);
      if (field && value && (name !== 'type' || siteTypes.has(value))) field.value = value;
    });

    arrival.addEventListener('change', () => {
      if (!arrival.value) return;
      departure.min = addDays(arrival.value, 1);
      if (!departure.value || departure.value <= arrival.value) departure.value = addDays(arrival.value, 2);
    });
  });

  const liveForm = document.querySelector('#avForm');
  if (liveForm) {
    const liveArrival = liveForm.elements.namedItem('from');
    const liveDeparture = liveForm.elements.namedItem('to');
    if (liveArrival && liveDeparture) {
      liveArrival.min = today;
      liveArrival.value = params.get('from') || today;
      liveDeparture.min = addDays(liveArrival.value, 1);
      liveDeparture.value = params.get('to') || addDays(liveArrival.value, 1);
    }
    let prepared = false;
    ['from', 'to', 'type', 'rigLengthFt', 'slides'].forEach((name) => {
      const field = liveForm.elements.namedItem(name);
      const value = params.get(name);
      if (!field || !value || (name === 'type' && !siteTypes.has(value))) return;
      field.value = value;
      prepared = true;
    });
    const hasCompleteDates = Boolean(params.get('from') && params.get('to'));
    const requestedType = params.get('type');
    const hasSiteTypeDecision = Boolean(requestedType && siteTypes.has(requestedType) && requestedType !== 'any');
    if (prepared && (hasCompleteDates || hasSiteTypeDecision)) liveForm.requestSubmit();
  }

  const filterGroup = document.querySelector('[data-experience-filters]');
  const filterGrid = document.querySelector('[data-experience-grid]');
  if (filterGroup && filterGrid) {
    const buttons = Array.from(filterGroup.querySelectorAll('[data-experience-filter]'));
    const cards = Array.from(filterGrid.querySelectorAll('[data-categories]'));
    const status = document.querySelector('[data-filter-status]');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const filter = button.dataset.experienceFilter || 'all';
        buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        let count = 0;
        cards.forEach((card) => {
          const show = filter === 'all' || (card.dataset.categories || '').split(',').includes(filter);
          card.hidden = !show;
          if (show) count += 1;
        });
        if (status) status.textContent = filter === 'all' ? 'Showing all featured ideas.' : `Showing ${count} matching ideas.`;
      });
    });
  }

  const renderPhotoAttribution = (element, attributions, placeId) => {
    if (!element) return;
    element.replaceChildren();
    const valid = Array.isArray(attributions)
      ? attributions.filter((item) => item && typeof item.displayName === 'string' && item.displayName.trim())
      : [];
    const insideLink = Boolean(element.closest('a'));

    element.append(document.createTextNode(valid.length ? 'Photo: ' : 'Photo via Google Maps'));
    valid.forEach((item, index) => {
      if (index) element.append(document.createTextNode(', '));
      const name = item.displayName.trim();
      if (!insideLink && item.uri) {
        const link = document.createElement('a');
        link.href = item.uri;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = name;
        element.append(link);
      } else {
        element.append(document.createTextNode(name));
      }
    });
    if (valid.length) element.append(document.createTextNode(' · Google Maps'));

    if (!insideLink && placeId) {
      const mapsLink = document.createElement('a');
      mapsLink.href = `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`;
      mapsLink.target = '_blank';
      mapsLink.rel = 'noopener noreferrer';
      mapsLink.className = 'crr-google-maps-source';
      mapsLink.textContent = 'View source';
      element.append(document.createTextNode(' · '), mapsLink);
    }
    element.hidden = false;
  };

  const loadGooglePlacePhoto = async (frame) => {
    if (frame.dataset.photoState) return;
    const placeId = frame.dataset.googlePlacePhoto || '';
    const image = frame.querySelector('[data-google-photo-image]');
    if (!placeId || !image) return;

    frame.dataset.photoState = 'loading';
    const width = frame.dataset.photoWidth || '1200';
    try {
      const response = await fetch(`/api/place-photo?place=${encodeURIComponent(placeId)}&w=${encodeURIComponent(width)}&format=json`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`photo ${response.status}`);
      const payload = await response.json();
      if (!payload.photoUri || typeof payload.photoUri !== 'string') throw new Error('photo missing');

      image.addEventListener('load', () => {
        frame.dataset.photoState = 'loaded';
        frame.classList.add('is-photo-loaded');
        renderPhotoAttribution(
          frame.querySelector('[data-google-photo-attribution]'),
          payload.authorAttributions,
          placeId,
        );
      }, { once: true });
      image.addEventListener('error', () => {
        frame.dataset.photoState = 'failed';
      }, { once: true });
      image.src = payload.photoUri;
    } catch {
      frame.dataset.photoState = 'failed';
    }
  };

  const googlePhotoFrames = Array.from(document.querySelectorAll('[data-google-place-photo]'));
  if ('IntersectionObserver' in window) {
    const photoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        loadGooglePlacePhoto(entry.target);
        photoObserver.unobserve(entry.target);
      });
    }, { rootMargin: '500px 0px' });
    googlePhotoFrames.forEach((frame) => photoObserver.observe(frame));
  } else {
    googlePhotoFrames.forEach(loadGooglePlacePhoto);
  }

  document.querySelectorAll('[data-card-image]').forEach((image) => {
    const frame = image.closest('.crr-list-card-visual');
    const reveal = () => frame?.classList.add('is-photo-loaded');
    if (image.complete && image.naturalWidth > 0) reveal();
    else {
      image.addEventListener('load', reveal, { once: true });
      image.addEventListener('error', () => {
        image.hidden = true;
        frame?.setAttribute('data-photo-state', 'failed');
      }, { once: true });
    }
  });

  const reveals = document.querySelectorAll('.v2-reveal, .reveal');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach((element) => element.classList.add('is-visible', 'visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible', 'visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -36px 0px' });
    reveals.forEach((element) => observer.observe(element));
  }
})();
