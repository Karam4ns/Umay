document.getElementById('emergency-stop').onclick=()=>window.computerBar.stop();
window.computerBar.onStatus(task=>{document.getElementById('task-label').textContent=task?.message||task?.goal||'Görev hazırlanıyor…';});
