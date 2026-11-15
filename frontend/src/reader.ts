// Reads a zone's PDF report inside the page (jopa-testing, round 9).
//
// Opening the PDF in a new tab or the browser's own viewer does not work everywhere: some browsers
// block a new tab, and some (embedded browsers, some in-app views) have no PDF viewer at all. So the
// pages are drawn here with pdf.js (Mozilla's PDF renderer, the one Firefox uses), on canvases.
// This file is loaded only when someone opens a report.
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { t } from "./i18n";
import { el } from "./ui";

GlobalWorkerOptions.workerSrc = workerUrl;

export type ReaderDoc = { title: string; subtitle: string; url: string; fileName: string };

let dialog: HTMLDialogElement | undefined;
let run = 0; // a newer report replaces one still being drawn

export async function openReader(doc: ReaderDoc): Promise<void> {
  const mine = ++run;
  dialog ??= document.body.appendChild(el("dialog", { className: "reader" }));
  const pages = el("div", { className: "reader-pages" });
  const status = el("p", { className: "muted" }, t("reader.loading"));
  status.setAttribute("role", "status");
  const close = el("button", { type: "button", onclick: () => dialog!.close() }, t("dialog.close"));
  const save = el("a", { className: "btn", href: doc.url, download: doc.fileName }, t("report.download"));
  const title = el("h2", { id: "reader-title" }, doc.title);
  dialog.setAttribute("aria-labelledby", title.id);
  dialog.replaceChildren(
    el("div", { className: "reader-head" }, el("div", {}, title, el("p", { className: "muted" }, doc.subtitle)), el("div", { className: "reader-tools" }, save, close)),
    el("div", { className: "reader-body" }, status, pages),
  );
  dialog.onclick = (e) => {
    if (e.target === dialog) dialog!.close(); // a click on the backdrop closes it
  };
  if (!dialog.open) dialog.showModal();
  close.focus();

  try {
    const pdf = await getDocument({ url: doc.url }).promise;
    if (mine !== run) return;
    status.textContent = t("reader.pages", { n: pdf.numPages });
    const width = Math.min(pages.clientWidth || 800, 900);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    // One page at a time, top to bottom, so the first page shows at once.
    for (let i = 1; i <= pdf.numPages; i++) {
      if (mine !== run || !dialog.open) return;
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const view = page.getViewport({ scale: (width / base.width) * ratio });
      const canvas = el("canvas", { className: "reader-page", width: Math.floor(view.width), height: Math.floor(view.height) });
      canvas.style.width = `${width}px`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", t("reader.page", { n: i, total: pdf.numPages }));
      pages.append(canvas);
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport: view }).promise;
    }
  } catch (err) {
    console.error(err);
    if (mine === run) status.textContent = t("reader.failed");
  }
}
