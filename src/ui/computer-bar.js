document.getElementById('emergency-stop').onclick=()=>window.computerBar.stop();
window.computerBar.onStatus(task=>{document.querySelector('strong').textContent=task?.status==='paused'?'Umay durakladı':'Umay çalışıyor';document.getElementById('task-label').textContent=task?.message||task?.goal||'Görev hazırlanıyor…';});
