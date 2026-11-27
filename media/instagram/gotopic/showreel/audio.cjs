// Saundtrekni Chromium'ning OfflineAudioContext'ida render qilib, 24-bit WAV ga yozadi (halqa uchun dum boshiga o'raladi).
const {chromium}=require('playwright');const fs=require('fs');
const X=require('path').join(__dirname,'../../../sfx/'); // media/sfx
const SND={whooshs:'whoosh/simple-whoosh-382724.mp3',swoosh:'whoosh/swoosh-014-383768.mp3',whoosh3:'whoosh/universfield-swoosh-023-454830.mp3',
  whooshend:'whoosh/whoosh-end-384629.mp3',swoosh2:'whoosh/swoosh-2-359826.mp3',softpop:'pop/soft-subtle-ui-pop-sfx-348820.mp3',pop:'pop/soft-pop-sfx-433612.mp3',
  tick:'click/ui-sound-374228.mp3',tap:'click/confirm-tap-394001.mp3',shine:'scifi/benkirb-shine-1-268902.mp3'};
// [boshlanish, ovoz, balandlik, maks. uzunlik] — har birining cho'qqisi kadrdagi harakat bilan mos
const CUES=[[2.38,'whooshs',.5],[2.92,'swoosh',.42],[3.40,'softpop',.5],[4.24,'whoosh3',.45],[4.99,'pop',.5],[5.42,'swoosh',.38],
  [7.05,'whooshs',.3],[7.24,'whoosh3',.32],[9.0,'shine',.28,1.4],[9.16,'whooshend',.38,.9],[10.41,'tick',.5],[11.26,'tap',.55],[11.40,'softpop',.42],
  [12.51,'whooshs',.42],[13.01,'whooshs',.42],[13.51,'whooshs',.42],[13.38,'swoosh2',.55],[14.56,'whooshs',.3]];
(async()=>{
  const sfx={};for(const [k,f] of Object.entries(SND)) sfx[k]=fs.readFileSync(X+f).toString('base64');
  const b=await chromium.launch();const p=await b.newPage();
  p.on('pageerror',e=>console.log('pageerror',e.message));p.on('console',m=>console.log('page:',m.text()));
  await p.goto('file://'+__dirname+'/audio.html');
  const r=await p.evaluate(([s,c])=>renderAudio(s,c),[sfx,CUES]);await b.close();
  const raw=Buffer.from(r.b64,'base64');const f=new Float32Array(new Uint8Array(raw).buffer);
  const SR=48000,D=15*SR,frames=f.length/2;const out=new Float32Array(D*2);
  for(let i=0;i<D*2;i++) out[i]=f[i];
  for(let i=D;i<frames;i++){out[2*(i-D)]+=f[2*i];out[2*(i-D)+1]+=f[2*i+1];} // dum → boshiga (uzluksiz halqa)
  let pk=0;for(const v of out) pk=Math.max(pk,Math.abs(v));const g=0.891/pk;
  const buf=Buffer.alloc(44+D*2*3);buf.write('RIFF',0);buf.writeUInt32LE(36+D*6,4);buf.write('WAVE',8);buf.write('fmt ',12);
  buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*6,28);buf.writeUInt16LE(6,32);buf.writeUInt16LE(24,34);
  buf.write('data',36);buf.writeUInt32LE(D*6,40);
  for(let i=0;i<D*2;i++){const v=Math.max(-8388608,Math.min(8388607,Math.round(out[i]*g*8388607)));buf.writeIntLE(v,44+i*3,3);}
  fs.writeFileSync('soundtrack.wav',buf);
  console.log('latency(samples)',r.latency,'raw peak',pk.toFixed(3),'gain',g.toFixed(3));
})();
