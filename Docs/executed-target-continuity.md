# Gerçek kullanılan hedefin sohbet dönüşünde korunması — 0.8.5 planı

> Uygulayıcı: `superpowers:executing-plans`, mevcut izole worktree, TDD ve tek taze son inceleme. Kullanıcının devam talimatı ve önceki kaynak/test installer teslim yetkisi geçerlidir.

**Hedef:** Umay'ın gerçekten öne getirip kullandığı pencereyi, sonraki sohbet komutunda eski pencere yerine yeniden doğrulanacak hedef olarak tutmak.
**Mimari:** Mevcut WorkspaceContext güncellenir; native focus sonucu ve gerçek masaüstü gözlemi salt okunur son hedef kaydını yeniler. Sonraki istekte PID/handle güncel Windows listesinde ve Chrome profili/MCP sekmesi yeniden doğrulanır. Bilinmeyen profili kabul etme veya eski UID oynatma eklenmez.
**Teknoloji:** Mevcut Electron/CommonJS/Chrome MCP/Windows native yardımcı. Yeni bağımlılık ve üretim sunucusu değişikliği yok.
**Spec:** `general-assistant-scope.md`, `obsidian-continuity-design.md`, `control-reliability-verification.md`.

## Canlı bulgu

2026-11-09 kurulu0.8.4, gerçek oturum ve atanan sohbet/bilgisayar modelleriyle denendi. İlk ayrı komut loopback test sitesini açtı; HTTP GET ve gerçek görev sonucu doğrulandı. Aynı sohbette ikinci, tam Türkçe arama komutu profil eşlemesi sorusunda durdu. Cookie/oturum anahtarı alınmadı; gerçek kullanıcı sitesine form veya sipariş gönderilmedi. Kodda BrowserMcp'nin doğrulanmış native focus sonucu WorkspaceContext.target kaydını güncellemiyor; bu kayıt eski pencereyi tutabiliyor. Umay öndeyken fallback bu eski kaydı kullanıyor.

İkinci RED/GREEN: `appIsUmay` geniş önek eşleşmesi, `Umay canlı kontrol testi - Google Chrome` gibi gerçek site/uygulama başlığını da sohbet sanıyordu. Karşılaştırma yalnız gerçek ana pencere ve kontrol çubuğunun tam başlıklarıyla sınırlandı; adı Umay ile başlayan kullanıcı uygulamaları kapsamdan çıkarılmaz.

## Kısıtlar / inceleme odağı

1. Kayıt yalnız gerçek native foreground/focus kanıtıyla veya taze masaüstü gözlemiyle yenilenir; model metni hedef/onay sayılmaz.
2. Umay'a dönüldüğünde aynı PID/handle güncel listede bulunmalı; kapalı/değişmiş hedefe fallback yok.
3. Yeni gerçek aktif uygulama, son kullanılan eski hedefi geçersiz kılabilir; kullanıcı odağı yok sayılmaz.
4. Hesap/iptal nesli değişiminde geç focus sonucu hedefi yazamaz. Gizli/izin isteyen pencere hafızaya alınmaz.
5. Chrome profili/connection/UID ve Dur/F8/checkout korumaları aynen korunur. Başarılı test belirli sitelerle sınırlı ürün tasarımına dönüşmez.

### Task1: Kanıtlı son pencere kaydı

**Dosyalar:** `src/workspace-context.cjs`, `src/device-services.cjs`; `tests/device-services.test.cjs`, `tests/workspace-context.test.cjs`.
**Arayüz:** `WorkspaceContext.rememberForeground(view)` yalnız pencere referansı kaydeder; etkili işlem veya kullanıcı onayı üretmez. Native focus callback'i son check'ten sonra çağırır; masaüstü onObservation da taze foreground'u aktarır. Sonraki refresh mevcut profil/sekme kurallarını yeniden uygular.

- [x] RED: eski farklı Chrome hedefi → gerçek focus → Umay'a dönüş → aynı sayfada takip isteği. Mevcut native callback çağrısıyla hedef hâlâ eskiydi; eski0.8.4 paketinde gerçek Chrome/Windows testinde de tekrarlandı.
- [x] GREEN: güvenilir foreground referansı kaydedilir; gizli/gerçek Umay/yanlış PID/arkaplan gözlemi reddedilir. Başlık öneki yanlış eşleşmesi ayrıca RED/GREEN ile kapatıldı.
- [x] Kontrol: hesap değişimi/geç native sonucu, kapanmış hedef, yeni aktif uygulama, mevcut workspace/device/browser regresyonu ve gerçek yeni kaynak dönüş zinciri geçti.

### Task2: Gerçek kabul ve teslim

- [x] Tek bağımsız son inceleme; native foreground bayrağı bulgusu etkisine göre Important olarak değerlendirilip tek RED/GREEN turunda kapatıldı. Ertelenmiş Minor yok.
- [x] 478 Node ve52 konuşma testi; gerçek Windows/F8, Chrome/checkout/arka plan ve son paket kontrol/izole hafıza/yönetici worker kontrolleri geçti.
- [ ] Kurulu0.8.4'te canlı başarısızlık kanıtı ve yeni kaynakta aynı dönüş/ayrı takip zinciri. Yeni sürüm kurulumunu kullanıcı yapar; gerçek yeni bulut testi yapılamazsa açık bırak.
- [x] 0.8.5 installer, kaynak/ASAR/MCP/hash, eski0.8.4 korunarak ana checkout'a kopya; GitHub kaynak ve40 Docs vault kopyası doğrulandı. Plan/walkthrought/kabul kaydı aynı dalda tutulur. Üstteki yeni kurulu canlı kabul kutusu kullanıcı kurulumu sonrası açıktır.
