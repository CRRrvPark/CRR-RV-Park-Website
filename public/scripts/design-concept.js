(() => {
  'use strict';

  const header = document.querySelector('[data-concept-header]');
  const menuButton = document.querySelector('[data-concept-menu]');
  const navigation = document.querySelector('[data-concept-nav]');

  const closeMenu = () => {
    if (!menuButton || !navigation || !header) return;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    navigation.classList.remove('is-open');
    header.classList.remove('is-open');
  };

  if (header) {
    const updateHeader = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
  }

  const mobileCta = document.querySelector('.concept-mobile-cta');
  if (mobileCta) {
    const updateMobileCta = () => {
      const isVisible = window.scrollY > 420;
      mobileCta.classList.toggle('is-visible', isVisible);
      mobileCta.setAttribute('aria-hidden', String(!isVisible));
      mobileCta.tabIndex = isVisible ? 0 : -1;
    };
    window.addEventListener('scroll', updateMobileCta, { passive: true });
    updateMobileCta();
  }

  if (menuButton && navigation && header) {
    menuButton.addEventListener('click', () => {
      const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(willOpen));
      menuButton.setAttribute('aria-label', willOpen ? 'Close navigation' : 'Open navigation');
      navigation.classList.toggle('is-open', willOpen);
      header.classList.toggle('is-open', willOpen);
    });

    navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        menuButton.focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (!header.contains(event.target)) closeMenu();
    });
  }

  const toLocalISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const addDays = (dateValue, days) => {
    const [year, month, day] = dateValue.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    return toLocalISO(date);
  };

  const query = new URLSearchParams(window.location.search);
  const today = toLocalISO(new Date());

  document.querySelectorAll('[data-concept-search]').forEach((form) => {
    const arrival = form.querySelector('[data-arrival]');
    const departure = form.querySelector('[data-departure]');
    if (!arrival || !departure) return;

    arrival.min = today;
    arrival.value = query.get('from') || arrival.value || today;
    departure.min = addDays(arrival.value, 1);
    departure.value = query.get('to') || departure.value || addDays(arrival.value, 2);

    ['type', 'rigLengthFt', 'slides'].forEach((name) => {
      const field = form.elements.namedItem(name);
      const value = query.get(name);
      if (field && value) field.value = value;
    });

    arrival.addEventListener('change', () => {
      if (!arrival.value) return;
      const nextDay = addDays(arrival.value, 1);
      departure.min = nextDay;
      if (!departure.value || departure.value <= arrival.value) {
        departure.value = addDays(arrival.value, 2);
      }
    });
  });

  const liveAvailabilityForm = document.querySelector('#avForm');
  if (liveAvailabilityForm) {
    const fieldMap = {
      from: 'from',
      to: 'to',
      type: 'type',
      rigLengthFt: 'rigLengthFt',
      slides: 'slides',
    };
    let hasPreparedSearch = false;

    Object.entries(fieldMap).forEach(([queryName, fieldName]) => {
      const value = query.get(queryName);
      const field = liveAvailabilityForm.elements.namedItem(fieldName);
      if (!field || !value) return;
      field.value = value;
      hasPreparedSearch = true;
    });

    if (hasPreparedSearch && query.get('from') && query.get('to')) {
      liveAvailabilityForm.requestSubmit();
    }
  }

  const matcher = document.querySelector('[data-site-matcher]');
  if (matcher) {
    const cards = Array.from(document.querySelectorAll('[data-site-card]'));
    const status = matcher.querySelector('[data-match-status]');

    matcher.addEventListener('submit', (event) => {
      event.preventDefault();
      const setup = matcher.elements.namedItem('setup').value;
      const hookups = matcher.elements.namedItem('hookups').value;

      let match = 'full';
      let guidance = '';
      if (setup === 'tent') {
        match = 'tent';
        if (hookups !== 'none') guidance = 'Tent sites do not include hookups. ';
      }
      else if (setup === 'van' && hookups === 'none') match = 'dry';
      else if (hookups === 'partial') match = 'partial';
      else if (setup === 'rv' && hookups === 'none') {
        match = 'full';
        guidance = 'Dry camp is limited to single vehicles up to 25 feet. ';
      }

      cards.forEach((card) => card.classList.toggle('is-recommended', card.dataset.siteCard === match));

      const matchedCard = cards.find((card) => card.dataset.siteCard === match);
      if (status && matchedCard) {
        const title = matchedCard.querySelector('h3')?.textContent || 'Recommended site type';
        status.textContent = `${guidance}${title} is the strongest starting point for the setup you selected.`;
      }
      matchedCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const filterGroup = document.querySelector('[data-explore-filters]');
  const experienceGrid = document.querySelector('[data-experience-grid]');
  const filterStatus = document.querySelector('[data-filter-status]');

  if (filterGroup && experienceGrid) {
    const buttons = Array.from(filterGroup.querySelectorAll('[data-filter]'));
    const cards = Array.from(experienceGrid.querySelectorAll('[data-categories]'));

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const filter = button.dataset.filter || 'all';
        buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));

        let visibleCount = 0;
        cards.forEach((card) => {
          const categories = (card.dataset.categories || '').split(',');
          const show = filter === 'all' || categories.includes(filter);
          card.hidden = !show;
          if (show) visibleCount += 1;
        });

        if (filterStatus) {
          const label = button.textContent.trim().toLowerCase();
          filterStatus.textContent =
            filter === 'all'
              ? 'Showing all featured ideas.'
              : `Showing ${visibleCount} ${label} ${visibleCount === 1 ? 'idea' : 'ideas'}.`;
        }
      });
    });
  }

  const reveals = document.querySelectorAll('.concept-reveal');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((element) => element.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );
    reveals.forEach((element) => observer.observe(element));
  }
})();
