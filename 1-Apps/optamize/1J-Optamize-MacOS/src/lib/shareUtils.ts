import html2canvas from 'html2canvas';
import type { OptaScore } from '@/types/scoring';

/**
 * Share utilities for exporting and sharing Opta score cards.
 */

/**
 * Generate a PNG image from a DOM element.
 * @param element - The DOM element to capture
 * @returns Blob of the PNG image
 */
export async function generateImage(element: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#0a0a0f',
    scale: 2, // Higher quality
    useCORS: true,
    logging: false,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate image blob'));
        }
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Download a blob as a file.
 * @param blob - The blob to download
 * @param filename - The filename for the download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Save score card as PNG image.
 * @param element - The ShareCard DOM element
 * @param score - The OptaScore for filename generation
 */
export async function saveAsImage(
  element: HTMLElement,
  score: OptaScore
): Promise<void> {
  const blob = await generateImage(element);
  const filename = `opta-score-${score.overall}-${Date.now()}.png`;
  downloadBlob(blob, filename);
}

/**
 * Copy score card image to clipboard.
 * @param element - The ShareCard DOM element
 * @returns true if successful, false otherwise
 */
export async function copyToClipboard(element: HTMLElement): Promise<boolean> {
  try {
    const blob = await generateImage(element);

    // Check if ClipboardItem is supported
    if (!navigator.clipboard || !window.ClipboardItem) {
      console.warn('Clipboard API not supported');
      return false;
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ]);

    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Generate share text for the score.
 * @param score - The OptaScore
 * @returns Formatted share text
 */
export function generateShareText(score: OptaScore): string {
  const lines = [
    `🎮 My Opta Score: ${score.overall}/100`,
    ``,
    `⚡ Performance: ${Math.round(score.dimensions.performance.weighted)}`,
    `👁️ Experience: ${Math.round(score.dimensions.experience.weighted)}`,
    `🎯 Competitive: ${Math.round(score.dimensions.competitive.weighted)}`,
    ``,
    `💰 Equivalent to $${score.wowFactors.moneySaved.amount} upgrade!`,
    `📊 Top ${100 - score.wowFactors.percentileRank.similar}% of ${score.wowFactors.percentileRank.tier} builds`,
    ``,
    `Optimize your PC with Opta ✨`,
  ];

  return lines.join('\n');
}

/**
 * Open Twitter/X share intent with score.
 * @param score - The OptaScore
 */
export function shareToTwitter(score: OptaScore): void {
  const text = encodeURIComponent(
    `🎮 My Opta Score: ${score.overall}/100\n\n` +
    `⚡ Performance: ${Math.round(score.dimensions.performance.weighted)}\n` +
    `💰 Saved $${score.wowFactors.moneySaved.amount} equivalent\n` +
    `📊 Top ${100 - score.wowFactors.percentileRank.similar}% of ${score.wowFactors.percentileRank.tier} builds\n\n` +
    `Optimize your PC with Opta ✨`
  );

  const url = `https://twitter.com/intent/tweet?text=${text}`;
  window.open(url, '_blank', 'noopener,noreferrer,width=550,height=420');
}

/**
 * Copy share text to clipboard for Discord/other platforms.
 * @param score - The OptaScore
 * @returns true if successful
 */
export async function copyShareText(score: OptaScore): Promise<boolean> {
  try {
    const text = generateShareText(score);
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy text:', error);
    return false;
  }
}

/**
 * Check if the Clipboard API supports image copying.
 * @returns true if supported
 */
export function supportsImageClipboard(): boolean {
  return !!(navigator.clipboard && window.ClipboardItem);
}
