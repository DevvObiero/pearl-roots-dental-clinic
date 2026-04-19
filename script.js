var textWrapper = document.querySelector(".title");
textWrapper.innerHTML = textWrapper.textContent.replace(
  /\S/g,
  "<span class='letter'>$&</span>"
);

anime.timeline().add({
  targets: ".title .letter",
  translateY: [100, 0],
  translateZ: 0,
  opacity: [0, 1],
  easing: "easeOutExpo",
  duration: 2000,
  delay: (el, i) => 4800 + 40 * i,
});

TweenMax.to(".box", 2.4, {
  y: "-100%",
  ease: Expo.easeInOut,
  delay: 1,
});

TweenMax.from("img", 4, {
  scale: "2",
  ease: Expo.easeInOut,
  delay: 0,
});

// Detect mobile
var isMobile = window.innerWidth <= 768;

TweenMax.to(".wrapper-img", 2.4, {
  width: isMobile ? "160" : "400",
  height: isMobile ? "210" : "500",
  ease: Expo.easeInOut,
  delay: 3.6,
});

TweenMax.from(".img", 0.4, {
  opacity: 0,
  ease: Expo.easeInOut,
  delay: 3.4,
});

// Mobile: smaller spread; Desktop: original values
TweenMax.to(".left", 2, {
  x: isMobile ? "-200" : "-400",
  rotation: -10,
  ease: Expo.easeInOut,
  delay: 3.8,
});

TweenMax.to(".right", 2, {
  x: isMobile ? "50" : "100",
  rotation: 10,
  ease: Expo.easeInOut,
  delay: 3.8,
});

TweenMax.staggerFrom(
  ".menu > div, .hero-container > div",
  2,
  {
    opacity: 0,
    y: 30,
    ease: Expo.easeInOut,
    delay: 4.2,
  },
  0.1
);

/* SCROLL REVEAL */
const revealEls = document.querySelectorAll('.reveal');

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealEls.forEach((el) => io.observe(el));

/* BEFORE / AFTER SLIDER */
document.querySelectorAll('[data-ba]').forEach((wrap) => {
  const handle = wrap.querySelector('.ba-handle');
  let dragging = false;

  const setClip = (pct) => {
    wrap.style.setProperty('--clip', pct + '%');
  };

  const getPos = (e) => {
    const rect = wrap.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    return Math.min(Math.max((x / rect.width) * 100, 2), 98);
  };

  setClip(50);

  handle.addEventListener('mousedown', () => {
    dragging = true;
  });

  handle.addEventListener('touchstart', () => {
    dragging = true;
  }, { passive: true });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  window.addEventListener('touchend', () => {
    dragging = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (dragging) setClip(getPos(e));
  });

  window.addEventListener('touchmove', (e) => {
    if (dragging) setClip(e);
  }, { passive: true });
});

/* TESTIMONIALS */
const testimonials = [
  {
    quote: "I walked in nervous about my smile and left feeling confident again.",
    author: "Patient One"
  },
  {
    quote: "The care felt calm, clear, and very professional from start to finish.",
    author: "Patient Two"
  },
  {
    quote: "They explained everything well and made the whole process feel easy.",
    author: "Patient Three"
  }
];

let current = 0;
const quoteEl = document.getElementById('testiQuote');
const authorEl = document.getElementById('testiAuthor');
const dotsWrap = document.getElementById('testiDots');

if (quoteEl && authorEl && dotsWrap) {
  testimonials.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'testi-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => showTesti(i));
    dotsWrap.appendChild(dot);
  });

  function showTesti(index) {
    current = index;
    quoteEl.classList.remove('visible');
    authorEl.classList.remove('visible');

    setTimeout(() => {
      quoteEl.textContent = '"' + testimonials[index].quote + '"';
      authorEl.textContent = '- ' + testimonials[index].author;
      quoteEl.classList.add('visible');
      authorEl.classList.add('visible');

      document.querySelectorAll('.testi-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
      });
    }, 250);
  }

  showTesti(0);

  setInterval(() => {
    showTesti((current + 1) % testimonials.length);
  }, 5000);
}const whatsappBtn = document.querySelector(".whatsapp-btn");

setTimeout(() => {
  whatsappBtn.classList.add("show");
}, 5500);