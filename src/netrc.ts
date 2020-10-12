import { stripIndent } from 'common-tags';

export function generateGithubNetRC(token: string): string {
    return stripIndent`
    machine github.com
      login x-access-token
      password ${token}
    `;
}

export function generateNpmRC(token: string): string {
  return stripIndent`
  //npm.pkg.github.com/:_authToken=${token}
  `;
}
