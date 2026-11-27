// 60 fps × 3 subkadr: k-kadr vaqti t = (k-2)/180 (orqada yopiluvchi zatvor), manfiy vaqt 15 s ga o'raladi (halqa).
const {chromium}=require('playwright');const fs=require('fs');
const GLYPHS="한국어ㅇㅁㅅ KOREYS TILI ENDI O'YIN Go Topic koreys tili · o'zbek tilida HANGUL TOPIK HORI AI SO'Z BOYLIGI Bugungi maqsad 70% Hori AI ustoz Hangul 100% T1 0123456789";
(async()=>{
  const [w,h,tag,workers='4',fmt='png',limit]=process.argv.slice(2);
  const N=limit?+limit:2700, dir=`frames-${tag}`; fs.mkdirSync(dir,{recursive:true});
  const b=await chromium.launch();
  const todo=[]; for(let k=0;k<N;k++){const f=`${dir}/${String(k).padStart(5,'0')}.${fmt}`; if(!fs.existsSync(f)) todo.push(k);}
  let next=0,done=0; const t0=Date.now(); const errs=[];
  async function worker(){
    const p=await b.newPage({viewport:{width:+w,height:+h}});
    p.on('pageerror',e=>errs.push(e.message));
    await p.goto('file://'+__dirname+`/reel.html?w=${w}&h=${h}`);
    await p.evaluate(async(g)=>{for(const wt of [500,700,900]) await document.fonts.load(`${wt} 100px "Noto Sans KR"`,g); await document.fonts.ready;},GLYPHS);
    while(next<todo.length){
      const k=todo[next++]; let t=(k-2)/180; if(t<0) t+=15;
      await p.evaluate(t=>seek(t),t);
      const tmp=`${dir}/.${String(k).padStart(5,'0')}.${fmt}`;
      await p.screenshot({path:tmp,type:fmt==='png'?'png':'jpeg',...(fmt==='png'?{}:{quality:95})});
      fs.renameSync(tmp,tmp.replace('/.','/'));
      if(++done%150===0) console.log(tag,done,'/',todo.length,((Date.now()-t0)/done).toFixed(0),'ms/frame');
    }
    await p.close();
  }
  await Promise.all(Array.from({length:+workers},worker)); await b.close();
  console.log(tag,'done',todo.length,'frames in',((Date.now()-t0)/1000).toFixed(0),'s; errors:',errs.slice(0,3));
})();
