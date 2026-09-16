import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Public version-2 content captured from the portal on 2026-09-16.
// Every API request is intercepted: these tests cannot create portal records.
const questions = JSON.parse(readFileSync(new URL('./fixtures/questions.json', import.meta.url)));
const consent = JSON.parse(readFileSync(new URL('./fixtures/consent.json', import.meta.url)));
const sessionId = '00000000-0000-4000-8000-000000000000';
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));

async function mockApi(page, { failContent = false } = {}) {
  const submissions = [];
  const versions = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    switch (url.pathname) {
      case '/api/v1/patient/questions':
        if (failContent) return send({ detail: 'Test outage' }, 503);
        return send(questions);
      case '/api/participant-information':
        versions.push(url.searchParams.get('version'));
        return send(consent);
      case '/api/session/start':
        versions.push(url.searchParams.get('version'));
        return send({ success: true, sessionId, questionnaireVersion: 2 });
      case '/api/v1/auth/hospitals': return send([{ id: 1, name: 'Test' }]);
      case '/api/submit':
        submissions.push(request.postDataJSON());
        return send({ success: true, questionnaireVersion: 2, riskCalculated: true, riskPercentage: '35.00' });
      case '/api/v1/risk-categories/':
        return send(fixture('risk-categories'));
      case '/api/v1/stats/': return send(fixture('stats'));
      case '/api/v1/stats/hospital-locations': return send(fixture('locations'));
      case '/api/v1/mammogram/portal-stats': return send(fixture('mammogram'));
      default: return send({ detail: 'Unexpected API request in test' }, 404);
    }
  });
  return { submissions, versions };
}

test('database consent → version-2 conditional questionnaire → submission → PDF, without login', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const { submissions, versions } = await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: consent.title, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Login', exact: true })).toHaveCount(0);
  const accept = page.getByRole('button', { name: consent.buttonText, exact: true });
  await expect(accept).toBeDisabled();
  await page.locator('#age-confirmed').check();
  await expect(accept).toBeDisabled();
  await page.locator('#information-voluntary').check();
  await accept.click();
  await expect(page.locator('[name="V2_Q03"]')).toBeVisible();
  // Required-field validation is exercised before filling the form.
  const dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.locator('button[type="submit"]').click();
  expect(dialogs).toHaveLength(1);
  expect(submissions).toHaveLength(0);

  await page.locator('[name="V2_Q03"]').fill('35');
  await page.locator('[name="V2_Q04"]').fill('165');
  await page.locator('[name="V2_Q05"]').fill('60');
  await page.locator('[name="V2_Q06"]').selectOption('Karnataka');
  for (const key of ['V2_Q07', 'V2_Q08']) await page.locator(`[name="${key}"]`).first().check();
  for (const key of ['V2_Q09', 'V2_Q10', 'V2_Q14', 'V2_Q16', 'V2_Q20']) {
    await page.locator(`[name="${key}"][value="No"]`).check();
  }
  await page.locator('[name="V2_Q11"][value="Pre-menopausal"]').check();
  await expect(page.locator('[name="V2_Q11_CYCLES"]').first()).toBeVisible();
  await page.locator('[name="V2_Q11_CYCLES"][value="Yes"]').check();
  await page.locator('[name="V2_Q11A"]').fill('13');
  await page.locator('[name="V2_Q13"][value="Yes"]').check();
  await page.locator('[name="V2_Q13C"]').fill('2');
  await expect(page.locator('[name^="V2_Q13C_TRIMESTERS-"]')).toHaveCount(2);
  await page.locator('[name^="V2_Q13C_TRIMESTERS-"]').first().selectOption({ index: 1 });
  await page.locator('[name^="V2_Q13C_TRIMESTERS-"]').nth(1).selectOption({ index: 2 });
  await page.locator('[name="V2_Q13"][value="No"]').check();
  await expect(page.locator('[name^="V2_Q13C_TRIMESTERS-"]')).toHaveCount(0);

  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('heading', { name: 'Submission Complete' })).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(versions).toEqual(['2', '2']);
  expect(submissions[0].formDataEn.V2_Q03).toBe('35');
  expect(submissions[0].formDataEn.V2_Q11A).toBe('13');
  expect(submissions[0].formDataEn).not.toHaveProperty('V2_Q13C');
  expect(submissions[0].formDataEn).not.toHaveProperty('V2_Q13C_TRIMESTERS');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download.*PDF/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await download.failure()).toBeNull();
  expect(errors).toEqual([]);
});

test('content outage blocks consent instead of showing a stale form', async ({ page }) => {
  await mockApi(page, { failContent: true });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Could not load the questionnaire');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.locator('#age-confirmed')).toHaveCount(0);
});

test('portal dashboard renders database aggregates on desktop and mobile', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mockApi(page);
  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: 'Age Distribution', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Risk Categories Reference' })).toBeVisible();
  await expect(page.locator('.stats-error')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Age Distribution', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
