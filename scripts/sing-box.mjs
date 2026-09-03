import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const RULESET_DIR = 'rulesets';
const DIST_DIR = 'dist/sing-box';
const SOURCE_OUT = `${DIST_DIR}/ai.json`;
const BINARY_OUT = `${DIST_DIR}/ai.srs`;
const META_PATH = 'upstream.json';
const RULESET_VERSION = 3;

function addUnique(target, seen, value) {
  if (!value || seen.has(value)) return;
  seen.add(value);
  target.push(value);
}

function parseAiRuleset(text) {
  const rule = {
    domain: [],
    domain_suffix: [],
    domain_keyword: [],
    domain_regex: [],
  };
  const seen = Object.fromEntries(Object.keys(rule).map((key) => [key, new Set()]));
  const unsupported = [];

  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    const parts = line.split(',').map((part) => part.trim());
    const type = parts.shift()?.toUpperCase();
    const value = parts.shift();

    if (!type || !value || parts.length > 0) {
      unsupported.push({ line: index + 1, value: line });
      continue;
    }

    if (type === 'DOMAIN') addUnique(rule.domain, seen.domain, value);
    else if (type === 'DOMAIN-SUFFIX') addUnique(rule.domain_suffix, seen.domain_suffix, value);
    else if (type === 'DOMAIN-KEYWORD') addUnique(rule.domain_keyword, seen.domain_keyword, value);
    else if (type === 'DOMAIN-REGEX') addUnique(rule.domain_regex, seen.domain_regex, value);
    else unsupported.push({ line: index + 1, value: line });
  }

  if (unsupported.length) {
    const preview = unsupported.slice(0, 10).map((item) => `L${item.line}: ${item.value}`).join('\n');
    throw new Error(`Unsupported rules found in ACL4SSR AI ruleset:\n${preview}${unsupported.length > 10 ? `\n... and ${unsupported.length - 10} more` : ''}`);
  }

  for (const key of Object.keys(rule)) {
    if (!rule[key].length) delete rule[key];
  }

  const count = Object.values(rule).reduce((sum, values) => sum + values.length, 0);
  if (count < 10) throw new Error(`Suspiciously few AI rules converted: ${count}`);

  return {
    source: {
      version: RULESET_VERSION,
      rules: [rule],
    },
    count,
    fields: Object.fromEntries(Object.entries(rule).map(([key, values]) => [key, values.length])),
  };
}

async function findAiRuleset() {
  const files = await readdir(RULESET_DIR);
  const matches = files.filter((name) => /^AI_[0-9a-f]{8}\.list$/i.test(name));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one mirrored ACL4SSR AI ruleset, found ${matches.length}: ${matches.join(', ')}`);
  }
  return matches[0];
}

async function updateMetadata(aiFile, converted) {
  const meta = JSON.parse(await readFile(META_PATH, 'utf8'));
  const provider = aiFile.replace(/\.list$/i, '');
  const mirrored = Array.isArray(meta.mirroredRulesets)
    ? meta.mirroredRulesets.find((item) => item.provider === provider)
    : undefined;

  if (!mirrored) throw new Error(`AI provider ${provider} is missing from ${META_PATH}`);

  meta.outputs = {
    ...(meta.outputs || {}),
    singbox: {
      source: SOURCE_OUT,
      binary: BINARY_OUT,
    },
  };
  meta.singbox = {
    provider,
    upstream: mirrored.source,
    ruleSetVersion: RULESET_VERSION,
    rules: converted.count,
    fields: converted.fields,
  };

  await writeFile(META_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf8');
}

async function main() {
  const aiFile = await findAiRuleset();
  const text = await readFile(`${RULESET_DIR}/${aiFile}`, 'utf8');
  const converted = parseAiRuleset(text);

  await mkdir(DIST_DIR, { recursive: true });
  await writeFile(SOURCE_OUT, JSON.stringify(converted.source, null, 2) + '\n', 'utf8');
  await updateMetadata(aiFile, converted);

  console.log(`Generated ${SOURCE_OUT} from ${aiFile}: ${converted.count} rules (${JSON.stringify(converted.fields)})`);
}

await main();
