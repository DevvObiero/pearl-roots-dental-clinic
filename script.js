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