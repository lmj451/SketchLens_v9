(function(){
  "use strict";

  var vp=document.getElementById('viewport'), layer=document.getElementById('layer');
  var imgC=document.getElementById('img'), ictx=imgC.getContext('2d',{willReadFrequently:true});
  var drop=document.getElementById('drop'), runBtn=document.getElementById('run');
  var p1=document.getElementById('p1'), p2=document.getElementById('p2'), p3=document.getElementById('p3');
  var MAXDIM=1100, loaded=false, IW=0, IH=0, scale=1, tx=0, ty=0, fileLabel='';

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* ═══════════════════════════════════════════════════════════
     진단 기준표 — 수행계획서 "진단 기준표" 슬라이드와 같은 내용
     criteria_version: v2_draft
     · 4개 진단 항목과 항목별 점검 포인트(subs). 점수는 매기지 않는다.
     · LLM은 항목마다 상태(보완 필요 · 양호 · 판단 불가)와 고칠 점(점검 포인트 · 부위 · 문제 · 이유 · 고치는 방법)을 쓴다.
     · 선 품질 외 3개 항목의 점검 포인트는 초안 → 팀에서 확정 필요
     · 이 배열이 2단계 LLM 고정 프롬프트의 진단 기준표와 1:1로 맞아야 함
     ═══════════════════════════════════════════════════════════ */
  var AXES=[
    {id:'line_quality', name:'선 품질',
     desc:'주요 선의 단절·겹침·번짐이 구조 해석을 방해하는지',
     subs:['주요 선의 식별 가능성','필요한 연결부의 명확성','겹친 선의 해석 방해 여부']},
    {id:'proportion', name:'비율',
     desc:'대응되는 부분의 길이·너비 차이와 크기 관계',
     subs:['대응 부위의 길이 차이','대응 부위의 너비 차이','부위 간 크기 관계']},
    {id:'silhouette', name:'실루엣',
     desc:'외곽선 누락·중첩과 전체 형태의 판독 가능 여부',
     subs:['외곽선 누락 여부','외곽선 중첩 여부','전체 형태의 판독 가능성']},
    {id:'balance', name:'균형',
     desc:'대응되는 요소의 높이·위치·정렬 차이',
     subs:['대응 요소의 높이 차이','대응 요소의 위치 차이','중심선 기준 정렬']}
    // 디테일 항목은 진단 범위에서 제외 (4개 항목)
  ];
  var AXIS_BY_ID={}; AXES.forEach(function(a){ AXIS_BY_ID[a.id]=a; });

  /* 항목 상태 (2단계 LLM 응답 JSON과 동일하게 사용) — 점수 대신 쓰는 표시 */
  var STATUS={needs_work:['보완 필요','r0'], ok:['양호','r2'], cannot_judge:['판단 불가','rx']};

  (function buildGuide(){
    var h='';
    AXES.forEach(function(a){
      h+='<div class="g-item"><h3>'+esc(a.name)+'</h3><p>'+esc(a.desc)+'</p><ol>';
      a.subs.forEach(function(s){ h+='<li>'+esc(s)+'</li>'; });
      h+='</ol></div>';
    });
    document.getElementById('guideItems').innerHTML=h;
  })();


  /* ─────────── 탭 ─────────── */
  function showTab(id){
    document.querySelectorAll('#tabs button').forEach(function(x){ x.classList.toggle('on', x.dataset.p===id); });
    // 화면에 있는 패널만 전환 (사용자용 HTML에는 입력·출력 패널(p2)이 없음)
    document.querySelectorAll('.pane').forEach(function(el){ el.classList.toggle('on', el.id===id); });
  }
  document.getElementById('tabs').addEventListener('click', function(e){
    var b=e.target.closest('button'); if(b) showTab(b.dataset.p);
  });

  /* ─────────── 확대·축소·이동 ─────────── */
  function apply(){
    layer.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';
    document.getElementById('zoomVal').textContent = loaded ? Math.round(scale*100)+'%' : '—';
  }
  function cl(s){ return Math.max(0.1, Math.min(8, s)); }
  function fit(){
    if(!loaded) return;
    scale = cl(Math.min((vp.clientWidth-32)/IW, (vp.clientHeight-32)/IH));
    tx=(vp.clientWidth-IW*scale)/2; ty=(vp.clientHeight-IH*scale)/2; apply();
  }
  function zoomAt(cx,cy,f){
    if(!loaded) return;
    var ns=cl(scale*f), k=ns/scale;
    tx=cx-(cx-tx)*k; ty=cy-(cy-ty)*k; scale=ns; apply();
  }
  function zc(f){ zoomAt(vp.clientWidth/2, vp.clientHeight/2, f); }
  document.getElementById('z-in').onclick=function(){ zc(1.25); };
  document.getElementById('z-out').onclick=function(){ zc(1/1.25); };
  document.getElementById('z-fit').onclick=fit;
  document.getElementById('z-100').onclick=function(){ if(loaded) zc(1/scale); };
  vp.addEventListener('wheel', function(e){
    if(!loaded) return; e.preventDefault();
    var r=vp.getBoundingClientRect();
    zoomAt(e.clientX-r.left, e.clientY-r.top, e.deltaY<0?1.12:1/1.12);
  },{passive:false});
  var pan=false,px=0,py=0;
  vp.addEventListener('pointerdown',function(e){
    if(!loaded) return; pan=true; px=e.clientX; py=e.clientY;
    vp.classList.add('drag'); vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener('pointermove',function(e){
    if(!pan) return; tx+=e.clientX-px; ty+=e.clientY-py; px=e.clientX; py=e.clientY; apply();
  });
  function ep(){ pan=false; vp.classList.remove('drag'); }
  vp.addEventListener('pointerup',ep); vp.addEventListener('pointercancel',ep);
  window.addEventListener('resize',function(){ if(loaded) fit(); });

  /* ─────────── 이미지 로드 ─────────── */
  function loadImage(src,name){
    var im=new Image();
    im.onload=function(){
      var s=Math.min(1, MAXDIM/Math.max(im.width,im.height));
      IW=Math.round(im.width*s); IH=Math.round(im.height*s);
      imgC.width=IW; imgC.height=IH;
      ictx.fillStyle='#FFF'; ictx.fillRect(0,0,IW,IH); ictx.drawImage(im,0,0,IW,IH);
      loaded=true; drop.classList.add('hidden'); runBtn.disabled=false;
      fileLabel=name||'이미지';
      document.getElementById('fileName').textContent=fileLabel;
      document.getElementById('sizeInfo').textContent=im.width+' × '+im.height+' px';
      p1.innerHTML='<div class="empty-r"><b>진단 준비 완료</b><p>아래 진단하기를 눌러주세요.</p></div>';
      fit();
    };
    im.onerror=function(){ alert('이미지를 불러오지 못했습니다. PNG나 JPG 파일인지 확인해 주세요.'); };
    im.src=src;
  }
  /* TODO(백엔드 연동 지점): 서버로 보낼 땐 imgC.toBlob(...)으로 캔버스 이미지를 꺼내
     FormData에 담는다. (requestClassify 참고) */
  function readFile(f){
    if(!f||!/^image\/(png|jpeg)$/.test(f.type)){ alert('PNG 또는 JPG 이미지만 올릴 수 있습니다.'); return; }
    var fr=new FileReader(); fr.onload=function(){ loadImage(fr.result,f.name); }; fr.readAsDataURL(f);
  }
  document.getElementById('t-open').onclick=function(){ document.getElementById('file').click(); };
  document.getElementById('file').onchange=function(e){ readFile(e.target.files[0]); };
  ['dragenter','dragover'].forEach(function(t){ vp.addEventListener(t,function(e){ e.preventDefault(); vp.classList.add('over'); }); });
  ['dragleave','drop'].forEach(function(t){ vp.addEventListener(t,function(e){ e.preventDefault(); vp.classList.remove('over'); }); });
  vp.addEventListener('drop',function(e){ if(e.dataTransfer.files&&e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });

  /* ─────────── 예시 스케치 ─────────── */
  function su(s){ return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s); }
  var TEE='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="560" viewBox="0 0 640 560">'+
   '<rect width="640" height="560" fill="#fff"/>'+
   '<g fill="none" stroke="#2A3A42" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">'+
   '<path d="M250 120 C262 104 286 96 320 96 C354 96 378 104 390 120"/>'+
   '<path d="M250 120 L150 168 L120 276 L186 300 L196 236"/>'+
   '<path d="M390 120 L496 166 L520 252 L462 272 L452 224"/>'+
   '<path d="M196 236 L192 452 L452 452 L452 224"/>'+
   '<path d="M286 100 C300 118 340 118 354 100"/></g>'+
   '<g fill="none" stroke="#5C6A66" stroke-width="1.8" stroke-linecap="round">'+
   '<path d="M360 300 L438 300 M360 318 L434 318 M360 336 L440 336 M364 354 L432 354 M362 372 L436 372"/>'+
   '<path d="M380 396 L428 398 M384 412 L424 414"/><circle cx="330" cy="330" r="14"/>'+
   '<path d="M214 320 L250 322"/></g>'+
   '<g fill="none" stroke="#9AA4A0" stroke-width="1.4" stroke-dasharray="6 5">'+
   '<path d="M186 300 L196 236 M462 272 L452 224"/></g></svg>';
  var DRESS='<svg xmlns="http://www.w3.org/2000/svg" width="560" height="680" viewBox="0 0 560 680">'+
   '<rect width="560" height="680" fill="#fff"/>'+
   '<g fill="none" stroke="#2A3A42" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">'+
   '<path d="M186 104 C198 88 220 82 250 82 C280 82 302 88 314 104"/>'+
   '<path d="M186 104 L136 140 L150 196 L196 180"/>'+
   '<path d="M314 104 L366 138 L352 194 L306 178"/>'+
   '<path d="M196 180 L188 300 L96 596 L392 596 L312 300 L306 178"/>'+
   '<path d="M188 300 L312 300"/></g>'+
   '<g fill="none" stroke="#5C6A66" stroke-width="1.8" stroke-linecap="round">'+
   '<path d="M140 380 L176 384 M132 420 L172 424 M124 460 L168 464 M116 500 L164 504 M108 540 L160 544"/>'+
   '<path d="M212 214 L250 216 M212 244 L246 246"/></g></svg>';
  document.getElementById('t-s1').onclick=function(){ loadImage(su(TEE),'예시 · 티셔츠 도식화'); };
  /* 수정본 예시: 왼쪽 소매 높이를 오른쪽과 맞추고 점선 보조선을 정리한 티셔츠 (전후 비교 시연용) */
  var TEE_FIXED='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="560" viewBox="0 0 640 560">'+
   '<rect width="640" height="560" fill="#fff"/>'+
   '<g fill="none" stroke="#2A3A42" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">'+
   '<path d="M250 120 C262 104 286 96 320 96 C354 96 378 104 390 120"/>'+
   '<path d="M250 120 L144 166 L120 252 L178 272 L188 224"/>'+
   '<path d="M390 120 L496 166 L520 252 L462 272 L452 224"/>'+
   '<path d="M188 224 L188 452 L452 452 L452 224"/>'+
   '<path d="M286 100 C300 118 340 118 354 100"/></g>'+
   '<g fill="none" stroke="#5C6A66" stroke-width="1.8" stroke-linecap="round">'+
   '<path d="M210 300 L280 300 M210 318 L276 318 M210 336 L282 336"/>'+
   '<path d="M360 300 L430 300 M364 318 L430 318 M358 336 L430 336"/>'+
   '<path d="M300 380 L340 380"/></g></svg>';
  document.getElementById('t-s2').onclick=function(){ loadImage(su(DRESS),'예시 · 원피스'); };
  document.getElementById('t-s3').onclick=function(){ loadImage(su(TEE_FIXED),'예시 · 티셔츠 도식화 (수정본)'); };

  /* ═══════════════════════════════════════════════════════════
     프로세스 B: 고민 글 → 진단 초점
     지금은 키워드로 항목을 찾아 칩을 켜고, 해석 결과를 문장으로 보여줘 사용자가 확인·수정하게 한다.
     TODO(미정 · 회의 질문 3): 실제 해석 방식(모델이 고민 글을 읽고 focus를 정할지,
     지금처럼 키워드 규칙을 하드코딩할지)은 LLM 테스트 후 결정.
     어느 쪽이든 서버에 보내는 값은 focus 배열(항목 id 목록) 하나로 통일한다.
     ═══════════════════════════════════════════════════════════ */
  var RULES={
    line_quality:['선이','선을','선 ','끊','번지','번져','겹쳐','겹친','지저분','흐릿','연결'],
    proportion:['비율','길이','소매','총장','어깨','너비','폭','크기','짧','길어'],
    silhouette:['실루엣','외곽','윤곽','형태','모양','핏'],
    balance:['균형','대칭','좌우','한쪽','기울','비뚤','높이','정렬','치우']
  };
  var focus={}, fromText={}, chipsEl=document.getElementById('chips');
  var worryEl=document.getElementById('worry'), noteEl=document.getElementById('focusNote');

  function focusIds(){ return AXES.filter(function(a){ return focus[a.id]; }).map(function(a){ return a.id; }); }
  function chips(){
    chipsEl.innerHTML='';
    AXES.forEach(function(a){
      var b=document.createElement('button');
      b.className='chip'; b.type='button'; b.textContent=a.name; b.title=a.desc;
      b.setAttribute('aria-pressed', focus[a.id]?'true':'false');
      b.onclick=function(){ focus[a.id]=!focus[a.id]; chips(); updateNote(); };
      chipsEl.appendChild(b);
    });
  }
  function updateNote(){
    var t=worryEl.value.trim();
    if(!t){ noteEl.classList.add('hidden'); return; }
    var hits=AXES.filter(function(a){ return fromText[a.id]; }).map(function(a){ return a.name; });
    noteEl.classList.remove('hidden');
    if(hits.length){
      noteEl.innerHTML='고민 글을 <b>'+esc(hits.join(', '))+'</b> 문제로 이해했어요. 이 항목을 먼저 보여드릴게요. 맞지 않으면 위에서 항목을 바꿔주세요.';
    }else{
      noteEl.innerHTML='고민 글에서 해당하는 항목을 찾지 못했어요. 중점으로 볼 항목을 위에서 직접 골라주세요.';
    }
  }
  chips();
  worryEl.addEventListener('input',function(){
    var t=this.value, hit={};
    Object.keys(RULES).forEach(function(k){ RULES[k].forEach(function(w){ if(t.indexOf(w)>-1) hit[k]=true; }); });
    // 이전에 글에서 켜졌던 항목은 끄고, 새로 찾은 항목만 켠다 (사용자가 직접 누른 항목은 유지)
    Object.keys(fromText).forEach(function(k){ if(!hit[k]) focus[k]=false; });
    Object.keys(hit).forEach(function(k){ focus[k]=true; });
    fromText=hit;
    chips(); updateNote();
  });


  /* ═══════════════════════════════════════════════════════════
     ① 서버 요청 — MobileNetV3(분류) → LLM(진단 · 개선 방법) 2단계 구조
        지금은 서버 연동 전이라 브라우저가 같은 모양의 데모 응답을 만든다.

     [1단계] MobileNetV3 : 패션 스케치 여부 · 의류 카테고리 분류
       전이학습한 분류 모델. 클래스 = 의류 카테고리 N개 + "기타"(비패션 이미지)
       → 서버가 decideRelevance() 규칙으로 통과 / 재확인 / 거절 결정
     [2단계] 멀티모달 LLM API : 진단 기준표에 따른 항목별 진단
       입력: 스케치 이미지 + 1단계 카테고리 + 진단 기준표(4개 항목 · 점검 포인트, 고정 프롬프트) + 고민 글 · focus
       출력: 항목별 상태(보완 필요 · 양호 · 판단 불가)와 한 줄 평
             + 고칠 점(항목 · 점검 포인트 · 부위 · 문제 · 이유 · 고치는 방법 · 중요 여부) + 총평 · 고민에 대한 답
       ※ 점수는 매기지 않는다.
     [서버] 응답 형식 확인 · 고칠 점 우선순위 번호 · 로그인 상태면 기록 저장
       ※ 1단계에서 거절되면 2단계(LLM)는 부르지 않는다. 재확인이면 사용자가 확인한 뒤에 부른다.

     TODO(백엔드 연동 지점) — 서버 언어와 상관없이 주고받는 값은 같다:
       1단계  POST /api/classify   FormData(image)
              → {diagnosis_id, model, top:{label, prob}, predictions:[{label, prob}…]}
       2단계  POST /api/diagnose   {diagnosis_id, worry, focus, artwork_id|null}
              → 최종 응답 {relevance, focus, summary, worry_answer, items, issues, record?}
     ═══════════════════════════════════════════════════════════ */
  var CATEGORIES=['티셔츠','원피스','셔츠','바지','스커트','기타'];   // 데모용. 실제 클래스는 학습 데이터에 맞춰 정함
  var CRITERIA_VERSION='v2_draft', PROMPT_VERSION='p2_draft';

  function requestClassify(){
    return new Promise(function(resolve){ setTimeout(function(){ resolve(buildDemoClassify()); }, 350); });
  }
  function requestDiagnose(stage1, worry, focusList){
    return new Promise(function(resolve){ setTimeout(function(){ resolve(buildDemoDiagnose(stage1, worry, focusList)); }, 1100); });
  }

  /* 서버 역할: LLM 응답의 형식을 확인하고, 고칠 점에 우선순위 번호를 붙여 1단계 결과와 합친다.
     우선순위: 고민 · focus 항목 → 중요 표시 → 기준표 항목 순서 */
  function merge(stage1, stage2, focusList){
    var fset={}; (focusList||[]).forEach(function(id){ fset[id]=true; });
    var items={}, all=[];
    AXES.forEach(function(a, ai){
      var it=(stage2.items||{})[a.id]||{status:'cannot_judge', comment:'응답에 이 항목이 없습니다.', issues:[]};
      var iss=(it.issues||[]).filter(function(x){ return x && x.problem && x.fix; });
      var st=it.status==='cannot_judge'?'cannot_judge':(iss.length?'needs_work':'ok');
      items[a.id]={status:st, comment:it.comment||''};
      iss.forEach(function(x, xi){
        all.push({id:x.id, item:a.id, criterion:x.criterion||'', importance:x.importance==='high'?'high':'normal',
          title:x.title, where:x.where||'', problem:x.problem, why:x.why||'', fix:x.fix,
          _k:(fset[a.id]?0:1)*100+(x.importance==='high'?0:1)*10+ai+xi/10});
      });
    });
    all.sort(function(p,q){ return p._k-q._k; });
    all.forEach(function(x,i){ x.priority=i+1; delete x._k; });
    return {criteria_version:CRITERIA_VERSION, prompt_version:PROMPT_VERSION, diagnosis_id:stage1.diagnosis_id,
      relevance:{category:stage1.top.label, confidence:stage1.top.prob}, focus:focusList||[],
      summary:stage2.summary||'', worry_answer:stage2.worry_answer||null, items:items, issues:all};
  }

  /* ─────────── 로컬 데모: 픽셀 계산으로 실제 응답과 같은 모양의 JSON을 만든다 ─────────── */
  var GX=10, GY=12;
  function measure(){
    var step=Math.max(1,Math.round(Math.max(IW,IH)/420));
    var d=ictx.getImageData(0,0,IW,IH).data;
    var bw=Math.ceil(IW/step), bh=Math.ceil(IH/step), bin=new Uint8Array(bw*bh);
    var ink=0,minX=bw,maxX=0,minY=bh,maxY=0,sx=0,x,y,dark=0;
    for(y=0;y<bh;y++) for(x=0;x<bw;x++){
      var i=((y*step)*IW+(x*step))*4;
      var lum=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
      if(lum<170){
        bin[y*bw+x]=1; ink++; sx+=x;
        if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
      }
    }
    var inkRatio=ink/(bw*bh);
    if(ink<60) return {inkRatio:inkRatio, empty:true};
    var W0=Math.max(1,maxX-minX+1), H0=Math.max(1,maxY-minY+1), mid=(minX+maxX)/2;
    var cxn=(sx/ink-mid)/W0;

    // 좌우 겹침률: 선 픽셀마다 중심선 반대편 같은 위치(±2칸 허용)에 선이 있는지 확인
    function near(cx,cy){
      for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++){
        var yy=cy+oy, xx=cx+ox;
        if(yy>=0&&yy<bh&&xx>=0&&xx<bw&&bin[yy*bw+xx]) return true;
      }
      return false;
    }
    var matched=0, L=0, R=0;
    for(y=minY;y<=maxY;y++) for(x=minX;x<=maxX;x++){
      if(!bin[y*bw+x]) continue;
      if(x<mid) L++; else R++;
      if(near(Math.round(2*mid-x),y)) matched++;
    }
    var sym=matched/Math.max(1,L+R), side=Math.max(L,R)/Math.max(1,Math.min(L,R));

    // 행별 좌우 폭 차이, 선이 없는 행 비율, 좌우 최상단 높이
    var wdSum=0, wdN=0, gapRows=0, topL=-1, topR=-1;
    for(y=minY;y<=maxY;y++){
      var lx=-1, rx=-1;
      for(x=minX;x<=maxX;x++) if(bin[y*bw+x]){ if(lx<0) lx=x; rx=x; }
      if(lx<0){ gapRows++; continue; }
      if(topL<0 && lx<mid) topL=y;
      if(topR<0 && rx>mid) topR=y;
      wdSum+=Math.abs((mid-lx)-(rx-mid)); wdN++;
    }
    var widthDiff=wdN?(wdSum/wdN)/W0:0, gap=gapRows/H0;
    var topDiff=(topL<0||topR<0)?1:Math.abs(topL-topR)/H0;

    // 외곽에서 채우기 → 닫힌 영역 비율
    var seen=new Uint8Array(bw*bh), q=[], head=0;
    for(x=0;x<bw;x++){ q.push(x); q.push((bh-1)*bw+x); }
    for(y=0;y<bh;y++){ q.push(y*bw); q.push(y*bw+bw-1); }
    q.forEach(function(i){ if(!bin[i]) seen[i]=1; });
    while(head<q.length){
      var c=q[head++]; if(!seen[c]) continue;
      var cy=Math.floor(c/bw), cx=c%bw;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(dd){
        var nx=cx+dd[0], ny=cy+dd[1];
        if(nx<0||ny<0||nx>=bw||ny>=bh) return;
        var n=ny*bw+nx;
        if(!bin[n]&&!seen[n]){ seen[n]=1; q.push(n); }
      });
    }
    var box=0, enc=0;
    for(y=minY;y<=maxY;y++) for(x=minX;x<=maxX;x++){
      box++; var ii=y*bw+x; if(!bin[ii]&&!seen[ii]) enc++;
    }
    var closure=box?enc/box:0, fill=ink/box;

    // 구역별 선 밀도
    var cells=[], mean=0;
    for(var gy=0;gy<GY;gy++) for(var gx=0;gx<GX;gx++){
      var x0=minX+Math.floor(W0*gx/GX), x1=minX+Math.floor(W0*(gx+1)/GX);
      var y0=minY+Math.floor(H0*gy/GY), y1=minY+Math.floor(H0*(gy+1)/GY);
      var n=0;
      for(y=y0;y<y1;y++) for(x=x0;x<x1;x++) if(bin[y*bw+x]) n++;
      cells.push({gx:gx,gy:gy,n:n}); mean+=n;
    }
    mean/=cells.length;
    var sd=0; cells.forEach(function(c){ sd+=(c.n-mean)*(c.n-mean); });
    sd=Math.sqrt(sd/cells.length);
    var hot=cells.slice().sort(function(a,b){return b.n-a.n;})[0];
    var emptyCells=cells.filter(function(c){ return c.n<mean*0.2; }).length/cells.length;

    return {inkRatio:inkRatio, sym:sym, side:side, heavy:(L>R?'왼쪽':'오른쪽'), cxn:cxn,
      widthDiff:widthDiff, gap:gap, topDiff:topDiff, closure:closure, fill:fill,
      cv:mean?sd/mean:1, hotRatio:mean?hot.n/mean:1, hot:hot, emptyCells:emptyCells, aspect:H0/W0};
  }
  function zone(gx,gy){
    return ['왼쪽','가운데','오른쪽'][Math.min(2,Math.floor(gx/(GX/3)))]+' '+
           ['위쪽','가슴~허리','아래쪽'][Math.min(2,Math.floor(gy/(GY/3)))];
  }

  function pc(v){ return Math.round(v*100)+'%'; }

  /* 2단계 데모: LLM 진단 응답과 같은 모양
     실제 서비스에서는 LLM이 이미지를 보고 진단 기준표대로 직접 쓴다. 데모는 선 계산값으로 흉내 낸다.
     id는 데모에서 같은 고칠 점을 버전끼리 맞춰 보려고 붙인 표시 (실제 비교는 LLM이 이전 고칠 점 목록을 읽고 판단) */
  function demoChecks(m){
    var side=m.heavy;
    return {
      line_quality:[
        {hit:m.fill>0.12, high:m.fill>0.3, id:'filled', criterion:'주요 선의 식별 가능성', title:'칠한 면 때문에 주요 선이 묻혀요', where:'칠한 부분',
         problem:'선이 차지하는 면적이 '+pc(m.fill)+'로 커서 선과 면이 섞여 보여요.', why:'도식화는 선으로 구조를 읽기 때문에 면이 많으면 형태 판단이 어려워요.',
         fix:'칠한 부분을 덜어내고 몸판 · 소매의 주요 선을 한 번 더 또렷하게 그어 주세요.'},
        {hit:m.closure<0.45, high:m.closure<0.25, id:'joint_gap', criterion:'필요한 연결부의 명확성', title:'연결부가 끊겨 있어요', where:'옆선 · 어깨선 연결부',
         problem:'닫힌 영역이 '+pc(m.closure)+'뿐이라 끊긴 연결부가 남아 있어요.', why:'연결부가 끊기면 부위가 어디로 이어지는지 읽기 어려워요.',
         fix:'끊긴 옆선 · 어깨선부터 이어 그려 각 부위가 어디로 이어지는지 보이게 하세요.'},
        {hit:m.hotRatio>4, high:m.hotRatio>6, id:'line_crowd', criterion:'겹친 선의 해석 방해 여부', title:'선이 한곳에 몰려 있어요', where:zone(m.hot.gx,m.hot.gy),
         problem:'이 구역에 선이 평균의 '+m.hotRatio.toFixed(1)+'배로 몰려 있어요.', why:'보조선이 주요 선보다 먼저 눈에 띄어 구조가 잘 안 읽혀요.',
         fix:'겹친 보조선을 지우거나 연하게 정리해 주요 선이 먼저 읽히게 하세요.'}
      ],
      proportion:[
        {hit:m.side>1.15, high:m.side>1.4, id:'sleeve_length', criterion:'대응 부위의 길이 차이', title:'좌우 소매 길이가 달라요', where:side+' 소매',
         problem:side+' 쪽 선 양이 반대쪽의 '+m.side.toFixed(2)+'배예요.', why:'짝이 되는 부위의 길이가 다르면 옷이 한쪽으로 기울어 보여요.',
         fix:'어깨너비와 소매 길이 기준선을 먼저 긋고, 양쪽 소매를 같은 기준선에 맞춰 다시 그려 보세요.'},
        {hit:m.widthDiff>0.05, high:m.widthDiff>0.11, id:'width_diff', criterion:'대응 부위의 너비 차이', title:'좌우 폭이 달라요', where:'몸판 옆선',
         problem:'중심선 기준 좌우 폭 차이가 전체 너비의 '+pc(m.widthDiff)+'예요.', why:'몸판 폭이 다르면 실제 옷 치수를 읽을 수 없어요.',
         fix:'중심선을 기준으로 좌우 폭을 같은 간격으로 표시한 뒤 옆선을 다시 맞춰 보세요.'},
        {hit:m.aspect<0.7||m.aspect>2.0, high:m.aspect<0.5||m.aspect>2.6, id:'size_relation', criterion:'부위 간 크기 관계', title:'전체 비율이 어색해요', where:'전체',
         problem:'전체 세로/가로 비율이 '+m.aspect.toFixed(2)+'예요.', why:'몸판과 소매 · 기장의 크기 관계가 실제 옷과 다르면 디자인 의도가 잘못 읽혀요.',
         fix:'총장과 어깨너비 기준을 먼저 정하고, 소매 · 칼라 크기를 그 기준에 맞춰 보세요.'}
      ],
      silhouette:[
        {hit:m.gap>0.02, high:m.gap>0.08, id:'outline_gap', criterion:'외곽선 누락 여부', title:'외곽선이 비어 있어요', where:'외곽선',
         problem:'선이 비는 구간이 전체 높이의 '+pc(m.gap)+'예요.', why:'외곽이 끊기면 전체 실루엣을 읽기 어려워요.',
         fix:'비어 있는 외곽 구간을 이어 실루엣이 한 번에 닫히게 하세요.'},
        {hit:m.closure<0.4, high:m.closure<0.2, id:'shape_read', criterion:'전체 형태의 판독 가능성', title:'전체 형태가 잘 안 읽혀요', where:'몸판 · 소매 외곽',
         problem:'외곽이 닫히지 않아 어떤 형태인지 특정하기 어려워요.', why:'실루엣이 읽혀야 옷의 종류와 핏이 전달돼요.',
         fix:'몸판과 소매 외곽선을 먼저 닫아 전체 형태가 한 번에 읽히게 하세요.'}
      ],
      balance:[
        {hit:m.topDiff>0.03, high:m.topDiff>0.07, id:'shoulder_height', criterion:'대응 요소의 높이 차이', title:'좌우 어깨 높이가 달라요', where:'어깨선',
         problem:'좌우 가장 높은 지점이 전체 높이의 '+pc(m.topDiff)+'만큼 차이 나요.', why:'정면 도식화에서 어깨 높이가 다르면 옷이 기울어 보여요.',
         fix:'가로 가이드선을 하나 긋고 양쪽 어깨 끝을 그 선에 맞추세요.'},
        {hit:m.sym<0.8, high:m.sym<0.6, id:'symmetry', criterion:'대응 요소의 위치 차이', title:'좌우 위치가 어긋나요', where:'몸판 전체',
         problem:'중심선으로 접었을 때 선의 '+pc(1-m.sym)+'가 겹치지 않아요.', why:'대칭이어야 할 도식화가 어긋나면 의도한 디자인으로 읽히지 않아요.',
         fix:'앞중심선을 먼저 긋고, 한쪽을 기준으로 반대편 위치를 맞춰 보세요.'},
        {hit:Math.abs(m.cxn)>0.03, high:Math.abs(m.cxn)>0.08, id:'center_offset', criterion:'중심선 기준 정렬', title:'그림이 한쪽으로 쏠려 있어요', where:'몸판 중심',
         problem:'무게중심이 '+(m.cxn>0?'오른쪽':'왼쪽')+'으로 '+pc(Math.abs(m.cxn))+' 치우쳐 있어요.', why:'한쪽에 선이 몰리면 실제 옷보다 비대칭으로 보여요.',
         fix:'앞중심선을 기준으로 양쪽 폭을 같은 간격으로 표시한 뒤 외곽선을 맞추세요.'}
      ]
    };
  }
  var OK_COMMENT={line_quality:'주요 선이 또렷하고 연결부도 잘 이어져 있어요.', proportion:'짝이 되는 부위의 길이 · 폭과 전체 비율이 자연스러워요.',
    silhouette:'외곽선이 끊김 없이 이어져 전체 형태가 잘 읽혀요.', balance:'좌우 높이와 위치가 중심선 기준으로 잘 맞아요.'};

  function buildDemoDiagnose(stage1, worry, focusList){
    var m=measure(), out={diagnosis_id:stage1.diagnosis_id, model:'multimodal_llm (demo)', category:stage1.top.label, items:{}};
    if(m.empty){
      AXES.forEach(function(a){ out.items[a.id]={status:'cannot_judge', comment:'선이 거의 보이지 않아 점검할 수 없어요.', issues:[]}; });
      out.summary='선이 거의 보이지 않아 진단하기 어려워요. 더 진한 선으로 다시 올려 주세요.';
      out.worry_answer=worry?'이미지에서 선을 찾기 어려워 고민하신 부분을 확인하지 못했어요.':null;
      return out;
    }
    var checks=demoChecks(m), need=[];
    AXES.forEach(function(a){
      var hits=checks[a.id].filter(function(c){ return c.hit; });
      out.items[a.id]={status:hits.length?'needs_work':'ok',
        comment:hits.length?hits.length+'가지를 고치면 좋아요. '+hits[0].title:OK_COMMENT[a.id],
        issues:hits.map(function(c){ return {id:c.id, criterion:c.criterion, importance:c.high?'high':'normal', title:c.title, where:c.where, problem:c.problem, why:c.why, fix:c.fix}; })};
      if(hits.length) need.push(a.name);
    });
    out.summary=need.length
      ? need.join(' · ')+' 항목에 고칠 점이 있어요. 나머지 항목은 양호해요.'
      : '4개 항목 모두 뚜렷한 문제가 보이지 않아요. 지금 상태에서 디테일을 더해 가도 좋아요.';
    if(worry){
      var rel=(focusList||[]).filter(function(id){ return out.items[id].status==='needs_work'; });
      out.worry_answer=rel.length
        ? '고민하신 부분은 '+rel.map(function(id){ return AXIS_BY_ID[id].name; }).join(' · ')+' 항목의 문제와 관련이 있어요. 해당 고칠 점을 먼저 보여드릴게요.'
        : '고민하신 부분에서는 뚜렷한 문제가 보이지 않았어요. 대신 아래 고칠 점을 먼저 보세요.';
    }else out.worry_answer=null;
    return out;
  }

  /* 1단계 데모: MobileNetV3 분류 응답과 같은 모양 (선 밀도·비율로 흉내만 냄) */
  function buildDemoClassify(){
    var m=measure(), top, second;
    if(m.empty || m.inkRatio<0.004){ top={label:'기타',prob:0.91}; second={label:'티셔츠',prob:0.05}; }
    else if(m.inkRatio>0.55){ top={label:'티셔츠',prob:0.55}; second={label:'기타',prob:0.31}; }
    else if(m.aspect>1.15){ top={label:'원피스',prob:0.92}; second={label:'스커트',prob:0.05}; }
    else { top={label:'티셔츠',prob:0.92}; second={label:'셔츠',prob:0.05}; }
    var rest=Math.round((1-top.prob-second.prob)*100)/100;
    var third=CATEGORIES.filter(function(c){ return c!==top.label && c!==second.label; })[0];
    return {diagnosis_id:'demo-'+Date.now(), model:'mobilenetv3_small (demo)', top:top,
      predictions:[top, second, {label:third, prob:rest}]};
  }

  /* ═══════════════════════════════════════════════════════════
     ② 패션 스케치 확인 — 수행계획서 "예외처리 방식" 흐름도와 동일
       가장 높은 클래스가 "기타"   → 거절 (비패션 이미지)
       의류 카테고리, 확률 ≥ 0.8  → 통과
       의류 카테고리, 0.4 ≤ 확률 < 0.8 → 사용자 재확인 (화질 저하 등 의심)
       의류 카테고리, 확률 < 0.4  → 거절 (관련성 매우 낮음)
     기준값(0.8 / 0.4)은 검증 결과를 보고 조정한다.
     ═══════════════════════════════════════════════════════════ */
  function decideRelevance(stage1){
    var t=stage1&&stage1.top;
    if(!t) return {status:'reject', title:'분류 결과를 확인할 수 없습니다', msg:'서버 응답에 분류 결과가 없습니다.'};
    if(t.label==='기타') return {status:'reject', title:'패션 스케치로 인식되지 않았습니다', msg:'의류 스케치가 아닌 이미지로 분류되었습니다 (기타 '+Math.round(t.prob*100)+'%). 의류 스케치를 올려주세요.'};
    if(t.prob>=0.8) return {status:'pass'};
    if(t.prob>=0.4) return {status:'unsure', title:'이미지를 다시 확인해 주세요', msg:t.label+'(으)로 분류되었지만 확신도가 '+Math.round(t.prob*100)+'%로 낮습니다. 화질이 낮거나 일부가 가려졌을 수 있습니다. 의류 스케치가 맞다면 진단을 계속 진행하세요.'};
    return {status:'reject', title:'관련성이 매우 낮은 이미지입니다', msg:'어떤 의류인지 판단하기 어렵습니다 (확신도 '+Math.round(t.prob*100)+'%). 다른 이미지를 올려주세요.'};
  }

  /* ═══════════════════════════════════════════════════════════
     ③ 로그인 · 진단 기록 · 수정본 재진단 · 전후 비교

     실제 서비스의 DB 테이블 (안)
       users       (id, email, password_hash, name, created_at)
       artworks    (id, user_id, title, category, created_at, updated_at)   ← 작품 1개 = 같은 그림의 버전 묶음
       diagnoses   (id, artwork_id, version, image_path, worry, focus, criteria_version, prompt_version,
                    category, confidence, summary, worry_answer, items(JSON), issues(JSON), created_at)   ← 진단 1번 = 버전 1개
       comparisons (id, artwork_id, from_version, to_version, result(JSON), created_at)

     TODO(백엔드 연동 지점) — 아래 api* 함수들이 실제로 부를 주소
       POST   /api/auth/signup              {email, password, name}      → {token, user}
       POST   /api/auth/login               {email, password}            → {token, user}
       POST   /api/auth/logout
       POST   /api/diagnose                 {diagnosis_id, worry, focus, artwork_id|null}
              → 로그인 상태면 서버가 진단을 저장하고 최종 응답에 record:{artwork_id, version} 포함
       GET    /api/artworks                                                → 내 작품 목록
       GET    /api/artworks/{id}                                           → 작품 + 버전별 진단
       POST   /api/artworks/{id}/compare    {from_version, to_version}   → 항목 상태 변화 + 이전 고칠 점의 해결 여부 (LLM 판단)
       DELETE /api/artworks/{id}

     지금은 서버 연동 전이라 같은 모양의 데이터를 이 브라우저(localStorage)에만 임시 저장한다.
     비밀번호는 저장하지 않는다 (데모는 이메일만으로 로그인 처리).
     ═══════════════════════════════════════════════════════════ */
  var DEV=document.body.dataset.mode==='dev';

  var STORE_KEY='sketchlens_demo_v9_items', storageOK=true;
  function emptyDB(){ return {users:{}, session:null, artworks:[], diagnoses:[], seq:1}; }
  var db=(function(){
    try{ var s=localStorage.getItem(STORE_KEY); if(s) return JSON.parse(s); }catch(e){ storageOK=false; }
    return emptyDB();
  })();
  function persist(){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(db)); storageOK=true; }
    catch(e){ storageOK=false; }
  }
  function nextId(p){ return p+'_'+(db.seq++); }
  function now(){ return new Date().toISOString(); }
  function fmtDate(iso){
    var d=new Date(iso); if(isNaN(d)) return '';
    function z(n){ return (n<10?'0':'')+n; }
    return d.getFullYear()+'.'+z(d.getMonth()+1)+'.'+z(d.getDate())+' '+z(d.getHours())+':'+z(d.getMinutes());
  }
  function user(){ return db.session ? db.users[db.session] : null; }
  function delay(v,ms){ return new Promise(function(r){ setTimeout(function(){ r(v); }, ms||200); }); }
  function shortText(t,n){ t=String(t||''); return t.length>n?t.slice(0,n)+'…':t; }

  /* ── 로그인 API (데모) ── */
  function apiSignup(email,name){
    if(db.users[email]) return Promise.reject(new Error('이미 가입된 이메일입니다. 로그인해 주세요.'));
    db.users[email]={id:nextId('u'), email:email, name:name||email.split('@')[0], created_at:now()};
    db.session=email; persist();
    return delay({token:'demo-token', user:db.users[email]});
  }
  function apiLogin(email){
    if(!db.users[email]) return Promise.reject(new Error('가입되지 않은 이메일입니다. 회원가입을 먼저 해 주세요.'));
    db.session=email; persist();
    return delay({token:'demo-token', user:db.users[email]});
  }
  function apiLogout(){ db.session=null; persist(); return delay({ok:true},50); }

  /* ── 기록 API (데모) ── */
  function myArtworks(){ var u=user(); return u?db.artworks.filter(function(a){ return a.user_id===u.id; }):[]; }
  function versionsOf(artId){
    return db.diagnoses.filter(function(d){ return d.artwork_id===artId; }).sort(function(a,b){ return a.version-b.version; });
  }
  function artById(id){ var u=user(); return db.artworks.filter(function(a){ return a.id===id && u && a.user_id===u.id; })[0]||null; }
  function issueCount(d){ return (d.issues||[]).length; }
  function topIssue(d){ var i=(d.issues||[])[0]; return i?i.title:'없음'; }
  function needCount(d){ return AXES.filter(function(a){ return ((d.items||{})[a.id]||{}).status==='needs_work'; }).length; }
  function stBadge(st){ var x=STATUS[st]||STATUS.cannot_judge; return '<span class="rt '+x[1]+'">'+x[0]+'</span>'; }

  /* 서버가 /api/diagnose 안에서 하는 저장을 흉내 냄 */
  function saveDiagnosis(final, artworkId, thumb){
    var u=user(); if(!u) return null;
    var art=artworkId?artById(artworkId):null;
    if(!art){
      art={id:nextId('a'), user_id:u.id, title:(fileLabel||'스케치').replace(/\.(png|jpe?g)$/i,''),
        category:final.relevance.category, created_at:now(), updated_at:now()};
      db.artworks.push(art);
    }
    var vs=versionsOf(art.id), ver=vs.length?vs[vs.length-1].version+1:1;
    var rec={id:nextId('d'), artwork_id:art.id, version:ver, created_at:now(), image:thumb, file_label:fileLabel,
      worry:worryEl.value.trim(), focus:final.focus, criteria_version:final.criteria_version, prompt_version:final.prompt_version,
      category:final.relevance.category, confidence:final.relevance.confidence, summary:final.summary,
      worry_answer:final.worry_answer, items:final.items, issues:final.issues};
    db.diagnoses.push(rec);
    art.updated_at=rec.created_at;
    persist();
    return {artwork_id:art.id, version:ver, title:art.title};
  }
  function apiListArtworks(){
    return delay(myArtworks().map(function(a){
      var vs=versionsOf(a.id), last=vs[vs.length-1], first=vs[0];
      return {id:a.id, title:a.title, category:a.category, version_count:vs.length, updated_at:a.updated_at,
        first_issues:first?issueCount(first):null,
        latest:last?{version:last.version, issues:issueCount(last), need:needCount(last), top:topIssue(last), image:last.image}:null,
        resolved_since_v1:(first&&last&&first!==last)?compareCore(first,last).counts.resolved:null};
    }).sort(function(x,y){ return x.updated_at<y.updated_at?1:-1; }), 120);
  }
  function apiGetArtwork(id){
    var a=artById(id);
    return a?delay({artwork:a, versions:versionsOf(id)},120):Promise.reject(new Error('작품을 찾을 수 없습니다.'));
  }
  function apiDeleteArtwork(id){
    db.artworks=db.artworks.filter(function(a){ return a.id!==id; });
    db.diagnoses=db.diagnoses.filter(function(d){ return d.artwork_id!==id; });
    persist(); return delay({ok:true},80);
  }
  function apiCompare(id, from, to){
    var vs=versionsOf(id), a=vs.filter(function(v){ return v.version===from; })[0], b=vs.filter(function(v){ return v.version===to; })[0];
    if(!a||!b) return Promise.reject(new Error('비교할 버전을 찾을 수 없습니다.'));
    var r=compareCore(a,b);
    r.artwork_id=id; r.from_version=from; r.to_version=to; r.model='llm (demo)';
    return delay(r, 700);
  }

  /* 전후 비교 데모 — 실제로는 LLM이 두 버전의 이미지와 이전 진단(항목 상태 · 고칠 점)을 보고 판단한다.
     item_changes: 항목별 상태 변화 / issue_results: 이전 고칠 점마다 resolved(해결) · partial(일부 해결) · remaining(남음)
     new_issues: 새로 생긴 고칠 점 */
  function compareCore(a,b){
    var bi={}; (b.issues||[]).forEach(function(x){ bi[x.id]=x; });
    var ai={}; (a.issues||[]).forEach(function(x){ ai[x.id]=x; });
    var changes=AXES.map(function(ax){
      var s1=((a.items||{})[ax.id]||{}).status||'cannot_judge', s2=((b.items||{})[ax.id]||{}).status||'cannot_judge';
      return {item:ax.id, name:ax.name, before:s1, after:s2,
        change:(s1==='needs_work'&&s2==='ok')?'improved':(s1==='ok'&&s2==='needs_work')?'worse':'same'};
    });
    var results=(a.issues||[]).map(function(x){
      var y=bi[x.id], st, c;
      if(!y){ st='resolved'; c='이전 조언 "'+shortText(x.fix,32)+'"대로 고쳐져 이번 버전에서는 이 문제가 보이지 않아요.'; }
      else if(x.importance==='high' && y.importance!=='high'){ st='partial'; c='나아졌지만 조금 남아 있어요. '+y.problem; }
      else { st='remaining'; c='아직 그대로예요. '+y.problem+' '+y.fix; }
      return {id:x.id, item:x.item, criterion:x.criterion, title:x.title, where:x.where, status:st, comment:c};
    });
    var fresh=(b.issues||[]).filter(function(y){ return !ai[y.id]; }).map(function(y){ return {item:y.item, criterion:y.criterion, title:y.title, where:y.where, problem:y.problem}; });
    var cnt={resolved:0, partial:0, remaining:0, new:fresh.length,
      improved_items:changes.filter(function(c){ return c.change==='improved'; }).length};
    results.forEach(function(i){ cnt[i.status]++; });
    var summary=results.length
      ? '이전 고칠 점 '+results.length+'개 중 '+cnt.resolved+'개를 해결했어요'+(cnt.partial?', '+cnt.partial+'개는 일부 해결':'')+(cnt.remaining?', '+cnt.remaining+'개는 아직 남아 있어요.':'.')
      : '이전 버전에는 고칠 점이 없었어요.';
    if(cnt.improved_items) summary+=' '+changes.filter(function(c){ return c.change==='improved'; }).map(function(c){ return c.name; }).join(' · ')+' 항목이 양호로 바뀌었어요.';
    if(fresh.length) summary+=' 새로 생긴 고칠 점이 '+fresh.length+'개 있어요.';
    return {same_criteria:a.criteria_version===b.criteria_version && a.prompt_version===b.prompt_version,
      counts:cnt, summary:summary, item_changes:changes, issue_results:results, new_issues:fresh};
  }

  /* ─────────── 화면 전환 ─────────── */
  var VIEWS=['diagnose','history','compare','login','guide'], afterLogin='';
  function showView(v){
    VIEWS.forEach(function(x){ document.getElementById('view-'+x).classList.toggle('hidden', x!==v); });
    var nav=(v==='compare')?'history':v;
    document.querySelectorAll('#navLinks a').forEach(function(a){ a.classList.toggle('on', a.dataset.view===nav); });
    if(v==='diagnose' && loaded) fit();
    window.scrollTo(0,0);
  }
  function route(){
    var parts=location.hash.replace(/^#/,'').split('/'), v=parts[0]||'diagnose';
    if(VIEWS.indexOf(v)<0) v='diagnose';
    showView(v);
    if(v==='history') renderHistoryView(parts[1]);
    if(v==='compare') renderCompareView(parts[1], parseInt(parts[2],10), parseInt(parts[3],10));
    if(v==='login') renderLogin(parts[1]==='signup');
    renderAcct();
  }
  window.addEventListener('hashchange', route);
  function go(h){ if(location.hash==='#'+h) route(); else location.hash=h; }

  function renderAcct(){
    var el=document.getElementById('acct'), u=user();
    el.innerHTML=u?'<span class="who">'+esc(u.name)+' 님</span><button class="btn quiet sm" id="logout">로그아웃</button>'
                  :'<a class="btn sm" href="#login">로그인</a>';
    if(u) document.getElementById('logout').onclick=function(){
      apiLogout().then(function(){ setRevise(null); currentArt=null; renderVersionsPane(); go('diagnose'); });
    };
  }
  function needLogin(target, msg){
    afterLogin=target;
    return '<div class="card narrow"><div class="empty-r"><b>로그인이 필요합니다</b><p>'+esc(msg)+'</p>'+
      '<a class="btn primary" href="#login">로그인</a> <a class="btn" href="#login/signup">회원가입</a></div></div>';
  }

  /* ─────────── 로그인 · 회원가입 화면 ─────────── */
  function renderLogin(signup){
    var el=document.getElementById('view-login');
    if(user()){ el.innerHTML='<div class="card narrow"><div class="empty-r"><b>이미 로그인되어 있습니다</b><p>'+esc(user().email)+'</p><a class="btn primary" href="#history">내 기록 보기</a></div></div>'; return; }
    el.innerHTML='<div class="card narrow auth">'+
      '<div class="tabs auth-tabs"><button type="button" class="'+(signup?'':'on')+'" data-m="login">로그인</button>'+
      '<button type="button" class="'+(signup?'on':'')+'" data-m="signup">회원가입</button></div>'+
      '<form class="card-body" id="authForm" novalidate>'+
      (signup?'<label class="fl">이름<input id="au-name" autocomplete="name" placeholder="홍길동"></label>':'')+
      '<label class="fl">이메일<input id="au-email" type="email" autocomplete="email" placeholder="you@example.com"></label>'+
      '<label class="fl">비밀번호<input id="au-pw" type="password" autocomplete="'+(signup?'new-password':'current-password')+'" placeholder="4자 이상"></label>'+
      '<p class="form-err hidden" id="au-err" role="alert"></p>'+
      '<button class="run" type="submit">'+(signup?'가입하고 시작하기':'로그인')+'</button>'+
      '<p class="hint-box">로그인하면 진단이 작품별로 기록되고, 수정본을 올려 이전 고칠 점이 해결됐는지 확인할 수 있습니다.'+
      ' <span class="muted">데모: 이 브라우저에만 임시 저장되며 비밀번호는 저장하지 않습니다.</span></p>'+
      '</form></div>';
    el.querySelectorAll('.auth-tabs button').forEach(function(b){
      b.onclick=function(){ go(b.dataset.m==='signup'?'login/signup':'login'); };
    });
    document.getElementById('authForm').onsubmit=function(e){
      e.preventDefault();
      var email=document.getElementById('au-email').value.trim().toLowerCase();
      var pw=document.getElementById('au-pw').value, err=document.getElementById('au-err');
      var nameEl=document.getElementById('au-name');
      function fail(m){ err.textContent=m; err.classList.remove('hidden'); }
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('이메일 형식을 확인해 주세요.');
      if(pw.length<4) return fail('비밀번호는 4자 이상 입력해 주세요.');
      if(signup && !nameEl.value.trim()) return fail('이름을 입력해 주세요.');
      (signup?apiSignup(email, nameEl.value.trim()):apiLogin(email)).then(function(){
        var msg='';
        if(pendingSave){ var r=saveDiagnosis(pendingSave.final, null, pendingSave.thumb); if(r){ currentArt=r.artwork_id; msg=r.title; } pendingSave=null; }
        renderVersionsPane();
        var t=afterLogin||'history'; afterLogin='';
        go(t);
        if(msg) toast('로그인 전에 한 진단을 「'+msg+'」 v1로 저장했습니다.');
      }).catch(function(x){ fail(x.message); });
    };
  }

  var toastT=0;
  function toast(m){
    var t=document.getElementById('toast');
    if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
    t.textContent=m; t.classList.add('on'); clearTimeout(toastT);
    toastT=setTimeout(function(){ t.classList.remove('on'); }, 3200);
  }

  /* ─────────── 수정본 재진단 모드 ─────────── */
  var revise=null, currentArt=null, pendingSave=null;
  var reviseBar=document.getElementById('reviseBar');
  function setRevise(artId){
    if(!artId){ revise=null; reviseBar.classList.add('hidden'); reviseBar.innerHTML=''; return; }
    var a=artById(artId); if(!a) return;
    var vs=versionsOf(artId), last=vs[vs.length-1];
    revise={artwork_id:artId, title:a.title, category:a.category, from:last?last.version:0};
    currentArt=artId;
    reviseBar.innerHTML='<div><b>수정본 재진단</b> 「'+esc(a.title)+'」 v'+(revise.from+1)+'로 저장됩니다'+
      (last?' <span class="muted">· 이전 v'+last.version+' 보완 필요 '+needCount(last)+'개 항목 · 고칠 점 '+issueCount(last)+'개</span>':'')+
      '</div><button class="btn quiet sm" id="reviseCancel">취소</button>';
    reviseBar.classList.remove('hidden');
    document.getElementById('reviseCancel').onclick=function(){ setRevise(null); };
  }
  function startRevise(artId){
    setRevise(artId);
    loaded=false; drop.classList.remove('hidden'); runBtn.disabled=true;
    imgC.width=10; imgC.height=10; fileLabel='';
    document.getElementById('fileName').textContent='파일 없음';
    document.getElementById('sizeInfo').textContent='';
    worryEl.value=''; focus={}; fromText={}; chips(); updateNote();
    p1.innerHTML='<div class="empty-r"><b>수정본 이미지를 올려주세요</b><p>고친 스케치를 올리고 진단하면 이전 고칠 점이 해결됐는지 바로 확인할 수 있습니다.</p></div>';
    apply(); renderVersionsPane(); showTab('p1');
    go('diagnose');
  }
  function thumbnail(){
    var s=Math.min(1, 360/Math.max(IW,IH)), c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(IW*s)); c.height=Math.max(1,Math.round(IH*s));
    var x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.drawImage(imgC,0,0,c.width,c.height);
    return c.toDataURL('image/jpeg',0.82);
  }

  /* ─────────── 결과 렌더 ─────────── */
  var ST={resolved:['해결','r2'], partial:['일부 해결','r1'], remaining:['남음','r0']};
  function issueBody(it){
    return '<dl class="iss-d">'+
      (it.where?'<dt>부위</dt><dd>'+esc(it.where)+'</dd>':'')+
      '<dt>문제</dt><dd>'+esc(it.problem)+'</dd>'+
      '<dt>이유</dt><dd>'+esc(it.why)+'</dd>'+
      '<dt>고치는 방법</dt><dd class="fix">'+esc(it.fix)+'</dd></dl>';
  }
  function impBadge(it){ return it.importance==='high'?'<span class="imp hi">중요</span>':''; }

  /* 화면이 읽는 모양:
     {relevance, focus, summary, worry_answer, items:{항목:{status, comment}},
      issues:[{priority, item, criterion, importance, title, where, problem, why, fix}], record?} */
  function render(res, extra){
    extra=extra||{};
    var focusSet={}; (res.focus||[]).forEach(function(id){ focusSet[id]=true; });
    var n=res.issues.length, need=needCount(res);
    var h='<div class="pills"><span class="pill">로컬 데모 응답 · 서버 연동 전</span>'+
          '<span class="pill">분류 <b>'+esc(res.relevance.category||'—')+'</b> '+Math.round((res.relevance.confidence||0)*100)+'%</span>'+
          '<span class="pill">보완 필요 <b>'+need+'개 항목</b> · 고칠 점 <b>'+n+'개</b></span>'+
          (res.record?'<span class="pill">「'+esc(res.record.title)+'」 <b>v'+res.record.version+'</b> 저장됨</span>':'')+'</div>';

    if(extra.categoryWarn) h+='<p class="warn">'+esc(extra.categoryWarn)+'</p>';

    if(extra.prev){
      var c=compareCore(extra.prev, res).counts, pn=issueCount(extra.prev);
      h+='<div class="cmp-cta"><div><div class="l">v'+extra.prev.version+' → v'+res.record.version+'</div>'+
         '<b>이전 고칠 점 '+pn+'개 중 '+c.resolved+'개 해결</b>'+(c.improved_items?' <span class="muted">· 양호로 바뀐 항목 '+c.improved_items+'개</span>':'')+'</div>'+
         '<a class="btn primary" href="#compare/'+res.record.artwork_id+'/'+extra.prev.version+'/'+res.record.version+'">전후 비교 보기</a></div>';
    }

    h+='<div class="sumbox"><div class="l">총평</div><p>'+esc(res.summary)+'</p></div>';
    if(res.worry_answer) h+='<div class="wans"><div class="l">고민에 대한 답</div><p>'+esc(res.worry_answer)+'</p></div>';

    if(n){
      var t=res.issues[0];
      h+='<div class="lead"><div class="l">가장 먼저 고칠 점 · '+esc(AXIS_BY_ID[t.item].name)+(focusSet[t.item]?' · 고민 반영':'')+'</div>'+
         '<h3>'+esc(t.title)+' '+impBadge(t)+'</h3>'+issueBody(t)+'</div>';
    }

    // 항목별: 보완 필요(고칠 점 우선순위 순, 고민·focus 반영됨) → 양호 → 판단 불가
    var ORD={needs_work:0, ok:1, cannot_judge:2};
    var ranked=AXES.map(function(a,i){
      var it=res.items[a.id]||{status:'cannot_judge', comment:''};
      var first=res.issues.filter(function(x){ return x.item===a.id; }).map(function(x){ return x.priority; })[0]||99;
      return {a:a, it:it, key:ORD[it.status]*1000+(it.status==='needs_work'?first:i)};   // 보완 필요 항목은 고칠 점 우선순위 순서
    }).sort(function(x,y){ return x.key-y.key; });
    h+='<h4 class="sec-h">항목별 진단</h4>';
    ranked.forEach(function(r, idx){
      var iss=res.issues.filter(function(x){ return x.item===r.a.id; });
      h+='<details class="axis-d'+(focusSet[r.a.id]?' f':'')+'"'+(idx===0&&r.it.status==='needs_work'?' open':'')+'>'+
         '<summary><span class="nm">'+esc(r.a.name)+'</span>'+(focusSet[r.a.id]?'<span class="fo">고민 반영</span>':'')+
         stBadge(r.it.status)+'<span class="cm">'+esc(r.it.comment)+'</span></summary>';
      if(iss.length){
        iss.forEach(function(x){
          h+='<div class="iss-in"><div class="iss-t"><span class="no">'+x.priority+'</span><b>'+esc(x.title)+'</b>'+impBadge(x)+
             '<span class="cr">'+esc(x.criterion)+'</span></div>'+issueBody(x)+'</div>';
        });
      }else{
        h+='<p class="ok-note">점검 포인트: '+esc(r.a.subs.join(' · '))+' — 뚜렷한 문제가 보이지 않아요.</p>';
      }
      h+='</details>';
    });

    if(res.record){
      h+='<div class="next"><button class="btn primary" id="goRevise">수정본 올려 다시 진단</button>'+
         '<a class="btn" href="#history/'+res.record.artwork_id+'">내 기록에서 보기</a></div>';
    }else{
      h+='<div class="next login-nudge"><p>로그인하면 이 진단이 기록되고, 고친 수정본을 올려 이전 고칠 점이 해결됐는지 확인할 수 있어요.</p>'+
         '<a class="btn primary" href="#login" id="nudgeLogin">로그인하고 저장</a></div>';
    }
    p1.innerHTML=h;
    var gr=document.getElementById('goRevise'); if(gr) gr.onclick=function(){ startRevise(res.record.artwork_id); };
    var nl=document.getElementById('nudgeLogin'); if(nl) nl.onclick=function(){ afterLogin='diagnose'; };
  }

  /* 입력·출력 탭: 서버로 보내는 값과 단계별 응답 JSON을 그대로 보여준다 */
  function renderIO(stage1, stage2, final, req){
    if(!p2) return;   // 사용자용 HTML(입력·출력 탭 없음)에서는 그리지 않음
    var u=user();
    var h='<h4 class="io-h">입력</h4><table class="dl">'+
      '<tr><td>스케치 이미지</td><td>'+esc(fileLabel)+' ('+IW+' × '+IH+')</td></tr>'+
      '<tr><td>고민 글</td><td>'+(worryEl.value.trim()?esc(worryEl.value.trim()):'<span class="muted">없음</span>')+'</td></tr>'+
      '<tr><td>중점 항목 (focus)</td><td>'+(focusIds().length?esc(focusIds().map(function(id){ return AXIS_BY_ID[id].name; }).join(', ')):'<span class="muted">없음</span>')+'</td></tr>'+
      '<tr><td>고정 프롬프트</td><td>LLM 진단 프롬프트 · 진단 기준표 '+CRITERIA_VERSION+' · '+PROMPT_VERSION+'</td></tr>'+
      '<tr><td>로그인</td><td>'+(u?esc(u.email)+' (Authorization: Bearer 토큰)':'<span class="muted">안 함 · 기록 저장 안 됨</span>')+'</td></tr>'+
      '<tr><td>작품 (artwork_id)</td><td>'+(revise?esc(revise.artwork_id)+' · 수정본':'<span class="muted">새 작품</span>')+'</td></tr>'+
      '</table>'+
      '<h4 class="io-h">1단계 응답 — POST /api/classify (MobileNetV3 분류)</h4>'+
      '<pre class="json">'+esc(JSON.stringify(stage1,null,2))+'</pre>';
    if(req) h+='<h4 class="io-h" style="margin-top:16px">2단계 요청 — POST /api/diagnose</h4>'+
      '<pre class="json">'+esc(JSON.stringify(req,null,2))+'</pre>';
    if(stage2) h+='<h4 class="io-h" style="margin-top:16px">2단계 LLM 응답 — 항목별 진단 (서버 내부)</h4>'+
      '<pre class="json">'+esc(JSON.stringify(stage2,null,2))+'</pre>';
    if(final) h+='<h4 class="io-h" style="margin-top:16px">최종 응답 — 서버 우선순위 · 기록 저장 후 화면에 전달</h4>'+
      '<pre class="json">'+esc(JSON.stringify(final,null,2))+'</pre>';
    if(!stage2) h+='<p class="hint-box">1단계에서 거절되었거나 확인 대기 중이라 2단계(LLM)는 호출하지 않았습니다.</p>';
    h+='<p class="hint-box">지금은 브라우저가 만든 데모 응답입니다. 서버가 같은 형식으로 응답하면 진단 탭이 그대로 그려집니다.</p>';
    p2.innerHTML=h;
  }

  /* 결과 카드의 "이 작품의 버전" 탭 */
  function renderVersionsPane(){
    if(!user()){ p3.innerHTML='<div class="empty-r"><b>로그인하면 버전이 기록됩니다</b><p>진단할 때마다 작품의 새 버전으로 저장되고, 이전 고칠 점이 해결됐는지 비교할 수 있습니다.</p><a class="btn primary" href="#login">로그인</a></div>'; return; }
    var a=currentArt?artById(currentArt):null;
    if(!a){ p3.innerHTML='<div class="empty-r"><b>아직 버전이 없습니다</b><p>진단하면 작품으로 저장되고, 수정본을 올릴 때마다 버전이 쌓입니다.</p></div>'; return; }
    var vs=versionsOf(a.id), h='<p class="pane-t">「'+esc(a.title)+'」 · '+esc(a.category)+'</p><div class="rec">';
    vs.slice().reverse().forEach(function(v,i,arr){
      var prev=arr[i+1];
      h+='<div class="row"><span class="n">v'+v.version+' · 보완 필요 '+needCount(v)+'개 항목 · 고칠 점 '+issueCount(v)+'개</span>'+
         '<span class="a">'+(prev?'이전 대비 <b class="up">'+compareCore(prev,v).counts.resolved+'개 해결</b>':'<span class="muted">첫 진단</span>')+'</span>'+
         (prev?'<a class="btn quiet sm" href="#compare/'+a.id+'/'+prev.version+'/'+v.version+'">비교</a>':'')+'</div>';
    });
    h+='</div><div class="next"><button class="btn" id="paneRevise">수정본 올리기</button><a class="btn quiet" href="#history/'+a.id+'">작품 기록 전체 보기</a></div>';
    p3.innerHTML=h;
    document.getElementById('paneRevise').onclick=function(){ startRevise(a.id); };
  }

  /* ─────────── 내 기록 화면 ─────────── */
  var hv=document.getElementById('view-history');
  function renderHistoryView(artId){
    if(!user()){ hv.innerHTML='<div class="page-head"><h1>내 기록</h1></div>'+needLogin('history'+(artId?'/'+artId:''),'진단 기록은 로그인한 사용자별로 저장됩니다.'); return; }
    hv.innerHTML='<div class="load">불러오는 중<div class="t"><i></i></div></div>';
    if(artId) return apiGetArtwork(artId).then(renderArtworkDetail).catch(function(e){
      hv.innerHTML='<div class="card narrow"><div class="empty-r"><b>'+esc(e.message)+'</b><p>삭제되었거나 다른 계정의 작품입니다.</p><a class="btn" href="#history">목록으로</a></div></div>';
    });
    apiListArtworks().then(function(list){
      var h='<div class="page-head"><h1>내 기록</h1><p>진단한 스케치가 작품별로 모여 있습니다. 같은 그림을 고쳐 올린 수정본은 한 작품의 버전으로 쌓입니다.</p></div>';
      if(!storageOK) h+='<p class="warn">브라우저 저장 공간을 쓸 수 없어 기록이 이 탭을 닫으면 사라집니다.</p>';
      if(!list.length){
        h+='<div class="card"><div class="empty-r"><b>아직 기록이 없습니다</b><p>스케치를 진단하면 여기에 작품으로 저장됩니다.</p><a class="btn primary" href="#diagnose">진단하러 가기</a></div></div>';
        hv.innerHTML=h; return;
      }
      h+='<div class="arts">';
      list.forEach(function(a){
        h+='<a class="art card" href="#history/'+a.id+'">'+
           '<div class="thumb">'+(a.latest&&a.latest.image?'<img src="'+a.latest.image+'" alt="">':'')+'</div>'+
           '<div class="art-b"><b>'+esc(a.title)+'</b>'+
           '<span class="art-m">'+esc(a.category)+' · 버전 '+a.version_count+'개 · '+fmtDate(a.updated_at)+'</span>'+
           '<span class="art-s">최근 보완 필요 <b>'+(a.latest?a.latest.need+'개 항목':'—')+'</b> · 고칠 점 <b>'+(a.latest?a.latest.issues+'개':'—')+'</b>'+
           (a.version_count>1?' <span class="muted">· v1 고칠 점 '+a.first_issues+'개 중</span> <b class="up">'+a.resolved_since_v1+'개 해결</b>':'')+'</span></div></a>';
      });
      hv.innerHTML=h+'</div>';
    });
  }

  function renderArtworkDetail(data){
    var a=data.artwork, vs=data.versions;
    var h='<div class="crumb"><a href="#history">내 기록</a> / '+esc(a.title)+'</div>'+
      '<div class="page-head row-h"><div><h1>'+esc(a.title)+'</h1><p>'+esc(a.category)+' · 버전 '+vs.length+'개 · 처음 진단 '+fmtDate(a.created_at)+'</p></div>'+
      '<div class="acts"><button class="btn primary" id="dRevise">수정본 올리기</button><button class="btn quiet" id="dDel">작품 삭제</button></div></div>';

    h+='<div class="detail"><section class="card"><div class="card-head"><h2>버전별 항목 상태</h2><span class="meta">진단 기준표 4개 항목</span></div><div class="card-body">';
    h+='<div class="tbl-wrap"><table class="vt st"><thead><tr><th>항목</th>';
    vs.forEach(function(v){ h+='<th>v'+v.version+'</th>'; });
    h+='</tr></thead><tbody>';
    AXES.forEach(function(ax){
      h+='<tr><td>'+esc(ax.name)+'</td>';
      vs.forEach(function(v){ h+='<td>'+stBadge(((v.items||{})[ax.id]||{}).status)+'</td>'; });
      h+='</tr>';
    });
    h+='<tr class="avg"><td>고칠 점</td>'; vs.forEach(function(v){ h+='<td>'+issueCount(v)+'개</td>'; }); h+='</tr>';
    h+='<tr class="avg"><td>이전 대비</td>';
    vs.forEach(function(v,i){
      var c=i?compareCore(vs[i-1],v).counts:null;
      h+='<td>'+(c?'<a class="up" href="#compare/'+a.id+'/'+vs[i-1].version+'/'+v.version+'">'+c.resolved+'개 해결</a>':'<span class="muted">첫 진단</span>')+'</td>';
    });
    h+='</tr></tbody></table></div></div></section>';

    h+='<section class="card"><div class="card-head"><h2>버전 기록</h2></div><div class="card-body vlist">';
    vs.slice().reverse().forEach(function(v){
      h+='<details class="ver"><summary><div class="thumb sm">'+(v.image?'<img src="'+v.image+'" alt="v'+v.version+' 스케치">':'')+'</div>'+
         '<div class="ver-b"><b>v'+v.version+'</b> <span class="muted">'+fmtDate(v.created_at)+'</span>'+
         '<span class="art-s">보완 필요 <b>'+needCount(v)+'개 항목</b> · 1순위 '+esc(topIssue(v))+'</span>'+
         (v.worry?'<span class="art-m">고민: '+esc(shortText(v.worry,40))+'</span>':'')+'</div></summary>'+
         '<div class="adv"><p class="adv-s">'+esc(v.summary)+'</p><ol>';
      (v.issues||[]).forEach(function(it){ h+='<li><b>'+esc(it.title)+'</b> <span class="muted">'+esc(AXIS_BY_ID[it.item].name)+'</span><p>'+esc(it.fix)+'</p></li>'; });
      h+='</ol></div></details>';
    });
    h+='</div></section></div>';
    hv.innerHTML=h;
    document.getElementById('dRevise').onclick=function(){ startRevise(a.id); };
    document.getElementById('dDel').onclick=function(){
      if(!confirm('「'+a.title+'」의 모든 버전을 삭제할까요? 되돌릴 수 없습니다.')) return;
      apiDeleteArtwork(a.id).then(function(){
        if(currentArt===a.id) currentArt=null;
        if(revise&&revise.artwork_id===a.id) setRevise(null);
        renderVersionsPane(); toast('작품을 삭제했습니다.'); go('history');
      });
    };
  }

  /* ─────────── 전후 비교 화면 ─────────── */
  var cv=document.getElementById('view-compare');
  function renderCompareView(artId, from, to){
    if(!user()){ cv.innerHTML='<div class="page-head"><h1>전후 비교</h1></div>'+needLogin('compare/'+artId+'/'+from+'/'+to,'비교는 로그인한 사용자의 기록으로만 할 수 있습니다.'); return; }
    var a=artById(artId);
    if(!a){ cv.innerHTML='<div class="card narrow"><div class="empty-r"><b>작품을 찾을 수 없습니다</b><a class="btn" href="#history">내 기록으로</a></div></div>'; return; }
    var vs=versionsOf(artId);
    if(vs.length<2){ cv.innerHTML='<div class="card narrow"><div class="empty-r"><b>비교할 버전이 하나뿐입니다</b><p>수정본을 올리면 이전 버전과 비교할 수 있습니다.</p><a class="btn primary" href="#history/'+artId+'">작품 보기</a></div></div>'; return; }
    if(!from||!to||from===to){ to=vs[vs.length-1].version; from=vs[vs.length-2].version; }
    var A=vs.filter(function(v){ return v.version===from; })[0], B=vs.filter(function(v){ return v.version===to; })[0];
    function sel(id,val){
      return '<select id="'+id+'" aria-label="'+(id==='cFrom'?'이전 버전':'비교할 버전')+'">'+vs.map(function(v){ return '<option value="'+v.version+'"'+(v.version===val?' selected':'')+'>v'+v.version+'</option>'; }).join('')+'</select>';
    }
    var head='<div class="crumb"><a href="#history">내 기록</a> / <a href="#history/'+artId+'">'+esc(a.title)+'</a> / 전후 비교</div>'+
      '<div class="page-head row-h"><div><h1>전후 비교</h1><p>같은 진단 기준표로 본 두 버전의 항목 상태와, 이전 고칠 점이 해결됐는지 봅니다.</p></div>'+
      '<div class="acts vsel">'+sel('cFrom',from)+'<span class="muted">→</span>'+sel('cTo',to)+'</div></div>';
    cv.innerHTML=head+'<div class="load">LLM이 이전 고칠 점의 해결 여부를 확인하는 중<div class="t"><i></i></div></div>';
    function onSel(){ go('compare/'+artId+'/'+document.getElementById('cFrom').value+'/'+document.getElementById('cTo').value); }
    document.getElementById('cFrom').onchange=onSel; document.getElementById('cTo').onchange=onSel;
    if(!A||!B) return;

    apiCompare(artId, from, to).then(function(r){
      var h=head;
      if(!r.same_criteria) h+='<p class="warn">두 버전의 진단 기준표나 프롬프트 버전이 달라 그대로 비교하기 어렵습니다.</p>';
      h+='<div class="pair">';
      [[A,'이전'],[B,'이후']].forEach(function(x){
        h+='<figure class="card"><div class="card-head"><h2>v'+x[0].version+' <span class="muted">'+x[1]+'</span></h2><span class="meta">'+fmtDate(x[0].created_at)+'</span></div>'+
           '<div class="pimg">'+(x[0].image?'<img src="'+x[0].image+'" alt="v'+x[0].version+' 스케치">':'<span class="muted">이미지 없음</span>')+'</div>'+
           '<figcaption>보완 필요 <b>'+needCount(x[0])+'개 항목</b> · 고칠 점 <b>'+issueCount(x[0])+'개</b></figcaption></figure>';
      });
      h+='</div>';
      h+='<section class="card"><div class="card-head"><h2>항목 상태 변화</h2><span class="meta">진단 기준표 4개 항목</span></div><div class="card-body">'+
         '<table class="vt st chg"><thead><tr><th>항목</th><th>v'+from+'</th><th></th><th>v'+to+'</th><th>변화</th></tr></thead><tbody>';
      r.item_changes.forEach(function(c){
        h+='<tr><td>'+esc(c.name)+'</td><td>'+stBadge(c.before)+'</td><td class="muted">→</td><td>'+stBadge(c.after)+'</td><td>'+
           (c.change==='improved'?'<span class="up">개선</span>':c.change==='worse'?'<span class="down">새 문제</span>':'<span class="dl-x">그대로</span>')+'</td></tr>';
      });
      h+='</tbody></table></div></section>';
      h+='<section class="card" style="margin-top:20px"><div class="card-head"><h2>이전 고칠 점 해결 현황</h2><span class="meta">v'+from+' 고칠 점 '+r.issue_results.length+'개 기준</span></div><div class="card-body">'+
         '<div class="cnt"><span class="c r2">해결 <b>'+r.counts.resolved+'</b></span><span class="c r1">일부 해결 <b>'+r.counts.partial+'</b></span>'+
         '<span class="c r0">남음 <b>'+r.counts.remaining+'</b></span><span class="c rx">새로 생김 <b>'+r.counts.new+'</b></span></div>'+
         '<p class="cmp-sum">'+esc(r.summary)+'</p>';
      r.issue_results.forEach(function(it){
        h+='<div class="cmp-item"><div class="ci-h"><span class="nm">'+esc(it.title)+'</span><span class="wh">'+esc(AXIS_BY_ID[it.item].name)+' · '+esc(it.where)+'</span>'+
           '<span class="rt '+ST[it.status][1]+'">'+ST[it.status][0]+'</span></div><p class="refl">'+esc(it.comment)+'</p></div>';
      });
      if(r.new_issues.length){
        h+='<h4 class="sec-h">새로 생긴 고칠 점</h4>';
        r.new_issues.forEach(function(it){
          h+='<div class="cmp-item"><div class="ci-h"><span class="nm">'+esc(it.title)+'</span><span class="wh">'+esc(AXIS_BY_ID[it.item].name)+' · '+esc(it.where)+'</span><span class="rt rx">새로 생김</span></div><p class="refl">'+esc(it.problem)+'</p></div>';
        });
      }
      h+='<p class="hint-box">항목 상태와 해결 여부는 LLM이 두 버전의 이미지와 이전 진단을 보고 판단합니다. 지금은 데모 문장입니다.</p></div></section>';
      if(DEV) h+='<section class="card io-card"><div class="card-head"><h2>입력·출력</h2><span class="meta">개발용</span></div><div class="card-body">'+
        '<h4 class="io-h">요청 — POST /api/artworks/'+esc(artId)+'/compare</h4><pre class="json">'+esc(JSON.stringify({from_version:from,to_version:to},null,2))+'</pre>'+
        '<h4 class="io-h" style="margin-top:16px">응답</h4><pre class="json">'+esc(JSON.stringify(r,null,2))+'</pre></div></section>';
      cv.innerHTML=h;
      document.getElementById('cFrom').onchange=onSel; document.getElementById('cTo').onchange=onSel;
    }).catch(function(e){
      cv.innerHTML=head+'<div class="card narrow"><div class="empty-r"><b>'+esc(e.message)+'</b></div></div>';
    });
  }

  /* ─────────── 진단 실행 ─────────── */
  function showLoading(msg){ p1.innerHTML='<div class="load">'+esc(msg)+'<div class="t"><i></i></div></div>'; }
  function showError(){
    runBtn.disabled=false;
    p1.innerHTML='<div class="empty-r"><b>진단 요청을 처리하지 못했습니다</b><p>서버 응답이 없거나 형식이 맞지 않습니다. 잠시 후 다시 시도해 주세요.</p>'+
      '<button class="btn primary" id="retry">다시 시도</button></div>';
    document.getElementById('retry').onclick=function(){ runBtn.onclick(); };
  }

  /* 2단계(LLM)를 부르고, 서버 역할(merge + 저장)을 거쳐 그린다 */
  function finish(stage1){
    showLoading('2단계: LLM이 진단 기준표로 항목별 고칠 점을 쓰는 중 · 분류 '+stage1.top.label+' '+Math.round(stage1.top.prob*100)+'%');
    runBtn.disabled=true;
    var worry=worryEl.value.trim();
    var fl=focusIds();
    var req={diagnosis_id:stage1.diagnosis_id, worry:worry, focus:fl, artwork_id:revise?revise.artwork_id:null};
    requestDiagnose(stage1, worry, fl).then(function(stage2){
      runBtn.disabled=false;
      var final=merge(stage1, stage2, fl), extra={}, thumb=thumbnail();
      if(revise && revise.category!==final.relevance.category)
        extra.categoryWarn='이전 버전('+revise.category+')과 다른 옷('+final.relevance.category+')으로 분류되었습니다. 같은 작품의 수정본이 맞는지 확인해 주세요.';
      if(user()){
        var prevVs=revise?versionsOf(revise.artwork_id):[];
        var rec=saveDiagnosis(final, revise?revise.artwork_id:null, thumb);
        if(rec){
          final.record=rec; currentArt=rec.artwork_id;
          if(prevVs.length) extra.prev=prevVs[prevVs.length-1];
          if(!storageOK) toast('브라우저 저장 공간이 부족해 기록이 이 탭에서만 유지됩니다.');
        }
        setRevise(null);
      }else{
        pendingSave={final:final, thumb:thumb};
      }
      render(final, extra);
      renderIO(stage1, stage2, final, req);
      renderVersionsPane();
    }).catch(showError);
  }

  runBtn.onclick=function(){
    if(!loaded) return;
    runBtn.disabled=true; showTab('p1');
    showLoading('1단계: MobileNetV3로 패션 스케치인지, 어떤 옷인지 분류하는 중');
    requestClassify().then(function(stage1){
      var d=decideRelevance(stage1);
      runBtn.disabled=false;
      if(d.status==='reject'){
        p1.innerHTML='<div class="empty-r"><b>'+esc(d.title)+'</b><p>'+esc(d.msg)+'</p></div>';
        renderIO(stage1, null, null, null);
        return;
      }
      if(d.status==='unsure'){
        p1.innerHTML='<div class="empty-r"><b>'+esc(d.title)+'</b><p>'+esc(d.msg)+'</p>'+
          '<button class="btn primary" id="confirmProceed">스케치가 맞아요, 진단 보기</button></div>';
        renderIO(stage1, null, null, null);
        document.getElementById('confirmProceed').onclick=function(){ finish(stage1); };
        return;
      }
      finish(stage1);
    }).catch(showError);
  };

  renderVersionsPane();
  route();
  apply();
})();
