# Varsayılan tarayıcı ile giriş/çıkış — 0.1.1

Kullanıcı talebi: Umay giriş ve çıkış işlemleri sistemin varsayılan tarayıcısıyla yapılacak.

## Tasarım ve uygulama

- Gömülü Electron giriş penceresi kaldırıldı. Sabit Veriüssü yetkilendirme URL'si
  main process içinden shell.openExternal ile açılır.
- Umay yalnız 127.0.0.1 üzerinde rastgele bir portta kısa ömürlü dönüş dinleyicisi açar.
  256 bit state ve PKCE S256 doğrulayıcısı giriş denemesine özeldir.
- Tarayıcıdaki mevcut site girişi kullanılır. Parola masaüstünde alınmaz ve tarayıcı
  çerezlerine erişilmez. Kullanıcı açıkça “Hesabımı Umay’a bağla” düğmesine basar.
- Sunucu 90 saniyelik şifreli kod üretir. Kod, mevcut web_sessions üzerinde tek kullanımlık
  kayıtla tutulur. Exchange, doğru PKCE doğrulayıcısı ve birebir dönüş URI'si ister;
  kaydı transaction içinde DELETE eder ve bağımsız masaüstü oturumu üretir.
- Oturum sırrı yalnız HTTPS exchange gövdesinde döner; renderer'a verilmez.
  Main process HttpOnly/Secure cookie olarak kalıcı Electron session deposuna yazar.
- Yanlış state, farklı callback, hatalı PKCE, süre dolması, eşzamanlı giriş ve iptal
  durumları test edilir. İptal sonrası gelen ve değiştirilen eski session token'ları iptal edilir.
- Çıkış mevcut masaüstü oturumunu sunucuda iptal eder, yerel durumu temizler ve
  varsayılan tarayıcıda ayrı Veriüssü çıkış onayı açar. Tarayıcıdaki site oturumu
  kullanıcı onayından sonra kapatılır; sayfayı sadece ziyaret etmek çıkış yaptırmaz.
- Oturum ömrü bu değişiklikle sınırsız yapılmaz; mevcut sunucu politikası 7 gündür.
  Uzun ömürlü refresh ayrı kabul koşulu olarak kalır.

## Sunucu değişiklikleri

`server/desktop-auth.controller.ts` ve `server/desktop-auth-policy.ts`, API src dizinine
eklenir; AppModule controllers listesine DesktopAuthController eklenir. Yeni tablo yoktur.
Eski AppModule dosyası sunucuda ayrı bir root yedek dizinine alındı.
Docker build içindeki TypeScript derlemesi geçti. Kaynak dizindeki ilgisiz değişiklikler
canlıya alınmadı: çalışan frontend imajı üzerine yalnız yeni iki derlenmiş dosya ve
controller kaydı eklendi. Sadece frontend yeniden oluşturuldu; sağlık kontrolü geçti.
Eski imaj geri dönüş etiketi ve override dosyasıyla sunucuda korunuyor.
Kaynak derlemesini engelleyen mevcut user-memory.controller.ts tür hatasına yalnız
`layers.notes!.active` non-null tür bildirimi eklendi; bu dosya canlı katmana taşınmadı.

## Test kapsamı

Loopback HTTP üzerinden gerçek callback testleri ve ortak sunucu politikasının PKCE,
expiry, URI sınırlama testleri yazıldı. Gerçek kullanıcının tarayıcı girişi ayrıca
ana cihazda denenmeli; otomatik testler kullanıcı oturumunu taklit ederek canlı hesaba girmez.

Referanslar: https://www.rfc-editor.org/rfc/rfc8252 ve
https://www.electronjs.org/docs/latest/api/shell#shellopenexternalurl-options

## [2026-11-04] Başarılı exchange yanıtı düzeltmesi
exchange HTTP yanıt başlığı ayarlarken @Res({passthrough:true}) kullanır; sonuç
nesnesini Nest gönderir. Önceki @Res() başarı yanıtını açık bırakıp masaüstünde
zaman aşımına yol açıyordu. Gerçek Nest/Fastify katmanındaki regresyon testi
`node tests/server-auth-http.cjs /path/to/api` komutuyla derlenmiş API bağımlılıkları
üzerinde çalışır; DB ve kullanıcı doğrulaması bu izole testte sahtedir.
Çalışan frontend imajı 0.1.2 controller katmanıyla güncellendi. Masaüstü 0.1.2 geçerlidir.
