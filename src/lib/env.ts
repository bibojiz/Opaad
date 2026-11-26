/** 'artifact' when built as the claude.ai preview (Claude answers, no server); 'web' for the shipped app. */
export const TARGET: 'web' | 'artifact' = import.meta.env.VITE_TARGET === 'artifact' ? 'artifact' : 'web';
export const IN_PREVIEW = TARGET === 'artifact';
/** Testing phase: AI is unlimited for everyone. Set VITE_AI_FREE_LIMIT=on in Vercel to turn the free-plan limit on at launch. */
export const TESTING_UNLIMITED_AI = IN_PREVIEW || import.meta.env.VITE_AI_FREE_LIMIT !== 'on';
