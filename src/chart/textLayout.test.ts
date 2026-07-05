import {
  BANNER_LINE_HEIGHT,
  BANNER_PADDING_X,
  BANNER_PADDING_Y,
  BANNER_TEXT_MAX_WIDTH,
  layoutTextBlock,
  wrapTextLines,
} from './textLayout';

const measureText = (text: string) => text.length * 10;

describe('wrapTextLines', () => {
  it('keeps short captions on one line', () => {
    expect(wrapTextLines('Alpha rises soon', measureText, 360)).toEqual(['Alpha rises soon']);
  });

  it('wraps long English captions by word', () => {
    expect(wrapTextLines('Alpha rises while Beta slows across the market', measureText, 180)).toEqual([
      'Alpha rises while',
      'Beta slows across',
      'the market',
    ]);
  });

  it('wraps Chinese captions without relying on spaces', () => {
    const lines = wrapTextLines('阿尔法在关键节点之前持续上升并最终超过贝塔', measureText, 100);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('阿尔法在关键节点之前持续上升并最终超过贝塔');
    expect(lines.every((line) => measureText(line) <= 100)).toBe(true);
  });

  it('splits a single oversized token so no line exceeds the max width', () => {
    const lines = wrapTextLines('Supercalifragilisticexpialidocious', measureText, 80);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('Supercalifragilisticexpialidocious');
    expect(lines.every((line) => measureText(line) <= 80)).toBe(true);
  });
});

describe('layoutTextBlock', () => {
  it('reports wrapped dimensions for banner backgrounds', () => {
    const layout = layoutTextBlock(
      'Alpha rises while Beta slows across the market',
      measureText,
      BANNER_TEXT_MAX_WIDTH,
    );

    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.textWidth).toBeLessThanOrEqual(BANNER_TEXT_MAX_WIDTH);
    expect(layout.boxWidth).toBeLessThanOrEqual(BANNER_TEXT_MAX_WIDTH + BANNER_PADDING_X * 2);
    expect(layout.boxHeight).toBe(layout.lines.length * BANNER_LINE_HEIGHT + BANNER_PADDING_Y * 2);
  });
});
