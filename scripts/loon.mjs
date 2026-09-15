const LOON_SUBSCRIPTION_PLACEHOLDER = '__SUB_STORE_LOON_SUBSCRIPTION_URL__';
const CHATGPT_IOS_RULE_URL = 'https://cdn.jsdelivr.net/gh/pickarm/acl4ssr-substore-override@main/overrides/ChatGPT_iOS.list';
const AI_POLICY = '💬 Ai平台';
const AI_DIRECT_REGION_GROUPS = [
  '🇺🇲 美国节点',
  '🇸🇬 狮城节点',
  '🇯🇵 日本节点',
  '🇭🇰 香港节点',
  '🇨🇳 台湾节点',
  '🇰🇷 韩国节点',
];

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
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

function filterExpression(patterns) {
  if (patterns.length === 1) return patterns[0];
  return patterns.map((p) => `(?:${p})`).join('|');
}

function buildFiltersAndGroups(groups) {
  const filters = [];
  const groupLines = [];
  const specs = groups.map(parseGroup);
  const nodeSourceByGroup = new Map();
  let filterIndex = 1;

  // Allocate each upstream node regex once, then reuse the resulting Remote
  // Filter directly in policy groups. This lets Loon show real nodes instead
  // of forcing AI through another select/url-test group first.
  for (const spec of specs) {
    if (!spec.patterns.length) continue;
    const allNodes = spec.patterns.some((p) => p === '.*' || p === '^.*$');
    if (allNodes) {
      nodeSourceByGroup.set(spec.name, 'Subs');
      continue;
    }
    const alias = `ACL4SSR_FILTER_${String(filterIndex++).padStart(2, '0')}`;
    filters.push(`${alias} = NameRegex,Subs,FilterKey = ${filterExpression(spec.patterns)}`);
    nodeSourceByGroup.set(spec.name, alias);
  }

  for (const spec of specs) {
    let members;

    if (spec.name === AI_POLICY) {
      members = AI_DIRECT_REGION_GROUPS
        .map((name) => nodeSourceByGroup.get(name))
        .filter(Boolean);
      if (!members.length) members.push('Subs');
      members.push('DIRECT');
    } else {
      members = [...spec.refs];
      const ownNodeSource = nodeSourceByGroup.get(spec.name);
      if (ownNodeSource) members.push(ownNodeSource);
    }

    const finalMembers = uniq(members);
    if (!finalMembers.length) finalMembers.push('REJECT');

    if (spec.type === 'select') {
      groupLines.push(`${spec.name} = select,${finalMembers.join(',')}`);
      continue;
    }

    if (spec.type === 'url-test') {
      groupLines.push(`${spec.name} = url-test,${finalMembers.join(',')},url = ${spec.url || 'http://www.gstatic.com/generate_204'},interval = ${spec.interval || 300},tolerance = ${spec.tolerance || 50}`);
      continue;
    }

    if (spec.type === 'fallback') {
      groupLines.push(`${spec.name} = fallback,${finalMembers.join(',')},url = ${spec.url || 'http://www.gstatic.com/generate_204'},interval = ${spec.interval || 300}`);
      continue;
    }

    if (spec.type === 'load-balance') {
      const algorithm = spec.strategy && /round/i.test(spec.strategy) ? 'round-robin' : 'pcc';
      groupLines.push(`${spec.name} = load-balance,${finalMembers.join(',')},url = ${spec.url || 'http://www.gstatic.com/generate_204'},interval = ${spec.interval || 300},algorithm = ${algorithm}`);
      continue;
    }

    throw new Error(`Unsupported Loon proxy group type: ${spec.type}`);
  }

  return { filters, groupLines };
}

function buildLoonRules(rulesets, providerSources, providers) {
  const localRules = [];
  // ChatGPT iOS dependency rules must be first-match before ACL4SSR Apple /
  // DIRECT providers. This is intentionally Loon-only; Mihomo output remains
  // derived directly from upstream ACL4SSR data.
  const remoteRules = [`${CHATGPT_IOS_RULE_URL},policy=${AI_POLICY},enabled=true`];
  const sourceToProvider = new Map();

  for (const [provider, source] of providerSources) sourceToProvider.set(source, provider);

  for (const { policy, source } of rulesets) {
    if (source.startsWith('[]')) {
      const inline = source.slice(2);
      if (inline === 'FINAL') localRules.push(`FINAL,${policy}`);
      else localRules.push(`${inline},${policy}`);
      continue;
    }

    const provider = sourceToProvider.get(source);
    if (!provider || !providers[provider]) throw new Error(`Missing mirrored provider for Loon ruleset: ${source}`);
    remoteRules.push(`${providers[provider].url},policy=${policy},enabled=true`);
  }

  return { localRules, remoteRules };
}

export function renderLoonConfig({ groups, rulesets, providerSources, providers, upstream, upstreamRepo, upstreamSha }) {
  const { filters, groupLines } = buildFiltersAndGroups(groups);
  const { localRules, remoteRules } = buildLoonRules(rulesets, providerSources, providers);

  return `# ACL4SSR Loon configuration template (generated file)\n# Upstream: ${upstream}\n# Upstream snapshot SHA-256: ${upstreamSha}\n# Source project: ${upstreamRepo}\n# Derived from ACL4SSR data; CC BY-SA 4.0.\n# DO NOT EDIT generated groups/rules directly; edit your node subscription URL below.\n#\n# IMPORTANT: replace ${LOON_SUBSCRIPTION_PLACEHOLDER} with a Sub-Store subscription that outputs target=Loon.\n# Example shape: https://your-sub-store.example/download/collection/all?target=Loon&includeUnsupportedProxy=true\n\n[General]\n# Relay-only UDP nodes are often unstable for HTTP/3. Block UDP/443 so QUIC\n# falls back to TCP/443, while leaving UDP/3478 available for ChatGPT Voice.\ndisable-udp-ports = 443\n\n[Remote Proxy]\nSubs = ${LOON_SUBSCRIPTION_PLACEHOLDER}\n\n[Remote Filter]\n${filters.join('\n')}\n\n[Proxy Group]\n${groupLines.join('\n')}\n\n[Rule]\n${localRules.join('\n')}\n\n[Remote Rule]\n${remoteRules.join('\n')}\n`;
}

export { LOON_SUBSCRIPTION_PLACEHOLDER };
