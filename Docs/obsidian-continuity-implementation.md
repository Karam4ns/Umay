# Obsidian hafızası ve çalışma devamlılığı uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Tamamlanmış görevleri ledger ve Git üzerinden doğrulamadan yeniden uygulama.

**Goal:** Windows Umay'da kaynaklı Obsidian hafızası, kurtarma anahtarıyla taşınabilir şifreli kasa ve güncel hedef üzerinden kesintisiz genel bilgisayar/sunucu kontrolü.

**Architecture:** Mevcut LocalMemory, DeviceServices, SystemTools, Chrome MCP ve native yürütücü korunur. Yeni bağımsız kasa, kayıt kataloğu, Obsidian bağlantısı ve çalışma bağlamı servisleri bu arayüzlere eklenir; sır çözme yalnız yerel broker'da olur. Aynı anda tek etkili görev, ayrı salt okunur izleyiciler ve sürümlü checkpoint'ler vardır.

**Tech Stack:** Electron/CommonJS, Node crypto/fs/SQLite, Windows güvenli saklama/UIAutomation, Chrome DevTools MCP 1.12.0 ve SDK 1.32.2; SSH için sürümü sabitlenmiş ssh2.

**Spec:** `Docs/obsidian-continuity-design.md`. Kullanıcı kurtarma anahtarıyla taşınabilir kasayı seçti. Kapsamı daraltan bir örnek/site/uygulama listesi oluşturulmaz.

## Global Constraints

- İlk platform Windows; mevcut sohbet, varsayılan tarayıcı girişi, roller, STT/TTS/klonlama korunur.
- Obsidian `raw/`, `.obsidian/`, `.git/` yazılmaz; gerçek vault test için değiştirilmez. Tüm üretilen notlar ve UI Türkçe.
- Gözlem zamanlayıcısı 300.000 ms; komut başında yeni hedef doğrulanır. Arka plan gözlemi uygulama açmaz, odak çalmaz veya girdi göndermez.
- Parola, OTP, tam kart ve anahtarlar Markdown/model/log/normal sohbet arşivine konulmaz. Kurtarma anahtarı yalnız oluşturma sırasında yerel UI'ye verilir; export paketine konulmaz.
- Sahiplik hesap + cihaz + kayıt/sürüm ile ayrılır. Çıkış/hesap değişiminde bekleyen işlem ve sır izinleri iptal edilir.
- Tek girdi sahibi; Dur/F8 ve nesil iptali yereldir. Belirsiz etki veya durdurma başarı diye gösterilmez; eski işlem tekrarlanmaz.
- Gerçek UAC onayı kullanıcıdadır. İlk hata genel 'yapamam' cevabı değildir; somut engel/alternatif/kullanıcı katkısı gösterilir.
- Taslaktaki görünürlük ve güvenlik sınırları uygulanamadığında otomatik sır kullanımı kapalı kalır; uygulanmış gibi sunulmaz.

## Review Focus

1. Gizli değer sonradan DOM/UIA/görüntü/ağ çıktısıyla geri sızabilir: Task 6/11'de sır izinli aşama ve çıkış korumaları.
2. Aynı vault'a iki hesap/cihaz ve silinmiş kaydı taşıyan eski outbox: Task 2/3'te sahiplik, üst sürüm, tombstone/çatışma.
3. Umay ön planda veya kullanıcı başka Chrome profiline geçmiş: Task 4/10'da eski hedefi yeni hedef sanmama ve profil belirsizliği.
4. Geç dönen gözlem/anahtar çözme/SSH işi yeni hesaba yazabilir: Task 1/4/6/8'de epoch/abort ve gerçek etki makbuzu.
5. Beklenen OTP ile yeni ilgisiz komut, çökme ve ödeme sonucu belirsizliği: Task 9/11'de görev bağlama, checkpoint ve tekrar etmeme.

## Dosya ve bağımlılık haritası

Yeni çekirdekler: `portable-secrets.cjs`, `memory-catalog.cjs`, `obsidian-bridge.cjs`, `workspace-context.cjs`, `secret-broker.cjs`, `windows-tools.cjs`, `ssh-tools.cjs`, `task-workspace.cjs`, `interaction-waits.cjs`. Genel `definitions()/perform()` sözleşmesine adaptör ekleme Task 5'te yapılır. Büyük DeviceServices dosyasına iş kuralları yığılmaz; yeni servisler ayrı kalır. UI: `plugins-settings.js/css`, mevcut sekmelere küçük entegrasyon. Her görevin kendi test dosyası vardır.

### Task 1: Taşınabilir şifreli kasa

**Files:** Create `src/portable-secrets.cjs`, `tests/portable-secrets.test.cjs`.

**Interfaces:** `PortableSecretStore({keyDirectory,protect,unprotect,now})`; `activate(account,{directory})`, `initialize()`, `unlock({recoveryKey,useDeviceKey})`, `lock()`, `state()`, `list()`, `put({id,kind,label,public,secret,expectedVersion})`, `remove(id,expectedVersion)`, internal `resolve(id,{fields})`, `exportEncrypted()`, `importEncrypted(bytes,{recoveryKey})`, `close()`. State/list/put sonuçları sır döndürmez. initialize yalnız bir kere `{recoveryKey}` döndürür. protect/unprotect async Windows saklama işlevleridir; testte farklı cihaz anahtarlarıyla taklit edilir.

- [ ] RED: iki bağımsız cihaz dizini arasında export/import + doğru kurtarma; yanlış anahtar/hesap/tahrifat reddi; secret ve anahtar diskte/durumda/listede yok; aktivasyon değişirken geç çözüm reddi; eski sürüm yazısı değişiklik yapmaz.
- [ ] Implement: random 32 bayt veri anahtarı, AES-256-GCM/12 bayt nonce, AAD'de sürüm+hesap+kayıt kimliği. Kurtarma metni `UMAY-RECOVERY-1-` + base64url anahtar; normal JSON dosyasına yazılmaz. Cihaz anahtar kopyası yalnız protect çıktısıdır. İçe aktarma hedef hesap ve authenticated envelope doğrulanmadan yazmaz; mevcut kayıtlar sessiz ezilmez. Kayıt sınırı 64 KiB, paket sınırı 64 MiB. Cipher verisi owner ad alanında immutable kayıt/sürüm dosyalarıdır: yeni sürüm parent head kimliklerine bağlanır ve exclusive oluşturulur; iki cihaz aynı parent'tan yazarsa iki head korunur, çözüm açık çatışma ister. expectedVersion güncel head kümesinin opaque token'ıdır; yeni değer açıkça bütün head'leri birleştirebilir. Silme authenticated tombstone'dur; aktif resolve silinmiş/çatışmış kaydı döndürmez. directory taşınabilir köktür, modül owner alt alanını ayırır; keyDirectory cihaz korumalı cache'tir. Import içindeki yollar kullanılmaz; dosya adları doğrulanmış kayıt/sürüm kimliklerinden üretilir. protect yoksa cihaz cache'i yazılmaz, manuel recovery unlock yolu kalır; düz anahtar diske düşmez. Path/junction ve her async sınırda nesil denetimi vardır.
- [ ] GREEN: `node --test tests/portable-secrets.test.cjs`, ardından `npm test`; kaynakları commit et ve raporda RED/GREEN kanıtını yaz.

### Task 2: Kaynaklı genişletilebilir hafıza kayıtları

**Files:** Create `src/memory-catalog.cjs`, `tests/memory-catalog.test.cjs`; mevcut `LocalMemory` dış API'sini bozma.

**Interfaces:** `MemoryCatalog({memory,deviceId,now})`; `activate()`, `upsert({id,key,type,title,fields,content,source,secretRef,expectedRevision})`, `list({query,type,limit,offset,includeArchived})`, `get(id)`, `archive(id,expectedRevision)`, `changes()`, `ack(eventId)`, `ingest(record,{path,parentRevision})`, `context(query)`. Kayıt: `{id,owner,type,title,fields,content,source,secretRef,revision,parents,deviceId,updatedAt,deleted}`. Değişiklikler SQLite transaction içinde outbox'a girer.

- [ ] RED: profil/tercih/adres/iletişim/aygıt/dosya/hesap/ödeme/özel türler; aynı key güncellemesi ve kaynak; eski revision ve iki cihaz aynı parent çatışması; iki hesap ayrımı; tombstone eski olayla dirilmez; sayfalama; özel değerler yerine secretRef.
- [ ] Implement: memory.require() ile aynı hesap DB'sinde ayrı katalog/event/outbox tabloları; sabit kayıt kimliği, kaynak ve görünür çatışma. Eşzamanlı sürümler saatle seçilmez. Katalog özel anahtar/parola/OTP alanlarının düz değerini kabul etmez; typed secretRef ve maskelenmiş public metadata kullanır. Context yalnız ilgili, etkin ve sınırlı kayıtları verir; model metni yeni yetki değildir.
- [ ] GREEN: odak test + `npm test`; commit ve rapor.

### Task 3: Obsidian vault bağlantısı ve eşitleme

**Files:** Create `src/obsidian-bridge.cjs`, `tests/obsidian-bridge.test.cjs`.

**Interfaces:** `discoverVaults({configFile})`; `ObsidianBridge({catalog,openExternal,configFile,now})`; `activate(account)`, `connect({vaultPath,folder})`, `disconnect()`, `sync({signal})`, `state()`, `openRecord(id)`, `secretDirectory()`, `protectedPaths()`, `close()`. `catalog` Task 2 arayüzüdür; secretDirectory Task 1'e verilecek taşınabilir şifreli köktür; owner alt alanını Task 1 ayırır.

- [ ] RED: sahte obsidian.json keşfi; Türkçe not/kaynak/bağlantı oluştur/güncelle/içe al; kullanıcının başka notunu ve raw/.obsidian/.git dosyasını değiştirmeme; traversal/junction; kullanıcı düzenlemesi çatışması; elle silme/taşıma/archive; disk hatası/abort sonrası idempotent retry; aynı vault'ta iki hesap ve iki cihaz.
- [ ] Implement: yalnız seçilmiş gerçek vault ve manifestte sahip olunan alan. Karam4n şeması için entities/umay-hafızası ve sources/umay altında owner ad alanı; diğer vault'larda yapılandırılan kök. Türkçe frontmatter ve kaynaklar. Exclusive create, içerik/sürüm+yedek ve çatışma kopyaları; sıradan FS yazısına uygulamalar arası atomik CAS garantisi verme. Obsidian URI yalnız doğrulanmış not yoluyla açılır. Kendi yazısını yeniden kullanıcı değişikliği saymayan debounce/poll; outbox yalnız doğrulanmış sonuçta ack edilir.
- [ ] GREEN: geçici vault ile odak test + `npm test`; gerçek vault'a yazmadan commit/rapor.

### Task 4: Güncel çalışma bağlamı ve pasif gözlem

**Files:** Create `src/workspace-context.cjs`, `tests/workspace-context.test.cjs`; Modify `src/computer-session.cjs`, `tests/computer-session.test.cjs`.

**Interfaces:** `WorkspaceContext({session,readForeground,readBrowser,capture,analyze,now,schedule,cancelSchedule,publish,isBusy,isSensitive})`; `activate(account)`, `configure({enabled,intervalMs:300000,excludedApps})`, `refresh({reason,signal})`, `state()`, `resolve(request,{conversationId})`, `stop()`. Session observe/context'a owner, executor, zaman, process/pencere, profile/tab ve sınırlı anlamlı sonuç eklenir; hiçbir eski öğe kimliği yeni eylem yetkisi olmaz.

- [ ] RED: 300000 ms tek uçuş; gözlem hiçbir launch/focus/input çağırmaz; Umay öndeyken gerçek önceki hedefi korur; PID/handle reuse, kapalı hedef ve aktif farklı app/profile; taze komut başında yeni read; gecikmiş gözlem hesap değişimine geçmez; hassas/kilitli/busy durum skip; grafik görünümde izinli ephemeral analiz, ham görüntü persist yok.
- [ ] Implement: önce salt okunur metadata/UIA ve bağlı tarayıcı; gerekli ve izinli olduğunda ephemeral capture/analyze. Bağlı olmayan Chrome'u açma. Model analizi yalnız referans özeti, işlem/fact/izin değildir. Native ve browser identity/freshness açık; belirsiz profil resolve sonucu `needsTarget`, tahmini kimlik değil. On-demand refresh ile periyodik kayıt ayrılır. Hesap değişimi zamanlayıcı ve inflight sonuçları iptal eder.
- [ ] GREEN: odak test + `npm test`; commit/rapor.

### Task 5: Servis entegrasyonu ve Eklentiler ayarları

**Files:** Modify `src/device-services.cjs`, `src/main.cjs`, `src/preload.cjs`, `src/local-memory.cjs`, `src/system-tools.cjs`, `src/ui/index.html`, `src/ui/model-roles.js`; Create `src/ui/plugins-settings.js`, `src/ui/plugins-settings.css`, `src/passive-analysis.cjs`, `tests/plugins-settings.test.cjs`, `tests/obsidian-services.test.cjs`, `tests/electron-obsidian-settings.cjs`.

**Interfaces:** `api.plugins(method,input)` IPC: state/discover/connect/disconnect/sync/open, observer-settings, vault-initialize/unlock/lock, recovery-export/import ve kayıt list/save/archive. Renderer'a yalnız bu güvenilir pencereden erişim. `SystemTools({adapters})` definitions/perform adaptör kayıtçısı eklenir; adapter sözleşmesi `definitions(),perform(name,args,{signal,check,taskId})`. Task 1–4 servisleri hesap lifecycle'ına bağlanır. Registry isimden doğru adaptörü seçer; yeni adaptörler varsayılan elevated worker'a yönlendirilmez. Tüm adaptörlerin job/pending makbuzları bitiş kontrolüne girer; process araçlarıyla sınırlı tutulmaz. Mevcut local-memory yöntemleri çalışır.

- [ ] RED: sahte vault'la gerçek ayar sekmesi ve üç sekme aria/hidden tutarlılığı; iptal edilen klasör/key dosya diyaloğu; safeStorage yokken cihaz cache'i kapalı ve manuel kurtarmayla şifreli yol; hesap değişiminde kapanma; sırın renderer sohbet/IPC genel API/log'a kaçmaması; eski ayarlar ve API uyumu.
- [ ] Implement: keşfedilmiş vault ve klasör seçici, bağlantı/yazılabilirlik/son sync/çatışma/kilit durumları; gerçek URI open ve export dosya diyalogları. Kurtarma anahtarını bir kez yerelde göster/kopyala; kopyalama kullanıcı eylemi, panoya otomatik yazma değil. Güvenli kayıt formu; mevcut özel kayıtları doğrulanmış migration/outbox ile bağla, eskiyi doğrulamadan silme. Mevcut putNode/facts/işlem/dosya kayıtlarını kaynaklı kataloğa idempotent bağla; sıradan sohbeti her seferinde komple vault'a dökme. Pasif analiz mevcut model API'sini salt okunur done/message sözleşmesiyle kullanır: yerelde hiçbir önerilen eylem çalıştırılmaz, 20 saniye deadline/iptal ve hesap nesli vardır; sonuç yalnız güvenilmeyen kısa durum özetidir. Komut geldiğinde eski analiz iptal edilir. Gözlem ilk diğer kullanıcıda kapalı; bu kullanıcının isteği için açık tercih kaydedilebilir, gerçek vault seçimi ve kasa kurulumu yerel onboarding'dedir.
- [ ] GREEN: servis/DOM testleri, geçici vault gerçek Electron ayarı, `npm test`; commit/rapor.

### Task 6: Yerel sır broker'ı ve çıkış sınırı

**Files:** Create `src/secret-broker.cjs`, `tests/secret-broker.test.cjs`; Modify `src/browser-mcp.cjs`, `src/device-services.cjs`, `src/system-tools.cjs`, `src/system-files.cjs`, `src/ui/renderer.js`, `src/ui/capture.js`, `src/system-worker-client.cjs`, `src/system-worker.cjs`.

**Interfaces:** `SecretBroker({store,identity,fill,publish,now})`; `begin({taskId,recordId,target,fields})`, `perform(leaseId)`, `redact(value)`, `canObserve(target)`, `assertToolAllowed(name,args)`, `end(leaseId)`, `invalidate()`. Target origin+profile+tab veya doğrulanmış native hedef. Task 1 resolve yalnız broker ve SSH adaptöründen çağrılır; genel IPC'ye açılmaz. `memory_secret_use` aracı referans ve alan eşlemesi alır, sır değeri almaz/döndürmez.

- [ ] RED: yanlış origin/profile, eski hedef, kullanıcı çıkışı, ağ/script/DOM/clipboard/generic süreç ile sır çıkarmaya çalışma, protected file read; secret sonrası görüntü/sonuç/cache/experience sızıntısı; sır capture'ının normal chat/STT arşivine düşmemesi; doğrulanamayan maskelemede fail closed.
- [ ] Implement: kısa ömürlü görev hedefli izin, yerel çöz/doldur, sanitization ve hassas aşamada tehlikeli okuma/exec/capture kapıları. Yerel form/özel ses yakalama açıkken kullanıcı değeri genel send API'sine gönderilmez; eksik özel alan bulutta tamamlatılmaz. Native profil başlıktan kanıtlanamazsa kullanıcı seçimi/manual gizli aşama. Bilgisayarın aynı OS hesabındaki bağımsız zararlı koduna karşı sandbox iddiası yok.
- [ ] GREEN: odak + `npm test`; commit/rapor.

### Task 7: Genel pencere, ses ve ekran araçları

**Files:** Create `src/windows-tools.cjs`, `tests/windows-tools.test.cjs`, `tests/electron-window-management.cjs`; Modify `src/native-desktop.ps1`, `src/computer-control.cjs`, `src/device-services.cjs`.

**Interfaces:** adapter tools `windows_list`, `window_manage({handle,processId,operation})`, `audio_state`, `audio_set({level,mute})`, `display_list`, `display_brightness({displayId,level})`. Window operations focus/minimize/maximize/restore/close/fullscreen; native PID/handle doğrulaması. Uygulama tam ekranı ile maximize ayrılır; desteklenmeyen yol görünür hata.

- [ ] RED: kapanan/yeniden kullanılan handle, yanlış PID/Umay kontrol overlay'i; geçersiz seviye/aygıt; unsupported parlaklık; gerçek yalnız test penceresinde min/max/restore/focus/close ve kaydet diyaloğu.
- [ ] Implement: mevcut native güven/odak/izin/ip­tal yolunu kullan. Sistem ayarlarında gerçek değer/aygıt readback; kör sabit F tuşu veya desteklenmeyen aygıtta başarı yok. Ses/parlaklık gerçek kullanıcı ayarı testte izinsiz değiştirilmez; gerçek read-only keşif ve sahte OS sınırı testleri yeterli, değişim ayrıca opt-in.
- [ ] GREEN: odak + gerçek kendi pencere testi + `npm test`; commit/rapor.

### Task 8: Şifreli profil üzerinden genel SSH

**Files:** Create `src/ssh-tools.cjs`, `tests/ssh-tools.test.cjs`, `tests/live-ssh-fixture.cjs`; Modify `package.json`, `package-lock.json`, `src/device-services.cjs`.

**Interfaces:** adapter tools `ssh_connect({profileId,expectedFingerprint})`, `ssh_exec({connectionId,command})`, `ssh_job_status({jobId})`, `ssh_job_stop({jobId})`, `ssh_list/read/write` (version/offset/limit), `ssh_close`. Profil Task 2'den, sır Task 1/6 yerel çözümünden; gerçek host anahtarı SHA256 ile doğrulanır. Bağlantı/görev/account sahipliği zorunlu.

- [ ] RED: loopback gerçek SSH sunucusu, komut/çıktı/dosya readback; yanlış hostkey/hesap; sır log/argüman/sonuçta yok; bağlantı kopunca kısmi/unknown etki; stop kanal kapanmasını uzaktaki proses öldü diye sunmaz; yeniden bağlanınca komut tekrar edilmez.
- [ ] Implement: resmî ssh2 belgelerine göre sürümü sabitle, ilk bilinmeyen fingerprint'i açık onay için geri ver; remote shell komutu kullanıcı kapsamındaki literal komut, kimlik bilgisi birleştirme yok. Bağlantı ve jobs bounded; SFTP yolları gerçek sonuç/sürümle. Doğrulanamayan durdurma `stop_unconfirmed`, checkpoint'te tutulur. Gerçek kullanıcı sunucusu test için değiştirilmez.
- [ ] GREEN: odak + loopback SSH + `npm test`; commit/rapor.

### Task 9: Uzun görev çalışma alanı ve checkpoint

**Files:** Create `src/task-workspace.cjs`, `tests/task-workspace.test.cjs`; Modify `src/computer-agent.cjs`, `src/device-services.cjs`, `src/computer-session.cjs`.

**Interfaces:** `TaskWorkspace({memory,now})`; `activate()`, `begin({taskId,origin,target})`, `checkpoint(task)`, `pauseForNewTask`, `list()`, `restore(id)`, `finish(id,result)`. Aynı anda bir etkili görev; arka plan read-only izleyici tanımları ayrı. Checkpoint sır, OTP, görüntü veya callback içermez; opaque referans ve gerçek etki makbuzu içerir.

- [ ] RED: ilgisiz iş eski etkili işi pause eder; eski model sonucu yeni işe girmez; aynı işe düzeltme; iki olası bekleyen işe yanıt belirsizliği; reboot yalnız readback/explicit resume; saatlerce izleme fazları görev kapsamını/stop'u kaybetmez; bounded geçmiş ve no-progress döngüsü.
- [ ] Implement: mevcut tek agent ownership'i korunur, paused checkpoint'ler açıkça seçilerek döner. 120 adım/30 dakika limitleri kör döngüyle kaldırılmaz; doğrulanmış faz/checkpoint ve yerel watch kullan, ilerlemesiz tekrar bütçesini sınırla. Uzak iş hâlâ çalışıyor olabilir; eski komut otomatik tekrarlanmaz. Başka etkili iş varken eski izleyici odak çalmaz.
- [ ] GREEN: lifecycle/regresyon + `npm test`; commit/rapor.

### Task 10: Komut devri ve tarayıcı devamlılığı

**Files:** Modify `src/device-services.cjs`, `src/computer-agent.cjs`, `src/browser-mcp.cjs`, `src/chrome-browser.cjs`, `server/desktop-reply.cjs`; Create `src/browser-sessions.cjs`, `tests/browser-sessions.test.cjs`, `tests/control-continuity.test.cjs`, `tests/electron-live-continuity.cjs`; Modify `src/ui/browser-settings.js`, `src/ui/index.html`; Extend `tests/browser-mcp.test.cjs`, `tests/desktop-reply.test.cjs`.

**Interfaces:** Task 4 resolve sonucu `{executor,target,freshness,reference,needsTarget}` task origin'e referans olarak eklenir, yetki değildir. `BrowserMcp.passiveState()` bağlantı başlatmadan okunur; `alignTarget(target)` yalnız komut sırasında gerçek profil/tab eşleşmesiyle seçer. BrowserSessions kayıtlı bağlantıları/profile alias'larını hesap bazlı tutar; aynı anda kullanılan MCP yürütücüsünün profileKey/connectionId'si context'te bulunur. Yönetilen profiller ayrı dizin/kimlik taşır; mevcut profile otomatik cookie/parola kopyalanmaz. Kullanıcı mevcut Chrome'da açık bağlantı iznini verir; ayrı izinli endpoint/oturumlar açıkça seçilir. Kanıtlanmamış profil trusted sayılmaz. Yeni provider aracı dynamic registry'den gelir; eski istemci sözleşmesi değişmez.

- [ ] RED: aç → ayrı komutta arat → ayrı komutta üçüncü sonuç; farklı uygulama/sekme/profile geçiş; app önde değilken ses komutu; quoted/how ordinary chat; stale UID/collision; gerçek aynı field value ile tekrarlanan fill model çağrısı; arama fill sonrası Enter eksikliği; değişmiş sonuç sırası.
- [ ] Implement: her komutta Task 4 refresh; deiktik devam hedefi devralır, açık yeni hedef bunu geçersiz kılabilir. Güncel browser snapshot/list anlamı bounded olarak taşınır; profile güveni olmayan secret akışı Task 6'da kapalı kalır. Aynı değerli fill gerçek readback üzerinden engellenir/sonraki eylem istenir; farklı field/value legitimate değişim bozulmaz. Browser/desktop/system geçişi yeni görev yetkisi değildir. Server directTask yalnız gerçek bağlamla devam rotası seçer; regex site isim listesi değil.
- [ ] GREEN: odak + kontrollü gerçek 3 komut web/native kabulü; gerçek modelle ayrı geçici profil denemesi; izole server HTTP testi gerekiyorsa; `npm test`; commit/rapor.

### Task 11: OTP, adres ve alışveriş bekleme akışı

**Files:** Create `src/interaction-waits.cjs`, `tests/interaction-waits.test.cjs`, `tests/live-checkout-fixture.cjs`; Modify `src/computer-agent.cjs`, `src/device-services.cjs`, `src/ui/chat-computer.js`, `src/ui/computer-commands.js`, `src/ui/renderer.js`.

**Interfaces:** `InteractionWaits({memory,broker,now})`; `wait({taskId,kind,target,expiresAt,question})`, `answer({taskId,value})`, `cancel(taskId)`, `state()` sanitized. kind otp/address/shipping-confirm/payment-choice. OTP yalnız bellekte ve bir kez; sır/OTP girişi Task 6 local capture'a gider, model/public history'ye değil. Yeni adres Task 2'ye kaynakla yazılır.

- [ ] RED: yanlış görev/origin/profile/expired OTP; kullanıcı başka işe geçti; tek gönderim ve yanlış kod retry; kayıtlı/yeni/adres yok durumunda her sipariş shipping confirm; kullanıcının verdiği adresin kalıcı mı işlem özel mi olduğu; wallet/card seçimi; ödeme sonucunun belirsizliğinde tekrar ödeme yok.
- [ ] Implement: bounded typed wait modeli, genel soru/confirm akışıyla aynı sohbette. Aktif görev scope/fresh target yeniden doğrulanır; OTP cevapları yeni bağımsız iş oluşturmaz. Sentetik mağaza fiyat/alıcı/adet gerçek state ile doğrulanır, gerçek alışveriş yapılmaz.
- [ ] GREEN: unit + gerçek yerel sandbox checkout + ses cevap yönlendirme regresyonu + `npm test`; commit/rapor.

### Task 12: Tam kabul, paket ve kaynak teslimi

**Files:** Create `Docs/obsidian-continuity-verification.md`, uygun `tests/live-*.cjs` fixture'ları; Modify `Docs/plan.md`, `Docs/walkthrought.md`, `package.json` sürüm/teslim bilgisi.

- [ ] Tüm önceki görev/review'leri ve spec maddelerini karşılaştır; her yetenek için uygulanan/gerçek test/sınır matrisi yaz. Sır koruması tamamlanmamış yol etkinmiş gibi yayımlanmaz.
- [ ] Tam Node suite, gerçek yerel vault + kurtarma taşıma + gerçek Obsidian URI, üç komut devamlılık, profil/hesap değişimi, loopback SSH, bekleyen OTP/adres ve iptal, gerçek kendi Windows penceresi/F8, mevcut ses/klonlama/auth regresyonu. Kontrollü ve gerçek model ölçümleri ayrı. Fiziksel bulunmayan donanım ve profesyonel uygulama kabulü açık belirtilir.
- [ ] Gerekli sunucu patch'ini önce izole HTTP/DB'de doğrula; yalnız beklenen modülleri dağıt, 10203 ve mevcut frontend/iki worker sağlık/bütünlüğünü kontrol et. Sunucu sırlarını Git'e koyma.
- [ ] İmzasız test installer'ı üret; kaynak/native/konuşma/MCP eşleşmesi, paket içinden yeni adapter yüklenmesi, hash/boyut/blockmap. Mevcut kullanıcı profilini otomatik migrate ederken sır ve kurtarma anahtarı loglanmaz; yeni vault bağlantısı/onboarding kullanıcıya görünürdür.
- [ ] Son bağımsız whole-branch review, bulguların çözümü, test kanıtları; kullanıcı tarafından zaten yetkilendirilmiş GitHub kaynak teslimi. Genel güncelleme/release yayını ayrıca talep edilmedikçe test kaynağı ve installer olarak raporla; geniş ve ölçülmemiş başarı garantisi verme.
