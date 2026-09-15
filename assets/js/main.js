/* Preloader — знак логотипа переливается, пока грузится страница */
(() => {
  const preloader = document.getElementById("preloader");
  if (!preloader) return;

  const root = document.documentElement;
  root.classList.add("is-loading");

  /* минимальное время показа, чтобы перелив успел прочитаться */
  const MIN_MS = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 400 : 2300;
  let hidden = false;

  const hide = () => {
    if (hidden) return;
    hidden = true;
    const wait = Math.max(0, MIN_MS - performance.now());
    setTimeout(() => {
      preloader.classList.add("done");
      root.classList.remove("is-loading");
      setTimeout(() => preloader.remove(), 700);
    }, wait);
  };

  if (document.readyState === "complete") hide();
  else window.addEventListener("load", hide);

  /* страховка: не держим страницу дольше 4.5 с, даже если что-то не догрузилось */
  setTimeout(hide, 4500);
})();

/* Куда уходят заявки со всех форм сайта.
   Пока строка пустая — форма открывает письмо в почтовой программе,
   как и раньше. Вписать сюда адрес веб-приложения Google Apps Script
   (вида https://script.google.com/macros/s/…/exec) — и заявки начнут
   падать в Google Таблицу. Больше нигде ничего менять не нужно. */
const REQUEST_ENDPOINT = "https://script.google.com/macros/s/AKfycbyCPKuVdIBWWcClgZeeGzsyZZK9dGukven0mGEHy2G3d35CAxc92UfVuthc68F1H3bT/exec";

document.addEventListener("DOMContentLoaded", () => {
  /* Sticky header shadow */
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Mobile nav toggle */
  const navToggle = document.querySelector(".nav-toggle");
  const mobileNav = document.querySelector(".mobile-nav");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", () => {
      const willOpen = !mobileNav.classList.contains("open");
      navToggle.classList.toggle("open", willOpen);
      mobileNav.classList.toggle("open", willOpen);
      document.body.style.overflow = willOpen ? "hidden" : "";
    });
    mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        navToggle.classList.remove("open");
        mobileNav.classList.remove("open");
        document.body.style.overflow = "";
      });
    });
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Scroll progress bar */
  if (!reduceMotion) {
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    document.body.appendChild(bar);
    let ticking = false;
    const updateBar = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = `scaleX(${p})`;
      ticking = false;
    };
    updateBar();
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(updateBar);
        }
      },
      { passive: true }
    );
  }

  /* Hero mark parallax (pointer + scroll) */
  const heroMark = document.querySelector(".hero-mark-bg");
  const hero = document.querySelector(".hero");
  if (heroMark && hero && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    let px = 0,
      py = 0,
      sy = 0,
      raf = null;
    const apply = () => {
      heroMark.style.setProperty("--mark-x", `${px}px`);
      heroMark.style.setProperty("--mark-y", `${py + sy}px`);
      raf = null;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    hero.addEventListener(
      "mousemove",
      (e) => {
        const r = hero.getBoundingClientRect();
        px = ((e.clientX - r.left) / r.width - 0.5) * -26;
        py = ((e.clientY - r.top) / r.height - 0.5) * -18;
        schedule();
      },
      { passive: true }
    );
    hero.addEventListener("mouseleave", () => {
      px = 0;
      py = 0;
      schedule();
    });
    window.addEventListener(
      "scroll",
      () => {
        sy = Math.min(window.scrollY, 600) * 0.12;
        schedule();
      },
      { passive: true }
    );
  }

  /* Reveal on scroll */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      /* threshold в долях элемента не годится: блок с текстом политики
         высотой ~9000px никогда не покажет 15% себя в окне 900px, и такой
         блок оставался невидимым навсегда. Считаем появлением любое
         пересечение, а нужную задержку даёт отрицательный rootMargin. */
      { threshold: 0, rootMargin: "0px 0px -80px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));

    /* Страховка: при резкой прокрутке (флик на мобильном, переход по якорю,
       восстановление позиции браузером) блок, через который «перескочили»
       за один кадр, никогда не пересекается с областью наблюдения ни разу —
       observer для него просто не срабатывает. Раньше страховка смотрела
       только на то, что видно на экране прямо сейчас (r.bottom > 0), и не
       замечала как раз такие уже проскроленные мимо блоки — они оставались
       невидимыми навсегда. Условие «верх элемента уже достиг низа экрана»
       ловит и их: неважно, ушёл ли блок вверх за пределы окна или ещё виден. */
    const revealIfDue = (el) => {
      if (el.classList.contains("in-view")) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) el.classList.add("in-view");
    };
    let ticking = false;
    const catchMissed = () => {
      ticking = false;
      revealEls.forEach(revealIfDue);
    };
    /* setTimeout, а не requestAnimationFrame: rAF не выполняется, пока вкладка
       в фоне или не отрисовывается (например, свёрнутый на мобильном браузер
       во время долгой прокрутки), и тогда страховка тоже зависала бы. */
    const scheduleCatchUp = () => {
      if (ticking) return;
      ticking = true;
      setTimeout(catchMissed, 100);
    };
    window.addEventListener("scroll", scheduleCatchUp, { passive: true });
    window.addEventListener("resize", scheduleCatchUp);
    setTimeout(catchMissed, 500);
    setTimeout(catchMissed, 3000);
    window.addEventListener("beforeprint", () => revealEls.forEach((el) => el.classList.add("in-view")));
  } else {
    revealEls.forEach((el) => el.classList.add("in-view"));
  }

  /* Animated stat counters */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    const animateCounter = (el) => {
      const target = parseInt(el.getAttribute("data-count"), 10) || 0;
      const suffix = el.getAttribute("data-suffix") || "";
      const duration = 1400;
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if ("IntersectionObserver" in window) {
      const animated = new Set();
      const runOnce = (el) => {
        if (animated.has(el)) return;
        animated.add(el);
        animateCounter(el);
      };
      const cio = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              runOnce(entry.target);
              cio.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach((el) => cio.observe(el));

      /* Та же страховка, что и для .reveal: при резкой прокрутке счётчик
         может оказаться пройден насквозь за один кадр и ни разу не набрать
         долю 0.5 для observer — тогда так и остаётся «0 лет в HR» навсегда,
         именно это потом читают поисковики и ИИ-ассистенты в тексте страницы. */
      let ticking = false;
      const catchMissed = () => {
        ticking = false;
        counters.forEach((el) => {
          if (animated.has(el)) return;
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight) {
            runOnce(el);
            cio.unobserve(el);
          }
        });
      };
      /* setTimeout, а не requestAnimationFrame — см. комментарий у .reveal выше */
      const scheduleCatchUp = () => {
        if (ticking) return;
        ticking = true;
        setTimeout(catchMissed, 100);
      };
      window.addEventListener("scroll", scheduleCatchUp, { passive: true });
      window.addEventListener("resize", scheduleCatchUp);
      setTimeout(catchMissed, 500);
      setTimeout(catchMissed, 3000);
    } else {
      counters.forEach(animateCounter);
    }
  }

  /* Request form(s) — на главной есть форма прямо в блоке, и такая же
     форма живёт в попапе на всех страницах, поэтому логика вынесена
     в функцию и работает через name-атрибуты, а не id (id должны быть
     уникальны, а форм на странице может быть несколько). */
  const bindRequestForm = (form) => {
    const nameInput = form.querySelector('input[name="name"]');
    const contactInput = form.querySelector('input[name="contact"]');
    const nameField = nameInput.closest(".field");
    const contactField = contactInput.closest(".field");
    const consent = form.querySelector('input[name="consent"]');
    const success = form.querySelector(".rf-success");

    const clearOnInput = (field) => {
      field.querySelector("input").addEventListener("input", () => field.classList.remove("invalid"));
    };
    clearOnInput(nameField);
    clearOnInput(contactField);
    consent.addEventListener("change", () => form.classList.remove("consent-invalid"));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const contact = contactInput.value.trim();

      let ok = true;
      nameField.classList.toggle("invalid", !name);
      if (!name) ok = false;
      contactField.classList.toggle("invalid", !contact);
      if (!contact) ok = false;
      form.classList.toggle("consent-invalid", !consent.checked);
      if (!consent.checked) ok = false;

      if (!ok) {
        form.querySelector(".field.invalid input, input[name='consent']")?.focus();
        return;
      }

      const submitBtn = form.querySelector(".rf-submit");
      const errorBox = form.querySelector(".rf-error");
      /* Источник: для форм прямо на странице задан заранее (data-source
         в HTML), для попапа — проставляется в момент открытия, по тексту
         кнопки, которая его открыла. */
      const source = form.dataset.source || "Форма на сайте";

      /* Запасной путь: пока адрес таблицы не вписан, заявка уходит
         письмом через почтовую программу — как было раньше. */
      const isEn = document.documentElement.lang === "en";
      const sendByMail = () => {
        const subject = isEn ? "Request from perfectmatch.pro" : "Заявка с сайта PerfectMatch";
        const body = isEn
          ? `Name: ${name}\nContact: ${contact}\nSource: ${source}\n\nSent from perfectmatch.pro`
          : `Имя: ${name}\nКонтакт: ${contact}\nИсточник: ${source}\n\nОтправлено с сайта perfectmatch.pro`;
        window.location.href =
          "mailto:p.yasin@perfectmatch.pro?subject=" +
          encodeURIComponent(subject) +
          "&body=" +
          encodeURIComponent(body);
        success.hidden = false;
      };

      if (!REQUEST_ENDPOINT) {
        sendByMail();
        return;
      }

      if (errorBox) errorBox.hidden = true;
      form.classList.add("sending");
      if (submitBtn) submitBtn.disabled = true;

      /* mode: "no-cors" — Google Apps Script не отдаёт заголовки CORS,
         и без этого браузер отклонил бы ответ. Заявка при этом доходит:
         запрос уходит, а провал сети мы всё равно поймаем в catch. */
      fetch(REQUEST_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
          name: name,
          contact: contact,
          source: source,
          page: location.pathname + location.search
        })
      })
        .then(() => {
          form.reset();
          success.hidden = false;
        })
        .catch(() => {
          if (errorBox) errorBox.hidden = false;
          else sendByMail();
        })
        .finally(() => {
          form.classList.remove("sending");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  };
  document.querySelectorAll(".request-form").forEach(bindRequestForm);

  /* Ссылка на политику лежит внутри <label> чекбокса — без этого клик по
     ней заодно переключал бы согласие. */
  document.querySelectorAll(".field-check .policy-link").forEach((link) => {
    link.addEventListener("click", (e) => e.stopPropagation());
  });

  /* Попап заявки — открывается по кнопкам «Обсудить задачу»
     и «Получить HR-диагностику» вместо перехода к якорю #contact. */
  const modal = document.getElementById("requestModal");
  if (modal) {
    const closeBtn = modal.querySelector(".modal-close");
    let lastFocused = null;

    const modalForm = modal.querySelector(".request-form");
    const pageLabel = document.body.dataset.page || document.title.split(" — ")[0].split(" | ")[0];

    const openModal = (buttonLabel) => {
      lastFocused = document.activeElement;
      if (modalForm) {
        modalForm.dataset.source = buttonLabel ? `«${buttonLabel}» — ${pageLabel}` : `Попап — ${pageLabel}`;
      }
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
      modal.querySelector('input[name="name"]')?.focus({ preventScroll: true });
    };

    const closeModal = () => {
      modal.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus({ preventScroll: true });
      }
    };

    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
    });

    /* Кнопки со ссылкой на #contact открывают попап вместо прокрутки —
       помечены атрибутом data-modal-trigger в HTML (не завязано на текст
       кнопки, поэтому работает одинаково на русской и английской версии). */
    document.querySelectorAll("a[data-modal-trigger], button[data-modal-trigger]").forEach((el) => {
      if (modal.contains(el)) return;
      el.addEventListener("click", (e) => {
        e.preventDefault();
        openModal(el.textContent.trim());
      });
    });
  }

  /* Testimonial carousel */
  const testiRoot = document.querySelector("[data-testimonials]");
  if (testiRoot) {
    const slides = JSON.parse(testiRoot.getAttribute("data-testimonials"));
    let index = 0;
    const quoteEl = testiRoot.querySelector(".testi-quote p");
    const nameEl = testiRoot.querySelector(".testi-person strong");
    const roleEl = testiRoot.querySelector(".testi-person span");
    const companyEl = testiRoot.querySelector(".testi-person .company");
    const logoEl = testiRoot.querySelector(".testi-logo");
    const counterEl = testiRoot.querySelector(".testi-counter");
    const prevBtn = testiRoot.querySelector(".testi-prev");
    const nextBtn = testiRoot.querySelector(".testi-next");

    const render = () => {
      const s = slides[index];
      const card = testiRoot.querySelector(".testi-card");
      card.style.opacity = 0;
      setTimeout(() => {
        quoteEl.textContent = `«${s.quote}»`;
        nameEl.textContent = s.name;
        roleEl.textContent = s.role;
        companyEl.textContent = s.company;
        if (logoEl) {
          if (s.logo) {
            logoEl.src = s.logo;
            logoEl.alt = s.company;
            logoEl.hidden = false;
          } else {
            logoEl.hidden = true;
          }
        }
        counterEl.textContent = `${index + 1} / ${slides.length}`;
        card.style.opacity = 1;
      }, 180);
    };
    prevBtn.addEventListener("click", () => {
      index = (index - 1 + slides.length) % slides.length;
      render();
    });
    nextBtn.addEventListener("click", () => {
      index = (index + 1) % slides.length;
      render();
    });

    render();
  }

  /* Уведомление о cookie — показывается один раз, дальше сайт помнит выбор */
  const cookieNotice = document.getElementById("cookieNotice");
  if (cookieNotice) {
    let accepted = false;
    try {
      accepted = localStorage.getItem("pm-cookie-accepted") === "1";
    } catch (e) {}

    if (!accepted) {
      cookieNotice.hidden = false;
      setTimeout(() => cookieNotice.classList.add("show"), 600);
    }

    cookieNotice.querySelector(".cookie-accept")?.addEventListener("click", () => {
      cookieNotice.classList.remove("show");
      try {
        localStorage.setItem("pm-cookie-accepted", "1");
      } catch (e) {}
      setTimeout(() => { cookieNotice.hidden = true; }, 450);
    });
  }
});
