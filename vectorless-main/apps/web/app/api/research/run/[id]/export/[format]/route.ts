import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { prisma } from "@vectorless/db";

interface RouteParams {
  params: { id: string; format: string };
}

function buildMarkdown(run: {
  title: string;
  reportSections: { sectionType: string; content: Record<string, unknown> }[];
}) {
  const header = `# ${run.title}\n`;
  const sections = run.reportSections
    .map((section) => {
      const markdownBody =
        (section.content?.markdown as string | undefined) ??
        "_No content yet_";
      const title = section.sectionType.replace(/_/g, " ");
      return `## ${title}\n\n${markdownBody}`;
    })
    .join("\n\n");
  return `${header}\n${sections}`.trim();
}

async function buildPdf(markdown: string) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const margin = 40;

  const lines = wrapText(markdown);
  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  let cursor = height - margin;

  lines.forEach((line) => {
    if (cursor <= margin) {
      page = pdfDoc.addPage();
      ({ width, height } = page.getSize());
      cursor = height - margin;
    }

    page.drawText(line, {
      x: margin,
      y: cursor,
      size: fontSize,
      font,
      color: undefined,
      maxWidth: width - margin * 2
    });
    cursor -= fontSize + 4;
  });

  return pdfDoc.save();
}

function wrapText(text: string, maxChars = 90) {
  const lines: string[] = [];
  text.split("\n").forEach((line) => {
    if (line.length <= maxChars) {
      lines.push(line);
      return;
    }
    let remaining = line;
    while (remaining.length > maxChars) {
      let sliceIndex = remaining.lastIndexOf(" ", maxChars);
      if (sliceIndex <= 0) sliceIndex = maxChars;
      lines.push(remaining.slice(0, sliceIndex));
      remaining = remaining.slice(sliceIndex).trim();
    }
    if (remaining.length) {
      lines.push(remaining);
    }
  });
  return lines;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const run = await prisma.researchRun.findUnique({
    where: { id: params.id },
    include: {
      reportSections: {
        orderBy: { position: "asc" }
      }
    }
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (!run.reportSections.length) {
    return NextResponse.json(
      { error: "No report sections to export" },
      { status: 400 }
    );
  }

  const markdown = buildMarkdown(run);
  const filename = slugify(run.title || "report") || "report";

  if (params.format === "markdown") {
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${filename}.md"`
      }
    });
  }

  if (params.format === "pdf") {
    const pdfBytes = await buildPdf(markdown);
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`
      }
    });
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}

