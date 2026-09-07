const BLOCKED_TAGS =
  /^(script|iframe|object|embed|applet|link|meta|base|form|svg|math|video|audio|source|track|frame|frameset)$/i;

const ALLOWED_ATTR = new Set([
  "href",
  "src",
  "srcset",
  "alt",
  "title",
  "width",
  "height",
  "class",
  "id",
  "style",
  "align",
  "valign",
  "bgcolor",
  "background",
  "border",
  "cellpadding",
  "cellspacing",
  "colspan",
  "rowspan",
  "role",
  "target",
  "rel",
  "color",
  "face",
  "size",
  "dir",
  "lang",
]);

const SAFE_IMAGE = /^(https?:|cid:|data:image\/(jpeg|jpg|png|gif|webp);)/i;
const SAFE_HREF = /^(https?:|mailto:)/i;

export function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function safeStyle(value: string) {
  if (/expression\s*\(|@import|behavior|javascript:|vbscript:/i.test(value)) return "";
  return value.replace(/url\(\s*['"]?\s*(?!https?:|cid:|data:image\/)/gi, "url(");
}

function safeUrl(name: string, value: string) {
  let trimmed = value.trim();
  if (trimmed.startsWith("//")) trimmed = `https:${trimmed}`;
  if (name === "href") return SAFE_HREF.test(trimmed) ? trimmed : "";
  if (name === "src" || name === "background") return SAFE_IMAGE.test(trimmed) ? trimmed : "";
  if (name === "srcset") {
    return trimmed
      .split(",")
      .map((part) => part.trim())
      .filter((part) => SAFE_IMAGE.test(part))
      .join(", ");
  }
  return trimmed;
}

function cleanAttrs(tag: string, raw: string) {
  const out: string[] = [];
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (name.startsWith("on") || name.startsWith("xlink") || !ALLOWED_ATTR.has(name)) continue;
    if (name === "style") {
      const style = safeStyle(value);
      if (style) out.push(`style="${style.replace(/"/g, "&quot;")}"`);
      continue;
    }
    if (name === "href" || name === "src" || name === "srcset" || name === "background") {
      const url = safeUrl(name, value);
      if (url) out.push(`${name}="${url.replace(/"/g, "&quot;")}"`);
      continue;
    }
    if (name === "target") {
      out.push('target="_blank"');
      continue;
    }
    out.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }
  if (tag.toLowerCase() === "a") {
    if (!out.some((item) => item.startsWith("rel="))) out.push('rel="noreferrer noopener"');
    if (!out.some((item) => item.startsWith("target="))) out.push('target="_blank"');
  }
  return out.length ? ` ${out.join(" ")}` : "";
}

export function sanitizeEmailHtml(raw: string) {
  let html = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "");
  html = html.replace(/<\/?([a-zA-Z0-9:-]+)(\s[^>]*)?>/g, (full, tag: string, attrs = "") => {
    if (full.startsWith("</")) return BLOCKED_TAGS.test(tag) ? "" : `</${tag}>`;
    if (BLOCKED_TAGS.test(tag)) return "";
    return `<${tag}${cleanAttrs(tag, attrs)}>`;
  });
  return html;
}

export function rewriteCidImages(html: string, images: Map<string, string>) {
  function swap(value: string) {
    const key = value.replace(/^cid:/i, "").replace(/^<|>$/g, "").toLowerCase();
    return images.get(key) ?? value;
  }
  return html
    .replace(/\b(src|background)\s*=\s*(["'])cid:([^"']+)\2/gi, (_, attr, quote, cid) => {
      return `${attr}=${quote}${swap(`cid:${cid}`)}${quote}`;
    })
    .replace(/url\(\s*(['"]?)cid:([^)'"]+)\1\s*\)/gi, (_, quote, cid) => {
      return `url(${quote}${swap(`cid:${cid}`)}${quote})`;
    });
}

export function wrapMailDocument(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
html,body{margin:0;padding:0;background:#fffdf7;color:#17301f;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;word-wrap:break-word;}
img{max-width:100%;height:auto;}
table{max-width:100%;}
a{color:#1b4d33;}
</style></head><body>${body}</body></html>`;
}
