import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const releaseRoot=path.join(root,'release');
const output=path.join(releaseRoot,'women-rise-legacy-sanitized-source');

const blockedDirectories=new Set(['.git','node_modules','dist','build','backups','.vercel','.railway','release','.cache','coverage']);
const blockedFileNames=new Set([
  '.env','.env.local','.env.production','.env.development','.env.test',
  'database.custom','data.sql','schema.sql','roles.sql','auth-users-and-identities.sql'
]);
const blockedExtensions=new Set(['.zip','.7z','.rar','.tgz','.gz','.dump','.bak','.backup','.custom','.log']);

function normalize(value){return value.split(path.sep).join('/');}
function isAllowed(relativePath){
  const normalized=normalize(relativePath).replace(/^\.\//,'');
  const parts=normalized.split('/');
  if(parts.some((part)=>blockedDirectories.has(part)))return false;
  const name=parts.at(-1)||'';
  if(name.startsWith('.env')&&!name.endsWith('.example'))return false;
  if(blockedFileNames.has(name))return false;
  if(blockedExtensions.has(path.extname(name).toLowerCase()))return false;
  return true;
}

function trackedFiles(){
  try{
    const output=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
    return output.split('\0').filter(Boolean);
  }catch{
    const files=[];
    function walk(current){
      for(const entry of fs.readdirSync(current,{withFileTypes:true})){
        const absolute=path.join(current,entry.name);
        const relative=path.relative(root,absolute);
        if(!isAllowed(relative))continue;
        if(entry.isDirectory())walk(absolute);
        else if(entry.isFile())files.push(relative);
      }
    }
    walk(root);
    return files;
  }
}

fs.rmSync(releaseRoot,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});

const copied=[];
for(const relative of trackedFiles()){
  if(!isAllowed(relative))continue;
  const source=path.join(root,relative);
  if(!fs.existsSync(source)||!fs.statSync(source).isFile())continue;
  const destination=path.join(output,relative);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(source,destination);
  copied.push(normalize(relative));
}

const unsafe=copied.filter((relative)=>!isAllowed(relative));
if(unsafe.length){
  fs.rmSync(releaseRoot,{recursive:true,force:true});
  throw new Error(`Unsafe files entered the release: ${unsafe.join(', ')}`);
}

const manifest=[
  'Women Rise Legacy - Sanitized Source Release',
  `Created: ${new Date().toISOString()}`,
  `Files: ${copied.length}`,
  '',
  'Excluded automatically:',
  '- .env and provider secrets',
  '- .git history',
  '- node_modules and generated dist/build files',
  '- database/Auth backups and dumps',
  '- local archives and logs',
  '',
  ...copied.sort()
].join('\n');
fs.writeFileSync(path.join(output,'SANITIZED-RELEASE-CONTENTS.txt'),manifest,'utf8');
console.log(`Sanitized source created at:\n${output}`);
console.log(`Copied ${copied.length} safe tracked files.`);
