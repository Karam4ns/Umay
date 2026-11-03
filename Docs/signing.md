# Windows kod imzalama

**Güncel karar:** Kullanıcı imzalamayı sonraya bıraktı. Aşağıdaki hazırlık korunuyor;
bu sürüm için sertifika edinimi veya gerçek imzalama yapılmayacak.

2026-11-03: Kullanıcı önce imzasız test sürümünü seçti; son talebi imzalı dağıtımdır.
Bu cihazın CurrentUser/My ve LocalMachine/My depolarında kod imzalama sertifikası,
proje kaynaklarında PFX/P12 bulunmadı. Henüz imzalı installer üretilmedi.

## Hazırlanan yol

`npm run build:signed` geçerli bir imzalama girdisi olmadan durur; imzasız pakete
sessizce düşmez. `CSC_LINK` yerel PFX/P12 konumu, `CSC_KEY_PASSWORD` parolasıdır;
alternatif `UMAY_CERT_SHA1`, Windows deposundaki sertifikanın parmak izidir.
Parmak izindeki SHA1 adlandırması sertifika kimliğidir; dosya imzası SHA256 kullanır.
Sertifika/özel anahtar/parola Git'e eklenmez. Sertifika dosyaları .gitignore kapsamındadır.

Derleme forceCodeSigning ile NSIS üretir, RFC3161 zaman damgası ister ve final
installer'ı Get-AuthenticodeSignature ile denetler. Geçerli olmayan imzada başarı
bildirilmez. Yayın otomatik yapılmaz. Bulut imzalama hesabı varsa sağlayıcıya uygun
adapter ayrıca yapılandırılacak; PFX varmış gibi davranılmayacak.

## Bekleyen bilgi

Kullanıcının mevcut Windows kod imzalama sertifikası veya bulut imzalama hesabı.
Yoksa sağlayıcı ve hesap/kimlik doğrulama süreci seçilmelidir. Kendi oluşturduğumuz
self-signed sertifika, kullanıcı cihazlarında genel yayıncı güveni sağlamaz.

Referans: https://learn.microsoft.com/en-us/azure/artifact-signing/overview
Yerel electron-builder 26.18.0 şemasında signtoolOptions/forceCodeSigning doğrulandı.
