import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { ReposCreateDeploymentParams, ReposCreateDeploymentStatusParams } from '@octokit/rest';
import { writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import replaceInFile from 'replace-in-file';

import { generateGithubNetRC, generateNpmRC } from './netrc';

async function run() {
  try {
    const githubToken = core.getInput('github_token');
    const context = github.context;
    const repo = context.repo.repo;
    const ref = (context.ref || '')
                .replace(/\//g, '-')
                .replace(/\\/g,'-')
                .toLowerCase();
    const prNum = context.issue.number;
    const bpToken = core.getInput('bp_github_token', { required: true });
    const bucket = core.getInput('bucket', { required: true });
    const dist_dir = core.getInput('dist_dir', { required: true });
    const projectName = core.getInput('project_name') || repo;
    const buildCmd = core.getInput('build_cmd', { required: true });
    const deployEnv = core.getInput('deploy_env', { required: true });
    const base_url = core.getInput('base_url');
    const skipEnvUpdate = core.getInput('skip_env_update');
    const workingDir = core.getInput('working_dir');
    const useRefForDestination = core.getInput('use_ref');

    const destination = useRefForDestination ? 
                          `s3://${bucket}/${projectName}-${ref}/` :
                          `s3://${bucket}/${projectName}-${prNum}/`;

    const url = useRefForDestination ? 
                  `${base_url}https://${projectName}-${ref}.canary.alpha.boldpenguin.com` :
                  `${base_url}https://${projectName}-${prNum}.canary.alpha.boldpenguin.com`;

    process.chdir('/github/workspace');

    const octokit = new github.GitHub(githubToken);

    core.startGroup('Create Deployment');
      const deployOpts: ReposCreateDeploymentParams  = {
        ...context.repo,
        ref: context.payload.pull_request ? context.payload.pull_request.head.sha : context.sha,
        task: 'canary',
        environment: deployEnv,
        transient_environment: true,
        required_contexts: [],
        auto_merge: false
      };
    const resp = await octokit.repos.createDeployment(deployOpts);
    const deploymentId = resp.data.id;
    core.endGroup();

    core.startGroup('Set netrc')
    const netrc = generateGithubNetRC(bpToken);
    const netrcPath = join(homedir(), '.netrc');
    writeFileSync(netrcPath, netrc);
    core.endGroup();

    core.startGroup('Set npmrc');
    const npmrc = generateNpmRC(bpToken);
    const npmrcPath = join(homedir(), '.npmrc');
    writeFileSync(npmrcPath, npmrc);
    core.endGroup();

    if (workingDir) {
      process.chdir(workingDir);
    }
    console.log('Current working directory: ' + process.cwd());

    if (!skipEnvUpdate) {
      core.startGroup('Rewrite redirect URL');
      await replaceInFile({
        files: 'src/environments/environment.canary.ts',
        from: 'REDIRECT_URL',
        to: url
      });
      core.endGroup();
    }

    core.startGroup('Install dependencies')
    if (existsSync('./yarn.lock')) {
      await exec.exec('yarn');
    } else {
      await exec.exec('npm', ['ci', '--unsafe-perm']);
    }
    core.endGroup();

    core.startGroup('Build')
    await exec.exec('npm', ['run', buildCmd]);
    core.endGroup();

    core.startGroup('Upload to S3')
    await exec.exec('aws', ['s3', 'sync', dist_dir, destination, '--delete', '--region', 'us-east-1', '--acl', 'public-read', '--sse']);
    core.endGroup();

    core.startGroup('Complete Deployment');
    const statusOpts: ReposCreateDeploymentStatusParams = {
      ...context.repo,
      deployment_id: deploymentId,
      state: 'success',
      environment_url: url
    };
    await octokit.repos.createDeploymentStatus(statusOpts);
    core.endGroup();
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
