import { appendFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { adminDb } from './db';
import { E2E_EMAILS } from '@/lib/e2eUsers';

// 10 scripted participants going through the real app (sign-up, password game, matches, contact
// buttons, guesses, reviews, experience review, leaderboard), plus "curious" behaviour. Person 10
// starts as a v1 participant and joins v2. Findings go to E2E_REPORT (one JSON line each).
// Runs in production: accounts are real (blopmatch+e2e01…10@gmail.com), matches between them
// are backdated so reviews open, and at the end they are deactivated (never matched again).

const REPORT = process.env.E2E_REPORT ?? 'e2e-report.jsonl';
const db = adminDb();
test.describe.configure({ mode: 'serial' });

type Person = { i: number; email: string; name: string; lang: 'en' | 'pt'; phone: string; instagram: string; password: string; showName: boolean; age: number };
const PASSWORDS = ['flamingo', 'vulcão', 'penguin', 'trampolim', 'volcano', 'pinguim', 'octopus', 'polvo', 'giggle', 'canguru'];
// Fictional numbers (US 555-01xx), so no real person is ever messaged.
const PEOPLE: Person[] = E2E_EMAILS.map((email, k) => ({
  i: k + 1,
  email,
  name: ['Alice', 'Bruno', 'Carla', 'Duarte', 'Eva', 'Filipe', 'Gabi', 'Hugo', 'Iris', 'João'][k],
  lang: k % 2 ? 'pt' : 'en',
  phone: `+1 202 555 01${String(k + 1).padStart(2, '0')}`,
  instagram: [3, 6, 9].includes(k + 1) ? '' : `e2e.test${k + 1}`,
  password: PASSWORDS[k],
  showName: k % 3 === 0, // the others appear with a nickname on the leaderboard
  age: 24 + (k % 4), // close ages: v2 never matches people more than 5 years apart
}));
const V1_PERSON = PEOPLE[9]; // starts in v1 (inserted directly), then joins v2 through the app
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
    if (/wa\.me|instagram\.com|ERR_BLOCKED|ERR_FAILED|404|502|504/.test(text)) return;
    finding(who, 'erro na consola', `${page.url()} · ${text}`);
  });
  page.on('response', (res) => {
    // 502/504 "upstream request failed" come from this sandbox's network proxy, not the app.
    if (res.status() === 502 || res.status() === 504) return;
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

// Navigation that retries when the sandbox proxy answers 502/504 (the app is not involved).
async function go(page: Page, url: string) {
  for (let attempt = 1; ; attempt++) {
    const res = await page.goto(url);
    if (!res || ![502, 504].includes(res.status()) || attempt === 4) return res;
    await page.waitForTimeout(2000 * attempt);
  }
}

// The v2 password step: one secret word, the leaderboard choice. Curious: a bad word first.
async function choosePassword(page: Page, p: Person, who: string) {
  const save = page.getByRole('button', { name: p.lang === 'pt' ? 'Guardar e ver os meus matches' : 'Save and see my matches' });
  if (p.i === 1 || p.i === 2) {
    await page.getByRole('textbox').fill('two words');
    await save.click();
    if ((await page.getByRole('alert').count()) === 0) finding(who, 'password inválida aceite sem erro');
  }
  const placeholder = await page.getByRole('textbox').getAttribute('placeholder');
  if (!placeholder || /sunflower|girassol/.test(placeholder)) finding(who, 'exemplo da password inesperado', placeholder);
  await page.getByRole('textbox').fill(p.password);
  if (p.showName) await page.getByRole('checkbox').check();
  await save.click();
  await expect(page).toHaveURL(/\/me$/, { timeout: 40_000 });
  await checkPage(page, who);
  if ((await page.getByText(p.password, { exact: true }).count()) === 0) finding(who, 'password não aparece no /me', p.password);
}

async function login(page: Page, p: Person) {
  await page.context().addCookies([{ name: 'lang', value: p.lang, url: test.info().project.use.baseURL! }]);
  // A sign-in link works once, so a failed attempt gets a fresh link.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: p.email });
    if (error) throw error;
    const { hashed_token, verification_type } = data.properties;
    const res = await page.goto(`/auth/callback?token_hash=${hashed_token}&type=${verification_type}`);
    if (res && res.ok() && !page.url().includes('/login')) return;
    await page.waitForTimeout(2000 * attempt);
  }
  throw new Error(`login falhou para ${p.email}`);
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
  // Person 10: a v1 participant from the first round (no password), to test joining v2.
  const { data: v1Row } = await db.from('participants').select('id').eq('email', V1_PERSON.email).maybeSingle();
  if (!v1Row) {
    const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
    const user = users.users.find((u) => u.email === V1_PERSON.email)!;
    const { data: ref } = await db.from('participants').select('interests').eq('email', PEOPLE[1].email).maybeSingle();
    const { error } = await db.from('participants').insert({
      user_id: user.id,
      email: V1_PERSON.email,
      name: V1_PERSON.name,
      whatsapp: V1_PERSON.phone.replace(/\s/g, ''),
      instagram: V1_PERSON.instagram || null,
      city: 'Lisbon',
      lang: V1_PERSON.lang,
      age: V1_PERSON.age,
      age_range: '25-30',
      time_in_city: 'lt6m',
      origin: 'other_country',
      interests: ref?.interests ?? ['music_rock', 'music_pop', 'sports_football', 'fit_gym', 'movies_comedy', 'act_beach'],
      talk_about: 'E2E v1: best coffee in town',
      consent_at: '2026-10-20T10:00:00Z',
      created_at: '2026-10-20T10:00:00Z',
      cohort: 'v1',
      pending_review: false,
    });
    if (error) throw error;
  }
});

for (const p of PEOPLE) {
  test(`${p.i}. ${p.name} faz o cadastro (${p.lang})`, async ({ page }) => {
    const who = `${p.i}. ${p.name}`;
    watch(page, who);
    await login(page, p);
    await page.waitForURL(/\/(join|me)/);
    test.skip(/\/me/.test(page.url()), 'já registado (corrida retomada)');
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
    await page.locator('#age').fill(String(p.age));
    for (const name of ['time_in_city', 'origin']) {
      await page.locator(`input[name="${name}"]`).nth(p.i % 3).check({ force: true });
    }
    for (const [c, category] of ['music', 'sports', 'fitness', 'movies'].entries()) {
      await page.locator(`button[aria-controls="interests-${category}"]`).click(); // categories start closed
      const buttons = page.locator(`#interests-${category} button[aria-pressed]`);
      const n = await buttons.count();
      for (const k of TASTES[p.i - 1]) await buttons.nth((k + c) % n).click();
    }
    if (p.i % 2) {
      await page.locator('fieldset').last().locator('button[aria-pressed]').first().click(); // talk about an interest
    } else {
      await page.locator('#talk_about').fill(`E2E ${p.name}: best coffee in town ☕ ${'!'.repeat(p.i)}`);
    }
    await page.locator('input[type="checkbox"]').check();
    const submit = page.getByRole('button', { name: p.lang === 'pt' ? 'Participar' : 'Join', exact: true });
    await submit.dblclick(); // curious: double tap
    // v2: the password game step comes right after the profile.
    await expect(page).toHaveURL(/\/join\/password/, { timeout: 30_000 });
    await checkPage(page, who);
    await choosePassword(page, p, who);

    // Already registered: /join goes back to /me.
    await go(page, '/join');
    if (!/\/me/.test(page.url())) finding(who, '/join acessível depois do cadastro', page.url());
  });
}

test('perfis gravados corretamente', async () => {
  const { data, error } = await db
    .from('participants')
    .select('email, whatsapp, instagram, age, active, cohort, password, password_kind, nickname, leaderboard_show_name, upgraded_at')
    .in('email', E2E_EMAILS);
  if (error) throw error;
  if (data.length !== 10) finding('base de dados', 'faltam perfis', `${data.length}/10`);
  for (const row of data) {
    const p = PEOPLE.find((x) => x.email === row.email)!;
    if (row.whatsapp !== p.phone.replace(/\s/g, '')) finding(p.name, 'WhatsApp gravado diferente', row.whatsapp);
    if ((row.instagram ?? '') !== p.instagram) finding(p.name, 'Instagram gravado diferente', row.instagram);
    if (row.age !== p.age) finding(p.name, 'idade gravada diferente', row.age);
    if (p === V1_PERSON) {
      if (row.cohort !== 'v1' || row.password) finding(p.name, 'conta da v1 já não está na v1 antes do upgrade', row);
      continue;
    }
    if (row.cohort !== 'v2') finding(p.name, 'perfil novo não ficou na v2', row.cohort);
    if (row.password !== p.password) finding(p.name, 'password gravada diferente', row.password);
    if (!row.password_kind) finding(p.name, 'tipo de palavra da password em falta (pista)', '');
    if (!row.nickname) finding(p.name, 'alcunha em falta', '');
    if (row.leaderboard_show_name !== p.showName) finding(p.name, 'escolha do ranking gravada diferente', row.leaderboard_show_name);
  }
});

// Person 10 comes back from v1: what's new → review the profile → password → v2 (and matches).
test(`${V1_PERSON.i}. ${V1_PERSON.name} (v1) entra na v2`, async ({ page }) => {
  const p = V1_PERSON;
  const who = `${p.i}. ${p.name} (v1)`;
  watch(page, who);
  await login(page, p);
  await go(page, '/me');
  test.skip(!/whats-new/.test(page.url()) && !/\/me$/.test(page.url()), 'estado inesperado');
  if (!/\/me\/whats-new/.test(page.url())) {
    const { data } = await db.from('participants').select('cohort').eq('email', p.email).maybeSingle();
    test.skip(data?.cohort === 'v2', 'já passou para a v2 (corrida retomada)');
    finding(who, 'v1 não foi levado às novidades', page.url());
  }
  await checkPage(page, who);
  // Curious: "not now" first, then the banner brings them back.
  await page.getByRole('link', { name: p.lang === 'pt' ? 'Agora não, ver os meus matches antigos' : "Not now, see my old matches" }).click();
  await page.waitForURL(/\/me\?old=1/);
  await page.getByRole('link', { name: p.lang === 'pt' ? 'Ver as novidades' : "See what's new" }).click();
  await page.waitForURL(/\/me\/whats-new/);
  await page.getByRole('link', { name: p.lang === 'pt' ? 'Rever o meu perfil e entrar' : 'Review my profile and join' }).click();
  await page.waitForURL(/\/me\/update/);
  await checkPage(page, who);
  if ((await page.locator('#name').inputValue()) !== p.name) finding(who, 'perfil não veio preenchido', await page.locator('#name').inputValue());
  await page.locator('#age').fill(String(p.age));
  await page.getByRole('button', { name: p.lang === 'pt' ? 'Guardar e continuar' : 'Save and continue' }).click();
  await expect(page).toHaveURL(/\/join\/password/, { timeout: 30_000 });
  await choosePassword(page, p, who);
  const { data } = await db.from('participants').select('cohort, upgraded_at, password').eq('email', p.email).maybeSingle();
  if (data?.cohort !== 'v2' || !data.upgraded_at) finding(who, 'não passou para a v2', data);
});

// New profiles are held until the AI check of the name and texts comes back clean; then the
// matching runs. Waits for that (up to 2 minutes) instead of a fixed pause.
test('esperar pela verificação e pelo matching', async () => {
  const deadline = Date.now() + 120_000;
  let held: string[] = [];
  while (Date.now() < deadline) {
    const { data, error } = await db.from('participants').select('name, pending_review').in('email', E2E_EMAILS);
    if (error) throw error;
    held = (data ?? []).filter((p) => p.pending_review).map((p) => p.name);
    if (held.length === 0) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (held.length) finding('verificação', 'perfis ainda pendentes (a IA marcou ou falhou)', held.join(', '));
  await new Promise((r) => setTimeout(r, 5000)); // last matches and e-mails

  // v2 rules: same language, at most 5 years apart, compatible only from a match score of 14.
  const { data: rows } = await db.from('participants').select('id, name, lang, age').in('email', E2E_EMAILS);
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const ids = [...byId.keys()];
  const { data: matches } = await db.from('matches').select('a_id, b_id, type, score').or(`a_id.in.(${ids}),b_id.in.(${ids})`);
  for (const m of matches ?? []) {
    const a = byId.get(m.a_id);
    const b = byId.get(m.b_id);
    if (!a || !b) continue; // with someone outside the test
    if (a.lang !== b.lang) finding('matching', 'match entre línguas diferentes', `${a.name}/${b.name}`);
    if (a.age && b.age && Math.abs(a.age - b.age) > 5) finding('matching', 'match com mais de 5 anos de diferença', `${a.name}/${b.name}`);
    if ((m.type === 'compatible') !== (m.score >= 14)) finding('matching', 'tipo do match não bate com o score', `${a.name}/${b.name} ${m.type} ${m.score}`);
  }
  finding('matching', 'matches das contas de teste', `${matches?.length ?? 0}`);
});

for (const p of PEOPLE) {
  test(`${p.i}. ${p.name} vê os matches e explora`, async ({ page, context }) => {
    const who = `${p.i}. ${p.name}`;
    watch(page, who);
    const others = E2E_EMAILS.filter((e) => e !== p.email);
    // Other people's passwords must not reach the page before they are found (or the tries used).
    const secrets = PEOPLE.filter((x) => x !== p && x !== V1_PERSON).map((x) => `"${x.password}"`);
    // The contact buttons open other sites in a new tab: blocked here, only the tap is recorded.
    await context.route(/wa\.me|instagram\.com/, (route) => route.abort());
    await login(page, p);
    await go(page, '/me');
    await checkPage(page, who, others);

    const links = await page.locator('a[href^="/me/match/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    if (links.length === 0) finding(who, 'sem matches', '');
    for (const [n, href] of links.entries()) {
      await go(page, href);
      await checkPage(page, who, [...others, ...secrets]);
      const game = page.locator('section', { hasText: p.lang === 'pt' ? 'Jogo da password' : 'Password game' });
      if ((await game.count()) === 0) finding(who, 'jogo da password em falta no match', href);
      else if ((await game.getByText(p.lang === 'pt' ? 'Pistas' : 'Clues').count()) === 0) finding(who, 'pistas da password em falta', href);
      // Guesses on the first match: a wrong word, the same word again (no try used), then the right one.
      const name = (await page.locator('h1').innerText()).split(',')[0].trim();
      const target = PEOPLE.find((x) => x.name === name);
      if (n === 0 && target && target !== V1_PERSON && (await page.locator('#guess').count())) {
        const guess = async (word: string) => {
          await page.locator('#guess').fill(word);
          await page.getByRole('button', { name: p.lang === 'pt' ? 'Adivinhar' : 'Guess', exact: true }).click();
          await expect(page.getByRole('button', { name: p.lang === 'pt' ? 'Adivinhar' : 'Guess', exact: true })).toBeEnabled({ timeout: 30_000 });
          return (await page.locator('form p[role="status"]').innerText().catch(() => '')).trim();
        };
        const wrong = await guess('giraffe');
        if (!/(Não é essa|Not that one)/.test(wrong)) finding(who, 'palpite errado sem a mensagem certa', wrong);
        const again = await guess('GIRAFFE');
        if (!/(Já tentaste|already tried)/.test(again)) finding(who, 'palpite repetido não foi recusado', again);
        if (p.i % 2) {
          await page.locator('#guess').fill(target.password);
          await page.getByRole('button', { name: p.lang === 'pt' ? 'Adivinhar' : 'Guess', exact: true }).click();
          await expect(game.getByText(p.lang === 'pt' ? 'Descobriste com' : 'You found it with')).toBeVisible({ timeout: 40_000 })
            .catch(() => finding(who, 'palpite certo não foi reconhecido', target.password));
        }
      }
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
      await go(page, href.replace('/me/match/', '/me/review/'));
      await checkPage(page, who, others);
      if ((await page.locator('input[name="contacted"]').count()) > 0) finding(who, 'review aberta antes do prazo', href);
    }

    // Curious: someone else's match, the admin, the info pages, language switch, back links.
    const { data: foreign } = await db.from('matches').select('id').limit(1).not('id', 'in', `(${links.map((l) => l.split('/').pop()).join(',') || '00000000-0000-0000-0000-000000000000'})`);
    if (foreign?.[0]) {
      const res = await go(page, `/me/match/${foreign[0].id}`);
      if (res?.status() !== 404) finding(who, 'abriu o match de outra pessoa', res?.status());
    }
    const admin = await go(page, '/admin');
    if (admin?.status() !== 404) finding(who, '/admin acessível a participante', admin?.status());
    await go(page, '/about');
    await checkPage(page, who);
    await page.getByRole('link', { name: p.lang === 'pt' ? 'Os meus matches' : 'My matches' }).first().click();
    await page.waitForURL(/\/me$/, { timeout: 10_000 }).catch(() => finding(who, 'voltar do About não foi para /me', page.url()));
    await go(page, '/privacy');
    await checkPage(page, who);
    await page.locator('[role="group"] button[aria-pressed="false"]').first().click(); // switch language
    await page.waitForTimeout(1500);
    await checkPage(page, who);
    await page.goBack();
    await go(page, '/me');
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

// The one-time BLOP experience review, right after the first match review. Curious: person 2
// says "later" the first time and must find the card on /me.
async function experience(page: Page, p: Person, who: string, k: number) {
  await checkPage(page, who);
  if (p.i === 2 && k === 1) {
    await page.getByRole('link', { name: p.lang === 'pt' ? 'Mais tarde' : 'Later' }).click();
    await page.waitForURL(/\/me$/);
    if ((await page.getByText(p.lang === 'pt' ? 'O que achas do BLOP?' : 'What do you think of BLOP?').count()) === 0)
      finding(who, 'cartão da avaliação da experiência em falta no /me');
    return;
  }
  const q = (text: string) => page.locator('fieldset', { has: page.locator('legend', { hasText: text }) });
  const pt = p.lang === 'pt';
  await q(pt ? 'Gostas da ideia' : 'Do you like the idea').locator('label').nth(p.i % 2).click();
  await q(pt ? 'faz mais sentido' : 'works better for').locator('label').nth(p.i % 3).click();
  await q(pt ? 'introvertida' : 'introverted').locator('label').nth(p.i % 3).click();
  await q(pt ? 'festa' : 'party').locator('label').nth(p.i % 3).click();
  const fun = q(pt ? 'divertido' : 'fun');
  if ((await fun.count()) === 0) finding(who, 'pergunta do jogo em falta na experiência');
  else await fun.locator('label').nth(4 + (p.i % 3)).click();
  await page.getByRole('button', { name: pt ? 'Enviar' : 'Send', exact: true }).click();
  await page.waitForURL(/\/me$/, { timeout: 20_000 }).catch(() => finding(who, 'avaliação da experiência não voltou ao /me', page.url()));
}

for (const p of PEOPLE) {
  test(`${p.i}. ${p.name} responde às reviews`, async ({ page }) => {
    const who = `${p.i}. ${p.name}`;
    watch(page, who);
    await login(page, p);
    await go(page, '/me');
    const links = await page.locator('a[href^="/me/match/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    let k = 0;
    for (const href of links) {
      const reviewUrl = href.replace('/me/match/', '/me/review/');
      await go(page, reviewUrl);
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
      // The idea questions moved to the one-time experience review: never in a match review.
      if ((await page.locator('input[name="likes_concept"]').count()) > 0) finding(who, 'review do match ainda pergunta sobre a ideia', reviewUrl);
      const interest = 2 + ((p.i + k) % 5); // 2–6
      await pick('interest_1_7', interest - 1);
      const why = page.locator('fieldset', { has: page.locator('legend', { hasText: p.lang === 'pt' ? 'menos interessante' : 'less interesting' }) });
      if (interest <= 3) {
        if ((await why.count()) === 0) finding(who, 'interesse baixo sem a pergunta do porquê', reviewUrl);
        else await why.locator('label').nth(p.i % 6).click();
      } else if ((await why.count()) > 0) finding(who, 'pergunta do porquê com interesse alto', reviewUrl);
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
      if (path !== 2) {
        // v2: how many times they said their password (0, 1, 2, 3+).
        const said = page.getByRole('button', { name: ['0', '1', '2', '3+'][(p.i + k) % 4], exact: true });
        if ((await said.count()) === 0) finding(who, 'pergunta "quantas vezes disseste" em falta', reviewUrl);
        else await said.click();
      }
      await page.locator('textarea').fill(k % 2 ? `E2E review ${p.name} 👍` : '');
      await send.click();
      // A lost response (sandbox proxy) leaves the page as is; the review may still be saved.
      await page.waitForURL(/\/me(\/experience)?$/, { timeout: 20_000 }).catch(() => finding(who, 'review enviada sem sair da página', reviewUrl));
      if (/\/me\/experience$/.test(page.url())) await experience(page, p, who, k);
      // Curious: try to answer again.
      await go(page, reviewUrl);
      if ((await page.locator('input[name="contacted"]').count()) > 0) finding(who, 'review pode ser repetida', reviewUrl);
    }
    await checkPage(page, who);
    // Leaderboard: people who didn't choose to show their name appear with a nickname.
    await go(page, '/me/leaderboard');
    await checkPage(page, who);
    const board = await page.locator('ol').first().innerText().catch(() => '');
    for (const x of PEOPLE) if (!x.showName && x !== p && new RegExp(`\\b${x.name}\\b`).test(board)) finding(who, 'nome no ranking sem autorização', x.name);
  });
}

// A resumed run starts with the accounts deactivated by the previous run's afterAll.
test.beforeAll(async () => {
  const { error } = await db.from('participants').update({ active: true }).in('email', E2E_EMAILS);
  if (error) throw error;
});

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
