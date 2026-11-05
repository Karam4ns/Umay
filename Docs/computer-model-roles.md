# Computer use ve model rolleri — 5 Kasım 2026

Amaç: Sohbet ve bilgisayar görevlerini ayrı modellerle yürütmek; mevcut Windows kontrolünü pencere yönetimi, hedefli kaydırma ve hata sonrası yeniden gözlemle tamamlamak.

Kullanıcının uygulama ve test talimatı doğrultusunda mevcut Electron/Veriüssü altyapısı üzerinde uygulanır. Ayrı otomasyon motoru eklemek yerine mevcut ekran → model → tek işlem → yeniden ekran akışı genişletilir. Sohbet ve ses modelleri değiştirilmez.

## Tasarım

- Ayarlar / Modeller: Sohbet modeli ve bilgisayar kontrol modeli ayrı atanır; hesap başına yerel ayarlarda kalır. Kaynak ve model kimliği birlikte saklanır. Silinmiş/yetkisi kalkmış atama sessizce başka modele geçmez; kullanıcıya bildirilir. Atama uygulama yeniden açıldığında yüklenir.
- Bilgisayar görevleri hem sohbet kutusundan hem Bilgisayar sayfasından atanmış computer use modelini kullanır. Ekran üzerinden tam kullanım için görsel destekli model gerekir; metin modeli erişilebilirlik bilgileriyle sınırlı olarak açıkça gösterilir.
- Windows: Açık pencereleri gözlemle/listele, seçileni öne getir, sol/sağ/orta/double click, hover, iki monitör arasında sürükleme, hedefte dikey/yatay kaydırma, metin ve kısayollar. Pencere/koordinat seçimleri güncel gözlemle doğrulanır. Her yerel giriş sonrası yeniden gözlem yapılır.
- Model geçersiz işlem üretirse veya pencere odağı değişirse en fazla iki kez yeni gözlem ve hata açıklamasıyla toparlanır. Kısmen yazılmış metin otomatik tekrar edilmez. Tekrarlanan aynı işlemler sınırsız sürmez. F8 her aşamada durdurur.
- Normal masaüstü tam kontrol kapsamındadır. Windows kilit ekranı, UAC güvenli masaüstü ve daha yüksek yetkili pencereler işletim sistemi kısıtıdır; bunlar aşılmaz ve başarı gibi gösterilmez. Dış modelin görsel muhakemesi için kusursuzluk garantisi verilmez.

## Uygulama planı

### 1. Model rolleri

- [x] Önce hesap ayrımı, kalıcılık, kaynak+kimlik çakışması, erişimi kaldırılmış atama ve computer görevinde atama kullanımı testlerini yaz; eksiklik nedeniyle başarısızlığı gör.
- [x] DeviceServices.modelRoles(method,input) ile state/save/resolve işlemleri; IPC ve ön yükleme köprüsü. Ayarlar alt sekmeleri ve Modeller formu; iki görev girişinin doğru role yönlendirilmesi.
- [x] Birim testleri ve gerçek Electron form/kaydet/yenile/hesap temizliği testleri.

### 2. Windows kontrolünün tamamlanması

- [x] Pencere seçimi, hedefli yatay/dikey kaydırma, orta tık ve monitörler arası sürükleme testleri (önce başarısız).
- [x] NativeDesktop/ComputerControl/PowerShell yardımcı genişletmesi; gözlemde pencere listesi, focus_window işlemi. Yerel giriş zaman aşımı sonrası gecikmiş komutların çalışmasını önle.
- [x] ComputerAgent toparlanma ve döngü koruması testleri; planlayıcıya geçerli yetenekleri ve hata sonucunu taşı.
- [x] Gerçek Windows'ta yalnızca geçici test pencerelerinde tıklama, yazı, seçme, sağ/orta/çift tık, sürükleme, kaydırma, pencere değiştirme ve durdurmayı teyit et.

### 3. Bütünleşik doğrulama ve teslim

- [x] npm test; Electron UI ve yerel giriş testleri; mevcut sohbet/ses gerileme kontrolleri.
- [x] Bağımsız kod incelemesi; önemli bulgulara testle düzeltme.
- [x] Sürüm, plan ve walkthrough güncelle; Windows kurulum dosyasını üret ve paket içeriğini doğrula.

## İncelemede özellikle aranacaklar

Hesap değişirken geç kalan model yanıtı, aynı kimlikli farklı model kaynakları, kaybolan pencere/fokus, kısmen yazıldıktan sonra tekrar riski, durdurulmuş/zaman aşımına uğramış native giriş kuyruğu.

Sonuç ve sınırlar: [computer-model-roles-verification.md](computer-model-roles-verification.md).
