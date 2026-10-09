"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

const MESSAGE_KEY = "__ptHtmlEmbed";

/**
 * Builds the document shown inside the sandboxed frame:
 * - links open in the main window (not inside the frame),
 * - a tiny script reports the content height so the frame grows to fit (no inner scrollbar).
 */
function buildSrcDoc(html: string, id: string) {
  const head = '<base target="_top">';
  const reporter = `<script>(function(){var last=0,n=0,t=Date.now();
function send(force){var h=Math.ceil(document.documentElement.scrollHeight);if(!force&&Math.abs(h-last)<2)return;
if(Date.now()-t<3000){if(++n>60)return;}else{t=Date.now();n=0;}
last=h;parent.postMessage({${MESSAGE_KEY}:${JSON.stringify(id)},h:h},"*");}
addEventListener("message",function(e){if(e.data&&e.data[${JSON.stringify(MESSAGE_KEY + "Ping")}])send(true);});
if(window.ResizeObserver)new ResizeObserver(function(){send(false);}).observe(document.documentElement);
addEventListener("load",function(){send(true);});[0,300,1000,2500].forEach(function(d){setTimeout(function(){send(true);},d);});})();</script>`;

  let doc = html.trim();
  const hasHtmlTag = /<html[\s>]/i.test(doc);
  if (/<head[\s>]/i.test(doc)) {
    doc = doc.replace(/<head([^>]*)>/i, `<head$1>${head}`);
  } else if (hasHtmlTag) {
    doc = doc.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
  } else {
    // A snippet, not a full page: give it a proper document so it renders in standards mode.
    doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}</head><body style="margin:0">${doc}</body></html>`;
  }
  return /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, `${reporter}</body>`) : doc + reporter;
}

/** Custom HTML pasted in the admin. "isolated" runs it in a sandbox; "inline" places it in the page. */
export function HtmlEmbed({ html, mode, width }: { html: string; mode: "isolated" | "inline"; width: "full" | "contained" }) {
  const wrap = width === "contained" ? "mx-auto w-full max-w-6xl px-4" : "w-full";

  if (mode === "inline") {
    // Scripts in inline HTML don't run (browsers ignore <script> inserted this way).
    return <div className={wrap} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <div className={wrap}>
      <IsolatedFrame html={html} />
    </div>
  );
}

function IsolatedFrame({ html }: { html: string }) {
  const id = useId();
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);
  const srcDoc = useMemo(() => buildSrcDoc(html, id), [html, id]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const data = e.data as Record<string, unknown> | null;
      if (data && data[MESSAGE_KEY] === id && typeof data.h === "number") {
        setHeight(Math.min(Math.max(data.h, 50), 30000));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [id]);

  // Ask the frame for its height once it has loaded (its first reports may arrive before we listen).
  const ping = () => ref.current?.contentWindow?.postMessage({ [`${MESSAGE_KEY}Ping`]: true }, "*");

  return (
    <iframe
      ref={ref}
      title="Custom content"
      srcDoc={srcDoc}
      style={{ height }}
      className="block w-full border-0"
      // No "allow-same-origin": pasted code can't read the site's cookies or the admin login.
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-modals allow-downloads"
      loading="lazy"
      onLoad={ping}
    />
  );
}
