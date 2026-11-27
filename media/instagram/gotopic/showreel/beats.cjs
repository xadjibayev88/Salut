const {chromium}=require('playwright');(async()=>{const [w,h,tag,mode]=process.argv.slice(2);const b=await chromium.launch();const p=await b.newPage({viewport:{width:+w,height:+h}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('file://'+__dirname+`/reel.html?w=${w}&h=${h}`);
await p.evaluate(async()=>{const g="한국어ㅇㅁㅅ KOREYS TILI ENDI O'YIN Go Topic koreys tili · o'zbek tilida HANGUL TOPIK HORI AI SO'Z BOYLIGI Bugungi maqsad 70% Hori AI ustoz Hangul 100% T1 0123456789";for(const wt of [500,700,900]) await document.fonts.load(`${wt} 100px "Noto Sans KR"`,g);await document.fonts.ready;});
const fs=require('fs');fs.mkdirSync('beats-'+tag,{recursive:true});
const off=mode==='mid'?0.18:0.3;
for(let n=0;n<31;n++){const t=Math.min(15,n*0.5+off);await p.evaluate(t=>seek(t),t);await p.screenshot({path:`beats-${tag}/b${String(n+1).padStart(2,'0')}.jpg`,type:'jpeg',quality:70});}
await p.evaluate(()=>seek(0));await p.screenshot({path:`beats-${tag}/f0.png`});await p.evaluate(()=>seek(15));await p.screenshot({path:`beats-${tag}/f15.png`});
console.log(tag,errs.slice(0,5));await b.close()})()
