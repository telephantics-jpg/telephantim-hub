/**
 * Live site content — Beacons-style CMS data.
 * Tries telephantim-ai /api/content first, then local site-content.json.
 */
import {
  applySiteContent,
  PROFILE,
  SUPPORT,
  FEATURED,
  SOCIALS,
  ICONS,
} from "./links.js";
import { applyBioContent, BIO } from "./bio-config.js";

const LOCAL_URL = "site-content.json";

function apiBase() {
  const raw = typeof window !== "undefined" ? window.TELEPHANTIM_API : "";
  if (raw == null) return "";
  return String(raw).replace(/\/$/, "");
}

export async function fetchSiteContent() {
  const bases = [];
  // Same-origin first (server.py /admin saves land here)
  bases.push("/api/content");
  const api = apiBase();
  if (api) bases.push(`${api}/api/content`);
  bases.push(`${LOCAL_URL}?v=${Date.now()}`);

  for (const url of bases) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      // API wraps { ok, content }; local file is bare
      const content = data && (data.content || data);
      if (content && (content.profile || content.support || content.bio)) {
        return content;
      }
    } catch (err) {
      console.warn("[site-content] fetch failed", url, err);
    }
  }
  return null;
}

/** Apply CMS payload into live module state. Returns applied content or null. */
export async function hydrateSiteContent() {
  const content = await fetchSiteContent();
  if (!content) return null;
  applySiteContent(content);
  applyBioContent(content.bio || content);
  return content;
}

export function getSiteSnapshot() {
  return {
    profile: { ...PROFILE },
    support: [...SUPPORT],
    featured: [...FEATURED],
    socials: [...SOCIALS],
    icons: { ...ICONS },
    bio: { ...BIO },
  };
}

export async function fetchSunoCatalog() {
  const bases = [];
  bases.push("/api/suno-catalog");
  const api = apiBase();
  if (api) bases.push(`${api}/api/suno-catalog`);
  bases.push(`suno-catalog.json?v=${Date.now()}`);

  for (const url of bases) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const rows = Array.isArray(data) ? data : data.tracks || data.catalog;
      if (Array.isArray(rows) && rows.length) return rows;
    } catch (err) {
      console.warn("[suno-catalog] fetch failed", url, err);
    }
  }
  return null;
}
