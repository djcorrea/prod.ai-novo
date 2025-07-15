import handler from '../api/chat.js';

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  cert: jest.fn(),
  getApps: jest.fn(() => [])
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: jest.fn(() => Promise.resolve({ uid: '1', email: 't@example.com' }))
  })
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    runTransaction: jest.fn(async fn => {
      await fn({
        get: jest.fn(() => ({ exists: false })),
        set: jest.fn(),
        update: jest.fn()
      });
    })
  }),
  FieldValue: { increment: jest.fn() },
  Timestamp: { now: () => ({ toDate: () => new Date() }) }
}));

function createRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
}

describe('chat handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns reply on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'hi' } }] })
    });

    const req = { method: 'POST', body: { message: 'Hello', idToken: 'tok', conversationHistory: [] } };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ reply: 'hi' });
  });

  it('handles openai failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { message: 'bad' } })
    });

    const req = { method: 'POST', body: { message: 'Hello', idToken: 'tok', conversationHistory: [] } };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json.mock.calls[0][0].error).toBe('Falha ao consultar OpenAI');
  });
});
