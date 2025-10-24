/* Attach masks after server-rendered / Nunjucks HTML is in DOM */
import { attachMask } from '../utils/inputMask';

export function initInputMasks(root=document) {
  const masked = root.querySelectorAll('input[data-mask]');
  masked.forEach(input => {
    const mask = input.getAttribute('data-mask');
    attachMask(input, mask);
  });
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initInputMasks());
  } else {
    initInputMasks();
  }
}

export default initInputMasks;
