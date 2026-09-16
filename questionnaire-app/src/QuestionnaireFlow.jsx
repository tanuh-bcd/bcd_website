import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Consent from './components/Consent';
import Questionnaire from './components/Questionnaire';
import ThankYou from './components/ThankYou';
import { buildDatabaseForm, getLanguageCode, portalRequest } from './services/portal';

export default function QuestionnaireFlow() {
  const { i18n, ready } = useTranslation(['consent', 'questionnaire', 'thankyou']);
  const language = getLanguageCode(i18n.resolvedLanguage || i18n.language);
  const [step, setStep] = useState('consent');
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState(null);
  const versionRef = useRef(import.meta.env.VITE_QUESTIONNAIRE_VERSION || null);
  const operationPending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setBundle(null);
    async function load() {
      try {
        const query = new URLSearchParams({ lang: language });
        if (versionRef.current) query.set('version', versionRef.current);
        const rows = await portalRequest(`/api/v1/patient/questions?${query}`, { signal: controller.signal });
        const form = buildDatabaseForm(rows);
        query.set('version', form.version);
        const englishQuery = new URLSearchParams({ lang: 'en', version: form.version });
        const [consent, englishRows] = await Promise.all([
          portalRequest(`/api/participant-information?${query}`, { signal: controller.signal }),
          language === 'en' ? rows : portalRequest(`/api/v1/patient/questions?${englishQuery}`, { signal: controller.signal }),
        ]);
        if (!consent.title || !consent.header || !consent.headernames || !Array.isArray(consent.sections)) {
          throw new Error('Consent information is incomplete. Please try again.');
        }
        if (!controller.signal.aborted) {
          versionRef.current = form.version;
          setBundle({ ...buildDatabaseForm(rows, englishRows), consent });
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      }
    }
    load();
    return () => controller.abort();
  }, [language, retry]);

  async function handleConsent({ file } = {}) {
    if (!bundle || operationPending.current) return;
    operationPending.current = true;
    setBusy(true);
    setError('');
    try {
      let id = sessionId;
      if (!id) {
        const response = await portalRequest(`/api/session/start?version=${bundle.version}`, { method: 'POST' });
        if (!response.success || !response.sessionId || Number(response.questionnaireVersion) !== bundle.version) {
          throw new Error('The session does not match this questionnaire. Please reload.');
        }
        id = response.sessionId;
        setSessionId(id);
      }
      if (file) {
        const body = new FormData();
        body.append('file', file);
        await portalRequest(`/api/session/${id}/consent`, { method: 'POST', body });
      }
      setStep('questionnaire');
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  }

  async function handleSubmit(_localized, english) {
    if (!sessionId || operationPending.current) return;
    operationPending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await portalRequest('/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, formDataEn: english }),
      });
      if (!response.success) throw new Error('Submission failed. Please try again.');
      setAnswers(english);
      setResult(response.riskCalculated ? response.riskPercentage : null);
      setStep('submitted');
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  }

  if (!ready || !bundle) return (
    <div role={error ? 'alert' : 'status'} style={{ padding: 32, textAlign: 'center' }}>
      {error ? <><p>Could not load the questionnaire: {error}</p><button onClick={() => setRetry(value => value + 1)}>Retry</button></> : 'Loading questionnaire…'}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', width: '100%' }}>
      {step === 'consent' && <Consent key={language} content={bundle.consent} onAccept={handleConsent} isStarting={busy} error={error} />}
      {step === 'questionnaire' && <>
        {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
        <Questionnaire onSubmit={handleSubmit} isSubmitting={busy} formStructure={bundle.formStructure}
          questionnaireData={bundle.localized} questionnaireDataEn={bundle.english} />
      </>}
      {step === 'submitted' && <ThankYou riskResult={result} formData={answers} sessionId={sessionId}
        formStructure={bundle.formStructure} questionnaireData={bundle.english} />}
    </div>
  );
}
