// Reads a zone's PDF report inside the page (jopa-testing, rounds 9-10).
//
// Opening the PDF in a new tab or the browser's own viewer does not work everywhere: some browsers
// block a new tab, and some (embedded browsers, some in-app views) have no PDF viewer at all. So the
// pages are drawn here with pdf.js (Mozilla's PDF renderer, the one Firefox uses), on canvases.
// This file is loaded only when someone opens a report.
//
// Memory: a page drawn at screen sharpness takes several MB, so only the pages near the view are
// drawn; pages far away are cleared again, and the document is released when the reader closes.
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { t } from "./i18n";
import { el } from "./ui";

GlobalWorkerOptions.workerSrc = workerUrl;

export type ReaderDoc = { title: string; subtitle: string; url: string; fileName: string };

let dialog: HTMLDialogElement | undefined;
let current: { pdf?: PDFDocumentProxy; stop?: () => void } | undefined;
let run = 0; // a newer report replaces one still being opened

// Stop drawing and give the document's memory back.
function release() {
  if (!current) return;
  current.stop?.();
  current.pdf?.destroy();
  current = undefined;
}

export async function openReader(doc: ReaderDoc): Promise<void> {
  const mine = ++run;
  release();
  // This opening's own state: `current` is cleared when the reader closes, possibly mid-load.
  const state: NonNullable<typeof current> = {};
  current = state;
  dialog ??= document.body.appendChild(el("dialog", { className: "reader" }));
  dialog.onclose = release;
  const pages = el("div", { className: "reader-pages" });
  const status = el("p", { className: "muted" }, t("reader.loading"));
  status.setAttribute("role", "status");
  const close = el("button", { type: "button", onclick: () => dialog!.close() }, t("dialog.close"));
  const save = el("a", { className: "btn", href: doc.url, download: doc.fileName }, t("report.download"));
  const title = el("h2", { id: "reader-title" }, doc.title);
  dialog.setAttribute("aria-labelledby", title.id);
  const body = el("div", { className: "reader-body" }, status, pages);
  dialog.replaceChildren(
    el("div", { className: "reader-head" }, el("div", {}, title, el("p", { className: "muted" }, doc.subtitle)), el("div", { className: "reader-tools" }, save, close)),
    body,
  );
  dialog.onclick = (e) => {
    if (e.target === dialog) dialog!.close(); // a click on the backdrop closes it
  };
  if (!dialog.open) dialog.showModal();
  close.focus();

  try {
    const pdf = await getDocument({ url: doc.url }).promise;
    if (mine !== run || current !== state) {
      pdf.destroy(); // closed or replaced while loading
      return;
    }
    state.pdf = pdf;
    status.textContent = t("reader.pages", { n: pdf.numPages });
    const width = Math.min(pages.clientWidth || 800, 900);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    // Every page gets its place at once (right size, empty), so scrolling and the scroll bar work.
    const first = await pdf.getPage(1);
    const base = first.getViewport({ scale: 1 });
    const height = Math.round((width * base.height) / base.width);
    const drawn = new Map<HTMLCanvasElement, Promise<void>>();
    const slots = Array.from({ length: pdf.numPages }, (_, i) => {
      const canvas = el("canvas", { className: "reader-page", width: 0, height: 0 }); // no pixels until drawn
      canvas.dataset.page = String(i + 1);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", t("reader.page", { n: i + 1, total: pdf.numPages }));
      return canvas;
    });
    pages.replaceChildren(...slots);

    const draw = (canvas: HTMLCanvasElement) => {
      if (drawn.has(canvas)) return;
      const job = (async () => {
        const page = await pdf.getPage(Number(canvas.dataset.page));
        const view = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * ratio });
        canvas.width = Math.floor(view.width);
        canvas.height = Math.floor(view.height);
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport: view }).promise;
        page.cleanup();
      })().catch(() => {
        drawn.delete(canvas); // the reader was closed meanwhile, or the page failed: try again later
      });
      drawn.set(canvas, job);
    };
    const clear = (canvas: HTMLCanvasElement) => {
      if (!drawn.has(canvas)) return;
      drawn.delete(canvas);
      canvas.width = canvas.height = 0; // gives the pixels back; the slot keeps its size
    };
    // Draw pages within one screen of the view; clear those more than four screens away. Worked
    // out from positions on scroll (not IntersectionObserver, which waits for the screen to repaint
    // and so does nothing in a background tab).
    const update = () => {
      const top = body.scrollTop, h = body.clientHeight || window.innerHeight;
      for (const c of slots) {
        const y = c.offsetTop - pages.offsetTop, bottom = y + c.offsetHeight;
        if (bottom > top - h && y < top + 2 * h) draw(c);
        else if (bottom < top - 4 * h || y > top + 5 * h) clear(c);
      }
    };
    let timer = 0;
    const onScroll = () => {
      if (!timer) timer = window.setTimeout(() => ((timer = 0), update()), 80);
    };
    if (current !== state) return;
    body.addEventListener("scroll", onScroll, { passive: true });
    state.stop = () => {
      body.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
    update();
  } catch (err) {
    console.error(err);
    if (mine === run) status.textContent = t("reader.failed");
  }
}
