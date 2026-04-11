#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');

const ENVIRONMENTS = {
  test: {
    name: 'test',
    profile: 'nwac-test',
    region: 'ca-central-1',
    loadBalancerName: 'nwac-test-alb',
    listenerPort: 443,
    surfaces: {
      admin: {
        hostnames: ['nwac-console-test.awentech.ca'],
        targetGroupName: 'nwac-test-admin-tg',
      },
      portal: {
        hostnames: ['nwac-public-test.awentech.ca'],
        targetGroupName: 'nwac-test-portal-tg',
      },
    },
  },
  prod: {
    name: 'prod',
    profile: 'nwac-prod',
    region: 'ca-central-1',
    loadBalancerName: 'nwac-prod-alb',
    listenerPort: 443,
    surfaces: {
      admin: {
        hostnames: ['nwac-console.awentech.ca'],
        targetGroupName: 'nwac-prod-admin-tg',
      },
      portal: {
        hostnames: ['nwac-public.awentech.ca', 'iset.nwac.ca'],
        targetGroupName: 'nwac-prod-portal-tg',
      },
    },
  },
};

const DEFAULT_TITLE = 'Scheduled maintenance';
const DEFAULT_MESSAGE = 'PATH is temporarily unavailable while maintenance is in progress. Please try again in a few minutes.';

function usage() {
  console.log([
    'Usage: node scripts/path-maintenance-fallback.js <set|clear|status> [options]',
    '',
    'Commands:',
    '  set      Enable the ALB fixed-response maintenance page',
    '  clear    Restore normal forwarding for the selected surfaces',
    '  status   Show whether the selected surfaces currently use a maintenance page',
    '',
    'Options:',
    '  --env NAME           Target environment: test or prod',
    '  --profile NAME       AWS profile override',
    '  --region REGION      AWS region override. Default: ca-central-1',
    '  --surfaces LIST      admin, portal, or all. Default: all',
    '  --title TEXT         HTML page title/header for `set`',
    '  --message TEXT       HTML page body text for `set`',
    '  --yes                Required for prod mutations',
    '  --json               Emit machine-readable JSON',
    '  --help               Show this help',
    '',
    'Examples:',
    '  node scripts/path-maintenance-fallback.js status --env test',
    '  node scripts/path-maintenance-fallback.js set --env test --surfaces admin',
    '  node scripts/path-maintenance-fallback.js clear --env prod --surfaces all --yes',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = {
    command: null,
    env: null,
    profile: null,
    region: null,
    surfaces: 'all',
    title: DEFAULT_TITLE,
    message: DEFAULT_MESSAGE,
    yes: false,
    json: false,
  };

  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--env') {
      args.env = String(argv[++index] || '').toLowerCase();
    } else if (token === '--profile') {
      args.profile = argv[++index];
    } else if (token === '--region') {
      args.region = argv[++index];
    } else if (token === '--surfaces') {
      args.surfaces = argv[++index];
    } else if (token === '--title') {
      args.title = argv[++index] || DEFAULT_TITLE;
    } else if (token === '--message') {
      args.message = argv[++index] || DEFAULT_MESSAGE;
    } else if (token === '--yes') {
      args.yes = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--help' || token === '-h') {
      args.command = 'help';
    } else {
      positional.push(token);
    }
  }

  if (!args.command && positional.length) {
    args.command = String(positional[0] || '').toLowerCase();
  }
  return args;
}

function quoteBashArgument(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env || process.env,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.status !== 0) {
    const output = options.capture
      ? (result.stderr || result.stdout || `${command} ${args.join(' ')} failed`).trim()
      : `${command} ${args.join(' ')} failed with exit code ${result.status}`;
    throw new Error(output);
  }

  return result;
}

function runAws(args, envConfig, captureJson = true) {
  const awsCommand = [
    'aws',
    ...args,
    '--profile',
    envConfig.profile,
    '--region',
    envConfig.region,
    ...(captureJson ? ['--output', 'json'] : []),
  ].map(quoteBashArgument).join(' ');
  const commandText = `AWS_PAGER='' AWS_CLI_AUTO_PROMPT=off ${awsCommand}`;
  const result = runCommand('bash', ['-lc', commandText], { capture: true });
  return captureJson ? JSON.parse(result.stdout || '{}') : (result.stdout || '');
}

function getEnvironmentConfig(args) {
  const base = ENVIRONMENTS[args.env];
  if (!base) {
    throw new Error(`Unsupported environment: ${args.env || '<missing>'}`);
  }
  return {
    ...base,
    profile: args.profile || base.profile,
    region: args.region || base.region,
  };
}

function resolveSurfaceKeys(value, envConfig) {
  const requested = String(value || 'all').trim().toLowerCase();
  if (!requested || requested === 'all') {
    return Object.keys(envConfig.surfaces);
  }
  const keys = requested.split(',').map(item => item.trim()).filter(Boolean);
  const invalid = keys.filter(key => !envConfig.surfaces[key]);
  if (invalid.length) {
    throw new Error(`Unsupported surface(s): ${invalid.join(', ')}`);
  }
  return [...new Set(keys)];
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMaintenanceHtml(title, message) {
  const html = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    '</head>',
    '<body style="font-family:Arial,sans-serif;padding:32px;line-height:1.5;color:#1b1f23">',
    `<h1 style="margin:0 0 16px">${escapeHtml(title)}</h1>`,
    `<p style="margin:0">${escapeHtml(message)}</p>`,
    '</body></html>',
  ].join('');
  if (Buffer.byteLength(html, 'utf8') > 1024) {
    throw new Error('Maintenance page HTML exceeds the ALB fixed-response 1024 byte limit. Shorten the title or message.');
  }
  return html;
}

function getHttpsListener(envConfig) {
  const loadBalancers = runAws(
    ['elbv2', 'describe-load-balancers', '--names', envConfig.loadBalancerName],
    envConfig
  ).LoadBalancers || [];
  const loadBalancerArn = loadBalancers[0]?.LoadBalancerArn;
  if (!loadBalancerArn) {
    throw new Error(`Load balancer not found: ${envConfig.loadBalancerName}`);
  }
  const listeners = runAws(
    ['elbv2', 'describe-listeners', '--load-balancer-arn', loadBalancerArn],
    envConfig
  ).Listeners || [];
  const listener = listeners.find(item => Number(item.Port) === Number(envConfig.listenerPort));
  if (!listener?.ListenerArn) {
    throw new Error(`HTTPS listener not found on ${envConfig.loadBalancerName}:${envConfig.listenerPort}`);
  }
  return listener;
}

function getListenerRules(listenerArn, envConfig) {
  return runAws(
    ['elbv2', 'describe-rules', '--listener-arn', listenerArn],
    envConfig
  ).Rules || [];
}

function ruleHosts(rule) {
  return (rule?.Conditions || [])
    .filter(condition => condition?.Field === 'host-header')
    .flatMap(condition => condition?.HostHeaderConfig?.Values || condition?.Values || []);
}

function findRuleForHost(rules, host) {
  const candidates = (rules || [])
    .filter(rule => !rule.IsDefault)
    .filter(rule => ruleHosts(rule).includes(host))
    .map(rule => ({
      ...rule,
      numericPriority: Number(rule.Priority),
    }))
    .filter(rule => Number.isFinite(rule.numericPriority))
    .sort((a, b) => a.numericPriority - b.numericPriority);
  return candidates[0] || null;
}

function getTargetGroupArn(envConfig, targetGroupName) {
  const groups = runAws(
    ['elbv2', 'describe-target-groups', '--names', targetGroupName],
    envConfig
  ).TargetGroups || [];
  const arn = groups[0]?.TargetGroupArn;
  if (!arn) {
    throw new Error(`Target group not found: ${targetGroupName}`);
  }
  return arn;
}

function buildForwardAction(targetGroupArn) {
  return [{
    Type: 'forward',
    Order: 1,
    ForwardConfig: {
      TargetGroups: [
        {
          TargetGroupArn: targetGroupArn,
          Weight: 1,
        },
      ],
      TargetGroupStickinessConfig: {
        Enabled: false,
      },
    },
  }];
}

function buildFixedResponseAction(title, message) {
  return [{
    Type: 'fixed-response',
    FixedResponseConfig: {
      StatusCode: '503',
      ContentType: 'text/html',
      MessageBody: buildMaintenanceHtml(title, message),
    },
  }];
}

function modifyRuleActions(ruleArn, actions, envConfig) {
  runAws(
    ['elbv2', 'modify-rule', '--rule-arn', ruleArn, '--actions', JSON.stringify(actions)],
    envConfig,
    false
  );
}

function collectSurfaceStatus(surfaceKeys, rules, envConfig) {
  return surfaceKeys.map(surfaceKey => {
    const surface = envConfig.surfaces[surfaceKey];
    return {
      surface: surfaceKey,
      entries: surface.hostnames.map(host => {
        const rule = findRuleForHost(rules, host);
        const actionType = rule?.Actions?.[0]?.Type || null;
        return {
          host,
          ruleArn: rule?.RuleArn || null,
          priority: rule?.Priority || null,
          actionType,
          maintenancePageEnabled: actionType === 'fixed-response',
        };
      }),
    };
  });
}

function printHumanStatus(statusRows) {
  for (const row of statusRows) {
    console.log(`${row.surface}:`);
    for (const entry of row.entries) {
      const mode = entry.maintenancePageEnabled ? 'maintenance page enabled' : `normal (${entry.actionType || 'unknown'})`;
      console.log(`  ${entry.host}: ${mode}`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'help' || !args.command) {
    usage();
    process.exit(args.command === 'help' ? 0 : 1);
  }
  if (!['set', 'clear', 'status'].includes(args.command)) {
    throw new Error(`Unsupported command: ${args.command}`);
  }
  if (!args.env) {
    throw new Error('--env is required');
  }
  const envConfig = getEnvironmentConfig(args);
  const surfaceKeys = resolveSurfaceKeys(args.surfaces, envConfig);

  if (envConfig.name === 'prod' && args.command !== 'status' && !args.yes) {
    throw new Error('Prod maintenance fallback mutations require --yes');
  }

  const listener = getHttpsListener(envConfig);
  const rules = getListenerRules(listener.ListenerArn, envConfig);
  const before = collectSurfaceStatus(surfaceKeys, rules, envConfig);

  if (args.command === 'status') {
    if (args.json) {
      console.log(JSON.stringify({
        ok: true,
        env: envConfig.name,
        listenerArn: listener.ListenerArn,
        surfaces: before,
      }, null, 2));
    } else {
      printHumanStatus(before);
    }
    return;
  }

  const desiredActionsBySurface = new Map();
  if (args.command === 'set') {
    for (const surfaceKey of surfaceKeys) {
      desiredActionsBySurface.set(surfaceKey, buildFixedResponseAction(args.title || DEFAULT_TITLE, args.message || DEFAULT_MESSAGE));
    }
  } else {
    for (const surfaceKey of surfaceKeys) {
      const targetGroupArn = getTargetGroupArn(envConfig, envConfig.surfaces[surfaceKey].targetGroupName);
      desiredActionsBySurface.set(surfaceKey, buildForwardAction(targetGroupArn));
    }
  }

  for (const row of before) {
    const actions = desiredActionsBySurface.get(row.surface);
    for (const entry of row.entries) {
      if (!entry.ruleArn) {
        throw new Error(`No listener rule found for ${entry.host} in ${envConfig.name}`);
      }
      modifyRuleActions(entry.ruleArn, actions, envConfig);
    }
  }

  const afterRules = getListenerRules(listener.ListenerArn, envConfig);
  const after = collectSurfaceStatus(surfaceKeys, afterRules, envConfig);

  if (args.json) {
    console.log(JSON.stringify({
      ok: true,
      env: envConfig.name,
      command: args.command,
      listenerArn: listener.ListenerArn,
      before,
      after,
    }, null, 2));
  } else {
    console.log(`${args.command === 'set' ? 'Enabled' : 'Cleared'} maintenance page on ${envConfig.name}.`);
    printHumanStatus(after);
  }
}

try {
  main();
} catch (error) {
  console.error(error?.message || error);
  process.exit(1);
}
