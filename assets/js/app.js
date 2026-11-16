(function () {
  "use strict";

  const DATA = window.CampuShareData;
  const HOUR = 3600000;
  const DAY = 24 * HOUR;
  const NOW = new Date();

  /* ======================================================================
     1. Helpers
     ====================================================================== */
  const $ = function (selector, root) {
    return (root || document).querySelector(selector);
  };
  const $$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };

  function escapeHtml(text) {
    return String(text === undefined || text === null ? "" : text).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function icon(name, extraClass) {
    return '<svg class="icon' + (extraClass ? " " + extraClass : "") + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function normalize(text) {
    return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function formatDate(date) {
    return WEEKDAYS[date.getDay()] + " " + pad(date.getDate()) + "/" + pad(date.getMonth() + 1);
  }

  function formatTime(date) {
    return pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function formatShortDate(date) {
    return pad(date.getDate()) + "/" + pad(date.getMonth() + 1) + "/" + date.getFullYear();
  }

  function relativeTime(date) {
    const diff = Date.now() - date.getTime();
    if (diff < 60000) {
      return "Ahora";
    }
    if (diff < HOUR) {
      return "Hace " + Math.round(diff / 60000) + " min";
    }
    if (diff < DAY && date.getDate() === new Date().getDate()) {
      return formatTime(date);
    }
    if (diff < 2 * DAY) {
      return "Ayer";
    }
    return formatDate(date);
  }

  function addDays(date, days) {
    return new Date(date.getTime() + days * DAY);
  }

  function toInputDate(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function fromInputDate(value) {
    const parts = value.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  }

  function daysBetween(from, to) {
    return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
  }

  function uid(prefix) {
    uid.counter = (uid.counter || 0) + 1;
    return prefix + Date.now().toString(36) + uid.counter;
  }

  function randomCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function plural(count, singular, pluralForm) {
    return count + " " + (count === 1 ? singular : pluralForm);
  }

  function showToast(message, type) {
    const region = $("#toast-region");
    const toast = document.createElement("div");
    toast.className = "toast" + (type === "error" ? " toast--error" : "");
    toast.innerHTML = icon(type === "error" ? "alert" : type === "info" ? "info" : "check") + "<span></span>";
    toast.querySelector("span").textContent = message;
    region.appendChild(toast);
    while (region.children.length > 2) {
      region.firstElementChild.remove();
    }
    setTimeout(function () {
      toast.remove();
    }, 4500);
  }

  /* ======================================================================
     2. State (seed data, in memory)
     ====================================================================== */
  function readSessionEmail() {
    try {
      return sessionStorage.getItem("campushare.email");
    } catch (error) {
      return null;
    }
  }

  function nameFromEmail(email) {
    const local = email.split("@")[0];
    if (/^[a-z]+[._][a-z]+/i.test(local)) {
      return local.split(/[._]/).slice(0, 2).map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }).join(" ");
    }
    return "Lucas Arias";
  }

  const myEmail = readSessionEmail() || "u202312345@upc.edu.pe";
  const myName = nameFromEmail(myEmail);

  const users = JSON.parse(JSON.stringify(DATA.users));
  users.me = {
    id: "me", name: myName, initials: myName.split(" ").map(function (p) { return p.charAt(0); }).join("").slice(0, 2).toUpperCase(),
    career: "Ing. de Sistemas", cycle: "6.º ciclo", rating: 4.9, ratings: 18, deals: 20, onTime: 20, incidents: 0
  };

  const REVIEWS = {
    u1: [["Diego G.", 5, "Muy puntual y la calculadora estaba impecable."], ["Lucía P.", 5, "Excelente comunicación por el chat."]],
    u2: [["Andrea R.", 5, "Devolvió el libro antes de la fecha."], ["Kevin M.", 4, "Todo bien, solo llegó 10 minutos tarde."]],
    u3: [["Sofía L.", 5, "La guía me salvó el parcial, ¡gracias!"]],
    u4: [["Andrea R.", 4, "Buen trato."], ["Renato Q.", 3, "La calculadora no traía cable."]],
    u5: [["Lucas A.", 5, "Cuidó mucho el libro."], ["Diego G.", 5, "Puntual en la entrega."]],
    u6: [["Marco T.", 5, "Muy amable."]],
    u7: [["Andrea R.", 2, "Devolvió la calculadora 5 días tarde."], ["Sofía L.", 3, "No respondía el chat."]],
    me: [["Lucía P.", 5, "Me prestó el libro de Química sin problemas."], ["Kevin M.", 5, "Muy organizado con la entrega."]]
  };

  const state = {
    campus: "Monterrico",
    materials: JSON.parse(JSON.stringify(DATA.materials)),
    blocked: {},
    filters: { query: "", onlyAvailable: true, faculty: [], category: [], campus: [], sort: "near" },
    notifications: [],
    requestsSent: [
      { id: "s1", materialId: "m2", from: NOW, to: addDays(NOW, 35), point: "Biblioteca – Sede Monterrico", slot: "Mar 18:00–19:00", status: "pending", createdAt: new Date(NOW - 3 * HOUR) },
      { id: "s2", materialId: "m3", from: addDays(NOW, 1), to: addDays(NOW, 1), point: "Cafetería – Sede San Isidro", slot: "Mié 10:00–11:00", status: "accepted", code: "735104", createdAt: new Date(NOW - 26 * HOUR) },
      { id: "s3", materialId: "m4", from: NOW, to: addDays(NOW, 20), point: "Biblioteca – Sede Villa", slot: "Jue 12:00–13:00", status: "rejected", createdAt: new Date(NOW - 50 * HOUR) }
    ],
    requestsReceived: [
      { id: "r1", materialId: "m7", requesterId: "u5", from: addDays(NOW, 1), to: addDays(NOW, 15), status: "pending", createdAt: new Date(NOW - 2 * HOUR) },
      { id: "r2", materialId: "m7", requesterId: "u7", from: addDays(NOW, 2), to: addDays(NOW, 20), status: "pending", createdAt: new Date(NOW - 5 * HOUR) }
    ],
    deals: [
      { id: "d1", materialId: "m13", role: "lender", otherId: "u5", status: "pending-delivery", point: "Biblioteca – Sede Monterrico", slot: "Hoy 18:00–19:00", code: "482915", days: 30 },
      { id: "d2", materialId: "m15", role: "lender", otherId: "u3", status: "on-loan", point: "Biblioteca – Sede Monterrico", slot: "Lun 12:00–13:00", deliveredAt: addDays(NOW, -25), dueDate: addDays(NOW, 5) },
      { id: "d3", materialId: "m16", role: "borrower", otherId: "u1", status: "on-loan", point: "Biblioteca – Sede Monterrico", slot: "Jue 12:00–13:00", deliveredAt: addDays(NOW, -28), dueDate: new Date(NOW.getTime() + 44 * HOUR) },
      { id: "d4", materialId: "m17", role: "borrower", otherId: "u2", status: "on-loan", point: "Biblioteca – Sede San Isidro", slot: "Mar 18:00–19:00", deliveredAt: addDays(NOW, -12), dueDate: addDays(NOW, 18) }
    ],
    history: [
      { id: "h1", title: "Juego de reglas técnicas", role: "lender", otherId: "u6", closedAt: addDays(NOW, -20), rating: 5, condition: "Buen estado" },
      { id: "h2", title: "Atlas de anatomía Netter", role: "borrower", otherId: "u3", closedAt: addDays(NOW, -45), rating: 5, condition: "Buen estado" }
    ],
    conversations: [
      { id: "c1", userId: "u1", materialId: "m16", unread: 2, messages: [
        { from: "them", text: "Hola, ¿cómo te va con la calculadora?", time: new Date(NOW - 26 * HOUR) },
        { from: "me", text: "¡Hola Andrea! Muy bien, la necesito hasta el jueves para el parcial.", time: new Date(NOW - 25 * HOUR) },
        { from: "them", text: "Perfecto. Recuerda que la devolución es en la biblioteca de Monterrico.", time: new Date(NOW - 40 * 60000) },
        { from: "them", text: "Si necesitas más tiempo me avisas por aquí 😊", time: new Date(NOW - 38 * 60000) }
      ] },
      { id: "c2", userId: "u5", materialId: "m13", unread: 1, messages: [
        { from: "me", text: "Hola Kevin, te entrego el Stewart hoy a las 6 pm en la biblioteca.", time: new Date(NOW - 3 * HOUR) },
        { from: "them", text: "¡Genial! Ahí estaré. ¿Te muestro el código en la app?", time: new Date(NOW - 70 * 60000) }
      ] },
      { id: "c3", userId: "u2", materialId: "m17", unread: 0, messages: [
        { from: "me", text: "Gracias por prestarme el Serway, lo cuido mucho.", time: new Date(NOW - 30 * HOUR) },
        { from: "them", text: "Gracias por avisar 🙌", time: new Date(NOW - 29 * HOUR) }
      ] },
      { id: "c4", userId: "u3", materialId: "m3", unread: 0, messages: [
        { from: "them", text: "Acepté tu solicitud de la guía. Nos vemos en la cafetería de San Isidro.", time: new Date(NOW - 50 * HOUR) },
        { from: "me", text: "¡Gracias Lucía! Te confirmo mañana.", time: new Date(NOW - 49 * HOUR) }
      ] }
    ],
    activeConversation: null,
    publishStep: 1,
    publishPhoto: null
  };

  function material(id) {
    return state.materials.find(function (item) {
      return item.id === id;
    });
  }

  function proximityOf(item) {
    return DATA.campusDistance[state.campus][item.campus] || "far";
  }

  function addNotification(text, kind, iconName) {
    state.notifications.unshift({ id: uid("n"), text: text, kind: kind || "info", icon: iconName || "bell", time: new Date(), read: false });
    renderNotifications();
  }

  /* ======================================================================
     3. Routing (hash based: #catalog, #publish, #loans, #chat)
     ====================================================================== */
  const VIEWS = { catalog: "Catálogo", publish: "Publicar", loans: "Mis préstamos", chat: "Chat" };
  let firstRoute = true;

  function currentView() {
    const hash = window.location.hash.replace("#", "");
    return VIEWS[hash] ? hash : "catalog";
  }

  function route() {
    const view = currentView();
    $$(".view").forEach(function (section) {
      section.hidden = section.dataset.view !== view;
    });
    $$("[data-nav]").forEach(function (link) {
      if (link.dataset.nav === view) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    document.title = VIEWS[view] + " | Demo CampuShare";
    if (view === "loans") {
      //renderLoans();
    }
    if (view === "chat") {
      if (!state.activeConversation && window.matchMedia("(min-width: 48.01rem)").matches && state.conversations.length) {
        openConversation(state.conversations[0].id);
      }
      renderConversations();
      renderThread();
    }
    if (view === "publish") {
      renderPublications();
    }
    if (!firstRoute) {
      window.scrollTo(0, 0);
      const heading = $("#view-" + view + " h1");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
    firstRoute = false;
  }

  function go(view) {
    if (window.location.hash === "#" + view) {
      route();
    } else {
      window.location.hash = view;
    }
  }

  /* ======================================================================
     4. Header (notifications, profile) and dialog helpers
     ====================================================================== */
  function renderNotifications() {
    const list = $("#notification-list");
    const unread = state.notifications.filter(function (n) {
      return !n.read;
    }).length;
    $("#bell-dot").hidden = unread === 0;
    $("#bell-label").textContent = unread ? "Notificaciones, " + plural(unread, "sin leer", "sin leer") : "Notificaciones";
    if (state.notifications.length === 0) {
      list.innerHTML = '<li class="notification">No tienes notificaciones.</li>';
      return;
    }
    list.innerHTML = state.notifications.map(function (n) {
      return '<li class="notification' + (n.read ? "" : " notification--unread") + '">' +
        '<span class="notification__icon notification__icon--' + n.kind + '">' + icon(n.icon) + "</span>" +
        "<div><p>" + escapeHtml(n.text) + "</p><time>" + relativeTime(n.time) + "</time></div></li>";
    }).join("");
  }

  function setupPopover(buttonId, popoverId) {
    const button = document.getElementById(buttonId);
    const popover = document.getElementById(popoverId);
    function close() {
      popover.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }
    button.addEventListener("click", function (event) {
      event.stopPropagation();
      const willOpen = popover.hidden;
      $$(".popover").forEach(function (other) {
        other.hidden = true;
      });
      $$("[aria-haspopup]").forEach(function (other) {
        other.setAttribute("aria-expanded", "false");
      });
      popover.hidden = !willOpen;
      button.setAttribute("aria-expanded", String(willOpen));
      if (willOpen && popoverId === "notifications") {
        renderNotifications();
      }
    });
    popover.addEventListener("click", function (event) {
      event.stopPropagation();
    });
    document.addEventListener("click", close);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !popover.hidden) {
        close();
        button.focus();
      }
    });
  }

  const dialogOpeners = new WeakMap();

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog.open) {
      dialogOpeners.set(dialog, document.activeElement);
      dialog.showModal();
    }
    const focusTarget = dialog.querySelector("[autofocus]") || dialog.querySelector(".modal__body input, .modal__body button, .modal__body textarea, .modal__body a");
    if (focusTarget) {
      focusTarget.focus();
    }
    return dialog;
  }

  function closeDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog.open) {
      dialog.close();
    }
  }

  function setupDialogs() {
    $$("dialog.modal").forEach(function (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) {
          dialog.close();
        }
        if (event.target.closest("[data-close]")) {
          dialog.close();
        }
      });
      dialog.addEventListener("close", function () {
        const opener = dialogOpeners.get(dialog);
        if (opener && document.body.contains(opener) && typeof opener.focus === "function") {
          opener.focus();
        }
      });
    });
  }

  let confirmAction = null;

  function confirmDialog(title, text, okLabel, onConfirm) {
    $("#confirm-title").textContent = title;
    $("#confirm-text").textContent = text;
    $("#confirm-ok").textContent = okLabel || "Confirmar";
    confirmAction = onConfirm;
    openDialog("confirm-dialog");
    $("#confirm-ok").focus();
  }

  /* ======================================================================
     5. V1 Catalog (HU010, HU011, HU013, HU029, HU030, HU032)
     ====================================================================== */
  function visibleInCatalog(item) {
    if (state.blocked[item.ownerId]) {
      return false;
    }
    if (item.status === "paused" || item.status === "withdrawn") {
      return false;
    }
    // HU013: materials with a confirmed delivery are hidden while "only available" is on
    if (state.filters.onlyAvailable && item.status !== "available") {
      return false;
    }
    return true;
  }

  function matchesQuery(item, query) {
    if (!query) {
      return true;
    }
    const text = normalize([item.title, item.course, item.code, item.category, item.faculty, item.campus, item.point].join(" "));
    return normalize(query).split(/\s+/).every(function (token) {
      return text.indexOf(token) !== -1;
    });
  }

  function filteredMaterials() {
    const f = state.filters;
    const order = { near: 0, mid: 1, far: 2 };
    return state.materials.filter(function (item) {
      return visibleInCatalog(item) &&
        matchesQuery(item, f.query) &&
        (f.faculty.length === 0 || f.faculty.indexOf(item.faculty) !== -1) &&
        (f.category.length === 0 || f.category.indexOf(item.category) !== -1) &&
        (f.campus.length === 0 || f.campus.indexOf(item.campus) !== -1);
    }).sort(function (a, b) {
      const mine = (a.ownerId === "me") - (b.ownerId === "me");
      if (mine) {
        return mine;
      }
      if (f.sort === "rating") {
        return users[b.ownerId].rating - users[a.ownerId].rating;
      }
      if (f.sort === "title") {
        return a.title.localeCompare(b.title, "es");
      }
      return (order[proximityOf(a)] - order[proximityOf(b)]) || (users[b.ownerId].rating - users[a.ownerId].rating);
    });
  }

  function statusBadge(item) {
    const kind = { available: "ok", reserved: "warn", "on-loan": "info", paused: "mute", withdrawn: "mute" }[item.status];
    return '<span class="badge badge--' + kind + '">' + DATA.statusLabel[item.status] + "</span>";
  }

  function materialMedia(item, size) {
    if (item.photo) {
      return '<img src="' + item.photo + '" alt="Foto de ' + escapeHtml(item.title) + '">';
    }
    return icon("book", size);
  }

  function materialCard(item) {
    const owner = users[item.ownerId];
    const proximity = proximityOf(item);
    const mine = item.ownerId === "me";
    let action;
    if (mine) {
      action = '<a class="btn btn--secondary btn--sm btn--block" href="#publish">Tu publicación</a>';
    } else if (item.status === "available") {
      action = '<button class="btn btn--primary btn--sm btn--block" type="button" data-request="' + item.id + '">' +
        (item.modality === "donation" ? "Pedir donación" : item.modality === "exchange" ? "Proponer intercambio" : "Solicitar préstamo") + "</button>";
    } else {
      action = '<button class="btn btn--secondary btn--sm btn--block" type="button" data-notify="' + item.id + '">Avisarme si se libera</button>';
    }
    return '<li class="material-card">' +
      '<div class="material-card__media">' + materialMedia(item) + "</div>" +
      '<div class="material-card__body">' +
        '<div class="material-card__top">' + statusBadge(item) +
          '<span class="rating" aria-label="Calificación del dueño: ' + owner.rating.toFixed(1) + ' de 5">' + icon("star") + owner.rating.toFixed(1) + "</span></div>" +
        '<button class="material-card__button" type="button" data-detail="' + item.id + '"><h3 class="material-card__title">' + escapeHtml(item.title) + "</h3></button>" +
        '<p class="material-card__meta">' + icon("book") + escapeHtml(item.course) + " · " + escapeHtml(item.category) + "</p>" +
        '<p class="material-card__meta' + (proximity === "near" ? " material-card__point--same" : "") + '">' + icon("pin") + escapeHtml(item.point) + "</p>" +
        '<div class="material-card__footer"><span class="proximity proximity--' + proximity + '">' + DATA.proximityLabel[proximity] + "</span>" +
          "<span>" + DATA.modalityLabel[item.modality] + " · " + escapeHtml(owner.name.split(" ")[0] + " " + owner.name.split(" ")[1].charAt(0) + ".") + "</span></div>" +
        '<div class="material-card__actions">' + action + "</div>" +
      "</div></li>";
  }

  function renderCatalog() {
    const results = filteredMaterials();
    const grid = $("#results-grid");
    const query = state.filters.query.trim();
    $("#results-title").textContent = query ? "Resultados para “" + query + "”" : "Todos los materiales";
    $("#results-count").textContent = plural(results.length, "material encontrado", "materiales encontrados");

    if (results.length === 0) {
      grid.innerHTML = '<li class="empty-state"><p class="empty-state__title">No hay materiales disponibles' +
        (query ? " para “" + escapeHtml(query) + "”" : " con estos filtros") + "</p>" +
        "<p>Prueba con otro curso o código, quita algunos filtros o desactiva “Solo disponibles”.</p>" +
        '<button class="btn btn--secondary btn--sm" type="button" data-action="reset-filters">Limpiar búsqueda y filtros</button></li>';
    } else {
      grid.innerHTML = results.map(materialCard).join("");
    }

    const active = state.filters.faculty.length + state.filters.category.length + state.filters.campus.length + (state.filters.onlyAvailable ? 0 : 1);
    const badge = $("#filters-count");
    badge.textContent = active ? String(active) : "";
    badge.hidden = active === 0;
    const total = state.materials.filter(function (item) {
      return item.status === "available" && !state.blocked[item.ownerId];
    }).length;
    $("#catalog-subtitle").textContent = total + " materiales disponibles publicados por estudiantes de tu universidad";
  }

  function renderFilterOptions() {
    const groups = { faculty: "#filter-faculty", category: "#filter-category", campus: "#filter-campus" };
    Object.keys(groups).forEach(function (key) {
      const values = [];
      state.materials.forEach(function (item) {
        if (values.indexOf(item[key]) === -1) {
          values.push(item[key]);
        }
      });
      values.sort(function (a, b) {
        return a.localeCompare(b, "es");
      });
      $(groups[key]).innerHTML = values.map(function (value) {
        return '<label class="checkbox"><input type="checkbox" data-filter="' + key + '" value="' + escapeHtml(value) + '"' +
          (state.filters[key].indexOf(value) !== -1 ? " checked" : "") + "><span>" + escapeHtml(value) + "</span></label>";
      }).join("");
    });
  }

  function resetFilters() {
    state.filters.query = "";
    state.filters.faculty = [];
    state.filters.category = [];
    state.filters.campus = [];
    state.filters.onlyAvailable = true;
    $("#catalog-query").value = "";
    $("#only-available").checked = true;
    renderFilterOptions();
    renderCatalog();
  }

  /* --- HU032: suggestions while typing --- */
  let activeSuggestion = -1;
  let currentSuggestions = [];

  function buildSuggestions(query) {
    const q = normalize(query);
    const found = [];
    function add(label, type, value) {
      if (found.length < 6 && !found.some(function (s) { return s.label === label; }) && normalize(label).indexOf(q) !== -1) {
        found.push({ label: label, type: type, value: value || label });
      }
    }
    const available = state.materials.filter(function (item) {
      return item.status === "available" && !state.blocked[item.ownerId];
    });
    available.forEach(function (item) {
      const count = available.filter(function (other) { return other.course === item.course; }).length;
      add(item.course, "Curso · " + item.code + " · " + plural(count, "material", "materiales"), item.course);
      if (normalize(item.code).indexOf(q) !== -1) {
        add(item.code + " – " + item.course, "Código de curso", item.code);
      }
    });
    available.forEach(function (item) {
      add(item.category, "Categoría");
    });
    available.forEach(function (item) {
      add(item.title, "Material");
    });
    available.forEach(function (item) {
      add(item.point, "Punto de recojo");
    });
    return found;
  }

  function highlight(label, query) {
    const index = normalize(label).indexOf(normalize(query));
    if (index === -1) {
      return escapeHtml(label);
    }
    return escapeHtml(label.slice(0, index)) + "<mark>" + escapeHtml(label.slice(index, index + query.length)) + "</mark>" + escapeHtml(label.slice(index + query.length));
  }

  function renderSuggestions() {
    const input = $("#catalog-query");
    const list = $("#suggestions");
    const query = input.value.trim();
    if (query.length < 2) {
      closeSuggestions();
      return;
    }
    currentSuggestions = buildSuggestions(query);
    activeSuggestion = -1;
    if (currentSuggestions.length === 0) {
      list.innerHTML = '<li class="suggestion" role="option" aria-disabled="true"><span class="suggestion__text">Sin sugerencias para “' + escapeHtml(query) + '”</span></li>';
    } else {
      list.innerHTML = currentSuggestions.map(function (s, index) {
        return '<li class="suggestion" role="option" id="suggestion-' + index + '" data-index="' + index + '" aria-selected="false">' +
          icon("search") + '<span class="suggestion__text">' + highlight(s.label, query) + "</span>" +
          '<span class="suggestion__type">' + escapeHtml(s.type) + "</span></li>";
      }).join("");
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function closeSuggestions() {
    $("#suggestions").hidden = true;
    $("#catalog-query").setAttribute("aria-expanded", "false");
    $("#catalog-query").removeAttribute("aria-activedescendant");
    activeSuggestion = -1;
  }

  function moveSuggestion(step) {
    if ($("#suggestions").hidden || currentSuggestions.length === 0) {
      return;
    }
    activeSuggestion = (activeSuggestion + step + currentSuggestions.length) % currentSuggestions.length;
    $$("#suggestions .suggestion").forEach(function (option, index) {
      option.setAttribute("aria-selected", String(index === activeSuggestion));
    });
    $("#catalog-query").setAttribute("aria-activedescendant", "suggestion-" + activeSuggestion);
  }

  function chooseSuggestion(index) {
    const suggestion = currentSuggestions[index];
    if (!suggestion) {
      return;
    }
    $("#catalog-query").value = suggestion.value;
    runSearch();
  }

  function runSearch() {
    state.filters.query = $("#catalog-query").value;
    closeSuggestions();
    renderCatalog();
  }

  function setupCatalog() {
    const input = $("#catalog-query");
    $("#catalog-search").addEventListener("submit", function (event) {
      event.preventDefault();
      if (activeSuggestion >= 0) {
        chooseSuggestion(activeSuggestion);
      } else {
        runSearch();
      }
    });
    input.addEventListener("input", function () {
      renderSuggestions();
      if (input.value.trim() === "" && state.filters.query) {
        state.filters.query = "";
        renderCatalog();
      }
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSuggestion(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSuggestion(-1);
      } else if (event.key === "Escape") {
        closeSuggestions();
      }
    });
    input.addEventListener("blur", function () {
      setTimeout(closeSuggestions, 150);
    });
    $("#suggestions").addEventListener("mousedown", function (event) {
      const option = event.target.closest("[data-index]");
      if (option) {
        event.preventDefault();
        chooseSuggestion(Number(option.dataset.index));
      }
    });

    $("#filters-panel").addEventListener("change", function (event) {
      const target = event.target;
      if (target.id === "only-available") {
        state.filters.onlyAvailable = target.checked;
      } else if (target.dataset.filter) {
        const list = state.filters[target.dataset.filter];
        const position = list.indexOf(target.value);
        if (target.checked && position === -1) {
          list.push(target.value);
        } else if (!target.checked && position !== -1) {
          list.splice(position, 1);
        }
      }
      renderCatalog();
    });
    $("#filters-reset").addEventListener("click", resetFilters);
    $("#filters-toggle").addEventListener("click", function () {
      const panel = $("#filters-panel");
      const open = panel.classList.toggle("is-open");
      this.setAttribute("aria-expanded", String(open));
    });
    $("#sort-select").addEventListener("change", function () {
      state.filters.sort = this.value;
      renderCatalog();
    });
    $("#my-campus").addEventListener("change", function () {
      state.campus = this.value;
      renderCatalog();
      showToast("Ahora la cercanía se calcula desde la sede " + state.campus + ".", "info");
    });

    $("#results-grid").addEventListener("click", function (event) {
      const detail = event.target.closest("[data-detail]");
      const request = event.target.closest("[data-request]");
      const notify = event.target.closest("[data-notify]");
      if (detail) {
        openDetail(detail.dataset.detail);
      } else if (request) {
        openRequest(request.dataset.request);
      } else if (notify) {
        const item = material(notify.dataset.notify);
        addNotification("Te avisaremos cuando “" + item.title + "” vuelva a estar disponible.", "info", "bell");
        showToast("Listo, te avisaremos cuando “" + item.title + "” se libere.");
      } else if (event.target.closest("[data-action='reset-filters']")) {
        resetFilters();
      }
    });
  }

  /* ======================================================================
     6. V2 Detail (HU012, HU022, HU038, HU044, HU050) + V3 Request (HU014, HU016, HU017)
     ====================================================================== */


  /* ======================================================================
     Init
     ====================================================================== */
  function init() {
    $("#my-initials").textContent = users.me.initials;
    $("#my-name").textContent = users.me.name;
    $("#my-email").textContent = myEmail;

    // HU019: reminders for loans that expire in less than 48 hours
    state.deals.forEach(function (deal) {
      if (deal.role === "borrower" && deal.dueDate.getTime() - Date.now() < 48 * HOUR) {
        const item = material(deal.materialId);
        state.notifications.push({ id: uid("n"), text: "Recordatorio: faltan menos de 48 h para devolver “" + item.title + "” (" + formatDate(deal.dueDate) + ").", kind: "warn", icon: "clock", time: new Date(NOW - 10 * 60000), read: false });
      }
    });
    state.notifications.push(
      { id: uid("n"), text: "Kevin Mendoza y Renato Quispe pidieron tu “Kit de disección”.", kind: "info", icon: "swap", time: new Date(NOW - 2 * HOUR), read: false },
      { id: uid("n"), text: "Lucía Paredes aceptó tu solicitud de “Guía de ejercicios Cálculo”. Entrega en Cafetería – Sede San Isidro.", kind: "ok", icon: "check", time: new Date(NOW - 26 * HOUR), read: true }
    );

    setupDialogs();
    setupPopover("bell-button", "notifications");
    setupPopover("profile-button", "profile-menu");
    $("#notifications-clear").addEventListener("click", function () {
      state.notifications.forEach(function (n) { n.read = true; });
      renderNotifications();
    });
    $("#confirm-form").addEventListener("submit", function (event) {
      event.preventDefault();
      closeDialog("confirm-dialog");
      if (confirmAction) {
        confirmAction();
        confirmAction = null;
      }
    });

    setupCatalog();

    renderFilterOptions();
    renderCatalog();
    renderNotifications();
    window.addEventListener("hashchange", route);
    route();
  }

  init();
})();
