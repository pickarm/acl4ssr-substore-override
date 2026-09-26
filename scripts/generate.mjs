import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';

const UPSTREAM = 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini';
const UPSTREAM_REPO = 'https://github.com/ACL4SSR/ACL4SSR';
const ALLOWED_RULE_PREFIX = 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/';
const MIRROR_RAW_BASE = 'https://cdn.jsdelivr.net/gh/pickarm/acl4ssr-substore-override@main/rulesets';
const MIHOMO_OUT = 'dist/acl4ssr-full.js';
const SNAPSHOT = 'upstream/ACL4SSR_Online_Full.ini';
const RULESET_DIR = 'rulesets';

function firstComma(s) {
  const i = s.indexOf(',');
  if (i < 0) throw new Error(`Expected comma: ${s}`);
  return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

function hash8(s) {
  return sha256(s).slice(0, 8);
}

function slug(s) {
  return s
    .replace(/^https?:\/\//, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(-72) || 'ruleset';
}

function parseIni(text) {
  const rulesets = [];
  const groups = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;

    if (line.startsWith('ruleset=')) {
      const [policy, source] = firstComma(line.slice('ruleset='.length));
      rulesets.push({ policy, source });
      continue;
    }

    if (line.startsWith('custom_proxy_group=')) {
      const body = line.slice('custom_proxy_group='.length);
      const parts = body.split('`');
      if (parts.length < 2) throw new Error(`Invalid custom_proxy_group: ${line}`);
      const [name, type, ...tokens] = parts;
      groups.push({ name: name.trim(), type: type.trim(), tokens: tokens.map((x) => x.trim()).filter(Boolean) });
    }
  }

  if (rulesets.length < 10) throw new Error(`Suspiciously few rulesets parsed: ${rulesets.length}`);
  if (groups.length < 10) throw new Error(`Suspiciously few proxy groups parsed: ${groups.length}`);
  return { rulesets, groups };
}

function buildRules(rulesets) {
  const providers = {};
  const rules = [];
  const providerByUrl = new Map();
  const providerSources = new Map();

  for (const { policy, source } of rulesets) {
    if (source.startsWith('[]')) {
      const inline = source.slice(2);
      if (inline === 'FINAL') rules.push(`MATCH,${policy}`);
      else rules.push(`${inline},${policy}`);
      continue;
    }

    if (!source.startsWith(ALLOWED_RULE_PREFIX)) {
      throw new Error(`Refusing ruleset source outside ACL4SSR upstream: ${source}`);
    }

    let provider = providerByUrl.get(source);
    if (!provider) {
      const u = new URL(source);
      const base = u.pathname.split('/').pop()?.replace(/\.list$/i, '') || 'ruleset';
      provider = `${slug(base).slice(0, 40)}_${hash8(source)}`;
      providerByUrl.set(source, provider);
      providerSources.set(provider, source);
      providers[provider] = {
        type: 'http',
        behavior: 'classical',
        format: 'text',
        url: `${MIRROR_RAW_BASE}/${provider}.list`,
        path: `./ruleset/${provider}.list`,
        interval: 86400,
      };
    }
    rules.push(`RULE-SET,${provider},${policy}`);
  }

  return { providers, rules, providerSources };
}

async function mirrorRulesets(providerSources) {
  await rm(RULESET_DIR, { recursive: true, force: true });
  await mkdir(RULESET_DIR, { recursive: true });

  const manifest = [];
  for (const [provider, source] of providerSources) {
    const res = await fetch(source, { headers: { 'user-agent': 'acl4ssr-substore-override-generator' } });
    if (!res.ok) throw new Error(`Failed to fetch ruleset ${source}: HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trim()) throw new Error(`Ruleset is empty: ${source}`);
    if (/^\s*</.test(text)) throw new Error(`Ruleset looks like HTML instead of text: ${source}`);

    const normalized = text.endsWith('\n') ? text : text + '\n';
    const file = `${provider}.list`;
    await writeFile(`${RULESET_DIR}/${file}`, normalized, 'utf8');
    manifest.push({
      provider,
      source,
      mirror: `${MIRROR_RAW_BASE}/${file}`,
      sha256: sha256(normalized),
      bytes: Buffer.byteLength(normalized),
    });
  }
  return manifest;
}

function parseGroup(group) {
  const refs = [];
  const patterns = [];
  const tokens = [...group.tokens];
  let url;
  let interval;
  let tolerance;
  let strategy;

  if (['url-test', 'fallback', 'load-balance'].includes(group.type)) {
    if (tokens.length < 3) throw new Error(`Not enough tokens for ${group.type}: ${group.name}`);
    const timing = tokens.pop();
    url = tokens.pop();
    const [intervalRaw, strategyRaw, toleranceRaw] = timing.split(',');
    interval = Number(intervalRaw || 300);
    tolerance = Number(toleranceRaw || 50);
    strategy = strategyRaw || undefined;
  }

  for (const token of tokens) {
    if (token.startsWith('[]')) refs.push(token.slice(2));
    else patterns.push(token);
  }

  return { name: group.name, type: group.type, refs, patterns, url, interval, tolerance, strategy };
}

function renderMihomo({ groups, providers, rules, upstreamSha }) {
  const specs = groups.map(parseGroup);
  const header = `/*!\n * ACL4SSR Sub-Store Override (generated file)\n * Upstream: ${UPSTREAM}\n * Upstream snapshot SHA-256: ${upstreamSha}\n * Source project: ${UPSTREAM_REPO}\n * Rulesets are mirrored by this repository and refreshed by GitHub Actions.\n * Empty helper groups are pruned dynamically from the current node set.\n * Derived from ACL4SSR data; CC BY-SA 4.0.\n * DO NOT EDIT: generated by scripts/generate.mjs\n */`;

  return `${header}\n\nconst RULE_PROVIDERS = ${JSON.stringify(providers, null, 2)};\n\nconst RULES = ${JSON.stringify(rules, null, 2)};\n\nconst GROUP_SPECS = ${JSON.stringify(specs, null, 2)};\n\nconst BUILTIN_POLICIES = new Set(['DIRECT', 'REJECT']);\nconst DIRECT_NODE_SELECT_EXCLUDES = new Set(['🚀 手动切换', '🎥 奈飞节点', '🛑 广告拦截', '🍃 应用净化']);\n\nfunction uniq(items) {\n  return [...new Set(items.filter(Boolean))];\n}\n\nfunction normalizeVlessProxy(proxy) {\n  if (!proxy || typeof proxy !== 'object') return proxy;\n  if (String(proxy.type || '').toLowerCase() !== 'vless') return proxy;\n\n  // Mihomo defaults udp=false. Force VLESS nodes to accept application UDP,\n  // and encode it as XUDP inside the existing VLESS transport. For the user's\n  // Vision + REALITY nodes the outer transport remains TCP (or TCP by default).\n  return { ...proxy, udp: true, 'packet-encoding': 'xudp' };\n}\n\nfunction matchNodes(names, patterns) {\n  if (!patterns.length) return [];\n  const out = [];\n  for (const pattern of patterns) {\n    let re;\n    try { re = new RegExp(pattern, 'i'); }\n    catch (e) { throw new Error('[ACL4SSR override] Invalid upstream regex ' + pattern + ': ' + e.message); }\n    for (const name of names) if (re.test(name)) out.push(name);\n  }\n  return uniq(out);\n}\n\nfunction resolveActiveGroups(nodeNames) {\n  const matches = new Map(GROUP_SPECS.map((spec) => [spec.name, matchNodes(nodeNames, spec.patterns)]));\n  const active = new Set();\n  let changed = true;\n\n  // A group is active only if it is grounded by at least one real node/builtin\n  // or references another already-grounded group. This also collapses empty\n  // dependency chains instead of leaving REJECT placeholders behind.\n  while (changed) {\n    changed = false;\n    for (const spec of GROUP_SPECS) {\n      if (active.has(spec.name)) continue;\n      const hasNodes = (matches.get(spec.name) || []).length > 0;\n      const hasGroundedRef = spec.refs.some((ref) => BUILTIN_POLICIES.has(ref) || active.has(ref));\n      if (hasNodes || hasGroundedRef) {\n        active.add(spec.name);\n        changed = true;\n      }\n    }\n  }\n\n  return { active, matches };\n}\n\nfunction shouldExposeDirectNodes(spec) {\n  if (spec.type !== 'select' || DIRECT_NODE_SELECT_EXCLUDES.has(spec.name)) return false;\n  // Business select groups reference other policies; helper filters usually only\n  // carry regex patterns. Expose real nodes in business groups without breaking\n  // filtered helpers such as Netflix-only nodes.\n  return spec.refs.length > 0 || spec.patterns.length === 0;\n}\n\nfunction buildGroup(spec, active, matches, nodeNames) {\n  const refs = spec.refs.filter((ref) => BUILTIN_POLICIES.has(ref) || active.has(ref));\n  const directNodes = shouldExposeDirectNodes(spec) ? nodeNames : [];\n  const proxies = uniq([...refs, ...(matches.get(spec.name) || []), ...directNodes]);\n  if (!proxies.length) return null;\n\n  if (spec.type === 'select') return { name: spec.name, type: 'select', proxies };\n  if (spec.type === 'url-test' || spec.type === 'fallback') {\n    return { name: spec.name, type: spec.type, proxies, url: spec.url || 'http://www.gstatic.com/generate_204', interval: spec.interval || 300, tolerance: spec.tolerance || 50 };\n  }\n  if (spec.type === 'load-balance') {\n    return { name: spec.name, type: 'load-balance', proxies, url: spec.url || 'http://www.gstatic.com/generate_204', interval: spec.interval || 300, strategy: spec.strategy || 'consistent-hashing' };\n  }\n  throw new Error('[ACL4SSR override] Unsupported group type: ' + spec.type);\n}\n\nfunction main(config) {\n  if (!config || !Array.isArray(config.proxies) || config.proxies.length === 0) {\n    throw new Error('[ACL4SSR override] config.proxies is empty; use this script on a Clash/Mihomo file generated from Sub-Store nodes.');\n  }\n  const proxies = config.proxies.map(normalizeVlessProxy);\n  const nodeNames = proxies.map((p) => p && p.name).filter(Boolean);\n  const { active, matches } = resolveActiveGroups(nodeNames);\n  const proxyGroups = GROUP_SPECS\n    .filter((spec) => active.has(spec.name))\n    .map((spec) => buildGroup(spec, active, matches, nodeNames))\n    .filter(Boolean);\n  return { ...config, proxies, 'proxy-groups': proxyGroups, 'rule-providers': RULE_PROVIDERS, rules: RULES };\n}\n\nglobalThis.main = main;\n`;
}

async function smokeTest(mihomoText, meta, providers) {
  if (!mihomoText.includes('globalThis.main = main')) throw new Error('Generated Mihomo script is missing main export');
  if (!mihomoText.includes('resolveActiveGroups')) throw new Error('Generated Mihomo script is missing empty-group pruning');
  if (!mihomoText.includes("'rule-providers'")) throw new Error('Generated Mihomo script is missing rule-providers');
  if (mihomoText.includes('AND,((NETWORK,UDP),(DST-PORT,443)),REJECT')) {
    throw new Error('Generated Mihomo rules must not globally reject UDP/443');
  }
  if (!mihomoText.includes('function normalizeVlessProxy(proxy)')) {
    throw new Error('Generated Mihomo script is missing VLESS UDP normalization');
  }
  if (!mihomoText.includes("udp: true, 'packet-encoding': 'xudp'")) {
    throw new Error('Generated Mihomo script must force VLESS UDP with XUDP');
  }
  if (!mihomoText.includes("function shouldExposeDirectNodes(spec)")) {
    throw new Error('Generated Mihomo script is missing direct-node exposure for select groups');
  }
  if (!mihomoText.includes("DIRECT_NODE_SELECT_EXCLUDES")) {
    throw new Error('Generated Mihomo script is missing helper-group exclusions');
  }
  if (meta.rules < 10 || meta.groups < 10 || meta.providers < 5) throw new Error(`Smoke test counts too small: ${JSON.stringify(meta)}`);
  for (const [name, provider] of Object.entries(providers)) {
    if (!provider.url.startsWith(`${MIRROR_RAW_BASE}/`)) throw new Error(`Provider ${name} is not using repository mirror`);
  }
}

async function main() {
  const res = await fetch(UPSTREAM, { headers: { 'user-agent': 'acl4ssr-substore-override-generator' } });
  if (!res.ok) throw new Error(`Failed to fetch upstream: HTTP ${res.status}`);
  const text = await res.text();
  const upstreamSha = sha256(text);
  const parsed = parseIni(text);
  const { providers, rules, providerSources } = buildRules(parsed.rulesets);
  const mirroredRulesets = await mirrorRulesets(providerSources);
  const mihomoText = renderMihomo({ groups: parsed.groups, providers, rules, upstreamSha });
  const meta = { rules: rules.length, groups: parsed.groups.length, providers: Object.keys(providers).length };
  await smokeTest(mihomoText, meta, providers);
  if (mirroredRulesets.length !== meta.providers) throw new Error(`Mirrored ${mirroredRulesets.length} rulesets but generated ${meta.providers} providers`);

  await mkdir('dist', { recursive: true });
  await mkdir('upstream', { recursive: true });
  await writeFile(SNAPSHOT, text.endsWith('\n') ? text : text + '\n', 'utf8');
  await writeFile(MIHOMO_OUT, mihomoText, 'utf8');
  await writeFile('upstream.json', JSON.stringify({
    upstream: UPSTREAM,
    sha256: upstreamSha,
    ...meta,
    outputs: { mihomo: MIHOMO_OUT },
    mirroredRulesets,
  }, null, 2) + '\n', 'utf8');
  console.log(`Generated ${MIHOMO_OUT}: ${meta.rules} rules, ${meta.groups} groups, ${meta.providers} mirrored providers`);
}

await main();
