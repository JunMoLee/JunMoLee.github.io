/* Junmo Lee — research website
   Data-driven rendering + light interaction layer. No frameworks, no build step. */

(function () {
  "use strict";

  const ICONS = {
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 19h16"/></svg>'
  };

  const esc = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Bold "J. Lee" / "J. Lee*" within an author string without touching other names
  const boldLee = (authors) => esc(authors).replace(/J\. Lee\*?/g, (m) => `<strong>${m}</strong>`);

  async function getJSON(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return res.json();
  }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* ---------- Site-wide links ---------- */
  function renderSiteLinks(site) {
    document.title = `${site.name} — Semiconductor Device Research`;

    const heroLinks = document.getElementById("heroLinks");
    const contactLinks = document.getElementById("contactLinks");
    const scholarLink = document.getElementById("scholarLink");
    const footerName = document.getElementById("footerName");
    const navCv = document.getElementById("navCvLink");
    const mobileCv = document.getElementById("mobileCvLink");

    const linkDefs = [
      { label: "Google Scholar", href: site.scholar, icon: "external" },
      { label: "CV", href: site.cv, icon: "download" },
      { label: "LinkedIn", href: site.linkedin, icon: "external" },
      { label: "GitHub", href: site.github, icon: "external" },
      { label: "Email", href: `mailto:${site.email}`, icon: "mail" }
    ];

    const chip = (d) =>
      `<a class="link-chip" href="${esc(d.href)}" ${d.href.startsWith("mailto") ? "" : 'target="_blank" rel="noopener"'}>${ICONS[d.icon]}${esc(d.label)}</a>`;

    if (heroLinks) heroLinks.innerHTML = linkDefs.map(chip).join("");
    if (contactLinks) contactLinks.innerHTML = linkDefs.map(chip).join("");
    if (scholarLink) scholarLink.setAttribute("href", site.scholar);
    if (footerName) footerName.textContent = `© ${site.year} ${site.name}`;
    if (navCv) navCv.setAttribute("href", site.cv);
    if (mobileCv) mobileCv.setAttribute("href", site.cv);
  }

  /* ---------- Publications ---------- */
  function renderPublications(pubs) {
    const list = document.getElementById("pubList");
    if (!list) return;
    list.innerHTML = pubs
      .map((p) => {
        const tags = (p.tags || [])
          .map((t) => `<span class="pub-tag">${esc(t)}</span>`)
          .join("");
        return `
        <article class="pub-row">
          <div class="pub-year">${esc(p.year)}</div>
          <div>
            <h3 class="pub-title">${esc(p.title)}</h3>
            <p class="pub-authors">${boldLee(p.authors)}</p>
            <p class="pub-venue"><em>${esc(p.venue)}</em>${p.vol ? ", " + esc(p.vol) : ""}, ${esc(p.year)}</p>
            ${tags ? `<div class="pub-tags">${tags}</div>` : ""}
          </div>
        </article>`;
      })
      .join("");

    const count = document.getElementById("pubCount");
    if (count) count.textContent = "";
  }

  function renderPending(items) {
    const wrap = document.getElementById("pendingList");
    if (!wrap) return;
    const heading = wrap.querySelector("h3");
    wrap.innerHTML = "";
    if (heading) wrap.appendChild(heading);
    items.forEach((p) => {
      wrap.appendChild(
        el(`
        <article class="pending-row">
          <p class="pending-status">${esc(p.status)}</p>
          <h4 class="pub-title" style="font-size:1rem">${esc(p.title)}</h4>
          <p class="pub-authors">${boldLee(p.authors)}</p>
          ${p.note ? `<p class="pub-venue">${esc(p.note)}</p>` : ""}
        </article>`)
      );
    });
  }

  /* ---------- Experience / Education ---------- */
  function renderTimeline(containerId, items, kind) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    wrap.innerHTML = items
      .map((item) => {
        if (kind === "experience") {
          const points = (item.points || []).map((pt) => `<li>${esc(pt)}</li>`).join("");
          return `
          <div class="timeline-item">
            <div class="timeline-head">
              <span class="timeline-org">${esc(item.org)}</span>
              <span class="timeline-period">${esc(item.period)}</span>
            </div>
            <p class="timeline-role">${esc(item.role)}</p>
            <p class="timeline-place">${esc(item.place)}</p>
            <ul class="timeline-points">${points}</ul>
          </div>`;
        }
        const details = (item.details || []).map((d) => `<span>${esc(d)}</span>`).join("");
        return `
        <div class="timeline-item">
          <div class="timeline-head">
            <span class="timeline-org">${esc(item.org)}</span>
            <span class="timeline-period">${esc(item.period)}</span>
          </div>
          <p class="timeline-role">${esc(item.degree)}</p>
          <p class="timeline-place">${esc(item.place)}</p>
          <div class="timeline-details">${details}</div>
        </div>`;
      })
      .join("");
  }

  /* ---------- Skills ---------- */
  function renderSkills(groups) {
    const grid = document.getElementById("skillsGrid");
    if (!grid) return;
    grid.innerHTML = groups
      .map(
        (g) => `
        <div class="skill-group">
          <h3>${esc(g.group)}</h3>
          <ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
        </div>`
      )
      .join("");
  }

  /* ---------- Awards ---------- */
  function renderAwards(awards) {
    const list = document.getElementById("awardList");
    if (!list) return;
    list.innerHTML = awards
      .map((a) => {
        const links = (a.links || [])
          .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`)
          .join("");
        return `
        <div class="award-row">
          <div class="award-year">${esc(a.year)}</div>
          <div>
            <p class="award-title">${esc(a.title)}</p>
            ${a.detail ? `<p class="award-detail">${esc(a.detail)}</p>` : ""}
            ${links ? `<div class="award-links">${links}</div>` : ""}
          </div>
        </div>`;
      })
      .join("");
  }

  /* ---------- Figure placeholders ---------- */
  // Each .figure-frame holds a real <img> (source: assets/images/, see README)
  // plus a .figure-placeholder shown until that file actually exists.
  function setupFigures() {
    document.querySelectorAll(".figure-frame img").forEach((img) => {
      const frame = img.closest(".figure-frame");
      const markLoaded = () => frame.classList.add("has-image");
      const markMissing = () => img.classList.add("is-broken");
      if (img.complete) {
        img.naturalWidth > 0 ? markLoaded() : markMissing();
      } else {
        img.addEventListener("load", markLoaded);
        img.addEventListener("error", markMissing);
      }
    });
  }

  /* ---------- Nav behavior ---------- */
  function setupNav() {
    const nav = document.getElementById("siteNav");
    const toggle = document.getElementById("navToggle");
    const menu = document.getElementById("mobileMenu");

    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      menu.classList.toggle("is-open", !open);
      document.body.style.overflow = !open ? "hidden" : "";
    });
    menu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        toggle.setAttribute("aria-expanded", "false");
        menu.classList.remove("is-open");
        document.body.style.overflow = "";
      })
    );

    const sections = ["about", "research", "publications", "experience", "contact"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const links = Array.from(document.querySelectorAll(".nav-links a"));
    if ("IntersectionObserver" in window && sections.length) {
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === `#${entry.target.id}`));
            }
          });
        },
        { rootMargin: "-45% 0px -50% 0px" }
      );
      sections.forEach((s) => spy.observe(s));
    }
  }

  /* ---------- Scroll reveal ---------- */
  function setupReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || !items.length) {
      items.forEach((i) => i.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    items.forEach((i) => io.observe(i));
  }

  /* ---------- Boot ---------- */
  async function init() {
    setupNav();
    setupFigures();

    try {
      const [site, pubs, pending, experience, education, skills, awards] = await Promise.all([
        getJSON("data/site.json"),
        getJSON("data/publications.json"),
        getJSON("data/publications-pending.json"),
        getJSON("data/experience.json"),
        getJSON("data/education.json"),
        getJSON("data/skills.json"),
        getJSON("data/awards.json")
      ]);

      renderSiteLinks(site);
      renderPublications(pubs);
      renderPending(pending);
      renderTimeline("experienceList", experience, "experience");
      renderTimeline("educationList", education, "education");
      renderSkills(skills);
      renderAwards(awards);
    } catch (err) {
      console.error("Content failed to load:", err);
    }

    setupReveal();

    // Content loads async; if the page opened on a deep link (#section),
    // the browser's initial anchor scroll can land short. Correct it once.
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) requestAnimationFrame(() => target.scrollIntoView());
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
