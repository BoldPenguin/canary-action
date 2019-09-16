import { generateGithubNetRC } from '../src/netrc';

describe('netrc', () => {
    it('generateGithubNetRC', async () => {
        const netrc = generateGithubNetRC('123456');
        expect(netrc).toBe('machine github.com\n  login 123456');
    });
});
