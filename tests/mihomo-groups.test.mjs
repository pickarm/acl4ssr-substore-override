import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const generated = readFileSync(new URL('../dist/acl4ssr-full.js', import.meta.url), 'utf8');

function generate(names) {
  const sandbox = {};
  runInNewContext(generated, sandbox);
  return sandbox.main({
    proxies: names.map((name, i) => ({
      name,
      type: 'vless',
      server: `test${i}.example.com`,
      port: 443,
      flow: 'xtls-rprx-vision'
    }))
  });
}

function target(rule) {
  return rule.slice(rule.lastIndexOf(',') + 1).trim();
}

function assertNoDanglingRules(out) {
  const policies = new Set(['DIRECT', 'REJECT', ...out['proxy-groups'].map(group => group.name)]);
  for (const rule of out.rules) {
    assert.ok(policies.has(target(rule)), `Dangling rule target: ${rule}`);
  }
}

test('personal-jp falls back to real node selection when Japan has no nodes', () => {
  const out = generate(['US 美国01移联优化', 'HK 香港三网优化']);
  const groups = out['proxy-groups'];
  assert.ok(!groups.some(group => group.name === '🇯🇵 日本节点'));
  assert.ok(groups.some(group => group.name === '🚀 节点选择'));
  assert.ok(out.rules.includes('RULE-SET,personal-jp,🚀 节点选择'));
  assert.ok(!out.rules.includes('RULE-SET,personal-jp,🇯🇵 日本节点'));
  assertNoDanglingRules(out);
});

test('personal-jp keeps Japanese policy when Japan node is present', () => {
  const out = generate(['US 美国01移联优化', 'JP 日本优化']);
  const jpGroup = out['proxy-groups'].find(group => group.name === '🇯🇵 日本节点');
  assert.ok(jpGroup);
  assert.ok(jpGroup.proxies.includes('JP 日本优化'));
  assert.ok(out.rules.includes('RULE-SET,personal-jp,🇯🇵 日本节点'));
  assertNoDanglingRules(out);
});

test('all personal groups resolve with a single US-only VLESS node', () => {
  const out = generate(['US 美国01移联优化']);
  assertNoDanglingRules(out);
  assert.ok(out.proxies.every(proxy => proxy.udp === true && proxy['packet-encoding'] === 'xudp'));
  const ai = out['proxy-groups'].find(group => group.name === '💬 Ai平台');
  assert.ok(ai && ai.proxies.includes('US 美国01移联优化'));
});
