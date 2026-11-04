# Cihaz yetenekleri — uygulama kararı ve kabul adımları

Kullanıcı üç aşamanın tamamını kodlayıp adım adım test etmemizi istedi: yerel
Obsidian benzeri hafıza, konum/saat/hava/RSS uyarıları ve tam ekran/klavye/fare
bilgisayar kontrolü. Önceki “yerel DB yok” kararı bu açık taleple değişti. Windows
kapsamı ve çalışan ses sistemi korunacak. Başlangıç kararları aşağıdadır; teslim doğrulaması dosyanın son bölümündedir.

## Yerel hafıza

Electron45 /Node24 içinde node:sqlite doğrulandı. Her hesap için SHA256 adında
ayrı SQLite dosyası; WAL ve göç sürümü. Tablolar: conversations, messages, nodes,
links, operations, device_files, private_accounts, settings, alerts ve mesaj FTS.
Sunucudan silinen sohbetler yerel arşivden silinmez. Mesajlardan açık tercihler ve
özellikler alınır; alıntı/provenans korunur, belirsiz çıkarım gerçek diye kaydedilmez.
Eski bilgi sürümleri arşivlenir. Sohbet ve dosya yolları araması, ilişkili notlar,
işlem günlüğü ve kullanıcı düzenleme görünümü kurulacak. Dosya içerikleri otomatik
olarak okunmaz; seçili köklerde ad/yol/boyut/değişim bilgisi indekslenir. Özel hesap
alanları Windows DPAPI /Electron safeStorage ile şifrelenir; model bağlamına girmez.

İlk6 SQLite testi geçti: yeniden açılış/sunucu silme, Türkçe FTS önek, hesap
yalıtımı/çıkış, kayıt sürümleri/wiki linkleri, giden mesaj ile sunucu kimliği eşleme,
şifreli özel hesap ve geç hesap sonucu, dosya yolu/kaybolan dosya kaydı.

## Konum ve canlı kaynaklar

Windows cihaz konumu alınamazsa şehir seçimi kullanılacak. Saat cihazın saat
dilimiyle gelir. MET Norway global tahmin verisi (CC BY4, tanımlayıcı User-Agent ve
HTTP önbelleği) kullanılır. Nominatim yalnız şehir aramada, önbellekle çağrılır.
AFAD resmi son deprem JSON'u, USGS Atom, Anadolu Ajansı güncel RSS ve Orman Genel
Müdürlüğü resmi RSS kaynakları canlı HTTP200 ile doğrulandı. MGM ana sayfasında
RSS bağlantısı bulunmadı; uydurma URL eklenmedi. Özel HTTPS RSS kaynağı eklenebilir.
Deprem60s /haber300s kontrol, tarih/konum/büyüklük koşulu ve kalıcı tekilleştirme.
Bildirimler uygulama açıkken ve hesap bağlıyken çalışır; eski haber seli bildirilmez.
Bir afetin önceden tahmini veya deprem erken uyarı sistemi olduğu iddia edilmez.

## Bilgisayar kontrolü

Ekranlar Electron desktopCapturer ile alınır; Windows SendInput/UIAutomation
ayrı PowerShell işçisi kullanır. Ses işçisi değişmez. Yerel kontrol açıkken görev
başlatılır; görünür görev durumu, durdurma düğmesi ve F8 bulunacak. Her eylemden
önce yeni gözlem; eski gözlem/hesap sonucu eylem yaptıramaz. DPI ve çoklu monitör
eşlemesi uygulanır. Şifreli hesaplar henüz otomatik araçlara açılmaz. Planlayıcı
seçili Veriüssü modeliyle tek JSON eylem üretir; ekran/yabancı içerik talimat sayılmaz.
Geri döndürülemez/yayın/gönderim eyleminde açık görev yetkisi yoksa somut eylem onayı
istenir. Onaydan sonra ekran yeniden gözlenir; eski koordinat körlemesine kullanılmaz.

Native salt okuma gözlemi gerçek Windows'ta160 erişilebilir öğe döndürdü. Henüz
klavye/fare kabul testi yapılmadı. Görev sınıfı ve kontrol sınıfı yazıldı, entegrasyon
ve testler devam ediyor. Görsel model ekranı kullanır; diğer modeller erişilebilirlik
öğeleriyle sınırlıdır, görmediği koordinatı tahmin ederek kullanamaz.

## Sunucuya ek sözleşme

Mevcut CHAT mesajına opsiyonel desktopContext/desktopMode/desktopImage alanları.
Görünen kullanıcı metni, web sohbeti ve faturalama korunur. Konum/hafıza bağlamı
mesaj metnine karıştırılmaz. Bilgisayar modunda JSON eylem protokolü normal sohbetin
metin biçimi/kalite dönüştürücüsünden ayrılır. Ekran geçici çalışma girdisidir; terminal
işlemden sonra media_options içindeki görüntü temizlenir, genel run yanıtına konmaz.
Yeni tablo gerekmez. Kontrolör ve execution dosyalarının salt okunur kopyası alındı;
server/desktop-context.ts ve dar desktop-context.patch hazırlanıyor. Henüz sunucu
değiştirilmedi/yayınlanmadı. Dağıtımda çalışan imaj/ortam/portlar korunmalı, yedek ve
dar geri alma kullanılmalı. 10203 sohbet portu değişmeyecek.

## Kalan kabul işleri

- Yerel servisleri doğrulanmış hesap ve API akışına bağla; eski sunucu belleğini eşle.
- Hafıza, kaynaklar/konum ve bilgisayar görevi arayüzlerini mevcut tasarımda ekle.
- Özel hesap gerçek Windows şifreleme; dosya indeksi, hesap değişimi ve iptal testleri.
- Kaynak parse/önbellek/tekilleştirme/bağlantı kesilmesi testleri.
- Yerel kontrol ve ajan: sahte planlayıcı +gerçek yalıtılmış test penceresinde giriş.
- Sunucu opsiyonel bağlam/JSON protokolü, normal web sohbeti regresyonu; dar yayın.
- Tüm mevcut ses/mikrofon/yanıt testleri; Windows installer ve GitHub bütünlüğü.

## [2026-11-05] Tamamlama ve inceleme kaydı

Üç bölümün servisleri, gerçek hesap akışına entegrasyonu ve mevcut tasarımdaki
arayüzleri tamamlandı. Kaynaklar canlı erişimle, süreçler hem birim hem gerçek
Electron/native/HTTP testleriyle sınandı. Sunucuya dar güncelleme uygulandı;
chat ve iki worker healthy, ortam/portlar korundu. Yedek:
`/root/umay-desktop-1793829033`. 103 Node ve60 Python PASS; paket kontrolü
ve GitHub eşleştirmesi son teslim kapılarıdır.

İnceleme altı önemli bulgu verdi: ekranın queued cancel/crash halinde kalması,
görmeyen modelin koordinat kullanması, tarama başlangıcında hesap kökü sızması,
sıradan notun bağlama girmemesi, çeviri alıntısının profil sayılması ve CSP'nin
ekran önizlemesini engellemesi. Hepsi doğrulandı ve düzeltildi. SQLite/native
RED→GREEN testleri, gerçek Electron image.decode ve sunucu gerçek DB terminal
geçişi testleriyle denetlendi. Uzun giriş32 Unicode karakter parçalarına ayrıldı;
Stop sonraki parçayı engeller, devam eden tek OS girişini geri saramaz.

Ruling: Mevcut development çalışma alanında devam edildi — kullanıcı yarıda
kalan işi aynı yerden, atlamadan sürdürmeyi istedi; yeni worktree'ye taşıyıp
kurulu model/runtime bağımlılıklarını yeniden başlatmak yerine mevcut
kaynaklar ve testler korundu. Yanlışsa maliyet: dal izolasyonu ayrıca yapılır.
Ruling: Sonlu açık kişisel bilgi kuralları ve tüm sohbet arşivi kullanılır —
alıntı/örnekten kişilik çıkarımı yapılmaz, her tur ek LLM çıkarım çağrısı
ses/yanıt gecikmesini artırmaz. Maliyet: örtük tercihler not olarak elle eklenebilir.
Ruling: Kaynaklar dakikalık/periyodik sorgulanır — bu, yayınlanmış afet haberini
bildirir; depremi önceden tahmin etmez. Uygulama kapalıyken sistem servisi çalışmaz.
Ruling: Görsel model dışındaki modeller yalnız erişilebilirlik öğelerini kullanır —
görmedikleri koordinatları çalıştırmazlar. Her uygulama aynı erişilebilirliği sunmaz.
Ruling: İnceleyenin canlı kaynak/harici model davranışı değerlendirmesi dışında
bıraktığı alanlar ürün sınırıdır; kaynak bağlantısı hatası görünür, seçili modelin
hatalı/eksik JSON'u görünür görev hatası olur. Evrensel model kalite garantisi verilmez.

Kaynaklar ve kullanım:
- Electron safeStorage (Windows DPAPI): https://www.electronjs.org/docs/latest/api/safe-storage
- Ekran yakalama: https://www.electronjs.org/docs/latest/api/desktop-capturer
- MET Norway: https://api.met.no/doc/TermsOfService ve https://api.met.no/doc/locationforecast/HowTO
- MET Norway CC BY4 atıf: https://www.met.no/en/free-meteorological-data/Licensing-and-crediting
- USGS Atom (güncelleme dakikalık): https://earthquake.usgs.gov/earthquakes/feed/v1.0/atom.php
- AFAD: https://deprem.afad.gov.tr/last-earthquakes.html
- AA RSS: https://www.aa.com.tr/tr/rss/default?cat=guncel
- OGM RSS kaynağı: https://www.ogm.gov.tr/tr/takip-edin/rss
- Şehir araması Nominatim: https://operations.osmfoundation.org/policies/nominatim/

Özel hesaplar kullanıcı tarafından girilen şifreli kayıtlardır; e-posta/sosyal ağ
hesaplarını henüz otomatik açan OAuth entegrasyonu yoktur. Kullanıcının bu alanı
ileride kullanacağı talebi doğrultusunda altyapı hazırlanmıştır.

Paket0.4.0 doğrulaması: asar sürümü ve17 uygulama kaynağı byte eşit;
asar.unpacked içindeki native-desktop.ps1 eşit;4 konuşma modülü değişmeden
birebir. Paket içindeki computer-control.cjs +native yardımcıyla gerçek Windows
UIAutomation/ekran/SendInput/Türkçe/Ctrl+A test penceresi PASS.
Installer 478594521 byte, SHA256:1ff33be1a23a5ccf440818c6a54a8708cf0b3b2e4aa9b6dfb8cc9582863e367c.
