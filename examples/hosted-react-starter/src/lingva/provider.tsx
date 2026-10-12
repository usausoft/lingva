'use client';

import type { PropsWithChildren } from 'react';
import { configureLingvaReact, LingvaProvider } from '@lingva/react';
import lingvaConfig from '../../lingva.config';
import lingvaProject from '../../.lingva/generated/project';

configureLingvaReact({
  ...lingvaConfig,
  project: lingvaProject,
});

export function AppLingvaProvider({ children }: PropsWithChildren) {
  return <LingvaProvider>{children}</LingvaProvider>;
}
