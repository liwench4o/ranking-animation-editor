export const BANNER_TEXT_MAX_WIDTH = 360;
export const BANNER_LINE_HEIGHT = 18;
// Air between stacked captions; they are bare text blocks, so a small gap reads
// as one quiet column instead of scattered notes.
export const BANNER_GAP = 6;
export const BANNER_TEXT_BASELINE_OFFSET = 12;
// Cap runaway captions so stacked banners can't swallow the chart.
export const BANNER_MAX_LINES = 4;
// Distance from the chart's bottom edge to the lowest banner, chosen so the
// banner stack sits just above the 78px period ticker band instead of inside it.
export const BANNER_STACK_BOTTOM = 110;

export interface TextBlockLayout {
  lines: string[];
  textWidth: number;
  textHeight: number;
}

export function wrapTextLines(
  text: string,
  measureText: (text: string) => number,
  maxWidth: number = BANNER_TEXT_MAX_WIDTH,
  maxLines?: number,
): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return [];
  }

  const lines: string[] = [];
  let current = '';

  for (const token of normalized.split(' ')) {
    for (const part of splitOversizedToken(token, measureText, maxWidth)) {
      const candidate = current ? `${current} ${part}` : part;

      if (!current || measureText(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }

      lines.push(current);
      current = part;
    }
  }

  if (current) {
    lines.push(current);
  }

  if (maxLines !== undefined && maxLines > 0 && lines.length > maxLines) {
    return truncateWithEllipsis(lines.slice(0, maxLines), measureText, maxWidth);
  }

  return lines;
}

export function layoutTextBlock(
  text: string,
  measureText: (text: string) => number,
  maxWidth: number = BANNER_TEXT_MAX_WIDTH,
  maxLines?: number,
): TextBlockLayout {
  const lines = wrapTextLines(text, measureText, maxWidth, maxLines);
  const textWidth = lines.reduce((width, line) => Math.max(width, measureText(line)), 0);
  const textHeight = lines.length * BANNER_LINE_HEIGHT;

  return { lines, textWidth, textHeight };
}

function truncateWithEllipsis(
  lines: string[],
  measureText: (text: string) => number,
  maxWidth: number,
): string[] {
  let last = lines[lines.length - 1];

  while (last && measureText(`${last}…`) > maxWidth) {
    last = last.slice(0, -1).trimEnd();
  }

  lines[lines.length - 1] = `${last}…`;

  return lines;
}

function splitOversizedToken(
  token: string,
  measureText: (text: string) => number,
  maxWidth: number,
): string[] {
  if (measureText(token) <= maxWidth) {
    return [token];
  }

  const parts: string[] = [];
  let current = '';

  for (const character of Array.from(token)) {
    const candidate = `${current}${character}`;

    if (current && measureText(candidate) > maxWidth) {
      parts.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}
