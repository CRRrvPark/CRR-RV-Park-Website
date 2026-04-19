/**
 * Spinner — loading indicator. Delegates to the design-system IconSpinner
 * so everything spins at the same tempo.
 */

import { IconSpinner } from './ui/Icon';

export function Spinner({ size = 20 }: { size?: number }) {
  return <IconSpinner size={size} />;
}
