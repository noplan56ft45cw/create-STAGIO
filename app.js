const DB_NAME='creative-studio-db', DB_VERSION=1;
let db, projects=[], assets=[], responses=[], projectFilter='all', assetFilter='all';
let selectedProjectId=localStorage.getItem('cs-selected-project')||'';
let assistantGenre=localStorage.getItem('cs-assistant-genre')||'illustration';
function selectedProject(){return projects.find(p=>p.id===selectedProjectId)||null}
function selectProject(id){selectedProjectId=id||'';if(selectedProjectId)localStorage.setItem('cs-selected-project',selectedProjectId);else localStorage.removeItem('cs-selected-project');render()}
const $=id=>document.getElementById(id);
const labels={illustration:'イラスト',video:'動画',game:'ゲーム','3d':'3D',general:'その他'};
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2300)}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;['projects','assets','responses'].forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'})})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function all(store){return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function put(store,obj){return new Promise((resolve,reject)=>{const t=db.transaction(store,'readwrite');t.objectStore(store).put(obj);t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}
function del(store,id){return new Promise((resolve,reject)=>{const t=db.transaction(store,'readwrite');t.objectStore(store).delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}
function clearStore(store){return new Promise((resolve,reject)=>{const t=db.transaction(store,'readwrite');t.objectStore(store).clear();t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}
async function refresh(){projects=await all('projects');assets=await all('assets');responses=await all('responses');render()}
function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===id));window.scrollTo(0,0)}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
function projectCard(p){
 const tasks=p.tasks||[],done=tasks.filter(t=>t.done).length,progress=tasks.length?Math.round(done/tasks.length*100):0;
 const selected=p.id===selectedProjectId;
 const linkedResponses=responses.filter(r=>r.projectId===p.id).sort((a,b)=>b.created-a.created);
 return `<article class="project-card ${selected?'is-selected':''}" data-project-card="${p.id}">
 <div class="project-top"><div><h3>${esc(p.name)}</h3><p>${esc(p.description||'説明はまだありません')}</p></div><span class="tag">${labels[p.genre]||'その他'}</span></div>
 ${selected?'<span class="selected-mark">✓ 選択中</span>':''}
 <div class="progress"><span style="width:${progress}%"></span></div>
 <div class="muted tiny">${progress}% 完了 · タスク ${done}/${tasks.length}</div>
 <div class="project-actions"><button class="mini-btn select-project-btn" data-action="select" data-id="${p.id}">${selected?'選択中':'このプロジェクトを選択'}</button><button class="mini-btn" data-action="task" data-id="${p.id}">＋ タスク</button><button class="mini-btn" data-action="edit" data-id="${p.id}">編集</button><button class="mini-btn danger-btn" data-action="delete" data-id="${p.id}">削除</button></div>
 ${tasks.length?`<div class="project-task-list">${tasks.map(t=>`<div class="project-task-item"><label><input type="checkbox" data-task="${t.id}" data-project="${p.id}" ${t.done?'checked':''}><span>${esc(t.name)}</span></label><span class="task-actions"><button type="button" class="mini-btn" data-action="edit-task" data-project-id="${p.id}" data-task-id="${t.id}">編集</button><button type="button" class="task-delete-btn" data-action="delete-task" data-project-id="${p.id}" data-task-id="${t.id}" aria-label="タスクを削除">削除</button></span></div>`).join('')}</div>`:''}
 <section class="project-responses"><div class="project-responses-head"><b>保存した制作回答</b><span class="tag">${linkedResponses.length}件</span></div>
 ${linkedResponses.length?linkedResponses.map(r=>`<article class="project-response-item"><div class="project-response-meta"><b>${esc(labels[r.genre]||'その他')}制作アシスタント</b><small>${new Date(r.created).toLocaleString('ja-JP')}</small></div><p>${esc(responseExcerpt(r.text))}</p><div class="project-actions"><button class="mini-btn" data-action="view-response" data-response-id="${r.id}">回答全文を見る</button><button class="mini-btn" data-action="task-from-response" data-response-id="${r.id}" data-project-id="${p.id}">＋ タスクにする</button></div></article>`).join(''):'<p class="muted tiny response-empty">このプロジェクトに保存された回答はまだありません。</p>'}
 </section>
 </article>`;
}
function responseExcerpt(text=''){const clean=String(text).replace(/!\[[^\]]*\]\([^)]*\)/g,'[画像]').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#>*`_~-]/g,' ').replace(/\s+/g,' ').trim();return clean.length>115?clean.slice(0,115)+'…':clean}
function safeMarkdown(text=''){
 let html=esc(String(text));
 html=html.replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g,'<img class="answer-image" src="$2" alt="$1" loading="lazy">');
 html=html.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
 html=html.replace(/^### (.+)$/gm,'<h4>$1</h4>').replace(/^## (.+)$/gm,'<h3>$1</h3>').replace(/^# (.+)$/gm,'<h2>$1</h2>');
 html=html.replace(/^\s*[-*] (.+)$/gm,'<li>$1</li>').replace(/(?:<li>.*<\/li>\n?)+/g,m=>'<ul>'+m+'</ul>');
 html=html.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
 return html.split(/\n{2,}/).map(part=>/^<(h[234]|ul|img)/.test(part.trim())?part:'<p>'+part.replace(/\n/g,'<br>')+'</p>').join('');
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){ $('projectCount').textContent=projects.length;$('doneCount').textContent=projects.reduce((n,p)=>n+(p.tasks||[]).filter(t=>t.done).length,0);$('assetCount').textContent=assets.length;
 const recent=[...projects].sort((a,b)=>b.updated-a.updated).slice(0,3);$('recentProjects').innerHTML=recent.length?recent.map(projectCard).join(''):'<div class="empty">まだプロジェクトがありません。＋新規作成から始めましょう。</div>';
 const tasks=projects.flatMap(p=>(p.tasks||[]).filter(t=>!t.done).map(t=>({...t,project:p.name,pid:p.id}))).slice(0,5);$('todayTasks').innerHTML=tasks.length?tasks.map(t=>`<label class="today-task"><input type="checkbox" data-task="${t.id}" data-project="${t.pid}">${esc(t.name)} <span class="muted tiny">· ${esc(t.project)}</span></label>`).join(''):'<div class="empty">未完了タスクはありません。</div>';
 const filtered=projects.filter(p=>projectFilter==='all'||p.genre===projectFilter);$('projectList').innerHTML=filtered.length?filtered.sort((a,b)=>b.updated-a.updated).map(projectCard).join(''):'<div class="empty">該当するプロジェクトはありません。新規作成してみましょう。</div>';
 const current=selectedProject();
 $('selectedProjectBanner').hidden=!current;
 $('selectedProjectBanner').innerHTML=current?`選択中のプロジェクト<strong>${esc(current.name)}</strong>${labels[current.genre]||'その他'} · タスク ${(current.tasks||[]).filter(t=>t.done).length}/${(current.tasks||[]).length} 完了` : '';
 $('bridgeProjectContext').textContent='選択中のプロジェクト：'+(current?current.name:'未選択（回答メモは共通保存）');
 $('assetProjectContext').textContent='選択中のプロジェクト：'+(current?current.name:'未選択（素材は共通ライブラリ）');
 renderAssets();$('savedResponses').innerHTML=responses.sort((a,b)=>b.created-a.created).map(r=>{const owner=projects.find(p=>p.id===r.projectId);return `<article class="response-card"><b>${esc(labels[r.genre]||'その他')}制作アシスタント</b><small class="muted">${esc(owner?.name||'共通メモ')}</small><p>${esc(responseExcerpt(r.text))}</p><button class="mini-btn" data-action="view-response" data-response-id="${r.id}">全文を見る</button> <button class="mini-btn" data-response-delete="${r.id}">削除</button></article>`}).join('');
}
function renderAssets(){const arr=assets.filter(a=>assetFilter==='all'||a.type===assetFilter);$('assetList').innerHTML=arr.length?arr.map(a=>`<article class="asset-card"><div class="asset-preview">${a.type==='image'&&a.data?`<img src="${a.data}" alt="">`:a.type==='video'?'▶':a.type==='audio'?'♫':'◇'}</div><div class="asset-info"><b>${esc(a.name)}</b><small>${esc(a.kind)} · ${formatSize(a.size)}</small><select class="asset-project-select" data-asset-project="${a.id}" aria-label="素材の所属プロジェクト"><option value="">共通素材</option>${projects.map(p=>`<option value="${p.id}" ${a.projectId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select><div class="project-actions"><button class="mini-btn" data-asset-share="${a.id}">共有</button><button class="mini-btn" data-asset-delete="${a.id}">削除</button></div></div></article>`).join(''):'<div class="empty" style="grid-column:1/-1">素材はまだありません。「＋追加」から読み込めます。</div>'}
function formatSize(n){if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'}
function openProject(p){$('editProjectId').value=p?.id||'';$('projectName').value=p?.name||'';$('projectGenre').value=p?.genre||'illustration';$('projectDescription').value=p?.description||'';$('projectDialogTitle').textContent=p?'プロジェクトを編集':'新規プロジェクト';$('projectDialog').showModal()}
document.querySelectorAll('[data-close-dialog]').forEach(btn=>{
 btn.addEventListener('click',()=>{
  const dialog=$(btn.dataset.closeDialog);
  if(dialog?.open) dialog.close('cancel');
 });
});
$('projectDialog').addEventListener('close',()=>{
 $('projectForm').reset();
 $('editProjectId').value='';
});
$('taskDialog').addEventListener('close',()=>{
 $('taskForm').reset();
 $('taskProjectId').value='';$('editTaskId').value='';$('taskDialogTitle').textContent='タスクを追加';
});
$('addProject').onclick=()=>openProject();$('quickAdd').onclick=()=>openProject();
$('projectForm').addEventListener('submit',async e=>{e.preventDefault();const id=$('editProjectId').value||uid(),old=projects.find(p=>p.id===id);const p={id,name:$('projectName').value.trim(),genre:$('projectGenre').value,description:$('projectDescription').value.trim(),progress:old?.progress||0,tasks:old?.tasks||[],created:old?.created||Date.now(),updated:Date.now()};if(!p.name)return;await put('projects',p);if(!selectedProjectId)selectProject(p.id);$('projectDialog').close();await refresh();toast('プロジェクトを保存しました')});
$('projectList').addEventListener('click',projectAction);$('recentProjects').addEventListener('click',projectAction);$('savedResponses').addEventListener('click',projectAction);
async function projectAction(e){
 const b=e.target.closest('[data-action]');if(!b)return;
 const action=b.dataset.action;
 if(action==='view-response'){const r=responses.find(x=>x.id===b.dataset.responseId);if(!r)return;$('responseViewTitle').textContent=(labels[r.genre]||'その他')+'制作アシスタント';$('responseViewMeta').textContent=new Date(r.created).toLocaleString('ja-JP')+' · '+(projects.find(p=>p.id===r.projectId)?.name||'共通メモ');$('responseViewBody').innerHTML=safeMarkdown(r.text);$('responseViewDialog').showModal();return}
 if(action==='task-from-response'){const r=responses.find(x=>x.id===b.dataset.responseId);if(!r)return;$('taskProjectId').value=b.dataset.projectId;$('editTaskId').value='';$('taskName').value=(labels[r.genre]||'制作')+'回答をもとに作業する';$('taskDialogTitle').textContent='保存回答からタスクを追加';$('taskDialog').showModal();return}
 if(action==='edit-task'){const p=projects.find(x=>x.id===b.dataset.projectId);const t=p?.tasks?.find(x=>x.id===b.dataset.taskId);if(p&&t)openTask(p.id,t);return}
 if(action==='delete-task'){
  const p=projects.find(x=>x.id===b.dataset.projectId);if(!p)return;
  const t=(p.tasks||[]).find(x=>x.id===b.dataset.taskId);if(!t)return;
  if(!confirm(`タスク「${t.name}」を削除しますか？`))return;
  p.tasks=p.tasks.filter(x=>x.id!==t.id);
  p.progress=p.tasks.length?Math.round(p.tasks.filter(x=>x.done).length/p.tasks.length*100):0;
  p.updated=Date.now();await put('projects',p);await refresh();toast('タスクを削除しました');return;
 }
 const p=projects.find(x=>x.id===b.dataset.id);if(!p)return;
 if(action==='select'){selectProject(p.id);toast('プロジェクトを選択しました');return}
 if(action==='edit')openProject(p);
 if(action==='delete'&&confirm(`「${p.name}」を削除しますか？\nこのプロジェクト内のタスクも削除されます。`)){
  await del('projects',p.id);if(selectedProjectId===p.id)selectProject('');await refresh();toast('プロジェクトを削除しました');
 }
 if(action==='task')openTask(p.id);
}
function openTask(id,task=null){$('taskProjectId').value=id;$('editTaskId').value=task?.id||'';$('taskName').value=task?.name||'';$('taskDialogTitle').textContent=task?'タスクを編集':'タスクを追加';$('taskDialog').showModal()}
$('taskForm').addEventListener('submit',async e=>{e.preventDefault();const p=projects.find(x=>x.id===$('taskProjectId').value);if(!p)return;const name=$('taskName').value.trim();if(!name)return;p.tasks=p.tasks||[];const editId=$('editTaskId').value;if(editId){const t=p.tasks.find(x=>x.id===editId);if(t)t.name=name}else p.tasks.push({id:uid(),name,done:false});p.progress=p.tasks.length?Math.round(p.tasks.filter(t=>t.done).length/p.tasks.length*100):0;p.updated=Date.now();await put('projects',p);$('taskDialog').close();await refresh();toast(editId?'タスクを更新しました':'タスクを追加しました')});
document.addEventListener('change',async e=>{if(e.target.matches('[data-task]')){const p=projects.find(x=>x.id===e.target.dataset.project),t=p?.tasks.find(x=>x.id===e.target.dataset.task);if(t){t.done=e.target.checked;p.progress=p.tasks.length?Math.round(p.tasks.filter(x=>x.done).length/p.tasks.length*100):0;p.updated=Date.now();await put('projects',p);await refresh()}}});
document.querySelectorAll('#projectFilters .filter').forEach(b=>b.onclick=()=>{document.querySelectorAll('#projectFilters .filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');projectFilter=b.dataset.filter;render()});
const assistantInfo={illustration:{title:'イラスト制作アシスタント',desc:'キャラクター・背景・構図・画風・画像生成用指示文を作成します。',tasks:'キャラクター設定、表情差分、衣装、ポーズ、構図、色設計、画像生成プロンプト'},video:{title:'動画制作アシスタント',desc:'企画・台本・カット割り・字幕・音声・編集手順を整理します。',tasks:'動画の目的と尺、構成、台本、シーンごとの映像、ナレーション、字幕、効果音、編集手順'},game:{title:'ゲーム制作アシスタント',desc:'ゲーム仕様・画面・キャラクター・コード・テスト計画を作成します。',tasks:'ゲームループ、操作方法、プレイヤー、敵、ステージ、UI、データ設計、実装手順、テスト項目'},'3d':{title:'3D制作アシスタント',desc:'モデル設計・形状・材質・テクスチャ・リグ・アニメーションを整理します。',tasks:'モデルの用途と寸法、形状、ポリゴン方針、材質、テクスチャ、リグ、アニメーション、書き出し形式'}};
function setAssistantGenre(g){assistantGenre=g;localStorage.setItem('cs-assistant-genre',g);$('promptGenre').value=g;document.querySelectorAll('[data-assistant-genre]').forEach(b=>{const on=b.dataset.assistantGenre===g;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))});$('assistantTitle').textContent=assistantInfo[g].title;$('assistantDescription').textContent=assistantInfo[g].desc;document.querySelectorAll('[data-step]').forEach((e,i)=>e.classList.toggle('active',i===0));}
document.querySelectorAll('[data-assistant-genre]').forEach(b=>b.addEventListener('click',()=>{if($('promptOutput').value&&!confirm('ジャンルを切り替えますか？現在の指示文は入力欄に残ります。'))return;setAssistantGenre(b.dataset.assistantGenre)}));
$('clearPrompt').onclick=()=>{const hasContent=$('promptGoal').value||$('promptNotes').value||$('promptOutput').value||$('responseNote').value;if(hasContent&&!confirm('今回の入力内容と生成済み指示文を消して、新しい制作を始めますか？保存済みの回答・プロジェクト・タスクは削除されません。'))return;$('promptGoal').value='';$('promptNotes').value='';$('promptOutput').value='';$('responseNote').value='';document.querySelectorAll('[data-step]').forEach((e,i)=>e.classList.toggle('active',i===0));toast('入力内容をクリアしました。新しい制作を始められます')};
$('makePrompt').onclick=()=>{const g=labels[assistantGenre],goal=$('promptGoal').value.trim(),notes=$('promptNotes').value.trim(),p=selectedProject();if(!goal){toast('作りたいものを入力してください');return}const projectContext=p?`\n【関連プロジェクト】\n名称：${p.name}\n説明：${p.description||'未設定'}\nジャンル：${labels[p.genre]||p.genre}`:'';$('promptOutput').value=`あなたは${g}制作の専門家兼、初心者向け制作ディレクターです。\n${projectContext}\n\n【今回作りたいもの】\n${goal}\n\n【希望・条件】\n${notes||'特になし'}\n\n【このジャンルで整理する項目】\n${assistantInfo[assistantGenre].tasks}\n\n【進め方】\n1. 最初に目的と不足情報を確認する。\n2. 制作工程を小さな段階に分け、各段階の成果物を明示する。\n3. 各工程について、必要な素材・無料で使えるツール・具体的な操作を示す。\n4. いきなり全工程を進めず、最初の工程を提案して私の確認を待つ。\n5. 実行後は結果の確認方法と次の工程を示す。\n6. Androidスマートフォンのみ・基本無料を優先し、有料機能が必要なら明記する。\n7. 可能な場合は制作アプリに渡せる具体的な素材・ファイル・指示文を作る。`;document.querySelectorAll('[data-step]').forEach((e,i)=>e.classList.toggle('active',i===1));toast('プロジェクト情報付き指示文を作成しました。内容を確認してからコピーしてください')};
$('copyPrompt').onclick=async()=>{if(!$('promptOutput').value){toast('先に指示文を作成してください');return}try{await navigator.clipboard.writeText($('promptOutput').value);document.querySelectorAll('[data-step]').forEach((e,i)=>e.classList.toggle('active',i===2));toast('コピーしました。ChatGPTに貼り付けてください')}catch{$('promptOutput').select();toast('長押ししてコピーしてください')}};
$('openChatGPT').onclick=()=>{if(!$('promptOutput').value){toast('先に指示文を作成してください');return}window.open('https://chatgpt.com/','_blank','noopener');document.querySelectorAll('[data-step]').forEach((e,i)=>e.classList.toggle('active',i===2));};
$('saveResponse').onclick=async()=>{const text=$('responseNote').value.trim();if(!text){toast('保存する回答を入力してください');return}const p=selectedProject();if(!confirm(`この回答を${p?'「'+p.name+'」':'共通メモ'}に保存しますか？`))return;await put('responses',{id:uid(),title:(labels[assistantGenre]||'その他')+'制作アシスタント '+new Date().toLocaleString('ja-JP'),text,genre:assistantGenre,projectId:selectedProjectId||null,created:Date.now()});$('responseNote').value='';document.querySelectorAll('[data-step]').forEach((e,i)=>e.classList.toggle('active',i===3));await refresh();toast('回答を保存しました')};
$('savedResponses').addEventListener('click',async e=>{const b=e.target.closest('[data-response-delete]');if(b&&confirm('このメモを削除しますか？')){await del('responses',b.dataset.responseDelete);await refresh()}});
$('importAssets').onclick=()=>$('assetPicker').click();
$('assetPicker').onchange=async e=>{for(const f of e.target.files){const type=f.type.startsWith('image/')?'image':f.type.startsWith('video/')?'video':f.type.startsWith('audio/')?'audio':'other';let data=null;if(type==='image'&&f.size<5*1024*1024)data=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>res(null);r.readAsDataURL(f)});try{await put('assets',{id:uid(),name:f.name,kind:f.type||'ファイル',type,size:f.size,data,blob:f,projectId:selectedProjectId||null,created:Date.now()})}catch{toast('保存容量が不足している可能性があります');break}}e.target.value='';await refresh();toast('素材を読み込みました')};
document.querySelectorAll('#assetFilters .filter').forEach(b=>b.onclick=()=>{document.querySelectorAll('#assetFilters .filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');assetFilter=b.dataset.filter;renderAssets()});
$('assetList').addEventListener('change',async e=>{const s=e.target.closest('[data-asset-project]');if(s){const a=assets.find(x=>x.id===s.dataset.assetProject);if(a){a.projectId=s.value||null;await put('assets',a);await refresh();toast('素材の所属を更新しました')}}});
$('assetList').addEventListener('click',async e=>{const d=e.target.closest('[data-asset-delete]'),s=e.target.closest('[data-asset-share]');if(d&&confirm('この素材を削除しますか？')){await del('assets',d.dataset.assetDelete);await refresh()}if(s){const a=assets.find(x=>x.id===s.dataset.assetShare);if(a?.blob&&navigator.share){try{await navigator.share({files:[new File([a.blob],a.name,{type:a.blob.type})],title:a.name})}catch{}}else if(a?.blob){const url=URL.createObjectURL(a.blob),link=document.createElement('a');link.href=url;link.download=a.name;link.click();URL.revokeObjectURL(url);toast('ダウンロードを開始しました')}else toast('この素材は共有用データを保持していません')}});

$('exportData').onclick=async()=>{const data={version:1,exportedAt:new Date().toISOString(),projects,responses};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});downloadBlob(blob,'creative-studio-backup.json');toast('バックアップを書き出しました')};
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('importData').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data.projects)||!Array.isArray(data.responses))throw Error('invalid');if(!confirm('現在のプロジェクトとメモをバックアップ内容で置き換えますか？'))return;await clearStore('projects');await clearStore('responses');for(const p of data.projects)await put('projects',p);for(const r of data.responses)await put('responses',r);await refresh();toast('バックアップを復元しました')}catch{toast('バックアップファイルを読み込めませんでした')}e.target.value=''};
$('refreshStorage').onclick=async()=>{if(navigator.storage?.estimate){const s=await navigator.storage.estimate();$('storageInfo').textContent=`使用中：約${formatSize(s.usage||0)} ／ 推定上限：約${formatSize(s.quota||0)}。実際の上限は端末・ブラウザにより変わります。`}else $('storageInfo').textContent='このブラウザでは保存容量を確認できません。';};
$('clearData').onclick=async()=>{if(confirm('本当にすべてのデータを削除しますか？')&&confirm('この操作は取り消せません。続行しますか？')){for(const s of ['projects','assets','responses'])await clearStore(s);selectProject('');await refresh();toast('すべてのデータを削除しました')}};
document.querySelectorAll('.genre-card').forEach(b=>b.onclick=()=>{projectFilter=b.dataset.genre;document.querySelectorAll('#projectFilters .filter').forEach(x=>x.classList.toggle('active',x.dataset.filter===projectFilter));showPage('projectsPage');render()});
async function init(){try{db=await openDB();await refresh();if(selectedProjectId&&!projects.some(p=>p.id===selectedProjectId))selectProject('');setAssistantGenre(assistantGenre in assistantInfo?assistantGenre:'illustration');$('refreshStorage').click();if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});}catch(e){console.error(e);toast('保存機能を初期化できませんでした。Chromeで開き直してください')}}init();
