/** 'artifact' when built as the claude.ai preview (Claude answers, no server); 'web' for the shipped app. */
export const TARGET: 'web' | 'artifact' = import.meta.env.VITE_TARGET === 'artifact' ? 'artifact' : 'web';
export const IN_PREVIEW = TARGET === 'artifact';
