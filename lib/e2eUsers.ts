// The 10 automated test accounts (Playwright, e2e/). Exact list: used by the tests, by
// `npm run e2e:clean` and by the /admin warning.
export const E2E_EMAILS = Array.from({ length: 10 }, (_, i) => `blopmatch+e2e${String(i + 1).padStart(2, '0')}@gmail.com`);

export const isE2eEmail = (email: string | null | undefined) => Boolean(email) && E2E_EMAILS.includes(email!.toLowerCase());
