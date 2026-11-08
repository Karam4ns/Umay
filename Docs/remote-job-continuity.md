# Yönetici ve SSH uzun iş devamlılığı — uygulama planı

> Uygulayıcı: `superpowers:executing-plans` ile aynı mevcut izole worktree'de adım adım, önce başarısız test, sonra uygulama. Kullanıcının ayrıntılı genel asistan kapsamı, önceki “başla/tam yetki/devam” talimatları ve 2026-11-08 devam isteği geçerlidir. Yeni belge için ayrıca onay verdiği iddia edilmez; mevcut kapsam yürütülür.

**Hedef:** Yetkili yardımcı ve SSH üzerinde Umay'ın başlattığı uzun işi, kullanıcının başka isteğinde durdurmadan izlemek; doğrulanmış sonucu aynı asıl göreve aktarmak.
**Mimari:** Mevcut `SystemTools` sahiplik/izleme koordinatörü korunur. Yönetici işçisi görevden bağımsız bir `SystemWorkerHost` ile hesap/görev/istek/iş sahipliğini tutar. SSH adaptörü aynı park/okuma/iptal arayüzüne katılır. Önce backend park alındısı, sonra ön planın bırakılması; izleyiciler yalnız salt okunur sonuç kullanır.
**Teknoloji:** Mevcut Electron/CommonJS/Windows özel pipe/SSH2. Yeni bağımlılık veya üretim sunucusu değişikliği yok.
**Spec:** `general-assistant-scope.md`, `obsidian-continuity-design.md`, `long-task-continuity.md`, `plan.md`; 0.8.2 sipariş/OTP/konuşma korunur.

## Yaklaşım ve sınırlar

İşi göreve bağlı çağrıdan ayırmak seçildi. Her iş için ayrı UAC/SSH bağlantısı veya eski shell komutunu tekrar çalıştırarak devam etmek, sahipliği ve tekrar etmeme gereksinimini bozardı. Mimari seçim uygulayıcıya aittir. Yönetici yetkisi ilk gerçek Windows onayıyla alınır; güvenli UAC ekranı kullanıcı yerine onaylanmaz. Uzak SSH `exit/close` veya TERM sonucu her sunucuda bütün torun süreçlerin bittiğini kanıtlamaz; belirsiz durum başarı veya yeniden komut izni sayılmaz.

Yeni sohbet/iş, park edilmiş işin özgün kullanıcı talimatını ve izlenen iş kimliklerini korur. Dur/F8, çıkış, yönetici erişimini kapatma ve izleyiciyi iptal etme ilgili sahip olunan işleri durdurmayı dener. Durduğu doğrulanamazsa açık hata ve durmuş otomatik devam gerekir. Yeniden başlatmada kimliği bulunmayan eski süreç/SSH oturumu otomatik canlandırılmaz. Kimlik bilgisi veya tam komut yeni izleme kayıtlarına yazılmaz.

## Genel kısıtlar

- Taban `4de04b5`; mevcut `codex/obsidian-continuity` Codex linked worktree. Başlangıç çalışma ağacı temiz; 440 Node testi geçti.
- Aynı hesap/görev/iş ve gerçek worker bağlantısı/SSH oturumu ile bağla; modelin verdiği kimlik başka iş yaratamaz. Eski alındı yeni bağlantıda kullanılamaz.
- Backend parkı başarılı olmadan yerel pending sahipliğini kaldırma. Kısmi park/iptal alındılarını yok sayma.
- SSH host fingerprint/kasa, varsayılan tarayıcı girişi, model rolleri, STT/TTS/klonlama, Chrome MCP ve sipariş korumaları korunur.
- Testler yalnız geçici dosyalar, kendi çocuk süreçlerimiz ve loopback SSH ile yapılır. Gerçek sunucuda kurulum/komut çalıştırılmaz. Gerçek Windows yükseltmesi ayrı kanıtlanır.

## İnceleme odağı

1. Park alındısı beklerken Dur/hesap değişimi: geç alındı durdurulan işi tekrar etkinleştirmemeli.
2. Arka plan durum okuması ön plandaki farklı işi durdurmamalı veya yetkili moda geçirmemeli.
3. Worker/SSH bağlantısı koparken işin sonucu bilinmiyorsa başarı/otomatik tekrar olmamalı.
4. İptal yalnız doğru görev/işleri etkilemeli; park edilmiş başka iş veya tüm worker yanlışlıkla iptal edilmemeli.
5. Yönetici erişimi iptali/yeniden açılışı ve aynı hesapla çıkış/giriş eski izin/alındıyı yeniden kullanmamalı.

### Task 1: Görev sahipli yönetici işçisi

**Dosyalar:** yeni `src/system-worker-host.cjs`, `tests/system-worker-host.test.cjs`; değişen `src/system-worker.cjs`, `src/system-worker-client.cjs`.
**Arayüz:** host `perform({id,account,taskId,toolName,args,roots})`, `parkTask(taskId,jobIds)`, `unparkTask(taskId)`, `cancelRequest(id)`, `cancelTask(taskId)`, `close()`; client aynı park/unpark alındısını taşır. İstek iptali ile görevdeki süreçleri durdurma ayrı RPC'dir. Worker tek hesaba bağlıdır.

- [x] RED: gerçek çocuk süreç A park edildikten sonra B'nin komutu ve A'nın salt okunur durum sorgusu A/B'yi öldürmemeli; başkasının işini park edememe, bekleme iptali, yanlış hesap, kapanma ve geç sonuç testleri.
- [x] GREEN: backend uygulaması ve private pipe yönlendirmesi; `SystemTools` içindeki görev değiştirme yan etkisi worker dispatch'ten çıkarılır. Main process eski araç şemasını korur.
- [x] Kontrol: `node --test tests/system-worker-host.test.cjs` ve gerçek özel pipe client/worker testi. UAC'siz simülasyon gerçek yükseltme sayılmaz.

### Task 2: Genel backend parkı ve SSH devamlılığı

**Dosyalar:** yeni `src/system-job-lifecycle.cjs`; `src/system-tools.cjs`, `src/ssh-tools.cjs`, `src/task-watch-tools.cjs`, `src/device-services.cjs`; yeni `tests/remote-job-continuity.test.cjs`, ilgili mevcut süreç/SSH testleri.
**Arayüz:** `SystemTools.parkTask(taskId)` asenkron `Promise<jobIds>`; `readTaskJobs({taskId,jobIds})` gerçek backend'e yönlenir, bağlantı kimliği kontrol edilir; SSH adaptörü `parkTask(taskId,ids)`, `unparkTask(taskId)`, `readJob(jobId,taskId)`, `jobIdentity(jobId)` sağlar. Local backend akışı korunur.

- [x] RED: yerel/yönetici/SSH karma sahiplikte park alındısı, park başarısızlığı, geç alındı + Dur/hesap değişimi, salt okunur izleme, iptal ve bağlantı kaybı. Eski komut yeniden çalışmamalı.
- [x] GREEN: tüm park çağrılarını `await` et; ana görev kendi alındısıyla ön planı bırakır. Worker isteği durdurulurken park edilmiş süreç yaşamaya devam eder; açık Dur ilgili işleri durdurur.
- [x] Kontrol: yeni testler + mevcut `parked-process`, `process-jobs`, `task-watchers`, `ssh-tools`, `ssh-files`, `system-tools`, `computer-watch` regresyonları.

### Task 3: Gerçek kabul ve 0.8.3 teslim

**Dosyalar:** yeni gerçek loopback SSH/ajan kabulü ve özel worker taşıma testi; mevcut Windows UAC testi, paket testleri; `Docs/remote-job-verification.md`, `plan.md`, `walkthrought.md` ve vault kopyaları.

- [x] Gerçek loopback SSH uzun işi + diğer görev + aynı işe sonuç aktarımı; kopmada otomatik devam/tekrar yok. Gerçek worker pipe ile iki görev, park, bekleme iptali ve doğru işi durdurma. Gerçek Windows yönetici süreci ayrı sınanır; onay engeli olursa açık raporlanır.
- [ ] Tam Node + 52 konuşma/klonlama testi; gerçek Chrome/sipariş/OTP/sohbet UI/arka plan regresyonu. Tek taze bağımsız son inceleme ve gerekli bulguların RED/GREEN çözümü.
- [x] 0.8.3 imzasız test paketi, ASAR/native/konuşma/MCP kaynak eşleşmesi, gerçek paket testleri ve hash/blockmap; GitHub dalına kaynak ve ana checkout'a installer; vault güncel Docs kopyaları. 0.8.2 korunur, genel updater yayını yapılmaz.

Tamamlanmış kutular yalnız bu turdaki gerçek kanıtla işaretlenir. Gerçek saatler ve bütün uygulama/sunucu/aygıt kabulü açık kalır.

## Gerçekleşen kabul ve açık kayıt

460 Node ve52 konuşma/klonlama testi; gerçek loopback SSH/same-agent devamı, gerçek Windows UAC/token/özel worker ve gerçek paket ASAR/Umay.exe kabulü geçti. Bağımsız üç Important ve iptal drain bulgusu RED/GREEN ile kapatıldı. Metadata UUID yanlış kart eşleşmesi sabit testle düzeltildi. Paket 78 kaynak/dört konuşma/361 MCP eşleşmesi ve hash ile hazır.

Task3 içindeki genel Windows odak regresyonu tamamlandı işaretlenmez: güncel ve önceki0.8.2 native sınıfıyla aynı `NATIVE_WINDOW_UNAVAILABLE` alındı; dosyalar byte olarak aynı. Bu koşul ve bütün uygulamalar/gerçek saatler kapsamı ayrı açık kalır. Sonuç, hash ve kaynak kanıtı `remote-job-verification.md` içinde.
