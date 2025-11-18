'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Paper, 
  Tabs, 
  Button, 
  Group, 
  Text, 
  Badge, 
  Card, 
  ActionIcon,
  Tooltip,
  Divider,
  Stack,
  Box,
  Anchor,
  Title,
  ScrollArea,
  List,
  ThemeIcon
} from '@mantine/core';
import {
  IconDownload,
  IconFileText,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconQuote,
  IconChartHistogram,
  IconInfoCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Citation {
  id: number;
  url: string;
  title: string;
  detail?: string;
}

type ConfidenceLevel = 'high' | 'medium' | 'low' | null | undefined;

interface Finding {
  text: string;
  source: string;
  section?: string;
  page?: string;
  confidence?: ConfidenceLevel;
  metricLabel?: string | null;
  metricValue?: number | null;
  unit?: string | null;
}

interface ResearchMetadata {
  topic: string;
  completedSteps: number;
  totalSteps: number;
  duration: number;
  sourcesCount: number;
}

interface ResearchReportProps {
  report: string;
  citations: Citation[];
  metadata: ResearchMetadata;
  findings?: Finding[];
}

const confidenceMeta: Record<
  NonNullable<ConfidenceLevel>,
  { label: string; emoji: string; color: string }
> = {
  high: { label: 'High confidence', emoji: '🟢', color: '#22c55e' },
  medium: { label: 'Medium confidence', emoji: '🟡', color: '#facc15' },
  low: { label: 'Low confidence', emoji: '🔴', color: '#fb7185' },
};

const formatMetricValue = (value: number, unit?: string | null) => {
  if (!Number.isFinite(value)) return 'n/a';
  const shortened =
    Math.abs(value) >= 1_000_000_000
      ? `${(value / 1_000_000_000).toFixed(1)}B`
      : Math.abs(value) >= 1_000_000
        ? `${(value / 1_000_000).toFixed(1)}M`
        : Math.abs(value) >= 1_000
          ? `${(value / 1_000).toFixed(1)}K`
          : value.toString();
  return `${shortened}${unit ? ` ${unit}` : ''}`;
};

const VisualizationPanel = ({ findings = [] }: { findings?: Finding[] }) => {
  const metricFindings = findings.filter(
    (finding) =>
      typeof finding.metricValue === 'number' &&
      finding.metricValue !== null &&
      finding.metricLabel,
  );

  const maxMetricValue = metricFindings.reduce(
    (max, finding) =>
      finding.metricValue && finding.metricValue > max
        ? finding.metricValue
        : max,
    0,
  );

  const confidenceTotals = findings.reduce(
    (acc, finding) => {
      if (
        finding.confidence &&
        confidenceMeta[finding.confidence as NonNullable<ConfidenceLevel>]
      ) {
        acc[finding.confidence] += 1;
      }
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );

  const totalConfidence =
    confidenceTotals.high + confidenceTotals.medium + confidenceTotals.low;

  const hasConfidenceData = totalConfidence > 0;
  const hasMetricData = metricFindings.length > 0 && maxMetricValue > 0;

  if (!hasConfidenceData && !hasMetricData) {
    return (
      <Text size="sm" c="dimmed">
        Visualizations will appear here when numeric or confidence-coded
        findings are available.
      </Text>
    );
  }

  return (
    <Stack gap="lg">
      {hasConfidenceData && (
        <div>
          <Group justify="space-between" mb="xs">
            <Text fw={600} size="sm">
              Confidence Mix
            </Text>
            <Text size="xs" c="dimmed">
              Based on {totalConfidence} cited findings
            </Text>
          </Group>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(confidenceTotals) as Array<
              keyof typeof confidenceTotals
            >).map((key) => {
              const count = confidenceTotals[key];
              const pct = totalConfidence
                ? Math.round((count / totalConfidence) * 100)
                : 0;
              const meta = confidenceMeta[key];
              return (
                <div
                  key={key}
                  className="rounded-lg border border-[var(--color-scrollbar)]/60 bg-[var(--color-chat-bar)]/60 p-3 text-center shadow-sm"
                >
                  <div className="text-lg">{meta.emoji}</div>
                  <Text size="xs" fw={600} c="dimmed">
                    {meta.label}
                  </Text>
                  <Text fw={700} size="lg" c="var(--color-text)">
                    {pct}%
                  </Text>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasMetricData && (
        <div>
          <Group justify="space-between" mb="xs">
            <Text fw={600} size="sm">
              Metric Highlights
            </Text>
            <Text size="xs" c="dimmed">
              Normalized to the largest reported figure
            </Text>
          </Group>
          <Stack gap="sm">
            {metricFindings.slice(0, 6).map((finding, idx) => {
              const widthPercent = finding.metricValue
                ? Math.min((finding.metricValue / maxMetricValue) * 100, 100)
                : 0;
              return (
                <div key={`${finding.metricLabel}-${idx}`}>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{finding.metricLabel}</span>
                    <span>
                      {finding.metricValue
                        ? formatMetricValue(
                            finding.metricValue,
                            finding.unit,
                          )
                        : 'n/a'}
                    </span>
                  </div>
                  <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-[var(--color-scrollbar)]/40">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] via-[#c026d3] to-[#fbbf24] shadow-[0_0_10px_rgba(124,58,237,0.5)] transition-[width] duration-500"
                      style={{ width: `${widthPercent || 5}%` }}
                    />
                  </div>
                  {(finding.section || finding.page) && (
                    <Text size="xs" c="dimmed" mt={4}>
                      {(finding.section && `Section: ${finding.section}`) || ''}
                      {finding.section && finding.page ? ' · ' : ''}
                      {finding.page && `p. ${finding.page}`}
                    </Text>
                  )}
                </div>
              );
            })}
          </Stack>
        </div>
      )}
    </Stack>
  );
};

export function ResearchReportMantine({
  report,
  citations,
  metadata,
  findings = [],
}: ResearchReportProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('report');
  const hasVisualizationData = useMemo(() => {
    const confidenceAvailable = findings.some(
      (finding) =>
        finding.confidence &&
        confidenceMeta[finding.confidence as NonNullable<ConfidenceLevel>],
    );
    const metricsAvailable = findings.some(
      (finding) =>
        typeof finding.metricValue === 'number' &&
        finding.metricValue !== null &&
        finding.metricLabel,
    );
    return confidenceAvailable || metricsAvailable;
  }, [findings]);

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    notifications.show({
      title: 'Copied!',
      message: 'Report copied to clipboard',
      color: 'green',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const pdf = new jsPDF();
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let y = margin;

      const addText = (text: string, fontSize: number = 11, isBold: boolean = false, color: number[] = [0, 0, 0]) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
        pdf.setTextColor(color[0], color[1], color[2]);
        
        const lines = pdf.splitTextToSize(text, maxWidth);
        
        for (const line of lines) {
          if (y > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(line, margin, y);
          y += fontSize * 0.5;
        }
        y += 5;
        pdf.setTextColor(0, 0, 0);
      };

      // Title
      addText(`Research Report: ${metadata.topic}`, 16, true, [124, 58, 237]);
      y += 5;

      // Metadata box
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, y);
      y += 5;
      pdf.text(`Sources: ${metadata.sourcesCount} | Duration: ${Math.round(metadata.duration / 1000)}s | Steps: ${metadata.completedSteps}/${metadata.totalSteps}`, margin, y);
      y += 10;
      pdf.setTextColor(0);

      // Report content - preserve structure
      const reportLines = report.split('\n');
      for (const line of reportLines) {
        if (line.startsWith('# ')) {
          y += 5;
          addText(line.replace(/^#\s/, ''), 16, true);
        } else if (line.startsWith('## ')) {
          y += 3;
          addText(line.replace(/^##\s/, ''), 14, true);
        } else if (line.startsWith('### ')) {
          y += 2;
          addText(line.replace(/^###\s/, ''), 12, true);
        } else if (line.trim()) {
          // Remove markdown formatting but keep citations
          const cleanLine = line
            .replace(/\*\*/g, '')
            .replace(/\*/g, '');
          addText(cleanLine, 10);
        } else {
          y += 3; // Add spacing for empty lines
        }
      }

      // References section
      if (y > pageHeight - 100) {
        pdf.addPage();
        y = margin;
      }

      y += 10;
      pdf.setDrawColor(124, 58, 237);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;
      
      addText('References & Citations', 14, true, [124, 58, 237]);
      y += 5;
      
      citations.forEach((citation) => {
        if (y > pageHeight - 30) {
          pdf.addPage();
          y = margin;
        }
        
        // Citation number
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(124, 58, 237);
        pdf.text(`[${citation.id}]`, margin, y);
        
        // Citation title and URL
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0);
        const titleLines = pdf.splitTextToSize(
          citation.detail
            ? `${citation.title} (${citation.detail})`
            : citation.title,
          maxWidth - 15,
        );
        pdf.text(titleLines, margin + 15, y);
        y += titleLines.length * 5;
        
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        const urlLines = pdf.splitTextToSize(citation.url, maxWidth - 15);
        pdf.text(urlLines, margin + 15, y);
        y += urlLines.length * 4 + 5;
        
        pdf.setTextColor(0);
      });

      pdf.save(`research-report-${metadata.topic.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      
      notifications.show({
        title: 'Success!',
        message: 'PDF downloaded successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to generate PDF',
        color: 'red',
      });
    }
  };

  const handleExportMarkdown = () => {
    // Ensure the report includes the References section
    let fullReport = report;
    
    // Check if report already has a References section
    if (!report.includes('## References') && !report.includes('## 9. References')) {
      fullReport += '\n\n---\n\n## References\n\n';
      citations.forEach((citation) => {
        const detailText = citation.detail ? ` (${citation.detail})` : '';
        fullReport += `[${citation.id}] ${citation.title}${detailText}\n${citation.url}\n\n`;
      });
    }
    
    // Add metadata header
    const header = `---
title: "Research Report: ${metadata.topic}"
generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
sources: ${metadata.sourcesCount}
duration: ${Math.round(metadata.duration / 1000)}s
steps: ${metadata.completedSteps}/${metadata.totalSteps}
---

`;
    
    const fullMarkdown = header + fullReport;
    
    const blob = new Blob([fullMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-report-${metadata.topic.replace(/\s+/g, '-').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    notifications.show({
      title: 'Success!',
      message: 'Markdown file downloaded',
      color: 'green',
    });
  };

  const handleExportTxt = () => {
    // Convert markdown to plain text
    const plainText = report
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italics
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Convert links to text
    
    const blob = new Blob([plainText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-report-${metadata.topic.replace(/\s+/g, '-').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    notifications.show({
      title: 'Success!',
      message: 'Text file downloaded',
      color: 'green',
    });
  };

  const handleExportDocx = async () => {
    try {
      const docx = await import('docx');
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink } = docx;

      // Parse the markdown report into document sections
      const lines = report.split('\n');
      const documentChildren: any[] = [];

      for (const line of lines) {
        if (line.startsWith('# ')) {
          documentChildren.push(
            new Paragraph({
              text: line.replace(/^#\s/, ''),
              heading: HeadingLevel.HEADING_1,
            })
          );
        } else if (line.startsWith('## ')) {
          documentChildren.push(
            new Paragraph({
              text: line.replace(/^##\s/, ''),
              heading: HeadingLevel.HEADING_2,
            })
          );
        } else if (line.startsWith('### ')) {
          documentChildren.push(
            new Paragraph({
              text: line.replace(/^###\s/, ''),
              heading: HeadingLevel.HEADING_3,
            })
          );
        } else if (line.trim()) {
          // Process inline citations and links
          const textRuns: any[] = [];
          const parts = line.split(/(\(Source:[^)]+\)|\[https?:\/\/[^\]]+\])/g);
          
          for (const part of parts) {
            if (part.match(/\(Source:[^)]+\)/)) {
              textRuns.push(new TextRun({ text: part, italics: true, color: '0000FF' }));
            } else if (part.trim()) {
              textRuns.push(new TextRun({ text: part }));
            }
          }

          documentChildren.push(
            new Paragraph({
              children: textRuns.length > 0 ? textRuns : [new TextRun(line)],
            })
          );
        }
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: documentChildren,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research-report-${metadata.topic.replace(/\s+/g, '-').toLowerCase()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notifications.show({
        title: 'Success!',
        message: 'Word document downloaded',
        color: 'green',
      });
    } catch (error) {
      console.error('Error generating DOCX:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to generate Word document',
        color: 'red',
      });
    }
  };

  // Create citation lookup map
  const citationMap = new Map(citations.map(c => [c.id, c]));

  // Process report to make citations clickable
  const renderReportWithCitations = () => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children, node, ...props }) => {
            const processChildren = (child: any): any => {
              if (typeof child === 'string') {
                const parts = child.split(/(\[\d+\])/g);
                return parts.map((part, idx) => {
                  const match = part.match(/^\[(\d+)\]$/);
                  if (match) {
                    const citationId = parseInt(match[1]);
                    const citation = citationMap.get(citationId);
                    if (citation) {
                      return (
                        <Tooltip
                          key={idx}
                          label={
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                [{citationId}] {citation.title}
                              </div>
                              {citation.detail && (
                                <div
                                  style={{
                                    fontSize: '0.8em',
                                    marginBottom: 4,
                                    opacity: 0.85,
                                  }}
                                >
                                  {citation.detail}
                                </div>
                              )}
                              <div style={{ fontSize: '0.85em', opacity: 0.9 }}>
                                {citation.url}
                              </div>
                              <div style={{ fontSize: '0.75em', marginTop: 4, opacity: 0.7 }}>
                                Click to open source
                              </div>
                            </div>
                          }
                          multiline
                          w={350}
                          styles={{ tooltip: { padding: '12px' } }}
                        >
                          <Anchor
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="research-report-citation"
                            c="violet"
                            fw={600}
                            mx={2}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'baseline',
                              textDecoration: 'none',
                              borderBottom: '2px solid rgba(171, 130, 255, 0.3)',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e: any) => {
                              e.currentTarget.style.backgroundColor = 'rgba(171, 130, 255, 0.1)';
                              e.currentTarget.style.borderBottomColor = 'rgba(171, 130, 255, 0.8)';
                            }}
                            onMouseLeave={(e: any) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.borderBottomColor = 'rgba(171, 130, 255, 0.3)';
                            }}
                          >
                            [{citationId}]
                          </Anchor>
                        </Tooltip>
                      );
                    }
                  }
                  return part;
                });
              }
              return child;
            };

            const processedChildren = Array.isArray(children)
              ? children.map(processChildren)
              : processChildren(children);

            return <Text component="p" mb="md">{processedChildren}</Text>;
          },
          h1: ({ children, node, ...props }) => (
            <Title order={1} mt="xl" mb="md" c="var(--color-text)">
              {children}
            </Title>
          ),
          h2: ({ children, node, ...props }) => (
            <Title order={2} mt="lg" mb="sm" c="var(--color-text)">
              {children}
            </Title>
          ),
          h3: ({ children, node, ...props }) => (
            <Title order={3} mt="md" mb="xs" c="var(--color-text)">
              {children}
            </Title>
          ),
          ul: ({ children, node, ...props }) => (
            <List mb="md">{children}</List>
          ),
          code: ({ inline, node, children, ...props }: any) =>
            inline ? (
              <code style={{ 
                backgroundColor: 'var(--color-code-bg)', 
                padding: '2px 6px', 
                borderRadius: '4px',
                fontSize: '0.9em'
              }}>
                {children}
              </code>
            ) : (
              <pre style={{ 
                backgroundColor: '#1f182a', 
                padding: '16px', 
                borderRadius: '8px',
                overflowX: 'auto',
                marginBottom: '16px'
              }}>
                <code>{children}</code>
              </pre>
            ),
        }}
      >
        {report}
      </ReactMarkdown>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ width: '100%', marginTop: 16, marginBottom: 16 }}
    >
      <Paper shadow="sm" radius="md" withBorder style={{ overflow: 'hidden' }}>
        {/* Header */}
        <Box p="md" style={{ backgroundColor: 'var(--color-nav)' }}>
          <Group justify="space-between" mb="xs">
            <Group>
              <ThemeIcon size="lg" variant="light" color="violet">
                <IconFileText size={20} />
              </ThemeIcon>
              <Title order={4} c="var(--color-text)">Research Report</Title>
            </Group>
            <Group gap="xs">
              <Tooltip label={copied ? "Copied!" : "Copy Markdown"}>
                <ActionIcon
                  variant="default"
                  onClick={handleCopyMarkdown}
                  size="lg"
                  color={copied ? "green" : undefined}
                >
                  {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Download Markdown">
                <Button
                  leftSection={<IconDownload size={16} />}
                  onClick={handleExportMarkdown}
                  size="sm"
                  variant="light"
                  color="violet"
                >
                  MD
                </Button>
              </Tooltip>
              <Tooltip label="Download Text">
                <Button
                  leftSection={<IconDownload size={16} />}
                  onClick={handleExportTxt}
                  size="sm"
                  variant="light"
                  color="cyan"
                >
                  TXT
                </Button>
              </Tooltip>
              <Tooltip label="Download Word">
                <Button
                  leftSection={<IconDownload size={16} />}
                  onClick={handleExportDocx}
                  size="sm"
                  variant="light"
                  color="grape"
                >
                  DOCX
                </Button>
              </Tooltip>
              <Tooltip label="Export PDF">
                <Button
                  leftSection={<IconDownload size={16} />}
                  onClick={handleExportPDF}
                  size="sm"
                  variant="light"
                  color="pink"
                >
                  PDF
                </Button>
              </Tooltip>
            </Group>
          </Group>

          {/* Metadata badges */}
          <Group gap="sm">
            <Badge variant="light" color="violet">
              {metadata.sourcesCount} sources
            </Badge>
            <Badge variant="light" color="cyan">
              {Math.round(metadata.duration / 1000)}s duration
            </Badge>
            <Badge variant="light" color="grape">
              {metadata.completedSteps}/{metadata.totalSteps} steps
            </Badge>
          </Group>
        </Box>

        <Divider />

        {/* Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="report" leftSection={<IconFileText size={16} />}>
              Report
            </Tabs.Tab>
            {findings && findings.length > 0 && (
              <Tabs.Tab value="findings" leftSection={<IconQuote size={16} />}>
                Findings ({findings.length})
              </Tabs.Tab>
            )}
            {hasVisualizationData && (
              <Tabs.Tab
                value="visuals"
                leftSection={<IconChartHistogram size={16} />}
              >
                Visuals
              </Tabs.Tab>
            )}
            <Tabs.Tab value="citations" leftSection={<IconExternalLink size={16} />}>
              References ({citations.length})
            </Tabs.Tab>
          </Tabs.List>

          {/* Report Tab */}
          <Tabs.Panel value="report" pt="md">
            <ScrollArea h={600} px="lg" pb="md">
              {renderReportWithCitations()}
            </ScrollArea>
          </Tabs.Panel>

          {/* Findings Tab - Shows mapping of findings to sources */}
          {findings && findings.length > 0 && (
            <Tabs.Panel value="findings" pt="md">
              <ScrollArea h={600} px="lg" pb="md">
                <Stack gap="md">
                  {findings.map((finding, idx) => {
                    const citation = citations.find(c => c.url === finding.source);
                    const confidence =
                      finding.confidence &&
                      confidenceMeta[
                        finding.confidence as NonNullable<ConfidenceLevel>
                      ]
                        ? confidenceMeta[
                            finding.confidence as NonNullable<ConfidenceLevel>
                          ]
                        : null;
                    return (
                      <Card
                        key={idx}
                        shadow="xs"
                        padding="md"
                        radius="md"
                        withBorder
                        className="research-report-findings"
                      >
                        <Stack gap="sm">
                          <Group justify="space-between" align="center">
                            <Group gap="xs">
                              <Badge size="lg" variant="light" color="violet">
                                Finding #{idx + 1}
                              </Badge>
                              {finding.section && (
                                <Badge variant="outline" size="sm" color="grape">
                                  {finding.section}
                                  {finding.page ? ` · p.${finding.page}` : ''}
                                </Badge>
                              )}
                            </Group>
                            {citation && (
                              <Badge size="sm" variant="outline" color="cyan">
                                Citation [{citation.id}]
                              </Badge>
                            )}
                          </Group>
                          <Text size="sm" c="var(--color-text-s)">
                            {finding.text}
                          </Text>
                          {confidence && (
                            <Group gap="xs">
                              <Badge
                                leftSection={confidence.emoji}
                                size="sm"
                                variant="light"
                                color="green"
                              >
                                {confidence.label}
                              </Badge>
                            </Group>
                          )}
                          {typeof finding.metricValue === 'number' &&
                            finding.metricValue !== null &&
                            finding.metricLabel && (
                              <Group justify="space-between" align="center">
                                <Text size="xs" c="dimmed">
                                  {finding.metricLabel}
                                </Text>
                                <Text size="xs" fw={600}>
                                  {formatMetricValue(
                                    finding.metricValue,
                                    finding.unit,
                                  )}
                                </Text>
                              </Group>
                            )}
                          <Divider />
                          <Group gap="xs">
                            <Text size="xs" c="dimmed" fw={500}>
                              Source:
                            </Text>
                            <Anchor
                              href={finding.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="xs"
                              c="violet"
                              className="research-report-finding-source"
                            >
                              {new URL(finding.source).hostname}
                            </Anchor>
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              component="a"
                              href={finding.source}
                              target="_blank"
                            >
                              <IconExternalLink size={12} />
                            </ActionIcon>
                          </Group>
                        </Stack>
                      </Card>
                    );
                  })}
                </Stack>
              </ScrollArea>
            </Tabs.Panel>
          )}

          {/* Citations Tab */}
          <Tabs.Panel value="citations" pt="md">
            <ScrollArea h={600} px="lg" pb="md">
              <Stack gap="sm">
                {citations.map((citation) => (
                  <Card
                    key={citation.id}
                    shadow="xs"
                    padding="md"
                    radius="md"
                    withBorder
                    style={{ 
                      backgroundColor: 'var(--color-chat-bar)',
                      borderColor: 'var(--color-scrollbar)'
                    }}
                  >
                    <Group wrap="nowrap" align="flex-start">
                      <ThemeIcon size="xl" radius="xl" variant="light" color="violet">
                        <Text fw={700}>{citation.id}</Text>
                      </ThemeIcon>
                      <Box flex={1}>
                        <Text fw={600} size="sm" mb={4} c="var(--color-text-s)">
                          {citation.title}
                        </Text>
                      {citation.detail && (
                        <Group gap="xs" mb={6}>
                          <IconInfoCircle size={14} color="#a855f7" />
                          <Text size="xs" c="dimmed">
                            {citation.detail}
                          </Text>
                        </Group>
                      )}
                        <Group gap="xs">
                          <Anchor
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="xs"
                            c="violet"
                            style={{ wordBreak: 'break-all' }}
                          >
                            {citation.url}
                          </Anchor>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            component="a"
                            href={citation.url}
                            target="_blank"
                          >
                            <IconExternalLink size={14} />
                          </ActionIcon>
                        </Group>
                      </Box>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
          </Tabs.Panel>

          {hasVisualizationData && (
            <Tabs.Panel value="visuals" pt="md">
              <ScrollArea h={600} px="lg" pb="md">
                <VisualizationPanel findings={findings} />
              </ScrollArea>
            </Tabs.Panel>
          )}
        </Tabs>
      </Paper>
    </motion.div>
  );
}

