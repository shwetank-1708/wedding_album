/** Choose the higher-contrast label colour for an opaque six-digit accent. */
export function galleryActionText(background: string): string {
  const hex = background.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
}
