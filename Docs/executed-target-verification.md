# Sohbet dönüşünde gerçek hedef — 0.8.5 kabul kaydı

2026-11-09. Plan `executed-target-continuity.md`; taban8f4b2c1, uygulama0ccd19d ve son kaynak **287e147**. Kapsam, mevcut genel bilgisayar/Chrome kontrolünde sonraki kullanıcı komutunun doğru gerçek hedeften devam etmesidir.

## Gerçek kurulu uygulama denemesi

Kurulu **0.8.4** normal arayüzünden, mevcut hesabın atanan gerçek sohbet ve bilgisayar rolleriyle yeni bir test sohbeti açıldı. Kimlik doğrulama ekranı otomasyonu, cookie/parola/token çıkarımı veya model rolü değişikliği yapılmadı. `computer-use` becerisiyle yalnız Umay'ın kendi mesaj arayüzü kullanıldı; hedef geçici loopback sitesiydi. Gerçek alışveriş, giriş, kullanıcı dosyası silme veya üçüncü kişiye ileti yoktu.

1. İlk ayrı komut test sayfasını açtı. Yerel HTTP sunucusu GET'i kaydetti; sayfa başlığı ve kurulu uygulamanın tamamlanmış görev kaydı eşleşti. Görev15:49:10.926–15:49:27.131 UTC, yaklaşık **16.2s**; kayıtta gözlem5285ms, model6778ms, giriş236ms,3 model turu var. Bu bir p50/p95 ölçümü değildir.
2. Aynı sohbette ayrı komut, tam `Duru gece ğüş 901` sorgusunu aramasını istedi. Görev, arama HTTP isteği gönderilmeden `Etkin Chrome penceresi seçili Umay profiliyle eşleşmiyor` sorusunda durdu. Sorgunun başarılı işlendiği iddia edilmedi.
3. Yalnız bu kendi test görevi normal arayüzden önce duraklatıldı, sonra `iptal et` ile sonlandırıldı; yerel kontrol noktası `stopped` doğrulandı. Kurulu uygulama kapatılmadı/patch edilmedi. Test sohbeti silinmedi; yerel ham kanıt Git'e eklenmedi.

## Kök neden ve düzeltmeler

- Doğrulanmış Chrome native focus sonucu, WorkspaceContext son hedefini yenilemiyordu. Eski farklı Chrome hedefi kalabiliyor; Umay sohbeti öndeyken fallback onu yeniden kullanıyordu. Gerçek mevcut callback üzerinden test önce **3≠5** ile başarısız oldu. `rememberForeground` şimdi yalnız gerçek PID/HWND/başlık/zaman referansını kaydeder. Sonraki komut, pencere listesinden aynı PID/HWND'yi ve Chrome bağlantısı/sekmesini tekrar doğrular. Eski UID veya onay taşınmaz.
- `appIsUmay` geniş önek eşleşmesi, `Umay canlı kontrol testi - Google Chrome` veya `Umay proje dosyası - Editor` başlığını da sohbet sanıyordu. RED/GREEN ile yalnız mevcut gerçek ana pencere ve kontrol çubuğu başlıkları eşleştirildi. Kullanıcının site/uygulama adı kapsam dışına çıkarılmaz.
- Son incelemede native `isForeground:false` bilgisinin ComputerControl gözleminde kaybolduğu bulundu. Callback üzerinden gerçek modül testi önce **2≠1** verdi: bilinen arka plan sonucu eski hedefi değiştirebiliyordu. Alan artık aktarılır; `rememberForeground` bu sonucu reddeder.

Kayıt hesabı değişmiş, PID'si geçersiz, arka plan, gizli veya izin isteyen pencereyi kabul etmez. Yeni gerçekten aktif uygulama önceki referansı geçersiz kılabilir. Kapanmış/yeniden kullanılmış PID/HWND için fallback yapılmaz. Sistem dosya gözlemi bu UI kaydını değiştirmez. Ek Chrome/OS turu eklenmedi; mevcut doğrulama sonucundaki referans tutulur.

## Testler ve bağımsız inceleme

- Son **478/478 Node** testi; sürüm0.8.5 ve son uygulama kaynaklarıyla. **52/52** mevcut konuşma/klonlama testi; bu modüllerin kaynakları değişmedi.
- Gerçek eski **0.8.4 ASAR/native/MCP** ile sahip olunan eski farklı pencere → Chrome işi → gerçek `Umay` başlıklı test sohbet penceresine dönüş → takip isteği testi başarısız oldu. Aynı gerçek pencere/MCP zinciri yeni kaynakta geçti. Sağlayıcı kontrollüdür; bu sonuç yeni sürümün canlı bulut zekâsı kabulü değildir.
- Gerçek Chrome'da explicit/endpoint'siz/recovered profil ve kullanıcının Ctrl+2 sekmesi, eksiksiz Unicode arama → üçüncü sonuç → sistem pencere büyütme geçti. Test sitesi başlığı Umay ile başlayacak şekilde de sınandı. Sonraki istekler ayrı görevlerdi.
- Gerçek Windows iki pencere, hover/sağ/orta/çift tık, dikey/yatay scroll, drag ve fiziksel F8 geçti. İlk F8 denemesi, kurulu uygulamadaki kendi duraklatılmış test görevi tuşu tuttuğu için engellendi; yalnız o görev sonlandırıldıktan sonra tekrar geçti. Başarısız deneme saklandı; bu bir global shortcut çakışma testidir.
- Chrome/Windows arka plan izleme/aynı işe devam ve gerçek loopback mağazasında adres/toplam/cüzdan/yanlış-doğru OTP/kayıp yanıt/tekrar engeli geçti. Yeni bir gerçek kullanıcı işlemi yapılmadı.
- Gerçek sohbet UI/IPC, yazılı/sesli görev devri, atanmış roller ve aynı sohbette soru/onay/Windows izin düğmesi akışı geçti. Fixture başlangıcındaki dev ses/login ve hesap kapatma yarış uyarıları logda tutulur; bunlar yeni bir gerçek mikrofon veya hesap giriş kabulü değildir.
- Tek taze salt okunur inceleme0Critical/0Important/1Minor bildirdi ve79 hedefli Node testi çalıştırdı. Minor, bilinen `isForeground:false` verisinin hedef kararında kaybolmasının etkisine göre uygulayıcı tarafından **Important** olarak yeniden değerlendirildi. Nedeni: native son odak kontrolü ile yanıt alanı hesaplaması arasında da odak değişebilir; bilinen ters kanıtın atılması doğru değildir. Kanıtlanmış canlı yanlış giriş iddiası yoktur. Tüketici callback testi RED/GREEN, ardından478 tam test geçti. Tek düzeltme turu yapıldı; ikinci inceleme ve ertelenmiş Minor yok.

## Açık kabul ve kararlar

İncelemecinin değerlendirmediği gerçek GUI/F8/checkout/paket konuları uygulayıcının ayrı testleridir. Kullanıcının kurulum teyidinden sonra kurulu0.8.5'in gerçek atanmış bulut modelleriyle aynı dört komutu tamamlaması ayrıca doğrulandı; aşağıdaki canlı kayıt geçerlidir. Bu dar zincirin tamamlanması sağlayıcı hatasının çözüldüğü veya genel kontrolün kusursuz olduğu anlamına gelmez.

Evrensel OS odak başarısı, bütün uygulama/site/aygıtlar, gerçek saatler ve p50/p95 başarı/hız matrisi açık kalır. Üretim veriussu.com/10203, hesap bağlama, kullanıcı model rolleri ve ses ayarları değiştirilmedi. Windows UAC ilk onayı kullanıcıda kalır; focus koruması gevşetilmedi. Bu sınırların maliyeti: ölçülmemiş canlı model ve geniş uygulama sonuçları için henüz güvenilirlik garantisi verilemez.

## Paket ve teslim

Son287e147 kaynakla0.8.5 test paketi hazırlandı.80 uygulama dosyası/native yardımcı/dört konuşma modülü kaynakla,361 MCP runtime dosyası sabit npm paketiyle eşleşti.22474 runtime dosyası/918827387 bayt SHA256 düzeyinde aynı; yalnız üretilen pycache hariç tutuldu.

Son ASAR/native ve gerçek paket Umay.exe MCP host ile eski farklı pencere → Chrome işi → gerçek Umay sohbet dönüşü → arama → üçüncü sonuç → sistem pencere büyütme kabulü geçti. İzole ASAR hafıza/kasa/Obsidian/SSH2/izleyici/kalıcı checkout ve gerçek paket yönetici/token/özel worker işi de geçti. Paket MCP close/reconnect/click/readback ve yardımcının kapanması doğrulandı. NSIS build exit0; ilk deneme son native alan düzeltmesi için iptal edildi, son kaynakla yeniden oluşturulan bu paket kullanılır.

- Installer: `C:/Users/Karam4n/Desktop/UmayV0.1.0/dist/target-0.8.5/Umay Setup 0.8.5.exe`
- Boyut: **350514199 bayt**, blockmap: **365838 bayt**.
- SHA256: `662db4ec89734611db209eefe015c6ad4d97e35a2d983d9ffe6e6deea72b4be6`
- SHA512: `vvThpUEanmrdvUYzx+VPwQD2RspCutDDt8Ga++p96dlv0ePtKpfZcXas46YXpdqJhcGfpVp/Rgrarlk9Uiqv1g==`
- latest.yml sürüm/boyut/SHA512 ile eşleşti. Authenticode `NotSigned`; imza kullanıcının önceki kararıyla ertelidir.
- exe/blockmap/latest.yml/verification.json ana checkout'a kopyalandı; dört dosyanın kaynak/hedef SHA256'ları aynı.
- Eski0.8.4 SHA256 değişmedi: `be2824c1f3a3c285f848667eb7ed5a66e71d42ad42285bd7582198c68f08ac3b`.
- Kaynak287e147 GitHub `codex/obsidian-continuity` dalına gönderildi; son40 Docs Markdown kopyası Obsidian `Umay/Docs` içinde tutulur. Otomatik kurulum/genel updater yayını yapılmadı.

Yeni sürümün kurulu uygulama üzerinden canlı kabulü için kullanıcıya somut bu kurulum bağlantısı gönderildi. Kullanıcı kurulumu teyit etti ve canlı teste devam edilmesini istedi; aşağıdaki deneme bu teyitten sonra yapıldı.

## 2026-11-09 — Kurulu0.8.5 gerçek model kabulü

`C:/Program Files/Umay/Umay.exe` ürün sürümü0.8.5.0 doğrulandı. Normal uygulama arayüzünde yeni test sohbetinden dört ayrı istek verildi. Sohbet/bilgisayar model rolleri, hesap ve ses ayarları değiştirilmedi; kimlik bilgisi çıkarılmadı. Yalnız sahip olunan `http://127.0.0.1:55701` test sitesi kullanıldı.

| Ayrı istek | Bağımsız etki kanıtı (UTC) | Görev kaydı | Yürütücü süresi |
| --- | --- | --- | --- |
| Sayfayı aç, başlığı doğrula | 16:24:22.091 GET `/`; önceki UI başlık gözlemiyle eşleşti | 44d874ae-b694-4b49-baf2-2d72d577af08 completed | 11.600s |
| Tam `Duru gece ğüş 901` ifadesini arat | 16:25:22.051 GET `/search`; sorgu eksiksiz aynı | bf51d349-d2f7-4ac4-82da-963e8a96aaaa completed | 6.805s |
| Üçüncü sonucu aç | 16:26:21.121 GET `/third` | e7ba9384-3859-4477-b700-97d2b7343eda completed | 4.844s |
| Deneme metnini yaz ve bir kez Kaydet | 16:29:32.190 tek POST `/save`; gövde tam `UMAY_085_ğüş_901` | 974e4495-e755-40fd-ac1d-a36b6b4d3ef9 completed | Tekrarın yürütücüsü6.077s |

Formun ilk sohbet isteği16:26:49.973'te gönderildi;16:27:16.737'de `INVALID_PROVIDER_RESPONSE` ile başarısız oldu (run8a7331e9-cf25-4881-b6a9-e816f9318013). Bilgisayar görevi oluşmadı ve POST yoktu. Arayüz kullanıcıya model hizmeti hatasını gösterdi. Etki olmadığı kontrol edildikten sonra aynı komut bir kez yeniden gönderildi; o tekrar tamamlandı. Bu hata saklanır; ilk denemede dörtte dört başarı veya sağlayıcı sorununun düzeldiği iddia edilmez.

Süreler `computer-task` başlangıç/tamamlanma kayıtlarının farkıdır; sohbetten devre, bekleme ve elle komutlar arasındaki süreler dahil değildir. Örneğin arama sohbet gönderimi16:25:06.458 → görev sonu16:25:24.230, toplam17.772s; yürütücü kısmı6.805s. Her görevde model/gözlem/girdi süreleri ayrı kaydedildi; bu tek zincir p50/p95 değildir.

Görevlerin genel `verified:false` / `model_reported` alanları değiştirilmedi. Tamamlama metninde Kaydedildi bildirimi vardır; dış doğrulama, uygulama beyanından ayrı HTTP etki kayıtlarıdır. Son Chrome ekranını bağımsız yeniden okuma denemesi, bilgisayar kullanımının güncel tarayıcı URL'sini güvenle belirleyememesi nedeniyle otomatik güvenlik denetimince durduruldu. Bu son ekran gözlemi gerçekleşmedi ve gerçekleşmiş sayılmaz; farklı yöntemle aşılmadı. Bağımsız son ekran doğrulaması açıktır.

Ham kanıt Git'e alınmayan `.superpowers/live-0.8.5-2026-11-09/acceptance.json`, `events.jsonl` ve salt okunur yerel görev kayıtlarındadır. Testin kendi loopback sunucusu terminal sonucu doğrulandıktan sonra kapatıldı. Bu tur yalnız kabul belgeleri güncellenir; yeni uygulama kodu/paket veya üretim sunucusu değişikliği yoktur. Sonraki açık işler sağlayıcı hatasının tekrarlı ölçümü ve kök neden incelemesi, sohbet→eylem gecikmesi ve genel uygulama/uzun süreli kullanım matrisidir.
