import { appendFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { adminDb } from './db';
import { E2E_EMAILS } from '@/lib/e2eUsers';

// 10 scripted participants going through the real app (sign-up, matches, contact buttons,
// reviews), plus "curious" behaviour. Findings go to E2E_REPORT (one JSON line each).
// Runs in production: accounts are real (blopmatch+e2e01…10@gmail.com), matches between them
// are backdated so reviews open, and at the end they are deactivated (never matched again).

const REPORT = process.env.E2E_REPORT ?? 'e2e-report.jsonl';
const db = adminDb();
test.describe.configure({ mode: 'serial' });

type Person = { i: number; email: string; name: string; lang: 'en' | 'pt'; phone: string; instagram: string };
// Fictional numbers (US 555-01xx), so no real person is ever messaged.
const PEOPLE: Person[] = E2E_EMAILS.map((email, k) => ({
  i: k + 1,
  email,
  name: ['Alice', 'Bruno', 'Carla', 'Duarte', 'Eva', 'Filipe', 'Gabi', 'Hugo', 'Iris', 'João'][k],
  lang: k % 2 ? 'pt' : 'en',
  phone: `+1 202 555 01${String(k + 1).padStart(2, '0')}`,
  instagram: [3, 6, 9].includes(k + 1) ? '' : `e2e.test${k + 1}`,
}));
// Overlapping tastes so there are compatible matches, plus a few different people.
const TASTES = [
  [0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3], [4, 5, 6], [4, 5, 7], [0, 1, 2], [5, 6, 7], [8, 9, 10], [0, 4, 8],
];

function finding(who: string, what: string, detail: unknown = '') {
  appendFileSync(REPORT, JSON.stringify({ who, what, detail, at: new Date().toISOString() }) + '\n');
}

// Console errors, failed pages and horizontal scroll, on every page a person visits.
function watch(page: Page, who: string) {
  page.on('pageerror', (err) => finding(who, 'erro de JavaScript', `${page.url()} · ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/wa\.me|instagram\.com|ERR_BLOCKED|ERR_FAILED|404/.test(text)) return;
    finding(who, 'erro na consola', `${page.url()} · ${text}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 500 && new URL(res.url()).host === new URL(page.url() || 'http://x').host)
      finding(who, `resposta ${res.status()}`, res.url());
  });
}

async function checkPage(page: Page, who: string, others: string[] = []) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) finding(who, 'scroll horizontal', `${page.url()} · ${overflow}px`);
  const text = await page.locator('body').innerText();
  if (/\bundefined\b|\[object Object\]|NaN/.test(text)) finding(who, 'texto estranho na página', page.url());
  const html = await page.content(); // includes the RSC payload
  for (const leak of ['"score"', '"type":"compatible"', '"type":"control"', ...others]) {
    if (html.includes(leak)) finding(who, 'fuga de dados para o participante', `${page.url()} · ${leak}`);
  }
}

async function login(page: Page, p: Person) {
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: p.email });
  if (error) throw error;
  const { hashed_token, verification_type } = data.properties;
  await page.context().addCookies([{ name: 'lang', value: p.lang, url: test.info().project.use.baseURL! }]);
  await page.goto(`/auth/callback?token_hash=${hashed_token}&type=${verification_type}`);
}

test('cria as 10 contas', async () => {
  const existing = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    data.users.forEach((u) => u.email && existing.add(u.email.toLowerCase()));
    if (data.users.length < 1000) break;
  }
  for (const p of PEOPLE) {
    if (existing.has(p.email)) continue;
    const { error } = await db.auth.admin.createUser({ email: p.email, email_confirm: true });
    if (error) throw error;
  }
});

for (const p of PEOPLE) {
  test(`${p.i}. ${p.name} faz o cadastro (${p.lang})`, async ({ page }) => {
    const who = `${p.i}. ${p.name}`;
    watch(page, who);
    await login(page, p);
    await expect(page).toHaveURL(/\/join/);
    await checkPage(page, who);

    // Curious: submit an empty form first, then wrong contacts.
    if (p.i === 1 || p.i === 2) {
      await page.getByRole('button', { name: p.lang === 'pt' ? 'Participar' : 'Join', exact: true }).click();
      await expect(page.getByRole('alert').first()).toBeVisible();
      await page.locator('#whatsapp').fill('212345678'); // PT fixed line
      await page.locator('#instagram').fill('not valid!');
      await page.getByRole('button', { name: p.lang === 'pt' ? 'Participar' : 'Join', exact: true }).click();
      if (!(await page.getByText(p.lang === 'pt' ? 'número de telemóvel válido' : 'valid mobile number').isVisible()))
        finding(who, 'número fixo aceite sem erro');
      // Mask: a Brazilian number typed after choosing Brazil.
      await page.locator('select[aria-label]').selectOption('BR');
      await page.locator('#whatsapp').fill('');
      await page.locator('#whatsapp').pressSequentially('11987654321');
      const shown = await page.locator('#whatsapp').inputValue();
      if (shown !== '(11) 98765-4321') finding(who, 'máscara BR inesperada', shown);
      await page.reload(); // curious: reload in the middle of the form
    }

    await page.locator('#name').fill(p.name);
    await page.locator('#whatsapp').fill(p.phone); // pasted "+1 …" switches the country
    if ((await page.locator('select[aria-label]').inputValue()) !== 'US')
      finding(who, 'colar +1 não mudou o país para EUA', await page.locator('select[aria-label]').inputValue());
    await page.locator('#instagram').fill(p.instagram);
    await page.locator('#city').fill(p.i % 3 ? 'Lisbon' : 'Porto');
    for (const name of ['age_range', 'time_in_city', 'origin']) {
      await page.locator(`input[name="${name}"]`).nth(p.i % 3).check({ force: true });
    }
    const groups = page.locator('fieldset:has(button[aria-pressed])');
    for (let c = 0; c < 4; c++) {
      const buttons = groups.nth(c).locator('button[aria-pressed]');
      for (const k of TASTES[p.i - 1]) await buttons.nth((k + c) % 11).click();
    }
    if (p.i % 2) {
      await page.locator('fieldset').last().locator('button[aria-pressed]').first().click(); // talk about an interest
    } else {
      await page.locator('#talk_about').fill(`E2E ${p.name}: best coffee in town ☕ ${'!'.repeat(p.i)}`);
    }
    await page.locator('input[type="checkbox"]').check();
    const submit = page.getByRole('button', { name: p.lang === 'pt' ? 'Participar' : 'Join', exact: true });
    await submit.dblclick(); // curious: double tap
    await expect(page).toHaveURL(/\/me/, { timeout: 30_000 });
    await checkPage(page, who);

    // Already registered: /join goes back to /me.
    await page.goto('/join');
    if (!/\/me/.test(page.url())) finding(who, '/join acessível depois do cadastro', page.url());
  });
}

test('perfis gravados corretamente', async () => {
  const { data, error } = await db.from('participants').select('email, whatsapp, instagram, active').in('email', E2E_EMAILS);
  if (error) throw error;
  if (data.length !== 10) finding('base de dados', 'faltam perfis', `${data.length}/10`);
  for (const row of data) {
    const p = PEOPLE.find((x) => x.email === row.email)!;
    if (row.whatsapp !== p.phone.replace(/\s/g, '')) finding(p.name, 'WhatsApp gravado diferente', row.whatsapp);
    if ((row.instagram ?? '') !== p.instagram) finding(p.name, 'Instagram gravado diferente', row.instagram);
  }
});

test('esperar pelo matching', async () => {
  await new Promise((r) => setTimeout(r, 15_000));
});

for (const p of PEOPLE) {
  test(`${p.i}. ${p.name} vê os matches e explora`, async ({ page, context }) => {
    const who = `${p.i}. ${p.name}`;
    watch(page, who);
    const others = E2E_EMAILS.filter((e) => e !== p.email);
    // The contact buttons open other sites in a new tab: blocked here, only the tap is recorded.
    await context.route(/wa\.me|instagram\.com/, (route) => route.abort());
    await login(page, p);
    await page.goto('/me');
    await checkPage(page, who, others);

    const links = await page.locator('a[href^="/me/match/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    if (links.length === 0) finding(who, 'sem matches', '');
    for (const href of links) {
      await page.goto(href);
      await checkPage(page, who, others);
      const wa = page.locator('a[href^="https://wa.me/"]');
      if ((await wa.count()) !== 1) finding(who, 'botão WhatsApp em falta', href);
      else {
        const msg = decodeURIComponent((await wa.getAttribute('href'))!.split('text=')[1] ?? '');
        if (!msg) finding(who, 'mensagem do WhatsApp vazia', href);
        const popup = page.waitForEvent('popup').catch(() => null);
        await wa.click();
        (await popup)?.close();
      }
      const ig = page.locator('a[href^="https://instagram.com/"]');
      if ((await ig.count()) > 0) {
        const popup = page.waitForEvent('popup').catch(() => null);
        await ig.click();
        (await popup)?.close();
      }
      // Review not open yet.
      await page.goto(href.replace('/me/match/', '/me/review/'));
      await checkPage(page, who, others);
      if ((await page.locator('input[name="contacted"]').count()) > 0) finding(who, 'review aberta antes do prazo', href);
    }

    // Curious: someone else's match, the admin, the info pages, language switch, back links.
    const { data: foreign } = await db.from('matches').select('id').limit(1).not('id', 'in', `(${links.map((l) => l.split('/').pop()).join(',') || '00000000-0000-0000-0000-000000000000'})`);
    if (foreign?.[0]) {
      const res = await page.goto(`/me/match/${foreign[0].id}`);
      if (res?.status() !== 404) finding(who, 'abriu o match de outra pessoa', res?.status());
    }
    const admin = await page.goto('/admin');
    if (admin?.status() !== 404) finding(who, '/admin acessível a participante', admin?.status());
    await page.goto('/about');
    await checkPage(page, who);
    await page.getByRole('link', { name: p.lang === 'pt' ? 'Os meus matches' : 'My matches' }).first().click();
    await page.waitForURL(/\/me$/, { timeout: 10_000 }).catch(() => finding(who, 'voltar do About não foi para /me', page.url()));
    await page.goto('/privacy');
    await checkPage(page, who);
    await page.locator('[role="group"] button[aria-pressed="false"]').first().click(); // switch language
    await page.waitForTimeout(1500);
    await checkPage(page, who);
    await page.goBack();
    await page.goto('/me');
    await page.getByRole('button', { name: p.lang === 'pt' ? 'Sign out' : 'Sair' }).first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/me'));
  });
}

test('abrir as reviews (recuar 4 dias os matches entre contas de teste)', async () => {
  const { data: people } = await db.from('participants').select('id').in('email', E2E_EMAILS);
  const ids = (people ?? []).map((x) => x.id);
  const { data: matches, error } = await db.from('matches').select('id, a_id, b_id, created_at').in('a_id', ids).in('b_id', ids);
  if (error) throw error;
  for (const m of matches) {
    const created = new Date(new Date(m.created_at).getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const { error: upError } = await db.from('matches').update({ created_at: created }).eq('id', m.id);
    if (upError) throw upError;
  }
  finding('base de dados', 'matches entre contas de teste recuados 4 dias', matches.length);
});

for (const p of PEOPLE) {
  test(`${p.i}. ${p.name} responde às reviews`, async ({ page }) => {
    const who = `${p.i}. ${p.name}`;
    watch(page, who);
    await login(page, p);
    await page.goto('/me');
    const links = await page.locator('a[href^="/me/match/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    let k = 0;
    for (const href of links) {
      const reviewUrl = href.replace('/me/match/', '/me/review/');
      await page.goto(reviewUrl);
      if ((await page.locator('input[name="contacted"]').count()) === 0) continue; // not open (match with a non-test account)
      const send = page.getByRole('button', { name: p.lang === 'pt' ? 'Enviar' : 'Send', exact: true });
      k++;
      const pick = (name: string, n: number) => page.locator(`input[name="${name}"]`).nth(n).check({ force: true });
      // Curious: send without answering.
      if (k === 1) {
        await send.click();
        if ((await page.getByRole('alert').count()) === 0) finding(who, 'review vazia sem aviso', reviewUrl);
      }
      const path = (p.i + k) % 3; // 0: talked, 1: contacted only, 2: no contact
      await pick('contacted', path === 2 ? 1 : 0);
      await pick('interest_1_7', 3 + (p.i % 4));
      if (path === 2) await pick('why_not', p.i % 5);
      else {
        await pick('who_first', p.i % 2);
        await pick('comfort_1_7', 4);
        await pick('talked', path === 0 ? 0 : 1);
        if (path === 0) {
          for (const f of ['flow_1_7', 'common_ground_1_7', 'satisfaction_1_7', 'meet_again_1_7']) await pick(f, (p.i + k) % 7);
          await pick('met', p.i % 3);
        }
      }
      if ((await page.locator('input[name="ig_follow"]').count()) > 0) await pick('ig_follow', (p.i + k) % 4);
      await page.locator('textarea').fill(k % 2 ? `E2E review ${p.name} 👍` : '');
      await send.click();
      await expect(page).toHaveURL(/\/me$/, { timeout: 20_000 });
      // Curious: try to answer again.
      await page.goto(reviewUrl);
      if ((await page.locator('input[name="contacted"]').count()) > 0) finding(who, 'review pode ser repetida', reviewUrl);
    }
    await checkPage(page, who);
  });
}

// Always runs, even after a failure: the test accounts must never be matched with people who
// sign up later.
test.afterAll(async () => {
  const { error } = await db.from('participants').update({ active: false }).in('email', E2E_EMAILS);
  if (error) throw error;
});

test('verificar reviews gravadas', async () => {
  const { data: people } = await db.from('participants').select('id, instagram').in('email', E2E_EMAILS);
  const ids = (people ?? []).map((x) => x.id);
  const withIg = new Set((people ?? []).filter((x) => x.instagram).map((x) => x.id));
  const { data: matches } = await db.from('matches').select('id, a_id, b_id').in('a_id', ids).in('b_id', ids);
  const { data: reviews } = await db.from('reviews').select('match_id, reviewer_id, ig_follow').in('reviewer_id', ids);
  for (const r of reviews ?? []) {
    const m = matches?.find((x) => x.id === r.match_id);
    if (!m) continue;
    const both = withIg.has(m.a_id) && withIg.has(m.b_id);
    if (both !== (r.ig_follow !== null)) finding('base de dados', 'ig_follow incoerente com quem tem Instagram', r);
  }
  finding('base de dados', 'reviews gravadas', `${reviews?.length ?? 0} reviews · ${matches?.length ?? 0} matches entre contas de teste`);
});
