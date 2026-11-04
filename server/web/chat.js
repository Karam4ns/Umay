(function(root){
 const catalog=Object.create(null);
 function add(codes,title,message,enTitle,enMessage){for(const code of codes.split(' '))catalog[code]={title,message,enTitle,enMessage};}
 add('INSUFFICIENT_TOKENS','Token limitiniz yetersiz','Bu mesajı yanıtlamak için kullanılabilir tokenınız yeterli değil. Hesabınızdaki token kullanımını ve bekleyen işlemleri kontrol edin.','Not enough available tokens','There are not enough available tokens for this message. Check your token usage and pending requests.');
 add('TOKEN_USAGE_RECONCILIATION_REQUIRED TOKEN_RECONCILIATION_REQUIRED','Token kullanımınız kontrol ediliyor','Önceki bir işlemin token kullanımı henüz kesinleşmedi. Bekleyen işlemlerinizi kontrol edin; sorun sürerse destekle iletişime geçin.','Token usage is being checked','Usage from a previous request is still pending. Check your pending requests or contact support if this continues.');
 add('SUBSCRIPTION_TOKEN_LIMIT','Kullanım limitinize ulaştınız','Aboneliğinizin kullanım sınırına ulaştınız. Bir süre sonra yeniden deneyin veya planınızın limitlerini kontrol edin.','Usage limit reached','Try again later or check the usage limits of your plan.');
 add('SUBSCRIPTION_NOT_AVAILABLE','Aboneliğiniz bu işlem için uygun değil','Aboneliğinizin durumunu kontrol edin veya hesabınıza açık başka bir model seçin.','Subscription unavailable','Check your subscription or choose another model available to your account.');
 add('LOGIN_REQUIRED UNAUTHORIZED','Yeniden giriş yapmanız gerekiyor','Oturumunuz sona ermiş olabilir. Hesabınıza giriş yapıp tekrar deneyin.','Please sign in again','Your session may have expired. Sign in and try again.');
 add('ACCOUNT_UNAVAILABLE ACCESS_DENIED','Bu işlem için erişiminiz yok','Hesabınızın durumunu ve bu işlemi kullanma yetkinizi kontrol edin.','Access unavailable','Check your account status and permissions for this action.');
 add('RATE_LIMITED PROVIDER_RATE_LIMIT TOO_MANY_RUNS','Çok fazla istek gönderildi','Biraz bekleyin ve devam eden işlemler tamamlandıktan sonra tekrar deneyin.','Too many requests','Wait a moment and let current requests finish before trying again.');
 add('RUN_IN_PROGRESS','Bir yanıt zaten hazırlanıyor','Yeni mesaj göndermeden önce mevcut yanıtı bekleyin veya yanıtı durdurun.','A reply is already being prepared','Wait for the current reply or stop it before sending another message.');
 add('PROVIDER_TIMEOUT REQUEST_TIMEOUT','Yanıt beklenenden uzun sürdü','Model şu anda zamanında yanıt veremiyor. Biraz sonra tekrar deneyin veya başka bir model seçin.','The reply took too long','Try again shortly or choose another model.');
 add('NETWORK_ERROR PROVIDER_CONNECTION_ERROR SERVER_UNAVAILABLE','Sunucuya bağlanılamadı','İnternet bağlantınızı kontrol edip tekrar deneyin. Sorun sürerse biraz bekleyin.','Could not connect to the server','Check your internet connection and try again. If this continues, wait a moment.');
 add('MODEL_NOT_AVAILABLE MODEL_UNAVAILABLE','Seçilen model şu anda kullanılamıyor','Model listesini yenileyin veya hesabınıza açık başka bir model seçin.','This model is unavailable','Refresh the model list or choose another available model.');
 add('MODEL_MEDIA_UNAVAILABLE','Model bu işlemi desteklemiyor','İstediğiniz işlem veya dosya türünü destekleyen başka bir model seçin.','This model does not support the action','Choose a model that supports this action or file type.');
 add('PROVIDER_AUTH_FAILED PROVIDER_REJECTED INVALID_PROVIDER_RESPONSE','Model şu anda yanıt veremiyor','Model hizmetinde bir sorun oluştu. Biraz sonra tekrar deneyin veya başka bir model seçin.','The model could not reply','Try again shortly or choose another model.');
 add('PROVIDER_TOOL_UNAVAILABLE','İstenen özellik şu anda kullanılamıyor','Model bu bağlantıda kullanılamayan bir özellik istedi. Sorunuzu farklı şekilde sorabilir veya başka bir model seçebilirsiniz.','The requested feature is unavailable','Rephrase your question or choose another model.');
 add('CONTEXT_LIMIT','Bu sohbet modelin sınırına ulaştı','Yeni bir sohbet başlatın veya mesajınızı ve eklerinizi kısaltarak tekrar deneyin.','This conversation reached the model limit','Start a new chat or shorten your message and attachments.');
 add('CONVERSATION_CHANGED stale','Sohbet başka bir yerde güncellendi','Sohbeti yenileyip tekrar deneyin. Yazdığınız mesaj gönderilemediyse taslağınızı koruyun.','The conversation changed','Refresh the conversation and try again. Keep your draft if it was not sent.');
 add('CHAT_ARCHIVED','Bu sohbet arşivlenmiş','Devam etmek için sohbeti arşivden çıkarın veya yeni bir sohbet başlatın.','This chat is archived','Restore it from the archive or start a new chat.');
 add('ANSWER_QUALITY_FAILED INVALID_SOURCE_CITATION','Güvenilir bir yanıt oluşturulamadı','Modelin yanıtı doğrulanamadığı için gösterilemiyor. Sorunuzu netleştirerek tekrar deneyin veya başka bir model seçin.','A reliable reply could not be produced','Clarify your question or choose another model.');
 add('MEMORY_CONTEXT_CHANGED MODEL_KNOWLEDGE_CHANGED','Sohbet bilgileri güncellendi','Kullanılan bilgiler değişti. Güncel bilgilerle yanıt almak için mesajınızı yeniden gönderin.','Conversation information changed','Send your message again to use the updated information.');
 add('CANCELED CANCELLED','Yanıt durduruldu','Hazır olduğunuzda yeni bir mesaj gönderebilirsiniz.','Reply stopped','Send another message when you are ready.');
 add('INVALID_REQUEST','Mesaj gönderilemedi','Mesajınızı ve eklerinizi kontrol edip tekrar deneyin.','Your message could not be sent','Check your message and attachments and try again.');
 const fallback={title:'İşlem tamamlanamadı',message:'Beklenmeyen bir sorun oluştu. Tekrar deneyin; sorun sürerse destekle iletişime geçin.',enTitle:'The action could not be completed',enMessage:'Try again. If the problem continues, contact support.'};
 function normalize(value){return typeof value==='string'?value.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'').trim():'';}
 function describe(value,language='tr'){
  const item=catalog[normalize(value)]||fallback;
  return /^tr(?:-|$)/i.test(language)?{title:item.title,message:item.message}:{title:item.enTitle,message:item.enMessage};
 }
 function responseCode(status,body){
  const values=Array.isArray(body?.message)?body.message:[body?.message,body?.code];
  for(const value of values)if(typeof value==='string'&&Object.hasOwn(catalog,value))return value;
  return ({401:'LOGIN_REQUIRED',403:'ACCESS_DENIED',409:'CONVERSATION_CHANGED',429:'RATE_LIMITED'})[status]||(status>=500?'SERVER_UNAVAILABLE':'INVALID_REQUEST');
 }
 function render(document,code,translate){
  const box=document.getElementById('chat-error');if(!box)return;
  const title=document.getElementById('chat-error-title'),detail=document.getElementById('chat-error-detail');
  box.hidden=!code;if(!code){title.textContent='';detail.textContent='';return;}
  const info=describe(code,document.documentElement?.lang||'tr');
  title.textContent=info.title;detail.textContent=info.message;
 }
 const api={describe,responseCode,render,isKnown:value=>Object.hasOwn(catalog,normalize(value))};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.UmayErrors=api;
})(globalThis);

/* Chat application */
(() => {
  const el = (id) => document.getElementById(id),
    t = window.chatText;
  let executionEnabled = false,
    codePolling = null,
    pendingCode = null;
  let editingMessage = null,
    pendingBranch = null;
  let recorder = null,
    recordTimer = null;
  let pendingFiles = [],
    uploading = false;
  let currentRun = null,
    pollTimer = null,
    runEvents = null,
    pendingSend = null;
  let conversationAction = null;
  let pendingCreate = null;
  let modelFilter = "ALL";
  let visionOnly = false;
  const fileLabel = (tr, en) =>
    document.documentElement.lang === "tr" ? tr : en;
  const hasVision = (model) =>
    (model?.categories ?? []).some((category) =>
      /^(vision|multimodal|image[-_ ]to[-_ ]text|görsel anlama)$/i.test(
        String(category),
      ),
    );
  function chooseVision() {
    visionOnly = true;
    modelFilter = "ALL";
    el("model-search").value = "";
    renderModelResults();
    el("model-dialog").showModal();
  }
  const previewDialog = document.createElement("dialog");
  previewDialog.className = "chat-dialog attachment-preview";
  const previewHeader = document.createElement("header");
  previewHeader.className = "chat-dialog-header";
  const previewTitle = document.createElement("h2");
  previewTitle.id = "attachment-preview-title";
  previewDialog.setAttribute("aria-labelledby", previewTitle.id);
  const previewClose = textNode("button", "×");
  previewClose.type = "button";
  previewClose.setAttribute("aria-label", t("close"));
  previewClose.onclick = () => previewDialog.close();
  previewHeader.append(previewTitle, previewClose);
  const previewBody = document.createElement("section");
  previewBody.className = "attachment-preview-body";
  previewDialog.append(previewHeader, previewBody);
  document.body.append(previewDialog);
  let previewUrl = null,
    previewTicket = 0;
  previewDialog.addEventListener("close", () => {
    previewTicket++;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    previewBody.replaceChildren();
  });
  function officePreview(data, file) {
    const meta = data.metadata,
      box = document.createElement("div");
    box.className = "office-preview";
    const note = textNode(
      "p",
      t(meta.format === "XLSX" ? "officeSheetPreview" : "officeTextOnly"),
      "office-note",
    );
    box.append(note);
    if (data.truncated)
      box.append(textNode("p", t("fileTruncated"), "office-note"));
    if (meta.warnings?.includes("FORMULAS_NOT_CALCULATED"))
      box.append(textNode("p", t("officeFormulas"), "office-note"));
    if (meta.warnings?.includes("FORMULA_CACHE_MISSING"))
      box.append(textNode("p", t("officeCacheMissing"), "office-note"));
    const download = textNode("a", t("officeDownload"), "office-download");
    download.href = "/site/chat/files/" + encodeURIComponent(file.id);
    download.setAttribute("download", file.name);
    box.append(download);
    if (meta.format === "XLSX" && meta.sheets?.length) {
      const label = textNode("label", t("officeSheet")),
        select = document.createElement("select"),
        panel = document.createElement("div");
      label.className = "office-sheet-picker";
      select.setAttribute("aria-label", t("officeSheet"));
      for (const [i, sheet] of meta.sheets.entries())
        select.add(
          new Option(
            sheet.name +
              (sheet.state !== "visible" ? " · " + t("officeHiddenSheet") : ""),
            String(i),
          ),
        );
      label.append(select);
      box.append(label, panel);
      const draw = () => {
        const sheet = meta.sheets[Number(select.value)],
          columns = [
            ...new Set(
              sheet.rows.flatMap((row) => row.cells.map((c) => c.column)),
            ),
          ].sort((a, b) => a - b);
        const table = document.createElement("table"),
          caption = textNode("caption", sheet.name),
          head = document.createElement("thead"),
          body = document.createElement("tbody"),
          tr = document.createElement("tr");
        tr.append(textNode("th", "#"));
        const columnName = (n) => {
          let value = "";
          for (; n > 0; n = Math.floor((n - 1) / 26))
            value = String.fromCharCode(65 + ((n - 1) % 26)) + value;
          return value;
        };
        for (const col of columns) {
          const th = textNode("th", columnName(col));
          th.scope = "col";
          tr.append(th);
        }
        head.append(tr);
        for (const row of sheet.rows) {
          const tr = document.createElement("tr"),
            th = textNode("th", String(row.number));
          th.scope = "row";
          tr.append(th);
          for (const col of columns) {
            const td = document.createElement("td"),
              cell = row.cells.find((c) => c.column === col);
            if (cell) {
              td.title = cell.address;
              const value = cell.text.replace(/ \[cached result\]$/, "");
              td.append(
                textNode("span", value === "[no cached result]" ? "—" : value),
              );
              if (cell.formula !== undefined)
                td.append(
                  textNode("small", t("officeFormula") + ": =" + cell.formula),
                );
            }
            tr.append(td);
          }
          body.append(tr);
        }
        table.append(caption, head, body);
        const scroll = document.createElement("div");
        scroll.className = "office-table-wrap";
        scroll.tabIndex = 0;
        scroll.setAttribute("role", "region");
        scroll.setAttribute("aria-label", sheet.name);
        scroll.append(table);
        panel.replaceChildren(scroll);
      };
      select.addEventListener("change", draw);
      draw();
      const details = document.createElement("details");
      details.append(
        textNode("summary", t("officeExtractedText")),
        textNode("pre", data.text),
      );
      box.append(details);
    } else box.append(textNode("pre", data.text));
    return box;
  }
  async function previewFile(file) {
    if (previewDialog.open) previewDialog.close();
    const ticket = ++previewTicket;
    previewTitle.textContent = file.name;
    previewBody.textContent = fileLabel("Yükleniyor…", "Loading…");
    previewDialog.showModal();
    try {
      if (
        file.mime?.startsWith("image/") ||
        file.mime === "application/pdf" ||
        file.mime?.startsWith("audio/") ||
        file.mime?.startsWith("video/")
      ) {
        const response = await fetch(
          "/site/chat/files/" + encodeURIComponent(file.id),
          { cache: "no-store", signal: AbortSignal.timeout(20000) },
        );
        if (!response.ok) throw Error();
        const blob = await response.blob();
        if (ticket !== previewTicket) return;
        previewUrl = URL.createObjectURL(blob);
        const node = document.createElement(
          file.mime.startsWith("image/")
            ? "img"
            : file.mime === "application/pdf"
              ? "iframe"
              : file.mime.startsWith("audio/")
                ? "audio"
                : "video",
        );
        node.src = previewUrl;
        if (node.tagName === "IMG") node.alt = file.name;
        if (node.tagName === "IFRAME") {
          node.title = file.name;
          node.setAttribute("sandbox", "");
        }
        if (["AUDIO", "VIDEO"].includes(node.tagName)) node.controls = true;
        previewBody.replaceChildren(node);
      } else {
        const data = await api(
          "/site/chat/files/" + encodeURIComponent(file.id) + "?view=text",
        );
        if (ticket !== previewTicket) return;
        if (["DOCX", "XLSX"].includes(data.metadata?.format)) {
          previewBody.replaceChildren(officePreview(data, file));
          return;
        }
        previewBody.replaceChildren(
          textNode(
            "pre",
            data.text ||
              fileLabel(
                "Metin içeriği bulunamadı.",
                "No text content available.",
              ),
          ),
        );
      }
    } catch {
      if (ticket === previewTicket)
        previewBody.textContent = fileLabel(
          "Dosya görüntülenemedi.",
          "Unable to preview file.",
        );
    }
  }
  let folderMode = "active",
    folderItems = [];
  let user = null,
    models = [],
    active = null,
    cursor = null,
    epoch = 0,
    busy = false,
    checking = false,
    frontend = new URL(location.href);
  function requestId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join(
      "",
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const labels = {
    tr: ["Açık moda geç", "Koyu moda geç"],
    en: ["Switch to light mode", "Switch to dark mode"],
    de: ["Zum hellen Modus wechseln", "Zum dunklen Modus wechseln"],
    fr: ["Passer au mode clair", "Passer au mode sombre"],
    es: ["Cambiar al modo claro", "Cambiar al modo oscuro"],
    ru: ["Включить светлую тему", "Включить тёмную тему"],
    ar: ["التبديل إلى الوضع الفاتح", "التبديل إلى الوضع الداكن"],
  };
  window.veriussuTheme.setLabelResolver(
    (theme) =>
      (labels[document.documentElement.lang] ?? labels.en)[
        theme === "dark" ? 0 : 1
      ],
  );
  el("model-current-logo").addEventListener("error", () => {
    el("model-current-logo").hidden = true;
    el("model-current-logo").removeAttribute("src");
  });
  const optionKey = (m) => `${m.source}:${m.id}`;
  el("message").placeholder = t("messageHint");
  el("menu").setAttribute("aria-label", t("menu"));
  el("send").setAttribute("aria-label", t("sendMessage"));
  el("history").setAttribute("aria-label", t("history"));
  function clear() {
    window.UmayErrors.render(document, null);
    if (recorder) {
      recorder.onstop = null;
      recorder.stream.getTracks().forEach((track) => track.stop());
      recorder.stop();
      recorder = null;
      clearTimeout(recordTimer);
    }
    if (previewDialog.open) previewDialog.close();
    epoch++;
    clearTimeout(codePolling);
    pendingCode = null;
    executionEnabled = false;
    el("code-dialog").close();
    clearTimeout(pollTimer);
    if (runEvents) {
      runEvents.close();
      runEvents = null;
    }
    currentRun = null;
    pendingFiles = [];
    paintFiles();
    pendingSend = null;
    el("message").value = "";
    el("run-sources").replaceChildren();
    user = null;
    window.dispatchEvent(new CustomEvent("chat:account", { detail: null }));
    pendingCreate = null;
    models = [];
    active = null;
    cursor = null;
    el("history").replaceChildren();
    el("conversation-dialog").close();
    conversationAction = null;
    el("chats-dialog").close();
    el("folder-results").replaceChildren();
    folderItems = [];
    el("messages").replaceChildren();
    el("welcome").hidden = false;
    el("account-name").textContent = "";
    el("model-dialog").close();
    el("settings-dialog").close();
    el("memory-list").replaceChildren();
    memoryItems = [];
    el("memory-search").value = "";
    el("memory-count").textContent = "0";
    el("model-results").replaceChildren();
    window.veriussuTheme.clearAccount();
  }
  function showRequestError(error) {
    const code = typeof error === "string" ? error : error?.message;
    window.UmayErrors.render(document, code || "UNKNOWN");
    const info = window.UmayErrors.describe(code, document.documentElement.lang);
    el("status").textContent = info.title + " — " + info.message;
    window.veriussuChatExperience?.setStatus("runFailed");
  }
  function notice(key) {
    el("status").textContent = key ? t(key) : "";
    window.veriussuChatExperience?.setStatus(key);
  }
  function controls() {
    const running =
      currentRun && ["QUEUED", "RUNNING"].includes(currentRun.status);
    window.veriussuChatExperience?.updateRunning(
      !!running || busy || uploading,
    );
    el("message").disabled =
      !!recorder ||
      busy ||
      uploading ||
      !user ||
      !selected() ||
      !!active?.archivedAt ||
      !!running;
    el("send").disabled =
      el("message").disabled ||
      (!el("message").value.trim() && !pendingFiles.length);
    el("attach-file").disabled =
      el("message").disabled ||
      pendingFiles.length >= 5 ||
      !["CHAT", "TRANSCRIBE"].includes(el("tool-kind").value) ||
      !!recorder;
    el("attach-file").title = t("attachFile");
    el("tool-kind").disabled = busy || uploading || !!running || !!recorder;
    el("voice").disabled = el("tool-kind").disabled;
    el("record-audio").disabled = busy || uploading || !!running;
    el("chat-versions").hidden = true;
    el("chat-versions").disabled = busy || !!running;
    el("message-edit-save").disabled = busy;
    el("stop-run").hidden = !running;
    el("stop-run").disabled = busy;
    el("new-chat").disabled = busy || !user || !selected();
    el("model-open").disabled = busy || !user || !!running;
    el("logout").disabled = busy;
    el("model").disabled = busy || !user || !models.length;
    el("more").disabled = busy;
    el("chats-folder").disabled = !user || busy;
    el("archive-folder").disabled = !user || busy;
    el("archive-current").disabled = busy;
    document
      .querySelectorAll(".conversation-icon")
      .forEach((button) => (button.disabled = busy));
    el("conversation-submit").disabled = busy;
    el("conversation-title-input").disabled = busy;
    el("conversation-close").disabled = busy;
    el("conversation-cancel").disabled = busy;
  }
  function paintFiles() {
    el("pending-files").replaceChildren();
    for (const file of pendingFiles) {
      const chip = document.createElement("span");
      chip.className = "file-chip";
      chip.append(
        textNode(
          "span",
          file.name + (file.truncated ? " · " + t("fileTruncated") : ""),
        ),
      );
      const remove = textNode("button", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", t("removeFile"));
      remove.disabled = busy || uploading;
      remove.addEventListener("click", async () => {
        if (busy || uploading) return;
        try {
          await api("/site/chat/files/remove", { id: file.id });
          pendingFiles = pendingFiles.filter((item) => item.id !== file.id);
          pendingSend = null;
          paintFiles();
          controls();
        } catch {
          notice("fileFailed");
        }
      });
      const view = textNode("button", fileLabel("Görüntüle", "Preview"));
      view.type = "button";
      view.onclick = () => void previewFile(file);
      chip.append(view, remove);
      el("pending-files").append(chip);
    }
  }
  el("attach-file").addEventListener("click", () => el("file-input").click());
  el("file-input").addEventListener("change", async () => {
    const files = [...el("file-input").files];
    el("file-input").value = "";
    if (busy || uploading || !user) return;
    if (
      pendingFiles.length + files.length > 5 ||
      files.some((file) => file.size > 8 * 1024 * 1024)
    ) {
      notice("fileLimit");
      return;
    }
    const ticket = epoch;
    uploading = true;
    controls();
    notice("uploadingFile");
    try {
      for (const file of files) {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await api("/site/chat/files", { name: file.name, data });
        if (ticket !== epoch) return;
        pendingFiles.push(result.file);
        pendingSend = null;
        paintFiles();
      }
      notice("ready");
    } catch (error) {
      if (ticket === epoch)
        notice(
          error.message === "OFFICE_LEGACY_UNSUPPORTED"
            ? "officeLegacyUnsupported"
            : error.message === "OFFICE_FILE_LIMIT"
              ? "officeFileTooLarge"
              : error.message === "OFFICE_READER_UNAVAILABLE"
                ? "officeReaderUnavailable"
                : /^OFFICE_/.test(error.message)
                  ? "officeFileRejected"
                  : "fileFailed",
        );
    } finally {
      uploading = false;
      controls();
      paintFiles();
    }
  });
  async function api(path, body) {
    const ticket = epoch;
    let r;
    try { r = await fetch(path, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    }); } catch (error) {
      if (ticket !== epoch) throw Error("STALE");
      const code = ["TimeoutError", "AbortError"].includes(error.name) ? "REQUEST_TIMEOUT" : "NETWORK_ERROR";
      showRequestError(code); throw Error(code);
    }
    if (ticket !== epoch) throw Error("STALE");
    if (r.status === 401) {
      clear();
      paint();
      throw Error("LOGIN_REQUIRED");
    }
    if (!r.ok) {
      const value = await r.json().catch(() => null);
      if (ticket !== epoch) throw Error("STALE");
      if (path === "/site/chat/files" && typeof value?.message === "string" && /^OFFICE_[A-Z_]+$/.test(value.message)) throw Error(value.message);
      const code = window.UmayErrors.responseCode(r.status, value);
      showRequestError(code); throw Error(code);
    }
    return r.json();
  }
  function selected() {
    return models.find((m) => optionKey(m) === el("model").value);
  }
  const modelPreferenceKey = () => "veriussu:model:" + user?.id;
  function preferredModel() {
    if (!user) return null;
    try {
      return localStorage.getItem(modelPreferenceKey());
    } catch {
      return null;
    }
  }
  let modelOwner = null;
  function paintModels() {
    const old = modelOwner === user?.id ? el("model").value : "";
    modelOwner = user?.id ?? null;
    el("model").replaceChildren();
    for (const source of ["SUBSCRIPTION", "PERSONAL"]) {
      const group = document.createElement("optgroup");
      group.label = t(source === "PERSONAL" ? "personal" : "subscription");
      for (const m of models.filter((m) => m.source === source)) {
        const o = document.createElement("option");
        o.value = optionKey(m);
        o.textContent = `${m.name} · ${m.serverName}`;
        group.append(o);
      }
      if (group.children.length) el("model").append(group);
    }
    if (!models.length) {
      const o = document.createElement("option");
      o.textContent = t("noModels");
      o.value = "";
      el("model").append(o);
    }
    const inStudio =
      new URL(location.href).searchParams.get("view") === "studio";
    const saved = preferredModel();
    if (active && !inStudio) {
      const key =
        active.source +
        ":" +
        (active.personalModelId ?? active.platformModelId);
      if (!models.some((m) => optionKey(m) === key)) {
        const o = document.createElement("option");
        o.value = key;
        o.textContent = `${active.modelName} · ${t("unavailable")}`;
        o.disabled = true;
        el("model").append(o);
      }
      el("model").value = key;
    } else if (models.some((m) => optionKey(m) === old))
      el("model").value = old;
    else if (models.some((m) => optionKey(m) === saved))
      el("model").value = saved;
    const m = selected();
    const logo = el("model-current-logo");
    logo.hidden = !m?.hasLogo || !m?.logoUrl;
    if (!logo.hidden) {
      if (logo.getAttribute("src") !== m.logoUrl) logo.src = m.logoUrl;
    } else logo.removeAttribute("src");
    el("model-label").textContent =
      m?.name ?? (active ? active.modelName : t("selectModel"));
    el("model-open").title = m
      ? `${m.name} · ${m.serverName}`
      : t("selectModel");
    if (el("model-dialog").open) renderModelResults();
    paintTools();
    controls();
  }
  function paintTools() {
    const old = el("tool-kind").value || "CHAT";
    const tools = selected()?.tools ?? ["CHAT"];
    el("tool-kind").replaceChildren(
      ...tools.map((kind) => {
        const option = textNode("option", t("tool" + kind));
        option.value = kind;
        return option;
      }),
    );
    el("tool-kind").value = tools.includes(old) ? old : tools[0];
    el("voice-picker").hidden = el("tool-kind").value !== "SPEECH";
    el("record-audio").hidden =
      el("tool-kind").value !== "TRANSCRIBE" ||
      !navigator.mediaDevices?.getUserMedia ||
      !window.MediaRecorder;
  }
  el("tool-kind").addEventListener("change", () => {
    pendingSend = null;
    paintTools();
    controls();
  });
  el("voice").addEventListener("change", () => {
    pendingSend = null;
  });
  el("record-audio").addEventListener("click", async () => {
    if (recorder) {
      recorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (
        busy ||
        (currentRun && ["QUEUED", "RUNNING"].includes(currentRun.status))
      ) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const chunks = [],
        mime = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/ogg")
            ? "audio/ogg"
            : null;
      if (!mime) {
        stream.getTracks().forEach((track) => track.stop());
        notice("recordUnsupported");
        return;
      }
      recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        clearTimeout(recordTimer);
        stream.getTracks().forEach((track) => track.stop());
        recorder = null;
        el("record-audio").textContent = t("recordAudio");
        const file = new File(
          chunks,
          "recording." + (mime === "audio/ogg" ? "ogg" : "webm"),
          { type: mime },
        );
        if (file.size > 8 * 1024 * 1024 || pendingFiles.length >= 5) {
          notice("fileLimit");
          controls();
          return;
        }
        const transfer = new DataTransfer();
        transfer.items.add(file);
        el("file-input").files = transfer.files;
        el("file-input").dispatchEvent(new Event("change"));
        controls();
      };
      recorder.start();
      recordTimer = setTimeout(() => recorder?.stop(), 60000);
      el("record-audio").textContent = t("stopRecording");
      controls();
    } catch {
      notice("recordUnsupported");
    }
  });
  function paint() {
    el("login").hidden = !!user;
    el("logout").hidden = !user;
    el("models-link").hidden = !user || !!models.length;
    el("chat-title").textContent = active?.title ?? t("welcome");
    el("welcome-text").textContent = t("intro");
    el("account-name").textContent = user?.firstName || user?.email || "";
    el("account-name").hidden = !user;
    el("logout").setAttribute("aria-label", t("logout"));
    el("logout").title = t("logout");
    el("archive-current").hidden = !active;
    el("archive-current").textContent = t(
      active?.archivedAt ? "restoreChat" : "archiveChat",
    );
    paintModels();
  }
  function mark() {
    el("history")
      .querySelectorAll("button[data-id]")
      .forEach((b) =>
        b.setAttribute("aria-current", String(b.dataset.id === active?.id)),
      );
  }
  const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
  const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
  const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
  const QUOTE = /^\s{0,3}>/;
  const RULE = /^\s{0,3}([-*_]\s*){3,}$/;
  function safeUrl(value) {
    const trimmed = String(value).trim();
    try {
      const url = new URL(trimmed);
      return ["https:", "http:", "mailto:"].includes(url.protocol)
        ? url.href
        : null;
    } catch {
      /* javascript:, data: ve diğer şemalar asla bağlantıya dönüşmez. */
      return null;
    }
  }
  function linkAt(text, start) {
    let depth = 0,
      label = "",
      i = start;
    for (; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === "\\" && i + 1 < text.length) {
        label += text[i + 1];
        i += 1;
        continue;
      }
      if (ch === "[") depth += 1;
      else if (ch === "]") {
        depth -= 1;
        if (depth === 0) break;
      }
      label += ch;
    }
    if (depth !== 0 || text[i] !== "]") return null;
    if (text[i + 1] !== "(") return null;
    let close = i + 2;
    depth = 1;
    for (; close < text.length; close += 1) {
      if (text[close] === "(") depth += 1;
      else if (text[close] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) return null;
    return {
      label: label.slice(1),
      href: text
        .slice(i + 2, close)
        .trim()
        .split(/\s+/)[0],
      next: close + 1,
    };
  }
  function appendLink(into, label, href) {
    const safe = safeUrl(href);
    if (!safe) return into.append(document.createTextNode(label));
    const link = document.createElement("a");
    link.href = safe;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    inline(label, into.appendChild(link));
    return link;
  }
  function inline(text, into) {
    let buffer = "",
      i = 0;
    const flush = () => {
      if (!buffer) return;
      into.append(document.createTextNode(buffer));
      buffer = "";
    };
    while (i < text.length) {
      const ch = text[i];
      if (ch === "\\" && i + 1 < text.length) {
        buffer += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === "`") {
        const ticks = /^`+/.exec(text.slice(i))[0];
        const end = text.indexOf(ticks, i + ticks.length);
        if (end !== -1) {
          flush();
          into.append(textNode("code", text.slice(i + ticks.length, end)));
          i = end + ticks.length;
          continue;
        }
      }
      if (text.startsWith("~~", i)) {
        const end = text.indexOf("~~", i + 2);
        if (end !== -1) {
          flush();
          const strike = document.createElement("s");
          inline(text.slice(i + 2, end), strike);
          into.append(strike);
          i = end + 2;
          continue;
        }
      }
      if (text.startsWith("***", i) || text.startsWith("___", i)) {
        const mark = text.slice(i, i + 3),
          end = text.indexOf(mark, i + 3);
        if (end > i + 3) {
          flush();
          const strong = document.createElement("strong"),
            em = document.createElement("em");
          inline(text.slice(i + 3, end), em);
          strong.append(em);
          into.append(strong);
          i = end + 3;
          continue;
        }
      }
      if (text.startsWith(ch + ch, i) && (ch === "*" || ch === "_")) {
        const end = text.indexOf(ch + ch, i + 2);
        if (end !== -1 && text[i + 2] !== " " && text[end - 1] !== " ") {
          flush();
          const strong = document.createElement("strong");
          inline(text.slice(i + 2, end), strong);
          into.append(strong);
          i = end + 2;
          continue;
        }
      }
      if ((ch === "*" || ch === "_") && text[i + 1] !== ch) {
        const end = text.indexOf(ch, i + 1);
        if (end !== -1 && text[i + 1] !== " " && text[end - 1] !== " ") {
          flush();
          const em = document.createElement("em");
          inline(text.slice(i + 1, end), em);
          into.append(em);
          i = end + 1;
          continue;
        }
      }
      if (ch === "!" && text[i + 1] === "[" && text[i + 2] !== "[") {
        const link = linkAt(text, i + 1);
        if (link) {
          appendLink(into, link.label, link.href);
          i = link.next;
          continue;
        }
      }
      if (ch === "[") {
        const link = linkAt(text, i);
        if (link) {
          flush();
          appendLink(into, link.label, link.href);
          i = link.next;
          continue;
        }
      }
      if (ch === "<") {
        const close = text.indexOf(">", i + 1);
        if (close !== -1) {
          const href = safeUrl(text.slice(i + 1, close));
          if (href) {
            flush();
            const link = document.createElement("a");
            link.href = href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = text.slice(i + 1, close);
            into.append(link);
            i = close + 1;
            continue;
          }
        }
      }
      if (/^https?:\/\//i.test(text.slice(i, i + 8))) {
        const bare = /^https?:\/\/[^\s<>()[\]]+/i.exec(text.slice(i))[0];
        const safe = safeUrl(bare);
        if (safe) {
          flush();
          const link = document.createElement("a");
          link.href = safe;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = bare;
          into.append(link);
          i += bare.length;
          continue;
        }
      }
      buffer += ch;
      i += 1;
    }
    flush();
  }
  async function copyValue(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    if (!copied) throw Error("COPY_FAILED");
  }
  function codeBlock(language, code) {
    const wrap = document.createElement("div"),
      bar = document.createElement("div"),
      copy = document.createElement("button"),
      pre = document.createElement("pre");
    wrap.className = "md-code";
    wrap.dataset.language = language.toLowerCase();
    bar.className = "md-code-bar";
    bar.append(textNode("span", language || t("codeLabel")));
    copy.type = "button";
    copy.className = "md-copy";
    copy.textContent = t("copyCode");
    copy.addEventListener("click", async () => {
      const restore = copy.textContent;
      copy.textContent = t("codeCopied");
      try {
        await copyValue(code);
      } catch {
        copy.textContent = t("copyFailed");
      }
      setTimeout(() => {
        copy.textContent = restore;
      }, 1600);
    });
    bar.append(copy);
    pre.append(textNode("code", code));
    wrap.append(bar, pre);
    return wrap;
  }
  function isTableDivider(line) {
    const trimmed = line.trim();
    return (
      trimmed.includes("|") &&
      /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(trimmed)
    );
  }
  function tableRow(line) {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  }
  function tableBlock(head, rows) {
    const table = document.createElement("table"),
      thead = document.createElement("thead"),
      headRow = document.createElement("tr"),
      body = document.createElement("tbody");
    for (const cell of head) {
      const th = document.createElement("th");
      inline(cell, th);
      headRow.append(th);
    }
    thead.append(headRow);
    for (const row of rows) {
      const tr = document.createElement("tr");
      for (let i = 0; i < head.length; i += 1) {
        const td = document.createElement("td");
        inline(row[i] ?? "", td);
        tr.append(td);
      }
      body.append(tr);
    }
    table.append(thead, body);
    return table;
  }
  function listBlock(lines, start) {
    const first = LIST_ITEM.exec(lines[start]),
      ordered = /\d/.test(first[2]),
      root = document.createElement(ordered ? "ol" : "ul"),
      baseDepth = Math.floor(first[1].replace(/\t/g, "    ").length / 2),
      stack = [{ node: root, depth: baseDepth }];
    if (ordered) {
      const from = Number.parseInt(first[2], 10);
      if (from !== 1) root.start = from;
    }
    let i = start;
    while (i < lines.length) {
      const item = LIST_ITEM.exec(lines[i]);
      if (!item || /\d/.test(item[2]) !== ordered) break;
      const depth = Math.floor(item[1].replace(/\t/g, "    ").length / 2);
      if (depth < baseDepth) break;
      while (stack.length > 1 && stack[stack.length - 1].depth > depth)
        stack.pop();
      if (stack[stack.length - 1].depth < depth) {
        const holder = stack[stack.length - 1].node.lastElementChild;
        if (!holder) break;
        const nested = document.createElement(ordered ? "ol" : "ul");
        holder.append(nested);
        stack.push({ node: nested, depth });
      }
      const li = document.createElement("li");
      inline(item[3], li);
      stack[stack.length - 1].node.append(li);
      i += 1;
    }
    return { node: root, next: i };
  }
  function richText(source) {
    const root = document.createElement("div"),
      lines = String(source ?? "")
        .replace(/\r\n?/g, "\n")
        .split("\n");
    root.className = "md";
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i += 1;
        continue;
      }
      const fence = FENCE.exec(line);
      if (fence) {
        const marker = fence[1],
          body = [];
        i += 1;
        while (i < lines.length && !lines[i].trim().startsWith(marker)) {
          body.push(lines[i]);
          i += 1;
        }
        i += 1;
        root.append(codeBlock(fence[2], body.join("\n")));
        continue;
      }
      if (RULE.test(line)) {
        root.append(document.createElement("hr"));
        i += 1;
        continue;
      }
      const heading = HEADING.exec(line);
      if (heading) {
        const title = document.createElement("h" + heading[1].length);
        inline(heading[2], title);
        root.append(title);
        i += 1;
        continue;
      }
      if (line.includes("|") && isTableDivider(lines[i + 1] ?? "")) {
        const head = tableRow(line),
          rows = [];
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
          rows.push(tableRow(lines[i]));
          i += 1;
        }
        root.append(tableBlock(head, rows));
        continue;
      }
      if (QUOTE.test(line)) {
        const quote = [];
        while (i < lines.length && QUOTE.test(lines[i])) {
          quote.push(lines[i].replace(/^\s{0,3}>\s?/, ""));
          i += 1;
        }
        const block = document.createElement("blockquote");
        block.append(richText(quote.join("\n")));
        root.append(block);
        continue;
      }
      if (LIST_ITEM.test(line)) {
        const list = listBlock(lines, i);
        if (list.next > i) {
          root.append(list.node);
          i = list.next;
        } else {
          // A malformed block must never prevent the parser from advancing.
          const block = document.createElement("p");
          inline(line, block);
          root.append(block);
          i += 1;
        }
        continue;
      }
      const paragraph = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !FENCE.test(lines[i]) &&
        !HEADING.test(lines[i]) &&
        !RULE.test(lines[i]) &&
        !QUOTE.test(lines[i]) &&
        !LIST_ITEM.test(lines[i])
      )
        paragraph.push((i++, lines[i - 1]));
      if (!paragraph.length) {
        paragraph.push(line);
        i += 1;
      }
      const block = document.createElement("p");
      for (const [index, value] of paragraph.entries()) {
        if (index) block.append(document.createElement("br"));
        inline(value, block);
      }
      root.append(block);
    }
    return root;
  }
  window.veriussuMarkdown = { render: richText };
  let renderedConversation = null;
  function renderMessages(messages) {
    const panel = el("main");
    const follow =
      renderedConversation !== active?.id ||
      panel.scrollHeight - panel.scrollTop - panel.clientHeight < 120;
    renderedConversation = active?.id;
    el("messages").replaceChildren();
    el("welcome").hidden = false;
    for (const message of messages) {
      const article = document.createElement("article");
      article.className = "chat-message " + message.role;
      const label = textNode(
        "small",
        message.role === "assistant"
          ? (active?.modelName ?? "Veriüssü")
          : (user?.firstName ?? t("account")),
        "message-role",
      );
      const body =
        message.role === "assistant"
          ? richText(
              window.veriussuPresentation.withoutSources(message.content),
            )
          : textNode("div", message.content);
      body.classList.add("message-content");
      if (message.role === "assistant" && message.id && executionEnabled) {
        for (const block of body.querySelectorAll(".md-code")) {
          const aliases = {
            py: "python",
            python: "python",
            python3: "python",
            js: "javascript",
            javascript: "javascript",
            node: "javascript",
          };
          const language = aliases[block.dataset.language],
            code = block.querySelector("code").textContent;
          if (!language || code.length > 12000) continue;
          const run = textNode("button", t("runCode"), "md-run");
          run.type = "button";
          run.addEventListener(
            "click",
            () => void executeCode(message.id, language, code),
          );
          block.querySelector(".md-code-bar").append(run);
        }
      }
      article.append(label, body);
      if (message.files?.length) {
        const files = document.createElement("div");
        files.className = "message-files";
        for (const file of message.files) {
          if (file.mime === "image/webp") {
            const image = document.createElement("img");
            image.className = "message-image";
            image.src = "/site/chat/files/" + encodeURIComponent(file.id);
            image.alt = file.name;
            image.loading = "lazy";
            files.append(image);
          } else if (
            file.mime?.startsWith("audio/") ||
            file.mime === "video/mp4"
          ) {
            const media = document.createElement(
              file.mime === "video/mp4" ? "video" : "audio",
            );
            media.controls = true;
            media.preload = "none";
            media.src = "/site/chat/files/" + encodeURIComponent(file.id);
            media.className = "message-media";
            files.append(media);
          }
          const link = textNode(
            "a",
            file.name + (file.truncated ? " · " + t("fileTruncated") : ""),
            "file-chip",
          );
          link.href = "/site/chat/files/" + encodeURIComponent(file.id);
          link.removeAttribute("download");
          link.addEventListener("click", (event) => {
            event.preventDefault();
            void previewFile(file);
          });
          if (file.mime === "image/webp") {
            const image = files.lastElementChild;
            image.style.cursor = "pointer";
            image.addEventListener("click", () => void previewFile(file));
          }
          files.append(link);
        }
        article.append(files);
      }
      if (message.role === "user" && message.id) {
        const actions = document.createElement("div"),
          edit = textNode("button", t("editMessage"), "message-copy");
        actions.className = "message-actions";
        edit.type = "button";
        edit.addEventListener("click", () => {
          if (
            busy ||
            (currentRun && ["QUEUED", "RUNNING"].includes(currentRun.status))
          )
            return;
          editingMessage = message;
          el("message-edit-content").value = message.content;
          el("message-edit-dialog").showModal();
          el("message-edit-content").focus();
        });
        actions.append(edit);
        article.append(actions);
      }
      if (message.role === "assistant") {
        const actions = document.createElement("div"),
          copy = textNode("button", t("copyAnswer"), "message-copy");
        actions.className = "message-actions";
        copy.type = "button";
        copy.addEventListener("click", async () => {
          try {
            await copyValue(
              window.veriussuPresentation.withoutSources(message.content),
            );
            copy.textContent = t("codeCopied");
          } catch {
            copy.textContent = t("copyFailed");
          }
          setTimeout(() => {
            if (copy.isConnected) copy.textContent = t("copyAnswer");
          }, 1800);
        });
        actions.append(copy);
        if (message.id) {
          const regenerate = textNode(
            "button",
            t("regenerateAnswer"),
            "message-copy",
          );
          regenerate.type = "button";
          regenerate.addEventListener(
            "click",
            () => void branchMessage(message.id, "REGENERATE"),
          );
          actions.append(regenerate);
        }
        article.append(actions);
      }
      el("messages").append(article);
    }
    el("welcome").hidden = messages.length > 0;
    window.veriussuChatExperience?.updateMessages(messages);
    if (follow)
      requestAnimationFrame(() => {
        panel.scrollTop = panel.scrollHeight;
      });
  }
  function renderCode(run) {
    el("code-status").textContent =
      t(
        ["QUEUED", "RUNNING"].includes(run.status)
          ? "codeRunning"
          : run.status === "COMPLETED"
            ? "codeCompleted"
            : "codeFailed",
      ) +
      (run.exitCode !== null && run.exitCode !== undefined
        ? " · " + run.exitCode
        : "") +
      (run.truncated ? " · " + t("fileTruncated") : "");
    el("code-stdout").textContent = run.stdout || "—";
    el("code-stderr").textContent = run.stderr || "—";
    el("code-files").replaceChildren();
    for (const file of run.files ?? []) {
      if (file.mime === "image/webp") {
        const image = document.createElement("img");
        image.src = "/site/chat/files/" + encodeURIComponent(file.id);
        image.alt = file.name;
        image.className = "message-image";
        el("code-files").append(image);
      }
      const link = textNode("a", file.name, "file-chip");
      link.href = "/site/chat/files/" + encodeURIComponent(file.id);
      link.download = file.name;
      el("code-files").append(link);
    }
  }
  async function executeCode(messageId, language, code) {
    if (!active || !user) return;
    if (pendingCode?.running) {
      el("code-dialog").showModal();
      return;
    }
    const conversationId = active.id;
    if (
      !pendingCode ||
      pendingCode.messageId !== messageId ||
      pendingCode.code !== code ||
      pendingCode.conversationId !== conversationId
    )
      pendingCode = {
        messageId,
        language,
        code,
        conversationId,
        requestId: requestId(),
      };
    pendingCode.running = true;
    const ticket = epoch;
    el("code-dialog").showModal();
    renderCode({ status: "QUEUED" });
    const poll = async (id) => {
      if (ticket !== epoch || !pendingCode?.running) return;
      try {
        const { run } = await api("/site/chat/code-runs/" + id);
        if (ticket !== epoch) return;
        renderCode(run);
        if (["QUEUED", "RUNNING"].includes(run.status))
          codePolling = setTimeout(() => void poll(id), 700);
        else pendingCode = null;
      } catch {
        if (ticket === epoch) {
          renderCode({ status: "FAILED" });
          if (pendingCode) pendingCode.running = false;
        }
      }
    };
    try {
      const { requestId: rid } = pendingCode;
      const { run } = await api(
        "/site/chat/conversations/" + conversationId + "/execute",
        { requestId: rid, messageId, language, code },
      );
      if (ticket !== epoch) return;
      renderCode(run);
      if (["QUEUED", "RUNNING"].includes(run.status)) await poll(run.id);
      else pendingCode = null;
    } catch {
      if (ticket === epoch) {
        renderCode({ status: "FAILED" });
        if (pendingCode) pendingCode.running = false;
      }
    }
  }
  el("code-close").addEventListener("click", () => el("code-dialog").close());
  async function branchMessage(messageId, mode, content) {
    if (
      busy ||
      !active ||
      (currentRun && ["QUEUED", "RUNNING"].includes(currentRun.status))
    )
      return;
    const source = active.id;
    if (
      !pendingBranch ||
      pendingBranch.source !== source ||
      pendingBranch.messageId !== messageId ||
      pendingBranch.mode !== mode ||
      pendingBranch.content !== content
    )
      pendingBranch = {
        source,
        messageId,
        mode,
        content,
        requestId: requestId(),
        expectedVersion: active.version,
      };
    busy = true;
    controls();
    try {
      const body = { ...pendingBranch };
      delete body.source;
      const data = await api(
        "/site/chat/conversations/" + source + "/branch",
        body,
      );
      pendingBranch = null;
      el("message-edit-dialog").close();
      editingMessage = null;
      active = data.conversation;
      currentRun = data.run;
      location.hash = active.id;
      const detail = await api("/site/chat/conversations/" + active.id);
      renderMessages(detail.messages);
      renderRun(currentRun);
      await history();
      paint();
      mark();
      schedulePoll(currentRun.id, active.id);
    } catch (error) {
      if (error.message !== "STALE")
        showRequestError(error);
    } finally {
      busy = false;
      controls();
    }
  }
  el("message-edit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (editingMessage)
      void branchMessage(
        editingMessage.id,
        "EDIT",
        el("message-edit-content").value.trim(),
      );
  });
  for (const id of ["message-edit-close", "message-edit-cancel"])
    el(id).addEventListener("click", () => {
      if (!busy) el("message-edit-dialog").close();
    });
  el("versions-close").addEventListener("click", () =>
    el("versions-dialog").close(),
  );
  el("chat-versions").addEventListener("click", async () => {
    if (busy || !active) return;
    busy = true;
    controls();
    try {
      const result = await api(
        "/site/chat/conversations/" + active.id + "/branches",
      );
      el("versions-list").replaceChildren();
      for (const conversation of result.conversations) {
        const button = textNode("button", conversation.title, "version-item");
        button.type = "button";
        button.setAttribute(
          "aria-current",
          String(conversation.id === active.id),
        );
        button.addEventListener("click", () => {
          el("versions-dialog").close();
          void open(conversation.id);
        });
        el("versions-list").append(button);
      }
      el("versions-dialog").showModal();
    } catch {
      notice("failed");
    } finally {
      busy = false;
      controls();
    }
  });
  function renderDraft() {
    // Ignore provisional content even when replayed by an older backend.
    document.getElementById("run-draft")?.remove();
  }
  function renderRun(run) {
    renderDraft(run);
    el("run-sources").replaceChildren();
    if (run?.status === "FAILED") showRequestError(run.errorCode || "UNKNOWN");
    else {
      window.UmayErrors.render(document, null);
      notice(run ? (["QUEUED", "RUNNING"].includes(run.status) ? "thinking" : run.phase) : "");
    }
    el("run-sources").hidden = true;
  }

  function schedulePoll(runId, conversationId) {
    clearTimeout(pollTimer);
    if (runEvents) runEvents.close();
    if (!window.EventSource) return pollFallback(runId, conversationId);
    const ticket = epoch;
    const events = new EventSource("/site/chat/runs/" + runId + "/events");
    runEvents = events;
    const valid = () =>
      ticket === epoch && active?.id === conversationId && runEvents === events;
    const fallback = () => {
      events.close();
      if (!valid()) return;
      runEvents = null;
      pollFallback(runId, conversationId);
    };
    events.addEventListener("snapshot", async (event) => {
      if (!valid()) {
        events.close();
        return;
      }
      try {
        const data = JSON.parse(event.data);
        if (data.run?.id !== runId) return fallback();
        currentRun = data.run;
        renderRun(currentRun);
        controls();
        if (!["QUEUED", "RUNNING"].includes(currentRun.status)) {
          events.close();
          const detail = await api(
            "/site/chat/conversations/" + conversationId,
          );
          if (!valid()) return;
          runEvents = null;
          active = detail.conversation;
          renderMessages(detail.messages);
          paint();
          renderRun(currentRun);
        }
      } catch {
        fallback();
      }
    });
    events.addEventListener("unavailable", fallback);
    events.onerror = () => {
      if (events.readyState === EventSource.CLOSED) fallback();
    };
    // EventSource reconnects automatically after network interruptions. A
    // bounded watchdog also recovers when a proxy silently drops the stream.
    events.onopen = () => {
      clearTimeout(pollTimer);
      pollTimer = setTimeout(fallback, 65000);
    };
    pollTimer = setTimeout(fallback, 65000);
  }
  function pollFallback(runId, conversationId) {
    clearTimeout(pollTimer);
    if (runEvents) {
      runEvents.close();
      runEvents = null;
    }
    const ticket = epoch;
    pollTimer = setTimeout(async () => {
      if (ticket !== epoch || active?.id !== conversationId) return;
      try {
        const data = await api("/site/chat/runs/" + runId);
        if (ticket !== epoch || active?.id !== conversationId) return;
        currentRun = data.run;
        renderRun(currentRun);
        controls();
        if (["QUEUED", "RUNNING"].includes(currentRun.status))
          schedulePoll(runId, conversationId);
        else {
          const detail = await api(
            "/site/chat/conversations/" + conversationId,
          );
          if (active?.id === conversationId && ticket === epoch) {
            active = detail.conversation;
            renderMessages(detail.messages);
            paint();
            renderRun(currentRun);
          }
        }
      } catch {
        if (ticket === epoch && active?.id === conversationId) {
          notice("failed");
          schedulePoll(runId, conversationId);
        }
      }
    }, 1000);
  }
  el("message").addEventListener("input", controls);
  el("message").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      el("send").click();
    }
  });
  el("send").addEventListener("click", async () => {
    const content =
        el("message").value.trim() ||
        (pendingFiles.length ? t("attachmentQuestion") : ""),
      model = selected();
    if (busy || uploading || !user || !model || !content) return;
    if (
      pendingFiles.some((file) => file.mime?.startsWith("image/")) &&
      !hasVision(model)
    ) {
      chooseVision();
      return;
    }
    busy = true;
    controls();
    try {
      if (!active) {
        const data = await api("/site/chat/conversations", {
          requestId: requestId(),
          title: content.slice(0, 100),
          source: model.source,
          modelId: model.id,
        });
        active = data.conversation;
        location.hash = active.id;
        await history();
      }
      if (
        !pendingSend ||
        pendingSend.content !== content ||
        pendingSend.conversationId !== active.id
      )
        pendingSend = {
          requestId: requestId(),
          content,
          fileIds: pendingFiles.map((file) => file.id),
          kind: el("tool-kind").value || "CHAT",
          ...(el("tool-kind").value === "SPEECH"
            ? { voice: el("voice").value }
            : {}),
          expectedVersion: active.version,
          conversationId: active.id,
        };
      const { conversationId, ...payload } = pendingSend;
      const data = await api(
        "/site/chat/conversations/" + conversationId + "/messages",
        payload,
      );
      pendingSend = null;
      pendingFiles = [];
      paintFiles();
      currentRun = data.run;
      el("message").value = "";
      const detail = await api("/site/chat/conversations/" + conversationId);
      renderMessages(detail.messages);
      renderRun(currentRun);
      schedulePoll(currentRun.id, conversationId);
      paint();
      closeMenu();
    } catch (e) {
      if (e.message !== "STALE")
        showRequestError(e);
    } finally {
      busy = false;
      controls();
    }
  });
  el("stop-run").addEventListener("click", async () => {
    if (!currentRun || busy) return;
    busy = true;
    controls();
    try {
      const data = await api(
        "/site/chat/runs/" + currentRun.id + "/cancel",
        {},
      );
      currentRun = data.run;
      clearTimeout(pollTimer);
      if (runEvents) {
        runEvents.close();
        runEvents = null;
      }
      renderRun(currentRun);
      if (active) {
        const detail = await api("/site/chat/conversations/" + active.id);
        renderMessages(detail.messages);
      }
    } catch {
      notice("failed");
    } finally {
      busy = false;
      controls();
    }
  });
  function conversationButton(conversation, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation-icon " + action;
    button.disabled = busy;
    button.title = t(action === "rename" ? "renameChat" : "deleteChat");
    button.setAttribute("aria-label", button.title);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.5");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute(
      "d",
      action === "rename"
        ? "m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z"
        : "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
    );
    svg.append(path);
    button.append(svg);
    button.addEventListener("click", () => {
      if (busy) return;
      conversationAction = { conversation, action };
      el("conversation-dialog-title").textContent = t(
        action === "rename" ? "renameChat" : "deleteChat",
      );
      el("conversation-title-label").hidden = action !== "rename";
      el("conversation-delete-note").hidden = action !== "delete";
      el("conversation-title-input").value = conversation.title;
      el("conversation-title-input").required = action === "rename";
      el("conversation-submit").textContent = t(
        action === "rename" ? "save" : "deleteChat",
      );
      el("conversation-submit").classList.toggle("danger", action === "delete");
      el("conversation-error").textContent = "";
      el("conversation-dialog").showModal();
      if (action === "rename") {
        el("conversation-title-input").focus();
        el("conversation-title-input").select();
      } else el("conversation-cancel").focus();
    });
    return button;
  }
  for (const id of ["conversation-close", "conversation-cancel"])
    el(id).addEventListener("click", () => {
      if (!busy) el("conversation-dialog").close();
    });
  el("conversation-close").setAttribute("aria-label", t("close"));
  el("conversation-dialog").addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });
  el("conversation-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !conversationAction) return;
    const { conversation, action } = conversationAction,
      title = el("conversation-title-input").value.trim();
    if (action === "rename" && !title) {
      el("conversation-title-input").focus();
      return;
    }
    busy = true;
    controls();
    try {
      const data = await api(
        "/site/chat/conversations/" + conversation.id + "/" + action,
        {
          expectedVersion: conversation.version,
          ...(action === "rename" ? { title } : {}),
        },
      );
      if (active?.id === conversation.id) {
        if (action === "delete") {
          active = null;
          currentRun = null;
          clearTimeout(pollTimer);
          if (runEvents) {
            runEvents.close();
            runEvents = null;
          }
          el("welcome").hidden = false;
          renderRun(null);
          location.hash = "";
          renderMessages([]);
        } else active = data.conversation;
      }
      el("conversation-dialog").close();
      conversationAction = null;
      await history();
      paint();
    } catch (e) {
      if (e.message !== "STALE")
        el("conversation-error").textContent = t(
          e.message === "stale" ? "stale" : "failed",
        );
    } finally {
      busy = false;
      controls();
      renderFolder();
    }
  });
  function addHistory(items, append = false) {
    if (!append) el("history").replaceChildren();
    for (const c of items.slice(0, 3)) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c.title;
      b.dataset.id = c.id;
      b.title = c.modelName;
      b.addEventListener("click", () => void open(c.id));
      b.className = "history-open";
      const row = document.createElement("div");
      row.className = "history-row";
      row.append(
        b,
        conversationButton(c, "rename"),
        conversationButton(c, "delete"),
      );
      el("history").append(row);
    }
    mark();
  }
  async function history() {
    const data = await api("/site/chat/conversations");
    addHistory(data.conversations);
    if (el("chats-dialog").open) await loadFolder(false);
  }
  function renderFolder() {
    const results = el("folder-results");
    results.replaceChildren();
    if (!folderItems.length)
      results.append(textNode("p", t("emptyFolder"), "model-results-empty"));
    for (const c of folderItems) {
      const row = document.createElement("div");
      row.className = "folder-row";
      const link = textNode("button", c.title, "folder-chat");
      link.type = "button";
      link.title = c.modelName;
      link.addEventListener("click", () => {
        if (busy) return;
        el("chats-dialog").close();
        void open(c.id);
      });
      const action = textNode(
        "button",
        t(c.archivedAt ? "restoreChat" : "archiveChat"),
        "folder-action",
      );
      action.type = "button";
      action.disabled = busy;
      action.addEventListener("click", () => void archiveConversation(c));
      const actions = document.createElement("div");
      actions.className = "folder-row-actions";
      actions.append(
        conversationButton(c, "rename"),
        conversationButton(c, "delete"),
        action,
      );
      row.append(link, actions);
      results.append(row);
    }
  }
  async function loadFolder(append) {
    const data = await api(
      "/site/chat/conversations?folder=" +
        folderMode +
        (append && cursor ? "&before=" + encodeURIComponent(cursor) : ""),
    );
    folderItems = append
      ? [...folderItems, ...data.conversations]
      : data.conversations;
    cursor = data.nextCursor;
    el("more").hidden = !cursor;
    renderFolder();
  }
  async function showFolder(mode) {
    if (!user || busy) return;
    folderMode = mode;
    folderItems = [];
    cursor = null;
    el("chats-dialog-title").textContent = t(
      mode === "archive" ? "archive" : "myChats",
    );
    el("folder-results").replaceChildren();
    el("chats-dialog").showModal();
    busy = true;
    controls();
    try {
      await loadFolder(false);
    } catch {
      notice("failed");
    } finally {
      busy = false;
      controls();
      renderFolder();
    }
  }
  async function archiveConversation(c) {
    if (busy) return;
    busy = true;
    controls();
    renderFolder();
    try {
      const data = await api("/site/chat/conversations/" + c.id + "/archive", {
        archived: !c.archivedAt,
        expectedVersion: c.version,
      });
      if (active?.id === c.id) active = data.conversation;
      await history();
      paint();
    } catch (e) {
      notice(e.message === "stale" ? "stale" : "failed");
    } finally {
      busy = false;
      controls();
      renderFolder();
    }
  }
  el("chats-folder").addEventListener("click", () => void showFolder("active"));
  el("archive-folder").addEventListener(
    "click",
    () => void showFolder("archive"),
  );
  el("archive-current").addEventListener("click", () => {
    if (active) void archiveConversation(active);
  });
  el("chats-close").setAttribute("aria-label", t("close"));
  el("chats-close").addEventListener("click", () => el("chats-dialog").close());
  function closeMenu() {
    el("sidebar").classList.remove("open");
    el("menu").setAttribute("aria-expanded", "false");
    el("studio-menu").setAttribute("aria-expanded", "false");
  }
  async function open(id) {
    if (busy) return;
    busy = true;
    controls();
    try {
      const data = await api(
        "/site/chat/conversations/" + encodeURIComponent(id),
      );
      active = data.conversation;
      dispatchEvent(new Event("chat:view"));
      clearTimeout(pollTimer);
      if (runEvents) {
        runEvents.close();
        runEvents = null;
      }
      currentRun = data.run ?? null;
      renderMessages(data.messages);
      renderRun(currentRun);
      if (currentRun && ["QUEUED", "RUNNING"].includes(currentRun.status))
        schedulePoll(currentRun.id, id);
      location.hash = id;
      if (!currentRun) notice("");
      paint();
      mark();
      closeMenu();
    } catch (e) {
      if (e.message !== "STALE")
        notice(e.message === "stale" ? "stale" : "failed");
    } finally {
      busy = false;
      controls();
    }
  }
  async function sync() {
    if (checking || busy || document.hidden) return;
    checking = true;
    try {
      const response = await fetch("/site/auth/me", {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 401) {
        clear();
        paint();
        return;
      }
      if (!response.ok) throw Error();
      const account = await response.json();
      const changed = user?.id !== account.id;
      if (changed) clear();
      user = account;
      window.dispatchEvent(
        new CustomEvent("chat:account", { detail: { id: account.id } }),
      );
      window.veriussuTheme.setAccount(account);
      const data = await api("/site/chat/models");
      executionEnabled = !!data.executionEnabled;
      models = data.models;
      paint();
      if (changed) {
        await history();
        const id = location.hash.slice(1);
        if (
          /^[a-f\d-]{36}$/i.test(id) &&
          new URL(location.href).searchParams.get("view") !== "studio"
        )
          await open(id);
      }
    } catch {
      notice("failed");
    } finally {
      checking = false;
      controls();
    }
  }
  function textNode(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function renderModelResults() {
    const query = el("model-search")
      .value.trim()
      .toLocaleLowerCase(document.documentElement.lang);
    const results = el("model-results");
    results.replaceChildren();
    if (visionOnly)
      results.append(
        textNode(
          "p",
          fileLabel(
            "Bu görseli incelemek için vision destekli bir model seçin. Mesajınız ve dosyalarınız korunur.",
            "Choose a vision model to analyze this image. Your message and files are preserved.",
          ),
        ),
      );
    for (const button of el("model-filters").querySelectorAll("button")) {
      const source = button.dataset.modelFilter;
      const label =
        source === "ALL"
          ? "allModels"
          : source === "SUBSCRIPTION"
            ? "subscriptionModels"
            : "personalModels";
      const count =
        source === "ALL"
          ? models.length
          : models.filter((m) => m.source === source).length;
      button.replaceChildren(
        document.createTextNode(t(label)),
        textNode("span", String(count)),
      );
      button.setAttribute("aria-pressed", String(modelFilter === source));
    }
    const matches = models.filter(
      (m) =>
        (!visionOnly || hasVision(m)) &&
        (modelFilter === "ALL" || m.source === modelFilter) &&
        [m.name, m.serverName, ...(m.categories ?? [])]
          .join(" ")
          .toLocaleLowerCase(document.documentElement.lang)
          .includes(query),
    );
    for (const source of ["SUBSCRIPTION", "PERSONAL"]) {
      const group = matches.filter((m) => m.source === source);
      if (!group.length) continue;
      const section = document.createElement("section");
      section.append(
        textNode(
          "h3",
          t(
            source === "SUBSCRIPTION" ? "subscriptionModels" : "personalModels",
          ),
          "model-group-title",
        ),
      );
      for (const model of group) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "model-option";
        row.dataset.modelKey = optionKey(model);
        const chosen = optionKey(model) === el("model").value;
        row.setAttribute("aria-pressed", String(chosen));
        let logo = null;
        if (model.hasLogo && model.logoUrl) {
          logo = document.createElement("img");
          logo.className = "model-option-logo";
          logo.alt = "";
          logo.src = model.logoUrl;
          logo.loading = "lazy";
          logo.addEventListener("error", () => logo.remove(), { once: true });
        }
        const copy = document.createElement("span");
        copy.className = "model-option-copy";
        copy.append(
          textNode("strong", model.name),
          textNode("small", model.serverName),
        );
        const meta = document.createElement("span");
        meta.className = "model-option-meta";
        const capacity = Number(model.contextCapacity);
        if (Number.isFinite(capacity) && capacity > 0)
          meta.append(
            textNode(
              "small",
              `${t("context")}: ${new Intl.NumberFormat(document.documentElement.lang).format(capacity)} ${t("tokens")}`,
            ),
          );
        meta.append(textNode("span", chosen ? "✓" : "↗", "model-option-check"));
        if (logo) row.append(logo);
        row.append(copy, meta);
        row.addEventListener("click", () => {
          if (busy) return;
          el("model").value = optionKey(model);
          el("model-dialog").close();
          el("model").dispatchEvent(new Event("change"));
        });
        section.append(row);
      }
      results.append(section);
    }
    if (!matches.length)
      results.append(
        textNode(
          "p",
          visionOnly
            ? fileLabel(
                "Hesabınızda erişilebilir vision modeli bulunamadı.",
                "No accessible vision model is available.",
              )
            : models.length
              ? t("noResults")
              : t("noModels"),
          "model-results-empty",
        ),
      );
  }
  el("model-search").placeholder = t("searchModels");
  el("model-search").setAttribute("aria-label", t("searchModels"));
  el("model-filters").setAttribute("aria-label", t("selectModel"));
  for (const prefix of [
    "model",
    "settings",
    "studio-servers",
    "studio-github",
  ]) {
    el(prefix + "-close").setAttribute("aria-label", t("close"));
    el(prefix + "-close").addEventListener("click", () =>
      el(prefix + "-dialog").close(),
    );
    el(prefix + "-dialog").addEventListener("click", (event) => {
      if (event.target !== el(prefix + "-dialog")) return;
      const rect = event.target.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        event.target.close();
    });
  }
  el("model-open").addEventListener("click", () => {
    if (!user || busy) return;
    visionOnly = false;
    modelFilter = "ALL";
    el("model-search").value = "";
    renderModelResults();
    el("model-dialog").showModal();
    el("model-search").focus();
  });
  el("model-search").addEventListener("input", renderModelResults);
  el("model-dialog").addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      el("model-dialog").close();
    }
  });
  el("model-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-model-filter]");
    if (!button) return;
    modelFilter = button.dataset.modelFilter;
    renderModelResults();
  });
  function openSettings() {
    if (!user) return;
    closeMenu();
    el("chat-language").value = document.documentElement.lang;
    el("settings-dialog").showModal();
    loadMemory().catch(() => {
      el("memory-status").textContent = t("failed");
    });
  }
  el("settings").addEventListener("click", () => openSettings());
  let memoryBusy = false,
    memoryItems = [];
  function settingsPage(page) {
    document
      .querySelectorAll("[data-settings-page]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.settingsPage === page),
        ),
      );
    document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.settingsPanel !== page;
    });
  }
  document
    .querySelectorAll("[data-settings-page]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        settingsPage(button.dataset.settingsPage),
      ),
    );
  el("memory-search").placeholder = t("memorySearch");
  el("memory-search").setAttribute("aria-label", t("memorySearch"));
  el("memory-search").addEventListener("input", renderMemory);
  async function loadMemory() {
    const data = await api("/site/chat/memory");
    el("memory-enabled").checked = data.enabled;
    memoryItems = data.memories;
    el("memory-count").textContent = String(memoryItems.length);
    renderMemory();
  }
  function renderMemory() {
    const query = el("memory-search")
      .value.trim()
      .toLocaleLowerCase(document.documentElement.lang);
    const items = memoryItems.filter((memory) =>
      [memory.content, t("memoryCategory_" + memory.category)]
        .join(" ")
        .toLocaleLowerCase(document.documentElement.lang)
        .includes(query),
    );
    el("memory-list").replaceChildren();
    el("memory-status").textContent = items.length
      ? ""
      : t(query ? "memoryNoResults" : "memoryEmpty");
    for (const memory of items) {
      const card = document.createElement("article");
      card.className = "memory-card";
      const heading = document.createElement("div");
      heading.className = "memory-card-heading";
      const category = textNode(
        "span",
        t("memoryCategory_" + memory.category),
        "memory-category",
      );
      const actions = document.createElement("div");
      actions.className = "memory-card-actions";
      const edit = textNode("button", t("memoryEdit"), "folder-action");
      edit.type = "button";
      edit.disabled = memoryBusy;
      actions.append(edit);
      heading.append(category, actions);
      const content = textNode("p", memory.content, "memory-content");
      const input = document.createElement("textarea");
      input.value = memory.content;
      input.maxLength = 1200;
      input.rows = 3;
      input.hidden = true;
      input.setAttribute("aria-label", t("memory"));
      const editorActions = document.createElement("div");
      editorActions.className = "memory-editor-actions";
      editorActions.hidden = true;
      const save = textNode("button", t("memorySave"), "primary");
      save.type = "button";
      const cancel = textNode("button", t("cancel"), "folder-action");
      cancel.type = "button";
      editorActions.append(cancel, save);
      edit.addEventListener("click", () => {
        content.hidden = true;
        actions.hidden = true;
        input.hidden = false;
        editorActions.hidden = false;
        input.focus();
      });
      cancel.addEventListener("click", () => {
        input.value = memory.content;
        content.hidden = false;
        actions.hidden = false;
        input.hidden = true;
        editorActions.hidden = true;
      });
      save.addEventListener("click", () =>
        mutateMemory(async () => {
          if (!input.value.trim()) {
            input.focus();
            throw Error("EMPTY");
          }
          await api("/site/chat/memory/" + memory.id + "/edit", {
            content: input.value.trim(),
          });
        }),
      );
      const source = document.createElement("details");
      source.className = "memory-source";
      const summary = textNode("summary", t("memorySource"));
      source.append(summary, textNode("p", memory.sourceQuote));
      card.append(heading, content, input, editorActions, source);
      el("memory-list").append(card);
    }
  }
  async function mutateMemory(fn) {
    if (memoryBusy) return;
    memoryBusy = true;
    el("memory-status").textContent = t("loading");
    document
      .querySelectorAll(
        '[data-settings-panel="memory"] button, #memory-enabled',
      )
      .forEach((button) => {
        button.disabled = true;
      });
    try {
      await fn();
      await loadMemory();
    } catch {
      el("memory-status").textContent = t("failed");
    } finally {
      memoryBusy = false;
      document
        .querySelectorAll(
          '[data-settings-panel="memory"] button, #memory-enabled',
        )
        .forEach((button) => {
          button.disabled = false;
        });
    }
  }
  el("memory-refresh").addEventListener("click", () =>
    mutateMemory(async () => {}),
  );
  el("memory-enabled").addEventListener("change", () =>
    mutateMemory(() =>
      api("/site/chat/memory/settings", {
        enabled: el("memory-enabled").checked,
      }),
    ),
  );
  el("chat-language").addEventListener("change", () => {
    try {
      localStorage.setItem("veriussu.language", el("chat-language").value);
      location.reload();
    } catch {
      notice("failed");
    }
  });
  el("settings-theme").addEventListener("click", () => {
    el("settings-dialog").close();
    el("theme").click();
  });
  el("new-chat").addEventListener("click", async () => {
    const m = selected();
    if (!m || busy) return;
    busy = true;
    controls();
    try {
      if (
        !pendingCreate ||
        pendingCreate.source !== m.source ||
        pendingCreate.modelId !== m.id
      ) {
        pendingCreate = {
          requestId: requestId(),
          title: t("newChat"),
          source: m.source,
          modelId: m.id,
        };
      }
      const data = await api("/site/chat/conversations", pendingCreate);
      pendingCreate = null;
      active = data.conversation;
      dispatchEvent(new Event("chat:view"));
      clearTimeout(pollTimer);
      if (runEvents) {
        runEvents.close();
        runEvents = null;
      }
      currentRun = null;
      renderRun(null);
      renderMessages([]);
      location.hash = active.id;
      await history();
      paint();
      notice("ready");
      closeMenu();
    } catch (e) {
      if (e.message !== "STALE") notice("failed");
    } finally {
      busy = false;
      controls();
    }
  });
  el("model").addEventListener("change", async () => {
    const m = selected();
    if (!m || busy) return;
    try {
      localStorage.setItem(modelPreferenceKey(), optionKey(m));
    } catch {
      /* Storage can be restricted. */
    }
    if (
      !active ||
      new URL(location.href).searchParams.get("view") === "studio"
    ) {
      paintModels();
      return;
    }
    busy = true;
    controls();
    try {
      const data = await api(
        "/site/chat/conversations/" + active.id + "/model",
        { source: m.source, modelId: m.id, expectedVersion: active.version },
      );
      active = data.conversation;
      await history();
      notice("selected");
    } catch (e) {
      if (e.message !== "STALE")
        notice(e.message === "stale" ? "stale" : "failed");
    } finally {
      busy = false;
      paint();
    }
  });
  el("more").addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    controls();
    try {
      await loadFolder(true);
    } catch {
      notice("failed");
    } finally {
      busy = false;
      controls();
    }
  });
  el("logout").addEventListener("click", async () => {
    if (busy) return;
    try {
      await api("/site/auth/logout", {});
      clear();
      location.hash = "";
      paint();
    } catch {
      notice("failed");
    }
  });
  el("menu").addEventListener("click", () => {
    const open = el("sidebar").classList.toggle("open");
    el("menu").setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
  document.addEventListener("click", (e) => {
    if (
      !el("sidebar").contains(e.target) &&
      !el("menu").contains(e.target) &&
      !el("studio-menu").contains(e.target)
    )
      closeMenu();
  });
  addEventListener("focus", () => void sync());
  document.addEventListener("visibilitychange", () => void sync());
  addEventListener("web:theme", () => void sync());
  setInterval(() => void sync(), 30000);
  void (async () => {
    try {
      const r = await fetch("/chat-config.json");
      const cfg = await r.json();
      frontend = cfg.frontendUrl
        ? new URL(cfg.frontendUrl)
        : new URL(location.href);
      if (!cfg.frontendUrl) frontend.port = cfg.frontendPort;
      frontend.pathname = "/";
      frontend.search = "";
      frontend.hash = "";
      if (!["http:", "https:"].includes(frontend.protocol)) throw Error();
      el("home-link").href = frontend.href;
      el("login").href = new URL("/login", frontend).href;
      el("account-name").href = new URL("/dashboard/account", frontend).href;
      el("models-link").href = new URL("/dashboard#my-models", frontend).href;
      await sync();
    } catch {
      notice("failed");
    }
  })();
})();
