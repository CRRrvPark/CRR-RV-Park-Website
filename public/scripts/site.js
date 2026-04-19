/* ============================================
   CROOKED RIVER RANCH RV PARK — Shared JS
   ============================================ */

(function () {
  'use strict';

  /* ---- NAV: scroll background ---- */
  const nav = document.querySelector('nav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- HAMBURGER toggle ---- */
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
    // Close menu when a nav link is clicked (mobile)
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  /* ---- REVEAL on scroll (IntersectionObserver) ---- */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach(el => io.observe(el));
  } else {
    // Fallback: show everything
    reveals.forEach(el => el.classList.add('visible'));
  }

  /* ---- FORM handler (Netlify Forms via AJAX) ---- */
  document.querySelectorAll('#contact-form, #monthly-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('.btn-sub');
      var origText = btn.textContent;
      btn.textContent = 'Sending…';
      btn.disabled = true;

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      })
      .then(function () {
        btn.textContent = 'Message Sent ✓';
        btn.style.background = '#16a34a';
        form.reset();
        setTimeout(function () {
          btn.textContent = origText;
          btn.style.background = '';
          btn.disabled = false;
        }, 4000);
      })
      .catch(function (err) {
        console.error('Form submission error:', err);
        btn.textContent = 'Error — Try Again';
        btn.style.background = '#dc2626';
        setTimeout(function () {
          btn.textContent = origText;
          btn.style.background = '';
          btn.disabled = false;
        }, 3500);
      });
    });
  });

  /* ---- COLLAPSIBLE SECTION toggles ---- */
  document.querySelectorAll('.ag-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const detail = btn.nextElementSibling;
      if (detail.classList.contains('open')) {
        detail.style.maxHeight = '0';
        detail.classList.remove('open');
        btn.classList.remove('open');
        btn.textContent = 'Read more';
      } else {
        detail.style.maxHeight = detail.scrollHeight + 'px';
        detail.classList.add('open');
        btn.classList.add('open');
        btn.textContent = 'Show less';
      }
    });
  });

  /* ---- ACTIVE NAV LINK highlight ---- */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a:not(.nav-cta)').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

})();
