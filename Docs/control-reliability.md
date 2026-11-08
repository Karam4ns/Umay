# Bilgisayar ve Chrome kontrolü — hata düzeltme planı

> Uygulayıcı: `superpowers:executing-plans` ile mevcut izole worktree'de, önce başarısız test sonra düzeltme. Kullanıcının genel kontrol kapsamı ve mevcut devam/GitHub/test installer talimatı geçerlidir.

**Hedef:** Kısa görevlerin iç bağlam yüzünden kesilmesini ve yanlış/eskimiş pencere veya sekmeyle devamı düzeltmek; gerçek etki ve güncel hedefle doğrulamak.
**Mimari:** Mevcut sohbet → ComputerAgent → sistem/Chrome MCP/Windows akışı korunur. Gönderilecek yardımcı bağlam bütçelenir, özgün kullanıcı isteği ve izinler korunur. Chrome hedefi gerçek bağlantı ve görünen sekmeyle eşlenir; Windows girdisi PID/handle ile doğrulanır.
**Teknoloji:** Mevcut Electron/CommonJS, Chrome DevTools MCP1.12.0 ve Windows native yardımcı. Yeni bağımlılık/üretim sunucusu değişikliği yok.
**Spec:** `general-assistant-scope.md`, `obsidian-continuity-design.md`, `remote-job-verification.md`; son kullanıcı talimatı “komple incele”.

## Bulgular ve kısıtlar

Yerel son kayıtlarda arama/fill/click sonrası “Görev açıklaması çok uzun” kesilmesi ve model_reported tamamlanmalar var. Hata kullanıcı komutu dışında büyüyen yardımcı bağlamdan da çıkabiliyor. Önceki Windows odak reddi bu tur kendi pencerelerimizde geçmedi; odak testi ve arka plan izleyici testi geçti. Bu, eski reddin kök nedeninin düzeldiği anlamına gelmez; Windows gerçek odak reddi başarı sayılmaz.

- Taban240bc71. Ses, klonlama, varsayılan tarayıcı hesabı, checkout/OTP, Dur/F8 ve arka plan iş sahipliği korunur.
- İzinler, özgün istek ve onay kapsamı bütçe için kesilmez. Şema veya ek bağlam daraltılınca açık metadata bırakılır; araçlar keşifle erişilebilir kalır.
- Chrome web etkileri MCP'de kalır. Yerel debug endpoint süreç kimliği yalnız bağlantı/pencere eşleme içindir; yeni web yürütücüsü değildir. Kullanıcı sekmesi belirsizse rastgele eski sekme kullanılmaz.
- Testler sahip olunan geçici Windows/Chrome pencereleri ve loopback site/dosyalarda; gerçek alışveriş/giriş/sunucu komutu yapılmaz.

## İnceleme odağı

1. Büyük sayfa/geçmiş/checkpoint: kısa görev kesilmeden güncel hedef korunmalı.
2. Uzun özgün istek ve belirli onay: kısaltma anlamı/yetkiyi değiştirmemeli.
3. Aynı Chrome sürecinde çok pencere/sekme: MCP seçimi kullanıcı odağı değildir; belirsiz eşleşmede yanlış giriş olmamalı.
4. Hesap/profil/bağlantı değişirken geç hedef sonucu: eski PID/UID yeni görevde kullanılamaz.
5. Windows handle/PID değişimi veya odak reddi: giriş gönderilmeden durmalı, başarı uydurulmamalı.

### Task1: İç bağlam bütçesi

**Dosyalar:** yeni `src/computer-prompt.cjs`, `tests/computer-prompt.test.cjs`; `src/computer-agent.cjs`, `tests/browser-agent.test.cjs`.
**Arayüz:** `prepareComputerPrompt(prompt, {limit=11900})` JSON kopyası döndürür; özgün istek/izinler korunur, ek gözlemler/şemalar sayfalı kalır, yetersiz değiştirilemez bütçe açık kodla durur.

- [x] RED: gerçek Agent büyük session/aktif hedef/sonuç/önceki adımlarla model isteğine ulaşmalı; metin ve onay tam kalmalı, canlı gözlem/sonuç nesneleri değişmemeli.
- [x] GREEN: iç ekleri öncelikle daralt; eski kullanıcı-uzunluğu hatasını doğru iç bağlam/istek ayrımına çevir.
- [x] Kontrol: hedefli Agent/prompt/input/system **68/68** geçti; görev kaydı ayrı commit.

### Task2: Gerçek hedef ve Windows girdisi

**Dosyalar:** `src/browser-mcp.cjs`, `src/device-services.cjs`, gerekirse yeni `src/chrome-identity.cjs`; `src/computer-control.cjs`, `src/native-desktop.ps1`; ilgili birim ve gerçek Electron testleri.
**Arayüz:** Chrome `syncForeground(view)` bağlı süreç/görünen sayfayı MCP ile eşler; salt okunur süreç sorgusu yalnız yerel browser debug endpoint kullanır. `ComputerControl` focus/girdide gözlenen PID'yi native yardımcıya taşır.

- [x] RED: mevcut Chrome bağlantısı ve yeniden kullanılan profil, kullanıcı sekme değişimi/çok pencere, yanlış PID ve geç profil sonucu testleri.
- [x] GREEN: kesin hedefte devam, Chrome görevi görünür, taze UID; belirsiz hedefte somut seçim sorusu, UAC/OS reddinde giriş yok. Başarısız/hassas komut gözlemi eski hedefi geçerli bırakamaz.
- [x] Kontrol: gerçek Chrome ayrı komut açma → eksiksiz Unicode arama → üçüncü sonuç → sistem üzerinden pencere büyütme. Aynı süreçte kullanıcı sekme değişimi, mevcut endpoint ve yeniden kullanılan profil. Gerçek Windows PID/odak/tuş/metin/basılı giriş iptali ve arka plan izleme geçti; son tam regresyon teslimde tekrarlanır.

### Task3: Regresyon ve teslim

- [x] Tek taze bağımsız son inceleme; iki Important RED/GREEN ile kapatıldı. Critical/Minor yok.
- [x] 473 Node +52 konuşma/klonlama; gerçek sohbet UI/Chrome/checkout/OTP/Windows/F8/uzun işler. Canlı model erişimi kilitli oturum kopyası nedeniyle doğrulanamadı; sonuç açık kaydedildi.
- [x] 0.8.4 test installer kaynak/ASAR/MCP/hash kontrolü, ana checkout'a kopya.80 uygulama/361 MCP/22474 runtime dosyası kaynakla aynı; gerçek paket kontrol zinciri ve yönetici işçisi geçti. Eski0.8.3 hash'i korundu; otomatik kurulum/updater yayını yok.
- [x] Plan/walkthrought/kabul kaydı, vault kopyaları ve GitHub mevcut dal kaynak teslimi. Kaynak aa20404 uzaktan doğrulandı; son teslim kaydı aynı dalda tutulur. Geniş evrensel kabul tamamlanmış gösterilmez.
