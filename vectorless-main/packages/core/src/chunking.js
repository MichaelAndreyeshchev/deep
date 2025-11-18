const defaultOptions = {
    maxCharsPerChunk: 1200,
    overlapRatio: 0.1,
    minChunkChars: 250
};
export function chunkPages(pages, options = {}) {
    const settings = { ...defaultOptions, ...options };
    const results = [];
    let buffer = "";
    let bufferPage;
    let bufferHeading;
    let order = 0;
    const overlapChars = Math.floor(settings.maxCharsPerChunk * settings.overlapRatio);
    const flushBuffer = () => {
        const trimmed = buffer.trim();
        if (!trimmed || trimmed.length < settings.minChunkChars) {
            buffer = "";
            return;
        }
        results.push({
            order,
            pageNumber: bufferPage,
            heading: bufferHeading,
            text: trimmed
        });
        order += 1;
        buffer = trimmed.slice(-overlapChars);
    };
    pages.forEach((page) => {
        const segments = page.text
            .split(/\n{2,}/)
            .map((segment) => segment.trim())
            .filter(Boolean);
        segments.forEach((segment) => {
            const prospectiveLength = buffer.length + segment.length + 1;
            if (prospectiveLength > settings.maxCharsPerChunk) {
                flushBuffer();
                buffer = "";
            }
            if (!buffer) {
                bufferPage = page.pageNumber;
                bufferHeading = page.heading;
            }
            buffer = [buffer, segment].filter(Boolean).join("\n\n");
        });
    });
    if (buffer.length) {
        flushBuffer();
    }
    return results;
}
