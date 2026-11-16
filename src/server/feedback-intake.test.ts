import { test, expect } from 'bun:test';
import { createFeedbackIntake, feedbackTriage } from './feedback-intake';
import { createPublicSecurity, publicHandler } from './public-security';

test('private receipt, category routing, auth, origin limits and bounded input', async () => {
  const intake = createFeedbackIntake(':memory:', () => 'test-secret');
  const security = createPublicSecurity({ PUBLIC_IP_LIMIT: '20' });
  const send = (body: unknown, origin = 'http://localhost') => {
    const req = new Request('http://localhost/api/feedback', { method: 'POST', headers: { origin }, body: JSON.stringify(body) });
    return publicHandler(security, '/api/feedback', 'POST', req, '127.0.0.1', () => intake.submit(req));
  };
  try {
    for (const category of Object.keys(feedbackTriage)) {
      const res = await send({ category, text: '<script>private abusive input</script>', consent: true });
      expect(res.status).toBe(201);
      const receipt = await res.json();
      expect(receipt.status).toBe('pending-private-review');
      expect(receipt.text).toBeUndefined();
      expect(receipt.owner).toBe(feedbackTriage[category as keyof typeof feedbackTriage].owner);
    }
    expect(intake.queue(new Request('http://localhost')).status).toBe(404);
    expect(intake.queue(new Request('http://localhost', { headers: { authorization: 'Bearer wrong' } })).status).toBe(404);
    const queue = await intake.queue(new Request('http://localhost', { headers: { authorization: 'Bearer test-secret' } })).json();
    expect(queue.feedback).toHaveLength(5);
    expect(queue.feedback[0].text).toContain('<script>');
    expect((await send({ category: 'privacy', text: 'secret', consent: true }, 'https://evil.example')).status).toBe(403);
    for (const body of [{ category: '__proto__', text: 'x', consent: true }, { category: 'bug', text: 'x', consent: false }, { category: 'bug', text: 'x'.repeat(4001), consent: true }]) expect((await send(body)).status).toBe(400);
    expect((await send({ text: 'x'.repeat(70000) })).status).toBe(413);
  } finally { intake.close(); }
});

test('unconfigured intake fails closed', async () => {
  const intake = createFeedbackIntake(':memory:', () => '');
  try { expect((await intake.submit(new Request('http://localhost'))).status).toBe(503); }
  finally { intake.close(); }
});
