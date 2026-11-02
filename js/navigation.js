/* Keyboard and accessibility support for the existing shared navigation. */
document.addEventListener('DOMContentLoaded', function () {
  const mobileNav = document.querySelector('.mobile-nav');
  const openButton = document.querySelector('.mobile-menu-button');
  const closeButton = document.querySelector('.mobile-nav .close-button');

  function focusWhenVisible(element, stillOpen) {
    const initialFocus = document.activeElement;
    let attempts = 0;
    function focusOnFrame() {
      // Do not steal focus if the user closes the menu or moves elsewhere.
      if (!stillOpen() || (document.activeElement !== initialFocus && document.activeElement !== element)) return;
      if (element.getClientRects().length && getComputedStyle(element).visibility === 'visible') {
        element.focus({ preventScroll: true });
        if (document.activeElement === element) return;
      }
      if (++attempts < 30) requestAnimationFrame(focusOnFrame);
    }
    requestAnimationFrame(focusOnFrame);
  }

  function makeButton(element, label) {
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', label);
    element.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        element.click();
      }
    });
  }

  if (mobileNav && openButton && closeButton) {
    mobileNav.id = 'mobile-navigation';
    mobileNav.setAttribute('role', 'dialog');
    mobileNav.setAttribute('aria-label', 'Main navigation');
    mobileNav.setAttribute('aria-modal', 'true');
    makeButton(openButton, 'Open navigation');
    makeButton(closeButton, 'Close navigation');
    openButton.setAttribute('aria-controls', mobileNav.id);

    const mobileSubmenus = [];
    mobileNav.querySelectorAll('.mobile-nav-item').forEach(function (item, index) {
      const trigger = item.querySelector(':scope > a');
      const submenu = item.querySelector(':scope > .mobile-dropdown');
      if (!trigger || !submenu) return;
      submenu.id = 'mobile-submenu-' + index;
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-controls', submenu.id);
      trigger.addEventListener('keydown', function (event) {
        if (event.key === ' ') {
          event.preventDefault();
          trigger.click();
        }
      });
      mobileSubmenus.push({ item, trigger });
    });

    let wasOpen = false;
    let previousOverflow = '';
    function syncMobileNavigation() {
      const isOpen = mobileNav.classList.contains('active');
      openButton.setAttribute('aria-expanded', String(isOpen));
      mobileNav.setAttribute('aria-hidden', String(!isOpen));
      mobileSubmenus.forEach(function ({ item, trigger }) {
        trigger.setAttribute('aria-expanded', String(item.classList.contains('active')));
      });
      if (isOpen && !wasOpen) {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        focusWhenVisible(closeButton, function () {
          return mobileNav.classList.contains('active');
        });
      } else if (!isOpen && wasOpen) {
        document.body.style.overflow = previousOverflow;
        const focusTarget = openButton.getClientRects().length ? openButton : document.querySelector('.header .nav a');
        if (focusTarget) focusTarget.focus();
      }
      wasOpen = isOpen;
    }
    // Existing inline click handlers own the toggles; observe their results.
    new MutationObserver(syncMobileNavigation).observe(mobileNav, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true
    });
    syncMobileNavigation();

    document.addEventListener('keydown', function (event) {
      if (!mobileNav.classList.contains('active')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeButton.click();
      } else if (event.key === 'Tab') {
        const focusable = Array.from(mobileNav.querySelectorAll('a[href], button, [tabindex="0"]'))
          .filter(function (element) { return element.getClientRects().length > 0; });
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !mobileNav.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !mobileNav.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    window.matchMedia('(min-width: 1200px)').addEventListener('change', function (event) {
      if (event.matches && mobileNav.classList.contains('active')) closeButton.click();
    });
  }

  document.querySelectorAll('.header .nav-item').forEach(function (item, index) {
    const trigger = item.querySelector(':scope > a');
    const submenu = item.querySelector(':scope > .dropdown-menu');
    if (!trigger || !submenu) return;
    submenu.id = 'desktop-submenu-' + index;
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-controls', submenu.id);
    function syncExpanded() {
      const expanded = !item.classList.contains('is-dismissed') &&
        (item.matches(':hover') || item.contains(document.activeElement));
      trigger.setAttribute('aria-expanded', String(expanded));
    }
    function openSubmenu() {
      item.classList.remove('is-dismissed');
      syncExpanded();
    }
    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      openSubmenu();
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        openSubmenu();
        focusWhenVisible(submenu.querySelector('a'), function () {
          return !item.classList.contains('is-dismissed') && item.contains(document.activeElement);
        });
      }
    });
    item.addEventListener('mouseenter', openSubmenu);
    item.addEventListener('mouseleave', syncExpanded);
    item.addEventListener('focusin', syncExpanded);
    item.addEventListener('focusout', function () {
      queueMicrotask(function () {
        if (!item.contains(document.activeElement)) item.classList.remove('is-dismissed');
        syncExpanded();
      });
    });
    item.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        item.classList.add('is-dismissed');
        trigger.focus();
        syncExpanded();
      }
    });
    syncExpanded();
  });
});
