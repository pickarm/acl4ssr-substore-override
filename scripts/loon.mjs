const LOON_SUBSCRIPTION_PLACEHOLDER = '__SUB_STORE_LOON_SUBSCRIPTION_URL__';

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
  let filterIndex = 1;

  for (const raw of groups) {
    const spec = parseGroup(raw);
    const members = [...spec.refs];

    if (spec.patterns.length) {
      const allNodes = spec.patterns.some((p) => p === '.*' || p === '^.*$');
      if (allNodes) {
        members.push('Subs');
      } else {
        const alias = `ACL4SSR_FILTER_${String(filterIndex++).padStart(2, '0')}`;
        filters.push(`${alias} = NameRegex,Subs,FilterKey = ${filterExpression(spec.patterns)}`);
        members.push(alias);
      }
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
  const remoteRules = [];
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

  return `# ACL4SSR Loon configuration template (generated file)\n# Upstream: ${upstream}\n# Upstream snapshot SHA-256: ${upstreamSha}\n# Source project: ${upstreamRepo}\n# Derived from ACL4SSR data; CC BY-SA 4.0.\n# DO NOT EDIT generated groups/rules directly; edit your node subscription URL below.\n#\n# IMPORTANT: replace ${LOON_SUBSCRIPTION_PLACEHOLDER} with a Sub-Store subscription that outputs target=Loon.\n# Example shape: https://your-sub-store.example/download/collection/all?target=Loon&includeUnsupportedProxy=true\n\n[Remote Proxy]\nSubs = ${LOON_SUBSCRIPTION_PLACEHOLDER}\n\n[Remote Filter]\n${filters.join('\n')}\n\n[Proxy Group]\n${groupLines.join('\n')}\n\n[Rule]\n${localRules.join('\n')}\n\n[Remote Rule]\n${remoteRules.join('\n')}\n`;
}

export { LOON_SUBSCRIPTION_PLACEHOLDER };
