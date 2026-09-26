const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('release: all versioned entry assets exist and share the application/service-worker version',()=>{
 const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
 const app=read('app.js'),html=read('index.html'),sw=read('sw.js'),version=app.match(/const APP_VERSION='V([^']+)'/)[1];
 assert.equal(version,'8.9.17','adopted charts final release');assert.match(html,new RegExp('<title>Institutional Radar V'+version.replace(/[.]/g,'\\.')+'</title>'));
 const c=vm.createContext({self:{addEventListener(){}}});vm.runInContext(sw+';result={CACHE,ASSETS}',c);
 assert.equal(c.result.CACHE,'institutional-radar-v'+version);
 const assets=[...html.matchAll(/(?:src|href)="(\.\/[^"?]+)\?v=([^"]+)"/g)];assert.ok(assets.length>=7);
 for(const [,file,v] of assets){assert.equal(v,version);assert.ok(fs.existsSync(path.join(root,file)));assert.ok(c.result.ASSETS.includes(file+'?v='+version))}
 assert.ok(app.includes("register('./sw.js?v="+version+"'"));
});
