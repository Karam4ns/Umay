# Umay kontrol merkezi ve giriş ekranı

Referans: kullanıcının verdiği “UMAY Fütüristik Yapay Zekâ Kontrol Merkezi.png”.
Seçilen yön: gece laciverti, cam paneller, ince turkuaz sınırlar; merkezde kanat
işaretli enerji küresi, solda sabit gezinme ve sağda gerçek sistem/konuşma verileri.
Vurgu moru yalnız küre ve ikinci eylemlerde, amber yalnız planlanan otomasyon alanında.
Renkler: zemin #030d14, panel #071b27, çizgi #174456, turkuaz #20dfee,
metin #e8f6ff, ikincil #8aa5b8. Sistem sans yazı, okunaklı 14–16px gövde.
Yapay küre SVG/CSS ile çizilir; çalışan kontrolleri görüntünün içine gömmeyiz.

Giriş/kayıt Codex benzeri ayrı karşılamadır: aynı markayla iki mod, Veriüssü ile
devam et düğmesi ve tarayıcı bekleme durumu. Parola uygulamaya girilmez;
mevcut state/PKCE akışı sürer. Kayıt niyeti tarayıcıdaki kayıt yönlendirmesine taşınır.
Oturum başarıyla doğrulanınca kontrol merkezi açılır; çıkışta karşılama geri gelir.

Ana sayfa ve sohbet tek işlevsel sohbet alanını paylaşır; mesaj varken sahne küçülür.
Ayarlar konuşma paketleri/klon/güncellemeyi, Hafıza gerçek sunucu kaydını gösterir.
Referanstaki geliştirilmemiş ajan/otomasyon/dosya eylemleri “Yakında” ile pasiftir;
örnek tamamlanmış görev veya sahte yüzde gösterilmez. CPU/RAM/disk ölçümü gerçek;
ölçülemeyen alan çizgiyle belirtilir. Geçmiş ve konuşma hazır durumu mevcut API'lerden gelir.
Koyu varsayılan, açık tema da korunur. Dar pencerede sağ panel kapanır ve menü küçülür.

## Yol haritası

- [x] Giriş/kayıt, oturum geçişleri ve gezinme regresyonlarını önce yaz/çalıştır.
- [x] Yerel SVG marka/küre ve pencere düzeni, giriş/kayıt, kontrol merkezi HTML/CSS.
- [x] Renderer mevcut ses/sohbet işlevlerini koruyarak hesap ve gezinme durumlarını bağla.
- [x] Güvenli pencere kontrolleri, gerçek sistem göstergeleri, kayıt intent aktarımı.
- [x] Node/Python ve gerçek Electron giriş/kayıt/ana ekran/ayarlar/sohbet/mikrofon kontrolleri.
- [x] Masaüstü/dar pencere/açık tema görsel QA, kod incelemesi, 0.2.0 installer ve GitHub.

Karar: bu çalışma mevcut development dalında sürer; tasarım kapsamı kullanıcının
uygulama tasarımını şimdi uygulama talebiyle yetkilidir. Önceki imzalama ertelemesi sürer.
