import pdfParse from "pdf-parse";

import type { PageSlice } from "./chunking";

type PagerenderPage = {
  pageIndex: number;
  getTextContent: () => Promise<{
    items: Array<{ str?: string }>;
  }>;
};

export async function extractPdfPages(buffer: Buffer): Promise<PageSlice[]> {
  const pages: PageSlice[] = [];
  await pdfParse(buffer, {
    pagerender: async (pageData: PagerenderPage) => {
      const textContent = await pageData.getTextContent();
      const text = textContent.items
        .map((item) => item.str ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      pages.push({
        pageNumber: pageData.pageIndex + 1,
        text
      });

      return text;
    }
  });

  return pages;
}

