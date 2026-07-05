export const BANNER_TEXT_MAX_WIDTH = 360;
export const BANNER_LINE_HEIGHT = 18;
export const BANNER_PADDING_X = 12;
export const BANNER_PADDING_Y = 8;
export const BANNER_GAP = 12;
export const BANNER_TEXT_BASELINE_OFFSET = 12;

export interface TextBlockLayout {
  lines: string[];
  textWidth: number;
  textHeight: number;
  boxWidth: number;
  boxHeight: number;
}

export function wrapTextLines(
  text: string,
  measureText: (text: string) => number,
  maxWidth: number = BANNER_TEXT_MAX_WIDTH,
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

  return lines;
}

export function layoutTextBlock(
  text: string,
  measureText: (text: string) => number,
  maxWidth: number = BANNER_TEXT_MAX_WIDTH,
): TextBlockLayout {
  const lines = wrapTextLines(text, measureText, maxWidth);
  const textWidth = lines.reduce((width, line) => Math.max(width, measureText(line)), 0);
  const textHeight = lines.length * BANNER_LINE_HEIGHT;

  return {
    lines,
    textWidth,
    textHeight,
    boxWidth: textWidth + BANNER_PADDING_X * 2,
    boxHeight: textHeight + BANNER_PADDING_Y * 2,
  };
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
