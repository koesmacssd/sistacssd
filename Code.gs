/**
 * SISTA-CSSD Backend Script (Code.gs)
 * Sistem Informasi Serah Terima Alat CSSD - RSUD dr. R. Koesma
 * 
 * Host: Google Apps Script (Web App RESTful API)
 * Database: Google Sheets
 */

// --- CONFIGURATION ---
var CONFIG_SHEET_NAME = 'config';
var USERS_SHEET_NAME = 'users';
var ITEMS_SHEET_NAME = 'items';
var ORDERS_SHEET_NAME = 'orders';
var DETAILS_SHEET_NAME = 'order_details';
var LOGS_SHEET_NAME = 'logs';

// Helper to get active sheet or open by ScriptProperty
function getSpreadsheet() {
  var id = '1J656JtbKRzBTjbhLEbXq7ks9mMc5IH-ObXz891JurQQ';
  try {
    if (id) return SpreadsheetApp.openById(id);
  } catch (e) {}
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  
  var propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (propId) {
    return SpreadsheetApp.openById(propId);
  }
  throw new Error("Spreadsheet tidak ditemukan. Silakan buka dari Spreadsheet bound-script atau atur SPREADSHEET_ID di Script Properties.");
}

// Helper to get config values
function getConfig(key, defaultValue) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sheet) return defaultValue;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === key) return data[i][1];
    }
  } catch (e) {}
  return defaultValue;
}

// Log activity to Sheet
function writeLog(email, activity) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(LOGS_SHEET_NAME);
    if (sheet) {
      sheet.appendRow([new Date(), email, activity]);
    }
  } catch (e) {
    Logger.log("Log error: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}

// --- JWT GOOGLE SSO VERIFICATION ---
function verifyGoogleToken(idToken) {
  if (!idToken) return null;
  try {
    var url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      var data = JSON.parse(response.getContentText());
      if (data.email) {
        return {
          email: data.email,
          name: data.name || data.email.split('@')[0],
          picture: data.picture || ''
        };
      }
    }
  } catch (e) {
    Logger.log("Token verification failed: " + e.toString());
  }
  return null;
}

// Helper for JSON Response
function jsonResponse(success, message, data) {
  var output = {
    success: success,
    message: message || '',
    data: data || null
  };
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

// Memastikan semua tab sheet ada sebelum request diproses
function ensureDatabaseInitialized() {
  try {
    var ss = getSpreadsheet();
    if (!ss.getSheetByName(USERS_SHEET_NAME)) {
      initDatabase();
    }
  } catch (e) {
    Logger.log("Auto-initialization failed: " + e.toString());
  }
}

// --- API ROUTING: GET ---
function doGet(e) {
  ensureDatabaseInitialized();
  try {
    var action = e.parameter.action;
    var idToken = e.parameter.credential;
    var devEmail = e.parameter.dev_email; // Untuk kemudahan pengujian jika SSO tidak aktif
    
    // Autentikasi user
    var userEmail = "";
    var userName = "";
    if (idToken) {
      var verified = verifyGoogleToken(idToken);
      if (verified) {
        userEmail = verified.email;
        userName = verified.name;
      } else {
        return jsonResponse(false, "Token autentikasi tidak valid atau telah kedaluwarsa.");
      }
    } else if (devEmail) {
      userEmail = devEmail;
      userName = devEmail.split('@')[0];
    }
    
    if (!action) {
      return jsonResponse(false, "Parameter 'action' diperlukan.");
    }

    // Inisialisasi Database (Bisa diakses siapa saja untuk setup awal)
    if (action === 'initDb') {
      return initDatabase();
    }

    if (!userEmail) {
      return jsonResponse(false, "Autentikasi diperlukan. Kirim parameter 'credential' atau 'dev_email'.");
    }

    // Ambil User Role
    var userProfile = getUserProfile(userEmail);
    if (!userProfile) {
      // Jika email adalah Super Admin default tapi belum terdaftar, daftarkan otomatis
      if (userEmail.toLowerCase() === 'syamsul18782@gmail.com') {
        registerUserAuto(userEmail, userName, 'Super Admin', 'CSSD');
        userProfile = getUserProfile(userEmail);
      } else {
        return jsonResponse(false, "User belum terdaftar.", { code: "NOT_REGISTERED", email: userEmail, name: userName });
      }
    }

    if (userProfile.status_aktif !== 'Aktif') {
      return jsonResponse(false, "Akun Anda sedang menunggu persetujuan Admin atau dinonaktifkan.", { code: "PENDING_APPROVAL", email: userEmail, status: userProfile.status_aktif });
    }

    var userRole = userProfile.peran;
    var userRoom = userProfile.nama_ruangan;

    switch (action) {
      case 'getUserProfile':
        return jsonResponse(true, "Profil user berhasil diambil.", userProfile);
        
      case 'getItems':
        return getItemsData();
        
      case 'getOrders':
        // Ruangan hanya melihat order mereka sendiri, Admin/Super Admin melihat semua
        var filterRoom = (userRole === 'Ruangan') ? userRoom : null;
        var filterEmail = (userRole === 'Ruangan') ? userEmail : null;
        return getOrdersData(filterRoom, filterEmail);
        
      case 'getUsers':
        if (userRole !== 'Admin' && userRole !== 'Super Admin') {
          return jsonResponse(false, "Akses ditolak. Hanya untuk Admin/Super Admin.");
        }
        return getUsersData();
        
      case 'getLogs':
        if (userRole !== 'Admin' && userRole !== 'Super Admin') {
          return jsonResponse(false, "Akses ditolak. Hanya untuk Admin/Super Admin.");
        }
        return getLogsData();

      default:
        return jsonResponse(false, "Action GET '" + action + "' tidak dikenali.");
    }
  } catch (error) {
    return jsonResponse(false, "Error: " + error.toString());
  }
}

// --- API ROUTING: POST ---
function doPost(e) {
  ensureDatabaseInitialized();
  var lock = LockService.getScriptLock();
  try {
    // Tunggu lock hingga 15 detik
    lock.waitLock(15000);

    var postData;
    if (e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        postData = e.parameter;
      }
    } else {
      postData = e.parameter;
    }

    var action = postData.action;
    var idToken = postData.credential;
    var devEmail = postData.dev_email;
    
    // Autentikasi user
    var userEmail = "";
    var userName = "";
    if (idToken) {
      var verified = verifyGoogleToken(idToken);
      if (verified) {
        userEmail = verified.email;
        userName = verified.name;
      } else {
        return jsonResponse(false, "Token autentikasi tidak valid atau telah kedaluwarsa.");
      }
    } else if (devEmail) {
      userEmail = devEmail;
      userName = devEmail.split('@')[0];
    }

    if (!action) {
      return jsonResponse(false, "Parameter 'action' diperlukan.");
    }

    if (!userEmail) {
      return jsonResponse(false, "Autentikasi diperlukan.");
    }

    // Cek registrasi user (Registrasi baru tidak perlu check active status)
    if (action === 'registerUser') {
      return registerUser(postData, userEmail);
    }

    var userProfile = getUserProfile(userEmail);
    if (!userProfile) {
      return jsonResponse(false, "User belum terdaftar.", { code: "NOT_REGISTERED", email: userEmail, name: userName });
    }

    if (userProfile.status_aktif !== 'Aktif') {
      return jsonResponse(false, "Akun Anda sedang menunggu persetujuan.", { code: "PENDING_APPROVAL", email: userEmail });
    }

    var userRole = userProfile.peran;
    var userRoom = userProfile.nama_ruangan;

    switch (action) {
      case 'updateUserStatus':
        if (userRole !== 'Admin' && userRole !== 'Super Admin') {
          return jsonResponse(false, "Akses ditolak.");
        }
        return updateUserStatus(postData, userEmail);
        
      case 'createOrder':
        return createOrder(postData, userEmail, userRoom);
        
      case 'updateOrderStatus':
        return updateOrderStatus(postData, userEmail, userRole);
        
      case 'updateItemCycle':
        if (userRole !== 'Admin' && userRole !== 'Super Admin') {
          return jsonResponse(false, "Akses ditolak.");
        }
        return updateItemCycle(postData, userEmail);
        
      case 'uploadImage':
        if (userRole !== 'Admin' && userRole !== 'Super Admin') {
          return jsonResponse(false, "Akses ditolak.");
        }
        return uploadImage(postData, userEmail);

      case 'manageItems':
        if (userRole !== 'Admin' && userRole !== 'Super Admin') {
          return jsonResponse(false, "Akses ditolak.");
        }
        return manageItems(postData, userEmail);
        
      default:
        return jsonResponse(false, "Action POST '" + action + "' tidak dikenali.");
    }
  } catch (error) {
    return jsonResponse(false, "Error: " + error.toString());
  } finally {
    lock.releaseLock();
  }
}

// --- DATABASE OPERATIONS ---

// Get User Profile
function getUserProfile(email) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1].toLowerCase() === email.toLowerCase()) {
      return {
        id: data[i][0],
        email: data[i][1],
        nama: data[i][2],
        peran: data[i][3],
        nama_ruangan: data[i][4],
        status_aktif: data[i][5]
      };
    }
  }
  return null;
}

// Get Users List
function getUsersData() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(USERS_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < data.length; i++) {
    users.push({
      id: data[i][0],
      email: data[i][1],
      nama: data[i][2],
      peran: data[i][3],
      nama_ruangan: data[i][4],
      status_aktif: data[i][5]
    });
  }
  return jsonResponse(true, "Daftar user berhasil dimuat.", users);
}

// Get Items List
function getItemsData() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length; i++) {
    items.push({
      id_alat: data[i][0],
      nama_alat: data[i][1],
      deskripsi: data[i][2],
      foto_drive_url: data[i][3],
      status_posisi: data[i][4],
      tanggal_sterilisasi: data[i][5] ? Utilities.formatDate(new Date(data[i][5]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : '',
      tanggal_kadaluwarsa_steril: data[i][6] ? Utilities.formatDate(new Date(data[i][6]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : ''
    });
  }
  return jsonResponse(true, "Inventaris alat berhasil dimuat.", items);
}

// Get Orders & Details List
function getOrdersData(filterRoom, filterEmail) {
  var ss = getSpreadsheet();
  var ordersSheet = ss.getSheetByName(ORDERS_SHEET_NAME);
  var detailsSheet = ss.getSheetByName(DETAILS_SHEET_NAME);
  var itemsSheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  
  var ordersData = ordersSheet.getDataRange().getValues();
  var detailsData = detailsSheet.getDataRange().getValues();
  var itemsData = itemsSheet.getDataRange().getValues();
  
  // Mapping item details
  var itemMap = {};
  for (var i = 1; i < itemsData.length; i++) {
    itemMap[itemsData[i][0]] = {
      nama_alat: itemsData[i][1],
      deskripsi: itemsData[i][2],
      foto_drive_url: itemsData[i][3]
    };
  }

  // Group details by order_id
  var detailsMap = {};
  for (var d = 1; d < detailsData.length; d++) {
    var orderId = detailsData[d][1];
    var itemId = detailsData[d][2];
    if (!detailsMap[orderId]) detailsMap[orderId] = [];
    detailsMap[orderId].push({
      id_detail: detailsData[d][0],
      id_alat: itemId,
      nama_alat: itemMap[itemId] ? itemMap[itemId].nama_alat : "Alat Tidak Dikenal",
      foto_drive_url: itemMap[itemId] ? itemMap[itemId].foto_drive_url : "",
      catatan_kondisi: detailsData[d][3]
    });
  }

  // Compile orders
  var orders = [];
  for (var o = 1; o < ordersData.length; o++) {
    var emailPeminjam = ordersData[o][1];
    var ruanganPeminjam = ordersData[o][2];
    
    // Filter
    if (filterRoom && ruanganPeminjam !== filterRoom) continue;

    var orderId = ordersData[o][0];
    orders.push({
      id_order: orderId,
      email_peminjam: emailPeminjam,
      ruangan_peminjam: ruanganPeminjam,
      status_order: ordersData[o][3],
      tanggal_request: ordersData[o][4] ? Utilities.formatDate(new Date(ordersData[o][4]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : '',
      tanggal_diambil: ordersData[o][5] ? Utilities.formatDate(new Date(ordersData[o][5]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : '',
      tanggal_kembali: ordersData[o][6] ? Utilities.formatDate(new Date(ordersData[o][6]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : '',
      items: detailsMap[orderId] || []
    });
  }
  
  // Sort order by tanggal_request descending
  orders.sort(function(a, b) {
    return new Date(b.tanggal_request) - new Date(a.tanggal_request);
  });

  return jsonResponse(true, "Daftar peminjaman berhasil dimuat.", orders);
}

// Get Logs
function getLogsData() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(LOGS_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var logs = [];
  // Ambil 200 logs terakhir
  var start = Math.max(1, data.length - 200);
  for (var i = start; i < data.length; i++) {
    logs.push({
      timestamp: data[i][0] ? Utilities.formatDate(new Date(data[i][0]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : '',
      email_aktor: data[i][1],
      aktivitas: data[i][2]
    });
  }
  logs.reverse(); // Terbaru di atas
  return jsonResponse(true, "Log aktivitas berhasil dimuat.", logs);
}

// --- POST METHODS LOGIC ---

// Register User
function registerUser(postData, userEmail) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(USERS_SHEET_NAME);
  
  // Cek jika sudah terdaftar
  var existing = getUserProfile(userEmail);
  if (existing) {
    return jsonResponse(false, "User sudah terdaftar.", existing);
  }
  
  var name = postData.nama || userEmail.split('@')[0];
  var room = postData.nama_ruangan || "Umum";
  var role = "Ruangan"; // Default role
  var status = "Pending"; // Butuh persetujuan
  
  var lastRow = sheet.getLastRow();
  var id = "USR-" + (lastRow + 1) + "-" + Math.floor(100 + Math.random() * 900);
  
  sheet.appendRow([id, userEmail, name, role, room, status]);
  writeLog(userEmail, "Registrasi user baru. Ruangan: " + room);
  
  // Kirim notifikasi ke Admin
  sendTelegramNotification("👤 *Registrasi User Baru*\nNama: " + name + "\nEmail: " + userEmail + "\nRuangan: " + room + "\nStatus: Menunggu Persetujuan Admin.");
  
  return jsonResponse(true, "Registrasi berhasil. Menunggu persetujuan Admin.", { id: id, email: userEmail, status: status });
}

// Auto register for Default Super Admin
function registerUserAuto(email, name, role, room) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(USERS_SHEET_NAME);
  var lastRow = sheet.getLastRow();
  var id = "USR-" + (lastRow + 1) + "-" + Math.floor(100 + Math.random() * 900);
  sheet.appendRow([id, email, name, role, room, 'Aktif']);
  writeLog(email, "Sistem otomatis mendaftarkan Super Admin default.");
}

// Update User Status (Approve/Reject/Change Role)
function updateUserStatus(postData, actorEmail) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(USERS_SHEET_NAME);
  var targetEmail = postData.target_email;
  var newStatus = postData.status_aktif; // 'Aktif' | 'Nonaktif' | 'Pending'
  var newRole = postData.peran; // 'Super Admin' | 'Admin' | 'Ruangan'
  var targetRoom = postData.nama_ruangan;
  
  if (!targetEmail) {
    return jsonResponse(false, "Parameter 'target_email' diperlukan.");
  }
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1].toLowerCase() === targetEmail.toLowerCase()) {
      var row = i + 1;
      
      // Keamanan: Hanya Super Admin yang bisa mengubah user dengan peran Super Admin / Admin
      var actorProfile = getUserProfile(actorEmail);
      var targetCurrentRole = data[i][3];
      if (targetCurrentRole === 'Super Admin' && actorProfile.peran !== 'Super Admin') {
        return jsonResponse(false, "Akses ditolak. Hanya Super Admin yang bisa mengubah akun Super Admin lain.");
      }
      
      if (newStatus) {
        sheet.getRange(row, 6).setValue(newStatus);
      }
      if (newRole) {
        sheet.getRange(row, 4).setValue(newRole);
      }
      if (targetRoom) {
        sheet.getRange(row, 5).setValue(targetRoom);
      }
      
      var msg = "Update User " + targetEmail + ": Status=" + (newStatus || 'N/A') + ", Peran=" + (newRole || 'N/A');
      writeLog(actorEmail, msg);
      
      // Kirim email notifikasi ke user jika status aktif disetujui
      if (newStatus === 'Aktif') {
        try {
          MailApp.sendEmail(targetEmail, 
            "Akun SISTA-CSSD Anda Telah Aktif", 
            "Halo " + data[i][2] + ",\n\nAkun SISTA-CSSD Anda telah disetujui oleh Admin. Sekarang Anda dapat menggunakan sistem.\n\nSalam,\nTim Admin CSSD RSUD dr. R. Koesma."
          );
        } catch (e) {
          Logger.log("Email failed: " + e.toString());
        }
      }
      
      return jsonResponse(true, "User berhasil diperbarui.", { email: targetEmail });
    }
  }
  
  return jsonResponse(false, "User tidak ditemukan.");
}

// Create Order (Multi-item Request)
function createOrder(postData, userEmail, userRoom) {
  var ss = getSpreadsheet();
  var ordersSheet = ss.getSheetByName(ORDERS_SHEET_NAME);
  var detailsSheet = ss.getSheetByName(DETAILS_SHEET_NAME);
  var itemsSheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  
  var itemIds = postData.item_ids; // Array [ "ALAT-01", "ALAT-02" ]
  var itemNotes = postData.item_notes || {}; // Objek { "ALAT-01": "catatan", ... }
  
  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    return jsonResponse(false, "Daftar item_ids kosong atau tidak valid.");
  }
  
  // 1. Validasi Ketersediaan Alat (Status harus 'Steril')
  var itemsData = itemsSheet.getDataRange().getValues();
  var itemsMap = {};
  for (var i = 1; i < itemsData.length; i++) {
    itemsMap[itemsData[i][0]] = {
      row: i + 1,
      nama: itemsData[i][1],
      status: itemsData[i][4]
    };
  }
  
  var invalidItems = [];
  for (var j = 0; j < itemIds.length; j++) {
    var itemId = itemIds[j];
    if (!itemsMap[itemId]) {
      invalidItems.push(itemId + " (Tidak ditemukan)");
    } else if (itemsMap[itemId].status !== 'Steril') {
      invalidItems.push(itemsMap[itemId].nama + " (Status: " + itemsMap[itemId].status + ")");
    }
  }
  
  if (invalidItems.length > 0) {
    return jsonResponse(false, "Beberapa alat tidak tersedia untuk dipinjam: " + invalidItems.join(', '));
  }
  
  // 2. Tulis ke Database
  var orderId = "ORD-" + new Date().getTime() + "-" + Math.floor(1000 + Math.random() * 9000);
  var now = new Date();
  
  // Tulis order header
  ordersSheet.appendRow([orderId, userEmail, userRoom, 'Pending', now, '', '']);
  
  // Tulis order details dan update status items -> 'Requested'
  for (var k = 0; k < itemIds.length; k++) {
    var itemId = itemIds[k];
    var detailId = "DTL-" + orderId.substring(4, 15) + "-" + (k + 1);
    var note = itemNotes[itemId] || '';
    
    // Tulis detail
    detailsSheet.appendRow([detailId, orderId, itemId, note]);
    
    // Update status alat di sheet items
    var itemRow = itemsMap[itemId].row;
    itemsSheet.getRange(itemRow, 5).setValue('Requested');
  }
  
  writeLog(userEmail, "Membuat request peminjaman baru " + orderId + " dengan " + itemIds.length + " item.");
  
  // Notifikasi
  var notifMessage = "📥 *Peminjaman Alat Baru*\nID: `" + orderId + "`\nRuangan: " + userRoom + "\nPengaju: " + userEmail + "\nJumlah Alat: " + itemIds.length + " item.\nStatus: Pending (Menunggu CSSD menyiapkan barang).";
  sendTelegramNotification(notifMessage);
  
  // Kirim email konfirmasi ke Peminjam
  try {
    MailApp.sendEmail(userEmail, 
      "Konfirmasi Request Peminjaman Alat " + orderId, 
      "Halo,\n\nPermintaan peminjaman alat steril dengan ID " + orderId + " telah kami terima dan sedang diproses oleh Tim CSSD.\n\nRuangan: " + userRoom + "\nJumlah Item: " + itemIds.length + "\n\nTerima kasih."
    );
  } catch (e) {
    Logger.log("Email failed: " + e.toString());
  }

  return jsonResponse(true, "Request peminjaman berhasil dibuat.", { id_order: orderId });
}

// Update Order Status
function updateOrderStatus(postData, actorEmail, actorRole) {
  var ss = getSpreadsheet();
  var ordersSheet = ss.getSheetByName(ORDERS_SHEET_NAME);
  var detailsSheet = ss.getSheetByName(DETAILS_SHEET_NAME);
  var itemsSheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  
  var orderId = postData.id_order;
  var nextStatus = postData.status_order; // 'Ready for Pickup' | 'Aktif' | 'Selesai'
  
  if (!orderId || !nextStatus) {
    return jsonResponse(false, "Parameter 'id_order' dan 'status_order' diperlukan.");
  }
  
  // Find order row
  var ordersData = ordersSheet.getDataRange().getValues();
  var orderRow = -1;
  var currentStatus = "";
  var borrowerEmail = "";
  var borrowerRoom = "";
  
  for (var o = 1; o < ordersData.length; o++) {
    if (ordersData[o][0] === orderId) {
      orderRow = o + 1;
      currentStatus = ordersData[o][3];
      borrowerEmail = ordersData[o][1];
      borrowerRoom = ordersData[o][2];
      break;
    }
  }
  
  if (orderRow === -1) {
    return jsonResponse(false, "ID Transaksi " + orderId + " tidak ditemukan.");
  }
  
  // Get items in this order
  var detailsData = detailsSheet.getDataRange().getValues();
  var orderItemIds = [];
  for (var d = 1; d < detailsData.length; d++) {
    if (detailsData[d][1] === orderId) {
      orderItemIds.push(detailsData[d][2]);
    }
  }

  // Get item rows in items sheet
  var itemsData = itemsSheet.getDataRange().getValues();
  var itemRowsMap = {};
  for (var i = 1; i < itemsData.length; i++) {
    itemRowsMap[itemsData[i][0]] = i + 1;
  }
  
  var now = new Date();
  
  // Status transition logic
  if (nextStatus === 'Ready for Pickup') {
    if (actorRole !== 'Admin' && actorRole !== 'Super Admin') return jsonResponse(false, "Akses ditolak.");
    if (currentStatus !== 'Pending') return jsonResponse(false, "Status transisi tidak valid. Status saat ini: " + currentStatus);
    
    // Update order
    ordersSheet.getRange(orderRow, 4).setValue('Ready for Pickup');
    
    // Update items -> 'Ready for Pickup'
    for (var a = 0; a < orderItemIds.length; a++) {
      var itemRow = itemRowsMap[orderItemIds[a]];
      if (itemRow) {
        itemsSheet.getRange(itemRow, 5).setValue('Ready for Pickup');
      }
    }
    
    writeLog(actorEmail, "Menyiapkan barang untuk " + orderId + ". Status: Ready for Pickup.");
    
    // Notifikasi
    sendTelegramNotification("📦 *Alat Siap Diambil*\nID Order: `" + orderId + "`\nRuangan: " + borrowerRoom + "\nSilakan perwakilan ruangan mengambil alat steril di CSSD.");
    try {
      MailApp.sendEmail(borrowerEmail,
        "Alat Siap Diambil - SISTA-CSSD [" + orderId + "]",
        "Halo,\n\nAlat-alat medis steril yang Anda minta dengan ID " + orderId + " telah disiapkan dan siap diambil di CSSD RSUD dr. R. Koesma.\n\nSilakan bawa kartu identitas ruangan Anda."
      );
    } catch (e) {}

  } else if (nextStatus === 'Aktif') {
    if (actorRole !== 'Admin' && actorRole !== 'Super Admin') return jsonResponse(false, "Akses ditolak.");
    if (currentStatus !== 'Ready for Pickup') return jsonResponse(false, "Status transisi tidak valid. Status saat ini: " + currentStatus);
    
    // Update order (Set status & tanggal_diambil)
    ordersSheet.getRange(orderRow, 4).setValue('Aktif');
    ordersSheet.getRange(orderRow, 6).setValue(now);
    
    // Update items -> 'Dipinjam [Ruangan]'
    for (var b = 0; b < orderItemIds.length; b++) {
      var itemRow = itemRowsMap[orderItemIds[b]];
      if (itemRow) {
        itemsSheet.getRange(itemRow, 5).setValue('Dipinjam ' + borrowerRoom);
      }
    }
    
    writeLog(actorEmail, "Konfirmasi serah terima alat untuk " + orderId + ". Status: Aktif.");
    sendTelegramNotification("🤝 *Serah Terima Selesai*\nID Order: `" + orderId + "`\nStatus: Aktif (Alat sedang dipinjam oleh " + borrowerRoom + ").");

  } else if (nextStatus === 'Selesai') {
    if (actorRole !== 'Admin' && actorRole !== 'Super Admin') return jsonResponse(false, "Akses ditolak.");
    if (currentStatus !== 'Aktif') return jsonResponse(false, "Status transisi tidak valid. Status saat ini: " + currentStatus);
    
    // Update order (Set status & tanggal_kembali)
    ordersSheet.getRange(orderRow, 4).setValue('Selesai');
    ordersSheet.getRange(orderRow, 7).setValue(now);
    
    // Update items -> 'Kotor'
    for (var c = 0; c < orderItemIds.length; c++) {
      var itemRow = itemRowsMap[orderItemIds[c]];
      if (itemRow) {
        itemsSheet.getRange(itemRow, 5).setValue('Kotor');
      }
    }
    
    writeLog(actorEmail, "Konfirmasi pengembalian alat untuk " + orderId + ". Status: Selesai.");
    sendTelegramNotification("✅ *Alat Berhasil Dikembalikan*\nID Order: `" + orderId + "`\nRuangan: " + borrowerRoom + "\nStatus Transaksi: Selesai. Semua alat diposisikan sebagai 'Kotor' untuk masuk ke siklus sterilisasi.");
    try {
      MailApp.sendEmail(borrowerEmail,
        "Peminjaman Selesai - SISTA-CSSD [" + orderId + "]",
        "Halo,\n\nTerima kasih, alat medis yang Anda pinjam dengan ID " + orderId + " telah resmi dikembalikan secara lengkap ke CSSD."
      );
    } catch (e) {}

  } else {
    return jsonResponse(false, "Status tujuan '" + nextStatus + "' tidak didukung.");
  }
  
  return jsonResponse(true, "Status transaksi berhasil diperbarui ke " + nextStatus + ".", { id_order: orderId, status_order: nextStatus });
}

// Update Item Cycle (Sterilization Cycle)
function updateItemCycle(postData, actorEmail) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  
  var itemId = postData.id_alat;
  var nextCycle = postData.status_posisi;
  
  if (!itemId || !nextCycle) {
    return jsonResponse(false, "Parameter 'id_alat' dan 'status_posisi' diperlukan.");
  }
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === itemId) {
      var row = i + 1;
      var currentStatus = data[i][4];
      
      if (nextCycle === 'Proses Steril') {
        if (currentStatus !== 'Kotor' && currentStatus !== 'Steril') {
          return jsonResponse(false, "Alat harus bersetatus 'Kotor' atau 'Steril' untuk masuk proses sterilisasi.");
        }
        sheet.getRange(row, 5).setValue('Proses Steril');
        writeLog(actorEmail, "Mengubah status " + itemId + " ke Proses Steril.");
        return jsonResponse(true, "Status alat berhasil diubah ke Proses Steril.", { id_alat: itemId, status: 'Proses Steril' });
        
      } else if (nextCycle === 'Steril') {
        if (currentStatus !== 'Proses Steril') {
          return jsonResponse(false, "Alat harus berstatus 'Proses Steril' untuk selesai disterilkan.");
        }
        
        var now = new Date();
        var expiryDaysStr = getConfig('STERILE_EXPIRY_DAYS', '30');
        var expiryDays = parseInt(expiryDaysStr) || 30;
        var expiryDate = new Date();
        expiryDate.setDate(now.getDate() + expiryDays);
        
        sheet.getRange(row, 5).setValue('Steril');
        sheet.getRange(row, 6).setValue(now);
        sheet.getRange(row, 7).setValue(expiryDate);
        
        writeLog(actorEmail, "Menyelesaikan sterilisasi " + itemId + ". Kadaluwarsa dalam " + expiryDays + " hari.");
        return jsonResponse(true, "Alat berhasil disterilkan dan siap dipinjam kembali.", { 
          id_alat: itemId, 
          status: 'Steril',
          tanggal_sterilisasi: now,
          tanggal_kadaluwarsa: expiryDate
        });
      } else {
        return jsonResponse(false, "Status siklus '" + nextCycle + "' tidak valid.");
      }
    }
  }
  return jsonResponse(false, "Alat dengan ID " + itemId + " tidak ditemukan.");
}

// CRUD Items (Add/Edit/Delete)
function manageItems(postData, actorEmail) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  var operation = postData.operation;
  
  if (!operation) {
    return jsonResponse(false, "Parameter 'operation' ('add'|'edit'|'delete') diperlukan.");
  }
  
  var idAlat = postData.id_alat;
  var namaAlat = postData.nama_alat;
  var deskripsi = postData.deskripsi || '';
  var fotoUrl = postData.foto_drive_url || '';
  
  var data = sheet.getDataRange().getValues();
  
  if (operation === 'add') {
    if (!idAlat || !namaAlat) {
      return jsonResponse(false, "ID Alat (QR) dan Nama Alat diperlukan.");
    }
    // Cek jika ID sudah ada
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === idAlat) {
        return jsonResponse(false, "ID Alat '" + idAlat + "' sudah terdaftar.");
      }
    }
    
    sheet.appendRow([idAlat, namaAlat, deskripsi, fotoUrl, 'Steril', new Date(), '']);
    writeLog(actorEmail, "Menambah alat baru: " + namaAlat + " (" + idAlat + ")");
    return jsonResponse(true, "Alat berhasil ditambahkan.");
    
  } else if (operation === 'edit') {
    if (!idAlat) return jsonResponse(false, "ID Alat diperlukan.");
    for (var j = 1; j < data.length; j++) {
      if (data[j][0] === idAlat) {
        var row = j + 1;
        if (namaAlat) sheet.getRange(row, 2).setValue(namaAlat);
        sheet.getRange(row, 3).setValue(deskripsi);
        if (fotoUrl) sheet.getRange(row, 4).setValue(fotoUrl);
        
        writeLog(actorEmail, "Mengubah info alat: " + idAlat);
        return jsonResponse(true, "Info alat berhasil diperbarui.");
      }
    }
    return jsonResponse(false, "Alat tidak ditemukan.");
    
  } else if (operation === 'delete') {
    if (!idAlat) return jsonResponse(false, "ID Alat diperlukan.");
    for (var k = 1; k < data.length; k++) {
      if (data[k][0] === idAlat) {
        var status = data[k][4];
        if (status !== 'Steril' && status !== 'Kotor' && status !== 'Proses Steril') {
          return jsonResponse(false, "Alat sedang dalam status transaksi (" + status + ") sehingga tidak bisa dihapus.");
        }
        sheet.deleteRow(k + 1);
        writeLog(actorEmail, "Menghapus alat: " + idAlat);
        return jsonResponse(true, "Alat berhasil dihapus dari inventaris.");
      }
    }
    return jsonResponse(false, "Alat tidak ditemukan.");
  }
  
  return jsonResponse(false, "Operasi '" + operation + "' tidak dikenal.");
}

// --- NOTIFICATION UTILITIES ---
function sendTelegramNotification(message) {
  var token = getConfig('TELEGRAM_TOKEN', '');
  var chatId = getConfig('TELEGRAM_CHAT_ID', '');
  
  if (!token || !chatId || token === 'TOKEN_BOT' || chatId === 'CHAT_ID') {
    Logger.log("Telegram Token/Chat ID belum diatur. Pesan: " + message);
    return;
  }
  
  var url = "https://api.telegram.org/bot" + token + "/sendMessage";
  var payload = {
    chat_id: chatId,
    text: message,
    parse_mode: "Markdown"
  };
  
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    Logger.log("Telegram Response: " + response.getContentText());
  } catch (e) {
    Logger.log("Gagal mengirim notifikasi Telegram: " + e.toString());
  }
}

// --- INITIALIZE SHEET DATABASE SCHEMA ---
function initDatabase() {
  var ss = getSpreadsheet();
  
  // 1. Config Sheet
  var configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG_SHEET_NAME);
    configSheet.appendRow(['Key', 'Value']);
    configSheet.appendRow(['TELEGRAM_TOKEN', 'TOKEN_BOT']);
    configSheet.appendRow(['TELEGRAM_CHAT_ID', 'CHAT_ID']);
    configSheet.appendRow(['STERILE_EXPIRY_DAYS', '30']);
  }
  
  // 2. Users Sheet
  var usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(USERS_SHEET_NAME);
    usersSheet.appendRow(['id', 'email', 'nama', 'peran', 'nama_ruangan', 'status_aktif']);
    // Bawaan Super Admin
    usersSheet.appendRow([
      'USR-1-DEFAULT', 
      'syamsul18782@gmail.com', 
      'Syamsul Admin', 
      'Super Admin', 
      'CSSD', 
      'Aktif'
    ]);
  }
  
  // 3. Items Sheet
  var itemsSheet = ss.getSheetByName(ITEMS_SHEET_NAME);
  if (!itemsSheet) {
    itemsSheet = ss.insertSheet(ITEMS_SHEET_NAME);
    itemsSheet.appendRow(['id_alat', 'nama_alat', 'deskripsi', 'foto_drive_url', 'status_posisi', 'tanggal_sterilisasi', 'tanggal_kadaluwarsa_steril']);
    // Contoh Data
    itemsSheet.appendRow(['ALAT-001', 'Minor Surgery Set A', 'Set instrumen bedah minor steril', '', 'Steril', new Date(), '']);
    itemsSheet.appendRow(['ALAT-002', 'Partus Set B', 'Set instrumen persalinan steril', '', 'Steril', new Date(), '']);
    itemsSheet.appendRow(['ALAT-003', 'Hecting Set C', 'Set menjahit luka steril', '', 'Kotor', new Date(), '']);
  }
  
  // 4. Orders Sheet
  var ordersSheet = ss.getSheetByName(ORDERS_SHEET_NAME);
  if (!ordersSheet) {
    ordersSheet = ss.insertSheet(ORDERS_SHEET_NAME);
    ordersSheet.appendRow(['id_order', 'email_peminjam', 'ruangan_peminjam', 'status_order', 'tanggal_request', 'tanggal_diambil', 'tanggal_kembali']);
  }
  
  // 5. Details Sheet
  var detailsSheet = ss.getSheetByName(DETAILS_SHEET_NAME);
  if (!detailsSheet) {
    detailsSheet = ss.insertSheet(DETAILS_SHEET_NAME);
    detailsSheet.appendRow(['id_detail', 'id_order', 'id_alat', 'catatan_kondisi']);
  }
  
  // 6. Logs Sheet
  var logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
  if (!logsSheet) {
    logsSheet = ss.insertSheet(LOGS_SHEET_NAME);
    logsSheet.appendRow(['timestamp', 'email_aktor', 'aktivitas']);
  }
  
  return jsonResponse(true, "Database SISTA-CSSD berhasil diinisialisasi.");
}

// Upload foto ke Google Drive folder
function uploadImage(postData, actorEmail) {
  var folderId = '1ZSelyuL7GYxOjEi-o6d8wIBc37NngxD9';
  try {
    var base64Data = postData.file_base64;
    var fileName = postData.file_name || 'alat_foto.jpg';
    var mimeType = postData.mime_type || 'image/jpeg';
    
    if (base64Data.indexOf(';base64,') !== -1) {
      base64Data = base64Data.split(';base64,')[1];
    }
    
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    
    // Set view permission for anyone with link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var directUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
    
    writeLog(actorEmail, "Upload foto alat medis: " + fileName + " ke Drive Folder. File ID: " + file.getId());
    
    return jsonResponse(true, "Foto berhasil diunggah.", { url: directUrl });
  } catch (error) {
    return jsonResponse(false, "Gagal mengunggah foto: " + error.toString());
  }
}
