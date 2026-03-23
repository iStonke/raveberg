<template>
  <div class="subpage-hero-orb" aria-hidden="true">
    <div class="subpage-hero-orb__halo" />
    <div class="subpage-hero-orb__core">
      <div class="subpage-hero-orb__content">
        <span class="subpage-hero-orb__cloud subpage-hero-orb__cloud--1" />
        <span class="subpage-hero-orb__cloud subpage-hero-orb__cloud--2" />
        <span class="subpage-hero-orb__cloud subpage-hero-orb__cloud--3" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.subpage-hero-orb {
  position: relative;
  width: 5.5rem;
  height: 5.5rem;
  display: grid;
  place-items: center;
}

.subpage-hero-orb__halo {
  position: absolute;
  inset: 0.2rem;
  border-radius: 999px;
  background:
    radial-gradient(circle at 50% 34%, rgba(129, 214, 255, 0.2), transparent 42%),
    radial-gradient(circle at 50% 68%, rgba(39, 93, 176, 0.18), transparent 70%);
  filter: blur(14px);
  opacity: 0.72;
}

.subpage-hero-orb__core {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  border: 1px solid rgba(166, 203, 232, 0.16);
  background:
    radial-gradient(circle at 50% 34%, rgba(84, 116, 165, 0.32), rgba(20, 32, 48, 0.06) 34%),
    linear-gradient(180deg, rgba(23, 34, 49, 0.96), rgba(10, 17, 27, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    inset 0 -10px 18px rgba(0, 0, 0, 0.2),
    0 14px 30px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

.subpage-hero-orb__content {
  position: relative;
  display: grid;
  align-content: center;
  justify-items: center;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(circle at 28% 30%, rgba(92, 228, 255, 0.46), transparent 48%),
    radial-gradient(circle at 72% 34%, rgba(167, 92, 255, 0.36), transparent 52%),
    radial-gradient(circle at 52% 76%, rgba(255, 102, 186, 0.34), transparent 48%),
    linear-gradient(160deg, rgba(42, 112, 210, 0.72), rgba(49, 22, 122, 0.82) 54%, rgba(150, 34, 107, 0.74));
  animation: subpageHeroOrbContentPulse 7.2s ease-in-out infinite;
  transform-origin: center;
}

.subpage-hero-orb__content::before,
.subpage-hero-orb__content::after {
  content: '';
  position: absolute;
  inset: -18%;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(18px);
}

.subpage-hero-orb__content::before {
  background:
    radial-gradient(circle at 34% 32%, rgba(88, 237, 255, 0.34), transparent 34%),
    radial-gradient(circle at 64% 70%, rgba(255, 114, 198, 0.26), transparent 38%);
  opacity: 0.82;
  animation: subpageHeroOrbWashA 9.8s ease-in-out infinite;
}

.subpage-hero-orb__content::after {
  background:
    radial-gradient(circle at 68% 28%, rgba(170, 108, 255, 0.3), transparent 36%),
    radial-gradient(circle at 28% 74%, rgba(74, 163, 255, 0.24), transparent 42%);
  opacity: 0.78;
  animation: subpageHeroOrbWashB 11.2s ease-in-out infinite;
}

.subpage-hero-orb__cloud {
  position: absolute;
  border-radius: 999px;
  filter: blur(14px);
  mix-blend-mode: screen;
  pointer-events: none;
}

.subpage-hero-orb__cloud--1 {
  top: -0.9rem;
  left: -1.1rem;
  width: 5.8rem;
  height: 5.2rem;
  background:
    radial-gradient(circle at 40% 46%, rgba(86, 232, 255, 0.96), rgba(86, 232, 255, 0.3) 58%, transparent 82%);
  opacity: 0.78;
  animation: subpageHeroOrbCloudA 7.4s ease-in-out infinite;
}

.subpage-hero-orb__cloud--2 {
  right: -1.05rem;
  bottom: -0.9rem;
  width: 5.6rem;
  height: 5.45rem;
  background:
    radial-gradient(circle at 54% 46%, rgba(162, 98, 255, 0.88), rgba(162, 98, 255, 0.26) 58%, transparent 80%);
  opacity: 0.7;
  animation: subpageHeroOrbCloudB 8.2s ease-in-out infinite;
}

.subpage-hero-orb__cloud--3 {
  left: -0.4rem;
  bottom: -1.2rem;
  width: 5.3rem;
  height: 4.8rem;
  background:
    radial-gradient(circle at 48% 48%, rgba(255, 116, 191, 0.84), rgba(255, 116, 191, 0.24) 56%, transparent 80%);
  opacity: 0.66;
  animation: subpageHeroOrbCloudC 9.6s ease-in-out infinite;
  animation-delay: 0.5s;
}

@keyframes subpageHeroOrbContentPulse {
  0% {
    transform: scale(1);
    opacity: 0.94;
  }

  50% {
    transform: scale(1.03);
    opacity: 1;
  }

  100% {
    transform: scale(1);
    opacity: 0.94;
  }
}

@keyframes subpageHeroOrbCloudA {
  0% {
    transform: translate3d(-14px, 10px, 0) scale(1);
    opacity: 0.66;
  }

  50% {
    transform: translate3d(18px, -20px, 0) scale(1.18);
    opacity: 0.94;
  }

  100% {
    transform: translate3d(-14px, 10px, 0) scale(1);
    opacity: 0.66;
  }
}

@keyframes subpageHeroOrbCloudB {
  0% {
    transform: translate3d(15px, -12px, 0) scale(1);
    opacity: 0.58;
  }

  50% {
    transform: translate3d(-18px, 16px, 0) scale(1.2);
    opacity: 0.88;
  }

  100% {
    transform: translate3d(15px, -12px, 0) scale(1);
    opacity: 0.58;
  }
}

@keyframes subpageHeroOrbCloudC {
  0% {
    transform: translate3d(-12px, 12px, 0) scale(0.98);
    opacity: 0.52;
  }

  50% {
    transform: translate3d(18px, -18px, 0) scale(1.22);
    opacity: 0.84;
  }

  100% {
    transform: translate3d(-12px, 12px, 0) scale(0.98);
    opacity: 0.52;
  }
}

@keyframes subpageHeroOrbWashA {
  0% {
    transform: translate3d(-6px, -4px, 0) scale(1);
    opacity: 0.72;
  }

  50% {
    transform: translate3d(8px, 6px, 0) scale(1.08);
    opacity: 0.96;
  }

  100% {
    transform: translate3d(-6px, -4px, 0) scale(1);
    opacity: 0.72;
  }
}

@keyframes subpageHeroOrbWashB {
  0% {
    transform: translate3d(7px, 5px, 0) scale(1.02);
    opacity: 0.66;
  }

  50% {
    transform: translate3d(-9px, -8px, 0) scale(1.1);
    opacity: 0.9;
  }

  100% {
    transform: translate3d(7px, 5px, 0) scale(1.02);
    opacity: 0.66;
  }
}

@media (max-width: 760px) {
  .subpage-hero-orb {
    width: 5rem;
    height: 5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .subpage-hero-orb__content,
  .subpage-hero-orb__content::before,
  .subpage-hero-orb__content::after,
  .subpage-hero-orb__cloud {
    animation: none !important;
    transition: none !important;
  }
}
</style>
