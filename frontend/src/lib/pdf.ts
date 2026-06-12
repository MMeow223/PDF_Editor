import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDocument = pdfjsLib.PDFDocumentProxy
export type PdfPage = pdfjsLib.PDFPageProxy

export function loadPdf(data: ArrayBuffer): Promise<PdfDocument> {
  // pdf.js transfers the buffer to its worker — hand it a copy
  return pdfjsLib.getDocument({ data: data.slice(0) }).promise
}
