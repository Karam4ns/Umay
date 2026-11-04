# Hesap bağlama ekranı

Amaç: kullanıcının istediği GPT benzeri sade hesap onayını Umay / Veriüssü kimliğiyle sunmak.
Seçilen yön: ortalanmış tek kart, bol boşluk, hesap satırı, erişim özeti ve tek belirgin bağlama eylemi.
Tam ekran tanıtım veya çok adımlı sihirbaz bu kısa onaya gereksiz adım ekler.

Renkler: zemin #fafafa, yüzey #ffffff, metin #171717, ikincil #737373,
çizgi #e5e5e5, eylem #171717. Koyu mod bunların ters kontrastlı eşlerini kullanır.
Yazı: sistem sans ailesi (Windows'ta Segoe UI), 30px başlık, 15px gövde.
Yerleşim: üstte Veriüssü markası; 448px onay kartı; kart içinde ortalanmış uygulama
işaretleri/başlık, sola hizalı hesap ve erişim özeti; tam genişlikte bağlama düğmesi.
Mobil: 24px dış boşluk, taşmayan hesap bilgisi, en az 44px tıklama hedefi.

Aktif hesap mevcut /site/auth/me üzerinden okunur; güvenilmeyen metin textContent ile
yazılır. Oturumsuz kullanıcı yeni sekmede mevcut /login veya /register sayfasına gider;
geri döndüğünde hesap yenilenir. Bağlama yalnız açık düğme onayıyla yapılır.
State/PKCE, exchange, izinli callback adresi ve oturum iptali sözleşmeleri korunur.
CSS/JS aynı kaynaktan sunulur; CSP genişletilerek inline script izni verilmez.

## Uygulama planı

- [x] Görünüm/client modülleri için oturumlu, oturumsuz ve hata durumlarını sınayan testleri yaz/çalıştır.
- [x] server/desktop-auth-view.ts: HTML ve açık/koyu/responsive CSS.
- [x] server/desktop-auth-client.ts: hesap gösterimi, tema ve mevcut onay formu davranışı.
- [x] Controller'a style.css güzergâhı ve yeni görünümü bağla; exchange davranışını koru.
- [x] Node testleri, gerçek Nest/Fastify HTTP regresyonu, masaüstü/mobil görsel kontrol.
- [x] Yalnız ilgili modülleri içeren sunucu katmanını dağıt; canlı kontroller ve GitHub kaydı.
