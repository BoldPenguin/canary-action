import { stripIndent } from 'common-tags';

export function generateGithubNetRC(token: string): string {
    return stripIndent`
    machine github.com
      login ${token}
    `;
}
