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
      if (field && value) field.value = value;
    });

    arrival.addEventListener('change', () => {
      if (!arrival.value) return;
      departure.min = addDays(arrival.value, 1);
      if (!departure.value || departure.value <= arrival.value) departure.value = addDays(arrival.value, 2);
    });
  });

  const liveForm = document.querySelector('#avForm');
  if (liveForm) {
    let prepared = false;
    ['from', 'to', 'type', 'rigLengthFt', 'slides'].forEach((name) => {
      const field = liveForm.elements.namedItem(name);
      const value = params.get(name);
      if (!field || !value) return;
      field.value = value;
      prepared = true;
    });
    if (prepared && params.get('from') && params.get('to')) liveForm.requestSubmit();
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
