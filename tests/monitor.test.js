const { computeChurnScore } = require('../src/agents/monitor');
jest.mock('../src/db/client');
jest.mock('../src/services/redis');

describe('churn score computation', () => {
  it('returns low risk for active users with key features', async () => {
    require('../src/db/client').query
      .mockResolvedValueOnce({ rows: Array(15).fill({ event_type: 'click', feature: 'dashboard', occurred_at: new Date() }) })
      .mockResolvedValueOnce({ rows: [{ feature_slug: 'dashboard' }, { feature_slug: 'automation' }, { feature_slug: 'integrations' }, { feature_slug: 'team-invite' }] })
      .mockResolvedValueOnce({ rows: [{ created_at: new Date(Date.now() - 5 * 86_400_000), plan: 'pro' }] })
      .mockResolvedValue({ rows: [] });

    const result = await computeChurnScore('test-user-id');
    expect(result.tier).toBe('low');
    expect(result.score).toBeLessThan(0.4);
  });
});
