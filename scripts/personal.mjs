import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {files} from '../docs/core.mjs';
const doc=JSON.parse(await readFile('personal/rules.json','utf8'));
await mkdir('personal',{recursive:true});
for(const [path,content] of Object.entries(files(doc))) await writeFile(path,content,'utf8');
console.log(`Personal rules: ${doc.rules.length}`);
