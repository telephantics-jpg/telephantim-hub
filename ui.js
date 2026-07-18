import { PROFILE, SUPPORT, FEATURED, SOCIALS, ICONS } from "./links.js";

function el(tag, className, html) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (html != null) n.innerHTML = html;
  return n;
}

function linkButton(item, { compact = false } = {}) {
  const a = document.createElement("a");
  a.className = compact ? "bio-link compact" : "bio-link";
  a.href = item.url.startsWith("http") ? item.url : `https://${item.url}`;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  if (item.accent) a.style.setProperty("--link-accent", item.accent);

  const icon = el("span", "bio-link-icon", ICONS[item.icon] || "🔗");
  const text = el("span", "bio-link-text");
  text.appendChild(el("strong", null, item.title));
  if (item.subtitle && !compact) {
    text.appendChild(el("small", null, item.subtitle));
  }
  const arrow = el("span", "bio-link-arrow", "→");
  a.append(icon, text, arrow);
  return a;
}

export function mountBio({ rootId = "bio-root", compact = false } = {}) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const card = el("div", "bio-card");

  // Profile
  const head = el("div", "bio-head");
  const avatar = document.createElement("img");
  avatar.className = "bio-avatar";
  avatar.src = PROFILE.avatar;
  avatar.alt = PROFILE.name;
  avatar.referrerPolicy = "no-referrer";

  const meta = el("div", "bio-meta");
  meta.appendChild(el("h1", null, PROFILE.name));
  meta.appendChild(el("p", "handle", PROFILE.handle));
  if (!compact) meta.appendChild(el("p", "tagline", PROFILE.tagline));
  head.append(avatar, meta);
  card.appendChild(head);

  // Support section
  const supportSec = el("section", "bio-section");
  supportSec.appendChild(el("h2", null, "Support / Pay"));
  const supportList = el("div", "bio-links");
  SUPPORT.forEach((item) => supportList.appendChild(linkButton(item, { compact })));
  supportSec.appendChild(supportList);
  card.appendChild(supportSec);

  // Featured
  if (!compact) {
    const featSec = el("section", "bio-section");
    featSec.appendChild(el("h2", null, "Featured"));
    const featList = el("div", "bio-links");
    FEATURED.forEach((item) => featList.appendChild(linkButton(item)));
    featSec.appendChild(featList);
    card.appendChild(featSec);

    // Socials
    const socialSec = el("section", "bio-section");
    socialSec.appendChild(el("h2", null, "Socials"));
    const socialRow = el("div", "bio-socials");
    SOCIALS.forEach((s) => {
      const a = document.createElement("a");
      a.className = "bio-social";
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.title = s.title;
      a.textContent = ICONS[s.icon] || s.title[0];
      socialRow.appendChild(a);
    });
    socialSec.appendChild(socialRow);
    card.appendChild(socialSec);
  }

  const foot = el(
    "p",
    "bio-foot",
    compact
      ? "Powered by your links · Telephantix"
      : `Also on <a href="${PROFILE.beacons}" target="_blank" rel="noopener">Beacons</a> · Mjolnir 3D demo`
  );
  card.appendChild(foot);

  root.appendChild(card);
}
