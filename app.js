'use strict';
/* =========================================================
   받아쓰기 공부 — 앱 스크립트
   - 한글/받침 규칙, 채점, 원고지 렌더링
   - 저장소: Cloud(Supabase, 로그인) / Guest(이 기기 localStorage)
   - 화면: 로그인 → 아이 고르기 → 이번 주 → 카드/문제/채점/결과/분석
   ========================================================= */

/* ---------- 한글 ---------- */
const JONG=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const dec=ch=>{const c=(ch||'').charCodeAt(0)-0xAC00;return(c<0||c>11171||isNaN(c))?null:{cho:Math.floor(c/588),jung:Math.floor(c%588/28),jong:c%28}};
const bare=d=>String.fromCharCode(0xAC00+(d.cho*21+d.jung)*28);
const hasJong=s=>{const d=dec((s||'').slice(-1));return !!(d&&d.jong)};
const callName=n=>n?(n+(hasJong(n)?'이':'')):'';
const PUNCT=/[.,?!~'"“”‘’·…]/g;
const norm=s=>(s||'').normalize('NFC').replace(/\s+/g,' ').trim();
const strip=s=>norm((s||'').replace(PUNCT,''));

const RULES={
  link:{name:'넘어가는 받침',tip:'받침 뒤에 ㅇ으로 시작하는 글자가 오면, 받침이 뒤로 넘어가 소리 나요. 글자는 제자리에 써요.'},
  change:{name:'바뀌는 받침',tip:'받침이 다른 소리로 바뀌어 들려요. ㅅ·ㅆ·ㅈ·ㅊ·ㅌ 받침은 [ㄷ]처럼, ㅂ 받침은 ㄴ 앞에서 [ㅁ]처럼 들려요.'},
  double:{name:'두 개 받침',tip:'받침이 두 개인데 하나만 소리 나요. 안 들리는 받침도 꼭 써요.'},
  rough:{name:'ㅎ 만나면 세게',tip:'ㅎ과 ㄱ·ㄷ·ㅈ이 만나면 [ㅋ·ㅌ·ㅊ]처럼 세게 들려요.'},
  tense:{name:'된소리',tip:'[ㄲ·ㄸ·ㅃ·ㅆ·ㅉ]처럼 세게 들려도 글자는 원래대로 써요.'},
  vowel:{name:'줄여 들리는 말',tip:'빨리 말하면 줄여서 들려도, 불러 준 대로 다 써요.'}
};
function ruleFor(w,s){
  const W=[...w],S=s?[...s]:null,same=S&&S.length===W.length;
  for(let i=0;i<W.length;i++){
    const d=dec(W[i]);if(!d||!d.jong)continue;
    if(same&&S[i]===W[i]&&(i===W.length-1||S[i+1]===W[i+1]))continue;
    const nx=W[i+1]?dec(W[i+1]):null,J=JONG[d.jong];
    if(nx&&nx.cho===11&&J!=='ㅇ')return'link';
    if('ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ'.includes(J))return'double';
    if(nx&&(('ㅎㄶㅀ'.includes(J)&&[0,3,12].includes(nx.cho))||('ㄱㄷㅂㅈㅅ'.includes(J)&&nx.cho===18)))return'rough';
    if('ㅅㅆㅈㅊㅌㄲㅋㅍ'.includes(J)||(nx&&'ㄱㄷㅂ'.includes(J)&&[2,6].includes(nx.cho)))return'change';
  }
  if(same&&W.some((c,i)=>c!==S[i]))return'tense';
  return null}
function trickIdx(w,s){const W=[...w];
  if(s){const S=[...s];if(S.length===W.length)return W.map((c,i)=>c!==S[i]?i:-1).filter(i=>i>=0)}
  const out=[];W.forEach((c,i)=>{const d=dec(c);if(!d||!d.jong)return;if(ruleFor(W.slice(i,i+2).join(''),null))out.push(i)});return out}
function buildWords(t,s){
  const tw=strip(t).split(' ').filter(Boolean),sw=s?strip(s).split(' ').filter(Boolean):null,out=[];
  tw.forEach((w,i)=>{const p=sw&&sw.length===tw.length?sw[i]:null;if(p&&p===w)return;const r=ruleFor(w,p);if(r)out.push({w,s:p,r})});
  return out}

/* ---------- 기본 급수 (2학년 4급 마음을 전해요) ---------- */
const DEFAULT_SET={level:'4급',title:'마음을 전해요',items:[
 {t:'그린 것이에요.',s:'그린 거시에요',w:[{w:'것이에요',s:'거시에요',r:'link',why:'ㅅ 받침이 뒤로 넘어가 [시]로 들려요.'}]},
 {t:'뜻깊은 작품을',s:'뜯끼픈 작푸믈',w:[{w:'뜻깊은',s:'뜯끼픈',r:'change',why:'뜻의 ㅅ은 [ㄷ]처럼, 깊의 ㅍ은 뒤로 넘어가 [픈]으로 들려요.'},{w:'작품을',s:'작푸믈',r:'link',why:'ㅁ 받침이 뒤로 넘어가 [믈]로 들려요.'}]},
 {t:'우체국이 어디 있나요?',s:'우체구기 어디 인나요',w:[{w:'우체국이',s:'우체구기',r:'link',why:'ㄱ 받침이 뒤로 넘어가 [기]로 들려요.'},{w:'있나요',s:'인나요',r:'change',why:'ㅆ 받침이 ㄴ을 만나 [ㄴ]처럼 들려요.'}]},
 {t:'도와주어서 고마워!',s:'도와주어서 고마워',w:[{w:'도와주어서',s:'도와줘서',r:'vowel',why:'빨리 들으면 [도와줘서]처럼 들려도, 불러 준 대로 주어서라고 써요.'}]},
 {t:'냄새 맡은 값',s:'냄새 마튼 갑',w:[{w:'맡은',s:'마튼',r:'link',why:'ㅌ 받침이 뒤로 넘어가 [튼]으로 들려요.'},{w:'값',s:'갑',r:'double',why:'ㅂ과 ㅅ 두 받침 중 [ㅂ]만 들려요. ㅅ도 꼭 써요.'}]},
 {t:'눈을 동그랗게 뜨고',s:'누늘 동그라케 뜨고',w:[{w:'눈을',s:'누늘',r:'link',why:'ㄴ 받침이 뒤로 넘어가 [늘]로 들려요.'},{w:'동그랗게',s:'동그라케',r:'rough',why:'ㅎ 받침과 ㄱ이 만나 [케]로 들려요.'}]},
 {t:'웃음을 터뜨렸답니다.',s:'우스믈 터뜨렫땀니다',w:[{w:'웃음을',s:'우스믈',r:'link',why:'ㅅ, ㅁ 받침이 차례로 뒤로 넘어가요.'},{w:'터뜨렸답니다',s:'터뜨렫땀니다',r:'change',why:'렸의 ㅆ은 [ㄷ]처럼, 답의 ㅂ은 [ㅁ]처럼 들려요.'}]},
 {t:'어깨를 들썩거렸습니다.',s:'어깨를 들썩꺼렫씀니다',w:[{w:'들썩거렸습니다',s:'들썩꺼렫씀니다',r:'change',why:'거는 [꺼]로 세게, 렸의 ㅆ은 [ㄷ]처럼, 습은 [씀]처럼 들려요.'}]},
 {t:'끝에 있습니다.',s:'끄테 읻씀니다',w:[{w:'끝에',s:'끄테',r:'link',why:'ㅌ 받침이 뒤로 넘어가 [테]로 들려요.'},{w:'있습니다',s:'읻씀니다',r:'change',why:'ㅆ은 [ㄷ]처럼, 습은 [씀]처럼 들려요.'}]},
 {t:'느릿한 목소리로',s:'느리탄 목쏘리로',w:[{w:'느릿한',s:'느리탄',r:'rough',why:'ㅅ 받침과 ㅎ이 만나 [탄]으로 들려요.'},{w:'목소리로',s:'목쏘리로',r:'tense',why:'[쏘]로 세게 들려도 글자는 소예요.'}]}
]};

/* ---------- 유틸 ---------- */
function load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
const $=id=>document.getElementById(id);
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
const newId=()=>(crypto&&crypto.randomUUID)?crypto.randomUUID():'id'+Date.now().toString(36)+Math.random().toString(36).slice(2);
const nowIso=()=>new Date().toISOString();
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const WD='일월화수목금토';
const fmtDay=iso=>{const d=new Date(iso);return (d.getMonth()+1)+'/'+d.getDate()+' ('+WD[d.getDay()]+')'};
let toastT=0;function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3200)}

/* ---------- 저장소 ---------- */
const CFG=window.BADASSEUGI_CONFIG||{};
let sb=null;
try{if(window.supabase&&CFG.supabaseUrl&&CFG.supabaseKey)sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey)}catch(e){sb=null}
const must=({data,error})=>{if(error)throw error;return data};

const Guest={
  kind:'guest',
  _g:k=>load('bs2.'+k,[]),_s:(k,v)=>save('bs2.'+k,v),
  async children(){return this._g('children')},
  async addChild(c){const row=Object.assign({id:newId(),created_at:nowIso()},c);const a=this._g('children');a.push(row);this._s('children',a);return row},
  async loadChild(cid){const f=a=>a.filter(x=>x.child_id===cid);
    return{sets:f(this._g('sets')),sessions:f(this._g('sessions')),wres:f(this._g('wres')),ires:f(this._g('ires'))}},
  async saveSet(s){const a=this._g('sets');const row=Object.assign({},s,{updated_at:nowIso()});
    if(!row.id){row.id=newId();row.created_at=nowIso();a.push(row)}else{const i=a.findIndex(x=>x.id===row.id);if(i>=0)a[i]=row;else a.push(row)}
    this._s('sets',a);return row},
  async delSet(id){this._s('sets',this._g('sets').filter(x=>x.id!==id))},
  async addSession(sess,items,words){const s=Object.assign({id:newId(),created_at:nowIso()},sess);
    const a=this._g('sessions');a.push(s);this._s('sessions',a);
    const ir=items.map(x=>Object.assign({session_id:s.id,child_id:s.child_id,set_id:s.set_id,created_at:s.created_at},x));
    const wr=words.map(x=>Object.assign({session_id:s.id,child_id:s.child_id,set_id:s.set_id,created_at:s.created_at},x));
    this._s('ires',this._g('ires').concat(ir));this._s('wres',this._g('wres').concat(wr));
    return{session:s,items:ir,words:wr}}
};
const Cloud={
  kind:'cloud',
  async children(){return must(await sb.from('children').select('*').order('created_at'))},
  async addChild(c){return must(await sb.from('children').insert(c).select().single())},
  async loadChild(cid){
    const [sets,sessions,wres,ires]=await Promise.all([
      sb.from('word_sets').select('*').eq('child_id',cid).order('created_at'),
      sb.from('sessions').select('*').eq('child_id',cid).order('created_at'),
      sb.from('word_results').select('word,sound,rule,ok,how,set_id,session_id,created_at').eq('child_id',cid).order('created_at').limit(10000),
      sb.from('item_results').select('item_type,text,ok,tags,set_id,session_id,created_at').eq('child_id',cid).order('created_at').limit(10000)]);
    return{sets:must(sets),sessions:must(sessions),wres:must(wres),ires:must(ires)}},
  async saveSet(s){const row={child_id:s.child_id,level:s.level,title:s.title,items:s.items,real_score:s.real_score??null,updated_at:nowIso()};
    if(s.id)return must(await sb.from('word_sets').update(row).eq('id',s.id).select().single());
    return must(await sb.from('word_sets').insert(row).select().single())},
  async delSet(id){must(await sb.from('word_sets').delete().eq('id',id))},
  async addSession(sess,items,words){
    const s=must(await sb.from('sessions').insert(sess).select().single());
    const base={session_id:s.id,child_id:s.child_id,set_id:s.set_id};
    const ir=items.map(x=>Object.assign({},base,x)),wr=words.map(x=>Object.assign({},base,x));
    if(ir.length)must(await sb.from('item_results').insert(ir));
    if(wr.length)must(await sb.from('word_results').insert(wr));
    ir.forEach(x=>x.created_at=s.created_at);wr.forEach(x=>x.created_at=s.created_at);
    return{session:s,items:ir,words:wr}}
};

/* ---------- 상태 ---------- */
const S={store:null,email:'',children:[],child:null,sets:[],sessions:[],wres:[],ires:[],setId:null,stats:{},lastSent:{}};
let opts=Object.assign({where:'paper',rate:'0.85',twice:true,punct:true,shuffle:false},load('bs.opts',{}));
const cur=()=>S.sets.find(s=>s.id===S.setId)||S.sets[S.sets.length-1];
const allWords=set=>set?set.items.flatMap(it=>(it.w||[]).map(w=>Object.assign({sent:it.t},w))):[];
function rebuild(){
  const st={};S.wres.forEach(r=>{const x=st[r.word]=st[r.word]||{ok:0,ng:0,streak:0};if(r.ok){x.ok++;x.streak++}else{x.ng++;x.streak=0}});S.stats=st;
  const ls={};S.ires.forEach(r=>{if(r.item_type==='sent')ls[r.set_id+'|'+r.text]=r.ok});S.lastSent=ls}
const wStat=w=>S.stats[w]||{ok:0,ng:0,streak:0};
const isWeak=w=>{const x=wStat(w);return x.ng>0&&x.streak<2};

/* ---------- 채점 ---------- */
function lcs(x,y){const n=x.length,m=y.length,d=[];for(let i=0;i<=n;i++)d.push(new Uint16Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)d[i][j]=x[i]===y[j]?d[i+1][j+1]+1:Math.max(d[i+1][j],d[i][j+1]);
  const a=Array(n).fill(false),b=Array(m).fill(false);let i=0,j=0;
  while(i<n&&j<m){if(x[i]===y[j]){a[i]=b[j]=true;i++;j++}else if(d[i+1][j]>=d[i][j+1])i++;else j++}
  return{a,b,len:d[0][0]}}
function judge(ans,cor){
  let a=norm(ans),c=norm(cor);
  if(!opts.punct){a=strip(a);c=strip(c)}
  let kind;
  if(a===c)kind='ok';
  else if(a.replace(/ /g,'')===c.replace(/ /g,''))kind='space';
  else if(strip(a)===strip(c))kind='punct';
  else if(strip(a).replace(/ /g,'')===strip(c).replace(/ /g,''))kind='both';
  else kind='spell';
  const m=lcs([...a],[...c]);
  return{kind,a,c,aMask:m.a,cMask:m.b}}
const KIND={ok:'참 잘했어요',space:'띄어쓰기를 다시 봐요',punct:'문장부호를 다시 봐요',both:'띄어쓰기·문장부호를 다시 봐요',spell:'글자를 다시 봐요'};
const KIND_TAGS={ok:[],space:['space'],punct:['punct'],both:['space','punct'],spell:['other']};
function sameButJong(a,b){const A=[...a],B=[...b];if(A.length!==B.length)return false;let diff=0;
  for(let i=0;i<A.length;i++){if(A[i]===B[i])continue;const x=dec(A[i]),y=dec(B[i]);if(!x||!y||x.cho!==y.cho||x.jung!==y.jung)return false;diff++}return diff>0}
function diagnose(ans,words){
  const toks=strip(ans).split(' ').filter(Boolean),flat=toks.join('');
  return words.map(w=>{const tw=strip(w.w);
    if(flat.includes(tw))return{w,st:'ok'};
    if(w.s&&toks.includes(strip(w.s)))return{w,st:'sound',got:strip(w.s)};
    const j=toks.find(t=>sameButJong(t,tw));if(j)return{w,st:'jong',got:j};
    let best=null,bl=0;toks.forEach(t=>{const l=lcs([...t],[...tw]).len;if(l>bl){bl=l;best=t}});
    return{w,st:'miss',got:bl>=Math.ceil([...tw].length/2)?best:null}})}

/* ---------- 원고지 · 카드 · 결과 ---------- */
function grid(str,mask,cls){const g=el('div','grid '+(cls||''));
  if(!str){g.classList.add('empty');g.appendChild(el('span','cell','안 썼어요'));return g}
  [...str].forEach((ch,i)=>g.appendChild(el('span','cell'+(ch===' '?' sp':'')+(mask&&!mask[i]?' bad':''),ch===' '?'':ch)));return g}
function card(w){
  const c=el('div','card'),pair=el('div','pair'),span=el('span','wr'),idx=trickIdx(w.w,w.s);
  [...w.w].forEach((ch,i)=>span.appendChild(idx.includes(i)?el('span','hl',ch):document.createTextNode(ch)));pair.appendChild(span);
  if(w.s&&w.s!==w.w)pair.appendChild(el('span','snd','['+w.s+']'));
  c.appendChild(pair);
  const b=el('button',null,'듣기');b.addEventListener('click',()=>speak(w.w,0.75,1));c.appendChild(b);
  const why=el('div','why'),top=el('div');top.appendChild(el('span','chip r-'+w.r,RULES[w.r].name));top.append(' '+(w.why||RULES[w.r].tip));why.appendChild(top);
  const S2=w.s?[...w.s]:null,sameLen=S2&&S2.length===[...w.w].length,sp=el('div','split');
  [...w.w].forEach((ch,i)=>{const d=dec(ch);if(!idx.includes(i)||!d||!d.jong)return;if(sameLen){const e=dec(S2[i]);if(e&&e.jong===d.jong)return}
    const x=el('span');x.append(ch+' = '+bare(d)+' + ');x.appendChild(el('b',null,JONG[d.jong]));sp.appendChild(x)});
  if(sp.childNodes.length)why.appendChild(sp);
  c.appendChild(why);return c}
function noteFor(x){return (x.s?'소리는 ['+x.s+'] · ':'')+(x.why||RULES[x.r].tip)}
function paperItem(no,r,q){const w=el('div','item');
  const mk=el('div','mark',r.kind==='ok'?'○':'✓'),b=el('div','body');
  let label='참 잘했어요';
  if(r.kind!=='ok'){const parts=[];if(q.type==='word'||r.words.length)parts.push('받침 낱말');
    if(r.tags.includes('space'))parts.push('띄어쓰기');if(r.tags.includes('punct'))parts.push('문장부호');if(r.tags.includes('other'))parts.push('글자');
    if(!parts.length)parts.push('글자');label=parts.join('·')+(hasJong(parts[parts.length-1])?'을':'를')+' 다시 봐요'}
  b.appendChild(el('div','kind'+(r.kind==='ok'?' ok':''),no+'. '+label));
  if(r.kind!=='ok')b.appendChild(el('div','sub','바른 답'));
  b.appendChild(grid(r.c,null,'small'));
  const notes=el('ul','diag');
  const wl=q.type==='word'?(r.kind==='ok'?[]:[q.w]):q.item.w.filter(x=>r.words.includes(x.w));
  wl.forEach(x=>{const li=el('li');li.appendChild(el('b',null,x.w));li.append(' · '+noteFor(x));notes.appendChild(li)});
  if(notes.childNodes.length)b.appendChild(notes);
  w.append(mk,b);return w}
function itemEl(no,r,q){if(r.paper)return paperItem(no,r,q);
  const w=el('div','item'),mk=el('div','mark',r.kind==='ok'?'○':'✓'),b=el('div','body');
  b.appendChild(el('div','kind'+(r.kind==='ok'?' ok':''),no+'. '+(q.type==='word'&&r.kind!=='ok'?'받침을 다시 봐요':KIND[r.kind])));
  if(r.kind==='ok')b.appendChild(grid(r.a,null,'small'));
  else{b.appendChild(el('div','sub','내가 쓴 답'));b.appendChild(grid(r.a,r.aMask,'small'));
    b.appendChild(el('div','sub','바른 답'));b.appendChild(grid(r.c,r.cMask,'small answer'))}
  const notes=el('ul','diag');
  if(q.type==='sent'&&r.diag)r.diag.filter(d=>d.st!=='ok').forEach(d=>{const li=el('li');
    if(d.got){li.appendChild(el('em',null,d.got));li.append(' → ')}
    li.appendChild(el('b',null,d.w.w));
    li.append(' · '+(d.st==='sound'?'소리 나는 대로 썼어요. ':d.st==='jong'?'받침이 달라요. ':'')+(d.w.why||RULES[d.w.r].tip));notes.appendChild(li)});
  if(q.type==='word'&&r.kind!=='ok'){const li=el('li');li.append(noteFor(q.w));notes.appendChild(li)}
  if(notes.childNodes.length)b.appendChild(notes);
  w.append(mk,b);return w}

/* ---------- 소리 ---------- */
let koVoice=null,speakToken=0;const hasTTS='speechSynthesis' in window;
function pickVoice(){if(!hasTTS)return;const vs=speechSynthesis.getVoices();
  koVoice=vs.find(v=>/^ko/i.test(v.lang)&&/google|yuna|sora|heami|sun-?hi|injoon/i.test(v.name))||vs.find(v=>/^ko/i.test(v.lang))||null}
if(hasTTS){pickVoice();speechSynthesis.onvoiceschanged=pickVoice}
setTimeout(()=>{if(!hasTTS||!koVoice)$('voiceWarn').hidden=false},1500);
function speak(text,rate,times){
  if(!hasTTS)return;const t=++speakToken;speechSynthesis.cancel();
  const say=n=>{if(t!==speakToken)return;const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';if(koVoice)u.voice=koVoice;u.rate=rate;
    u.onstart=()=>$('listen').classList.add('speaking');
    u.onend=()=>{$('listen').classList.remove('speaking');if(n>1)setTimeout(()=>say(n-1),1300)};
    u.onerror=()=>$('listen').classList.remove('speaking');
    speechSynthesis.speak(u)};
  say(times)}
const stopSpeak=()=>{speakToken++;if(hasTTS)speechSynthesis.cancel()};

/* ---------- 화면 전환 ---------- */
const SCREENS=['sBoot','sAuth','sKids','sStart','sL','sQ','sM','sR','sStats','sE'];
function show(id){SCREENS.forEach(s=>$(s).hidden=s!==id);
  $('setbar').hidden=!['sStart','sL','sQ','sM','sR','sE'].includes(id)||!S.child;
  $('who').hidden=!S.store||id==='sAuth';window.scrollTo(0,0)}
function setTitle(){const t=S.child?callName(S.child.name)+'의 받아쓰기 공부':'받아쓰기 공부';$('ttl').textContent=t;document.title=t}
function goHome(){stopSpeak();renderHome();show('sStart')}

/* ---------- 로그인 ---------- */
let signUp=false;
function renderAuth(msg){
  $('authH').textContent=signUp?'보호자 회원가입':'보호자 로그인';
  $('btnAuth').textContent=signUp?'가입하기':'로그인';
  $('btnAuthToggle').textContent=signUp?'이미 계정이 있어요 · 로그인':'처음이에요 · 회원가입';
  $('aPw').autocomplete=signUp?'new-password':'current-password';
  $('authMsg').hidden=!msg;$('authMsg').textContent=msg||'';
  if(!sb){$('authForm').hidden=true;$('authMsg').hidden=false;$('authMsg').textContent='로그인 서버에 연결하지 못했어요. 로그인 없이 써 볼 수 있어요.'}
  setTitle();show('sAuth')}
$('btnAuthToggle').addEventListener('click',()=>{signUp=!signUp;renderAuth()});
$('authForm').addEventListener('submit',async e=>{e.preventDefault();
  const email=$('aEmail').value.trim(),pw=$('aPw').value;
  if(!/^\S+@\S+\.\S+$/.test(email))return renderAuth('이메일 주소를 확인해 주세요.');
  if(pw.length<6)return renderAuth('비밀번호는 6자 이상이어야 해요.');
  $('btnAuth').disabled=true;
  try{
    if(signUp){
      const {data,error}=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+location.pathname}});
      if(error)throw error;
      if(!data.session){signUp=false;renderAuth('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 여기서 로그인해 주세요.');return}
    }else{
      const {error}=await sb.auth.signInWithPassword({email,password:pw});if(error)throw error;
    }
    await enterCloud();
  }catch(err){renderAuth(authErr(err))}
  finally{$('btnAuth').disabled=false}});
function authErr(e){const m=(e&&e.message)||'';
  if(/Invalid login/i.test(m))return '이메일이나 비밀번호가 맞지 않아요.';
  if(/not confirmed/i.test(m))return '아직 가입 확인 메일의 링크를 누르지 않았어요. 메일함을 확인해 주세요.';
  if(/already registered/i.test(m))return '이미 가입한 이메일이에요. 로그인해 주세요.';
  if(/rate limit/i.test(m))return '잠시 뒤에 다시 시도해 주세요. 메일을 너무 자주 보냈어요.';
  return '로그인하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'+(m?' ('+m+')':'')}
$('btnGuest').addEventListener('click',()=>{save('bs2.guest',true);enterGuest()});
$('btnLogout').addEventListener('click',async()=>{
  if(S.store===Cloud&&sb)await sb.auth.signOut().catch(()=>{});
  save('bs2.guest',false);Object.assign(S,{store:null,email:'',children:[],child:null,sets:[],sessions:[],wres:[],ires:[]});signUp=false;renderAuth()});

async function enterCloud(){S.store=Cloud;const {data}=await sb.auth.getUser();S.email=(data&&data.user&&data.user.email)||'';$('whoMail').textContent=S.email;$('btnLogout').textContent='로그아웃';await loadKids()}
async function enterGuest(){S.store=Guest;S.email='';$('whoMail').textContent='이 기기에만 저장';$('btnLogout').textContent='로그인하기';await loadKids()}

/* ---------- 아이 ---------- */
async function loadKids(){
  try{S.children=await S.store.children()}catch(e){toast('아이 목록을 불러오지 못했어요.');S.children=[]}
  const last=load('bs2.child.'+S.store.kind,null);
  const pick=S.children.find(c=>c.id===last)||(S.children.length===1?S.children[0]:null);
  if(pick)return selectChild(pick);
  renderKids()}
function renderKids(){S.child=null;setTitle();const box=$('kidList');box.innerHTML='';
  S.children.forEach(c=>{const b=el('button');b.append(callName(c.name));if(c.grade)b.appendChild(el('span','g',c.grade+'학년'));b.addEventListener('click',()=>selectChild(c));box.appendChild(b)});
  $('kidList').hidden=!S.children.length;show('sKids');if(!S.children.length)$('kName').focus()}
$('kidForm').addEventListener('submit',async e=>{e.preventDefault();const name=norm($('kName').value);if(!name){$('kName').focus();return}
  try{const c=await S.store.addChild({name,grade:+$('kGrade').value});S.children.push(c);$('kName').value='';await selectChild(c,true)}
  catch(err){toast('아이를 추가하지 못했어요. 다시 시도해 주세요.')}});
$('btnKids').addEventListener('click',()=>{stopSpeak();renderKids()});
async function selectChild(c,isNew){
  S.child=c;save('bs2.child.'+S.store.kind,c.id);setTitle();show('sBoot');
  try{Object.assign(S,await S.store.loadChild(c.id))}catch(e){toast('기록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');S.sets=[];S.sessions=[];S.wres=[];S.ires=[]}
  if(!S.sets.length){try{S.sets=[await S.store.saveSet(Object.assign({child_id:c.id},JSON.parse(JSON.stringify(DEFAULT_SET))))]}catch(e){toast('기본 급수를 만들지 못했어요.')}}
  S.setId=load('bs2.set.'+c.id,null);if(!S.sets.find(s=>s.id===S.setId))S.setId=S.sets.length?S.sets[S.sets.length-1].id:null;
  rebuild();goHome()}

/* ---------- 주간 계획 ---------- */
const STAGES=[
  {n:1,name:'소리와 글자 익히기',days:'금~월',desc:'받침 낱말 카드로 들리는 소리와 쓰는 글자 비교'},
  {n:2,name:'받침 낱말 받아쓰기',days:'화',desc:'헷갈리는 낱말만 하나씩 듣고 쓰고 바로 확인'},
  {n:3,name:'실전 모의시험',days:'수',desc:'시험처럼 공책에 문장을 다 쓰고 한꺼번에 채점'},
  {n:4,name:'틀린 것 마지막 점검',days:'목 아침',desc:'틀린 문장과 헷갈리는 낱말만'}];
const DAY_STAGE={5:1,6:1,0:1,1:1,2:2,3:3,4:4};
function renderHome(){
  const s=cur();if(!s){renderKids();return}
  setTitle();$('lvl').textContent=s.level||'급수';$('setTitle').textContent=s.title||'';
  const sel=$('setSel');sel.innerHTML='';S.sets.forEach(x=>{const o=el('option',null,(x.level?x.level+' ':'')+(x.title||''));o.value=x.id;sel.appendChild(o)});sel.value=s.id;sel.hidden=S.sets.length<2;
  const now=new Date(),dow=now.getDay(),until=(4-dow+7)%7,thu=new Date(now);thu.setDate(now.getDate()+until);
  $('dday').textContent=until===0?'오늘이 받아쓰기 시험 날이에요':'목요일 시험까지 '+until+'일';
  $('ddayDate').textContent=until===0?'':(thu.getMonth()+1)+'월 '+thu.getDate()+'일 목요일';
  const today=DAY_STAGE[dow],ol=$('stages');ol.innerHTML='';
  STAGES.forEach(st=>{const li=el('li'),b=el('button','stage'+(st.n===today?' today':''));
    b.appendChild(el('span','n',String(st.n)));
    const nm=el('span','nm',st.name+' ');if(st.n===today)nm.appendChild(el('span','chip today','오늘'));b.appendChild(nm);
    b.appendChild(el('span','ds',st.days+' · '+st.desc));
    const last=[...S.sessions].reverse().find(l=>l.set_id===s.id&&l.stage===st.n);
    const stx=el('span','st',last?(fmtDay(last.created_at)+(last.score!=null&&last.stage!==1?' · '+last.score+'점':' · 완료')):'아직 안 했어요');b.appendChild(stx);
    if(st.n===4&&!fixQueue().length){b.disabled=true;stx.textContent='틀린 게 없어요'}
    b.addEventListener('click',()=>startStage(st.n));li.appendChild(b);ol.appendChild(li)});
  const weak=allWords(s).filter(w=>isWeak(w.w)),box=$('weak');box.innerHTML='';
  weak.forEach(w=>box.appendChild(el('span','chip',w.w+' ×'+wStat(w.w).ng)));
  const tally={};allWords(s).forEach(w=>{const n=wStat(w.w).ng;if(n)tally[w.r]=(tally[w.r]||0)+n});
  $('ruleTally').textContent=Object.keys(tally).length?'틀린 횟수: '+Object.entries(tally).sort((a,b)=>b[1]-a[1]).map(([r,n])=>RULES[r].name+' '+n+'번').join(' · '):'';
  $('weakBox').hidden=!weak.length;
  $('realScore').value=s.real_score??'';$('realMsg').textContent='';
  $('segRate').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===String(opts.rate)));
  $('segWhere').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===opts.where));
  $('optTwice').checked=opts.twice;$('optPunct').checked=opts.punct;$('optShuffle').checked=opts.shuffle}
$('setSel').addEventListener('change',e=>{S.setId=e.target.value;save('bs2.set.'+S.child.id,S.setId);renderHome()});
$('segWhere').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;opts.where=b.dataset.v;save('bs.opts',opts);renderHome()});
$('segRate').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;opts.rate=b.dataset.v;save('bs.opts',opts);renderHome()});
['Twice','Punct','Shuffle'].forEach(k=>$('opt'+k).addEventListener('change',e=>{opts[k.toLowerCase()]=e.target.checked;save('bs.opts',opts)}));
$('btnReal').addEventListener('click',async()=>{const v=$('realScore').value.trim(),s=cur();
  const n=v===''?null:Math.max(0,Math.min(100,Math.round(+v)));if(v!==''&&isNaN(n))return;
  try{const row=await S.store.saveSet(Object.assign({},s,{real_score:n}));Object.assign(s,row);$('realMsg').textContent=n==null?'지웠어요':n+'점 기록했어요'}
  catch(e){$('realMsg').textContent='저장하지 못했어요'}});

/* ---------- 1단계 카드 ---------- */
function renderLearn(){const box=$('cards');box.innerHTML='';
  cur().items.forEach((it,i)=>{const h=el('div','sentHead');h.append((i+1)+'. '+it.t+' ');
    const b=el('button',null,'문장 듣기');b.style.minHeight='34px';b.style.padding='4px 10px';b.addEventListener('click',()=>speak(it.t,parseFloat(opts.rate),1));h.appendChild(b);box.appendChild(h);
    if(!(it.w||[]).length)box.appendChild(el('div','note','받침 때문에 헷갈리는 낱말이 없어요.'));
    (it.w||[]).forEach(w=>box.appendChild(card(w)))})}
$('btnLearnDone').addEventListener('click',async()=>{await record({stage:1,mode:'learn',total:0,correct:0,score:null},[],[]);goHome()});
$('btnLearnBack').addEventListener('click',goHome);

/* ---------- 문제 진행 ---------- */
let queue=[],idx=0,answers=[],checked=[],marks=[],revealed=[],mode='each',stage=0,lastRes=[];
const paper=()=>opts.where!=='screen';
const sentQ=items=>items.map(it=>({type:'sent',text:it.t,item:it}));
const wordQ=ws=>ws.map(w=>({type:'word',text:w.w,w}));
function fixQueue(){const s=cur();if(!s)return[];
  return [...wordQ(allWords(s).filter(w=>isWeak(w.w))),...sentQ(s.items.filter(it=>S.lastSent[s.id+'|'+it.t]===false))]}
function startStage(n){const s=cur();
  if(n===1){renderLearn();show('sL');return}
  if(n===2){const weak=allWords(s).filter(w=>isWeak(w.w));begin(wordQ(weak.length>=3?weak:allWords(s)),'each',2)}
  if(n===3)begin(sentQ(s.items),'all',3);
  if(n===4)begin(fixQueue(),'each',4)}
$('btnFreeEach').addEventListener('click',()=>begin(sentQ(cur().items),'each',0));
$('btnFreeAll').addEventListener('click',()=>begin(sentQ(cur().items),'all',0));
$('btnFreeWords').addEventListener('click',()=>begin(wordQ(allWords(cur())),'each',0));

function begin(list,m,st){if(!list.length){goHome();return}
  queue=list.slice();mode=m;stage=st;
  if(opts.shuffle)for(let i=queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[queue[i],queue[j]]=[queue[j],queue[i]]}
  idx=0;answers=Array(queue.length).fill('');checked=Array(queue.length).fill(null);marks=[];revealed=[];show('sQ');renderQ(true)}
function check(i){const q=queue[i],r=judge(answers[i],q.text);if(q.type==='sent')r.diag=diagnose(answers[i],q.item.w||[]);return r}
function renderQ(autoplay){
  const q=queue[idx],P=paper();
  $('qn').textContent=idx+1;$('qt').textContent=queue.length;
  $('qKind').textContent=(q.type==='word'?'낱말 받아쓰기':'문장 받아쓰기')+(mode==='all'?' · 다 쓰고 채점':'');
  $('dots').innerHTML='';queue.forEach((_,i)=>$('dots').appendChild(el('i',i===idx?'now':(answers[i]||checked[i]||revealed[i])?'done':'')));
  $('typeArea').hidden=P;$('paperHint').hidden=!P||!!revealed[idx]||!!checked[idx];
  $('paperHint').textContent='공책에 '+(idx+1)+'번을 쓰고, 들은 대로 써요.';
  $('answer').value=answers[idx];$('answer').disabled=!!checked[idx];
  $('peek').hidden=true;$('peek').textContent=q.text;$('btnPeek').textContent='보호자: 문제 보기';
  liveGrid();
  const fb=$('fb');fb.innerHTML='';fb.hidden=!checked[idx]&&!revealed[idx];
  if(checked[idx])fb.appendChild(itemEl(idx+1,checked[idx],q));
  else if(revealed[idx])fb.appendChild(markEl(idx,()=>{$('btnNext').disabled=marks[idx].ok==null}));
  $('btnPrev').hidden=mode==='each';$('btnPrev').disabled=idx===0;
  const last=idx===queue.length-1,btn=$('btnNext');btn.disabled=false;
  if(P&&mode==='each'){btn.textContent=revealed[idx]?(last?'결과 보기':'다음 문제'):'다 썼어요 · 정답 보기';if(revealed[idx])btn.disabled=marks[idx].ok==null}
  else if(P)btn.textContent=last?'다 썼어요 · 채점하기':'다 썼어요 · 다음';
  else btn.textContent=mode==='each'?(checked[idx]?(last?'결과 보기':'다음 문제'):'확인'):(last?'채점하기':'다음');
  if(!checked[idx]&&!P)$('answer').focus({preventScroll:true});
  if(autoplay)playCur(false)}
const playCur=slow=>{const q=queue[idx];speak(q.text,slow?0.55:parseFloat(opts.rate),slow?1:(opts.twice?2:1))};
function liveGrid(){const v=$('answer').value.replace(/\s+/g,' ').replace(/^ /,''),l=$('live');l.innerHTML='';
  const g=el('div','grid');[...v].forEach(ch=>g.appendChild(el('span','cell'+(ch===' '?' sp':''),ch===' '?'':ch)));
  g.appendChild(el('span','caret'));l.appendChild(g)}
$('answer').addEventListener('input',()=>{answers[idx]=$('answer').value;liveGrid()});
$('answer').addEventListener('keydown',e=>{if(e.key!=='Enter'||e.isComposing||e.keyCode===229)return;e.preventDefault();next()});
$('btnPlay').addEventListener('click',()=>playCur(false));
$('btnSlow').addEventListener('click',()=>playCur(true));
$('btnPeek').addEventListener('click',()=>{const p=$('peek');p.hidden=!p.hidden;$('btnPeek').textContent=p.hidden?'보호자: 문제 보기':'가리기'});
$('btnPrev').addEventListener('click',()=>{answers[idx]=$('answer').value;if(idx>0){idx--;renderQ(true)}});
$('btnQuit').addEventListener('click',goHome);
function next(){
  if(paper()){
    if(mode==='each'){
      if(!revealed[idx]){revealed[idx]=true;stopSpeak();renderQ(false);return}
      if(marks[idx].ok==null)return;
      checked[idx]=paperRes(idx);
      if(idx<queue.length-1){idx++;renderQ(true)}else finish();return}
    if(idx<queue.length-1){idx++;renderQ(true);return}
    showMark();return}
  answers[idx]=$('answer').value;
  if(mode==='each'&&!checked[idx]){checked[idx]=check(idx);stopSpeak();renderQ(false);$('btnNext').focus();return}
  if(idx<queue.length-1){idx++;renderQ(true);return}
  finish()}
$('btnNext').addEventListener('click',next);

/* ---------- 종이 채점 ---------- */
function paperRes(i){const q=queue[i],m=marks[i];return{paper:true,kind:m.ok?'ok':'paperx',c:norm(q.text),words:m.ok?[]:m.words.slice(),tags:m.ok?[]:m.tags.slice()}}
function markEl(i,onChange){
  const q=queue[i],m=marks[i]=marks[i]||{ok:null,words:[],tags:[]};
  const w=el('div','item'),b=el('div','body');
  b.appendChild(el('div','sub','바른 답'));
  b.appendChild(grid(norm(q.text),null,q.type==='word'?'':'small'));
  if(q.type==='word'&&q.w.s)b.appendChild(el('div','note','소리 ['+q.w.s+'] · 글자 '+q.w.w));
  const mk=el('div','row mk'),bo=el('button','o','○ 맞았어요'),bx=el('button','x','✗ 틀렸어요');mk.append(bo,bx);b.appendChild(mk);
  const tags=el('div','tagbox');
  if(q.type==='sent'){
    tags.appendChild(el('div','sub','어디가 틀렸나요? 여러 개 골라도 돼요'));
    const row=el('div','weak');
    const mkTag=(label,key,list)=>{const t=el('button','tag',label),on=()=>m[list].includes(key);t.setAttribute('aria-pressed',on());
      t.addEventListener('click',()=>{if(on())m[list]=m[list].filter(k=>k!==key);else m[list].push(key);t.setAttribute('aria-pressed',on())});row.appendChild(t)};
    (q.item.w||[]).forEach(x=>mkTag(x.w,x.w,'words'));
    mkTag('띄어쓰기','space','tags');mkTag('문장부호','punct','tags');mkTag('다른 글자','other','tags');
    tags.appendChild(row);b.appendChild(tags)}
  const sync=()=>{bo.setAttribute('aria-pressed',m.ok===true);bx.setAttribute('aria-pressed',m.ok===false);tags.hidden=m.ok!==false;onChange&&onChange()};
  bo.addEventListener('click',()=>{m.ok=true;sync()});bx.addEventListener('click',()=>{m.ok=false;sync()});
  sync();w.append(el('div','mnum',String(i+1)),b);return w}
function showMark(){stopSpeak();const box=$('markList');box.innerHTML='';
  const upd=()=>{const left=queue.filter((_,i)=>!marks[i]||marks[i].ok==null).length;$('btnMarkDone').disabled=left>0;$('markLeft').textContent=left?left+'문제 남았어요':''};
  queue.forEach((_,i)=>box.appendChild(markEl(i,upd)));upd();show('sM')}
$('btnMarkDone').addEventListener('click',finish);

/* ---------- 기록 ---------- */
let pending=null;
async function record(sess,items,words){
  const row=Object.assign({child_id:S.child.id,set_id:cur().id,write_on:paper()?'paper':'screen'},sess);
  try{const r=await S.store.addSession(row,items,words);
    S.sessions.push(r.session);S.ires.push(...r.items);S.wres.push(...r.words);rebuild();pending=null;return true}
  catch(e){pending=[sess,items,words];return false}}
function rowsFor(){
  const items=[],words=[];
  lastRes.forEach((r,i)=>{const q=queue[i],ok=r.kind==='ok';
    items.push({item_type:q.type,text:q.text,ok,tags:r.paper?r.tags:KIND_TAGS[r.kind]||[],typed:r.paper?null:r.a});
    if(q.type==='word'){let how=null;if(!ok)how=r.paper?'mark':(diagnose(r.a,[q.w])[0].st);if(how==='ok')how='miss';
      words.push({word:q.w.w,sound:q.w.s||null,rule:q.w.r,ok,how})}
    else if(r.paper)(q.item.w||[]).forEach(w=>{const wo=ok||!r.words.includes(w.w);words.push({word:w.w,sound:w.s||null,rule:w.r,ok:wo,how:wo?null:'mark'})});
    else (r.diag||[]).forEach(d=>words.push({word:d.w.w,sound:d.w.s||null,rule:d.w.r,ok:d.st==='ok',how:d.st==='ok'?null:d.st}))});
  return{items,words}}
async function finish(){
  stopSpeak();
  lastRes=queue.map((q,i)=>checked[i]||(paper()?paperRes(i):check(i)));
  const ok=lastRes.filter(r=>r.kind==='ok').length,sc=Math.round(ok/queue.length*100);
  $('score').textContent=sc;const m=$('scoreMsg');m.innerHTML='';
  m.appendChild(el('strong',null,queue.length+'문제 중 '+ok+'문제 맞았어요.'));
  m.appendChild(el('p','note',sc===100?'하나도 안 틀렸어요!':paper()?'틀린 문장은 바른 답을 보고 공책에 한 번 더 써 봐요.':'빨간 칸은 틀린 곳, 초록 칸은 바르게 고친 곳이에요. ∨ 표시는 띄어쓰기 자리예요.'));
  const box=$('items');box.innerHTML='';lastRes.forEach((r,i)=>box.appendChild(itemEl(i+1,r,queue[i])));
  $('btnRetryWrong').hidden=ok===queue.length;$('saveMsg').hidden=true;show('sR');
  const {items,words}=rowsFor();
  const saved=await record({stage,mode,total:queue.length,correct:ok,score:sc},items,words);
  if(!saved)showSaveRetry()}
function showSaveRetry(){const w=$('saveMsg');w.hidden=false;w.innerHTML='';w.append('기록을 저장하지 못했어요. 인터넷 연결을 확인해 주세요. ');
  const b=el('button',null,'다시 저장');b.style.minHeight='36px';b.addEventListener('click',async()=>{if(!pending)return;b.disabled=true;
    const ok=await record(...pending);if(ok){w.hidden=true;toast('저장했어요')}else b.disabled=false});w.appendChild(b)}
$('btnRetryWrong').addEventListener('click',()=>begin(queue.filter((_,i)=>lastRes[i].kind!=='ok'),'each',stage));
$('btnAgain').addEventListener('click',()=>begin(queue,mode,stage));
$('btnHome').addEventListener('click',goHome);

/* ---------- 기록 분석 ---------- */
$('btnStats').addEventListener('click',renderStats);
$('btnStatsBack').addEventListener('click',goHome);
function renderStats(){
  $('statsH').textContent=callName(S.child.name)+'의 기록 분석';
  const ss=S.sessions,wr=S.wres,ir=S.ires,setName=id=>{const s=S.sets.find(x=>x.id===id);return s?(s.level||'')+' '+(s.title||''):'지운 급수'};
  // 타일
  const since=Date.now()-28*864e5,days=new Set(ss.filter(s=>new Date(s.created_at)>=since).map(s=>ymd(new Date(s.created_at))));
  const wOk=wr.filter(r=>r.ok).length,mocks=ss.filter(s=>s.mode==='all'&&s.score!=null);
  const tiles=[[ss.length+'번','지금까지 연습'],[days.size+'일','최근 4주 연습한 날'],[wr.length?Math.round(wOk/wr.length*100)+'%':'–','받침 낱말 정답률'],[mocks.length?mocks[mocks.length-1].score+'점':'–','마지막 모의시험']];
  const T=$('tiles');T.innerHTML='';tiles.forEach(([b,s])=>{const d=el('div','tile');d.append(el('b',null,b),el('span',null,s));T.appendChild(d)});
  // 점수 흐름
  const C=$('chartScore');C.innerHTML='';const pts=mocks.slice(-12);
  const reals=S.sets.filter(s=>s.real_score!=null);
  if(!pts.length&&!reals.length)C.appendChild(el('p','note','모의시험(3단계)을 하면 점수가 여기에 쌓여요.'));
  else C.appendChild(scoreChart(pts,reals));
  // 규칙별
  const R=$('ruleBars');R.innerHTML='';const by={};wr.forEach(r=>{const k=r.rule||'etc';const x=by[k]=by[k]||{ok:0,n:0};x.n++;if(r.ok)x.ok++});
  const rows=Object.entries(by).filter(([k])=>RULES[k]).sort((a,b)=>a[1].ok/a[1].n-b[1].ok/b[1].n);
  if(!rows.length)R.appendChild(el('p','note','받침 낱말 기록이 아직 없어요.'));
  rows.forEach(([k,x])=>{const p=Math.round(x.ok/x.n*100),row=el('div','bar');row.appendChild(el('span',null,RULES[k].name));
    const tr=el('div','track'),f=el('div','fill'+(p<70?' low':''));f.style.width=p+'%';tr.appendChild(f);row.appendChild(tr);row.appendChild(el('span','v',x.ok+'/'+x.n+' · '+p+'%'));R.appendChild(row)});
  // 자주 틀린 낱말
  const W=$('topWrong');W.innerHTML='';const bw={};wr.forEach(r=>{const x=bw[r.word]=bw[r.word]||{ng:0,n:0,sound:r.sound,rule:r.rule,last:null};x.n++;if(!r.ok)x.ng++;x.last=r.ok});
  const top=Object.entries(bw).filter(([,x])=>x.ng).sort((a,b)=>b[1].ng-a[1].ng).slice(0,10);
  if(!top.length)W.appendChild(el('li','note','틀린 받침 낱말이 아직 없어요.'));
  top.forEach(([w,x])=>{const li=el('li');li.appendChild(el('b',null,w));if(x.sound)li.appendChild(el('span','note','['+x.sound+']'));
    if(RULES[x.rule])li.appendChild(el('span','chip r-'+x.rule,RULES[x.rule].name));
    li.appendChild(el('span','sc',x.ng+'번'+(x.last?' · 최근엔 맞음':'')));W.appendChild(li)});
  // 틀린 이유
  const wrong=wr.filter(r=>!r.ok),cnt=k=>wrong.filter(r=>r.how===k).length,tg=k=>ir.filter(r=>!r.ok&&(r.tags||[]).includes(k)).length;
  const parts=[];if(cnt('sound'))parts.push('소리 나는 대로 쓰기 '+cnt('sound')+'번');if(cnt('jong'))parts.push('받침만 틀림 '+cnt('jong')+'번');
  if(cnt('mark'))parts.push('종이 채점에서 받침 낱말 '+cnt('mark')+'번');if(tg('space'))parts.push('띄어쓰기 '+tg('space')+'번');if(tg('punct'))parts.push('문장부호 '+tg('punct')+'번');if(tg('other'))parts.push('다른 글자 '+tg('other')+'번');
  $('whyBreak').textContent=parts.length?parts.join(' · '):'아직 틀린 기록이 없어요.';
  // 급수별 표
  const tb=$('setTable');tb.innerHTML='';const hd=el('tr');['급수','연습','모의시험 최고','실제 시험'].forEach(h=>hd.appendChild(el('th',null,h)));tb.appendChild(hd);
  S.sets.forEach(s=>{const my=ss.filter(x=>x.set_id===s.id),mk=my.filter(x=>x.mode==='all'&&x.score!=null),tr=el('tr');
    [setName(s.id),my.length+'번',mk.length?Math.max(...mk.map(x=>x.score))+'점':'–',s.real_score!=null?s.real_score+'점':'–'].forEach(v=>tr.appendChild(el('td',null,v)));tb.appendChild(tr)});
  show('sStats')}
function scoreChart(pts,reals){
  const NS='http://www.w3.org/2000/svg',w=360,h=190,L=30,Rr=12,Tp=12,B=28,mk=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e};
  const svg=mk('svg',{viewBox:'0 0 '+w+' '+h,role:'img','aria-label':'모의시험 점수 그래프'});
  const y=v=>Tp+(100-v)/100*(h-Tp-B);
  [0,50,100].forEach(v=>{svg.appendChild(mk('line',{x1:L,x2:w-Rr,y1:y(v),y2:y(v),class:'ax'}));const t=mk('text',{x:L-8,y:y(v)+4,'text-anchor':'end'});t.textContent=v;svg.appendChild(t)});
  const n=Math.max(pts.length,1),x=i=>n===1?(L+(w-Rr))/2:L+i*(w-L-Rr)/(n-1);
  if(pts.length>1)svg.appendChild(mk('polyline',{points:pts.map((p,i)=>x(i)+','+y(p.score)).join(' '),class:'ln'}));
  pts.forEach((p,i)=>{svg.appendChild(mk('circle',{cx:x(i),cy:y(p.score),r:i===pts.length-1?6:4,class:'pt'}));
    if(i===pts.length-1||pts.length<=5||i%3===0){const t=mk('text',{x:x(i),y:h-12,'text-anchor':'middle'});t.textContent=fmtDay(p.created_at).replace(/ \(.\)/,'');svg.appendChild(t)}});
  // 실제 시험 점수: 그 급수의 마지막 모의시험 위치 근처에 초록 원
  reals.forEach(s=>{const i=pts.map(p=>p.set_id).lastIndexOf(s.id);if(i<0)return;svg.appendChild(mk('circle',{cx:x(i)+10,cy:y(s.real_score),r:5,class:'rp'}))});
  const wrap=el('div');wrap.appendChild(svg);
  if(reals.length)wrap.appendChild(el('p','note','빨간 점: 모의시험 · 초록 원: 실제 목요일 시험'));
  return wrap}

/* ---------- 문장 바꾸기 ---------- */
let delArmed=false;
$('btnEdit').addEventListener('click',()=>{const s=cur();$('eLvl').value=s.level||'';$('eTtl').value=s.title||'';
  $('eList').value=s.items.map(it=>it.t+(it.s&&it.s!==strip(it.t)?' ['+it.s+']':'')).join('\n');
  delArmed=false;$('btnDelSet').textContent='이 급수 지우기';$('btnDelSet').hidden=S.sets.length<2;
  $('editNote').textContent=S.store===Cloud?'계정에 저장돼요. 다른 기기에서도 같은 문장으로 연습해요.':'이 기기의 브라우저에만 저장돼요.';show('sE')});
function parseItems(old){return $('eList').value.split('\n').map(norm).filter(Boolean).map(line=>{
  const m=line.match(/^(.*?)\s*\[([^\]]+)\]\s*$/),t=norm(m?m[1]:line),s=m?norm(m[2]):null;
  const prev=old.find(it=>it.t===t&&(!s||it.s===s));
  return prev||{t,s,w:buildWords(t,s)}})}
async function saveSet(asNew){const s=cur(),items=parseItems(s.items);if(!items.length){$('eList').focus();return}
  const data={child_id:S.child.id,level:norm($('eLvl').value),title:norm($('eTtl').value),items};
  try{
    if(asNew){const row=await S.store.saveSet(data);S.sets.push(row);S.setId=row.id}
    else{const row=await S.store.saveSet(Object.assign({},s,data));Object.assign(s,row)}
    save('bs2.set.'+S.child.id,S.setId);goHome()}
  catch(e){toast('저장하지 못했어요. 다시 시도해 주세요.')}}
$('btnSave').addEventListener('click',()=>saveSet(false));
$('btnNewSet').addEventListener('click',()=>saveSet(true));
$('btnCancel').addEventListener('click',goHome);
$('btnDelSet').addEventListener('click',async()=>{if(S.sets.length<2)return;
  if(!delArmed){delArmed=true;$('btnDelSet').textContent='한 번 더 누르면 지워져요 (기록은 남아요)';return}
  try{await S.store.delSet(cur().id);S.sets=S.sets.filter(s=>s.id!==S.setId);S.setId=S.sets[S.sets.length-1].id;save('bs2.set.'+S.child.id,S.setId);goHome()}
  catch(e){toast('지우지 못했어요.')}});

/* ---------- 시작 ---------- */
(async function boot(){
  if(sb){
    try{const {data}=await sb.auth.getSession();if(data&&data.session){await enterCloud();return}}catch(e){}
    sb.auth.onAuthStateChange((ev,session)=>{if(ev==='SIGNED_IN'&&session&&S.store!==Cloud&&!$('sAuth').hidden)enterCloud()});
  }
  if(load('bs2.guest',false))return enterGuest();
  renderAuth()})();
