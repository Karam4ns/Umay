# Kullanıcı onaylı yönetici erişimi

Kullanıcı 5 Kasım 2026 tarihinde gerekli izinleri vererek yönetici uygulamalarının da kontrol edilmesini istedi. Normal Windows yetkisiyle çalışan ana Electron uygulaması korunur; gerektiğinde ayrı, geçici Windows yönetici yardımcısı açılır. UAC ve kilit ekranındaki kimlik doğrulaması kullanıcıya aittir.

## Akış

1. Normal kontrol gözlemi hedef pencerenin yönetici yetkisi gerektirdiğini belirler veya Windows giriş reddi verir.
2. Görev `permission` durumunda duraklar, Umay görünür olur. Kullanıcı «Windows yönetici onayını aç» düğmesine basar.
3. Yerel named pipe ve rastgele oturum anahtarıyla yalnızca mevcut göreve bağlı yardımcı hazırlanır. Windows `runas` gerçek UAC penceresini açar. Uygulama veya model UAC'yi onaylayamaz.
4. Yardımcı Windows yönetici tokenını doğrular. Onaydan sonra güncel ekran gözlemiyle aynı model/görev devam eder; önceki koordinat otomatik tekrar kullanılmaz.
5. Durdurma, çıkış, hesap değişimi, bağlantı kopması veya görevin terminal durumu yardımcının bağlantısını kapatır. Servis/scheduled task kurulmaz; UAC ilkesi değiştirilmez.

Yeni taşıma yalnızca mevcut native ekran/UIA/klavye/fare protokolünü taşır; keyfi shell/PowerShell çalıştırma IPC'si açılmaz. Model yönetici erişimini kendi kendine etkinleştiremez. Yönetici onayı ayrı kullanıcı düğmesi gerektirir.

## Uygulama ve test planı

- [x] Görev izin duraklama/devam/ret ve hesap değişimi testleri; önce başarısız.
- [x] `src/desktop-access.cjs`: normal/yönetici native yönlendirmesi, UAC launcher, tek kullanımlı named pipe, oturum ve kapanış.
- [x] `src/elevated-desktop.ps1`: pipe kimlik doğrulama ve yönetici tokenı; mevcut native kod bellekte sabit içerikle çalıştırılır.
- [x] Native gözlemde hedef pencerenin yükseltilmiş tokenını ve yardımcı yetkisini bildir; yetki gerektiğinde giriş yapma.
- [x] Bilgisayar sayfasında açıklama ve Windows onay düğmesi; otomatik geçiş yok.
- [x] Transport kimlik doğrulama, reddedilmiş UAC, iptal ve geç bağlantı testleri; normal Windows gerçek giriş, UI ve sohbet/ses regresyonları.
- [x] Kullanıcının açık test onayıyla gerçek yönetici penceresi ve paket içi yönetici kontrolü çalıştırıldı. Oturum zaten yönetici olduğundan standart kullanıcı UAC diyaloğu ayrıca doğrulanmış sayılmaz.
- [x] Bağımsız inceleme, tam test ve Windows kurulum paketi.

Kaynaklar: [Microsoft yönetici süreçleri](https://learn.microsoft.com/en-us/windows/win32/secbp/running-with-administrator-privileges/), [SendInput yetki seviyesi](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), [UAC çalışma biçimi](https://learn.microsoft.com/en-gb/windows-server/security/user-account-control/how-user-account-control-works).

## 0.4.2 doğrulaması

- 129 uygulama testi ve60 ses testi geçti. İzin duraklama, doğrulanmış grant, ret, geç grant, hesap değişimi, pipe kimlik doğrulama, probe öncesi native yönlendirme, F8 ve kısmi metin kontrolleri kapsandı.
- Gerçek Windows named pipe/bootstrap/gzip-native protokolü çalıştırıldı. Bu Codex yürütme oturumunun Windows tokenı zaten yönetici olduğu ölçüldü (`administrator=true`). Testin normal başlattığı yardımcı da bu tokenı miras aldı; bu sonuç standart kullanıcıdan UAC yükseltme diyaloğunun test edildiği anlamına gelmez.
- Gerçek PowerShell/C# hata protokolü, SendInput OS sınırında kontrollü dönüşlerle test edildi. OS girişi üretmeden sarılmış hata normalizasyonu, ilk metin parçası/ilk Unicode çiftinde kısmi giriş, sıfır giriş reddi ve Enter key-up hatası doğrulandı. Türkçe Windows regex kültürü nedeniyle kod tanıma case-sensitive yapılır.
- Normal masaüstünde gerçek fare/klavye/UIA/gözlem görevi ve fiziksel F8, izin durumunda F8 kaydının korunması; Electron izin düğmesi ve rol/hafıza/konum/tema regresyonları geçti.
- Bağımsız incelemedeki3 önemli bulgu (sarılmış native hata kodu, izin sırasında F8 kaybı, ilk metin parçasında kısmi giriş) testle düzeltildi. İnceleme sonrası bilinen ertelenmiş küçük bulgu yok.
- Paket içindeki36 uygulama dosyası, unpacked native yardımcı ve4 ses modülü kaynaklarla aynı. Paket içinden gerçek Windows görev ve Electron arayüz testleri geçti. İmzalama önceki kullanıcı kararıyla ertelenmiş test sürümüdür.
- `dist/Umay Setup 0.4.2.exe`:478604999 bayt; SHA256 `47ec046665400d139ffa8b5c95f1de72e8e02c9e029e29bc9cdb90ae2d50a0a4`.
- Eski `dist/win-unpacked/resources/app.asar` Windows tarafından kilitlendiği için çalışan uygulamaya müdahale edilmedi. Paket `dist/admin-0.4.2` altında oluşturulup installer dist köküne kopyalandı. Doğrulama: `node tests/verify-computer-package.cjs dist/admin-0.4.2/win-unpacked/resources`.
- Sunucu, hesap bakiyeleri, STT/TTS modelleri ve klonlama değiştirilmedi.

## Kullanıcı onayıyla tamamlanan gerçek test

Kullanıcı «Testi başlat; Windows UAC onayını vereceğim.» yanıtıyla testi açıkça onayladı. `electron tests/electron-admin-desktop.cjs` ve aynı testin 0.4.2 paket modüllerini kullanan sürümü başarıyla tamamlandı.

- Gerçek `runas` başlatıcısı, yönetici helper tokenı, pipe bağlantısı ve native UIA/SendInput doğrulandı.
- Geçici yönetici WinForms penceresindeki metin alanı fiziksel sınırlarıyla bulundu; fareyle seçilip `Umay yönetici erişimi ığüşöç doğrulandı.` metninin tamamı yazıldı.
- Bu eski WinForms kontrolü UIA'da adı/değeri olmayan bir Pane olarak göründüğünden yazı, test penceresinin kendi TextChanged olayının güncellediği başlıktan bağımsız olarak doğrulandı. Test UI olay kuyruğunun tamamlanmasını koşulla bekler; SendInput dönüşünü ekranda tamamlanma kabul etmez. Test penceresi kullanıcı tarafından istenen görünür pencere olduğundan Normal başlatılır; gerçek yönetici helper gizli kalır.
- Oturum iptalinden sonra yardımcı sürecin gerçekten sonlandığı PID kontrolüyle doğrulandı. Geçici pencere helper'ın finally bloğunda kapatıldı.
- Paket bütünlüğü yeniden geçti:36 uygulama dosyası, unpacked native yardımcı,4 ses modülü. `npm test`:129/129.
- İki çalıştırmada da `CLIENT_ALREADY_ADMINISTRATOR=true` ölçüldü. Dolayısıyla bu testte standart kullanıcıdan yeni UAC kabul/ret diyaloğu gösterilmedi; bu dalın gerçek testi normal yetkili bir Windows oturumu gerektirir. Diyalog çıkmaması gizli onay veya UAC ilke değişikliği değildir.

Ürün kodunda değişiklik gerekmedi; test penceresinin görünür başlatılması ve platforma uygun bağımsız metin doğrulaması düzeltildi. 0.4.2 installer ve SHA256 değeri değişmedi.

F8 normal masaüstündeki çalışan/bekleyen görevleri durdurur. Windows güvenli UAC masaüstündeyken Umay kısayolunun çalışacağı iddia edilmez; o onayı kullanıcı Windows'un kendi Evet/Hayır/Esc denetimleriyle tamamlar. UAC ilkesi, kilit ekranı veya Windows korumaları kapatılmaz. Aynı kullanıcı hesabında zaten keyfi kod çalıştıran saldırgan ayrı bir güvenlik sınırı olarak ele alınmaz; pipe sırrı loglanmaz ve yanlış token kabul edilmez.
