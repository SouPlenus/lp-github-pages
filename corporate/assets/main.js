/* ============================================================
   SouPlenus Corporate — interações
   ============================================================ */
;(function () {
  "use strict"
  /* SouPlenus Corporate interactions v1 */

  /* ---------- Dores: horizontal pinned scroll ---------- */
  var hscroll = document.getElementById("hscroll")
  var hTrack = document.getElementById("hscrollTrack")
  if (hscroll && hTrack) {
    var ticking = false
    function updateHScroll() {
      ticking = false
      // Disabled on small screens (track stacks vertically)
      if (window.matchMedia("(max-width: 940px)").matches) {
        hTrack.style.transform = ""
        return
      }
      var rect = hscroll.getBoundingClientRect()
      var vh = window.innerHeight
      var distance = hscroll.offsetHeight - vh // total vertical scroll inside pin
      var maxShift = hTrack.scrollWidth - window.innerWidth // total horizontal travel
      if (distance <= 0 || maxShift <= 0) {
        hTrack.style.transform = ""
        return
      }
      var progress = Math.min(Math.max(-rect.top / distance, 0), 1)
      hTrack.style.transform = "translate3d(" + -progress * maxShift + "px,0,0)"
    }
    function onHScroll() {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(updateHScroll)
      }
    }
    window.addEventListener("scroll", onHScroll, { passive: true })
    window.addEventListener("resize", updateHScroll)
    updateHScroll()
  }

  /* ---------- Hero specialties marquee ---------- */
  var specialties = [
    "Psicólogos",
    "Nutricionistas",
    "Fisioterapeutas",
    "Psiquiatras",
    "Médicos",
    "Terapeutas integrativos",
  ]
  var specTrack = document.getElementById("specTrack")
  if (specTrack) {
    var specHTML = specialties
      .map(function (s) {
        return '<span class="spec-pill">' + s + "</span>"
      })
      .join("")
    // Each half repeats the set enough to exceed the viewport, so the
    // -50% loop never reveals empty space.
    var specHalf = specHTML + specHTML + specHTML
    specTrack.innerHTML = specHalf + specHalf
  }

  /* ---------- Client logos marquee ---------- */
  var clients = [
    {
      name: "BeTalent",
      src: "https://www.souplenus.com.br/_nuxt/img/betalent-logo.ae67c25.jpg",
    },
    {
      name: "Inove Casa",
      src: "https://www.souplenus.com.br/_nuxt/img/inove-casa-logo.ff7247f.jpeg",
    },
    {
      name: "The Place English School",
      src: "https://www.souplenus.com.br/_nuxt/img/the-place-logo.bc97f55.png",
    },
    {
      name: "Universidade Federal de Pelotas",
      src: "https://www.souplenus.com.br/_nuxt/img/ufpel-logo.4569345.jpeg",
    },
  ]
  var logosTrack = document.getElementById("logosTrack")
  if (logosTrack) {
    var logoHTML = clients
      .map(function (c) {
        return (
          '<span class="client-logo"><img src="' +
          c.src +
          '" alt="' +
          c.name +
          '" /></span>'
        )
      })
      .join("")
    // Each half repeats the set so the -50% loop stays seamless and full.
    var logoHalf = logoHTML + logoHTML + logoHTML
    logosTrack.innerHTML = logoHalf + logoHalf
  }

  /* Plataformas: notification removed (badge moved into SVG) */

  /* ---------- FAQ ---------- */
  var faqs = [
    {
      q: "Minha empresa é pequena, funciona para mim também?",
      a: "Sim. Atendemos empresas <b>a partir de 3 colaboradores</b>. Nosso objetivo é tornar o acesso à saúde mais acessível para pequenas e médias empresas que não conseguem arcar com os planos de saúde tradicionais.",
    },
    {
      q: "Já tenho um plano de saúde. Por que contratar a SouPlenus?",
      a: "A maioria dos planos de saúde <b>não cobre psicologia de forma ampla</b> — e quando cobre, tem carência, lista de espera e rede limitada. Nossa plataforma oferece <b>acesso imediato</b> a psicólogos e outros profissionais da saúde, com <b>agendamento direto pela plataforma</b>.",
    },
    {
      q: "Quanto custa para a empresa?",
      a: "O número de colaboradores incluídos no benefício determina a faixa de investimento que a empresa fará mensalmente. Preencha o formulário e <b>solicite sua cotação gratuita</b>.",
    },
    {
      q: "Quanto custa para o colaborador?",
      a: "O colaborador paga um <b>valor fixo reduzido</b> em consultas com psicólogos e nutricionistas. Além disso, oferecemos <b>descontos exclusivos</b> em medicina, psiquiatria e fisioterapia.",
    },
    {
      q: "A empresa é obrigada a subsidiar as consultas dos colaboradores?",
      a: "<b>Não.</b> A empresa paga um <b>valor fixo por colaborador</b>, sem precisar subsidiar o valor total ou parcial das consultas, gerando <b>previsibilidade e economia</b> para a empresa.",
    },
    {
      q: "Posso oferecer o benefício só para alguns colaboradores?",
      a: "Sim. <b>A empresa define quem será incluído</b> no programa — pode ser apenas a liderança, um departamento específico ou toda a equipe.",
    },
    {
      q: "O programa cobre apenas saúde mental ou outras especialidades também?",
      a: "Além de psicólogos e psiquiatras, oferecemos atendimentos com <b>nutricionistas, fisioterapeutas, médicos gerais e terapeutas integrativos</b>.",
    },
    {
      q: "Como a SouPlenus Corporate regulariza minha empresa conforme a NR-1?",
      a: "A SouPlenus Corporate é uma <b>medida de prevenção a riscos psicossociais</b>, que pode ser documentada junto ao plano de ação do <b>Programa de Gerenciamento de Riscos (PGR)</b>. Isso contribui diretamente para a <b>conformidade com a NR-1</b>.",
    },
    {
      q: "Os dados dos colaboradores ficam seguros?",
      a: "Sim. Todas as informações são tratadas com <b>sigilo</b> e em <b>conformidade com a LGPD</b>. Os dados são confidenciais, utilizados internamente apenas para fins informativos, de atendimento e suporte ao colaborador.",
    },
    {
      q: "Os profissionais são qualificados e monitorados?",
      a: "Sim. Todos os profissionais parceiros passam por um <b>processo de verificação</b> e são <b>monitorados continuamente</b> pela SouPlenus para garantir a qualidade dos atendimentos.",
    },
    {
      q: "Quanto tempo leva para o programa estar ativo após a contratação?",
      a: "Após o envio da lista de colaboradores, os acessos serão ativados em <b>até 1 dia útil</b>. Em seguida, entraremos em contato com os colaboradores orientando a utilização da plataforma.",
    },
    {
      q: "Em casos de demissão ou contratação, como funciona?",
      a: "Quando ocorrer contratação ou demissão de algum colaborador, basta <b>atualizar a lista de colaboradores beneficiados</b>.",
    },
    {
      q: "Como é realizado o pagamento da consulta?",
      a: "O pagamento é realizado <b>diretamente pelo colaborador</b> no ato do agendamento pela plataforma, por meio de <b>Pix ou Cartão de Crédito</b>.",
    },
    {
      q: "Tem atendimento fora de Pelotas/RS?",
      a: "Sim. As <b>consultas online</b> atendem colaboradores em <b>qualquer cidade do Brasil</b>. O atendimento presencial está disponível em Pelotas/RS.",
    },
  ]

  var faqGrid = document.getElementById("faqGrid")
  if (faqGrid) {
    faqs.forEach(function (item, i) {
      var wrap = document.createElement("div")
      wrap.className = "faq-item"
      wrap.innerHTML =
        '<button class="faq-q" aria-expanded="false">' +
        item.q +
        '<span class="pm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg></span>' +
        "</button>" +
        '<div class="faq-a"><div class="faq-a-inner">' +
        item.a +
        "</div></div>"
      faqGrid.appendChild(wrap)

      var btn = wrap.querySelector(".faq-q")
      var panel = wrap.querySelector(".faq-a")
      btn.addEventListener("click", function () {
        var isOpen = wrap.classList.contains("open")
        // close all
        faqGrid.querySelectorAll(".faq-item.open").forEach(function (el) {
          el.classList.remove("open")
          el.querySelector(".faq-a").style.maxHeight = null
          el.querySelector(".faq-q").setAttribute("aria-expanded", "false")
        })
        if (!isOpen) {
          wrap.classList.add("open")
          panel.style.maxHeight = panel.scrollHeight + "px"
          btn.setAttribute("aria-expanded", "true")
        }
      })
    })
  }

  /* ---------- Form validation ---------- */
  var form = document.getElementById("cotacaoForm")
  var success = document.getElementById("formSuccess")

  /* ---------- WhatsApp phone mask: (53) 99999-9999 ---------- */
  var whatsapp = document.getElementById("whatsapp")
  if (whatsapp) {
    function maskPhone(value) {
      var d = value.replace(/\D/g, "").slice(0, 11)
      if (d.length === 0) return ""
      var out = "(" + d.slice(0, 2)
      if (d.length < 2) return out
      out += ") "
      if (d.length <= 6) {
        out += d.slice(2)
      } else if (d.length <= 10) {
        // landline: (53) 3307-6016
        out += d.slice(2, 6) + "-" + d.slice(6)
      } else {
        // mobile: (53) 99106-6960
        out += d.slice(2, 7) + "-" + d.slice(7)
      }
      return out
    }
    whatsapp.addEventListener("input", function () {
      var start = this.selectionStart
      var beforeLen = this.value.length
      this.value = maskPhone(this.value)
      // keep caret near the end when typing at the end
      if (start >= beforeLen) {
        this.setSelectionRange(this.value.length, this.value.length)
      }
    })
    whatsapp.addEventListener("keydown", function (e) {
      // allow Backspace to remove formatting smoothly
      if (e.key === "Backspace" && /[\s()\-]$/.test(this.value)) {
        this.value = this.value.replace(/[\s()\-]+$/, "")
      }
    })
  }

  if (form) {
    function validateField(field) {
      var input = field.querySelector("input, select")
      var ok = true
      var val = (input.value || "").trim()
      if (!val) ok = false
      else if (input.type === "email")
        ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
      else if (input.type === "tel") ok = val.replace(/\D/g, "").length >= 10
      field.classList.toggle("error", !ok)
      return ok
    }

    form
      .querySelectorAll(".field input, .field select")
      .forEach(function (input) {
        input.addEventListener("blur", function () {
          validateField(input.closest(".field"))
        })
        input.addEventListener("input", function () {
          var f = input.closest(".field")
          if (f.classList.contains("error")) validateField(f)
        })
      })

    var SHEETS_URL =
      "https://script.google.com/macros/s/AKfycbz0G94vFRZY6QTEdB5HyUJv5TAQcpeCLI5f1-KHHRl_yKD0gj_8Y84tfuzrJiQuYMEt0Q/exec"

    form.addEventListener("submit", function (e) {
      e.preventDefault()
      var fields = form.querySelectorAll(".field")
      var allOk = true
      fields.forEach(function (f) {
        if (!validateField(f)) allOk = false
      })
      if (!allOk) {
        var firstError = form.querySelector(
          ".field.error input, .field.error select",
        )
        if (firstError) firstError.focus()
        return
      }

      var submitBtn = form.querySelector("[type=submit]")
      submitBtn.disabled = true
      submitBtn.textContent = "Enviando…"

      var payload = {
        nome: document.getElementById("nome").value.trim(),
        whatsapp: document.getElementById("whatsapp").value.trim(),
        email: document.getElementById("email").value.trim(),
        empresa: document.getElementById("empresa").value.trim(),
        colaboradores: document.getElementById("colaboradores").value,
        plano: document.getElementById("plano").value,
      }

      fetch(SHEETS_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      })
        .catch(function () {
          // silently ignore network errors — lead already captured server-side
        })
        .finally(function () {
          form.style.display = "none"
          success.classList.add("show")

          if (typeof gtag === "function") {
            gtag("event", "conversion", { send_to: "AW-10777868214/_RsaCKnljLgcELbvpJMo" })
          }

          var msg = encodeURIComponent(
            "Olá, me chamo " +
              payload.nome +
              " e quero saber mais informações sobre a SouPlenus Corporate.",
          )
          window.open("https://wa.me/5553991818805?text=" + msg, "_blank")
        })
    })
  }
})()
