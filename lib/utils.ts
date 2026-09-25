import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge taught the Mesta theme: the DS-005 type scale (text-caption …) is a font size,
 * not a colour, and the control/cell spacing tokens are spacing — otherwise `cn('text-caption',
 * 'text-muted')` would drop the size, and `cn('h-control-md', 'h-10')` would keep both.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['heading', 'section', 'body', 'body-sm', 'label', 'caption', 'numeric-lg', 'numeric-md'],
      spacing: ['control-sm', 'control-md', 'control-lg', 'cell', 'cell-y', 'card'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
