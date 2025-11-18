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
export declare function parseTranscriptText(text: string): TranscriptSegmentInput[];
