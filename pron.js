'use strict';
/* =========================================================
   표준 발음 자동 생성 (초등 받아쓰기 범위)
   어절 단위로 받침 규칙을 적용한다:
   ㅎ 축약·탈락 → 연음(겹받침 포함, 구개음화) → 대표음 → 경음화 → 비음화 → 유음화
   ========================================================= */
(function(root){
  const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.split('');
  const JONG=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const SPLIT={'ㄳ':['ㄱ','ㅅ'],'ㄵ':['ㄴ','ㅈ'],'ㄶ':['ㄴ','ㅎ'],'ㄺ':['ㄹ','ㄱ'],'ㄻ':['ㄹ','ㅁ'],'ㄼ':['ㄹ','ㅂ'],'ㄽ':['ㄹ','ㅅ'],'ㄾ':['ㄹ','ㅌ'],'ㄿ':['ㄹ','ㅍ'],'ㅀ':['ㄹ','ㅎ'],'ㅄ':['ㅂ','ㅅ']};
  const REP={'ㄱ':'ㄱ','ㄲ':'ㄱ','ㅋ':'ㄱ','ㄳ':'ㄱ','ㄺ':'ㄱ','ㄴ':'ㄴ','ㄵ':'ㄴ','ㄶ':'ㄴ','ㄷ':'ㄷ','ㅅ':'ㄷ','ㅆ':'ㄷ','ㅈ':'ㄷ','ㅊ':'ㄷ','ㅌ':'ㄷ','ㅎ':'ㄷ',
    'ㄹ':'ㄹ','ㄼ':'ㄹ','ㄽ':'ㄹ','ㄾ':'ㄹ','ㅀ':'ㄹ','ㄻ':'ㅁ','ㅁ':'ㅁ','ㅂ':'ㅂ','ㅍ':'ㅂ','ㅄ':'ㅂ','ㄿ':'ㅂ','ㅇ':'ㅇ','':''};
  const TENSE={'ㄱ':'ㄲ','ㄷ':'ㄸ','ㅂ':'ㅃ','ㅅ':'ㅆ','ㅈ':'ㅉ'};
  const ASP={'ㄱ':'ㅋ','ㄷ':'ㅌ','ㅂ':'ㅍ','ㅈ':'ㅊ','ㅅ':'ㅌ'};
  const NASAL={'ㄱ':'ㅇ','ㄷ':'ㄴ','ㅂ':'ㅁ'};

  const decompose=ch=>{const c=ch.charCodeAt(0)-0xAC00;if(c<0||c>11171)return null;return{cho:CHO[Math.floor(c/588)],jung:Math.floor(c%588/28),jong:JONG[c%28]}};
  const compose=s=>String.fromCharCode(0xAC00+(CHO.indexOf(s.cho)*21+s.jung)*28+JONG.indexOf(s.jong));

  function word(w){
    const chars=[...w];
    if(chars.some(c=>!decompose(c)))return w;          // 한글 아닌 글자가 섞이면 그대로
    const S=chars.map(decompose);
    // 밟- 예외: ㄼ 받침이 자음 앞에서 [ㅂ]
    const isBalb=i=>chars[i]==='밟';
    for(let i=0;i<S.length-1;i++){
      const a=S[i],b=S[i+1];let J=a.jong;if(!J)continue;
      // 1) ㅎ 받침(ㅎ, ㄶ, ㅀ)
      if(J==='ㅎ'||J==='ㄶ'||J==='ㅀ'){
        const rest=J==='ㅎ'?'':SPLIT[J][0];
        if('ㄱㄷㅈ'.includes(b.cho)){b.cho=ASP[b.cho];a.jong=rest;continue}
        if(b.cho==='ㅅ'){b.cho='ㅆ';a.jong=rest;continue}
        if(b.cho==='ㅇ'){a.jong=rest;J=rest;if(!J)continue}
        else if(b.cho==='ㄴ'){a.jong=J==='ㅎ'?'ㄴ':rest;J=a.jong}
      }
      // 2) 받침 + ㅎ → 거센소리
      if(b.cho==='ㅎ'&&J!=='ㄴ'&&J!=='ㄹ'&&J!=='ㅁ'&&J!=='ㅇ'){
        let keep='',m=J;if(SPLIT[J]){keep=SPLIT[J][0];m=SPLIT[J][1]}
        const r=REP[m]||m;
        if(ASP[r]||m==='ㅈ'||m==='ㅊ'){
          let asp=m==='ㅈ'||m==='ㅊ'?'ㅊ':ASP[r];
          if(r==='ㄷ'&&b.jung===20)asp='ㅊ';           // 닫히다 → [다치다]
          b.cho=asp;a.jong=keep;continue}
      }
      // 3) 연음: 받침 + ㅇ
      if(b.cho==='ㅇ'&&J!=='ㅇ'){
        let keep='',m=J;if(SPLIT[J]){keep=SPLIT[J][0];m=SPLIT[J][1]}
        if(b.jung===20&&(m==='ㄷ'||m==='ㅌ'))m=m==='ㄷ'?'ㅈ':'ㅊ';   // 구개음화: 굳이, 같이
        if(keep&&'ㄱㄷㅂ'.includes(REP[keep])&&TENSE[m])m=TENSE[m];  // 값이 → [갑씨]
        a.jong=keep;b.cho=m;continue}
      // 4) 대표음
      let r=REP[J];
      if(J==='ㄺ'&&b.cho==='ㄱ')r='ㄹ';                 // 맑게 → [말께]
      if(J==='ㄼ'&&isBalb(i))r='ㅂ';
      a.jong=r;
      // 5) 경음화
      if('ㄱㄷㅂ'.includes(r)&&TENSE[b.cho])b.cho=TENSE[b.cho];
      else if((J==='ㄺ'&&r==='ㄹ'&&b.cho==='ㄱ'))b.cho='ㄲ';
      else if((J==='ㄼ'||J==='ㄾ')&&TENSE[b.cho])b.cho=TENSE[b.cho];  // 넓게 → [널께]
      else if((J==='ㄵ'||J==='ㄻ')&&TENSE[b.cho])b.cho=TENSE[b.cho];  // 앉고 → [안꼬], 젊지 → [점찌]
      // 6) 비음화
      if(NASAL[r]&&(b.cho==='ㄴ'||b.cho==='ㅁ'))a.jong=NASAL[r];
      if((r==='ㅁ'||r==='ㅇ')&&b.cho==='ㄹ')b.cho='ㄴ';
      if(NASAL[r]&&b.cho==='ㄹ'){b.cho='ㄴ';a.jong=NASAL[r]}
      // 7) 유음화
      if(a.jong==='ㄴ'&&b.cho==='ㄹ')a.jong='ㄹ';
      else if(a.jong==='ㄹ'&&b.cho==='ㄴ')b.cho='ㄹ';
    }
    const last=S[S.length-1];
    if(last.jong)last.jong=chars[chars.length-1]==='밟'?'ㅂ':REP[last.jong];
    return S.map(compose).join('');
  }
  const PUN=/[.,?!~'"“”‘’·…]/g;
  function sentence(t){return (t||'').replace(PUN,'').replace(/\s+/g,' ').trim().split(' ').map(word).join(' ')}
  root.Pron={word,sentence,decompose};
})(typeof window!=='undefined'?window:globalThis);
