var SS_ID = SpreadsheetApp.getActiveSpreadsheet().getId();


// --- 1. ŞİFRELEME (HASH) FONKSİYONU ---
function sifreKriptola(sifre) {
  if (!sifre) return "";
  var imza = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(sifre).trim(), Utilities.Charset.UTF_8);
  var hexString = '';
  for (var i = 0; i < imza.length; i++) {
    var byte = imza[i];
    if (byte < 0) byte += 256;
    var hexStr = byte.toString(16);
    if (hexStr.length == 1) hexStr = '0' + hexStr;
    hexString += hexStr;
  }
  return hexString;
}


// --- 2. SAYFA BULUCU ---
function getSheetSafe(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toLocaleUpperCase('tr-TR') === sheetName.toLocaleUpperCase('tr-TR')) {
      return sheets[i];
    }
  }
  return null;
}


// --- 3. SİSTEM AÇILIŞI ---
function doGet() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var uygulamaAdi = "BORUSAN PORTAL";
  var okulAdi = "BORUSAN ASIM KOCABIYIK MTAL";
  var logoUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Ministry_of_National_Education_%28Turkey%29_logo.svg/512px-Ministry_of_National_Education_%28Turkey%29_logo.svg.png";
 
  try {
    var bilgiSheet = getSheetSafe(ss, "BILGI");
    if (bilgiSheet) {
      var data = bilgiSheet.getDataRange().getValues();
      for (var i = 0; i < data.length; i++) {
        var key = String(data[i][0]).trim().toUpperCase();
        if (key === "UYGULAMA_ADI") uygulamaAdi = String(data[i][1]).trim();
        else if (key === "OKUL_ADI") okulAdi = String(data[i][1]).trim();
        else if (key === "LOGO") {
          var link = String(data[i][1]).trim();
          if(link !== "") logoUrl = link;
        }
      }
    }
  } catch (e) {}


  var template = HtmlService.createTemplateFromFile('Index');
  template.uygulamaAdi = uygulamaAdi;
  template.okulAdi = okulAdi;
  template.logoUrl = logoUrl;
 
  return template.evaluate()
      .setTitle(uygulamaAdi)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}


// --- 4. GİRİŞ İŞLEMİ (HASH KONTROLLÜ) ---
function girisYap(id, sifre) {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var kSheet = getSheetSafe(ss, "KULLANICI");
    var uSheet = getSheetSafe(ss, "UYGULAMALAR");
   
    if (!kSheet || !uSheet) return { basari: false, mesaj: "Veritabanı sayfaları bulunamadı." };
   
    var kData = kSheet.getDataRange().getValues();
    var uData = uSheet.getDataRange().getValues();
   
    var temizInputId = String(id).trim();
    var kriptoluGirisSifresi = sifreKriptola(sifre);
   
    var uygulamalar = [];
    for (var i = 1; i < uData.length; i++) {
      if (uData[i][0]) {
        uygulamalar.push({
          kod: String(uData[i][0]).trim(),
          ad: String(uData[i][1]).trim(),
          aciklama: uData[i][2] ? String(uData[i][2]).trim() : "",
          link: uData[i][3] ? String(uData[i][3]).trim() : "#"
        });
      }
    }
   
    var headers = kData[0].map(function(h) { return String(h).trim().toUpperCase(); });
    var idIndex = headers.indexOf("ID") !== -1 ? headers.indexOf("ID") : 1;
    var sifreIndex = headers.indexOf("SIFRE") !== -1 ? headers.indexOf("SIFRE") : 2;
    var durumIndex = headers.indexOf("DURUM") !== -1 ? headers.indexOf("DURUM") : 0;
    var adIndex = headers.indexOf("AD") !== -1 ? headers.indexOf("AD") : 3;
    var soyadIndex = headers.indexOf("SOYAD") !== -1 ? headers.indexOf("SOYAD") : 4;
   
    for (var i = 1; i < kData.length; i++) {
      var rowId = kData[i][idIndex] !== undefined ? String(kData[i][idIndex]).trim() : "";
     
      if (rowId === temizInputId) {
        var rawDurum = kData[i][durumIndex] ? String(kData[i][durumIndex]).trim().toLocaleUpperCase('tr-TR') : "";
        var tablodakiKriptoluSifre = kData[i][sifreIndex] !== undefined ? String(kData[i][sifreIndex]).trim() : "";
       
        if (rawDurum !== "AKTİF" && rawDurum !== "AKTIF" && rawDurum !== "") return { basari: false, mesaj: "Hesap aktif değil." };
        if (tablodakiKriptoluSifre !== kriptoluGirisSifresi) return { basari: false, mesaj: "Şifre hatalı!" };
       
        var ad = kData[i][adIndex];
        var soyad = kData[i][soyadIndex];
        var kullaniciYetkileri = {};
       
        for (var j = 0; j < uygulamalar.length; j++) {
          var appKod = String(uygulamalar[j].kod).trim().toUpperCase();
          var colIndex = headers.indexOf(appKod);
          var yetkiDegeri = colIndex !== -1 ? kData[i][colIndex] : "";
          var aktifMi = (yetkiDegeri !== null && yetkiDegeri !== undefined && String(yetkiDegeri).trim() !== "" && String(yetkiDegeri).toLocaleUpperCase('tr-TR') !== "FALSE");
          kullaniciYetkileri[appKod] = { yetki: yetkiDegeri, aktif: aktifMi };
        }
        return { basari: true, adSoyad: ad + " " + soyad, uygulamalar: uygulamalar, yetkiler: kullaniciYetkileri };
      }
    }
    return { basari: false, mesaj: "Bu ID bulunamadı!" };
  } catch (err) {
    return { basari: false, mesaj: "Sistem Hatası: " + err.message };
  }
}


// --- 5. ŞİFRE SIFIRLAMA TALEBİ ---
function sifreSifirlamaTalebi(kullaniciId) {
  var kilit = LockService.getScriptLock();
  try {
    kilit.waitLock(10000);
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = getSheetSafe(ss, "KULLANICI");
    if (!sheet) return { basari: false, mesaj: "Veritabanı hatası." };
   
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim().toUpperCase(); });
   
    var idIndex = headers.indexOf("ID") !== -1 ? headers.indexOf("ID") : 1;
    var emailIndex = headers.indexOf("MAIL");
    var kodIndex = headers.indexOf("GECICI_KOD");
    var adIndex = headers.indexOf("AD") !== -1 ? headers.indexOf("AD") : 3;
    var soyadIndex = headers.indexOf("SOYAD") !== -1 ? headers.indexOf("SOYAD") : 4;
   
    if (emailIndex === -1) return { basari: false, mesaj: "Sistemde 'MAIL' sütunu bulunamadı!" };
    if (kodIndex === -1) return { basari: false, mesaj: "Sistemde 'GECICI_KOD' sütunu bulunamadı!" };
   
    var temizId = String(kullaniciId).trim();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]).trim() === temizId) {
        var email = data[i][emailIndex];
        if (!email || String(email).trim() === "") return { basari: false, mesaj: "Bu ID'ye tanımlı bir mail adresi bulunmuyor." };
       
        var rastgeleKod = Math.floor(100000 + Math.random() * 900000).toString();
        sheet.getRange(i + 1, kodIndex + 1).setValue(rastgeleKod);
       
        var adSoyad = data[i][adIndex] + " " + data[i][soyadIndex];
var konu = "Borusan Portal Şifre Sıfırlama Kodunuz";


// Spam filtrelerini aşmak için profesyonel HTML tablo yapısı
var htmlMesaj = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
  <h2 style="color: #ea580c; text-align: center; margin-bottom: 20px; font-weight: bold;">Borusan Portal</h2>
  <p style="color: #334155; font-size: 16px;">Sayın <b>${adSoyad}</b>,</p>
  <p style="color: #475569; font-size: 15px; line-height: 1.5;">Borusan Portal hesabınız için şifre sıfırlama talebinde bulundunuz. İşleminize devam edebilmeniz için tek kullanımlık güvenlik kodunuz aşağıda belirtilmiştir:</p>
 
  <div style="text-align: center; margin: 35px 0;">
    <span style="font-size: 28px; font-weight: bold; background-color: #f8fafc; border: 2px dashed #cbd5e1; padding: 12px 24px; border-radius: 8px; letter-spacing: 6px; color: #0f172a;">${rastgeleKod}</span>
  </div>
 
  <p style="color: #64748b; font-size: 13px; line-height: 1.4;"><em><strong style="color:#ef4444">Uyarı:</strong> Hesabınızın güvenliği için bu kodu kimseyle paylaşmayınız. Eğer bu talebi siz yapmadıysanız, bu e-postayı lütfen dikkate almayınız.</em></p>
 
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
  <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Borusan Asım Kocabıyık MTAL - Bilgi İşlem Servisi<br>Bu e-posta otomatik olarak oluşturulmuştur, lütfen yanıtlamayınız.</p>
</div>
`;


// Gelişmiş Gönderim Parametreleri
MailApp.sendEmail({
  to: email,
  subject: konu,
  htmlBody: htmlMesaj,
  name: "Borusan Portal Destek", // Mailin kimden geldiğini gösterir (Spam filtresini rahatlatır)
  replyTo: "noreply@borusan.com" // Yanıtlanamaz bir mail imajı çizer
});
        var gizliMail = String(email).substring(0, 3) + "***" + String(email).substring(String(email).indexOf("@"));
        return { basari: true, mesaj: "Doğrulama kodu " + gizliMail + " adresine gönderildi." };
      }
    }
    return { basari: false, mesaj: "Sistemde böyle bir ID bulunamadı." };
  } catch (err) {
    return { basari: false, mesaj: "Hata: " + err.message };
  } finally {
    kilit.releaseLock();
  }
}


// --- 6. YENİ ŞİFREYİ ONAYLA VE KAYDET ---
function yeniSifreyiKaydet(kullaniciId, girilenKod, yeniSifre) {
  var kilit = LockService.getScriptLock();
  try {
    kilit.waitLock(10000);
    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = getSheetSafe(ss, "KULLANICI");
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim().toUpperCase(); });
   
    var idIndex = headers.indexOf("ID") !== -1 ? headers.indexOf("ID") : 1;  
    var sifreIndex = headers.indexOf("SIFRE");
    var kodIndex = headers.indexOf("GECICI_KOD");
   
    var temizId = String(kullaniciId).trim();
    var temizKod = String(girilenKod).trim();
   
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]).trim() === temizId) {
        var tablodakiKod = String(data[i][kodIndex]).trim();
        if (tablodakiKod === "" || tablodakiKod !== temizKod) {
          return { basari: false, mesaj: "Girdiğiniz doğrulama kodu hatalı veya süresi geçmiş!" };
        }
       
        var kriptoluYeniSifre = sifreKriptola(yeniSifre);
        sheet.getRange(i + 1, sifreIndex + 1).setValue(kriptoluYeniSifre);
        sheet.getRange(i + 1, kodIndex + 1).setValue(""); // OTP kullanıldı, imha et
       
        return { basari: true, mesaj: "Şifreniz başarıyla değiştirildi. Giriş yapabilirsiniz." };
      }
    }
    return { basari: false, mesaj: "Kullanıcı bulunamadı." };
  } catch (err) {
    return { basari: false, mesaj: "Hata: " + err.message };
  } finally {
    kilit.releaseLock();
  }
}


// --- 7. ADMİN İÇİN: MANUEL EKLENEN ŞİFRELERİ KRİPTOLAMA ARACI ---
function tumEskiSifreleriKriptola() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var sheet = getSheetSafe(ss, "KULLANICI");
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim().toUpperCase(); });
  var sifreIndex = headers.indexOf("SIFRE");
 
  if (sifreIndex === -1) return;
 
  for (var i = 1; i < data.length; i++) {
    var mevcutSifre = String(data[i][sifreIndex]).trim();
    // SHA-256 kodları 64 karakterdir. Değilse düz metindir, kriptola.
    if (mevcutSifre !== "" && mevcutSifre.length !== 64) {
      var yeniKriptolu = sifreKriptola(mevcutSifre);
      sheet.getRange(i + 1, sifreIndex + 1).setValue(yeniKriptolu);
    }
  }
}





