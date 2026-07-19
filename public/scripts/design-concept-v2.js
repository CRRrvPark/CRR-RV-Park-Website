(() => {
  'use strict';

  const header = document.querySelector('[data-v2-header]');
  const menuButton = document.querySelector('[data-v2-menu]');
  const navigation = document.querySelector('[data-v2-nav]');

  const closeMenu = () => {
    if (!header || !menuButton || !navigation) return;
    header.classList.remove('is-open');
    navigation.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
  };

  if (header && menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
      header.classList.toggle('is-open', willOpen);
      navigation.classList.toggle('is-open', willOpen);
      menuButton.setAttribute('aria-expanded', String(willOpen));
      menuButton.setAttribute('aria-label', willOpen ? 'Close navigation' : 'Open navigation');
    });

    navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

    document.addEventListener('click', (event) => {
      if (!header.contains(event.target)) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || menuButton.getAttribute('aria-expanded') !== 'true') return;
      closeMenu();
      menuButton.focus();
    });
  }

  const mobileBook = document.querySelector('.v2-mobile-book');
  if (mobileBook) {
    const updateMobileBook = () => {
      const isVisible = window.scrollY > 520;
      mobileBook.classList.toggle('is-visible', isVisible);
      mobileBook.setAttribute('aria-hidden', String(!isVisible));
      mobileBook.tabIndex = isVisible ? 0 : -1;
    };
    window.addEventListener('scroll', updateMobileBook, { passive: true });
    updateMobileBook();
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

  document.querySelectorAll('[data-v2-search]').forEach((form) => {
    const arrival = form.querySelector('[data-v2-arrival]');
    const departure = form.querySelector('[data-v2-departure]');
    if (!arrival || !departure) return;

    arrival.min = today;
    arrival.value = query.get('from') || today;
    departure.min = addDays(arrival.value, 1);
    departure.value = query.get('to') || addDays(arrival.value, 2);

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
    let hasPreparedSearch = false;
    ['from', 'to', 'type', 'rigLengthFt', 'slides'].forEach((name) => {
      const value = query.get(name);
      const field = liveAvailabilityForm.elements.namedItem(name);
      if (!field || !value) return;
      field.value = value;
      hasPreparedSearch = true;
    });

    if (hasPreparedSearch && query.get('from') && query.get('to')) {
      liveAvailabilityForm.requestSubmit();
    }
  }

  const matcher = document.querySelector('[data-v2-matcher]');
  if (matcher) {
    const cards = Array.from(document.querySelectorAll('[data-v2-site-card]'));
    const status = matcher.querySelector('[data-v2-match-status]');

    matcher.addEventListener('submit', (event) => {
      event.preventDefault();

      const rigType = matcher.elements.namedItem('rigType').value;
      const rigLength = Number(matcher.elements.namedItem('rigLength').value || 0);
      const hookups = matcher.elements.namedItem('hookups').value;
      const hasSlides = matcher.elements.namedItem('matcherSlides').value === 'yes';

      cards.forEach((card) => card.classList.remove('is-recommended'));

      if (rigLength > 65) {
        if (status) {
          status.textContent = 'The listed guest-bookable pull-through fit is up to 65 feet. Call the office with the exact rig dimensions so the team can review the options.';
        }
        return;
      }

      let match = 'full';
      let guidance = '';

      if (rigType === 'tent') {
        match = 'tent';
        if (hookups === 'full' || hookups === 'partial') {
          guidance = 'Tent sites do not include hookups. ';
        }
      } else if ((rigType === 'van' || rigType === 'truck') && hookups === 'none' && (!rigLength || rigLength <= 25)) {
        match = 'dry';
      } else if (hookups === 'partial' && (!rigLength || rigLength <= 50)) {
        match = 'partial';
      } else if (hookups === 'none') {
        match = 'full';
        guidance = 'Dry camp is limited to qualifying vans and truck campers up to 25 feet. ';
      }

      if (rigLength > 50 && match === 'partial') {
        match = 'full';
        guidance = 'Water + electric sites are listed up to 50 feet. ';
      }

      if (hasSlides) {
        guidance += 'Confirm the site-specific slide guidance on the live map. ';
      }

      const matchedCard = cards.find((card) => card.dataset.v2SiteCard === match);
      matchedCard?.classList.add('is-recommended');

      if (status && matchedCard) {
        const title = matchedCard.querySelector('h3')?.textContent || 'Recommended stay type';
        status.textContent = `${guidance}${title} is the recommended starting point for the details entered.`;
      }

      matchedCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const filterGroup = document.querySelector('[data-v2-filters]');
  const experienceGrid = document.querySelector('[data-v2-experience-grid]');
  const filterStatus = document.querySelector('[data-v2-filter-status]');

  if (filterGroup && experienceGrid) {
    const buttons = Array.from(filterGroup.querySelectorAll('[data-v2-filter]'));
    const cards = Array.from(experienceGrid.querySelectorAll('[data-v2-categories]'));

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const filter = button.dataset.v2Filter || 'all';
        buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));

        let visibleCount = 0;
        cards.forEach((card) => {
          const categories = (card.dataset.v2Categories || '').split(',');
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

  const reveals = document.querySelectorAll('.v2-reveal');
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
      { threshold: 0.08, rootMargin: '0px 0px -36px 0px' },
    );
    reveals.forEach((element) => observer.observe(element));
  }
})();
