import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { generateGithubNetRC } from './netrc';
import { writeFileSync } from 'fs';
import { ChecksCreateParams } from '@octokit/rest';

async function run() {
  try {
    const githubToken = core.getInput('GITHUB_TOKEN');
    const context = github.context;
    const repo = context.repo.repo;
    const prNum = context.payload.pull_request.number;
    const bpToken = core.getInput('BP_GITHUB_TOKEN');
    const bucket = core.getInput('BUCKET');

    const octokit = new github.GitHub(githubToken);
    const checkOptions: ChecksCreateParams = {
      ...context.repo,
      name: 'Canary Build',
      head_sha: context.payload.pull_request.head.sha,
      status: 'in_progress',
      output: {
        title: 'Deploying',
        summary: ''
      }
    };

    core.startGroup('Create GH Check');
    octokit.checks.create(checkOptions);
    core.endGroup();

    core.startGroup('Set netrc')
    const netrc = generateGithubNetRC(bpToken);
    writeFileSync('~/.netrc', netrc);
    core.endGroup();

    const destination = `s3://${bucket}/${repo}/${prNum}/`;
    core.setOutput('destination', destination);

    core.startGroup('Install dependencies')
    exec.exec('npm', ['install']);
    core.endGroup();

    core.startGroup('Build')
    exec.exec('npm', ['run', 'build-canary']);
    core.endGroup();

    core.startGroup('Complete GH Check');
    checkOptions.status = 'completed';
    checkOptions.conclusion = 'success';
    checkOptions.completed_at = new Date().toString();
    checkOptions.output = {
      title: 'Deployed',
      summary: `https://${repo}-${prNum}.canary.alpha.boldpenguin.com`
    };
    octokit.checks.create(checkOptions);
    core.endGroup();


  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
