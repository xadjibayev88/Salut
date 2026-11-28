const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const [app,workers='4']=process.argv.slice(2);const N=6480,dir=`frames-${app}`;fs.mkdirSync(dir,{recursive:true});
const b=await chromium.launch({args:['--allow-file-access-from-files']});const todo=[];for(let k=0;k<N;k++)if(!fs.existsSync(`${dir}/${String(k).padStart(5,'0')}.jpg`))todo.push(k);
let next=0,done=0;const t0=Date.now(),errs=[];
async function w(){const p=await b.newPage({viewport:{width:1080,height:1920}});p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+__dirname+'/film.html?app='+app);await p.evaluate(()=>window.ready);
while(next<todo.length){const k=todo[next++];const t=Math.max(0,(k-3)/240);await p.evaluate(t=>seek(t),t);
const f=`${dir}/.${String(k).padStart(5,'0')}.jpg`;await p.screenshot({path:f,type:'jpeg',quality:94});fs.renameSync(f,f.replace('/.','/'));if(++done%800===0)console.log(app,done,((Date.now()-t0)/done).toFixed(0),'ms/f');}await p.close();}
await Promise.all(Array.from({length:+workers},w));await b.close();console.log(app,'done',todo.length,((Date.now()-t0)/1000).toFixed(0)+'s',errs.slice(0,3));})();
