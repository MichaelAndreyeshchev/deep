export interface TranscriptMetadata {
  company?: string;
  interviewee?: string;
  interviewer?: string;
  recordedAt?: Date;
}

export interface TranscriptSegmentInput {
  speaker: string;
  text: string;
  order: number;
}

const SPEAKER_REGEX = /^([A-Za-z][A-Za-z .,'-]{1,40}|[A-Z]{2,}):\s*(.*)$/;

export function parseTranscriptText(text: string): TranscriptSegmentInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const segments: TranscriptSegmentInput[] = [];
  let currentSpeaker = "Narrator";
  let buffer: string[] = [];
  let order = 0;

  const flush = () => {
    if (!buffer.length) return;
    const content = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (!content) {
      buffer = [];
      return;
    }
    segments.push({
      speaker: currentSpeaker,
      text: content,
      order
    });
    order += 1;
    buffer = [];
  };

  lines.forEach((line) => {
    const match = line.match(SPEAKER_REGEX);
    if (match) {
      flush();
      currentSpeaker = match[1].trim();
      const remainder = match[2]?.trim();
      if (remainder) {
        buffer.push(remainder);
      }
      return;
    }

    buffer.push(line);
  });

  flush();

  return segments;
}

