import {cp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
const files=["index.html", "styles.css", "app.js", "favicon.svg", "assets/", "lib/"];
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const file of files) await cp(file,file==='public/'?'dist':path.join('dist',file),{recursive:true});
