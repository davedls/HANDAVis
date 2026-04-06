(() => {
  const nav = document.querySelector('.nav-links');
  if (!nav) return;

  const header = document.querySelector('.main-header');
  const links = Array.from(nav.querySelectorAll('.nav-scroll-link[href^="#"]'));
  if (!links.length) return;

  const pairs = links
    .map((link) => {
      const hash = link.getAttribute('href');
      const section = hash ? document.querySelector(hash) : null;
      return section ? { link, section } : null;
    })
    .filter(Boolean);
  if (!pairs.length) return;

  const indicator = document.createElement('span');
  indicator.className = 'nav-indicator';
  nav.appendChild(indicator);

  let activeLink = null;
  let ticking = false;
  let manualTarget = null;
  let manualTargetUntil = 0;
  const visibleRatios = new Map();

  function getHeaderOffset() {
    return (header ? header.offsetHeight : 0) + 12;
  }

  function moveIndicator(link) {
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();

    indicator.style.left = `${Math.round(linkRect.left - navRect.left)}px`;
    indicator.style.top = `${Math.round(linkRect.top - navRect.top)}px`;
    indicator.style.width = `${Math.round(linkRect.width)}px`;
    indicator.style.height = `${Math.round(linkRect.height)}px`;
    indicator.style.opacity = '1';
  }

  function setActive(link) {
    if (!link) return;
    if (link !== activeLink) {
      links.forEach((item) => item.classList.remove('active'));
      link.classList.add('active');
      activeLink = link;
    }
    moveIndicator(link);
  }

  function isManualNavigationRunning() {
    if (!manualTarget) return false;

    const targetTop = manualTarget.section.getBoundingClientRect().top;
    if (Math.abs(targetTop - getHeaderOffset()) <= 18 || performance.now() > manualTargetUntil) {
      manualTarget = null;
      return false;
    }

    return true;
  }

  function getCurrentLinkByScrollFallback() {
    const y = window.scrollY + getHeaderOffset() + (window.innerHeight * 0.2);

    let current = pairs[0].link;
    pairs.forEach(({ link, section }) => {
      if (section.offsetTop <= y) {
        current = link;
      }
    });
    return current;
  }

  function getMostVisibleLink() {
    let bestLink = null;
    let bestRatio = 0;
    visibleRatios.forEach((ratio, link) => {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestLink = link;
      }
    });
    return bestLink;
  }

  function syncActiveLink() {
    if (isManualNavigationRunning()) {
      setActive(manualTarget.link);
      return;
    }

    setActive(getMostVisibleLink() || getCurrentLinkByScrollFallback());
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      syncActiveLink();
      ticking = false;
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const pair = pairs.find((item) => item.section === entry.target);
        if (!pair) return;

        if (entry.isIntersecting) {
          visibleRatios.set(pair.link, entry.intersectionRatio);
        } else {
          visibleRatios.delete(pair.link);
        }
      });

      syncActiveLink();
    },
    {
      threshold: [0.2, 0.35, 0.5, 0.65, 0.8],
      rootMargin: '-72px 0px -35% 0px',
    }
  );

  pairs.forEach(({ section }) => {
    section.style.scrollMarginTop = `${getHeaderOffset()}px`;
    observer.observe(section);
  });

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const hash = link.getAttribute('href');
      const targetSection = hash ? document.querySelector(hash) : null;
      if (!targetSection) return;

      event.preventDefault();
      manualTarget = { link, section: targetSection };
      manualTargetUntil = performance.now() + 900;

      setActive(link);

      const targetY = window.scrollY + targetSection.getBoundingClientRect().top - getHeaderOffset();
      window.scrollTo({
        top: Math.max(targetY, 0),
        behavior: 'smooth',
      });

      if (history.replaceState) {
        history.replaceState(null, '', hash);
      } else {
        window.location.hash = hash;
      }
    });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    pairs.forEach(({ section }) => {
      section.style.scrollMarginTop = `${getHeaderOffset()}px`;
    });
    syncActiveLink();
  });

  const initialFromHash = links.find((link) => link.getAttribute('href') === window.location.hash);
  setActive(initialFromHash || getCurrentLinkByScrollFallback() || links[0]);
})();
document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
        threshold: 0.2 // Trigger when 20% of the section is visible
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const elements = entry.target.querySelectorAll('.scroll-animate');
            
            // Check if we are coming from the top (scrolling down into it)
            // or if we are leaving toward the top (scrolling up out of it)
            if (entry.isIntersecting) {
                elements.forEach(el => el.classList.add('is-visible'));
            } else {
                // Only remove the class if the section is ABOVE the viewport 
                // (meaning the user scrolled back up)
                if (entry.boundingClientRect.top > 0) {
                    elements.forEach(el => el.classList.remove('is-visible'));
                }
            }
        });
    }, observerOptions);

    // Observe the entire mission section
    const missionSection = document.querySelector('#mission');
    if (missionSection) observer.observe(missionSection);
});